"use client";

import Image from "next/image";
import { useReveal } from "./useReveal";

// Prova visual real — as duas telas que o cliente de fato vê: o Painel
// Executivo (screenshot real do produto, dados de demonstração) e um
// exemplo real de Site Premium gerado pela plataforma. Rotulado
// explicitamente como exemplo/demonstração, nunca como depoimento de
// cliente — nenhuma das duas imagens é encenação, mas nenhuma é
// atribuída a um cliente pagante específico.
export default function ProdutoVisivel({ isMobile }: { isMobile: boolean }) {
  const [ref, cls] = useReveal<HTMLDivElement>();

  return (
    <section style={{ padding: isMobile ? "20px 20px 80px" : "10px 40px 120px", background: "var(--bg)" }}>
      <div ref={ref} className={cls} style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1.15fr 0.85fr",
            gap: isMobile ? 40 : 28,
            alignItems: "start",
          }}
        >
          <div>
            <span className="section-tag">Produto real</span>
            <h3 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 800, color: "var(--text)", margin: "0 0 14px" }}>
              O Painel Executivo, direto do produto
            </h3>
            <div className="browser-shell">
              <div className="browser-bar">
                <i /><i /><i /><span>app.organizapro.com.br</span>
              </div>
              <Image
                src="/organizapro-dashboard.png"
                alt="Painel Executivo real do OrganizaPro com prioridade do dia, agenda e panorama, usando dados de demonstração"
                width={1440}
                height={960}
                sizes="(max-width: 700px) 100vw, 60vw"
                style={{ display: "block", width: "100%", height: "auto" }}
              />
            </div>
            <p className="produto-legenda">Tela real do produto · dados de demonstração</p>
          </div>

          <div>
            <span className="section-tag">Exemplo gerado</span>
            <h3 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 800, color: "var(--text)", margin: "0 0 14px" }}>
              Um Site Premium publicado pela plataforma
            </h3>
            <div className="browser-shell">
              <div className="browser-bar">
                <i /><i /><i /><span>seunegocio.organizapro.com.br</span>
              </div>
              <Image
                src="/site-premium-exemplo-desktop.png"
                alt="Exemplo de Site Premium gerado pelo OrganizaPro para um negócio de exemplo"
                width={1440}
                height={900}
                sizes="(max-width: 700px) 100vw, 45vw"
                style={{ display: "block", width: "100%", height: "auto" }}
              />
            </div>
            <p className="produto-legenda">Exemplo de site gerado pela plataforma · não é cliente real</p>
          </div>
        </div>
      </div>

      <style>{`
        .browser-shell {
          border-radius: 16px; overflow: hidden;
          background: var(--panel); border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 30px 70px rgba(0,0,0,0.5);
        }
        .browser-bar {
          display: flex; align-items: center; gap: 6px; padding: 10px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.06); background: var(--surface);
        }
        .browser-bar i { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.14); }
        .browser-bar span { margin: 0 auto; font-size: 11px; color: var(--muted); }
        .produto-legenda { margin: 10px 2px 0; font-size: 12px; color: var(--muted); }
      `}</style>
    </section>
  );
}
