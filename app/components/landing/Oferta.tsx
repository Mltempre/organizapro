"use client";

import { Check } from "lucide-react";
import { useReveal } from "./useReveal";
import { abrirWhatsapp } from "./whatsapp";

const PLANOS = [
  {
    medalha: "🥉",
    nome: "OrganizaPro",
    tagline: "Organize o seu próprio negócio.",
    itens: ["Sistema completo", "1 Empresa", "1 Site Premium Profissional"],
    publico: "Ideal para empresários e profissionais liberais.",
    destaque: false,
  },
  {
    medalha: "🥈",
    nome: "OrganizaPro Agência",
    tagline: "Crie uma nova fonte de renda.",
    itens: ["Sistema completo", "Até 10 Empresas com Sites Premium Profissionais"],
    publico: "Ideal para: Agências, Social Media, Designers, Freelancers, Marketing Digital.",
    destaque: true,
  },
  {
    medalha: "🥇",
    nome: "OrganizaPro Revenda",
    tagline: "Transforme o OrganizaPro na sua plataforma de negócios.",
    itens: ["Sistema completo", "Empresas ilimitadas", "Sites Premium Profissionais ilimitados"],
    publico: "Voltado para quem deseja escalar um negócio baseado na criação de sites.",
    destaque: false,
  },
];

const IMPLANTACAO_ITENS = [
  "Diretor Digital configurado",
  "Site Premium Profissional",
  "Configuração do Perfil Google",
  "SEO inicial básico",
  "Treinamento incluso",
];

const MENSALIDADE_ITENS = [
  "Acesso completo ao OrganizaPro",
  "Agenda e cadastro de clientes",
  "Automações de lembrete e avaliação",
  "Suporte via WhatsApp",
  "Atualizações incluídas",
];

export default function Oferta({ isMobile }: { isMobile: boolean }) {
  const [ref, cls] = useReveal<HTMLDivElement>();

  return (
    <section id="oferta" style={{ padding: isMobile ? "64px 20px" : "96px 40px", background: "var(--panel)" }}>
      <div ref={ref} className={cls} style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: isMobile ? 28 : 36 }}>
          <span className="section-tag">Planos</span>
          <h2 className="section-title">Um plano para o seu negócio. Outro para quem quer construir um negócio com sites.</h2>
          <p className="section-lead">Sem mensalidade surpresa. Sem letras miúdas.</p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
            gap: 18,
            marginBottom: isMobile ? 32 : 44,
            alignItems: "stretch",
          }}
        >
          {PLANOS.map((plano) => (
            <div
              key={plano.nome}
              style={{
                borderRadius: 18,
                padding: isMobile ? "28px 22px" : "32px 26px",
                background: plano.destaque ? "linear-gradient(135deg, var(--accent), var(--accent-strong))" : "var(--surface)",
                border: plano.destaque ? "1px solid rgba(74,155,176,0.5)" : "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ fontSize: 30, marginBottom: 10 }}>{plano.medalha}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#f1f5f9", marginBottom: 6 }}>{plano.nome}</div>
              <div style={{ fontSize: 14, color: plano.destaque ? "rgba(255,255,255,0.75)" : "var(--muted)", marginBottom: 20, lineHeight: 1.5 }}>
                {plano.tagline}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20, flex: 1 }}>
                {plano.itens.map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, color: plano.destaque ? "#fff" : "var(--text)", fontWeight: 500, lineHeight: 1.5 }}>
                    <Check size={15} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2, color: plano.destaque ? "#fff" : "#4a9bb0" }} />
                    {item}
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12.5, color: plano.destaque ? "rgba(255,255,255,0.6)" : "#64748b", lineHeight: 1.6, margin: "0 0 20px" }}>
                {plano.publico}
              </p>
              <button
                className={plano.destaque ? "btn-main" : "btn-secondary"}
                onClick={() => abrirWhatsapp(`Quero saber mais sobre o plano ${plano.nome}`)}
                style={{ width: "100%" }}
              >
                {plano.nome === "OrganizaPro" ? "Quero começar" : "Fale com nosso time"}
              </button>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginBottom: isMobile ? 28 : 36 }}>
          <span className="section-tag">Investimento — plano OrganizaPro</span>
          <h3 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 800, color: "var(--text)", lineHeight: 1.2, margin: "0 0 8px" }}>
            Ter um Diretor Digital custa menos que um estagiário
          </h3>
        </div>

        <div id="incluso" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, alignItems: "start" }}>
          <div className="oferta-implantacao">
            <div className="oferta-eyebrow" style={{ color: "rgba(255,255,255,0.55)" }}>
              Implantação — paga uma única vez
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.65)", marginTop: 12 }}>R$</span>
              <span style={{ fontSize: 64, fontWeight: 900, lineHeight: 1, color: "#fff" }}>1.497</span>
            </div>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.58)", margin: "0 0 28px", lineHeight: 1.65 }}>
              Pago uma única vez. Inclui configuração completa, Site Premium Profissional e orientação de Perfil Google.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {IMPLANTACAO_ITENS.map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "rgba(255,255,255,0.85)" }}>
                  <span className="oferta-check-implantacao"><Check size={12} strokeWidth={3} /></span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="oferta-mensalidade">
            <div className="oferta-eyebrow" style={{ color: "#64748b" }}>
              Manutenção — cobrada mensalmente
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#64748b", marginTop: 12 }}>R$</span>
              <span style={{ fontSize: 64, fontWeight: 900, lineHeight: 1, color: "var(--text)" }}>197</span>
              <span style={{ fontSize: 15, color: "#64748b", marginTop: 44 }}>/mês</span>
            </div>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 28px", lineHeight: 1.65 }}>
              Acesso contínuo ao OrganizaPro, hospedagem, automações e suporte.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {MENSALIDADE_ITENS.map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--text)" }}>
                  <span className="oferta-check-mensalidade"><Check size={12} strokeWidth={3} /></span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="oferta-resumo">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Primeiro ano completo:</div>
            <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: "#4a9bb0" }}>
              R$1.497 + 12 × R$197 = <span style={{ color: "var(--text)" }}>R$3.861</span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>Implantação + Site Premium + Perfil Google + suporte por 12 meses</div>
          </div>
          <button className="btn-main" style={{ flexShrink: 0 }} onClick={() => abrirWhatsapp("Quero saber mais sobre o OrganizaPro — Implantação + Mensalidade")}>
            Quero saber mais
          </button>
        </div>
      </div>

      <style>{`
        .oferta-implantacao {
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
          border-radius: 18px; padding: ${isMobile ? "32px 24px" : "40px 36px"}; color: #fff;
        }
        .oferta-mensalidade {
          background: var(--surface); border-radius: 18px;
          padding: ${isMobile ? "32px 24px" : "40px 36px"}; border: 1px solid rgba(255,255,255,0.1);
        }
        .oferta-eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 10px; }
        .oferta-check-implantacao, .oferta-check-mensalidade {
          width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .oferta-check-implantacao { background: rgba(255,255,255,0.15); color: #fff; }
        .oferta-check-mensalidade { background: rgba(74,155,176,0.15); color: #4a9bb0; }
        .oferta-resumo {
          margin-top: 20px; background: var(--surface); border-radius: 14px; padding: ${isMobile ? "20px 20px" : "22px 28px"};
          border: 1px solid rgba(255,255,255,0.08);
          display: flex; align-items: ${isMobile ? "flex-start" : "center"};
          justify-content: space-between; flex-wrap: wrap; gap: 16px; flex-direction: ${isMobile ? "column" : "row"};
        }
      `}</style>
    </section>
  );
}
