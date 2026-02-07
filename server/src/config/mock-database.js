/**
 * Mock Database for Testing Purchase Orders
 * This is a temporary solution while we resolve MongoDB Atlas SSL issues
 */

const { logger } = require("./logging");

// In-memory data store
const mockData = {
  purchases: [],
  suppliers: [
    {
      _id: "supplier1",
      name: "Medical Supplies Co",
      company: "Medical Supplies Company Ltd",
      phone: "+880123456789",
      email: "contact@medicalsupplies.com",
      address: "123 Medical Street, Dhaka",
    },
    {
      _id: "supplier2",
      name: "Pharma Distributors",
      company: "Pharma Distributors Ltd",
      phone: "+880987654321",
      email: "info@pharmadist.com",
      address: "456 Pharma Avenue, Chittagong",
    },
  ],
  products: [
    {
      _id: "product1",
      name: "Paracetamol 500mg",
      sku: "PAR500",
      category: "Medicine",
      purchasePrice: 2.5,
      sellingPrice: 5.0,
      isActive: true,
    },
    {
      _id: "product2",
      name: "Surgical Mask",
      sku: "MASK001",
      category: "PPE",
      purchasePrice: 1.0,
      sellingPrice: 2.5,
      isActive: true,
    },
    {
      _id: "product3",
      name: "Digital Thermometer",
      sku: "THERM001",
      category: "Equipment",
      purchasePrice: 15.0,
      sellingPrice: 25.0,
      isActive: true,
    },
  ],
  stock: [],
  users: [
    {
      _id: "user1",
      name: "Test User",
      email: "test@example.com",
      role: "SHOP_ADMIN",
      shopId: "test_shop",
      permissions: [
        "create_purchase",
        "view_purchases",
        "edit_purchase",
        "view_suppliers",
        "view_products",
      ],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  sales: [
    {
      _id: "sale1",
      invoiceNo: "INV-001",
      saleDate: new Date(),
      grandTotal: 150,
      paymentStatus: "Paid",
      customerId: "customer1",
      items: [
        { productId: "product1", qty: 5, rate: 10, total: 50 },
        { productId: "product2", qty: 10, rate: 10, total: 100 },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: "sale2",
      invoiceNo: "INV-002",
      saleDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      grandTotal: 75,
      paymentStatus: "Paid",
      customerId: "customer2",
      items: [{ productId: "product3", qty: 3, rate: 25, total: 75 }],
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  ],
  expenses: [
    {
      _id: "expense1",
      expenseNo: "EXP-001",
      amount: 50,
      category: "Office Supplies",
      expenseDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  stock: [
    {
      _id: "stock1",
      productId: "product1",
      currentQty: 100,
      availableQty: 95,
      reservedQty: 5,
      isLowStock: false,
      lastUpdated: new Date(),
    },
    {
      _id: "stock2",
      productId: "product2",
      currentQty: 50,
      availableQty: 50,
      reservedQty: 0,
      isLowStock: false,
      lastUpdated: new Date(),
    },
  ],
  shops: [
    {
      _id: "shop1",
      shopId: "test_shop",
      name: "Test Medical Store",
      status: "Active",
      subscriptionExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  system_users: [
    {
      _id: "user1",
      name: "Test User",
      email: "test@example.com",
      role: "SHOP_ADMIN",
      shopId: "test_shop",
      permissions: [
        "create_purchase",
        "view_purchases",
        "edit_purchase",
        "view_suppliers",
        "view_products",
        "view_sales_report",
      ],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
};

// Mock collection class
class MockCollection {
  constructor(name, data) {
    this.name = name;
    this.data = data;
  }

  async find(query = {}) {
    return {
      toArray: async () => {
        let results = [...this.data];

        // Simple query matching
        if (Object.keys(query).length > 0) {
          results = results.filter((item) => {
            return Object.keys(query).every((key) => {
              if (
                key === "_id" &&
                typeof query[key] === "object" &&
                query[key].toString
              ) {
                return item._id === query[key].toString();
              }
              return item[key] === query[key];
            });
          });
        }

        return results;
      },
      sort: (sortObj) => ({
        toArray: async () => {
          let results = [...this.data];

          // Apply query filter first
          if (Object.keys(query).length > 0) {
            results = results.filter((item) => {
              return Object.keys(query).every((key) => {
                if (
                  key === "_id" &&
                  typeof query[key] === "object" &&
                  query[key].toString
                ) {
                  return item._id === query[key].toString();
                }
                return item[key] === query[key];
              });
            });
          }

          // Apply sorting
          if (sortObj && Object.keys(sortObj).length > 0) {
            const sortKey = Object.keys(sortObj)[0];
            const sortOrder = sortObj[sortKey];
            results.sort((a, b) => {
              if (sortOrder === 1) {
                return a[sortKey] > b[sortKey] ? 1 : -1;
              } else {
                return a[sortKey] < b[sortKey] ? 1 : -1;
              }
            });
          }

          return results;
        },
        skip: (skipCount) => ({
          toArray: async () => {
            let results = [...this.data];

            // Apply query filter
            if (Object.keys(query).length > 0) {
              results = results.filter((item) => {
                return Object.keys(query).every((key) => {
                  if (
                    key === "_id" &&
                    typeof query[key] === "object" &&
                    query[key].toString
                  ) {
                    return item._id === query[key].toString();
                  }
                  return item[key] === query[key];
                });
              });
            }

            // Apply sorting
            if (sortObj && Object.keys(sortObj).length > 0) {
              const sortKey = Object.keys(sortObj)[0];
              const sortOrder = sortObj[sortKey];
              results.sort((a, b) => {
                if (sortOrder === 1) {
                  return a[sortKey] > b[sortKey] ? 1 : -1;
                } else {
                  return a[sortKey] < b[sortKey] ? 1 : -1;
                }
              });
            }

            return results.slice(skipCount);
          },
          limit: (limitCount) => ({
            toArray: async () => {
              let results = [...this.data];

              // Apply query filter
              if (Object.keys(query).length > 0) {
                results = results.filter((item) => {
                  return Object.keys(query).every((key) => {
                    if (
                      key === "_id" &&
                      typeof query[key] === "object" &&
                      query[key].toString
                    ) {
                      return item._id === query[key].toString();
                    }
                    return item[key] === query[key];
                  });
                });
              }

              // Apply sorting
              if (sortObj && Object.keys(sortObj).length > 0) {
                const sortKey = Object.keys(sortObj)[0];
                const sortOrder = sortObj[sortKey];
                results.sort((a, b) => {
                  if (sortOrder === 1) {
                    return a[sortKey] > b[sortKey] ? 1 : -1;
                  } else {
                    return a[sortKey] < b[sortKey] ? 1 : -1;
                  }
                });
              }

              return results.slice(skipCount, skipCount + limitCount);
            },
          }),
        }),
      }),
      skip: (skipCount) => ({
        toArray: async () => {
          let results = [...this.data];

          // Apply query filter
          if (Object.keys(query).length > 0) {
            results = results.filter((item) => {
              return Object.keys(query).every((key) => {
                if (
                  key === "_id" &&
                  typeof query[key] === "object" &&
                  query[key].toString
                ) {
                  return item._id === query[key].toString();
                }
                return item[key] === query[key];
              });
            });
          }

          return results.slice(skipCount);
        },
        limit: (limitCount) => ({
          toArray: async () => {
            let results = [...this.data];

            // Apply query filter
            if (Object.keys(query).length > 0) {
              results = results.filter((item) => {
                return Object.keys(query).every((key) => {
                  if (
                    key === "_id" &&
                    typeof query[key] === "object" &&
                    query[key].toString
                  ) {
                    return item._id === query[key].toString();
                  }
                  return item[key] === query[key];
                });
              });
            }

            return results.slice(skipCount, skipCount + limitCount);
          },
        }),
      }),
      limit: (limitCount) => ({
        toArray: async () => {
          let results = [...this.data];

          // Apply query filter
          if (Object.keys(query).length > 0) {
            results = results.filter((item) => {
              return Object.keys(query).every((key) => {
                if (
                  key === "_id" &&
                  typeof query[key] === "object" &&
                  query[key].toString
                ) {
                  return item._id === query[key].toString();
                }
                return item[key] === query[key];
              });
            });
          }

          return results.slice(0, limitCount);
        },
      }),
    };
  }

  async findOne(query = {}) {
    const results = await this.find(query);
    const array = await results.toArray();
    return array.length > 0 ? array[0] : null;
  }

  async countDocuments(query = {}) {
    let results = [...this.data];

    // Apply query filter
    if (Object.keys(query).length > 0) {
      results = results.filter((item) => {
        return Object.keys(query).every((key) => {
          if (
            key === "_id" &&
            typeof query[key] === "object" &&
            query[key].toString
          ) {
            return item._id === query[key].toString();
          }
          return item[key] === query[key];
        });
      });
    }

    return results.length;
  }

  async insertOne(doc) {
    const newDoc = {
      _id:
        doc._id ||
        `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...doc,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.data.push(newDoc);

    return {
      insertedId: newDoc._id,
      acknowledged: true,
    };
  }

  async updateOne(query, update) {
    const item = await this.findOne(query);
    if (item) {
      const index = this.data.findIndex((d) => d._id === item._id);
      if (index !== -1) {
        if (update.$set) {
          Object.assign(this.data[index], update.$set, {
            updatedAt: new Date(),
          });
        }
        return { modifiedCount: 1, acknowledged: true };
      }
    }
    return { modifiedCount: 0, acknowledged: true };
  }

  async aggregate(pipeline) {
    // Simple aggregation support for purchases with supplier lookup
    let results = [...this.data];

    for (const stage of pipeline) {
      if (stage.$match) {
        results = results.filter((item) => {
          return Object.keys(stage.$match).every((key) => {
            if (
              key === "_id" &&
              typeof stage.$match[key] === "object" &&
              stage.$match[key].toString
            ) {
              return item._id === stage.$match[key].toString();
            }

            // Handle date range queries
            if (key.includes("Date") && typeof stage.$match[key] === "object") {
              const itemDate = new Date(item[key]);
              if (
                stage.$match[key].$gte &&
                itemDate < new Date(stage.$match[key].$gte)
              ) {
                return false;
              }
              if (
                stage.$match[key].$lte &&
                itemDate > new Date(stage.$match[key].$lte)
              ) {
                return false;
              }
              return true;
            }

            return item[key] === stage.$match[key];
          });
        });
      }

      if (stage.$lookup && stage.$lookup.from === "suppliers") {
        results = results.map((item) => {
          const supplier = mockData.suppliers.find(
            (s) => s._id === item.supplierId,
          );
          return {
            ...item,
            supplier: supplier || { name: "Unknown Supplier", company: "" },
          };
        });
      }

      if (stage.$group) {
        // Simple grouping support
        if (stage.$group._id === null) {
          // Aggregate all records
          const totalSales = results.reduce(
            (sum, item) =>
              sum + (item.grandTotal || item.totalAmount || item.amount || 0),
            0,
          );
          const totalOrders = results.length;
          const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

          results = [
            {
              _id: null,
              totalSales: totalSales,
              totalOrders: totalOrders,
              avgOrderValue: avgOrderValue,
              totalAmount: totalSales,
              count: totalOrders,
            },
          ];
        }
      }

      if (stage.$sort) {
        const sortKey = Object.keys(stage.$sort)[0];
        const sortOrder = stage.$sort[sortKey];
        results.sort((a, b) => {
          if (sortOrder === -1) {
            return new Date(b[sortKey]) - new Date(a[sortKey]);
          }
          return new Date(a[sortKey]) - new Date(b[sortKey]);
        });
      }

      if (stage.$skip) {
        results = results.slice(stage.$skip);
      }

      if (stage.$limit) {
        results = results.slice(0, stage.$limit);
      }
    }

    return {
      toArray: async () => results,
    };
  }
}

// Mock database class
class MockDatabase {
  constructor(name) {
    this.name = name;
  }

  collection(collectionName) {
    if (!mockData[collectionName]) {
      mockData[collectionName] = [];
    }
    return new MockCollection(collectionName, mockData[collectionName]);
  }
}

// Mock client
const mockClient = {
  db: (name) => new MockDatabase(name),
  close: async () => {
    logger.info("Mock database connection closed");
  },
};

/**
 * Connect to mock database
 */
async function connectToMockDatabase() {
  logger.info(
    "🔧 Using mock database for testing (MongoDB Atlas connection failed)",
  );
  logger.info("Mock data initialized with sample suppliers and products");
  return mockClient;
}

/**
 * Get mock database for shop
 */
function getMockShopDatabase(shopId) {
  return mockClient.db(`shop_${shopId}`);
}

/**
 * Get mock system database
 */
function getMockSystemDatabase() {
  return mockClient.db("medical_store_system");
}

module.exports = {
  connectToMockDatabase,
  getMockShopDatabase,
  getMockSystemDatabase,
  mockClient,
};
