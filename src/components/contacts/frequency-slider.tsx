"use client";

import { useState } from "react";

const FREQUENCY_STOPS = [1, 7, 14, 30, 60, 90];
const FREQUENCY_LABELS: Record<number, string> = {
  1: "Daily",
  7: "Weekly",
  14: "Bi-weekly",
  30: "Monthly",
  60: "Bi-monthly",
  90: "Quarterly",
};

interface FrequencySliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function FrequencySlider({ value, onChange }: FrequencySliderProps) {
  const [current, setCurrent] = useState(value);

  const closestStop =
    FREQUENCY_STOPS.reduce((prev, curr) =>
      Math.abs(curr - current) < Math.abs(prev - current) ? curr : prev
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Contact Frequency</label>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          Every {current} days ({FREQUENCY_LABELS[closestStop] || `${current}d`})
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={90}
        step={1}
        value={current}
        onChange={(e) => {
          const val = parseInt(e.target.value);
          setCurrent(val);
          onChange(val);
        }}
        className="w-full accent-primary"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        {FREQUENCY_STOPS.map((stop) => (
          <button
            key={stop}
            type="button"
            onClick={() => {
              setCurrent(stop);
              onChange(stop);
            }}
            className={`rounded px-1.5 py-0.5 transition-colors hover:bg-accent ${
              current === stop ? "bg-accent font-medium text-foreground" : ""
            }`}
          >
            {FREQUENCY_LABELS[stop]}
          </button>
        ))}
      </div>
    </div>
  );
}
