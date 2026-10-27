/* ========================================
   Autonomia em Movimento — JavaScript
   HUB / Universidade de Brasília
   ======================================== */

// Chave para armazenamento no localStorage
var CHAVE_STORAGE = 'autonomia_usuario_sessao';
var CHAVE_PERFIL_EXERCICIO = 'autonomia_perfil_exercicio';

// Estado global do aplicativo
var usuarioAtual = null;
var dorRepouso = 2;
var dorMovimento = 5;
var atipico = 0;
var treinoConcluido = false;
var perfilExercicioAtivo = 'mobilidade';
var mesAtual = new Date(2025, 4, 1); // maio 2025

// ========================================
// MATRIZ DE RECOMENDAÇÃO CLÍNICA DE EXERCÍCIOS
// ========================================
var PERFIS_EXERCICIOS = {
  // 1. Perfil de Fortalecimento e Manutenção (EVA de 0 a 3)
  fortalecimento: {
    chave: 'fortalecimento',
    nome: 'Fortalecimento e Manutenção',
    evaRange: 'EVA de 0 a 3',
    badge: 'Dor leve ou ausente',
    descCurta: 'Exercícios de controle motor e fortalecimento leve com carga corporal para dor leve ou ausente.',
    objetivo: 'Manter a capacidade funcional e os ganhos obtidos no atendimento presencial no HUB/UnB.',
    exercicioTitulo: 'Exercício 1: Ponte com ativação de glúteos e controle motor',
    visualLabel: 'Controle Motor e Carga Corporal Leve',
    instrucoes: 'Realize 3 séries de 10 a 12 repetições. Movimentos controlados com sustentação de 2 segundos no topo, focando na estabilidade do tronco e sem sobrecarregar a coluna.',
    subInstrucoes: 'Mantenha a respiração suave e constante durante todo o movimento.',
    mostrarTpe: false,
    tpeTexto: 'Dica HUB/UnB: Manter os músculos ativos nos dias de dor leve consolida sua autonomia e previne o retorno de crises.'
  },

  // 2. Perfil de Mobilidade e Alongamento (EVA de 4 a 7)
  mobilidade: {
    chave: 'mobilidade',
    nome: 'Mobilidade e Alongamento',
    evaRange: 'EVA de 4 a 7',
    badge: 'Dor moderada',
    descCurta: 'Exercícios de mobilidade ativa e alongamentos leves combinados a pílulas educativas de Educação Terapêutica do Paciente (TPE).',
    objetivo: 'Aliviar a rigidez e desensibilizar o medo do movimento.',
    exercicioTitulo: 'Exercício 1: Mobilidade suave e respiração diafragmática',
    visualLabel: 'Mobilidade Ativa e Desensibilização',
    instrucoes: 'Realize 3 séries de 30 segundos. Movimentos lentos e suaves até o ponto de conforto, sem forçar a articulação e sem prender o ar.',
    subInstrucoes: 'Respeite os limites do seu corpo hoje. O foco é soltar a musculatura e aliviar a rigidez.',
    mostrarTpe: true,
    tpeTexto: 'Sentir um desconforto moderado e tolerável durante o movimento é normal e seguro. Mover-se com calma ensina o cérebro que o movimento não representa perigo.'
  },

  // 3. Perfil de Segurança e Bloqueio (EVA de 8 a 10 ou Sinais Atípicos)
  bloqueio: {
    chave: 'bloqueio',
    nome: 'Rotina Suspensa (Trava de Segurança)',
    evaRange: 'EVA de 8 a 10 ou Sinais Atípicos',
    badge: 'Alerta de Segurança',
    descCurta: 'Bloqueio automático de qualquer rotina de exercício diante de dor intensa ou relato de sinais de alarme.',
    objetivo: 'Interrupção preventiva e direcionamento imediato para atendimento presencial no HUB/UnB ou SAMU 192.'
  }
};

// ========================================
// 1. AUTENTICAÇÃO E PERSISTÊNCIA DE LOGIN
// ========================================

