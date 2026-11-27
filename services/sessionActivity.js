export const TEMPO_INATIVO_MS = 30 * 60 * 1000;

export function criarControleDeSessao({janela, documento, aoExpirar}) {
  const eventos = ["pointerdown", "keydown", "wheel"];
  let chave, ultimo, timer;

  const chaveDoUsuario = id => "tcc:atividade:" + id;
  function ler(chave) {
    try {
      return Number(janela.localStorage.getItem(chave)) || 0;
    } catch {
      return 0;
    }
  }
  function salvar() {
    try {
      janela.localStorage.setItem(chave, String(ultimo));
    } catch {
      // O controle em memória ainda funciona quando o armazenamento está indisponível.
    }
  }
  function conferir() {
    if (!chave) return false;
    janela.clearTimeout(timer);
    ultimo = Math.max(ultimo, ler(chave));
    const restante = ultimo + TEMPO_INATIVO_MS - Date.now();
    if (restante <= 0) {
      parar();
      aoExpirar();
      return false;
    }
    timer = janela.setTimeout(conferir, restante);
    return true;
  }
  function interagir(evento) {
    if (!evento.isTrusted || Date.now() - ultimo < 5000 || !conferir()) return;
    ultimo = Date.now();
    salvar();
    conferir();
  }
  function sincronizar(evento) {
    if (evento.key === chave) conferir();
  }
  function parar() {
    janela.clearTimeout(timer);
    for (const evento of eventos) janela.removeEventListener(evento, interagir);
    janela.removeEventListener("storage", sincronizar);
    documento.removeEventListener("visibilitychange", conferir);
    chave = null;
  }
  return {
    podeRestaurar(id) {
      const atividade = ler(chaveDoUsuario(id));
      return !atividade || Date.now() - atividade < TEMPO_INATIVO_MS;
    },
    iniciar(id, novoLogin = false) {
      parar();
      chave = chaveDoUsuario(id);
      ultimo = (!novoLogin && ler(chave)) || Date.now();
      salvar();
      if (!conferir()) return;
      for (const evento of eventos) janela.addEventListener(evento, interagir, {passive:true});
      janela.addEventListener("storage", sincronizar);
      documento.addEventListener("visibilitychange", conferir);
    },
    parar
  };
}
