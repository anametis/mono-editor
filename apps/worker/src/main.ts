import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DatabaseModule } from "@kara/platform-database";
import { ContentService } from "@kara/content-server";
import {
  logger,
  publicationCount,
  workerDuration,
  workerFailures,
  publicationLag,
} from "@kara/platform-observability";
import { writeFile } from "node:fs/promises";
@Module({ imports: [DatabaseModule], providers: [ContentService] })
class WorkerModule {}
const app = await NestFactory.createApplicationContext(WorkerModule, {
  logger: ["error", "warn"],
});
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    stopping = true;
  });
while (!stopping) {
  const start = Date.now();
  try {
    const count = await app.get(ContentService).publishDue();
    publicationLag.record(
      await app.get(ContentService).publicationLagSeconds(),
    );
    publicationCount.add(count);
    await writeFile(
      process.env.WORKER_HEARTBEAT ?? "/tmp/kara-worker-heartbeat",
      String(Date.now()),
    );
    if (count) logger.info({ count }, "Published scheduled revisions");
  } catch (err) {
    workerFailures.add(1);
    logger.error({ err }, "Publication worker failed");
  }
  workerDuration.record(Date.now() - start);
  // Poll without overlapping work; database locks allow additional worker processes.
  for (let i = 0; i < 15 && !stopping; i++)
    await new Promise((resolve) => setTimeout(resolve, 1000));
}
await app.close();
