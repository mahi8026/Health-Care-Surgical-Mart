/**
 * API Configuration and Setup
 * Centralized API configuration with interceptors and error handling
 */

import axios from "axios";
import { API_CONFIG } from "./constants";

// Log API configuration for debugging in development only
if (import.meta.env.DEV) {
  console.log('Axios API configured with base URL:', API_CONFIG.BASE_URL);
}

// Create axios instance with default configuration
const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
  // withCredentials removed - we're using Authorization header now, not cookies
});

// Request interceptor - Add Authorization header with token from localStorage
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage (for cross-domain setups)
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    // Unwrap axios response.data so callers get the API payload directly,
    // matching the previous fetch-based apiService behaviour.
    return response.data;
  },
  (error) => {
    // Handle common errors
    if (error.response?.status === 401) {
      // Unauthorized - clear user state, token, and redirect to login
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      localStorage.removeItem("lastLoginTime");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  },
);

export default api;
