import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ContentModule } from "@kara/content-server";
import { IdentityModule } from "@kara/identity-server";
import { InteractionsModule } from "@kara/interactions-server";
@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    ContentModule,
    IdentityModule,
    InteractionsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
