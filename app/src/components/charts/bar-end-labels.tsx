"use client";

import { motion } from "motion/react";
import { createPortal } from "react-dom";
import { useChart, useChartPortalContainer, useChartStable } from "./chart-context";

export interface BarEndLabelsProps {
  /** Key in data whose value is shown at the right of each horizontal bar */
  valueKey: string;
  format?: (value: number) => string;
}

/** Value column on the right margin of a horizontal bar chart, highlighted on hover. */
export function BarEndLabels(props: BarEndLabelsProps) {
  const { containerRef, barScale } = useChartStable();
  const container = useChartPortalContainer(containerRef);
  if (!(container && barScale)) return null;
  return <BarEndLabelsInner {...props} container={container} />;
}

function BarEndLabelsInner({ valueKey, format = String, container }: BarEndLabelsProps & { container: HTMLDivElement }) {
  const { margin, barScale, bandWidth, barXAccessor, data, hoveredBarIndex } = useChart();
  if (!(barScale && bandWidth && barXAccessor)) return null;
  return createPortal(
    <div className="pointer-events-none absolute top-0 bottom-0" style={{ right: 0, width: margin.right }}>
      {data.map((d, i) => (
        <div key={barXAccessor(d)} className="absolute right-0 left-0 flex items-center justify-end" style={{ top: (barScale(barXAccessor(d)) ?? 0) + margin.top, height: bandWidth }}>
          <motion.span
            animate={{ opacity: hoveredBarIndex == null || hoveredBarIndex === i ? 1 : 0.45 }}
            className="text-sm font-semibold tabular-nums"
            style={{ color: "var(--foreground)" }}
            transition={{ duration: 0.15 }}
          >
            {format(Number(d[valueKey]))}
          </motion.span>
        </div>
      ))}
    </div>,
    container,
  );
}

BarEndLabels.displayName = "BarEndLabels";

export default BarEndLabels;
