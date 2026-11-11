import { describe, expect, test } from "vitest";
import { decidirAcaoIssue } from "./decidir-acao-issue.js";
import { renderizarIssue, lerOcorrencias } from "./renderizar-issue.js";

const f = { id: "abc123def456", titulo: "checkout.spec.ts > Checkout > finalizar compra conclui o pedido" };
const t = {
  categoria: "bug_produto",
  confianca: 0.82,
  resumo: "Botão Finalizar não conclui o pedido",
  passos: ["Entrar", "Adicionar produto", "Clicar em Finalizar"],
  esperado: "Confirmação do pedido",
  obtido: "Nada acontece",
  causaProvavel: "Erro de JavaScript no clique",
  sugestaoCorrecao: "Verificar o handler do botão",
};
const execucao = { id: "42", url: "https://github.com/o/r/actions/runs/42", data: "2026-11-12" };

describe("decidirAcaoIssue", () => {
  test("teste_instavel nunca gera issue", () => {
    expect(decidirAcaoIssue(f, { ...t, categoria: "teste_instavel" }, [])).toEqual({ acao: "nenhuma", numero: null });
  });
  test("triagem nula não gera issue", () => {
    expect(decidirAcaoIssue(f, null, []).acao).toBe("nenhuma");
  });
  test("sem issue com a mesma impressão digital: criar", () => {
    const outra = [{ number: 3, state: "open", body: "<!-- triagem-ia:fp=ffffffffffff -->" }];
    expect(decidirAcaoIssue(f, t, outra)).toEqual({ acao: "criar", numero: null });
  });
  test("issue aberta com o marcador: atualizar", () => {
    const ex = [{ number: 7, state: "open", body: `x\n<!-- triagem-ia:fp=${f.id} -->` }];
    expect(decidirAcaoIssue(f, t, ex)).toEqual({ acao: "atualizar", numero: 7 });
  });
  test("issue fechada com o marcador: reabrir", () => {
    const ex = [{ number: 9, state: "closed", body: `<!-- triagem-ia:fp=${f.id} -->` }];
    expect(decidirAcaoIssue(f, t, ex)).toEqual({ acao: "reabrir", numero: 9 });
  });
  test("entre aberta e fechada com o mesmo marcador, prefere a aberta", () => {
    const ex = [
      { number: 9, state: "closed", body: `<!-- triagem-ia:fp=${f.id} -->` },
      { number: 12, state: "open", body: `<!-- triagem-ia:fp=${f.id} -->` },
    ];
    expect(decidirAcaoIssue(f, t, ex)).toEqual({ acao: "atualizar", numero: 12 });
  });
  test("corpo nulo nas issues existentes não quebra", () => {
    expect(decidirAcaoIssue(f, t, [{ number: 1, state: "open", body: null }]).acao).toBe("criar");
  });
});

describe("renderizarIssue", () => {
  test("título, marcadores, contador, última ocorrência e rótulos", () => {
    const { titulo, corpo, rotulos } = renderizarIssue(f, t, execucao, 2);
    expect(titulo).toBe("[SauceDemo] Botão Finalizar não conclui o pedido");
    expect(corpo).toContain(`<!-- triagem-ia:fp=${f.id} -->`);
    expect(corpo).toContain("<!-- triagem-ia:ocorrencias=3 -->");
    expect(corpo).toContain("Última ocorrência: 2026-11-12");
    expect(corpo).toContain(execucao.url);
    expect(corpo).toContain("1. Entrar");
    expect(corpo).toContain("82%");
    expect(corpo).toMatch(/plantada de propósito/);
    expect(rotulos).toEqual(["triagem-ia", "bug_produto"]);
    expect(lerOcorrencias(corpo)).toBe(3);
  });

  test("primeira ocorrência conta 1", () => {
    expect(lerOcorrencias(renderizarIssue(f, t, execucao, 0).corpo)).toBe(1);
  });

  test("teste_quebrado inclui a sugestão de correção do teste", () => {
    const { corpo, rotulos } = renderizarIssue(f, { ...t, categoria: "teste_quebrado" }, execucao, 0);
    expect(corpo).toContain("Verificar o handler do botão");
    expect(corpo).toMatch(/Correção sugerida para o teste/);
    expect(rotulos).toEqual(["triagem-ia", "teste_quebrado"]);
  });

  test("lerOcorrencias sem marcador devolve 0", () => {
    expect(lerOcorrencias("corpo qualquer")).toBe(0);
    expect(lerOcorrencias(null)).toBe(0);
  });
});
