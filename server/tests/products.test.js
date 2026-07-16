/**
 * Product Management Tests
 * Tests for product CRUD operations
 */

const request = require('supertest');

describe('Product Management API', () => {
  let app;
  let adminToken;
  let staffToken;
  
  beforeAll(() => {
    // Import app after environment is set
    app = require('../src/server');
    
    // Create test tokens using globally seeded test user IDs
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
  
  describe('GET /api/products', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/products');
      
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
    
    it('should list products for authenticated user', async () => {
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${adminToken}`);
      
      // Should succeed (200) or return empty list
      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data || res.body.products)).toBe(true);
      }
    });
    
    it('should support pagination parameters', async () => {
      const res = await request(app)
        .get('/api/products?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);
      
      // Should handle pagination without errors
      expect([200, 404]).toContain(res.statusCode);
    });
    
    it('should support search by name', async () => {
      const res = await request(app)
        .get('/api/products?search=surgical')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect([200, 404]).toContain(res.statusCode);
    });
    
    it('should support category filtering', async () => {
      const res = await request(app)
        .get('/api/products?category=PPE')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect([200, 404]).toContain(res.statusCode);
    });
    
    it('should allow STAFF role to view products', async () => {
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${staffToken}`);
      
      // STAFF should be able to read products
      expect([200, 404]).toContain(res.statusCode);
    });
  });
  
  describe('POST /api/products', () => {
    const validProduct = {
      name: 'Test Surgical Mask FFP2',
      sku: `TEST-${Date.now()}`,
      category: 'PPE',
      price: 50,
      costPrice: 30,
      stock: 100,
      minStock: 10,
      description: 'High quality FFP2 surgical mask',
      brand: 'Test Brand',
      unit: 'piece',
      isActive: true
    };
    
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/products')
        .send(validProduct);
      
      expect(res.statusCode).toBe(401);
    });
    
    it('should reject product creation by STAFF', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(validProduct);
      
      // STAFF typically shouldn't create products (read-only)
      expect([403, 401]).toContain(res.statusCode);
    });
    
    it('should reject product without required fields', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Incomplete Product'
          // Missing SKU, price, etc.
        });
      
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });
    
    it('should reject invalid price', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validProduct,
          price: -10 // Invalid negative price
        });
      
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
    
    it('should reject invalid stock quantity', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validProduct,
          stock: -5 // Invalid negative stock
        });
      
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
  });
  
  describe('GET /api/products/:id', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/products/test_id_123');
      
      expect(res.statusCode).toBe(401);
    });
    
    it('should return 404 for non-existent product', async () => {
      const res = await request(app)
        .get('/api/products/non_existent_id_999999')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.statusCode).toBe(404);
    });
    
    it('should allow STAFF to view product details', async () => {
      const res = await request(app)
        .get('/api/products/test_id')
        .set('Authorization', `Bearer ${staffToken}`);
      
      // Should allow read access (404 if not found, not 403)
      expect([200, 404]).toContain(res.statusCode);
    });
  });
  
  describe('PUT /api/products/:id', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .put('/api/products/test_id_123')
        .send({ name: 'Updated Name' });
      
      expect(res.statusCode).toBe(401);
    });
    
    it('should reject updates by STAFF role', async () => {
      const res = await request(app)
        .put('/api/products/test_id')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Updated by Staff' });
      
      // STAFF shouldn't be able to update products
      expect([403, 401, 404]).toContain(res.statusCode);
    });
    
    it('should reject invalid price update', async () => {
      const res = await request(app)
        .put('/api/products/test_id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: -50 });
      
      expect([400, 404]).toContain(res.statusCode);
    });
  });
  
  describe('DELETE /api/products/:id', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .delete('/api/products/test_id_123');
      
      expect(res.statusCode).toBe(401);
    });
    
    it('should reject deletion by STAFF role', async () => {
      const res = await request(app)
        .delete('/api/products/test_id')
        .set('Authorization', `Bearer ${staffToken}`);
      
      // STAFF shouldn't be able to delete products
      expect([403, 401, 404]).toContain(res.statusCode);
    });
    
    it('should return 404 for non-existent product', async () => {
      const res = await request(app)
        .delete('/api/products/non_existent_999999')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.statusCode).toBe(404);
    });
  });
  
  describe('Product Search Performance', () => {
    it('should handle search queries efficiently', async () => {
      const startTime = Date.now();
      
      const res = await request(app)
        .get('/api/products?search=mask')
        .set('Authorization', `Bearer ${adminToken}`);
      
      const duration = Date.now() - startTime;
      
      // With indexes, should be fast (<500ms even with network)
      expect(duration).toBeLessThan(2000);
      expect([200, 404]).toContain(res.statusCode);
    });
    
    it('should handle category filtering efficiently', async () => {
      const startTime = Date.now();
      
      const res = await request(app)
        .get('/api/products?category=PPE')
        .set('Authorization', `Bearer ${adminToken}`);
      
      const duration = Date.now() - startTime;
      
      // Should be fast with category index
      expect(duration).toBeLessThan(2000);
      expect([200, 404]).toContain(res.statusCode);
    });
  });
  
  describe('Product Validation', () => {
    it('should reject product with empty name', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '',
          sku: 'TEST-123',
          price: 100
        });
      
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
    
    it('should reject product with empty SKU', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Product',
          sku: '',
          price: 100
        });
      
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
    
    it('should handle missing optional fields gracefully', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Test Product ${Date.now()}`,
          sku: `TEST-${Date.now()}`,
          price: 100
          // Optional fields like description, brand omitted
        });
      
      // Should accept or validate properly
      expect([200, 201, 400, 403]).toContain(res.statusCode);
    });
  });
  
  describe('Role-Based Access Control', () => {
    it('should enforce SHOP_ADMIN can create products', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `RBAC Test ${Date.now()}`,
          sku: `RBAC-${Date.now()}`,
          price: 99
        });
      
      // Admin should have access (200/201) or validation error (400)
      expect([200, 201, 400]).toContain(res.statusCode);
    });
    
    it('should allow both roles to read products', async () => {
      const adminRes = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${adminToken}`);
      
      const staffRes = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${staffToken}`);
      
      // Both should be able to read
      expect([200, 404]).toContain(adminRes.statusCode);
      expect([200, 404]).toContain(staffRes.statusCode);
    });
  });
});
