const observarVLibras = new MutationObserver(() => {
  const botao = document.getElementById('vlibras-access-wrapper')?.shadowRoot?.querySelector('button');
  if (!botao) return;
  observarVLibras.disconnect();
  botao.click();
});
observarVLibras.observe(document.body, { childList: true });
