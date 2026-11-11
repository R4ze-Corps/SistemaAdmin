export type StoreSection = "wine" | "products";

export function sectionForLegacyItem(name: string, category: string): StoreSection {
  const text = `${name} ${category}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  if (/chocolate|kit|frigobar|refrigerante|coca|cerveja|suco|agua|cafe|biscoito|petisco|doce|presente|snack/.test(text)) return "products";
  return "wine";
}
