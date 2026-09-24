import { Module } from "@nestjs/common";
import { DatabaseModule } from "@kara/platform-database";
import { AuthModule } from "@kara/platform-auth";
import { ContentService } from "./application/content.service";
import {
  EditorialController,
  DiscoveryController,
  PublicContentController,
} from "./http/controller";
@Module({
  imports: [DatabaseModule, AuthModule],
  providers: [ContentService],
  controllers: [
    EditorialController,
    PublicContentController,
    DiscoveryController,
  ],
  exports: [ContentService],
})
export class ContentModule {}
export { ContentService } from "./application/content.service";
