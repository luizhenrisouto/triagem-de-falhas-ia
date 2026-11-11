import { test, expect, type Page } from "@playwright/test";
import { login, type Usuario } from "./apoio/login";

async function irParaCheckout(page: Page, usuario: Usuario) {
  await login(page, usuario);
  await page.getByTestId("add-to-cart-sauce-labs-backpack").click();
  await page.getByTestId("shopping-cart-link").click();
  await page.getByTestId("checkout").click();
}

async function preencherDados(page: Page) {
  await page.getByTestId("firstName").fill("Ana");
  await page.getByTestId("lastName").fill("Lima");
  await page.getByTestId("postalCode").fill("90000-000");
}

test.describe("Checkout", () => {
  test("checkout completo gera confirmação do pedido", async ({ page }) => {
    await irParaCheckout(page, "standard_user");
    await preencherDados(page);
    await page.getByTestId("continue").click();
    await page.getByTestId("finish").click();
    await expect(page.getByTestId("complete-header")).toHaveText("Thank you for your order!");
  });

  test("campo sobrenome aceita texto no checkout", async ({ page }) => {
    await irParaCheckout(page, "problem_user");
    await page.getByTestId("lastName").fill("Lima");
    await expect(page.getByTestId("lastName")).toHaveValue("Lima");
  });

  test("finalizar compra conclui o pedido", async ({ page }) => {
    await irParaCheckout(page, "error_user");
    await preencherDados(page);
    await page.getByTestId("continue").click();
    await page.getByTestId("finish").click();
    await expect(page.getByTestId("complete-header")).toHaveText("Thank you for your order!", {
      timeout: 5_000,
    });
  });
});
