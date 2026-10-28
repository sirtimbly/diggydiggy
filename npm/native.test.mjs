import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { installNative, platformTarget } from "./native.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "diggydiggy-download-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const binary = Buffer.from("a test executable payload\n");
  const compressed = gzipSync(binary);
  const sha256 = createHash("sha256").update(compressed).digest("hex");
  await mkdir(join(root, "npm"));
  await writeFile(join(root, "package.json"), '{"version":"0.1.0"}');
  await writeFile(join(root, "npm/release.json"), JSON.stringify({ repository: "example/diggydiggy", version: "0.1.0", assets: { darwin_arm64: { file: "diggydiggy_0.1.0_darwin_arm64.gz", sha256 } } }));
  return { root, binary, compressed };
}

test("downloads the exact release, verifies its checksum, decompresses, and reuses the cache", async (t) => {
  const { root, binary, compressed } = await fixture(t);
  let requests = 0;
  const request = async (url) => {
    requests++;
    assert.equal(url, "https://github.com/example/diggydiggy/releases/download/v0.1.0/diggydiggy_0.1.0_darwin_arm64.gz");
    return new Response(compressed);
  };
  const options = { root, target: "darwin_arm64", request, progress() {} };
  const executable = await installNative(options);
  assert.deepEqual(await readFile(executable), binary);
  assert.ok((await stat(executable)).mode & 0o111);
  assert.equal(await installNative(options), executable);
  assert.equal(requests, 1);
});

test("rejects tampered downloads before installing an executable", async (t) => {
  const { root } = await fixture(t);
  await assert.rejects(installNative({ root, target: "darwin_arm64", request: async () => new Response(gzipSync("corrupt")), progress() {} }), /checksum mismatch/);
  await assert.rejects(stat(join(root, ".diggy-native/darwin_arm64/diggy")), { code: "ENOENT" });
});

test("rejects mismatched metadata, unsupported platforms, and missing releases", async (t) => {
  const { root } = await fixture(t);
  await writeFile(join(root, "package.json"), '{"version":"0.2.0"}');
  await assert.rejects(installNative({ root, target: "darwin_arm64" }), /does not match/);
  assert.throws(() => platformTarget("win32", "x64"), /No Diggy binary/);
  await writeFile(join(root, "package.json"), '{"version":"0.1.0"}');
  await assert.rejects(installNative({ root, target: "linux_amd64" }), /no verified binary/);
});
