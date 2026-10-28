#!/usr/bin/env node
import { spawn } from "node:child_process";
import { executablePath } from "./native.mjs";

try {
  const executable = await executablePath();
  const child = spawn(executable, process.argv.slice(2), { stdio: "inherit" });
  const forward = (signal) => { if (!child.killed) child.kill(signal); };
  const interrupt = () => forward("SIGINT");
  const terminate = () => forward("SIGTERM");
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  child.on("error", (error) => { console.error(`Diggy could not start: ${error.message}`); process.exitCode = 1; });
  child.on("exit", (code, signal) => {
    process.off("SIGINT", interrupt); process.off("SIGTERM", terminate);
    process.exitCode = code ?? (signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1);
  });
} catch (error) { console.error(`Diggy: ${error.message}`); process.exitCode = 1; }
