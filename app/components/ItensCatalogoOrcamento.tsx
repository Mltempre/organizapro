'use client';

import React, { useState } from 'react';
import { comporOrcamentoDoCatalogo, type ItemCatalogo } from '../../lib/catalogo-comercial';

// ── Itens do catálogo num orçamento ──────────────────────────────────────
// Um único seletor, usado no "Novo orçamento" (/orcamentos) e no "Gerar
// orçamento" de uma oportunidade (/oportunidades). Só compõe descrição e
// valor pela soma dos preços do catálogo (comporOrcamentoDoCatalogo); quem
// usa decide o que fazer com eles — os dois campos continuam editáveis e
// o catálogo continua opcional. Nenhuma escrita, nenhuma API nova.

export type ItemCatalogoOrcamento = Pick<ItemCatalogo, 'id' | 'nome' | 'preco_centavos' | 'disponivel'>;
export type ItemEscolhidoOrcamento = { servicoId: string; quantidade: number };

function formatarValor(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

export default function ItensCatalogoOrcamento({ catalogo, itens, onItens, onErro }: {
  catalogo: ItemCatalogoOrcamento[];
  itens: ItemEscolhidoOrcamento[];
  // procedimento/valor: descrição e total (em reais, com 2 casas) já compostos.
  onItens: (itens: ItemEscolhidoOrcamento[], composto: { procedimento: string; valor: string }) => void;
  onErro: (mensagem: string) => void;
}) {
  const [itemEscolhido, setItemEscolhido] = useState('');
  const [qtdEscolhida, setQtdEscolhida]   = useState('1');

  // Itens do catálogo (ex.: peça + mão de obra): preenchem descrição e valor
  // pela soma dos preços cadastrados. Os dois campos continuam editáveis.
  function aplicarItens(novos: ItemEscolhidoOrcamento[]) {
    const { descricao, totalCentavos } = comporOrcamentoDoCatalogo(novos.flatMap(i => {
      const c = catalogo.find(x => x.id === i.servicoId);
      return c ? [{ nome: c.nome, preco_centavos: c.preco_centavos ?? 0, quantidade: i.quantidade }] : [];
    }));
    onItens(novos, { procedimento: descricao, valor: totalCentavos > 0 ? (totalCentavos / 100).toFixed(2) : '' });
  }

  function adicionarItem() {
    const quantidade = Number(qtdEscolhida);
    if (!itemEscolhido) return;
    if (!Number.isInteger(quantidade) || quantidade <= 0) { onErro('Quantidade deve ser um número inteiro maior que zero.'); return; }
    onErro('');
    const existente = itens.find(i => i.servicoId === itemEscolhido);
    aplicarItens(existente
      ? itens.map(i => i.servicoId === itemEscolhido ? { ...i, quantidade: i.quantidade + quantidade } : i)
      : [...itens, { servicoId: itemEscolhido, quantidade }]);
    setItemEscolhido(''); setQtdEscolhida('1');
  }

  return (
    <div data-testid="orcamento-itens-catalogo">
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Itens do catálogo (opcional)</label>
      {catalogo.length === 0 ? (
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
          Nenhum item com preço no catálogo. <a href="/pedidos" style={{ color: '#38bdf8' }}>Cadastrar em Catálogo e Pedidos</a> ou descreva abaixo.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={itemEscolhido}
              onChange={e => setItemEscolhido(e.target.value)}
              aria-label="Item do catálogo"
              style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            >
              <option value="">Produto ou serviço…</option>
              {catalogo.map(c => <option key={c.id} value={c.id}>{c.nome} — {formatarValor((c.preco_centavos ?? 0) / 100)}</option>)}
            </select>
            <input
              type="number" min="1" step="1"
              value={qtdEscolhida}
              onChange={e => setQtdEscolhida(e.target.value)}
              aria-label="Quantidade"
              style={{ width: 64, padding: '10px 8px', borderRadius: 8, border: '1px solid #2d3148', background: '#0f1117', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
            <button
              type="button"
              onClick={adicionarItem}
              disabled={!itemEscolhido}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3148', background: 'transparent', color: '#e2e8f0', fontSize: 13, cursor: itemEscolhido ? 'pointer' : 'not-allowed', opacity: itemEscolhido ? 1 : 0.5 }}
            >
              + Adicionar
            </button>
          </div>
          {itens.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {itens.map(i => {
                const c = catalogo.find(x => x.id === i.servicoId);
                if (!c) return null;
                return (
                  <li key={i.servicoId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13, color: '#e2e8f0' }}>
                    <span>{i.quantidade}× {c.nome}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {formatarValor(((c.preco_centavos ?? 0) * i.quantidade) / 100)}
                      <button
                        type="button"
                        onClick={() => aplicarItens(itens.filter(x => x.servicoId !== i.servicoId))}
                        aria-label={`Remover ${c.nome}`}
                        style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}
                      >
                        ✕
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p style={{ fontSize: 12, color: '#64748b', margin: '8px 0 0' }}>
            Combine produtos e mão de obra. Descrição e valor são preenchidos pela soma dos preços do catálogo e podem ser ajustados.
          </p>
        </>
      )}
    </div>
  );
}
