# Triagem de falhas de teste com IA (n8n + Claude) — desenho

Data: 2026-11-11 · Autor do projeto: Luiz Henri Souto (GitHub `luizhenrisouto`)

## 1. Intenção e porquê

Peça principal de um portfólio público para o Programa de Estágio GenAI do iFood, trilha **AI Builder**. O formulário de inscrição valoriza, nesta ordem: projetos que combinam prompt engineering, orquestração de agentes, n8n integrando IA a sistemas externos e vibe coding, com **resultado de negócio mensurável**, e soluções **em produção, com números**. Cada caixa que o autor marcar no formulário precisa ter um link que a comprove.

O autor é QA de automação. Hoje, quando um teste automatizado falha, alguém precisa abrir o log, ver o print, decidir se é bug do produto, instabilidade ou teste quebrado e, se for bug, escrever o registro com passos, esperado x obtido e evidência. Este projeto automatiza essa triagem com IA, de forma **genérica**: qualquer empresa liga no próprio CI.

Quem vai olhar: recrutador do iFood. Precisa entender em 30 segundos pelo README (GIF ou vídeo curto + números) e, se quiser, abrir o fluxo do n8n, as issues abertas pela IA e a página de resultados.

## 2. Objetivos

- Uma suíte Playwright pública contra o **SauceDemo** (saucedemo.com), com falhas plantadas cujo gabarito é conhecido:
  - `problem_user` e `error_user` → falhas que são **bug do produto**;
  - `performance_glitch_user` com tempo limite apertado → **teste instável**;
  - um teste com seletor/asserção errada de propósito → **teste quebrado**;
  - testes com `standard_user` que passam (a suíte não é só falha).
- Um **fluxo n8n** que recebe as falhas, chama o Claude para classificar cada uma e:
  - **bug do produto:** abre uma issue no GitHub escrita (título, passos, esperado x obtido, causa provável, print anexado/linkado, link da execução). Se já existe issue aberta para a mesma falha, comenta "ocorreu de novo em <data>" em vez de duplicar;
  - **teste instável:** não abre issue; registra e explica por que é instabilidade;
  - **teste quebrado:** abre issue com rótulo próprio e a correção sugerida para o teste.
- Rodar **no GitHub Actions**: em push, manualmente e **uma vez por dia** (agendado). O n8n sobe dentro do job, importa o fluxo do repositório, processa e desliga. Sem servidor, custo de infraestrutura zero.
- Uma **página de resultados no GitHub Pages** (link público para o formulário) com histórico das execuções: total de testes, falhas, classificação da IA por falha, **acerto da IA contra o gabarito**, tempo de triagem, custo em US$ por execução e links para as issues.
- **Genérico:** a entrada do fluxo é o relatório padrão de testes (JUnit XML; o JSON do Playwright pode ser usado como extra). O README tem uma seção "Como usar na sua empresa" com o webhook, o exemplo de workflow do Actions e os segredos necessários.

## 3. Não-objetivos (fica para depois)

- Testes de API (Restful Booker): opcional, só se sobrar tempo.
- Notificação no Slack ou e-mail: a primeira versão usa issues do GitHub + resumo no próprio job do Actions.
- Integração com Azure DevOps/Jira: o README pode citar como extensão possível, sem implementar.
- n8n hospedado permanentemente (Cloud ou servidor).

## 4. Anti-objetivos (seria fracasso mesmo funcionando)

- Qualquer dado, nome, URL, print ou trecho de código do empregador do autor. Nada do trabalho do autor aparece.
- Números inventados ou inflados. Todo número da página precisa sair das execuções reais; estimativas são rotuladas como estimativa.
- Spam de issues: a execução diária não pode abrir a mesma issue todo dia.
- Chave da API no repositório ou nos logs.
- Um README que só um desenvolvedor entende.

## 5. Como funciona (decidido)

1. **Actions** roda a suíte Playwright (com `retries` ligado, para o próprio Playwright marcar instáveis) e gera JUnit XML + prints + traces. O passo de testes não derruba o job.
2. O job sobe o **n8n** (imagem oficial em container de serviço do runner, ou `npx n8n`; escolha do builder), importa o fluxo versionado em `n8n/` e o ativa.
3. Um script do job envia as falhas para o **webhook** do n8n (uma chamada por execução com a lista de falhas, ou uma por falha; escolha do builder), junto com o link da execução e dos artefatos.
4. O n8n, para cada falha, monta o contexto (nome do teste, erro, stack, trecho do código do teste, se foi marcado instável pelo Playwright) e chama a **API do Claude** pedindo saída estruturada (JSON validado): categoria, confiança, resumo, passos, esperado, obtido, causa provável, sugestão de correção.
5. O n8n abre/comenta issues no GitHub conforme a categoria (com deduplicação por "impressão digital" da falha: arquivo + nome do teste + tipo de erro).
6. O n8n devolve ao job o resultado da triagem com tokens usados; o job grava o histórico (JSON por execução) e publica a página no GitHub Pages.

