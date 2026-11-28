const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {resolve} = require("node:path");
const {test} = require("node:test");
const vm = require("node:vm");

const fonte = arquivo => readFileSync(resolve(__dirname, "..", arquivo), "utf8");
const modulo = fonte("data/respiratorio.js");
const dados = import("data:text/javascript;base64," + Buffer.from(modulo).toString("base64"));
const acesso = fonte("acesso.js");
const salvar = acesso.slice(acesso.indexOf("async function saveSymptoms(){"), acesso.indexOf("let sampleList=null"));

test("planos antigos e novos selecionam o domínio apropriado", async () => {
  const {dominioDoDiario, catalogoRespiratorio} = await dados;
  const respiratorio = {clinical_domain: "respiratorio"};
  assert.equal(dominioDoDiario([]), "musculoesqueletico");
  assert.equal(dominioDoDiario([{}]), "musculoesqueletico");
  assert.equal(dominioDoDiario([respiratorio]), "respiratorio");
  assert.equal(dominioDoDiario([{}, respiratorio]), "misto");
  assert.equal(dominioDoDiario([{clinical_domain: "misto"}]), "misto");
  assert.equal(new Set(catalogoRespiratorio.map(x => x.id)).size, 5);
  assert.equal(catalogoRespiratorio.find(x => x.id === "inspiracao-fracionada").parametrosPadrao.inspiratory_hold_seconds, 3);
});

for (const dominio of ["musculoesqueletico", "respiratorio", "misto"]) {
  test("envio do diário " + dominio, async () => {
    const {medidasRespiratorias, avisoFaltaDeAr} = await dados;
    const passos = [];
    const respiratorio = dominio !== "musculoesqueletico";
    const muscular = dominio !== "respiratorio";
    const notas = {dyspnea_rest: "7", dyspnea_exertion: "0", cough_level: "2", secretion_level: "0", airway_dryness: "0"};
    let registro;
    const contexto = {
      busy: false, user: {id: "paciente-ficticio"}, isAuthenticated: () => true, isProfessional: () => false,
      $: id => ({
        dataset: {dominio}, value: id==="diarioMunicipio"?"São Paulo":id==="diarioUF"?"SP":muscular ? "4" : "",
        querySelector: () => id in notas ? {value: notas[id]} : muscular && id === "dorParadoComparacao" ? {value:"4"} : muscular && id === "dorMovimentoComparacao" ? {value:"6"} : null
      }),
      levels: ["Nenhuma", "Leve"], moods: ["Bem"], humorAtual: 0, atividadeAtual: 0,
      rigidezAtual: muscular ? 1 : null, fadigaAtual: muscular ? 0 : null, atipico: 0,
      medidasAtivas: () => medidasRespiratorias, avisoFaltaDeAr, environmentalColumnsAvailable: true,
      extrasAmbienteDisponiveis: true, camposQualidadeAr: ["pm2_5", "pm10", "ozone", "carbon_dioxide"],
      obterClimaLocal: async () => {
        passos.push("clima");
        if (dominio === "respiratorio") throw Error("API indisponível simulada");
        return {weather_temperature: 26, weather_uv_index: 0};
      },
      obterQualidadeAr: async () => {
        passos.push("ar");
        if (dominio === "misto") throw Error("HTTP 502 simulado");
        return {pm2_5: 14, pm10: 18, ozone: 25, carbon_dioxide: 451};
      },
      weatherColumnsAvailable: true,
      supabase: {from: tabela => {
        assert.equal(tabela, "symptom_records");
        return {insert: async valor => {registro = valor; passos.push("salvar"); return {};}};
      }},
      mostrarErroDiario: mensagem => { throw Error(mensagem); },
      result: () => {}, loadPatientData: async () => passos.push("recarregar"),
      navigate: () => passos.push("início"), message: () => {}, alert: () => passos.push("alerta")
    };
    await vm.runInNewContext(salvar + "\nsaveSymptoms()", contexto);
    assert.deepEqual(passos, ["clima", "ar", "salvar", "recarregar", "início", ...(respiratorio ? ["alerta"] : [])]);
    assert.equal(registro.pain_rest, muscular ? 4 : null);
    assert.equal(registro.pain_movement, muscular ? 6 : null);
    assert.equal(registro.stiffness, muscular ? "Leve" : null);
    assert.equal(registro.dyspnea_rest, respiratorio ? 7 : undefined);
    assert.equal(registro.dyspnea_exertion, respiratorio ? 0 : undefined);
    assert.equal(registro.secretion_level, respiratorio ? 0 : undefined);
    assert.equal(registro.airway_dryness, respiratorio ? 0 : undefined);
    assert.equal(registro.pm2_5, dominio !== "musculoesqueletico" ? undefined : 14);
    assert.equal(registro.pm10, dominio !== "musculoesqueletico" ? undefined : 18);
    assert.equal(registro.ozone, dominio !== "musculoesqueletico" ? undefined : 25);
    assert.equal(registro.carbon_dioxide, dominio !== "musculoesqueletico" ? undefined : 451);
    assert.equal(registro.weather_uv_index, dominio === "respiratorio" ? undefined : 0);
    assert.equal(registro.weather_temperature, dominio === "respiratorio" ? undefined : 26);
  });
}
