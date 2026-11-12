/* ========================================
   Autonomia em Movimento — JavaScript
   HUB / Universidade de Brasília
   ======================================== */

var CHAVE_STORAGE = 'autonomia_usuario_sessao';
var CHAVE_REGISTROS = 'autonomia_registros_historico';
var registrosUsuario = [];

// Carrega os registros salvos ao iniciar a aplicação
function carregarRegistrosSalvos() {
  var salvos = localStorage.getItem(CHAVE_REGISTROS);
  if (salvos) {
    try {
      registrosUsuario = JSON.parse(salvos);
    } catch (e) {
      registrosUsuario = [];
    }
  }
}
carregarRegistrosSalvos();

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

function verificarSessao() {
  // Sem atribuição automática de exercícios. A prescrição caberá ao fisioterapeuta.
  var dadosSalvos = localStorage.getItem(CHAVE_STORAGE) || sessionStorage.getItem(CHAVE_STORAGE);
  if (dadosSalvos) {
    try {
      usuarioAtual = JSON.parse(dadosSalvos);
      aplicarUsuarioNaInterface(usuarioAtual.nome);
      mostrarCabecalho(true);
      navegarPara('inicio');
      return;
    } catch (e) {}
  }
  mostrarCabecalho(false);
  navegarPara('login');
}

function realizarLogin(event) {
  if (event) event.preventDefault();
  var nomeInput = document.getElementById('loginNome');
  var lembrar = document.getElementById('rememberMe').checked;
  var nome = (nomeInput && nomeInput.value.trim()) ? nomeInput.value.trim() : 'Maria Silva';
  usuarioAtual = { nome: nome, dataLogin: new Date().toISOString() };
  var dadosJson = JSON.stringify(usuarioAtual);
  if (lembrar) localStorage.setItem(CHAVE_STORAGE, dadosJson);
  else sessionStorage.setItem(CHAVE_STORAGE, dadosJson);
  aplicarUsuarioNaInterface(nome);
  mostrarCabecalho(true);
  navegarPara('inicio');
}

function realizarLogout() {
  localStorage.removeItem(CHAVE_STORAGE);
  sessionStorage.removeItem(CHAVE_STORAGE);
  usuarioAtual = null;
  fecharMenu();
  mostrarCabecalho(false);
  navegarPara('login');
}

function validarTcle() {
  var aceite = document.getElementById('aceiteTcle');
  if (!aceite || !aceite.checked) {
    alert('Você deve aceitar os termos do consentimento para prosseguir.');
    return;
  }
  navegarPara('questionario-inicial');
}

function concluirOnboarding() {
  var nomeInput = document.getElementById('qNome');
  var nome = (nomeInput && nomeInput.value.trim()) ? nomeInput.value.trim() : 'Maria Silva';

  usuarioAtual = {
    nome: nome,
    dataLogin: new Date().toISOString()
  };

  localStorage.setItem(CHAVE_STORAGE, JSON.stringify(usuarioAtual));
  aplicarUsuarioNaInterface(nome);
  mostrarCabecalho(true);
  navegarPara('inicio');
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
  var paginas = document.querySelectorAll('.page');
  for (var i = 0; i < paginas.length; i++) paginas[i].classList.remove('active');
  var destino = document.getElementById('page-' + pagina);
  if (destino) destino.classList.add('active');
  
  if (pagina === 'login' || pagina === 'boas-vindas' || pagina === 'tcle' || pagina === 'questionario-inicial') {
    mostrarCabecalho(false);
  } else {
    mostrarCabecalho(true);
  }
  
  var itens = document.querySelectorAll('.menu-item');
  for (var i = 0; i < itens.length; i++) itens[i].classList.remove('active');
  var mapaMenu = { 'inicio': 0, 'sintomas': 1, 'historico': 2, 'orientacoes': 3, 'exercicios': 4, 'contatos': 5 };
  if (mapaMenu[pagina] !== undefined && itens[mapaMenu[pagina]]) itens[mapaMenu[pagina]].classList.add('active');
  
  fecharMenu();
  fecharClimaSheet();
  window.scrollTo(0, 0);
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
  buscarClimaReal();
  var maiorDor = Math.max(dorRepouso, dorMovimento);
  
  var registro = {
    data: new Date().toISOString(),
    dorRepouso: dorRepouso,
    dorMovimento: dorMovimento,
    maiorDor: maiorDor,
    rigidez: rigidezAtual,
    fadiga: fadigaAtual,
    humor: humorAtual,
    atividade: atividadeAtual,
    sinalAtipico: atipico === 1
  };

  registrosUsuario.push(registro);
  localStorage.setItem(CHAVE_REGISTROS, JSON.stringify(registrosUsuario));
  gerarHeatmap();

  var climaBloq = document.getElementById('climaBloqueado');
  var climaLib = document.getElementById('climaLiberado');
  if (climaBloq) climaBloq.style.display = 'none';
  if (climaLib) climaLib.style.display = 'block';

  // Registrar sintomas não modifica nem bloqueia exercícios prescritos.
  if (registro.sinalAtipico || maiorDor >= 8) {
    alert('Registro salvo. Para sintomas intensos ou inesperados, procure orientação profissional. Esta plataforma não faz triagem clínica nem altera exercícios automaticamente.');
  }
  navegarPara('inicio');
}

