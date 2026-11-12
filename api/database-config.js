export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido" });
  }

  res.setHeader("Cache-Control", "no-store");

  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();

  const validUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url);
  const validKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);

  if (!validUrl || !validKey) {
    return res.status(503).json({
      configured: false,
      error: "Conexão não configurada nesta implantação. Verifique as variáveis SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY (ou NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) no ambiente Production da Vercel e faça um novo deploy.",
      missing: [
        ...(!validUrl ? ["URL do Supabase ausente ou inválida"] : []),
        ...(!validKey ? ["Chave publicável do Supabase ausente ou inválida"] : [])
      ]
    });
  }

  return res.status(200).json({ configured: true, url, publishableKey: key });
}
