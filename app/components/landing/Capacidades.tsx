"use client";

import { Users, CalendarCheck, Globe, Sparkles, MessageCircle, Zap, Star, BarChart3, ScanSearch } from "lucide-react";
import { useReveal } from "./useReveal";

// Grade de capacidades REAIS da plataforma — cada item corresponde a um
// módulo existente no produto (auditado no código: app/clientes,
// app/agendamentos, app/site, app/conteudo, app/chatbot, app/automacao,
// app/reputacao, app/metricas, app/raio-x). Nenhum número de resultado é
// inventado aqui — só o que o módulo efetivamente faz.
const CAPACIDADES = [
  {
    icon: Users,
    titulo: "Clientes",
    desc: "Cada cliente com histórico completo de atendimentos, contato rápido e busca instantânea — nada de agenda de papel ou post-it.",
  },
  {
    icon: CalendarCheck,
    titulo: "Agenda",
    desc: "Compromissos com status real — confirmado, pendente, remarcado — confirmação por WhatsApp em um clique e relatório do dia pronto para imprimir.",
  },
  {
    icon: Globe,
    titulo: "Site Premium",
    desc: "Um site profissional para o seu negócio, com serviços, equipe, galeria e depoimentos — publicado e pronto para receber clientes.",
  },
  {
    icon: Sparkles,
    titulo: "Conteúdo com IA",
    desc: "Legenda, gancho, hashtags e melhor horário de postagem gerados por inteligência artificial real para o seu Instagram, em segundos.",
  },
  {
    icon: MessageCircle,
    titulo: "Chatbot no WhatsApp",
    desc: "Responde automaticamente perguntas sobre horário, endereço e serviços — e te chama quando o cliente precisa falar com você de verdade.",
  },
  {
    icon: Zap,
    titulo: "Automação",
    desc: "Lembrete de compromisso enviado sozinho na véspera. Pedido de avaliação enviado sozinho depois do atendimento. Sem ninguém precisar lembrar.",
  },
  {
    icon: Star,
    titulo: "Reputação",
    desc: "Acompanhe quantos pedidos de avaliação foram enviados e quantos clientes responderam — sua reputação com número, não com achismo.",
  },
  {
    icon: BarChart3,
    titulo: "Métricas",
    desc: "Visão rápida de compromissos, confirmações e cancelamentos — o essencial da operação, sem planilha.",
  },
  {
    icon: ScanSearch,
    titulo: "Raio-X do Negócio",
    desc: "Uma nota de 0 a 100 para a saúde do seu negócio, com diagnóstico por inteligência artificial e a missão da semana para melhorar.",
  },
];

export default function Capacidades({ isMobile }: { isMobile: boolean }) {
  const [ref, cls] = useReveal<HTMLDivElement>();

  return (
    <section id="capacidades" style={{ padding: isMobile ? "64px 20px" : "96px 40px", background: "var(--bg)" }}>
      <div ref={ref} className={cls} style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: isMobile ? 40 : 60 }}>
          <span className="section-tag">O que já roda de verdade</span>
          <h2 className="section-title">Nove frentes. Uma única operação.</h2>
          <p className="section-lead">
            Não é uma promessa de roadmap — é o que já está em produção, organizando clientes, oportunidades,
            atendimento e a operação comercial do seu negócio todos os dias.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
            gap: 16,
          }}
        >
          {CAPACIDADES.map(({ icon: Icon, titulo, desc }) => (
            <div key={titulo} className="capacidade-card">
              <div className="capacidade-icon">
                <Icon size={20} strokeWidth={2} />
              </div>
              <h3 className="capacidade-titulo">{titulo}</h3>
              <p className="capacidade-desc">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .capacidade-card {
          padding: 26px 24px;
          border-radius: 18px;
          background: var(--surface);
          border: 1px solid rgba(255,255,255,0.07);
          transition: border-color 0.22s ease, transform 0.22s ease, background 0.22s ease;
        }
        .capacidade-card:hover {
          border-color: rgba(74,155,176,0.4);
          transform: translateY(-3px);
          background: var(--surface-strong);
        }
        .capacidade-icon {
          width: 40px; height: 40px; border-radius: 12px;
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
          color: #fff; display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px;
          box-shadow: 0 4px 16px rgba(31,78,95,0.35);
        }
        .capacidade-titulo { font-size: 16px; font-weight: 700; color: var(--text); margin: 0 0 8px; }
        .capacidade-desc { font-size: 13.5px; color: var(--muted); line-height: 1.65; margin: 0; }
      `}</style>
    </section>
  );
}
