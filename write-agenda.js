const fs = require('fs');
const code = `"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const meses = ["Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const dias = ["Dom","Seg","Ter","Qua","Qui","Sex","Sab"];

const ags = [
  {id:1,hora:"08:00",paciente:"Maria Silva",proc:"Limpeza",prof:"Dr. Carlos",status:"confirmado",dia:18},
  {id:2,hora:"09:30",paciente:"Joao Pereira",proc:"Extracao",prof:"Dr. Carlos",status:"aguardando",dia:18},
  {id:3,hora:"11:00",paciente:"Ana Costa",proc:"Canal",prof:"Dra. Ana",status:"confirmado",dia:18},
  {id:4,hora:"14:00",paciente:"Carlos Mendes",proc:"Consulta inicial",prof:"Dr. Carlos",status:"novo",dia:18},
  {id:5,hora:"09:00",paciente:"Fernanda Lima",proc:"Restauracao",prof:"Dra. Ana",status:"confirmado",dia:19},
];

const st = {
  confirmado:{bg:"#dcfce7",color:"#166534",label:"Confirmado"},
  aguardando:{bg:"#fef9c3",color:"#854d0e",label:"Aguardando"},
  novo:{bg:"#dbeafe",color:"#1e40af",label:"Novo"},
};

export default function Agenda() {
  const router = useRouter();
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [diaSel, setDiaSel] = useState(hoje.getDate());
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const celulas = Array.from({length: primeiroDia + diasNoMes}, (_, i) => i < primeiroDia ? null : i - primeiroDia + 1);
  const agendaDia = ags.filter(a => a.dia === diaSel);

  return (
    <div style={{display:"flex",height:"100vh",background:"#f8fafc",fontFamily:"Inter,sans-serif"}}>
      <aside style={{width:230,minWidth:230,background:"#fff",borderRight:"1px solid #e2e8f0",display:"flex",flexDirection:"column",padding:"20px 0"}}>
        <div style={{padding:"0 20px 20px",borderBottom:"1px solid #e2e8f0",marginBottom:8}}>
          <span style={{fontSize:18,fontWeight:700,color:"#1e293b"}}>BOLÃO SHORTS AI</span>
        </div>
        {[{e:"Home",l:"Dashboard",h:"/"},{e:"Agenda",l:"Agenda",h:"/agendamentos"},{e:"Pacientes",l:"Pacientes",h:"/pacientes"},{e:"Auto",l:"Automacoes",h:"/automacao"}].map(item=>(
          <div key={item.h} onClick={()=>router.push(item.h)} style={{padding:"8px 20px",fontSize:13,cursor:"pointer",color:item.h==="/agendamentos"?"#7c3aed":"#475569",background:item.h==="/agendamentos"?"#f5f3ff":"transparent",fontWeight:item.h==="/agendamentos"?600:400}}>
            {item.l}
          </div>
        ))}
      </aside>
      <main style={{flex:1,overflowY:"auto",padding:"24px 28px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <h1 style={{fontSize:22,fontWeight:700,color:"#1e293b",margin:0}}>Agenda</h1>
          <button style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#7c3aed",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Novo agendamento</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"300px 1fr",gap:20}}>
          <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <button onClick={()=>mes===0?setMes(11)||setAno(ano-1):setMes(mes-1)} style={{border:"none",background:"none",fontSize:18,cursor:"pointer"}}>&#8249;</button>
              <span style={{fontSize:13,fontWeight:600}}>{meses[mes]} {ano}</span>
              <button onClick={()=>mes===11?setMes(0)||setAno(ano+1):setMes(mes+1)} style={{border:"none",background:"none",fontSize:18,cursor:"pointer"}}>&#8250;</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
              {dias.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:600,color:"#94a3b8"}}>{d}</div>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
              {celulas.map((d,i)=>{
                const isHoje=d===hoje.getDate()&&mes===hoje.getMonth()&&ano===hoje.getFullYear();
                const isSel=d===diaSel;
                const temAg=d&&ags.some(a=>a.dia===d);
                return <div key={i} onClick={()=>d&&setDiaSel(d)} style={{textAlign:"center",padding:"5px 0",fontSize:12,borderRadius:6,cursor:d?"pointer":"default",background:isSel?"#7c3aed":isHoje?"#ede9fe":"transparent",color:isSel?"#fff":d?"#1e293b":"transparent",fontWeight:isSel||isHoje?700:400}}>
                  {d||""}
                  {temAg&&!isSel&&<div style={{width:4,height:4,borderRadius:"50%",background:"#7c3aed",margin:"1px auto 0"}}/>}
                </div>;
              })}
            </div>
          </div>
          <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:18}}>
            <div style={{fontSize:14,fontWeight:600,color:"#1e293b",marginBottom:16}}>Dia {diaSel} de {meses[mes]} — {agendaDia.length} consultas</div>
            {agendaDia.length===0?<div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>Nenhuma consulta neste dia</div>:agendaDia.map((a,i)=>(
              <div key={a.id} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 0",borderBottom:i<agendaDia.length-1?"1px solid #f1f5f9":"none"}}>
                <span style={{fontSize:14,fontWeight:700,color:"#1e293b",minWidth:50}}>{a.hora}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{a.paciente}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{a.proc} · {a.prof}</div>
                </div>
                <span style={{fontSize:11,padding:"3px 10px",borderRadius:10,background:st[a.status as keyof typeof st].bg,color:st[a.status as keyof typeof st].color,fontWeight:600}}>{st[a.status as keyof typeof st].label}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}`;
fs.writeFileSync('app/agendamentos/page.tsx', code, 'utf8');
console.log('Agenda escrita!');
