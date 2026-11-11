// Nó "Interpretar triagem" (uma vez para todos os itens).
// O n8n chama o Claude falha por falha; o tempo de triagem é a média do nó inteiro por falha.
const preparados = $("Preparar falhas").all();
const respostas = $input.all();
const fimMs = Date.now();
const n = Math.max(preparados.length, 1);
return preparados.map((p, i) => {
  const http = respostas[i]?.json ?? {};
  const resposta = http.body !== undefined ? { ...http.body, statusCode: http.statusCode } : http;
  const { modelo } = p.json.contexto;
  const inicioMedio = fimMs - (fimMs - p.json.inicioMs) / n;
  const interpretacao = interpretarRespostaClaude(resposta, { modelo, inicioMs: Math.round(inicioMedio), fimMs });
  return { json: { falha: p.json.falha, contexto: p.json.contexto, issuesExistentes: p.json.issuesExistentes, ...interpretacao } };
});
