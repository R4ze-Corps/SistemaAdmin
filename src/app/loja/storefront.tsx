"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUpRight, Coffee, GlassWater, Gift, Leaf, Search, Sparkles, Wine, X } from "lucide-react";

type Section = "wine" | "products";
type Item = { id: string; name: string; description: string; category: string; section: Section; price: number; imageUrl?: string; featured: boolean };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const cellarPhoto = "/assets/wine-bottles-cutout.png";
const categoryIcon = (category: string) => {
  const label = category.toLocaleLowerCase("pt-BR");
  if (label.includes("vinho") || label.includes("espumante")) return Wine;
  if (label.includes("chocolate") || label.includes("kit") || label.includes("presente")) return Gift;
  if (label.includes("café") || label.includes("cafe")) return Coffee;
  if (label.includes("sem álcool") || label.includes("sem alcool") || label.includes("água") || label.includes("agua") || label.includes("refrigerante")) return GlassWater;
  return Leaf;
};

export default function Storefront() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<Section>("wine");
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

  const sectionItems = useMemo(() => items.filter(item => item.section === section), [items, section]);
  const categories = useMemo(() => ["Tudo", ...new Set(sectionItems.map(item => item.category))], [sectionItems]);
  const visibleItems = useMemo(() => sectionItems.filter(item => (category === "Tudo" || item.category === category) && `${item.name} ${item.description} ${item.category}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))), [sectionItems, category, query]);
  const featured = sectionItems.find(item => item.featured) || sectionItems.find(item => item.imageUrl);
  const setSectionAndReset = (next: Section) => { setSection(next); setCategory("Tudo"); setQuery(""); };

  return <main className={`store-page store-page-redesign store-section-${section}`}>
    <section className="store-hero" aria-labelledby="store-title">
      <div className="store-hero-copy"><p className="store-eyebrow"><span /> MATTO CHALÉS · LOJA DO REFÚGIO</p><h1 id="store-title">Pequenos prazeres,<br /><em>grandes momentos.</em></h1><p className="store-lead">Vinhos escolhidos para brindar e delicadezas para aproveitar cada instante da sua estadia.</p><a className="store-hero-link" href="#cardapio">Explorar a seleção <ArrowDown size={17} /></a><span className="store-hero-ornament" aria-hidden="true">✳</span></div>
      <div className="store-feature" aria-label={featured ? `Destaque: ${featured.name}` : section === "wine" ? "Seleção da adega" : "Produtos especiais do chalé"}><span className="store-feature-orbit orbit-one" /><span className="store-feature-orbit orbit-two" /><img className="store-feature-photo" src={featured?.imageUrl || (section === "wine" ? cellarPhoto : "/assets/adega-background-2.png")} alt={featured?.name || (section === "wine" ? "Seleção de garrafas de vinho" : "Kit de boas-vindas do chalé") } referrerPolicy="no-referrer" /><div className="store-feature-caption"><span><Sparkles size={14} /> {featured?.category || (section === "wine" ? "SELEÇÃO DA CASA" : "PEQUENOS PRAZERES")}</span><strong>{featured?.name || (section === "wine" ? "Um brinde à pausa" : "Um mimo para sua estadia")}</strong><small>{featured ? money.format(featured.price) : "Escolhas para curtir sem pressa"}</small></div></div>
    </section>

    <section id="cardapio" className="store-menu" aria-labelledby="menu-title">
      <div className="store-menu-heading"><div><p className="store-eyebrow">FEITO PARA A SUA ESTADIA</p><h2 id="menu-title">Escolha seu <span>momento.</span></h2><p>Conheça nossa adega e os itens disponíveis no chalé.</p></div><span className="store-count">{sectionItems.length.toString().padStart(2, "0")} <small>{sectionItems.length === 1 ? "item" : "itens"}</small></span></div>
      <div className="store-tabs" role="tablist" aria-label="Seções da loja">
        <button id="tab-wine" role="tab" aria-selected={section === "wine"} aria-controls="store-products" type="button" onClick={() => setSectionAndReset("wine")}><Wine size={17} /><span>Adega</span><small>Vinhos e espumantes</small></button>
        <button id="tab-products" role="tab" aria-selected={section === "products"} aria-controls="store-products" type="button" onClick={() => setSectionAndReset("products")}><Gift size={17} /><span>Outros produtos</span><small>Kits, chocolates e bebidas</small></button>
      </div>
      <div className="store-controls"><label className="store-search"><Search size={18} /><span className="sr-only">Buscar nesta seção</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={section === "wine" ? "Buscar um vinho…" : "Buscar produtos do chalé…"} type="search" /></label><div className="store-categories" role="group" aria-label="Filtrar por categoria">{categories.map(name => { const Icon = name === "Tudo" ? Sparkles : categoryIcon(name); return <button key={name} type="button" aria-pressed={category === name} onClick={() => setCategory(name)}><Icon size={15} />{name}</button>; })}</div></div>
      <div id="store-products" role="tabpanel" aria-labelledby={section === "wine" ? "tab-wine" : "tab-products"}>
        {loading ? <div className="store-empty" role="status"><span className="store-loader" /> Preparando a seleção…</div> : error ? <div className="store-empty" role="alert"><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Tentar novamente</button></div> : visibleItems.length ? <div className="store-grid">{visibleItems.map((item, index) => { const Icon = categoryIcon(item.category); return <button type="button" key={item.id} className={`store-card ${item.featured ? "is-featured" : ""}`} onClick={() => setSelected(item)} aria-label={`Ver detalhes de ${item.name}`}>
          <span className="store-card-image">{item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <><span className="store-card-grain" /><Icon size={42} strokeWidth={1.1} /><span className="store-card-index">{String(index + 1).padStart(2, "0")}</span></>}</span>
          <span className="store-card-body"><span className="store-card-category">{item.category}{item.featured && <span className="store-card-tag"><Sparkles size={12} /> DA CASA</span>}</span><strong>{item.name}</strong><span className="store-card-description">{item.description || "Uma escolha especial para aproveitar sem pressa."}</span><span className="store-card-bottom"><b>{money.format(item.price)}</b><span className="store-card-open">Ver detalhes <ArrowUpRight size={14} /></span></span></span>
        </button>; })}</div> : <div className="store-empty">{sectionItems.length ? "Nenhum item corresponde a essa busca." : section === "wine" ? "Nossa seleção de vinhos está sendo preparada. Volte em breve." : "Os produtos disponíveis no frigobar e os kits especiais aparecerão aqui."}</div>}
      </div>
    </section>

    <dialog ref={dialog} className="store-dialog" onClick={event => { if (event.target === dialog.current) setSelected(null); }} onClose={() => setSelected(null)} aria-label={selected?.name || "Detalhes do item"}>
      {selected && <article className="store-detail"> <button className="store-detail-close" type="button" onClick={() => setSelected(null)} aria-label="Fechar detalhes"><X size={18} /></button><div className="store-detail-art">{selected.imageUrl ? <img src={selected.imageUrl} alt={selected.name} referrerPolicy="no-referrer" /> : (() => { const Icon = categoryIcon(selected.category); return <Icon size={64} strokeWidth={1} />; })()}</div><div className="store-detail-copy"><p className="store-eyebrow">{selected.category}</p><h2>{selected.name}</h2><p>{selected.description || "Uma escolha especial para aproveitar sem pressa."}</p><strong>{money.format(selected.price)}</strong><button type="button" onClick={() => setSelected(null)}><ArrowLeft size={16} /> Voltar à seleção</button></div></article>}
    </dialog>
  </main>;
}
