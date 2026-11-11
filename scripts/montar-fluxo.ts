/**
 * Gera n8n/fluxo.json a partir de n8n/fluxo.modelo.json:
 * - troca {{CODIGO:nome}} pelo código das bibliotecas (n8n/codigo) + o código do nó (n8n/nos/nome.js);
 * - {{CODIGO:registrar:acao}} usa n8n/nos/registrar.js com a ação trocada;
 * - troca {{HEADERS_GITHUB}} e {{REGRAS_SWITCH}}.
 * Uso: npx tsx scripts/montar-fluxo.ts
 */
import fs from "node:fs";
import path from "node:path";

const BIBLIOTECAS = [
  "precos",
  "montar-requisicao-claude",
  "interpretar-resposta-claude",
  "decidir-acao-issue",
  "renderizar-issue",
  "montar-resultado",
];

const HEADERS_GITHUB = [
  { name: "Authorization", value: "=Bearer {{ $env.GITHUB_TOKEN }}" },
  { name: "Accept", value: "application/vnd.github+json" },
  { name: "X-GitHub-Api-Version", value: "2022-11-28" },
  { name: "User-Agent", value: "triagem-de-falhas-ia" },
];

const regra = (valor: string) => ({
  conditions: {
    options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
    conditions: [
      {
        id: `regra-${valor}`,
        leftValue: "={{ $json.acao }}",
        rightValue: valor,
        operator: { type: "string", operation: "equals" },
      },
    ],
    combinator: "and",
  },
  renameOutput: true,
  outputKey: valor,
});
const REGRAS_SWITCH = ["criar", "atualizar", "reabrir", "nenhuma"].map(regra);

export function montarFluxo(raiz: string): any {
  const ler = (p: string) => fs.readFileSync(path.join(raiz, p), "utf8");
  const bibliotecas = BIBLIOTECAS.map((b) => `// ---- n8n/codigo/${b}.js ----\n${ler(`n8n/codigo/${b}.js`)}`).join("\n");
  const fluxo = JSON.parse(ler("n8n/fluxo.modelo.json"));

  for (const no of fluxo.nodes) {
    const p = no.parameters ?? {};
    const m = typeof p.jsCode === "string" ? p.jsCode.match(/^\{\{CODIGO:([\w-]+)(?::([\w-]+))?\}\}$/) : null;
    if (m) {
      let codigo = ler(`n8n/nos/${m[1]}.js`);
      if (m[2]) codigo = codigo.replace(/ACAO_REALIZADA/g, m[2]);
      p.jsCode = `${bibliotecas}\n// ---- nó: ${no.name} ----\n${codigo}`;
    }
    if (p.headerParameters?.parameters === "{{HEADERS_GITHUB}}") p.headerParameters.parameters = HEADERS_GITHUB;
    if (p.rules?.values === "{{REGRAS_SWITCH}}") p.rules.values = REGRAS_SWITCH;
  }
  return fluxo;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const raiz = path.resolve(__dirname, "..");
  const destino = path.join(raiz, "n8n/fluxo.json");
  fs.writeFileSync(destino, JSON.stringify(montarFluxo(raiz), null, 2) + "\n");
  console.log(`Fluxo gerado em ${path.relative(raiz, destino)}`);
}
