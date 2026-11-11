/**
 * Resultado final de uma falha, devolvido pelo webhook.
 * `decisao`: item do nó "Decidir ação"; `acaoRealizada`: criada | atualizada | reaberta | nenhuma;
 * `respostaGithub`: corpo da resposta do GitHub (ou null quando não houve chamada).
 */
function montarResultado(decisao, acaoRealizada, respostaGithub) {
  let acaoIssue = acaoRealizada;
  let issueUrl = null;
  let erroIssue = null;
  if (acaoRealizada !== "nenhuma") {
    if (respostaGithub && respostaGithub.html_url) {
      issueUrl = respostaGithub.html_url;
    } else {
      acaoIssue = "nenhuma";
      erroIssue = `Falha ao ${acaoRealizada === "criada" ? "criar" : "alterar"} a issue: ${
        respostaGithub?.error?.message ?? respostaGithub?.message ?? "resposta sem link"
      }`;
    }
  }
  return {
    falhaId: decisao.falha.id,
    titulo: decisao.falha.titulo,
    triagem: decisao.triagem,
    erroTriagem: decisao.erroTriagem,
    acaoIssue,
    issueUrl,
    erroIssue,
    tokensEntrada: decisao.tokensEntrada,
    tokensSaida: decisao.tokensSaida,
    custoUsd: decisao.custoUsd,
    duracaoTriagemMs: decisao.duracaoTriagemMs,
  };
}

if (typeof module !== "undefined") module.exports = { montarResultado };
