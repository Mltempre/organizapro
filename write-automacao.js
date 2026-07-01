const fs = require('fs');
const code = `"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const automacoes = [
  { id:1, icon:"💬", titulo:"Confirmacao de consulta", desc:"Envia mensagem via WhatsApp 24h antes da consulta pedindo confirmacao.", ativo:true, enviados:142, taxa:"89%", cor:"#dcfce7", corIcon:"#166534" },
  { id:2, icon:"⏰", titulo:"Lembrete de retorno", desc:"Envia mensagem 30 dias apos a consulta lembrando o paciente de agendar retorno.", ativo:true, enviados:87, taxa:"72%", cor:"#fef9c3", corIcon:"#854d0e" },
  { id:3, icon:"⭐", titulo:"Pedido de avaliacao Google", desc:"Apos o atendimento, envia link para o paciente avaliar a clinica no Google.", ativo:true, enviados:203, taxa:"34%", cor:"#ede9fe", corIcon:"#7c3aed" },
  { id:4, icon:"🎂", titulo:"Feliz aniversario", desc:"Envia mensagem automatica no aniversario do paciente com cupom de desconto.", ativo:false, enviados:0, taxa:"-", cor:"#fce7f3", corIcon:"#9d174d" },
  { id:5, icon:"✨", titulo:"Post IA semanal", desc:"Gera e agenda automaticamente um post para o Instagram toda segunda-feira.", ativo:false, enviados:0, taxa:"-", cor:"#e0f2fe", corIcon:"#0369a1" },
];

export default function Automacao() {
  const router = useRouter();
  const [ats, setAts] = useState(automacoes.map(a=>a.ativo));

  return (
    <div style={{display:"flex",height:"100vh",background:"#f8fafc",fontFamily:"Inter,sans-serif"}}>
      <aside style={{width:230,minWidth:230,background:"#fff",borderRight:"1px solid #e2e8f0",display:"flex",flexDirection:"column",padding:"20px 0"}}>
        <div style={{padding:"0 20px 20px",borderBottom:"1px solid #e2e8f0",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18,fontWeight:700,color:"#1e293b"}}>BOLÃO SHORTS AI</span>
            <span style={{fontSize:10,background:"#ede9fe",color:"#7c3aed",padding:"2px 7px",borderRadius:6,fontWeight:600}}>Beta</span>
          </div>
          <div style={{fontSize:11,color:"#94a3b8",marginTop:3}}>Odontologia</div>
        </div>
        {[{l:"Dashboard",h:"/"},{l:"Agenda",h:"/agendamentos"},{l:"Pacientes",h:"/pacientes"},{l:"Automacoes",h:"/automacao"},{l:"Reputacao",h:"/reputacao"},{l:"Conteudo IA",h:"/conteudo"},{l:"Site",h:"/site"},{l:"Config",h:"/configuracoes"}].map(item=>(
          <div key={item.h} onClick={()=>router.push(item.h)} style={{padding:"8px 20px",fontSize:13,cursor:"pointer",color:item.h==="/automacao"?"#7c3aed":"#475569",background:item.h==="/automacao"?"#f5f3ff":"transparent",fontWeight:item.h==="/automacao"?600:400,borderRight:item.h==="/automacao"?"3px solid #7c3aed":"3px solid transparent"}}>
            {item.l}
          </div>
        ))}
        <div style={{marginTop:"auto",padding:"16px 20px",borderTop:"1px solid #e2e8f0"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:"#ede9fe",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#7c3aed"}}>CF</div>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>Clinica Flow</div>
              <div style={{fontSize:11,color:"#94a3b8"}}>Administrador</div>
            </div>
          </div>
        </div>
      </aside>

      <main style={{flex:1,overflowY:"auto",padding:"24px 28px"}}>
        <div style={{marginBottom:24}}>
          <h1 style={{fontSize:22,fontWeight:700,color:"#1e293b",margin:0}}>Automacoes</h1>
          <p style={{fontSize:13,color:"#64748b",margin:"4px 0 0"}}>{ats.filter(Boolean).length} automacoes ativas</p>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:24}}>
          {[{l:"Mensagens enviadas",v:"432",d:"este mes",cor:"#7c3aed"},{l:"Taxa media de resposta",v:"72%",d:"confirmacoes",cor:"#0369a1"},{l:"Avaliacoes geradas",v:"68",d:"ultimos 30 dias",cor:"#166534"}].map(m=>(
            <div key={m.l} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:"16px 18px"}}>
              <div style={{fontSize:12,color:"#64748b",marginBottom:6}}>{m.l}</div>
              <div style={{fontSize:26,fontWeight:700,color:m.cor}}>{m.v}</div>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>{m.d}</div>
            </div>
          ))}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {automacoes.map((a,i)=>(
            <div key={a.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:20}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
                <div style={{width:44,height:44,borderRadius:10,background:a.cor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{a.icon}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:14,fontWeight:600,color:"#1e293b"}}>{a.titulo}</span>
                    <div onClick={()=>{const n=[...ats];n[i]=!n[i];setAts(n);}} style={{width:40,height:22,borderRadius:11,background:ats[i]?"#7c3aed":"#cbd5e1",position:"relative",cursor:"pointer",flexShrink:0}}>
                      <div style={{position:"absolute",top:3,left:ats[i]?20:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
                    </div>
                  </div>
                  <p style={{fontSize:12,color:"#64748b",margin:"0 0 12px",lineHeight:1.5}}>{a.desc}</p>
                  <div style={{display:"flex",gap:16}}>
                    <div>
                      <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase"}}>Enviados</div>
                      <div style={{fontSize:16,fontWeight:700,color:"#1e293b"}}>{a.enviados}</div>
                    </div>
                    <div>
                      <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase"}}>Taxa</div>
                      <div style={{fontSize:16,fontWeight:700,color:"#1e293b"}}>{a.taxa}</div>
                    </div>
                    <div style={{marginLeft:"auto"}}>
                      <span style={{fontSize:11,padding:"3px 10px",borderRadius:10,background:ats[i]?"#dcfce7":"#f1f5f9",color:ats[i]?"#166534":"#64748b",fontWeight:600}}>{ats[i]?"Ativa":"Inativa"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}`;
fs.writeFileSync('app/automacao/page.tsx', code, 'utf8');
console.log('Automacao escrita!');
