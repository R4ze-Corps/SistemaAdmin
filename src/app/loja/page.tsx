import type { Metadata } from "next";
import Storefront from "./storefront";
import "./store.css";

export const metadata: Metadata = {
  title: "Adega do Chalé | Refúgio",
  description: "Conheça as bebidas e os pequenos prazeres disponíveis durante sua estadia no Refúgio.",
};

export default function LojaPage() {
  return <Storefront />;
}
