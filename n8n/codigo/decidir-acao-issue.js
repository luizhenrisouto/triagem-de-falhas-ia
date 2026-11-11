/**
 * Decide o que fazer com a issue de uma falha triada.
 * `issuesExistentes`: issues do repositório com o rótulo triagem-ia (abertas e fechadas).
 * `opcoes.listagemFalhou`: a chamada que lista as issues deu erro.
 */
function decidirAcaoIssue(falha, triagem, issuesExistentes, opcoes = {}) {
  if (!triagem || triagem.categoria === "teste_instavel") return { acao: "nenhuma", numero: null };
  // Sem a lista não dá para saber se a issue já existe: criar agora poderia duplicar.
  if (opcoes.listagemFalhou) {
    return { acao: "nenhuma", numero: null, erro: "Não foi possível listar as issues no GitHub; nada foi criado para não duplicar." };
  }
  const marcador = `<!-- triagem-ia:fp=${falha.id} -->`;
  const mesmas = (issuesExistentes || []).filter((i) => (i.body || "").includes(marcador));
  const aberta = mesmas.find((i) => i.state === "open");
  if (aberta) return { acao: "atualizar", numero: aberta.number };
  if (mesmas.length > 0) return { acao: "reabrir", numero: mesmas[0].number };
  return { acao: "criar", numero: null };
}

if (typeof module !== "undefined") module.exports = { decidirAcaoIssue };
