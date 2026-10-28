import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { fileURLToPath } from "node:url";
import { platformTarget } from "../npm/native.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const { version } = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) throw new Error("Invalid release version");
const target = platformTarget();
const directory = join(root, ".release", target);
const assets = join(root, ".release/assets");
const notices = join(directory, "licenses");
// Go module-cache license files are read-only. Recreate this generated tree so
// repeat builds neither fail on those modes nor retain obsolete notices.
await rm(notices, { recursive: true, force: true });
await mkdir(notices, { recursive: true }); await mkdir(assets, { recursive: true });
const executable = join(directory, "diggy");
execFileSync("sh", [join(root, "scripts/build-portable.sh"), executable, version], { cwd: root, stdio: "inherit" });

async function collectLicenseFiles(source, destination) {
  const files = await readdir(source, { withFileTypes: true }).catch(() => []);
  for (const entry of files) {
    if (!entry.isFile() || !/^(licen[cs]e|notice|copying|copyright)([._-].*)?$/i.test(entry.name)) continue;
    await mkdir(destination, { recursive: true });
    await copyFile(join(source, entry.name), join(destination, entry.name));
  }
}
await copyFile(join(root, "LICENSE"), join(notices, "Diggy-MIT.txt"));
await copyFile(join(root, "local/licenses/Dolt-APACHE-2.0.txt"), join(notices, "Dolt-APACHE-2.0.txt"));
await copyFile(join(root, "THIRD_PARTY_NOTICES.md"), join(notices, "THIRD_PARTY_NOTICES.md"));
for (const name of await readdir(join(root, "assets")))
  if (name.startsWith("OFL-")) await copyFile(join(root, "assets", name), join(notices, name));
await collectLicenseFiles(join(root, "local/licenses"), join(notices, "Dolt"));
const modules = execFileSync("go", ["list", "-m", "-f", "{{.Path}}|{{.Version}}|{{.Dir}}", "all"], { cwd: join(root, "local"), encoding: "utf8" });
for (const line of modules.trim().split("\n")) {
  const [name, moduleVersion, source] = line.split("|");
  if (source && moduleVersion) await collectLicenseFiles(source, join(notices, "go", name.replaceAll("/", "__")));
}
// Include JavaScript build/runtime dependency notices conservatively: the web
// bundle can contain transitive code even though the npm launcher has no deps.
const seenPackages = new Set();
async function javascriptNotices(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    if (entry.name.startsWith(".") || !(entry.isDirectory() || entry.isSymbolicLink())) continue;
    const path = join(directory, entry.name);
    if (entry.name.startsWith("@")) { await javascriptNotices(path); continue; }
    const source = await realpath(path);
    if (seenPackages.has(source)) continue;
    seenPackages.add(source);
    const manifest = JSON.parse(await readFile(join(source, "package.json"), "utf8").catch(() => "{}"));
    if (manifest.name) await collectLicenseFiles(source, join(notices, "npm", `${manifest.name}@${manifest.version}`.replaceAll("/", "__")));
    await javascriptNotices(join(source, "node_modules"));
  }
}
await javascriptNotices(join(root, "node_modules"));
// pnpm places transitive packages in its virtual store; do not omit their
// notices merely because the root dependency entries are symlinks.
const store = join(root, "node_modules/.pnpm");
for (const entry of await readdir(store, { withFileTypes: true }).catch(() => []))
  if (entry.isDirectory()) await javascriptNotices(join(store, entry.name, "node_modules"));
if (process.platform === "darwin") {
  const prefix = execFileSync("brew", ["--prefix", "icu4c"], { encoding: "utf8" }).trim();
  for (const directory of await readdir(join(prefix, "share/icu"))) await collectLicenseFiles(join(prefix, "share/icu", directory), join(notices, "ICU"));
} else {
  await collectLicenseFiles("/usr/share/doc/libicu-dev", join(notices, "ICU"));
}
const file = `diggydiggy_${version}_${target}.gz`;
await pipeline(createReadStream(executable), createGzip({ level: 9 }), createWriteStream(join(assets, file)));
const hash = createHash("sha256");
for await (const chunk of createReadStream(join(assets, file))) hash.update(chunk);
const licenses = `diggydiggy_${version}_${target}_licenses.tar.gz`;
execFileSync("tar", ["-czf", join(assets, licenses), "-C", directory, "licenses"]);
await writeFile(join(assets, `${target}.json`), JSON.stringify({ target, file, sha256: hash.digest("hex"), licenses }, null, 2)+"\n");
console.log(`Built ${file} and ${licenses}`);
