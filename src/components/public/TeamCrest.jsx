import React from "react";

// Renders a team's uploaded logo, or an auto colour monogram (initials on a
// team-derived colour) when no logo is set — so preloaded teams look intentional.
const HUES = [15, 200, 160, 265, 330, 45, 120, 190, 30, 350, 220, 90, 0, 240, 60];

export function teamInitials(name, short) {
  const src = String(short || name || "?").trim();
  const words = src.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function teamHue(name) {
  const seed = [...String(name || "")].reduce((t, c) => t + c.charCodeAt(0), 0);
  return HUES[seed % HUES.length];
}

export default function TeamCrest({ name, short, logo, className = "h-16 w-16" }) {
  if (logo) {
    // Transparent container so transparent-PNG crests blend with the page.
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <img src={logo} alt={name} className="h-full w-full object-contain" />
      </div>
    );
  }
  const hue = teamHue(name);
  return (
    <div
      className={`flex items-center justify-center font-display uppercase tracking-tight text-white ${className}`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 70%, 42%), hsl(${(hue + 25) % 360}, 65%, 28%))`,
        border: `1px solid hsl(${hue}, 70%, 55%, 0.4)`,
      }}
      title={name}
    >
      {teamInitials(name, short)}
    </div>
  );
}
