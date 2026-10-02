import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const trustedProxies = (process.env.TRUSTED_PROXIES ?? '')
    .split(',')
    .map((proxy) => proxy.trim())
    .filter(Boolean);
  if (trustedProxies.length > 0) {
    app.set('trust proxy', trustedProxies);
  }

  const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim());

  app.enableCors({
    origin: corsOrigins,
    exposedHeaders: [
      'Retry-After',
      'X-Upload-Limit',
      'X-Upload-Remaining',
      'X-Upload-Reset',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port, '0.0.0.0');
}

bootstrap();
