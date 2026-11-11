# Triagem de falhas de teste com IA — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repositório público que roda testes Playwright contra o SauceDemo no GitHub Actions, manda as falhas para um fluxo n8n que as tria com o Claude, abre/atualiza issues sem duplicar e publica uma página de resultados com números reais.

**Architecture:** A lógica pura (ler relatórios, impressão digital, montar a chamada ao Claude, interpretar a resposta, decidir a ação da issue, métricas) vive em arquivos JS/TS testados com Vitest. Os nós Code do n8n usam esses mesmos arquivos: um script de build injeta o código em `n8n/fluxo.json`. O Actions roda testes → sobe n8n → envia falhas ao webhook → recebe o resultado → grava histórico na branch `gh-pages` → GitHub Pages serve a página estática.

**Tech Stack:** Node 22 (CI) / Node 24 (local), TypeScript via `tsx`, `@playwright/test`, Vitest, `fast-xml-parser`, n8n (via `npx n8n`, sem Docker local), API do Claude via nó HTTP Request (REST), GitHub REST API, GitHub Actions + Pages.

**Spec:** `docs/superpowers/specs/2026-11-11-triagem-falhas-ia-design.md`

## Global Constraints

- Nenhum dado, nome, URL, print ou código do empregador do autor em lugar nenhum do repositório (conferir no Task 9 com a lista de termos em `.superpowers/termos-proibidos.txt`, que fica fora do repositório).
- Nomes de testes descrevem comportamento, nunca a resposta (proibido "bug", "quebrado", "instável", "flaky", `problem_user`, `error_user`, `glitch` no **título** do teste).
- Modelo padrão `claude-opus-5-5`, configurável pela variável `MODELO_CLAUDE`; `claude-haiku-5-5` deve funcionar trocando só essa variável.
- Preços para custo: Opus 5.5 US$ 4 / US$ 20 por milhão de tokens (entrada/saída); Haiku 5.5 US$ 0,10 / US$ 0,50. Ficam num único arquivo.
- Estimativa manual: **30 minutos por falha**, sempre exibida como "estimativa do autor".
- Segredos só via `secrets.ANTHROPIC_API_KEY` e `GITHUB_TOKEN`; nunca impressos em log.
- Categorias exatas (string): `bug_produto`, `teste_instavel`, `teste_quebrado`.
- Issues: rótulo `triagem-ia` + rótulo da categoria; título começa com `[SauceDemo] `.
- Tudo voltado ao leitor (README, página, issues, mensagens) em português; README com resumo curto em inglês no topo.
- Repositório criado **privado**; só vira público no Task 9, depois da conferência e do "ok" do autor.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Claude devolve recusa (`stop_reason: "refusal"`), JSON inválido ou erro HTTP/limite → a falha aparece no resultado com `erroTriagem`, sem issue, e a execução inteira continua (teste no Task 3).
- Execução sem nenhuma falha → nada é enviado ao Claude, o histórico ganha uma execução "verde" e a página mostra 0 falhas sem quebrar (testes nos Tasks 6 e 7).
- Mesma falha em dias seguidos / issue fechada que volta → atualiza contador ou reabre, nunca cria segunda issue (teste no Task 4).
- Print ausente ou grande demais (>4 MB) → triagem segue só com texto (teste no Task 2).
- Mensagem de erro com números variáveis (tempos, ids) → mesma impressão digital entre execuções (teste no Task 2).

---

### Task 1: Repositório, suíte Playwright e gabarito

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `.nvmrc` (`22`), `playwright.config.ts`, `testes/e2e/catalogo.spec.ts`, `testes/e2e/carrinho.spec.ts`, `testes/e2e/checkout.spec.ts`, `testes/e2e/apoio/login.ts`, `testes/gabarito.json`
- Move: `docs/superpowers/specs/2026-11-11-triagem-falhas-ia-design.md` já está na pasta (veio da sessão).

**Interfaces:**
- Produces: `testes/gabarito.json` = `{ "<titulo completo do teste>": "bug_produto" | "teste_instavel" | "teste_quebrado" }` (só testes que devem falhar). Relatórios: `relatorios/resultado.json` (reporter `json`) e `relatorios/junit.xml` (reporter `junit`); prints em `test-results/`.
- `login(page, usuario: "standard_user" | "problem_user" | "error_user" | "performance_glitch_user"): Promise<void>` em `testes/e2e/apoio/login.ts` (senha `secret_sauce`, baseURL `https://www.saucedemo.com`).

