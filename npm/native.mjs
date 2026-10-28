import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { access, chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";

export const packageRoot = fileURLToPath(new URL("../", import.meta.url));
export async function exists(path) { try { await access(path); return true; } catch { return false; } }
export function platformTarget(platform = process.platform, arch = process.arch) {
  const architecture = { x64: "amd64", arm64: "arm64" }[arch];
  if (!["darwin", "linux"].includes(platform) || !architecture)
    throw new Error(`No Diggy binary for ${platform}/${arch}. Supported: macOS and Linux on x64 or arm64. See the source-build instructions.`);
  return `${platform}_${architecture}`;
}

export async function installNative({ root = packageRoot, target = platformTarget(), request = fetch, progress = console.error } = {}) {
  const metadata = JSON.parse(await readFile(join(root, "npm/release.json"), "utf8"));
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  if (metadata.version !== manifest.version) throw new Error("Release metadata does not match the npm package version.");
  if (!/^[\w.-]+\/[\w.-]+$/.test(metadata.repository ?? ""))
    throw new Error("This package has no release binaries yet. Build from source using mise run local:install.");
  const asset = metadata.assets[target];
  if (!asset || !/^[a-f0-9]{64}$/.test(asset.sha256 ?? "") || !/^[\w.-]+\.gz$/.test(asset.file ?? ""))
    throw new Error(`This release has no verified binary for ${target}.`);
  const directory = join(root, ".diggy-native", target);
  const executable = join(directory, "diggy");
  const stamp = join(directory, "sha256");
  if (await exists(executable) && await readFile(stamp, "utf8").catch(() => "") === asset.sha256) return executable;
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `.download-${randomUUID()}`);
  const url = `https://github.com/${metadata.repository}/releases/download/v${metadata.version}/${asset.file}`;
  progress(`Downloading Diggy ${metadata.version} for ${target}…`);
  try {
    const response = await request(url, { signal: AbortSignal.timeout(180_000), redirect: "follow" });
    if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}). Check the GitHub release and your network connection.`);
    const hash = createHash("sha256");
    let bytes = 0;
    async function* verifiedChunks() {
      for await (const chunk of Readable.fromWeb(response.body)) {
        bytes += chunk.length;
        if (bytes > 256 * 1024 * 1024) throw new Error("Binary download exceeded the size limit.");
        hash.update(chunk); yield chunk;
      }
    }
    await pipeline(verifiedChunks(), createWriteStream(`${temporary}.gz`, { flags: "wx", mode: 0o600 }));
    if (hash.digest("hex") !== asset.sha256) throw new Error("Binary checksum mismatch; the download was not installed.");
    await pipeline(createReadStream(`${temporary}.gz`), createGunzip(), createWriteStream(temporary, { flags: "wx", mode: 0o700 }));
    await chmod(temporary, 0o755);
    await rename(temporary, executable);
    await writeFile(`${temporary}.stamp`, asset.sha256, { mode: 0o600 });
    await rename(`${temporary}.stamp`, stamp);
    return executable;
  } finally {
    await Promise.all([temporary, `${temporary}.gz`, `${temporary}.stamp`].map((path) => rm(path, { force: true })));
  }
}

export async function executablePath() {
  if (process.env.DIGGY_BINARY) {
    const executable = resolve(process.env.DIGGY_BINARY);
    if (!await exists(executable)) throw new Error(`DIGGY_BINARY does not exist: ${executable}`);
    return executable;
  }
  if (await exists(join(packageRoot, "local/go.mod"))) {
    const executable = join(packageRoot, "bin/diggy");
    if (!await exists(executable)) throw new Error("Build the source checkout first: mise run local:build");
    return executable;
  }
  return installNative();
}
