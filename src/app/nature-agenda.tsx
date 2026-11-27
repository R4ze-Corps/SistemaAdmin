"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Leaf, BedDouble, CalendarDays, ChevronLeft, ChevronRight, House } from "lucide-react";
import { Glass } from "@/components/ui/glass";

import "./nature-agenda.css";

type Stay = {
  id: string; cabinId: string; guestName: string; people: number;
  start: string; end: string; checkIn: string; checkOut: string; status: string;
};
type Props = {
  today: string; cabins: {id: string; name: string}[]; bookings: Stay[];
  ready: boolean; onBack: () => void;
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
        const count = bookings.filter(b => b.start <= date && date < b.end).length;
        const label = count === 1 ? "1 reserva" : count + " reservas";
        return <button key={date} onClick={() => select(date)} aria-pressed={day === date}
          aria-current={date === today ? "date" : undefined} aria-label={formatDay(date) + ", " + label}>
          <strong>{i+1}</strong>{count > 0 && <span>{count}<i>{count === 1 ? " reserva" : " reservas"}</i></span>}
        </button>;
      })}
    </div>
  </section>;
}

const chalets = [
  { key: "manaca", name: "Chalé Manacá", gallery: ["/assets/estadia-manaca.webp", "/nature/canopy.jpg", "/nature/lake.jpg"] },
  { key: "ipe", name: "Chalé Ipê", gallery: ["/assets/estadia-ipe.webp", "/nature/lake.jpg", "/nature/waterfall.jpg"] },
];

export default function ChaletAgenda({today, cabins, bookings, ready, onBack}: Props) {
  const [day, setDay] = useState(today);
  const [selected, setSelected] = useState<typeof chalets[number] | null>(null);
  const [photo, setPhoto] = useState(0);
  const unit = selected && cabins.find(c => c.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().split(/\W+/).includes(selected.key));
  const stays = selected ? bookings.filter(b => b.cabinId === unit?.id) : bookings;
  const occupied = stays.some(b => b.start <= day && day < b.end);

  function showChalet(next: typeof selected) {
    setSelected(next);
    setPhoto(0);
    window.scrollTo(0, 0);
  }
  return <main className="chalet-agenda">
    <Glass as="header" className="escape-nav-lens" contentClassName="escape-nav" radius={24} strength={0.5} blur={4} tint={0.45} tintColor="255,252,244" dome={0.1}>
      <button className="stay-brand" onClick={onBack} aria-label="Matto Chalés — voltar à tela inicial"><House/> Matto Chalés</button>
      <nav aria-label="Navegação dos chalés">
        {selected ? <button onClick={() => showChalet(null)}><ArrowLeft size={15}/> Chalés</button> : <a href="#chales">Chalés</a>}
        <a href="#agenda">{selected ? "Disponibilidade" : "Agenda"}</a>
      </nav>
    </Glass>
    {selected ? <section className="stay-detail" key={selected.key}>
      <small>HOSPEDAGEM POR DIÁRIA</small><h1>{selected.name}</h1>
      <p>Consulte as noites disponíveis no {selected.name} para planejar sua estadia.</p>
      <figure><img src={selected.gallery[photo]} alt={photo === 0 ? "Representação ilustrativa do " + selected.name : "Paisagem ilustrativa da galeria"}/>
        <figcaption>Galeria ilustrativa · {photo+1} de {selected.gallery.length}</figcaption></figure>
      <div className="stay-thumbs">{selected.gallery.map((src,i) => <button key={src} onClick={() => setPhoto(i)} aria-label={"Ver imagem "+(i+1)} aria-pressed={photo===i}><img src={src} alt=""/></button>)}</div>
    </section> : <>
      <section id="estadia" className="escape-hero"><div className="escape-copy"><small>HOSPEDAGEM EM CHALÉS</small><h1>Encontre seu<br/><em>refúgio.</em></h1><p>Escolha entre o Manacá e o Ipê para sua próxima estadia.</p><a href="#chales">Explorar chalés <ArrowRight size={17}/></a></div></section>
      <div className="escape-ribbon"><span><House/> Dois chalés</span><span><BedDouble/> Aluguel por diária</span><span><CalendarDays/> Agenda de reservas</span></div>
      <section className="escape-units" id="chales"><header><h2>Nossos chalés <Leaf size={20}/></h2><a href="#agenda">Ver agenda <ArrowRight size={15}/></a></header>
        <div>{chalets.map(c => <article key={c.key} style={{backgroundImage:"linear-gradient(0deg,#0c241fef,transparent 80%),url("+c.gallery[0]+")"}}>
          <small>ALUGUEL POR DIÁRIA</small><h3>{c.name}</h3>
          <button onClick={() => showChalet(c)} aria-label={"Mais detalhes sobre o "+c.name}>Mais Detalhes <ArrowRight size={16}/></button>
        </article>)}</div>
      </section>
    </>}
    <section className="chalet-content" id="agenda" aria-label="Disponibilidade por data">
      {ready && (!selected || unit) ? <>
        <ReservationMonth day={day} today={today} bookings={stays} select={setDay}/>
        {selected && <p aria-live="polite">{formatDay(day)} · {occupied ? "Noite ocupada" : "Noite disponível"}</p>}
      </> : <p>{ready ? "Este chalé ainda não está vinculado à agenda de reservas." : "Carregando agenda…"}</p>}
    </section>
  </main>;
}