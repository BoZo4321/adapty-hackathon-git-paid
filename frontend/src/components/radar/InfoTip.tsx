// "?" icon with a hover/focus explanation. align="left" opens the tooltip to the right of the icon.
import type { ReactNode } from "react";

export default function InfoTip({ children, align = "right" }: { children: ReactNode; align?: "left" | "right" }) {
  return (
    <span className="radar-info" tabIndex={0} aria-label="What is this?">
      ?
      <span className={`radar-info-tip${align === "left" ? " radar-info-tip-left" : ""}`}>{children}</span>
    </span>
  );
}
