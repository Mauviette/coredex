const KEY = "coredex:data";

function getEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Stockage non configuré : ajoute une base Upstash/Vercel KV au projet (variables KV_REST_API_URL / KV_REST_API_TOKEN)."
    );
  }
  return { url, token };
}

async function redisGet(key) {
  const { url, token } = getEnv();
  const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

async function redisSet(key, value) {
  const { url, token } = getEnv();
  const r = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/plain" },
    body: value,
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const raw = await redisGet(KEY);
      res.status(200).json(raw ? JSON.parse(raw) : { progress: {}, order: null, notes: {} });
      return;
    }

    if (req.method === "POST") {
      const { progress, order, notes } = req.body || {};
      await redisSet(
        KEY,
        JSON.stringify({ progress: progress || {}, order: order || null, notes: notes || {} })
      );
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Méthode non supportée" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
