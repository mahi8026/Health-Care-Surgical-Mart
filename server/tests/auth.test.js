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

  describe('POST /api/auth/firebase-login — shop auto-detection', () => {
    const { getShopDatabase, getSystemDatabase } = require('../src/config/database');
    const { ObjectId } = require('mongodb');
    const admin = require('../src/config/firebase-admin');

    let verifySpy;
    const unique = Date.now().toString(36);
    const indexEmail = `auto.${unique}@test.com`;
    const fallbackShopId = `shop_fallback_${unique}`;
    const fallbackEmail = `owner.${unique}@test.com`;

    beforeAll(async () => {
      const systemDb = getSystemDatabase();

      // Seed a user_shop_index entry (the path that should always be used first)
      await systemDb.collection('user_shop_index').updateOne(
        { email: indexEmail },
        {
          $set: {
            email: indexEmail,
            shopId: global.testUtils.SHOP_ID,
            userId: global.testUtils.ADMIN_ID,
            role: 'SHOP_ADMIN',
            isActive: true,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );

      // Seed the matching user inside the test shop DB
      const testShopDb = getShopDatabase(global.testUtils.SHOP_ID);
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

      // Seed a shop WITHOUT an index entry + owner user, to exercise the
      // legacy fallback loop (which previously used shop._id instead of shop.shopId)
      await systemDb.collection('shops').updateOne(
        { shopId: fallbackShopId },
        {
          $setOnInsert: {
            shopId: fallbackShopId,
            name: `Fallback Shop ${unique}`,
            email: `shop.${unique}@test.com`,
            ownerEmail: fallbackEmail,
            status: 'Active',
            isActive: true,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
      const fallbackDb = getShopDatabase(fallbackShopId);
      await fallbackDb.collection('users').updateOne(
        { email: fallbackEmail },
        {
          $setOnInsert: {
            name: 'Fallback Owner',
            email: fallbackEmail,
            role: 'SHOP_ADMIN',
            shopId: fallbackShopId,
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
      verifySpy.mockImplementation((token) => {
        const email = token === 'auto_token' ? indexEmail : fallbackEmail;
        return Promise.resolve({ uid: 'test-uid', email });
      });
    });

    afterEach(() => {
      verifySpy.mockClear();
    });

    afterAll(async () => {
      verifySpy.mockRestore();
      const systemDb = getSystemDatabase();
      await systemDb.collection('user_shop_index').deleteOne({ email: indexEmail });
      await systemDb.collection('shops').deleteOne({ shopId: fallbackShopId });
      await getShopDatabase(fallbackShopId).collection('users').deleteOne({ email: fallbackEmail });
      await getShopDatabase(global.testUtils.SHOP_ID).collection('users').deleteOne({ email: indexEmail });
    });

    it('should login via user_shop_index lookup without shopId', async () => {
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

    it('should find user via legacy shop loop using shop.shopId (not _id)', async () => {
      const res = await request(app)
        .post('/api/auth/firebase-login')
        .send({ firebaseToken: 'fallback_token', email: fallbackEmail });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.shopId).toBe(fallbackShopId);
      expect(res.body.data.token).toBeDefined();
    });
  });

  describe('POST /api/auth/login — legacy shop auto-detection', () => {
    const { getShopDatabase, getSystemDatabase } = require('../src/config/database');
    const bcrypt = require('bcryptjs');

    const unique = Date.now().toString(36);
    const legacyShopId = `shop_legacy_${unique}`;
    const legacyEmail = `legacy.${unique}@test.com`;

    beforeAll(async () => {
      const systemDb = getSystemDatabase();

      await systemDb.collection('shops').updateOne(
        { shopId: legacyShopId },
        {
          $setOnInsert: {
            shopId: legacyShopId,
            name: `Legacy Shop ${unique}`,
            email: `shop.legacy.${unique}@test.com`,
            ownerEmail: legacyEmail,
            status: 'Active',
            isActive: true,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
      await getShopDatabase(legacyShopId).collection('users').updateOne(
        { email: legacyEmail },
        {
          $setOnInsert: {
            name: 'Legacy Owner',
            email: legacyEmail,
            passwordHash: await bcrypt.hash('LegacyPass@123', 4),
            role: 'SHOP_ADMIN',
            shopId: legacyShopId,
            isActive: true,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
    });

    afterAll(async () => {
      const systemDb = getSystemDatabase();
      await systemDb.collection('shops').deleteOne({ shopId: legacyShopId });
      await getShopDatabase(legacyShopId).collection('users').deleteOne({ email: legacyEmail });
    });

    it('should login via shop.shopId fallback without shopId (owner email)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: legacyEmail, password: 'LegacyPass@123' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.shopId).toBe(legacyShopId);
      expect(res.body.data.token).toBeDefined();
    });
  });
  
  describe('POST /api/auth/firebase-login — production layout (shop_<ObjectId> DB)', () => {
    // Regression: production stores real users in the shop DB named after the
    // shop document's _id (e.g. shop_6a020466789ca874348b2557), while the
    // shops.shopId field is only a business slug that maps to a junk DB.
    // The resolver must try the _id-based name first.
    const { client, getSystemDatabase } = require('../src/config/database');
    const admin = require('../src/config/firebase-admin');

    let verifySpy;
    const unique = Date.now().toString(36);
    const legacyEmail = `legacyid.${unique}@test.com`;
    let legacyShopId;

    beforeAll(async () => {
      const systemDb = getSystemDatabase();
      const inserted = await systemDb.collection('shops').insertOne({
        shopId: `shop_legacyid_${unique}`,
        name: `Legacy ID Shop ${unique}`,
        email: `shop.legacyid.${unique}@test.com`,
        ownerEmail: legacyEmail,
        status: 'Active',
        isActive: true,
        createdAt: new Date(),
      });
      legacyShopId = inserted.insertedId.toString();

      // The real user lives ONLY in the shot_<ObjectId> database (like prod).
      // We deliberately do NOT create shop_<slug> with this user.
      const legacyDb = client().db(`shop_${legacyShopId}`);
      await legacyDb.collection('users').insertOne({
        name: 'Legacy ID Owner',
        email: legacyEmail,
        role: 'SHOP_ADMIN',
        shopId: legacyShopId,
        isActive: true,
        createdAt: new Date(),
      });

      verifySpy = jest.spyOn(admin.auth(), 'verifyIdToken');
    });

    beforeEach(() => {
      verifySpy.mockImplementation((token) =>
        Promise.resolve({
          uid: 'test-uid',
          email: token === 'legacyid_token' ? legacyEmail : 'other@test.com',
        })
      );
    });

    afterEach(() => {
      verifySpy.mockClear();
    });

    afterAll(async () => {
      verifySpy.mockRestore();
      const systemDb = getSystemDatabase();
      await client()
        .db(`shop_${legacyShopId}`)
        .dropDatabase();
      await systemDb.collection('shops').deleteOne({ _id: new (require('mongodb').ObjectId)(legacyShopId) });
    });

    it('should login an owner whose shop data is in shop_<ObjectId> (production layout)', async () => {
      const res = await request(app)
        .post('/api/auth/firebase-login')
        .send({ firebaseToken: 'legacyid_token', email: legacyEmail });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(legacyEmail);
      expect(res.body.data.user.shopId).toBe(legacyShopId);
      expect(res.body.data.token).toBeDefined();
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
      // (email has no shop → 400 from the resolver, or 401 invalid creds).
      expect(res.body.message).not.toMatch(/injection/i);
      expect([400, 401]).toContain(res.statusCode);
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
