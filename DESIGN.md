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

Warm paper and green controls frame a dark earth scene with five distinct work colors. Token values above are extracted from `styles.css` and the `PALETTE` fills in `src/project/project.js`.

### Primary

- **Green:** primary actions, range accent, and the practical workbench identity; its darker hover variant reinforces interaction.
- **Accent:** pale green text selection. Selected size controls use the separate `control-selected` fill.

### Secondary

- **Amber, Moss, Lilac, Coral, Blue:** user-selectable work block fills. They distinguish blocks without encoding completion, priority, or ownership.

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

The header is 52px tall with 20px horizontal gutters. A 64px project row keeps the title and Add a block action compact. Main fills the remaining viewport with 12px side/bottom gutters; the workbench has one excavation column and no permanent side panels. A 44px toolbar and 30px legend frame the canvas, which takes all remaining width and height. Terrain expands to cover wide viewports, including when zooming out.

Below 680px, the header is 44px, the project row is 52px, the toolbar is 40px, and gutters are 6px. The crew tray starts collapsed. The page stays within the screen while the excavation and popup contents scroll independently.

Middle-button drag or Space plus left-button drag pans the excavation, including when starting over a work item. Space shows a grab cursor; an active pan shows grabbing. Pointer capture keeps the gesture continuous outside the viewport; downward movement extends the ground. Release, Escape, lost capture, or window blur exits the gesture. A compact legend hint and help explain both shortcuts.

The excavation starts 900px wide and at least 1160px deep inside an independently scrollable viewport. It grows down, left, and right with the packed work. Only terrain around the viewport is painted; logical block and cavity coordinates remain stable as the visible origin shifts. Fit and zoom range from 60% to 135%; narrow screens retain sideways panning and an explicit swipe hint. Block presets are 210×132, 250×148, and 300×172px. Custom known dimensions range from 176–640px wide and 132–640px tall. Eight edge/corner handles resize in 8px increments while preserving the masonry structure. Handles appear on hover, selection, keyboard focus, and coarse-pointer devices; they use cream square corners and centered edge grips with directional resize cursors. Keyboard arrows resize a focused handle in 8px steps, or 32px with Shift. Escape or pointer cancellation discards the preview. Preset buttons reset custom dimensions. The internal 0–48 uncertainty range, in steps of 4, is presented as 0–100% unknown and affects only the face mask. Automatic packing begins within a 768px band using contact edges and grid candidates. Moved blocks can occupy any signed horizontal position; dragging snaps to edges or an 8px grid, and keyboard movement uses 64px column steps. Actual colored rectangles determine collision bounds. Bodies start at the surface course, touch earlier work, or respect a deeper prerequisite floor; they never overlap. The initial 48px of headroom is an open shaft above the surface course, not a reservation around every block. Dragging previews a snapped footprint and reflows neighboring work; left/right arrows change columns, while up/down arrows change packing order. Shift moves three columns or positions. Extracted footprints are fixed reservations, so reflow preserves the hole. Holding a block near a side or the bottom of the viewport scrolls and extends the ground continuously. The reset-view control restores normal zoom at the original surface.

## Elevation & Depth

Light control surfaces use borders and tonal separation. The workbench has no exterior shadow. Work blocks use hard inset highlights and lower-edge shading to resemble cut stone: `inset 0 4px 0 #ffffff30, inset 0 -5px 0 #00000020, inset 4px 0 0 #ffffff15, inset -4px 0 0 #00000017`. Selection uses a close-fitting outline rather than added elevation. Toasts use `0 7px 22px #17211630`; the help dialog uses `0 20px 80px #17211640` over a dark translucent backdrop. Dragged digger previews have a small drop shadow.

## Shapes

Control corners are mildly softened: 5px buttons, 4px fields and segmented size groups, 8px workbench, and 10px dialog. The excavation stays rectilinear: blocks use 1px corners, sprites and texture are integer rectangles, and uncertainty is a scattered 4px pixel fringe. Small circular presence markers belong to the surrounding interface.

## Components

### Buttons and focus

Primary buttons use green with cream text; secondary buttons are transparent with a subtle border. Both use 9×15px padding, 13px semibold type, and a 39px minimum height. Icon buttons are transparent with a pale hover fill; text actions are small and underlined. Disabled buttons reduce opacity to .45. Keyboard focus uses a 3px green outline with 4px offset; the block hit area uses a cream outline. On mobile, inspector buttons have a 42px minimum height and icon targets grow.

### Inputs and segmented controls

Inputs and selects use the field fill, 1px control border, 4px corners, and 8×9px padding. Textareas resize vertically. The size group shares one enclosing border with internal dividers; the selected size uses a pale green fill and semibold text. The uncertainty slider is paired with named endpoints and a live description. Color choices are 28px squares with an ink selection border.

### Header, tags, and containers

The header pairs a pixel pickaxe and wordmark with workspace context, save status, and help. There is no multi-page navigation. The small outlined demo tag uses Pixel type. The crew floats in a small paper tray; block details open in a paper popup with compact 11px section spacing.

### Dependency connectors

