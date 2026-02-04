/**
 * Expense Service
 * Handles all expense-related API operations
 */

import { BaseService } from "./baseService";
import api from "../config/api";

class ExpenseService extends BaseService {
  constructor() {
    super("/expenses");
  }

  // Get expenses with advanced filtering
  async getExpenses(filters = {}) {
    const response = await api.get(this.endpoint, { params: filters });
    return response.data;
  }

  // Upload receipt for expense
  async uploadReceipt(expenseId, file) {
    const formData = new FormData();
    formData.append("receipt", file);
    formData.append("expenseId", expenseId);

    const response = await api.post("/expenses/upload-receipt", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  }

  // Get expense analytics
  async getAnalytics(params = {}) {
    const response = await api.get("/expenses/analytics", { params });
    return response.data;
  }

  // Get expense summary
  async getSummary(params = {}) {
    const response = await api.get("/expenses/summary", { params });
    return response.data;
  }

  // Recurring expenses
  async getRecurringExpenses(params = {}) {
    const response = await api.get("/expenses/recurring", { params });
    return response.data;
  }

  async createRecurringExpense(data) {
    const response = await api.post("/expenses/recurring", data);
    return response.data;
  }

  async updateRecurringExpense(id, data) {
    const response = await api.put(`/expenses/recurring/${id}`, data);
    return response.data;
  }

  async stopRecurringExpense(id) {
    const response = await api.delete(`/expenses/recurring/${id}`);
    return response.data;
  }

  // Process recurring expenses (admin function)
  async processRecurringExpenses() {
    const response = await api.post("/expenses/process-recurring");
    return response.data;
  }

  // Get filter options (categories, payment methods, vendors, etc.)
  async getFilterOptions() {
    const response = await api.get("/expenses/filter-options");
    return response.data;
  }

  // Bulk delete expenses
  async bulkDelete(expenseIds) {
    const response = await api.delete("/expenses/bulk", {
      data: { expenseIds },
    });
    return response.data;
  }
}

export const expenseService = new ExpenseService();
export default expenseService;
