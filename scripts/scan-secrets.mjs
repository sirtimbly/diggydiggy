import { spawnSync, execFileSync } from "node:child_process";
import { copyFile, lstat, mkdir, mkdtemp, readlink, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const reports = join(root, "bin/security");
const scanner = process.env.GITLEAKS_BIN || "gitleaks";
const snapshot = await mkdtemp(join(tmpdir(), "diggydiggy-scan-"));
const index = await mkdtemp(join(tmpdir(), "diggydiggy-index-scan-"));
let failed = false, count = 0;
try {
  await mkdir(reports, { recursive: true });
  const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
  for (const path of files) {
    const source = join(root, path), target = join(snapshot, path);
    const info = await lstat(source).catch((error) => { if (error.code === "ENOENT") return null; throw error; });
    if (!info) continue; // Tracked files deleted in the working tree.
    await mkdir(dirname(target), { recursive: true });
    if (info.isSymbolicLink()) await writeFile(target, await readlink(source));
    else if (info.isFile()) await copyFile(source, target);
    else throw new Error(`Cannot scan non-file tracked path: ${path}`);
    count++;
  }
  const tracked = execFileSync("git", ["ls-files", "-z", "--cached"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
  for (const path of tracked) {
    const target = join(index, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, execFileSync("git", ["show", `:${path}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 }));
  }
  for (const [label, args] of [
    ["history", ["git", "--log-opts=--all --full-history --reflog", root]],
    ["index", ["dir", index]],
    ["working-tree", ["dir", snapshot]],
  ]) {
    const result = spawnSync(scanner, [...args, "--config", join(root, ".gitleaks.toml"), "--redact=100", "--ignore-gitleaks-allow", "--no-banner", "--report-format=json", "--report-path", join(reports, `${label}.json`)], { stdio: "inherit", cwd: root });
    if (result.error) throw new Error(`Install Gitleaks or set GITLEAKS_BIN: ${result.error.message}`);
    if (result.status !== 0) failed = true;
  }
  console.log(`Scanned all Git refs and reflogs, the staged index, plus ${count} current tracked/unignored files. Redacted reports: ${resolve(reports)}`);
  if (failed) process.exitCode = 1;
} finally { await Promise.all([snapshot, index].map((path) => rm(path, { recursive: true, force: true }))); }
