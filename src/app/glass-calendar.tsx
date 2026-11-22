"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import { DayPicker, type DayButtonProps, type Modifiers } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import { createPortal } from "react-dom";

const toISO = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fromISO = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

type DayContent = (date: Date, modifiers: Modifiers) => ReactNode;

export function GlassCalendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  dayContent,
  schedule = false,
  hideNavigation = false,
}: {
  month: Date;
  onMonthChange: (month: Date) => void;
  selected?: Date;
  onSelect: (date: Date) => void;
  dayContent?: DayContent;
  schedule?: boolean;
  hideNavigation?: boolean;
}) {
  const GlassDayButton = (props: DayButtonProps) => {
    const { day, modifiers, className, ...buttonProps } = props;
    const date = day.date;
    const classNames = ["glass-calendar-day-button", schedule && "glass-calendar-schedule-day", className].filter(Boolean).join(" ");
    return (
      <button
        {...buttonProps}
        type="button"
        className={classNames}
        data-calendar-column={date.getDay()}
        data-selected-single={modifiers.selected || undefined}
        data-today={modifiers.today || undefined}
      >
        {dayContent ? dayContent(date, modifiers) : date.getDate()}
      </button>
    );
  };

  return <div className={`glass-calendar ${schedule ? "glass-calendar-schedule" : ""}`}>
    <DayPicker
      mode="single"
      month={month}
      onMonthChange={onMonthChange}
      selected={selected}
      onSelect={date => { if (date) onSelect(date); }}
      locale={ptBR}
      weekStartsOn={0}
      showOutsideDays
      fixedWeeks
      hideNavigation={hideNavigation}
      captionLayout="label"
      classNames={{
        root: "glass-calendar-root",
        months: "glass-calendar-months",
        month: "glass-calendar-month",
        month_caption: "glass-calendar-caption",
        caption_label: "glass-calendar-caption-label",
        nav: "glass-calendar-nav",
        button_previous: "glass-calendar-nav-button glass-calendar-previous",
        button_next: "glass-calendar-nav-button glass-calendar-next",
        month_grid: "glass-calendar-grid",
        weekdays: "glass-calendar-weekdays",
        weekday: "glass-calendar-weekday",
        week: "glass-calendar-week",
        day: "glass-calendar-day",
        day_button: "glass-calendar-day-button",
        outside: "glass-calendar-outside",
        today: "glass-calendar-today",
      }}
      components={{ DayButton: GlassDayButton }}
    />
  </div>;
}

function usePopoverPosition(trigger: React.RefObject<HTMLButtonElement | null>, panel: React.RefObject<HTMLDivElement | null>, width: number) {
  const [position, setPosition] = useState({ left: 8, top: 8, width });
  const place = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const actualWidth = Math.min(width, window.innerWidth - 16);
    const height = panel.current?.offsetHeight ?? 360;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - actualWidth - 8));
    const below = rect.bottom + 8;
    const top = below + height <= window.innerHeight - 8 ? below : Math.max(8, rect.top - height - 8);
    setPosition({ left, top, width: actualWidth });
  }, [trigger, panel, width]);
  return { position, place };
}

function usePopoverEvents(open: boolean, setOpen: (open: boolean) => void, trigger: React.RefObject<HTMLButtonElement | null>, panel: React.RefObject<HTMLDivElement | null>, place: () => void) {
  useEffect(() => {
    if (!open) return;
    const schedulePlace = () => requestAnimationFrame(place);
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    schedulePlace();
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
  }, [open, setOpen, trigger, panel, place]);
}

export function GlassDatePicker({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => value ? fromISO(value) : new Date());
  const { position, place } = usePopoverPosition(trigger, panel, 304);
  usePopoverEvents(open, setOpen, trigger, panel, place);
  const selected = value ? fromISO(value) : undefined;
  const displayValue = selected ? selected.toLocaleDateString("pt-BR") : "Selecionar data";

  return <>
    <button ref={trigger} type="button" className={`glass-calendar-trigger ${className}`} aria-label={`${label}: ${displayValue}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setMonth(value ? fromISO(value) : new Date()); place(); setOpen(current => !current); }}>
      <span>{displayValue}</span><CalendarDays size={16} aria-hidden="true" />
    </button>
    {open && createPortal(<div ref={panel} role="dialog" aria-label={`Calendário: ${label}`} className="glass-calendar-popover" style={{ left: position.left, top: position.top, width: position.width }}>
      <GlassCalendar month={month} onMonthChange={setMonth} selected={selected} onSelect={date => { onChange(toISO(date)); setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); setOpen(false); trigger.current?.focus(); }} />
    </div>, document.body)}
  </>;
}

export function GlassMonthPicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(value.slice(0, 4)) || new Date().getFullYear());
  const { position, place } = usePopoverPosition(trigger, panel, 296);
  usePopoverEvents(open, setOpen, trigger, panel, place);
  const [yearText, monthText] = value.split("-").map(Number);
  const displayValue = value ? new Date(yearText, monthText - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "Selecionar mês";
  const monthNames = Array.from({ length: 12 }, (_, index) => new Date(year, index, 1).toLocaleDateString("pt-BR", { month: "long" }));

  return <>
    <button ref={trigger} type="button" className="glass-calendar-trigger glass-month-trigger" aria-label={`${label}: ${displayValue}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setYear(Number(value.slice(0, 4)) || new Date().getFullYear()); place(); setOpen(current => !current); }}>
      <CalendarDays size={16} aria-hidden="true" /><span className="capitalize">{displayValue}</span>
    </button>
    {open && createPortal(<div ref={panel} role="dialog" aria-label={`Selecionar ${label}`} className="glass-calendar-popover glass-month-popover" style={{ left: position.left, top: position.top, width: position.width }}>
      <div className="glass-month-heading"><button type="button" aria-label="Ano anterior" onClick={() => setYear(current => current - 1)}>‹</button><strong>{year}</strong><button type="button" aria-label="Próximo ano" onClick={() => setYear(current => current + 1)}>›</button></div>
      <div className="glass-month-grid">{monthNames.map((name, index) => { const monthValue = `${year}-${String(index + 1).padStart(2, "0")}`; return <button key={monthValue} type="button" aria-pressed={value === monthValue} onClick={() => { onChange(monthValue); setOpen(false); trigger.current?.focus(); }}>{name}</button>; })}</div>
    </div>, document.body)}
  </>;
}
