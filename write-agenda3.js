const fs = require('fs');
const code = `"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const meses = ["Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const dias = ["Dom","Seg","Ter","Qua","Qui","Sex","Sab"];

type Ag = { id:string; hora:string; paciente_nome:string; procedimento:string; profissional:string; status:string; data:string; };

const st = {
  confirmado:{bg:"#dcfce7",color:"#166534",label:"Confirmado"},
  aguardando:{bg:"#fef9c3",color:"#854d0e",label:"Aguardando"},
  novo:{bg:"#dbeafe",color:"#1e40af",label:"Novo"},
};

function prevMes(mes:number,ano:number,setMes:(n:number)=>void,setAno:(n:number)=>void){if(mes===0){setMes(11);setAno(ano-1);}else{setMes(mes-1);}}
function nextMes(mes:number,ano:number,setMes:(n:number)=>void,setAno:(n:number)=>void){if(mes===11){setMes(0);setAno(ano+1);}else{setMes(mes+1);}}

export default function Agenda() {
  const router = useRouter();
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [diaSel, setDiaSel] = useState(hoje.getDate());
  const [ags, setAgs] = useState<Ag[]>([]);
  const [modal, setModal] = useState(false);
  const [paciente, setPaciente] = useState("");
  const [proc, setProc] = useState("");
  const [prof, setProf] = useState("");
  const [hora, setHora] = useState("08:00");
  const [salvando, setSalvando] = useState(false);

  useEffect(()=>{ carregar(); },[]);

  async function carregar(){
    const {data} = await supabase.from("agendamentos").select("*").order("hora",{ascending:true});
    if(data) setAgs(data);
  }

  async function adicionar(){
    if(!paciente||!proc) return;
    setSalvando(true);
    const data = new Date(ano,mes,diaSel).toISOString().split("T")[0];
    await supabase.from("agendamentos").insert([{paciente_nome:paciente,procedimento:proc,profissional:prof,hora,data,status:"novo"}]);
    setPaciente("");setProc("");setProf("");setHora("08:00");setModal(false);
    carregar();
    setSalvando(false);
  }

  const primeiroDia = new Date(ano,mes,1).getDay();
  const diasNoMes = new Date(ano,mes+1,0).getDate();
  const celulas = Array.from({length:primeiroDia+diasNoMes},(_,i)=>i<primeiroDia?null:i-primeiroDia+1);
  const dataSelStr = new Date(ano,mes,diaSel).toISOString().split("T")[0];
  const agendaDia = ags.filter(a=>a.data===dataSelStr);

  return (
    <div style={{display:"flex",height:"100vh",background:"#f8fafc",fontFamily:"Inter,sans-serif"}}>
      <aside style={{width:230,minWidth:230,background:"#fff",borderRight:"1px solid #e2e8f0",display:"flex",flexDirection:"column",padding:"20px 0"}}>
        <div style={{padding:"0 20px 20px",borderBottom:"1px solid #e2e8f0",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18,fontWeight:700,color:"#1e293b"}}>BOLÃO SHORTS AI</span>
            <span style={{fontSize:10,background:"#ede9fe",color:"#7c3aed",padding:"2px 7px",borderRadius:6,fontWeight:600}}>Beta</span>
          </div>
        </div>
        {[{l:"Dashboard",h:"/"},{l:"Agenda",h:"/agendamentos"},{l:"Pacientes",h:"/pacientes"},{l:"Automacoes",h:"/automacao"},{l:"Reputacao",h:"/reputacao"},{l:"Conteudo IA",h:"/conteudo"},{l:"Site",h:"/site"},{l:"Config",h:"/configuracoes"}].map(item=>(
          <div key={item.h} onClick={()=>router.push(item.h)} style={{padding:"8px 20px",fontSize:13,cursor:"pointer",color:item.h==="/agendamentos"?"#7c3aed":"#475569",background:item.h==="/agendamentos"?"#f5f3ff":"transparent",fontWeight:item.h==="/agendamentos"?600:400,borderRight:item.h==="/agendamentos"?"3px solid #7c3aed":"3px solid transparent"}}>
            {item.l}
          </div>
        ))}
        <div style={{marginTop:"auto",padding:"16px 20px",borderTop:"1px solid #e2e8f0"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:"#ede9fe",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#7c3aed"}}>CF</div>
            <div><div style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>Clinica Flow</div><div style={{fontSize:11,color:"#94a3b8"}}>Administrador</div></div>
          </div>
        </div>
      </aside>

      <main style={{flex:1,overflowY:"auto",padding:"24px 28px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:700,color:"#1e293b",margin:0}}>Agenda</h1>
            <p style={{fontSize:13,color:"#64748b",margin:"4px 0 0"}}>{agendaDia.length} consultas para o dia {diaSel}</p>
          </div>
          <button onClick={()=>setModal(true)} style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#7c3aed",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Novo agendamento</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"300px 1fr",gap:20}}>
          <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <button onClick={()=>prevMes(mes,ano,setMes,setAno)} style={{border:"none",background:"none",fontSize:18,cursor:"pointer"}}>&#8249;</button>
              <span style={{fontSize:13,fontWeight:600}}>{meses[mes]} {ano}</span>
              <button onClick={()=>nextMes(mes,ano,setMes,setAno)} style={{border:"none",background:"none",fontSize:18,cursor:"pointer"}}>&#8250;</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
              {dias.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:600,color:"#94a3b8"}}>{d}</div>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
              {celulas.map((d,i)=>{
                const isHoje=d===hoje.getDate()&&mes===hoje.getMonth()&&ano===hoje.getFullYear();
                const isSel=d===diaSel;
                const dStr=d?new Date(ano,mes,d).toISOString().split("T")[0]:"";
                const temAg=d&&ags.some(a=>a.data===dStr);
                return <div key={i} onClick={()=>d&&setDiaSel(d)} style={{textAlign:"center",padding:"5px 0",fontSize:12,borderRadius:6,cursor:d?"pointer":"default",background:isSel?"#7c3aed":isHoje?"#ede9fe":"transparent",color:isSel?"#fff":d?"#1e293b":"transparent",fontWeight:isSel||isHoje?700:400}}>
                  {d||""}
                  {temAg&&!isSel&&<div style={{width:4,height:4,borderRadius:"50%",background:"#7c3aed",margin:"1px auto 0"}}/>}
                </div>;
              })}
            </div>
          </div>

          <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:18}}>
            <div style={{fontSize:14,fontWeight:600,color:"#1e293b",marginBottom:16}}>Dia {diaSel} de {meses[mes]} — {agendaDia.length} consultas</div>
            {agendaDia.length===0?(
              <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>Nenhuma consulta neste dia. Clique em + Novo agendamento!</div>
            ):agendaDia.map((a,i)=>(
              <div key={a.id} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 0",borderBottom:i<agendaDia.length-1?"1px solid #f1f5f9":"none"}}>
                <span style={{fontSize:14,fontWeight:700,color:"#1e293b",minWidth:50}}>{a.hora}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{a.paciente_nome}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{a.procedimento}{a.profissional?" - "+a.profissional:""}</div>
                </div>
                <span style={{fontSize:11,padding:"3px 10px",borderRadius:10,background:st[a.status as keyof typeof st]?.bg||"#f1f5f9",color:st[a.status as keyof typeof st]?.color||"#64748b",fontWeight:600}}>{st[a.status as keyof typeof st]?.label||a.status}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {modal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50}}>
          <div style={{background:"#fff",borderRadius:16,padding:28,width:420,boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
            <h2 style={{fontSize:16,fontWeight:700,color:"#1e293b",marginBottom:20}}>Novo Agendamento — Dia {diaSel} de {meses[mes]}</h2>
            {[{l:"Paciente",v:paciente,s:setPaciente,p:"Nome do paciente"},{l:"Procedimento",v:proc,s:setProc,p:"Ex: Limpeza, Canal..."},{l:"Profissional",v:prof,s:setProf,p:"Ex: Dr. Carlos"}].map(f=>(
              <div key={f.l} style={{marginBottom:14}}>
                <label style={{fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:4}}>{f.l}</label>
                <input value={f.v} onChange={e=>f.s(e.target.value)} placeholder={f.p} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,outline:"none",boxSizing:"border-box"}} />
              </div>
            ))}
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:4}}>Horario</label>
              <input type="time" value={hora} onChange={e=>setHora(e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,outline:"none",boxSizing:"border-box"}} />
            </div>
            <div style={{display:"flex",gap:10,marginTop:20}}>
              <button onClick={()=>setModal(false)} style={{flex:1,padding:"9px",borderRadius:8,border:"1px solid #e2e8f0",background:"#fff",fontSize:13,cursor:"pointer",color:"#475569"}}>Cancelar</button>
              <button onClick={adicionar} disabled={salvando} style={{flex:1,padding:"9px",borderRadius:8,border:"none",background:"#7c3aed",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",opacity:salvando?0.7:1}}>{salvando?"Salvando...":"Agendar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}`;
fs.writeFileSync('app/agendamentos/page.tsx', code, 'utf8');
console.log('Agenda com Supabase escrita!');
