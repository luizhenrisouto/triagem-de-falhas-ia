import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import type { Falha } from "./tipos";
import { impressaoDigital, semAnsi } from "./impressao-digital";
import { lerPrint, trechoCodigo } from "./trecho-codigo";

const lista = <T>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);

/** Junta texto simples e CDATA de um nó (o parser pode devolver string, objeto ou lista). */
function textoDe(no: unknown): string {
  if (no === undefined || no === null) return "";
  if (typeof no !== "object") return String(no);
  if (Array.isArray(no)) return no.map(textoDe).join("");
  const o = no as Record<string, unknown>;
  return textoDe(o["#text"]) + textoDe(o["#cdata"]);
}

/** Linha da falha: o ">" do trecho do Playwright, senão "arquivo:linha:coluna". */
function linhaDaFalha(texto: string, arquivo: string): number | null {
  const marcada = texto.match(/^\s*>\s*(\d+)\s*\|/m);
  if (marcada) return Number(marcada[1]);
  const local = texto.match(new RegExp(`${arquivo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:(\\d+):\\d+`));
  return local ? Number(local[1]) : null;
}

/**
 * Lê um relatório JUnit XML (qualquer ferramenta). Só falhas definitivas: o JUnit não informa
 * testes que passaram numa nova tentativa. Os testes são procurados em `diretorioTestes`
 * (padrão "testes/e2e") relativo a `raizProjeto`.
 */
export function lerRelatorioJunit(caminhoXml: string, raizProjeto: string, diretorioTestes = "testes/e2e"): Falha[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", textNodeName: "#text", cdataPropName: "#cdata" });
  const xml = parser.parse(fs.readFileSync(caminhoXml, "utf8"));
  const dirXml = path.dirname(path.resolve(caminhoXml));
  const falhas: Falha[] = [];

  for (const suite of lista(xml.testsuites?.testsuite ?? xml.testsuite)) {
    for (const caso of lista<any>(suite.testcase)) {
      const problema = lista<any>(caso.failure)[0] ?? lista<any>(caso.error)[0];
      if (!problema) continue;
      const arquivo: string = caso.classname ?? suite.name ?? "";
      const titulo = `${arquivo} > ${String(caso.name).split(" › ").join(" > ")}`;
      const detalhe = semAnsi(textoDe(problema));
      const tipo = problema.type ? `${problema.type}: ` : "";
      const erro = `${tipo}${semAnsi(String(problema.message ?? ""))}`.trim();
      const linha = linhaDaFalha(detalhe, arquivo);
      const saida = textoDe(caso["system-out"]);
      const anexo = saida.match(/\[\[ATTACHMENT\|([^\]]+\.png)\]\]/)?.[1];
      falhas.push({
        id: impressaoDigital(arquivo, titulo, erro),
        titulo,
        arquivo,
        linha,
        erro,
        stack: detalhe.trim(),
        trechoCodigo: trechoCodigo(path.resolve(raizProjeto, diretorioTestes, arquivo), linha),
        passouNaNovaTentativa: false,
        tentativas: 1,
        duracaoMs: Math.round(Number(caso.time ?? 0) * 1000),
        printBase64: lerPrint(anexo ? path.resolve(dirXml, anexo.replace(/\\/g, "/")) : undefined),
      });
    }
  }
  return falhas;
}