- [ ] **Step 1:** `git init -b main`, `npm init`, instalar `@playwright/test typescript tsx vitest fast-xml-parser` e `npx playwright install chromium`. `.gitignore`: `node_modules`, `test-results`, `relatorios`, `playwright-report`, `.n8n`, `.env`.
- [ ] **Step 2:** `playwright.config.ts`: `use.baseURL` SauceDemo, `screenshot: "only-on-failure"`, `trace: "retain-on-failure"`, `retries: process.env.CI ? 1 : 0`, reporters `list`, `["json", { outputFile: "relatorios/resultado.json" }]`, `["junit", { outputFile: "relatorios/junit.xml" }]`, só chromium.
- [ ] **Step 3:** Escrever 9 testes com títulos neutros:
  - passam (`standard_user`): "login mostra o catálogo de produtos", "adicionar produto atualiza o contador do carrinho", "checkout completo gera confirmação do pedido", "ordenar por menor preço coloca o item mais barato primeiro";
  - `problem_user`: "imagem de cada produto corresponde ao produto" → `bug_produto`; "campo sobrenome aceita texto no checkout" → `bug_produto`;
  - `error_user`: "finalizar compra conclui o pedido" → `bug_produto`;
  - `performance_glitch_user`: "catálogo abre em tempo aceitável" com `expect(...).toBeVisible({ timeout: X })`, X calibrado no Step 5 → `teste_instavel`;
  - `standard_user` com seletor errado de propósito (ex.: `[data-test="remover-item"]`, que não existe): "remover produto esvazia o carrinho" → `teste_quebrado`.
- [ ] **Step 4:** Preencher `testes/gabarito.json` com os 5 títulos completos (formato `arquivo > describe > título`, como aparece no JSON do Playwright) e categoria.
- [ ] **Step 5: Verificar e calibrar.** Rodar `npx playwright test --repeat-each=10` só no teste de desempenho e ajustar X até falhar entre 30% e 70% das vezes. Depois `npx playwright test` completo.
  Expected: 4 passam; os 3 de bug e o de seletor falham sempre; o de desempenho falha às vezes. Se algum comportamento do SauceDemo não for o esperado (o site pode ter mudado), trocar a verificação por outro defeito real do mesmo usuário e atualizar o gabarito.
- [ ] **Step 6: Commit** `chore: suíte Playwright do SauceDemo com falhas plantadas e gabarito`.

---

### Task 2: Coletor de falhas

**Files:**
- Create: `src/coleta/tipos.ts`, `src/coleta/impressao-digital.ts`, `src/coleta/ler-playwright.ts`, `src/coleta/ler-junit.ts`, `src/coleta/trecho-codigo.ts`
- Test: `src/coleta/*.test.ts`, fixtures em `testes/fixtures/` (um `resultado.json` e um `junit.xml` reais gerados no Task 1, copiados e enxugados)

**Interfaces:**
- Produces:
```ts
export type Falha = {
  id: string;                 // impressão digital, 12 hex
  titulo: string;             // "arquivo > describe > título"
  arquivo: string; linha: number | null;
  erro: string; stack: string;
  trechoCodigo: string;       // até 40 linhas ao redor de `linha`
  passouNaNovaTentativa: boolean; tentativas: number; duracaoMs: number;
  printBase64: string | null; // PNG; null se ausente ou > 4 MB
};
export function impressaoDigital(arquivo: string, titulo: string, erro: string): string;
export function lerRelatorioPlaywright(caminhoJson: string, raizProjeto: string): Falha[];
export function lerRelatorioJunit(caminhoXml: string, raizProjeto: string): Falha[];
```

