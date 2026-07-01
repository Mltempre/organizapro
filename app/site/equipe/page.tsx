"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminShell from "../../components/AdminShell";

type Membro = { id: string; foto_url: string|null; nome: string; especialidade: string|null; cro: string|null; descricao: string|null; ordem: number; };
type Form   = { foto_url: string; nome: string; especialidade: string; cro: string; descricao: string; };

const NAV = [
  { l:"Configuracoes", h:"/site",              i:"⚙️"  },
  { l:"Galeria",       h:"/site/galeria",      i:"📸"  },
  { l:"Equipe",        h:"/site/equipe",       i:"👥", a:true },
  { l:"Antes/Depois",  h:"/site/antes-depois", i:"✨"  },
  { l:"Depoimentos",   h:"/site/depoimentos",  i:"💬"  },
  { l:"Servicos",      h:"/site/servicos",     i:"🦷"  },
  { l:"Estrutura",     h:"/site/estrutura",    i:"🏥"  },
];

const initials = (nome: string) => nome.trim().split(" ").filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 2).join("");
const COLORS = ["#0d3d2e","#1a3a5c","#2d1b69","#7c2d12","#064e3b","#1e3a5f"];

export default function EquipeAdmin() {
  const router = useRouter();
  const [clinicaId, setClinicaId] = useState("");
  const [itens, setItens]         = useState<Membro[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState<{ mode:"add"|"edit"; item?: Membro }|null>(null);
  const [form, setForm]           = useState<Form>({ foto_url:"", nome:"", especialidade:"", cro:"", descricao:"" });
  const [uploading, setUploading] = useState(false);
  const [salvando, setSalvando]   = useState(false);
  const [erro, setErro]           = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: cu } = await supabase.from("clinica_usuarios").select("clinica_id").eq("usuario_id", user.id).maybeSingle();
    if (!cu?.clinica_id) { setLoading(false); return; }
    setClinicaId(cu.clinica_id);
    const { data } = await supabase.from("clinica_equipe").select("*").eq("clinica_id", cu.clinica_id).order("ordem");
    setItens(data ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  async function uploadFoto(file: File) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !clinicaId) return;
    setUploading(true); setErro("");
    const fd = new FormData();
    fd.append("file", file); fd.append("tipo", "equipe"); fd.append("clinica_id", clinicaId);
    const res  = await fetch("/api/upload", { method:"POST", headers:{ Authorization:`Bearer ${session.access_token}` }, body:fd });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) { setErro(data.error || "Erro no upload."); return; }
    setForm(p => ({ ...p, foto_url: data.url }));
  }

  async function salvar() {
    if (!form.nome.trim()) { setErro("Informe o nome do profissional."); return; }
    setSalvando(true); setErro("");
    const payload = {
      clinica_id:    clinicaId,
      foto_url:      form.foto_url || null,
      nome:          form.nome.trim(),
      especialidade: form.especialidade.trim() || null,
      cro:           form.cro.trim() || null,
      descricao:     form.descricao.trim() || null,
    };
    if (modal?.mode === "add") {
      const maxOrdem = itens.length ? Math.max(...itens.map(i => i.ordem)) + 1 : 0;
      const { error } = await supabase.from("clinica_equipe").insert({ ...payload, ordem: maxOrdem });
      if (error) { setErro("Erro ao salvar."); setSalvando(false); return; }
    } else if (modal?.item) {
      const { error } = await supabase.from("clinica_equipe").update(payload).eq("id", modal.item.id);
      if (error) { setErro("Erro ao salvar."); setSalvando(false); return; }
    }
    setSalvando(false); setModal(null); carregar();
  }

  async function excluir(id: string) {
    if (!window.confirm("Excluir este profissional?")) return;
    await supabase.from("clinica_equipe").delete().eq("id", id);
    carregar();
  }

  async function mover(item: Membro, dir: -1|1) {
    const sorted = [...itens].sort((a,b) => a.ordem - b.ordem);
    const idx  = sorted.findIndex(i => i.id === item.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("clinica_equipe").update({ ordem: swap.ordem }).eq("id", item.id),
      supabase.from("clinica_equipe").update({ ordem: item.ordem }).eq("id", swap.id),
    ]);
    carregar();
  }

  const sorted = [...itens].sort((a,b) => a.ordem - b.ordem);

  return (
    <AdminShell title="Equipe" subtitle="Profissionais exibidos no site publico" actionLabel="+ Adicionar Profissional" actionOnClick={() => { setForm({ foto_url:"", nome:"", especialidade:"", cro:"", descricao:"" }); setModal({ mode:"add" }); setErro(""); }}>

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
          <div style={{ fontSize:44, marginBottom:14 }}>👥</div>
          <p style={{ color:"var(--muted)", margin:0, fontSize:15 }}>Nenhum profissional cadastrado. Adicione sua equipe para exibir no site.</p>
        </div>
      )}

      {sorted.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:16 }}>
          {sorted.map((item, idx) => (
            <div key={item.id} style={{ background:"var(--surface)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, overflow:"hidden" }}>
              <div style={{ height:120, background:`linear-gradient(135deg,${COLORS[idx % COLORS.length]},#0f172a)`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {item.foto_url
                  ? <img src={item.foto_url} alt={item.nome} style={{ width:80, height:80, borderRadius:"50%", objectFit:"cover", border:"2.5px solid rgba(255,255,255,0.2)" }} />
                  : <div style={{ width:68, height:68, borderRadius:"50%", background:"rgba(255,255,255,0.12)", border:"2px solid rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:800, color:"#fff" }}>{initials(item.nome)}</div>
                }
              </div>
              <div style={{ padding:"12px 14px" }}>
                <div style={{ fontSize:14, fontWeight:700, color:"#f1f5f9", marginBottom:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.nome}</div>
                {item.especialidade && <div style={{ fontSize:12, color:"#00c896", marginBottom:4 }}>{item.especialidade}</div>}
                {item.cro && <div style={{ fontSize:11, color:"#64748b", marginBottom:8 }}>CRO: {item.cro}</div>}
                <div style={{ display:"flex", gap:5 }}>
                  <button onClick={() => mover(item,-1)} disabled={idx===0} style={{ padding:"5px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#64748b", fontSize:12, cursor:"pointer" }}>↑</button>
                  <button onClick={() => mover(item, 1)} disabled={idx===sorted.length-1} style={{ padding:"5px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#64748b", fontSize:12, cursor:"pointer" }}>↓</button>
                  <button onClick={() => { setForm({ foto_url:item.foto_url??"", nome:item.nome, especialidade:item.especialidade??"", cro:item.cro??"", descricao:item.descricao??"" }); setModal({ mode:"edit", item }); setErro(""); }} style={{ flex:1, padding:"5px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#94a3b8", fontSize:12, cursor:"pointer" }}>Editar</button>
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
            <h3 style={{ fontSize:17, fontWeight:700, color:"#f1f5f9", margin:"0 0 20px" }}>{modal.mode==="add" ? "Adicionar Profissional" : "Editar Profissional"}</h3>
            {erro && <div style={{ background:"rgba(239,68,68,0.10)", border:"1px solid rgba(239,68,68,0.3)", color:"#f87171", borderRadius:8, padding:"8px 12px", marginBottom:14, fontSize:13 }}>{erro}</div>}

            {/* Foto */}
            <div style={{ marginBottom:16, cursor:"pointer", border:"2px dashed rgba(255,255,255,0.12)", borderRadius:12, overflow:"hidden", position:"relative", height:130, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={() => fileRef.current?.click()}>
              {form.foto_url
                ? <img src={form.foto_url} alt="preview" style={{ width:100, height:100, borderRadius:"50%", objectFit:"cover" }} />
                : <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, color:"#475569" }}>
                    <span style={{ fontSize:28 }}>👤</span>
                    <span style={{ fontSize:12 }}>Foto do profissional (opcional)</span>
                  </div>
              }
              {uploading && <div style={{ position:"absolute", inset:0, background:"rgba(10,13,20,0.82)", display:"flex", alignItems:"center", justifyContent:"center", color:"#c4b5fd", fontSize:14, fontWeight:600 }}>Enviando...</div>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => e.target.files?.[0] && uploadFoto(e.target.files[0])} />

            {[
              { label:"Nome *", key:"nome", placeholder:"Dr. João Silva" },
              { label:"Especialidade", key:"especialidade", placeholder:"Ortodontia" },
              { label:"CRO", key:"cro", placeholder:"CRO-SP 12345" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:12 }}>
                <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:6 }}>{f.label}</label>
                <input value={form[f.key as keyof Form]} onChange={e => setForm(p => ({...p, [f.key]:e.target.value}))} placeholder={f.placeholder} className="input-field" />
              </div>
            ))}

            <div style={{ marginBottom:22 }}>
              <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:6 }}>Mini descricao</label>
              <textarea value={form.descricao} onChange={e => setForm(p => ({...p, descricao:e.target.value}))} placeholder="Especialista com 10 anos de experiencia..." className="input-field" style={{ resize:"vertical", minHeight:70 }} />
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setModal(null)} className="button-secondary" style={{ flex:1, padding:12, fontSize:14 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando||uploading} className="button-primary" style={{ flex:2, padding:12, fontSize:14 }}>
                {salvando ? "Salvando..." : "Salvar Profissional"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
