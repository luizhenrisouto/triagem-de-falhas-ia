// No n8n, triagem-comum.js é concatenado antes deste arquivo; nos testes, vem por require.
const _comumClaude =
  typeof ESQUEMA_TRIAGEM !== "undefined" ? { ESQUEMA_TRIAGEM, textoDaFalha } : require("./triagem-comum.js");

// Modelos com fallback no servidor (beta server-side-fallback-2026-07-01). O Haiku 5.5 não tem.
const MODELOS_COM_FALLBACK = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-2"];

/** Corpo do POST /v1/messages (API do Claude) para triar uma falha. */
function montarRequisicaoClaude(falha, { promptSistema, modelo }) {
  const conteudo = [];
  if (falha.printBase64) {
    conteudo.push({ type: "image", source: { type: "base64", media_type: "image/png", data: falha.printBase64 } });
  }
  conteudo.push({ type: "text", text: _comumClaude.textoDaFalha(falha) });
  const corpo = {
    model: modelo,
    max_tokens: 2000,
    system: promptSistema,
    output_config: { effort: "low", format: { type: "json_schema", schema: _comumClaude.ESQUEMA_TRIAGEM } },
    messages: [{ role: "user", content: conteudo }],
  };
  if (MODELOS_COM_FALLBACK.includes(modelo)) corpo.fallbacks = "default";
  return corpo;
}

if (typeof module !== "undefined") module.exports = { montarRequisicaoClaude };
