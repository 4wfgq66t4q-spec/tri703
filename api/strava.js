export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { endpoint, token } = req.query;
  if (!endpoint || !token) return res.status(400).json({ error: "Missing params" });

  try {
    const url = `https://www.strava.com/api/v3${decodeURIComponent(endpoint)}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${decodeURIComponent(token)}` },
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
