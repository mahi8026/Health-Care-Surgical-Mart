import api from "../config/api";

class BulkProductService {
  /**
   * Upload bulk product file
   */
  async uploadFile(file, options = {}) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("importType", options.importType || "create");
    formData.append("skipDuplicates", options.skipDuplicates || false);
    formData.append("updateExisting", options.updateExisting || false);
    formData.append("validateOnly", options.validateOnly || false);
    formData.append("autoGenerateSKU", options.autoGenerateSKU || false);

    return await api.post("/bulk-products/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  }

  /**
   * Process bulk import
   */
  async processImport(importId) {
    return await api.post(`/bulk-products/process/${importId}`);
  }

  /**
   * Get all bulk imports
   */
  async getImports(params = {}) {
    return await api.get("/bulk-products/imports", { params });
  }

  /**
   * Get bulk import details
   */
  async getImportDetails(importId) {
    return await api.get(`/bulk-products/imports/${importId}`);
  }

  /**
   * Delete bulk import
   */
  async deleteImport(importId) {
    return await api.delete(`/bulk-products/imports/${importId}`);
  }

  /**
   * Get bulk import statistics
   */
  async getStats() {
    return await api.get("/bulk-products/stats");
  }
}

export default new BulkProductService();
