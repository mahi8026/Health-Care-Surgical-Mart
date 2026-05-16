import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../config/firebase";
import { signInWithEmail, signOutUser } from "../services/firebaseAuthService";
import api from "../config/api";
import { setUserContext, clearUserContext } from "../config/sentry";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
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
        // Check if we already have a valid session in localStorage (e.g. after a page reload).
        // If so, restore from it instead of hitting the backend again — the JWT is still valid.
        const storedToken = localStorage.getItem("token");
        const storedUser = localStorage.getItem("user");

        if (storedToken && storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            setToken(storedToken);
            setMongoUser(parsedUser);
            setUserContext(parsedUser);
            setLoading(false);
            return;
          } catch {
            // Stored data is corrupt — clear it and sign out Firebase too
            localStorage.removeItem("token");
            localStorage.removeItem("user");
          }
        }

        // No stored session but Firebase still has the user (e.g. localStorage was cleared
        // while Firebase persisted the session). Sign out of Firebase silently so the user
        // goes through the normal login form — which collects shopId and credentials properly.
        try {
          await signOutUser();
        } catch {
          // ignore sign-out errors
        }
        setFirebaseUser(null);
      } else {
        // User is signed out
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setToken(null);
        setMongoUser(null);
        
        // Clear user context in Sentry
        clearUserContext();
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

      const response = await api.post("/auth/firebase-login", body);

      if (response.success && response.data) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        setToken(response.data.token);
        setMongoUser(response.data.user);
        
        // Set user context in Sentry
        setUserContext(response.data.user);

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
      if (import.meta.env.DEV) {
        console.error("Login error:", error);
      }
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
      
      // Clear user context in Sentry
      clearUserContext();
      
      return { success: true };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Logout error:", error);
      }
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
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export default AuthProvider;