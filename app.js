/* ========================================
   Autonomia em Movimento — JavaScript
   HUB / Universidade de Brasília
   ======================================== */

var registrosUsuario = [];
var treinosConcluidos = [];

var usuarioAtual = null;
var dorRepouso = 2;
var dorMovimento = 5;
var atipico = 0;
var rigidezAtual = 1;
var fadigaAtual = 1;
var humorAtual = 1;
var atividadeAtual = 1;
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

function alterarDor(tipo, delta) {
  if (tipo === 'rest') {
    dorRepouso = Math.max(0, Math.min(10, dorRepouso + delta));
    document.getElementById('restPainValue').textContent = dorRepouso + '/10';
    var pct = dorRepouso * 10;
    document.getElementById('restPainFill').style.width = pct + '%';
    document.getElementById('restPainThumb').style.left = 'calc(' + pct + '% - 9px)';
  } else {
    dorMovimento = Math.max(0, Math.min(10, dorMovimento + delta));
    document.getElementById('movPainValue').textContent = dorMovimento + '/10';
    var pct = dorMovimento * 10;
    document.getElementById('movPainFill').style.width = pct + '%';
    document.getElementById('movPainThumb').style.left = 'calc(' + pct + '% - 9px)';
  }
}

function selecionar(grupoId, indice) {
  var grupo = document.getElementById(grupoId);
  if (!grupo) return;
  var botoes = grupo.querySelectorAll('.choice-btn, .mood-btn');
  botoes.forEach(function(botao) { botao.classList.remove('selected'); });
  if (botoes[indice]) botoes[indice].classList.add('selected');

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

function concluirRegistro(event) {
  if (event) event.preventDefault();
  if (window.AppAuth) return window.AppAuth.saveSymptoms();
}

// ========================================
// GERAÇÃO DE HISTÓRICO E HEATMAP DINÂMICO
// ========================================

function gerarHeatmap() {
  var grid = document.getElementById('heatmapGrid');
  if (!grid) return;
  grid.innerHTML = '';

  var totalDor = 0, maxDor = 0, diasComRegistro = 0;
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
    var valorVisivel = treinosDoDia.length ? '✓' : '-';

    if (!regDoDia) {
      cell.style.backgroundColor = 'var(--superficie-neutra)';
      cell.style.borderColor = 'var(--linha)';
      cell.innerHTML = '<span class="heatmap-cell-day">' + i + '</span> <span class="heatmap-cell-value">' + valorVisivel + '</span>';
    } else {
      var v = (filtroDorVisualizacao === 0) ? regDoDia.dorRepouso : regDoDia.dorMovimento;
      totalDor += v;
      if (v > maxDor) maxDor = v;
      diasComRegistro++;

      cell.dataset.intensidade = v === 0 ? 'nenhuma' : v <= 3 ? 'leve' : v <= 6 ? 'moderada' : 'intensa';

      valorVisivel = v + '/10';
      cell.innerHTML = '<span class="heatmap-cell-day">' + i + '</span> <span class="heatmap-cell-value">' + valorVisivel + '</span>';
      
      (function(dia, reg) {
        cell.onclick = function() { abrirClimaSheet(dia, reg); };
      })(i, regDoDia);
    }
    if (treinosDoDia.length) {
      cell.classList.add('heatmap-workout-day');
      cell.title = treinosDoDia.length + ' treino(s) concluído(s)';
      if (regDoDia) {
        var marker = document.createElement('span');
        marker.className = 'heatmap-workout-marker';
        marker.textContent = ' ✓';
        cell.appendChild(marker);
      }
    }
    if (regDoDia || treinosDoDia.length) {
      (function(dia, registro) {
        cell.onclick = function() { abrirClimaSheet(dia, registro || null); };
        cell.tabIndex = 0;
        cell.setAttribute('role', 'button');
        var marcador = registro && treinosDoDia.length ? ' ✓' : '';
        var descricao = treinosDoDia.length ? ' e treinos concluídos' : '';
        cell.setAttribute('aria-label', 'Ver registros do dia ' + dia + ' ' + valorVisivel + marcador + descricao);
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
    var textoFiltro = (filtroDorVisualizacao === 0) ? 'Dor em repouso' : 'Dor ao movimento';
    lblFiltro.textContent = 'Mês de ' + nomes[mesAtual.getMonth()] + ' · ' + textoFiltro;
  }

  var statsElements = document.querySelectorAll('.stat-value');
  if (statsElements.length >= 3) {
    if (diasComRegistro > 0) {
      statsElements[0].textContent = (totalDor / diasComRegistro).toFixed(1).replace('.', ',') + '/10';
      statsElements[1].textContent = maxDor + '/10';
      statsElements[2].textContent = diasComRegistro;
    } else {
      statsElements[0].textContent = '-';
      statsElements[1].textContent = '-';
      statsElements[2].textContent = '0';
    }
  }
}

function mudarMes(delta) {
  mesAtual = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + delta, 1);
  gerarHeatmap();
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
  if (dor) dor.textContent = 'Dor ao movimento: ' + (reg ? reg.dorMovimento + '/10 (Repouso: ' + reg.dorRepouso + '/10)' : 'Nenhum registro de dor neste dia');

  var intensidade = ['Nenhuma', 'Leve', 'Moderada', 'Intensa'];
  var rigidez = document.getElementById('sheetRigidez');
  var fadiga = document.getElementById('sheetFadiga');
  var humor = document.getElementById('sheetHumor');
  if (rigidez) rigidez.textContent = (reg ? intensidade[reg.rigidez] : null) || 'Não registrado';
  if (fadiga) fadiga.textContent = (reg ? intensidade[reg.fadiga] : null) || 'Não registrado';
  if (humor) humor.textContent = 'Não registrado';

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

function verificarRegistroHoje() {
  var hoje = new Date().toDateString();
  var existe = registrosUsuario.some(function(r) {
    return new Date(r.data).toDateString() === hoje;
  });
  var botao = document.getElementById('btnRegistrarSintomas');
  var status = document.getElementById('registroDiarioStatus');
  if (botao) botao.hidden = existe;
  if (status) status.hidden = !existe;
}

atualizarDataAtual();
gerarHeatmap();
