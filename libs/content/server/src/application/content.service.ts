import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Database, Prisma } from "@kara/platform-database";
import type { Principal } from "@kara/permissions";
import { requireEditor, requirePermission } from "../policies/access";
import type { CreatePostInput, EditInput } from "../http/dto";
import { randomUUID } from "node:crypto";
@Injectable()
export class ContentService {
  constructor(private readonly db: Database) {}
  async sitemapCount() {
    return {
      count: await this.db.post.count({
        where: { publishedRevisionId: { not: null } },
      }),
    };
  }
  async sitemapEntries(page: number) {
    const posts = await this.db.post.findMany({
      where: { publishedRevisionId: { not: null } },
      select: {
        slug: true,
        publishedRevision: { select: { publishedAt: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * 1000,
      take: 1000,
    });
    return posts.map((p) => ({
      slug: p.slug,
      publishedAt: p.publishedRevision!.publishedAt!.toISOString(),
    }));
  }
  async listPublic(page = 1) {
    const posts = await this.db.post.findMany({
      where: { publishedRevisionId: { not: null } },
      select: {
        id: true,
        slug: true,
        publishedRevision: {
          select: { title: true, summary: true, publishedAt: true },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * 20,
      take: 20,
    });
    return posts.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.publishedRevision!.title,
      summary: p.publishedRevision!.summary,
      publishedAt: p.publishedRevision!.publishedAt!.toISOString(),
    }));
  }
  async publicPost(slug: string) {
    const post = await this.db.post.findUnique({
      where: { slug },
      include: { publishedRevision: true },
    });
    if (!post?.publishedRevision) throw new NotFoundException();
    return this.publicView(post);
  }
  private publicView(
    post: Prisma.PostGetPayload<{ include: { publishedRevision: true } }>,
  ) {
    const r = post.publishedRevision!;
    return {
      id: post.id,
      slug: post.slug,
      title: r.title,
      summary: r.summary,
      body: r.body,
      publishedAt: r.publishedAt!.toISOString(),
    };
  }
  async listEditorial(actor: Principal, page = 1) {
    const broad = actor.permissions.some((p) =>
      ["post:review", "post:publish", "post:assign"].includes(p),
    );
    if (!broad) requirePermission(actor, "post:create");
    const posts = await this.db.post.findMany({
      where: broad
        ? {}
        : { OR: [{ ownerId: actor.id }, { assignedToId: actor.id }] },
      include: { revisions: { orderBy: { createdAt: "desc" }, take: 20 } },
      orderBy: { createdAt: "desc" },
      take: 20,
      skip: (page - 1) * 20,
    });
    return posts.map((p) => ({
      id: p.id,
      slug: p.slug,
      ownerId: p.ownerId,
      assignedToId: p.assignedToId,
      revisions: p.revisions.map((r) => ({
        id: r.id,
        title: r.title,
        summary: r.summary,
        body: r.body,
        status: r.status,
        version: r.version,
        scheduledAt: r.scheduledAt?.toISOString() ?? null,
      })),
    }));
  }
  async create(actor: Principal, input: CreatePostInput) {
    requirePermission(actor, "post:create");
    try {
      return await this.db.$transaction(async (tx) => {
        const post = await tx.post.create({
          data: {
            // The composite publication relation shares id; supply it before nested writes.
            id: randomUUID(),
            slug: input.slug,
            ownerId: actor.id,
            revisions: {
              create: {
                title: input.title,
                summary: input.summary,
                body: input.body,
              },
            },
          },
        });
        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            action: "post:create",
            resourceId: post.id,
          },
        });
        return { id: post.id };
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      )
        throw new ConflictException("This slug is already used");
      throw e;
    }
  }
  async mutate(
    actor: Principal,
    revisionId: string,
    action: "edit" | "submit" | "approve" | "schedule" | "publish" | "cancel",
    input?: EditInput | Date,
  ) {
    return this.db.$transaction(async (tx) => {
      const initial = await tx.revision.findUnique({
        where: { id: revisionId },
      });
      if (!initial) throw new NotFoundException();
      await tx.$queryRaw`SELECT id FROM "Post" WHERE id = ${initial.postId} FOR UPDATE`;
      const r = await tx.revision.findUniqueOrThrow({
        where: { id: revisionId },
        include: { post: true },
      });
      if (action === "edit" || action === "submit")
        requireEditor(actor, r.post);
      else
        requirePermission(
          actor,
          action === "approve" ? "post:review" : "post:publish",
        );
      if (
        action === "approve" &&
        (actor.id === r.post.ownerId || actor.id === r.post.assignedToId)
      )
        throw new ForbiddenException(
          "Another staff member must review this post",
        );
      const now = new Date();
      let result;
      if (action === "edit") {
        const edit = input as EditInput;
        if (r.version !== edit.version)
          throw new ConflictException(
            "The revision changed; reload before editing",
          );
        const data = {
          title: edit.title,
          summary: edit.summary,
          body: edit.body,
        };
        if (r.status === "PUBLISHED") {
          const existing = await tx.revision.findFirst({
            where: { postId: r.postId, status: { not: "PUBLISHED" } },
          });
          if (existing)
            throw new ConflictException("Edit the existing working revision");
          result = await tx.revision.create({
            data: { ...data, postId: r.postId },
          });
        } else
          result = await tx.revision.update({
            where: { id: r.id },
            data: {
              ...data,
              status: "DRAFT",
              approvedAt: null,
              approvedBy: null,
              scheduledAt: null,
              version: { increment: 1 },
            },
          });
      } else {
        const allowed = {
          submit: ["DRAFT"],
          approve: ["SUBMITTED"],
          schedule: ["APPROVED"],
          publish: ["APPROVED"],
          cancel: ["SCHEDULED"],
        };
        if (!allowed[action].includes(r.status))
          throw new ConflictException("Invalid revision transition");
        if (
          action === "schedule" &&
          (!(input instanceof Date) ||
            !Number.isFinite(input.getTime()) ||
            input <= now)
        )
          throw new BadRequestException("Choose a future publication time");
        const data: Prisma.RevisionUpdateInput =
          action === "submit"
            ? { status: "SUBMITTED" }
            : action === "approve"
              ? { status: "APPROVED", approvedBy: actor.id, approvedAt: now }
              : action === "schedule"
                ? { status: "SCHEDULED", scheduledAt: input as Date }
                : action === "cancel"
                  ? { status: "APPROVED", scheduledAt: null }
                  : { status: "PUBLISHED", publishedAt: now };
        result = await tx.revision.update({
          where: { id: r.id },
          data: { ...data, version: { increment: 1 } },
        });
        if (action === "publish")
          await tx.post.update({
            where: { id: r.postId },
            data: { publishedRevisionId: r.id },
          });
      }
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: "revision:" + action,
          resourceId: result.id,
        },
      });
      return { id: result.id };
    });
  }
  async assign(actor: Principal, postId: string, userId: string) {
    requirePermission(actor, "post:assign");
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Post" WHERE id = ${postId} FOR UPDATE`;
      const staff = await tx.staff.findUnique({ where: { userId } });
      if (!staff?.permissions.includes("post:create"))
        throw new BadRequestException("Assign to an invited creator");
      await tx.post.update({
        where: { id: postId },
        data: { assignedToId: userId },
      });
      await tx.auditEvent.create({
        data: { actorId: actor.id, action: "post:assign", resourceId: postId },
      });
    });
  }
  async publishDue() {
    const due = await this.db.revision.findMany({
      where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: 100,
      select: { id: true, postId: true },
    });
    let published = 0;
    for (const candidate of due) {
      published += await this.db.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM "Post" WHERE id = ${candidate.postId} FOR UPDATE SKIP LOCKED`;
        if (!locked.length) return 0;
        const r = await tx.revision.findUniqueOrThrow({
          where: { id: candidate.id },
        });
        const now = new Date();
        if (
          r.status !== "SCHEDULED" ||
          !r.approvedAt ||
          !r.approvedBy ||
          !r.scheduledAt ||
          r.scheduledAt > now
        )
          return 0;
        await tx.revision.update({
          where: { id: r.id },
          data: {
            status: "PUBLISHED",
            publishedAt: now,
            version: { increment: 1 },
          },
        });
        await tx.post.update({
          where: { id: r.postId },
          data: { publishedRevisionId: r.id },
        });
        await tx.auditEvent.create({
          data: {
            actorId: "worker",
            action: "revision:publish",
            resourceId: r.id,
          },
        });
        return 1;
      });
    }
    return published;
  }
  async publicationLagSeconds() {
    const oldest = await this.db.revision.findFirst({
      where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      select: { scheduledAt: true },
    });
    return oldest?.scheduledAt
      ? Math.max(0, (Date.now() - oldest.scheduledAt.getTime()) / 1000)
      : 0;
  }
}
