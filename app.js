/* ========================================
   Autonomia em Movimento — JavaScript
   HUB / Universidade de Brasília
   ======================================== */

var CHAVE_STORAGE = 'autonomia_usuario_sessao';
var CHAVE_PERFIL_EXERCICIO = 'autonomia_perfil_exercicio';

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
var registrosDemo = [];
var perfilExercicioAtivo = 'mobilidade';
var mesAtual = new Date(); 
var filtroDorVisualizacao = 1; // 0 = Repouso, 1 = Movimento
var mesAtualObj = { mes: 0, ano: 0, dados: [] };

var PERFIS_EXERCICIOS = {
  fortalecimento: {
    chave: 'fortalecimento',
    nome: 'Fortalecimento e Manutenção',
    evaRange: 'EVA de 0 a 3',
    badge: 'Dor leve ou ausente',
    descCurta: 'Exercícios de controle motor e fortalecimento leve com carga corporal para dor leve ou ausente.',
    objetivo: 'Manter a capacidade funcional e os ganhos obtidos no atendimento presencial no HUB/UnB.',
    exercicioTitulo: 'Exercício 1: Ponte com ativação de glúteos e controle motor',
    visualLabel: 'Controle Motor e Carga Corporal Leve',
    instrucoes: 'Realize 3 séries de 10 a 12 repetições. Movimentos controlados com sustentação de 2 segundos no topo, focando na estabilidade do tronco.',
    subInstrucoes: 'Mantenha a respiração suave e constante durante todo o movimento.',
    mostrarTpe: false,
    tpeTexto: 'Dica HUB: Manter os músculos ativos nos dias de dor leve consolida sua autonomia e previne crises.'
  },
  mobilidade: {
    chave: 'mobilidade',
    nome: 'Mobilidade e Alongamento',
    evaRange: 'EVA de 4 a 7',
    badge: 'Dor moderada',
    descCurta: 'Exercícios de mobilidade ativa e alongamentos leves combinados a pílulas educativas (TPE).',
    objetivo: 'Aliviar a rigidez e desensibilizar o medo do movimento.',
    exercicioTitulo: 'Exercício 1: Mobilidade suave e respiração diafragmática',
    visualLabel: 'Mobilidade Ativa e Desensibilização',
    instrucoes: 'Realize 3 séries de 30 segundos. Movimentos lentos e suaves até o ponto de conforto, sem forçar a articulação.',
    subInstrucoes: 'Respeite os limites do seu corpo hoje. O foco é soltar a musculatura e aliviar a rigidez.',
    mostrarTpe: true,
    tpeTexto: 'Sentir um desconforto moderado e tolerável durante o movimento é normal e seguro. Mover-se com calma ensina o cérebro que o movimento não representa perigo.'
  },
  bloqueio: {
    chave: 'bloqueio',
    nome: 'Rotina Suspensa (Trava de Segurança)',
    evaRange: 'EVA 8 a 10 ou Atípicos',
    badge: 'Alerta de Segurança',
    descCurta: 'Bloqueio automático de qualquer rotina de exercício diante de dor intensa ou relato de sinais de alarme.',
    objetivo: 'Interrupção preventiva e direcionamento para atendimento presencial.'
  }
};

function verificarSessao() {
  var perfilSalvo = localStorage.getItem(CHAVE_PERFIL_EXERCICIO);
  if (perfilSalvo && PERFIS_EXERCICIOS[perfilSalvo]) {
    aplicarPerfilExercicios(perfilSalvo);
  } else {
    aplicarPerfilExercicios('mobilidade');
  }
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
  mostrarCabecalho(pagina !== 'login');
  
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
    // CONEXÃO DO FILTRO DA DOR COM O MAPA DE CALOR:
    case 'filtDorOptions': 
      filtroDorVisualizacao = indice; 
      gerarHeatmap(); 
      break;
  }
}

