import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base relativa: o build funciona em qualquer subcaminho (GitHub Pages, servidor da UFRGS).
export default defineConfig({ base: "./", plugins: [react()] });
