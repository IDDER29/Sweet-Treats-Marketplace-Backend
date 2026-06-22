/** DI token for the shared ioredis client (in its own file to avoid a
 * circular import between redis.module and cache.service). */
export const REDIS_CLIENT = 'REDIS_CLIENT';
