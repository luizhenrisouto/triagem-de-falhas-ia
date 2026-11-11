import { MINUTOS_MANUAIS_POR_FALHA, type Execucao, type ResultadoTriagem, type ResumoExecucao } from "./tipos";

export function calcularResumo(entrada: {
  execucao: Execucao;
  modelo: string;
  totalTestes: number;
  aprovados: number;
  resultados: ResultadoTriagem[];
  gabarito: Record<string, string>;
}): ResumoExecucao {
  const { execucao, resultados, gabarito } = entrada;
  const triados = resultados.filter((r) => r.triagem);
  const contar = (f: (r: ResultadoTriagem) => boolean) => resultados.filter(f).length;

  const comGabarito = resultados.filter((r) => gabarito[r.titulo]);
  const acertos = comGabarito.filter((r) => r.triagem?.categoria === gabarito[r.titulo]).length;
  const tempoTriadosMs = triados.reduce((s, r) => s + r.duracaoTriagemMs, 0);
  const minutosManuaisEstimados = triados.length * MINUTOS_MANUAIS_POR_FALHA;

  return {
    id: execucao.id,
    data: execucao.dataIso,
    url: execucao.url,
    commit: execucao.commit,
    modelo: entrada.modelo,
    totalTestes: entrada.totalTestes,
    aprovados: entrada.aprovados,
    falhas: resultados.length,
    porCategoria: {
      bug_produto: contar((r) => r.triagem?.categoria === "bug_produto"),
      teste_instavel: contar((r) => r.triagem?.categoria === "teste_instavel"),
      teste_quebrado: contar((r) => r.triagem?.categoria === "teste_quebrado"),
    },
    acertoGabaritoPct: comGabarito.length ? Math.round((acertos / comGabarito.length) * 100) : null,
    duracaoMediaTriagemMs: triados.length ? Math.round(tempoTriadosMs / triados.length) : null,
    custoUsd: resultados.reduce((s, r) => s + (r.custoUsd || 0), 0),
    minutosManuaisEstimados,
    minutosEconomizados: minutosManuaisEstimados - tempoTriadosMs / 60_000,
    issues: {
      criadas: contar((r) => r.acaoIssue === "criada"),
      atualizadas: contar((r) => r.acaoIssue === "atualizada"),
      reabertas: contar((r) => r.acaoIssue === "reaberta"),
    },
    resultados,
  };
}
