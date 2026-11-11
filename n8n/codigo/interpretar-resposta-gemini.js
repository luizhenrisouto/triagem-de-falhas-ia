// No n8n, precos.js e triagem-comum.js são concatenados antes deste arquivo; nos testes, vêm por require.
const _depsGemini = {
  custoUsd: typeof custoUsd === "function" ? custoUsd : require("./precos.js").custoUsd,
  lerTriagemDoTexto: typeof lerTriagemDoTexto === "function" ? lerTriagemDoTexto : require("./triagem-comum.js").lerTriagemDoTexto,
};

/**
 * Converte a resposta da API do Gemini (ou o erro HTTP) num resultado de triagem.
 * Nunca lança: qualquer problema vira `erroTriagem`. Tokens de pensamento contam como saída.
 */
function interpretarRespostaGemini(respostaHttp, { modelo, inicioMs, fimMs }) {
  const r = respostaHttp || {};
  const uso = r.usageMetadata || {};
  const tokensEntrada = uso.promptTokenCount ?? 0;
  const tokensSaida = (uso.candidatesTokenCount ?? 0) + (uso.thoughtsTokenCount ?? 0);
  const base = {
    triagem: null,
    erroTriagem: null,
    tokensEntrada,
    tokensSaida,
    custoUsd: _depsGemini.custoUsd(modelo, tokensEntrada, tokensSaida) ?? 0,
    duracaoTriagemMs: fimMs - inicioMs,
  };
  const falhou = (motivo) => ({ ...base, erroTriagem: motivo });

  if (r.error || (r.statusCode && r.statusCode >= 400)) {
    const status = r.error?.status ?? "erro";
    const msg = r.error?.message ?? "";
    return falhou(`Erro da API (HTTP ${r.statusCode ?? r.error?.code ?? "?"}): ${status}${msg ? ` - ${msg}` : ""}`);
  }
  if (r.promptFeedback?.blockReason) return falhou(`A IA bloqueou o pedido (${r.promptFeedback.blockReason}).`);

  const candidato = (r.candidates || [])[0];
  if (!candidato) return falhou("A IA não devolveu nenhuma resposta.");
  if (candidato.finishReason && candidato.finishReason !== "STOP") {
    return falhou(`A resposta da IA terminou com ${candidato.finishReason}.`);
  }
  const texto = (candidato.content?.parts || [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  const { triagem, erro } = _depsGemini.lerTriagemDoTexto(texto);
  return erro ? falhou(erro) : { ...base, triagem };
}

if (typeof module !== "undefined") module.exports = { interpretarRespostaGemini };
