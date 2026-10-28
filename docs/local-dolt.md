# Run Diggy locally with embedded Dolt

This experimental mode packages the web app into a Go executable and uses Dolt
in-process. There is no hosted account service, Worker, database server, or
WebSocket connection. All edits, including undo and redo, save locally. The hosted
version remains available through the existing commands.

## Install for local development

Install mise as described in the main README, a C/C++ compiler, and ICU4C.
Mise installs the pinned Node, pnpm, and Go versions.
On macOS, install ICU with `brew install icu4c`; the build helper finds Homebrew's
headers and libraries. On Debian/Ubuntu, install `build-essential` and `libicu-dev`.
The native ICU requirement comes from the embedded Dolt driver.

From the Diggy source directory:

```sh
mise trust
mise install
mise run setup
mise run local:install
```

This builds the web app and Go executable, then installs `diggy` into
`~/.local/bin` without requiring administrator access. If that directory is not
on your PATH, the installer prints the line to add to your shell startup file
(`~/.zshrc` for zsh or `~/.bashrc` for bash). Open a new terminal after adding it.

Run the installed command from any project checkout to keep its board with that
project:

```sh
cd /path/to/your/project
diggy
```

Open the URL printed by Diggy. It starts at <http://127.0.0.1:4180> and tries
4181, 4182, and successive ports if earlier ports are occupied. The first board
starts empty. Add blocks and crew as usual; no sign-in is needed. Wait for
**Saved to Dolt** before closing the page.

Re-run `mise run local:install` from the Diggy source directory after changing the
source. The installed executable is a copy, so rebuilding alone does not update
it. To choose another installation prefix:

```sh
mise run local:install -- --prefix /your/preferred/location
```

The command is installed at `<prefix>/bin/diggy`. `PREFIX` can also set the
prefix; `--prefix` takes precedence. Choose a directory you can write to.
To uninstall the default installation, remove `~/.local/bin/diggy`; project
databases remain in their project directories.

For a one-off run from the source directory without installing, use
`mise run local:start`. `mise run local:build` only builds `bin/diggy`.
This source installer is the current development workflow; a published npm
package is a separate future distribution step.

The default database is `.diggy/diggy/`, relative to the current directory. Add
`.diggy/` to that project's `.gitignore`. Dolt synchronizes its data through a
separate Git ref; do not commit its working database files as ordinary Git files.

Options must precede the command:

```sh
diggy -data /path/to/project/.diggy -port 4181 -name "Your name" -email "you@example.com"
```

`-port` sets the first port to try; occupied ports are skipped up to port 65535.
Each running project needs its own data directory as well as an available port.
Browser preferences and recovery caches are specific to the selected port's origin.

The development executable embeds the built web assets and links to the build
machine's ICU libraries. `mise run release:binary` creates a standalone executable
with ICU linked statically; native release builds and npm installs use this
form. Linux release binaries still require glibc 2.35+ and the system C++ runtime.
No separate Dolt installation is required. See the main README for npm
installation and direct Go installation instructions.

## Share through an existing Git remote

The header's **Sync** button saves pending edits, receives fast-forward changes,
and uploads local commits using the database's `origin` remote. Editing pauses
briefly during sync, and received work appears on the board automatically. The
button shows **Syncing…**, then **Synced with Git**, or a retryable error. Save or
cancel open forms before syncing. Another tab's unsaved changes are not included.

Configure the remote once using the command below, or clone an existing database.
Stop the running local app before using CLI remote commands. They open the same
embedded database and need its exclusive lock. Git must be installed and the Git
remote must already contain at least one code commit. Existing Git SSH/HTTPS
authentication is used.

On the first machine, configure the board's remote:

```sh
diggy remote git@github.com:YOUR_ORG/YOUR_PROJECT.git
```

Restart `diggy`, then use **Sync** to upload its saved history. You can also use
`diggy push` while the app is stopped.

On another machine, clone the database into a new data directory, then start:

```sh
diggy -data /path/to/project/.diggy clone git@github.com:YOUR_ORG/YOUR_PROJECT.git
diggy -data /path/to/project/.diggy
```

Use **Sync** for later edits. To receive or send through the CLI instead, stop the
app and use:

```sh
diggy pull
diggy push
```

Use the same `-data` argument on every command if you use a custom directory.
Sync is explicit; it does not synchronize code branches or run in the background.
Data uses Dolt's `refs/dolt/data` Git transport; ordinary `git clone`, `git pull`,
and `git push` do not replace these database commands. GitHub/GitLab code PRs do
not automatically show the database diffs.

**First-pass limitation:** Sync and pull accept fast-forward updates only. If both
machines have committed independent edits, they refuse to merge. Local history
is preserved, but there is no Diggy conflict resolution or branch UI yet. Use a
single writer at a time for this prototype. An advanced user can stop Diggy and
inspect the database with a compatible Dolt CLI.

## Storage model and recovery

Each data directory contains one board. SQL stores records in `diggy_cells`, keyed
by entity kind, stable entity ID, and property name. Properties are individually
versioned JSON values; assignments and dependency-array memberships have separate
records, and collection order is recorded per entity. Saves compare the current
records and update only changed ones in one transaction. Each changed save
creates a Dolt commit. There is no shared incrementing revision field or single
board blob.

This first schema still stores computed layout fields and the legacy primary
dependency property. Before enabling automatic merges, these projections should
be derived again from authored intent and merged boards must pass domain
validation. The Go API validates the storage envelope; the browser also applies
Diggy's existing project validation and masonry rules.

The database is authoritative on startup. A content-based ETag prevents an old
browser tab from overwriting newer saves; a stale tab stops saving and asks for a
reload. The app does not refresh other tabs automatically.

Edits also retain the existing browser cache under `diggy-dolt-recovery`. A failed
save shows an error and a retry action. This cache is a manual recovery aid, not
an automatic restore: export its JSON through the browser's storage tools before
making more edits if you need to recover unsaved work. It is shared by local
boards on the same browser origin. Normal startup always opens the database.
Camera, selection, animation state, cleared-card visibility, and sync credentials
are excluded from SQL project data.

The service binds only to `127.0.0.1`, checks the expected Host and browser Origin,
and exposes a project API rather than arbitrary SQL. It is intended for a local
user, not LAN hosting.

## Verification

```sh
mise run test:local
mise run test:unit
mise run typecheck
```

The Go suite checks restart persistence, Dolt history, field-sized diffs, stale
writes, local API access boundaries, and push/clone/fast-forward pull against a
temporary Git repository. Browser-client tests cover serialized saves and stale
write rejection.

## License

Diggy's original code uses the MIT license. This permits commercial use and
modification while retaining the copyright and license notice. Dependencies keep
their own licenses, including Apache 2.0 for Dolt and SIL OFL 1.1 for the fonts.
See `LICENSE` and `THIRD_PARTY_NOTICES.md`.
