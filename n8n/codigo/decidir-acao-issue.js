/**
 * Decide o que fazer com a issue de uma falha triada.
 * `issuesExistentes`: issues do repositório com o rótulo triagem-ia (abertas e fechadas).
 */
function decidirAcaoIssue(falha, triagem, issuesExistentes) {
  if (!triagem || triagem.categoria === "teste_instavel") return { acao: "nenhuma", numero: null };
  const marcador = `<!-- triagem-ia:fp=${falha.id} -->`;
  const mesmas = (issuesExistentes || []).filter((i) => (i.body || "").includes(marcador));
  const aberta = mesmas.find((i) => i.state === "open");
  if (aberta) return { acao: "atualizar", numero: aberta.number };
  if (mesmas.length > 0) return { acao: "reabrir", numero: mesmas[0].number };
  return { acao: "criar", numero: null };
}

if (typeof module !== "undefined") module.exports = { decidirAcaoIssue };
