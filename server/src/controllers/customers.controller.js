/**
 * Customers Controller
 * Handles business logic for customer management
 */

const BaseController = require("./base.controller");
const { ObjectId } = require("mongodb");
const { logger } = require("../config/logging");
const { getShopDatabase } = require("../config/database");

class CustomersController extends BaseController {
  /**
   * Get all customers with pagination and search
   */
  async getCustomers(req, res) {
    try {
      const shopDb = getShopDatabase(req.user.shopId);
      const { page = 1, limit = 50, search = "" } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const searchQuery = this._buildSearchQuery(search);

      const customers = await shopDb
        .collection("customers")
        .find(searchQuery)
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();

      const total = await shopDb
        .collection("customers")
        .countDocuments(searchQuery);

      const pagination = this.buildPagination(page, limit, total);

      res.json({
        success: true,
        data: customers,
        pagination,
      });
    } catch (error) {
      logger.error("Get customers error:", error);
      this.sendError(res, "Failed to fetch customers", 500, error);
    }
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(req, res) {
    try {
      const shopDb = getShopDatabase(req.user.shopId);
      const customer = await shopDb
        .collection("customers")
        .findOne({ _id: new ObjectId(req.params.id) });

      if (!customer) {
        return this.sendError(res, "Customer not found", 404);
      }

      this.sendSuccess(res, customer, "Customer fetched successfully");
    } catch (error) {
      logger.error("Get customer error:", error);
      this.sendError(res, "Failed to fetch customer", 500, error);
    }
  }

  /**
   * Create new customer
   */
  async createCustomer(req, res) {
    try {
      const shopDb = getShopDatabase(req.user.shopId);
      const { name, phone, email, address, type = "Regular" } = req.body;

      // Validate required fields
      this.validateRequired(req.body, ["name", "phone"]);

      // Check if phone already exists
      const existingCustomer = await shopDb
        .collection("customers")
        .findOne({ phone: phone.trim() });

      if (existingCustomer) {
        return this.sendError(
          res,
          "Customer with this phone already exists",
          400,
        );
      }

      // Build customer object
      const customerData = this._buildCustomerObject(
        { name, phone, email, address, type },
        req.user,
      );

      // Insert customer
      const result = await shopDb
        .collection("customers")
        .insertOne(customerData);

      this.sendSuccess(
        res,
        { _id: result.insertedId, ...customerData },
        "Customer created successfully",
        201,
      );
    } catch (error) {
      logger.error("Create customer error:", error);
      this.sendError(res, error.message || "Failed to create customer", 400, error);
    }
  }

  /**
   * Update customer
   */
  async updateCustomer(req, res) {
    try {
      const shopDb = getShopDatabase(req.user.shopId);
      const { name, phone, email, address, type } = req.body;

      // Validate required fields
      this.validateRequired(req.body, ["name", "phone"]);

      // Check if customer exists
      const existingCustomer = await shopDb
        .collection("customers")
        .findOne({ _id: new ObjectId(req.params.id) });

      if (!existingCustomer) {
        return this.sendError(res, "Customer not found", 404);
      }

      // Check if phone is taken by another customer
      const phoneCheck = await shopDb.collection("customers").findOne({
        phone: phone.trim(),
        _id: { $ne: new ObjectId(req.params.id) },
      });

      if (phoneCheck) {
        return this.sendError(res, "Phone number is already taken", 400);
      }

      // Build update data
      const updateData = this._buildUpdateData(
        { name, phone, email, address, type },
        req.user,
      );

      // Update customer
      await shopDb
        .collection("customers")
        .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData });

      this.sendSuccess(res, null, "Customer updated successfully");
    } catch (error) {
      logger.error("Update customer error:", error);
      this.sendError(res, error.message || "Failed to update customer", 500, error);
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
        .collection("customers")
        .findOne({ _id: new ObjectId(req.params.id) });

      if (!customer) {
        return this.sendError(res, "Customer not found", 404);
      }

      // Check if customer has any sales
      const salesCount = await shopDb
        .collection("sales")
        .countDocuments({ customerId: req.params.id });

      if (salesCount > 0) {
        return this.sendError(
          res,
          "Cannot delete customer with existing sales records",
          400,
        );
      }

      // Delete customer
      await shopDb
        .collection("customers")
        .deleteOne({ _id: new ObjectId(req.params.id) });

      this.sendSuccess(res, null, "Customer deleted successfully");
    } catch (error) {
      logger.error("Delete customer error:", error);
      this.sendError(res, "Failed to delete customer", 500, error);
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
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ],
    };
  }

  /**
   * Build customer object for creation
   */
  _buildCustomerObject({ name, phone, email, address, type }, user) {
    return {
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
      address: address?.trim() || null,
      type,
      totalPurchases: 0,
      lastPurchaseDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user.id || user._id,
    };
  }

  /**
   * Build update data object
   */
  _buildUpdateData({ name, phone, email, address, type }, user) {
    return {
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
      address: address?.trim() || null,
      type,
      updatedAt: new Date(),
      updatedBy: user.id || user._id,
    };
  }
}

module.exports = new CustomersController();
