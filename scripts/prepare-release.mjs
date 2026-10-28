import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRelease } from "../npm/validate.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--repository" || !/^[\w.-]+\/[\w.-]+$/.test(args[1]))
  throw new Error("Usage: mise run release:prepare -- --repository OWNER/REPO");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const { version } = pkg;
const assets = {};
const checksums = [];
await rm(join(root, "npm/licenses"), { recursive: true, force: true });
for (const target of ["darwin_arm64", "darwin_amd64", "linux_arm64", "linux_amd64"]) {
  const data = JSON.parse(await readFile(join(root, ".release/assets", `${target}.json`), "utf8"));
  if (data.target !== target || data.file !== `diggydiggy_${version}_${target}.gz` || data.licenses !== `diggydiggy_${version}_${target}_licenses.tar.gz`)
    throw new Error(`Mismatched release asset for ${target}`);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(join(root, ".release/assets", data.file))) hash.update(chunk);
  if (hash.digest("hex") !== data.sha256) throw new Error(`Checksum mismatch for ${target}`);
  await readFile(join(root, ".release/assets", data.licenses));
  const notices = join(root, ".release/notices", target);
  await mkdir(notices, { recursive: true });
  execFileSync("tar", ["-xzf", join(root, ".release/assets", data.licenses), "-C", notices]);
  await cp(join(notices, "licenses"), join(root, "npm/licenses", target), { recursive: true });
  assets[target] = { file: data.file, sha256: data.sha256, licenses: data.licenses };
  checksums.push(`${data.sha256}  ${data.file}`);
}
await writeFile(join(root, "npm/release.json"), JSON.stringify({ repository: args[1], version, assets }, null, 2)+"\n");
pkg.repository = { type: "git", url: `git+https://github.com/${args[1]}.git` };
pkg.homepage = `https://github.com/${args[1]}#readme`;
pkg.bugs = { url: `https://github.com/${args[1]}/issues` };
await writeFile(join(root, "package.json"), JSON.stringify(pkg, null, 2)+"\n");
await writeFile(join(root, ".release/assets/SHA256SUMS"), checksums.join("\n")+"\n");
await validateRelease();
console.log("Prepared npm release metadata for all four platforms.");
