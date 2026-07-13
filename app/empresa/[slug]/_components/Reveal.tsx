"use client";
import React, { useEffect, useRef, useState } from "react";

// Mesmo padrão da Landing Oficial (app/page.tsx): IntersectionObserver com um
// timeout de segurança que força a revelação mesmo se o observer nunca
// disparar (navegação direta por âncora, aba em segundo plano). Uma seção
// de venda nunca pode ficar invisível por causa de uma microinteração.
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const reveal = () => setVisible(true);
    const el = ref.current;
    if (!el) { reveal(); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { reveal(); io.disconnect(); }
    }, { threshold: 0.12 });
    io.observe(el);
    const fallback = setTimeout(reveal, 1500);
    return () => { io.disconnect(); clearTimeout(fallback); };
  }, []);
  return { ref, visible };
}

export default function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(24px)",
      transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
    }}>
      {children}
    </div>
  );
}

// Variante para grades de cards — pequeno atraso incremental por item.
export function RevealItem({ children, index = 0, step = 0.06 }: { children: React.ReactNode; index?: number; step?: number }) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const delay = index * step;
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(18px)",
      transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
    }}>
      {children}
    </div>
  );
}
