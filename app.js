/* ========================================
   Autonomia em Movimento — JavaScript
   HUB / Universidade de Brasília
   ======================================== */

var registrosUsuario = [];
var treinosConcluidos = [];

var usuarioAtual = null;
var atipico = null;
var rigidezAtual = null;
var fadigaAtual = null;
var humorAtual = null;
var atividadeAtual = null;
var treinoConcluido = false;
var registroEnviadoHoje = false;
var mesAtual = new Date(); 
var filtroDorVisualizacao = 1; // 0 = Repouso, 1 = Movimento

function appPaginaInicial() {
  return window.AppAuth && window.AppAuth.isProfessional() ? 'profissional' : 'inicio';
}

function realizarLogin(event) {
  if (event) event.preventDefault();
  if (window.AppAuth) return window.AppAuth.login();
}

function realizarLogout() {
  if (window.AppAuth) return window.AppAuth.logout();
}

function aplicarUsuarioNaInterface(nome) {
  var displayInicio = document.getElementById('userNameDisplay');
  var displayPerfil = document.getElementById('perfilNome');
  if (displayInicio) displayInicio.textContent = nome;
  if (displayPerfil) displayPerfil.textContent = nome;
}

function mostrarCabecalho(visivel) {
  var header = document.getElementById('appHeader');
  if (header) header.style.display = visivel ? 'grid' : 'none';
}

function navegarPara(pagina) {
  if (window.AppAuth) return window.AppAuth.navigate(pagina);
  var paginas = document.querySelectorAll('.page');
  paginas.forEach(function(p) { p.classList.toggle('active', p.id === 'page-login'); });
  mostrarCabecalho(false);
}

function alternarMenu() {
  var drawer = document.getElementById('menuDrawer');
  var overlay = document.getElementById('menuOverlay');
  var aberto = drawer ? drawer.classList.toggle('open') : false;
  if (overlay) overlay.classList.toggle('open', aberto);
  document.getElementById('menuBtn')?.setAttribute('aria-expanded', String(aberto));
}

