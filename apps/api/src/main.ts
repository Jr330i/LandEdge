import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './prisma/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: (() => {
      const raw = process.env.CORS_ORIGINS?.trim();
      if (!raw) {
        return [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/];
      }
      return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((entry) => {
          if (entry === '*.vercel.app' || entry === 'https://*.vercel.app') {
            return /^https:\/\/[\w-]+\.vercel\.app$/;
          }
          return entry;
        });
    })(),
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Sofinda API')
    .setDescription(
      'Property sub-ledger and operational intelligence — OpenAPI (PRD FR-025)',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
}
void bootstrap();
