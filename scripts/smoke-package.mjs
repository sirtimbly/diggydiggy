import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const { version } = JSON.parse(await readFile("package.json", "utf8"));
const tarball = resolve(`diggydiggy-${version}.tgz`);
const directory = await mkdtemp(`${tmpdir()}/diggydiggy-package-`);
try {
  await writeFile(join(directory, "package.json"), '{"private":true}');
  // Keep dependency scripts disabled here so first launch also verifies the
  // supported lazy-download path used by pnpm installations with build guards.
  execFileSync("pnpm", ["add", "--save-dev", "--ignore-scripts", tarball], { cwd: directory, stdio: "inherit" });
  const output = execFileSync(join(directory, "node_modules/.bin/diggy"), ["--version"], { cwd: directory, encoding: "utf8" });
  assert.equal(output.trim(), version);
  const installed = JSON.parse(await readFile(join(directory, "node_modules/diggydiggy/package.json"), "utf8"));
  assert.equal(installed.name, "diggydiggy");
  console.log("pnpm dev-dependency install, verified binary download, and diggy launcher passed.");
} finally { await rm(directory, { recursive: true, force: true }); }
