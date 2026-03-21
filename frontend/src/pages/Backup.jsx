import { useState } from "react";
import { Icon, Spinner, Toggle } from "../components/common.jsx";
import { useApp } from "../context.jsx";

export default function BackupPage() {
  const { runBackup, backupRunning, backupProgress, channelId, pauseBackup, resumeBackup } = useApp();
  const [pathInput,setPathInput]=useState("");
  const [paths,setPaths]=useState([]);
  const [scheds,setScheds]=useState([
    {label:"A cada hora",  sub:"Verifica mudanças toda hora",       on:false},
    {label:"2x ao dia",   sub:"12h e 20h automaticamente",         on:true},
    {label:"Diário 20h",  sub:"Backup completo diário",             on:true},
    {label:"Ao iniciar",  sub:"Backup ao ligar o computador",       on:true},
  ]);

  const addPath = () => {
    const p = pathInput.trim();
    if(p && !paths.includes(p)) { setPaths(prev=>[...prev,p]); setPathInput(""); }
  };
  const removePath = (i) => setPaths(prev=>prev.filter((_,j)=>j!==i));
  const handleStart = () => { if(paths.length>0) runBackup(paths); };

  const totalPct = backupProgress ? Math.round((backupProgress.done/Math.max(backupProgress.total,1))*100) : 0;
  const isDone = backupProgress?.status==="done";
  const isPaused = backupProgress?.paused === true;

  return (
      <div style={{padding:26}}>
        <div className="anim-fu" style={{fontFamily:"var(--display)",fontSize:19,fontWeight:700,marginBottom:20}}>Backup & Sincronização</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 290px",gap:16}}>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>

            {/* path selector */}
            <div className="card anim-fu1" style={{padding:20}}>
              <div style={{fontWeight:600,marginBottom:14}}>Pastas / arquivos para backup</div>
              <div className="flex gap-2" style={{marginBottom:12}}>
                <input className="input" value={pathInput} onChange={e=>setPathInput(e.target.value)}
                       placeholder="/home/marcos/Documentos" style={{fontSize:13}}
                       onKeyDown={e=>{ if(e.key==="Enter") addPath(); }}/>
                <button className="btn btn-ghost btn-sm" onClick={addPath} disabled={!pathInput.trim()}><Icon n="plus" size={13}/>Adicionar</button>
              </div>
              {paths.length===0 ? (
                  <div style={{fontSize:12.5,color:"var(--text3)",padding:"10px 0"}}>Nenhum caminho adicionado. Digite o caminho completo e pressione Enter.</div>
              ) : paths.map((p,i)=>(
                  <div key={i} className="flex items-center gap-2" style={{padding:"7px 10px",background:"var(--bg2)",borderRadius:8,marginBottom:4,border:"1px solid var(--border)"}}>
                    <span style={{fontSize:14}}>📁</span>
                    <span style={{flex:1,fontSize:12.5,fontFamily:"var(--mono)",color:"var(--text2)"}}>{p}</span>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>removePath(i)} style={{width:26,height:26}}><Icon n="trash" size={12}/></button>
                  </div>
              ))}
              <button className="btn btn-primary w-full" style={{marginTop:12,padding:"11px",fontSize:14}} onClick={handleStart}
                      disabled={backupRunning || paths.length===0 || !channelId}>
                {backupRunning?<><Spinner size={14}/>Backup em andamento...</>:!channelId?<span>Sem canal configurado</span>:<><Icon n="play" size={13}/>Iniciar backup ({paths.length} caminho{paths.length>1?"s":""})</>}
              </button>
            </div>

            {/* live progress */}
            <div className="card anim-fu2" style={{padding:20}}>
              <div className="flex items-center justify-between" style={{marginBottom:16}}>
                <span style={{fontWeight:600}}>Progresso do backup</span>
                <div className="flex items-center gap-2">
                  {backupRunning && isPaused && <span className="tag tag-yellow">PAUSADO</span>}
                  {backupRunning && !isPaused && <span className="tag tag-yellow" style={{animation:"pulse 1.5s infinite"}}>LIVE</span>}
                  {isDone && <span className="tag tag-green">CONCLUÍDO</span>}
                  {!backupRunning && !isDone && <span className="tag tag-gray">IDLE</span>}
                  {backupRunning && (
                      <button className="btn btn-ghost btn-sm" onClick={isPaused ? resumeBackup : pauseBackup} style={{padding:"5px 12px"}}>
                        {isPaused ? <><Icon n="play" size={12}/>Retomar</> : <><Icon n="pause" size={12}/>Pausar</>}
                      </button>
                  )}
                </div>
              </div>

              {backupProgress ? (
                  <div>
                    {/* overall progress */}
                    <div className="flex justify-between" style={{fontSize:12,color:"var(--text2)",marginBottom:7}}>
                      <span>{isDone?"Backup finalizado":isPaused?`Pausado — ${backupProgress.done}/${backupProgress.total} arquivos enviados`:`Enviando ${backupProgress.done}/${backupProgress.total} arquivos...`}</span>
                      <span className="mono">{totalPct}%</span>
                    </div>
                    <div className="progress" style={{marginBottom:14}}><div className="progress-fill" style={{width:`${totalPct}%`,background:isDone?"var(--green)":undefined}}/></div>

                    {/* current file */}
                    {backupProgress.current && (
                        <div className="bk-item">
                          <div className="bk-item-icon" style={{background:"rgba(42,171,238,.12)"}}><Spinner size={14}/></div>
                          <div style={{flex:1}}>
                            <div className="flex items-center justify-between" style={{marginBottom:5}}>
                              <span style={{fontSize:13,fontWeight:500}}>{backupProgress.current.filename}</span>
                              <span style={{fontSize:11,color:"var(--tg)",fontFamily:"var(--mono)"}}>{backupProgress.current.speed_mbps} MB/s</span>
                            </div>
                            <div className="progress" style={{height:3}}>
                              <div className="progress-fill" style={{width:`${backupProgress.current.percent}%`}}/>
                            </div>
                          </div>
                          <span className="mono" style={{fontSize:11,color:"var(--tg)",width:32,textAlign:"right"}}>{backupProgress.current.percent}%</span>
                        </div>
                    )}

                    {/* summary stats */}
                    <div className="flex gap-4" style={{marginTop:12,fontSize:12,color:"var(--text2)"}}>
                      {backupProgress.done>0 && <span style={{color:"var(--green)"}}>✅ {backupProgress.done} enviado{backupProgress.done>1?"s":""}</span>}
                      {backupProgress.skipped>0 && <span style={{color:"var(--yellow)"}}>⏭️ {backupProgress.skipped} pulado{backupProgress.skipped>1?"s":""}</span>}
                      {backupProgress.failed>0 && <span style={{color:"var(--red)"}}>❌ {backupProgress.failed} erro{backupProgress.failed>1?"s":""}</span>}
                      {backupProgress.bytes>0 && <span className="mono" style={{color:"var(--text3)"}}>{(backupProgress.bytes/1048576).toFixed(1)} MB total</span>}
                    </div>
                  </div>
              ) : (
                  <div className="empty" style={{padding:"30px 20px"}}>
                    <div className="empty-icon">📭</div>
                    <div className="empty-title">Nenhum backup em execução</div>
                    <div className="empty-sub">Adicione caminhos acima e clique em "Iniciar backup".</div>
                  </div>
              )}
            </div>
          </div>

          {/* right col */}
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div className="card anim-fu1" style={{padding:20}}>
              <div style={{fontWeight:600,marginBottom:14}}>Agendamentos</div>
              {scheds.map((s,i)=>(
                  <div key={i} className="sched-row">
                    <div>
                      <div style={{fontSize:13,fontWeight:500}}>{s.label}</div>
                      <div style={{fontSize:11.5,color:"var(--text2)",marginTop:2}}>{s.sub}</div>
                    </div>
                    <Toggle on={s.on} onToggle={()=>setScheds(sc=>sc.map((x,j)=>j===i?{...x,on:!x.on}:x))}/>
                  </div>
              ))}
              <div style={{fontSize:11,color:"var(--text3)",marginTop:10,padding:"8px 10px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--border)"}}>
                ⚠️ Agendamentos ainda não conectados ao backend (em breve).
              </div>
            </div>

            {backupProgress && (
                <div className="card anim-fu2" style={{padding:20}}>
                  <div style={{fontWeight:600,marginBottom:14}}>Resumo</div>
                  {[
                    ["Total",       `${backupProgress.total} arquivo${backupProgress.total>1?"s":""}`],
                    ["Enviados",    `${backupProgress.done}`],
                    ["Pulados",     `${backupProgress.skipped}`],
                    ["Falhas",      `${backupProgress.failed}`],
                    ["Dados env.",  `${(backupProgress.bytes/1048576).toFixed(1)} MB`],
                  ].map(([k,v],i,a)=>(
                      <div key={i} className="flex items-center justify-between" style={{padding:"9px 0",borderBottom:i<a.length-1?"1px solid var(--border)":"none"}}>
                        <span style={{fontSize:12.5,color:"var(--text2)"}}>{k}</span>
                        <span style={{fontSize:13,fontWeight:600,fontFamily:"var(--mono)"}}>{v}</span>
                      </div>
                  ))}
                </div>
            )}
          </div>
        </div>
      </div>
  );
}