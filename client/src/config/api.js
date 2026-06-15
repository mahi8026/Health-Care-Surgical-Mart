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
  withCredentials: true, // CRITICAL: Send cookies with requests (for httpOnly JWT)
});

// Request interceptor - NO LONGER NEEDED to add Bearer token
// The JWT is sent automatically as an httpOnly cookie
api.interceptors.request.use(
  (config) => {
    // No need to manually add Authorization header
    // The browser automatically sends the httpOnly cookie
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
      // Unauthorized - clear user state and redirect to login
      // The cookie will be cleared by the backend on logout
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  },
);

export default api;