- [ ] **Step 1: Testes que falham**
```ts
test("impressão digital ignora números variáveis", () => {
  const a = impressaoDigital("x.spec.ts", "t", "Timeout 5000ms exceeded after 5231ms");
  const b = impressaoDigital("x.spec.ts", "t", "Timeout 5000ms exceeded after 6012ms");
  expect(a).toBe(b); expect(a).toMatch(/^[0-9a-f]{12}$/);
});
test("impressão digital muda com o título", () => { expect(impressaoDigital("x","a","e")).not.toBe(impressaoDigital("x","b","e")); });
test("Playwright: inclui falhas e instáveis, exclui aprovados", () => {
  const f = lerRelatorioPlaywright("testes/fixtures/resultado.json", ".");
  expect(f.map(x => x.titulo)).toContain(/* título de um teste que falhou na fixture */);
  expect(f.find(x => x.passouNaNovaTentativa)).toBeDefined();
  expect(f.every(x => x.trechoCodigo.length > 0)).toBe(true);
});
test("JUnit: só falhas definitivas, passouNaNovaTentativa=false", () => { /* fixture junit.xml */ });
test("print acima de 4 MB vira null", () => { /* fixture com anexo apontando arquivo grande gerado no teste */ });
```
- [ ] **Step 2:** `npx vitest run src/coleta` → FAIL (módulos não existem).
- [ ] **Step 3:** Implementar. Impressão digital: primeira linha do erro, sem códigos ANSI, com todo número trocado por `#`, depois `sha1(arquivo + "::" + titulo + "::" + erroNormalizado).slice(0, 12)`. "Instável" no JSON do Playwright = `status: "flaky"` (passou depois de falhar); nesse caso o erro vem da tentativa que falhou.
- [ ] **Step 4:** `npx vitest run src/coleta` → PASS.
- [ ] **Step 5: Commit** `feat: coletor de falhas (Playwright JSON e JUnit)`.

---

### Task 3: Chamada ao Claude (prompt, requisição, interpretação, custo)

**Files:**
- Create: `prompts/triagem.md`, `n8n/codigo/montar-requisicao-claude.js`, `n8n/codigo/interpretar-resposta-claude.js`, `src/ia/precos.js`
- Test: `n8n/codigo/montar-requisicao-claude.test.js`, `n8n/codigo/interpretar-resposta-claude.test.js`

Os arquivos em `n8n/codigo/` são JS puro (CommonJS, sem dependências, sem `require` externo exceto entre si via injeção pelo build), cada um exportando uma única função; o Task 5 os injeta nos nós Code.

**Interfaces:**
- Consumes: `Falha` (Task 2).
- Produces:
```js
// montar-requisicao-claude.js
function montarRequisicaoClaude(falha, { promptSistema, modelo }) // -> corpo JSON para POST https://api.anthropic.com/v1/messages
// interpretar-resposta-claude.js
function interpretarRespostaClaude(respostaHttp, { modelo, inicioMs, fimMs })
// -> { triagem: Triagem | null, erroTriagem: string | null, tokensEntrada, tokensSaida, custoUsd, duracaoTriagemMs }
// Triagem = { categoria: "bug_produto"|"teste_instavel"|"teste_quebrado", confianca: number, resumo: string,
//             passos: string[], esperado: string, obtido: string, causaProvavel: string, sugestaoCorrecao: string }
// precos.js
function custoUsd(modelo, tokensEntrada, tokensSaida) // Opus 5.5: 4/20 por MTok; Haiku 5.5: 0.10/0.50; modelo desconhecido -> null
```

- [ ] **Step 1:** Escrever `prompts/triagem.md`: papel (QA sênior fazendo triagem), as três categorias com critérios de decisão, instrução de usar só as evidências dadas, de responder em português, e de escrever passos reproduzíveis. Sem citar SauceDemo, usuários ou o gabarito.
- [ ] **Step 2: Testes que falham**
```js
test("requisição usa modelo, saída estruturada e fallback", () => {
  const r = montarRequisicaoClaude(falhaExemplo, { promptSistema: "P", modelo: "claude-opus-5-5" });
  expect(r.model).toBe("claude-opus-5-5");
  expect(r.system).toBe("P");
  expect(r.output_config.format.type).toBe("json_schema");
  expect(r.output_config.format.schema.properties.categoria.enum)
    .toEqual(["bug_produto", "teste_instavel", "teste_quebrado"]);
  expect(r.fallbacks).toBe("default");
});
test("print entra como bloco de imagem; sem print, só texto", () => { /* content[0].type === "image" quando printBase64 */ });
test("texto do usuário traz erro, stack, trecho e se passou na nova tentativa", () => { /* contém cada campo */ });
test("resposta válida vira triagem com custo", () => {
  const r = interpretarRespostaClaude(respostaOk, { modelo: "claude-opus-5-5", inicioMs: 0, fimMs: 1500 });
  expect(r.triagem.categoria).toBe("bug_produto");
  expect(r.custoUsd).toBeCloseTo(1000 * 4 / 1e6 + 200 * 20 / 1e6);
  expect(r.duracaoTriagemMs).toBe(1500);
});
test("recusa vira erroTriagem", () => { expect(interpretarRespostaClaude({ stop_reason: "refusal", content: [], usage: {...} }, ctx).erroTriagem).toMatch(/recus/i); });
test("JSON inválido vira erroTriagem", () => { /* content[0].text = "não é json" */ });
test("erro HTTP vira erroTriagem com status", () => { /* { error: { type: "rate_limit_error" }, statusCode: 429 } */ });
```
- [ ] **Step 3:** `npx vitest run n8n/codigo` → FAIL.
- [ ] **Step 4:** Implementar. Requisição: `max_tokens: 2000`, `output_config: { effort: "low", format: { type: "json_schema", schema } }` com `additionalProperties: false` e todos os campos em `required`, `fallbacks: "default"`; o header `anthropic-beta: server-side-fallback-2026-07-01` e `anthropic-version: 2023-06-01` ficam no nó HTTP (Task 5). Interpretação: checar `stop_reason` antes de ler `content`; parse com `JSON.parse` do bloco `text`.
- [ ] **Step 5:** `npx vitest run n8n/codigo` → PASS.
- [ ] **Step 6: Commit** `feat: prompt e contrato da triagem com Claude`.

