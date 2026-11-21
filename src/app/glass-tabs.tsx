"use client";

import { useLayoutEffect, useRef, useState } from "react";

export type GlassTabOption<T extends string> = { value: T; label: string; icon: React.ReactNode };

/** Compact glass tab rail with a shared, spring-like indicator. */
export default function GlassTabs<T extends string>({
  value,
  onValueChange,
  options,
  label = "Seções do painel",
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: GlassTabOption<T>[];
  label?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef(new Map<T, HTMLButtonElement>());
  const [indicator, setIndicator] = useState({ x: 0, width: 0, ready: false });

  useLayoutEffect(() => {
    const measure = () => {
      const list = listRef.current;
      const active = triggerRefs.current.get(value);
      if (!list || !active) return;
      const listRect = list.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      setIndicator({ x: activeRect.left - listRect.left, width: activeRect.width, ready: true });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (listRef.current) observer.observe(listRef.current);
    return () => observer.disconnect();
  }, [value, options.length]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = options.findIndex(option => option.value === value);
    const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
    const option = options[next];
    if (option) {
      onValueChange(option.value);
      triggerRefs.current.get(option.value)?.focus();
    }
  }

  return <div className="glass-tabs" role="tablist" aria-label={label} onKeyDown={handleKeyDown}>
    <span aria-hidden="true" className={`glass-tabs-indicator ${indicator.ready ? "is-ready" : ""}`} style={{ width: indicator.width, transform: `translateX(${indicator.x}px)` }} />
    <div className="glass-tabs-list" ref={listRef}>
      {options.map(option => <button
        key={option.value}
        ref={node => { if (node) triggerRefs.current.set(option.value, node); else triggerRefs.current.delete(option.value); }}
        type="button"
        role="tab"
        aria-selected={value === option.value}
        tabIndex={value === option.value ? 0 : -1}
        className="glass-tabs-trigger"
        onClick={() => onValueChange(option.value)}
      >{option.icon}<span>{option.label}</span></button>)}
    </div>
  </div>;
}
