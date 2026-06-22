import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { Users } from './../src/entities/users.entity';

/**
 * Smoke / integration tests.
 *
 * These boot the FULL AppModule against a real PostgreSQL instance (same as the
 * running app — see CLAUDE.md "Environment"). Booting alone is the regression
 * guard that catches DI/runtime wiring failures that `npm run build` cannot:
 * missing runtime deps, bad provider exports, mis-imported adapters, etc.
 *
 * The request flows then cover the auth, RBAC, analytics and commerce paths
 * end-to-end so a green build can no longer hide a broken runtime.
 *
 * Requires a reachable DB (DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_NAME).
 */
describe('Smoke / integration (e2e)', () => {
  let app: INestApplication;
  let http: any;

  // Unique suffix so reruns against a persistent DB never collide.
  const uniq = Date.now();
  const customerEmail = `e2e_cust_${uniq}@test.com`;
  const businessEmail = `e2e_biz_${uniq}@test.com`;
  const password = 'password123';

  let customerToken: string;
  let businessToken: string;
  let productId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirror main.ts so validation behaviour matches production.
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    http = app.getHttpServer();
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('boots the full application module (DI graph resolves)', () => {
    // If beforeAll completed, every module/provider wired up successfully.
    expect(app).toBeDefined();
  });

  describe('Observability', () => {
    it('reports readiness with a database check', async () => {
      const res = await request(http).get('/health/ready').expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.details.database.status).toBe('up');
    });

    it('echoes a correlation id and honours an inbound one', async () => {
      const generated = await request(http).get('/health/live').expect(200);
      expect(generated.headers['x-request-id']).toBeDefined();

      const passed = await request(http)
        .get('/health/live')
        .set('x-request-id', 'trace-abc-123')
        .expect(200);
      expect(passed.headers['x-request-id']).toBe('trace-abc-123');
    });

    it('exposes Prometheus metrics (RED + process)', async () => {
      const res = await request(http).get('/metrics').expect(200);
      expect(res.text).toContain('http_request_duration_seconds');
      expect(res.text).toContain('orders_created_total');
      expect(res.text).toContain('process_cpu_user_seconds_total');
    });
  });

  describe('Customer auth (JWT)', () => {
    it('registers a customer without optional address/phone', async () => {
      const res = await request(http)
        .post('/users/auth/register')
        .send({
          first_name: 'E2E',
          last_name: 'Customer',
          email: customerEmail,
          password,
        })
        .expect(201);
      expect(res.body.email).toBe(customerEmail);
    });

    it('rejects a malformed email (global ValidationPipe)', async () => {
      await request(http)
        .post('/users/auth/register')
        .send({
          first_name: 'X',
          last_name: 'Y',
          email: 'not-an-email',
          password,
        })
        .expect(400);
    });

    it('rejects unknown properties (forbidNonWhitelisted)', async () => {
      await request(http)
        .post('/users/auth/register')
        .send({
          first_name: 'X',
          last_name: 'Y',
          email: `extra_${uniq}@test.com`,
          password,
          hacker: true,
        })
        .expect(400);
    });

    it('logs in and issues a JWT', async () => {
      const res = await request(http)
        .post('/users/auth/login')
        .send({ email: customerEmail, password })
        .expect(201);
      expect(res.body.token).toBeDefined();
      customerToken = res.body.token;
    });

    it('accepts the JWT on a protected route (sign/verify secret match)', async () => {
      const res = await request(http)
        .get('/users/profile')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      expect(res.body.email).toBe(customerEmail);
    });

    it('rejects a protected route without a token', async () => {
      await request(http).get('/users/profile').expect(401);
    });

    it('issues a refresh token, rotates it, and is single-use', async () => {
      const email = `e2e_refresh_${uniq}@test.com`;
      await request(http)
        .post('/users/auth/register')
        .send({ first_name: 'R', last_name: 'T', email, password })
        .expect(201);
      const login = await request(http)
        .post('/users/auth/login')
        .send({ email, password })
        .expect(201);
      const refreshToken = login.body.refreshToken;
      expect(refreshToken).toBeDefined();

      // Exchange the refresh token for a fresh pair.
      const refreshed = await request(http)
        .post('/users/auth/refresh')
        .send({ refreshToken })
        .expect(201);
      expect(refreshed.body.token).toBeDefined();
      expect(refreshed.body.refreshToken).toBeDefined();
      expect(refreshed.body.refreshToken).not.toBe(refreshToken);

      // The new access token works.
      await request(http)
        .get('/users/profile')
        .set('Authorization', `Bearer ${refreshed.body.token}`)
        .expect(200);

      // The old refresh token is now single-use -> rejected.
      await request(http)
        .post('/users/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('returns 400 (not 500) for a malformed id on a uuid route', async () => {
      // A non-uuid against a uuid column would otherwise be a raw DB 500.
      await request(http).get('/products/not-a-uuid').expect(400);
    });
  });

  describe('Admin RBAC (RolesGuard)', () => {
    it('forbids a non-admin user from the admin dashboard', async () => {
      await request(http)
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });
  });

  describe('Audit logging', () => {
    it('writes an immutable audit entry for an admin action', async () => {
      // Mint an ADMIN: register a user, promote via the repo, log in for a token
      // whose claims carry the ADMIN role.
      const adminEmail = `e2e_admin_${uniq}@test.com`;
      await request(http)
        .post('/users/auth/register')
        .send({ first_name: 'Ad', last_name: 'Min', email: adminEmail, password })
        .expect(201);
      const usersRepo: Repository<Users> = app.get(getRepositoryToken(Users));
      await usersRepo.update({ email: adminEmail }, { role: 'ADMIN' as any });
      const adminLogin = await request(http)
        .post('/users/auth/login')
        .send({ email: adminEmail, password })
        .expect(201);
      const adminToken = adminLogin.body.token;

      // A target business to moderate.
      const targetEmail = `e2e_target_${uniq}@test.com`;
      const reg = await request(http)
        .post('/business/register')
        .send({
          firstName: 'Tgt',
          lastName: 'Biz',
          businessName: `Target Bakery ${uniq}`,
          email: targetEmail,
          password,
          businessType: 'bakery',
          address: '9 Target St',
          phoneNumber: '555-0900',
          agreeToTerms: true,
        })
        .expect(201);
      const targetId = reg.body.business.id;

      await request(http)
        .post(`/admin/businesses/${targetId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'policy violation' })
        .expect(201);

      const audit = await request(http)
        .get(`/admin/audit/Business/${targetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(audit.body.length).toBeGreaterThanOrEqual(1);
      expect(audit.body[0].action).toBe('business.suspend');
      expect(audit.body[0].metadata.reason).toBe('policy violation');
      // sensitive fields must never be persisted to audit metadata
      expect(audit.body[0].metadata.password).toBeUndefined();
    });
  });

  describe('Business auth + analytics', () => {
    it('registers a business', async () => {
      await request(http)
        .post('/business/register')
        .send({
          firstName: 'E2E',
          lastName: 'Owner',
          businessName: `E2E Bakery ${uniq}`,
          email: businessEmail,
          password,
          businessType: 'bakery',
          address: '1 Test Lane',
          phoneNumber: '555-0100',
          agreeToTerms: true,
        })
        .expect(201);
    });

    it('logs in the business and issues a token', async () => {
      const res = await request(http)
        .post('/business/login')
        .send({ email: businessEmail, password })
        .expect(201);
      expect(res.body.token).toBeDefined();
      businessToken = res.body.token;
    });

    it('serves analytics to an authenticated business', async () => {
      const res = await request(http)
        .get('/analytics/sales')
        .set('Authorization', `Bearer ${businessToken}`)
        .expect(200);
      expect(res.body).toHaveProperty('totalRevenue');
      expect(res.body).toHaveProperty('totalOrders');
    });

    it('rejects analytics without a token', async () => {
      await request(http).get('/analytics/sales').expect(401);
    });
  });

  describe('Commerce flow (product + checkout)', () => {
    it('creates a product as the business', async () => {
      const res = await request(http)
        .post('/products')
        .set('Authorization', `Bearer ${businessToken}`)
        .send({
          name: 'E2E Chocolate Cake',
          price: 25.5,
          description: 'Rich chocolate cake',
          stockQuantity: 10,
          category: 'cakes',
        })
        .expect(201);
      expect(res.body.id).toBeDefined();
      productId = res.body.id;
    });

    it('checks out an order with a server-recomputed total', async () => {
      const res = await request(http)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          items: [{ productId, quantity: 2 }],
          deliveryAddress: '123 Main St',
        })
        .expect(201);
      expect(res.body.id).toBeDefined();
      // 2 x 25.50 recomputed server-side
      expect(Number(res.body.totalAmount)).toBe(51);
    });

    it('lists the order in the customer history', async () => {
      const res = await request(http)
        .get('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Security regression guards', () => {
    it('never returns the password hash on the profile', async () => {
      const res = await request(http)
        .get('/users/profile')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      expect(res.body.password).toBeUndefined();
    });

    it('forbids a business from editing another business product (IDOR)', async () => {
      // Register a second business; it must not be able to touch the first
      // business's product (productId, created in the commerce flow above).
      const otherEmail = `e2e_biz2_${uniq}@test.com`;
      await request(http)
        .post('/business/register')
        .send({
          firstName: 'Other',
          lastName: 'Owner',
          businessName: `Other Bakery ${uniq}`,
          email: otherEmail,
          password,
          businessType: 'bakery',
          address: '2 Rival Rd',
          phoneNumber: '555-0200',
          agreeToTerms: true,
        })
        .expect(201);
      const login = await request(http)
        .post('/business/login')
        .send({ email: otherEmail, password })
        .expect(201);
      const otherToken = login.body.token;

      await request(http)
        .put(`/products/${productId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ price: 0.01 })
        .expect(403);

      await request(http)
        .delete(`/products/${productId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('forbids reviewing a product the customer has not purchased', async () => {
      // The customer's order is still PENDING (not a verified purchase).
      await request(http)
        .post(`/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ rating: 5, comment: 'Great' })
        .expect(403);
    });
  });

  describe('Commerce fix regressions', () => {
    const stockOf = async (id: string) => {
      const res = await request(http)
        .get(`/products/${id}/stock`)
        .set('Authorization', `Bearer ${businessToken}`)
        .expect(200);
      return Number(res.body.stockQuantity);
    };

    it('restores stock when a pending order is cancelled', async () => {
      const created = await request(http)
        .post('/products')
        .set('Authorization', `Bearer ${businessToken}`)
        .send({
          name: 'Tracked Cake',
          price: 10,
          stockQuantity: 10,
          trackStock: true,
          category: 'cakes',
        })
        .expect(201);
      const tracked = created.body.id;
      expect(await stockOf(tracked)).toBe(10);

      const order = await request(http)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ items: [{ productId: tracked, quantity: 3 }] })
        .expect(201);
      expect(await stockOf(tracked)).toBe(7);

      await request(http)
        .patch(`/orders/${order.body.id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      expect(await stockOf(tracked)).toBe(10);
    });

    it('replays a repeated Idempotency-Key instead of double-checking-out', async () => {
      const created = await request(http)
        .post('/products')
        .set('Authorization', `Bearer ${businessToken}`)
        .send({
          name: 'Idem Cake',
          price: 10,
          stockQuantity: 10,
          trackStock: true,
          category: 'cakes',
        })
        .expect(201);
      const pid = created.body.id;
      const idemKey = `idem-${uniq}`;
      const body = { items: [{ productId: pid, quantity: 2 }] };

      const first = await request(http)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', idemKey)
        .send(body)
        .expect(201);

      const replay = await request(http)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', idemKey)
        .send(body)
        .expect(201);

      // Same order replayed, and stock only decremented once (10 - 2 = 8).
      expect(replay.body.id).toBe(first.body.id);
      const stockRes = await request(http)
        .get(`/products/${pid}/stock`)
        .set('Authorization', `Bearer ${businessToken}`)
        .expect(200);
      expect(Number(stockRes.body.stockQuantity)).toBe(8);
    });

    it('enforces a per-customer discount usage limit', async () => {
      const code = `ONCE${uniq}`;
      await request(http)
        .post(`/business/any/discounts`)
        .set('Authorization', `Bearer ${businessToken}`)
        .send({
          code,
          type: 'FIXED_AMOUNT',
          value: 1,
          maxUsesPerCustomer: 1,
          validFrom: new Date(Date.now() - 1000).toISOString(),
        })
        .expect(201);

      // First use succeeds...
      await request(http)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ items: [{ productId, quantity: 1 }], discountCode: code })
        .expect(201);

      // ...second use by the same customer is rejected.
      await request(http)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ items: [{ productId, quantity: 1 }], discountCode: code })
        .expect(400);
    });
  });
});
