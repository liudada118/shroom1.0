import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react({
      fastRefresh: true,
      include: /\.[jt]sx?$/,
    }),
  ],

  // Legacy CRA code uses .js files with JSX.
  esbuild: {
    loader: "jsx",
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@pages": path.resolve(__dirname, "./src/pages") || path.resolve(__dirname, "./src/page"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@assets": path.resolve(__dirname, "./src/assets"),
      "@utils": path.resolve(__dirname, "./src/assets/util"),
    },
  },

  server: {
    port: 3000,
    host: "0.0.0.0",
    proxy: {
      "/ws": {
        target: "ws://127.0.0.1:19999",
        ws: true,
      },
    },
  },

  build: {
    outDir: "../build",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-three": ["three"],
          "vendor-antd": ["antd"],
          "vendor-echarts": ["echarts"],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },

  css: {
    preprocessorOptions: {
      scss: {
      },
    },
  },

  optimizeDeps: {
    esbuildOptions: {
      loader: {
        ".js": "jsx",
      },
    },
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "three",
      "antd",
      "echarts",
      "@tweenjs/tween.js",
    ],
  },
});
