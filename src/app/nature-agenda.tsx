"use client";

import { useState } from "react";
import { ArrowLeft, BedDouble, CalendarDays, ChevronLeft, ChevronRight, DoorClosed, DoorOpen, House, Users } from "lucide-react";
import { GlassDatePicker } from "./glass-calendar";
import "./nature-agenda.css";

type Stay = {
  id: string; cabinId: string; guestName: string; people: number;
  start: string; end: string; checkIn: string; checkOut: string; status: string;
};
type Props = {
  today: string; cabins: {id: string; name: string}[]; bookings: Stay[];
  onBack: () => void; onCalendar: (day: string) => void;
};
const formatDay = (day: string) => new Date(day + "T12:00:00").toLocaleDateString("pt-BR", {weekday:"long", day:"numeric", month:"long"});

function ReservationMonth({ day, today, bookings, select }: {
  day: string; today: string; bookings: Stay[]; select: (day: string) => void;
}) {
  const [year, month] = day.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthLabel = monthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  function changeMonth(offset: number) {
    select(new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 10));
  }
  return <section className="stay-month" aria-label="Calendário mensal de reservas">
    <header><h2>{monthLabel}</h2><div><button onClick={() => select(today)}>Hoje</button>
      <button aria-label="Mês anterior" onClick={() => changeMonth(-1)}><ChevronLeft/></button>
      <button aria-label="Próximo mês" onClick={() => changeMonth(1)}><ChevronRight/></button></div></header>
    <div className="stay-days">
      {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d => <small key={d}>{d}</small>)}
      {Array.from({length: monthStart.getUTCDay()}, (_, i) => <span key={"blank"+i}/>)}
      {Array.from({length: days}, (_, i) => {
        const date = day.slice(0,8) + String(i+1).padStart(2,"0");
        const count = bookings.filter(b => b.start <= date && date <= b.end).length;
        const label = count === 1 ? "1 reserva" : count + " reservas";
        return <button key={date} onClick={() => select(date)} aria-pressed={day === date}
          aria-current={date === today ? "date" : undefined} aria-label={formatDay(date) + ", " + label}>
          <strong>{i+1}</strong>{count > 0 && <span>{count}<i>{count === 1 ? " reserva" : " reservas"}</i></span>}
        </button>;
      })}
    </div>
  </section>;
}

export default function ChaletAgenda({today, cabins, bookings, onBack, onCalendar}: Props) {
  const [day, setDay] = useState(today);
  const arrivals = bookings.filter(b => b.start === day).sort((a,b) => a.checkIn.localeCompare(b.checkIn));
  const departures = bookings.filter(b => b.end === day).sort((a,b) => a.checkOut.localeCompare(b.checkOut));
  const occupied = bookings.filter(b => b.start <= day && day < b.end);
  function moveDay(offset: number) {
    const date = new Date(day + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + offset);
    setDay(date.toISOString().slice(0,10));
  }
  return <main className="chalet-agenda">
    <header className="chalet-top"><strong><House/> Matto Chalés</strong><button onClick={onBack}><ArrowLeft/> Voltar ao painel</button></header>
    <section className="chalet-banner"><div><p>HOSPEDAGEM</p><h1>Agenda dos chalés</h1><span>Entradas, saídas e estadias em um só lugar.</span><button onClick={() => onCalendar(day)}><CalendarDays/> Ver calendário de reservas</button></div></section>
    <section className="chalet-content" aria-label="Agenda por data">
      <ReservationMonth day={day} today={today} bookings={bookings} select={setDay}/>
      <header className="chalet-date"><div><small>{day === today ? "HOJE" : "DIA SELECIONADO"}</small><h2>{formatDay(day)}</h2></div>
        <div className="chalet-picker"><button aria-label="Dia anterior" onClick={() => moveDay(-1)}><ChevronLeft/></button><GlassDatePicker label="Escolher data" value={day} onChange={value => setDay(value || today)}/><button aria-label="Próximo dia" onClick={() => moveDay(1)}><ChevronRight/></button></div>
      </header>
      <div className="chalet-columns">{[
        {title:"Entradas", icon:DoorOpen, list:arrivals, time:(b:Stay) => b.checkIn, empty:"Nenhuma entrada prevista."},
        {title:"Saídas", icon:DoorClosed, list:departures, time:(b:Stay) => b.checkOut, empty:"Nenhuma saída prevista."},
        {title:"Estadias", icon:BedDouble, list:occupied, time:(b:Stay) => b.status, empty:"Nenhuma estadia nesta noite."}
      ].map(group => <section className="chalet-list" key={group.title}><header><group.icon/><h3>{group.title}</h3><b>{group.list.length}</b></header>
        {group.list.length === 0 ? <p>{group.empty}</p> : <ul>{group.list.map(b => <li key={b.id}><strong>{b.guestName}</strong><span>{group.time(b)}</span><small>{cabins.find(c => c.id === b.cabinId)?.name || "Chalé"} · <Users size={13}/> {b.people}</small></li>)}</ul>}
      </section>)}</div>
    </section>
  </main>;
}
