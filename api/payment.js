// Marchabb API Integration v2.2
// Pagamento via PIX com Marchabb Gateway

const BASE_URL = "https://api.marchabb.com/v1";

async function handlePaymentRequest(req, res) {
  // Handle OPTIONS
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const PUBLIC_KEY = process.env.MARCHABB_PUBLIC_KEY;
    const SECRET_KEY = process.env.MARCHABB_SECRET_KEY;
    
    if (!PUBLIC_KEY || !SECRET_KEY) {
      return res.status(500).json({ 
        success: false, 
        message: "Chaves da Marchabb não configuradas" 
      });
    }

    // Parse body
    let bodyData = req.body;
    if (typeof bodyData === "string") {
      bodyData = JSON.parse(bodyData);
    }

    const { cpf, nome, email, phone, amount, title } = bodyData;

    console.log("[PAYMENT] Dados recebidos:", { cpf, nome, email, phone });

    // Validação
    const validCpf = cpf?.toString().trim();
    const validNome = nome?.toString().trim();
    const validEmail = email?.toString().trim() || "cliente@cnhpopularbrasil.site";
    const validPhone = phone?.toString().trim() || "11999999999";

    if (!validCpf || !validNome) {
      return res.status(400).json({
        success: false,
        message: "CPF e Nome são obrigatórios",
      });
    }

    const FIXED_AMOUNT = amount || process.env.FIXED_AMOUNT || "64.73";
    const FIXED_TITLE = title || "Taxa de Adesão";

    // Converter para centavos
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
        document: { 
          number: String(validCpf).replace(/\D/g, ""), 
          type: "cpf" 
        },
      },
      pix: { expiresIn: 3600 },
      externalRef: `order_${Date.now()}`,
    };

    // Auth
    const auth = "Basic " + Buffer.from(PUBLIC_KEY + ":" + SECRET_KEY).toString("base64");

    console.log("[PAYMENT] Enviando para Marchabb...");

    const resp = await fetch(`${BASE_URL}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": auth,
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error("[PAYMENT] Erro Marchabb:", resp.status, data);
      return res.status(502).json({
        success: false,
        message: "Falha ao criar PIX",
      });
    }

    const tx = data?.id;
    const pixText = data?.pix?.qrcode || data?.pix?.brCode || "";

    if (!tx || !pixText) {
      return res.status(502).json({
        success: false,
        message: "Gateway não retornou dados esperados",
      });
    }

    return res.status(200).json({
      success: true,
      transaction_id: String(tx),
      pix_code: String(pixText),
      amount: data?.amount || amountCents,
      status: String(data?.status || "PENDING"),
      qr_code: String(pixText),
    });

  } catch (error) {
    console.error("[PAYMENT] Erro:", error.message);
    return res.status(500).json({
      success: false,
      message: "Erro interno",
      error: error.message,
    });
  }
}

module.exports = handlePaymentRequest;
