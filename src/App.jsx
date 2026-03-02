import { useState, useEffect, useRef, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const RACE_DATE  = new Date("2026-09-13T07:00:00");
const PLAN_START = new Date("2026-03-01T00:00:00");
const DEFAULT_FTP = 212;

const PHASE = {
  1:"Base Building",2:"Base Building",3:"Base Building",4:"Base Building",
  5:"Aerobic Dev",6:"Aerobic Dev",7:"Aerobic Dev",8:"Aerobic Dev",
  9:"Recovery",10:"Build I",11:"Build I",12:"Build I",
  13:"Build II",14:"Build II",15:"Build II",16:"Build II",
  17:"Peak",18:"Peak",19:"Peak",20:"Peak",
  21:"Race-Specific",22:"Race-Specific",23:"Race-Specific",24:"Race-Specific",
  25:"Taper I",26:"Taper II",27:"Taper III",28:"Race Week",
};

const PHASE_NOTES = {
  "Base Building":  "Focus on aerobic foundation. Keep everything easy. No heroics.",
  "Aerobic Dev":    "Building your engine. Z2 is the priority — resist going harder.",
  "Recovery":       "Planned down week. Sleep, eat, absorb the work you've done.",
  "Build I":        "Introducing threshold work. Quality over quantity on key sessions.",
  "Build II":       "Bigger training load. This is where fitness really develops.",
  "Peak":           "Highest volume block. Fatigue is normal — trust the process.",
  "Race-Specific":  "Simulate race conditions. Practice nutrition and transitions.",
  "Taper I":        "Back off volume. Keep some intensity. Trust your fitness.",
  "Taper II":       "Legs should start feeling fresher. Short, sharp sessions only.",
  "Taper III":      "Almost there. Easy movement only. Rest is training now.",
  "Race Week":      "You're ready. Protect the body. Race day is here.",
};

// [swim1m, swim2m, bikeTueMins, bikeThuMins, brickMins, runWedMins, longRunMins]
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

const DAY_MAP = { MON:1, TUE:2, WED:3, THU:4, FRI:5, SAT:6, SUN:0 };
const DAY_FULL = { MON:"Monday", TUE:"Tuesday", WED:"Wednesday", THU:"Thursday", FRI:"Friday", SAT:"Saturday", SUN:"Sunday" };

function getWorkouts(w) {
  const p = PLAN[w] || PLAN[1];
  const isTaper = w >= 25;
  const isRace  = w >= 21 && w <= 24;
  const isPeak  = w >= 17 && w <= 20;

  const bikeZone = isTaper ? "Z2 · Easy spin" :
                   isRace  ? "Race Pace · 80–90% FTP" :
                   isPeak  ? "Threshold / Sweet Spot · 85–95% FTP" :
                             "Z2 Endurance · 56–75% FTP";

  const runZone  = isTaper ? "Easy / Recovery pace" :
                   isRace  ? "HIM Pace · 7:30–8:00/mi" :
                             "Z2 · Conversational effort";

  const swimZone = isRace || isPeak ? "2:00–2:20/100m" : "2:10–2:40/100m";

  return [
    { id:"ms", day:"MON", disc:"SWIM",   title:"Technique Swim",
      detail:`${p[0]}m`, zone:swimZone,
      note: w<=4 ? "Drills: catch-up, fingertip drag, bilateral breathing" :
            w<=8 ? "Aerobic pace. Focus on high elbow catch and long stroke" :
                   "Build to steady effort last 400m. Practice open water sighting" },

    { id:"tb", day:"TUE", disc:"BIKE",   title:"Endurance Ride",
      detail:`${p[2]} min`, zone:bikeZone,
      note: isTaper ? "Easy spin, keep HR low, just activate the legs" :
            isRace  ? "Include 3×10min at race watts with 5min easy between" :
            isPeak  ? "2×20min sweet spot with 10min recovery between" :
                      "Steady Z2. If indoors, use ERG mode. Cadence 85–95rpm" },

    { id:"ts", day:"TUE", disc:"LIFT",   title:"Lower Body Power",
      detail:"45 min", zone:"Strength",
      note: w<=8  ? "Back squat 4×6, Romanian deadlift 3×8, hip thrusts 3×10" :
            w<=16 ? "Front squat 3×5, single-leg deadlift 3×8, Bulgarian split squat" :
                    "Maintenance only — goblet squat, step-ups, keep it light" },

    { id:"wr", day:"WED", disc:"RUN",    title:"Interval Run",
      detail:`${p[5]} min`, zone:runZone,
      note: isTaper ? "20min easy jog. No watch. Just move." :
            isRace  ? "2mi warm-up, 4×1mi at HIM pace (7:30–8:00/mi), 1mi cool-down" :
            isPeak  ? "1mi warm-up, 6×800m at 10K pace, 1mi cool-down" :
                      "Warm up 10min, 4×5min at tempo effort, cool down 10min" },

    { id:"hb", day:"THU", disc:"BIKE",   title:"Tempo Ride",
      detail:`${p[3]} min`, zone:bikeZone,
      note: isTaper ? "30min easy. Just keep the legs loose before race week." :
            isRace  ? "Sustained race pace effort. Practice nutrition every 20min." :
                      "Hold target power steady. No coasting. Practice fueling." },

    { id:"hs", day:"THU", disc:"LIFT",   title:"Upper Body",
      detail:"40 min", zone:"Strength",
      note: w<=8  ? "Bench press 4×6, cable rows 3×10, pull-ups 3×max, shoulder press 3×8" :
            w<=16 ? "DB chest press 3×8, seated rows 3×10, lat pulldown, face pulls" :
                    "Resistance bands only. Keep it light — just maintain." },

    { id:"fw", day:"FRI", disc:"SWIM",   title:"Aerobic Swim",
      detail:`${p[1]}m`, zone:swimZone,
      note: w<=8  ? "500m warm-up, 4×200m on 20sec rest, 200m kick, 300m cool-down" :
            isRace ? "Include 400m at race effort. Practice wetsuit if you have one." :
                     "Include 6×50m fast with full recovery. Build race-pace comfort." },

    { id:"fl", day:"FRI", disc:"LIFT",   title:"Upper Body Power",
      detail:"40 min", zone:"Strength",
      note:"Push-press 4×5, bent-over rows 3×8, incline DB press 3×8, tricep dips 3×max" },

    { id:"sb", day:"SAT", disc:"BRICK",  title:"Long Ride + Brick Run",
      detail:`${p[4]}min bike + 20–40min run`, zone:bikeZone,
      note: isTaper ? "Short easy ride + 15min jog. Practice T2 and race kit." :
            isRace  ? "Ride at race watts throughout. Run immediately at HIM pace. This is your race rehearsal." :
                      "Ride Z2. Run off the bike within 90sec. Practice nutrition every 20min on bike." },

    { id:"sr", day:"SUN", disc:"RUN",    title:"Long Easy Run",
      detail:`${p[6]} min`, zone:"Z2 · Conversational",
      note: isTaper ? "Very easy jog. Talk test — if you can't hold a conversation, slow down." :
                      "No watch, no pace targets. Run by feel. This builds your aerobic base." },
  ];
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getCurrentWeek() {
  const now = new Date();
  const diff = Math.floor((now - PLAN_START) / (1000*60*60*24*7));
  return Math.max(1, Math.min(28, diff + 1));
}

function getTodayDay() {
  const d = new Date().getDay();
  return ["SUN","MON","TUE","WED","THU","FRI","SAT"][d];
}

function daysLeft() { return Math.ceil((RACE_DATE - new Date()) / (1000*60*60*24)); }
function fmt(s) { const h=Math.floor(s/3600), m=Math.floor((s%3600)/60); return h?`${h}h ${m}m`:`${m}m`; }
function km(m) { return (m/1000).toFixed(1)+" km"; }
function weeksLeft() { return Math.ceil(daysLeft()/7); }

function getZones(ftp) {
  return [
    { z:"Z1", name:"Active Recovery", lo:0,                    hi:Math.round(ftp*.55),  pct:"< 55%",    desc:"Warm-up, cool-down, recovery rides" },
    { z:"Z2", name:"Endurance",       lo:Math.round(ftp*.56),  hi:Math.round(ftp*.75),  pct:"56–75%",   desc:"Aerobic base. Majority of your training." },
    { z:"Z3", name:"Tempo",           lo:Math.round(ftp*.76),  hi:Math.round(ftp*.90),  pct:"76–90%",   desc:"Comfortably hard. 70.3 bike effort zone." },
    { z:"Z4", name:"Threshold",       lo:Math.round(ftp*.91),  hi:Math.round(ftp*1.05), pct:"91–105%",  desc:"Hard. 40km TT pace. Key interval zone." },
    { z:"Z5", name:"VO2 Max",         lo:Math.round(ftp*1.06), hi:Math.round(ftp*1.20), pct:"106–120%", desc:"Very hard. 5–8min efforts only." },
    { z:"Z6", name:"Anaerobic",       lo:Math.round(ftp*1.21), hi:Math.round(ftp*1.50), pct:"> 121%",   desc:"All-out. Short sprint efforts." },
  ];
}

function calcTSS(a, ftp) {
  if ((a.type==="Ride"||a.type==="VirtualRide") && a.average_watts) {
    const np=a.weighted_average_watts||a.average_watts, IF_=np/ftp, hrs=a.moving_time/3600;
    return Math.round(hrs*np*IF_/ftp*100);
  }
  if (a.suffer_score) return a.suffer_score * 2;
  return Math.round((a.moving_time/3600) * 45);
}

function getMonday() {
  const now = new Date();
  const d = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (d===0 ? 6 : d-1));
  mon.setHours(0,0,0,0);
  return mon;
}

function getThisWeekActs(acts) {
  const mon = getMonday();
  return acts.filter(a => new Date(a.start_date) >= mon);
}

function getLoad(acts, ftp) {
  if (!acts?.length) return { label:"No Data", sub:"Connect Strava to unlock", pct:0 };
  const tw = getThisWeekActs(acts);
  const tss = tw.reduce((s,a) => s+calcTSS(a,ftp), 0);
  const count = tw.length;
  const sub = count > 0 ? `${count} workout${count>1?"s":""} this week · ~${tss} TSS` : "No workouts logged yet this week";
  if (tss > 600) return { label:"Overreaching", sub, pct:100 };
  if (tss > 450) return { label:"Well Loaded",  sub, pct:78  };
  if (tss > 280) return { label:"Optimal",      sub, pct:58  };
  if (tss > 120) return { label:"Fresh",        sub, pct:32  };
  return               { label:"Undertrained",  sub, pct:14  };
}

function getLoadAdvice(acts, ftp, week) {
  if (!acts?.length) return "Connect Strava to get personalized load recommendations based on your actual rides and runs.";
  const tw  = getThisWeekActs(acts);
  const tss = tw.reduce((s,a) => s+calcTSS(a,ftp), 0);
  const swimCount = tw.filter(a => a.type==="Swim").length;
  const swimAlert = swimCount === 0 ? " ⚠️ No swim logged yet this week — prioritize getting in the water." : "";
  if (tss > 600) return `Load is very high. Take today easy — Z2 only, no intensity. Prioritize 8+ hours sleep.${swimAlert}`;
  if (tss > 450) return `Good training stimulus this week. Keep intensity moderate and watch for heavy legs.${swimAlert}`;
  if (tss > 280) return `You're in the sweet spot. Push your key sessions — brick and intervals are fair game.${swimAlert}`;
  if (tss > 120) return `Below target. Add volume where you can — extend the long ride and don't skip swims.${swimAlert}`;
  return `No workouts yet this week. Start with your swim today — even 1500m gets the week moving.`;
}

// ─── API CALLS ────────────────────────────────────────────────────────────────
async function stravaFetch(ep, tok) {
  const r = await fetch(`/api/strava?endpoint=${encodeURIComponent(ep)}&token=${encodeURIComponent(tok)}`);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

async function refreshStravaToken(cid, sec, ref) {
  const r = await fetch("/api/refresh", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ client_id:cid, client_secret:sec, refresh_token:ref }),
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

function getRuleCoachReply(question, ftp, week, load, acts) {
  const q = question.toLowerCase();
  const phase = PHASE[week] || "Base Building";
  const isTaper = week >= 25;
  const isRace = week >= 21 && week <= 24;
  const isPeak = week >= 17 && week <= 20;
  const tw = getThisWeekActs(acts);
  const swimsThisWeek = tw.filter(a => a.type === "Swim").length;
  const bikesThisWeek = tw.filter(a => a.type === "Ride" || a.type === "VirtualRide").length;
  const runsThisWeek  = tw.filter(a => a.type === "Run").length;
  const tss = tw.reduce((s,a) => s + calcTSS(a, ftp), 0);
  const sweetSpotLo = Math.round(ftp * 0.88);
  const sweetSpotHi = Math.round(ftp * 0.95);
  const z2lo = Math.round(ftp * 0.56);
  const z2hi = Math.round(ftp * 0.75);
  const weeksToRace = Math.ceil(daysLeft() / 7);

  // SWIM questions
  if (q.includes("swim") || q.includes("pool") || q.includes("open water")) {
    if (swimsThisWeek === 0)
      return `You have zero swims logged this week — that needs to change today. Get in the pool for at least ${PLAN[week]?.[0] || 2000}m. Focus on technique: high elbow catch, bilateral breathing, and sighting every 10 strokes for open water practice.

With ${weeksToRace} weeks to race day, missing swims is your biggest risk. Swim fitness drops fast and open water anxiety builds without pool time. Two swims a week minimum from here — no exceptions.`;
    return `You have ${swimsThisWeek} swim${swimsThisWeek>1?"s":""} logged this week. Target is 2 per week at this stage. Focus your ${PLAN[week]?.[0] || 2000}m Monday session on technique and your ${PLAN[week]?.[1] || 2000}m Friday session on building aerobic pace.

For open water prep, practice bilateral sighting every 8–10 strokes in the pool. The swim leg is short — your goal is to exit the water relaxed and ready to ride.`;
  }

  // BIKE / FTP / POWER questions
  if (q.includes("bike") || q.includes("ride") || q.includes("ftp") || q.includes("power") || q.includes("watt")) {
    if (q.includes("ftp") || q.includes("improve") || q.includes("increase"))
      return `To raise your FTP from ${ftp}W, the most effective work is sweet spot intervals: 2–3 sessions per week with 2×20min at ${sweetSpotLo}–${sweetSpotHi}W. Consistency beats intensity — do this for 6–8 weeks and you'll see 5–15W gains.

Avoid the trap of riding too hard on easy days. Your Z2 rides at ${z2lo}–${z2hi}W are building the aerobic base that makes threshold work possible. Keep easy rides easy.`;
    if (isTaper)
      return `You're in ${phase} — keep the bike easy. Short rides at ${z2lo}–${z2hi}W just to keep the legs fresh. No long efforts, no intensity. Your fitness is locked in — protect it now.`;
    if (isRace)
      return `Race-specific phase. Your key bike target on race day is ${sweetSpotLo}–${sweetSpotHi}W for 56 miles. Practice this on Saturday's brick — hold that power for the full ride duration and then run off immediately.

Practice your nutrition every 20 minutes on the bike. Aim for 60–90g carbs/hour. What you do in training is what you'll do on race day.`;
    return `This week's bike focus is ${phase === "Base Building" || phase === "Aerobic Dev" ? `Z2 endurance at ${z2lo}–${z2hi}W` : `sweet spot work at ${sweetSpotLo}–${sweetSpotHi}W`}. You have ${bikesThisWeek} bike session${bikesThisWeek!==1?"s":""} logged so far this week.

For your 70.3 bike leg, you want to hold ${sweetSpotLo}–${sweetSpotHi}W (80–90% FTP) comfortably for 56 miles. Every ride builds toward that. Keep cadence 85–95rpm and practice fueling every 20 minutes.`;
  }

  // RUN questions
  if (q.includes("run") || q.includes("pace") || q.includes("brick")) {
    if (q.includes("brick"))
      return `Brick workouts are your most important race prep. After every long ride, get your run shoes on within 90 seconds — the transition discomfort you feel is exactly what you're training your legs to handle.

Target 20–40 minutes off the bike at an easy effort first. As you approach race weeks, build to HIM pace (7:30–8:00/mi) for the last half of the run. Practice your T2 routine every single time.`;
    if (isTaper)
      return `You're tapering — keep runs short and easy. 20–30 minutes max at a comfortable conversational pace. A couple of short strides (8×10 seconds fast) are fine to keep the legs sharp, but nothing more.`;
    return `You have ${runsThisWeek} run${runsThisWeek!==1?"s":""} logged this week. Your 70.3 run target is 7:30–8:00/mi for 13.1 miles — that's a pace you should only be flirting with in key sessions, not easy days.

The most important run discipline for 70.3 is running Z2 on easy days. If you go too hard on your Wednesday run, your legs won't be fresh for the Saturday brick or Sunday long run. Protect the easy days.`;
  }

  // NUTRITION questions
  if (q.includes("nutrition") || q.includes("food") || q.includes("fuel") || q.includes("eat") || q.includes("carb")) {
    return `Race day nutrition for 70.3: eat a solid carb-heavy breakfast 2–3 hours before start (oats, banana, toast — ~600–800 cal). On the bike, target 60–90g carbs/hour — gels, chews, or liquid. Take in fluids every 15–20 minutes.

Don't try anything new on race day. Practice your exact race nutrition on every long ride and brick from now on. Your gut needs training just like your legs do. A nutrition failure on the bike is the most common reason people blow up on the run.`;
  }

  // RACE DAY questions
  if (q.includes("race") || q.includes("race day") || q.includes("strategy") || q.includes("pacing")) {
    return `Race day strategy for ${weeksToRace} weeks out:

🏊 Swim easy — seed yourself to avoid the washing machine start. Sight every 8 strokes. Exit the water relaxed.

🚴 Bike conservative for the first 10 miles — hold ${sweetSpotLo}–${sweetSpotHi}W and don't chase people going out too hard. This is where most athletes blow their run. Fuel every 20 minutes.

🏃 Run the first mile easy. Build into your 7:30–8:00/mi target. If you biked smart, miles 8–13 are where you pass everyone who didn't.`;
  }

  // RECOVERY / FATIGUE questions
  if (q.includes("tired") || q.includes("fatigue") || q.includes("rest") || q.includes("recover") || q.includes("sore")) {
    if (load?.label === "Overreaching")
      return `Your load is very high — this is your body telling you something. Take 1–2 easy days: short Z2 ride or easy 20min jog only. Prioritize 8+ hours sleep, hit your protein (0.7g per lb bodyweight), and get off your feet.

Fatigue is not the enemy — unmanaged fatigue is. One easy day now is worth three days of forced rest later.`;
    return `With ${tss > 0 ? `~${tss} TSS logged` : "low load"} this week, ${tss > 280 ? "your fatigue is legitimate — honor it" : "you have room to push but listen to your body"}. Make sure you're sleeping 7–9 hours, eating enough carbs to fuel training, and not stacking hard sessions back to back.

If your resting HR is elevated by 5+ BPM or you feel flat on a session that should feel easy — those are signals to back off.`;
  }

  // TAPER questions
  if (q.includes("taper") || q.includes("peak") || (isTaper && q.includes("week"))) {
    return `You're ${weeksToRace} weeks out. ${isTaper ? "Taper is working — trust it even when you feel antsy or flat. That's normal." : "You're not in taper yet, but it's close."}

Reduce volume by 40–50% but keep 2–3 short intensity sessions per week to stay sharp. Race day fitness is already built — you're just letting your body absorb it now. Don't add extra sessions because you feel fresh. The hay is in the barn.`;
  }

  // GENERAL weekly advice
  const weekInsights = [];
  if (swimsThisWeek === 0) weekInsights.push("⚠️ No swim yet this week — get in the pool today.");
  if (tss > 450) weekInsights.push("Your load is high — protect your sleep and keep easy sessions truly easy.");
  if (tss < 120 && tw.length > 0) weekInsights.push("Load is below target — you have room to push this week.");
  if (bikesThisWeek === 0 && !isTaper) weekInsights.push("No bike sessions yet — Tuesday's endurance ride is your priority.");

  return `Week ${week} of 28 — ${phase} phase. ${weeksToRace} weeks to race day.

${weekInsights.length > 0 ? weekInsights.join(" ") + "

" : ""}This week's priority: ${
    isTaper ? "rest and short sharp sessions only. Trust your fitness." :
    isRace  ? "race simulation. Ride at target watts, run at HIM pace, practice transitions." :
    isPeak  ? "your biggest training week. Nail the Saturday brick — it's the most important session of the plan." :
    week <= 8 ? "aerobic base. Keep every session in Z2. Resist the urge to go harder." :
    "progressive overload. Hit your key sessions and don't skip the swim."
  }

Ask me about swim catch-up, bike pacing, race strategy, nutrition, or anything else.`;
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,       setTab]       = useState("home");
  const [week,      setWeek]      = useState(getCurrentWeek);
  const [ftp,       setFtp]       = useState(DEFAULT_FTP);
  const [ftpInput,  setFtpInput]  = useState(String(DEFAULT_FTP));
  const [checked,   setChecked]   = useState({});
  const [acts,      setActs]      = useState([]);
  const [athlete,   setAthlete]   = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [connErr,   setConnErr]   = useState("");
  const [modal,     setModal]     = useState(false);
  const [tok,       setTok]       = useState("");
  const [cid,       setCid]       = useState("");
  const [csec,      setCsec]      = useState("");
  const [rtok,      setRtok]      = useState("");
  const [chat,      setChat]      = useState([{
    role:"assistant",
    content:"Hey Shaun. Week " + getCurrentWeek() + " of 28 — " + weeksLeft() + " weeks to race day.\n\nYou mentioned missing some swims lately. Let's make sure that doesn't snowball. What's on your mind — today's session, race strategy, nutrition, or something else?"
  }]);
  const [chatIn,    setChatIn]    = useState("");
  const chatEnd = useRef(null);

  const days    = daysLeft();
  const load    = getLoad(acts, ftp);
  const advice  = getLoadAdvice(acts, ftp, week);
  const wos     = getWorkouts(week);
  const todayD  = getTodayDay();
  const todayWos= wos.filter(w => w.day === todayD);
  const done    = wos.filter(w => checked[`${week}-${w.id}`]).length;
  const zones   = getZones(ftp);
  const phase   = PHASE[week] || "Base Building";
  const phaseNote = PHASE_NOTES[phase] || "";
  const thisWeekActs = getThisWeekActs(acts);

  const chartData = Array.from({length:28}, (_,i) => {
    const wk=i+1, p=PLAN[wk];
    return { w:`${wk}`, Bike:p[2]+p[3]+p[4], Run:p[5]+p[6], Swim:Math.round((p[0]+p[1])/100) };
  });

  useEffect(() => { chatEnd.current?.scrollIntoView({behavior:"smooth"}); }, [chat]);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("t703") || "{}");
      if (s.checked)    setChecked(s.checked);
      if (s.ftp)        { setFtp(s.ftp); setFtpInput(String(s.ftp)); }
      if (s.tok)        setTok(s.tok);
      if (s.cid)        setCid(s.cid);
      if (s.csec)       setCsec(s.csec);
      if (s.rtok)       setRtok(s.rtok);
      if (s.connected)  setConnected(s.connected);
      if (s.acts?.length) setActs(s.acts);
      if (s.athlete)    setAthlete(s.athlete);
    } catch {}
  }, []);

  const save = useCallback((u) => {
    try {
      const c = JSON.parse(localStorage.getItem("t703") || "{}");
      localStorage.setItem("t703", JSON.stringify({...c, ...u}));
    } catch {}
  }, []);

  const toggle = (id) => {
    const k = `${week}-${id}`, n = {...checked, [k]:!checked[k]};
    setChecked(n); save({checked:n});
  };

  const connect = async () => {
    setLoading(true); setConnErr("");
    try {
      let t = tok;
      if (cid && csec && rtok) {
        const r = await refreshStravaToken(cid, csec, rtok);
        if (r.access_token) { t = r.access_token; setTok(t); }
      }
      const [ath, ac] = await Promise.all([
        stravaFetch("/athlete", t),
        stravaFetch("/athlete/activities?per_page=40", t),
      ]);
      setAthlete(ath); setActs(ac); setConnected(true);
      save({ tok:t, cid, csec, rtok, connected:true, acts:ac, athlete:ath });
      setModal(false);
    } catch(e) { setConnErr("Connection failed: " + e.message); }
    setLoading(false);
  };

  const refresh = async () => {
    if (!tok) return;
    setLoading(true);
    try {
      let t = tok;
      if (cid && csec && rtok) {
        const r = await refreshStravaToken(cid, csec, rtok);
        if (r.access_token) { t = r.access_token; setTok(t); }
      }
      const ac = await stravaFetch("/athlete/activities?per_page=40", t);
      setActs(ac); save({ tok:t, acts:ac });
    } catch(e) { setConnErr(e.message); }
    setLoading(false);
  };

  const send = () => {
    if (!chatIn.trim()) return;
    const u = {role:"user", content:chatIn};
    const reply = getRuleCoachReply(chatIn, ftp, week, load, acts);
    setChat(prev => [...prev, u, {role:"assistant", content:reply}]);
    setChatIn("");
  };

  const updateFtp = () => {
    const v = parseInt(ftpInput);
    if (v > 50 && v < 600) { setFtp(v); save({ftp:v}); }
  };

  const navItems = [
    {id:"home",  label:"Home"},
    {id:"plan",  label:"Plan"},
    {id:"strava",label:"Strava"},
    {id:"zones", label:"Zones"},
    {id:"coach", label:"Coach"},
  ];

  return (
    <div style={{fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,sans-serif",background:"#fff",minHeight:"100vh",maxWidth:393,margin:"0 auto",position:"relative"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{margin:0;background:#fff;}
        input,button{font-family:inherit;}
        input:focus{outline:none;}
        ::-webkit-scrollbar{display:none;}
        .section-title{font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#aaa;margin-bottom:12px;}
        .divider{height:1px;background:#f0f0f0;margin:20px 0;}
        .tap-btn{background:#000;color:#fff;border:none;border-radius:100px;padding:14px 24px;font-size:14px;font-weight:700;cursor:pointer;transition:opacity .15s;width:100%;letter-spacing:.2px;font-family:inherit;}
        .tap-btn:active{opacity:.6;}
        .tap-btn.outline{background:#fff;color:#000;border:1.5px solid #000;}
        .tap-btn.orange{background:#FC4C02;}
        .field{background:#f5f5f5;border:none;border-radius:12px;padding:14px 16px;font-size:15px;width:100%;color:#000;font-family:inherit;}
        .nav-bar{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:393px;background:#fff;border-top:1px solid #efefef;display:flex;align-items:center;padding:0 0 env(safe-area-inset-bottom,16px) 0;z-index:100;}
        .nav-item{flex:1;display:flex;flex-direction:column;align-items:center;padding:10px 0 4px;cursor:pointer;gap:3px;background:none;border:none;-webkit-user-select:none;}
        .nav-item:active{opacity:.5;}
        .nav-dot{width:4px;height:4px;border-radius:50%;background:#000;margin-top:1px;transition:opacity .15s;}
        .wo-row{border-top:1px solid #f0f0f0;padding:14px 0;display:flex;align-items:flex-start;gap:12px;cursor:pointer;-webkit-user-select:none;}
        .wo-row:active{opacity:.6;}
        .check{width:22px;height:22px;border-radius:50%;border:1.5px solid #ddd;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;transition:all .15s;}
        .check.done{background:#000;border-color:#000;}
        .stat-box{flex:1;border:1.5px solid #ebebeb;border-radius:14px;padding:14px;}
        .bubble-me{background:#000;color:#fff;border-radius:18px 18px 4px 18px;padding:12px 15px;max-width:82%;align-self:flex-end;font-size:14px;line-height:1.55;}
        .bubble-ai{background:#f5f5f5;color:#000;border-radius:18px 18px 18px 4px;padding:12px 15px;max-width:84%;align-self:flex-start;font-size:14px;line-height:1.6;}
        .progress-track{height:3px;background:#f0f0f0;border-radius:2px;overflow:hidden;}
        .progress-fill{height:100%;background:#000;border-radius:2px;transition:width .4s;}
        .pill{display:inline-block;border:1.5px solid #000;border-radius:100px;padding:2px 9px;font-size:10px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;}
        .pill.fill{background:#000;color:#fff;border-color:#000;}
        .pill.orange{background:#FC4C02;color:#fff;border-color:#FC4C02;}
        .act-row{border-top:1px solid #f0f0f0;padding:13px 0;display:flex;align-items:center;gap:11px;}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:200;display:flex;align-items:flex-end;}
        .modal-sheet{background:#fff;width:100%;border-radius:20px 20px 0 0;padding:20px 20px calc(28px + env(safe-area-inset-bottom,0px));max-height:88vh;overflow-y:auto;}
        .modal-handle{width:36px;height:4px;background:#e0e0e0;border-radius:2px;margin:0 auto 18px;}
        .today-card{background:#000;color:#fff;border-radius:16px;padding:16px;margin-bottom:8px;}
        .today-card:active{opacity:.85;}
      `}</style>

      {/* ── MODAL ── */}
      {modal && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setModal(false);}}>
          <div className="modal-sheet">
            <div className="modal-handle"/>
            <div style={{fontSize:20,fontWeight:800,marginBottom:4}}>Connect Strava</div>
            <div style={{fontSize:13,color:"#888",marginBottom:20,lineHeight:1.5}}>
              Get your tokens at <span style={{color:"#FC4C02",fontWeight:600}}>strava.com/settings/api</span>. Stored in your browser only.
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:11}}>
              <div>
                <div className="section-title" style={{marginBottom:5}}>Access Token (quickest)</div>
                <input className="field" placeholder="Paste access_token here" value={tok} onChange={e=>setTok(e.target.value)}/>
              </div>
              <div style={{textAlign:"center",fontSize:11,color:"#ccc"}}>— or use all three for auto-refresh —</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <div className="section-title" style={{marginBottom:5}}>Client ID</div>
                  <input className="field" placeholder="207209" value={cid} onChange={e=>setCid(e.target.value)}/>
                </div>
                <div>
                  <div className="section-title" style={{marginBottom:5}}>Client Secret</div>
                  <input className="field" type="password" placeholder="••••••" value={csec} onChange={e=>setCsec(e.target.value)}/>
                </div>
              </div>
              <div>
                <div className="section-title" style={{marginBottom:5}}>Refresh Token</div>
                <input className="field" placeholder="Refresh token" value={rtok} onChange={e=>setRtok(e.target.value)}/>
              </div>
              {connErr && <div style={{fontSize:12,color:"#c00",background:"#fff5f5",padding:"10px 12px",borderRadius:10}}>{connErr}</div>}
              <button className="tap-btn orange" onClick={connect} disabled={loading}>{loading?"Connecting…":"Connect Strava"}</button>
              <button className="tap-btn outline" onClick={()=>setModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SCROLL AREA ── */}
      <div style={{paddingBottom:84,minHeight:"100vh",overflowY:"auto",WebkitOverflowScrolling:"touch"}}>

        {/* ══════════ HOME ══════════ */}
        {tab==="home" && (
          <>
            {/* Hero */}
            <div style={{background:"#000",color:"#fff",padding:"52px 20px 28px"}}>
              <div style={{fontSize:11,fontWeight:600,letterSpacing:1.5,opacity:.4,textTransform:"uppercase",marginBottom:6}}>
                {connected && athlete ? `${athlete.firstname} ${athlete.lastname} · ` : ""}Sep 13, 2026
              </div>
              <div style={{fontSize:76,fontWeight:900,lineHeight:.85,letterSpacing:-4,marginBottom:6}}>{days}</div>
              <div style={{fontSize:15,fontWeight:400,opacity:.5,marginBottom:22}}>days to race day</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                <span style={{fontSize:10,fontWeight:700,letterSpacing:1,opacity:.4,textTransform:"uppercase"}}>Week {week} of 28</span>
                <span style={{fontSize:10,fontWeight:700,letterSpacing:1,opacity:.4,textTransform:"uppercase"}}>{phase}</span>
              </div>
              <div className="progress-track" style={{background:"rgba(255,255,255,.15)"}}>
                <div className="progress-fill" style={{width:`${week/28*100}%`,background:"#fff"}}/>
              </div>
              {phaseNote && <div style={{fontSize:12,opacity:.45,marginTop:10,lineHeight:1.5}}>{phaseNote}</div>}
            </div>

            <div style={{padding:"20px 20px 0"}}>

              {/* Today's sessions */}
              {todayWos.length > 0 && (
                <>
                  <div className="section-title">Today · {DAY_FULL[todayD]}</div>
                  {todayWos.map(wo => {
                    const k = `${week}-${wo.id}`, isDone = !!checked[k];
                    return (
                      <div key={wo.id} className="today-card" style={{opacity:isDone?.6:1}} onClick={()=>{ toggle(wo.id); }}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                          <div style={{fontSize:16,fontWeight:800}}>{wo.title}</div>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <span style={{fontSize:13,fontWeight:700,opacity:.7}}>{wo.detail}</span>
                            {isDone && <span style={{fontSize:13}}>✓</span>}
                          </div>
                        </div>
                        <div style={{fontSize:11,opacity:.5,marginBottom:4,textTransform:"uppercase",letterSpacing:.5}}>{wo.disc} · {wo.zone}</div>
                        <div style={{fontSize:12,opacity:.6,lineHeight:1.5}}>{wo.note}</div>
                      </div>
                    );
                  })}
                  <div className="divider"/>
                </>
              )}

              {/* Stats */}
              <div style={{display:"flex",gap:10,marginBottom:16}}>
                <div className="stat-box">
                  <div style={{fontSize:26,fontWeight:900,letterSpacing:-1,lineHeight:1}}>{done}<span style={{fontSize:13,fontWeight:500,color:"#bbb"}}>/{wos.length}</span></div>
                  <div style={{fontSize:10,fontWeight:600,color:"#aaa",marginTop:3,textTransform:"uppercase",letterSpacing:.5}}>Week {week}</div>
                </div>
                <div className="stat-box">
                  <div style={{fontSize:22,fontWeight:900,letterSpacing:-.5,lineHeight:1}}>{ftp}<span style={{fontSize:12,fontWeight:400,color:"#bbb"}}> W</span></div>
                  <div style={{fontSize:10,fontWeight:600,color:"#aaa",marginTop:3,textTransform:"uppercase",letterSpacing:.5}}>FTP</div>
                </div>
                <div className="stat-box" style={{cursor:"pointer"}} onClick={()=>setTab("strava")}>
                  <div style={{fontSize:22,fontWeight:900,letterSpacing:-.5,lineHeight:1,color:connected?"#FC4C02":"#000"}}>
                    {connected ? thisWeekActs.length : "—"}
                  </div>
                  <div style={{fontSize:10,fontWeight:600,color:"#aaa",marginTop:3,textTransform:"uppercase",letterSpacing:.5}}>
                    {connected ? "This wk" : "Strava"}
                  </div>
                </div>
              </div>

              <div className="divider" style={{margin:"4px 0 16px"}}/>

              {/* Training load */}
              <div className="section-title">Training Load · This Week</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
                <div style={{fontSize:22,fontWeight:900,letterSpacing:-.5}}>{load.label}</div>
                <div style={{fontSize:11,color:"#999"}}>{load.sub}</div>
              </div>
              <div className="progress-track" style={{marginBottom:12}}>
                <div className="progress-fill" style={{width:`${load.pct}%`}}/>
              </div>
              <div style={{fontSize:13,color:"#555",lineHeight:1.65,marginBottom:20}}>{advice}</div>

              <div className="divider"/>

              {/* Volume chart */}
              <div className="section-title">28-Week Plan Volume</div>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={chartData} margin={{top:4,right:0,bottom:0,left:-32}}>
                  <defs>
                    {[["gb","#000"],["gr","#555"],["gs","#bbb"]].map(([id,c])=>(
                      <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={c} stopOpacity={.25}/>
                        <stop offset="95%" stopColor={c} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <XAxis dataKey="w" tick={{fontSize:8,fill:"#ccc"}} tickLine={false} axisLine={false} interval={3}/>
                  <YAxis tick={{fontSize:8,fill:"#ccc"}} tickLine={false} axisLine={false}/>
                  <Tooltip contentStyle={{background:"#fff",border:"1px solid #eee",borderRadius:8,fontSize:11,boxShadow:"0 2px 8px rgba(0,0,0,.08)"}} labelStyle={{fontWeight:700}}/>
                  <Area type="monotone" dataKey="Bike" stroke="#000" fill="url(#gb)" strokeWidth={1.5} name="Bike (min)"/>
                  <Area type="monotone" dataKey="Run"  stroke="#555" fill="url(#gr)" strokeWidth={1.5} name="Run (min)"/>
                  <Area type="monotone" dataKey="Swim" stroke="#bbb" fill="url(#gs)" strokeWidth={1.5} name="Swim (×10m)"/>
                </AreaChart>
              </ResponsiveContainer>
              <div style={{fontSize:10,color:"#ccc",textAlign:"center",marginTop:4}}>Taper begins Week 25 · Race Week 28</div>

              <div className="divider"/>

              {!connected && (
                <button className="tap-btn orange" onClick={()=>setModal(true)} style={{marginBottom:4}}>Connect Strava</button>
              )}
            </div>
          </>
        )}

        {/* ══════════ PLAN ══════════ */}
        {tab==="plan" && (
          <div style={{padding:"52px 20px 0"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:6}}>
              <div>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:1,color:"#aaa",textTransform:"uppercase",marginBottom:2}}>{phase}</div>
                <div style={{fontSize:36,fontWeight:900,letterSpacing:-2,lineHeight:.92}}>Week {week}</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button className="tap-btn outline" style={{width:"auto",padding:"8px 14px",fontSize:13}} onClick={()=>setWeek(w=>Math.max(1,w-1))}>←</button>
                <button className="tap-btn" style={{width:"auto",padding:"8px 14px",fontSize:13}} onClick={()=>setWeek(w=>Math.min(28,w+1))}>→</button>
              </div>
            </div>

            <div style={{fontSize:12,color:"#aaa",marginBottom:6,lineHeight:1.5}}>{phaseNote}</div>
            <div style={{fontSize:11,color:"#bbb",marginBottom:14}}>{done} of {wos.length} sessions complete</div>
            <div className="progress-track" style={{marginBottom:20}}>
              <div className="progress-fill" style={{width:`${done/wos.length*100}%`}}/>
            </div>

            {["MON","TUE","WED","THU","FRI","SAT","SUN"].map(day => {
              const dayWos = wos.filter(w => w.day === day);
              if (!dayWos.length) return null;
              const isToday = day === todayD && week === getCurrentWeek();
              return (
                <div key={day} style={{marginBottom:6}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:1,color:isToday?"#000":"#bbb",textTransform:"uppercase",paddingTop:6,marginBottom:0,display:"flex",alignItems:"center",gap:6}}>
                    {DAY_FULL[day]}
                    {isToday && <span className="pill fill" style={{fontSize:8}}>Today</span>}
                  </div>
                  {dayWos.map(wo => {
                    const k = `${week}-${wo.id}`, isDone = !!checked[k];
                    return (
                      <div key={wo.id} className="wo-row" onClick={()=>toggle(wo.id)}>
                        <div className={`check ${isDone?"done":""}`}>
                          {isDone && <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
                        </div>
                        <div style={{flex:1,opacity:isDone?.45:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3,flexWrap:"wrap"}}>
                            <span style={{fontSize:14,fontWeight:700}}>{wo.title}</span>
                            <span className="pill" style={{fontSize:9}}>{wo.disc}</span>
                          </div>
                          <div style={{fontSize:12,color:"#888",marginBottom:2,lineHeight:1.4}}>{wo.note}</div>
                          <div style={{fontSize:10,color:"#bbb"}}>{wo.zone}</div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0,opacity:isDone?.45:1,paddingLeft:8}}>
                          <div style={{fontSize:12,fontWeight:800,whiteSpace:"nowrap"}}>{wo.detail}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* ══════════ STRAVA ══════════ */}
        {tab==="strava" && (
          <div style={{padding:"52px 20px 0"}}>
            {!connected ? (
              <div style={{textAlign:"center",paddingTop:50}}>
                <div style={{fontSize:44,marginBottom:14}}>🟠</div>
                <div style={{fontSize:30,fontWeight:900,letterSpacing:-1.5,marginBottom:8}}>Connect Strava</div>
                <div style={{fontSize:13,color:"#888",lineHeight:1.65,maxWidth:280,margin:"0 auto 28px"}}>
                  Sync your rides, runs and swims for smart weekly load analysis and AI coaching.
                </div>
                <button className="tap-btn orange" onClick={()=>setModal(true)}>Connect Strava</button>
              </div>
            ) : (
              <>
                {/* Athlete header */}
                {athlete && (
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                    {athlete.profile_medium && <img src={athlete.profile_medium} alt="" style={{width:42,height:42,borderRadius:"50%",border:"2px solid #000"}}/>}
                    <div style={{flex:1}}>
                      <div style={{fontSize:16,fontWeight:800}}>{athlete.firstname} {athlete.lastname}</div>
                      <div style={{fontSize:11,color:"#aaa"}}>{athlete.city} · {acts.length} activities loaded</div>
                    </div>
                    <button className="tap-btn outline" style={{width:"auto",padding:"8px 12px",fontSize:12}} onClick={refresh} disabled={loading}>
                      {loading ? "…" : "↻"}
                    </button>
                  </div>
                )}

                {/* Load */}
                <div style={{borderTop:"2px solid #000",paddingTop:16,marginBottom:20}}>
                  <div className="section-title">This Week's Load</div>
                  <div style={{fontSize:28,fontWeight:900,letterSpacing:-1,marginBottom:4}}>{load.label}</div>
                  <div style={{fontSize:11,color:"#aaa",marginBottom:10}}>{load.sub}</div>
                  <div className="progress-track" style={{marginBottom:14}}>
                    <div className="progress-fill" style={{width:`${load.pct}%`}}/>
                  </div>
                  <div style={{fontSize:13,color:"#555",lineHeight:1.65}}>{advice}</div>
                </div>

                {/* This week's activities */}
                {thisWeekActs.length > 0 && (
                  <>
                    <div className="section-title">This Week</div>
                    {thisWeekActs.map(act => {
                      const tss = calcTSS(act, ftp);
                      const icon = act.type==="Ride"||act.type==="VirtualRide" ? "🚴" : act.type==="Run" ? "🏃" : act.type==="Swim" ? "🏊" : "🏋️";
                      return (
                        <div key={act.id} className="act-row">
                          <div style={{fontSize:20,width:34,textAlign:"center",flexShrink:0}}>{icon}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{act.name}</div>
                            <div style={{fontSize:11,color:"#aaa",marginTop:1}}>{fmt(act.moving_time)}{act.distance>0?` · ${km(act.distance)}`:""}</div>
                          </div>
                          <div style={{flexShrink:0,textAlign:"right"}}>
                            <div style={{fontSize:13,fontWeight:800}}>{tss} <span style={{fontSize:9,fontWeight:500,color:"#aaa"}}>TSS</span></div>
                            {act.average_heartrate && <div style={{fontSize:10,color:"#aaa"}}>{Math.round(act.average_heartrate)} bpm</div>}
                            {act.average_watts && <div style={{fontSize:10,color:"#aaa"}}>{Math.round(act.average_watts)}W</div>}
                          </div>
                        </div>
                      );
                    })}
                    <div className="divider"/>
                  </>
                )}

                {/* TSS chart */}
                {acts.length > 3 && (
                  <>
                    <div className="section-title">Recent TSS</div>
                    <ResponsiveContainer width="100%" height={110}>
                      <BarChart data={[...acts].reverse().slice(0,14).map(a=>({n:a.name.slice(0,8), T:calcTSS(a,ftp)}))}>
                        <XAxis dataKey="n" tick={{fontSize:8,fill:"#ccc"}} tickLine={false} axisLine={false}/>
                        <YAxis tick={{fontSize:8,fill:"#ccc"}} tickLine={false} axisLine={false}/>
                        <Tooltip contentStyle={{background:"#fff",border:"1px solid #eee",borderRadius:8,fontSize:11}} labelStyle={{fontWeight:700}}/>
                        <Bar dataKey="T" fill="#000" radius={[3,3,0,0]} name="TSS"/>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="divider"/>
                  </>
                )}

                {/* All activities */}
                <div className="section-title">All Activities</div>
                {acts.slice(0,20).map(act => {
                  const tss = calcTSS(act, ftp);
                  const icon = act.type==="Ride"||act.type==="VirtualRide" ? "🚴" : act.type==="Run" ? "🏃" : act.type==="Swim" ? "🏊" : "🏋️";
                  const isThisWeek = thisWeekActs.some(a=>a.id===act.id);
                  return (
                    <div key={act.id} className="act-row">
                      <div style={{fontSize:20,width:34,textAlign:"center",flexShrink:0}}>{icon}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{act.name}</div>
                        <div style={{fontSize:11,color:"#aaa",marginTop:1}}>
                          {new Date(act.start_date).toLocaleDateString("en-US",{month:"short",day:"numeric"})} · {fmt(act.moving_time)}{act.distance>0?` · ${km(act.distance)}`:""}
                          {isThisWeek && <span className="pill fill" style={{fontSize:8,marginLeft:6}}>This wk</span>}
                        </div>
                      </div>
                      <div style={{flexShrink:0,textAlign:"right"}}>
                        <div style={{fontSize:13,fontWeight:800}}>{tss} <span style={{fontSize:9,fontWeight:500,color:"#aaa"}}>TSS</span></div>
                        {act.average_heartrate && <div style={{fontSize:10,color:"#aaa"}}>{Math.round(act.average_heartrate)} bpm</div>}
                        {act.average_watts && <div style={{fontSize:10,color:"#aaa"}}>{Math.round(act.average_watts)}W</div>}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ══════════ ZONES ══════════ */}
        {tab==="zones" && (
          <div style={{padding:"52px 20px 0"}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:1,color:"#aaa",textTransform:"uppercase",marginBottom:4}}>Power Zones</div>
            <div style={{fontSize:36,fontWeight:900,letterSpacing:-2,lineHeight:.92,marginBottom:20}}>FTP {ftp}W</div>

            <div style={{display:"flex",gap:10,marginBottom:20}}>
              <input className="field" style={{flex:1}} value={ftpInput} onChange={e=>setFtpInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&updateFtp()} placeholder="Enter new FTP (watts)"/>
              <button className="tap-btn" style={{width:"auto",padding:"14px 18px"}} onClick={updateFtp}>Update</button>
            </div>

            {/* Sweet spot box */}
            <div style={{border:"2px solid #000",borderRadius:14,padding:"14px 18px",marginBottom:20}}>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",color:"#aaa",marginBottom:4}}>70.3 Bike Target · Sweet Spot</div>
              <div style={{fontSize:30,fontWeight:900,letterSpacing:-1}}>{Math.round(ftp*.88)}–{Math.round(ftp*.95)}<span style={{fontSize:16,fontWeight:400,color:"#aaa"}}> W</span></div>
              <div style={{fontSize:11,color:"#888",marginTop:3}}>88–95% FTP · Hold this for 56 miles on race day</div>
            </div>

            {zones.map((z,i) => (
              <div key={i} style={{borderTop:"1px solid #f0f0f0",padding:"13px 0"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                  <div>
                    <span style={{fontSize:10,fontWeight:700,color:"#bbb",marginRight:7}}>{z.z}</span>
                    <span style={{fontSize:14,fontWeight:700}}>{z.name}</span>
                  </div>
                  <div style={{fontSize:14,fontWeight:800}}>{z.lo}–{z.hi}<span style={{fontSize:10,fontWeight:400,color:"#aaa"}}> W</span></div>
                </div>
                <div style={{fontSize:11,color:"#aaa",marginBottom:7,lineHeight:1.4}}>{z.desc}</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{flex:1,height:2,background:"#f0f0f0",borderRadius:2,overflow:"hidden"}}>
                    <div style={{width:`${Math.min(100,(z.hi/ftp/1.5)*100)}%`,height:"100%",background:"#000"}}/>
                  </div>
                  <div style={{fontSize:9,color:"#bbb",fontWeight:600,minWidth:44,textAlign:"right"}}>{z.pct}</div>
                </div>
              </div>
            ))}

            <div className="divider"/>
            <div className="section-title">Race Day Targets</div>
            {[
              {d:"Swim",  t:"34–38 min",                                s:"1.2 mi open water · stay relaxed early"},
              {d:"Bike",  t:`${Math.round(ftp*.80)}–${Math.round(ftp*.90)}W`, s:"56 mi · 80–90% FTP · don't blow up here"},
              {d:"T1+T2", t:"< 5 min",                                  s:"Practice every single brick workout"},
              {d:"Run",   t:"7:30–8:00/mi",                             s:"13.1 mi · the fitness is there if you ran easy on bike"},
              {d:"Finish",t:"~5:00–5:20",                               s:"Estimated total time based on current fitness"},
            ].map(({d,t,s}) => (
              <div key={d} style={{borderTop:"1px solid #f0f0f0",padding:"13px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700}}>{d}</div>
                  <div style={{fontSize:11,color:"#aaa",marginTop:2,lineHeight:1.4}}>{s}</div>
                </div>
                <div style={{fontSize:15,fontWeight:800,paddingLeft:12,textAlign:"right",flexShrink:0}}>{t}</div>
              </div>
            ))}
          </div>
        )}

        {/* ══════════ COACH ══════════ */}
        {tab==="coach" && (
          <div style={{display:"flex",flexDirection:"column",height:"100vh",paddingTop:52}}>
            <div style={{padding:"0 20px 14px",borderBottom:"1px solid #f0f0f0"}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:1,color:"#aaa",textTransform:"uppercase",marginBottom:2}}>AI Coach</div>
              <div style={{fontSize:22,fontWeight:900,letterSpacing:-1}}>Ask anything.</div>
            </div>

            <div style={{flex:1,overflowY:"auto",padding:"14px 20px",display:"flex",flexDirection:"column",gap:10,WebkitOverflowScrolling:"touch"}}>
              {chat.map((m,i) => (
                <div key={i} className={m.role==="user"?"bubble-me":"bubble-ai"} style={{whiteSpace:"pre-wrap"}}>{m.content}</div>
              ))}
                            <div ref={chatEnd}/>
            </div>

            {chat.length <= 2 && (
              <div style={{padding:"0 20px 10px",display:"flex",flexWrap:"wrap",gap:7}}>
                {[
                  "I missed swims — catch up plan?",
                  "What's key this week?",
                  "Race day pacing strategy",
                  "Nutrition plan for 70.3",
                  "How do I improve my FTP?",
                ].map(q => (
                  <button key={q} style={{background:"#f5f5f5",border:"none",borderRadius:100,padding:"8px 13px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}
                    onClick={()=>setChatIn(q)}>{q}</button>
                ))}
              </div>
            )}

            <div style={{padding:"10px 20px",borderTop:"1px solid #f0f0f0",paddingBottom:"calc(10px + env(safe-area-inset-bottom,0px))"}}>
              <div style={{display:"flex",gap:8}}>
                <input className="field" style={{flex:1,padding:"12px 15px"}}
                  placeholder="Message your coach…" value={chatIn}
                  onChange={e=>setChatIn(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}/>
                <button className="tap-btn" style={{width:"auto",padding:"12px 16px",fontSize:16}} onClick={send} disabled={!chatIn.trim()}>↑</button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── BOTTOM NAV ── */}
      <nav className="nav-bar">
        {navItems.map(({id,label}) => (
          <button key={id} className="nav-item" onClick={()=>setTab(id)}>
            <div style={{fontSize:10,fontWeight:tab===id?800:500,color:tab===id?"#000":"#c0c0c0",letterSpacing:.3,textTransform:"uppercase"}}>
              {label}
            </div>
            <div className="nav-dot" style={{opacity:tab===id?1:0}}/>
          </button>
        ))}
      </nav>
    </div>
  );
}
