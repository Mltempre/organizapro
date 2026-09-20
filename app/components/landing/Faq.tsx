"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useReveal } from "./useReveal";

// Perguntas e respostas restritas ao que é verificável no produto — sem
// prometer prazo de resposta, política de cancelamento ou qualquer termo
// comercial que não esteja no escopo confirmado desta missão.
const PERGUNTAS = [
  {
    q: "O Site Premium está incluso no valor?",
    a: "Sim. O plano OrganizaPro já inclui 1 Site Premium Profissional, configurado na implantação — não é um serviço à parte.",
  },
  {
    q: "Preciso saber mexer com tecnologia para usar?",
    a: "Não. O painel é visual, pensado para o dia a dia de quem atende clientes — sem comandos, sem configuração técnica.",
  },
  {
    q: "O chatbot substitui o meu atendimento?",
    a: "Não. Ele responde automaticamente perguntas comuns — horário, endereço, serviços — e direciona o cliente para falar com você quando o assunto exige uma pessoa de verdade.",
  },
  {
    q: "Os lembretes e pedidos de avaliação são realmente automáticos?",
    a: "Sim. O lembrete de compromisso é enviado sozinho na véspera, e o pedido de avaliação é enviado sozinho depois do atendimento — ambos pelo WhatsApp.",
  },
  {
    q: "Funciona para o meu tipo de negócio?",
    a: "Se o seu negócio atende clientes com hora marcada — de barbearia a clínica, de advogado a academia — o OrganizaPro organiza agenda, clientes, site e atendimento do mesmo jeito.",
  },
  {
    q: "Consigo acessar pelo celular?",
    a: "Sim. O painel é acessado pelo navegador e funciona tanto no computador quanto no celular.",
  },
];

export default function Faq({ isMobile }: { isMobile: boolean }) {
  const [ref, cls] = useReveal<HTMLDivElement>();
  const [aberta, setAberta] = useState<number | null>(0);

  return (
    <section id="faq" style={{ padding: isMobile ? "64px 20px" : "96px 40px", background: "var(--bg)" }}>
      <div ref={ref} className={cls} style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: isMobile ? 36 : 52 }}>
          <span className="section-tag">Perguntas frequentes</span>
          <h2 className="section-title">Antes de falar com a gente</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {PERGUNTAS.map((item, i) => {
            const aberto = aberta === i;
            return (
              <div key={item.q} className="faq-item" style={{ borderColor: aberto ? "rgba(74,155,176,0.4)" : "rgba(255,255,255,0.08)" }}>
                <button
                  type="button"
                  className="faq-pergunta"
                  aria-expanded={aberto}
                  onClick={() => setAberta(aberto ? null : i)}
                >
                  {item.q}
                  <ChevronDown size={18} className={aberto ? "faq-chevron faq-chevron-aberto" : "faq-chevron"} />
                </button>
                {aberto && <p className="faq-resposta">{item.a}</p>}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .faq-item {
          border-radius: 14px; border: 1px solid; background: var(--surface);
          overflow: hidden; transition: border-color 0.2s ease;
        }
        .faq-pergunta {
          width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 18px 20px; background: none; border: none; color: var(--text);
          font-family: inherit; font-size: 14.5px; font-weight: 700; text-align: left; cursor: pointer;
        }
        .faq-chevron { color: var(--muted); flex-shrink: 0; transition: transform 0.2s ease; }
        .faq-chevron-aberto { transform: rotate(180deg); color: #4a9bb0; }
        .faq-resposta { margin: 0; padding: 0 20px 20px; color: var(--muted); font-size: 13.5px; line-height: 1.7; }
      `}</style>
    </section>
  );
}
