import { test, expect } from "@playwright/test";
import { login } from "./apoio/login";

test.describe("Catálogo", () => {
  test("login mostra o catálogo de produtos", async ({ page }) => {
    await login(page, "standard_user");
    await expect(page.getByTestId("inventory-list")).toBeVisible();
    await expect(page.getByTestId("inventory-item")).toHaveCount(6);
  });

  test("ordenar por menor preço coloca o item mais barato primeiro", async ({ page }) => {
    await login(page, "standard_user");
    await page.getByTestId("product-sort-container").selectOption("lohi");
    const precos = (await page.getByTestId("inventory-item-price").allTextContents()).map((p) =>
      Number(p.replace("$", "")),
    );
    expect(precos[0]).toBe(Math.min(...precos));
  });

  test("imagem de cada produto corresponde ao produto", async ({ page }) => {
    await login(page, "problem_user");
    const imagens = await page.locator(".inventory_item_img img").evaluateAll((els) =>
      els.map((e) => (e as HTMLImageElement).getAttribute("src")),
    );
    expect(new Set(imagens).size).toBe(imagens.length);
  });

  test("catálogo abre em tempo aceitável", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("username").fill("performance_glitch_user");
    await page.getByTestId("password").fill("secret_sauce");
    const limiteMs = Number(process.env.LIMITE_CATALOGO_MS ?? 5165);
    const inicio = Date.now();
    await page.getByTestId("login-button").click();
    await expect(page.getByTestId("inventory-list")).toBeVisible({ timeout: 15_000 });
    const tempoMs = Date.now() - inicio;
    test.info().annotations.push({ type: "tempo-catalogo-ms", description: String(tempoMs) });
    expect(tempoMs, `catálogo deve abrir em menos de ${limiteMs} ms`).toBeLessThan(limiteMs);
  });
});
