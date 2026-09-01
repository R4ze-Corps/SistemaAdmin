import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Refúgio Gestão | Painel de reservas",
  description: "Painel administrativo para gestão de reservas e hospedagens.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}