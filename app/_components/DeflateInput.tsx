"use client";

import { useState } from "react";
import { setDeduction, getDeduction } from "./deflateStore";

// Compact "deduct N minutes" control shown on a commit or journal row. Feeds the
// shared store, which the review form reads to lower the credited hours.
export function DeflateInput({ itemKey, maxMinutes }: { itemKey: string; maxMinutes?: number }) {
  const [min, setMin] = useState(getDeduction(itemKey));
  return (
    <label
      className={`flex items-center gap-1 shrink-0 text-xs ${min > 0 ? "text-rose-600 dark:text-rose-400 font-medium" : "text-ink/40"}`}
      title="Deduct this many minutes from the credited hours"
      onClick={(e) => e.stopPropagation()}
    >
      −
      <input
        type="number"
        min="0"
        max={maxMinutes}
        step="5"
        value={min || ""}
        placeholder="0"
        onChange={(e) => {
          let v = Math.max(0, Math.round(Number(e.target.value) || 0));
          if (maxMinutes !== undefined) v = Math.min(v, maxMinutes);
          setMin(v);
          setDeduction(itemKey, v);
        }}
        className="pixl-input w-14 text-xs py-0.5 px-1.5 text-right"
      />
      min
    </label>
  );
}
