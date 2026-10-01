"use client";

import Link from "next/link";
import AdminShell from "./AdminShell";
import type { AgItem, DashboardViewProps } from "./DashboardView";
import type { ResumoReceitaPerdida } from "../../lib/receita-perdida";
import type { ResumoFechamento } from "../../lib/fechamento-contabil";
import { DIAS_PARA_CONSIDERAR_PARADO } from "../../lib/motor-orcamentos";
import styles from "./CasaDashboard.module.css";

export type CasaDashboardProps = Pick<DashboardViewProps, "clinicaId" | "dataStr" | "saudacaoCard" | "temDados" | "missaoDoDia" | "indicadores" | "indicadoresCobranca" | "orcamentosParadosCount" | "onboarding"> & {
  outrasPrioridades: DashboardViewProps["missaoDoDia"];
  agendaHoje: AgItem[];
  receitaPerdida: ResumoReceitaPerdida;
  fechamento?: { competencia: string; resumo: ResumoFechamento | null } | null;
  /** Estoque V1: quantidade de itens com saldo no mínimo ou abaixo (0 = sem alerta). */
  estoqueBaixo?: number;
};

const moeda = (valor: number | null) => valor === null ? "Valor não informado" : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Projeção da Casa: nenhuma consulta, regra comercial ou reordenação de sinais.
// A demonstração mantém sua superfície própria; esta recebe só a carga autenticada.
export default function CasaDashboard(props: CasaDashboardProps) {
  const { dataStr, saudacaoCard, temDados, missaoDoDia, indicadores, indicadoresCobranca,
    agendaHoje, receitaPerdida, orcamentosParadosCount, onboarding } = props;
  const agenda = agendaHoje.filter(a => a.status !== "cancelado" && a.status !== "faltou");
  // Limpeza GO 1 (2026-10-01): a Casa mostra só o RESUMO das prioridades — a
  // lista completa (motivo, evidência, cliente, próxima ação) pertence ao
  // Gerente Comercial (/copiloto), que a exibe inteira com impacto e ação.
  const totalPrioridades = missaoDoDia.length + props.outrasPrioridades.length;
  const primeiraPrioridade = missaoDoDia[0] ?? props.outrasPrioridades[0];
  return (
    <AdminShell title="Visão Geral">
      <div className={styles.casa}>
        <header className={styles.cabecalho}>
          <div><p className={styles.muted}>{dataStr}</p><h1>{saudacaoCard.linha1}</h1>
            <p>{temDados ? "Veja as prioridades e os resultados registrados do seu negócio." : "Comece cadastrando seus clientes e compromissos."}</p>
          </div>
          <nav aria-label="Cadastrar" className={styles.links}>
            <Link href="/clientes?novo=1">Novo cliente</Link>
            <Link href="/agendamentos?novo=1">Novo agendamento</Link>
          </nav>
        </header>

        <section className={styles.card} aria-labelledby="casa-agora">
          <div className={styles.titulo}><h2 id="casa-agora">Precisa da sua atenção</h2><Link href="/copiloto">Abrir Gerente Comercial →</Link></div>
          {totalPrioridades === 0 || !primeiraPrioridade ? <p className={styles.muted}>{temDados ? "Nenhuma prioridade identificada nos dados carregados." : "As prioridades aparecerão conforme você registrar a operação."}</p> :
            <p>{totalPrioridades === 1 ? "1 prioridade identificada" : `${totalPrioridades} prioridades identificadas`} — a mais urgente: <strong>{primeiraPrioridade.titulo}</strong>{primeiraPrioridade.contexto?.nome ? ` (${primeiraPrioridade.contexto.nome})` : ""}. A lista completa está no Gerente Comercial.</p>}
        </section>

        <section className={styles.card} aria-labelledby="casa-dinheiro">
          <div className={styles.titulo}><h2 id="casa-dinheiro">Dinheiro</h2><Link href="/financeiro">Abrir Dinheiro →</Link></div>
          {indicadoresCobranca ? <>
            <p className={styles.muted}>Valores das cobranças registradas. Cobranças vencidas já estão incluídas no valor a receber.</p>
            <dl className={styles.numeros}>
              <div><dt>Recebido no mês · cobranças</dt><dd>{moeda(indicadoresCobranca.valorRecebidoMes)}</dd></div>
              <div><dt>A receber · cobranças</dt><dd>{moeda(indicadoresCobranca.valorEmAberto)}</dd></div>
            </dl>
          </> : <p className={styles.muted}>Nenhuma cobrança registrada. <Link href="/cobrancas">Ver cobranças →</Link></p>}
          {/* Limpeza GO 1: o detalhamento por categoria ("Valores que merecem
              acompanhamento") e os atalhos saíram da Casa — o detalhe vive na
              Receita Perdida e o total também aparece no Dinheiro (menu lateral).
              Aqui fica só o total em risco, em uma linha. */}
          {receitaPerdida.totalConhecido > 0 &&
            <p className={styles.muted}>Em risco: {moeda(receitaPerdida.totalConhecido)} em {receitaPerdida.totalItensComValor} {receitaPerdida.totalItensComValor === 1 ? "item" : "itens"} (detalhamento na Receita Perdida, no menu).</p>}
        </section>

        {!!props.estoqueBaixo && props.estoqueBaixo > 0 && (
          <p role="status" className={styles.muted} data-testid="alerta-estoque-baixo">
            <strong>Estoque baixo:</strong> {props.estoqueBaixo} {props.estoqueBaixo === 1 ? "produto chegou" : "produtos chegaram"} ao estoque mínimo. <Link href="/estoque">Abrir Estoque →</Link>
          </p>
        )}

        {props.fechamento && (props.fechamento.resumo ? (
          <section className={styles.card} aria-labelledby="casa-fechamento">
            <div className={styles.titulo}><h2 id="casa-fechamento">Fechamento contábil</h2><Link href="/fechamento-contabil">Ver Fechamento Contábil →</Link></div>
            <p className={styles.muted}>Competência {props.fechamento.competencia.split("-").reverse().join("/")}</p>
            {props.fechamento.resumo.clientes.length === 0 ? <p className={styles.muted}>Nenhum cliente ativo para acompanhar nesta competência.</p> :
              props.fechamento.resumo.clientes.every(cliente => cliente.checklist.length === 0) ? <p className={styles.muted}>Nenhum documento obrigatório definido para os clientes. Revise a configuração em Ver fechamentos.</p> : (
                <dl className={`${styles.numeros} ${styles.fechamentoNumeros}`}>
                  <div><dt>Prontos</dt><dd>{props.fechamento.resumo.prontos}</dd></div>
                  <div><dt>Pendentes</dt><dd>{props.fechamento.resumo.pendentes}</dd></div>
                  <div><dt>Bloqueados</dt><dd>{props.fechamento.resumo.bloqueados}</dd></div>
                  {props.fechamento.resumo.emRevisao > 0 && <div><dt>Em revisão</dt><dd>{props.fechamento.resumo.emRevisao}</dd></div>}
                </dl>
              )}
          </section>
        ) : <p role="status" className={styles.muted}>Resumo do fechamento contábil indisponível. <Link href="/fechamento-contabil">Ver Fechamento Contábil →</Link></p>)}

        <div className={styles.duasColunas}>
          <section className={styles.card} aria-labelledby="casa-agenda">
            <div className={styles.titulo}><h2 id="casa-agenda">Agenda de hoje</h2><Link href="/agendamentos">Abrir agenda →</Link></div>
            <p>{indicadores.compromissosHoje} compromisso(s) · {indicadores.pendentes} aguardando confirmação</p>
            {agenda.length === 0 ? <p className={styles.muted}>Nenhum compromisso ativo hoje.</p> : <ul className={styles.agenda}>{agenda.slice(0, 3).map(a => <li key={a.id}>
              <time>{a.hora.slice(0, 5)}</time><span>{a.paciente_nome}<small>{a.status === "agendado" ? "Aguardando confirmação" : a.status === "confirmado" ? "Confirmado" : a.status === "concluido" ? "Concluído" : a.status}</small></span>
            </li>)}</ul>}
            {agenda.length > 3 && <p className={styles.muted}>Mais {agenda.length - 3} compromisso(s) na agenda.</p>}
            {indicadores.atrasados > 0 && <Link href="/agendamentos?filtro=historico">Revisar até {indicadores.atrasados} compromisso(s) anteriores sem conclusão →</Link>}
          </section>
          <section className={styles.card} aria-labelledby="casa-comercial">
            <h2 id="casa-comercial">Comercial e presença</h2>
            {/* Limpeza GO 1: os atalhos (Orçamentos, Catálogo e Pedidos,
                Oportunidades, Reputação, Google Presença) saíram daqui — são
                navegação pura, já disponível no menu lateral. Ficam as contagens. */}
            <p>{orcamentosParadosCount > 0 ? `${orcamentosParadosCount} orçamento(s) apresentado(s) aguardando resposta (todos, inclusive os enviados há menos de ${DIAS_PARA_CONSIDERAR_PARADO} dias).` : "Nenhum orçamento apresentado aguardando resposta."}</p>
            <div className={styles.risco}><h3>Avaliações solicitadas</h3>
              <p>{indicadores.avaliacoesPendentes > 0 ? `${indicadores.avaliacoesPendentes} solicitação(ões) aguardando resposta do cliente.` : "Nenhuma solicitação de avaliação aguardando resposta."}</p>
            </div>
          </section>
        </div>
        {!onboarding.temEmpresa && <p className={styles.muted}>Seu cadastro de contato está incompleto. <Link href="/configuracoes">Completar dados da empresa →</Link></p>}
      </div>
    </AdminShell>
  );
}
