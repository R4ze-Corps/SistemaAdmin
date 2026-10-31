"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUpRight, Coffee, GlassWater, Leaf, Search, Sparkles, Wine, X } from "lucide-react";

type Item = { id: string; name: string; description: string; category: string; price: number; imageUrl?: string; featured: boolean };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const cellarPhoto = "https://images.pexels.com/photos/18513800/pexels-photo-18513800.jpeg?auto=compress&cs=tinysrgb&w=1000";
const categoryIcon = (category: string) => {
  const label = category.toLowerCase();
  if (label.includes("vinho") || label.includes("espumante")) return Wine;
  if (label.includes("café") || label.includes("cafe")) return Coffee;
  if (label.includes("sem álcool") || label.includes("sem alcool") || label.includes("água") || label.includes("agua")) return GlassWater;
  return Leaf;
};

export default function Storefront() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tudo");
  const [selected, setSelected] = useState<Item | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/store/menu", { cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Não foi possível abrir o cardápio.");
      if (active) setItems(data.items);
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Não foi possível abrir o cardápio."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (selected && !element.open) element.showModal();
    if (!selected && element.open) element.close();
  }, [selected]);

  const categories = useMemo(() => ["Tudo", ...new Set(items.map(item => item.category))], [items]);
  const visibleItems = useMemo(() => items.filter(item => (category === "Tudo" || item.category === category) && `${item.name} ${item.description} ${item.category}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))), [items, category, query]);
  const featured = items.find(item => item.featured);

  return <main className="store-page">
    <section className="store-hero" aria-labelledby="store-title">
      <div className="store-hero-copy"><p className="store-eyebrow"><span /> UM PEQUENO PRAZER, NO SEU TEMPO</p><h1 id="store-title">Sabores que<br /><em>combinam com o refúgio.</em></h1><p className="store-lead">Uma seleção feita para brindar os dias tranquilos e deixar a estadia ainda mais especial.</p><a className="store-hero-link" href="#cardapio">Descobrir o cardápio <ArrowDown size={17} /></a><span className="store-hero-ornament" aria-hidden="true">✳</span></div>
      <div className="store-feature" aria-label={featured ? `Destaque: ${featured.name}` : "Seleção da adega"}><span className="store-feature-orbit orbit-one" /><span className="store-feature-orbit orbit-two" /><img className="store-feature-photo" src={featured?.imageUrl || cellarPhoto} alt="Duas garrafas de vinho em um ambiente aconchegante" referrerPolicy="no-referrer" /><div className="store-feature-caption"><span><Sparkles size={14} /> ESCOLHA DA CASA</span><strong>{featured?.name || "Um brinde à pausa"}</strong><small>{featured ? money.format(featured.price) : "Sua seleção especial começa aqui"}</small></div></div>
    </section>

    <section id="cardapio" className="store-menu" aria-labelledby="menu-title">
      <div className="store-menu-heading"><div><p className="store-eyebrow">A ADEGA</p><h2 id="menu-title">Encontre seu momento<span>.</span></h2><p>Explore a seleção e conheça cada detalhe.</p></div><span className="store-count">{items.length.toString().padStart(2, "0")} <small>itens</small></span></div>
      <div className="store-controls"><label className="store-search"><Search size={18} /><span className="sr-only">Buscar no cardápio</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="O que você está procurando?" type="search" /></label><div className="store-categories" role="group" aria-label="Filtrar por categoria">{categories.map(name => { const Icon = name === "Tudo" ? Sparkles : categoryIcon(name); return <button key={name} type="button" aria-pressed={category === name} onClick={() => setCategory(name)}><Icon size={15} />{name}</button>; })}</div></div>
      {loading ? <div className="store-empty" role="status"><span className="store-loader" /> Preparando a seleção…</div> : error ? <div className="store-empty" role="alert"><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Tentar novamente</button></div> : visibleItems.length ? <div className="store-grid">{visibleItems.map((item, index) => { const Icon = categoryIcon(item.category); return <button type="button" key={item.id} className={`store-card ${item.featured ? "is-featured" : ""}`} onClick={() => setSelected(item)} aria-label={`Ver detalhes de ${item.name}`}>
        <span className="store-card-image">{item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <><span className="store-card-grain" /><Icon size={42} strokeWidth={1.1} /><span className="store-card-index">{String(index + 1).padStart(2, "0")}</span></>}</span>
        <span className="store-card-body"><span className="store-card-category">{item.category}{item.featured && <span className="store-card-tag"><Sparkles size={12} /> DA CASA</span>}</span><strong>{item.name}</strong><span className="store-card-description">{item.description || "Uma escolha especial para aproveitar sem pressa."}</span><span className="store-card-bottom"><b>{money.format(item.price)}</b><span className="store-card-open">Conhecer <ArrowUpRight size={14} /></span></span></span>
      </button>; })}</div> : <div className="store-empty">{items.length ? "Nenhum item corresponde a essa busca." : "A seleção está sendo preparada. Volte em breve para conhecer as opções da adega."}</div>}
    </section>

    <footer className="store-footer"><span className="store-footer-mark"><Wine size={16} /></span><span>Refúgio <i>·</i> bons momentos, sem pressa.</span><a href="#cardapio">Voltar ao início <ArrowUpRight size={13} /></a></footer>

    <dialog ref={dialog} className="store-dialog" onClick={event => { if (event.target === dialog.current) setSelected(null); }} onClose={() => setSelected(null)} aria-label={selected?.name || "Detalhes do item"}>
      {selected && <article className="store-detail"> <button className="store-detail-close" type="button" onClick={() => setSelected(null)} aria-label="Fechar detalhes"><X size={18} /></button><div className="store-detail-art">{selected.imageUrl ? <img src={selected.imageUrl} alt="" referrerPolicy="no-referrer" /> : (() => { const Icon = categoryIcon(selected.category); return <Icon size={64} strokeWidth={1} />; })()}</div><div className="store-detail-copy"><p className="store-eyebrow">{selected.category}</p><h2>{selected.name}</h2><p>{selected.description || "Uma escolha especial para aproveitar sem pressa."}</p><strong>{money.format(selected.price)}</strong><button type="button" onClick={() => setSelected(null)}><ArrowLeft size={16} /> Voltar ao cardápio</button></div></article>}
    </dialog>
  </main>;
}
