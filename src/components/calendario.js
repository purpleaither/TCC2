function gerarHeatmap() {
  var grid = document.getElementById('heatmapGrid');
  if (!grid) return;
  grid.replaceChildren();

  var totalDor = 0, maxDor = 0, diasComRegistro = 0;
  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth();
  const numDias = new Date(ano, mes + 1, 0).getDate();
  const diaDoMes = data => {
    const d = new Date(data);
    return d.getMonth() === mes && d.getFullYear() === ano ? d.getDate() : null;
  };
  const sintomasPorDia = new Map();
  for (const registro of registrosUsuario) {
    const dia = diaDoMes(registro.data);
    if (dia !== null) sintomasPorDia.set(dia, registro);
  }
  const treinosPorDia = new Map();
  for (const treino of treinosConcluidos) {
    const dia = diaDoMes(treino.completed_at);
    if (dia !== null) treinosPorDia.set(dia, (treinosPorDia.get(dia) ?? 0) + 1);
  }

  for (let i = 1; i <= numDias; i++) {
    const regDoDia = sintomasPorDia.get(i);
    const treinosDoDia = treinosPorDia.get(i) ?? 0;
    var cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    var valorVisivel = treinosDoDia ? '' : '-';

    if (!regDoDia) {
      cell.style.backgroundColor = 'var(--superficie-neutra)';
      cell.style.borderColor = 'var(--linha)';
    } else {
      var v = (filtroDorVisualizacao === 0) ? regDoDia.dorRepouso : regDoDia.dorMovimento;
      totalDor += v;
      if (v > maxDor) maxDor = v;
      diasComRegistro++;

      cell.dataset.intensidade = v === 0 ? 'nenhuma' : v <= 3 ? 'leve' : v <= 6 ? 'moderada' : 'intensa';

      valorVisivel = v + '/10';
    }
    const dia = document.createElement('span');
    dia.className = 'heatmap-cell-day';
    dia.textContent = String(i);
    cell.append(dia);
    if (valorVisivel) {
      const valor = document.createElement('span');
      valor.className = 'heatmap-cell-value';
      valor.textContent = valorVisivel;
      cell.append(' ', valor);
    }
    if (treinosDoDia) {
      cell.classList.add('heatmap-workout-day');
      cell.title = treinosDoDia + ' treino(s) concluído(s)';
    }
    if (regDoDia || treinosDoDia) {
      const abrir = () => abrirClimaSheet(i, regDoDia ?? null);
      const descricao = treinosDoDia ? ' e treinos concluídos' : '';
      cell.tabIndex = 0;
      cell.setAttribute('role', 'button');
      cell.setAttribute('aria-label', 'Ver registros do dia ' + i + (valorVisivel ? ' ' + valorVisivel : '') + descricao);
      cell.onclick = abrir;
      cell.onkeydown = event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          abrir();
        }
      };
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


document.addEventListener('DOMContentLoaded', gerarHeatmap);
