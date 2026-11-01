import { defineConfig } from "vite";
// Relative assets support both /repository/ Pages sites and custom domains.
export default defineConfig({ base: "./", build: { outDir: "dist" } });
