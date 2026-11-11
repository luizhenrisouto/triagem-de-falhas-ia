import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { montarFluxo } from "./montar-fluxo";

const RAIZ = path.resolve(__dirname, "..");

describe("montarFluxo", () => {
  const fluxo = montarFluxo(RAIZ);
  const texto = JSON.stringify(fluxo);

  test("não sobra nenhum marcador", () => {
    expect(texto).not.toMatch(/\{\{(CODIGO|HEADERS_GITHUB|REGRAS_SWITCH)/);
    expect(texto).not.toContain("ACAO_REALIZADA");
  });

  test("cada nó Code traz as bibliotecas e o próprio código", () => {
    const codes = fluxo.nodes.filter((n: any) => n.type === "n8n-nodes-base.code");
    expect(codes).toHaveLength(8);
    for (const n of codes) expect(n.parameters.jsCode).toContain("function montarRequisicaoGemini(");
    for (const n of codes) {
      expect(n.parameters.jsCode).toContain("function montarResultado(");
      expect(n.parameters.jsCode).toContain("function custoUsd(");
    }
    const criada = fluxo.nodes.find((n: any) => n.name === "Registrar criada");
    expect(criada.parameters.jsCode).toContain('const acao = "criada"');
  });

  test("headers do GitHub usam o token do ambiente", () => {
    const listar = fluxo.nodes.find((n: any) => n.name === "GitHub: listar issues");
    const nomes = listar.parameters.headerParameters.parameters.map((h: any) => h.name);
    expect(nomes).toEqual(["Authorization", "Accept", "X-GitHub-Api-Version", "User-Agent"]);
    expect(listar.parameters.headerParameters.parameters[0].value).toBe("=Bearer {{ $env.GITHUB_TOKEN }}");
  });

  test("Switch tem as quatro saídas na ordem das conexões", () => {
    const sw = fluxo.nodes.find((n: any) => n.name === "Qual ação?");
    expect(sw.parameters.rules.values.map((r: any) => r.outputKey)).toEqual(["criar", "atualizar", "reabrir", "nenhuma"]);
  });

  test("nenhuma chave de API no fluxo gerado", () => {
    expect(texto).not.toMatch(/sk-ant-|ghp_|gho_|github_pat_/);
  });

  test("o n8n/fluxo.json versionado está sincronizado com o código", () => {
    const versionado = JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n/fluxo.json"), "utf8"));
    expect(versionado).toEqual(fluxo);
  });
});
