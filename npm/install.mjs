import { join } from "node:path";
import { executablePath, exists, installNative, packageRoot } from "./native.mjs";

// A source checkout builds with the developer's Go toolchain; registry installs
// have no local/ sources and receive a prebuilt executable instead.
if (process.env.DIGGY_BINARY || !await exists(join(packageRoot, "local/go.mod"))) {
  try {
    if (process.env.DIGGY_BINARY) await executablePath();
    else await installNative();
  }
  catch (error) {
    console.error(`Diggy binary setup: ${error.message}\nLaunch diggy to retry, or set DIGGY_BINARY to a locally built executable.`);
    process.exitCode = 1;
  }
}
