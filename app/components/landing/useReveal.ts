"use client";

import { useEffect, useRef, useState } from "react";

// Fade+slide ao entrar na viewport — única microinteração que precisa de JS
// (o resto é CSS puro). A observação para assim que revela, sem custo
// contínuo de scroll. Timeout de segurança força a revelação mesmo se o
// IntersectionObserver nunca disparar (navegação direta por âncora, aba em
// segundo plano) — uma seção de venda nunca pode ficar invisível por causa
// de uma microinteração.
export function useReveal<T extends HTMLElement>(): [React.RefObject<T | null>, string] {
  const elRef = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const reveal = () => setVisible(true);
    const el = elRef.current;
    if (!el) {
      reveal();
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    const fallback = setTimeout(reveal, 1500);
    return () => {
      obs.disconnect();
      clearTimeout(fallback);
    };
  }, []);

  return [elRef, "reveal" + (visible ? " reveal-visible" : "")];
}
