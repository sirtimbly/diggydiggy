---
name: Diggy
description: A pixel-art project excavation inside a cream-paper workbench.
colors:
  paper: "#f5f3e9"
  panel: "#faf9f3"
  ink: "#303c30"
  muted: "#626b5b"
  line: "#dfdfd1"
  green: "#355c38"
  green-hover: "#294b2d"
  accent: "#d4e6a4"
  soil: "#342b2a"
  amber: "#ddb472"
  moss: "#a7bc83"
  lilac: "#b4a6cf"
  coral: "#d9957d"
  blue: "#8eb7c3"
  rose: "#dba0b6"
  rose-shade: "#9f6b81"
  peach: "#e3b99a"
  peach-shade: "#a38466"
  lemon: "#d9ce83"
  lemon-shade: "#9c9255"
  teal: "#8ec2af"
  teal-shade: "#5d8e7d"
  slate: "#a2adc7"
  slate-shade: "#6f7d9b"
  field: "#fffef9"
  button-text: "#fffef4"
  control-border: "#d5d9c7"
  control-selected: "#e0e8cc"
  focus: "#779d48"
  block-ink: "#332b27"
  block-selected: "#fbf0bd"
  block-drop: "#fff5bd"
typography:
  brand:
    fontFamily: "Pixel"
    fontSize: "29px"
    letterSpacing: "-1px"
  headline:
    fontFamily: "DM, sans-serif"
    fontSize: "29px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-1px"
  inspector-title:
    fontFamily: "DM, sans-serif"
    fontSize: "23px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.5px"
  block-title:
    fontFamily: "DM, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "DM, sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  button:
    fontFamily: "DM, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  label:
    fontFamily: "Pixel"
    fontSize: "11px"
rounded:
  block: "1px"
  field: "4px"
  control: "5px"
  workbench: "8px"
  dialog: "10px"
spacing:
  inline: "8px"
  compact: "12px"
  scene-content: "16px"
  panel: "22px"
  desktop-gutter: "40px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.button-text}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  button-primary-hover:
    backgroundColor: "{colors.green-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "8px 9px"
  workbench:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.workbench}"
  task-block:
    textColor: "{colors.block-ink}"
    rounded: "{rounded.block}"
---

# Design System: Diggy

## Overview

**Creative North Star: "A project excavation"**

A pixel-art excavation sits inside a quiet cream-paper workbench. Earth and stone textures, colored work blocks, and small diggers make the project tangible; restrained sans-serif controls keep the scene usable.

This documents the implemented prototype and the user’s confirmed digging direction. Depth communicates sequence, soft pixel edges communicate uncertain scope, and cracks communicate manually reported progress. Pickaxe movement communicates activity only.

**Key Characteristics:**
- Cream-paper controls around a dark, textured excavation.
- Pixel typography for scene labels; DM Sans for readable controls and task names.
- Colored blocks with adjustable uncertainty and several visible diggers.
- Manual progress, with no date or time axis.

## Colors

Warm paper and green controls frame a dark earth scene with ten distinct work colors. Token values above are extracted from `styles.css` and the `PALETTE` fills and paired shades in `src/project/project.js`.

### Primary

- **Green:** primary actions, range accent, and the practical workbench identity; its darker hover variant reinforces interaction.
- **Accent:** pale green text selection. Selected size controls use the separate `control-selected` fill.

### Secondary

- **Amber, Moss, Lilac, Coral, Blue, Rose, Peach, Lemon, Teal, Slate:** user-selectable work block fills. They distinguish blocks without encoding completion, priority, or ownership. Rose, Peach, Lemon, Teal, and Slate each have a paired shade token for their stone treatment.

### Neutral

