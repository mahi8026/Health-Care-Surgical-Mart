import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@pages": path.resolve(__dirname, "./src/pages"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@services": path.resolve(__dirname, "./src/services"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@styles": path.resolve(__dirname, "./src/styles"),
      "@assets": path.resolve(__dirname, "./src/assets"),
      "@contexts": path.resolve(__dirname, "./src/contexts"),
    },
  },
  server: {
    port: 3000,
    strictPort: false,
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, _res) => {
            console.log("proxy error", err);
          });
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            console.log("Sending Request to the Target:", req.method, req.url);
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            console.log(
              "Received Response from the Target:",
              proxyRes.statusCode,
              req.url,
            );
          });
        },
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    chunkSizeWarningLimit: 600, // Increased from default 500kB
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries
          vendor: ["react", "react-dom"],
          router: ["react-router-dom"],
          // Firebase and auth
          firebase: ["firebase/app", "firebase/auth"],
          // Chart libraries
          charts: ["chart.js", "react-chartjs-2"],
          // UI utilities
          ui: ["lucide-react", "react-hot-toast", "clsx", "tailwind-merge"],
          // Form and data fetching
          forms: ["react-hook-form", "react-query", "axios"],
        },
      },
    },
  },
});
