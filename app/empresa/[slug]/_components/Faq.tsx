"use client";
import React, { useState } from "react";
import Reveal from "./Reveal";
import { IcChevron } from "./icons";
import { FAQS } from "../_lib/content";

function FaqItem({ p, r }: { p: string; r: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen(o => !o)} style={{ background: "#ffffff", borderRadius: 12, marginBottom: 10, border: open ? "1.5px solid #B8863D" : "1px solid #E8E1D4", transition: "border-color 0.2s", cursor: "pointer", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", gap: 12 }}>
        <span style={{ fontWeight: 600, color: "#14110D", fontSize: 15, lineHeight: 1.4, flex: 1 }}>{p}</span>
        <span style={{ color: open ? "#B8863D" : "#6B6459", flexShrink: 0, transition: "color 0.2s" }}><IcChevron open={open}/></span>
      </div>
      <div style={{ maxHeight: open ? 300 : 0, overflow: "hidden", transition: "max-height 0.35s ease" }}>
        <div style={{ padding: "0 22px 18px", color: "#6B6459", fontSize: 14.5, lineHeight: 1.75, borderTop: "1px solid #FAF7F2" }}>{r}</div>
      </div>
    </div>
  );
}

export default function Faq() {
  return (
    <section style={{ padding: "96px 24px", background: "#ffffff" }}>
      <Reveal>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#B8863D", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 12px" }}>Dúvidas frequentes</p>
            <h2 style={{ fontSize: "clamp(30px,3.8vw,44px)", fontWeight: 800, color: "#14110D", margin: "0 0 12px", lineHeight: 1.2 }}>Perguntas frequentes</h2>
            <p style={{ fontSize: 14, color: "#6B6459", margin: "0 0 44px" }}>Orientações gerais sobre como funciona o atendimento</p>
          </div>
          {FAQS.map((f, i) => <FaqItem key={i} p={f.p} r={f.r}/>)}
        </div>
      </Reveal>
    </section>
  );
}
