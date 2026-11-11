// Nó "Decidir ação" (uma vez para todos os itens): criar, atualizar, reabrir ou nenhuma.
return $input.all().map((item) => {
  const d = item.json;
  const { acao, numero } = decidirAcaoIssue(d.falha, d.triagem, d.issuesExistentes);
  let issue = null;
  if (acao !== "nenhuma") {
    const existente = d.issuesExistentes.find((i) => i.number === numero);
    issue = renderizarIssue(d.falha, d.triagem, d.contexto.execucao, lerOcorrencias(existente?.body));
  }
  const { issuesExistentes, ...resto } = d;
  return { json: { ...resto, acao, numero, issue } };
});
