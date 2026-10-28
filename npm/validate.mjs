import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
export async function validateRelease() {
  const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  const release = JSON.parse(await readFile(new URL("npm/release.json", root), "utf8"));
  if (!/^[\w.-]+\/[\w.-]+$/.test(release.repository ?? "") || release.version !== pkg.version)
    throw new Error("Prepare release binaries and metadata before publishing: mise run release:prepare -- --repository OWNER/REPO");
  for (const target of ["darwin_arm64", "darwin_amd64", "linux_arm64", "linux_amd64"])
    if (!/^[a-f0-9]{64}$/.test(release.assets[target]?.sha256 ?? "")) throw new Error(`Missing release checksum for ${target}`);
  return release;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { await validateRelease(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
