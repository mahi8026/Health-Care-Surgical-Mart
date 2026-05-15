/**
 * Base Service Class
 * Provides common CRUD operations for all services
 *
 * NOTE: api.js interceptor already unwraps response.data, so `response`
 * here IS the API payload { success, data, pagination, ... }.
 * Do NOT call response.data again — return response directly.
 */

import api from "../config/api";

export class BaseService {
  constructor(endpoint) {
    this.endpoint = endpoint;
  }

  async getAll(params = {}) {
    return await api.get(this.endpoint, { params });
  }

  async getById(id) {
    return await api.get(`${this.endpoint}/${id}`);
  }

  async create(data) {
    return await api.post(this.endpoint, data);
  }

  async update(id, data) {
    return await api.put(`${this.endpoint}/${id}`, data);
  }

  async delete(id) {
    return await api.delete(`${this.endpoint}/${id}`);
  }

  async bulkDelete(ids) {
    return await api.post(`${this.endpoint}/bulk-delete`, { ids });
  }
}
