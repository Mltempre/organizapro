const fs = require('fs');
const code = `"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const nav = [{l:"Dashboard",h:"/"},{l:"Agenda",h:"/agendamentos"},{l:"Pacientes",h:"/pacientes"},{l:"Automacoes",h:"/automacao"},{l:"Conteudo IA",h:"/conteudo"}];

const tipos = [
  {id:"legenda", icon:"✍️", label:"Gerar Legenda", desc:"Descreva sua foto ou vídeo e receba uma legenda profissional"},
  {id:"ideias", icon:"💡", label:"Ideias de Posts", desc:"Receba sugestões de conteúdo para a semana"},
  {id:"hashtags", icon:"#️⃣", label:"Hashtags", desc:"Hashtags ideais para seu nicho e cidade"},
  {id:"calendario", icon:"📅", label:"Calendário de Conteúdo", desc:"Plano de posts para o mês"},
  {id:"briefing", icon:"📸", label:"Plano de Conteúdo da Semana", desc:"O que fotografar essa semana na clínica"},
];

export default function Conteudo() {
  const router = useRouter();
  const [tipoSel, setTipoSel] = useState(tipos[0]);
  const [input, setInput] = useState("");
  const [cidade, setCidade] = useState("");
  const [especialidade, setEspecialidade] = useState("Odontologia");
  const [resultado, setResultado] = useState("");
  const [loading, setLoading] = useState(false);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function gerar() {
    if (!input && tipoSel.id === "legenda") return;
    setLoading(true);
    setResultado("");

    const prompts: Record<string, string> = {
      legenda: \`Você é um especialista em marketing digital para clínicas de \${especialidade}. Crie uma legenda profissional, humanizada e premium para Instagram baseada nessa descrição: "\${input}". A legenda deve ser autêntica, engajadora, com chamada para ação e no máximo 150 palavras. Não use emojis em excesso. Tom: profissional mas próximo.\`,
      ideias: \`Você é um especialista em marketing digital para clínicas de \${especialidade} em \${cidade||"Brasil"}. Crie 7 ideias de posts para Instagram para a semana, uma para cada dia. Foco em conteúdo humano: bastidores, equipe, pacientes (com consentimento), procedimentos, dicas. Formato: Dia + Tipo + Descrição curta da ideia.\`,
      hashtags: \`Crie uma lista de 25 hashtags para uma clínica de \${especialidade} em \${cidade||"Brasil"}. Misture hashtags: grandes (100k+), médias (10k-100k) e pequenas (nicho local). Organize por categoria.\`,
      calendario: \`Crie um calendário de conteúdo para Instagram de uma clínica de \${especialidade} para os próximos 30 dias. Inclua: data, tipo de post, tema, formato (foto/reels/stories), objetivo. Foco em conteúdo humano e autêntico.\`,
      briefing: \`Crie um briefing fotográfico semanal para uma clínica de \${especialidade}. Liste o que a equipe deve fotografar/filmar essa semana para ter conteúdo para o Instagram. Inclua: o que fotografar, como fotografar, dica de luz/ângulo, para qual post vai servir.\`,
    };

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompts[tipoSel.id] }],
        }),
      });
      const data = await res.json();
      setResultado(data.content?.[0]?.text || "Erro ao gerar conteúdo.");
    } catch (e) {
      setResultado("Erro de conexão. Tente novamente.");
    }
    setLoading(false);
  }

  return (
    <div style={{display:"flex",height:"100vh",background:"#f8fafc",fontFamily:"Inter,sans-serif"}}>
      <aside style={{width:220,minWidth:220,background:"#fff",borderRight:"1px solid #e2e8f0",display:"flex",flexDirection:"column",padding:"20px 0"}}>
        <div style={{padding:"0 20px 20px",borderBottom:"1px solid #e2e8f0",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18,fontWeight:700,color:"#1e293b"}}>BOLÃO SHORTS AI</span>
            <span style={{fontSize:10,background:"#ede9fe",color:"#7c3aed",padding:"2px 7px",borderRadius:6,fontWeight:600}}>Beta</span>
          </div>
        </div>
        {nav.map(item=>(
          <div key={item.h} onClick={()=>router.push(item.h)} style={{padding:"8px 20px",fontSize:13,cursor:"pointer",color:item.h==="/conteudo"?"#7c3aed":"#475569",background:item.h==="/conteudo"?"#f5f3ff":"transparent",fontWeight:item.h==="/conteudo"?600:400,borderRight:item.h==="/conteudo"?"3px solid #7c3aed":"3px solid transparent"}}>
            {item.l}
          </div>
        ))}
        <div style={{marginTop:"auto",padding:"16px 20px",borderTop:"1px solid #e2e8f0"}}>
          <div style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>BOLÃO SHORTS AI</div>
          <div style={{fontSize:11,color:"#94a3b8"}}>Administrador</div>
          <button onClick={logout} style={{marginTop:8,width:"100%",padding:"6px",borderRadius:6,border:"1px solid #fecaca",background:"#fff5f5",fontSize:11,color:"#ef4444",cursor:"pointer",fontWeight:600}}>Sair</button>
        </div>
      </aside>

      <main style={{flex:1,overflowY:"auto",padding:"28px 32px"}}>
        <div style={{marginBottom:24}}>
          <h1 style={{fontSize:22,fontWeight:700,color:"#1e293b",margin:0}}>Conteúdo IA</h1>
          <p style={{fontSize:13,color:"#64748b",margin:"4px 0 0"}}>Seu assistente de marketing — você traz o conteúdo humano, a IA transforma em profissional</p>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:24}}>
          {tipos.map(t=>(
            <div key={t.id} onClick={()=>{setTipoSel(t);setResultado("");setInput("");}} style={{background:tipoSel.id===t.id?"#7c3aed":"#fff",border:tipoSel.id===t.id?"2px solid #7c3aed":"2px solid #e2e8f0",borderRadius:12,padding:"14px 12px",cursor:"pointer",textAlign:"center",transition:"all 0.2s"}}>
              <div style={{fontSize:22,marginBottom:6}}>{t.icon}</div>
              <div style={{fontSize:12,fontWeight:600,color:tipoSel.id===t.id?"#fff":"#1e293b"}}>{t.label}</div>
            </div>
          ))}
        </div>

        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:24,marginBottom:20}}>
          <div style={{fontSize:14,fontWeight:600,color:"#1e293b",marginBottom:4}}>{tipoSel.icon} {tipoSel.label}</div>
          <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>{tipoSel.desc}</div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:"#475569",display:"block",marginBottom:4}}>ESPECIALIDADE</label>
              <select value={especialidade} onChange={e=>setEspecialidade(e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,outline:"none"}}>
                <option>Odontologia</option>
                <option>Dermatologia</option>
                <option>Fisioterapia</option>
                <option>Psicologia</option>
                <option>Nutrição</option>
                <option>Medicina Estética</option>
              </select>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:"#475569",display:"block",marginBottom:4}}>CIDADE (opcional)</label>
              <input value={cidade} onChange={e=>setCidade(e.target.value)} placeholder="Ex: São Paulo" style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,outline:"none",boxSizing:"border-box"}} />
            </div>
          </div>

          {tipoSel.id==="legenda" && (
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:600,color:"#475569",display:"block",marginBottom:4}}>DESCREVA SUA FOTO OU VÍDEO</label>
              <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="Ex: Foto da equipe sorrindo na recepção da clínica, clima descontraído numa sexta de tarde..." rows={3} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,outline:"none",resize:"vertical",boxSizing:"border-box"}} />
            </div>
          )}

          <button onClick={gerar} disabled={loading} style={{padding:"10px 24px",borderRadius:8,border:"none",background:"#7c3aed",color:"#fff",fontSize:13,fontWeight:600,cursor:loading?"not-allowed":"pointer",opacity:loading?0.7:1}}>
            {loading?"Gerando...":"✨ Gerar com IA"}
          </button>
        </div>

        {resultado && (
          <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:24}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:600,color:"#1e293b"}}>✅ Resultado</div>
              <button onClick={()=>navigator.clipboard.writeText(resultado)} style={{padding:"6px 14px",borderRadius:6,border:"1px solid #e2e8f0",background:"#f8fafc",fontSize:11,cursor:"pointer",color:"#475569",fontWeight:600}}>📋 Copiar</button>
            </div>
            <div style={{fontSize:13,color:"#334155",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{resultado}</div>
          </div>
        )}
      </main>
    </div>
  );
}`;
fs.writeFileSync('app/conteudo/page.tsx', code, 'utf8');
console.log('Modulo de conteudo IA escrito!');
