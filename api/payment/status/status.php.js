const BASE_URL = "https://api.blackcatpagamentos.online/api";

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") return res.status(405).send("Method Not Allowed");

    const API_KEY = process.env.BLACKCAT_SK;
    if (!API_KEY) return res.status(500).json({ success: false, message: "BLACKCAT_SK não configurada" });

    const id = String(req.query.id || req.query.transaction_id || "").trim();
    if (!id) return res.status(400).json({ success: false, message: "id é obrigatório" });

    // tenta alguns caminhos comuns (depende da Blackcat)
    const candidates = [
      `${BASE_URL}/sales/get-sale/${encodeURIComponent(id)}`,
      `${BASE_URL}/sales/get-sale?transactionId=${encodeURIComponent(id)}`,
      `${BASE_URL}/sales/get-sale?transaction_id=${encodeURIComponent(id)}`,
      `${BASE_URL}/sales/get-sale?id=${encodeURIComponent(id)}`,
    ];

    let last = null;
    for (const url of candidates) {
      const r = await fetch(url, {
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
      });
      const j = await r.json().catch(() => ({}));
      last = { ok: r.ok, status: r.status, body: j };
      if (r.ok && j?.success === true) {
        const status = j?.data?.status || j?.data?.paymentStatus || "PENDING";
        return res.json({ success: true, status });
      }
    }

    return res.status(502).json({
      success: false,
      message: "Não foi possível consultar status",
      last,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Erro interno", error: String(e?.message || e) });
  }
};