---

### Task 4: Decisão e texto das issues (sem duplicar)

**Files:**
- Create: `n8n/codigo/decidir-acao-issue.js`, `n8n/codigo/renderizar-issue.js`
- Test: `n8n/codigo/decidir-acao-issue.test.js`, `n8n/codigo/renderizar-issue.test.js`

**Interfaces:**
- Consumes: `Falha`, `Triagem` (Tasks 2–3).
- Produces:
```js
// issuesExistentes: lista da API GET /repos/{o}/{r}/issues?labels=triagem-ia&state=all (já paginada pelo nó)
function decidirAcaoIssue(falha, triagem, issuesExistentes)
// -> { acao: "criar" | "atualizar" | "reabrir" | "nenhuma", numero: number | null }
function renderizarIssue(falha, triagem, execucao, ocorrenciasAnteriores)
// execucao = { id, url, data } ; -> { titulo, corpo, rotulos: string[] }
function lerOcorrencias(corpo) // -> number (0 se não houver marcador)
```

- [ ] **Step 1: Testes que falham**
```js
test("teste_instavel nunca gera issue", () => { expect(decidirAcaoIssue(f, { ...t, categoria: "teste_instavel" }, []).acao).toBe("nenhuma"); });
test("triagem nula não gera issue", () => { expect(decidirAcaoIssue(f, null, []).acao).toBe("nenhuma"); });
test("sem issue com a mesma impressão digital: criar", () => { expect(decidirAcaoIssue(f, t, []).acao).toBe("criar"); });
test("issue aberta com o marcador: atualizar", () => {
  const ex = [{ number: 7, state: "open", body: `<!-- triagem-ia:fp=${f.id} -->` }];
  expect(decidirAcaoIssue(f, t, ex)).toEqual({ acao: "atualizar", numero: 7 });
});
test("issue fechada com o marcador: reabrir", () => { /* state: "closed" -> { acao: "reabrir", numero } */ });
test("corpo traz marcadores, contador e última ocorrência", () => {
  const { titulo, corpo, rotulos } = renderizarIssue(f, t, { id: "42", url: "https://x/42", data: "2026-11-12" }, 2);
  expect(titulo.startsWith("[SauceDemo] ")).toBe(true);
  expect(corpo).toContain(`<!-- triagem-ia:fp=${f.id} -->`);
  expect(corpo).toContain("<!-- triagem-ia:ocorrencias=3 -->");
  expect(corpo).toContain("Última ocorrência: 2026-11-12");
  expect(rotulos).toEqual(["triagem-ia", "bug_produto"]);
  expect(lerOcorrencias(corpo)).toBe(3);
});
test("teste_quebrado inclui a sugestão de correção", () => { /* corpo contém triagem.sugestaoCorrecao */ });
```
- [ ] **Step 2:** `npx vitest run n8n/codigo` → FAIL nos novos testes.
- [ ] **Step 3:** Implementar. Corpo: resumo, passos numerados, esperado x obtido, causa provável, (sugestão se `teste_quebrado`), confiança, link da execução, aviso "Issue aberta automaticamente pela triagem com IA; falha plantada de propósito na demonstração."
- [ ] **Step 4:** `npx vitest run` → PASS.
- [ ] **Step 5: Commit** `feat: decisão e texto das issues com deduplicação`.

