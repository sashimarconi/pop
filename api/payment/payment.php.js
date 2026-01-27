const QRCode = require("qrcode");

const BASE_URL = "https://api.blackcatpagamentos.online/api";

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    const API_KEY = process.env.BLACKCAT_SK;
    if (!API_KEY) {
      return res.status(500).json({ success: false, message: "BLACKCAT_SK não configurada" });
    }

    // Dados FIXOS do .env
    const FIXED_NAME = process.env.FIXED_NAME;
    const FIXED_EMAIL = process.env.FIXED_EMAIL;
    const FIXED_PHONE = process.env.FIXED_PHONE;
    const FIXED_CPF = process.env.FIXED_CPF;
    const FIXED_AMOUNT = process.env.FIXED_AMOUNT; // "64,73"
    const FIXED_TITLE = process.env.FIXED_TITLE;

    if (!FIXED_NAME || !FIXED_EMAIL || !FIXED_PHONE || !FIXED_CPF || !FIXED_AMOUNT || !FIXED_TITLE) {
      return res.status(500).json({ success: false, message: "Dados FIXOS não configurados no .env" });
    }

    // 64,73 -> 6473
    const amountReais = Number(String(FIXED_AMOUNT).replace(",", "."));
    const amountCents = Math.round(amountReais * 100);

    const payload = {
      amount: amountCents,
      currency: "BRL",
      paymentMethod: "pix",
      items: [
        { title: FIXED_TITLE, unitPrice: amountCents, quantity: 1, tangible: false },
      ],
      customer: {
        name: FIXED_NAME,
        email: FIXED_EMAIL,
        phone: String(FIXED_PHONE).replace(/\D/g, ""),
        document: { number: String(FIXED_CPF).replace(/\D/g, ""), type: "cpf" },
      },
      pix: { expiresInDays: 1 },
      externalRef: `order_${Date.now()}`,
    };

    const resp = await fetch(`${BASE_URL}/sales/create-sale`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok || data?.success !== true) {
      return res.status(502).json({
        success: false,
        message: "Falha ao criar PIX",
        status: resp.status,
        gateway: data,
      });
    }

    const tx = data?.data?.transactionId;
    const pd = data?.data?.paymentData || {};

    // O front espera pix_code (texto copia e cola)
    const pixText =
      pd.copyPaste ||
      pd.copy_paste ||
      pd.pixCode ||
      pd.qrCode ||
      "";

    if (!tx || !pixText) {
      return res.status(502).json({
        success: false,
        message: "Gateway não retornou transactionId/pix_code",
        gateway: data,
      });
    }

    // Resposta NO FORMATO QUE O FRONT DO SEU SITE ESPERA
    return res.status(200).json({
      success: true,
      transaction_id: tx,
      pix_code: pixText,
      amount: data?.data?.amount ?? amountCents,
      status: data?.data?.status ?? "PENDING",
      invoice_url: data?.data?.invoiceUrl ?? "",
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      message: "Erro interno",
      error: String(e?.message || e),
    });
  }
};
