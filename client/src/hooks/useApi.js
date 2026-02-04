/**
 * Custom API Hook
 * Provides a consistent interface for API calls with loading states and error handling
 */

import { useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import api from "../config/api";
import { TOAST_MESSAGES } from "../config/constants";

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (apiCall, options = {}) => {
    const {
      showSuccessToast = false,
      successMessage = "",
      showErrorToast = true,
      errorMessage = TOAST_MESSAGES.ERROR.GENERIC,
    } = options;

    setLoading(true);
    setError(null);

    try {
      const response = await apiCall();

      if (showSuccessToast && successMessage) {
        toast.success(successMessage);
      }

      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || errorMessage;
      setError(errorMsg);

      if (showErrorToast) {
        toast.error(errorMsg);
      }

      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { execute, loading, error };
};

export default useApi;
