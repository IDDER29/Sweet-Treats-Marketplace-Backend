import * as Sentry from '@sentry/node';

/**
 * Initialise Sentry only when SENTRY_DSN is configured — otherwise this is a
 * no-op and `captureException` simply does nothing, so the app runs identically
 * without it. Call as early as possible in bootstrap.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
  });
}

export { Sentry };
