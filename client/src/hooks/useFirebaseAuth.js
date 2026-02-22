import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../config/firebase";
import {
  signUpWithEmail,
  signInWithEmail,
  signOutUser,
  resetPassword,
  changePassword,
  sendVerificationEmail,
} from "../services/firebaseAuthService";

/**
 * Custom hook for Firebase Authentication
 * Provides authentication state and methods
 */
export const useFirebaseAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Listen to authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  /**
   * Sign up with email and password
   */
  const signUp = async (email, password, displayName) => {
    setLoading(true);
    setError(null);
    try {
      const result = await signUpWithEmail(email, password, displayName);
      if (!result.success) {
        setError(result.message);
      }
      return result;
    } catch (err) {
      setError(err.message);
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign in with email and password
   */
  const signIn = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithEmail(email, password);
      if (!result.success) {
        setError(result.message);
      }
      return result;
    } catch (err) {
      setError(err.message);
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign out current user
   */
  const signOut = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signOutUser();
      if (!result.success) {
        setError(result.message);
      }
      return result;
    } catch (err) {
      setError(err.message);
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Send password reset email
   */
  const forgotPassword = async (email) => {
    setLoading(true);
    setError(null);
    try {
      const result = await resetPassword(email);
      if (!result.success) {
        setError(result.message);
      }
      return result;
    } catch (err) {
      setError(err.message);
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Change user password
   */
  const updatePassword = async (currentPassword, newPassword) => {
    setLoading(true);
    setError(null);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (!result.success) {
        setError(result.message);
      }
      return result;
    } catch (err) {
      setError(err.message);
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Send email verification
   */
  const verifyEmail = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await sendVerificationEmail();
      if (!result.success) {
        setError(result.message);
      }
      return result;
    } catch (err) {
      setError(err.message);
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    error,
    signUp,
    signIn,
    signOut,
    forgotPassword,
    updatePassword,
    verifyEmail,
    isAuthenticated: !!user,
    isEmailVerified: user?.emailVerified || false,
  };
};

export default useFirebaseAuth;
