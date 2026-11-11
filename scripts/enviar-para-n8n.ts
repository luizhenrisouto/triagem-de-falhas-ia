/**
 * Lê o relatório de testes, envia as falhas ao webhook do n8n e grava o resumo da execução.
 * Uso: npx tsx scripts/enviar-para-n8n.ts --relatorio relatorios/resultado.json --saida relatorios/resumo.json
 * Aceita o JSON do Playwright ou um JUnit XML (extensão .xml).
 * Variáveis: N8N_URL, MODELO_IA (padrão gemini-3.8-flash; claude-* usa o Claude), GITHUB_RUN_ID, GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_SHA.
 */
import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import { lerRelatorioPlaywright } from "../src/coleta/ler-playwright";
import { lerRelatorioJunit } from "../src/coleta/ler-junit";
import { calcularResumo } from "../src/metricas/calcular";
import type { Execucao, ResultadoTriagem, ResumoExecucao } from "../src/metricas/tipos";

type Opcoes = {
  relatorio: string;
  saida: string;
  raiz: string;
  env: Record<string, string | undefined>;
  fetchFn?: typeof fetch;
};

const LIMITE_ENVIO_MS = 10 * 60 * 1000;

function contarTestes(relatorio: string): { totalTestes: number; aprovados: number } {
  if (relatorio.endsWith(".xml")) {
    const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" }).parse(fs.readFileSync(relatorio, "utf8"));
    const raiz = xml.testsuites ?? xml.testsuite ?? {};
    const total = Number(raiz.tests ?? 0);
    return { totalTestes: total, aprovados: total - Number(raiz.failures ?? 0) - Number(raiz.errors ?? 0) - Number(raiz.skipped ?? 0) };
  }
  const s = JSON.parse(fs.readFileSync(relatorio, "utf8")).stats ?? {};
  const n = (k: string) => Number(s[k] ?? 0);
  return { totalTestes: n("expected") + n("unexpected") + n("flaky") + n("skipped"), aprovados: n("expected") };
}

function montarExecucao(env: Opcoes["env"]): Execucao {
  const agora = new Date();
  const id = env.GITHUB_RUN_ID ?? `local-${agora.getTime()}`;
  const url = env.GITHUB_RUN_ID
    ? `${env.GITHUB_SERVER_URL ?? "https://github.com"}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
    : "";
  const data = agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  return { id, url, data, dataIso: agora.toISOString(), commit: env.GITHUB_SHA ?? "" };
}

export async function executarEnvio(o: Opcoes): Promise<ResumoExecucao> {
  const fetchFn = o.fetchFn ?? fetch;
  const falhas = o.relatorio.endsWith(".xml") ? lerRelatorioJunit(o.relatorio, o.raiz) : lerRelatorioPlaywright(o.relatorio, o.raiz);
  const gabaritoArq = path.join(o.raiz, "testes/gabarito.json");
  const gabarito = fs.existsSync(gabaritoArq) ? JSON.parse(fs.readFileSync(gabaritoArq, "utf8")) : {};
  const execucao = montarExecucao(o.env);
  const modelo = o.env.MODELO_IA || "gemini-3.8-flash";
  const base = { execucao, modelo, gabarito, ...contarTestes(o.relatorio) };
  const gravar = (resultados: ResultadoTriagem[]) => {
    const resumo = calcularResumo({ ...base, resultados });
    fs.mkdirSync(path.dirname(o.saida), { recursive: true });
    fs.writeFileSync(o.saida, JSON.stringify(resumo, null, 2));
    return resumo;
  };

  if (falhas.length === 0) return gravar([]);

  const { dataIso, commit, ...execucaoParaN8n } = execucao;
  let resultados: ResultadoTriagem[];
  try {
    const resposta = await fetchFn(`${o.env.N8N_URL ?? "http://127.0.0.1:5678"}/webhook/triagem`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        execucao: execucaoParaN8n,
        repositorio: o.env.GITHUB_REPOSITORY,
        modelo,
        promptSistema: fs.readFileSync(path.join(o.raiz, "prompts/triagem.md"), "utf8"),
        falhas,
      }),
      signal: AbortSignal.timeout(LIMITE_ENVIO_MS),
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}: ${await resposta.text()}`);
    resultados = ((await resposta.json()) as { resultados: ResultadoTriagem[] }).resultados;
  } catch (e) {
    gravar([]);
    throw new Error(`Falha ao enviar para o n8n: ${(e as Error).message}`);
  }
  return gravar(resultados);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const arg = (nome: string, padrao: string) => {
    const i = process.argv.indexOf(`--${nome}`);
    return i > 0 ? process.argv[i + 1] : padrao;
  };
  const raiz = path.resolve(__dirname, "..");
  executarEnvio({
    relatorio: path.resolve(arg("relatorio", "relatorios/resultado.json")),
    saida: path.resolve(arg("saida", "relatorios/resumo.json")),
    raiz,
    env: process.env,
  })
    .then((r) => console.log(`Triagem: ${r.falhas} falhas, acerto ${r.acertoGabaritoPct ?? "-"}%, custo US$ ${r.custoUsd.toFixed(4)}`))
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
