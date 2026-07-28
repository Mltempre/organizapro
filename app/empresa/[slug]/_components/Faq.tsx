"use client";
import { useState } from "react";
import Reveal from "./Reveal";
import { Icon } from "./icons";
import { eyebrow, radius } from "../_lib/theme";
import { font, paleta, type Tema, type Tone } from "../_lib/families";
import type { DBFaq } from "../_lib/types";

function FaqItem({ p, r, isFirst, pal }: { p: string; r: string; isFirst: boolean; pal: ReturnType<typeof paleta> }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen(o => !o)} style={{ borderTop: isFirst ? "none" : `1px solid ${pal.line}`, cursor: "pointer", paddingTop: isFirst ? 0 : 22, paddingBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <span style={{ fontFamily: font.body, fontWeight: 700, color: pal.text, fontSize: 15.5, lineHeight: 1.4, flex: 1 }}>{p}</span>
        <span style={{ flexShrink: 0, transition: "transform 0.3s", transform: open ? "rotate(45deg)" : "rotate(0deg)" }}>
          <Icon name="plus" size={18} color={open ? pal.accent : pal.textMuted}/>
        </span>
      </div>
      <div style={{ maxHeight: open ? 300 : 0, overflow: "hidden", transition: "max-height 0.35s ease" }}>
        <div style={{ paddingTop: 14, color: pal.textMuted, fontSize: 14.5, lineHeight: 1.75, maxWidth: 560, fontFamily: font.body }}>{r}</div>
      </div>
    </div>
  );
}

// Só renderiza com FAQ real cadastrado pelo cliente (clinica_faq). Sem
// tabela/dado próprio, a seção inteira desaparece — nunca mostra perguntas
// universais como se fossem escritas para este negócio específico.
export default function Faq({ faqs, tema, tone = "light", variant = 2 }: { faqs: DBFaq[]; tema: Tema; tone?: Tone; variant?: 1 | 2 }) {
  if (faqs.length === 0) return null;
  const p = paleta(tema, tone, variant);
  return (
    <section id="faq" style={{ padding: "112px 24px", background: p.bg }}>
      <Reveal>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <span style={{ ...eyebrow, display: "inline-block", background: tema.primarySoft, border: `1px solid ${tema.primaryBorder}`, color: p.accent, padding: "5px 14px", borderRadius: radius.pill, marginBottom: 16, fontFamily: font.body }}>Dúvidas frequentes</span>
            <h2 style={{ fontFamily: font.display, fontWeight: 600, fontSize: "clamp(27px,3.2vw,38px)", color: p.text, margin: "0 0 12px", lineHeight: 1.2 }}>Perguntas frequentes</h2>
          </div>
          <div>
            {faqs.map((f, i) => <FaqItem key={f.id} p={f.pergunta} r={f.resposta} isFirst={i === 0} pal={p}/>)}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