function fecharMenu() {
  var drawer = document.getElementById('menuDrawer');
  var overlay = document.getElementById('menuOverlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  document.getElementById('menuBtn')?.setAttribute('aria-expanded', 'false');
}

document.addEventListener('DOMContentLoaded', function() {
  fecharMenu();
  var menuBtn = document.getElementById('menuBtn');
  var menuOverlay = document.getElementById('menuOverlay');
  if (menuBtn) menuBtn.onclick = alternarMenu;
  if (menuOverlay) menuOverlay.onclick = fecharMenu;
});

function atualizarDataAtual() {
  var el = document.getElementById('currentDateDisplay');
  if (!el) return;
  var hoje = new Date();
  var diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  var meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  el.textContent = diasSemana[hoje.getDay()] + ', ' + hoje.getDate() + ' de ' + meses[hoje.getMonth()] + ' de ' + hoje.getFullYear();
}

function selecionar(grupoId, indice) {
  var grupo = document.getElementById(grupoId);
  if (!grupo) return;
  var botoes = grupo.querySelectorAll('.choice-btn, .mood-btn');
  botoes.forEach(function(botao) { botao.classList.remove('selected'); });
  if (botoes[indice]) botoes[indice].classList.add('selected');
  grupo.querySelectorAll('[aria-pressed]').forEach(botao => botao.setAttribute('aria-pressed', String(botao.classList.contains('selected'))));

  switch (grupoId) {
    case 'rigidezOptions': rigidezAtual = indice; break;
    case 'fadigaOptions': fadigaAtual = indice; break;
    case 'humorOptions': humorAtual = indice; break;
    case 'atividadeOptions': atividadeAtual = indice; break;
    case 'atipicoOptions': atipico = indice; break;
    case 'filtDorOptions': 
      filtroDorVisualizacao = indice; 
      gerarHeatmap(); 
      break;
  }
}

let etapaDiario = 0;

function definirEtapaDiario(indice, focar = false) {
  const etapas = document.querySelectorAll('#page-sintomas [data-etapa-diario]');
  if (!etapas[indice]) return;
  etapaDiario = indice;
  document.getElementById('diarioErro').hidden = true;
  etapas.forEach((etapa, posicao) => { etapa.hidden = posicao !== indice; });
  document.getElementById('diarioEtapa').textContent = 'Etapa ' + (indice + 1) + ' de ' + etapas.length;
  document.getElementById('diarioVoltar').hidden = indice === 0;
  document.getElementById('diarioProximo').hidden = indice === etapas.length - 1;
  document.getElementById('diarioSalvar').hidden = indice !== etapas.length - 1;
  if (focar) {
    etapas[indice].querySelector('h2').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

function mostrarErroDiario(mensagem) {
  const erro = document.getElementById('diarioErro');
  erro.textContent = mensagem;
  erro.hidden = false;
  erro.focus();
}

function mudarEtapaDiario(delta) {
  if (etapaDiario === 1 && delta > 0) {
    const faltando = [
      [rigidezAtual, 'rigidez'], [fadigaAtual, 'cansaço'],
      [humorAtual, 'humor'], [atividadeAtual, 'nível de atividade física']
    ].filter(([valor]) => valor === null).map(([, rotulo]) => rotulo);
    if (faltando.length) {
      mostrarErroDiario('Responda sobre ' + faltando.join(', ') + ' para continuar.');
      return;
    }
  }
  definirEtapaDiario(etapaDiario + delta, true);
}

function limparRegistroDiario() {
  rigidezAtual = fadigaAtual = humorAtual = atividadeAtual = atipico = null;
  document.querySelectorAll('#page-sintomas .selected').forEach(botao => {
    botao.classList.remove('selected');
    if (botao.hasAttribute('aria-pressed')) botao.setAttribute('aria-pressed', 'false');
  });
}

function concluirRegistro() {
  if (atipico === null) {
    mostrarErroDiario('Informe se você percebeu algum sinal fora do comum.');
    return;
  }
  if (window.AppAuth) return window.AppAuth.saveSymptoms();
}

// ========================================
// GERAÇÃO DE HISTÓRICO E HEATMAP DINÂMICO
// ========================================

function gerarHeatmap() {
  var grid = document.getElementById('heatmapGrid');
  if (!grid) return;
  grid.innerHTML = '';

  var totalDor = 0, maxDor = 0, diasComRegistro = 0, diasComNota = 0;
  var numDias = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0).getDate();

  for (var i = 1; i <= numDias; i++) {
    var regDoDia = registrosUsuario.slice().reverse().find(function(r) {
      var d = new Date(r.data);
      return d.getDate() === i && d.getMonth() === mesAtual.getMonth() && d.getFullYear() === mesAtual.getFullYear();
    });

    var treinosDoDia = treinosConcluidos.filter(function(t) {
      var d = new Date(t.completed_at);
      return d.getDate() === i && d.getMonth() === mesAtual.getMonth() && d.getFullYear() === mesAtual.getFullYear();
    });
    var cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    if (i === 1) cell.style.gridColumnStart = (new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1).getDay() + 6) % 7 + 1;
    var valorVisivel = treinosDoDia.length ? '' : '-';

    const nota = filtroDorVisualizacao === 0 ? regDoDia?.dorRepouso : regDoDia?.dorMovimento;
    if (regDoDia) diasComRegistro++;
    if (Number.isFinite(nota)) {
      totalDor += nota;
      maxDor = Math.max(maxDor, nota);
      diasComNota++;
      cell.dataset.intensidade = nota === 0 ? 'nenhuma' : nota <= 3 ? 'leve' : nota <= 6 ? 'moderada' : 'intensa';
      valorVisivel = nota + '/10';
    } else if (regDoDia) {
      valorVisivel = '';
    }

    cell.appendChild(Object.assign(document.createElement('span'), {className: 'heatmap-cell-day', textContent: i}));
    const marcador = Number.isFinite(nota) ? nota : regDoDia ? '•' : valorVisivel;
    if (marcador !== '') cell.appendChild(Object.assign(document.createElement('span'), {className: 'heatmap-cell-value', textContent: marcador}));
    if (treinosDoDia.length) {
      cell.classList.add('heatmap-workout-day');
      cell.title = treinosDoDia.length + ' treino(s) concluído(s)';
    }
    if (regDoDia || treinosDoDia.length) {
      (function(dia, registro) {
        cell.onclick = function() { abrirClimaSheet(dia, registro || null); };
        cell.tabIndex = 0;
        cell.setAttribute('role', 'button');
        var descricao = treinosDoDia.length ? ' e treinos concluídos' : '';
        cell.setAttribute('aria-label', 'Ver registros do dia ' + dia + (valorVisivel ? ' ' + valorVisivel : '') + descricao);
        cell.onkeydown = function(event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            abrirClimaSheet(dia, registro || null);
          }
        };
      })(i, regDoDia);
    }
    grid.appendChild(cell);
  }

  var nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  
  var elLabel = document.getElementById('mesLabel');
  if (elLabel) elLabel.textContent = (nomes[mesAtual.getMonth()] + ' ' + mesAtual.getFullYear()).toLowerCase();

  var lblFiltro = document.getElementById('historicoPeriodo');
  if (lblFiltro) {
    var textoFiltro = (filtroDorVisualizacao === 0) ? 'Dor em repouso' : 'Dor ao se movimentar';
    lblFiltro.textContent = 'Mês de ' + nomes[mesAtual.getMonth()] + ' · ' + textoFiltro;
  }

  var statsElements = document.querySelectorAll('.stat-value');
  if (statsElements.length >= 3) {
    statsElements[2].textContent = diasComRegistro;
    if (diasComNota > 0) {
      statsElements[0].textContent = (totalDor / diasComNota).toFixed(1).replace('.', ',') + '/10';
      statsElements[1].textContent = maxDor + '/10';
    } else {
      statsElements[0].textContent = '-';
      statsElements[1].textContent = '-';
    }
  }
}

