/**
 * Expense Category Service
 * Handles all expense category-related API operations
 */

import { BaseService } from "./baseService";
import api from "../config/api";

class ExpenseCategoryService extends BaseService {
  constructor() {
    super("/expense-categories");
  }

  // Get active categories only
  async getActiveCategories() {
    const response = await api.get(`${this.endpoint}?active=true`);
    return response.data;
  }

  // Get categories by type
  async getCategoriesByType(type) {
    const response = await api.get(`${this.endpoint}?type=${type}`);
    return response.data;
  }

  // Soft delete category (deactivate)
  async deactivateCategory(id) {
    const response = await api.put(`${this.endpoint}/${id}/deactivate`);
    return response.data;
  }

  // Reactivate category
  async reactivateCategory(id) {
    const response = await api.put(`${this.endpoint}/${id}/reactivate`);
    return response.data;
  }

  // Check if category can be deleted (no associated expenses)
  async checkDeletable(id) {
    const response = await api.get(`${this.endpoint}/${id}/check-deletable`);
    return response.data;
  }
}

export const expenseCategoryService = new ExpenseCategoryService();
export default expenseCategoryService;
