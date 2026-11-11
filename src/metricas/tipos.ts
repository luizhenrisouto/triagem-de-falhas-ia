export type Categoria = "bug_produto" | "teste_instavel" | "teste_quebrado";

export type Triagem = {
  categoria: Categoria;
  confianca: number;
  resumo: string;
  passos: string[];
  esperado: string;
  obtido: string;
  causaProvavel: string;
  sugestaoCorrecao: string;
};

/** Um item de `resultados` devolvido pelo webhook do n8n. */
export type ResultadoTriagem = {
  falhaId: string;
  titulo: string;
  triagem: Triagem | null;
  erroTriagem: string | null;
  acaoIssue: "criada" | "atualizada" | "reaberta" | "nenhuma";
  issueUrl: string | null;
  erroIssue: string | null;
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd: number;
  duracaoTriagemMs: number;
};

/** `data`: texto legível para as issues; `dataIso`: para ordenar o histórico. */
export type Execucao = { id: string; url: string; data: string; dataIso: string; commit: string };

export type ResumoExecucao = {
  id: string;
  data: string;
  url: string;
  commit: string;
  modelo: string;
  totalTestes: number;
  aprovados: number;
  falhas: number;
  porCategoria: Record<Categoria, number>;
  acertoGabaritoPct: number | null;
  duracaoMediaTriagemMs: number | null;
  custoUsd: number;
  minutosManuaisEstimados: number;
  minutosEconomizados: number;
  issues: { criadas: number; atualizadas: number; reabertas: number };
  resultados: ResultadoTriagem[];
};

/** Estimativa do autor: tempo de triagem manual de uma falha. */
export const MINUTOS_MANUAIS_POR_FALHA = 30;
