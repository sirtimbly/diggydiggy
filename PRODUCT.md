# Diggy

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Vite and React organize the interface into components, with CSS and a small Canvas sprite renderer. The prototype keeps project data locally in the browser.

## Users
Developers and team leads exploring current work together.

## Product Purpose
Make a project visible as an excavation. Show known work, uncertain scope, order of operations, and where developers are working without implying deadlines or duration.

## Capabilities and Constraints
The excavation occupies the full available workspace. A small collapsible worker palette floats at the top left. Clicking a block opens compact nonmodal details beside it; progress, uncertainty, and assignments are immediate, with size and dependencies in an expandable section. Close by Escape, the close button, or clicking outside. The same popup stays within the mobile screen; there are no permanent inspector or crew sidebars.

Drag work blocks through soil. Move diggers onto blocks, including several diggers on one block and up to two work sites per person. Represent unknown scope with an adjustable vertical dithered gap in the block color: higher uncertainty hides a greater portion, and the color returns at the bottom rim. Preserve readable task labels. Represent deliberate progress with cracks and excavation. Depth indicates sequence, never time.

Blocks form a contact stack of actual 2D rectangles. Dragging reorders work and snaps to contact edges. Collision and selection bounds match the colored box, with no external uncertainty padding. Uncertainty affects only the visible face. Extraction leaves a persistent empty space; completed bodies stay reserved during later rearrangement and neighboring cavities form one hole. The excavation grows deeper as work is added. It also expands sideways without a fixed column limit, with edge scrolling while dragging sideways or deeper. Known block width and height can be resized from all four edges and corners, independently of uncertainty, with masonry reflow and saved custom dimensions.

The excavation can be panned with middle-button drag or Space plus left-button drag, including over work blocks. Horizontal and vertical panning extend into fresh ground; editing text retains normal keyboard behavior.

Overhead stone occludes lower work. Vertical shafts open only above exposed top-face intervals and join completed cavities. Diggers stand in this empty space on reachable surfaces; buried assignments wait until the way is clear. Fractures begin at the edges and grow inward like lightning, splitting into connected smaller branches as progress rises; they do not simply get thicker.

Dependencies can be drawn from a prerequisite’s lower connector to dependent work. A block may have multiple prerequisites, cycles are rejected, and every dependent footprint must stay below its prerequisites during placement and resizing.

Diggers have independent work rhythms, with occasional coffee sips, phone pauses, and short walks along their own exposed ledge. These are ambient character animations only; they never advance reported task progress. Reduced motion keeps characters stationary.

## Brand Commitments
Pixel art, earth and stone textures, colorful work blocks, and diggers with animated pickaxes.

## Evidence on Hand
The user's verbal description. All tasks and people in the initial project are illustrative demo data.

## Open Decisions
The user confirmed manual progress; animation shows activity only. Local persistence and no backend are prototype implementation choices. Remote collaboration is beyond this first prototype.
