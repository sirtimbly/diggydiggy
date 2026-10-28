# Releasing diggydiggy

The npm package is `diggydiggy`; the installed executable is `diggy`. The package
contains a dependency-free Node launcher, version-specific SHA-256 checksums,
and license notices. It downloads a compressed native executable in postinstall;
if scripts are disabled, first launch performs the same verified download.
Downloads go under the installed package's `.diggy-native/` directory, never the
consumer project's source directory. Network access to GitHub is required for
that first download. `DIGGY_BINARY` can point to an offline/source-built binary.

## Native build targets

| Target | Build runner | Runtime requirement |
| --- | --- | --- |
| darwin_arm64 | macos-14 | macOS 14+ on Apple Silicon |
| darwin_amd64 | macos-15-intel | macOS 15+ on Intel |
| linux_arm64 | ubuntu-22.04-arm | glibc 2.35+ and system C++ runtime |
| linux_amd64 | ubuntu-22.04 | glibc 2.35+ and system C++ runtime |

These are native builds, not cgo cross-compilation. `scripts/build-portable.sh`
stages only ICU's static archives, compiles with `icu_static`, and rejects any
binary still linked against ICU shared libraries. macOS checks also reject
Homebrew library paths. Linux binaries use the runner's system libc/libstdc++;
they do not claim compatibility with Alpine/musl or older glibc distributions.
Windows is deliberately excluded until its native toolchain is supported/tested.

Build your current platform locally:

```sh
mise trust
mise install
mise run setup
mise run build:local
mise run release:binary
```

Outputs live under ignored `.release/`: the native executable, a `.gz` download,
a license archive, and a JSON checksum record. Release executables support
`diggy --version`. Development builds report `dev`.

## GitHub automation

1. Push the source to the intended GitHub repository; the release job reads its
   actual `GITHUB_REPOSITORY`, so no owner/repo is guessed in source.
2. Enable Actions and allow Actions to create pull requests for release-please.
3. The `ci` workflow tests web/Worker code, local Go code, and npm download logic
   on macOS/Linux. It scans the full checked-out history on Linux.
4. On successful CI for a push to `main`, release-please opens/updates the release
   PR from Conventional Commits. Merging it creates the version tag/release.
5. The same workflow explicitly invokes the reusable release job. This works
   with the built-in GitHub token, whose tag/release events do not independently
   trigger another workflow. No personal release token is needed.
6. The release workflow builds/tests all four platforms, uploads native assets
   and a prepared npm tarball, and tests installation of that exact tarball as a
   dev dependency in a new project. A manual `v*` tag also runs the build job.

The default source branch is `main`; adjust release-please if the repo uses
another branch. The initial manifest baseline is `0.1.0`; a manually created
`v0.1.0` tag can build the first release after reviewing the source.

Release metadata is generated only after all target artifacts exist. The
preparation step verifies their version/platform names and hashes, embeds the
actual release URLs/checksums into `npm/release.json`, and includes dependency
notices under `npm/licenses/`. The committed release metadata is intentionally
empty: directly publishing the source package is refused by `prepublishOnly`.
Do not check generated release metadata or native downloads into Git.

## Publishing to npm

Nothing is published to npm automatically yet. Configure the `diggydiggy` npm
package's trusted publisher for this GitHub repository, workflow `publish-npm.yml`,
and environment `npm`. Create that GitHub environment and add any desired
reviewers. Follow npm's first-publication/account setup process if the package
does not exist yet. No npm token is stored in the repo.

Then run the **publish-npm** workflow manually with an existing built release
tag. It downloads the exact tarball already attached to that GitHub release,
re-tests its dev-dependency installation, then uses the mise-pinned tools, pnpm OIDC, and
provenance to publish it. It does not rebuild or replace release binaries. Once
the first publication and trusted publisher are established, automatic invocation
can be added to that publishing workflow.

Release assets are immutable: the build workflow deliberately does not clobber
existing assets. Publish an already-built version through **publish-npm**, rather
than rebuilding its tag. Use a new version for changed binaries; replacing files
would invalidate checksums embedded in packages that users already installed.

The expected user workflow after publication is:

```sh
pnpm add --save-dev diggydiggy --allow-build=diggydiggy
pnpm exec diggy
```

When used as a dev dependency, native downloads are installation artifacts under
`node_modules/diggydiggy`; the board database remains relative to the user's
working directory. A project may add `"diggy": "diggy"` to its npm scripts.

## Secret scanning

Run `mise install`, then `mise run secrets:check` (mise installs Gitleaks). Or point `GITLEAKS_BIN` at its
executable. CI uses the same `mise.toml` and four-platform `mise.lock` as local
development. The scan covers all reachable refs/reflogs, the staged index, and
current contents of every tracked file, including modifications, plus new
unignored source files. Ignored local credentials are not copied into scan
artifacts. Reports redact secret values and are saved under `bin/security/`.

The only explicit exclusion is the public `diggy-crew-position-v1` browser
preference name in `crew-palette-drag.js`; both the file and exact value must
match. Other findings are not baselined or silently accepted. A passing scan
means no credentials were detected by these rules, not a proof that arbitrary
data can never contain a secret.
