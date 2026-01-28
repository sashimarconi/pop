#!/usr/bin/env node

/**
 * Script de teste da API contra o Vercel
 * Simula uma requisição exatamente como o frontend faria
 */

const testData = {
  cpf: "07317831905",
  nome: "JUAN PABLO MARCONI",
  email: "sashidoblack@gmail.com",
  phone: "(44) 92802-8281",
  amount: "64.73",
  title: "Taxa de Adesão",
};

async function testRemoteAPI() {
  const API_URL = "https://popcnh.vercel.app/api/payment/payment.php";
  
  console.log("🧪 Testando API remota via Vercel\n");
  console.log(`📍 URL: ${API_URL}\n`);
  console.log("📝 Payload:");
  console.log(JSON.stringify(testData, null, 2));
  console.log("\n---\n");

  try {
    console.log("⏳ Enviando requisição...");
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testData),
    });

    const data = await response.json();

    console.log(`\n✓ Status HTTP: ${response.status}\n`);
    console.log("📊 Resposta JSON:");
    console.log(JSON.stringify(data, null, 2));

    if (data.success) {
      console.log("\n✅ SUCESSO!\n");
      console.log("✨ Dados para o frontend:");
      console.log(`   transaction_id: ${data.transaction_id}`);
      console.log(`   pix_code: ${data.pix_code.substring(0, 50)}...`);
      console.log(`   amount: ${data.amount}`);
      console.log(`   status: ${data.status}`);
      console.log(`   qr_code: ${data.qr_code ? "presente" : "vazio"}`);
    } else {
      console.log("\n❌ ERRO");
      console.log(`   Mensagem: ${data.message}`);
    }
  } catch (error) {
    console.error("💥 ERRO:", error.message);
  }
}

testRemoteAPI();
