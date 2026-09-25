import type { ReactNode } from "react";

/** A rubber-stamp label: format tags, "Tonight", "Sold out". */
export function Stamp({ children, tone = "ink" }: { children: ReactNode; tone?: "ink" | "red" }) {
  return <em className={`stamp ${tone}`}>{children}</em>;
}
