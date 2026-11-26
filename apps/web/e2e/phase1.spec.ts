import { expect, test } from '@playwright/test';

test.describe('TuVitrina Fase 1 — Navegación pública, autenticación y documentos legales', () => {
  test('carga la página de inicio, términos y privacidad sin errores en español de Cuba', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 2 })).toContainText('Tu catálogo online');

    await page.goto('/terminos');
    await expect(page.getByRole('heading', { level: 4 })).toContainText('Términos de uso');

    await page.goto('/privacidad');
    await expect(page.getByRole('heading', { level: 4 })).toContainText('Política de privacidad');
  });

  test('muestra pestañas de entrar, registro con términos versionados y recuperación de clave', async ({
    page,
  }) => {
    await page.goto('/entrar');
    await expect(page.getByRole('tab', { name: 'Entrar' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Crear cuenta' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Recuperar clave' })).toBeVisible();

    await page.getByRole('tab', { name: 'Crear cuenta' }).click();
    await expect(page.getByText(/Términos de uso/i)).toBeVisible();
    await expect(page.getByText(/Política de privacidad/i)).toBeVisible();

    await page.getByRole('tab', { name: 'Recuperar clave' }).click();
    await expect(page.getByRole('button', { name: /Enviar enlace/i })).toBeVisible();
  });
});
