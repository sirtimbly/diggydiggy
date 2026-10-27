import { projectPalette } from "../project/color-legend.js";
import { Icon } from "./Icon.jsx";

export function BlockColorPicker({ color, onChange, project }) {
  const palette = projectPalette(project);
  const named = Object.values(palette).some((entry) => entry.label);
  return (
    <fieldset className="block-color-picker">
      <legend>Block color</legend>
      <div className={`block-color-options${named ? " has-labels" : ""}`}>
        {Object.entries(palette).map(([key, value]) => (
          <button
            key={key}
            type="button"
            className="block-color-option"
            data-color={key}
            style={{ "--color-fill": value.fill, "--color-border": value.shade }}
            aria-label={value.name}
            aria-pressed={key === color}
            title={`${value.name}${key === color ? " (selected)" : ""}`}
            onClick={() => onChange(key)}
          >
            {key === color && <Icon name="check" />}
            <span>{value.name}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
