(() => {
  const painel = document.querySelector('#painelAcessibilidade');
  const formulario = document.querySelector('#preferenciasAcessibilidade');
  const chave = 'autonomia-preferencias';
  const padrao = { tema: 'sistema', texto: '100', contraste: false, espacamento: false, movimento: false };

  const temaSistema = matchMedia('(prefers-color-scheme: dark)');

  function atualizarTema() {
    const raiz = document.documentElement;
    const tema = raiz.dataset.tema;
    raiz.toggleAttribute('data-tema-escuro', tema === 'escuro' || (tema === 'sistema' && temaSistema.matches));
  }

  function aplicar(dados) {
    const raiz = document.documentElement;
    for (const [nome, valorPadrao] of Object.entries(padrao)) {
      const controle = formulario.elements.namedItem(nome);
      const valor = dados[nome];
      if (typeof valorPadrao === 'boolean') {
        controle.checked = valor === true;
        raiz.toggleAttribute('data-' + nome, controle.checked);
      } else {
        controle.value = Array.from(controle.options).some(opcao => opcao.value === valor) ? valor : valorPadrao;
        raiz.dataset[nome] = controle.value;
      }
    }
    atualizarTema();
  }

  temaSistema.addEventListener('change', atualizarTema);
  try {
    aplicar(JSON.parse(localStorage.getItem(chave)) ?? padrao);
  } catch {
    aplicar(padrao);
  }

  formulario.addEventListener('change', () => {
    const dados = {};
    for (const [nome, valorPadrao] of Object.entries(padrao)) {
      const controle = formulario.elements.namedItem(nome);
      dados[nome] = typeof valorPadrao === 'boolean' ? controle.checked : controle.value;
    }
    aplicar(dados);
    try { localStorage.setItem(chave, JSON.stringify(dados)); } catch {}
  });
  formulario.addEventListener('submit', evento => evento.preventDefault());
  formulario.addEventListener('reset', evento => {
    evento.preventDefault();
    aplicar(padrao);
    try { localStorage.removeItem(chave); } catch {}
  });
  painel.addEventListener('keydown', evento => {
    if (evento.key !== 'Escape' || !painel.open) return;
    evento.preventDefault();
    painel.open = false;
    painel.querySelector('summary').focus();
  });
})();