- **Paper / Panel:** page background and enclosing control surfaces.
- **Ink / Muted / Line:** primary text, supporting copy, and quiet structural separators.
- **Soil:** excavation surround; the Canvas terrain adds darker strata, grass, stones, and subdued mineral pixels.
- **Field / Control Border:** lightly tinted inputs with a visible stroke.
- **Block Ink / Block Selected / Block Drop:** readable scene text, cream selection outline, and a dashed drop-target outline.

## Typography

Local `DM` aliases DM Sans; local `Pixel` aliases Silkscreen. The two DM font files provide regular and semibold styling. Use DM for working text and Pixel for the logo, scene sign, depth labels, block identifiers, percentages, and inspector status labels.

The workspace headline is 19px, becoming 14px on mobile. Popup inspector headings are 20px on all screen sizes. Work block names are 20px, becoming 22px on mobile, and clamp to two lines. Body defaults to 14px/1.5, with controls and supporting text generally 11–13px. Mobile text fields become 16px. Scene text scales with terrain zoom while surrounding controls keep their size.

## Layout

The header is 52px tall with 20px horizontal gutters. Main fills the remaining viewport with 12px side/bottom gutters; the workbench has one excavation column and no permanent side panels or separate project action strip. A 44px toolbar and 30px legend frame the canvas, which takes all remaining width and height. Add block sits immediately after Undo and Redo, before zoom and reset-view controls; project context, the demo badge, Cleared, and Phases share the toolbar. Terrain expands to cover wide viewports, including when zooming out.

Below 680px, the header is 44px and gutters are 6px. The toolbar becomes two rows within 76px: project name, Cleared, and Phases above history, Add block, zoom, and reset-view controls. All controls remain available. The crew tray starts collapsed. The page stays within the screen while the excavation and popup contents scroll independently.

Middle-button drag or Space plus left-button drag pans the excavation, including when starting over a work item. Space shows a grab cursor; an active pan shows grabbing. Pointer capture keeps the gesture continuous outside the viewport; vertical movement stays within the content-derived world depth. Release, Escape, lost capture, or window blur exits the gesture. A compact legend hint and help explain both shortcuts. Command or Ctrl plus scroll zooms around the cursor within the existing 60–135% range; ordinary scrolling retains its native behavior. A nonpassive listener prevents browser zoom during modified scrolling, including at either limit. Active drag/pan gestures and the project-details modal guard zoom changes. Zoom is local view state.

The excavation starts 900px wide and at least 1160px deep inside an independently scrollable viewport. Depth follows content and layout, including work and placement previews; vertical scrolling and panning do not create empty ground. Horizontal growth remains unbounded. Only terrain around the viewport is painted; logical block and cavity coordinates remain stable as the visible origin shifts. Fit and zoom range from 60% to 135%; narrow screens retain sideways panning and an explicit swipe hint. Block presets are 210×132, 250×148, and 300×172px. Custom known dimensions range from 176–640px wide and 132–640px tall. Eight edge/corner handles resize in 8px increments while preserving the masonry structure. Handles appear on hover, selection, keyboard focus, and coarse-pointer devices; they use cream square corners and centered edge grips with directional resize cursors. Keyboard arrows resize a focused handle in 8px steps, or 32px with Shift. Escape or pointer cancellation discards the preview. Preset buttons reset custom dimensions. The internal 0–48 uncertainty range, in steps of 4, is presented as 0–100% unknown and affects only the face mask. Automatic packing begins within a 768px band using contact edges and grid candidates. Moved blocks can occupy any signed horizontal position; dragging snaps to edges or an 8px grid, and keyboard movement uses 64px column steps. Actual colored rectangles determine collision bounds. Bodies start at the surface course, touch earlier work, or respect a deeper prerequisite floor; they never overlap. The initial 48px of headroom is an open shaft above the surface course, not a reservation around every block. Dragging previews a snapped footprint and reflows neighboring work; left/right arrows change columns, while up/down arrows change packing order. Shift moves three columns or positions. Extracted footprints are fixed reservations, so reflow preserves the hole. Holding a block near a side or the bottom of the viewport scrolls the view. Sideways movement can extend the ground; vertical scrolling remains within the depth supplied by content and layout previews. The reset-view control restores normal zoom at the original surface.

