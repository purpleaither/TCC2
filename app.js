/* ========================================
   Autonomia em Movimento — JavaScript
   HUB / Universidade de Brasília
   ======================================== */

var registrosUsuario = [];
var treinosConcluidos = [];

var dorRepouso = 2;
var dorMovimento = 5;
var atipico = 0;
var rigidezAtual = 1;
var fadigaAtual = 1;
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
