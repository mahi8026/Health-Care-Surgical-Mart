import { createContext, useContext, useState, useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../config/firebase";
import { signInWithEmail, signOutUser } from "../services/firebaseAuthService";
import api from "../config/api";
import { setUserContext, clearUserContext } from "../config/sentry";
import { hasPermission as checkPermission } from "../utils/permissions";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Token refresh interval ref
  const tokenRefreshInterval = useRef(null);

  // Setup Firebase token refresh (every 50 minutes, before 1-hour expiry)
  useEffect(() => {
    if (firebaseUser) {
      // Clear any existing interval
      if (tokenRefreshInterval.current) {
        clearInterval(tokenRefreshInterval.current);
      }

      // Refresh Firebase token every 50 minutes
      tokenRefreshInterval.current = setInterval(async () => {
        try {
          if (import.meta.env.DEV) {
            console.log('[AUTH] Refreshing Firebase token...');
          }
          const newIdToken = await firebaseUser.getIdToken(true); // Force refresh
          
          // Re-authenticate with backend to refresh JWT cookie
          const response = await api.post("/auth/firebase-login", {
            firebaseToken: newIdToken,
            email: firebaseUser.email,
          });

          if (response.success && response.data?.user) {
            // Update user state (cookie is automatically updated by backend)
            setMongoUser(response.data.user);
            localStorage.setItem("user", JSON.stringify(response.data.user));
            
            if (import.meta.env.DEV) {
              console.log('[AUTH] Token refreshed successfully');
            }
          }
        } catch (error) {
          console.error('[AUTH] Token refresh failed:', error);
          // If refresh fails, let the user continue until next interval
          // or until a 401 forces logout
        }
      }, 50 * 60 * 1000); // 50 minutes
    }

    return () => {
      if (tokenRefreshInterval.current) {
        clearInterval(tokenRefreshInterval.current);
      }
    };
  }, [firebaseUser]);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser);

      if (currentUser) {
        // Check if we have stored user and token in localStorage
        const storedUser = localStorage.getItem("user");
        const storedToken = localStorage.getItem("token");

        if (storedUser && storedToken) {
          try {
            const parsedUser = JSON.parse(storedUser);
            
            // Verify token is not expired (JWT format: header.payload.signature)
            const tokenParts = storedToken.split('.');
            if (tokenParts.length === 3) {
              const payload = JSON.parse(atob(tokenParts[1]));
              const expiryTime = payload.exp * 1000; // Convert to milliseconds
              
              if (Date.now() < expiryTime) {
                // Token is still valid - restore session without API call
                setMongoUser(parsedUser);
                setUserContext(parsedUser);
                setLoading(false);
                return;
              } else {
                // Token expired - clear it
                console.log('[AUTH] Token expired, clearing session');
                localStorage.removeItem("user");
                localStorage.removeItem("token");
              }
            }
          } catch (error) {
            // Invalid token or user data - clear it
            console.error('[AUTH] Failed to parse stored session:', error);
            localStorage.removeItem("user");
            localStorage.removeItem("token");
          }
        }

        // No valid stored session - user needs to log in
        setMongoUser(null);
        clearUserContext();
      } else {
        // User is signed out from Firebase
        localStorage.removeItem("user");
        localStorage.removeItem("token");
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
      // Backend will set httpOnly cookie with JWT
      const body = {
        firebaseToken: idToken,
        email: email,
      };

      if (shopId) {
        body.shopId = shopId;
      }

      const response = await api.post("/auth/firebase-login", body);

      if (response.success && response.data?.user) {
        // Store user data AND token
        // Token is stored in localStorage for cross-domain compatibility
        localStorage.setItem("user", JSON.stringify(response.data.user));
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("lastLoginTime", Date.now().toString());
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
      // Clear token refresh interval
      if (tokenRefreshInterval.current) {
        clearInterval(tokenRefreshInterval.current);
        tokenRefreshInterval.current = null;
      }
      
      // Call backend to clear httpOnly cookie
      await api.post("/auth/logout");
      
      // Sign out from Firebase
      await signOutUser();
      
      // Clear local state and token
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      localStorage.removeItem("lastLoginTime");
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
    login,
    logout,
    loading,
    error,
    isAuthenticated: !!mongoUser && !!firebaseUser,
    isFirebaseAuthenticated: !!firebaseUser,
    isMongoAuthenticated: !!mongoUser,
    // Permission helper function
    hasPermission: (permission) => checkPermission(mongoUser, permission),
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export default AuthProvider;