import { describe, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { executarEnvio } from "./enviar-para-n8n";

const RAIZ = path.resolve(__dirname, "..");
const FIXTURE = path.join(RAIZ, "testes/fixtures/resultado.json");
const ENV = {
  N8N_URL: "http://n8n.local",
  GITHUB_RUN_ID: "99",
  GITHUB_SERVER_URL: "https://github.com",
  GITHUB_REPOSITORY: "dono/repo",
  GITHUB_SHA: "abc123",
  MODELO_IA: "claude-opus-5-5",
  ISSUE_PREFIXO_TITULO: "[SauceDemo] ",
  ISSUE_RODAPE: "Falha plantada.",
};

const saida = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "envio-")), "resumo.json");

describe("executarEnvio", () => {
  test("envia as falhas com prompt, modelo e execução, e grava o resumo", async () => {
    const chamadas: any[] = [];
    const fetchFalso = async (url: string, init: any) => {
      chamadas.push({ url, corpo: JSON.parse(init.body) });
      return new Response(JSON.stringify({ resultados: [] }), { status: 200 });
    };
    const destino = saida();
    const resumo = await executarEnvio({ relatorio: FIXTURE, saida: destino, raiz: RAIZ, env: ENV, fetchFn: fetchFalso as any });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toBe("http://n8n.local/webhook/triagem");
    const corpo = chamadas[0].corpo;
    expect(corpo.repositorio).toBe("dono/repo");
    expect(corpo.modelo).toBe("claude-opus-5-5");
    expect(corpo.promptSistema).toBe(fs.readFileSync(path.join(RAIZ, "prompts/triagem.md"), "utf8"));
    expect(corpo.execucao.id).toBe("99");
    expect(corpo.execucao.url).toBe("https://github.com/dono/repo/actions/runs/99");
    expect(corpo.falhas).toHaveLength(5);
    expect(corpo.issue).toEqual({ prefixoTitulo: "[SauceDemo] ", rodape: "Falha plantada." });
    expect(resumo.totalTestes).toBe(9);
    expect(resumo.aprovados).toBe(4);
    expect(JSON.parse(fs.readFileSync(destino, "utf8")).id).toBe("99");
  });

  test("sem falhas: não chama o n8n e grava resumo zerado", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "envio-"));
    const vazio = path.join(dir, "r.json");
    fs.writeFileSync(vazio, JSON.stringify({ config: {}, suites: [], stats: { expected: 9, unexpected: 0, flaky: 0, skipped: 0 } }));
    let chamou = false;
    const resumo = await executarEnvio({ relatorio: vazio, saida: saida(), raiz: RAIZ, env: ENV, fetchFn: (async () => ((chamou = true), new Response("{}"))) as any });
    expect(chamou).toBe(false);
    expect(resumo.falhas).toBe(0);
    expect(resumo.aprovados).toBe(9);
  });

  test("n8n fora do ar: grava as falhas como sem triagem e lança erro", async () => {
    const destino = saida();
    const falhar = (async () => {
      throw new Error("ECONNREFUSED");
    }) as any;
    await expect(executarEnvio({ relatorio: FIXTURE, saida: destino, raiz: RAIZ, env: ENV, fetchFn: falhar })).rejects.toThrow(/n8n/);
    const resumo = JSON.parse(fs.readFileSync(destino, "utf8"));
    // as falhas continuam aparecendo, como "sem triagem", em vez de uma execução falsamente verde
    expect(resumo.falhas).toBe(5);
    expect(resumo.resultados).toHaveLength(5);
    expect(resumo.resultados.every((r: any) => r.triagem === null && /n8n/.test(r.erroTriagem) && r.acaoIssue === "nenhuma")).toBe(true);
    expect(resumo.acertoGabaritoPct).toBe(0);
  });

  test("JUnit sem totais na raiz soma as suítes", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "envio-"));
    const xml = path.join(dir, "r.xml");
    fs.writeFileSync(xml, '<testsuites><testsuite name="a" tests="3" failures="1" errors="0" skipped="0"><testcase name="t1" classname="a"><failure message="x">x</failure></testcase><testcase name="t2" classname="a"/><testcase name="t3" classname="a"/></testsuite><testsuite name="b" tests="2" failures="0" errors="1" skipped="0"><testcase name="t4" classname="b"><error message="y">y</error></testcase><testcase name="t5" classname="b"/></testsuite></testsuites>');
    const resumo = await executarEnvio({ relatorio: xml, saida: saida(), raiz: RAIZ, env: ENV, fetchFn: (async () => new Response(JSON.stringify({ resultados: [] }))) as any });
    expect(resumo.totalTestes).toBe(5);
    expect(resumo.aprovados).toBe(3);
  });
});
