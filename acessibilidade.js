(() => {
  const raiz = document.documentElement;
  const painel = document.querySelector("#acessibilidade");
  const diminuir = document.querySelector("#diminuirTexto");
  const aumentar = document.querySelector("#aumentarTexto");
  const tamanho = document.querySelector("#tamanhoTexto");
  const botaoContraste = document.querySelector("#alternarContraste");
  const redefinir = document.querySelector("#redefinirAcessibilidade");
  const chave = "tcc2:acessibilidade";
  const tamanhos = [100, 110, 120, 130, 140, 150];
  let preferencias = {};

  try {
    preferencias = JSON.parse(localStorage.getItem(chave)) ?? {};
  } catch {
    // Os controles continuam disponíveis quando o armazenamento falha.
  }

  let indice = Math.max(0, tamanhos.indexOf(preferencias.tamanho));
  let contraste = preferencias.contraste === true;

  function aplicar() {
    const percentual = tamanhos[indice];
    raiz.style.fontSize = percentual + "%";
    raiz.style.setProperty("--escala-texto", percentual / 100);
    raiz.classList.toggle("alto-contraste", contraste);
    tamanho.value = percentual + "%";
    diminuir.setAttribute("aria-disabled", String(indice === 0));
    aumentar.setAttribute("aria-disabled", String(indice === tamanhos.length - 1));
    botaoContraste.setAttribute("aria-pressed", String(contraste));
  }

  function salvar() {
    aplicar();
    try {
      localStorage.setItem(chave, JSON.stringify({ tamanho: tamanhos[indice], contraste }));
    } catch {
      // A preferência ainda vale na página atual.
    }
  }

  diminuir.addEventListener("click", () => {
    if (indice > 0) {
      indice -= 1;
      salvar();
    }
  });
  aumentar.addEventListener("click", () => {
    if (indice < tamanhos.length - 1) {
      indice += 1;
      salvar();
    }
  });
  botaoContraste.addEventListener("click", () => {
    contraste = !contraste;
    salvar();
  });
  redefinir.addEventListener("click", () => {
    indice = 0;
    contraste = false;
    salvar();
  });
  painel.addEventListener("keydown", evento => {
    if (evento.key === "Escape" && painel.open) {
      painel.open = false;
      painel.querySelector("summary").focus();
    }
  });

  aplicar();
})();
