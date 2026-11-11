import type { Metadata } from "next";
import Storefront from "./storefront";
import "./store.css";
import "./store-adjustments.css";
import "./store-redesign.css";

export const metadata: Metadata = {
  title: "Adega do Chalé | Refúgio",
  description: "Conheça os vinhos, kits e pequenos prazeres disponíveis durante sua estadia no Refúgio.",
};

export default function LojaPage() {
  return <Storefront />;
}
