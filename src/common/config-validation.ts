// Production configuration guard. In NODE_ENV=production the app must refuse to
// start with an insecure or incomplete config (e.g. the well-known fallback JWT
// secret, which would let anyone forge admin tokens). Enforced from main.ts.

const INSECURE_JWT_FALLBACK = 'mySecretKey';
const MIN_JWT_LENGTH = 16;
const REQUIRED_DB_KEYS = [
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_NAME',
];

/** Hard errors that must block startup in production. Empty outside production. */
export function collectConfigErrors(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const errors: string[] = [];

  const jwt = env.JWT_SECRET;
  if (!jwt || jwt === INSECURE_JWT_FALLBACK) {
    errors.push(
      'JWT_SECRET must be set to a strong, non-default value in production.',
    );
  } else if (jwt.length < MIN_JWT_LENGTH) {
    errors.push(
      `JWT_SECRET is too short (>= ${MIN_JWT_LENGTH} chars required; 32+ recommended).`,
    );
  }

  for (const key of REQUIRED_DB_KEYS) {
    if (!env[key]) errors.push(`${key} must be set in production.`);
  }

  return errors;
}

/** Throw (fail fast) if the production config is insecure or incomplete. */
export function assertProductionConfig(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const errors = collectConfigErrors(env);
  if (errors.length > 0) {
    throw new Error(
      `Refusing to start — insecure/incomplete production configuration:\n  - ${errors.join(
        '\n  - ',
      )}`,
    );
  }
}
