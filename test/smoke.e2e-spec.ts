import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

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
  });

  describe('Admin RBAC (RolesGuard)', () => {
    it('forbids a non-admin user from the admin dashboard', async () => {
      await request(http)
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
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
});