---

### Task 5: Fluxo n8n (build, importação e teste de integração com dublês)

**Files:**
- Create: `n8n/fluxo.modelo.json` (exportado do editor do n8n, com marcadores `{{CODIGO:nome-do-arquivo}}` nos nós Code), `scripts/montar-fluxo.ts` (gera `n8n/fluxo.json`), `scripts/subir-n8n.ts` (sobe n8n, importa, ativa, espera o webhook responder), `testes/integracao/duble-servidor.ts`, `testes/integracao/fluxo.test.ts`
- Modify: `package.json` scripts: `"fluxo:montar"`, `"n8n:local"`, `"test:integracao"`

**Interfaces:**
- Consumes: as funções dos Tasks 3–4.
- Produces: webhook `POST {N8N_URL}/webhook/triagem` com corpo
  `{ execucao: { id, url, data }, repositorio: "dono/nome", modelo, promptSistema, falhas: Falha[] }`
  e resposta síncrona
  `{ resultados: Array<{ falhaId, titulo, triagem, erroTriagem, acaoIssue: "criada"|"atualizada"|"reaberta"|"nenhuma", issueUrl: string|null, tokensEntrada, tokensSaida, custoUsd, duracaoTriagemMs }> }`.
  Variáveis lidas pelo n8n (ambiente): `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `CLAUDE_URL_BASE` (padrão `https://api.anthropic.com`), `GITHUB_URL_BASE` (padrão `https://api.github.com`).
- Nós (na ordem): Webhook (responder com o último nó) → Separar falhas → Code "montar requisição" → HTTP Request Claude (headers `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-beta: server-side-fallback-2026-07-01`; "continuar em erro") → Code "interpretar" → HTTP Request "listar issues" (`labels=triagem-ia&state=all`, paginação) → Code "decidir" → Switch (criar/atualizar/reabrir/nenhuma) → HTTP Requests do GitHub (POST issue / PATCH corpo / PATCH `state: open` + POST comentário "voltou a ocorrer") → Agregar → Responder.

- [ ] **Step 1:** Rodar `npx n8n` local, montar o fluxo no editor (o autor pode assistir em `http://localhost:5678`), exportar para `n8n/fluxo.modelo.json` e trocar o código dos nós Code pelos marcadores.
- [ ] **Step 2:** `scripts/montar-fluxo.ts`: para cada marcador, lê `n8n/codigo/<nome>.js` e gera o código do nó = fonte + chamada da função com `$input`/`$json`. Gera `n8n/fluxo.json` (versionado também, para quem só quer importar).
- [ ] **Step 3: Teste de integração que falha** (`testes/integracao/fluxo.test.ts`, timeout 5 min): sobe dublês HTTP para Claude e GitHub (respostas fixas, registram chamadas), sobe n8n apontando `CLAUDE_URL_BASE`/`GITHUB_URL_BASE` para eles, envia 3 falhas (bug, instável, quebrado).
```ts
expect(res.resultados).toHaveLength(3);
expect(res.resultados.map(r => r.acaoIssue).sort()).toEqual(["criada", "criada", "nenhuma"]);
expect(dubleGithub.chamadas.filter(c => c.metodo === "POST" && c.caminho.endsWith("/issues"))).toHaveLength(2);
// segunda execução com a mesma lista de issues já "existentes" no dublê:
expect(res2.resultados.filter(r => r.acaoIssue === "criada")).toHaveLength(0);
// dublê do Claude devolvendo 500 para uma falha: as outras seguem, essa tem erroTriagem
```
- [ ] **Step 4:** `npm run test:integracao` → FAIL; implementar `subir-n8n.ts` (CLI `n8n import:workflow --input=n8n/fluxo.json`; ativar o fluxo pelo comando que a versão instalada oferecer; `N8N_USER_FOLDER` numa pasta temporária; espera ativa até o webhook responder) e ajustar o fluxo até passar.
- [ ] **Step 5:** `npm run test:integracao` → PASS. Fixar a versão do n8n no `package.json` (`devDependencies`), a mesma usada no CI.
- [ ] **Step 6: Commit** `feat: fluxo n8n de triagem com teste de integração`.

---

### Task 6: Envio ao n8n e métricas da execução

**Files:**
- Create: `scripts/enviar-para-n8n.ts`, `src/metricas/calcular.ts`
- Test: `src/metricas/calcular.test.ts`, `scripts/enviar-para-n8n.test.ts`