Each live block has input and output ports 7px inside its top-right and bottom-right corners, separate from resize grips. Dark green circular ports carry cream details. Draw from the lower output of a prerequisite to dependent work. Orthogonal cream/green arrows link the ports; a dark under-stroke keeps them distinct from soil. Arrowheads use 9px user-space markers with a compact chevron, the same dark outline, and the same foreground color as their line, including selected and invalid states. Routes take side channels around intervening blocks where available. Selecting either endpoint highlights its lines. The dashed draft turns coral for an invalid target. Inspector prerequisite rows support multiple parents and individual removal. Dependency depth constrains live previews and all committed layouts.

### Crew and excavation blocks

Crew buttons combine a pixel sprite, name, and a compact work-site count; assignment summaries remain in accessible labels and tooltips; selected diggers get a pale green background and border. Blocks are colored stone-like rectangles with a code, two-line title, status, reported percentage, cracks, and diggers placed above the top edge. Hover brightens blocks; selection uses a close-fitting 2px cream outline; drop targets use a 3px dashed cream outline offset 8px.

Multiple diggers may share a block; each person may have two work sites. Dragging a person or selecting them and choosing a block assigns work. Progress is reported in 10% steps; completing a block removes its material and leaves its exact footprint as a dark cavity, while listing the task as out of the ground. Adjacent cavity cells share one pixel rim, forming a single hole; surface cavities open through the grass. Rearranging and resizing work leaves excavated space intact. A cleared task can be selected from its cavity marker to reopen it. Dependencies show a waiting state. Independent pickaxe cycles vary from 155–235ms per frame. Each visible worker alternates 11–26 second digging stretches with occasional 2.8–5.4 second coffee or phone breaks, or short walks along the exposed ledge. Initial work stretches and frame offsets vary per worker. Reduced motion freezes the pose and suppresses completion particles and smooth scrolling.

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

Uncertainty is shown within the stone face. A deterministic 4px Bayer dither progressively removes the block color vertically, reveals the soil through a variable-height middle, and returns to full color in the final 4px of its bottom rim. At 0% the face is fully solid; higher values start the fade earlier and hide more of the middle. Texture and progress cracks share the same mask. Labels stay legible outside the face mask; status and progress use small soil-colored backings when uncertainty is present. The former outer speckle is removed, and there is no padded masonry reservation. The inspector reports a normalized 0–100% unknown value.

### Contact stack and exposed work

Layout version 3 uses the colored rectangle itself as the collision body and selection bound. Adjacent edges can touch. Uncertainty adds no margin, and digger headroom is actual empty shaft space instead of invisible reserved padding. Old geological slot outlines are removed. Dependencies constrain vertical order; overhead body projections additionally determine physical access.

Unoccluded top-face intervals open vertical shafts in cavity color `#1d2221`, clipped to exact body edges and merged with extracted cavities. Working sprites stand on these exposed spans; buried assignments are queued and their progress action explains the obstruction. Resize and drag previews use the same collision/exposure model. Dependency ports sit inside the top-right and bottom-right face corners, with progress moved left to stay clear.

Cracks follow deterministic branching trees from several body edges. Jagged main fissures advance toward the interior; smaller forks begin only once the parent crack reaches their junction. Progress extends the connected tips and secondary branches, with steady 2px trunks and 1px forks instead of increasing thickness. The uncertainty mask also masks fractures. The excavation fills the bounded workspace height; popup content cannot change its dimensions or vertical scroll range.

### Digger personality

Character clocks are keyed by person and work site and survive inspector and board rerenders. Each worker has a different pickaxe phase, tempo, first break, and subsequent activity sequence. Coffee includes a cream mug raised for a sip and drifting steam; phone pauses show a small blue-green screen and tapping thumb. Walking has alternating legs, a subtle bob, and directional facing. These tiny gestures keep the existing 32×40 pixel sprite scale.

Exposed ledges are divided into personal walking lanes with an 8px gap between workers. Walks stay within a single exposed interval and cover short distances; they cannot cross buried areas or another worker. Dragging/resizing temporarily freezes locomotion. Activity labels appear in the existing hover tooltip without noisy live announcements. Animation never modifies work state. Under reduced motion, all character poses and positions remain still. Offscreen and hidden-tab activity clocks pause and resume without replaying missed actions. Walking uses transforms on the small sprite button, avoiding layout changes.

### Floating workspace tools

The expanded Crew tray is about 236px wide and under 100px tall, pinned 12px from the left and 10px from the top of the canvas. Four sprite/name/site-count buttons support the existing assignment interactions. The plus/minus control collapses it to a 104px tray; mobile starts collapsed. Completed tasks move to a compact Cleared menu in the toolbar, with restoration also available through cavity markers. Reset remains in Help.

Block details use a native nonmodal popover, 344px wide or the available screen width minus 24px, with a maximum height of 660px. It opens beside the clicked body or cavity, flips sides as needed, and clamps within 12px of the screen edges. It does not dim or resize the canvas. A fixed chrome row keeps Close available while the content scrolls. Progress, uncertainty, and assignments are immediately visible; Size & prerequisites expands the less frequent controls. Notes clamp to three lines, redundant captions are omitted, and assignment chips share a row.

Escape, Close, and outside clicks dismiss the popup; Escape/Close restore focus to the originating block. Keyboard block activation opens the same popup. Native scrolling that brings a clicked block into view keeps the popup anchored; deliberate canvas wheel/pan gestures dismiss it. Creating and editing work use the same popup and saving returns to the canvas. Moving/resizing/assigning work does not open it.