function verificarSessao() {
  // Restaura recomendação de exercício salva ou inicia com padrão
  var perfilSalvo = localStorage.getItem(CHAVE_PERFIL_EXERCICIO);
  if (perfilSalvo && PERFIS_EXERCICIOS[perfilSalvo]) {
    aplicarPerfilExercicios(perfilSalvo);
  } else {
    aplicarPerfilExercicios('mobilidade');
  }

  // Tenta carregar do localStorage (lembrar de mim) ou sessionStorage
  var dadosSalvos = localStorage.getItem(CHAVE_STORAGE) || sessionStorage.getItem(CHAVE_STORAGE);
  
  if (dadosSalvos) {
    try {
      usuarioAtual = JSON.parse(dadosSalvos);
      aplicarUsuarioNaInterface(usuarioAtual.nome);
      mostrarCabecalho(true);
      navegarPara('inicio');
      return;
    } catch (e) {
      console.error('Erro ao ler sessão salva', e);
    }
  }

  // Se não estiver logado, exibe tela de login
  mostrarCabecalho(false);
  navegarPara('login');
}

function realizarLogin(event) {
  if (event) event.preventDefault();

  var nomeInput = document.getElementById('loginNome');
  var lembrar = document.getElementById('rememberMe').checked;
  var nome = (nomeInput && nomeInput.value.trim()) ? nomeInput.value.trim() : 'Maria Silva';

  usuarioAtual = {
    nome: nome,
    dataLogin: new Date().toISOString()
  };

  // Salva no storage apropriado
  var dadosJson = JSON.stringify(usuarioAtual);
  if (lembrar) {
    localStorage.setItem(CHAVE_STORAGE, dadosJson);
  } else {
    sessionStorage.setItem(CHAVE_STORAGE, dadosJson);
  }

  aplicarUsuarioNaInterface(nome);
  mostrarCabecalho(true);
  navegarPara('inicio');
}

function realizarLogout() {
  // Limpa ambos os storages
  localStorage.removeItem(CHAVE_STORAGE);
  sessionStorage.removeItem(CHAVE_STORAGE);
  usuarioAtual = null;

  // Fecha menu se aberto
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
  if (header) {
    header.style.display = visivel ? 'flex' : 'none';
  }
}

// ========================================
// 2. NAVEGAÇÃO ENTRE TELAS
// ========================================

function navegarPara(pagina) {
  // Esconde todas as páginas
  var paginas = document.querySelectorAll('.page');
  for (var i = 0; i < paginas.length; i++) {
    paginas[i].classList.remove('active');
  }

  // Exibe a página de destino
  var destino = document.getElementById('page-' + pagina);
  if (destino) {
    destino.classList.add('active');
  }

  // Controla exibição do cabeçalho
  if (pagina === 'login') {
    mostrarCabecalho(false);
  } else {
    mostrarCabecalho(true);
  }

  // Atualiza item ativo no menu lateral
  var itens = document.querySelectorAll('.menu-item');
  for (var i = 0; i < itens.length; i++) {
    itens[i].classList.remove('active');
  }

  var mapaMenu = {
    'inicio': 0,
    'sintomas': 1,
    'historico': 2,
    'orientacoes': 3,
    'exercicios': 4,
    'contatos': 5
  };
  if (mapaMenu[pagina] !== undefined && itens[mapaMenu[pagina]]) {
    itens[mapaMenu[pagina]].classList.add('active');
  }

  // Fecha menu e painéis abertos
  fecharMenu();
  fecharClimaSheet();

  // Rola até o topo da tela
  window.scrollTo(0, 0);
}

// ========================================
// 3. MENU LATERAL
// ========================================

var menuBtn = document.getElementById('menuBtn');
var menuOverlay = document.getElementById('menuOverlay');
var menuDrawer = document.getElementById('menuDrawer');

if (menuBtn) {
  menuBtn.addEventListener('click', function() {
    menuOverlay.classList.add('open');
    menuDrawer.classList.add('open');
  });
}

if (menuOverlay) {
  menuOverlay.addEventListener('click', function() {
    fecharMenu();
  });
}

function fecharMenu() {
  if (menuOverlay) menuOverlay.classList.remove('open');
  if (menuDrawer) menuDrawer.classList.remove('open');
}

// ========================================
// 4. DATA ATUAL DINÂMICA
// ========================================

