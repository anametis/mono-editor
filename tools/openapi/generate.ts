import "reflect-metadata";
import { writeFile } from "node:fs/promises";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { createApp } from "../../apps/api/src/bootstrap";
const app = await createApp();
const document = SwaggerModule.createDocument(
  app,
  new DocumentBuilder()
    .setTitle("Kara API")
    .setVersion("1")
    .addCookieAuth("better-auth.session_token")
    .build(),
  { operationIdFactory: (controller, method) => `${controller}_${method}` },
);
await writeFile(
  "docs/architecture/openapi.json",
  JSON.stringify(document, null, 2) + "\n",
);
await app.close();