## Elevation & Depth

Light control surfaces use borders and tonal separation. The workbench has no exterior shadow. Work block faces use 4px hard inset bevels mixed from each block’s existing fill and shade: left is 80% fill / 20% white, right is 65% fill / 35% shade, bottom is 40% fill / 60% shade, and top is 84% fill / 16% white. The bevels belong to `.block-surface`, so they follow its corner cuts and uncertainty mask. Selection uses a close-fitting outline rather than added elevation. Toasts use `0 7px 22px #17211630`; the help dialog uses `0 20px 80px #17211640` over a dark translucent backdrop. Dragged digger previews have a small drop shadow.

## Shapes

Control corners are mildly softened: 5px buttons, 4px fields and segmented size groups, 8px workbench, and 10px dialog. The excavation stays rectilinear: each stone face removes a 4×4px square (one world pixel) at every corner using an orthogonal 12-point clip, while the outer block retains its full rectangular bounds and 1px corners. Sprites and texture use integer rectangles; uncertainty uses the existing 4px Bayer face mask. Small circular presence markers belong to the surrounding interface.

## Components

### Buttons and focus

Primary buttons use green with cream text; secondary buttons are transparent with a subtle border. Both use 9×15px padding, 13px semibold type, and a 39px minimum height. Icon buttons are transparent with a pale hover fill; text actions are small and underlined. Disabled buttons reduce opacity to .45. Keyboard focus uses a 3px green outline with 4px offset; the block hit area uses a cream outline. On mobile, inspector buttons have a 42px minimum height and icon targets grow.

### Inputs and segmented controls

Inputs and selects use the field fill, 1px control border, 4px corners, and 8×9px padding. Textareas resize vertically. The size group shares one enclosing border with internal dividers; the selected size uses a pale green fill and semibold text. The uncertainty slider is paired with named endpoints and a live description. The ten color choices form two rows of five 28px squares with an ink selection border.

### Keyboard navigation and form focus

New and edit block popups focus the title field as soon as they open, retaining the existing field and focus styling. With the canvas idle, N starts work below the last-created unfinished block, then the selected unfinished block, with the same source color and width; it uses normal creation when neither is available. G opens Go to block. These shortcuts leave text entry, composition, held-key repeats, Command/Ctrl/Alt combinations, open dialogs, menus and forms, and active drag/pan gestures alone. Creation retains the sign-in guard; navigation remains available to viewers.

Go to block is a small paper form centered horizontally near the canvas bottom (20px inset), at most 360px wide with 12px side clearance. It uses the existing panel fill, line border, softened corners (8px), padding (14×16px), and a restrained shadow (`0 8px 24px #25301f24`). A visible label sits above a row containing #, a focused numeric text field, Go, and Close. Supporting copy explains typing, Enter, and Escape. A missing-number message appears inline with status semantics and marks the field invalid; it uses the warm error ink (`#91452f`). Below 680px, the input uses readable mobile type (16px) and the input and buttons have a minimum height (44px).

The number entry supports multiple digits, navigating after a short typing pause (650ms); Enter or Go submits immediately. Escape, Close, or an outside click cancels. Successful navigation selects and focuses the matching stable block number, centers its world footprint, and fits the view within 60–100% zoom. Completed work reveals the existing muted cavity card through its browser-local visibility preference without reopening it. Navigation uses smooth scrolling unless reduced motion requests an immediate scroll. Saving a block also returns focus and brings its footprint into view.

### Blocked sites

Unfinished block details place a labeled Blocked switch before progress. The native checkbox uses switch semantics, a compact pill track (38×24px), and a round thumb (16px); its checked state uses warm amber, supported by the label and explanatory text. The control inherits the existing focus treatment and signed-out disabled state.

