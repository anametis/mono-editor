import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { toNodeHandler } from "better-auth/node";
import { AUTH, type Auth } from "@kara/platform-auth";
import { Database } from "@kara/platform-database";
import { logger } from "@kara/platform-observability";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { randomUUID } from "node:crypto";
import pinoHttp from "pino-http";
import { AppModule } from "./app.module";
export async function createApp() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: ["error", "warn"],
  });
  app.setGlobalPrefix("api");
  // Production API is reachable only through the private, header-replacing proxy.
  if (process.env.NODE_ENV === "production")
    app.getHttpAdapter().getInstance().set("trust proxy", 1);
  app.use(
    pinoHttp({
      logger,
      genReqId: () => randomUUID(),
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  const origins = (process.env.TRUSTED_ORIGINS ?? "").split(",");
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    if (process.env.NODE_ENV !== "production")
      req.headers["x-forwarded-for"] = req.socket.remoteAddress;
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
      (!req.headers.origin || !origins.includes(req.headers.origin))
    ) {
      res.status(403).json({ message: "Untrusted origin" });
      return;
    }
    next();
  });
  const auth = app.get<Auth>(AUTH);
  app.use("/api/auth", (req: Request, res: Response) => {
    return toNodeHandler(auth)(req, res);
  });
  app.use(express.json({ limit: "128kb" }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const server = app.getHttpAdapter().getInstance();
  server.get("/health/live", (_req: Request, res: Response) =>
    res.json({ status: "ok" }),
  );
  server.get("/health/ready", async (_req: Request, res: Response) => {
    try {
      await app.get(Database).$queryRaw`SELECT 1`;
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });
  app.enableShutdownHooks();
  return app;
}
