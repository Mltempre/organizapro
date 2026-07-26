// Cálculo de horários vagos a partir do texto livre de horário de
// funcionamento (ex.: "Seg a Sex: 08h - 18h") e dos compromissos já
// ocupados no dia. Extraído de app/agendamentos/page.tsx (PDF executivo)
// para ser reutilizado também pelo Dashboard (Central de Oportunidades) —
// mesma lógica, um único lugar.
export function obterHorariosVagos(
  agendamentos: { hora: string; status: string }[],
  funcionamento?: string,
): string[] {
  if (!funcionamento) return [];
  const horas = [...funcionamento.matchAll(/(?:^|\D)([01]?\d|2[0-3])(?:[h:]([0-5]\d))?/g)]
    .map(m => Number(m[1]) * 60 + Number(m[2] || 0));
  if (horas.length < 2 || horas[1] <= horas[0]) return [];

  const ocupados = new Set(
    agendamentos
      .filter(a => !["cancelado", "faltou"].includes(a.status))
      .map(a => a.hora ? `${a.hora.substring(0, 2)}:00` : "")
  );
  const vagos: string[] = [];
  for (let minuto = horas[0]; minuto < horas[1]; minuto += 60) {
    const slot = `${String(Math.floor(minuto / 60)).padStart(2, "0")}:${String(minuto % 60).padStart(2, "0")}`;
    if (!ocupados.has(slot)) vagos.push(slot);
  }
  return vagos;
}
