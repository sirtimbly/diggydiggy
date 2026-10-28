import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const executable = resolve(process.argv[2]);
const directory = await mkdtemp(`${tmpdir()}/diggydiggy-smoke-`);
const child = spawn(executable, ["-data", directory, "-port", "43180"], { cwd: directory, stdio: ["ignore", "pipe", "inherit"] });
try {
  const url = await new Promise((accept, reject) => {
    const timeout = setTimeout(() => reject(new Error("Native startup timed out")), 30_000);
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/Diggy: (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) { clearTimeout(timeout); accept(match[1]); }
    });
    child.once("error", (error) => { clearTimeout(timeout); reject(error); });
    child.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`Native app exited during startup: ${code}`)); });
  });
  const response = await fetch(`${url}/api/local/project`);
  assert.equal(response.status, 200);
  const project = {version:1,layoutVersion:3,name:"Release smoke test",blocks:[],crew:[],dividers:[],excavations:[],colorLegend:{}};
  const saved = await fetch(`${url}/api/local/project`, { method: "PUT", headers: { "content-type": "application/json", "if-match": response.headers.get("etag"), origin: url }, body: JSON.stringify({project}) });
  assert.equal(saved.status, 204);
  assert.equal((await (await fetch(`${url}/api/local/project`)).json()).project.name, project.name);
  assert.equal((await fetch(url)).status, 200);
  console.log("Native web serving and embedded SQL persistence passed.");
} finally {
  child.kill("SIGTERM");
  await new Promise((accept) => { if (child.exitCode !== null || child.signalCode) return accept(); child.once("exit", accept); });
  await rm(directory, { recursive: true, force: true });
}
