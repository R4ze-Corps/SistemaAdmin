"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { GlassSurface } from "@/components/ui/glass";

export type GlassSelectOption = { value: string; label: string };

export default function GlassSelectMenu({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  triggerClassName = "",
}: {
  value: string;
  options: GlassSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  triggerClassName?: string;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const listboxId = `glass-select-${useId().replace(/:/g, "")}`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, options.findIndex(option => option.value === value)));
  const [position, setPosition] = useState({ left: 8, top: 8, width: 220, maxHeight: 240 });
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const selected = options.find(option => option.value === value);

  const place = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(rect.width, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const top = rect.bottom + 2;
    const maxHeight = Math.max(40, Math.min(240, window.innerHeight - top - 8));
    setPosition({ left, top, width, maxHeight });
  }, []);

  useEffect(() => { setPortal(open ? trigger.current?.closest("dialog") ?? document.body : null); }, [open]);
  useEffect(() => {
    if (!open || !portal) return;
    const schedulePlace = () => requestAnimationFrame(place);
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    schedulePlace();
    requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>(`[data-option-index="${activeIndex}"]`)?.focus());
    window.addEventListener("resize", schedulePlace);
    window.addEventListener("scroll", schedulePlace, true);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("resize", schedulePlace);
      window.removeEventListener("scroll", schedulePlace, true);
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open, portal, place, activeIndex]);

  const openMenu = () => {
    if (disabled) return;
    const selectedIndex = options.findIndex(option => option.value === value);
    setActiveIndex(Math.max(0, selectedIndex));
    place();
    setOpen(true);
  };
  const choose = (option: GlassSelectOption) => {
    onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  };
  const onListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!options.length) return;
    let next = activeIndex;
    if (event.key === "ArrowDown") next = (activeIndex + 1) % options.length;
    else if (event.key === "ArrowUp") next = (activeIndex - 1 + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else return;
    event.preventDefault();
    setActiveIndex(next);
    requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>(`[data-option-index="${next}"]`)?.focus());
  };

  return <>
    <button ref={trigger} type="button" role="combobox" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={listboxId} aria-disabled={disabled || undefined} disabled={disabled} onClick={open ? () => setOpen(false) : openMenu} onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") { event.preventDefault(); openMenu(); } }} className={`glass-select-trigger flex h-10 w-full items-center justify-between rounded-xl border border-white/20 bg-[rgba(32,58,65,.38)] px-3 text-left text-xs text-[#f4fafb] shadow-[inset_0_1px_0_rgba(255,255,255,.12)] outline-none backdrop-blur-xl backdrop-saturate-150 transition hover:bg-[rgba(45,77,84,.5)] focus-visible:ring-2 focus-visible:ring-cyan-200/40 disabled:cursor-not-allowed disabled:opacity-50 ${triggerClassName}`}>
      <span className="truncate">{selected?.label ?? "Selecione uma opção"}</span><ChevronDown size={15} className="ml-2 shrink-0 text-white/70" aria-hidden="true" />
    </button>
    {open && portal ? createPortal(<GlassSurface ref={panel} id={listboxId} role="listbox" aria-label={ariaLabel} onKeyDown={onListKeyDown} className="glass-select-popup fixed z-[100] overflow-hidden border border-white/20 text-[#f4fafb] shadow-[0_18px_50px_rgba(0,0,0,.35)]" contentClassName="max-h-[min(15rem,calc(100vh-16px))] overflow-y-auto p-1.5" style={{ position: "fixed", zIndex: 100, left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight }} tint={0.24} blur={18} saturation={1.65} radius={12} specular>
      {options.map((option, index) => {
        const isSelected = option.value === value;
        const isActive = index === activeIndex;
        return <button key={option.value} type="button" role="option" aria-selected={isSelected} data-option-index={index} tabIndex={isActive ? 0 : -1} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(option)} className={`flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-xs transition ${isSelected ? "bg-cyan-100/15 text-[#c7f3e7] ring-1 ring-inset ring-cyan-100/15" : isActive ? "bg-white/12 text-white" : "text-white/90 hover:bg-white/10"}`}>
          <span className="truncate">{option.label}</span>{isSelected && <Check size={14} className="shrink-0 text-[#8fcaa7]" aria-hidden="true" />}
        </button>;
      })}
    </GlassSurface>, portal) : null}
  </>;
}
