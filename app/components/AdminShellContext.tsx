"use client";
// ── Contrato entre AdminShellFrame (chrome persistente, vive no layout
// raiz) e AdminShell (shim que cada página continua chamando exatamente
// como antes) — Gate Funcional da Navegação V1. Ver AdminShellFrame.tsx
// para o motivo desta separação (evitar remount da sidebar a cada troca
// de rota).
import { createContext, useContext } from "react";

export type AdminShellHeader = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionOnClick?: () => void;
};

export type AdminShellContextValue = {
  setHeader: (header: AdminShellHeader) => void;
};

export const AdminShellContext = createContext<AdminShellContextValue | null>(null);

export function useAdminShellContext(): AdminShellContextValue | null {
  return useContext(AdminShellContext);
}
