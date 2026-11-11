export type Falha = {
  /** Impressão digital: 12 caracteres hexadecimais, estável entre execuções. */
  id: string;
  /** "arquivo > describe > título" */
  titulo: string;
  arquivo: string;
  linha: number | null;
  erro: string;
  stack: string;
  /** Até 40 linhas do arquivo de teste ao redor de `linha`. */
  trechoCodigo: string;
  passouNaNovaTentativa: boolean;
  tentativas: number;
  duracaoMs: number;
  /** PNG em base64; null se ausente ou maior que 4 MB. */
  printBase64: string | null;
};

export const LIMITE_PRINT_BYTES = 4 * 1024 * 1024;
