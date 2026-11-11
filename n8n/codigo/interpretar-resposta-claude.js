// No n8n, precos.js e triagem-comum.js são concatenados antes deste arquivo; nos testes, vêm por require.
const _depsClaude = {
  custoUsd: typeof custoUsd === "function" ? custoUsd : require("./precos.js").custoUsd,
  lerTriagemDoTexto: typeof lerTriagemDoTexto === "function" ? lerTriagemDoTexto : require("./triagem-comum.js").lerTriagemDoTexto,
};

/**
 * Converte a resposta da API do Claude (ou o erro HTTP) num resultado de triagem.
 * Nunca lança: qualquer problema vira `erroTriagem`, para a execução seguir com as outras falhas.
 */
function interpretarRespostaClaude(respostaHttp, { modelo, inicioMs, fimMs }) {
  const r = respostaHttp || {};
  const tokensEntrada = r.usage?.input_tokens ?? 0;
  const tokensSaida = r.usage?.output_tokens ?? 0;
  const base = {
    triagem: null,
    erroTriagem: null,
    tokensEntrada,
    tokensSaida,
    custoUsd: _depsClaude.custoUsd(modelo, tokensEntrada, tokensSaida) ?? 0,
    duracaoTriagemMs: fimMs - inicioMs,
  };
  const falhou = (motivo) => ({ ...base, erroTriagem: motivo });

  if (r.error || (r.statusCode && r.statusCode >= 400)) {
    const tipo = r.error?.type ?? "erro";
    const msg = r.error?.message ?? "";
    return falhou(`Erro da API (HTTP ${r.statusCode ?? "?"}): ${tipo}${msg ? ` - ${msg}` : ""}`);
  }
  if (r.stop_reason === "refusal") return falhou("A IA recusou a triagem desta falha.");
  if (r.stop_reason === "max_tokens") return falhou("Resposta cortada no limite de tokens.");

  const texto = (r.content || []).find((b) => b.type === "text")?.text;
  const { triagem, erro } = _depsClaude.lerTriagemDoTexto(texto);
  return erro ? falhou(erro) : { ...base, triagem };
}

if (typeof module !== "undefined") module.exports = { interpretarRespostaClaude };
