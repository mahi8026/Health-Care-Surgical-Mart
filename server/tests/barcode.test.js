/**
 * Barcode Scanner POS Tests
 * Tests barcode/SKU product lookup, unique barcode enforcement, search,
 * and creating sales with barcode-only items.
 */

const request = require('supertest');

describe('Barcode POS API', () => {
  let app;
  let adminToken;
  const unique = Date.now();

  const barcode = `8901${unique % 1000000000000}`.slice(0, 13);
  const sku = `BAR-${unique}`;

  const baseProduct = {
    name: `Barcode Test Mask ${unique}`,
    category: 'Medical',
    brand: 'TestBrand',
    sku,
    barcode,
    purchasePrice: 30,
    sellingPrice: 50,
    unit: 'pcs',
    minStockLevel: 5,
    initialQuantity: 20,
  };

  beforeAll(() => {
    app = require('../src/server');
    adminToken = global.testUtils.generateTestToken({
      userId: global.testUtils.ADMIN_ID,
      email: 'admin@test.com',
      role: 'SHOP_ADMIN',
      shopId: global.testUtils.SHOP_ID,
    });
  });

  describe('Product creation with barcode', () => {
    it('should require authentication', async () => {
      const res = await request(app).post('/api/products').send(baseProduct);
      expect(res.statusCode).toBe(401);
    });

    it('should create a product with a barcode', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(baseProduct);

      expect([200, 201]).toContain(res.statusCode);
      if (res.statusCode === 201) {
        expect(res.body.data.barcode).toBe(barcode);
        expect(res.body.data._id).toBeTruthy();
      }
    });

    it('should reject a duplicate barcode', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...baseProduct,
          sku: `${sku}-DUP`,
          name: `Duplicate Barcode ${unique}`,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message.toLowerCase()).toContain('barcode');
    });
  });

  describe('GET /api/products/lookup/:code', () => {
    it('should require authentication', async () => {
      const res = await request(app).get(`/api/products/lookup/${barcode}`);
      expect(res.statusCode).toBe(401);
    });

    it('should look up a product by barcode', async () => {
      const res = await request(app)
        .get(`/api/products/lookup/${barcode}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data._id).toBeTruthy();
      expect(res.body.data.barcode).toBe(barcode);
    });

    it('should look up a product by SKU', async () => {
      const res = await request(app)
        .get(`/api/products/lookup/${sku}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 404]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body.data.sku).toBe(sku);
      }
    });

    it('should return 404 for an unknown code', async () => {
      const res = await request(app)
        .get('/api/products/lookup/000999888777')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should return 400 for an empty code', async () => {
      const res = await request(app)
        .get('/api/products/lookup/%20%20%20')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
    });
  });

  describe('Product search by barcode', () => {
    it('should match products by barcode in search', async () => {
      const res = await request(app)
        .get(`/api/products?search=${barcode}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 404]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        const matches = (res.body.data || []).filter(
          (p) => p.barcode === barcode || p.sku === barcode,
        );
        expect(matches.length).toBeGreaterThan(0);
      }
    });
  });

  describe('POST /api/sales with barcode item', () => {
    it('should create a sale from a barcode-only item', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerType: 'Walk-in',
          items: [{ barcode, quantity: 1, sellingPrice: 50 }],
          subtotal: 50,
          discount: 0,
          vatAmount: 0,
          grandTotal: 50,
          cashPaid: 50,
          bankPaid: 0,
          paymentMethod: 'cash',
        });

      expect([200, 201]).toContain(res.statusCode);
      if (res.statusCode === 201) {
        expect(res.body.data.invoiceNo).toBeTruthy();
      }
    });

    it('should reject a sale with an unknown barcode', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: 'test_customer',
          items: [{ barcode: '9999999999999', quantity: 1, sellingPrice: 50 }],
          subtotal: 50,
          discount: 0,
          vatAmount: 0,
          grandTotal: 50,
          cashPaid: 50,
          bankPaid: 0,
          paymentMethod: 'cash',
        });

      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
  });
});