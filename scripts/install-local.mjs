import { copyFile, chmod, mkdir, rename, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--prefix" || !args[1])) {
  console.error("Usage: mise run local:install -- [--prefix /installation/directory]");
  process.exit(1);
}

const prefix = resolve(args[1] ?? (process.env.PREFIX || join(homedir(), ".local")));
const binDirectory = join(prefix, "bin");
const source = fileURLToPath(new URL("../bin/diggy", import.meta.url));
const target = join(binDirectory, "diggy");
const temporary = join(binDirectory, `.diggy-install-${randomUUID()}`);

try {
  if (resolve(source) === target) throw new Error("Choose an installation prefix outside the build directory.");
  await mkdir(binDirectory, { recursive: true });
  await copyFile(source, temporary, constants.COPYFILE_EXCL);
  await chmod(temporary, 0o755);
  // Replace the executable atomically, including while an older copy is running.
  await rename(temporary, target);
  console.log(`Installed Diggy at ${target}`);
  const onPath = (process.env.PATH ?? "").split(delimiter).some((entry) => resolve(entry || ".") === binDirectory);
  if (onPath) {
    console.log("Run diggy from any project directory. Re-run local:install after source changes.");
  } else {
    const quoted = `'${binDirectory.replaceAll("'", "'\\''")}'`;
    console.log(`Add this to your shell startup file, then open a new terminal:\n\nexport PATH=${quoted}:"$PATH"`);
  }
} catch (error) {
  console.error(`Could not install Diggy: ${error.message}`);
  process.exitCode = 1;
} finally {
  await rm(temporary, { force: true });
}
