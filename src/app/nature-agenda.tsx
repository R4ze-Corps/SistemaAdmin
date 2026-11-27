"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Compass, Footprints, Globe, Leaf, Mountain, Play, Sprout, Trees, Users, Waves, X } from "lucide-react";
import "./nature-agenda.css";

const projects = [
  { name: "Oceanos limpos", photo: "turtle", icon: Waves, text: "Cuidar do oceano começa na margem. Conheça práticas para reduzir resíduos e proteger a vida marinha." },
  { name: "Floresta viva", photo: "waterfall", icon: Trees, text: "Árvores nativas abrigam espécies, refrescam trilhas e protegem nascentes. Observe a mata sem retirar plantas ou sementes." },
  { name: "Comunidade em ação", photo: "community", icon: Users, text: "A conservação ganha força quando as pessoas compartilham o cuidado com os espaços que habitam." },
  { name: "Uso sustentável da terra", photo: "lake", icon: Sprout, text: "Solo, vegetação e água fazem parte do mesmo ciclo. Percorra caminhos marcados para preservar suas margens." },
  { name: "Ação climática", photo: "glacier", icon: Globe, text: "Das geleiras às florestas, mudanças de temperatura transformam paisagens e a disponibilidade de água." },
  { name: "Cultivar juntos", photo: "planting", icon: Leaf, text: "O plantio coletivo aproxima pessoas da terra. Priorize espécies nativas e acompanhe o crescimento das mudas." },
];
const photo = (name: string) => "/nature/" + name + ".jpg";

export default function NatureAgenda({ onBack, onCalendar }: { onBack: () => void; onCalendar: () => void }) {
  const [start, setStart] = useState(0);
  const [project, setProject] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  function explore(index: number) { setProject(index); dialog.current?.showModal(); }
  const current = projects[project];
  return <main className="nature-frame" lang="pt-BR">
    <article className="nature-paper">
      <section className="nature-hero" id="nature-start">
        <header className="nature-nav"><b><Mountain/> Matto Nature</b><nav><a href="#nature-start">Início</a><a href="#nature-mission">Nossa missão</a><a href="#nature-projects">Projetos</a></nav><button onClick={onBack}><ArrowLeft/> Voltar ao painel</button></header>
        <div className="nature-intro"><small><Sprout/> JUNTOS POR UM PLANETA MAIS VERDE</small>
          <h1>Salve a <em>natureza.</em><br/>Cuide do amanhã.</h1><p>Conecte-se com a terra, descubra iniciativas de conservação e planeje sua próxima experiência.</p>
          <button className="nature-primary" onClick={onCalendar}><CalendarDays/> Abrir agenda</button>
        </div>
        <div className="nature-floats">{[1,0,5].map(i => <button key={i} onClick={() => explore(i)}><img src={photo(projects[i].photo)} alt=""/><span>{projects[i].name}</span></button>)}</div>
        <button className="nature-play" onClick={() => explore(1)} aria-label="Conhecer Floresta viva"><Play/></button>
        <div className="nature-strip">{[[Trees,"Florestas"],[Waves,"Oceanos"],[Mountain,"Clima"],[Users,"Pessoas"]].map(([I,label],i) => { const Icon = I as typeof Trees; return <button key={i} onClick={() => explore([1,0,4,2][i])}><Icon/>{String(label)}</button>; })}</div>
      </section>
      <section className="nature-mission" id="nature-mission"><div><small><Leaf/> NOSSA MISSÃO</small><h2>Construir um mundo <em>mais verde,</em> limpo e forte.</h2><p>Educação e cuidado com o território aproximam pessoas e natureza.</p><a className="nature-primary" href="#nature-projects">Explorar projetos</a></div>
        {projects.slice(3).map((p,i) => <button className="nature-story" key={p.name} style={{backgroundImage: "linear-gradient(transparent 25%, #10231cdd),url("+photo(p.photo)+")"}} onClick={() => explore(i+3)}><p.icon/><strong>{p.name}</strong><span>Conhecer iniciativa</span></button>)}
      </section>
      <div className="nature-band"><Sprout/> Conservação <Footprints/> Turismo consciente <Leaf/> Biodiversidade <Compass/> Exploração</div>
      <section className="nature-projects" id="nature-projects"><header><small><Leaf/> NOSSAS INICIATIVAS</small><span>{[-1,1].map(d => <button key={d} aria-label={d<0?"Projeto anterior":"Próximo projeto"} onClick={() => setStart((start+d+projects.length)%projects.length)}>{d<0?<ChevronLeft/>:<ChevronRight/>}</button>)}</span></header><div className="nature-grid">
        {[0,1,2].map(offset => { const i=(start+offset)%projects.length, p=projects[i]; return <button className="nature-tile" key={p.name} onClick={() => explore(i)}><img src={photo(p.photo)} alt=""/><strong>{p.name}</strong><p>{p.text}</p><span>Saiba mais <ArrowRight/></span></button>; })}
        <aside><h2>Ações reais.<br/>Um futuro melhor.</h2><p>Descubra as paisagens e histórias por trás de cada iniciativa.</p><div><CalendarDays/><h3>Planeje sua visita</h3><button onClick={onCalendar}>Consultar agenda <ArrowRight/></button></div></aside>
      </div></section>
    </article><dialog ref={dialog} className="nature-dialog"><button aria-label="Fechar" onClick={() => dialog.current?.close()}><X/></button><img src={photo(current.photo)} alt=""/><h2>{current.name}</h2><p>{current.text}</p></dialog>
  </main>;
}
