# Run Diggy locally with embedded Dolt

This experimental mode packages the web app into a Go executable and uses Dolt
in-process. There is no hosted account service, Worker, database server, or
WebSocket connection. All edits, including undo and redo, save locally. The hosted
version remains available through the existing commands.

## Build and start

Install Node.js as described in the main README, Go (the module pins Go 1.26.7;
Go's automatic toolchain download is supported), a C/C++ compiler, and ICU4C.
On macOS, install ICU with `brew install icu4c`; the build helper finds Homebrew's
headers and libraries. On Debian/Ubuntu, install `build-essential` and `libicu-dev`.
The native ICU requirement comes from the embedded Dolt driver.

From the Diggy source directory:

```sh
npm install
npm run local:start
```

Open <http://127.0.0.1:4180>. The first board starts empty. Add blocks and crew as
usual; no sign-in is needed. Wait for **Saved to Dolt** before closing the page.

`npm run local:build` builds `bin/diggy`. After that, run the executable from any
project checkout to keep its board with that project:

```sh
/path/to/diggy/bin/diggy
```

The default database is `.diggy/diggy/`, relative to the current directory. Add
`.diggy/` to that project's `.gitignore`. Dolt synchronizes its data through a
separate Git ref; do not commit its working database files as ordinary Git files.

Options must precede the command:

```sh
./bin/diggy -data /path/to/project/.diggy -port 4181 -name "Your name" -email "you@example.com"
```

The executable embeds the built web assets but currently links to the system's
ICU libraries. Moving it to a different machine requires compatible native
libraries. No separate Dolt installation is required.

## Share through an existing Git remote

Stop the running local app before using remote commands. They open the same
embedded database and need its exclusive lock. Git must be installed and the Git
remote must already contain at least one code commit. Existing Git SSH/HTTPS
authentication is used.

On the first machine, configure the board's remote and upload its saved history:

```sh
./bin/diggy remote git@github.com:YOUR_ORG/YOUR_PROJECT.git
./bin/diggy push
```

On another machine, clone the database into a new data directory, then start:

```sh
./bin/diggy -data /path/to/project/.diggy clone git@github.com:YOUR_ORG/YOUR_PROJECT.git
./bin/diggy -data /path/to/project/.diggy
```

To receive or send later edits, stop the app and use:

```sh
./bin/diggy pull
./bin/diggy push
```

Use the same `-data` argument on every command if you use a custom directory.
There is no automatic push, pull, or synchronization of code and data branches.
Data uses Dolt's `refs/dolt/data` Git transport; ordinary `git clone`, `git pull`,
and `git push` do not replace these database commands. GitHub/GitLab code PRs do
not automatically show the database diffs.

**First-pass limitation:** pull accepts fast-forward updates only. If both
machines have committed independent edits, pull refuses to merge. Local history
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
npm run test:local
npm run test:unit
npm run typecheck
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
