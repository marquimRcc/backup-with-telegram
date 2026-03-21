/**
 * common.jsx — componentes reutilizáveis
 */

/* ─── ICONS ──────────────────────────────────────────────────────────────── */
const icPaths = {
  home:     <><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
  cloud:    <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>,
  folder:   <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>,
  activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>,
  shield:   <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
  plus:     <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  check:    <polyline points="20 6 9 17 4 12" strokeWidth="2.5"/>,
  arrow:    <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
  arrowL:   <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>,
  refresh:  <><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></>,
  clock:    <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  zap:      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" strokeWidth="1.6"/>,
  file:     <><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></>,
  play:     <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none"/>,
  pause:    <><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/></>,
  tg:       <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.89 8.22l-1.97 9.28c-.14.66-.54.82-1.08.51l-3-2.21-1.45 1.39c-.16.16-.29.29-.6.29l.21-3.05 5.56-5.02c.24-.21-.05-.33-.37-.12L6.21 13.8l-2.96-.92c-.64-.2-.66-.64.14-.95l11.57-4.46c.53-.2 1.01.13.83.95z" fill="currentColor" stroke="none"/>,
  trash:    <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></>,
  download: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
  upload:   <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
  link:     <><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></>,
  bell:     <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>,
  info:     <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8" strokeWidth="2.5"/></>,
  wrench:   <><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></>,
};

export const Icon = ({ n, size = 16, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"}
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {icPaths[n]}
  </svg>
);

export const FILE_ICON = {pdf:"📄",xls:"📊",xlsx:"📊",ppt:"📑",pptx:"📑",doc:"📝",docx:"📝",txt:"📋",md:"📋",jpg:"🖼️",jpeg:"🖼️",png:"🖼️",gif:"🖼️",mp4:"🎬",mkv:"🎬",mp3:"🎵",flac:"🎵",zip:"🗜️",gz:"🗜️",tar:"🗜️",rar:"🗜️","7z":"🗜️",py:"💾",js:"💾",jsx:"💾",java:"💾",sh:"💾",json:"💾",dir:"📁",file:"📄",appimage:"🗜️"};

/** Separa "MarcosQueiroz" → "Marcos Queiroz" */
export const splitName = (name) => name ? name.replace(/([a-z])([A-Z])/g, "$1 $2") : "...";

export const Spinner = ({size=16}) => (
  <div style={{width:size,height:size,borderRadius:"50%",border:`2px solid rgba(255,255,255,.2)`,borderTopColor:"white",animation:"spin 1s linear infinite",flexShrink:0}}/>
);

export const Toggle = ({on,onToggle}) => (
  <button className={`toggle ${on?"on":"off"}`} onClick={onToggle} style={{outline:"none"}}>
    <div className="toggle-knob"/>
  </button>
);

export const fmtSize = (b) => b > 1073741824 ? `${(b/1073741824).toFixed(1)} GB` : b > 1048576 ? `${(b/1048576).toFixed(1)} MB` : `${Math.round(b/1024)} KB`;
