import { describe, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { impressaoDigital } from "./impressao-digital";
import { lerRelatorioPlaywright } from "./ler-playwright";
import { lerRelatorioJunit } from "./ler-junit";

const RAIZ = path.resolve(__dirname, "../..");
const JSON_FIXTURE = path.join(RAIZ, "testes/fixtures/resultado.json");
const JUNIT_FIXTURE = path.join(RAIZ, "testes/fixtures/junit.xml");

describe("impressaoDigital", () => {
  test("ignora números variáveis", () => {
    const a = impressaoDigital("x.spec.ts", "t", "Timeout 5000ms exceeded after 5231ms");
    const b = impressaoDigital("x.spec.ts", "t", "Timeout 5000ms exceeded after 6012ms");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{12}$/);
  });

  test("ignora códigos de cor ANSI e linhas depois da primeira", () => {
    const a = impressaoDigital("x", "t", "\u001b[31mErro grave\u001b[39m\nCall log: 123");
    const b = impressaoDigital("x", "t", "Erro grave\noutra coisa");
    expect(a).toBe(b);
  });

  test("muda com o título", () => {
    expect(impressaoDigital("x", "a", "e")).not.toBe(impressaoDigital("x", "b", "e"));
  });
});

describe("lerRelatorioPlaywright", () => {
  const falhas = lerRelatorioPlaywright(JSON_FIXTURE, RAIZ);
  const titulos = falhas.map((f) => f.titulo);

  test("inclui falhas definitivas e instáveis, exclui aprovados", () => {
    expect(titulos).toContain("carrinho.spec.ts > Carrinho > remover produto esvazia o carrinho");
    expect(titulos).toContain("catalogo.spec.ts > Catálogo > catálogo abre em tempo aceitável");
    expect(titulos).not.toContain("carrinho.spec.ts > Carrinho > adicionar produto atualiza o contador do carrinho");
    expect(falhas).toHaveLength(5);
  });

  test("instável traz o erro da tentativa que falhou", () => {
    const f = falhas.find((x) => x.titulo.includes("tempo aceitável"))!;
    expect(f.passouNaNovaTentativa).toBe(true);
    expect(f.tentativas).toBe(2);
    expect(f.erro).toContain("toBeLessThan");
  });

  test("falha definitiva tem arquivo, linha, erro sem ANSI e trecho do código", () => {
    const f = falhas.find((x) => x.titulo.includes("remover produto"))!;
    expect(f.passouNaNovaTentativa).toBe(false);
    expect(f.arquivo).toBe("carrinho.spec.ts");
    expect(f.linha).toBe(15);
    expect(f.erro).toContain("remover-item");
    expect(f.erro).not.toContain("\u001b");
    expect(f.trechoCodigo).toContain('getByTestId("remover-item")');
    expect(f.id).toBe(impressaoDigital(f.arquivo, f.titulo, f.erro));
  });

  test("print inexistente vira null", () => {
    expect(falhas.every((f) => f.printBase64 === null)).toBe(true);
  });

  test("print presente vira base64; acima de 4 MB vira null", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coleta-"));
    const pequeno = path.join(dir, "p.png");
    const grande = path.join(dir, "g.png");
    fs.writeFileSync(pequeno, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    fs.writeFileSync(grande, Buffer.alloc(4 * 1024 * 1024 + 1));
    const r = JSON.parse(fs.readFileSync(JSON_FIXTURE, "utf8"));
    const specs = r.suites.flatMap((s: any) => s.suites.flatMap((d: any) => d.specs));
    const ruins = specs.filter((s: any) => s.tests[0].status === "unexpected");
    ruins[0].tests[0].results[0].attachments = [{ name: "screenshot", contentType: "image/png", path: pequeno }];
    ruins[1].tests[0].results[0].attachments = [{ name: "screenshot", contentType: "image/png", path: grande }];
    const caminho = path.join(dir, "r.json");
    fs.writeFileSync(caminho, JSON.stringify(r));
    const lidas = lerRelatorioPlaywright(caminho, RAIZ);
    expect(lidas.find((f) => f.titulo.endsWith(ruins[0].title))!.printBase64).toBe("iVBORw==");
    expect(lidas.find((f) => f.titulo.endsWith(ruins[1].title))!.printBase64).toBeNull();
  });
});

describe("lerRelatorioJunit", () => {
  const falhas = lerRelatorioJunit(JUNIT_FIXTURE, RAIZ);

  test("só falhas definitivas, com o mesmo formato de título", () => {
    expect(falhas.map((f) => f.titulo).sort()).toEqual([
      "carrinho.spec.ts > Carrinho > remover produto esvazia o carrinho",
      "catalogo.spec.ts > Catálogo > imagem de cada produto corresponde ao produto",
      "checkout.spec.ts > Checkout > campo sobrenome aceita texto no checkout",
      "checkout.spec.ts > Checkout > finalizar compra conclui o pedido",
    ]);
    expect(falhas.every((f) => !f.passouNaNovaTentativa)).toBe(true);
  });

  test("traz linha da falha e trecho do código", () => {
    const f = falhas.find((x) => x.titulo.includes("remover produto"))!;
    expect(f.linha).toBe(15);
    expect(f.trechoCodigo).toContain("remover-item");
  });
});
