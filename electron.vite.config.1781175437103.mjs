// electron.vite.config.ts
import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": resolve("src/shared")
      }
    },
    build: {
      rollupOptions: {
        input: { index: resolve("src/main/index.ts") }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": resolve("src/shared")
      }
    },
    build: {
      rollupOptions: {
        input: { index: resolve("src/preload/index.ts") }
      }
    }
  },
  renderer: {
    root: "src/renderer",
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
        "@shared": resolve("src/shared")
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: { index: resolve("src/renderer/index.html") }
      }
    }
  }
});
export {
  electron_vite_config_default as default
};
