import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from '../src/health/health.module';

/** E2E slice without Prisma — safe when Postgres is not running. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    HealthModule,
  ],
})
export class E2eAppModule {}
