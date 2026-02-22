import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../config/firebase";
import { signInWithEmail, signOutUser } from "../services/firebaseAuthService";
import { apiService } from "../services/api";

const FirebaseAuthContext = createContext();

export const useFirebaseAuth = () => {
  const context = useContext(FirebaseAuthContext);
  if (!context) {
    throw new Error(
      "useFirebaseAuth must be used within a FirebaseAuthProvider",
    );
  }
  return context;
};

export const FirebaseAuthProvider = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [mongoUser, setMongoUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser);

      if (currentUser) {
        // User is signed in with Firebase
        // Get Firebase ID token
        try {
          const idToken = await currentUser.getIdToken();

          // Verify with backend and get MongoDB user data
          const response = await apiService.post("/auth/firebase-login", {
            firebaseToken: idToken,
            email: currentUser.email,
          });

          if (response.success && response.data) {
            localStorage.setItem("token", response.data.token);
            localStorage.setItem("user", JSON.stringify(response.data.user));
            setToken(response.data.token);
            setMongoUser(response.data.user);
          }
        } catch (error) {
          console.error("Error verifying Firebase token:", error);
          setError("Failed to verify authentication");
        }
      } else {
        // User is signed out
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setToken(null);
        setMongoUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password, shopId = null) => {
    try {
      setLoading(true);
      setError(null);

      // Sign in with Firebase
      const firebaseResult = await signInWithEmail(email, password);

      if (!firebaseResult.success) {
        setError(firebaseResult.message);
        return {
          success: false,
          message: firebaseResult.message,
        };
      }

      // Get Firebase ID token
      const idToken = await firebaseResult.user.getIdToken();

      // Verify with backend and get MongoDB user data
      const body = {
        firebaseToken: idToken,
        email: email,
      };

      if (shopId) {
        body.shopId = shopId;
      }

      const response = await apiService.post("/auth/firebase-login", body);

      if (response.success && response.data) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        setToken(response.data.token);
        setMongoUser(response.data.user);
        return { success: true };
      } else {
        // Firebase auth succeeded but MongoDB verification failed
        await signOutUser();
        return {
          success: false,
          message: response.message || "User not found in system",
        };
      }
    } catch (error) {
      console.error("Login error:", error);
      setError(error.message);
      return {
        success: false,
        message: error.message || "Login failed",
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOutUser();
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setToken(null);
      setMongoUser(null);
      setFirebaseUser(null);
      return { success: true };
    } catch (error) {
      console.error("Logout error:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  };

  const value = {
    firebaseUser,
    user: mongoUser,
    token,
    login,
    logout,
    loading,
    error,
    isAuthenticated: !!mongoUser && !!firebaseUser,
    isFirebaseAuthenticated: !!firebaseUser,
    isMongoAuthenticated: !!mongoUser,
  };

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
};

export default FirebaseAuthProvider;
