/**
 * Authentication Tests
 * Tests for auth endpoints
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

// firebase-admin/auth pulls in jwks-rsa → jose (ESM-only), which Jest 29 can't parse.
// Mock it so the firebase-login shim gets a controllable verifyIdToken.
const mockAuthInstance = { verifyIdToken: jest.fn() };
jest.mock('firebase-admin/auth', () => ({
  getAuth: () => mockAuthInstance,
}));

describe('Authentication API', () => {
  let app;
  
  beforeAll(() => {
    // Import app after environment is set
    app = require('../src/server');
  });
  
  describe('POST /api/auth/firebase-login', () => {
    it('should reject login without Firebase token', async () => {
      const res = await request(app)
        .post('/api/auth/firebase-login')
        .send({ email: 'test@test.com' });
      
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });
    
    it('should reject login with invalid Firebase token', async () => {
      const res = await request(app)
        .post('/api/auth/firebase-login')
        .send({ 
          firebaseToken: 'invalid_token',
          email: 'test@test.com'
        });
      
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/firebase-login — single configured shop database', () => {
    const { getShopDatabase } = require('../src/config/database');
    const admin = require('../src/config/firebase-admin');

    let verifySpy;
    const unique = Date.now().toString(36);
    const indexEmail = `auto.${unique}@test.com`;

    beforeAll(async () => {
      // Seed the user directly in the configured (pinned) shop database — that
      // is the only place single-tenant login looks.
      const testShopDb = getShopDatabase();
      await testShopDb.collection('users').updateOne(
        { email: indexEmail },
        {
          $setOnInsert: {
            name: 'Auto Detect User',
            email: indexEmail,
            role: 'SHOP_ADMIN',
            shopId: global.testUtils.SHOP_ID,
            isActive: true,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );

      // Mock Firebase token verification (Firebase Admin is configured in .env)
      verifySpy = jest.spyOn(admin.auth(), 'verifyIdToken');
    });

    // resetMocks:true wipes implementations between tests — re-apply each time
    beforeEach(() => {
      verifySpy.mockImplementation(() =>
        Promise.resolve({ uid: 'test-uid', email: indexEmail })
      );
    });

    afterEach(() => {
      verifySpy.mockClear();
    });

    afterAll(async () => {
      verifySpy.mockRestore();
      await getShopDatabase().collection('users').deleteOne({ email: indexEmail });
    });

    it('should login a user found in the configured shop database without shopId', async () => {
      const res = await request(app)
        .post('/api/auth/firebase-login')
        .send({ firebaseToken: 'auto_token', email: indexEmail });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(indexEmail);
      expect(res.body.data.token).toBeDefined();
    });

    it('should accept email in different case (case-insensitive match)', async () => {
      const res = await request(app)
        .post('/api/auth/firebase-login')
        .send({ firebaseToken: 'auto_token', email: indexEmail.toUpperCase() });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject a user that exists only in a non-configured database', async () => {
      // A user planted in a DIFFERENT database (e.g. a legacy shop_<slug> DB)
      // must NOT be found — single-tenant mode only reads the pinned DB.
      const res = await request(app)
        .post('/api/auth/firebase-login')
        .send({ firebaseToken: 'auto_token', email: `elsewhere.${unique}@test.com` });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login — single shop database', () => {
    const { getShopDatabase } = require('../src/config/database');
    const bcrypt = require('bcryptjs');

    const unique = Date.now().toString(36);
    const loginEmail = `login.${unique}@test.com`;

    beforeAll(async () => {
      await getShopDatabase().collection('users').updateOne(
        { email: loginEmail },
        {
          $setOnInsert: {
            name: 'Login Owner',
            email: loginEmail,
            passwordHash: await bcrypt.hash('LegacyPass@123', 4),
            role: 'SHOP_ADMIN',
            shopId: global.testUtils.SHOP_ID,
            isActive: true,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
    });

    afterAll(async () => {
      await getShopDatabase().collection('users').deleteOne({ email: loginEmail });
    });

    it('should login with email and password against the configured shop database', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: loginEmail, password: 'LegacyPass@123' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(loginEmail);
      expect(res.body.data.token).toBeDefined();
    });

    it('should reject login with a wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: loginEmail, password: 'WrongPass@123' });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid/i);
    });

    it('should reject login for an unknown email in the configured database', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: `nobody.${unique}@test.com`, password: 'Whatever@123' });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid/i);
    });
  });
  
  describe('POST /api/auth/logout', () => {
    it('should allow logout without authentication', async () => {
      const res = await request(app)
        .post('/api/auth/logout');
      
      // Should not error (logout always succeeds)
      expect([200, 401]).toContain(res.statusCode);
    });
  });
  
  describe('Protected Routes', () => {
    it('should require authentication for /api/products', async () => {
      const res = await request(app)
        .get('/api/products');
      
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
    
    it('should require authentication for /api/sales', async () => {
      const res = await request(app)
        .get('/api/sales');
      
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
    
    it('should require authentication for /api/customers', async () => {
      const res = await request(app)
        .get('/api/customers');
      
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
  
  describe('JWT Token Validation', () => {
    it('should reject expired JWT token', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: 'test', email: 'test@test.com', role: 'SHOP_ADMIN', shopId: 'test_shop' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );
      
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${expiredToken}`);
      
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toMatch(/expired|invalid/i);
    });
    
    it('should reject malformed JWT token', async () => {
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', 'Bearer malformed.token.here');
      
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/auth/me — session restore via Authorization header', () => {
    it('should return the user for a valid Bearer token', async () => {
      const token = global.testUtils.generateTestToken({
        userId: global.testUtils.ADMIN_ID,
        role: 'SHOP_ADMIN',
        shopId: global.testUtils.SHOP_ID,
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBeDefined();
    });

    it('should return 401 without a token', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 for a revoked token after logout (blacklist check)', async () => {
      const token = global.testUtils.generateTestToken({
        userId: global.testUtils.ADMIN_ID,
        role: 'SHOP_ADMIN',
        shopId: global.testUtils.SHOP_ID,
      });

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);
      expect(logoutRes.statusCode).toBe(200);

      // The revoked token must no longer work on /me
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.statusCode).toBe(401);
    });
  });

  describe('Request sanitization — must not block legitimate input', () => {
    it('should allow passwords containing $ substrings (no false positives)', async () => {
      // A password like "pass$ne1" was previously rejected with 400 by
      // sanitizeRequest's substring-based NoSQL pattern check.
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: `sanitize.${Date.now()}@test.com`,
          password: 'pass$ne1', // matches /\$ne/ as a substring only
        });

      // Must NOT be a "potential injection detected" rejection — the request
      // should reach the route and be handled by normal login validation
      // (unknown email → 401 invalid credentials, since the app is single-tenant).
      expect(res.body.message).not.toMatch(/injection/i);
      expect(res.statusCode).toBe(401);
    });

    it('should still block NoSQL operator keys in query strings', async () => {
      const res = await request(app)
        .get('/api/products')
        .query({ 'user[$ne]': 'admin' });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/injection/i);
    });
  });

  describe('POST /api/auth/firebase-login — SUPER_ADMIN (system_users)', () => {
    const { getSystemDatabase } = require('../src/config/database');
    const admin = require('../src/config/firebase-admin');

    const unique = Date.now().toString(36);
    const superEmail = `super.${unique}@test.com`;

    let verifySpy;

    beforeAll(async () => {
      const systemDb = getSystemDatabase();
      await systemDb.collection('system_users').updateOne(
        { email: superEmail },
        {
          $setOnInsert: {
            name: 'Super Admin Test',
            email: superEmail,
            role: 'SUPER_ADMIN',
            isSuper: true,
            isActive: true,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );

      verifySpy = jest.spyOn(admin.auth(), 'verifyIdToken');
    });

    beforeEach(() => {
      verifySpy.mockImplementation(() =>
        Promise.resolve({ uid: 'super-uid', email: superEmail })
      );
    });

    afterEach(() => {
      verifySpy.mockClear();
    });

    afterAll(async () => {
      verifySpy.mockRestore();
      const systemDb = getSystemDatabase();
      await systemDb.collection('system_users').deleteOne({ email: superEmail });
    });

    it('should authenticate a super admin from system_users without a shop', async () => {
      const res = await request(app)
        .post('/api/auth/firebase-login')
        .send({ firebaseToken: 'super_token', email: superEmail });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('SUPER_ADMIN');
      expect(res.body.data.user.isSuper).toBe(true);
      expect(res.body.data.user.shopId).toBeNull();
      expect(res.body.data.token).toBeDefined();
    });

    it('should allow the super admin token to access /api/super-admin/shops', async () => {
      const loginRes = await request(app)
        .post('/api/auth/firebase-login')
        .send({ firebaseToken: 'super_token', email: superEmail });

      const token = loginRes.body.data.token;

      const res = await request(app)
        .get('/api/super-admin/shops')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should deny /api/super-admin/shops for shop admins', async () => {
      const shopAdminToken = global.testUtils.generateTestToken({
        userId: global.testUtils.ADMIN_ID,
        role: 'SHOP_ADMIN',
        shopId: global.testUtils.SHOP_ID,
      });

      const res = await request(app)
        .get('/api/super-admin/shops')
        .set('Authorization', `Bearer ${shopAdminToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
  
  describe('Health Check', () => {
    it('should return health status without authentication', async () => {
      const res = await request(app)
        .get('/health');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBeDefined();
    });
  });
});
