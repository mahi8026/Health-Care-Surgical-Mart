import { apiService } from "./api";

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

    return await apiService.post("/bulk-products/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  }

  /**
   * Process bulk import
   */
  async processImport(importId) {
    return await apiService.post(`/bulk-products/process/${importId}`);
  }

  /**
   * Get all bulk imports
   */
  async getImports(params = {}) {
    return await apiService.get("/bulk-products/imports", { params });
  }

  /**
   * Get bulk import details
   */
  async getImportDetails(importId) {
    return await apiService.get(`/bulk-products/imports/${importId}`);
  }

  /**
   * Delete bulk import
   */
  async deleteImport(importId) {
    return await apiService.delete(`/bulk-products/imports/${importId}`);
  }

  /**
   * Download Excel template
   */
  downloadExcelTemplate() {
    const token = localStorage.getItem("token");
    const url = `${import.meta.env.VITE_API_URL}/api/bulk-products/template/excel`;

    window.open(`${url}?token=${token}`, "_blank");
  }

  /**
   * Download CSV template
   */
  downloadCSVTemplate() {
    const token = localStorage.getItem("token");
    const url = `${import.meta.env.VITE_API_URL}/api/bulk-products/template/csv`;

    window.open(`${url}?token=${token}`, "_blank");
  }

  /**
   * Get bulk import statistics
   */
  async getStats() {
    return await apiService.get("/bulk-products/stats");
  }
}

export default new BulkProductService();
