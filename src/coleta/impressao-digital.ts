import { createHash } from "node:crypto";

const ANSI = /\u001b\[[0-9;]*m/g;

export function semAnsi(texto: string): string {
  return texto.replace(ANSI, "");
}

/** Primeira linha do erro, sem cores e com todo número trocado por "#". */
export function normalizarErro(erro: string): string {
  const primeira = semAnsi(erro).trim().split("\n")[0] ?? "";
  return primeira.replace(/\d+/g, "#").trim();
}

export function impressaoDigital(arquivo: string, titulo: string, erro: string): string {
  return createHash("sha1")
    .update(`${arquivo}::${titulo}::${normalizarErro(erro)}`)
    .digest("hex")
    .slice(0, 12);
}
