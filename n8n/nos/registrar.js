// Nós "Registrar ..." (um por caminho, para cada item). ACAO_REALIZADA é trocada pelo build.
const decisao = $("Decidir ação").item.json;
const acao = "ACAO_REALIZADA";
return { json: montarResultado(decisao, acao, acao === "nenhuma" ? null : $json) };
