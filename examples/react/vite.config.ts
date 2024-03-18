import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import qiankun from "vite-plugin-qiankun-lite";
import { name } from "./package.json";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    qiankun({
      name,
      entry: "src/main.tsx",
      sandbox: !!process.env.VITE_SANDBOX,
    }),
  ],
  server: {
    cors: true,
    origin: "*",
  },
});
