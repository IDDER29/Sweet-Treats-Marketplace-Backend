import { buildTypeOrmOptions, parseReplicaHosts } from './typeorm.config';

describe('typeorm.config', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      DB_HOST: 'master-db',
      DB_PORT: '5432',
      DB_USERNAME: 'u',
      DB_PASSWORD: 'p',
      DB_NAME: 'sweet',
    };
    delete process.env.DB_REPLICA_HOSTS;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('parseReplicaHosts', () => {
    it('returns [] when unset', () => {
      expect(parseReplicaHosts(undefined, 5432)).toEqual([]);
    });
    it('parses host and host:port, defaulting the port, ignoring blanks', () => {
      expect(parseReplicaHosts('r1:5433, r2 ,', 5432)).toEqual([
        { host: 'r1', port: 5433 },
        { host: 'r2', port: 5432 },
      ]);
    });
  });

  describe('buildTypeOrmOptions', () => {
    it('uses a single connection when no replicas are configured', () => {
      const o: any = buildTypeOrmOptions();
      expect(o.host).toBe('master-db');
      expect(o.port).toBe(5432);
      expect(o.replication).toBeUndefined();
      expect(o.synchronize).toBe(true); // dev default
    });

    it('enables read/write splitting when DB_REPLICA_HOSTS is set', () => {
      process.env.DB_REPLICA_HOSTS = 'replica-a:5432,replica-b';
      const o: any = buildTypeOrmOptions();
      expect(o.host).toBeUndefined();
      expect(o.replication.master).toMatchObject({
        host: 'master-db',
        port: 5432,
        username: 'u',
        database: 'sweet',
      });
      expect(o.replication.slaves).toHaveLength(2);
      expect(o.replication.slaves[0]).toMatchObject({
        host: 'replica-a',
        port: 5432,
        username: 'u',
      });
      expect(o.replication.slaves[1]).toMatchObject({
        host: 'replica-b',
        port: 5432,
      });
    });

    it('disables synchronize and runs migrations in production', () => {
      process.env.NODE_ENV = 'production';
      const o: any = buildTypeOrmOptions();
      expect(o.synchronize).toBe(false);
      expect(o.migrationsRun).toBe(true);
    });
  });
});
