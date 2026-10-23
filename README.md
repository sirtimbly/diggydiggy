# Diggy

A small project excavation prototype. Depth represents sequence, never time. Colored blocks represent known scope; a vertical dithered absence represents uncertainty. Diggers show where people are working, and cracks show deliberately reported progress.

## Run

Run `npm run dev`, then open http://127.0.0.1:4173. No installation or build step is needed. The project uses HTML, CSS, JavaScript, and a custom Canvas pixel sprite renderer. Fonts are served locally.

## Explore

- Drag blocks to reorder a stack of solid rectangles. A snap outline previews the landing; nearby blocks reflow around it, snapping to actual contact edges. Hold a dragged block near an edge to auto-scroll sideways or deeper. Both left and right extend as needed, with no fixed column limit. Left/right arrow keys change a focused block’s column; up/down changes its order.
- Drag a digger onto a block, or select a person and then click a block. A person can have up to two work sites. Several people can share a block.
- Drag any of the four edges or four corners to resize known scope. The masonry reflows live and preserves excavated ground. Focus a handle and use arrow keys to resize by 8px, or 32px with Shift. Escape cancels an in-progress resize. Custom dimensions persist; Small/Medium/Large restore presets.
- Drag a block’s lower link dot onto work that depends on it to draw a dependency arrow. Alternatively, select the dot and then the dependent block, or add a prerequisite in the inspector. Blocks can have multiple prerequisites. Loops and duplicate links are rejected; remove links in the inspector.
- Dependent footprints always remain below all prerequisite footprints, including their excavated spaces. A buried top surface also waits until enough of the work above has been cleared to fit a digger. This is enforced during drag previews, keyboard moves, resizing, and reload. Moving or resizing a prerequisite carries downstream work down as needed.
- Select a block to adjust uncertainty, assignments, and dependencies. A 0% unknown block is solid. As uncertainty rises, its color fades out through ordered pixel dithering over a larger vertical region, then fades back into the last few pixels of the bottom rim. Titles and controls stay readable. Uncertainty changes the face treatment without adding invisible space around the block.
- Use **Chip away +10%** to report progress. At 100%, the block breaks into rubble and leaves a permanent cavity in its exact packed footprint. Neighboring cavities merge visually, and the rest of the stack stays in place. Dependent blocks become available.
- Add blocks, edit their names and notes, or restore cleared work.
- Pan anywhere on the excavation with middle-button drag or hold Space and left-drag, including over blocks, diggers, and link/resize handles. The grab cursor shows the mode; release the button or Space to stop. Panning opens fresh ground sideways and downward. Text fields retain normal spaces.
- Use zoom and horizontal/vertical scrolling to explore the excavation. The reset-view control returns to the starting ground. On phones, the inspector is below the ground.

All people and work are sample data. Changes are saved in this browser's local storage; there is no backend, shared live sync, or automatic progress. **Reset demo** replaces local changes after an inline confirmation.

Keyboard users can select people and blocks with native buttons and manage assignments through the inspector. Each visible digger has an independent pickaxe phase and cadence. Occasionally they sip coffee, check a phone for a few seconds, or walk to another spot in their own safe part of the exposed ledge. Ambient activity never changes task progress or saves. Timelines survive UI rerenders, walking stops during editing gestures, and reduced-motion preferences freeze characters and suppress rubble.

## Verify

`npm run check` checks JavaScript syntax and runs the masonry, dependency-routing, canvas-gesture, fracture-growth, and character-timeline tests. Tests cover collision-free mixed sizes and uncertainty, supported placement, stable extraction, reserved holes during dragging/resizing, migration, determinism, and growing the excavation. Browser checks cover vertical wheel scrolling, middle-button and Space panning, depth growth, live collision/dependency constraints, exact extraction, exposed shafts, worker access, migration, and mobile overflow.

## Placement model

`masonry.js` packs actual block rectangles into a contact stack. Collision and selection bounds match the colored face exactly; there is no uncertainty margin, headroom reservation, or column-rounded body. Auto placement tries contact edges and grid positions, while dragging snaps to nearby edges or an 8px grid. Arbitrary signed horizontal positions remain available. Dependencies impose a minimum depth even across columns. Rearrangement and resizing cannot overlap live stone or reserved excavations.

The model projects every overhead body onto each lower top face. Unobstructed spans form vertical shafts from the surface down to that face; they never pass through live work. Diggers stand only on exposed spans wide enough for their sprites. Assignments on buried or dependency-blocked work remain queued. Extraction removes only the exact body, preserves its cavity, and exposes the next top face without silently moving the rest of the stack. Cavities and shafts paint as one clipped dark union.

The scene has an independently bounded scroll window. Wheel scrolling, panning, and edge dragging can extend the ground downward. Terrain painting stays limited to the visible area plus overscan. `fractures.js` generates stable jagged fracture trees rooted at the edges. Manual progress advances the tips inward and reveals connected forks and smaller secondary branches; stroke weights stay fixed.

Saved projects migrate to layout version 3 without losing tasks, notes, assignments, progress, or completion. Old padded completion reservations shrink once to the stored colored body dimensions.

## Fonts

DM Sans and Silkscreen, from Google Fonts, are distributed under the SIL Open Font License. See `assets/OFL-dm-sans.txt` and `assets/OFL-silkscreen.txt`.
