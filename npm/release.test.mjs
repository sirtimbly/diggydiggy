import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

test("release preparation requires all platform artifacts, bundles notices, and supports repeat runs", async (t) => {
  const source = fileURLToPath(new URL("../", import.meta.url));
  const root = await mkdtemp(join(tmpdir(), "diggydiggy-release-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const directory of ["scripts", "npm", ".release/assets", "notice-fixture/licenses"]) await mkdir(join(root, directory), { recursive: true });
  for (const file of ["scripts/prepare-release.mjs", "npm/validate.mjs"]) await copyFile(join(source, file), join(root, file));
  await writeFile(join(root, "package.json"), '{"name":"diggydiggy","version":"0.1.0"}');
  await writeFile(join(root, "notice-fixture/licenses/LICENSE"), "Fixture notice", { mode: 0o444 });
  const run = () => spawnSync(process.execPath, ["scripts/prepare-release.mjs", "--repository", "example/diggydiggy"], { cwd: root, encoding: "utf8" });
  assert.notEqual(run().status, 0, "incomplete builds must not prepare a publishable package");
  for (const target of ["darwin_arm64", "darwin_amd64", "linux_arm64", "linux_amd64"]) {
    const file = `diggydiggy_0.1.0_${target}.gz`;
    const licenses = `diggydiggy_0.1.0_${target}_licenses.tar.gz`;
    const bytes = Buffer.from(`fixture for ${target}`);
    await writeFile(join(root, ".release/assets", file), bytes);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    execFileSync("tar", ["-czf", join(root, ".release/assets", licenses), "-C", join(root, "notice-fixture"), "licenses"]);
    await writeFile(join(root, ".release/assets", `${target}.json`), JSON.stringify({ target, file, licenses, sha256 }));
  }
  let result = run(); assert.equal(result.status, 0, result.stderr);
  result = run(); assert.equal(result.status, 0, result.stderr);
  const release = JSON.parse(await readFile(join(root, "npm/release.json"), "utf8"));
  assert.equal(release.repository, "example/diggydiggy");
  assert.equal(Object.keys(release.assets).length, 4);
  assert.equal(await readFile(join(root, "npm/licenses/linux_arm64/LICENSE"), "utf8"), "Fixture notice");
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  assert.equal(pkg.repository.url, "git+https://github.com/example/diggydiggy.git");
  await writeFile(join(root, ".release/assets/diggydiggy_0.1.0_linux_arm64.gz"), "tampered");
  result = run(); assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Checksum mismatch/);
});