**Interfaces:**
- Consumes: `lerRelatorioPlaywright` (Task 2), contrato do webhook (Task 5), `testes/gabarito.json` (Task 1).
- Produces:
```ts
export type ResumoExecucao = {
  id: string; data: string; url: string; commit: string; modelo: string;
  totalTestes: number; aprovados: number; falhas: number;
  porCategoria: Record<"bug_produto"|"teste_instavel"|"teste_quebrado", number>;
  acertoGabaritoPct: number | null;      // null quando não há falha com gabarito
  duracaoMediaTriagemMs: number | null;
  custoUsd: number;
  minutosManuaisEstimados: number;       // falhas triadas * 30
  minutosEconomizados: number;           // estimados - tempo real somado da triagem
  issues: { criadas: number; atualizadas: number; reabertas: number };
  resultados: ResultadoTriagem[];        // como vem do webhook
};
export function calcularResumo(entrada: { execucao; totalTestes: number; aprovados: number; resultados; gabarito: Record<string,string>; modelo: string }): ResumoExecucao;
```
  CLI: `tsx scripts/enviar-para-n8n.ts --relatorio relatorios/resultado.json --saida relatorios/resumo.json` (lê `N8N_URL`, `GITHUB_RUN_ID`, `GITHUB_SERVER_URL`, `GITHUB_REPOSITORY`, `GITHUB_SHA`, `MODELO_CLAUDE`).

- [ ] **Step 1: Testes que falham**
```ts
test("acerto contra o gabarito", () => { /* 4 resultados, 3 batem com o gabarito -> 75 */ });
test("falha com erroTriagem conta como erro, não como acerto", () => {});
test("minutos economizados usam 30 min por falha triada", () => {
  const r = calcularResumo({ ...base, resultados: [triado(60_000), triado(30_000)] });
  expect(r.minutosManuaisEstimados).toBe(60);
  expect(r.minutosEconomizados).toBeCloseTo(60 - 1.5);
});
test("sem falhas: zeros, acerto null e não chama o n8n", async () => { /* fetch dublê não é chamado; resumo.falhas === 0 */ });
```
- [ ] **Step 2:** `npx vitest run src/metricas scripts` → FAIL.
- [ ] **Step 3:** Implementar. O envio lê o prompt de `prompts/triagem.md` e o põe em `promptSistema`; timeout do POST 10 min; se o n8n não responder, grava resumo com `resultados: []` e sai com código 1 (o job marca falha da triagem, não dos testes).
- [ ] **Step 4:** `npx vitest run` → PASS.
- [ ] **Step 5: Commit** `feat: envio ao n8n e métricas da execução`.

---

### Task 7: Histórico e página de resultados

**Files:**
- Create: `scripts/publicar-historico.ts`, `site/index.html`, `site/app.js`, `site/estilo.css`
- Test: `scripts/publicar-historico.test.ts`

**Interfaces:**
- Consumes: `ResumoExecucao` (Task 6).
- Produces: na pasta de publicação (checkout da branch `gh-pages`): `dados/execucoes/<id>.json` (resumo completo) e `dados/indice.json` = `{ atualizadoEm, totais: { execucoes, falhasTriadas, acertoMedioPct, custoTotalUsd, horasEconomizadas, issuesAbertas }, execucoes: Array<resumo sem `resultados`> }` ordenado do mais novo para o mais antigo; mais os arquivos de `site/`.
  CLI: `tsx scripts/publicar-historico.ts --resumo relatorios/resumo.json --destino publicacao/`.

- [ ] **Step 1: Testes que falham**
```ts
test("adiciona execução e recalcula totais", () => { /* destino com 2 execuções -> 3; totais somados */ });
test("mesma execução publicada duas vezes não duplica", () => {});
test("primeira execução cria indice.json do zero", () => {});
test("execução sem falhas entra com acerto null e não derruba a média", () => {});
```
- [ ] **Step 2:** `npx vitest run scripts/publicar-historico` → FAIL.
- [ ] **Step 3:** Implementar o script; depois a página: cabeçalho com números grandes (horas economizadas — "estimativa do autor: 30 min por falha manual", acerto médio, custo total, execuções), aviso "as falhas são plantadas de propósito no SauceDemo; o gabarito está no repositório", tabela de execuções (clique abre o detalhe com cada falha, categoria da IA x gabarito, link da issue). HTML/CSS/JS puros, sem build, legível no celular, tema claro e escuro.
- [ ] **Step 4:** `npx vitest run` → PASS. Gerar um `publicacao/` com 3 resumos de exemplo e abrir `npx serve publicacao` no navegador; conferir no desktop e em 375 px de largura.
- [ ] **Step 5: Commit** `feat: histórico e página de resultados`.

