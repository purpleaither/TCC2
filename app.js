/* ========================================
   Autonomia em Movimento — JavaScript
   HUB / Universidade de Brasília
   ======================================== */

var registrosUsuario = [];

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
  if (header) header.style.display = visivel ? 'flex' : 'none';
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
  if (drawer) drawer.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open');
}

function fecharMenu() {
  var drawer = document.getElementById('menuDrawer');
  var overlay = document.getElementById('menuOverlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
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

    var cell = document.createElement('div');
    cell.className = 'heatmap-cell';

    if (!regDoDia) {
      cell.style.backgroundColor = '#f9f9f9';
      cell.style.borderColor = '#ddd';
      cell.innerHTML = '<span class="heatmap-cell-day" style="color:#888">' + i + '</span><span class="heatmap-cell-value" style="color:#888">-</span>';
    } else {
      var v = (filtroDorVisualizacao === 0) ? regDoDia.dorRepouso : regDoDia.dorMovimento;
      totalDor += v;
      if (v > maxDor) maxDor = v;
      diasComRegistro++;

      if (v === 0) cell.style.backgroundColor = '#f4f4f4';
      else if (v <= 3) cell.style.backgroundColor = '#ffe48a';
      else if (v <= 6) cell.style.backgroundColor = '#ffb464';
      else cell.style.backgroundColor = '#f17b72';

      cell.innerHTML = '<span class="heatmap-cell-day">' + i + '</span><span class="heatmap-cell-value">' + v + '/10</span>';
      
      (function(dia, reg) {
        cell.onclick = function() { abrirClimaSheet(dia, reg); };
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

function apresentarClimaNoPainel(registro) {
  var card = document.getElementById('climaLiberado');
  if (!card) return;
  card.replaceChildren();
  var titulo = document.createElement('h3');
  titulo.className = 'weather-title';
  titulo.textContent = 'Informações meteorológicas';
  card.append(titulo);

  var main = document.createElement('p');
  main.className = 'weather-main';
  var detalhe = document.createElement('p');
  detalhe.className = 'weather-detail';
  var observacao = document.createElement('p');
  observacao.className = 'card-text-small';

  var clima = registro && registro.clima;
  if (clima && clima.temperatura != null && clima.umidade != null && clima.pressao != null) {
    main.textContent = '☀ ' + (clima.cidade || 'Brasília') + ' · ' + clima.temperatura + ' °C';
    detalhe.textContent = 'Umidade: ' + clima.umidade + '% · Pressão: ' + clima.pressao + ' hPa';
    observacao.textContent = 'Condições registradas em ' + new Date(clima.observadoEm || registro.data).toLocaleString('pt-BR') + '. Fonte: Open-Meteo.';
  } else {
    main.textContent = 'Dados meteorológicos não disponíveis';
    detalhe.textContent = 'Não foi possível associar informações meteorológicas a este registro.';
    observacao.textContent = 'Os sintomas permanecem salvos. O clima não será substituído por uma medição de outra data.';
  }
  card.append(main, detalhe, observacao);
}

function abrirClimaSheet(dia, reg) {
  var nomesMes = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  var titulo = document.getElementById('climaSheetTitle');
  if (titulo) titulo.textContent = 'Registro do dia ' + dia + ' de ' + nomesMes[mesAtual.getMonth()];

  var dor = document.getElementById('sheetDorNivel');
  if (dor) dor.textContent = 'Dor ao movimento: ' + reg.dorMovimento + '/10 (Repouso: ' + reg.dorRepouso + '/10)';

  var intensidade = ['Nenhuma', 'Leve', 'Moderada', 'Intensa'];
  var rigidez = document.getElementById('sheetRigidez');
  var fadiga = document.getElementById('sheetFadiga');
  var humor = document.getElementById('sheetHumor');
  if (rigidez) rigidez.textContent = intensidade[reg.rigidez] || 'Não registrado';
  if (fadiga) fadiga.textContent = intensidade[reg.fadiga] || 'Não registrado';
  if (humor) humor.textContent = 'Não registrado';

  var resumo = document.getElementById('sheetClimaDesc');
  if (resumo) {
    var clima = reg.clima;
    if (clima && clima.temperatura != null && clima.umidade != null && clima.pressao != null) {
      resumo.textContent = (clima.cidade || 'Brasília') + ': ' +
        clima.temperatura + ' °C, umidade ' + clima.umidade + '% e pressão ' + clima.pressao +
        ' hPa. Observado em ' + new Date(clima.observadoEm || reg.data).toLocaleString('pt-BR') +
        ' (Open-Meteo).';
    } else {
      resumo.textContent = 'Não há dados meteorológicos salvos para este registro.';
    }
  }
  var sheet = document.getElementById('climaSheet');
  if (sheet) sheet.classList.add('open');
}

function verificarRegistroHoje() {
  var hoje = new Date().toDateString();
  var existe = registrosUsuario.some(function(r) {
    return new Date(r.data).toDateString() === hoje;
  });
  var botao = document.getElementById('btnRegistrarSintomas');
  var bloqueado = document.getElementById('climaBloqueado');
  var liberado = document.getElementById('climaLiberado');
  if (botao) {
    botao.textContent = existe ? 'Sintomas já registrados hoje ✓' : 'Registrar sintomas';
    botao.style.background = existe ? '#4a7c59' : '';
  }
  if (bloqueado) bloqueado.style.display = existe ? 'none' : 'block';
  if (liberado) liberado.style.display = existe ? 'block' : 'none';
  if (existe) {
    var hojeRegistro = registrosUsuario.slice().reverse().find(function(r) {
      return new Date(r.data).toDateString() === hoje;
    });
    apresentarClimaNoPainel(hojeRegistro);
  }
}

atualizarDataAtual();
gerarHeatmap();
