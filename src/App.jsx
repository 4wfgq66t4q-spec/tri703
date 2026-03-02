import { useState, useEffect, useRef, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

// ─── DATA ─────────────────────────────────────────────────────────────────────
const RACE_DATE = new Date("2026-09-13T07:00:00");
const DEFAULT_FTP = 212;

const PHASE = {
  1:"Base",2:"Base",3:"Base",4:"Base",
  5:"Aerobic",6:"Aerobic",7:"Aerobic",8:"Aerobic",
  9:"Recovery",10:"Build I",11:"Build I",12:"Build I",
  13:"Build II",14:"Build II",15:"Build II",16:"Build II",
  17:"Peak",18:"Peak",19:"Peak",20:"Peak",
  21:"Race-Specific",22:"Race-Specific",23:"Race-Specific",24:"Race-Specific",
  25:"Taper I",26:"Taper II",27:"Taper III",28:"Race Week",
};

const PLAN = {
  1:[1500,1600,60,75,120,45,65],  2:[1600,1600,65,60,125,48,68],
  3:[1700,1700,70,60,130,51,71],  4:[1800,1800,75,60,135,54,74],
  5:[1900,1900,80,60,140,57,77],  6:[2000,2000,85,60,145,60,80],
  7:[2100,2100,90,60,150,63,83],  8:[2200,2200,95,60,155,66,86],
  9:[2200,2200,75,60,135,50,70], 10:[2300,2300,80,60,140,54,74],
  11:[2400,2400,85,60,145,58,78],12:[2500,2500,90,60,150,62,82],
  13:[2600,2600,95,60,155,66,86],14:[2700,2700,100,60,160,70,90],
  15:[2800,2800,105,60,165,74,94],16:[2900,2900,110,60,170,78,98],
  17:[2600,2600,90,60,150,75,95],18:[2700,2700,95,60,155,80,100],
  19:[2800,2800,100,60,160,85,105],20:[2900,2900,105,60,165,90,110],
  21:[3000,3000,110,60,170,95,115],22:[3100,3100,115,60,175,100,120],
  23:[3200,3200,120,60,180,105,125],24:[3300,3300,125,60,185,110,130],
  25:[2000,2000,75,60,135,50,70],26:[1700,1700,60,60,120,40,60],
  27:[1400,1400,45,60,105,30,50],28:[1100,1100,30,60,90,20,40],
};

function getWorkouts(w) {
  const p = PLAN[w]||PLAN[1];
  const isTaper=w>=25, isRace=w>=21&&w<=24;
  const bz=isTaper?"Z2 Easy":isRace?"Race Pace 80–90%":w>=17?"Threshold 85–95%":"Z2 56–75%";
  const rz=isTaper?"Easy recovery":isRace?"7:30–8:00/mi":"Z2 conversational";
  return [
    {id:"ms",day:"MON",disc:"SWIM",  title:"Technique Swim",   detail:`${p[0]}m`,                    zone:"2:00–2:40/100m",  note:"Form & catch focus"},
    {id:"tb",day:"TUE",disc:"BIKE",  title:"Endurance Ride",   detail:`${p[2]} min`,                 zone:bz,                note:"Cadence 85–95 rpm"},
    {id:"ts",day:"TUE",disc:"LIFT",  title:"Lower Body Power", detail:"45 min",                      zone:"—",               note:"Squats, deadlifts"},
    {id:"wr",day:"WED",disc:"RUN",   title:"Interval Run",     detail:`${p[5]} min`,                 zone:rz,                note:"Controlled effort"},
    {id:"hb",day:"THU",disc:"BIKE",  title:"Tempo Ride",       detail:`${p[3]} min`,                 zone:bz,                note:"Steady power output"},
    {id:"hs",day:"THU",disc:"LIFT",  title:"Upper Body",       detail:"40 min",                      zone:"—",               note:"Bench, rows, pull-ups"},
    {id:"fw",day:"FRI",disc:"SWIM",  title:"Aerobic Swim",     detail:`${p[1]}m`,                    zone:"2:10–2:40/100m",  note:"Sight & steady pace"},
    {id:"fl",day:"FRI",disc:"LIFT",  title:"Upper Body Power", detail:"40 min",                      zone:"—",               note:"Explosive push/pull"},
    {id:"sb",day:"SAT",disc:"BRICK", title:"Long Ride + Run",  detail:`${p[4]}m bike + 20–40m run`,  zone:bz,                note:"Nutrition & T2 practice"},
    {id:"sr",day:"SUN",disc:"RUN",   title:"Long Easy Run",    detail:`${p[6]} min`,                 zone:"Z2 by feel",      note:"No watch, run easy"},
  ];
}

function getZones(ftp) {
  return [
    {z:"Z1",name:"Active Recovery",lo:0,               hi:Math.round(ftp*.55), pct:"< 55%"},
    {z:"Z2",name:"Endurance",      lo:Math.round(ftp*.56),hi:Math.round(ftp*.75),pct:"56–75%"},
    {z:"Z3",name:"Tempo",          lo:Math.round(ftp*.76),hi:Math.round(ftp*.90),pct:"76–90%"},
    {z:"Z4",name:"Threshold",      lo:Math.round(ftp*.91),hi:Math.round(ftp*1.05),pct:"91–105%"},
    {z:"Z5",name:"VO2 Max",        lo:Math.round(ftp*1.06),hi:Math.round(ftp*1.20),pct:"106–120%"},
    {z:"Z6",name:"Anaerobic",      lo:Math.round(ftp*1.21),hi:Math.round(ftp*1.50),pct:"> 121%"},
  ];
}

function calcTSS(a, ftp) {
  if ((a.type==="Ride"||a.type==="VirtualRide")&&a.average_watts) {
    const np=a.weighted_average_watts||a.average_watts,IF_=np/ftp,hrs=a.moving_time/3600;
    return Math.round(hrs*np*IF_/ftp*100);
  }
  if (a.suffer_score) return a.suffer_score*2;
  return Math.round((a.moving_time/3600)*45);
}

function getLoad(acts, ftp) {
  if (!acts?.length) return {label:"No Data",sub:"Connect Strava to unlock",pct:0,color:"#999"};
  const tss=acts.slice(0,10).reduce((s,a)=>s+calcTSS(a,ftp),0);
  if (tss>600) return {label:"Overreaching",sub:`~${tss} TSS this week`,pct:100,color:"#000"};
  if (tss>450) return {label:"Well Loaded",sub:`~${tss} TSS this week`,pct:78,color:"#000"};
  if (tss>280) return {label:"Optimal",sub:`~${tss} TSS this week`,pct:58,color:"#000"};
  if (tss>120) return {label:"Fresh",sub:`~${tss} TSS this week`,pct:32,color:"#000"};
  return        {label:"Undertrained",sub:`~${tss} TSS — add volume`,pct:14,color:"#000"};
}

function getLoadAdvice(acts, ftp) {
  if (!acts?.length) return "Connect Strava to get personalized weekly recommendations based on your actual training data.";
  const tss=acts.slice(0,10).reduce((s,a)=>s+calcTSS(a,ftp),0);
  if (tss>600) return "Your load is very high. Take an easy week — Z2 only, prioritize sleep. No intensity until you feel fresh.";
  if (tss>450) return "Good stimulus. Keep this week similar or slightly lighter. Watch for heavy legs or elevated resting HR.";
  if (tss>280) return "Sweet spot. Push your key sessions this week — brick and intervals are fair game. Stay on top of sleep.";
  if (tss>120) return "Below target. Extend your long ride and don't skip swim sessions — you have capacity to add volume.";
  return "Very low stimulus. Ramp up gradually, no more than +10% per week, but you have room to add sessions.";
}

function daysLeft() { return Math.ceil((RACE_DATE-new Date())/(1000*60*60*24)); }
function fmt(s) { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h?`${h}h ${m}m`:`${m}m`; }
function km(m) { return (m/1000).toFixed(1)+" km"; }
function discLabel(d) {
  if(d==="SWIM") return "Swim";
  if(d==="BIKE") return "Bike";
  if(d==="RUN")  return "Run";
  if(d==="BRICK")return "Brick";
  return "Lift";
}

async function stravaFetch(ep, tok) {
  const r = await fetch(`/api/strava?endpoint=${encodeURIComponent(ep)}&token=${encodeURIComponent(tok)}`);
  if(!r.ok) throw new Error(`${r.status}`);
  return r.json();
}
async function refreshStravaToken(cid,sec,ref) {
  const r=await fetch("/api/refresh",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({client_id:cid,client_secret:sec,refresh_token:ref})});
  if(!r.ok) throw new Error(`${r.status}`);
  return r.json();
}
async function askCoach(msgs, ftp, week, load, acts) {
  const sys=`You are a sharp, direct triathlon coach for Shaun, racing 70.3 on September 13, 2026. FTP=${ftp}W, Week ${week}/28 (${PHASE[week]||"Base"}), Load: ${load?.label}. Recent: ${acts?.slice(0,4).map(a=>`${a.type} ${fmt(a.moving_time)} HR:${a.average_heartrate||"—"} W:${a.average_watts||"—"}`).join(" | ")||"none"}. Be direct and specific. 2 paragraphs max.`;
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:800,system:sys,messages:msgs})});
  const d=await r.json();
  return d.content?.[0]?.text||"Coach unavailable.";
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,       setTab]       = useState("home");
  const [week,      setWeek]      = useState(6);
  const [ftp,       setFtp]       = useState(DEFAULT_FTP);
  const [ftpInput,  setFtpInput]  = useState(String(DEFAULT_FTP));
  const [checked,   setChecked]   = useState({});
  const [acts,      setActs]      = useState([]);
  const [athlete,   setAthlete]   = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [err,       setErr]       = useState("");
  const [modal,     setModal]     = useState(false);
  const [tok,       setTok]       = useState("");
  const [cid,       setCid]       = useState("");
  const [csec,      setCsec]      = useState("");
  const [rtok,      setRtok]      = useState("");
  const [chat,      setChat]      = useState([{role:"assistant",content:"Hey Shaun. Week 6, September 13 is the goal. You're behind on swims — let's fix that. What do you need?"}]);
  const [chatIn,    setChatIn]    = useState("");
  const [chatLoad,  setChatLoad]  = useState(false);
  const chatEnd = useRef(null);

  const days   = daysLeft();
  const load   = getLoad(acts, ftp);
  const advice = getLoadAdvice(acts, ftp);
  const wos    = getWorkouts(week);
  const done   = wos.filter(w=>checked[`${week}-${w.id}`]).length;
  const zones  = getZones(ftp);
  const phase  = PHASE[week]||"Base";

  const chartData = Array.from({length:28},(_,i)=>{
    const wk=i+1,p=PLAN[wk];
    return {w:`${wk}`,B:p[2]+p[3]+p[4],R:p[5]+p[6],S:Math.round((p[0]+p[1])/100)};
  });

  useEffect(()=>{chatEnd.current?.scrollIntoView({behavior:"smooth"})},[chat]);

  useEffect(()=>{
    try {
      const s=JSON.parse(localStorage.getItem("t703")||"{}");
      if(s.checked)   setChecked(s.checked);
      if(s.ftp)       {setFtp(s.ftp);setFtpInput(String(s.ftp));}
      if(s.week)      setWeek(s.week);
      if(s.tok)       setTok(s.tok);
      if(s.cid)       setCid(s.cid);
      if(s.csec)      setCsec(s.csec);
      if(s.rtok)      setRtok(s.rtok);
      if(s.connected) setConnected(s.connected);
      if(s.acts?.length) setActs(s.acts);
      if(s.athlete)   setAthlete(s.athlete);
    } catch{}
  },[]);

  const save = useCallback((u)=>{
    try{const c=JSON.parse(localStorage.getItem("t703")||"{}");localStorage.setItem("t703",JSON.stringify({...c,...u}));}catch{}
  },[]);

  const toggle = id => {
    const k=`${week}-${id}`,n={...checked,[k]:!checked[k]};
    setChecked(n);save({checked:n});
  };

  const connect = async()=>{
    setLoading(true);setErr("");
    try{
      let t=tok;
      if(cid&&csec&&rtok){const r=await refreshStravaToken(cid,csec,rtok);if(r.access_token){t=r.access_token;setTok(t);}}
      const[ath,ac]=await Promise.all([stravaFetch("/athlete",t),stravaFetch("/athlete/activities?per_page=25",t)]);
      setAthlete(ath);setActs(ac);setConnected(true);
      save({tok:t,cid,csec,rtok,connected:true,acts:ac,athlete:ath});
      setModal(false);
    }catch(e){setErr("Connection failed: "+e.message);}
    setLoading(false);
  };

  const send = async()=>{
    if(!chatIn.trim()||chatLoad)return;
    const u={role:"user",content:chatIn},n=[...chat,u];
    setChat(n);setChatIn("");setChatLoad(true);
    try{const r=await askCoach(n.filter((_,i)=>i>0||n[0].role==="user"),ftp,week,load,acts);setChat([...n,{role:"assistant",content:r}]);}
    catch{setChat([...n,{role:"assistant",content:"Connection error."}]);}
    setChatLoad(false);
  };

  const updateFtp=()=>{const v=parseInt(ftpInput);if(v>50&&v<600){setFtp(v);save({ftp:v});}};

  // ─── NAV ITEMS ──────────────────────────────────────────────────────────────
  const navItems = [
    {id:"home",  label:"Home"},
    {id:"plan",  label:"Plan"},
    {id:"strava",label:"Strava"},
    {id:"zones", label:"Zones"},
    {id:"coach", label:"Coach"},
  ];

  return (
    <div style={{
      fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
      background:"#fff",
      minHeight:"100vh",
      maxWidth:393,
      margin:"0 auto",
      position:"relative",
      overflow:"hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{margin:0;background:#fff;}
        input,button{font-family:inherit;}
        input:focus{outline:none;}
        ::-webkit-scrollbar{display:none;}

        .pill-tag {
          display:inline-block;
          border:1.5px solid #000;
          border-radius:100px;
          padding:3px 10px;
          font-size:10px;
          font-weight:700;
          letter-spacing:.5px;
          text-transform:uppercase;
        }
        .pill-fill {
          display:inline-block;
          background:#000;
          color:#fff;
          border-radius:100px;
          padding:3px 10px;
          font-size:10px;
          font-weight:700;
          letter-spacing:.5px;
          text-transform:uppercase;
        }
        .wo-card {
          border-top:1px solid #e8e8e8;
          padding:14px 0;
          display:flex;
          align-items:flex-start;
          gap:14px;
          cursor:pointer;
          transition:opacity .15s;
          -webkit-user-select:none;
        }
        .wo-card:active{opacity:.6;}
        .check-box {
          width:22px;height:22px;border-radius:50%;
          border:1.5px solid #000;
          flex-shrink:0;margin-top:1px;
          display:flex;align-items:center;justify-content:center;
          transition:all .15s;
        }
        .check-box.done{background:#000;border-color:#000;}
        .tap-btn {
          background:#000;color:#fff;border:none;
          border-radius:100px;padding:14px 24px;
          font-size:14px;font-weight:700;cursor:pointer;
          transition:opacity .15s;width:100%;
          letter-spacing:.2px;
        }
        .tap-btn:active{opacity:.7;}
        .tap-btn.outline{background:#fff;color:#000;border:1.5px solid #000;}
        .field {
          background:#f5f5f5;border:none;border-radius:12px;
          padding:14px 16px;font-size:15px;width:100%;color:#000;
        }
        .nav-bar {
          position:fixed;bottom:0;left:50%;transform:translateX(-50%);
          width:393px;background:#fff;
          border-top:1px solid #e8e8e8;
          display:flex;align-items:center;
          padding:0 0 env(safe-area-inset-bottom,16px) 0;
          z-index:100;
        }
        .nav-item {
          flex:1;display:flex;flex-direction:column;align-items:center;
          padding:10px 0 4px;cursor:pointer;gap:3px;
          transition:opacity .15s;
          background:none;border:none;
          -webkit-user-select:none;
        }
        .nav-item:active{opacity:.5;}
        .nav-dot {
          width:4px;height:4px;border-radius:50%;
          background:#000;margin-top:1px;
          transition:opacity .15s;
        }
        .act-row {
          border-top:1px solid #e8e8e8;
          padding:14px 0;
          display:flex;align-items:center;gap:12px;
        }
        .stat-box {
          flex:1;border:1.5px solid #000;border-radius:16px;
          padding:16px;
        }
        .section-title {
          font-size:11px;font-weight:700;letter-spacing:1px;
          text-transform:uppercase;color:#999;margin-bottom:12px;
        }
        .divider{height:1px;background:#e8e8e8;margin:24px 0;}
        .modal-overlay{
          position:fixed;inset:0;background:rgba(0,0,0,.6);
          z-index:200;display:flex;align-items:flex-end;
        }
        .modal-sheet{
          background:#fff;width:100%;border-radius:20px 20px 0 0;
          padding:24px 20px calc(32px + env(safe-area-inset-bottom,0px));
          max-height:85vh;overflow-y:auto;
        }
        .modal-handle{
          width:36px;height:4px;background:#e0e0e0;border-radius:2px;
          margin:0 auto 20px;
        }
        .bubble-me{
          background:#000;color:#fff;border-radius:18px 18px 4px 18px;
          padding:12px 16px;max-width:82%;align-self:flex-end;
          font-size:14px;line-height:1.5;
        }
        .bubble-ai{
          background:#f5f5f5;color:#000;border-radius:18px 18px 18px 4px;
          padding:12px 16px;max-width:82%;align-self:flex-start;
          font-size:14px;line-height:1.6;
        }
        .progress-track{
          height:3px;background:#e8e8e8;border-radius:2px;overflow:hidden;
        }
        .progress-fill{
          height:100%;background:#000;border-radius:2px;transition:width .4s;
        }
      `}</style>

      {/* ── STRAVA MODAL ── */}
      {modal && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setModal(false);}}>
          <div className="modal-sheet">
            <div className="modal-handle"/>
            <div style={{fontSize:22,fontWeight:800,marginBottom:6}}>Connect Strava</div>
            <div style={{fontSize:13,color:"#666",marginBottom:20,lineHeight:1.5}}>
              Get your credentials at <span style={{color:"#FC4C02",fontWeight:600}}>strava.com/settings/api</span>. Stored locally only.
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div>
                <div className="section-title" style={{marginBottom:6}}>Access Token</div>
                <input className="field" placeholder="Paste access_token" value={tok} onChange={e=>setTok(e.target.value)}/>
              </div>
              <div style={{textAlign:"center",fontSize:11,color:"#ccc",padding:"4px 0"}}>— or use all three for auto-refresh —</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <div className="section-title" style={{marginBottom:6}}>Client ID</div>
                  <input className="field" placeholder="207209" value={cid} onChange={e=>setCid(e.target.value)}/>
                </div>
                <div>
                  <div className="section-title" style={{marginBottom:6}}>Client Secret</div>
                  <input className="field" type="password" placeholder="••••••" value={csec} onChange={e=>setCsec(e.target.value)}/>
                </div>
              </div>
              <div>
                <div className="section-title" style={{marginBottom:6}}>Refresh Token</div>
                <input className="field" placeholder="Refresh token" value={rtok} onChange={e=>setRtok(e.target.value)}/>
              </div>
              {err && <div style={{fontSize:12,color:"#c00",background:"#fff0f0",padding:"10px 12px",borderRadius:10}}>{err}</div>}
              <button className="tap-btn" style={{background:"#FC4C02",marginTop:4}} onClick={connect} disabled={loading}>
                {loading?"Connecting…":"Connect Strava"}
              </button>
              <button className="tap-btn outline" onClick={()=>setModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SCROLL AREA ── */}
      <div style={{paddingBottom:80,minHeight:"100vh",overflowY:"auto",WebkitOverflowScrolling:"touch"}}>

        {/* ════════ HOME ════════ */}
        {tab==="home" && (
          <div>
            {/* Hero */}
            <div style={{background:"#000",color:"#fff",padding:"56px 20px 32px"}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,opacity:.5,textTransform:"uppercase",marginBottom:8}}>
                {connected && athlete ? `${athlete.firstname} ${athlete.lastname} ·` : ""} September 13, 2026
              </div>
              <div style={{fontSize:72,fontWeight:900,lineHeight:.88,letterSpacing:-3,marginBottom:4}}>
                {days}
              </div>
              <div style={{fontSize:16,fontWeight:500,opacity:.6,marginBottom:24}}>days to race day</div>

              {/* Week progress */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontSize:11,fontWeight:700,letterSpacing:1,opacity:.5,textTransform:"uppercase"}}>
                  Week {week} of 28
                </span>
                <span style={{fontSize:11,fontWeight:700,letterSpacing:1,opacity:.5,textTransform:"uppercase"}}>
                  {phase}
                </span>
              </div>
              <div className="progress-track" style={{background:"rgba(255,255,255,.15)"}}>
                <div className="progress-fill" style={{width:`${week/28*100}%`,background:"#fff"}}/>
              </div>
            </div>

            <div style={{padding:"0 20px"}}>

              {/* Stats row */}
              <div style={{display:"flex",gap:10,margin:"20px 0"}}>
                <div className="stat-box">
                  <div style={{fontSize:28,fontWeight:900,letterSpacing:-1,lineHeight:1}}>{done}/{wos.length}</div>
                  <div style={{fontSize:11,fontWeight:600,color:"#999",marginTop:4,textTransform:"uppercase",letterSpacing:.5}}>This week</div>
                </div>
                <div className="stat-box">
                  <div style={{fontSize:22,fontWeight:900,letterSpacing:-1,lineHeight:1.1}}>{ftp}<span style={{fontSize:13,fontWeight:500,color:"#999"}}> W</span></div>
                  <div style={{fontSize:11,fontWeight:600,color:"#999",marginTop:4,textTransform:"uppercase",letterSpacing:.5}}>FTP</div>
                </div>
                <div className="stat-box" style={{cursor:"pointer"}} onClick={()=>setTab("strava")}>
                  <div style={{fontSize:22,fontWeight:900,letterSpacing:-1,lineHeight:1.1,color:connected?"#FC4C02":"#000"}}>
                    {connected ? acts.length : "—"}
                  </div>
                  <div style={{fontSize:11,fontWeight:600,color:"#999",marginTop:4,textTransform:"uppercase",letterSpacing:.5}}>
                    {connected?"Activities":"Strava"}
                  </div>
                </div>
              </div>

              <div className="divider" style={{margin:"8px 0 20px"}}/>

              {/* Training load */}
              <div className="section-title">Training Load</div>
              <div style={{marginBottom:4}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
                  <div style={{fontSize:24,fontWeight:900,letterSpacing:-1}}>{load.label}</div>
                  <div style={{fontSize:11,color:"#999",fontWeight:500}}>{load.sub}</div>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{width:`${load.pct}%`}}/>
                </div>
              </div>
              <div style={{fontSize:13,color:"#444",lineHeight:1.6,marginTop:12}}>{advice}</div>

              <div className="divider"/>

              {/* Volume chart */}
              <div className="section-title">28-Week Volume</div>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={chartData} margin={{top:4,right:0,bottom:0,left:-30}}>
                  <defs>
                    {[["gb","#000"],["gr","#555"],["gs","#aaa"]].map(([id,c])=>(
                      <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={c} stopOpacity={.3}/>
                        <stop offset="95%" stopColor={c} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <XAxis dataKey="w" tick={{fontSize:9,fill:"#ccc"}} tickLine={false} axisLine={false} interval={3}/>
                  <YAxis tick={{fontSize:9,fill:"#ccc"}} tickLine={false} axisLine={false}/>
                  <Tooltip contentStyle={{background:"#fff",border:"1px solid #e8e8e8",borderRadius:8,fontSize:11,boxShadow:"0 4px 12px rgba(0,0,0,.08)"}} labelStyle={{fontWeight:700}}/>
                  <Area type="monotone" dataKey="B" stroke="#000" fill="url(#gb)" strokeWidth={1.5} name="Bike"/>
                  <Area type="monotone" dataKey="R" stroke="#555" fill="url(#gr)" strokeWidth={1.5} name="Run"/>
                  <Area type="monotone" dataKey="S" stroke="#aaa" fill="url(#gs)" strokeWidth={1.5} name="Swim"/>
                </AreaChart>
              </ResponsiveContainer>
              <div style={{fontSize:11,color:"#ccc",textAlign:"center",marginTop:6}}>Bike · Run · Swim — Taper starts Week 25</div>

              <div className="divider"/>

              {/* Week slider */}
              <div className="section-title">Current Week</div>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
                <input type="range" min={1} max={28} value={week}
                  onChange={e=>{const v=+e.target.value;setWeek(v);save({week:v});}}
                  style={{flex:1,accentColor:"#000",height:2}}/>
                <div style={{fontSize:15,fontWeight:800,minWidth:52,textAlign:"right"}}>Wk {week}</div>
              </div>

              {/* Strava CTA */}
              {!connected && (
                <>
                  <div className="divider"/>
                  <button className="tap-btn" style={{background:"#FC4C02",marginBottom:8}} onClick={()=>setModal(true)}>
                    Connect Strava
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ════════ PLAN ════════ */}
        {tab==="plan" && (
          <div style={{padding:"56px 20px 0"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:4}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:"#999",textTransform:"uppercase",marginBottom:2}}>{phase}</div>
                <div style={{fontSize:38,fontWeight:900,letterSpacing:-2,lineHeight:.95}}>Week {week}</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button className="tap-btn outline" style={{width:"auto",padding:"8px 14px",fontSize:13}}
                  onClick={()=>{const n=Math.max(1,week-1);setWeek(n);save({week:n});}}>←</button>
                <button className="tap-btn" style={{width:"auto",padding:"8px 14px",fontSize:13}}
                  onClick={()=>{const n=Math.min(28,week+1);setWeek(n);save({week:n});}}>→</button>
              </div>
            </div>

            <div style={{fontSize:12,color:"#999",marginBottom:20}}>{done} of {wos.length} sessions complete</div>
            <div className="progress-track" style={{marginBottom:24}}>
              <div className="progress-fill" style={{width:`${done/wos.length*100}%`}}/>
            </div>

            {/* Group by day */}
            {["MON","TUE","WED","THU","FRI","SAT","SUN"].map(day=>{
              const dayWos=wos.filter(w=>w.day===day);
              if(!dayWos.length) return null;
              const dayFull={MON:"Monday",TUE:"Tuesday",WED:"Wednesday",THU:"Thursday",FRI:"Friday",SAT:"Saturday",SUN:"Sunday"}[day];
              return (
                <div key={day} style={{marginBottom:8}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:1,color:"#bbb",textTransform:"uppercase",marginBottom:0,paddingTop:4}}>{dayFull}</div>
                  {dayWos.map(wo=>{
                    const k=`${week}-${wo.id}`,isDone=!!checked[k];
                    return (
                      <div key={wo.id} className="wo-card" onClick={()=>toggle(wo.id)}>
                        <div className={`check-box ${isDone?"done":""}`}>
                          {isDone && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <div style={{flex:1,opacity:isDone?.45:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                            <span style={{fontSize:14,fontWeight:700}}>{wo.title}</span>
                            <span className="pill-tag" style={{fontSize:9}}>{wo.disc}</span>
                          </div>
                          <div style={{fontSize:12,color:"#666",marginBottom:2}}>{wo.note}</div>
                          <div style={{fontSize:11,color:"#aaa"}}>{wo.zone}</div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0,opacity:isDone?.45:1}}>
                          <div style={{fontSize:13,fontWeight:800}}>{wo.detail}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* ════════ STRAVA ════════ */}
        {tab==="strava" && (
          <div style={{padding:"56px 20px 0"}}>
            {!connected ? (
              <div style={{paddingTop:40,textAlign:"center"}}>
                <div style={{fontSize:48,marginBottom:16}}>🟠</div>
                <div style={{fontSize:32,fontWeight:900,letterSpacing:-1.5,marginBottom:8}}>Connect Strava</div>
                <div style={{fontSize:14,color:"#666",lineHeight:1.6,maxWidth:280,margin:"0 auto 32px"}}>
                  Sync your real workouts for smart training load analysis and weekly recommendations.
                </div>
                <button className="tap-btn" style={{background:"#FC4C02"}} onClick={()=>setModal(true)}>Connect Strava</button>
              </div>
            ) : (
              <>
                {athlete && (
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
                    {athlete.profile_medium && <img src={athlete.profile_medium} alt="" style={{width:44,height:44,borderRadius:"50%",border:"2px solid #000"}}/>}
                    <div style={{flex:1}}>
                      <div style={{fontSize:17,fontWeight:800}}>{athlete.firstname} {athlete.lastname}</div>
                      <div style={{fontSize:12,color:"#999"}}>{athlete.city} · {acts.length} activities</div>
                    </div>
                    <button className="tap-btn outline" style={{width:"auto",padding:"8px 14px",fontSize:12}} onClick={()=>setModal(true)}>Edit</button>
                  </div>
                )}

                {/* Load */}
                <div className="section-title">Training Load</div>
                <div style={{fontSize:32,fontWeight:900,letterSpacing:-1.5,marginBottom:4}}>{load.label}</div>
                <div style={{fontSize:12,color:"#999",marginBottom:10}}>{load.sub}</div>
                <div className="progress-track" style={{marginBottom:16}}>
                  <div className="progress-fill" style={{width:`${load.pct}%`}}/>
                </div>
                <div style={{fontSize:13,color:"#444",lineHeight:1.6,marginBottom:24}}>{advice}</div>

                {/* TSS chart */}
                {acts.length>2 && (
                  <>
                    <div className="section-title">Recent TSS</div>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={[...acts].reverse().slice(0,10).map(a=>({n:a.name.slice(0,8),T:calcTSS(a,ftp)}))}>
                        <XAxis dataKey="n" tick={{fontSize:8,fill:"#ccc"}} tickLine={false} axisLine={false}/>
                        <YAxis tick={{fontSize:8,fill:"#ccc"}} tickLine={false} axisLine={false}/>
                        <Tooltip contentStyle={{background:"#fff",border:"1px solid #e8e8e8",borderRadius:8,fontSize:11}} labelStyle={{fontWeight:700}}/>
                        <Bar dataKey="T" fill="#000" radius={[3,3,0,0]} name="TSS"/>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="divider"/>
                  </>
                )}

                {/* Activity list */}
                <div className="section-title">Activities</div>
                {acts.slice(0,15).map(act=>{
                  const tss=calcTSS(act,ftp);
                  const icon=act.type==="Ride"||act.type==="VirtualRide"?"🚴":act.type==="Run"?"🏃":act.type==="Swim"?"🏊":"🏋️";
                  return (
                    <div key={act.id} className="act-row">
                      <div style={{fontSize:22,width:36,textAlign:"center",flexShrink:0}}>{icon}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{act.name}</div>
                        <div style={{fontSize:11,color:"#999",marginTop:1}}>
                          {new Date(act.start_date).toLocaleDateString()} · {fmt(act.moving_time)}
                          {act.distance>0?` · ${km(act.distance)}`:""}
                        </div>
                      </div>
                      <div style={{flexShrink:0,textAlign:"right"}}>
                        <div style={{fontSize:13,fontWeight:800}}>{tss} <span style={{fontSize:10,fontWeight:500,color:"#999"}}>TSS</span></div>
                        {act.average_heartrate && <div style={{fontSize:11,color:"#999"}}>{Math.round(act.average_heartrate)} bpm</div>}
                        {act.average_watts && <div style={{fontSize:11,color:"#999"}}>{Math.round(act.average_watts)}W</div>}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ════════ ZONES ════════ */}
        {tab==="zones" && (
          <div style={{padding:"56px 20px 0"}}>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:"#999",textTransform:"uppercase",marginBottom:4}}>Power Zones</div>
            <div style={{fontSize:38,fontWeight:900,letterSpacing:-2,lineHeight:.95,marginBottom:24}}>FTP {ftp}W</div>

            {/* FTP update */}
            <div style={{display:"flex",gap:10,marginBottom:24}}>
              <input className="field" style={{flex:1}} value={ftpInput}
                onChange={e=>setFtpInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&updateFtp()}
                placeholder="Update FTP (watts)"/>
              <button className="tap-btn" style={{width:"auto",padding:"14px 20px"}} onClick={updateFtp}>Update</button>
            </div>

            {/* Sweet spot callout */}
            <div style={{border:"2px solid #000",borderRadius:16,padding:"16px 20px",marginBottom:24}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#999",marginBottom:4}}>70.3 Bike Target · Sweet Spot</div>
              <div style={{fontSize:32,fontWeight:900,letterSpacing:-1}}>{Math.round(ftp*.88)}–{Math.round(ftp*.95)}<span style={{fontSize:18,fontWeight:500,color:"#999"}}> W</span></div>
              <div style={{fontSize:12,color:"#666",marginTop:2}}>88–95% FTP · Ride this for 56 miles</div>
            </div>

            {/* Zones */}
            {zones.map((z,i)=>(
              <div key={i} style={{borderTop:"1px solid #e8e8e8",padding:"14px 0"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div>
                    <span style={{fontSize:11,fontWeight:700,color:"#999",marginRight:8}}>{z.z}</span>
                    <span style={{fontSize:14,fontWeight:700}}>{z.name}</span>
                  </div>
                  <div style={{fontSize:15,fontWeight:800}}>{z.lo}–{z.hi}<span style={{fontSize:11,fontWeight:500,color:"#999"}}> W</span></div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{flex:1,height:3,background:"#e8e8e8",borderRadius:2,overflow:"hidden"}}>
                    <div style={{width:`${Math.min(100,(z.hi/ftp/1.5)*100)}%`,height:"100%",background:"#000",borderRadius:2}}/>
                  </div>
                  <div style={{fontSize:10,color:"#999",fontWeight:600,minWidth:48,textAlign:"right"}}>{z.pct}</div>
                </div>
              </div>
            ))}

            <div className="divider"/>

            {/* Race targets */}
            <div className="section-title">Race Day Targets</div>
            {[
              {d:"Swim",t:"~36 min",s:"1.2 mi open water"},
              {d:"Bike",t:`${Math.round(ftp*.80)}–${Math.round(ftp*.90)}W`,s:"56 mi at 80–90% FTP"},
              {d:"Run", t:"7:30–8:00/mi",s:"13.1 mi HIM pace"},
              {d:"T1+T2",t:"< 5 min",s:"Practice every brick"},
            ].map(({d,t,s})=>(
              <div key={d} style={{borderTop:"1px solid #e8e8e8",padding:"14px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700}}>{d}</div>
                  <div style={{fontSize:11,color:"#999",marginTop:1}}>{s}</div>
                </div>
                <div style={{fontSize:16,fontWeight:800}}>{t}</div>
              </div>
            ))}
          </div>
        )}

        {/* ════════ COACH ════════ */}
        {tab==="coach" && (
          <div style={{display:"flex",flexDirection:"column",height:"100vh",paddingTop:56}}>
            <div style={{padding:"0 20px 16px",borderBottom:"1px solid #e8e8e8"}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:"#999",textTransform:"uppercase",marginBottom:2}}>AI Coach</div>
              <div style={{fontSize:24,fontWeight:900,letterSpacing:-1}}>Ask anything.</div>
            </div>

            {/* Chat area */}
            <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12,WebkitOverflowScrolling:"touch"}}>
              {chat.map((m,i)=>(
                <div key={i} className={m.role==="user"?"bubble-me":"bubble-ai"} style={{whiteSpace:"pre-wrap"}}>
                  {m.content}
                </div>
              ))}
              {chatLoad && <div className="bubble-ai" style={{color:"#999"}}>Thinking…</div>}
              <div ref={chatEnd}/>
            </div>

            {/* Quick prompts */}
            {chat.length<=2 && (
              <div style={{padding:"0 20px 12px",display:"flex",flexWrap:"wrap",gap:8}}>
                {["Missed swims — catch up plan?","Long ride guidance this week","Race day pacing strategy","Nutrition for 70.3"].map(q=>(
                  <button key={q} style={{background:"#f5f5f5",border:"none",borderRadius:100,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}
                    onClick={()=>setChatIn(q)}>{q}</button>
                ))}
              </div>
            )}

            {/* Input */}
            <div style={{padding:"12px 20px",borderTop:"1px solid #e8e8e8",paddingBottom:"calc(12px + env(safe-area-inset-bottom,0px))"}}>
              <div style={{display:"flex",gap:8}}>
                <input className="field" style={{flex:1,padding:"12px 16px"}}
                  placeholder="Message your coach…"
                  value={chatIn}
                  onChange={e=>setChatIn(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}/>
                <button className="tap-btn" style={{width:"auto",padding:"12px 16px"}} onClick={send} disabled={chatLoad||!chatIn.trim()}>↑</button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── BOTTOM NAV ── */}
      <nav className="nav-bar">
        {navItems.map(({id,label})=>(
          <button key={id} className="nav-item" onClick={()=>setTab(id)}>
            <div style={{fontSize:10,fontWeight:tab===id?800:500,color:tab===id?"#000":"#bbb",letterSpacing:.3,textTransform:"uppercase"}}>
              {label}
            </div>
            <div className="nav-dot" style={{opacity:tab===id?1:0}}/>
          </button>
        ))}
      </nav>
    </div>
  );
}
