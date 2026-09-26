"use client";

import Link from "next/link";
import AdminShell from "./AdminShell";
import type { AgItem, DashboardViewProps } from "./DashboardView";
import type { ResumoReceitaPerdida } from "../../lib/receita-perdida";
import type { ResumoFechamento } from "../../lib/fechamento-contabil";
import styles from "./CasaDashboard.module.css";

export type CasaDashboardProps = Pick<DashboardViewProps, "clinicaId" | "dataStr" | "saudacaoCard" | "temDados" | "missaoDoDia" | "indicadores" | "indicadoresCobranca" | "orcamentosParadosCount" | "onboarding"> & {
  outrasPrioridades: DashboardViewProps["missaoDoDia"];
  agendaHoje: AgItem[];
  receitaPerdida: ResumoReceitaPerdida;
  fechamento?: { competencia: string; resumo: ResumoFechamento | null } | null;
};

const moeda = (valor: number | null) => valor === null ? "Valor não informado" : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const rotulosRisco = {
  orcamento_parado: "Orçamentos sem resposta",
  cobranca_atrasada: "Cobranças vencidas",
  tratamento_sem_retorno: "Tratamentos sem retorno (valor estimado)",
  pedido_nao_concluido: "Pedidos não concluídos",
};

// Projeção da Casa: nenhuma consulta, regra comercial ou reordenação de sinais.
// A demonstração mantém sua superfície própria; esta recebe só a carga autenticada.
export default function CasaDashboard(props: CasaDashboardProps) {
  const { dataStr, saudacaoCard, temDados, missaoDoDia, indicadores, indicadoresCobranca,
    agendaHoje, receitaPerdida, orcamentosParadosCount, onboarding } = props;
  const agenda = agendaHoje.filter(a => a.status !== "cancelado" && a.status !== "faltou");
  const renderPrioridades = (sinais: DashboardViewProps["missaoDoDia"]) => (
<ol className={styles.prioridades}>{sinais.map(sinal => (
              <li key={sinal.id}>
                <div><span className={styles.badge}>{sinal.prioridade === "alta" ? "Alta prioridade" : sinal.prioridade === "media" ? "Atenção" : "Acompanhar"}</span>
                  <h3>{sinal.titulo}</h3>
                  {sinal.contexto && <p className={styles.cliente}>{sinal.contexto.nome}</p>}
                  <p>{sinal.motivo}</p><p className={styles.muted}>{sinal.evidencia}</p>
                  <p><strong>Próxima ação:</strong> {sinal.acaoSugerida}</p>
                </div>
                {(sinal.destinoAcao || sinal.destino) && <Link className={styles.acao} href={sinal.destinoAcao || sinal.destino!}>
                  {sinal.destinoAcao ? "Abrir acompanhamento" : sinal.destinoLabel || "Ver detalhes"} →
                </Link>}
              </li>
            ))}</ol>
  );
  const riscos = receitaPerdida.porOrigem.filter(r => r.itensComValor + r.itensSemValor > 0);
  return (
    <AdminShell title="Casa">
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
          <div className={styles.titulo}><h2 id="casa-agora">Precisa da sua atenção</h2><Link href="/copiloto">Acompanhar clientes →</Link></div>
          {missaoDoDia.length === 0 ? <p className={styles.muted}>{temDados ? "Nenhuma prioridade identificada nos dados carregados." : "As prioridades aparecerão conforme você registrar a operação."}</p> :
            renderPrioridades(missaoDoDia)}
          {props.outrasPrioridades.length > 0 && <details className={styles.maisPrioridades}><summary>Ver outras {props.outrasPrioridades.length} prioridades</summary>{renderPrioridades(props.outrasPrioridades)}</details>}
        </section>

        <section className={styles.card} aria-labelledby="casa-dinheiro">
          <div className={styles.titulo}><h2 id="casa-dinheiro">Dinheiro</h2><Link href="/financeiro">Abrir financeiro →</Link></div>
          {indicadoresCobranca ? <>
            <p className={styles.muted}>Valores das cobranças registradas. O atraso já está incluído no valor a receber.</p>
            <dl className={styles.numeros}>
              <div><dt>Recebido no mês · cobranças</dt><dd>{moeda(indicadoresCobranca.valorRecebidoMes)}</dd></div>
              <div><dt>A receber · cobranças</dt><dd>{moeda(indicadoresCobranca.valorEmAberto)}</dd></div>
              <div><dt>Em atraso</dt><dd>{moeda(indicadoresCobranca.valorEmAtraso)}</dd></div>
            </dl>
          </> : <p className={styles.muted}>Nenhuma cobrança registrada. <Link href="/cobrancas">Ver cobranças →</Link></p>}
          <div className={styles.risco}>
            <h3>Valores que merecem acompanhamento</h3>
            {riscos.length === 0 ? <p className={styles.muted}>Nenhum orçamento, cobrança, tratamento ou pedido em risco identificado.</p> : <>
              <p className={styles.muted}>Cada categoria tem seu próprio valor. Não representa receita recebida nem um total a somar.</p>
              <ul>{riscos.map(r => <li key={r.origem}><span>{rotulosRisco[r.origem]}</span><strong>{r.itensComValor > 0 ? moeda(r.totalConhecido) : "Valor não informado"}</strong>
                {r.itensSemValor > 0 && <small>{r.itensSemValor} registro(s) sem valor informado</small>}
              </li>)}</ul>
            </>}
            <nav className={styles.links} aria-label="Acompanhar dinheiro">
              <Link href="/receita-perdida">Ver valores em risco →</Link>
              <Link href="/previsor-faturamento">Ver previsão →</Link>
            </nav>
          </div>
        </section>

        {props.fechamento && (props.fechamento.resumo ? (
          <section className={styles.card} aria-labelledby="casa-fechamento">
            <div className={styles.titulo}><h2 id="casa-fechamento">Fechamento contábil</h2><Link href="/fechamento-contabil">Ver fechamentos →</Link></div>
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
        ) : <p role="status" className={styles.muted}>Resumo do fechamento contábil indisponível. <Link href="/fechamento-contabil">Ver fechamentos →</Link></p>)}

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
            <p>{orcamentosParadosCount > 0 ? `${orcamentosParadosCount} orçamento(s) apresentado(s) aguardando resposta.` : "Nenhum orçamento apresentado aguardando resposta."}</p>
            <nav className={styles.links} aria-label="Comercial"><Link href="/orcamentos">Orçamentos →</Link><Link href="/pedidos" aria-describedby="casa-ecommerce-descricao">E-commerce IA →</Link><Link href="/oportunidades">Interesses recebidos →</Link></nav>
            <p id="casa-ecommerce-descricao" className={styles.muted}>E-commerce IA: catálogo, pedidos online e inteligência comercial.</p>
            <div className={styles.risco}><h3>Avaliações solicitadas</h3>
              <p>{indicadores.avaliacoesPendentes > 0 ? `${indicadores.avaliacoesPendentes} solicitação(ões) aguardando resposta do cliente.` : "Nenhuma solicitação de avaliação aguardando resposta."}</p>
              <nav className={styles.links} aria-label="Presença"><Link href="/reputacao">Ver avaliações →</Link><Link href="/google-presenca">Presença no Google →</Link></nav>
            </div>
          </section>
        </div>
        {!onboarding.temEmpresa && <p className={styles.muted}>Seu cadastro de contato está incompleto. <Link href="/configuracoes">Completar dados da empresa →</Link></p>}
      </div>
    </AdminShell>
  );
}
