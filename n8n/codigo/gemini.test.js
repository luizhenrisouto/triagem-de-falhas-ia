import { describe, expect, test } from "vitest";
import { montarRequisicaoGemini } from "./montar-requisicao-gemini.js";
import { interpretarRespostaGemini } from "./interpretar-resposta-gemini.js";
import { provedorDoModelo } from "./provedor.js";
import { custoUsd } from "./precos.js";

const falha = {
  id: "abc123def456",
  titulo: "checkout.spec.ts > Checkout > finalizar compra conclui o pedido",
  arquivo: "checkout.spec.ts",
  linha: 38,
  erro: "Error: expect(locator).toHaveText(expected) failed",
  stack: "at checkout.spec.ts:38:61",
  trechoCodigo: "> 38 | await expect(...)",
  passouNaNovaTentativa: false,
  tentativas: 1,
  duracaoMs: 7000,
  printBase64: "iVBORw==",
};
const triagemOk = {
  categoria: "teste_quebrado",
  confianca: 0.7,
  resumo: "Seletor inexistente",
  passos: ["a"],
  esperado: "e",
  obtido: "o",
  causaProvavel: "c",
  sugestaoCorrecao: "s",
};
const respostaOk = {
  candidates: [{ content: { parts: [{ text: JSON.stringify(triagemOk) }] }, finishReason: "STOP" }],
  usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 150, thoughtsTokenCount: 50 },
};
const ctx = { modelo: "gemini-3.8-flash", inicioMs: 0, fimMs: 2000 };

describe("provedorDoModelo", () => {
  test("gemini-* é Gemini, claude-* é Claude", () => {
    expect(provedorDoModelo("gemini-3.8-flash")).toBe("gemini");
    expect(provedorDoModelo("claude-opus-5-5")).toBe("claude");
  });
});

describe("montarRequisicaoGemini", () => {
  const r = montarRequisicaoGemini(falha, { promptSistema: "P", modelo: "gemini-3.8-flash" });

  test("instrução de sistema, JSON estruturado e pensamento baixo", () => {
    expect(r.systemInstruction).toEqual({ parts: [{ text: "P" }] });
    expect(r.generationConfig.responseMimeType).toBe("application/json");
    expect(r.generationConfig.responseJsonSchema.properties.categoria.enum).toEqual(["bug_produto", "teste_instavel", "teste_quebrado"]);
    expect(r.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "LOW" });
    expect(r.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(2000);
  });

  test("print vai como inline_data antes do texto", () => {
    const partes = r.contents[0].parts;
    expect(r.contents[0].role).toBe("user");
    expect(partes[0]).toEqual({ inline_data: { mime_type: "image/png", data: "iVBORw==" } });
    expect(partes[1].text).toContain(falha.erro);
  });

  test("sem print, só texto", () => {
    const sem = montarRequisicaoGemini({ ...falha, printBase64: null }, { promptSistema: "P", modelo: "gemini-3.8-flash" });
    expect(sem.contents[0].parts).toHaveLength(1);
  });
});

describe("interpretarRespostaGemini", () => {
  test("resposta válida vira triagem; tokens de pensamento contam na saída; custo zero no gratuito", () => {
    const r = interpretarRespostaGemini(respostaOk, ctx);
    expect(r.triagem).toEqual(triagemOk);
    expect(r.erroTriagem).toBeNull();
    expect(r.tokensEntrada).toBe(900);
    expect(r.tokensSaida).toBe(200);
    expect(r.custoUsd).toBe(0);
    expect(r.duracaoTriagemMs).toBe(2000);
  });

  test("ignora partes de pensamento e usa o texto final", () => {
    const resp = { ...respostaOk, candidates: [{ ...respostaOk.candidates[0], content: { parts: [{ thought: true, text: "pensando" }, { text: JSON.stringify(triagemOk) }] } }] };
    expect(interpretarRespostaGemini(resp, ctx).triagem).toEqual(triagemOk);
  });

  test("prompt bloqueado vira erroTriagem", () => {
    const r = interpretarRespostaGemini({ promptFeedback: { blockReason: "SAFETY" }, usageMetadata: {} }, ctx);
    expect(r.triagem).toBeNull();
    expect(r.erroTriagem).toMatch(/bloque/i);
  });

  test("finishReason diferente de STOP vira erroTriagem", () => {
    const r = interpretarRespostaGemini({ ...respostaOk, candidates: [{ ...respostaOk.candidates[0], finishReason: "MAX_TOKENS" }] }, ctx);
    expect(r.erroTriagem).toContain("MAX_TOKENS");
  });

  test("JSON inválido e categoria inválida viram erroTriagem", () => {
    const comTexto = (t) => ({ ...respostaOk, candidates: [{ content: { parts: [{ text: t }] }, finishReason: "STOP" }] });
    expect(interpretarRespostaGemini(comTexto("oi"), ctx).erroTriagem).toMatch(/json/i);
    expect(interpretarRespostaGemini(comTexto(JSON.stringify({ ...triagemOk, categoria: "x" })), ctx).erroTriagem).toMatch(/categoria/i);
  });

  test("erro HTTP (cota excedida) vira erroTriagem com status", () => {
    const r = interpretarRespostaGemini({ statusCode: 429, error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "quota" } }, ctx);
    expect(r.erroTriagem).toContain("429");
    expect(r.erroTriagem).toContain("RESOURCE_EXHAUSTED");
  });
});

describe("custoUsd do Gemini", () => {
  test("nível gratuito custa zero", () => {
    expect(custoUsd("gemini-3.8-flash", 1e6, 1e6)).toBe(0);
  });
});
