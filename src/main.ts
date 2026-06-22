import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { setupSwagger } from './common/swagger';
import { initSentry } from './observability/sentry';
import helmet from 'helmet';

async function bootstrap() {
  // Initialise error tracking before anything else (no-op without SENTRY_DSN).
  initSentry();

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bufferLogs: true,
  });

  // Route Nest's own logs through Pino (structured, correlated).
  app.useLogger(app.get(Logger));

  // Security headers. CSP is extended to allow the self-hosted Swagger UI's
  // inline bootstrap (acceptable for a JSON API that renders no user HTML).
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );

  // CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
  });

  // Set up global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true, // Automatically remove properties not specified in DTO
      forbidNonWhitelisted: true, // Throw an error if non-whitelisted properties are found
    }),
  );

  // Publish the OpenAPI contract at /api/docs (+ /api/docs-json).
  setupSwagger(app);

  if (!process.env.JWT_SECRET) {
    // In production, refuse to boot with the well-known fallback secret — it
    // would let anyone forge admin tokens. In dev, warn but allow it.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'JWT_SECRET must be set in production. Refusing to start with the insecure fallback secret.',
      );
    }
    console.warn(
      'WARNING: JWT_SECRET is not set. Using insecure fallback "mySecretKey". Set JWT_SECRET in production!',
    );
  }

  await app.listen(3000);
}
bootstrap();
