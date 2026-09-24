import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
} from "@nestjs/swagger";
import { StaffGuard, type ActorRequest } from "@kara/platform-auth";
import { SkipThrottle } from "@nestjs/throttler";
import { ContentService } from "../application/content.service";
import {
  AssignInput,
  CreatePostInput,
  EditInput,
  EditorialPostDto,
  PageQuery,
  PublicPostDto,
  PublicPostSummaryDto,
  ScheduleInput,
} from "./dto";
export class IdDto {
  @ApiProperty() id!: string;
}
class SitemapCountDto {
  @ApiProperty() count!: number;
}
class SitemapEntryDto {
  @ApiProperty() slug!: string;
  @ApiProperty() publishedAt!: string;
}
@ApiTags("public-content")
@Controller("discovery")
@SkipThrottle()
export class DiscoveryController {
  constructor(private readonly content: ContentService) {}
  @Get("count") @ApiOkResponse({ type: SitemapCountDto }) count() {
    return this.content.sitemapCount();
  }
  @Get("entries") @ApiOkResponse({ type: [SitemapEntryDto] }) entries(
    @Query() query: PageQuery,
  ) {
    return this.content.sitemapEntries(query.page ?? 1);
  }
}
@ApiTags("public-content")
@Controller("posts")
@SkipThrottle()
export class PublicContentController {
  constructor(private readonly content: ContentService) {}
  @Get() @ApiOkResponse({ type: [PublicPostSummaryDto] }) list(
    @Query() query: PageQuery,
  ) {
    return this.content.listPublic(query.page);
  }
  @Get(":slug") @ApiOkResponse({ type: PublicPostDto }) get(
    @Param("slug") slug: string,
  ) {
    return this.content.publicPost(slug);
  }
}
@ApiTags("editorial")
@UseGuards(StaffGuard)
@Controller("editorial")
export class EditorialController {
  constructor(private readonly content: ContentService) {}
  @Get("posts") @ApiOkResponse({ type: [EditorialPostDto] }) list(
    @Req() req: ActorRequest,
    @Query() query: PageQuery,
  ) {
    return this.content.listEditorial(req.actor, query.page);
  }
  @Post("posts") @ApiCreatedResponse({ type: IdDto }) create(
    @Req() req: ActorRequest,
    @Body() input: CreatePostInput,
  ) {
    return this.content.create(req.actor, input);
  }
  @Patch("posts/:id/assignment") assign(
    @Req() req: ActorRequest,
    @Param("id") id: string,
    @Body() input: AssignInput,
  ) {
    return this.content.assign(req.actor, id, input.userId);
  }
  @Patch("revisions/:id") @ApiOkResponse({ type: IdDto }) edit(
    @Req() req: ActorRequest,
    @Param("id") id: string,
    @Body() input: EditInput,
  ) {
    return this.content.mutate(req.actor, id, "edit", input);
  }
  @Post("revisions/:id/submit") @ApiCreatedResponse({ type: IdDto }) submit(
    @Req() req: ActorRequest,
    @Param("id") id: string,
  ) {
    return this.content.mutate(req.actor, id, "submit");
  }
  @Post("revisions/:id/approve") @ApiCreatedResponse({ type: IdDto }) approve(
    @Req() req: ActorRequest,
    @Param("id") id: string,
  ) {
    return this.content.mutate(req.actor, id, "approve");
  }
  @Post("revisions/:id/publish") @ApiCreatedResponse({ type: IdDto }) publish(
    @Req() req: ActorRequest,
    @Param("id") id: string,
  ) {
    return this.content.mutate(req.actor, id, "publish");
  }
  @Post("revisions/:id/schedule") @ApiCreatedResponse({ type: IdDto }) schedule(
    @Req() req: ActorRequest,
    @Param("id") id: string,
    @Body() input: ScheduleInput,
  ) {
    return this.content.mutate(
      req.actor,
      id,
      "schedule",
      new Date(input.scheduledAt),
    );
  }
  @Post("revisions/:id/cancel") @ApiCreatedResponse({ type: IdDto }) cancel(
    @Req() req: ActorRequest,
    @Param("id") id: string,
  ) {
    return this.content.mutate(req.actor, id, "cancel");
  }
}
