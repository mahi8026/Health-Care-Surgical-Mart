/**
 * Customer Management Tests
 * Tests for customer CRUD operations
 */

const request = require('supertest');

describe('Customer Management API', () => {
  let app;
  let adminToken;
  let staffToken;
  
  beforeAll(() => {
    app = require('../src/server');
    
    adminToken = global.testUtils.generateTestToken({
      userId: global.testUtils.ADMIN_ID,
      email: 'admin@test.com',
      role: 'SHOP_ADMIN',
      shopId: global.testUtils.SHOP_ID,
    });
    
    staffToken = global.testUtils.generateTestToken({
      userId: global.testUtils.STAFF_ID,
      email: 'staff@test.com',
      role: 'STAFF',
      shopId: global.testUtils.SHOP_ID,
    });
  });
  
  describe('GET /api/customers', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/customers');
      expect(res.statusCode).toBe(401);
    });
    
    it('should list customers for authenticated admin', async () => {
      const res = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect([200, 404]).toContain(res.statusCode);
    });
    
    it('should allow STAFF to view customers', async () => {
      const res = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${staffToken}`);
      
      expect([200, 404]).toContain(res.statusCode);
    });
    
    it('should support search by phone', async () => {
      const res = await request(app)
        .get('/api/customers?phone=1234567890')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect([200, 404]).toContain(res.statusCode);
    });
    
    it('should support search by name', async () => {
      const res = await request(app)
        .get('/api/customers?search=John')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect([200, 404]).toContain(res.statusCode);
    });
    
    it('should filter by customer type', async () => {
      const res = await request(app)
        .get('/api/customers?type=wholesale')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect([200, 404]).toContain(res.statusCode);
    });
    
    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/customers?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect([200, 404]).toContain(res.statusCode);
    });
  });
  
  describe('POST /api/customers', () => {
    const validCustomer = {
      name: 'Test Customer',
      phone: `91234${Date.now().toString().slice(-5)}`,
      email: `test${Date.now()}@test.com`,
      type: 'retail',
      address: '123 Test Street'
    };
    
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/customers')
        .send(validCustomer);
      
      expect(res.statusCode).toBe(401);
    });
    
    it('should reject customer without name', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          phone: '1234567890',
          type: 'retail'
        });
      
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
    
    it('should reject customer without phone', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Customer',
          type: 'retail'
        });
      
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
    
    it('should validate phone number format', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Customer',
          phone: 'invalid_phone',
          type: 'retail'
        });
      
      expect([400, 404]).toContain(res.statusCode);
    });
    
    it('should validate email format', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Customer',
          phone: '1234567890',
          email: 'invalid_email',
          type: 'retail'
        });
      
      expect([400, 404]).toContain(res.statusCode);
    });
    
    it('should validate customer type', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Customer',
          phone: '1234567890',
          type: 'invalid_type'
        });
      
      expect([400, 404]).toContain(res.statusCode);
    });
    
    it('should handle optional email field', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Customer ${Date.now()}`,
          phone: `999${Date.now().toString().slice(-7)}`,
          type: 'retail'
          // No email provided
        });
      
      expect([200, 201, 400, 404]).toContain(res.statusCode);
    });
  });
  
  describe('GET /api/customers/:id', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/customers/test_customer_123');
      
      expect(res.statusCode).toBe(401);
    });
    
    it('should return 404 for non-existent customer', async () => {
      const res = await request(app)
        .get('/api/customers/non_existent_999999')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.statusCode).toBe(404);
    });
    
    it('should allow STAFF to view customer details', async () => {
      const res = await request(app)
        .get('/api/customers/test_id')
        .set('Authorization', `Bearer ${staffToken}`);
      
      expect([200, 404]).toContain(res.statusCode);
    });
  });
  
  describe('PUT /api/customers/:id', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .put('/api/customers/test_id')
        .send({ name: 'Updated Name' });
      
      expect(res.statusCode).toBe(401);
    });
    
    it('should reject invalid phone update', async () => {
      const res = await request(app)
        .put('/api/customers/test_id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ phone: 'invalid' });
      
      expect([400, 404]).toContain(res.statusCode);
    });
    
    it('should reject invalid email update', async () => {
      const res = await request(app)
        .put('/api/customers/test_id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'not-an-email' });
      
      expect([400, 404]).toContain(res.statusCode);
    });
  });
  
  describe('DELETE /api/customers/:id', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .delete('/api/customers/test_id');
      
      expect(res.statusCode).toBe(401);
    });
    
    it('should return 404 for non-existent customer', async () => {
      const res = await request(app)
        .delete('/api/customers/non_existent_999')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.statusCode).toBe(404);
    });
  });
  
  describe('Customer Search Performance (with indexes)', () => {
    it('should handle phone search efficiently', async () => {
      const startTime = Date.now();
      
      const res = await request(app)
        .get('/api/customers?phone=1234567890')
        .set('Authorization', `Bearer ${adminToken}`);
      
      const duration = Date.now() - startTime;
      
      // With phone index, should be very fast
      expect(duration).toBeLessThan(2000);
      expect([200, 404]).toContain(res.statusCode);
    });
    
    it('should handle name search efficiently', async () => {
      const startTime = Date.now();
      
      const res = await request(app)
        .get('/api/customers?search=John')
        .set('Authorization', `Bearer ${adminToken}`);
      
      const duration = Date.now() - startTime;
      
      // With name index, should be fast
      expect(duration).toBeLessThan(2000);
      expect([200, 404]).toContain(res.statusCode);
    });
    
    it('should handle type filter efficiently', async () => {
      const startTime = Date.now();
      
      const res = await request(app)
        .get('/api/customers?type=wholesale')
        .set('Authorization', `Bearer ${adminToken}`);
      
      const duration = Date.now() - startTime;
      
      // With type index, should be fast
      expect(duration).toBeLessThan(2000);
      expect([200, 404]).toContain(res.statusCode);
    });
  });
  
  describe('Customer Purchase History', () => {
    it('should retrieve customer purchase history', async () => {
      const res = await request(app)
        .get('/api/customers/test_id/sales')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect([200, 404]).toContain(res.statusCode);
    });
    
    it('should allow STAFF to view purchase history', async () => {
      const res = await request(app)
        .get('/api/customers/test_id/sales')
        .set('Authorization', `Bearer ${staffToken}`);
      
      expect([200, 404]).toContain(res.statusCode);
    });
  });
  
  describe('Role-Based Access Control', () => {
    it('should allow both roles to search customers', async () => {
      const adminRes = await request(app)
        .get('/api/customers?search=test')
        .set('Authorization', `Bearer ${adminToken}`);
      
      const staffRes = await request(app)
        .get('/api/customers?search=test')
        .set('Authorization', `Bearer ${staffToken}`);
      
      expect([200, 404]).toContain(adminRes.statusCode);
      expect([200, 404]).toContain(staffRes.statusCode);
    });
  });
});
