import { PALETTE } from "./palette.js";

export const COLOR_LABEL_LIMIT = 32;
const hexColor = /^#[\da-f]{6}$/i;
export function validColorLegend(legend) {
  return Boolean(legend && typeof legend === "object" && !Array.isArray(legend) &&
    Object.entries(legend).every(([key, entry]) => Object.hasOwn(PALETTE, key) && entry &&
      typeof entry === "object" && !Array.isArray(entry) &&
      Object.keys(entry).every((field) => ["color", "label"].includes(field)) &&
      typeof entry.color === "string" && hexColor.test(entry.color) &&
      typeof entry.label === "string" && entry.label.length <= COLOR_LABEL_LIMIT));
}
function shade(color) {
  return `#${color.slice(1).match(/../g).map((channel) => Math.round(parseInt(channel, 16) * .7).toString(16).padStart(2, "0")).join("")}`;
}
export function projectPalette(project) {
  return Object.fromEntries(Object.entries(PALETTE).map(([key, base]) => {
    const entry = project?.colorLegend?.[key];
    const fill = entry?.color ?? base.fill;
    const label = entry?.label.trim() ?? "";
    return [key, { ...base, fill, shade: fill === base.fill ? base.shade : shade(fill), label, name: label || base.name }];
  }));
}

export function blockTextColor(fill) {
  const rgb = fill.slice(1).match(/../g).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  const luminance = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  if (luminance >= .3) return "#332b27";
  return luminance < .179 ? "#ffffff" : "#000000";
}
