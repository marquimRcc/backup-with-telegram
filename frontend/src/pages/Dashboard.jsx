import { Icon, Spinner, splitName } from "../components/common.jsx";
import { useApp } from "../context.jsx";

export default function Dashboard() {
  const { set, runBackup, backupRunning, backupProgress, user, realChannels, realStats, channelId, activityLog } = useApp();
  const setPage = (p) => set({ page: p });
  const pct = backupProgress?.current?.percent || (backupProgress ? Math.round((backupProgress.done/Math.max(backupProgress.total,1))*100) : 0);

  return (
    <div style={{padding:26}}>
      {/* header */}
      <div className="flex items-center justify-between anim-fu" style={{marginBottom:22}}>
        <div>
          <div style={{fontFamily:"var(--display)",fontSize:21,fontWeight:700,letterSpacing:"-.3px"}}>Olá, {splitName(user?.first_name)} 👋</div>
          <div style={{fontSize:12.5,color:"var(--text2)",marginTop:3}}>{realChannels.length>0?<>Canal: <span style={{color:"var(--tg)",fontFamily:"var(--mono)"}}>{realChannels[0]?.name}</span></>:<span style={{color:"var(--text3)"}}>Nenhum canal configurado</span>}</div>
        </div>
        <button className="btn btn-primary" onClick={()=>backupRunning?null:setPage("backup")} disabled={backupRunning} style={{padding:"10px 20px"}}>
          {backupRunning?<><Spinner/><span>Em andamento...</span></>:<><Icon n="cloud" size={15}/><span>Backup agora</span></>}
        </button>
      </div>

      {/* stats */}
      <div className="stat-grid anim-fu1" style={{marginBottom:22}}>
        {[
          {icon:"cloud",  bg:"rgba(42,171,238,.12)", color:"var(--tg)",    val:realStats?.total_size||"...", label:"Armazenado",    delta:realStats?`${realStats.total_files} arquivos`:"carregando...", dc:"var(--tg)"},
          {icon:"folder", bg:"rgba(48,209,88,.12)",  color:"var(--green)", val:realStats?.total_files?.toLocaleString("pt-BR")||"...", label:"Arquivos", delta:realChannels.length>0?`${realChannels.length} canal(is)`:"sem canal", dc:"var(--green)"},
          {icon:"clock",  bg:"rgba(255,159,10,.12)", color:"#FF9F0A",      val:realStats?.last_backup?new Date(realStats.last_backup).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"—", label:"Último backup", delta:realStats?.last_backup?new Date(realStats.last_backup).toLocaleDateString("pt-BR"):"nunca", dc:"var(--text2)"},
          {icon:"shield", bg:"rgba(191,90,242,.12)", color:"#BF5AF2",      val:realChannels.length>0?"online":"—", label:"Telegram", delta:realChannels[0]?.name||"sem canal", dc:"var(--green)"},
        ].map((s,i)=>(
          <div key={i} className="stat-card">
            <div className="stat-icon" style={{background:s.bg}}><Icon n={s.icon} size={17} color={s.color}/></div>
            <div className="stat-value" style={{fontSize:s.val.length>6?19:24}}>{s.val}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-delta" style={{color:s.dc}}>{s.delta}</div>
          </div>
        ))}
      </div>

      <div className="anim-fu2" style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:16}}>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {/* backup status */}
          <div className="card" style={{padding:20}}>
            <div className="flex items-center justify-between" style={{marginBottom:16}}>
              <div className="flex items-center gap-3">
                <div className={`status-dot ${backupRunning?"yellow":"green"}`}/>
                <span style={{fontWeight:600,fontSize:14}}>{backupRunning?"Backup em andamento":"Sistema operacional"}</span>
              </div>
              <span className={`tag ${backupRunning?"tag-yellow":"tag-green"}`} style={backupRunning?{animation:"pulse 1.5s infinite"}:{}}>
                {backupRunning?"LIVE":"IDLE"}
              </span>
            </div>
            {backupRunning?(
              <div>
                <div className="flex justify-between" style={{fontSize:12,color:"var(--text2)",marginBottom:7}}>
                  <span>Enviando para Telegram... {backupProgress?`${backupProgress.done}/${backupProgress.total} arquivos`:""}</span>
                  <span className="mono">{pct}%</span>
                </div>
                <div className="progress"><div className="progress-fill" style={{width:`${pct}%`}}/></div>
                <div style={{fontSize:11.5,color:"var(--text3)",marginTop:8,fontFamily:"var(--mono)"}}>
                  {backupProgress?.current ? `→ ${backupProgress.current.filename} (${backupProgress.current.speed_mbps} MB/s)` : "preparando..."}
                </div>
              </div>
            ):(
              <div>
                <div className="flex justify-between" style={{fontSize:12,color:"var(--text2)",marginBottom:7}}>
                  <span>Armazenamento utilizado</span>
                  <span className="mono">{realStats?.total_size||"..."} / ∞</span>
                </div>
                <div className="progress"><div className="progress-fill" style={{width:"20%"}}/></div>
                <div style={{fontSize:12,color:"var(--text3)",marginTop:8}}>Telegram: armazenamento ilimitado</div>
              </div>
            )}
          </div>

          {/* folders list */}
          <div className="card" style={{padding:20}}>
            <div className="flex items-center justify-between" style={{marginBottom:14}}>
              <div>
                <span style={{fontWeight:600,fontSize:14}}>Arquivos por tipo</span>
                {realStats?.total_files>0&&<span className="tag tag-green" style={{marginLeft:8,fontSize:10}}>{realStats.total_files} total</span>}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setPage("files")}><Icon n="arrow" size={13}/>Ver todos</button>
            </div>
            {(realStats?.folders||[]).length>0 ? (realStats.folders.map((f,i)=>(
              <div key={i} className="flex items-center" style={{padding:"8px 10px",borderRadius:9,cursor:"pointer",transition:"background .12s",gap:12}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--bg2)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <span style={{fontSize:17,width:26,textAlign:"center"}}>{f.emoji}</span>
                <span style={{flex:1,fontSize:13,fontWeight:500}}>{f.label}</span>
                <span style={{fontSize:11,color:"var(--text3)",fontFamily:"var(--mono)"}}>{f.count} arq.</span>
                <span style={{fontSize:11,color:"var(--text2)",fontFamily:"var(--mono)",width:58,textAlign:"right"}}>{f.size}</span>
              </div>
            ))) : (
              <div style={{padding:"20px 0",textAlign:"center",color:"var(--text3)",fontSize:13}}>
                {realStats ? "Nenhum arquivo no canal ainda." : "Carregando..."}
              </div>
            )}
          </div>
        </div>

        {/* activity */}
        <div className="card anim-fu3" style={{padding:20,height:"fit-content"}}>
          <div className="flex items-center justify-between" style={{marginBottom:14}}>
            <span style={{fontWeight:600,fontSize:14}}>Atividade recente</span>
            <Icon n="activity" size={14} color="var(--text3)"/>
          </div>
          {activityLog.length>0 ? activityLog.slice(0,6).map((l,i)=>(
            <div key={i} className="log-item">
              <span style={{fontSize:15,flexShrink:0}}>{l.e}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12.5,lineHeight:1.5}}>{l.text}</div>
                <div style={{fontSize:10.5,color:"var(--text3)",fontFamily:"var(--mono)",marginTop:2}}>{l.time}</div>
              </div>
            </div>
          )) : (
            <div style={{padding:"24px 0",textAlign:"center"}}>
              <div style={{fontSize:28,marginBottom:8}}>📭</div>
              <div style={{fontSize:13,color:"var(--text2)",marginBottom:4}}>Sem atividade ainda</div>
              <div style={{fontSize:12,color:"var(--text3)"}}>Faça um upload ou backup para ver registros aqui.</div>
            </div>
          )}
          {activityLog.length>6&&(
            <button className="btn btn-ghost btn-sm w-full" style={{marginTop:12}} onClick={()=>setPage("activity")}>
              Ver histórico completo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
