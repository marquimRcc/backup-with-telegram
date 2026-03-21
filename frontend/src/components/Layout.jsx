import { Icon, Spinner, splitName } from "./common.jsx";

const NAV = [
  {id:"dashboard", label:"Dashboard",     icon:"home"},
  {id:"files",     label:"Arquivos",      icon:"folder"},
  {id:"backup",    label:"Backup",        icon:"cloud"},
  {id:"tools",     label:"Ferramentas",   icon:"wrench"},
  {id:"activity",  label:"Atividade",     icon:"activity"},
  {id:"settings",  label:"Configurações", icon:"settings"},
];

export default function Layout({ page, setPage, backupRunning, user, children }) {
  return (
    <div style={{display:"flex",height:"100vh",overflow:"hidden"}}>
      <div className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark"><Icon n="tg" size={17} color="white"/></div>
          <div className="logo-text">Tele<span>Vault</span></div>
        </div>
        <div className="nav-section">
          <div className="nav-section-label">Menu</div>
          {NAV.map(n=>(
            <div key={n.id} className={`nav-item ${page===n.id?"active":""}`} onClick={()=>setPage(n.id)}>
              <Icon n={n.icon} size={16}/>
              <span>{n.label}</span>
              {n.id==="backup"&&backupRunning&&(
                <span style={{marginLeft:"auto",width:8,height:8,borderRadius:"50%",background:"var(--yellow)",animation:"pulse 1.2s infinite",display:"block"}}/>
              )}
            </div>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="user-row">
            <div className="avatar">{user?.first_name?.[0]||"?"}</div>
            <div>
              <div className="user-name">{splitName(user?.first_name)}</div>
              <div className="user-phone">{user?.phone ? `+${user.phone.slice(0,4)} ···· ${user.phone.slice(-4)}` : "..."}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div className="topbar">
          <div className="topbar-title">{NAV.find(n=>n.id===page)?.label}</div>
          {backupRunning&&(
            <div className="flex items-center gap-2" style={{marginLeft:14}}>
              <div className="status-dot yellow"/>
              <span style={{fontSize:12,color:"var(--yellow)"}}>Backup em andamento...</span>
            </div>
          )}
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
            <div className="flex items-center gap-2">
              <div className={`status-dot ${backupRunning?"yellow":"green"}`}/>
              <span style={{fontSize:12,color:"var(--text2)"}}>Telegram</span>
            </div>
            <button className="btn btn-ghost btn-icon btn-sm"><Icon n="bell" size={15}/></button>
          </div>
        </div>

        <div style={{flex:1,overflow:"auto"}}>
          <div key={page} className="anim-fi" style={{height:"100%"}}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
