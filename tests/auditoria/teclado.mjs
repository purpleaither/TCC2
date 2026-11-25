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
  const escala = pagina.locator('#page-sintomas.active .pain-scale-controls').first();
  const menos = escala.getByRole('button').first();
  const mais = escala.getByRole('button').last();
  const valor = pagina.locator('#restPainValue');
  await menos.focus();
  await pagina.keyboard.press('Tab');
  assert.equal(await mais.evaluate(el => el === document.activeElement), true);
  await pagina.keyboard.press('Shift+Tab');
  assert.equal(await menos.evaluate(el => el === document.activeElement), true);
  const antes = parseInt(await valor.textContent(), 10);
  await pagina.keyboard.press('Space');
  assert.equal(parseInt(await valor.textContent(), 10), Math.max(0, antes - 1));
  await mais.focus();
  await pagina.keyboard.press('Enter');
  assert.equal(parseInt(await valor.textContent(), 10), Math.max(0, antes - 1) + 1);
  const alvos = await escala.getByRole('button').evaluateAll(botoes => botoes.map(botao => {
    const { width, height } = botao.getBoundingClientRect();
    return { largura: width, altura: height };
  }));
  await escala.screenshot({ path: pasta + '/teclado-escala.png' });
  return { alvos, escopo: 'Ativação e percurso entre os botões da escala' };
}
