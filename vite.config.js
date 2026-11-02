import fs from "node:fs/promises";
import path from "node:path";
import { publicManifest } from "./scripts/lib/media.mjs";
// A normal static build must not publish audit metadata or the incremental cache.
export default {
  plugins: [
    {
      name: "public-tour-manifest",
      apply: "build",
      async closeBundle() {
        const dir = path.resolve("dist/generated");
        try {
          const source = JSON.parse(
            await fs.readFile(path.join(dir, "manifest.json"), "utf8"),
          );
          await fs.writeFile(
            path.join(dir, "manifest.json"),
            JSON.stringify(publicManifest(source), null, 2) + "\n",
          );
          await fs.rm(path.join(dir, "cache.json"), { force: true });
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      },
    },
  ],
};
