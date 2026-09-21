"use client";
// ── ShellGate — decide, pela rota atual, se a chrome persistente
// (AdminShellFrame) envolve a página (Gate Funcional da Navegação V1).
// Vive em app/layout.tsx (raiz real do Next.js, nunca desmonta entre
// navegações client-side) — é isso que torna a sidebar de fato
// persistente, ao contrário do AdminShell antigo (montado dentro de cada
// page.tsx). Páginas públicas (/, /site institucional de marketing não
// confundir com o /site de edição — ver nota abaixo, /blog, /login,
// /reset-password, /empresa/[slug], /r/[codigo]) nunca recebem a sidebar
// interna — ROTAS_COM_SHELL é a mesma lista (derivada de navGrupos) que
// já define o menu, nunca uma segunda fonte de verdade.
import { usePathname } from "next/navigation";
import AdminShellFrame, { ROTAS_COM_SHELL } from "./AdminShellFrame";

function rotaTemShell(pathname: string): boolean {
  return ROTAS_COM_SHELL.some((rota) => pathname === rota || pathname.startsWith(rota + "/"));
}

export default function ShellGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (!rotaTemShell(pathname)) return <>{children}</>;
  return <AdminShellFrame>{children}</AdminShellFrame>;
}
