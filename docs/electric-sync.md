# Electric integration boundary

The app is still local. There is no server connection, account system, or background network request. `src/project/store.js` is the integration boundary; the controller no longer reads or writes browser storage directly. The current key (`diggy-project-v1`) and project schema remain compatible. Additive `_sync` metadata stores the shared project identity, confirmed revision, and durable pending commands when sync is explicitly enabled. Undo history remains local to an editing session and starts empty on reload.

Electric provides the Postgres read path. Writes must go through an application API, with optimistic edits held until the corresponding database change arrives through Electric. This follows Electric's [write patterns](https://electric.ax/docs/sync/guides/writes) and [TypeScript client guidance](https://electric.ax/docs/sync/api/clients/typescript). The official client can be added when there is a backend to connect to; it is not required for local mode.

## Interfaces ready to connect

The controller exposes `store` and `receiveRemote(snapshot)`. The store exposes:

- `getProject()` — a defensive project copy; `projectDocument(project)` converts it to shared data.
- `subscribe(listener)` — local edit, undo, redo, and remote events. Local events include a command with a UUID, client/session UUID, project UUID, base revision, kind, label, and field changes. Release the returned subscription during disposal.
- `enableSync({ projectId, revision })` — start queueing writes after the backend has explicitly seeded or confirmed this local project. It cannot switch an already shared project. Opening an existing shared project needs a separate project-loading flow, never an implicit upload over that project.
- `getPendingMutations()` — defensive copies of commands to submit to the write API in FIFO order. They survive reload. HTTP success alone must not clear them.
- `receive({ projectId, revision, project, acknowledgedIds })` — consume a newer confirmed snapshot with receipts. Wrong-project and stale revisions are ignored. Only explicitly acknowledged commands are removed; unacknowledged edits rebase using field preconditions. Conflicts return `{ applied: false, conflict: commandId }` and leave the revision, local work, and durable queue intact.

Use `controller.receiveRemote` to update the UI. It returns `{ deferred: true }` during a pointer gesture, slider gesture, or unsaved form; the integration must retain the latest snapshot and retry after the interaction finishes. The raw store method is for non-UI consumers. Neither method adds remote changes to this user's undo stack or emits another outbound local write.

Commands use a normalized document: `order`, `blocks` keyed by ID, and `excavations` keyed by block ID (or footprint for legacy unowned holes). A change has `path`, `before`, and `after`. `null` means an absent property; `{ value }` means a present JSON value. There are no arbitrary JavaScript functions in a command. Selection, canvas bounds, zoom, popup/form state, crew selection, and animated character state stay local. Block coordinates/slots are currently included so physical placement and extraction can be transacted together; they are not independent CRDT positions.

## Backend work still needed

`sync/schema.sql` is a reference schema, not an applied migration. One project row is a deliberate first integration: the full physical stack and its reservations are a single transaction. Per-entity tables or fractional ordering can follow when collaboration semantics are settled.

Implement the following before enabling sync:

1. Authenticated project creation/loading and membership checks. Seed a row using `projectDocument(controller.store.getProject())`; explicitly associate that draft with the returned project UUID and revision. Keep different shared projects in separate storage namespaces.
2. A write endpoint that authenticates the user, locks the project row, checks a globally unique command UUID for an existing receipt, validates the project ID and allowed change paths/values, then checks every `before` precondition against the latest document. Apply the command atomically, validate dependencies, assignment limits, and layout/excavations, and increment the revision. Return 409 for conflicting or invalid commands. Insert the receipt and changed document in the same Postgres transaction. Repeated UUIDs must return the original receipt and reject a different payload using that UUID. `baseRevision` is diagnostic: stale writes require matching field preconditions, never blind last-writer replacement.
3. Authenticated Electric shape proxies for the project row and relevant mutation receipts. Do not expose Electric credentials, client-supplied SQL filters, or direct database credentials. Use `ShapeStream` + `Shape` from `@electric-sql/client` behind those proxies. The backend controls project membership and shape filters.
4. A bridge that subscribes to local store events, sends pending commands serially with retry/backoff, and materializes incoming project/receipt shapes. Only acknowledge a receipt once the project shape has reached at least that receipt's revision. Then call `controller.receiveRemote` with the shared project revision, materialized project, and acknowledged command IDs. Coalesce shape deliveries, retain deferred snapshots, stop/release all subscriptions and requests on teardown, and surface offline/conflict states honestly.
5. An explicit conflict-resolution flow. Automatic rebasing stops if pending edits conflict; the queue is retained. There is intentionally no silent discard or overwrite API. A conflict-resolution UI/command protocol belongs with the backend integration.

Undo emits compensating field changes as a new local command; it never rolls back a whole remote snapshot. Fields changed by a teammate since the original edit are skipped. If the partial inverse would violate project validation, the entire inverse is skipped. Redo includes only fields actually undone. This is a conservative foundation, not a claim of complete collaborative conflict resolution. In-flight writes, conflicting reorder operations, deletes versus edits, and layout changes need backend transaction tests with multiple clients before live use.