function aplicarPerfilExercicios(tipo) {
  var perfil = PERFIS_EXERCICIOS[tipo];
  if (!perfil) return;
  perfilExercicioAtivo = tipo;
  localStorage.setItem(CHAVE_PERFIL_EXERCICIO, tipo);

  var homeLabel = document.getElementById('homeRoutineLabel');
  var homeValue = document.getElementById('homeRoutineValue');
  var homeDesc = document.getElementById('homeRoutineDesc');
  var homeBtn = document.getElementById('homeBtnExercicios');

  if (tipo === 'bloqueio') {
    if (homeLabel) homeLabel.textContent = 'Status da rotina:';
    if (homeValue) { homeValue.textContent = '⚠ Rotina Suspensa'; homeValue.style.color = '#cc0000'; }
    if (homeDesc) homeDesc.textContent = perfil.descCurta;
    if (homeBtn) { homeBtn.textContent = 'Ver alerta de segurança'; homeBtn.className = 'btn btn-danger'; homeBtn.onclick = function() { navegarPara('alerta'); }; }
  } else {
    if (homeLabel) homeLabel.textContent = 'Rotina recomendada (' + perfil.evaRange + '):';
    if (homeValue) { homeValue.textContent = perfil.nome; homeValue.style.color = '#006633'; }
    if (homeDesc) homeDesc.textContent = perfil.descCurta;
    if (homeBtn) { homeBtn.textContent = 'Abrir meus exercícios'; homeBtn.className = 'btn'; homeBtn.onclick = function() { navegarPara('exercicios'); }; }
  }

  var lockedCard = document.getElementById('exLockedCard');
  var normalContainer = document.getElementById('exNormalContainer');
  var exName = document.getElementById('exRoutineName');
  var exGoal = document.getElementById('exRoutineGoal');
  var exTitle = document.getElementById('exExerciseTitle');
  var exVisualLabel = document.getElementById('exVisualLabel');
  var exInstructions = document.getElementById('exInstructions');
  var exSubInstructions = document.getElementById('exSubInstructions');
  var exTpeCard = document.getElementById('exTpeCard');
  var exTpeText = document.getElementById('exTpeText');

  if (tipo === 'bloqueio') {
    if (lockedCard) lockedCard.style.display = 'block';
    if (normalContainer) normalContainer.style.display = 'none';
  } else {
    if (lockedCard) lockedCard.style.display = 'none';
    if (normalContainer) normalContainer.style.display = 'block';
    if (exName) exName.textContent = perfil.nome + ' (' + perfil.evaRange + ')';
    if (exGoal) exGoal.textContent = 'Objetivo: ' + perfil.objetivo;
    if (exTitle) exTitle.textContent = perfil.exercicioTitulo;
    if (exVisualLabel) exVisualLabel.textContent = perfil.visualLabel;
    if (exInstructions) exInstructions.textContent = perfil.instrucoes;
    if (exSubInstructions) exSubInstructions.textContent = perfil.subInstrucoes;
    if (exTpeCard) {
      if (perfil.mostrarTpe) { exTpeCard.style.display = 'block'; if (exTpeText) exTpeText.textContent = perfil.tpeTexto; } 
      else { exTpeCard.style.display = 'none'; }
    }
  }

  var btnTreino = document.getElementById('btnConcluirTreino');
  if (btnTreino) { btnTreino.textContent = 'Concluir treino'; btnTreino.disabled = false; btnTreino.style.background = '#006633'; }
}

