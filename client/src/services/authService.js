/**
 * Authentication Service
 * Handles all authentication-related API operations
 */

import api from "../config/api";

class AuthService {
  async login(credentials) {
    const response = await api.post("/auth/login", credentials);

    if (response.data.success && response.data.token) {
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
    }

    return response.data;
  }

  async logout() {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      // Continue with logout even if API call fails
      console.error("Logout API call failed:", error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  }

  async refreshToken() {
    const response = await api.post("/auth/refresh");

    if (response.data.token) {
      localStorage.setItem("token", response.data.token);
    }

    return response.data;
  }

  async getCurrentUser() {
    const response = await api.get("/auth/me");
    return response.data;
  }

  async updateProfile(data) {
    const response = await api.put("/auth/profile", data);

    if (response.data.user) {
      localStorage.setItem("user", JSON.stringify(response.data.user));
    }

    return response.data;
  }

  async changePassword(data) {
    const response = await api.put("/auth/change-password", data);
    return response.data;
  }

  getStoredUser() {
    try {
      const user = localStorage.getItem("user");
      return user ? JSON.parse(user) : null;
    } catch (error) {
      console.error("Error parsing stored user:", error);
      return null;
    }
  }

  getStoredToken() {
    return localStorage.getItem("token");
  }

  isAuthenticated() {
    return !!this.getStoredToken();
  }
}

export const authService = new AuthService();
export default authService;
