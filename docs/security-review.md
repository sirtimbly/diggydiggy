# Public-source secret review — 2026-10-28

Gitleaks 8.30.1 scanned the three existing Git commits reachable through all refs
and reflogs, the staged index, and current tracked/unignored source files.

No credentials were detected after reviewing one false positive: the public
`diggy-crew-position-v1` localStorage preference name. `.gitleaks.toml` excludes
only that exact value in `crew-palette-drag.js`; default detection rules remain
enabled, and inline allow comments are ignored by the scan command. No history
was rewritten and no secret baseline was accepted.

Reproduce with `mise run secrets:check` after `mise install` (which installs Gitleaks), or set
`GITLEAKS_BIN` to its executable. Redacted JSON results for history, index, and
working-tree snapshots are saved under ignored `bin/security/`.

The scan deliberately does not copy ignored local credential files, databases,
or installed dependencies into reports. It detects known credential patterns;
it is not a guarantee about every possible secret or a dependency vulnerability
audit. Repeat it before the actual public push if the source changes.
