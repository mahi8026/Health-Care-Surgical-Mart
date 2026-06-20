/**
 * Customers Controller
 * Handles business logic for customer management
 */

const BaseController = require('./base.controller');
const { ObjectId } = require('mongodb');
const { logger } = require('../config/logging');
const { getShopDatabase } = require('../config/database');

class CustomersController extends BaseController {
  /**
   * Get all customers with pagination and search
   */
  async getCustomers(req, res) {
    try {
      const shopDb = getShopDatabase(req.user.shopId);
      const { page = 1, limit = 50, search = '' } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const searchQuery = this._buildSearchQuery(search);

      const customers = await shopDb
        .collection('customers')
        .find(searchQuery)
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();

      const total = await shopDb
        .collection('customers')
        .countDocuments(searchQuery);

      const pagination = this.buildPagination(page, limit, total);

      res.json({
        success: true,
        data: customers,
        pagination,
      });
    } catch (error) {
      logger.error('Get customers error:', error);
      this.sendError(res, 'Failed to fetch customers', 500, error);
    }
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(req, res) {
    try {
      const shopDb = getShopDatabase(req.user.shopId);
      const customer = await shopDb
        .collection('customers')
        .findOne({ _id: new ObjectId(req.params.id) });

      if (!customer) {
        return this.sendError(res, 'Customer not found', 404);
      }

      this.sendSuccess(res, customer, 'Customer fetched successfully');
    } catch (error) {
      logger.error('Get customer error:', error);
      this.sendError(res, 'Failed to fetch customer', 500, error);
    }
  }

  /**
   * Create new customer
   */
  async createCustomer(req, res) {
    try {
      const shopDb = getShopDatabase(req.user.shopId);
      const {
        name, phone, email, address, type = 'Retail',
        creditEnabled = false, creditLimit = 0,
      } = req.body;

      this.validateRequired(req.body, ['name', 'phone']);

      const existingCustomer = await shopDb
        .collection('customers')
        .findOne({ phone: phone.trim() });

      if (existingCustomer) {
        return this.sendError(res, 'Customer with this phone already exists', 400);
      }

      const customerData = this._buildCustomerObject(
        { name, phone, email, address, type, creditEnabled, creditLimit },
        req.user,
      );

      const result = await shopDb.collection('customers').insertOne(customerData);

      this.sendSuccess(
        res,
        { _id: result.insertedId, ...customerData },
        'Customer created successfully',
        201,
      );
    } catch (error) {
      logger.error('Create customer error:', error);
      this.sendError(res, error.message || 'Failed to create customer', 400, error);
    }
  }

  /**
   * Update customer
   */
  async updateCustomer(req, res) {
    try {
      const shopDb = getShopDatabase(req.user.shopId);
      const {
        name, phone, email, address, type,
        creditEnabled, creditLimit,
      } = req.body;

      this.validateRequired(req.body, ['name', 'phone']);

      const existingCustomer = await shopDb
        .collection('customers')
        .findOne({ _id: new ObjectId(req.params.id) });

      if (!existingCustomer) {
        return this.sendError(res, 'Customer not found', 404);
      }

      const phoneCheck = await shopDb.collection('customers').findOne({
        phone: phone.trim(),
        _id: { $ne: new ObjectId(req.params.id) },
      });

      if (phoneCheck) {
        return this.sendError(res, 'Phone number is already taken', 400);
      }

      const updateData = this._buildUpdateData(
        { name, phone, email, address, type, creditEnabled, creditLimit },
        req.user,
      );

      await shopDb
        .collection('customers')
        .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData });

      this.sendSuccess(res, null, 'Customer updated successfully');
    } catch (error) {
      logger.error('Update customer error:', error);
      this.sendError(res, error.message || 'Failed to update customer', 500, error);
    }
  }

  /**
   * Delete customer
   */
  async deleteCustomer(req, res) {
    try {
      const shopDb = getShopDatabase(req.user.shopId);

      // Check if customer exists
      const customer = await shopDb
        .collection('customers')
        .findOne({ _id: new ObjectId(req.params.id) });

      if (!customer) {
        return this.sendError(res, 'Customer not found', 404);
      }

      // Check if customer has any sales
      const salesCount = await shopDb
        .collection('sales')
        .countDocuments({ customerId: req.params.id });

      if (salesCount > 0) {
        return this.sendError(
          res,
          'Cannot delete customer with existing sales records',
          400,
        );
      }

      // Delete customer
      await shopDb
        .collection('customers')
        .deleteOne({ _id: new ObjectId(req.params.id) });

      this.sendSuccess(res, null, 'Customer deleted successfully');
    } catch (error) {
      logger.error('Delete customer error:', error);
      this.sendError(res, 'Failed to delete customer', 500, error);
    }
  }

  // ==================== Private Helper Methods ====================

  /**
   * Build search query
   */
  _buildSearchQuery(search) {
    if (!search) {
      return {};
    }

    return {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ],
    };
  }

  /**
   * Build customer object for creation
   */
  _buildCustomerObject({ name, phone, email, address, type, creditEnabled, creditLimit }, user) {
    return {
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
      address: address?.trim() || null,
      type: type || 'Retail',
      creditEnabled: creditEnabled === true || creditEnabled === 'true',
      creditLimit: parseFloat(creditLimit) || 0,
      currentDue: 0,
      totalPurchased: 0,
      totalPurchases: 0,
      lastPurchaseDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user.id || user._id,
    };
  }

  _buildUpdateData({ name, phone, email, address, type, creditEnabled, creditLimit }, user) {
    const update = {
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
      address: address?.trim() || null,
      type: type || 'Retail',
      updatedAt: new Date(),
      updatedBy: user.id || user._id,
    };
    if (creditEnabled !== undefined) {update.creditEnabled = creditEnabled === true || creditEnabled === 'true';}
    if (creditLimit !== undefined) {update.creditLimit = parseFloat(creditLimit) || 0;}
    return update;
  }
}

module.exports = new CustomersController();
