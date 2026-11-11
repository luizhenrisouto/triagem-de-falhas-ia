import { describe, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { publicarHistorico } from "./publicar-historico";
import type { ResumoExecucao } from "../src/metricas/tipos";

const RAIZ = path.resolve(__dirname, "..");

function resumo(id: string, data: string, extra: Partial<ResumoExecucao> = {}): ResumoExecucao {
  return {
    id, data, url: `https://x/${id}`, commit: "c", modelo: "claude-opus-5-5",
    totalTestes: 9, aprovados: 5, falhas: 4,
    porCategoria: { bug_produto: 2, teste_instavel: 1, teste_quebrado: 1 },
    acertoGabaritoPct: 100, acertosGabarito: 4, totalComGabarito: 4, idsTriados: ["a", "b", "c", "d"],
    duracaoMediaTriagemMs: 3000, custoUsd: 0.1, custoIncompleto: false,
    minutosManuaisEstimados: 120, minutosEconomizados: 119.8,
    issues: { criadas: 3, atualizadas: 0, reabertas: 0 },
    resultados: [{ falhaId: "a", titulo: "t", triagem: null, erroTriagem: null, acaoIssue: "nenhuma", issueUrl: null, erroIssue: null, tokensEntrada: 1, tokensSaida: 1, custoUsd: 0, duracaoTriagemMs: 0 }],
    ...extra,
  };
}

function preparar(resumos: ResumoExecucao[]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pub-"));
  const destino = path.join(dir, "publicacao");
  for (const r of resumos) {
    const arq = path.join(dir, `${r.id}.json`);
    fs.writeFileSync(arq, JSON.stringify(r));
    publicarHistorico({ resumo: arq, destino, raiz: RAIZ });
  }
  const indice = JSON.parse(fs.readFileSync(path.join(destino, "dados/indice.json"), "utf8"));
  return { destino, indice };
}

describe("publicarHistorico", () => {
  test("primeira execução cria índice, detalhe e copia o site", () => {
    const { destino, indice } = preparar([resumo("1", "2026-11-12T11:00:00.000Z")]);
    expect(indice.execucoes).toHaveLength(1);
    expect(indice.execucoes[0].resultados).toBeUndefined();
    expect(fs.existsSync(path.join(destino, "dados/execucoes/1.json"))).toBe(true);
    expect(fs.existsSync(path.join(destino, "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(destino, ".nojekyll"))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(destino, "dados/gabarito.json"), "utf8"))).toEqual(
      JSON.parse(fs.readFileSync(path.join(RAIZ, "testes/gabarito.json"), "utf8")),
    );
  });

  test("adiciona execuções, ordena da mais nova e recalcula totais", () => {
    const { indice } = preparar([
      resumo("1", "2026-11-12T11:00:00.000Z"),
      resumo("2", "2026-11-14T11:00:00.000Z", { acertoGabaritoPct: 80, acertosGabarito: 4, totalComGabarito: 5, issues: { criadas: 0, atualizadas: 3, reabertas: 0 } }),
      resumo("3", "2026-11-13T11:00:00.000Z", { acertoGabaritoPct: 60, acertosGabarito: 3, totalComGabarito: 5, issues: { criadas: 1, atualizadas: 2, reabertas: 1 } }),
    ]);
    expect(indice.execucoes.map((e: any) => e.id)).toEqual(["2", "3", "1"]);
    expect(indice.totais.execucoes).toBe(3);
    expect(indice.totais.falhasTriadas).toBe(12);
    // acerto somado sobre todas as falhas com gabarito: 11 de 14
    expect(indice.totais.acertoMedioPct).toBe(79);
    expect(indice.totais.custoTotalUsd).toBeCloseTo(0.3);
    // as mesmas 4 falhas nas 3 execuções contam 30 min uma vez só; o tempo da automação soma tudo
    expect(indice.totais.falhasDistintas).toBe(4);
    expect(indice.totais.horasEconomizadas).toBeCloseTo((4 * 30 - 3 * 0.2) / 60);
    expect(indice.totais.custoIncompleto).toBe(false);
    expect(indice.totais.issuesAbertas).toBe(4);
  });

  test("falhas sem triagem não contam como triadas", () => {
    const { indice } = preparar([resumo("1", "2026-11-12T11:00:00.000Z", { falhas: 5 })]);
    expect(indice.totais.falhasTriadas).toBe(4);
  });

  test("mesma execução publicada duas vezes não duplica", () => {
    const { indice } = preparar([resumo("1", "2026-11-12T11:00:00.000Z"), resumo("1", "2026-11-12T11:00:00.000Z")]);
    expect(indice.execucoes).toHaveLength(1);
    expect(indice.totais.execucoes).toBe(1);
  });

  test("execução sem falhas entra com acerto null e não derruba a média", () => {
    const { indice } = preparar([
      resumo("1", "2026-11-12T11:00:00.000Z", { acertoGabaritoPct: 100 }),
      resumo("2", "2026-11-13T11:00:00.000Z", { falhas: 0, acertoGabaritoPct: null, acertosGabarito: 0, totalComGabarito: 0, idsTriados: [], resultados: [], minutosManuaisEstimados: 0, minutosEconomizados: 0, custoUsd: 0 }),
    ]);
    expect(indice.totais.acertoMedioPct).toBe(100);
    expect(indice.totais.execucoes).toBe(2);
  });
});
