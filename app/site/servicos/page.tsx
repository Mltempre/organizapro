"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminShell from "../../components/AdminShell";

type Item = { id: string; icone: string; imagem_url: string|null; nome: string; descricao: string|null; ordem: number; };
type Form = { icone: string; imagem_url: string; nome: string; descricao: string; };

const NAV = [
  { l:"Configuracoes", h:"/site",              i:"⚙️"  },
  { l:"Galeria",       h:"/site/galeria",      i:"📸"  },
  { l:"Equipe",        h:"/site/equipe",       i:"👥"  },
  { l:"Antes/Depois",  h:"/site/antes-depois", i:"✨"  },
  { l:"Depoimentos",   h:"/site/depoimentos",  i:"💬"  },
  { l:"Servicos",      h:"/site/servicos",     i:"🛠️", a:true },
  { l:"Estrutura",     h:"/site/estrutura",    i:"🏢"  },
];

const ICONS = [
  { key:"tooth",       emoji:"⭐", label:"Destaque"    },
  { key:"smile",       emoji:"😊", label:"Atendimento" },
  { key:"gem",         emoji:"💎", label:"Premium"     },
  { key:"microscope",  emoji:"🔍", label:"Detalhes"    },
  { key:"shield",      emoji:"🛡️", label:"Garantia"    },
  { key:"sparkle",     emoji:"✨", label:"Especial"    },
  { key:"heart",       emoji:"❤️", label:"Cuidado"     },
  { key:"clinic",      emoji:"🏢", label:"Negocio"     },
];

const ICON_COLORS: Record<string, string> = {
  tooth:"#00c896", smile:"#3b82f6", gem:"#8b5cf6",
  microscope:"#f59e0b", shield:"#ef4444", sparkle:"#06b6d4",
  heart:"#ec4899", clinic:"#10b981",
};

