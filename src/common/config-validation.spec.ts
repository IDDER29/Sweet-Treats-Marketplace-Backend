import {
  collectConfigErrors,
  assertProductionConfig,
} from './config-validation';

const baseProd = {
  NODE_ENV: 'production',
  JWT_SECRET: 'a-strong-secret-of-decent-length',
  DB_HOST: 'db',
  DB_PORT: '5432',
  DB_USERNAME: 'u',
  DB_PASSWORD: 'p',
  DB_NAME: 'sweet',
} as NodeJS.ProcessEnv;

describe('config-validation', () => {
  it('passes for a complete, secure production config', () => {
    expect(collectConfigErrors(baseProd)).toEqual([]);
    expect(() => assertProductionConfig(baseProd)).not.toThrow();
  });

  it('is a no-op outside production', () => {
    expect(collectConfigErrors({ NODE_ENV: 'test' })).toEqual([]);
    expect(collectConfigErrors({} as NodeJS.ProcessEnv)).toEqual([]);
  });

  it('blocks the insecure default JWT secret', () => {
    const errs = collectConfigErrors({
      ...baseProd,
      JWT_SECRET: 'mySecretKey',
    });
    expect(errs.some((e) => e.includes('JWT_SECRET'))).toBe(true);
  });

  it('blocks an unset JWT secret', () => {
    const env = { ...baseProd };
    delete env.JWT_SECRET;
    expect(collectConfigErrors(env).some((e) => e.includes('JWT_SECRET'))).toBe(
      true,
    );
  });

  it('blocks a too-short JWT secret', () => {
    const errs = collectConfigErrors({ ...baseProd, JWT_SECRET: 'short' });
    expect(errs.some((e) => e.includes('too short'))).toBe(true);
  });

  it('blocks missing DB credentials and lists each', () => {
    const env = { ...baseProd };
    delete env.DB_HOST;
    delete env.DB_PASSWORD;
    const errs = collectConfigErrors(env);
    expect(errs.some((e) => e.includes('DB_HOST'))).toBe(true);
    expect(errs.some((e) => e.includes('DB_PASSWORD'))).toBe(true);
  });

  it('assertProductionConfig throws with a combined message', () => {
    expect(() =>
      assertProductionConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 'mySecretKey',
      } as NodeJS.ProcessEnv),
    ).toThrow(/Refusing to start/);
  });
});
