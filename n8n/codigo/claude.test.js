import { describe, expect, test } from "vitest";
import { montarRequisicaoClaude } from "./montar-requisicao-claude.js";
import { interpretarRespostaClaude } from "./interpretar-resposta-claude.js";
import { custoUsd } from "./precos.js";

const falhaExemplo = {
  id: "abc123def456",
  titulo: "checkout.spec.ts > Checkout > finalizar compra conclui o pedido",
  arquivo: "checkout.spec.ts",
  linha: 38,
  erro: "Error: expect(locator).toHaveText(expected) failed",
  stack: "at checkout.spec.ts:38:61",
  trechoCodigo: "> 38 | await expect(page.getByTestId('complete-header')).toHaveText(...)",
  passouNaNovaTentativa: false,
  tentativas: 1,
  duracaoMs: 7000,
  printBase64: "iVBORw==",
};

const triagemOk = {
  categoria: "bug_produto",
  confianca: 0.9,
  resumo: "Botão Finalizar não conclui o pedido",
  passos: ["Entrar", "Adicionar produto", "Finalizar"],
  esperado: "Confirmação do pedido",
  obtido: "Nada acontece",
  causaProvavel: "Erro no front",
  sugestaoCorrecao: "Verificar o handler do botão",
};

const respostaOk = {
  stop_reason: "end_turn",
  content: [{ type: "text", text: JSON.stringify(triagemOk) }],
  usage: { input_tokens: 1000, output_tokens: 200 },
};
const ctx = { modelo: "claude-opus-5-5", inicioMs: 0, fimMs: 1500 };

describe("montarRequisicaoClaude", () => {
  test("usa modelo, saída estruturada, esforço baixo e fallback", () => {
    const r = montarRequisicaoClaude(falhaExemplo, { promptSistema: "P", modelo: "claude-opus-5-5" });
    expect(r.model).toBe("claude-opus-5-5");
    expect(r.system).toBe("P");
    expect(r.max_tokens).toBe(2000);
    expect(r.output_config.effort).toBe("low");
    expect(r.output_config.format.type).toBe("json_schema");
    const schema = r.output_config.format.schema;
    expect(schema.properties.categoria.enum).toEqual(["bug_produto", "teste_instavel", "teste_quebrado"]);
    expect(schema.additionalProperties).toBe(false);
    expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort());
    expect(r.fallbacks).toBe("default");
  });

  test("Haiku não recebe fallbacks (não tem fallback no servidor)", () => {
    const r = montarRequisicaoClaude(falhaExemplo, { promptSistema: "P", modelo: "claude-haiku-5-5" });
    expect(r.fallbacks).toBeUndefined();
  });

  test("print entra como bloco de imagem antes do texto", () => {
    const conteudo = montarRequisicaoClaude(falhaExemplo, { promptSistema: "P", modelo: "claude-opus-5-5" }).messages[0].content;
    expect(conteudo[0]).toEqual({ type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw==" } });
    expect(conteudo[1].type).toBe("text");
  });

  test("sem print, só texto", () => {
    const conteudo = montarRequisicaoClaude({ ...falhaExemplo, printBase64: null }, { promptSistema: "P", modelo: "claude-opus-5-5" }).messages[0].content;
    expect(conteudo).toHaveLength(1);
    expect(conteudo[0].type).toBe("text");
  });

  test("texto traz título, erro, stack, trecho e nova tentativa", () => {
    const texto = montarRequisicaoClaude({ ...falhaExemplo, passouNaNovaTentativa: true, tentativas: 2 }, { promptSistema: "P", modelo: "claude-opus-5-5" })
      .messages[0].content.at(-1).text;
    for (const parte of [falhaExemplo.titulo, falhaExemplo.erro, falhaExemplo.stack, falhaExemplo.trechoCodigo]) {
      expect(texto).toContain(parte);
    }
    expect(texto).toMatch(/passou numa nova tentativa: sim/i);
    expect(texto).toMatch(/tentativas: 2/i);
  });
});

describe("interpretarRespostaClaude", () => {
  test("resposta válida vira triagem com custo e duração", () => {
    const r = interpretarRespostaClaude(respostaOk, ctx);
    expect(r.triagem).toEqual(triagemOk);
    expect(r.erroTriagem).toBeNull();
    expect(r.tokensEntrada).toBe(1000);
    expect(r.tokensSaida).toBe(200);
    expect(r.custoUsd).toBeCloseTo((1000 * 4) / 1e6 + (200 * 20) / 1e6);
    expect(r.duracaoTriagemMs).toBe(1500);
  });

  test("recusa vira erroTriagem", () => {
    const r = interpretarRespostaClaude({ stop_reason: "refusal", content: [], usage: { input_tokens: 10, output_tokens: 0 } }, ctx);
    expect(r.triagem).toBeNull();
    expect(r.erroTriagem).toMatch(/recus/i);
  });

  test("JSON inválido vira erroTriagem", () => {
    const r = interpretarRespostaClaude({ ...respostaOk, content: [{ type: "text", text: "não é json" }] }, ctx);
    expect(r.triagem).toBeNull();
    expect(r.erroTriagem).toMatch(/json/i);
  });

  test("categoria fora da lista vira erroTriagem", () => {
    const texto = JSON.stringify({ ...triagemOk, categoria: "outra" });
    const r = interpretarRespostaClaude({ ...respostaOk, content: [{ type: "text", text: texto }] }, ctx);
    expect(r.triagem).toBeNull();
    expect(r.erroTriagem).toMatch(/categoria/i);
  });

  test("resposta cortada por max_tokens vira erroTriagem", () => {
    const r = interpretarRespostaClaude({ ...respostaOk, stop_reason: "max_tokens" }, ctx);
    expect(r.erroTriagem).toMatch(/limite/i);
  });

  test("erro HTTP vira erroTriagem com status e custo zero", () => {
    const r = interpretarRespostaClaude({ statusCode: 429, error: { type: "rate_limit_error", message: "slow down" } }, ctx);
    expect(r.triagem).toBeNull();
    expect(r.erroTriagem).toContain("429");
    expect(r.erroTriagem).toContain("rate_limit_error");
    expect(r.custoUsd).toBe(0);
  });
});

describe("custoUsd", () => {
  test("Opus 5.5 e Haiku 5.5", () => {
    expect(custoUsd("claude-opus-5-5", 1e6, 1e6)).toBeCloseTo(24);
    expect(custoUsd("claude-haiku-5-5", 1e6, 1e6)).toBeCloseTo(0.6);
  });
  test("modelo desconhecido devolve null", () => {
    expect(custoUsd("outro", 1, 1)).toBeNull();
  });
});
