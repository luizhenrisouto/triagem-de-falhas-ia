import type { Page } from "@playwright/test";

export type Usuario = "standard_user" | "problem_user" | "error_user" | "performance_glitch_user";

export async function login(page: Page, usuario: Usuario): Promise<void> {
  await page.goto("/");
  await page.getByTestId("username").fill(usuario);
  await page.getByTestId("password").fill("secret_sauce");
  await page.getByTestId("login-button").click();
}
