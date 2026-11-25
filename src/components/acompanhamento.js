import { $, el } from '../utils/dom.js';
import { date, localDateKey, monitoringWeeks } from '../utils/datas.js';
import { levels } from '../types/sintomas.js';
import { mapWeather } from '../services/clima.js';

function monitoringBars(rows, maximum, title){
  const list = el("ul", undefined, "monitoring-bars");
  list.setAttribute("role", "list");
  list.setAttribute("aria-label", title);
  for (const row of rows) {
    const item = el("li", undefined, "monitoring-bar");
    item.append(el("span", row.label), el("strong", row.text));
    const track = el("span", undefined, "monitoring-track");
    track.setAttribute("aria-hidden", "true");
    const fill = el("span", undefined, "monitoring-fill");
    fill.style.inlineSize = (row.value / maximum * 100) + "%";
    track.append(fill);
    item.append(track);
    list.append(item);
  }
  return list;
}

function monitoringTopic(label, panel){
  const details = el("details", undefined, "monitoring-topic");
  details.append(el("summary", label), panel);
  return details;
}

function renderProfessionalMonitoring({ patientId, professionalWorkouts, records, plans }) {
  const root = $("graficosRegistrosProf");
  root.replaceChildren();
  if (!patientId) return;
  if (professionalWorkouts === undefined) {
    root.append(el("p", "Carregando acompanhamento…", "card-text"));
    return;
  }

  root.append(el("h2", "Acompanhamento do paciente", "card-title"));
  const windows = monitoringWeeks();
  const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
  const latestByDay = new Map();
  for (const record of records) {
    const day = localDateKey(record.recorded_at);
    if (day && !latestByDay.has(day)) latestByDay.set(day, record);
  }
  const recent = [...latestByDay.values()].slice(0, 7).reverse();
  const workoutCard = el("section", undefined, "card");
  workoutCard.append(el("h3", "Treinos concluídos por semana", "card-title"),
    el("p", "Últimos 28 dias, incluindo hoje. Cada treino conta uma vez no gráfico.", "card-text"));
  if (professionalWorkouts === null) {
    workoutCard.append(el("p", "Não foi possível carregar os treinos.", "card-text-small"));
  } else {
    const planOptions = new Map(plans.map(plan => [plan.id, plan.title]));
    for (const session of professionalWorkouts) {
      for (const exercise of session.exercises || []) {
        if (exercise.plan_id && !planOptions.has(exercise.plan_id)) {
          planOptions.set(exercise.plan_id, exercise.plan_title || "Plano anterior");
        }
      }
    }
    const select = el("select", undefined, "form-input");
    select.id = "monitoramentoPlano";
    const all = el("option", "Todos os planos");
    all.value = "";
    select.append(all);
    for (const [id, title] of planOptions) {
      const option = el("option", title);
      option.value = id;
      select.append(option);
    }
    const filter = el("label", "Plano", "form-group form-label");
    filter.append(select);
    const output = el("div");
    output.setAttribute("aria-live", "polite");
    const showSessions = () => {
      const counts = [0, 0, 0, 0];
      for (const session of professionalWorkouts) {
        if (select.value && !session.exercises?.some(exercise => exercise.plan_id === select.value)) continue;
        const time = new Date(session.completed_at);
        const week = counts.findIndex((_, index) => time >= windows[index] && time < windows[index + 1]);
        if (week >= 0) counts[week] += 1;
      }
      const rows = counts.map((count, index) => {
        const lastDay = new Date(windows[index + 1]);
        lastDay.setDate(lastDay.getDate() - 1);
        return { label: shortDate.format(windows[index]) + " a " + shortDate.format(lastDay),
          text: count + (count === 1 ? " treino" : " treinos"), value: count };
      });
      output.replaceChildren(monitoringBars(rows, Math.max(1, ...counts), "Treinos concluídos por período"));
    };
    select.addEventListener("change", showSessions);
    workoutCard.append(filter, output);
    if (professionalWorkouts.length === 500) {
      workoutCard.append(el("p", "O gráfico considera até os 500 treinos mais recentes do período.", "card-text-small"));
    }
    showSessions();
  }
  root.append(monitoringTopic("Ver treinos concluídos", workoutCard));
  for (const [key, title, buttonLabel] of [
    ["stiffness", "Rigidez", "Ver nível de rigidez"],
    ["fatigue", "Cansaço (fadiga)", "Ver nível de cansaço"]
  ]) {
    const card = el("section", undefined, "card");
    card.append(el("h3", title, "card-title"),
      el("p", "Último relato de até 7 dias com registro. Dias sem resposta ficam fora do gráfico.", "card-text"));
    const rows = recent.filter(record => levels.includes(record[key])).map(record => ({
      label: shortDate.format(new Date(record.recorded_at)),
      text: record[key], value: levels.indexOf(record[key])
    }));
    card.append(rows.length ? monitoringBars(rows, levels.length - 1, title + " por dia")
      : el("p", "Nenhum relato disponível.", "card-text-small"));
    root.append(monitoringTopic(buttonLabel, card));
  }
}

export function exibirRegistrosProfissionais(dados) {
  const { patientId, professionalWorkouts, records } = dados;
  renderProfessionalMonitoring(dados);
  if (!patientId || professionalWorkouts === undefined) return;
  const root = el("div");
  root.id = "listaRegistrosProf";
  $("graficosRegistrosProf").append(monitoringTopic("Ver registros individuais", root));
  if(!records.length)root.append(el("p","Nenhum registro disponível.","demo-vazio"));
  for(const r of records) {
    const card=el("div",undefined,"card");
    card.append(el("h3",date(r.recorded_at),"card-title"));
    card.append(el("p","Dor em repouso: "+r.pain_rest+"/10 · Dor ao movimento: "+r.pain_movement+"/10","card-text"));
    card.append(el("p","Rigidez: "+r.stiffness+" · Fadiga: "+r.fatigue,"card-text-small"));
    const clima=mapWeather(r);
    if(clima)card.append(el("p","Clima registrado em "+date(clima.observadoEm)+": "+clima.temperatura+" °C · "+clima.umidade+"% · "+clima.pressao+" hPa ("+clima.cidade+")","card-text-small"));
    root.append(card);
  }
}
