const browserType = require('./navegador.cjs');
const fs=require('node:fs');
(async()=>{const report=[],network=[];let browser,p;const simular=process.env.TCC_CLIMA_FALHA==='1';try{
browser=await browserType.launch();p=await browser.newPage();
let simulacoes=0;
if(simular)await p.route('**/api/weather?*',rota=>{
 simulacoes++;
 return rota.fulfill({status:502,json:{error:'Falha meteorológica simulada'}});
});
const isSymptoms=r=>new URL(r.url()).pathname.endsWith('/rest/v1/symptom_records');
p.on('response',r=>{if(isSymptoms(r)||(new URL(r.url()).pathname==='/api/weather'||new URL(r.url()).hostname==='api.open-meteo.com'))network.push({endpoint:new URL(r.url()).pathname,method:r.request().method(),status:r.status(),
 tempoAteCabecalhoMs:(()=>{const t=r.request().timing();return t.responseStart>=0?Math.round(t.responseStart):null})()})});
p.on('requestfailed',r=>{if((new URL(r.url()).pathname==='/api/weather'||new URL(r.url()).hostname==='api.open-meteo.com'))network.push({endpoint:new URL(r.url()).pathname,method:r.method(),error:r.failure()?.errorText})});
p.on('request',r=>{if((new URL(r.url()).pathname==='/api/weather'||new URL(r.url()).hostname==='api.open-meteo.com'))network.push({endpoint:new URL(r.url()).pathname,method:r.method(),event:'request'})});
await p.goto(process.env.TCC_BASE_URL || 'https://tcc2-lime.vercel.app/');
await p.locator('#loginEmail').fill(process.env.TEST_PACIENTE_EMAIL);await p.locator('#loginSenha').fill(process.env.TEST_PACIENTE_PASSWORD);
const initial=p.waitForResponse(r=>isSymptoms(r)&&r.request().method()==='GET'&&r.ok(),{timeout:30000});
await p.locator('#loginSubmit').click();await p.locator('#page-inicio.active').waitFor({timeout:30000});
const before=await (await initial).json();const ids=new Set(before.map(x=>x.id));
await p.evaluate(()=>window.navegarPara('sintomas'));await p.locator('#page-sintomas.active').waitFor();
if(await p.locator('#page-sintomas .selected').count() || await p.locator('#restPainValue,#movPainValue').count())
  throw Error('O formulário abriu com respostas preenchidas');
if(await p.locator('#page-sintomas').getAttribute('data-dominio')!=='musculoesqueletico') throw Error('CI-05 requer o paciente fictício musculoesquelético');
await p.locator('#diarioProximo').click();
if(!(await p.locator('#diarioErro').isVisible())) throw Error('O diário avançou sem notas de dor');
await p.locator('#dorParadoComparacao').getByRole('button',{name:'4',exact:true}).click();
await p.locator('#dorMovimentoComparacao').getByRole('button',{name:'6',exact:true}).click();
await p.locator('#diarioProximo').click();
await p.locator('#diarioProximo').click();
if(!(await p.locator('#diarioErro').isVisible())) throw Error('O diário avançou sem humor e atividade física');
await p.locator('#rigidezOptions').getByRole('button',{name:'Moderada',exact:true}).click();
await p.locator('#fadigaOptions').getByRole('button',{name:'Leve',exact:true}).click();
await p.locator('#humorOptions').getByRole('button',{name:'Desanimado',exact:true}).click();
await p.locator('#atividadeOptions').getByRole('button',{name:'Moderada',exact:true}).click();
const expected={pain_rest:4,pain_movement:6,stiffness:'Moderada',fatigue:'Leve',mood:'Desanimado',activity_level:'Moderada'};
await p.locator('#diarioVoltar').click();
await p.locator('#diarioProximo').click();
if(!(await p.locator('#humorOptions').getByRole('button',{name:'Desanimado',exact:true}).and(p.locator('.selected')).isVisible()) ||
   !(await p.locator('#atividadeOptions .selected').getByText('Moderada').isVisible()))
  throw Error('O diário perdeu as respostas ao voltar de etapa');
await p.locator('#diarioProximo').click();
await p.locator('#diarioProximo').click();
await p.locator('#diarioSalvar').click();
if(!(await p.locator('#diarioErro').isVisible())) throw Error('O diário aceitou o envio sem resposta sobre sinais');
await p.locator('#diarioVoltar').click();
await p.locator('#atipicoOptions').getByRole('button',{name:'Não',exact:true}).click();
await p.locator('#diarioProximo').click();
await p.locator('#diarioMunicipio').fill('São Paulo');
await p.locator('#diarioUF').selectOption('SP');
const saved=p.waitForResponse(r=>isSymptoms(r)&&r.request().method()==='POST'&&r.ok(),{timeout:45000});
const inicioRegistro=performance.now();
await p.getByRole('button',{name:'Concluir registro de sintomas',exact:true}).click();await saved;const tempoRegistroMs=Math.round(performance.now()-inicioRegistro);await p.locator('#page-inicio.active').waitFor({timeout:30000});
const aviso=simular&&await p.locator('#authFlash').textContent();
const read=p.waitForResponse(r=>isSymptoms(r)&&r.request().method()==='GET'&&r.ok(),{timeout:30000});await p.reload();const rows=await (await read).json();
const added=rows.filter(x=>!ids.has(x.id)&&Object.entries(expected).every(([k,v])=>x[k]===v));
if(added.length!==1)throw Error('Novo registro não identificado univocamente após recarregar');
await p.locator('#page-inicio.active').waitFor({timeout:30000});
await p.locator('#btnRegistrarSintomas').click();
await p.locator('#climaSheet.open').waitFor();
const resumoDor=await p.locator('#sheetDorNivel').innerText();
if(!resumoDor.includes('4/10') || !resumoDor.includes('6/10'))
  throw Error('Intensidade de dor incorreta no histórico');
if(await p.locator('#sheetHumor').innerText()!==expected.mood ||
   await p.locator('#sheetAtividade').innerText()!==expected.activity_level)
  throw Error('Humor ou atividade física ausente no calendário após recarregar');
report.push({id:simular?'CT44-persistencia':'CT25',status:'passed',expected,tempoRegistroMs});
const x=added[0];const weather=['weather_temperature','weather_humidity','weather_pressure'].every(k=>typeof x[k]==='number'&&Number.isFinite(x[k]))&&!!x.weather_city&&Number.isFinite(Date.parse(x.weather_observed_at));
if(simular){
 const semMedicao=['weather_temperature','weather_humidity','weather_pressure','weather_city','weather_observed_at'].every(campo=>x[campo]==null);
 const avisoExibido=/Sintomas registrados/i.test(aviso)&&/Dados ambientais indisponíveis/i.test(aviso);
 report.push({id:'CT44-falha-clima',status:simulacoes===2&&semMedicao&&avisoExibido?'passed':'failed',simulacoes,semMedicao,avisoExibido});
}else report.push({id:'CT26',status:weather?'passed':'failed',weather:weather?{city:x.weather_city,temperature:x.weather_temperature,humidity:x.weather_humidity,pressure:x.weather_pressure,observedAt:x.weather_observed_at}:null});
}catch(e){report.push({id:'CI05',status:'failed',error:String(e.message),stack:String(e.stack||'')});if(p){fs.mkdirSync('test-results',{recursive:true});await p.screenshot({path:simular?'test-results/ci05-falha-clima.png':'test-results/ci05-falha.png',fullPage:true}).catch(()=>{});}}finally{if(browser)await browser.close();fs.mkdirSync('test-results',{recursive:true});const evidence={report,network,retention:'Registro fictício mantido por autorização'};fs.writeFileSync(simular?'test-results/clima-falha-interface.json':'test-results/ci05-sintomas-clima.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));if(report.length!==2||report.some(x=>x.status!=='passed'))process.exitCode=1}})();
