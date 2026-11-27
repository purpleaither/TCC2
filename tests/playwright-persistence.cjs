const {chromium}=require('playwright');
const fs=require('node:fs');
const base=process.env.TCC_BASE_URL || 'https://tcc2-lime.vercel.app/';
const title='TESTE FICTICIO PW '+Date.now();
const exercise='Mobilidade simulada PW '+Date.now();
const report=[];
const network=[]; let phase='preparacao';
let browser,prof,patient,patientId;
async function step(id,fn){const inicio=performance.now();try{await fn();report.push({id,status:'passed',duracaoMs:Math.round(performance.now()-inicio)});return true}catch(e){report.push({id,status:'failed',error:String(e.message).split('\n')[0].slice(0,200)});return false}}
async function login(role,home){const p=await browser.newPage();await p.goto(base);await p.locator('#loginEmail').fill(process.env['TEST_'+role+'_EMAIL']);await p.locator('#loginSenha').fill(process.env['TEST_'+role+'_PASSWORD']);await p.locator('#loginSubmit').click({timeout:30000});await p.locator('#page-'+home+'.active').waitFor({timeout:30000});return p}
async function nav(p,n){await p.evaluate(n=>window.navegarPara(n),n);await p.locator('#page-'+n+'.active').waitFor()}
function card(){return prof.locator('#listaPlanosProf .card').filter({has:prof.getByText(title,{exact:true})})}
async function selectPatient(){await nav(prof,'planos-prof');await prof.locator('#pacientePlanoProf').selectOption(patientId);await prof.waitForTimeout(1500)}
(async()=>{browser=await chromium.launch();try{
patient=await login('PACIENTE','inicio');prof=await login('FISIO','profissional');
prof.on('request',r=>{const u=new URL(r.url());if(u.pathname==='/api/exercisebank')network.push({phase,endpoint:u.pathname,method:r.method(),event:'request'})});prof.on('requestfailed',r=>{const u=new URL(r.url());if(u.pathname==='/api/exercisebank')network.push({phase,endpoint:u.pathname,event:'requestfailed',error:r.failure()?.errorText})});prof.on('response',r=>{const u=new URL(r.url());if(u.pathname==='/api/exercisebank'||/\/rest\/v1\/(care_plans|plan_exercises)$/.test(u.pathname))network.push({phase,endpoint:u.pathname,method:r.request().method(),status:r.status(),retryAfter:r.headers()['retry-after']||null})});
const name=(await patient.locator('#userNameDisplay').innerText()).trim();
await nav(prof,'planos-prof');
const matches=await prof.locator('#pacientePlanoProf option').evaluateAll((opts,name)=>opts.filter(o=>o.textContent.trim()===name&&o.value).map(o=>o.value),name);
if(matches.length!==1)throw Error('Conta ficticia nao identificada univocamente no seletor; nenhuma escrita realizada');
patientId=matches[0];await selectPatient();
if(await step('CT20-21',async()=>{await prof.locator('#page-planos-prof.active').locator('#createPlanEntry').click();await prof.locator('#nomePlanoProf').fill(title);await prof.getByRole('button',{name:'Próximo',exact:true}).click();await prof.getByRole('button',{name:'Adicionar manualmente',exact:true}).click();const row=prof.locator('#exerciseConfigRow');await row.locator('[name=customName]').fill(exercise);await prof.getByRole('button',{name:'Concluir inserção',exact:true}).click();await prof.locator('#page-exercise-source-prof.active').getByRole('button',{name:'Voltar',exact:true}).click();await prof.locator('#formPlanoProf button[type=submit]').click();await card().getByText(exercise,{exact:true}).waitFor({timeout:20000})})){
if(!process.env.CT22_ONLY)await step('CT23',async()=>{await prof.reload();await prof.locator('#page-profissional.active').waitFor({timeout:30000});await selectPatient();await card().getByText(exercise,{exact:true}).waitFor()});
if(!process.env.CT22_ONLY)await step('CT29',async()=>{await selectPatient();await card().getByRole('button',{name:'Editar',exact:true}).click();await prof.locator('#orientacoesPlanoProf').fill('Orientacao ficticia revisada PW');await prof.locator('#formPlanoProf button[type=submit]').click();await card().getByText('Orientacao ficticia revisada PW',{exact:true}).waitFor();await prof.reload();await prof.locator('#page-profissional.active').waitFor({timeout:30000});await selectPatient();await card().getByText('Orientacao ficticia revisada PW',{exact:true}).waitFor()});
if(!process.env.CT22_ONLY && !process.env.TCC_SERIE_DESEMPENHO)await step('CT54',async()=>{
  const guide=patient.locator('#guiaArLivre section');
  const entry=guide.getByText(exercise,{exact:true});
  const routes=[];
  patient.on('request',request=>{
    if(['api.open-meteo.com','air-quality-api.open-meteo.com','overpass-api.de'].includes(new URL(request.url()).hostname))
      routes.push(request.method());
  });
  if(await entry.count())throw Error('Exercício sem indicação apareceu no guia');
  async function setOutdoor(enabled){
    await card().getByRole('button',{name:'Editar',exact:true}).click();
    await prof.locator('#resumoExerciciosPlano').getByRole('button',{name:'Editar exercício',exact:true}).first().click();
    await prof.getByRole('checkbox',{name:'Recomendar realização em parques ou áreas verdes ao ar livre'}).setChecked(enabled);
    await prof.getByRole('button',{name:'Concluir inserção',exact:true}).click();
    await prof.locator('#formPlanoProf button[type=submit]').click();
    await card().getByText(exercise,{exact:true}).waitFor();
  }
  await setOutdoor(true);
  await card().getByText('Indicação ao ar livre',{exact:true}).waitFor();
  await entry.waitFor({timeout:20000});
  if(routes.length)throw Error('Consulta externa iniciada antes de escolher uma localização');
  await setOutdoor(false);
  await entry.waitFor({state:'detached',timeout:20000});
});
if(!process.env.TCC_SERIE_DESEMPENHO)await step('CT22',async()=>{phase='biblioteca';await card().getByRole('button',{name:'Editar',exact:true}).click();await prof.getByRole('button',{name:'+ Adicionar exercícios',exact:true}).click();await prof.getByRole('button',{name:'Escolher na ExerciseBank',exact:true}).click();await prof.locator('#exercisebankRefresh').waitFor();const catalogo=prof.waitForResponse(r=>new URL(r.url()).pathname==='/api/exercisebank'&&r.request().method()==='GET');await prof.locator('#exercisebankRefresh').click({timeout:30000});const resposta=await catalogo;if(!resposta.ok())throw Error('Catálogo respondeu HTTP '+resposta.status());const item=prof.locator('#exercisebankResults .bank-result').first();try{await item.waitFor({timeout:30000})}catch(e){throw Error('Biblioteca sem resultados: '+(await prof.locator('#exercisebankStatus').innerText()).slice(0,120))};const name=await item.getByRole('heading').innerText();phase='configuracao';await item.getByRole('button',{name:'Selecionar exercício'}).click();await prof.getByRole('button',{name:'Concluir inserção',exact:true}).click();await item.waitFor({state:'visible'});await prof.locator('#page-exercise-bank-prof.active').getByRole('button',{name:'Voltar',exact:true}).click();await prof.locator('#page-exercise-source-prof.active').getByRole('button',{name:'Voltar',exact:true}).click();phase='salvamento';await prof.locator('#page-editor-prof.active').waitFor();await prof.locator('#formPlanoProf button[type=submit]').click();phase='verificacao';await card().getByText(name,{exact:true}).waitFor({timeout:20000});phase='persistencia';await prof.reload();await prof.locator('#page-profissional.active').waitFor({timeout:30000});await selectPatient();await card().getByText(name,{exact:true}).waitFor({timeout:20000});if(!network.some(x=>x.phase==='salvamento'||x.phase==='verificacao' ? x.endpoint.endsWith('/plan_exercises')&&x.method==='POST'&&x.status>=200&&x.status<300 : false))throw Error('Resposta de inserção não observada')});
if(!process.env.CT22_ONLY)await step('CT24',async()=>{await patient.reload();await patient.locator('#page-inicio.active').waitFor({timeout:30000});await nav(patient,'exercicios');for(let i=0;i<100;i++){if(await patient.locator('.patient-plan-title').getByText(title,{exact:true}).count())break;const next=patient.getByRole('button',{name:/próximo/i});if(!await next.count()||!await next.first().isEnabled())break;await next.first().click()}await patient.locator('.patient-plan-title').filter({hasText:title}).waitFor({timeout:5000});await patient.locator('.patient-exercise-title').filter({hasText:exercise}).waitFor({timeout:5000})});
if(!process.env.CT22_ONLY && !process.env.TCC_SERIE_DESEMPENHO)await step('CT55',async()=>{
  await card().getByRole('button',{name:'Editar',exact:true}).click();
  await prof.getByRole('button',{name:'+ Adicionar exercícios',exact:true}).click();
  await prof.getByRole('button',{name:'Adicionar caminhada ao ar livre',exact:true}).click();
  const dialog=prof.locator('#exerciseConfigDialog');
  const name=dialog.getByLabel('Nome do exercício');
  if(await name.inputValue()!=='Caminhada ao ar livre')throw Error('Nome da caminhada incorreto');
  if(!await dialog.getByRole('checkbox').isChecked())throw Error('Indicação ao ar livre não marcada');
  for(const field of ['series','repetitions','duration','frequency']){
    if(await dialog.locator('[name="'+field+'"]').inputValue())throw Error('Parâmetro preenchido automaticamente');
  }
  const walk='Caminhada fictícia PW '+Date.now();
  await name.fill(walk);
  await dialog.getByLabel('Séries',{exact:true}).fill('1');
  await dialog.getByLabel('Duração',{exact:true}).fill('10 minutos');
  await dialog.getByLabel('Frequência',{exact:true}).fill('2 vezes por semana');
  await dialog.getByRole('button',{name:'Concluir inserção',exact:true}).click();
  await prof.locator('#page-exercise-source-prof.active').getByRole('button',{name:'Voltar',exact:true}).click();
  await prof.locator('#formPlanoProf button[type=submit]').click();
  await card().getByText(walk,{exact:true}).waitFor();
  await nav(patient,'inicio');
  await patient.locator('#guiaArLivre').getByText(walk,{exact:true}).waitFor({timeout:20000});
});
}
}catch(e){report.push({id:'setup',status:'blocked',error:String(e.message).split('\n')[0].slice(0,200)})}
finally{if(prof&&patientId){await step('CT30-cleanup',async()=>{await selectPatient();if(!await card().count()){report.push({id:'CT30',status:'not_executed'});return}prof.once('dialog',d=>d.accept());await card().getByRole('button',{name:'Excluir',exact:true}).click();await card().waitFor({state:'detached',timeout:20000})})}await browser.close();fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/playwright-persistence.json',JSON.stringify(report,null,2));fs.writeFileSync('test-results/diagnostico-ct22.json',JSON.stringify(network,null,2));console.log(JSON.stringify({report,network}));if(report.some(x=>x.status!=='passed'))process.exitCode=1}})().catch(()=>{process.exitCode=1});
