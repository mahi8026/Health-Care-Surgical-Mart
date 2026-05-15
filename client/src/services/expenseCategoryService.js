/**
 * Expense Category Service
 * Handles all expense category-related API operations
 *
 * NOTE: api.js interceptor already unwraps response.data.
 * Return response directly — do NOT call response.data.
 */

import { BaseService } from "./baseService";
import api from "../config/api";

class ExpenseCategoryService extends BaseService {
  constructor() {
    super("/expense-categories");
  }

  // Get active categories only (server returns active by default)
  async getActiveCategories() {
    return await api.get(this.endpoint);
  }

  // Get categories by type
  async getCategoriesByType(type) {
    return await api.get(`${this.endpoint}?type=${type}`);
  }

  // Soft delete category (deactivate)
  async deactivateCategory(id) {
    return await api.put(`${this.endpoint}/${id}/deactivate`);
  }

  // Reactivate category
  async reactivateCategory(id) {
    return await api.put(`${this.endpoint}/${id}/reactivate`);
  }

  // Check if category can be deleted (no associated expenses)
  async checkDeletable(id) {
    return await api.get(`${this.endpoint}/${id}/check-deletable`);
  }
}

export const expenseCategoryService = new ExpenseCategoryService();
export default expenseCategoryService;
