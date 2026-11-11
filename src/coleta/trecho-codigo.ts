import fs from "node:fs";
import { LIMITE_PRINT_BYTES } from "./tipos";

/** Até 40 linhas ao redor de `linha` (ou as primeiras 40), numeradas. "" se o arquivo não existir. */
export function trechoCodigo(caminhoArquivo: string, linha: number | null): string {
  if (!fs.existsSync(caminhoArquivo)) return "";
  const linhas = fs.readFileSync(caminhoArquivo, "utf8").split(/\r?\n/);
  const centro = linha ?? 1;
  const inicio = Math.max(1, centro - 20);
  const fim = Math.min(linhas.length, inicio + 39);
  const saida: string[] = [];
  for (let n = inicio; n <= fim; n++) {
    saida.push(`${n === linha ? ">" : " "} ${String(n).padStart(3)} | ${linhas[n - 1]}`);
  }
  return saida.join("\n");
}

/** PNG em base64, ou null se não existir ou passar de 4 MB. */
export function lerPrint(caminho: string | undefined): string | null {
  if (!caminho || !fs.existsSync(caminho)) return null;
  if (fs.statSync(caminho).size > LIMITE_PRINT_BYTES) return null;
  return fs.readFileSync(caminho).toString("base64");
}
