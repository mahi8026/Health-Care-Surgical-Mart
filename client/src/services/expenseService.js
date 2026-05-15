/**
 * Expense Service
 * Handles all expense-related API operations
 *
 * NOTE: api.js interceptor already unwraps response.data.
 * Return response directly — do NOT call response.data.
 */

import { BaseService } from "./baseService";
import api from "../config/api";

class ExpenseService extends BaseService {
  constructor() {
    super("/expenses");
  }

  // Get expenses with advanced filtering
  async getExpenses(filters = {}) {
    return await api.get(this.endpoint, { params: filters });
  }

  // Upload receipt for expense
  async uploadReceipt(expenseId, file) {
    const formData = new FormData();
    formData.append("receipts", file); // server expects "receipts" (plural)
    formData.append("expenseId", expenseId);
    return await api.post("/expenses/upload-receipt", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  }

  // Get expense analytics
  async getAnalytics(params = {}) {
    return await api.get("/expenses/analytics", { params });
  }

  // Get expense summary
  async getSummary(params = {}) {
    return await api.get("/expenses/summary", { params });
  }

  // Recurring expenses
  async getRecurringExpenses(params = {}) {
    return await api.get("/expenses/recurring", { params });
  }

  async createRecurringExpense(data) {
    return await api.post("/expenses/recurring", data);
  }

  async updateRecurringExpense(id, data) {
    return await api.put(`/expenses/recurring/${id}`, data);
  }

  async stopRecurringExpense(id) {
    return await api.delete(`/expenses/recurring/${id}`);
  }

  // Process recurring expenses (admin function)
  async processRecurringExpenses() {
    return await api.post("/expenses/process-recurring");
  }

  // Get filter options (categories, payment methods, vendors, etc.)
  async getFilterOptions() {
    return await api.get("/expenses/filter-options");
  }

  // Bulk delete expenses — server has POST /expenses/bulk-delete
  async bulkDelete(expenseIds) {
    return await api.post("/expenses/bulk-delete", { expenseIds });
  }
}

export const expenseService = new ExpenseService();
export default expenseService;
