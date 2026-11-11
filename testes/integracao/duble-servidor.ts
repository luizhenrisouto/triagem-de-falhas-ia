import http from "node:http";
import type { AddressInfo } from "node:net";

export type Chamada = { metodo: string; caminho: string; corpo: any; headers: http.IncomingHttpHeaders };
export type Resposta = { status: number; corpo: unknown };
export type Responder = (c: Chamada) => Resposta;

export type Duble = { url: string; chamadas: Chamada[]; trocarResposta(r: Responder): void; fechar(): Promise<void> };

/** Servidor HTTP falso que registra cada chamada e responde com a função dada. */
export async function criarDuble(responder: Responder): Promise<Duble> {
  const chamadas: Chamada[] = [];
  let atual = responder;
  const servidor = http.createServer((req, res) => {
    let dados = "";
    req.on("data", (p) => (dados += p));
    req.on("end", () => {
      let corpo: any = dados;
      try {
        corpo = dados ? JSON.parse(dados) : null;
      } catch {}
      const chamada = { metodo: req.method ?? "", caminho: req.url ?? "", corpo, headers: req.headers };
      chamadas.push(chamada);
      const r = atual(chamada);
      res.writeHead(r.status, { "content-type": "application/json" });
      res.end(JSON.stringify(r.corpo));
    });
  });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  const { port } = servidor.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    chamadas,
    trocarResposta: (r) => (atual = r),
    fechar: () => new Promise((ok) => servidor.close(() => ok())),
  };
}
