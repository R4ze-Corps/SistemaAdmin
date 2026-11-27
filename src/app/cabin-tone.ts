export type CabinTone = "emerald" | "amber" | "violet" | "rose";
export function dotClass(tone: CabinTone) { return tone === "amber" ? "bg-[#c89e66]" : tone === "violet" ? "bg-[#8877bb]" : tone === "rose" ? "bg-[#c47b68]" : "bg-[#68a07d]"; }
