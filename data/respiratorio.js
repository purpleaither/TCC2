export const medidasRespiratorias = [
  ['dyspnea_rest', 'Falta de ar em repouso', 10],
  ['dyspnea_exertion', 'Falta de ar ao se mexer', 10],
  ['cough_level', 'Tosse', 3],
  ['secretion_level', 'Secreção (catarro)', 3],
  ['airway_dryness', 'Ressecamento ou irritação nas vias aéreas', 3]
];

export const niveisRespiratorios = ['Ausente', 'Leve', 'Moderada', 'Intensa'];
export const avisoFaltaDeAr = 'Pause os exercícios agora e procure atendimento presencial no HUB ou na rede de urgência. Se a falta de ar for intensa neste momento, ligue para o SAMU (192).';

export function dominioDoDiario(planos) {
  const dominios = new Set(planos.map(plano => plano.clinical_domain ?? 'musculoesqueletico'));
  if (dominios.has('misto') || dominios.size > 1) return 'misto';
  return dominios.has('respiratorio') ? 'respiratorio' : 'musculoesqueletico';
}

export function resumoRespiratorio(registro) {
  return medidasRespiratorias.filter(([campo]) => Number.isInteger(registro[campo]))
    .map(([campo, rotulo, maximo]) => rotulo + ': ' +
      (maximo === 10 ? registro[campo] + '/10' : niveisRespiratorios[registro[campo]]))
    .join(' · ');
}

export const catalogoRespiratorio = [
  ['freno-labial', 'Respiração com Freno Labial', 'Controle respiratório', 'Soltar o ar devagar pelos lábios, conforme demonstrado pelo fisioterapeuta.', 3, 6, 60],
  ['diafragmatica', 'Respiração Diafragmática', 'Controle respiratório', 'Perceber o movimento da barriga durante a respiração.', 3, 8, 60],
  ['inspiracao-fracionada', 'Inspiração Fracionada em Tempos', 'Expansão do tórax', 'Inspiração em etapas, com pausas conforme a orientação recebida.', 3, 5, 90, 3],
  ['mobilidade-toracica', 'Mobilidade Torácica Associada aos Membros Superiores', 'Mobilidade', 'Combinar a respiração com os movimentos orientados para os braços.', 3, 8, 60],
  ['ciclo-ativo', 'Ciclo Ativo da Respiração / Huffing Leve', 'Higiene brônquica', 'Técnica orientada para ajudar a mover o catarro, com momentos de respiração calma e de saída controlada do ar.', 2, 3, 90]
].map(([id, nome, categoria, descricao, series, cycles, rest_seconds, inspiratory_hold_seconds]) => ({
  id, nome, categoria, descricao, domain: 'respiratorio', domiciliar: true,
  parametrosPadrao: {series, repetitions: String(cycles), rest_seconds, inspiratory_hold_seconds}
}));
