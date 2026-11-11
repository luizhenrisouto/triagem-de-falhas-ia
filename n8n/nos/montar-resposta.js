// Nó "Montar resposta" (uma vez para todos os itens).
return [{ json: { resultados: $input.all().map((i) => i.json) } }];