A blocked site keeps its colored stone and shows a centered striped pixel construction barrier (112×44px) above the face. Dark diagonal stripes, square feet, and a small amber beacon fit the excavation’s pixel language. The reflector and directional amber light turn about a vertical axis on a six-second loop, viewed from the front like a lighthouse. One continuous beam footprint sweeps horizontally from left to right and back on both halves of the turn; it never points up or down or disappears behind the casing. Facing the viewer adds a brighter white center to the amber beam. Light intensity and reflector position update on every animation frame with full 8-bit blending. The reflector’s horizontal position, apparent width, and brightness share the light field’s animation clock. A fixed pixel grid illuminates the soil behind and around the site, with bright yellow near the lamp, deeper ochre toward the shadows, and a dithered fade into darkness. Faint spill keeps the soil visible between sweeps; the grid itself never rotates or blurs. Reduced motion leaves a steady light pool and a still reflector. The light and reflector pause when offscreen or the tab is hidden. The barrier is decorative and ignores pointer input. The block’s accessible description and the details popup explain the closure. Assigned diggers disappear, and phase captions reserve space for the barrier. This treatment represents a deliberate site closure, distinct from prerequisite waiting or buried work.

### Header, tags, and containers

The header pairs a centered pixel shovel and Silkscreen wordmark with the project name, save status, and help. There is no multi-page navigation. The small outlined demo tag uses Pixel type and sits in the board toolbar. Project-name buttons in the header and toolbar have a small edit icon. They and the surface sign open the same native Edit project modal. The crew floats in a small paper tray; block details open in a paper popup with compact 11px section spacing.

The brand shovel is the self-contained `assets/shovel.svg`, shared by the header image and favicon. Its centered silhouette has a compact solid copper T-grip, timber shaft, brass collar, and a shaded teal steel blade with symmetric sides that remain full-width to y=28 before tapering through unequal orthogonal pixel steps to a softened four-pixel-wide tip across the bottom two rows, rivets, and a central ridge. The narrower, taller blade spans 16×18 units (x=8–24, y=18–36) within the 32×36px grid. The horizontal T-bar is 12px wide and 4px high, 75% of the blade’s width. Preserve crisp pixel edges throughout the silhouette, shading, and ridge; use only horizontal and vertical path segments. The static, decorative header image is 32×36px on desktop and 28×32px below 680px; it is hidden at 360px and below. The wordmark keeps the existing green period and paper setting. Worker pickaxe animation remains an activity cue within the excavation.

The project modal uses a paper surface, border, rounded corners, and a dark backdrop. It is at most 420px wide, stays 12px from the viewport sides, and scrolls on short screens. Project name is required; Sign subtitle is optional; both accept up to 80 characters. Explicit Save changes commits the two trimmed values together as one undoable shared edit. Cancel, Close, and Escape discard the draft; focus changes do not commit it, and incoming shared updates wait while it is open. Mobile fields use 16px text.

The timber sign is fixed at world x=280, clear of the expanded desktop and default collapsed mobile crew tray. Its DOM text starts at x=294; renderer and text placement share the exported surface-sign origin. The shovel sits at x=580. Pixel project-name text is always present, with an optional smaller DM subtitle below. An empty subtitle omits its line. Both lines truncate with ellipses inside the sign and provide their full content in the tooltip. The sign remains a keyboard-accessible button.

