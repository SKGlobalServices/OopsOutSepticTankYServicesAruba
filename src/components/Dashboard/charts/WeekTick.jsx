import React from 'react'

export const WeekTick = ({x, y, payload}) => {
  const raw = payload?.value || "";
    const hasRange = raw.includes("|");
    const [weekText, rangeText] = hasRange ? raw.split("|") : [raw, ""];
  return (
    <g transform={`translate(${x},${y}) rotate(-45)`}>
        <text dy={8} textAnchor="end" fill="#334155" fontSize={10}>
          <tspan x={0} dy={0}>{weekText}</tspan>
          {hasRange ? (
            <tspan x={0} dy={14} fill="#64748b" fontSize={11}>{rangeText}</tspan>
          ) : null}
        </text>
      </g>
  )
}
