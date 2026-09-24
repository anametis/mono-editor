import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Global,
  Module,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
@Injectable()
export class Database
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
@Global()
@Module({ providers: [Database], exports: [Database] })
export class DatabaseModule {}
export { Prisma } from "@prisma/client";
