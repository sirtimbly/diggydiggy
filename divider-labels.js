// Labels repeat through open soil. Stone and the full animated digger silhouette
// are obstacles; text never relies on the uncertain face being opaque.
export const DIVIDER_LABEL_HEIGHT = 28;
export function layoutDividerLabels(divider, obstacles, viewport, width, {height = DIVIDER_LABEL_HEIGHT, gap = 8, compactHeight} = {}) {
  const left = viewport.left + gap, right = viewport.right - gap;
  if (right - left < width) return [];
  function spaces(y, bandHeight = height, minimumWidth = width) {
    let ranges = [{left, right}];
    for (const body of obstacles) {
      if (body.y - gap >= y + bandHeight || body.y + body.height + gap <= y) continue;
      const a = body.x - gap, b = body.x + body.width + gap;
      ranges = ranges.flatMap((r) => a >= r.right || b <= r.left ? [r] : [
        ...(a > r.left ? [{left:r.left, right:a}] : []),
        ...(b < r.right ? [{left:b, right:r.right}] : []),
      ]);
    }
    return ranges.filter((r) => r.right - r.left >= minimumWidth);
  }
  const y = divider.y - height - gap, scale = height / DIVIDER_LABEL_HEIGHT,
    pitch = Math.max(336 * scale, width + 56 * scale);
  const labels = [];
  for (const range of spaces(y)) {
    let x = divider.x + Math.ceil((range.left - divider.x) / pitch) * pitch;
    if (x + width > range.right) x = Math.max(range.left, Math.min(divider.x, range.right - width));
    for (; x + width <= range.right; x += pitch) labels.push({x, y, width, height});
  }
  if (labels.length) return labels;
  // Narrow channels use the full font size and a variable-height caption.
  // Test its complete rectangle at each height, including above nearby courses.
  function compactAt(boundary) {
    for (const rows of [1,2,3,4]) {
      const bandHeight = (rows*16+14)*scale;
      if (boundary-bandHeight-gap<8) continue;
      const choices = [];
      for (const range of spaces(boundary-bandHeight-gap,bandHeight,64*scale)) {
        const compactWidth = Math.min(width,range.right-range.left);
        const h = Math.min(78*scale,compactHeight?.(compactWidth) ?? 78*scale);
        if (h>bandHeight) continue;
        choices.push({x:Math.max(range.left,Math.min(divider.x,range.right-compactWidth)),
          y:boundary-h-gap, width:compactWidth, height:h, compact:true});
      }
      choices.sort((a,b) => Math.abs(a.x-divider.x)-Math.abs(b.x-divider.x));
      if (choices.length) return [choices[0]];
    }
    return [];
  }
  const compact = compactAt(divider.y);
  if (compact.length) return compact;
  // A full course of stone may cross the boundary. Put one caption above that
  // course instead, with a fine leader down to the actual boundary depth.
  const candidates = [...new Set(obstacles.map((b) => b.y))]
    .filter((boundary) => boundary-height-gap >= 8 && boundary < divider.y).sort((a,b) => b-a);
  for (const boundary of candidates) {
    const top = boundary-gap-height, ranges = spaces(top);
    if (ranges.length) {
      const choices = ranges.map((r) => ({x:Math.max(r.left,Math.min(divider.x,r.right-width)), y:top, width, height}));
      choices.sort((a,b) => Math.abs(a.x-divider.x)-Math.abs(b.x-divider.x));
      return [choices[0]];
    }
    const above = compactAt(boundary);
    if (above.length) return above;
  }
  return [];
}
