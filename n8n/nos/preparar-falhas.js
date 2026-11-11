// Nó "Preparar falhas" (uma vez para todos os itens).
// Entrada: corpo do webhook + issues existentes. Saída: um item por falha, com a requisição pronta para a IA escolhida.
const corpo = $("Webhook").first().json.body;
const listagem = $("GitHub: listar issues").all().map((i) => i.json);
const listagemFalhou = listagem.some((i) => i && i.error);
const issuesExistentes = listagem.filter((i) => i && typeof i.number === "number");
const provedor = provedorDoModelo(corpo.modelo);
const montar = provedor === "gemini" ? montarRequisicaoGemini : montarRequisicaoClaude;
const contexto = { execucao: corpo.execucao, repositorio: corpo.repositorio, modelo: corpo.modelo, issue: corpo.issue || {} };
const inicioMs = Date.now();
return (corpo.falhas || []).map((falha) => ({
  json: {
    falha: { ...falha, printBase64: null },
    contexto,
    provedor,
    issuesExistentes,
    listagemFalhou,
    inicioMs,
    requisicao: montar(falha, { promptSistema: corpo.promptSistema, modelo: corpo.modelo }),
  },
}));