Decorative scenery uses crisp pixel geometry and fixed world coordinates. A blue porta-potty at x=840, y=12 stands beside the surface fence with a pale roof, inset vented door, latch, and green vacant indicator; its base starts at y=88. Underground discoveries comprise scattered dinosaur remains at x=328, top y=576 (60 terrain units of 8px below the surface), a helmeted, bearded dwarf at x=768, top y=1536 (180 units), and a shadowy winged, horned balrog at x=464, top y=2016 (240 units). The fossil uses muted bone tones at opacity 0.45, with a skull, separated short tail, two ribs, and one thigh. The dwarf has a full copper beard with dark sideburns, two alternating braided locks, gold clasps, tapered ends, and a curled moustache. A raised brow, rosy cheeks, and crooked toothy grin add personality above leather suspenders and wide planted boots. Six pickaxe poses (ready, windup, lift, strike, follow-through, recovery) advance in 180ms steps, with shoulder lean, bobbing, a two-handed grip, and impact sparks. The balrog stands within a stepped rock arch and soot-dark chamber, framed by warm faceted stones, rubble, and an ember-strewn floor. Its eight-pose idle cycle (2880ms) combines breathing and expanding shoulders, weight shifts on planted boots and bent legs, wing flex and droop, head turns and eyelids, and arm and whip sway. Fire, coals, and rising embers use a separate stepped flicker (180ms); the creature sits 24px into the cave, and all poses fit its 248px discovery height. A separate viewport-windowed discovery canvas clears complete live-block footprints, including uncertain regions, and all cavities and shafts, keeping these scenes visible only in soil. Its existing animation loop refreshes at about 140ms intervals, stays static with reduced motion, and pauses when the page is hidden. All scenery follows terrain pan and zoom without interactions or project state.

### Dependency connectors

Each live block has input and output ports 7px inside its top-right and bottom-right corners, separate from resize grips. Dark green circular ports carry cream details. Draw from the lower output of a prerequisite to dependent work. Orthogonal cream/green arrows link the ports; a dark under-stroke keeps them distinct from soil. Arrowheads use 9px user-space markers with a compact chevron, the same dark outline, and the same foreground color as their line, including selected and invalid states. Routes take side channels around intervening blocks where available. Selecting either endpoint highlights its lines. The dashed draft turns coral for an invalid target. Inspector prerequisite rows support multiple parents and individual removal. Dependency depth constrains live previews and all committed layouts.

### Remote selection markers

Other active sessions retain colored selection rings around their selected blocks. Each distinct person has a matching colored initials circle (28px), a cream border (2px), and white semibold initials (10px). A matching SVG cursor arrow (20×24px) points inward from above-left, with a cream stroke to separate it from the terrain. The first circle’s center anchors at the block’s bottom-right corner, half overhanging both edges; up to four circles extend side by side to the left at 34px intervals. Inverse scaling below 100% terrain zoom preserves their on-screen size. Full names remain in the selection’s screen-reader label; the visual markers are decorative and the overlay uses `pointer-events: none`.

### Crew and excavation blocks

Hardhats have a narrower, taller crown, a projecting brim with a shaded underside, and one raised central rib with two side ribs. Highlights and shadows derive from the worker's chosen helmet color.

Headphones sit beneath the hardhat. The fitted band is concealed inside the helmet shell, while the ear cups remain visible below the brim. This layering preserves the crown, raised ribs, and brim across poses, facing directions, and glasses settings.

Faces use a symmetrical 16px-wide silhouette with paired ears and a centered chin. Both forward-facing eyes are 2×2px pupils on the same row, spaced 8px apart. Glasses use matching 6×6px frames with centered 4×4px inner lenses; pupils remain visible above the lens fill. The face and glasses stay aligned through bobbing poses, mirrored facing, hair, headphones, and the existing hardhat.

Crew buttons combine a pixel sprite, name, and placement LEDs; assignment summaries with exact counts remain in accessible labels and tooltips; selected diggers get a pale green background and border. The same LEDs appear in the active Manage crew roster. Each available placement is a crisp 6×6px stepped, recessed pixel light, dim when unused and active green when assigned. Arrange up to four lights per row and two rows for the maximum eight placements; preserve their hard pixel edges at every state. Blocks are colored stone-like rectangles with a plain number, two-line title, status, reported percentage, cracks, and diggers placed above the top edge. Hover brightens blocks; selection uses a close-fitting 2px cream outline; drop targets use a 3px dashed cream outline offset 8px.

