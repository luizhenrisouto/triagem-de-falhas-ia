// Preço por milhão de tokens (US$), entrada e saída. Fontes: tabelas de preços da Anthropic e do Google (nov/2026).
// Gemini: nível gratuito da API, custo zero (há limite de requisições por minuto e por dia).
const PRECOS_POR_MILHAO = {
  "claude-opus-5-5": { entrada: 4, saida: 20 },
  "claude-haiku-5-5": { entrada: 0.1, saida: 0.5 },
  "gemini-3.8-flash": { entrada: 0, saida: 0 },
  "gemini-3.5-flash-lite": { entrada: 0, saida: 0 },
};

function custoUsd(modelo, tokensEntrada, tokensSaida) {
  const p = PRECOS_POR_MILHAO[modelo];
  if (!p) return null;
  return (tokensEntrada * p.entrada + tokensSaida * p.saida) / 1e6;
}

if (typeof module !== "undefined") module.exports = { custoUsd, PRECOS_POR_MILHAO };
