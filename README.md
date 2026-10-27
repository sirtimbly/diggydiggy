# Diggy

A small project excavation prototype. Depth represents sequence, never time. Colored blocks represent known scope; a vertical dithered absence represents uncertainty. Diggers show where people are working, and cracks show deliberately reported progress.

Open [diggydiggy.app](https://diggydiggy.app). The [original Workers hostname](https://diggy-diggy.sirtimbly.workers.dev) remains available. Use **Share** to create a project with a private invite link.

## Run

For a local Go app with embedded Dolt storage and optional Git remote transport,
use `npm run local:start` after installing the native prerequisites in
[Local Dolt setup](docs/local-dolt.md). This experimental mode needs no hosted
sign-in or database server. Diggy's original code is [MIT licensed](LICENSE);
bundled dependencies and fonts retain their own licenses.

Use Node.js 22.12+ (or 20.19+) and install the dependencies once:

```sh
npm install
npm run dev
```

Open [Diggy](http://127.0.0.1:4173/). Vite provides the dev server and hot updates; React owns the interface components, with a custom Canvas pixel sprite renderer. Fonts are served locally. The dev server uses a fixed port so existing browser-local projects stay available at the same origin.

The Cloudflare Vite plugin runs the Worker and its SQLite Durable Objects locally alongside React. Local shared projects persist under `.wrangler/`. `npm run build` creates the client assets in `dist/client/` and Worker bundle in `dist/diggy_diggy/`. `npm run preview` serves the complete production build at http://127.0.0.1:4174/.

## Source layout

- `src/App.jsx` composes the workspace; `src/main.jsx` mounts React and manages the controller lifecycle.
- `src/components/` contains the header, toolbar, crew palette, excavation scene, task blocks, details popup, block form, and help dialog.
- `src/project/project.js` contains sample data, palette, and saved-project validation. `src/project/crew.js` owns crew validation and lifecycle operations. `src/project/controller.js` coordinates project commands, persistence, canvas navigation, and pointer previews.
- `src/rendering/` contains terrain/dependency painting, sprite animation, fracture/dither painting, and shared pixel helpers. These render outside React’s animation loop.
- The root `masonry.js`, `canvas-pan.js`, `dependency-lines.js`, `fractures.js`, and `digger-life.js` modules hold the independently tested geometry and interaction models.

React renders committed task placements. Pointer previews update the current scene directly for immediate feedback, then a committed placement replaces that transient scene. Inspector form state stays within React. Controller disposal removes event listeners, pointer capture, observers, animation frames, and timers during module replacement.

## Undo and live sharing

Sign in, then use **New project** in the header to open a blank project with its own private sharing link. It starts without sample blocks or crew; use **Add your first block** and **Manage crew** to build it out. Your previous project stays intact. The Diggy home link returns to your original browser-local draft; keep each shared project's invite link to return to it. Creation requires a connection; a failure keeps you on the current board with a retryable message.

Use **⌘/Ctrl+Z** to undo and **⌘/Ctrl+Y** or **Shift+⌘/Ctrl+Z** to redo, or use the toolbar arrows. Moving/resizing, links, assignments, progress/extraction, edits, additions/deletions, and resetting the demo are undoable. A drag or uncertainty-slider gesture is one history entry. Camera movement and selection are excluded, and text fields keep their native undo. History holds the last 100 edits in the current session; editing after undo clears redo.

Use **Share → Create a shared project** to make a shared copy of your current dig. Send its private invite link to teammates; anyone with the link can view, and signed-in collaborators can edit. Your original local draft remains at `/`. Each shared project has its own browser cache and a Cloudflare Durable Object with SQLite storage. Committed edits, assignments, progress, extraction, dependencies, and undo/redo update other connected browsers through WebSockets.

Open the same shared invite in each browser to collaborate. The root URL is a separate local draft and is labeled “Local draft · not shared.” Avatars beside **Live saved** show signed-in collaborators and anonymous viewing sessions; open the avatar stack for names and activity. A collaborator’s selected block has their colored outline and name. Presence does not grant editing access or enter undo history.

Pending edits survive connection loss and replay on reconnect. Conflicting edits pause saving and offer **Keep my pending edits** or **Use shared changes**. Both choices preserve a browser-local backup before resolving. Remote updates wait while you drag or edit a form. Camera position, selection, animations, and session undo history stay local.

See [Cloudflare setup and deployment](docs/cloudflare-sync.md) for Wrangler authentication, architecture, access, and deployment commands.

## Sign-in and editing

The header’s **Sign in** menu supports Google and GitHub OAuth. A valid sign-in is required to create projects or change any project data, including local drafts, names, subtitles, blocks, crew, phases, and undo/redo. Signed-out visitors can view and navigate. Shared digs also require their private invite link; signing in alone does not grant access. Signing out stops editing while preserving viewing access and saved work. The server checks the account session for creation and every shared mutation, including existing WebSockets after logout or expiry.

Create a Google web OAuth client and a GitHub OAuth App, then configure their client IDs and secrets. See [OAuth app setup](docs/cloudflare-sync.md#google-and-github-sign-in) for exact callback URLs, local configuration, and deployment commands. Buttons remain unavailable until their provider is configured.

## Explore

The excavation fills the workspace. The small **Crew** tray at the top left supports drag-to-assign or select-then-click; its minus button collapses it. The keyboard-accessible **Manage crew** button opens a modal to add diggers, edit their appearance, or archive and restore members. Choose a name, helmet/shirt/skin/hair colors, no hair or short/medium/long hair, and independent glasses and headphones. The large preview updates as you edit; **Save changes** commits the draft and **Cancel** discards it. Archiving removes current assignments; restoring makes the digger available without restoring old assignments. Crew changes save, sync per field, and support undo/redo. **Cleared** in the toolbar lists completed work.

- Drag blocks to reorder a stack of solid rectangles. A snap outline previews the landing; nearby blocks reflow around it, snapping to actual contact edges. Hold a dragged block near an edge to auto-scroll sideways or deeper. Both left and right extend as needed, with no fixed column limit. Left/right arrow keys change a focused block’s column; up/down changes its order.
- Drag a digger onto a block, or select a person and then click a block. A person can have up to two work sites. Several people can share a block.
- Drag any of the four edges or four corners to resize known scope. The masonry reflows live and preserves excavated ground. Focus a handle and use arrow keys to resize by 8px, or 32px with Shift. Escape cancels an in-progress resize. Double-click a left or right side handle, or focus it and press Enter, to grow outward to the nearest vertical edge of a block above or below. The opposite side and height stay fixed, and alignment is exact rather than rounded to the grid. Occupied ground, excavations, and the maximum width prevent unsafe growth; each alignment is one undoable, synced edit. Custom dimensions persist; Small/Medium/Large restore presets.
- Drag a block’s lower link dot onto work that depends on it to draw a dependency arrow. Alternatively, select the dot and then the dependent block, or add a prerequisite in the inspector. Blocks can have multiple prerequisites. Loops and duplicate links are rejected; remove links in the inspector.
- Dependent footprints always remain below all prerequisite footprints, including their excavated spaces. A buried top surface also waits until enough of the work above has been cleared to fit a digger. This is enforced during drag previews, keyboard moves, resizing, and reload. Moving or resizing a prerequisite carries downstream work down as needed.
- Click a block to open its compact, nonmodal details popup. The labeled color swatches at the top recolor the block immediately, with undo and shared saving. The full edit/new-block form also puts its color picker first; those choices apply when you save or add the block and are discarded with Cancel. Progress, uncertainty, and assignments are visible immediately; expand **Size & prerequisites** for presets and dependency controls. Close with Escape, the close button, or a click outside. Click empty canvas or workspace space to clear the block selection and hide its resize handles. Save/create returns to the canvas. A 0% unknown block is solid. As uncertainty rises, its color fades out through ordered pixel dithering over a larger vertical region, then fades back into the last few pixels of the bottom rim. Titles and controls stay readable. Uncertainty changes the face treatment without adding invisible space around the block.
- Use **Chip away +10%** to report progress. At 100%, the block breaks into rubble and leaves a permanent cavity in its exact packed footprint. Neighboring cavities merge visually, and the rest of the stack stays in place. Dependent blocks become available.
- Open **Cleared** to search completed work by title or code. Click a result to view its details, or use its eye button to show or hide it on the canvas. Shown work stays complete in its original cavity, with a muted dashed card, checkmark, and **Cleared 100%** status. It cannot be moved, resized, assigned diggers, or linked; use its details to deliberately reopen it. Visibility saves separately for each project in this browser, survives reload, and stays out of shared edits and undo history.
- Add blocks or edit their names and notes.
- Use **Phases → Add a divider** to mark a rough phase or milestone with a name and Sand, Sage, Mist, Heather, or Clay color. Click a line, caption, or menu entry to edit or remove it in the nonmodal editor. Drag a line or caption horizontally or vertically; focused captions move with arrow keys by 8px, or 32px with Shift. Escape cancels a drag, and each completed drag is one undoable edit. Captions repeat in open soil, wrap in narrow spaces, or sit above stone with a leader to the boundary. Placement reserves block bodies, digger walking ranges, crew tray, other captions, and cleared-work markers. Caption text stays at least 12px on screen at 60% zoom; very long names may truncate, with the full name in the title tooltip. Dividers save locally and sync with shared projects without changing block placement, dependencies, or progress. They mark sequence, never dates.
- Pan anywhere on the excavation with middle-button drag or hold Space and left-drag, including over blocks, diggers, and link/resize handles. The grab cursor shows the mode; release the button or Space to stop. Panning opens fresh ground sideways and downward. Text fields retain normal spaces.
- Use zoom and horizontal/vertical scrolling to explore the excavation. The reset-view control returns to the starting ground. On phones, the same popup fits within the screen, and the crew tray starts collapsed.

All initial people and work are sample data. Local projects save only in this browser; shared projects also save on Cloudflare. Progress is always manual. **Reset demo** replaces the current project after an inline confirmation and is shared with teammates when collaboration is enabled.

Keyboard users can select people and blocks with native buttons and manage assignments through the popup. Escape and the close button return focus to the originating block. Diggers use 40×48 pixel sprites with larger faces; their appearance carries through every pose and both facing directions. Each visible digger has an independent pickaxe phase and cadence. Occasionally they sip coffee, check a phone for a few seconds, or walk to another spot in their own safe part of the exposed ledge. Ambient activity never changes task progress or saves. Timelines survive UI rerenders, walking stops during editing gestures, and reduced-motion preferences freeze characters and suppress rubble.

## Verify

`npm run check` runs the geometry, interaction, history, and store tests, checks Worker TypeScript, runs Worker integration tests in the Cloudflare runtime, and builds the complete application. Worker tests cover private sessions, atomic conflicting edits, duplicate receipts, reconnects, project isolation, and fan-out to twenty connections. Tests cover collision-free mixed sizes and uncertainty, supported placement, stable extraction, reserved holes during dragging/resizing, migration, determinism, and growing the excavation. Browser checks cover vertical wheel scrolling, middle-button and Space panning, depth growth, live collision/dependency constraints, exact extraction, exposed shafts, worker access, migration, and mobile overflow.

## Placement model

`masonry.js` packs actual block rectangles into a contact stack. Collision and selection bounds match the colored face exactly; there is no uncertainty margin, headroom reservation, or column-rounded body. Auto placement tries contact edges and grid positions, while dragging snaps to nearby edges or an 8px grid. Arbitrary signed horizontal positions remain available. Dependencies impose a minimum depth even across columns. Rearrangement and resizing cannot overlap live stone or reserved excavations.

The model projects every overhead body onto each lower top face. Unobstructed spans form vertical shafts from the surface down to that face; they never pass through live work. Diggers stand only on exposed spans wide enough for their sprites. Assignments on buried or dependency-blocked work remain queued. Extraction removes only the exact body, preserves its cavity, and exposes the next top face without silently moving the rest of the stack. Cavities and shafts paint as one clipped dark union.

The scene has an independently bounded scroll window. Wheel scrolling, panning, and edge dragging can extend the ground downward. Terrain painting stays limited to the visible area plus overscan. `fractures.js` generates stable jagged fracture trees rooted at the edges. Manual progress advances the tips inward and reveals connected forks and smaller secondary branches; stroke weights stay fixed.

Saved projects migrate to layout version 3 without losing tasks, notes, assignments, progress, or completion. Old padded completion reservations shrink once to the stored colored body dimensions.

## Fonts

DM Sans and Silkscreen, from Google Fonts, are distributed under the SIL Open Font License. See `assets/OFL-dm-sans.txt` and `assets/OFL-silkscreen.txt`.
