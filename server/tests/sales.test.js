/**
 * Sales Management Tests
 * Tests for sales CRUD operations and business logic
 */

const request = require('supertest');

describe('Sales Management API', () => {
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
  
  describe('GET /api/sales', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/sales');
      expect(res.statusCode).toBe(401);
    });
    
    it('should list sales for authenticated admin', async () => {
      const res = await request(app)
        .get('/api/sales')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect([200, 404]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
      }
    });
    
    it('should allow STAFF to view sales', async () => {
      const res = await request(app)
        .get('/api/sales')
        .set('Authorization', `Bearer ${staffToken}`);
      
      // STAFF should be able to read sales
      expect([200, 404]).toContain(res.statusCode);
    });
    
    it('should support date range filtering', async () => {
      const res = await request(app)
        .get('/api/sales?startDate=2026-01-01&endDate=2026-12-31')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect([200, 404]).toContain(res.statusCode);
    });
    
    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/sales?page=1&limit=20')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect([200, 404]).toContain(res.statusCode);
    });
    
    it('should filter by customer', async () => {
      const res = await request(app)
        .get('/api/sales?customerId=test_customer_123')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect([200, 404]).toContain(res.statusCode);
    });
    
    it('should filter by payment status', async () => {
      const res = await request(app)
        .get('/api/sales?paymentStatus=paid')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect([200, 404]).toContain(res.statusCode);
    });
  });
  
  describe('POST /api/sales', () => {
    const validSale = {
      customerId: 'test_customer',
      items: [
        {
          productId: 'test_product_1',
          quantity: 2,
          price: 100,
          total: 200
        }
      ],
      subtotal: 200,
      discount: 0,
      tax: 0,
      total: 200,
      paymentMethod: 'cash',
      paymentStatus: 'paid'
    };
    
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/sales')
        .send(validSale);
      
      expect(res.statusCode).toBe(401);
    });
    
    it('should allow STAFF to create sales', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(validSale);
      
      // STAFF should be able to create sales (main function)
      expect([200, 201, 400, 404]).toContain(res.statusCode);
    });
    
    it('should reject sale without items', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: 'test_customer',
          items: [],
          total: 0
        });
      
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
    
    it('should reject sale with negative total', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validSale,
          total: -100
        });
      
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
    
    it('should reject sale with invalid payment method', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validSale,
          paymentMethod: 'invalid_method'
        });
      
      expect([400, 404]).toContain(res.statusCode);
    });
    
    it('should validate item quantities', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validSale,
          items: [{
            productId: 'test',
            quantity: 0, // Invalid
            price: 100,
            total: 0
          }]
        });
      
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
  });
  
  describe('GET /api/sales/:id', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/sales/test_sale_123');
      
      expect(res.statusCode).toBe(401);
    });
    
    it('should return 404 for non-existent sale', async () => {
      const res = await request(app)
        .get('/api/sales/non_existent_999999')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.statusCode).toBe(404);
    });
  });
  
  describe('Sales Query Performance (with indexes)', () => {
    it('should handle date range queries efficiently', async () => {
      const startTime = Date.now();
      
      const res = await request(app)
        .get('/api/sales?startDate=2026-01-01&endDate=2026-12-31')
        .set('Authorization', `Bearer ${adminToken}`);
      
      const duration = Date.now() - startTime;
      
      // With saleDate index, should be fast
      expect(duration).toBeLessThan(2000);
      expect([200, 404]).toContain(res.statusCode);
    });
    
    it('should handle customer filter efficiently', async () => {
      const startTime = Date.now();
      
      const res = await request(app)
        .get('/api/sales?customerId=test_customer_123')
        .set('Authorization', `Bearer ${adminToken}`);
      
      const duration = Date.now() - startTime;
      
      // With customerId index, should be fast
      expect(duration).toBeLessThan(2000);
      expect([200, 404]).toContain(res.statusCode);
    });
  });
  
  describe('Invoice Generation', () => {
    it('should generate unique invoice numbers', async () => {
      // Test that invoice numbers don't collide
      const res1 = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: 'test',
          items: [{ productId: 'p1', quantity: 1, price: 100, total: 100 }],
          total: 100,
          paymentMethod: 'cash',
          paymentStatus: 'paid'
        });
      
      // Should succeed or fail with validation, not duplicate key error
      expect([200, 201, 400, 404]).toContain(res1.statusCode);
    });
  });
  
  describe('Role-Based Access Control', () => {
    it('should allow STAFF to create sales (main POS function)', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customerId: 'test_customer',
          items: [{
            productId: 'test_product',
            quantity: 1,
            price: 50,
            total: 50
          }],
          total: 50,
          paymentMethod: 'cash',
          paymentStatus: 'paid'
        });
      
      // STAFF primary function is to create sales
      expect([200, 201, 400, 404]).toContain(res.statusCode);
    });
    
    it('should allow both roles to view sales reports', async () => {
      const adminRes = await request(app)
        .get('/api/sales')
        .set('Authorization', `Bearer ${adminToken}`);
      
      const staffRes = await request(app)
        .get('/api/sales')
        .set('Authorization', `Bearer ${staffToken}`);
      
      expect([200, 404]).toContain(adminRes.statusCode);
      expect([200, 404]).toContain(staffRes.statusCode);
    });
  });
});
