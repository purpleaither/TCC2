import assert from 'node:assert/strict';

export async function verificarTeclado(pagina, pasta) {
  const menu = pagina.locator('#menuBtn');
  await menu.focus();
  await pagina.keyboard.press('Enter');
  await pagina.locator('#menuDrawer.open').waitFor({ timeout: 5000 });
  const item = pagina.locator('#menuDrawer.open [onclick="navegarPara(\'sintomas\')"]');
  await item.focus();
  await pagina.keyboard.press('Space');
  await pagina.locator('#page-sintomas.active').waitFor({ timeout: 5000 });
  const escala = pagina.locator('#dorParadoComparacao');
  const menos = escala.getByRole('button', { name: 'Menos dor' });
  const mesma = escala.getByRole('button', { name: 'A mesma dor' });
  await menos.focus();
  await pagina.keyboard.press('Tab');
  assert.equal(await mesma.evaluate(el => el === document.activeElement), true);
  await pagina.keyboard.press('Shift+Tab');
  assert.equal(await menos.evaluate(el => el === document.activeElement), true);
  await pagina.keyboard.press('Space');
  assert.equal(await menos.getAttribute('aria-pressed'), 'true');
  await mesma.focus();
  await pagina.keyboard.press('Enter');
  assert.equal(await mesma.getAttribute('aria-pressed'), 'true');
  assert.equal(await menos.getAttribute('aria-pressed'), 'false');
  const alvos = await escala.getByRole('button').evaluateAll(botoes => botoes.map(botao => {
    const { width, height } = botao.getBoundingClientRect();
    return { largura: width, altura: height };
  }));
  await escala.screenshot({ path: pasta + '/teclado-escala.png' });
  return { alvos, escopo: 'Ativação e percurso entre os botões da escala' };
}
