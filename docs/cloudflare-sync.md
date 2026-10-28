# Cloudflare live saving

Production domain: [diggydiggy.app](https://diggydiggy.app). The [original Workers hostname](https://diggy-diggy.sirtimbly.workers.dev) stays enabled for existing links. Open **Share** to create a private shared project and copy its invite.

Diggy runs as one Worker with Static Assets and a SQLite Durable Object per project. PartyServer supplies hibernating WebSockets; PartySocket reconnects browsers. No Electric, Postgres, D1, or separate server is required. The deployment is independent of Coleo Reef; it uses the same Cloudflare account and the Worker + Static Assets pattern.

## Local development

```sh
mise install
mise run setup
mise run dev
```

Open http://127.0.0.1:4173/. The Cloudflare Vite plugin runs both React and the Worker; shared rooms use local SQLite under ignored `.wrangler/`. A local invite works only for browsers that can reach that development origin. Production invites use the deployed origin.

## Wrangler setup

Use the project-local Wrangler through mise and pnpm:

```sh
mise run cf:login
mise run cf:whoami
mise run cf:types
mise run check
mise run deploy:check
mise run deploy
```

`mise run cf:login` uses device authorization: approve the short code on Cloudflare’s site within five minutes. Keep the command running until it reports success. It avoids the temporary localhost callback server used by plain `wrangler login`; that server closes after two minutes, so an older approval link will lead to an unavailable localhost page. Start a new login if the code expires.

`wrangler.jsonc` selects account `a8d34ac4c43d2065eb53587d152760ae` and Worker `diggy-diggy`. For a different account, change `account_id`. Authentication may instead use `CLOUDFLARE_API_TOKEN` in the shell or CI secret store with Workers deployment and account-read permissions. Do not commit credentials. Runtime secrets from Reef are not needed.

The production config attaches `diggydiggy.app` as a [Worker Custom Domain](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/). Its DNS zone must be active in the selected Cloudflare account. Production was deployed to this domain on October 23, 2026. A production deployment creates or updates the domain attachment, DNS record, and TLS certificate; editing the config or running a dry run does not activate it. No manual A or CNAME record is needed for the Worker. Staging explicitly sets `routes: []` so it cannot claim the production domain. OAuth callbacks follow the request's origin, so use `https://diggydiggy.app` for production sign-in.

The Vite build produces `dist/client/` and `dist/diggy_diggy/` and writes Wrangler's deployment redirect. Deploy after building; Wrangler uploads the generated Worker and its assets. The `v1` migration creates the SQLite-backed `ProjectRoom` class automatically. The object constructor creates its tables idempotently. Future Durable Object class changes need new Wrangler migration tags; project schema changes need explicit data migration code.

`mise run deploy:staging` checks the app, builds with `CLOUDFLARE_ENV=staging`, and deploys `diggy-diggy-staging` with a separate project namespace and workers.dev hostname. Production adds `diggydiggy.app` and keeps its workers.dev hostname. No Reef domains, routes, databases, or deployments are changed. For Workers Builds, use `mise run check` as the build command and `mise exec -- pnpm exec wrangler deploy` as the deploy command; configure the staging build environment separately if needed.

## Sharing and access

**New project** in the header creates a blank project directly in a new room and opens its private invite URL. Blocks, crew, dividers, and excavations start empty. The old local draft or shared room is preserved. The operation uses the same creation endpoint and rate limit as sharing a draft, requires a valid signed-in account, and leaves the current board open if creation fails. Each successful project has its own browser cache and invite. Creation buttons prevent duplicate requests while pending.

**Share → Create a shared project** copies the current local project into a new room. The returned invite has a random 256-bit edit capability in its URL fragment. Opening it exchanges the capability for a project-scoped HttpOnly session cookie and removes the fragment from the address bar. SQLite stores only the capability hash. WebSocket URLs contain no secret. Requests check same-origin access; project creation is rate limited.

The Share window copies the full invite, which the browser retains locally. A plain project URL requires an existing project session; a new teammate needs the invite. Sessions last thirty days; reopen the invite to renew. Project IDs are server-generated random UUIDv4 values, and each independent invite token contains 256 random bits. There are no sequential project URLs or public project-list endpoints. Knowing a project ID or having an OAuth account session grants no project access. REST reads and WebSocket connections both require the project capability cookie. Holding an invite grants viewing; editing also requires a valid account session. Roles, invite revocation, and an admin project directory remain future work. Treat invite links as private.

## Google and GitHub sign-in

Sign-in is required for all changes to project data, including local drafts and shared-project creation. Joining invites and viewing remain available while signed out. No project ownership, account project list, email matching, or role checks are added. Signing out revokes the account session and preserves saved work and viewing access. Every WebSocket mutation rechecks the session, so open connections cannot keep editing after logout or expiry. Account cookies use `Path=/api` to reach project endpoints; the session endpoint upgrades older `/api/auth` cookies automatically and logout clears both paths. The interface starts read-only, refreshes its account on focus and periodically, and shares sign-out across tabs. Pending edits pause until sign-in succeeds again.

Create these applications yourself:

| Provider | Application type | Production callback URL |
| --- | --- | --- |
| Google | OAuth client ID, **Web application**, with a configured consent screen | `https://diggydiggy.app/api/auth/google/callback` |
| GitHub | **OAuth App** (Settings → Developer settings → OAuth Apps) | `https://diggydiggy.app/api/auth/github/callback` |

The GitHub OAuth App also registers `https://diggy-diggy.sirtimbly.workers.dev/api/auth/github/callback` for login on the original Workers hostname.

Use `https://diggydiggy.app` as the homepage URL and Google authorized domain `diggydiggy.app`. Google requests only `openid profile`; GitHub requests only `read:user`. Diggy reads the provider's stable user ID and display name. It does not request access to Drive, repositories, issues, or email. See the provider setup references: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) and [GitHub OAuth web flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).

For local development, register these exact callback URLs:

- `http://127.0.0.1:4173/api/auth/google/callback`
- `http://127.0.0.1:4173/api/auth/github/callback`

Add the local redirect to the Google web client. Use a separate GitHub OAuth App for local development so its callback is unambiguous. While a Google app is in testing mode, add your intended testers in Google’s console. For staging, use separate credentials and replace the production hostname above with `diggy-diggy-staging.sirtimbly.workers.dev`.

Copy the committed empty template to the ignored local secret file and fill in your values:

```sh
cp .env.example .dev.vars
mise run dev
```

Configure production secrets using interactive prompts; never put actual secrets in source or shell arguments:

```sh
mise exec -- pnpm exec wrangler secret put GOOGLE_CLIENT_ID
mise exec -- pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
mise exec -- pnpm exec wrangler secret put GITHUB_CLIENT_ID
mise exec -- pnpm exec wrangler secret put GITHUB_CLIENT_SECRET
mise run deploy
```

For staging, add `--env staging` to each `wrangler secret put` command and use `mise run deploy:staging`. Each provider is enabled independently only when both its ID and secret exist. OAuth credentials are optional deployment bindings; a provider with missing credentials stays disabled. `mise run cf:types` reads only the credential names from the empty `.env.example` template for type generation. A deployment includes the additive `v2` migration for the SQLite-backed `AuthSession` class without changing existing project rooms.

Sign-in uses authorization code exchange with S256 PKCE, a random 256-bit state bound to an HttpOnly SameSite=Lax cookie, and a single-use server-side flow that expires after ten minutes. Successful sign-in issues a separate random 256-bit HttpOnly account cookie valid for thirty days, stored only as a hash in its object address. Cookies are Secure on HTTPS. The server reads the authenticated profile, then discards provider access/refresh tokens. Session records contain only the provider, stable ID, and display name; alarms remove expired state. Return URLs are limited to the local draft or a valid project URL; invite fragments never go to OAuth providers. Failures return a retryable message without exposing provider error details.

## Commit protocol

`src/sync/protocol.js` validates edits and the resulting full project, including dependencies, crew records, assignment limits, allowed fields, and the physical placement model. Crew is a normalized map alongside blocks and excavations. Existing browser projects and SQLite documents without a crew field acquire independent copies of the four original diggers; the next commit persists that additive migration without resetting project state. Archived crew cannot be assigned to active blocks; archive commands remove their assignments in the same transaction. Each project is one atomic document because moving a block can move its downstream stack and excavation reservations.

Phase dividers are a separate optional `dividers` collection: an array in browser project state and a map keyed by ID in the normalized sync document. Each record has `id`, `label`, `x`, `y`, and `color`; validation permits up to 50 dividers with names of 1–60 characters and one of the five named colors. Legacy projects without the collection load with no dividers. Add, edit, move, and remove commands use the same field-level preconditions, offline queue, local persistence, and compensating undo/redo as other project edits. Repeated captions and collision-aware label placement are derived locally; only the annotation record syncs. Dividers do not change masonry, dependency ordering, or progress.

The browser sends field-level commands serially with UUIDs and before/after preconditions. Updates to computed block `x`, `y`, `column`, and `slot` fields are excluded from shared commands; dimensions, pins, ordering, and prerequisites carry the user’s intent, and canonical packing recomputes the placement. Legacy commands are interpreted the same way. Already-satisfied field changes are idempotent, and receipts at the client’s current revision can still clear its outbox. Competing authored changes retain explicit conflict review. The room checks preconditions against confirmed state, applies masonry, and commits the document, revision, and mutation receipt in one SQLite transaction. Replaying the same UUID and payload returns its original receipt; reusing an ID with a different payload is rejected. Only confirmed receipts clear the browser outbox. Server snapshots broadcast to connected browsers; pending local commands rebase conservatively.

The `project` table holds the normalized document and current revision. `mutations` holds durable receipts. Rooms hibernate when idle and resume from SQLite. The prototype allows up to 64 connected tabs per project, supporting a small team with multiple tabs. Receipt retention is currently unbounded; add a defined replay horizon before introducing cleanup.

Project color meanings use an optional `colorLegend` map keyed by the existing palette slots (for example, `amber: { color: "#336699", label: "Engineering" }`). Only six-digit hex colors and labels up to 32 characters are accepted. Missing maps resolve to the original palette. Legend entries participate in field-level commands, durable storage, and selective undo/redo; independent edits to different slots or fields merge. Existing account checks protect these commands, including from anonymous WebSockets.

## Live presence

Project WebSockets carry a separate presence message for each browser session. The server derives signed-in identity from the account session and assigns anonymous viewers a stable underground creature name and matching pixel-art avatar. The twelve options are Mole, Badger, Gopher, Groundhog, Rabbit, Mole-Rat, Earthworm, Ant, Beetle, Termite, Cave Cricket, and Cave Salamander. The server broadcasts the creature ID with the name, including for existing connections; the client renders its local sixteen-pixel sprite without external image requests. Only verified names, optional provider avatar URLs, colors, activity, and selected block IDs are broadcast; account IDs, account session hashes, and invite tokens stay private. Authenticated users with multiple tabs share one avatar/color.

The interface sends selections immediately, clears them for hidden tabs, and refreshes presence every twenty seconds. Socket closure removes the participant immediately; sessions without an update for 65 seconds are omitted on the next roster broadcast. Connection attachments preserve presence across Durable Object hibernation. Presence does not update SQLite project data, revisions, mutation receipts, history, or editing access. Anonymous users can publish selection presence while remaining unable to mutate projects.

## Local state and conflicts

The original draft stays under `diggy-project-v1`; shared caches use `diggy-project-v1:<projectId>`. Queued commands persist in `_sync` metadata. Disconnects show pending edits and replay them after reconnect. Opening a shared project requires a successful server fetch; this is not an offline-installable app.

Cleared-block visibility uses a separate `<storageKey>:visible-cleared` browser preference for each project. It survives reload but is excluded from shared documents, the outbox, and undo history. Showing a completed card leaves the excavation and completion state intact; reopening or deleting work removes its visibility preference.

A drag, slider gesture, or unsaved form defers incoming snapshots. A precondition conflict stops the queue and opens a review choice. **Keep my pending edits** applies pending field values to the latest confirmed state as a new validated command. **Use shared changes** discards the pending queue. Both first save the previous project and queue to `<storageKey>:conflict-backup`; resolution stops if that backup cannot be written. It can be inspected in browser storage. A deleted parent or invalid combined layout may prevent keeping edits; using the shared version remains available.

Undo and redo emit compensating edits. They skip fields subsequently changed by another user and never replace an entire remote snapshot. Selection, camera, form drafts, sprite timelines, and undo history remain local; shared saving covers committed project changes, not transient drag previews or individual-user presence.

## Verification

```sh
mise run check
mise run deploy:check
```

Worker tests run in workerd and exercise private sessions, duplicate commands, atomic conflicts, malformed edits, isolation, and twenty concurrent connections. Browser checks cover two isolated sessions, shared rename/undo/redo, conflicts, offline queue replay, reload, local-draft preservation, and mobile sharing. `/healthz` provides a small deployment smoke endpoint.
