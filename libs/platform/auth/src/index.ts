import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Global,
  Inject,
  Injectable,
  Module,
  UnauthorizedException,
} from "@nestjs/common";
import { Database, DatabaseModule } from "@kara/platform-database";
import { permissions, type Principal } from "@kara/permissions";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import { twoFactor, username } from "better-auth/plugins";
import { fromNodeHeaders } from "better-auth/node";
import nodemailer from "nodemailer";
import type { Request } from "express";
export const AUTH = Symbol("AUTH");
export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
export function createAuth(db: Database) {
  const secret = required("BETTER_AUTH_SECRET");
  if (secret.length < 32)
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
  const origins = required("TRUSTED_ORIGINS").split(",");
  const production = process.env.NODE_ENV === "production";
  if (production && origins.some((origin) => !origin.startsWith("https://")))
    throw new Error("Production origins must use HTTPS");
  const mail = nodemailer.createTransport({
    host: required("SMTP_HOST"),
    port: Number(required("SMTP_PORT")),
    secure: process.env.SMTP_SECURE === "true",
    ...(process.env.SMTP_USER
      ? {
          auth: {
            user: process.env.SMTP_USER,
            pass: required("SMTP_PASSWORD"),
          },
        }
      : {}),
    connectionTimeout: 10000,
    socketTimeout: 10000,
  });
  const send = async (to: string, subject: string, text: string) => {
    await mail.sendMail({ from: required("MAIL_FROM"), to, subject, text });
  };
  return betterAuth({
    appName: "Kara",
    secret,
    baseURL: required("AUTH_URL"),
    basePath: "/api/auth",
    trustedOrigins: origins,
    database: prismaAdapter(db, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      sendResetPassword: async ({ user, url }) =>
        send(user.email, "Reset your Kara password", url),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) =>
        send(user.email, "Verify your Kara email", url),
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      cookieCache: { enabled: false },
      additionalFields: {
        mfaVerified: { type: "boolean", defaultValue: false, input: false },
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
      useSecureCookies: production,
      crossSubDomainCookies: { enabled: false },
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: production,
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 30,
      customRules: {
        "/sign-in/*": { window: 60, max: 5 },
        "/two-factor/*": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
      },
    },
    plugins: [
      username(),
      twoFactor({
        otpOptions: {
          sendOTP: async ({ user, otp }) =>
            send(
              user.email,
              "Your Kara sign-in code",
              `Your code is ${otp}. It expires in 3 minutes.`,
            ),
          period: 3,
        },
      }),
    ],
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (
          ![
            "/two-factor/verify-otp",
            "/two-factor/verify-backup-code",
          ].includes(ctx.path)
        )
          return;
        const result = ctx.context.returned;
        if (!result || result instanceof Error || result instanceof Response)
          return;
        const successful =
          typeof result === "object" &&
          ("token" in result || ("status" in result && result.status === true));
        if (!successful) return;
        const session = ctx.context.newSession ?? ctx.context.session;
        if (session)
          await db.session.update({
            where: { id: session.session.id },
            data: { mfaVerified: true },
          });
      }),
    },
  });
}
export type Auth = ReturnType<typeof createAuth>;
export type ActorRequest = Request & { actor: Principal };
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AUTH) private readonly auth: Auth) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<ActorRequest>();
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user.emailVerified) throw new UnauthorizedException();
    req.actor = { id: session.user.id, permissions: [] };
    return true;
  }
}
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly db: Database,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<ActorRequest>();
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user.emailVerified) throw new UnauthorizedException();
    const staff = await this.db.staff.findUnique({
      where: { userId: session.user.id },
    });
    if (!staff) throw new ForbiddenException("Staff access is invitation-only");
    // Check the database on every privileged request; disabling MFA revokes access immediately.
    const stored = await this.db.session.findUnique({
      where: { id: session.session.id },
      include: { user: true },
    });
    if (!stored?.mfaVerified || !stored.user.twoFactorEnabled)
      throw new ForbiddenException(
        "Complete email verification and two-step sign-in",
      );
    req.actor = {
      id: session.user.id,
      permissions: permissions.filter((p) => staff.permissions.includes(p)),
    };
    return true;
  }
}
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    { provide: AUTH, inject: [Database], useFactory: createAuth },
    SessionGuard,
    StaffGuard,
  ],
  exports: [AUTH, SessionGuard, StaffGuard],
})
export class AuthModule {}