function atualizarDataAtual() {
  var el = document.getElementById('currentDateDisplay');
  if (!el) return;

  var hoje = new Date();
  var diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  var meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  var diaSemana = diasSemana[hoje.getDay()];
  var dia = hoje.getDate();
  var mes = meses[hoje.getMonth()];
  var ano = hoje.getFullYear();

  el.textContent = diaSemana + ', ' + dia + ' de ' + mes + ' de ' + ano;
}

// ========================================
// 5. ESCALA DE DOR (EVA)
// ========================================

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

// ========================================
// 6. SELEÇÃO DE OPÇÕES (BOTÕES EM GRUPO)
// ========================================

function selecionar(grupoId, indice) {
  var grupo = document.getElementById(grupoId);

  if (!grupo) return;

  var botoes = grupo.querySelectorAll(
    '.choice-btn, .mood-btn'
  );

  botoes.forEach(function(botao) {
    botao.classList.remove('selected');
  });

  if (botoes[indice]) {
    botoes[indice].classList.add('selected');
  }

  // Atualiza o valor correspondente à opção selecionada.
  switch (grupoId) {
    case 'rigidezOptions':
      rigidezAtual = indice;
      break;

    case 'fadigaOptions':
      fadigaAtual = indice;
      break;

    case 'humorOptions':
      humorAtual = indice;
      break;

    case 'atividadeOptions':
      atividadeAtual = indice;
      break;

    case 'atipicoOptions':
      atipico = indice;
      break;
  }
}

// ========================================
// 7. CONCLUSÃO DO REGISTRO E MATRIZ DE DECISÃO
// ========================================

function aplicarPerfilExercicios(tipo) {
  var perfil = PERFIS_EXERCICIOS[tipo];
  if (!perfil) return;
  perfilExercicioAtivo = tipo;
  localStorage.setItem(CHAVE_PERFIL_EXERCICIO, tipo);

  // 1. Atualiza card na Tela 1.0 (Início)
  var homeLabel = document.getElementById('homeRoutineLabel');
  var homeValue = document.getElementById('homeRoutineValue');
  var homeDesc = document.getElementById('homeRoutineDesc');
  var homeBtn = document.getElementById('homeBtnExercicios');

  if (tipo === 'bloqueio') {
    if (homeLabel) homeLabel.textContent = 'Status da rotina:';
    if (homeValue) {
      homeValue.textContent = '⚠ Rotina Suspensa (Trava Ativa)';
      homeValue.style.color = '#cc0000';
    }
    if (homeDesc) homeDesc.textContent = perfil.descCurta;
    if (homeBtn) {
      homeBtn.textContent = 'Ver alerta de segurança';
      homeBtn.className = 'btn btn-danger';
      homeBtn.onclick = function() { navegarPara('alerta'); };
    }
  } else {
    if (homeLabel) homeLabel.textContent = 'Rotina recomendada (' + perfil.evaRange + '):';
    if (homeValue) {
      homeValue.textContent = perfil.nome;
      homeValue.style.color = '#006633';
    }
    if (homeDesc) homeDesc.textContent = perfil.descCurta;
    if (homeBtn) {
      homeBtn.textContent = 'Abrir meus exercícios';
      homeBtn.className = 'btn';
      homeBtn.onclick = function() { navegarPara('exercicios'); };
    }
  }

  // 2. Atualiza elementos na Tela 5.0 (Meus exercícios)
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

    // Pílula educativa TPE (destaque especial para dor moderada 4 a 7)
    if (exTpeCard) {
      if (perfil.mostrarTpe) {
        exTpeCard.style.display = 'block';
        if (exTpeText) exTpeText.textContent = perfil.tpeTexto;
      } else {
        exTpeCard.style.display = 'none';
      }
    }
  }

  // Reseta estado do botão de treino concluído para o novo treino
  var btnTreino = document.getElementById('btnConcluirTreino');
  if (btnTreino) {
    btnTreino.textContent = 'Concluir treino';
    btnTreino.disabled = false;
    btnTreino.style.background = '#006633';
  }
}
function concluirRegistro(event) {
  if (event) {
    event.preventDefault();
  }
  // Obtém os valores informados no formulário.
  var maiorDor = Math.max(dorRepouso, dorMovimento);

  // Cria um registro temporário para demonstrar o funcionamento.
  // Ele permanece apenas na memória enquanto a página está aberta.
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

  registrosDemo.push(registro);
  registroEnviadoHoje = true;

  // Libera o card meteorológico após o envio do formulário.
  // A integração com uma API real será feita na próxima etapa.
  var climaBloq = document.getElementById('climaBloqueado');
  var climaLib = document.getElementById('climaLiberado');

  if (climaBloq) {
    climaBloq.style.display = 'none';
  }

  if (climaLib) {
    climaLib.style.display = 'block';
  }

  // REGRA 1: sinais atípicos ou dor de 8 a 10.
  // A rotina de exercícios deve ser bloqueada.
  if (registro.sinalAtipico || maiorDor >= 8) {
    var motivo = '';

    if (registro.sinalAtipico && maiorDor >= 8) {
      motivo =
        'Foi relatado um sinal atípico e dor intensa (' +
        maiorDor +
        '/10). Os exercícios foram bloqueados por segurança.';
    } else if (registro.sinalAtipico) {
      motivo =
        'Foi relatado um sinal atípico. Os exercícios foram ' +
        'bloqueados preventivamente.';
    } else {
      motivo =
        'A dor informada foi de ' +
        maiorDor +
        '/10. Os exercícios foram bloqueados por segurança.';
    }

    var elMotivo = document.getElementById('motivoBloqueio');

    if (elMotivo) {
      elMotivo.textContent = motivo;
    }

    aplicarPerfilExercicios('bloqueio');
    navegarPara('alerta');

    return;
  }

  // REGRA 2: dor de 0 a 3.
  if (maiorDor <= 3) {
    aplicarPerfilExercicios('fortalecimento');
  }

  // REGRA 3: dor de 4 a 7.
  else {
    aplicarPerfilExercicios('mobilidade');
  }

  // Mostra a tela inicial com o resultado do registro.
  navegarPara('inicio');

  console.log(
    'Registro demonstrativo concluído:',
    registro
  );
}
// ========================================
// 8. CONCLUSÃO DO TREINO
// ========================================

