/**
 * Authentication Tests
 * Tests for auth endpoints
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

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
  
  describe('Health Check', () => {
    it('should return health status without authentication', async () => {
      const res = await request(app)
        .get('/health');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBeDefined();
    });
  });
});
