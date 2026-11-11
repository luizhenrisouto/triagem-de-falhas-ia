// No n8n, triagem-comum.js é concatenado antes deste arquivo; nos testes, vem por require.
const _comumGemini =
  typeof ESQUEMA_TRIAGEM !== "undefined" ? { ESQUEMA_TRIAGEM, textoDaFalha } : require("./triagem-comum.js");

/** Corpo do POST models/{modelo}:generateContent (API do Gemini) para triar uma falha. */
function montarRequisicaoGemini(falha, { promptSistema }) {
  const partes = [];
  if (falha.printBase64) partes.push({ inline_data: { mime_type: "image/png", data: falha.printBase64 } });
  partes.push({ text: _comumGemini.textoDaFalha(falha) });
  return {
    systemInstruction: { parts: [{ text: promptSistema }] },
    contents: [{ role: "user", parts: partes }],
    generationConfig: {
      maxOutputTokens: 4000,
      responseMimeType: "application/json",
      responseJsonSchema: _comumGemini.ESQUEMA_TRIAGEM,
      thinkingConfig: { thinkingLevel: "LOW" },
    },
  };
}

if (typeof module !== "undefined") module.exports = { montarRequisicaoGemini };
