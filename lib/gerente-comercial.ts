import { gerarEstadoComercialCanonico, type SinalCanonico } from './nucleo-inteligente';
import type { ResumoReceitaPerdida } from './receita-perdida';
import type { CasoAgendaAutonoma } from './agenda-autonoma';

export type AtencaoComercial = {
  sinal: SinalCanonico;
  impacto: { valor: number | null; descricao: string };
  destinoAcao: string | null;
};

/** Projeção de leitura: prioridade/deduplicação pertencem ao núcleo;
 * dinheiro pertence à Receita Perdida; execução pertence ao fluxo original.
 * Nunca associa dinheiro por nome/telefone nem soma domínios sobrepostos. */
export function coordenarGerenteComercial(
  sinais: SinalCanonico[],
  receita: ResumoReceitaPerdida | null,
  agenda: CasoAgendaAutonoma[] = [],
): AtencaoComercial[] {
  return gerarEstadoComercialCanonico(sinais).sinais.map(sinal => {
    const item = receita?.itens.find(i => i.origem === sinal.tipo && i.id === sinal.entidadeId);
    const valor = item?.valor != null && Number.isFinite(item.valor) && item.valor >= 0 ? item.valor : null;
    const casoAgenda = agenda.find(c => c.tipo === sinal.tipo && c.id === sinal.entidadeId);
    return {
      sinal,
      impacto: {
        valor,
        descricao: valor === null
          ? (sinal.apresentacao?.impacto || sinal.acaoSugerida)
          : item?.origem === 'tratamento_sem_retorno'
            ? 'Valor estimado registrado no tratamento em risco; não é receita confirmada.'
            : 'Valor registrado em risco; não é receita confirmada.',
      },
      destinoAcao: sinal.destinoAcao || casoAgenda?.destino || sinal.destino || null,
    };
  });
}