function concluirTreino() {
  treinoConcluido = true;
  var btn = document.getElementById('btnConcluirTreino');
  if (btn) {
    btn.textContent = 'Treino concluído!';
    btn.disabled = true;
    btn.style.background = '#005528';
  }
  setTimeout(function() { navegarPara('inicio'); }, 500);
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
    var regDoDia = registrosUsuario.find(function(r) {
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

function abrirClimaSheet(dia, reg) {
  var nomesMes = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  
  var elTitle = document.getElementById('climaSheetTitle');
  if (elTitle) elTitle.textContent = 'Registro do dia ' + dia + ' de ' + nomesMes[mesAtual.getMonth()];

  var sheet = document.getElementById('climaSheet');
  if (sheet) sheet.classList.add('open');
}

function fecharClimaSheet() {
  var sheet = document.getElementById('climaSheet');
  if (sheet) sheet.classList.remove('open');
}

function buscarClimaReal() {
  var latitude = -15.7801;
  var longitude = -47.9292;
  
  var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + latitude + '&longitude=' + longitude + '&current=temperature_2m,relative_humidity_2m,surface_pressure';

  fetch(url)
    .then(function(response) { return response.json(); })
    .then(function(data) {
      var temp = data.current.temperature_2m;
      var umidade = data.current.relative_humidity_2m;
      var pressao = data.current.surface_pressure;

      var cardClima = document.getElementById('climaLiberado');
      if (cardClima) {
        cardClima.innerHTML = 
          '<h3 class="weather-title">Informações meteorológicas</h3>' +
          '<p class="weather-main">☀ Brasília · ' + temp + ' °C</p>' +
          '<p class="weather-detail">Umidade: ' + umidade + '% · Pressão: ' + pressao + ' hPa</p>' +
          '<p class="card-text-small">Atualizado em tempo real para sua região após o registro diário.</p>';
      }
    })
    .catch(function(error) {
      console.error('Erro ao buscar clima:', error);
    });
}
// --- CORREÇÃO DO HISTÓRICO (Preenche rigidez, fadiga e humor salvos) ---
function abrirClimaSheet(dia, reg) {
  var nomesMes = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  
  var elTitle = document.getElementById('climaSheetTitle');
  if (elTitle) elTitle.textContent = 'Registro do dia ' + dia + ' de ' + nomesMes[mesAtual.getMonth()];

  var elDor = document.getElementById('sheetDorNivel');
  if (elDor) elDor.textContent = 'Dor ao movimento: ' + reg.dorMovimento + '/10 (Repouso: ' + reg.dorRepouso + '/10)';

  var textosIntensidade = ['Nenhuma', 'Leve', 'Moderada', 'Intensa'];
  var textosHumor = ['Bem', 'Regular', 'Desanimado'];

  var elRigidez = document.getElementById('sheetRigidez');
  if (elRigidez) elRigidez.textContent = textosIntensidade[reg.rigidez] !== undefined ? textosIntensidade[reg.rigidez] : 'Leve';

  var elFadiga = document.getElementById('sheetFadiga');
  if (elFadiga) elFadiga.textContent = textosIntensidade[reg.fadiga] !== undefined ? textosIntensidade[reg.fadiga] : 'Leve';

  var elHumor = document.getElementById('sheetHumor');
  if (elHumor) elHumor.textContent = textosHumor[reg.humor] !== undefined ? textosHumor[reg.humor] : 'Regular';
  
  var sheet = document.getElementById('climaSheet');
  if (sheet) sheet.classList.add('open');
}

// --- FEEDBACK VISUAL NA HOME (Sintomas e Treino Concluídos) ---
function verificarRegistroHoje() {
  var hojeStr = new Date().toDateString();
  var jaRegistrou = registrosUsuario.some(function(r) {
    return new Date(r.data).toDateString() === hojeStr;
  });

  var btnRegistro = document.getElementById('btnRegistrarSintomas');
  var climaBloq = document.getElementById('climaBloqueado');
  var climaLib = document.getElementById('climaLiberado');

  if (jaRegistrou) {
    registroEnviadoHoje = true;
    if (btnRegistro) {
      btnRegistro.textContent = 'Sintomas já registrados hoje ✓';
      btnRegistro.style.background = '#4a7c59';
    }
    if (climaBloq) climaBloq.style.display = 'none';
    if (climaLib) climaLib.style.display = 'block';
  }

  // Verifica treino do dia
  var treinoSalvo = localStorage.getItem('autonomia_treino_concluido_hoje');
  if (treinoSalvo === hojeStr) {
    treinoConcluido = true;
    var btnTreinoHome = document.getElementById('homeBtnExercicios');
    if (btnTreinoHome) {
      btnTreinoHome.textContent = 'Treino concluído hoje ✓';
      btnTreinoHome.style.background = '#4a7c59';
    }
  }
}

// Atualize também a função concluirTreino para salvar o status de hoje:
function concluirTreino() {
  treinoConcluido = true;
  var hojeStr = new Date().toDateString();
  localStorage.setItem('autonomia_treino_concluido_hoje', hojeStr);

  var btn = document.getElementById('btnConcluirTreino');
  if (btn) {
    btn.textContent = 'Treino concluído!';
    btn.disabled = true;
    btn.style.background = '#005528';
  }

  var btnTreinoHome = document.getElementById('homeBtnExercicios');
  if (btnTreinoHome) {
    btnTreinoHome.textContent = 'Treino concluído hoje ✓';
    btnTreinoHome.style.background = '#4a7c59';
  }

  setTimeout(function() { navegarPara('inicio'); }, 500);
}

atualizarDataAtual();
gerarHeatmap();
