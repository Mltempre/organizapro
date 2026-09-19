"use client";

import { useEffect, useState } from "react";
import LandingHero from "./components/landing/LandingHero";
import EstilosCompartilhados from "./components/landing/EstilosCompartilhados";
import ProdutoVisivel from "./components/landing/ProdutoVisivel";
import ComoFunciona from "./components/landing/ComoFunciona";
import Diferenciacao from "./components/landing/Diferenciacao";
import Capacidades from "./components/landing/Capacidades";
import ParaQuem from "./components/landing/ParaQuem";
import Oferta from "./components/landing/Oferta";
import Faq from "./components/landing/Faq";
import CtaFinal from "./components/landing/CtaFinal";
import LandingFooter from "./components/landing/LandingFooter";
import { abrirWhatsapp } from "./components/landing/whatsapp";

// ── Landing institucional OrganizaPro · V3 ──────────────────────────
//
// Reconstrução em cima da identidade dark já homologada em Produção
// (preservada — mesma paleta/fonte do painel real, ver app/globals.css),
// dividida em componentes por seção para evitar um único arquivo de 800+
// linhas. Toda capacidade citada foi auditada diretamente no código do
// produto (app/dashboard, app/agendamentos, app/clientes, app/chatbot,
// app/automacao, app/reputacao, app/metricas, app/conteudo, app/site,
// app/raio-x) — nenhuma métrica, cliente ou depoimento é inventado.
export default function Page() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "var(--bg)", color: "var(--text)", overflowX: "hidden", maxWidth: "100vw" }}>
      <EstilosCompartilhados />

      <LandingHero onPrimaryCta={() => abrirWhatsapp()} />
      <ProdutoVisivel isMobile={isMobile} />
      <ComoFunciona isMobile={isMobile} />
      <Diferenciacao isMobile={isMobile} />
      <Capacidades isMobile={isMobile} />
      <ParaQuem isMobile={isMobile} />
      <Oferta isMobile={isMobile} />
      <Faq isMobile={isMobile} />
      <CtaFinal isMobile={isMobile} />
      <LandingFooter isMobile={isMobile} />
    </div>
  );
}
