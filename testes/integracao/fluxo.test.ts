import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { criarDuble, type Chamada, type Duble } from "./duble-servidor";
import { subirN8n, type N8nRodando } from "../../scripts/subir-n8n";

const PORTA = 5699;
const REPO = "dono/repo";
const execucao = { id: "1", url: "https://github.com/dono/repo/actions/runs/1", data: "2026-11-12" };

const falha = (id: string, titulo: string, erro: string) => ({
  id, titulo, arquivo: "x.spec.ts", linha: 10, erro, stack: "", trechoCodigo: "> 10 | x",
  passouNaNovaTentativa: false, tentativas: 1, duracaoMs: 1000, printBase64: null,
});
const FALHAS = [
  falha("aaaaaaaaaaaa", "x.spec.ts > A > bug", "ERRO_BUG"),
  falha("bbbbbbbbbbbb", "x.spec.ts > A > instavel", "ERRO_INSTAVEL"),
  falha("cccccccccccc", "x.spec.ts > A > quebrado", "ERRO_QUEBRADO"),
];

const triagem = (categoria: string) => ({
  categoria, confianca: 0.9, resumo: `resumo ${categoria}`, passos: ["p1"], esperado: "e", obtido: "o",
  causaProvavel: "c", sugestaoCorrecao: "s",
});
const respostaClaude = (c: Chamada) => {
  const texto: string = c.corpo.messages[0].content.at(-1).text;
  if (texto.includes("ERRO_FALHA_API")) return { status: 500, corpo: { type: "error", error: { type: "api_error", message: "boom" } } };
  const categoria = texto.includes("ERRO_BUG") ? "bug_produto" : texto.includes("ERRO_INSTAVEL") ? "teste_instavel" : "teste_quebrado";
  return {
    status: 200,
    corpo: { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(triagem(categoria)) }], usage: { input_tokens: 100, output_tokens: 50 } },
  };
};

let claude: Duble;
let gemini: Duble;
let github: Duble;
let n8n: N8nRodando;
let issues: any[] = [];

const enviar = async (falhas = FALHAS, modelo = "claude-opus-5-5") => {
  const r = await fetch(`${n8n.url}/webhook/triagem`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ execucao, repositorio: REPO, modelo, promptSistema: "P", falhas }),
  });
  expect(r.status).toBe(200);
  return (await r.json()) as { resultados: any[] };
};

