const QRCode = require("qrcode");

const BASE_URL = "https://api.blackcatpagamentos.online/api";

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST")
      return res.status(405).send("Method Not Allowed");

    const API_KEY = process.env.BLACKCAT_SK;
    if (!API_KEY) {
      return res
        .status(500)
        .json({ success: false, message: "BLACKCAT_SK não configurada" });
    }

    // Dados que vêm da API da CNH via req.body
    const { cpf, nome, nome_mae, email, phone, amount, title } = req.body;

    // Validar dados recebidos
    if (!cpf || !nome || !email || !phone) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Dados obrigatórios não fornecidos: cpf, nome, email, phone",
        });
    }

    // Dados do .env como fallback
    const FIXED_AMOUNT = amount || process.env.FIXED_AMOUNT;
    const FIXED_TITLE = title || process.env.FIXED_TITLE;

    if (!FIXED_AMOUNT || !FIXED_TITLE) {
      return res
        .status(500)
        .json({
          success: false,
          message: "Amount e Title são obrigatórios",
        });
    }

    // 64,73 -> 6473
    const amountReais = Number(String(FIXED_AMOUNT).replace(",", "."));
    const amountCents = Math.round(amountReais * 100);

    const payload = {
      amount: amountCents,
      currency: "BRL",
      paymentMethod: "pix",
      items: [
        {
          title: FIXED_TITLE,
          unitPrice: amountCents,
          quantity: 1,
          tangible: false,
        },
      ],
      customer: {
        name: nome,
        email: email,
        phone: String(phone).replace(/\D/g, ""),
        document: { number: String(cpf).replace(/\D/g, ""), type: "cpf" },
      },
      pix: { expiresInDays: 1 },
      externalRef: `order_${Date.now()}`,
    };

    console.log("[PAYMENT API] Enviando payload para BlackCat:", JSON.stringify(payload));
    console.log("[PAYMENT API] Headers:", { "X-API-Key": API_KEY ? "***" : "MISSING" });

    const resp = await fetch(`${BASE_URL}/sales/create-sale`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
      },
      body: JSON.stringify(payload),
    });

    console.log("[PAYMENT API] Status da BlackCat:", resp.status);

    const data = await resp.json().catch((err) => {
      console.error("[PAYMENT API] Erro ao fazer parse JSON:", err);
      return {};
    });

    console.log("[PAYMENT API] Resposta da BlackCat:", JSON.stringify(data));

    if (!resp.ok || data?.success !== true) {
      console.error("[PAYMENT API] Falha ao criar PIX. Status:", resp.status, "Data:", data);
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
      pd.copyPaste || pd.copy_paste || pd.pixCode || pd.qrCode || "";

    console.log("[PAYMENT API] transactionId:", tx, "pixText:", pixText ? "✓" : "✗");

    if (!tx || !pixText) {
      console.error("[PAYMENT API] Gateway não retornou os dados esperados");
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
    console.error("[PAYMENT API] ERRO CAPTURADO:", e);
    console.error("[PAYMENT API] Stack trace:", e?.stack);
    return res.status(500).json({
      success: false,
      message: "Erro interno",
      error: String(e?.message || e),
    });
  }
};
