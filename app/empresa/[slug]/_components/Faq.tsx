"use client";
import { useState } from "react";
import Reveal from "./Reveal";
import { Icon } from "./icons";
import { color, eyebrow, radius } from "../_lib/theme";
import type { DBFaq } from "../_lib/types";

function FaqItem({ p, r, isFirst }: { p: string; r: string; isFirst: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen(o => !o)} style={{ borderTop: isFirst ? "none" : `1px solid ${color.line}`, cursor: "pointer", paddingTop: isFirst ? 0 : 22, paddingBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <span style={{ fontWeight: 700, color: color.text, fontSize: 15.5, lineHeight: 1.4, flex: 1 }}>{p}</span>
        <span style={{ flexShrink: 0, transition: "transform 0.3s", transform: open ? "rotate(45deg)" : "rotate(0deg)" }}>
          <Icon name="plus" size={18} color={open ? color.accent : color.textFaint}/>
        </span>
      </div>
      <div style={{ maxHeight: open ? 300 : 0, overflow: "hidden", transition: "max-height 0.35s ease" }}>
        <div style={{ paddingTop: 14, color: color.textMuted, fontSize: 14.5, lineHeight: 1.75, maxWidth: 560 }}>{r}</div>
      </div>
    </div>
  );
}

// Só renderiza com FAQ real cadastrado pelo cliente (clinica_faq). Sem
// tabela/dado próprio, a seção inteira desaparece — nunca mostra perguntas
// universais como se fossem escritas para este negócio específico.
export default function Faq({ faqs }: { faqs: DBFaq[] }) {
  if (faqs.length === 0) return null;
  return (
    <section style={{ padding: "112px 24px", background: color.ink }}>
      <Reveal>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <span style={{ ...eyebrow, display: "inline-block", background: color.accentSoft, border: `1px solid ${color.accentBorder}`, color: color.accent, padding: "5px 14px", borderRadius: radius.pill, marginBottom: 16 }}>Dúvidas frequentes</span>
            <h2 style={{ fontSize: "clamp(26px,3.2vw,38px)", fontWeight: 800, color: color.text, margin: "0 0 12px", lineHeight: 1.2, letterSpacing: "-0.01em" }}>Perguntas frequentes</h2>
          </div>
          <div>
            {faqs.map((f, i) => <FaqItem key={f.id} p={f.pergunta} r={f.resposta} isFirst={i === 0}/>)}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
