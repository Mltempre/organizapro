import type { ComponentType } from "react";
import type { ModeloId } from "../_lib/modelos";
import type { PropsDoSite } from "./types";
import Aurora from "./aurora";
import Vertice from "./vertice";
import Pulse from "./pulse";

// ── Registro dos modelos visuais ──────────────────────────────────────────
//
// Um id → um shell de composição. O fallback é sempre Aurora: um modelo sem
// shell implementado (ou um valor inesperado) nunca deixa o visitante sem
// página — degrada para a composição mais neutra, sem erro e sem 404.
const SHELLS: Partial<Record<ModeloId, ComponentType<PropsDoSite>>> = {
  aurora: Aurora,
  vertice: Vertice,
  pulse: Pulse,
};

export function shellDoModelo(modelo: ModeloId): ComponentType<PropsDoSite> {
  return SHELLS[modelo] ?? Aurora;
}
