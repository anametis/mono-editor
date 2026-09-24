import {
  Controller,
  Delete,
  Get,
  Module,
  NotFoundException,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { Database, DatabaseModule } from "@kara/platform-database";
import {
  AuthModule,
  SessionGuard,
  type ActorRequest,
} from "@kara/platform-auth";
class Page {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
}
class BookmarkDto {
  @ApiProperty() postId!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
}
@ApiTags("interactions")
@UseGuards(SessionGuard)
@Controller("bookmarks")
class BookmarkController {
  constructor(private readonly db: Database) {}
  @Get() @ApiOkResponse({ type: [BookmarkDto] }) async list(
    @Req() req: ActorRequest,
    @Query() query: Page,
  ) {
    const saved = await this.db.bookmark.findMany({
      where: {
        userId: req.actor.id,
        post: { publishedRevisionId: { not: null } },
      },
      select: {
        postId: true,
        post: {
          select: {
            slug: true,
            publishedRevision: { select: { title: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * 20,
      take: 20,
    });
    return saved.map((b) => ({
      postId: b.postId,
      slug: b.post.slug,
      title: b.post.publishedRevision!.title,
    }));
  }
  @Put(":postId") async save(
    @Req() req: ActorRequest,
    @Param("postId") postId: string,
  ) {
    const post = await this.db.post.findFirst({
      where: { id: postId, publishedRevisionId: { not: null } },
      select: { id: true },
    });
    if (!post) throw new NotFoundException();
    await this.db.bookmark.upsert({
      where: { userId_postId: { userId: req.actor.id, postId } },
      create: { userId: req.actor.id, postId },
      update: {},
    });
    return { success: true };
  }
  @Delete(":postId") async remove(
    @Req() req: ActorRequest,
    @Param("postId") postId: string,
  ) {
    await this.db.bookmark.deleteMany({
      where: { userId: req.actor.id, postId },
    });
    return { success: true };
  }
}
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [BookmarkController],
})
export class InteractionsModule {}
