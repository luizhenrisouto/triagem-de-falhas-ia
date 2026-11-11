// Partes da triagem que não dependem do provedor de IA.
const CATEGORIAS = ["bug_produto", "teste_instavel", "teste_quebrado"];

const ESQUEMA_TRIAGEM = {
  type: "object",
  properties: {
    categoria: { type: "string", enum: CATEGORIAS },
    confianca: { type: "number" },
    resumo: { type: "string" },
    passos: { type: "array", items: { type: "string" } },
    esperado: { type: "string" },
    obtido: { type: "string" },
    causaProvavel: { type: "string" },
    sugestaoCorrecao: { type: "string" },
  },
  required: ["categoria", "confianca", "resumo", "passos", "esperado", "obtido", "causaProvavel", "sugestaoCorrecao"],
  additionalProperties: false,
};

function textoDaFalha(falha) {
  return [
    `Teste: ${falha.titulo}`,
    `Arquivo: ${falha.arquivo}${falha.linha ? `, linha ${falha.linha}` : ""}`,
    `Tentativas: ${falha.tentativas}`,
    `Passou numa nova tentativa: ${falha.passouNaNovaTentativa ? "sim" : "não"}`,
    `Duração total: ${falha.duracaoMs} ms`,
    "",
    "Mensagem de erro:",
    falha.erro,
    "",
    "Stack:",
    falha.stack || "(sem stack)",
    "",
    "Trecho do código do teste:",
    falha.trechoCodigo || "(código não disponível)",
    "",
    falha.printBase64 ? "O print da tela no momento da falha está anexado." : "Não há print desta falha.",
  ].join("\n");
}

/** Converte o texto JSON devolvido pela IA em triagem, ou explica por que não deu. */
function lerTriagemDoTexto(texto) {
  let triagem;
  try {
    triagem = JSON.parse(texto);
  } catch {
    return { triagem: null, erro: "A IA devolveu um JSON inválido." };
  }
  if (!triagem || !CATEGORIAS.includes(triagem.categoria)) {
    return { triagem: null, erro: `A IA devolveu uma categoria inválida: ${triagem?.categoria}` };
  }
  return { triagem, erro: null };
}

if (typeof module !== "undefined") module.exports = { CATEGORIAS, ESQUEMA_TRIAGEM, textoDaFalha, lerTriagemDoTexto };
