// TEMPORARY: Hardcode for debugging
const API_BASE_URL = 'https://health-care-surgical-mart.onrender.com/api';

// Debug logging
console.log('=== API SERVICE DEBUG ===');
console.log('Environment Mode:', import.meta.env.MODE);
console.log('VITE_API_URL from env:', import.meta.env.VITE_API_URL);
console.log('Using API_BASE_URL:', API_BASE_URL);
console.log('========================');

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    console.log('API Service initialized with base URL:', this.baseURL);
  }

  async request(endpoint, options = {}) {
    const token = localStorage.getItem("token");

    const config = {
      ...options, // Spread options first
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers, // Then merge headers, preserving Authorization
      },
    };

    // Only set Content-Type to application/json if not already set and not FormData
    if (!config.headers["Content-Type"] && !(config.body instanceof FormData)) {
      config.headers["Content-Type"] = "application/json";
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, config);

      // Handle authentication errors
      if (response.status === 401) {
        // Don't automatically redirect, let the calling component handle it
        const errorData = await response.text();
        throw new Error(
          "Authentication failed: " + (errorData || "Please log in again"),
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "API Error");
      }

      return data;
    } catch (error) {
      console.error(`API Error for ${endpoint}:`, error);

      // Handle JSON parsing errors
      if (error.message.includes("Unexpected end of JSON input")) {
        throw new Error(
          "Server returned empty response. Check server logs for errors.",
        );
      }

      throw error;
    }
  }

  async get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  }

  async post(endpoint, data, options = {}) {
    const config = {
      method: "POST",
      ...options,
    };

    // Handle FormData vs JSON
    if (data instanceof FormData) {
      config.body = data;
      // Don't set Content-Type for FormData - browser will set it with boundary
    } else {
      config.body = JSON.stringify(data);
      // Merge headers instead of overriding
      config.headers = {
        "Content-Type": "application/json",
        ...config.headers, // This preserves any existing headers including Authorization
      };
    }

    return this.request(endpoint, config);
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  }
}

export const apiService = new ApiService();
export default apiService;