function concluirTreino() {
  treinoConcluido = true;
  var btn = document.getElementById('btnConcluirTreino');
  if (btn) {
    btn.textContent = 'Treino concluído · feedback registrado!';
    btn.disabled = true;
    btn.style.background = '#005528';
  }
}

// ========================================
// 9. HEATMAP DO HISTÓRICO
// ========================================

var valoresDor = [2, 3, 7, 5, 1, 0, 4, 3, 8, 6, 2, 1, 7, 4, 1, 2, 5, 9, 6, 3, 2];

function gerarHeatmap() {
  var grid = document.getElementById('heatmapGrid');
  if (!grid) return;
  grid.innerHTML = '';

  for (var i = 0; i < valoresDor.length; i++) {
    var v = valoresDor[i];
    var cor;
    if (v === 0) cor = '#f4f4f4';
    else if (v <= 3) cor = '#ffe48a';
    else if (v <= 6) cor = '#ffb464';
    else cor = '#f17b72';

    var cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    cell.style.background = cor;
    cell.innerHTML = '<span class="heatmap-cell-day">' + (i + 1) + '</span><span class="heatmap-cell-value">' + v + '/10</span>';

    (function(dia) {
      cell.addEventListener('click', function() {
        abrirClimaSheet(dia);
      });
    })(i + 1);

    grid.appendChild(cell);
  }
}

function mudarMes(delta) {
  mesAtual = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + delta, 1);
  var nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
               'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  
  var elLabel = document.getElementById('mesLabel');
  if (elLabel) {
    elLabel.textContent = nomes[mesAtual.getMonth()] + ' ' + mesAtual.getFullYear();
  }
}

function abrirClimaSheet(dia) {
  var nomesMes = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.',
                  'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  var mesAbrev = nomesMes[mesAtual.getMonth()];
  
  var elTitle = document.getElementById('climaSheetTitle');
  if (elTitle) {
    elTitle.textContent = 'Clima em ' + dia + ' de ' + mesAbrev;
  }
  
  var sheet = document.getElementById('climaSheet');
  if (sheet) sheet.classList.add('open');
}

function fecharClimaSheet() {
  var sheet = document.getElementById('climaSheet');
  if (sheet) sheet.classList.remove('open');
}

// ========================================
// 10. INICIALIZAÇÃO AO CARREGAR A PÁGINA
// ========================================

atualizarDataAtual();
gerarHeatmap();
verificarSessao();
