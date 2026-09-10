import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("login page loads correctly", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Connexion")).toBeVisible();
    await expect(page.getByPlaceholder("votre@email.com")).toBeVisible();
  });

  test("register page loads correctly", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByText("Inscription")).toBeVisible();
  });

  test("login page has link to register", async ({ page }) => {
    await page.goto("/login");
    const registerLink = page.getByText("S'inscrire");
    await expect(registerLink).toBeVisible();
  });

  test("register page has link to login", async ({ page }) => {
    await page.goto("/register");
    const loginLink = page.getByText("Se connecter");
    await expect(loginLink).toBeVisible();
  });

  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/coach/dashboard");
    await page.waitForURL("**/login");
    await expect(page).toHaveURL(/\/login/);
  });
});