Display DIG-01 as 1, without a prefix or leading zeros, consistently on task faces, in details, in the Cleared list and revealed card, and in screen-reader labels. This presentation leaves stored IDs and codes unchanged.

Multiple diggers may share a block; each person follows the project’s placement maximum, initially two and adjustable from one to eight. Manage crew uses a labeled native Placements per digger number field with visible up/down steppers and an explicit Save limit action in the existing field and button styles. The required field accepts whole numbers from one to eight, keeps a cleared draft blank while editing, and normalizes the draft after a successful save. Its compact width (88px) and desktop minimum height (40px) keep it alongside Save limit; below 680px, the field and save action have a minimum height (44px), and the field uses readable mobile type (16px). The active roster scrolls within the dialog so the limit controls and footer remain reachable on short mobile screens. Dragging a person or selecting them and choosing a block assigns work. Progress is reported in 10% steps; completing a block removes its material and leaves its exact footprint as a dark cavity, while listing the task as out of the ground. Adjacent cavity cells share one pixel rim, forming a single hole; surface cavities open through the grass. Rearranging and resizing work leaves excavated space intact. A cleared task can be selected from its cavity marker to reopen it. Dependencies show a waiting state. Independent pickaxe cycles vary from 155–235ms per frame. Each visible worker alternates 11–26 second digging stretches with occasional 2.8–5.4 second coffee or phone breaks, or short walks along the exposed ledge. Initial work stretches and frame offsets vary per worker. Reduced motion freezes the pose and suppresses completion particles and smooth scrolling.

## Do's and Don'ts

### Do:

- **Do** keep the excavation central and controls on light paper surfaces.
- **Do** render terrain, cracks, dithering, and sprites with crisp pixel edges.
- **Do** distinguish the known beginning and end from the dithered unknown middle.
- **Do** preserve text and focus cues alongside color and animation.
- **Do** keep progress deliberate and the mobile scene pannable.

### Don't:

- **Don’t** turn excavation depth or block dimensions into deadlines or duration.
- **Don’t** advance progress from pickaxe animation.
- **Don’t** replace readable interface text with pixel typography throughout.
- **Don’t** let decorative terrain compete with the colored work blocks.

### Unknown scope

Uncertainty is shown within the stone face. The alpha mask starts with 28% coverage across the full body, beneath deterministic opaque 4px Bayer pixels. Soil texture shows through the faint block tint in the obscured middle, keeping the full estimated footprint discernible. Higher values start the fade earlier and enlarge that band; known material remains opaque and the final 4px of the bottom rim returns to full color. At 0% the face uses no mask and remains fully solid. The full stone face, including its inset bevels, texture, and progress cracks, shares the same mask and stepped corner clip. Labels and controls remain outside the clipped face; collision, selection, and control geometry remain rectangular. Labels stay legible outside the face mask; progress uses a small soil-colored backing when uncertainty is present. The former outer speckle is removed, and there is no padded masonry reservation. The inspector reports a normalized 0–100% unknown value.

### Contact stack and exposed work

Layout version 3 uses the colored rectangle itself as the collision body and selection bound. Adjacent edges can touch. Uncertainty adds no margin, and digger headroom is actual empty shaft space instead of invisible reserved padding. Old geological slot outlines are removed. Dependencies constrain vertical order; overhead body projections additionally determine physical access.

Unoccluded top-face intervals open vertical shafts in cavity color `#1d2221`, clipped to exact body edges and merged with extracted cavities. Working sprites stand on these exposed spans; buried assignments are queued and their progress action explains the obstruction. Resize and drag previews use the same collision/exposure model; drag previews update the availability treatment from the preview layout. Live work blocks show their number, title, and any progress percentage without routine status badges. Ready stone keeps its chosen color, including unassigned ready work. Buried, prerequisite-waiting, and manually blocked work uses the same subtle filter (`saturate(.74) brightness(.95)`) on the stone face and the number/title group, keeping their ink and color backings consistent. Diggers, crew, presence, and barriers retain their colors; the uncertainty mask is unchanged. Sprites, the barrier, and beacon provide nontext cues, with the reason retained in the block’s accessible description and details popup. Completed cards keep their Cleared label. Dependency ports sit inside the top-right and bottom-right face corners, with progress moved left to stay clear.

