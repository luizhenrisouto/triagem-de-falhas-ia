/**
 * Sobe um n8n descartável com o fluxo de triagem importado e ativo.
 * Uso em linha de comando (CI): npx tsx scripts/subir-n8n.ts  → imprime "n8n pronto em <url>" e fica rodando.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const VERSAO_N8N = "2.45.4";
const RAIZ = path.resolve(__dirname, "..");
const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

export type N8nRodando = { url: string; processo: ChildProcess; parar(): void; log: string };

function ambiente(pasta: string, porta: number, extra: Record<string, string>): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: "production",
    N8N_USER_FOLDER: pasta,
    N8N_PORT: String(porta),
    N8N_RUNNERS_BROKER_PORT: String(porta + 1000),
    N8N_HOST: "127.0.0.1",
    N8N_LISTEN_ADDRESS: "127.0.0.1",
    N8N_BLOCK_ENV_ACCESS_IN_NODE: "false",
    N8N_DIAGNOSTICS_ENABLED: "false",
    N8N_PERSONALIZATION_ENABLED: "false",
    N8N_VERSION_NOTIFICATIONS_ENABLED: "false",
    N8N_SECURE_COOKIE: "false",
    EXECUTIONS_DATA_SAVE_ON_SUCCESS: "none",
    EXECUTIONS_DATA_SAVE_ON_ERROR: "none",
    N8N_LOG_LEVEL: process.env.N8N_LOG_LEVEL ?? "warn",
    ...extra,
  };
}

function cli(args: string[], env: NodeJS.ProcessEnv) {
  const r = spawnSync(NPX, ["--yes", `n8n@${VERSAO_N8N}`, ...args], { env, cwd: RAIZ, encoding: "utf8", shell: process.platform === "win32" });
  if (r.status !== 0) throw new Error(`n8n ${args[0]} falhou:\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}

async function esperarPronto(url: string, processo: ChildProcess, limiteMs: number) {
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    if (processo.exitCode !== null) throw new Error(`n8n saiu com código ${processo.exitCode}`);
    try {
      // O webhook é registrado alguns segundos depois do /healthz/readiness. Um GET num webhook
      // registrado só para POST responde "Did you mean to make a POST request?".
      const r = await fetch(`${url}/webhook/triagem`);
      if ((await r.text()).includes("POST request")) return;
    } catch {}
    await new Promise((ok) => setTimeout(ok, 1000));
  }
  throw new Error(`n8n não ficou pronto em ${limiteMs / 1000}s`);
}

export async function subirN8n(opcoes: { porta?: number; env?: Record<string, string>; limiteMs?: number } = {}): Promise<N8nRodando> {
  const porta = opcoes.porta ?? 5678;
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "n8n-triagem-"));
  const env = ambiente(pasta, porta, opcoes.env ?? {});
  cli(["import:workflow", `--input=${path.join(RAIZ, "n8n/fluxo.json")}`], env);
  cli(["publish:workflow", "--id=TriagemFalhasIA1"], env);
  const log = path.join(pasta, "n8n.log");
  const saida = fs.openSync(log, "a");
  const processo = spawn(NPX, ["--yes", `n8n@${VERSAO_N8N}`, "start"], {
    env,
    cwd: RAIZ,
    stdio: ["ignore", saida, saida],
    shell: process.platform === "win32",
    detached: process.platform !== "win32",
  });
  const parar = () => {
    if (processo.exitCode !== null || !processo.pid) return;
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(processo.pid), "/T", "/F"]);
    else process.kill(-processo.pid, "SIGTERM");
  };
  const url = `http://127.0.0.1:${porta}`;
  try {
    await esperarPronto(url, processo, opcoes.limiteMs ?? 180_000);
  } catch (e) {
    parar();
    const fim = fs.readFileSync(log, "utf8").split("\n").slice(-25).join("\n");
    throw new Error(`${(e as Error).message}\n--- final do log do n8n (${log}) ---\n${fim}`);
  }
  return { url, processo, parar, log };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  subirN8n({ porta: Number(process.env.N8N_PORT ?? 5678) })
    .then(({ url, parar }) => {
      console.log(`n8n pronto em ${url}`);
      for (const s of ["SIGINT", "SIGTERM"] as const) process.on(s, () => (parar(), process.exit(0)));
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
