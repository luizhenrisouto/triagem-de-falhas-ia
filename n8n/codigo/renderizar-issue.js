function lerOcorrencias(corpo) {
  const m = (corpo || "").match(/<!-- triagem-ia:ocorrencias=(\d+) -->/);
  return m ? Number(m[1]) : 0;
}

const NOME_CATEGORIA = {
  bug_produto: "Bug do produto",
  teste_quebrado: "Teste quebrado",
  teste_instavel: "Teste instável",
};

/** Título, corpo (Markdown) e rótulos da issue. `ocorrenciasAnteriores` = contador lido da issue existente (0 se nova). */
function renderizarIssue(falha, triagem, execucao, ocorrenciasAnteriores) {
  const ocorrencias = (ocorrenciasAnteriores || 0) + 1;
  const quebrado = triagem.categoria === "teste_quebrado";
  const corpo = [
    `**${NOME_CATEGORIA[triagem.categoria]}** · confiança da IA: ${Math.round(triagem.confianca * 100)}%`,
    "",
    `**Teste:** \`${falha.titulo}\``,
    "",
    "### Passos para reproduzir",
    ...triagem.passos.map((p, i) => `${i + 1}. ${p}`),
    "",
    "### Esperado",
    triagem.esperado,
    "",
    "### Obtido",
    triagem.obtido,
    "",
    "### Causa provável",
    triagem.causaProvavel,
    "",
    quebrado ? "### Correção sugerida para o teste" : "### Sugestão",
    triagem.sugestaoCorrecao,
    "",
    "---",
    `Ocorrências: ${ocorrencias} · Última ocorrência: ${execucao.data} ([execução ${execucao.id}](${execucao.url}), print e trace nos artefatos)`,
    "",
    "> Issue aberta automaticamente pela triagem com IA. Esta falha foi plantada de propósito na demonstração (SauceDemo); o gabarito está em `testes/gabarito.json`.",
    "",
    `<!-- triagem-ia:fp=${falha.id} -->`,
    `<!-- triagem-ia:ocorrencias=${ocorrencias} -->`,
  ].join("\n");
  return { titulo: `[SauceDemo] ${triagem.resumo}`, corpo, rotulos: ["triagem-ia", triagem.categoria] };
}

if (typeof module !== "undefined") module.exports = { renderizarIssue, lerOcorrencias };