Cracks follow deterministic branching trees from several body edges. Jagged main fissures advance toward the interior; smaller forks begin only once the parent crack reaches their junction. Progress extends the connected tips and secondary branches, with steady 2px trunks and 1px forks instead of increasing thickness. The uncertainty mask also masks fractures. The excavation fills the bounded workspace height; popup content cannot change its dimensions or vertical scroll range.

### Digger personality

Character clocks are keyed by person and work site and survive inspector and board rerenders. Each worker has a different pickaxe phase, tempo, first break, and subsequent activity sequence. Coffee includes a cream mug raised for a sip and drifting steam; phone pauses show a small blue-green screen and tapping thumb. Walking has alternating legs, a subtle bob, and directional facing. These tiny gestures keep the existing 32×40 pixel sprite scale.

Exposed ledges are divided into personal walking lanes with an 8px gap between workers. Walks stay within a single exposed interval and cover short distances; they cannot cross buried areas or another worker. Dragging/resizing temporarily freezes locomotion. Activity labels appear in the existing hover tooltip without noisy live announcements. Animation never modifies work state. Under reduced motion, all character poses and positions remain still. Offscreen and hidden-tab activity clocks pause and resume without replaying missed actions. Walking uses transforms on the small sprite button, avoiding layout changes.

### Floating workspace tools

The expanded Crew tray is about 236px wide and under 100px tall, initially 12px from the left and 10px from the top of the canvas. Four sprite/name/placement-LED buttons support the existing assignment interactions. The plus/minus control collapses it to a 104px tray; mobile starts collapsed. Completed tasks move to a compact Cleared menu in the toolbar, with restoration also available through cavity markers. Reset remains in Help.

The Crew header is a drag surface with a small move icon, grab/grabbing cursors, and a keyboard-focusable Move crew palette button. Its focus outline uses the existing green focus color. Movement stays in screen space within the canvas, with an 8px edge inset, independently of terrain pan and zoom. Arrow keys move the focused handle by 8px, or 32px with Shift; Home restores the initial position and Escape cancels an active drag. Position is stored locally as fractions of available travel, keeping the tray reachable after reload, viewport resizing, or expanding and collapsing. Manage crew, collapse, and digger assignment remain separate controls. Phase captions recalculate their obstacle around the moved tray. The tray retains its existing paper surface and compact crew treatment.

Block details use a native nonmodal popover, 344px wide or the available screen width minus 24px, with natural content height capped at the smaller of 660px and the viewport height minus 24px. It opens beside the clicked body or cavity, flips sides as needed, and clamps within 12px of the screen edges. It does not dim or resize the canvas. A fixed chrome row keeps Close available while the content scrolls. The scroll body uses `flex: 1 1 auto` with `min-height: 0` in the shared `styles.css` inspector rule; its content basis preserves natural height and prevents Safari from collapsing the auto-height popover body. Keep that content basis when changing the layout. Progress, uncertainty, and assignments are immediately visible; Size & prerequisites expands the less frequent controls. Notes clamp to three lines, redundant captions are omitted, and assignment chips share a row.

Escape, Close, and outside clicks dismiss the popup; Escape/Close restore focus to the originating block. Keyboard block activation opens the same popup. Native scrolling that brings a clicked block into view keeps the popup anchored; deliberate canvas wheel/pan gestures dismiss it. Creating and editing work use the same popup, focus the title immediately, and return focus to the saved block on the canvas. Moving/resizing/assigning work does not open it.
