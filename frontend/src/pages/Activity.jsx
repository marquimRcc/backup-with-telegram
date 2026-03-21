import { useState, useEffect } from "react";
import { backup as backupApi } from "../api.js";
import { Spinner } from "../components/common.jsx";
import { useApp } from "../context.jsx";

export default function ActivityPage() {
  const { activityLog } = useApp();
  const [dbJobs,setDbJobs]=useState([]);
  const [loadingJobs,setLoadingJobs]=useState(true);

  useEffect(()=>{
    backupApi.jobs(20).then(r=>{
      setDbJobs((r.data.jobs||[]).map(j=>({
        e: j.status==="done"?"\u2705":j.status==="failed"?"\u274c":j.status==="cancelled"?"\ud83d\udeab":"\u23f3",
        text: j.status==="done"
          ? `Backup conclu\u00eddo \u2014 ${j.files_sent} enviado${j.files_sent>1?"s":""}, ${j.files_skipped} pulado${j.files_skipped>1?"s":""} (${(j.bytes_sent/1048576).toFixed(1)} MB)`
          : j.status==="failed" ? `Backup falhou \u2014 ${j.files_failed} erro${j.files_failed>1?"s":""}`
          : j.status==="cancelled" ? "Backup cancelado pelo usu\u00e1rio"
          : `Backup em andamento \u2014 ${j.files_sent}/${j.files_total}`,
        time: j.finished_at ? new Date(j.finished_at).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})
          : j.started_at ? new Date(j.started_at).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "\u2014",
      })));
    }).catch(()=>{}).finally(()=>setLoadingJobs(false));
  },[]);

  return (
    <div style={{padding:26}}>
      <div className="anim-fu" style={{fontFamily:"var(--display)",fontSize:19,fontWeight:700,marginBottom:20}}>Hist\u00f3rico de Atividade</div>

      {activityLog.length>0 && (
        <div className="card anim-fu1" style={{padding:20,marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:600,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".1em",marginBottom:12}}>Sess\u00e3o atual</div>
          {activityLog.map((l,i)=>(
            <div key={i} className="log-item">
              <span style={{fontSize:16,flexShrink:0,marginTop:1}}>{l.e}</span>
              <div style={{flex:1}}><div style={{fontSize:13.5}}>{l.text}</div></div>
              <div style={{fontSize:11,color:"var(--text3)",fontFamily:"var(--mono)",flexShrink:0}}>{l.time}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card anim-fu2" style={{padding:20}}>
        <div style={{fontSize:10,fontWeight:600,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".1em",marginBottom:12}}>Hist\u00f3rico de backups</div>
        {loadingJobs ? (
          <div style={{textAlign:"center",padding:"30px"}}><Spinner size={20}/></div>
        ) : dbJobs.length>0 ? dbJobs.map((l,i)=>(
          <div key={i} className="log-item">
            <span style={{fontSize:16,flexShrink:0,marginTop:1}}>{l.e}</span>
            <div style={{flex:1}}><div style={{fontSize:13.5}}>{l.text}</div></div>
            <div style={{fontSize:11,color:"var(--text3)",fontFamily:"var(--mono)",flexShrink:0}}>{l.time}</div>
          </div>
        )) : (
          <div style={{padding:"30px 20px",textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:8}}>\ud83d\udced</div>
            <div style={{fontSize:13,color:"var(--text2)"}}>Nenhum backup registrado ainda.</div>
          </div>
        )}
      </div>
    </div>
  );
}

