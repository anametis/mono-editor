import { Database } from "@kara/platform-database";
import { roles } from "@kara/permissions";
const email = process.argv[2];
if (!email) throw new Error("Usage: pnpm bootstrap:staff <verified-email>");
const db = new Database();
try {
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(710419)`;
    if (await tx.staff.count())
      throw new Error("A staff account already exists. Use an invitation.");
    const user = await tx.user.findUniqueOrThrow({ where: { email } });
    if (!user.emailVerified) throw new Error("Verify the email first");
    await tx.staff.create({
      data: { userId: user.id, permissions: roles.administrator },
    });
    await tx.session.updateMany({
      where: { userId: user.id },
      data: { mfaVerified: false },
    });
    await tx.auditEvent.create({
      data: {
        actorId: "bootstrap",
        action: "staff:bootstrap",
        resourceId: user.id,
      },
    });
  });
  console.log(
    "Initial administrator granted. Complete MFA before accessing editorial.",
  );
} finally {
  await db.$disconnect();
}
