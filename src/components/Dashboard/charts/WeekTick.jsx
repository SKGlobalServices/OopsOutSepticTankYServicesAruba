import React from "react";

// A more robust tick renderer for week labels that handles mobile sizing
// and prevents clipping when rotated. Expects payload.value like "Semana X|DD MMM - DD MMM"
export const WeekTick = ({
  x,
  y,
  payload,
  index,
  visibleTicks,
  rotate = -90,
}) => {
  const raw = (payload && (payload.value ?? payload)) || "";
  const hasRange = typeof raw === "string" && raw.includes("|");
  const [weekText, rangeText] = hasRange ? raw.split("|") : [raw, ""];

  // Determine sizing based on window width (defensive: check typeof window)
  const isBrowser = typeof window !== "undefined";
  const width = isBrowser ? window.innerWidth : 1024;
  const isSmallMobile = width <= 480;
  const isMobile = width <= 768;

  const weekFont = isSmallMobile ? 11 : isMobile ? 12 : 10;
  const rangeFont = isSmallMobile ? 10 : isMobile ? 11 : 9;

  // If mobile and too many ticks, skip some labels to avoid overlap.
  if (
    isSmallMobile &&
    typeof index === "number" &&
    visibleTicks &&
    visibleTicks > 0
  ) {
    const showEvery = Math.max(1, Math.round(visibleTicks / 6));
    if (index % showEvery !== 0) return null;
  }

  // Use a small background rect to improve readability on busy charts
  // We'll render the text group translated so rotation doesn't clip.
  const groupTransform = `translate(${x}, ${y}) rotate(${rotate})`;

  return (
    <g transform={groupTransform}>
      <rect
        x={-6}
        y={-18}
        rx={4}
        ry={4}
        width={Math.max(40, weekText.length * (weekFont * 0.6))}
        height={hasRange ? 34 : 20}
        fill="rgba(255,255,255,0.9)"
      />
      <text
        dy={6}
        textAnchor="end"
        fill="#334155"
        fontSize={weekFont}
        fontWeight={600}
      >
        <tspan x={0} dy={0}>
          {weekText}
        </tspan>
        {hasRange ? (
          <tspan
            x={0}
            dy={14}
            fill="#64748b"
            fontSize={rangeFont}
            fontWeight={400}
          >
            {rangeText}
          </tspan>
        ) : null}
      </text>
    </g>
  );
};
