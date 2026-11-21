"use client";

import { type ButtonHTMLAttributes, type PointerEvent, type ReactNode, useRef } from "react";

type GlassSwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onChange" | "children"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel: string;
  children?: ReactNode;
};

/** Compact, accessible liquid-glass toggle with a controlled value. */
export default function GlassSwitch({ checked, onCheckedChange, ariaLabel, children, className = "", ...props }: GlassSwitchProps) {
  const drag = useRef<{ startX: number; startPosition: number; moved: boolean } | null>(null);
  const skipClick = useRef(false);

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startPosition: checked ? 24 : 0, moved: false };
  }
  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current) return;
    const delta = event.clientX - current.startX;
    if (Math.abs(delta) > 3) current.moved = true;
    if (!current.moved) return;
    const position = Math.max(-8, Math.min(32, current.startPosition + delta));
    event.currentTarget.style.setProperty("--switch-drag-x", `${position - current.startPosition}px`);
  }
  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    event.currentTarget.style.removeProperty("--switch-drag-x");
    if (!current.moved) return;
    skipClick.current = true;
    const finalPosition = Math.max(-8, Math.min(32, current.startPosition + event.clientX - current.startX));
    onCheckedChange(finalPosition >= 14);
  }
  function onPointerCancel(event: PointerEvent<HTMLButtonElement>) {
    drag.current = null;
    event.currentTarget.style.removeProperty("--switch-drag-x");
  }

  return <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    className={`glass-switch ${className}`.trim()}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={onPointerCancel}
    onClick={() => { if (skipClick.current) { skipClick.current = false; return; } onCheckedChange(!checked); }}
    {...props}
  >
    {children}
    <span className="glass-switch-track" aria-hidden="true"><span className="glass-switch-thumb"><span className="glass-switch-thumb-solid" /><span className="glass-switch-thumb-lens" /></span></span>
  </button>;
}
