import Reveal from "./Reveal";
import { IcWa, IcPhone } from "./icons";
import type { Empresa } from "../_lib/types";

export default function CtaFinal({ empresa, waLink, whatsappNumber }: { empresa: Empresa; waLink: string; whatsappNumber?: string }) {
  if (!whatsappNumber && !empresa.telefone) return null;
  return (
    <section style={{ background: "linear-gradient(160deg,#1C1712 0%,#0B0906 100%)", padding: "108px 24px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle,rgba(184,134,61,0.20) 0%,transparent 68%)", top: "-20%", left: "50%", transform: "translateX(-50%)" }}/>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1.5px, transparent 1.5px)", backgroundSize: "24px 24px" }}/>
      <Reveal>
        <div style={{ maxWidth: 680, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: "#D4A85E", letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 20px" }}>Vamos conversar?</p>
          <h2 style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: "clamp(30px,4.8vw,50px)", fontWeight: 550, color: "#ffffff", margin: "0 0 20px", lineHeight: 1.18 }}>
            Vamos conversar sobre o que sua empresa precisa?
          </h2>
          <p style={{ fontSize: 16.5, color: "rgba(255,255,255,0.60)", margin: "0 0 44px", lineHeight: 1.7 }}>
            Fale com a gente agora e receba um atendimento pensado para o seu momento.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center" }}>
            {whatsappNumber && (
              <a href={waLink} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "18px 40px", borderRadius: 9, background: "#25D366", color: "#ffffff", textDecoration: "none", fontWeight: 700, fontSize: 16.5, boxShadow: "0 16px 40px rgba(37,211,102,0.35)" }}>
                <IcWa/> Falar no WhatsApp
              </a>
            )}
            {empresa.telefone && (
              <a href={"tel:" + empresa.telefone} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "18px 34px", borderRadius: 9, border: "1.5px solid rgba(212,168,94,0.35)", color: "#ffffff", textDecoration: "none", fontWeight: 600, fontSize: 15.5 }}>
                <IcPhone/> {empresa.telefone}
              </a>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
