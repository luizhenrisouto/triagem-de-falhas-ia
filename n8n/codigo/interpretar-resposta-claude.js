// No n8n, precos.js é concatenado antes deste arquivo; nos testes, vem por require.
function _custo(modelo, entrada, saida) {
  const fn = typeof custoUsd === "function" ? custoUsd : require("./precos.js").custoUsd;
  return fn(modelo, entrada, saida);
}

const CATEGORIAS_VALIDAS = ["bug_produto", "teste_instavel", "teste_quebrado"];

/**
 * Converte a resposta da API (ou o erro HTTP) num resultado de triagem.
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
    custoUsd: _custo(modelo, tokensEntrada, tokensSaida) ?? 0,
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
  let triagem;
  try {
    triagem = JSON.parse(texto);
  } catch {
    return falhou("A IA devolveu um JSON inválido.");
  }
  if (!triagem || !CATEGORIAS_VALIDAS.includes(triagem.categoria)) {
    return falhou(`A IA devolveu uma categoria inválida: ${triagem?.categoria}`);
  }
  return { ...base, triagem };
}

if (typeof module !== "undefined") module.exports = { interpretarRespostaClaude };
