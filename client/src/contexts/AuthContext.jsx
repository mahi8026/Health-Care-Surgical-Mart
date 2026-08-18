import { createContext, useContext, useState, useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../config/firebase";
import { signInWithEmail, signOutUser } from "../services/firebaseAuthService";
import api from "../config/api";
import { setUserContext, clearUserContext } from "../config/sentry";
import { hasPermission as checkPermission } from "../utils/permissions";

const AuthContext = createContext();

// Returns true when the stored JWT is structurally valid and (if it carries
// an exp claim) not yet expired. A session with no exp is treated as valid —
// the backend rejects it anyway if it is stale.
const isStoredTokenValid = (storedToken) => {
  if (!storedToken) return false;
  const parts = storedToken.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(
      window.atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (typeof payload.exp === "number") {
      return Date.now() < payload.exp * 1000;
    }
    return true;
  } catch {
    return false;
  }
};

// eslint-disable-next-line react-refresh/only-export-components
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
  const refreshInProgress = useRef(false); // Prevent concurrent refreshes

  // Setup Firebase token refresh (every 50 minutes, before 1-hour expiry)
  useEffect(() => {
    if (firebaseUser) {
      // Clear any existing interval
      if (tokenRefreshInterval.current) {
        clearInterval(tokenRefreshInterval.current);
      }

      // Refresh Firebase token every 50 minutes
      tokenRefreshInterval.current = setInterval(async () => {
        // Prevent concurrent refresh attempts
        if (refreshInProgress.current) {
          if (import.meta.env.DEV) {
            console.log('[AUTH] Token refresh already in progress, skipping');
          }
          return;
        }
        
        refreshInProgress.current = true;
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
            // Update user state AND the rotated JWT (the backend issues a new
            // token on every firebase-login — keeping the old one in
            // localStorage would make the stored session stale/invalid)
            setMongoUser(response.data.user);
            localStorage.setItem("user", JSON.stringify(response.data.user));
            if (response.data.token) {
              localStorage.setItem("token", response.data.token);
            }
            
            if (import.meta.env.DEV) {
              console.log('[AUTH] Token refreshed successfully');
            }
          }
        } catch (error) {
          console.error('[AUTH] Token refresh failed:', error);
          // If refresh fails, let the user continue until next interval
          // or until a 401 forces logout
        } finally {
          refreshInProgress.current = false;
        }
      }, 50 * 60 * 1000); // 50 minutes
    }

    return () => {
      if (tokenRefreshInterval.current) {
        clearInterval(tokenRefreshInterval.current);
      }
      refreshInProgress.current = false;
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

        if (storedUser && isStoredTokenValid(storedToken)) {
          try {
            const parsedUser = JSON.parse(storedUser);

            // Token is still valid - restore session without API call
            setMongoUser(parsedUser);
            setUserContext(parsedUser);
            setLoading(false);
            return;
          } catch (error) {
            // Invalid stored user data - clear it
            if (import.meta.env.DEV) {
              console.error('[AUTH] Failed to parse stored session:', error);
            }
            localStorage.removeItem("user");
            localStorage.removeItem("token");
          }
        }

        // Stored session missing, expired or malformed. The Firebase session
        // is still valid, so try a silent re-login before showing the login
        // page — the backend issues a fresh JWT from the current ID token.
        if (currentUser) {
          try {
            const idToken = await currentUser.getIdToken(true);
            const response = await api.post("/auth/firebase-login", {
              firebaseToken: idToken,
              email: currentUser.email,
            });

            if (response.success && response.data?.user && response.data?.token) {
              localStorage.setItem("user", JSON.stringify(response.data.user));
              localStorage.setItem("token", response.data.token);
              localStorage.setItem("lastLoginTime", Date.now().toString());
              setMongoUser(response.data.user);
              setUserContext(response.data.user);
              setLoading(false);
              return;
            }
          } catch (error) {
            // Silent re-login failed (offline, user removed, ...) - fall
            // through and show the login page.
            if (import.meta.env.DEV) {
              console.error('[AUTH] Silent re-login failed:', error);
            }
          }
        }

        // No valid session and silent re-login unavailable - user needs to log in
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

  const login = async (email, password) => {
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
      const message = error.serverMessage || error.message || "Login failed";
      setError(message);
      return {
        success: false,
        message,
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    // Clear local state FIRST so a backend failure can't strand the user
    // in a half-logged-out state.
    if (tokenRefreshInterval.current) {
      clearInterval(tokenRefreshInterval.current);
      tokenRefreshInterval.current = null;
    }

    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("lastLoginTime");
    setMongoUser(null);
    setFirebaseUser(null);
    clearUserContext();

    let serverError = null;
    try {
      // Best-effort: revoke the token server-side
      await api.post("/auth/logout");
    } catch (error) {
      serverError = error;
      if (import.meta.env.DEV) {
        console.error("Logout error:", error);
      }
    }

    try {
      // Sign out from Firebase
      await signOutUser();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Firebase sign-out error:", error);
      }
      serverError = serverError || error;
    }

    return {
      success: !serverError,
      message: serverError?.message,
    };
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