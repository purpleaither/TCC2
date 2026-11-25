// Ignora respostas de um paciente anterior ou de uma sessão encerrada.
export function criarControleDeSolicitacao() {
  let versao = 0;
  return {
    invalidar() { versao += 1; },
    iniciar() {
      const atual = ++versao;
      return () => atual === versao;
    }
  };
}
