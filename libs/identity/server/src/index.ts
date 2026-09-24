import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Module,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsEmail, IsIn, IsString, Length } from "class-validator";
import { createHash, randomBytes } from "node:crypto";
import { Database, DatabaseModule } from "@kara/platform-database";
import {
  AuthModule,
  SessionGuard,
  StaffGuard,
  type ActorRequest,
} from "@kara/platform-auth";
import { roles } from "@kara/permissions";
class InviteInput {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty({ enum: Object.keys(roles) })
  @IsIn(Object.keys(roles))
  role!: keyof typeof roles;
}
class AcceptInput {
  @ApiProperty() @IsString() @Length(64, 64) token!: string;
}
class AccessDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: [String] }) permissions!: string[];
}
class InvitationDto {
  @ApiProperty() invitationUrl!: string;
}
@ApiTags("identity")
@Controller("identity")
class IdentityController {
  constructor(private readonly db: Database) {}
  @Get("access")
  @UseGuards(StaffGuard)
  @ApiOkResponse({ type: AccessDto })
  access(@Req() req: ActorRequest) {
    return req.actor;
  }
  @Post("invitations")
  @UseGuards(StaffGuard)
  @ApiOkResponse({ type: InvitationDto })
  async invite(@Req() req: ActorRequest, @Body() body: InviteInput) {
    if (!req.actor.permissions.includes("staff:manage"))
      throw new ForbiddenException();
    const token = randomBytes(32).toString("hex");
    await this.db.$transaction(async (tx) => {
      const invitation = await tx.staffInvitation.create({
        data: {
          email: body.email.toLowerCase(),
          tokenHash: createHash("sha256").update(token).digest("hex"),
          permissions: roles[body.role],
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          invitedBy: req.actor.id,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: req.actor.id,
          action: "staff:invite",
          resourceId: invitation.id,
        },
      });
    });
    // Deliver this one-time link through the organization's trusted invitation channel.
    return {
      invitationUrl: `${process.env.ADMIN_URL ?? "http://localhost:4200"}/?invite=${token}`,
    };
  }
  @Post("invitations/accept") @UseGuards(SessionGuard) async accept(
    @Req() req: ActorRequest,
    @Body() body: AcceptInput,
  ) {
    const hash = createHash("sha256").update(body.token).digest("hex");
    await this.db.$transaction(async (tx) => {
      const invitation = await tx.staffInvitation.findUnique({
        where: { tokenHash: hash },
      });
      const user = await tx.user.findUniqueOrThrow({
        where: { id: req.actor.id },
      });
      if (
        !invitation ||
        invitation.acceptedAt ||
        invitation.expiresAt < new Date() ||
        invitation.email !== user.email.toLowerCase()
      )
        throw new BadRequestException("Invitation is invalid or expired");
      const result = await tx.staffInvitation.updateMany({
        where: {
          id: invitation.id,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date() },
      });
      if (result.count !== 1)
        throw new BadRequestException("Invitation was already used");
      await tx.staff.upsert({
        where: { userId: user.id },
        create: { userId: user.id, permissions: invitation.permissions },
        update: { permissions: invitation.permissions },
      });
      await tx.session.updateMany({
        where: { userId: user.id },
        data: { mfaVerified: false },
      });
      await tx.auditEvent.create({
        data: {
          actorId: user.id,
          action: "staff:accept-invitation",
          resourceId: invitation.id,
        },
      });
    });
    return { success: true };
  }
}
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [IdentityController],
})
export class IdentityModule {}
