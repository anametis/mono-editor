import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { SMTPServer } from "smtp-server";
import { Database } from "@kara/platform-database";
import { ContentService } from "@kara/content-server";
import { roles, type Principal } from "@kara/permissions";
import { createApp } from "../apps/api/src/bootstrap";
if (!process.env.DATABASE_URL?.includes("kara_test"))
  throw new Error("Integration tests require an isolated kara_test database");
const db = new Database();
await db.$connect();
const run = randomUUID().slice(0, 8);
const createdUserIds: string[] = [];
const posts: string[] = [];
const creator: Principal = { id: `creator-${run}`, permissions: roles.creator };
const reviewer: Principal = {
  id: `reviewer-${run}`,
  permissions: roles.publisher,
};
const service = new ContentService(db);
let app: Awaited<ReturnType<typeof createApp>> | undefined;
let mailServer: SMTPServer | undefined;
try {
  const { id } = await service.create(creator, {
    slug: `test-${run}`,
    title: "Original title",
    summary: "Public summary",
    body: "Original body",
  });
  posts.push(id);
  let revision = await db.revision.findFirstOrThrow({ where: { postId: id } });
  await assert.rejects(service.publicPost(`test-${run}`));
  await assert.rejects(
    service.mutate({ ...creator, id: "outsider" }, revision.id, "edit", {
      title: "x",
      summary: "x",
      body: "x",
      version: 1,
    }),
  );
  await service.mutate(creator, revision.id, "submit");
  await assert.rejects(
    service.mutate(
      { ...creator, permissions: roles.administrator },
      revision.id,
      "approve",
    ),
  );
  await service.mutate(reviewer, revision.id, "approve");
  await service.mutate(
    reviewer,
    revision.id,
    "schedule",
    new Date(Date.now() + 60000),
  );
  assert.equal(await service.publishDue(), 0, "Never publish early");
  await service.mutate(reviewer, revision.id, "cancel");
  await db.revision.update({
    where: { id: revision.id },
    data: { scheduledAt: new Date(Date.now() - 1000) },
  });
  assert.equal(await service.publishDue(), 0, "Cancelled work stays cancelled");
  await service.mutate(
    reviewer,
    revision.id,
    "schedule",
    new Date(Date.now() + 60000),
  );
  await db.revision.update({
    where: { id: revision.id },
    data: { scheduledAt: new Date(Date.now() - 1000) },
  });
  const results = await Promise.all([
    service.publishDue(),
    service.publishDue(),
  ]);
  assert.equal(
    results.reduce((a, b) => a + b, 0),
    1,
    "Concurrent workers publish exactly once",
  );
  const publicPost = await service.publicPost(`test-${run}`);
  assert.equal(publicPost.title, "Original title");
  assert.equal("ownerId" in publicPost, false);
  revision = await db.revision.findUniqueOrThrow({
    where: { id: revision.id },
  });
  const edited = await service.mutate(creator, revision.id, "edit", {
    title: "Unapproved title",
    summary: "Changed summary",
    body: "Changed body",
    version: revision.version,
  });
  assert.equal(
    (await service.publicPost(`test-${run}`)).title,
    "Original title",
    "Edits never change published text",
  );
  await service.mutate(creator, edited.id, "submit");
  await service.mutate(reviewer, edited.id, "approve");
  const approved = await db.revision.findUniqueOrThrow({
    where: { id: edited.id },
  });
  await service.mutate(creator, edited.id, "edit", {
    title: "Changed after approval",
    summary: "Summary",
    body: "Body",
    version: approved.version,
  });
  const draft = await db.revision.findUniqueOrThrow({
    where: { id: edited.id },
  });
  assert.equal(draft.status, "DRAFT");
  assert.equal(draft.approvedAt, null);
  assert.equal(await service.publicationLagSeconds(), 0);
  assert.equal(
    (await service.sitemapEntries(1)).some((p) => p.slug === `test-${run}`),
    true,
  );
  await assert.rejects(service.mutate(reviewer, edited.id, "publish"));
  console.log(
    "PASS publishing: ownership, review, concurrency, cancellation, revisions",
  );
  const messages: string[] = [];
  mailServer = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onData(stream, _session, callback) {
      let body = "";
      stream.on("data", (chunk) => (body += chunk.toString()));
      stream.on("end", () => {
        messages.push(body.replace(/=\r?\n/g, "").replace(/=3D/g, "="));
        callback();
      });
    },
  });
  await new Promise<void>((resolve) =>
    mailServer!.listen(1026, "127.0.0.1", resolve),
  );
  process.env.SMTP_PORT = "1026";
  process.env.AUTH_URL = "http://localhost:4017/api/auth";
  process.env.TRUSTED_ORIGINS = "http://localhost:4017";
  app = await createApp();
  await app.listen(4017, "127.0.0.1");
  const cookies = new Map<string, string>();
  async function call(
    path: string,
    body?: object,
    origin = "http://localhost:4017",
  ) {
    const response = await fetch(`http://127.0.0.1:4017${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        origin,
        "content-type": "application/json",
        cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0]!;
      const split = pair.indexOf("=");
      cookies.set(pair.slice(0, split), pair.slice(split + 1));
    }
    const data = await response.json().catch(() => ({}));
    return { response, data };
  }
  const password = "Strong-password-7291!";
  const username = `staff_${run}`;
  const signup = await call("/api/auth/sign-up/email", {
    email: `${username}@example.test`,
    name: "Integration staff",
    username,
    password,
  });
  assert.equal(signup.response.status, 200, JSON.stringify(signup.data));
  const user = await db.user.findUniqueOrThrow({ where: { username } });
  createdUserIds.push(user.id);
  const verification = messages
    .find((m) => m.includes("verify-email"))
    ?.match(/https?:\/\/[^\s<>]+verify-email[^\s<>]*/)?.[0];
  assert(verification, "A real verification email must be delivered");
  const verify = await fetch(verification!.replace("localhost", "127.0.0.1"), {
    redirect: "manual",
  });
  assert(verify.status < 400);
  await db.staff.create({
    data: { userId: user.id, permissions: roles.administrator },
  });
  const signed = await call("/api/auth/sign-in/username", {
    username,
    password,
  });
  assert.equal(signed.response.status, 200, JSON.stringify(signed.data));
  assert.equal(
    (await call("/api/identity/access")).response.status,
    403,
    "Password-only staff session denied",
  );
  const enabled = await call("/api/auth/two-factor/enable", { password });
  assert.equal(enabled.response.status, 200, JSON.stringify(enabled.data));
  const sent = await call("/api/auth/two-factor/send-otp", {});
  assert.equal(sent.response.status, 200, JSON.stringify(sent.data));
  const otp = messages.at(-1)?.match(/Your code is (\d{6})/)?.[1];
  assert(otp, "OTP delivered over SMTP");
  const verified = await call("/api/auth/two-factor/verify-otp", {
    code: otp,
    trustDevice: false,
  });
  assert.equal(verified.response.status, 200, JSON.stringify(verified.data));
  assert.equal(
    (await call("/api/identity/access")).response.status,
    200,
    "Verified staff session allowed",
  );
  await call("/api/auth/sign-out", {});
  cookies.clear();
  const challenge = await call("/api/auth/sign-in/username", {
    username,
    password,
  });
  assert.equal(challenge.data.twoFactorRedirect, true);
  assert.equal(
    (await call("/api/identity/access")).response.status,
    401,
    "Pending OTP cannot access staff routes",
  );
  await call("/api/auth/two-factor/send-otp", {});
  const nextOtp = messages.at(-1)?.match(/Your code is (\d{6})/)?.[1];
  assert(nextOtp);
  const complete = await call("/api/auth/two-factor/verify-otp", {
    code: nextOtp,
    trustDevice: false,
  });
  assert.equal(complete.response.status, 200, JSON.stringify(complete.data));
  assert.equal((await call("/api/identity/access")).response.status, 200);
  const invitation = await call("/api/identity/invitations", {
    email: user.email,
    role: "creator",
  });
  assert.equal(invitation.response.status, 201);
  const inviteToken = new URL(invitation.data.invitationUrl).searchParams.get(
    "invite",
  );
  assert.equal(
    (await call("/api/identity/invitations/accept", { token: inviteToken }))
      .response.status,
    201,
  );
  assert.equal(
    (await call("/api/identity/invitations/accept", { token: inviteToken }))
      .response.status,
    400,
    "Invitation cannot be reused",
  );
  assert.equal(
    (await call("/api/identity/access")).response.status,
    403,
    "Permission changes require a new second step",
  );
  assert.equal(
    (
      await call(
        "/api/editorial/posts",
        { slug: "x", title: "x", summary: "x", body: "x" },
        "https://evil.test",
      )
    ).response.status,
    403,
    "Cross-origin mutation denied",
  );
  console.log(
    "PASS authentication: verified email, username/password, OTP enrollment and login, staff guard, CSRF",
  );
} finally {
  await app?.close();
  await new Promise<void>((resolve) =>
    mailServer ? mailServer.close(() => resolve()) : resolve(),
  );
  await db.post.updateMany({
    where: { id: { in: posts } },
    data: { publishedRevisionId: null },
  });
  await db.post.deleteMany({ where: { id: { in: posts } } });
  await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await db.staffInvitation.deleteMany({
    where: { invitedBy: { in: createdUserIds } },
  });
  await db.auditEvent.deleteMany({
    where: {
      OR: [
        { actorId: { in: [creator.id, reviewer.id, ...createdUserIds] } },
        { resourceId: { in: posts } },
      ],
    },
  });
  await db.$disconnect();
}
