import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import qiankun from "vite-plugin-qiankun-lite";
import { name } from "./package.json";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    qiankun({
      name,
      entry: "src/main.ts",
      sandbox: !!process.env.VITE_SANDBOX,
    }),
  ],
  server: {
    cors: true,
    origin: "*",
  },
});
