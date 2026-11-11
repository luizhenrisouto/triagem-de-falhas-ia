// Nó "Registrar reaberta" (para cada item): o link vem da resposta do PATCH que reabriu a issue.
const decisao = $("Decidir ação").item.json;
return { json: montarResultado(decisao, "reaberta", $("GitHub: reabrir issue").item.json) };
