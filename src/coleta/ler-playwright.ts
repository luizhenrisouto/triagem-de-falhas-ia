import fs from "node:fs";
import path from "node:path";
import type { Falha } from "./tipos";
import { impressaoDigital, semAnsi } from "./impressao-digital";
import { lerPrint, trechoCodigo } from "./trecho-codigo";

type Resultado = {
  status: string;
  duration: number;
  error?: { message?: string; stack?: string; location?: { line: number } };
  attachments?: { name: string; contentType: string; path?: string }[];
};
type Spec = { title: string; file: string; line: number; tests: { status: string; results: Resultado[] }[] };
type Suite = { title: string; suites?: Suite[]; specs?: Spec[] };

/**
 * Lê o relatório JSON do Playwright. Devolve as falhas definitivas (status "unexpected")
 * e os testes instáveis (status "flaky": falhou e depois passou na nova tentativa).
 */
export function lerRelatorioPlaywright(caminhoJson: string, raizProjeto: string): Falha[] {
  const relatorio = JSON.parse(fs.readFileSync(caminhoJson, "utf8"));
  const rootDir: string = relatorio.config?.rootDir ?? "";
  const resolver = (p: string) => path.resolve(raizProjeto, p);
  const falhas: Falha[] = [];

  const visitar = (suite: Suite, caminho: string[]) => {
    for (const filha of suite.suites ?? []) visitar(filha, [...caminho, filha.title]);
    for (const spec of suite.specs ?? []) {
      for (const teste of spec.tests) {
        if (teste.status !== "unexpected" && teste.status !== "flaky") continue;
        const falhou = teste.results.find((r) => r.status !== "passed" && r.status !== "skipped") ?? teste.results[0];
        const titulo = [...caminho, spec.title].join(" > ");
        const erro = semAnsi(falhou.error?.message ?? "").trim();
        const linha = falhou.error?.location?.line ?? spec.line ?? null;
        const print = falhou.attachments?.find((a) => a.name === "screenshot")?.path;
        falhas.push({
          id: impressaoDigital(spec.file, titulo, erro),
          titulo,
          arquivo: spec.file,
          linha,
          erro,
          stack: semAnsi(falhou.error?.stack ?? ""),
          trechoCodigo: trechoCodigo(resolver(path.join(rootDir, spec.file)), linha),
          passouNaNovaTentativa: teste.status === "flaky",
          tentativas: teste.results.length,
          duracaoMs: teste.results.reduce((s, r) => s + r.duration, 0),
          printBase64: lerPrint(print ? resolver(print) : undefined),
        });
      }
    }
  };

  for (const suite of relatorio.suites ?? []) visitar(suite, [suite.title]);
  return falhas;
}
