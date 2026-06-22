import { randomUUID } from 'crypto';
import type { Params } from 'nestjs-pino';

const isTest = !!process.env.JEST_WORKER_ID;
const isProd = process.env.NODE_ENV === 'production';

/**
 * Structured logging config (Pino).
 * - Correlates every request with an `x-request-id` (honoured from the inbound
 *   header if a proxy set one, otherwise generated) and echoes it on the response.
 * - Redacts auth headers, cookies and password fields so secrets never hit logs.
 * - Pretty prints in local dev; plain JSON in prod; silent under Jest so the test
 *   output stays clean and no pino-pretty worker thread leaks into the suite.
 */
export const loggerConfig: Params = {
  pinoHttp: {
    level: isTest ? 'silent' : process.env.LOG_LEVEL || 'info',
    genReqId: (req, res) => {
      const headerId = req.headers['x-request-id'];
      const id =
        (Array.isArray(headerId) ? headerId[0] : headerId) || randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    customProps: (req: any) => ({
      // Attach the authenticated principal (if a guard has run) to each log line.
      userId: req.user?.userId ?? req.user?.businessId,
      role: req.user?.role,
    }),
    // Keep request/response lines compact — id, verb, path, status, timing.
    serializers: {
      req: (req: any) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res: any) => ({ statusCode: res.statusCode }),
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.oldPassword',
        'req.body.newPassword',
        'req.body.token',
        'res.headers["set-cookie"]',
      ],
      remove: true,
    },
    autoLogging: !isTest,
    transport:
      !isProd && !isTest
        ? {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
          }
        : undefined,
  },
};
