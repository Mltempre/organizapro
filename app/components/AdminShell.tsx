"use client";
// ── AdminShell — shim de compatibilidade (Gate Funcional da Navegação V1) ──
// Antes deste gate, este componente RENDERIZAVA a sidebar inteira — cada
// page.tsx que chamava <AdminShell> montava sua PRÓPRIA cópia, e cada
// navegação desmontava/remontava tudo (causa raiz do "sidebar não
// permanece estável" identificado na auditoria). A chrome persistente
// (sidebar + barra de topo) agora vive em AdminShellFrame.tsx, montada
// uma única vez em app/layout.tsx (via ShellGate).
//
// Este componente continua com a MESMA assinatura pública (title,
// subtitle, actionLabel, actionOnClick, children) — nenhuma das páginas
// que já chamam <AdminShell title="..." subtitle="...">{conteúdo}</AdminShell>
// precisou mudar uma linha. Ele só empurra o cabeçalho para a chrome via
// Context e devolve {children} direto, sem nenhum wrapper visual próprio.
import { ReactNode, useEffect } from "react";
import { useAdminShellContext } from "./AdminShellContext";

interface AdminShellProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionOnClick?: () => void;
  children: ReactNode;
}

export default function AdminShell({ title, subtitle, actionLabel, actionOnClick, children }: AdminShellProps) {
  const ctx = useAdminShellContext();

  // Gate Funcional da Navegação V1 — bug real encontrado e corrigido
  // nesta missão: a primeira versão deste efeito não tinha array de
  // dependências ("mantém sempre em sincronia") — setHeader() atualiza
  // estado no AdminShellFrame (ancestral), que re-renderiza {children},
  // que re-executa ESTE efeito de novo (sem dependências, roda em TODO
  // render) — loop infinito ("Maximum update depth exceeded", confirmado
  // no console durante a auditoria funcional, era a causa do indicador
  // vermelho "1 Issue"). AdminShellFrame.setHeader também descarta
  // atualizações sem mudança real (defesa em profundidade), mas o array
  // de dependências aqui é quem realmente impede o próprio efeito de
  // re-disparar sem necessidade.
  useEffect(() => {
    ctx?.setHeader({ title, subtitle, actionLabel, actionOnClick });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ctx é o Provider (estável no ciclo de vida da árvore); incluí-lo forçaria re-execução a cada render de qualquer consumidor do Context, reintroduzindo o mesmo risco.
  }, [title, subtitle, actionLabel, actionOnClick]);

  return <>{children}</>;
}
