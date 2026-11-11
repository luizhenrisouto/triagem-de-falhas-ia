import { test, expect } from "@playwright/test";
import { login } from "./apoio/login";

test.describe("Carrinho", () => {
  test("adicionar produto atualiza o contador do carrinho", async ({ page }) => {
    await login(page, "standard_user");
    await page.getByTestId("add-to-cart-sauce-labs-backpack").click();
    await expect(page.getByTestId("shopping-cart-badge")).toHaveText("1");
  });

  test("remover produto esvazia o carrinho", async ({ page }) => {
    await login(page, "standard_user");
    await page.getByTestId("add-to-cart-sauce-labs-backpack").click();
    await page.getByTestId("shopping-cart-link").click();
    await page.getByTestId("remover-item").click({ timeout: 5_000 });
    await expect(page.getByTestId("inventory-item")).toHaveCount(0);
  });
});
