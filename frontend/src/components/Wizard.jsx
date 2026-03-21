import { useState } from "react";
import { auth as authApi } from "../api.js";
import { Icon, Spinner } from "./common.jsx";

export default function Wizard({onDone}) {
  const [step,setStep] = useState(0);
  const [phone,setPhone] = useState("+55 ");
  const [code,setCode] = useState("");
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");

  const load = async (cb) => {
    setLoading(true);
    try { await cb(); }
    catch(e) { setError(e?.response?.data?.detail || e.message || "Erro desconhecido"); }
    finally { setLoading(false); }
  };

  return (
    <div className="wizard-wrap">
      <div className="wizard-card">
        {/* STEP 0: phone */}
        {step===0 && <div className="anim-si">
          <div className="wiz-logo"><Icon n="tg" size={24} color="white"/></div>
          <div className="wiz-step-bar">{[0,1,2].map(i=><div key={i} className={`wiz-dot ${i===0?"active":""}`}/>)}</div>
          <div className="wiz-title">Conectar ao Telegram</div>
          <div className="wiz-sub">Autorize o TeleVault a acessar seu armazenamento pessoal via API oficial Telegram.</div>
          <div className="form-grp">
            <label className="form-lbl">Número de telefone</label>
            <input className="input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+55 11 99999-9999" style={{fontSize:15,letterSpacing:".02em"}}/>
          </div>
          <div style={{fontSize:12,color:"var(--text3)",marginBottom:20,lineHeight:1.7,padding:"10px 12px",background:"var(--bg2)",borderRadius:9,border:"1px solid var(--border)"}}>
            <span style={{color:"var(--tg)"}}>ℹ</span>  Seus dados nunca saem do seu próprio armazenamento Telegram. Zero servidores terceiros.
          </div>
          <button className="btn btn-primary w-full" style={{padding:"12px",fontSize:14}} onClick={()=>load(async()=>{setError("");await authApi.sendCode(phone);setStep(1);})} disabled={loading}>
            {loading?<><Spinner/>Enviando...</>:<><span>Enviar código</span><Icon n="arrow" size={14}/></>}
          </button>
          {error&&<div style={{marginTop:12,padding:"10px 12px",background:"rgba(255,69,58,.08)",border:"1px solid rgba(255,69,58,.2)",borderRadius:9,fontSize:12.5,color:"var(--red)"}}>{error}</div>}
        </div>}

        {/* STEP 1: code */}
        {step===1 && <div className="anim-si">
          <div className="wiz-logo" style={{background:"linear-gradient(145deg,#30D158,#1A8A3A)"}}><Icon n="check" size={22} color="white"/></div>
          <div className="wiz-step-bar">{[0,1,2].map(i=><div key={i} className={`wiz-dot ${i===1?"active":i<1?"done":""}`}/>)}</div>
          <div className="wiz-title">Verificar identidade</div>
          <div className="wiz-sub">Digite o código de 5 dígitos enviado para o seu Telegram agora.</div>
          <div className="form-grp">
            <label className="form-lbl">Código de verificação</label>
            <input className="input" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,5))}
              placeholder="• • • • •" style={{fontSize:22,letterSpacing:"0.4em",textAlign:"center",fontFamily:"var(--mono)",padding:"14px"}}/>
          </div>
          <button className="btn btn-primary w-full" style={{padding:"12px",fontSize:14,marginBottom:10}} onClick={()=>load(async()=>{setError("");await authApi.signIn(code);setStep(2);})} disabled={loading||code.length<5}>
            {loading?<><Spinner/>Verificando...</>:<><span>Confirmar</span><Icon n="arrow" size={14}/></>}
          </button>
          {error&&<div style={{marginTop:10,padding:"10px 12px",background:"rgba(255,69,58,.08)",border:"1px solid rgba(255,69,58,.2)",borderRadius:9,fontSize:12.5,color:"var(--red)"}}>{error}</div>}
          <button className="btn btn-ghost w-full" style={{padding:"10px",marginTop:8}} onClick={()=>{setStep(0);setError("");}}><Icon n="arrowL" size={14}/>Voltar</button>
        </div>}

        {/* STEP 2: done */}
        {step===2 && <div className="anim-si" style={{maxHeight:"80vh",overflowY:"auto"}}>
          <div className="wiz-logo" style={{background:"linear-gradient(145deg,#30D158,#1A8A3A)"}}><Icon n="check" size={24} color="white"/></div>
          <div className="wiz-step-bar">{[0,1,2].map(i=><div key={i} className={`wiz-dot ${i===2?"active":"done"}`}/>)}</div>
          <div className="wiz-title">Tudo pronto!</div>
          <div className="wiz-sub">Autenticação concluída. O TeleVault vai usar o canal configurado no servidor para armazenar seus backups.</div>

          <div style={{padding:"14px 16px",background:"var(--bg2)",borderRadius:10,border:"1px solid var(--border)",marginBottom:20}}>
            <div className="flex items-center gap-3">
              <span style={{fontSize:22}}>📦</span>
              <div>
                <div style={{fontSize:13,fontWeight:600}}>Canal de backup</div>
                <div style={{fontSize:12,color:"var(--text2)",fontFamily:"var(--mono)",marginTop:2}}>Configurado via TELEVAULT_CHANNEL_ID no servidor</div>
              </div>
              <span className="tag tag-green" style={{marginLeft:"auto"}}>Ativo</span>
            </div>
          </div>

          <div style={{fontSize:12,color:"var(--text3)",marginBottom:20,lineHeight:1.7,padding:"10px 12px",background:"var(--bg2)",borderRadius:9,border:"1px solid var(--border)"}}>
            <span style={{color:"var(--tg)"}}>ℹ</span>  Seus arquivos são enviados diretamente para o seu canal privado no Telegram. Nenhum servidor terceiro é envolvido.
          </div>

          <button className="btn btn-primary w-full" style={{padding:"12px",fontSize:14}} onClick={()=>load(onDone)} disabled={loading}>
            {loading?<><Spinner/>Carregando...</>:<><Icon n="zap" size={15}/><span>Começar a usar</span></>}
          </button>
        </div>}
      </div>
    </div>
  );
}

