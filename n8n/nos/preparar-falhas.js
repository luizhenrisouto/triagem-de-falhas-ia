// Nó "Preparar falhas" (uma vez para todos os itens).
// Entrada: corpo do webhook + issues existentes. Saída: um item por falha, com a requisição pronta para o Claude.
const corpo = $("Webhook").first().json.body;
const issuesExistentes = $("GitHub: listar issues")
  .all()
  .map((i) => i.json)
  .filter((i) => i && typeof i.number === "number");
const contexto = {
  execucao: corpo.execucao,
  repositorio: corpo.repositorio,
  modelo: corpo.modelo,
};
const inicioMs = Date.now();
return (corpo.falhas || []).map((falha) => ({
  json: {
    falha: { ...falha, printBase64: null },
    contexto,
    issuesExistentes,
    inicioMs,
    requisicao: montarRequisicaoClaude(falha, { promptSistema: corpo.promptSistema, modelo: corpo.modelo }),
  },
}));
