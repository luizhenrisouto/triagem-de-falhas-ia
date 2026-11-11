// Preço por milhão de tokens (US$), entrada e saída. Fonte: tabela de preços da Anthropic (nov/2026).
const PRECOS_POR_MILHAO = {
  "claude-opus-5-5": { entrada: 4, saida: 20 },
  "claude-haiku-5-5": { entrada: 0.1, saida: 0.5 },
};

function custoUsd(modelo, tokensEntrada, tokensSaida) {
  const p = PRECOS_POR_MILHAO[modelo];
  if (!p) return null;
  return (tokensEntrada * p.entrada + tokensSaida * p.saida) / 1e6;
}

if (typeof module !== "undefined") module.exports = { custoUsd, PRECOS_POR_MILHAO };
