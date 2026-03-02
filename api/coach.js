export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { messages, ftp, week, phase, load, recentActs } = req.body;

  const system = `You are a sharp, direct triathlon coach for Shaun, a 70.3 athlete racing September 13, 2026.

Current stats:
- FTP: ${ftp}W
- Training week: ${week}/28 (${phase} phase)
- Training load this week: ${load}
- Recent Strava activities: ${recentActs?.map(a => `${a.type} ${a.duration} | HR: ${a.hr||"—"} | Watts: ${a.watts||"—"} | Suffer: ${a.suffer||"—"} | Date: ${a.date}`).join(" // ") || "none loaded"}

Key context:
- Shaun has been slacking the last 2 weeks and missed swim sessions
- Chicago-based athlete, 60–80 miles/week cycling baseline
- Wahoo and Apple Watch auto-sync to Strava
- Plan covers 28 weeks: Base → Aerobic Dev → Build I/II → Peak → Race-Specific → Taper → Race Week
- 70.3 targets: Swim ~36min, Bike at 80–90% FTP, Run 7:30–8:00/mi

Coaching style:
- Be direct, specific, and data-driven
- Reference their actual numbers when relevant
- No fluff or generic advice
- Keep responses to 2–3 paragraphs max
- If they ask about missing swims, give a concrete catch-up plan
- If load is low, push them. If overreaching, protect them.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        system,
        messages: messages.filter(m => m.role === "user" || m.role === "assistant")
          .map(m => ({ role: m.role, content: m.content })),
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || `API error ${response.status}`);
    res.status(200).json({ reply: data.content?.[0]?.text || "No response." });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