**Modelo:** `claude-opus-5-5` por padrão, configurável por variável (troca para `claude-haiku-5-5` numa linha). Custo estimado: ~US$ 0,04 por falha triada no Opus. A página mostra o custo real.

**Segredos:** `ANTHROPIC_API_KEY` (o autor cola em Settings → Secrets) e o token do GitHub do próprio Actions para abrir issues.

**Desenvolvimento local:** n8n via `npx n8n` no PC do autor (Windows, Node 24, sem Docker), para editar o fluxo visualmente; o fluxo é exportado em JSON para o repositório.

## 6. Métricas (o "resultado mensurável")

- Por execução: testes, falhas, falhas triadas, distribuição por categoria, acerto contra o gabarito (%), tempo médio de triagem por falha (s), custo (US$).
- Acumulado: execuções diárias, issues abertas x reaproveitadas, acerto médio.
- Comparação "antes x depois": **~30 min por falha na triagem manual** (estimativa do autor a partir da experiência profissional: abrir log e print, reproduzir, decidir a categoria, escrever o registro com evidência; sempre rotulada como estimativa) x tempo medido da triagem automática. A página calcula "horas economizadas" = falhas triadas × 30 min − tempo real da automação.

## 7. Repositório e apresentação

- Repositório público em `github.com/luizhenrisouto`. Nome provisório: `triagem-de-falhas-ia` (decisão do Claude; o autor pode trocar).
- README em português, com resumo curto em inglês no topo. Conteúdo: problema → solução → GIF/vídeo → números ao vivo (link da página) → como funciona (diagrama) → como usar na sua empresa → ferramentas usadas (n8n, Claude, Playwright, GitHub Actions/Pages, vibe coding com Claude Code).
- A página de resultados é estática (HTML/JS lendo os JSON do histórico), sem backend.

## 8. Critérios de pronto

- Execução manual e agendada funcionando no Actions, ponta a ponta, sem passo manual.
- Pelo menos uma issue de bug e uma de teste quebrado abertas pela IA, e uma falha instável corretamente não transformada em issue.
- Segunda execução não duplica issues.
- Página no ar com dados reais de pelo menos 3 execuções.
- README completo com GIF/vídeo e seção "como usar na sua empresa".
- Nenhum segredo ou dado do trabalho do autor no repositório (conferido antes de tornar público).

## 9. Decisões tomadas pelo Claude após a revisão (o autor pode mudar)

- **Instáveis chegam à triagem.** Entrada principal: JSON do Playwright, que traz falhas *e* testes que só passaram na nova tentativa. JUnit XML continua aceito para outras ferramentas (nesse caso só falhas definitivas chegam). O teste de `performance_glitch_user` usa um tempo limite próximo do atraso real, para falhar de forma intermitente de verdade, não sempre.
- **Sem spam de issues.** Uma falha já com issue aberta não gera comentário novo a cada execução: o corpo da issue é atualizado com "última ocorrência" e um contador. Se a issue foi fechada e a falha volta, a issue é reaberta com um comentário "voltou a ocorrer". Vale igual para bug e teste quebrado.
- **Acerto medido com honestidade.** Nomes de testes descrevem o comportamento, nunca a resposta (nada de "teste-quebrado" ou "bug" no nome). A IA recebe só o que um QA receberia: erro, stack, código do teste, print e se passou na nova tentativa. A página e o README dizem com clareza que as falhas foram plantadas de propósito e qual é o gabarito.
- **"Usar na sua empresa" = copiar e configurar.** Entregável: seção do README + um arquivo de workflow do Actions pronto para copiar + o fluxo n8n em JSON + lista de segredos, e uma nota de como apontar para um n8n próprio já hospedado. Action reutilizável fica para depois.
- **Issues ficam no próprio repositório do portfólio**, com rótulos `triagem-ia` + categoria e título prefixado `[SauceDemo]`. Elas são a prova visível do sistema funcionando; usa o `GITHUB_TOKEN` do Actions, sem token extra.

## 10. Deixado ao builder

Estrutura de pastas, linguagem dos scripts auxiliares (Node/TS preferível, para ficar junto do Playwright), forma exata de subir o n8n no Actions, desenho dos nós do n8n, prompt do Claude (desde que versionado no repositório e legível), esquema do JSON de saída, visual da página de resultados (limpo e legível no celular), quantidade exata de testes (sugestão: 10 a 15).
