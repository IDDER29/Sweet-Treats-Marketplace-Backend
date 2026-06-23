import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { initSentry } from './observability/sentry';
import { assertProductionConfig } from './common/config-validation';

/**
 * Dedicated worker process: boots the application context WITHOUT an HTTP
 * listener, so the BullMQ processors run here (and can be scaled independently of
 * the API). Run with PROCESS_QUEUES=true; run the API with PROCESS_QUEUES=false
 * so a job backlog can't starve request handling.
 *
 *   node dist/worker.js
 */
async function bootstrapWorker() {
  assertProductionConfig();
  initSentry();
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(PinoLogger));
  app.enableShutdownHooks();
  new Logger('Worker').log('Worker started — processing queues');
}

bootstrapWorker();