---

### Task 8: GitHub Actions ponta a ponta (repositório privado)

**Files:**
- Create: `.github/workflows/triagem.yml`, `exemplos/usar-na-sua-empresa.yml`

**Interfaces:**
- Consumes: scripts dos Tasks 1–7.
- Produces: workflow com gatilhos `push` (main), `workflow_dispatch` e `schedule: "0 11 * * *"` (08:00 Brasília); `permissions: contents: write, issues: write`; `concurrency` para não rodar duas ao mesmo tempo.

- [ ] **Step 1:** Criar o repositório **privado**: `gh repo create luizhenrisouto/triagem-de-falhas-ia --private --source . --push`. Criar os rótulos `triagem-ia`, `bug_produto`, `teste_quebrado` com `gh label create`.
- [ ] **Step 2:** Pedir ao autor para colar `ANTHROPIC_API_KEY` em Settings → Secrets and variables → Actions (o Claude não manipula a chave). Variável de repositório `MODELO_CLAUDE=claude-opus-5-5`.
- [ ] **Step 3:** Escrever o workflow: checkout → setup-node 22 com cache → `npm ci` → `npx playwright install --with-deps chromium` → testes (`continue-on-error: true`) → `npm run fluxo:montar` → subir n8n em segundo plano (`scripts/subir-n8n.ts`) → `enviar-para-n8n` → resumo no `$GITHUB_STEP_SUMMARY` → checkout de `gh-pages` em `publicacao/` (criar a branch órfã se não existir) → `publicar-historico` → commit/push em `gh-pages` → upload de `test-results/` como artefato (7 dias). O print vai como artefato; a issue linka a execução.
- [ ] **Step 4:** `gh workflow run triagem.yml` e acompanhar com `gh run watch`.
  Expected: job verde; issues de `bug_produto` e `teste_quebrado` criadas com rótulos; nenhuma issue para o instável; `gh-pages` com `dados/indice.json`.
- [ ] **Step 5:** Rodar de novo. Expected: nenhuma issue nova; corpo das existentes com `ocorrencias=2`.
- [ ] **Step 6:** `exemplos/usar-na-sua-empresa.yml`: versão comentada e mínima do workflow para quem já tem testes próprios (troca só o passo de testes e o caminho do relatório; aceita JUnit).
- [ ] **Step 7: Commit** `ci: triagem diária no GitHub Actions`.

---

### Task 9: README, conferência de segurança e publicação

**Files:**
- Create: `README.md`, `docs/diagrama.svg` (ou Mermaid no README), `docs/demo.gif`
- Modify: nenhum código

- [ ] **Step 1:** README conforme o spec §7: resumo em inglês (3 linhas) → problema → solução → GIF → números ao vivo (link da página) → como funciona (diagrama) → como usar na sua empresa (aponta `exemplos/`, segredos, nota sobre n8n próprio hospedado) → ferramentas usadas (n8n, Claude API, Playwright, GitHub Actions/Pages, Claude Code) → aviso das falhas plantadas e do gabarito → autor.
- [ ] **Step 2:** Gravar o GIF (execução → issue aberta → página) com até 15 s.
- [ ] **Step 3: Conferência.** `git log --all -p | grep -inEf .superpowers/termos-proibidos.txt` → nenhuma linha. Revisar `n8n/fluxo.json` por credenciais embutidas.
- [ ] **Step 4:** Mostrar ao autor o README, uma issue e a página local e **pedir o "ok" para publicar**. Só então: `gh repo edit --visibility public --accept-visibility-change-consequences` e ativar Pages na branch `gh-pages` (`gh api -X POST repos/luizhenrisouto/triagem-de-falhas-ia/pages -f "source[branch]=gh-pages" -f "source[path]=/"`).
- [ ] **Step 5:** Abrir a URL do Pages e conferir que carrega com dados reais. Critério do spec: pelo menos 3 execuções; se houver menos, disparar `gh workflow run` até ter 3.
- [ ] **Step 6: Commit** `docs: README com demonstração e guia de uso`.
