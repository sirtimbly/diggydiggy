import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

// A standalone browser bundle: no Worker runtime or hosted account services.
export default defineConfig({
  plugins: [react(), {
    name: "local-license-notices",
    generateBundle() {
      for (const file of ["LICENSE", "THIRD_PARTY_NOTICES.md", "local/licenses/Dolt-APACHE-2.0.txt", "assets/OFL-dm-sans.txt", "assets/OFL-silkscreen.txt"])
        this.emitFile({ type: "asset", fileName: `licenses/${file.split("/").at(-1)}`, source: readFileSync(file) });
    },
  }],
  define: { "import.meta.env.VITE_LOCAL_DOLT": JSON.stringify(true) },
  build: { outDir: "local/web" },
});
