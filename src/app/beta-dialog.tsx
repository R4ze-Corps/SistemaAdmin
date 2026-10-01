"use client";

import { ReactNode, useContext, useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { BetaFeedbackContext } from "./beta-feedback";

/** Native modal semantics, keyboard containment and focus restoration, Beta only. */
export default function BetaDialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const changed = useRef(false);
  const titleId = useId();
  const feedback = useContext(BetaFeedbackContext);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previous = document.activeElement as HTMLElement | null;
    const heading = element.querySelector("h2");
    if (heading) heading.id = titleId;
    element.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [titleId]);
  function dismiss() {
    if (changed.current && !window.confirm("Descartar as alterações deste formulário? Para mantê-las, cancele e salve antes de fechar.")) return;
    onClose();
  }
  return <dialog ref={dialog} className="beta-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); dismiss(); }} onChangeCapture={() => { changed.current = true; }} onClickCapture={event => { if ((event.target as HTMLElement).closest('[role="switch"], [aria-pressed]')) changed.current = true; }}>
    <button type="button" onClick={dismiss} aria-label="Fechar janela" className="beta-dialog-close"><X size={20} /></button>
    {feedback.message && <div className="beta-dialog-feedback" role="status" aria-live="polite"><span>{feedback.message}</span><button type="button" aria-label="Dispensar mensagem" onClick={feedback.dismiss}><X size={18} /></button></div>}
    {children}
  </dialog>;
}
