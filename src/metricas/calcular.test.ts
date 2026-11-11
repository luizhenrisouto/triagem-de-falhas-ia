import { describe, expect, test } from "vitest";
import { calcularResumo } from "./calcular";
import type { ResultadoTriagem } from "./tipos";

const execucao = { id: "7", url: "https://x/7", data: "12/11/2026 08:00", dataIso: "2026-11-12T11:00:00.000Z", commit: "abc" };

let seq = 0;
function resultado(categoria: string | null, extra: Partial<ResultadoTriagem> = {}): ResultadoTriagem {
  seq++;
  return {
    falhaId: `id${seq}`,
    titulo: `t${seq}`,
    triagem: categoria ? ({ categoria } as any) : null,
    erroTriagem: categoria ? null : "erro",
    acaoIssue: "nenhuma",
    issueUrl: null,
    erroIssue: null,
    tokensEntrada: 100,
    tokensSaida: 10,
    custoUsd: 0.01,
    duracaoTriagemMs: 1000,
    ...extra,
  };
}
const base = { execucao, modelo: "claude-opus-5-5", totalTestes: 9, aprovados: 5, gabarito: {} as Record<string, string> };

describe("calcularResumo", () => {
  test("acerto contra o gabarito considera só falhas com gabarito", () => {
    const rs = [resultado("bug_produto"), resultado("bug_produto"), resultado("teste_quebrado"), resultado("teste_instavel"), resultado("bug_produto")];
    const gabarito = { t1: "bug_produto", t2: "bug_produto", t3: "teste_quebrado", t4: "bug_produto" } as Record<string, string>;
    const gab = Object.fromEntries(Object.entries(gabarito).map(([k, v], i) => [rs[i].titulo, v]));
    const r = calcularResumo({ ...base, resultados: rs, gabarito: gab });
    expect(r.acertoGabaritoPct).toBe(75);
  });

  test("falha com erroTriagem conta como erro, não como acerto", () => {
    const rs = [resultado(null), resultado("bug_produto")];
    const r = calcularResumo({ ...base, resultados: rs, gabarito: { [rs[0].titulo]: "bug_produto", [rs[1].titulo]: "bug_produto" } });
    expect(r.acertoGabaritoPct).toBe(50);
  });

  test("minutos economizados usam 30 min por falha triada", () => {
    const r = calcularResumo({ ...base, resultados: [resultado("bug_produto", { duracaoTriagemMs: 60_000 }), resultado("bug_produto", { duracaoTriagemMs: 30_000 }), resultado(null)] });
    expect(r.minutosManuaisEstimados).toBe(60);
    expect(r.minutosEconomizados).toBeCloseTo(60 - 1.5);
  });

  test("contagens, custo, tempo médio e issues", () => {
    const rs = [
      resultado("bug_produto", { acaoIssue: "criada", custoUsd: 0.02, duracaoTriagemMs: 2000 }),
      resultado("teste_quebrado", { acaoIssue: "atualizada", custoUsd: 0.01, duracaoTriagemMs: 4000 }),
      resultado("teste_instavel", { acaoIssue: "nenhuma", custoUsd: 0.01, duracaoTriagemMs: 3000 }),
      resultado("bug_produto", { acaoIssue: "reaberta", custoUsd: 0.01, duracaoTriagemMs: 3000 }),
    ];
    const r = calcularResumo({ ...base, resultados: rs });
    expect(r.falhas).toBe(4);
    expect(r.totalTestes).toBe(9);
    expect(r.aprovados).toBe(5);
    expect(r.porCategoria).toEqual({ bug_produto: 2, teste_instavel: 1, teste_quebrado: 1 });
    expect(r.custoUsd).toBeCloseTo(0.05);
    expect(r.duracaoMediaTriagemMs).toBe(3000);
    expect(r.issues).toEqual({ criadas: 1, atualizadas: 1, reabertas: 1 });
    expect(r.acertoGabaritoPct).toBeNull();
    expect(r.id).toBe("7");
    expect(r.data).toBe(execucao.dataIso);
  });

  test("sem falhas: zeros e nulos", () => {
    const r = calcularResumo({ ...base, aprovados: 9, resultados: [] });
    expect(r.falhas).toBe(0);
    expect(r.acertoGabaritoPct).toBeNull();
    expect(r.duracaoMediaTriagemMs).toBeNull();
    expect(r.custoUsd).toBe(0);
    expect(r.minutosEconomizados).toBe(0);
  });
});
