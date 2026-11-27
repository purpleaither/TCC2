const browserType = require('./navegador.cjs');
const fs=require('node:fs');
const base=process.env.TCC_BASE_URL || 'https://tcc2-lime.vercel.app/';
const title='TESTE FICTICIO PW '+Date.now();
const exercise='Mobilidade simulada PW '+Date.now();
const report=[];
const network=[]; let phase='preparacao';
let browser,prof,patient,patientId;
async function step(id,fn){try{await fn();report.push({id,status:'passed'});return true}catch(e){report.push({id,status:'failed',error:String(e.message).split('\n')[0].slice(0,200)});return false}}
async function login(role,home){const p=await browser.newPage();await p.goto(base);await p.locator('#loginEmail').fill(process.env['TEST_'+role+'_EMAIL']);await p.locator('#loginSenha').fill(process.env['TEST_'+role+'_PASSWORD']);await p.locator('#loginSubmit').click({timeout:30000});await p.locator('#page-'+home+'.active').waitFor({timeout:30000});return p}
async function nav(p,n){await p.evaluate(n=>window.navegarPara(n),n);await p.locator('#page-'+n+'.active').waitFor()}
function card(){return prof.locator('#listaPlanosProf .card').filter({has:prof.getByText(title,{exact:true})})}
async function selectPatient(){await nav(prof,'planos-prof');await prof.locator('#pacientePlanoProf').selectOption(patientId);await prof.waitForTimeout(1500)}
(async()=>{browser=await browserType.launch();try{
patient=await login('PACIENTE','inicio');prof=await login('FISIO','profissional');
prof.on('request',r=>{const u=new URL(r.url());if(u.pathname==='/api/exercisebank')network.push({phase,endpoint:u.pathname,method:r.method(),event:'request'})});prof.on('requestfailed',r=>{const u=new URL(r.url());if(u.pathname==='/api/exercisebank')network.push({phase,endpoint:u.pathname,event:'requestfailed',error:r.failure()?.errorText})});prof.on('response',r=>{const u=new URL(r.url());if(u.pathname==='/api/exercisebank'||/\/rest\/v1\/(care_plans|plan_exercises)$/.test(u.pathname))network.push({phase,endpoint:u.pathname,method:r.request().method(),status:r.status(),retryAfter:r.headers()['retry-after']||null})});
const name=(await patient.locator('#userNameDisplay').innerText()).trim();
await nav(prof,'planos-prof');
const matches=await prof.locator('#pacientePlanoProf option').evaluateAll((opts,name)=>opts.filter(o=>o.textContent.trim()===name&&o.value).map(o=>o.value),name);
if(matches.length!==1)throw Error('Conta ficticia nao identificada univocamente no seletor; nenhuma escrita realizada');
patientId=matches[0];await selectPatient();
if(!await step('preparacao-plano',async()=>{await prof.locator('#page-planos-prof.active').locator('#createPlanEntry').click();await prof.locator('#nomePlanoProf').fill(title);await prof.getByRole('button',{name:'Próximo',exact:true}).click();if(await prof.locator('#etapaCategoriaPlano').isVisible())await prof.getByRole('button',{name:'Ortopédico',exact:true}).click();await prof.getByRole('button',{name:'Adicionar manualmente',exact:true}).click();const row=prof.locator('#exerciseConfigRow');await row.locator('[name=customName]').fill(exercise);await prof.getByRole('button',{name:'Concluir inserção',exact:true}).click();await prof.locator('#page-exercise-source-prof.active').getByRole('button',{name:'Voltar',exact:true}).click();await prof.locator('#formPlanoProf button[type=submit]').click();await card().getByText(exercise,{exact:true}).waitFor({timeout:20000})}))throw Error('Preparação do plano falhou');
const isWorkout=r=>new URL(r.url()).pathname.endsWith('/rest/v1/workout_sessions');
patient.on('response',r=>{if(isWorkout(r))network.push({method:r.request().method(),status:r.status()})});
const before=patient.waitForResponse(r=>isWorkout(r)&&r.request().method()==='GET'&&r.ok(),{timeout:30000});await patient.reload();const ids=new Set((await (await before).json()).map(x=>x.id));await patient.locator('#page-inicio.active').waitFor();await nav(patient,'exercicios');
let seen=false;for(let i=0;i<100;i++){if(await patient.locator('.patient-exercise-title').innerText()===exercise)seen=true;if(await patient.locator('#finishPatientWorkout').count())break;await patient.getByRole('button',{name:'Próximo',exact:true}).click()}
if(!seen)throw Error('Exercício fictício não encontrado');
const inicioConclusao=performance.now();
const post=patient.waitForResponse(r=>isWorkout(r)&&r.request().method()==='POST'&&r.ok(),{timeout:30000});await patient.locator('#finishPatientWorkout').click();await post;await patient.locator('#finishPatientWorkout').filter({hasText:'✓'}).waitFor({timeout:30000});report.push({id:'CT27',status:'passed',duracaoMs:Math.round(performance.now()-inicioConclusao)});
const inicioHistorico=performance.now();
const read=patient.waitForResponse(r=>isWorkout(r)&&r.request().method()==='GET'&&r.ok(),{timeout:30000});await patient.reload();const rows=await (await read).json();const added=rows.filter(x=>!ids.has(x.id)&&x.exercises?.some(e=>e.plan_title===title&&e.exercise_name===exercise));if(added.length!==1)throw Error('Sessão não recuperada univocamente');await patient.locator('#page-inicio.active').waitFor();await nav(patient,'historico');const day=await patient.evaluate(t=>new Date(t).getDate(),added[0].completed_at);await patient.getByRole('button',{name:'Ver atividades do dia '+day,exact:true}).click();const row=patient.locator('#sheetWorkoutHistory .workout-history-exercise').filter({hasText:title});await row.getByText(exercise,{exact:true}).waitFor();report.push({id:'CT28',status:'passed',duracaoMs:Math.round(performance.now()-inicioHistorico)});
}catch(e){report.push({id:'CI06',status:'failed',error:String(e.message).split('\n')[0]})}finally{await browser.close();fs.mkdirSync('test-results',{recursive:true});const evidence={report,network,retention:'Plano e treino fictícios mantidos'};fs.writeFileSync('test-results/ci06-treino-historico.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));if(report.some(x=>x.status!=='passed')||!report.some(x=>x.id==='CT28'))process.exitCode=1}})();
