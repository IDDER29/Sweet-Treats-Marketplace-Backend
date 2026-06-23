import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { authenticator } from 'otplib';
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
  let businessRefreshToken: string;
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

      // The old refresh token is now single-use -> rejected. Replaying it also
      // trips reuse-detection, which burns the whole token family.
      await request(http)
        .post('/users/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      // Because the family was revoked, the *valid* rotated token is dead too.
      await request(http)
        .post('/users/auth/refresh')
        .send({ refreshToken: refreshed.body.refreshToken })
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

  describe('MFA (TOTP)', () => {
    it('enrolls, activates, then enforces the second factor at login', async () => {
      const email = `e2e_mfa_${uniq}@test.com`;
      await request(http)
        .post('/users/auth/register')
        .send({ first_name: 'M', last_name: 'F', email, password })
        .expect(201);
      const login = await request(http)
        .post('/users/auth/login')
        .send({ email, password })
        .expect(201);
      const token = login.body.token;

      // Enroll -> get the shared secret.
      const enroll = await request(http)
        .post('/users/mfa/enroll')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      expect(enroll.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
      const secret = enroll.body.secret;

      // Activate with a real code.
      await request(http)
        .post('/users/mfa/activate')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: authenticator.generate(secret) })
        .expect(201);

      // Login now requires the code.
      await request(http)
        .post('/users/auth/login')
        .send({ email, password })
        .expect(401);

      // ...and succeeds with a valid one.
      const mfaLogin = await request(http)
        .post('/users/auth/login')
        .send({ email, password, totpCode: authenticator.generate(secret) })
        .expect(201);
      expect(mfaLogin.body.token).toBeDefined();
    });

    it('never exposes the MFA secret on the profile', async () => {
      const email = `e2e_mfa_leak_${uniq}@test.com`;
      await request(http)
        .post('/users/auth/register')
        .send({ first_name: 'M', last_name: 'L', email, password })
        .expect(201);
      const login = await request(http)
        .post('/users/auth/login')
        .send({ email, password })
        .expect(201);
      await request(http)
        .post('/users/mfa/enroll')
        .set('Authorization', `Bearer ${login.body.token}`)
        .expect(201);
      const profile = await request(http)
        .get('/users/profile')
        .set('Authorization', `Bearer ${login.body.token}`)
        .expect(200);
      expect(profile.body.mfa_secret).toBeUndefined();
    });
  });

  describe('Audit logging', () => {
    it('writes an immutable audit entry for an admin action', async () => {
      // Mint an ADMIN: register a user, promote via the repo, log in for a token
      // whose claims carry the ADMIN role.
      const adminEmail = `e2e_admin_${uniq}@test.com`;
      await request(http)
        .post('/users/auth/register')
        .send({
          first_name: 'Ad',
          last_name: 'Min',
          email: adminEmail,
          password,
        })
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

    it('logs in the business and issues a token + refresh token', async () => {
      const res = await request(http)
        .post('/business/login')
        .send({ email: businessEmail, password })
        .expect(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      businessToken = res.body.token;
      businessRefreshToken = res.body.refreshToken;
    });

    it('rotates the business refresh token (single-use, kind-checked)', async () => {
      const refreshed = await request(http)
        .post('/business/auth/refresh')
        .send({ refreshToken: businessRefreshToken })
        .expect(201);
      expect(refreshed.body.token).toBeDefined();
      expect(refreshed.body.refreshToken).toBeDefined();
      expect(refreshed.body.refreshToken).not.toBe(businessRefreshToken);

      // A business refresh token must not be redeemable at the user endpoint.
      await request(http)
        .post('/users/auth/refresh')
        .send({ refreshToken: refreshed.body.refreshToken })
        .expect(401);

      // The original (now rotated) business token is single-use -> rejected.
      await request(http)
        .post('/business/auth/refresh')
        .send({ refreshToken: businessRefreshToken })
        .expect(401);
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

    it('finds the product via stemmed full-text search (cakes -> cake)', async () => {
      // "cakes" (plural) must match the "...Cake" product through FTS stemming —
      // a plain ILIKE '%cakes%' would miss it entirely.
      const res = await request(http)
        .get('/products')
        .query({ search: 'cakes' })
        .expect(200);
      expect(res.body.total).toBeGreaterThan(0);
      expect(Array.isArray(res.body.data)).toBe(true);
      const names = res.body.data.map((p: any) => String(p.name).toLowerCase());
      expect(names.some((n: string) => n.includes('cake'))).toBe(true);
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

  describe('Cart', () => {
    it('adds to cart, reads it, checks out, and empties', async () => {
      // Add the product to the cart.
      const added = await request(http)
        .post('/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: 1 })
        .expect(201);
      expect(added.body.itemCount).toBe(1);
      expect(added.body.businessId).toBeDefined();
      expect(Number(added.body.subtotal)).toBeGreaterThan(0);

      // Read it back.
      const cart = await request(http)
        .get('/cart')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      expect(cart.body.items).toHaveLength(1);

      // Checkout the cart -> creates an order.
      const order = await request(http)
        .post('/cart/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ deliveryAddress: '123 Main St' })
        .expect(201);
      expect(order.body.id).toBeDefined();

      // Cart is now empty.
      const empty = await request(http)
        .get('/cart')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      expect(empty.body.itemCount).toBe(0);
    });

    it('rejects the cart without auth', async () => {
      await request(http).get('/cart').expect(401);
    });
  });

  describe('Address book', () => {
    let addressId: string;

    it('creates an address (first one is the default)', async () => {
      const res = await request(http)
        .post('/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          recipientName: 'Jane Doe',
          line1: '5 Baker St',
          city: 'London',
          postcode: 'NW1 6XE',
          phone: '555-0142',
        })
        .expect(201);
      expect(res.body.isDefault).toBe(true);
      expect(res.body.country).toBe('GB');
      addressId = res.body.id;
    });

    it('checks out using the saved address (snapshotted onto the order)', async () => {
      const order = await request(http)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ items: [{ productId, quantity: 1 }], addressId })
        .expect(201);
      const detail = await request(http)
        .get(`/orders/${order.body.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      expect(detail.body.deliveryAddress).toContain('Jane Doe');
      expect(detail.body.deliveryAddress).toContain('5 Baker St');
    });

    it('lists the saved addresses', async () => {
      const res = await request(http)
        .get('/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Notifications', () => {
    const auth = () => ({ Authorization: `Bearer ${customerToken}` });

    it('records an in-app notification when an order is placed', async () => {
      await request(http)
        .post('/orders')
        .set(auth())
        .send({ items: [{ productId, quantity: 1 }], deliveryAddress: '1 St' })
        .expect(201);

      // record() is best-effort + fire-and-forget, so poll the feed briefly.
      let total = 0;
      for (let i = 0; i < 20; i++) {
        const res = await request(http)
          .get('/notifications')
          .set(auth())
          .expect(200);
        total = res.body.total;
        if (total >= 1) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      expect(total).toBeGreaterThanOrEqual(1);
    });

    it('reports an unread count and marks all read', async () => {
      const before = await request(http)
        .get('/notifications/unread-count')
        .set(auth())
        .expect(200);
      expect(before.body.count).toBeGreaterThanOrEqual(1);

      await request(http)
        .post('/notifications/read-all')
        .set(auth())
        .expect(201);

      const after = await request(http)
        .get('/notifications/unread-count')
        .set(auth())
        .expect(200);
      expect(after.body.count).toBe(0);
    });

    it('requires auth', async () => {
      await request(http).get('/notifications').expect(401);
    });
  });

  describe('Delivery partner', () => {
    let driverToken: string;
    let driverId: string;
    let orderId: string;

    it('registers and logs in a driver', async () => {
      const email = `e2e_driver_${uniq}@test.com`;
      const reg = await request(http)
        .post('/drivers/register')
        .send({ name: 'Dan', email, password: 'password123' })
        .expect(201);
      expect(reg.body.password).toBeUndefined();
      driverId = reg.body.id;
      const login = await request(http)
        .post('/drivers/login')
        .send({ email, password: 'password123' })
        .expect(201);
      driverToken = login.body.token;
    });

    it('a driver sees their (empty) assigned-order list', async () => {
      const res = await request(http)
        .get('/drivers/me/orders')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('assign-driver requires business auth', async () => {
      const order = await request(http)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ items: [{ productId, quantity: 1 }], deliveryAddress: '1 St' })
        .expect(201);
      orderId = order.body.id;
      await request(http)
        .patch(`/orders/${orderId}/assign-driver`)
        .send({ driverId })
        .expect(401);
    });

    it('cannot assign a driver before the order is PREPARING/READY', async () => {
      await request(http)
        .patch(`/orders/${orderId}/assign-driver`)
        .set('Authorization', `Bearer ${businessToken}`)
        .send({ driverId })
        .expect(400);
    });
  });

  describe('Favorites', () => {
    const auth = () => ({ Authorization: `Bearer ${customerToken}` });

    it('favorites a product, lists it, then unfavorites', async () => {
      const add = await request(http)
        .post(`/favorites/products/${productId}`)
        .set(auth())
        .expect(201);
      expect(add.body.favorited).toBe(true);

      const list = await request(http)
        .get('/favorites')
        .set(auth())
        .expect(200);
      expect(list.body.products.some((p: any) => p.id === productId)).toBe(
        true,
      );

      const rm = await request(http)
        .delete(`/favorites/products/${productId}`)
        .set(auth())
        .expect(200);
      expect(rm.body.favorited).toBe(false);
    });

    it('follows and unfollows a shop', async () => {
      const shops = await request(http).get('/shops').expect(200);
      const businessId = shops.body.data[0].id;
      const follow = await request(http)
        .post(`/favorites/shops/${businessId}`)
        .set(auth())
        .expect(201);
      expect(follow.body.following).toBe(true);
      await request(http)
        .delete(`/favorites/shops/${businessId}`)
        .set(auth())
        .expect(200);
    });

    it('requires auth', async () => {
      await request(http).get('/favorites').expect(401);
    });
  });

  describe('Seller storefront', () => {
    let shopSlug: string;

    it('lets the seller edit their public storefront', async () => {
      const res = await request(http)
        .patch('/business/profile')
        .set('Authorization', `Bearer ${businessToken}`)
        .send({
          description: 'Best cakes in town',
          logoUrl: 'http://cdn.example/logo.png',
          businessHours: { mon: '9-17', sun: 'closed' },
        })
        .expect(200);
      expect(res.body.description).toBe('Best cakes in town');
      expect(res.body.slug).toBeDefined();
      expect(res.body.password).toBeUndefined();
      shopSlug = res.body.slug;
    });

    it('serves the public storefront with the active catalog', async () => {
      const res = await request(http).get(`/shops/${shopSlug}`).expect(200);
      expect(res.body.businessName).toBeDefined();
      expect(res.body.description).toBe('Best cakes in town');
      expect(Array.isArray(res.body.products)).toBe(true);
      expect(res.body.password).toBeUndefined();
    });

    it('browses shops publicly', async () => {
      const res = await request(http).get('/shops').expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('404s an unknown shop slug', async () => {
      await request(http).get('/shops/no-such-shop-xyz').expect(404);
    });

    it('seller-reply endpoint requires business auth', async () => {
      await request(http)
        .post(`/products/${productId}/reviews/${productId}/reply`)
        .send({ reply: 'x' })
        .expect(401);
    });

    it('seller-reply 404s an unknown review', async () => {
      await request(http)
        .post(
          `/products/${productId}/reviews/00000000-0000-4000-8000-000000000000/reply`,
        )
        .set('Authorization', `Bearer ${businessToken}`)
        .send({ reply: 'Thanks!' })
        .expect(404);
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
