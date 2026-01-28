const BASE_URL = "https://api.marchabb.com/v1";

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") return res.status(405).send("Method Not Allowed");

    const PUBLIC_KEY = process.env.MARCHABB_PUBLIC_KEY;
    const SECRET_KEY = process.env.MARCHABB_SECRET_KEY;
    if (!PUBLIC_KEY || !SECRET_KEY) return res.status(500).json({ success: false, message: "Chaves da Marchabb não configuradas" });

    const id = String(req.query.id || req.query.transaction_id || "").trim();
    if (!id) return res.status(400).json({ success: false, message: "id é obrigatório" });

    // Criar autenticação Basic Auth para Marchabb
    const auth = "Basic " + Buffer.from(PUBLIC_KEY + ":" + SECRET_KEY).toString("base64");

    // Endpoint para buscar transação na Marchabb
    const url = `${BASE_URL}/transactions/${encodeURIComponent(id)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": auth,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data?.id) {
      const status = data?.status || "PENDING";
      return res.json({ success: true, status, transaction: data });
    }

    return res.status(502).json({
      success: false,
      message: "Não foi possível consultar status",
      response: { status: response.status, data },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Erro interno", error: String(e?.message || e) });
  }
};
