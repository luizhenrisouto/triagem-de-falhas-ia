const NOMES = {
  bug_produto: "bug do produto",
  teste_instavel: "teste instável",
  teste_quebrado: "teste quebrado",
};

const num = (n, casas = 0) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const dataLegivel = (iso) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else e.setAttribute(k, v);
  }
  for (const f of filhos) if (f) e.append(f);
  return e;
}

function frase(totais) {
  const h1 = document.getElementById("frase");
  const sub = document.getElementById("subfrase");
  h1.textContent = "";
  if (!totais.execucoes) {
    h1.textContent = "Ainda não há execuções publicadas.";
    sub.textContent = "A primeira roda pelo GitHub Actions; depois, uma vez por dia às 8h.";
    return;
  }
  const n = (txt) => el("span", { class: "numero", text: txt });
  const execs = totais.execucoes === 1 ? "1 execução" : `${num(totais.execucoes)} execuções`;
  const horas = totais.horasEconomizadas;
  h1.append(`Em ${execs}, a IA triou `, n(`${num(totais.falhasTriadas)} falhas`));
  if (totais.acertoMedioPct !== null) h1.append(" e acertou ", n(`${num(totais.acertoMedioPct)}%`), " das categorias");
  if (horas >= 1) h1.append(" — cerca de ", n(`${num(horas, horas < 10 ? 1 : 0)} horas`), " de triagem manual.");
  else h1.append(".");
  const custo = `${totais.custoIncompleto ? "pelo menos " : ""}US$ ${num(totais.custoTotalUsd, 2)}`;
  const distintas = totais.falhasDistintas ?? totais.falhasTriadas;
  sub.textContent =
    `${num(distintas)} ${distintas === 1 ? "falha diferente" : "falhas diferentes"}; ` +
    `${num(totais.issuesAbertas)} ${totais.issuesAbertas === 1 ? "issue aberta" : "issues abertas"}, sem repetir a mesma falha. ` +
    `Custo total da IA: ${custo}.`;
}

function faixa(exec) {
  const f = el("div", { class: "faixa", "aria-hidden": "true" });
  for (let i = 0; i < exec.aprovados; i++) f.append(el("span", { class: "aprovado" }));
  for (const [cat, qtd] of Object.entries(exec.porCategoria)) for (let i = 0; i < qtd; i++) f.append(el("span", { class: cat }));
  const semTriagem = exec.falhas - Object.values(exec.porCategoria).reduce((a, b) => a + b, 0);
  for (let i = 0; i < semTriagem; i++) f.append(el("span", { class: "erro" }));
  return f;
}

function descreverExecucao(exec) {
  const partes = [`${exec.falhas} de ${exec.totalTestes} falharam`];
  if (exec.acertoGabaritoPct !== null) partes.push(`acerto ${exec.acertoGabaritoPct}%`);
  return partes.join(", ");
}

async function detalhar(exec, alvo, gabarito) {
  alvo.textContent = "Carregando…";
  try {
    const completo = await fetch(`dados/execucoes/${encodeURIComponent(exec.id)}.json`).then((r) => r.json());
    alvo.textContent = "";
    if (!completo.resultados.length) {
      alvo.append(el("p", { class: "vazio", text: "Nenhuma falha nesta execução: todos os testes passaram." }));
    }
    for (const r of completo.resultados) {
      const certo = gabarito[r.titulo];
      const cat = r.triagem?.categoria;
      const veredito = el("p", { class: "veredito" });
      veredito.append(
        el("span", { class: "etiqueta" }, el("span", { class: `ponto ${cat ?? "erro"}` }), `IA: ${cat ? NOMES[cat] : "sem triagem"}`),
      );
      if (certo) {
        veredito.append(
          el("span", { class: cat === certo ? "confere" : "diverge", text: cat === certo ? "confere com o gabarito" : `gabarito: ${NOMES[certo]}` }),
        );
      }
      const item = el("div", { class: "falha" }, el("p", { class: "falha-titulo", text: r.titulo }), veredito);
      if (r.triagem) item.append(el("p", { text: r.triagem.resumo }));
      if (r.erroTriagem) item.append(el("p", { class: "meta", text: r.erroTriagem }));
      const meta = el("p", { class: "meta" });
      if (r.issueUrl) meta.append(el("a", { href: r.issueUrl, text: `Issue ${r.acaoIssue}` }), " · ");
      meta.append(`${num(r.duracaoTriagemMs / 1000, 1)} s de triagem · US$ ${num(r.custoUsd, 4)}`);
      item.append(meta);
      alvo.append(item);
    }
    if (exec.url) alvo.append(el("p", { class: "meta" }, el("a", { href: exec.url, text: "Ver a execução no GitHub Actions, com prints e traces" })));
  } catch {
    alvo.textContent = "Não foi possível carregar esta execução. Recarregue a página para tentar de novo.";
  }
}

async function iniciar() {
  const lista = document.getElementById("lista");
  let indice;
  try {
    indice = await fetch("dados/indice.json").then((r) => (r.ok ? r.json() : null));
  } catch {}
  if (!indice) {
    frase({ execucoes: 0 });
    return;
  }
  const gabarito = await fetch("dados/gabarito.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  frase(indice.totais);
  for (const exec of indice.execucoes) {
    const idDetalhe = `detalhe-${exec.id}`;
    const botao = el(
      "button",
      { class: "linha-execucao", "aria-expanded": "false", "aria-controls": idDetalhe },
      el("span", { class: "quando", text: dataLegivel(exec.data) }),
      faixa(exec),
      el("span", { class: "resumo-linha", text: descreverExecucao(exec) }),
    );
    const detalhe = el("div", { class: "detalhe", id: idDetalhe, hidden: "" });
    botao.addEventListener("click", () => {
      const abrir = botao.getAttribute("aria-expanded") === "false";
      botao.setAttribute("aria-expanded", String(abrir));
      detalhe.hidden = !abrir;
      if (abrir && !detalhe.dataset.carregado) {
        detalhe.dataset.carregado = "1";
        detalhar(exec, detalhe, gabarito);
      }
    });
    lista.append(el("li", {}, botao, detalhe));
  }
}

iniciar();