function concluirRegistro(event) {
  if (event) event.preventDefault();
  buscarClimaReal();
  var maiorDor = Math.max(dorRepouso, dorMovimento);
  var registro = { sinalAtipico: atipico === 1 };

  var climaBloq = document.getElementById('climaBloqueado');
  var climaLib = document.getElementById('climaLiberado');
  if (climaBloq) climaBloq.style.display = 'none';
  if (climaLib) climaLib.style.display = 'block';

  if (registro.sinalAtipico || maiorDor >= 8) {
    aplicarPerfilExercicios('bloqueio');
    navegarPara('alerta');
    return;
  }
  if (maiorDor <= 3) aplicarPerfilExercicios('fortalecimento');
  else aplicarPerfilExercicios('mobilidade');
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
// GERAÇÃO DE DADOS E HEATMAP DINÂMICO
// ========================================

function atualizarDadosDoMes() {
  mesAtualObj.mes = mesAtual.getMonth();
  mesAtualObj.ano = mesAtual.getFullYear();
  var dados = [];
  var hoje = new Date();
  var numDias = new Date(mesAtualObj.ano, mesAtualObj.mes + 1, 0).getDate();
  var arrIntensidade = ['Nenhuma', 'Leve', 'Moderada', 'Intensa'];
  var arrHumor = ['Bem', 'Regular', 'Desanimado'];

  for (var i = 1; i <= numDias; i++) {
    if (mesAtualObj.ano > hoje.getFullYear() || 
       (mesAtualObj.ano === hoje.getFullYear() && mesAtualObj.mes > hoje.getMonth()) || 
       (mesAtualObj.ano === hoje.getFullYear() && mesAtualObj.mes === hoje.getMonth() && i > hoje.getDate())) {
      dados.push(null); 
    } else {
      var dMov = Math.floor(Math.random() * 10);
      var dRep = Math.max(0, dMov - Math.floor(Math.random() * 4)); // Repouso geralmente menor
      dados.push({
        dorRepouso: dRep,
        dorMovimento: dMov,
        rigidez: arrIntensidade[Math.floor(Math.random() * 4)],
        fadiga: arrIntensidade[Math.floor(Math.random() * 4)],
        humor: arrHumor[Math.floor(Math.random() * 3)],
        clima: "Variação térmica brusca e umidade do ar em 45%."
      });
    }
  }
  mesAtualObj.dados = dados;
}

function gerarHeatmap() {
  var grid = document.getElementById('heatmapGrid');
  if (!grid) return;
  grid.innerHTML = ''; 

  var ano = mesAtualObj.ano;
  var mes = mesAtualObj.mes;
  var numDias = mesAtualObj.dados.length;
  
  var primeiroDiaSemana = new Date(ano, mes, 1).getDay(); 
  var offset = (primeiroDiaSemana === 0) ? 6 : primeiroDiaSemana - 1;

  for (var i = 0; i < offset; i++) {
    var emptyCell = document.createElement('div');
    emptyCell.className = 'heatmap-cell';
    emptyCell.style.border = 'none';
    emptyCell.style.background = 'transparent';
    emptyCell.style.cursor = 'default';
    grid.appendChild(emptyCell);
  }

  var totalDor = 0, maxDor = 0, diasComRegistro = 0;

  for (var i = 0; i < numDias; i++) {
    var item = mesAtualObj.dados[i];
    var cell = document.createElement('div');
    cell.className = 'heatmap-cell';

    if (item === null) {
      cell.style.backgroundColor = '#fafafa';
      cell.style.borderColor = '#eee';
      cell.style.cursor = 'default';
      cell.innerHTML = '<span class="heatmap-cell-day" style="color:#ccc">' + (i + 1) + '</span><span class="heatmap-cell-value" style="color:#ccc">-</span>';
    } else {
      var v = (filtroDorVisualizacao === 0) ? item.dorRepouso : item.dorMovimento;
      totalDor += v;
      if (v > maxDor) maxDor = v;
      diasComRegistro++;

      if (v === 0) cell.style.backgroundColor = '#f4f4f4';
      else if (v <= 3) cell.style.backgroundColor = '#ffe48a';
      else if (v <= 6) cell.style.backgroundColor = '#ffb464';
      else cell.style.backgroundColor = '#f17b72';

      cell.innerHTML = '<span class="heatmap-cell-day">' + (i + 1) + '</span><span class="heatmap-cell-value">' + v + '/10</span>';
      
      (function(dia, dadosDia, valorDor) {
        cell.onclick = function() { abrirClimaSheet(dia, dadosDia, valorDor); };
      })(i + 1, item, v);
    }
    grid.appendChild(cell);
  }

  // ATUALIZA A TELA (Mês forçado para minúsculo e Estatísticas da visão global)
  var nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  
  var elLabel = document.getElementById('mesLabel');
  if (elLabel) elLabel.textContent = (nomes[mes] + ' ' + ano).toLowerCase();

  var lblFiltro = document.getElementById('historicoPeriodo');
  if (lblFiltro) {
    var textoFiltro = (filtroDorVisualizacao === 0) ? 'Dor em repouso' : 'Dor ao movimento';
    var diaFim = Math.min(new Date().getDate(), numDias);
    if (ano < new Date().getFullYear() || mes < new Date().getMonth()) diaFim = numDias;
    lblFiltro.textContent = '1–' + diaFim + ' de ' + nomes[mes].substring(0,3) + '. · ' + textoFiltro;
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
  atualizarDadosDoMes();
  gerarHeatmap();
}

function abrirClimaSheet(dia, dadosDia, valorDor) {
  var nomesMes = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  
  var elTitle = document.getElementById('climaSheetTitle');
  if (elTitle) elTitle.textContent = 'Dia ' + dia + ' de ' + nomesMes[mesAtual.getMonth()];

  var elDor = document.getElementById('sheetDorNivel');
  if (elDor) elDor.textContent = ((filtroDorVisualizacao === 0) ? 'Dor em repouso' : 'Dor ao movimento') + ': ' + valorDor + '/10';

  var elRigidez = document.getElementById('sheetRigidez');
  if (elRigidez) elRigidez.textContent = dadosDia.rigidez;

  var elFadiga = document.getElementById('sheetFadiga');
  if (elFadiga) elFadiga.textContent = dadosDia.fadiga;

  var elHumor = document.getElementById('sheetHumor');
  if (elHumor) elHumor.textContent = dadosDia.humor;
  
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
   function validarTcle() {
  var aceite = document.getElementById('aceiteTcle').checked;
  if (!aceite) {
    alert('Deve aceitar os termos do consentimento para prosseguir.');
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

}

atualizarDataAtual();
atualizarDadosDoMes();
gerarHeatmap();
verificarSessao();