export default function ServicosAdmin() {
  const router = useRouter();
  const [clinicaId, setClinicaId] = useState("");
  const [itens, setItens]         = useState<Item[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState<{ mode:"add"|"edit"; item?: Item }|null>(null);
  const [form, setForm]           = useState<Form>({ icone:"tooth", imagem_url:"", nome:"", descricao:"" });
  const [uploading, setUploading] = useState(false);
  const [salvando, setSalvando]   = useState(false);
  const [erro, setErro]           = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: cu } = await supabase.from("clinica_usuarios").select("clinica_id").eq("usuario_id", user.id).maybeSingle();
      if (!cu?.clinica_id) { return; }
      setClinicaId(cu.clinica_id);
      const { data } = await supabase.from("clinica_servicos").select("*").eq("clinica_id", cu.clinica_id).order("ordem");
      setItens(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  async function uploadImg(file: File) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !clinicaId) return;
    setUploading(true); setErro("");
    const fd = new FormData();
    fd.append("file", file); fd.append("tipo", "servico"); fd.append("clinica_id", clinicaId);
    const res  = await fetch("/api/upload", { method:"POST", headers:{ Authorization:`Bearer ${session.access_token}` }, body:fd });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) { setErro(data.error || "Erro no upload."); return; }
    setForm(p => ({ ...p, imagem_url: data.url }));
  }

  async function salvar() {
    if (!form.nome.trim()) { setErro("Informe o nome do servico."); return; }
    setSalvando(true); setErro("");
    const payload = { clinica_id:clinicaId, icone:form.icone, imagem_url:form.imagem_url||null, nome:form.nome.trim(), descricao:form.descricao.trim()||null };
    if (modal?.mode === "add") {
      const maxOrdem = itens.length ? Math.max(...itens.map(i => i.ordem)) + 1 : 0;
      const { error } = await supabase.from("clinica_servicos").insert({ ...payload, ordem:maxOrdem });
      if (error) { setErro("Erro ao salvar."); setSalvando(false); return; }
    } else if (modal?.item) {
      const { error } = await supabase.from("clinica_servicos").update(payload).eq("id", modal.item.id);
      if (error) { setErro("Erro ao salvar."); setSalvando(false); return; }
    }
    setSalvando(false); setModal(null); carregar();
  }

  async function excluir(id: string) {
    if (!window.confirm("Excluir este servico?")) return;
    await supabase.from("clinica_servicos").delete().eq("id", id);
    carregar();
  }

  async function mover(item: Item, dir: -1|1) {
    const sorted = [...itens].sort((a,b) => a.ordem - b.ordem);
    const idx  = sorted.findIndex(i => i.id === item.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("clinica_servicos").update({ ordem: swap.ordem }).eq("id", item.id),
      supabase.from("clinica_servicos").update({ ordem: item.ordem }).eq("id", swap.id),
    ]);
    carregar();
  }

  const sorted = [...itens].sort((a,b) => a.ordem - b.ordem);
  const cor = (icone: string) => ICON_COLORS[icone] ?? "#00c896";

  return (
    <AdminShell title="Servicos" subtitle="Servicos exibidos no site" actionLabel="+ Adicionar Servico" actionOnClick={() => { setForm({ icone:"tooth", imagem_url:"", nome:"", descricao:"" }); setModal({ mode:"add" }); setErro(""); }}>

      <nav style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:24 }}>
        {NAV.map(m => (
          <button key={m.h} onClick={() => router.push(m.h)} style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${m.a ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.08)"}`, background:m.a ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.02)", color:m.a ? "#c4b5fd" : "#64748b", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:6, fontWeight:m.a ? 600 : 400, whiteSpace:"nowrap" }}>
            {m.i} {m.l}
          </button>
        ))}
      </nav>

      {loading && <p style={{ color:"var(--muted)" }}>Carregando...</p>}

      {!loading && itens.length === 0 && (
        <div className="panel" style={{ textAlign:"center", padding:"52px 20px" }}>
          <div style={{ fontSize:44, marginBottom:14 }}>🛠️</div>
          <p style={{ color:"var(--muted)", margin:0, fontSize:15 }}>Nenhum servico cadastrado. Adicione seus servicos para exibir no site.</p>
        </div>
      )}

      {sorted.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:16 }}>
          {sorted.map((item, idx) => (
            <div key={item.id} style={{ background:"var(--surface)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, overflow:"hidden" }}>
              {item.imagem_url && (
                <div style={{ height:110, overflow:"hidden" }}>
                  <img src={item.imagem_url} alt={item.nome} style={{ width:"100%", height:"100%", objectFit:"cover" }} loading="lazy" />
                </div>
              )}
              <div style={{ padding:"14px 14px 10px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <div style={{ width:38, height:38, borderRadius:10, background:`${cor(item.icone)}20`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                    {ICONS.find(i => i.key === item.icone)?.emoji ?? "🛠️"}
                  </div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#f1f5f9" }}>{item.nome}</div>
                </div>
                {item.descricao && <p style={{ fontSize:12, color:"#64748b", lineHeight:1.6, margin:"0 0 10px" }}>{item.descricao}</p>}
                <div style={{ display:"flex", gap:5 }}>
                  <button onClick={() => mover(item,-1)} disabled={idx===0} style={{ padding:"5px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#64748b", fontSize:12, cursor:"pointer" }}>↑</button>
                  <button onClick={() => mover(item, 1)} disabled={idx===sorted.length-1} style={{ padding:"5px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#64748b", fontSize:12, cursor:"pointer" }}>↓</button>
                  <button onClick={() => { setForm({ icone:item.icone, imagem_url:item.imagem_url??"", nome:item.nome, descricao:item.descricao??"" }); setModal({ mode:"edit", item }); setErro(""); }} style={{ flex:1, padding:"5px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#94a3b8", fontSize:12, cursor:"pointer" }}>Editar</button>
                  <button onClick={() => excluir(item.id)} style={{ padding:"5px 8px", borderRadius:6, border:"1px solid rgba(239,68,68,0.3)", background:"transparent", color:"#f87171", fontSize:12, cursor:"pointer" }}>✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(6px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={() => setModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#0a0d14", border:"1px solid rgba(255,255,255,0.10)", borderRadius:20, padding:"28px 24px", maxWidth:480, width:"100%", maxHeight:"90vh", overflowY:"auto" }}>
            <h3 style={{ fontSize:17, fontWeight:700, color:"#f1f5f9", margin:"0 0 20px" }}>{modal.mode==="add" ? "Adicionar Servico" : "Editar Servico"}</h3>
            {erro && <div style={{ background:"rgba(239,68,68,0.10)", border:"1px solid rgba(239,68,68,0.3)", color:"#f87171", borderRadius:8, padding:"8px 12px", marginBottom:14, fontSize:13 }}>{erro}</div>}

            {/* Icone picker */}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:8 }}>Icone</label>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                {ICONS.map(ic => (
                  <button key={ic.key} type="button" onClick={() => setForm(p => ({...p, icone:ic.key}))}
                    style={{ padding:"10px 6px", borderRadius:10, border:`1.5px solid ${form.icone === ic.key ? cor(ic.key) : "rgba(255,255,255,0.08)"}`, background:form.icone === ic.key ? `${cor(ic.key)}18` : "rgba(255,255,255,0.02)", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    <span style={{ fontSize:20 }}>{ic.emoji}</span>
                    <span style={{ fontSize:10, color: form.icone === ic.key ? cor(ic.key) : "#64748b", fontWeight:600 }}>{ic.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Imagem opcional */}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:6 }}>Imagem ilustrativa (opcional)</label>
              <div onClick={() => fileRef.current?.click()} style={{ border:"2px dashed rgba(255,255,255,0.10)", borderRadius:10, height:100, overflow:"hidden", cursor:"pointer", position:"relative", display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(255,255,255,0.02)" }}>
                {form.imagem_url ? <img src={form.imagem_url} alt="preview" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <span style={{ fontSize:13, color:"#334155" }}>Clique para enviar imagem</span>}
                {uploading && <div style={{ position:"absolute", inset:0, background:"rgba(10,13,20,0.82)", display:"flex", alignItems:"center", justifyContent:"center", color:"#c4b5fd", fontSize:13 }}>Enviando...</div>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => e.target.files?.[0] && uploadImg(e.target.files[0])} />
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:6 }}>Nome do servico *</label>
              <input value={form.nome} onChange={e => setForm(p => ({...p, nome:e.target.value}))} placeholder="Ex: Corte de Cabelo, Consultoria Financeira..." className="input-field" />
            </div>
            <div style={{ marginBottom:22 }}>
              <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:6 }}>Descricao</label>
              <textarea value={form.descricao} onChange={e => setForm(p => ({...p, descricao:e.target.value}))} placeholder="Descreva o que torna esse servico especial..." className="input-field" style={{ resize:"vertical", minHeight:70 }} />
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setModal(null)} className="button-secondary" style={{ flex:1, padding:12, fontSize:14 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando||uploading} className="button-primary" style={{ flex:2, padding:12, fontSize:14 }}>
                {salvando ? "Salvando..." : "Salvar Servico"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
