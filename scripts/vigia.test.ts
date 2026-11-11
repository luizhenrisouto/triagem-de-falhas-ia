import { describe, expect, test } from "vitest";
import { decidirVigia } from "./vigia.mjs";

const AGORA = new Date("2026-11-12T12:00:00Z");
const min = (m: number) => new Date(AGORA.getTime() - m * 60_000).toISOString();
const run = (id: number, status: string, conclusion: string | null, criadoHaMin: number) => ({
  id,
  status,
  conclusion,
  created_at: min(criadoHaMin),
  html_url: `https://github.com/o/r/actions/runs/${id}`,
});

describe("decidirVigia", () => {
  test("tudo em dia: nada a fazer", () => {
    const d = decidirVigia([run(3, "completed", "success", 60)], AGORA);
    expect(d).toEqual({ cancelar: [], redisparar: false, alerta: null });
  });

  test("execução presa na fila há mais de 30 min: cancela e dispara outra", () => {
    const d = decidirVigia([run(5, "queued", null, 45), run(4, "completed", "success", 120)], AGORA);
    expect(d.cancelar).toEqual([5]);
    expect(d.redisparar).toBe(true);
  });

  test("na fila há pouco tempo: espera", () => {
    const d = decidirVigia([run(5, "queued", null, 10), run(4, "completed", "success", 120)], AGORA);
    expect(d.cancelar).toEqual([]);
    expect(d.redisparar).toBe(false);
  });

  test("presa na fila mas já existe outra rodando: cancela sem disparar outra", () => {
    const d = decidirVigia([run(6, "in_progress", null, 5), run(5, "queued", null, 45)], AGORA);
    expect(d.cancelar).toEqual([5]);
    expect(d.redisparar).toBe(false);
  });

  test("rodando há mais de 60 min (acima do limite dos jobs): cancela e alerta", () => {
    const d = decidirVigia([run(7, "in_progress", null, 75), run(4, "completed", "success", 300)], AGORA);
    expect(d.cancelar).toEqual([7]);
    expect(d.redisparar).toBe(true);
    expect(d.alerta).toMatch(/75 min/);
  });

  test("última execução terminou com falha: alerta com o link", () => {
    const d = decidirVigia([run(8, "completed", "failure", 30), run(4, "completed", "success", 300)], AGORA);
    expect(d.alerta).toMatch(/falhou/);
    expect(d.alerta).toContain("runs/8");
    expect(d.redisparar).toBe(false);
  });

  test("nenhum sucesso nas últimas 26 h: alerta", () => {
    const d = decidirVigia([run(4, "completed", "success", 27 * 60)], AGORA);
    expect(d.alerta).toMatch(/26 h/);
  });

  test("sem nenhuma execução: alerta e dispara", () => {
    const d = decidirVigia([], AGORA);
    expect(d.redisparar).toBe(true);
    expect(d.alerta).toMatch(/nenhuma execução/i);
  });

  test("execução cancelada pelo próprio vigia não conta como falha", () => {
    const d = decidirVigia([run(9, "completed", "cancelled", 20), run(4, "completed", "success", 120)], AGORA);
    expect(d.alerta).toBeNull();
  });
});
