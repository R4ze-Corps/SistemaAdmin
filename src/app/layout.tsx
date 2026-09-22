import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Refúgio Gestão | Painel de reservas",
  description: "Painel administrativo para gestão de reservas e hospedagens.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="pt-BR" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var saved=localStorage.getItem("refugio-theme");var dark=saved?saved==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",dark)}catch(e){}})()` }} /></head><body>{children}</body></html>;
}