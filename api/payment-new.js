const QRCode = require("qrcode");

// Marchabb API Integration v2.1
const BASE_URL = "https://api.marchabb.com/v1";

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST")
      return res.status(405).send("Method Not Allowed");

    const PUBLIC_KEY = process.env.MARCHABB_PUBLIC_KEY;
    const SECRET_KEY = process.env.MARCHABB_SECRET_KEY;
    
    if (!PUBLIC_KEY || !SECRET_KEY) {
      return res
        .status(500)
        .json({ success: false, message: "Chaves da Marchabb não configuradas" });
    }

    // Dados que vêm da API da CNH via req.body
    const { cpf, nome, nome_mae, email, phone, amount, title } = req.body;

    console.log("[PAYMENT API] Dados recebidos:", { cpf, nome, email, phone });

    // Validar dados recebidos - usar defaults se não fornecidos
    const validCpf = cpf?.toString().trim();
    const validNome = nome?.toString().trim();
    const validEmail = email?.toString().trim() || "cliente@cnhpopularbrasil.site";
    const validPhone = phone?.toString().trim() || "11999999999";

    if (!validCpf || !validNome) {
      console.error("[PAYMENT API] CPF ou Nome faltando:", { validCpf, validNome });
      return res
        .status(400)
        .json({
          success: false,
          message: "Dados obrigatórios não fornecidos: cpf e nome são obrigatórios",
          received: { cpf, nome, email, phone },
        });
    }

    // Dados do .env como fallback
    const FIXED_AMOUNT = amount || process.env.FIXED_AMOUNT;
    const FIXED_TITLE = title || "Taxa de Adesão"; // Default para Taxa de Adesão

    if (!FIXED_AMOUNT) {
      return res
        .status(500)
        .json({
          success: false,
          message: "Amount é obrigatório",
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
        name: validNome,
        email: validEmail,
        phone: String(validPhone).replace(/\D/g, ""),
        document: { number: String(validCpf).replace(/\D/g, ""), type: "cpf" },
      },
      pix: { expiresIn: 3600 }, // Expira em 1 hora
      externalRef: `order_${Date.now()}`,
    };

    // Criar autenticação Basic Auth para Marchabb
    const auth = "Basic " + Buffer.from(PUBLIC_KEY + ":" + SECRET_KEY).toString("base64");

    console.log("[PAYMENT API] Enviando payload para Marchabb:", JSON.stringify(payload));
    console.log("[PAYMENT API] Auth header presente:", auth ? "✓" : "✗");

    const resp = await fetch(`${BASE_URL}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": auth,
      },
      body: JSON.stringify(payload),
    });

    console.log("[PAYMENT API] Status da Marchabb:", resp.status);

    const data = await resp.json().catch((err) => {
      console.error("[PAYMENT API] Erro ao fazer parse JSON:", err);
      return {};
    });

    console.log("[PAYMENT API] Resposta da Marchabb:", JSON.stringify(data));

    if (!resp.ok) {
      console.error("[PAYMENT API] Falha ao criar PIX. Status:", resp.status, "Data:", data);
      return res.status(502).json({
        success: false,
        message: "Falha ao criar PIX",
        status: resp.status,
        gateway: data,
      });
    }

    // A resposta da Marchabb vem com a estrutura: { id, amount, status, paymentMethod, pix: { qrcode, ... } }
    const tx = data?.id;
    const pixData = data?.pix || {};

    // O PIX code está em qrcode (brCode)
    const pixText = pixData?.qrcode || pixData?.copyPaste || pixData?.brCode || "";

    console.log("[PAYMENT API] transactionId:", tx, "pixCode presente:", pixText ? "✓" : "✗");

    if (!tx || !pixText) {
      console.error("[PAYMENT API] Gateway não retornou os dados esperados", { tx, pixText, pixData });
      return res.status(502).json({
        success: false,
        message: "Gateway não retornou transactionId/pixCode",
        gateway: data,
      });
    }

    // Resposta NO FORMATO QUE O FRONT DO SEU SITE ESPERA
    return res.status(200).json({
      success: true,
      transaction_id: tx,
      pix_code: pixText,
      amount: data?.amount ?? amountCents,
      status: data?.status ?? "PENDING",
      qr_code: pixData?.qrcode ?? "", // QR code em base64 se disponível
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
