/**
 * Vigia da triagem: roda de hora em hora (workflow vigia.yml) e garante que nada fica parado sem ninguém saber.
 * - Execução presa na fila há mais de 30 min: cancela e dispara outra.
 * - Execução rodando há mais de 60 min (acima do limite dos jobs): cancela, dispara outra e alerta.
 * - Última execução falhou, ou nenhuma deu certo nas últimas 26 h: abre/atualiza uma issue de alerta.
 * - Tudo voltou ao normal: comenta e fecha a issue de alerta.
 * Sem dependências: só Node 24 e a API do GitHub.
 * Uso: GITHUB_TOKEN=... GITHUB_REPOSITORY=dono/repo node scripts/vigia.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIMITE_FILA_MIN = 30;
const LIMITE_RODANDO_MIN = 60;
const LIMITE_SEM_SUCESSO_H = 26;
const WORKFLOW = "triagem.yml";

const minutosDesde = (iso, agora) => Math.round((agora.getTime() - new Date(iso).getTime()) / 60_000);

/** Decide o que fazer a partir das execuções recentes (mais novas primeiro). Função pura, testada. */
export function decidirVigia(execucoes, agora) {
  const cancelar = [];
  const alertas = [];
  for (const r of execucoes) {
    const idade = minutosDesde(r.created_at, agora);
    if ((r.status === "queued" || r.status === "waiting" || r.status === "pending") && idade > LIMITE_FILA_MIN) cancelar.push(r.id);
    if (r.status === "in_progress" && idade > LIMITE_RODANDO_MIN) {
      cancelar.push(r.id);
      alertas.push(`A execução ${r.html_url} estava rodando havia ${idade} min, acima do limite; foi cancelada e disparada de novo.`);
    }
  }
  const ativasSaudaveis = execucoes.filter((r) => r.status !== "completed" && !cancelar.includes(r.id));
  const redisparar = execucoes.length === 0 || (cancelar.length > 0 && ativasSaudaveis.length === 0);

  if (execucoes.length === 0) alertas.push("Nenhuma execução da triagem encontrada.");
  const concluidas = execucoes.filter((r) => r.status === "completed" && r.conclusion !== "cancelled" && r.conclusion !== "skipped");
  const ultima = concluidas[0];
  if (ultima && ultima.conclusion !== "success") alertas.push(`A última execução falhou (${ultima.conclusion}): ${ultima.html_url}`);
  const ultimoSucesso = concluidas.find((r) => r.conclusion === "success");
  if (execucoes.length > 0 && (!ultimoSucesso || minutosDesde(ultimoSucesso.created_at, agora) > LIMITE_SEM_SUCESSO_H * 60)) {
    alertas.push(`Nenhuma execução com sucesso nas últimas ${LIMITE_SEM_SUCESSO_H} h.`);
  }
  return { cancelar, redisparar, alerta: alertas.length ? alertas.join("\n") : null };
}

async function github(caminho, { metodo = "GET", corpo } = {}) {
  const r = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "triagem-de-falhas-ia-vigia",
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  return { ok: r.ok, status: r.status, json: texto ? JSON.parse(texto) : null };
}

async function executar() {
  const agora = new Date();
  const { json } = await github(`/actions/workflows/${WORKFLOW}/runs?per_page=20`);
  const execucoes = json?.workflow_runs ?? [];
  const decisao = decidirVigia(execucoes, agora);
  console.log(JSON.stringify(decisao));

  for (const id of decisao.cancelar) {
    const r = await github(`/actions/runs/${id}/cancel`, { metodo: "POST" });
    if (!r.ok) await github(`/actions/runs/${id}/force-cancel`, { metodo: "POST" });
    console.log(`Cancelada (ou tentativa de cancelar) a execução ${id}: HTTP ${r.status}`);
  }
  if (decisao.redisparar) {
    const repo = await github("");
    const r = await github(`/actions/workflows/${WORKFLOW}/dispatches`, { metodo: "POST", corpo: { ref: repo.json.default_branch } });
    console.log(`Nova execução disparada: HTTP ${r.status}`);
  }

  const abertas = (await github("/issues?labels=vigia&state=open&per_page=10")).json ?? [];
  if (decisao.alerta) {
    const texto = `${decisao.alerta}\n\nVerificado pelo vigia em ${agora.toISOString()}.`;
    if (abertas[0]) await github(`/issues/${abertas[0].number}/comments`, { metodo: "POST", corpo: { body: texto } });
    else await github("/issues", { metodo: "POST", corpo: { title: "Vigia: a triagem precisa de atenção", body: texto, labels: ["vigia"] } });
  } else {
    for (const i of abertas) {
      await github(`/issues/${i.number}/comments`, { metodo: "POST", corpo: { body: "A triagem voltou a rodar normalmente. Fechando o alerta." } });
      await github(`/issues/${i.number}`, { metodo: "PATCH", corpo: { state: "closed" } });
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  executar().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
