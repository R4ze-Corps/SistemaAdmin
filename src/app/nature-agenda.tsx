"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Search, MapPin, Leaf, BedDouble, CalendarDays, ChevronLeft, ChevronRight, DoorClosed, DoorOpen, House, Users } from "lucide-react";
import { Glass } from "@/components/ui/glass";
import { GlassDatePicker } from "./glass-calendar";
import "./nature-agenda.css";

type Stay = {
  id: string; cabinId: string; guestName: string; people: number;
  start: string; end: string; checkIn: string; checkOut: string; status: string;
};
type Props = {
  today: string; cabins: {id: string; name: string}[]; bookings: Stay[];
  ready: boolean; onReserve: (id: string, start: string, end: string, people: number) => void; onBack: () => void; onCalendar: (day: string) => void;
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

export default function ChaletAgenda({today, cabins, bookings, ready, onReserve, onBack, onCalendar}: Props) {
  const [day, setDay] = useState(today);
  const tomorrow = new Date(today + "T12:00:00Z");
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const [arrival, setArrival] = useState(today);
  const [leaving, setLeaving] = useState(tomorrow.toISOString().slice(0,10));
  const [choice, setChoice] = useState("");
  const [guests, setGuests] = useState(2);
  const [searched, setSearched] = useState(false);
  const valid = arrival >= today && leaving > arrival && Number.isInteger(guests) && guests >= 1;
  const options = [{key:"manaca",name:"Chalé Manacá"}, {key:"ipe",name:"Chalé Ipê"}];
  const nights = valid ? Math.round((Date.parse(leaving)-Date.parse(arrival))/86400000) : 0;
  const arrivals = bookings.filter(b => b.start === day).sort((a,b) => a.checkIn.localeCompare(b.checkIn));
  const departures = bookings.filter(b => b.end === day).sort((a,b) => a.checkOut.localeCompare(b.checkOut));
  const occupied = bookings.filter(b => b.start <= day && day < b.end);
  function moveDay(offset: number) {
    const date = new Date(day + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + offset);
    setDay(date.toISOString().slice(0,10));
  }
  return <main className="chalet-agenda">
    <section id="estadia" className="escape-hero">
      <Glass as="header" className="escape-nav-lens" contentClassName="escape-nav" radius={24} strength={0.5} blur={4} tint={0.45} tintColor="255,252,244" dome={0.1}><a href="#estadia"><House/> Matto Chalés</a><nav><a href="#chalés">Chalés</a><a href="#disponibilidade">Disponibilidade</a><a href="#agenda">Agenda</a></nav><button onClick={onBack}><ArrowLeft size={17}/> Painel</button></Glass>
    <div className="escape-copy"><small>HOSPEDAGEM EM CHALÉS</small><h1>Encontre seu<br/><em>refúgio.</em></h1><p>Escolha entre o Manacá e o Ipê para sua próxima estadia.</p><a href="#chalés">Explorar chalés <ArrowRight size={17}/></a></div>
      <form id="disponibilidade" className="escape-search" onSubmit={e => {e.preventDefault(); setSearched(true); if(valid) document.getElementById("chalés")?.scrollIntoView({block:"start"});}}>
        <label><span><MapPin/> Onde ficar</span><select value={choice} onChange={e=>setChoice(e.target.value)}><option value="">Todos os chalés</option>{options.map(o=><option key={o.key} value={o.key}>{o.name}</option>)}</select></label>
        <div><span><CalendarDays/> Entrada</span><GlassDatePicker label="Entrada" value={arrival} onChange={setArrival}/></div>
        <div><span><CalendarDays/> Saída</span><GlassDatePicker label="Saída" value={leaving} onChange={setLeaving}/></div>
        <label><span><Users/> Hóspedes</span><input aria-label="Quantidade de hóspedes" type="number" required min="1" step="1" value={guests || ""} onChange={e=>setGuests(Number(e.target.value))}/></label>
        <button><Search size={17}/> Buscar</button>
      </form>{searched && !valid && <p className="escape-error" role="alert">Escolha uma entrada a partir de hoje e uma saída posterior.</p>}
    </section>
    <div className="escape-ribbon"><span><House/> Dois chalés</span><span><BedDouble/> Aluguel por diária</span><span><CalendarDays/> Agenda de reservas</span></div>
    <section className="escape-units" id="chalés"><header><h2>Nossos chalés <Leaf size={20}/></h2><a href="#agenda">Ver agenda <ArrowRight size={15}/></a></header>
      <div>{options.filter(o=>!choice || o.key===choice).map(o=>{
        const unit = cabins.find(c=>c.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().split(/\W+/).includes(o.key));
        const available = ready && unit && valid && !bookings.some(b=>b.cabinId===unit.id && b.start<leaving && arrival<b.end);
        return <article key={o.key} style={{backgroundImage:"linear-gradient(0deg,#0c241fef,transparent 80%),url(/assets/estadia-"+o.key+".webp)"}}>
          <small>ALUGUEL POR DIÁRIA</small><h3>{o.name}</h3><p>{!ready ? "Carregando agenda…" : !unit ? "Unidade sem vínculo na agenda" : !valid ? "Selecione um período válido" : available ? "Disponível · "+nights+(nights===1?" diária":" diárias") : "Ocupado neste período"}</p>
          <button disabled={!available} onClick={()=>unit && available && onReserve(unit.id,arrival,leaving,guests)}>Reservar <ArrowRight size={16}/></button>
        </article>;
      })}</div>
    </section>
    <section className="chalet-content" id="agenda" aria-label="Agenda por data">
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
    <footer className="escape-footer"><House/> Matto Chalés <button onClick={() => onCalendar(day)}>Abrir painel de reservas</button></footer>
  </main>;
}
