import { Icon } from "./icons";
import type { Empresa } from "../_lib/types";

// Só exibe itens amarrados a um campo real do cadastro. Se nenhum existir,
// o componente não renderiza nada — nunca preenche com dado genérico aqui.
export default function Credibilidade({ empresa, local }: { empresa: Empresa; local: string }) {
  const itens: { icone: string; texto: string }[] = [];
  if (local) itens.push({ icone: "pin", texto: local });
  if (empresa.especialidade) itens.push({ icone: "target", texto: empresa.especialidade });
  if (empresa.horario_funcionamento) itens.push({ icone: "clock", texto: empresa.horario_funcionamento });
  if (empresa.nota_google) itens.push({ icone: "star", texto: `${empresa.nota_google} ${empresa.num_avaliacoes ? `(${empresa.num_avaliacoes} avaliações)` : "no Google"}` });

  if (itens.length === 0) return null;

  return (
    <section style={{ background: "#14110D" }}>
      <div className="cred-bar" style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexWrap: "wrap" }}>
        {itens.map((it, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 28px", borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.10)" : "none", flex: "1 1 0", minWidth: 200, justifyContent: "center" }}>
            {it.icone === "pin"
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              : it.icone === "star"
                ? <Icon name="star" size={15} color="#c9962c"/>
                : <Icon name={it.icone} size={15} color="rgba(255,255,255,0.55)"/>
            }
            <span style={{ fontSize: 13.5, fontWeight: 500, color: "rgba(255,255,255,0.85)" }}>{it.texto}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
