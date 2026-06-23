import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "react-query";
import { Toaster } from "react-hot-toast";

import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { StockProvider } from "./contexts/StockContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { initializeSentry } from "./config/sentry.js";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./styles/index.css";

// Initialize Sentry for error tracking
initializeSentry();

// Register service worker for PWA (production only)
// Auto-reloads the page when a new version is deployed
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('[PWA] SW registered:', reg.scope);

      // New SW found waiting — tell it to activate immediately
      if (reg.waiting) {
        reg.waiting.postMessage('SKIP_WAITING');
      }

      // New SW installed during this session — activate it immediately
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version ready — skip waiting and reload
            console.log('[PWA] New version available, updating...');
            newWorker.postMessage('SKIP_WAITING');
          }
        });
      });

    }).catch((err) => {
      console.warn('[PWA] SW registration failed:', err);
    });

    // When the SW takes control (after SKIP_WAITING), reload the page
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        console.log('[PWA] Controller changed — reloading for new version');
        window.location.reload();
      }
    });
  });
}

// Create a client with optimized defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
    mutations: {
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AuthProvider>
            <StockProvider>
              <App />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: "#363636",
                    color: "#fff",
                  },
                  success: {
                    duration: 3000,
                    theme: {
                      primary: "green",
                      secondary: "black",
                    },
                  },
                }}
              />
            </StockProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