beforeAll(async () => {
  claude = await criarDuble(respostaClaude);
  gemini = await criarDuble((c) => {
    const texto: string = c.corpo.contents[0].parts.at(-1).text;
    const categoria = texto.includes("ERRO_BUG") ? "bug_produto" : texto.includes("ERRO_INSTAVEL") ? "teste_instavel" : "teste_quebrado";
    return {
      status: 200,
      corpo: { candidates: [{ content: { parts: [{ text: JSON.stringify(triagem(categoria)) }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 80, candidatesTokenCount: 40 } },
    };
  });
  github = await criarDuble((c) => {
    if (c.metodo === "GET") return { status: 200, corpo: issues };
    if (c.metodo === "POST" && c.caminho.endsWith("/issues")) {
      const nova = { number: issues.length + 1, state: "open", body: c.corpo.body, html_url: `https://github.com/${REPO}/issues/${issues.length + 1}` };
      issues.push(nova);
      return { status: 201, corpo: nova };
    }
    if (c.metodo === "PATCH") {
      const n = Number(c.caminho.split("/").pop());
      const i = issues.find((x) => x.number === n)!;
      Object.assign(i, c.corpo);
      return { status: 200, corpo: i };
    }
    return { status: 201, corpo: { html_url: "comentario" } };
  });
  n8n = await subirN8n({
    porta: PORTA,
    env: { CLAUDE_URL_BASE: claude.url, GEMINI_URL_BASE: gemini.url, GITHUB_URL_BASE: github.url, ANTHROPIC_API_KEY: "chave-falsa", GEMINI_API_KEY: "chave-gemini-falsa", GITHUB_TOKEN: "token-falso" },
  });
}, 300_000);

afterAll(async () => {
  n8n?.parar();
  await claude?.fechar();
  await gemini?.fechar();
  await github?.fechar();
});

describe("fluxo n8n", () => {
  test("primeira execução: cria issues de bug e de teste quebrado, nenhuma para instável", async () => {
    const { resultados } = await enviar();
    expect(resultados).toHaveLength(3);
    const porId = Object.fromEntries(resultados.map((r) => [r.falhaId, r]));
    expect(porId.aaaaaaaaaaaa.acaoIssue).toBe("criada");
    expect(porId.aaaaaaaaaaaa.issueUrl).toMatch(/issues\/\d+$/);
    expect(porId.bbbbbbbbbbbb.acaoIssue).toBe("nenhuma");
    expect(porId.bbbbbbbbbbbb.triagem.categoria).toBe("teste_instavel");
    expect(porId.cccccccccccc.acaoIssue).toBe("criada");
    expect(porId.aaaaaaaaaaaa.custoUsd).toBeCloseTo((100 * 4 + 50 * 20) / 1e6);
    expect(github.chamadas.filter((c) => c.metodo === "POST" && c.caminho.endsWith("/issues"))).toHaveLength(2);
    expect(claude.chamadas[0].headers["x-api-key"]).toBe("chave-falsa");
    expect(claude.chamadas[0].headers["anthropic-version"]).toBe("2026-10-21");
    expect(github.chamadas[0].headers.authorization).toBe("Bearer token-falso");
  }, 120_000);

  test("segunda execução: atualiza, não duplica", async () => {
    const antes = issues.length;
    const { resultados } = await enviar();
    expect(issues.length).toBe(antes);
    expect(resultados.filter((r) => r.acaoIssue === "atualizada")).toHaveLength(2);
    expect(issues[0].body).toContain("triagem-ia:ocorrencias=2");
  }, 120_000);

  test("issue fechada que volta é reaberta com comentário", async () => {
    issues[0].state = "closed";
    const { resultados } = await enviar([FALHAS[0]]);
    expect(resultados[0].acaoIssue).toBe("reaberta");
    expect(issues[0].state).toBe("open");
    expect(github.chamadas.some((c) => c.caminho.endsWith("/comments"))).toBe(true);
  }, 120_000);

  test("erro da API numa falha não derruba as outras", async () => {
    const { resultados } = await enviar([falha("dddddddddddd", "x.spec.ts > A > api", "ERRO_FALHA_API"), FALHAS[1]]);
    expect(resultados).toHaveLength(2);
    const ruim = resultados.find((r) => r.falhaId === "dddddddddddd");
    expect(ruim.erroTriagem).toContain("500");
    expect(ruim.acaoIssue).toBe("nenhuma");
    expect(resultados.find((r) => r.falhaId === "bbbbbbbbbbbb").triagem.categoria).toBe("teste_instavel");
  }, 120_000);

  test("modelo gemini-* usa o Gemini, com a chave do Google e sem chamar o Claude", async () => {
    const antesClaude = claude.chamadas.length;
    const { resultados } = await enviar([FALHAS[1]], "gemini-3.8-flash");
    expect(resultados[0].triagem.categoria).toBe("teste_instavel");
    expect(resultados[0].custoUsd).toBe(0);
    expect(claude.chamadas.length).toBe(antesClaude);
    const chamada = gemini.chamadas.at(-1)!;
    expect(chamada.caminho).toBe("/v1beta/models/gemini-3.8-flash:generateContent");
    expect(chamada.headers["x-goog-api-key"]).toBe("chave-gemini-falsa");
    expect(chamada.headers["x-api-key"]).toBeUndefined();
  }, 120_000);

  test("provedor ocupado (503) é tentado de novo e a triagem sai", async () => {
    let tentativas = 0;
    const normal = (c: Chamada) => ({
      status: 200,
      corpo: { candidates: [{ content: { parts: [{ text: JSON.stringify(triagem("teste_instavel")) }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 80, candidatesTokenCount: 40 } },
    });
    gemini.trocarResposta((c) => (++tentativas === 1 ? { status: 503, corpo: { error: { code: 503, status: "UNAVAILABLE", message: "high demand" } } } : normal(c)));
    const { resultados } = await enviar([FALHAS[1]], "gemini-3.8-flash");
    expect(tentativas).toBe(2);
    expect(resultados[0].erroTriagem).toBeNull();
    expect(resultados[0].triagem.categoria).toBe("teste_instavel");
  }, 120_000);
});
