import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import qiankun from "vite-plugin-qiankun-lite";
import { name } from "./package.json";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), qiankun({ name })],
  server: {
    cors: true,
    origin: "*",
  },
});
