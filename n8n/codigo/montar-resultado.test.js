import { describe, expect, test } from "vitest";
import { montarResultado } from "./montar-resultado.js";

const decisao = {
  falha: { id: "abc123def456", titulo: "x > y > z" },
  triagem: { categoria: "bug_produto" },
  erroTriagem: null,
  tokensEntrada: 1000,
  tokensSaida: 200,
  custoUsd: 0.008,
  duracaoTriagemMs: 1500,
};

describe("montarResultado", () => {
  test("issue criada leva o link da issue", () => {
    const r = montarResultado(decisao, "criada", { html_url: "https://github.com/o/r/issues/1" });
    expect(r).toEqual({
      falhaId: "abc123def456",
      titulo: "x > y > z",
      triagem: { categoria: "bug_produto" },
      erroTriagem: null,
      acaoIssue: "criada",
      issueUrl: "https://github.com/o/r/issues/1",
      erroIssue: null,
      tokensEntrada: 1000,
      tokensSaida: 200,
      custoUsd: 0.008,
      duracaoTriagemMs: 1500,
    });
  });

  test("sem ação de issue: nenhuma, sem link", () => {
    const r = montarResultado(decisao, "nenhuma", null);
    expect(r.acaoIssue).toBe("nenhuma");
    expect(r.issueUrl).toBeNull();
    expect(r.erroIssue).toBeNull();
  });

  test("GitHub respondeu com erro: ação vira nenhuma e o erro é registrado", () => {
    const r = montarResultado(decisao, "criada", { error: { message: "Bad credentials" } });
    expect(r.acaoIssue).toBe("nenhuma");
    expect(r.issueUrl).toBeNull();
    expect(r.erroIssue).toContain("Bad credentials");
  });

  test("print não volta no resultado", () => {
    const r = montarResultado({ ...decisao, falha: { ...decisao.falha, printBase64: "AAAA" } }, "nenhuma", null);
    expect(JSON.stringify(r)).not.toContain("AAAA");
  });
});
