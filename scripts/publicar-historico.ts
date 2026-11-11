/**
 * Acrescenta o resumo de uma execução ao histórico publicado (branch gh-pages) e copia a página.
 * Uso: npx tsx scripts/publicar-historico.ts --resumo relatorios/resumo.json --destino publicacao/
 */
import fs from "node:fs";
import path from "node:path";
import { MINUTOS_MANUAIS_POR_FALHA, type ResumoExecucao } from "../src/metricas/tipos";

type ExecucaoNoIndice = Omit<ResumoExecucao, "resultados">;
export type Indice = {
  atualizadoEm: string;
  totais: {
    execucoes: number;
    falhasTriadas: number;
    falhasDistintas: number;
    acertoMedioPct: number | null;
    custoTotalUsd: number;
    custoIncompleto: boolean;
    horasEconomizadas: number;
    issuesAbertas: number;
  };
  execucoes: ExecucaoNoIndice[];
};

function calcularTotais(execucoes: ExecucaoNoIndice[]): Indice["totais"] {
  const soma = (f: (e: ExecucaoNoIndice) => number) => execucoes.reduce((s, e) => s + f(e), 0);
  const acertos = soma((e) => e.acertosGabarito ?? 0);
  const comGabarito = soma((e) => e.totalComGabarito ?? 0);
  // Uma falha que se repete em vários dias é triada à mão uma vez: os 30 min contam uma vez por falha distinta.
  const distintas = new Set(execucoes.flatMap((e) => e.idsTriados ?? [])).size;
  const minutosAutomacao = soma((e) => e.minutosManuaisEstimados - e.minutosEconomizados);
  return {
    execucoes: execucoes.length,
    falhasTriadas: soma((e) => Object.values(e.porCategoria).reduce((a, b) => a + b, 0)),
    falhasDistintas: distintas,
    acertoMedioPct: comGabarito ? Math.round((acertos / comGabarito) * 100) : null,
    custoTotalUsd: soma((e) => e.custoUsd),
    custoIncompleto: execucoes.some((e) => e.custoIncompleto),
    horasEconomizadas: (distintas * MINUTOS_MANUAIS_POR_FALHA - minutosAutomacao) / 60,
    issuesAbertas: soma((e) => e.issues.criadas),
  };
}

export function publicarHistorico(o: { resumo: string; destino: string; raiz: string }): Indice {
  const resumo: ResumoExecucao = JSON.parse(fs.readFileSync(o.resumo, "utf8"));
  const dirDados = path.join(o.destino, "dados");
  fs.mkdirSync(path.join(dirDados, "execucoes"), { recursive: true });
  fs.writeFileSync(path.join(dirDados, "execucoes", `${resumo.id}.json`), JSON.stringify(resumo, null, 2));

  const arqIndice = path.join(dirDados, "indice.json");
  const anteriores: ExecucaoNoIndice[] = fs.existsSync(arqIndice) ? JSON.parse(fs.readFileSync(arqIndice, "utf8")).execucoes : [];
  const { resultados, ...semResultados } = resumo;
  const execucoes = [...anteriores.filter((e) => e.id !== resumo.id), semResultados].sort((a, b) => (a.data < b.data ? 1 : -1));
  const indice: Indice = { atualizadoEm: new Date().toISOString(), totais: calcularTotais(execucoes), execucoes };
  fs.writeFileSync(arqIndice, JSON.stringify(indice, null, 2));

  for (const arq of fs.readdirSync(path.join(o.raiz, "site"))) {
    fs.copyFileSync(path.join(o.raiz, "site", arq), path.join(o.destino, arq));
  }
  fs.writeFileSync(path.join(o.destino, ".nojekyll"), "");
  const gabarito = path.join(o.raiz, "testes/gabarito.json");
  if (fs.existsSync(gabarito)) fs.copyFileSync(gabarito, path.join(dirDados, "gabarito.json"));
  return indice;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const arg = (nome: string, padrao: string) => {
    const i = process.argv.indexOf(`--${nome}`);
    return i > 0 ? process.argv[i + 1] : padrao;
  };
  const indice = publicarHistorico({
    resumo: path.resolve(arg("resumo", "relatorios/resumo.json")),
    destino: path.resolve(arg("destino", "publicacao")),
    raiz: path.resolve(__dirname, ".."),
  });
  console.log(`Histórico com ${indice.totais.execucoes} execuções.`);
}
