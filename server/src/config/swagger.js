/**
 * Swagger/OpenAPI Configuration
 * API Documentation setup using swagger-jsdoc and swagger-ui-express
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { logger } = require('./logging');

/**
 * Swagger JSDoc Options
 */
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Health Care Surgical Mart - POS API',
      version: '2.0.0',
      description:
        'Multi-tenant Medical Store Point of Sale System API with Firebase Authentication, RBAC, and comprehensive inventory management',
      contact: {
        name: 'API Support',
        email: 'support@healthcaresurgicalmart.com',
      },
      license: {
        name: 'Proprietary',
        url: 'https://healthcaresurgicalmart.com/license',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
      {
        url: 'https://staging-api.healthcaresurgicalmart.com',
        description: 'Staging server',
      },
      {
        url: 'https://api.healthcaresurgicalmart.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'JWT token obtained from /api/auth/firebase-login endpoint',
        },
      },
      schemas: {
        // Common Response Schemas
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Operation completed successfully',
            },
            data: {
              type: 'object',
              description: 'Response data (varies by endpoint)',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'Error message',
            },
            error: {
              type: 'string',
              description: 'Error details (development only)',
            },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            total: {
              type: 'integer',
              example: 100,
            },
            page: {
              type: 'integer',
              example: 1,
            },
            limit: {
              type: 'integer',
              example: 20,
            },
            totalPages: {
              type: 'integer',
              example: 5,
            },
          },
        },

        // User & Authentication Schemas
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011',
            },
            name: {
              type: 'string',
              example: 'John Doe',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john.doe@example.com',
            },
            role: {
              type: 'string',
              enum: ['ADMIN', 'MANAGER', 'CASHIER'],
              example: 'MANAGER',
            },
            shopId: {
              type: 'string',
              example: 'shop_12345',
            },
            permissions: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['sales.create', 'products.read', 'customers.manage'],
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['idToken', 'email'],
          properties: {
            idToken: {
              type: 'string',
              description: 'Firebase ID token',
              example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFkYzBmM...',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            shopId: {
              type: 'string',
              description: 'Shop ID (optional for multi-shop users)',
              example: 'shop_12345',
            },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Login successful',
            },
            data: {
              type: 'object',
              properties: {
                token: {
                  type: 'string',
                  description: 'JWT token for API authentication',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                },
                user: {
                  $ref: '#/components/schemas/User',
                },
              },
            },
          },
        },

        // Product Schemas
        Product: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011',
            },
            name: {
              type: 'string',
              example: 'Surgical Gloves - Medium',
            },
            sku: {
              type: 'string',
              example: 'SG-MED-001',
            },
            barcode: {
              type: 'string',
              example: '1234567890123',
            },
            category: {
              type: 'string',
              example: 'Surgical Supplies',
            },
            subcategory: {
              type: 'string',
              example: 'Gloves',
            },
            manufacturer: {
              type: 'string',
              example: 'MedSupply Inc.',
            },
            price: {
              type: 'number',
              format: 'float',
              example: 15.99,
            },
            costPrice: {
              type: 'number',
              format: 'float',
              example: 10.5,
            },
            taxRate: {
              type: 'number',
              format: 'float',
              example: 5.0,
            },
            unit: {
              type: 'string',
              example: 'box',
            },
            description: {
              type: 'string',
              example: 'Latex-free surgical gloves, powder-free',
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
            shopId: {
              type: 'string',
              example: 'shop_12345',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },

        // Stock Schema
        Stock: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011',
            },
            productId: {
              type: 'string',
              example: '507f1f77bcf86cd799439012',
            },
            quantity: {
              type: 'integer',
              example: 150,
            },
            reorderLevel: {
              type: 'integer',
              example: 20,
            },
            isLowStock: {
              type: 'boolean',
              example: false,
            },
            lastRestocked: {
              type: 'string',
              format: 'date-time',
            },
            shopId: {
              type: 'string',
              example: 'shop_12345',
            },
          },
        },

        // Sale Schemas
        Sale: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011',
            },
            invoiceNumber: {
              type: 'string',
              example: 'INV-2026-00123',
            },
            customerId: {
              type: 'string',
              example: '507f1f77bcf86cd799439013',
            },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  productId: {
                    type: 'string',
                  },
                  productName: {
                    type: 'string',
                  },
                  quantity: {
                    type: 'integer',
                  },
                  price: {
                    type: 'number',
                  },
                  discount: {
                    type: 'number',
                  },
                  tax: {
                    type: 'number',
                  },
                  total: {
                    type: 'number',
                  },
                },
              },
            },
            subtotal: {
              type: 'number',
              example: 150.0,
            },
            discount: {
              type: 'number',
              example: 10.0,
            },
            tax: {
              type: 'number',
              example: 7.0,
            },
            total: {
              type: 'number',
              example: 147.0,
            },
            paymentMethod: {
              type: 'string',
              enum: ['cash', 'card', 'mobile', 'credit'],
              example: 'card',
            },
            status: {
              type: 'string',
              enum: ['completed', 'pending', 'cancelled'],
              example: 'completed',
            },
            shopId: {
              type: 'string',
              example: 'shop_12345',
            },
            createdBy: {
              type: 'string',
              example: '507f1f77bcf86cd799439014',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },

        // Customer Schema
        Customer: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011',
            },
            name: {
              type: 'string',
              example: 'Dr. Sarah Johnson',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'sarah.johnson@hospital.com',
            },
            phone: {
              type: 'string',
              example: '+8801712345678',
            },
            address: {
              type: 'string',
              example: '123 Medical Plaza, Dhaka',
            },
            customerType: {
              type: 'string',
              enum: ['individual', 'hospital', 'clinic', 'pharmacy'],
              example: 'hospital',
            },
            creditLimit: {
              type: 'number',
              example: 50000.0,
            },
            outstandingBalance: {
              type: 'number',
              example: 5000.0,
            },
            shopId: {
              type: 'string',
              example: 'shop_12345',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },

        // Supplier Schema
        Supplier: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011',
            },
            name: {
              type: 'string',
              example: 'MedSupply International',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'sales@medsupply.com',
            },
            phone: {
              type: 'string',
              example: '+8801812345678',
            },
            address: {
              type: 'string',
              example: '456 Industrial Area, Dhaka',
            },
            contactPerson: {
              type: 'string',
              example: 'Ahmed Khan',
            },
            paymentTerms: {
              type: 'string',
              example: 'Net 30',
            },
            shopId: {
              type: 'string',
              example: 'shop_12345',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },

        // Expense Schema
        Expense: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011',
            },
            category: {
              type: 'string',
              example: 'Utilities',
            },
            subcategory: {
              type: 'string',
              example: 'Electricity',
            },
            amount: {
              type: 'number',
              example: 5000.0,
            },
            description: {
              type: 'string',
              example: 'Monthly electricity bill',
            },
            date: {
              type: 'string',
              format: 'date',
              example: '2026-05-10',
            },
            paymentMethod: {
              type: 'string',
              enum: ['cash', 'bank_transfer', 'card', 'mobile'],
              example: 'bank_transfer',
            },
            receiptUrl: {
              type: 'string',
              example: 'https://storage.googleapis.com/bucket/receipts/...',
            },
            shopId: {
              type: 'string',
              example: 'shop_12345',
            },
            createdBy: {
              type: 'string',
              example: '507f1f77bcf86cd799439014',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },

        // Return Schema
        Return: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011',
            },
            returnNumber: {
              type: 'string',
              example: 'RET-2026-00045',
            },
            originalSaleId: {
              type: 'string',
              example: '507f1f77bcf86cd799439012',
            },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  productId: {
                    type: 'string',
                  },
                  productName: {
                    type: 'string',
                  },
                  quantity: {
                    type: 'integer',
                  },
                  refundAmount: {
                    type: 'number',
                  },
                },
              },
            },
            totalRefund: {
              type: 'number',
              example: 50.0,
            },
            returnReason: {
              type: 'string',
              example: 'Damaged product',
            },
            status: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected', 'completed'],
              example: 'approved',
            },
            shopId: {
              type: 'string',
              example: 'shop_12345',
            },
            createdBy: {
              type: 'string',
              example: '507f1f77bcf86cd799439014',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },

        // Purchase Schema
        Purchase: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011',
            },
            purchaseNumber: {
              type: 'string',
              example: 'PO-2026-00089',
            },
            supplierId: {
              type: 'string',
              example: '507f1f77bcf86cd799439013',
            },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  productId: {
                    type: 'string',
                  },
                  productName: {
                    type: 'string',
                  },
                  quantity: {
                    type: 'integer',
                  },
                  costPrice: {
                    type: 'number',
                  },
                  total: {
                    type: 'number',
                  },
                },
              },
            },
            subtotal: {
              type: 'number',
              example: 10000.0,
            },
            tax: {
              type: 'number',
              example: 500.0,
            },
            total: {
              type: 'number',
              example: 10500.0,
            },
            status: {
              type: 'string',
              enum: ['pending', 'received', 'cancelled'],
              example: 'received',
            },
            shopId: {
              type: 'string',
              example: 'shop_12345',
            },
            createdBy: {
              type: 'string',
              example: '507f1f77bcf86cd799439014',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication token is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                success: false,
                message: 'No token provided',
              },
            },
          },
        },
        ForbiddenError: {
          description: 'User does not have required permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                success: false,
                message: 'Insufficient permissions',
              },
            },
          },
        },
        ValidationError: {
          description: 'Request validation failed',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                success: false,
                message: 'Validation error: name is required',
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                success: false,
                message: 'Resource not found',
              },
            },
          },
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                success: false,
                message: 'Internal server error',
              },
            },
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints',
      },
      {
        name: 'Sales',
        description: 'Point of Sale transactions and invoice management',
      },
      {
        name: 'Products',
        description: 'Product catalog and inventory management',
      },
      {
        name: 'Stock',
        description: 'Stock levels and inventory tracking',
      },
      {
        name: 'Returns',
        description: 'Product returns and refund processing',
      },
      {
        name: 'Customers',
        description: 'Customer relationship management',
      },
      {
        name: 'Suppliers',
        description: 'Supplier management and procurement',
      },
      {
        name: 'Expenses',
        description: 'Business expense tracking and categorization',
      },
      {
        name: 'Purchases',
        description: 'Purchase orders and supplier transactions',
      },
      {
        name: 'Financial Reports',
        description: 'Financial analytics and reporting',
      },
      {
        name: 'Email',
        description: 'Email campaign management and templates',
      },
      {
        name: 'SMS',
        description: 'SMS messaging and notifications',
      },
      {
        name: 'Notifications',
        description: 'System notifications and alerts',
      },
      {
        name: 'Users',
        description: 'User management and permissions',
      },
      {
        name: 'Super Admin',
        description: 'Super admin operations and shop management',
      },
      {
        name: 'Bulk Operations',
        description: 'Bulk product import and data operations',
      },
      {
        name: 'Settings',
        description: 'System configuration and preferences',
      },
    ],
  },
  apis: [
    './src/routes/*.routes.js', // All route files
    './src/routes/**/*.routes.js', // Nested route files
  ],
};

/**
 * Generate Swagger specification
 */
const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * Setup Swagger middleware
 * @param {Express} app - Express application instance
 */
function setupSwagger(app) {
  const swaggerEnabled =
    process.env.SWAGGER_ENABLED === 'true' ||
    process.env.NODE_ENV === 'development';

  if (!swaggerEnabled) {
    logger.info('Swagger UI is disabled in production', {
      file: 'swagger.js',
      function: 'setupSwagger',
      nodeEnv: process.env.NODE_ENV,
    });
    return;
  }

  // Swagger UI options
  const swaggerUiOptions = {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Health Care Surgical Mart API Docs',
  };

  // Mount Swagger UI
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

  // Serve raw OpenAPI spec as JSON
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  logger.info('Swagger UI enabled', {
    file: 'swagger.js',
    function: 'setupSwagger',
    url: '/api/docs',
    specUrl: '/api/docs.json',
  });
}

module.exports = {
  setupSwagger,
  swaggerSpec,
};