function mudarMes(delta) {
  mesAtual = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + delta, 1);
  gerarHeatmap();
}

function resumirDor(nota, comparacao) {
  return [Number.isFinite(nota) ? nota + '/10' : '', comparacao].filter(Boolean).join(' · ') || 'Não registrada';
}

function fecharClimaSheet() {
  var sheet = document.getElementById('climaSheet');
  if (sheet) sheet.classList.remove('open');
}

function abrirClimaSheet(dia, reg) {
  var nomesMes = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  var titulo = document.getElementById('climaSheetTitle');
  if (titulo) titulo.textContent = 'Registro do dia ' + dia + ' de ' + nomesMes[mesAtual.getMonth()];

  var dor = document.getElementById('sheetDorNivel');
  if (dor) dor.textContent = reg
    ? 'Quando ficou parado: ' + resumirDor(reg.dorRepouso, reg.comparacaoParado) +
      ' | Ao se mexer: ' + resumirDor(reg.dorMovimento, reg.comparacaoMovimento)
    : 'Nenhum registro de dor neste dia';

  var intensidade = ['Nenhuma', 'Leve', 'Moderada', 'Intensa'];
  var rigidez = document.getElementById('sheetRigidez');
  var fadiga = document.getElementById('sheetFadiga');
  var humor = document.getElementById('sheetHumor');
  if (rigidez) rigidez.textContent = (reg ? intensidade[reg.rigidez] : null) || 'Não registrado';
  if (fadiga) fadiga.textContent = (reg ? intensidade[reg.fadiga] : null) || 'Não registrado';
  if (humor) humor.textContent = reg?.humor ?? 'Não registrado';
  const atividade = document.getElementById('sheetAtividade');
  if (atividade) atividade.textContent = reg?.atividade ?? 'Não registrada';

  var resumo = document.getElementById('sheetClimaDesc');
  if (resumo) {
    var clima = reg && reg.clima;
    if (clima && clima.temperatura != null && clima.umidade != null && clima.pressao != null) {
      resumo.textContent = (clima.cidade || 'Brasília') + ': ' +
        clima.temperatura + ' °C, umidade ' + clima.umidade + '% e pressão ' + clima.pressao +
        ' hPa. Observado em ' + new Date(clima.observadoEm || reg.data).toLocaleString('pt-BR') +
        ' (Open-Meteo).';
    } else {
      resumo.textContent = 'Não há dados meteorológicos salvos para este registro.';
    }
  }
  if (window.AppAuth && window.AppAuth.renderWorkoutDay) window.AppAuth.renderWorkoutDay(mesAtual.getFullYear(), mesAtual.getMonth(), dia);
  var sheet = document.getElementById('climaSheet');
  if (sheet) sheet.classList.add('open');
}

function obterRegistroHoje(hoje) {
  return registrosUsuario.findLast(function(registro) {
    return new Date(registro.data).toDateString() === hoje.toDateString();
  });
}

function verificarRegistroHoje() {
  var botao = document.getElementById('btnRegistrarSintomas');
  if (botao) {
    botao.textContent = obterRegistroHoje(new Date())
      ? 'Ver meu registro de sintomas'
      : 'Registrar sintomas';
  }
}

function abrirRegistroDiario() {
  var hoje = new Date();
  var registro = obterRegistroHoje(hoje);
  if (!registro) {
    navegarPara('sintomas');
    return;
  }
  mesAtual = hoje;
  navegarPara('historico');
  abrirClimaSheet(hoje.getDate(), registro);
  document.querySelector('#climaSheet .bottom-sheet-close')?.focus();
}

atualizarDataAtual();
gerarHeatmap();

const abrirVLibras = document.getElementById('abrirVLibras');
const painelVLibras = document.getElementById('painelVLibras');
if (abrirVLibras && painelVLibras) {
  const quadro = painelVLibras.querySelector('iframe');
  abrirVLibras.addEventListener('click', () => {
    quadro.src = 'https://vlibras.gov.br/app/';
    painelVLibras.showModal();
  });
  painelVLibras.addEventListener('close', () => quadro.removeAttribute('src'));
}
