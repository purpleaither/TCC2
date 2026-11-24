const {chromium}=require('playwright');
const fs=require('node:fs');
const base='https://tcc2-lime.vercel.app/';
const title='TESTE FICTICIO PW '+Date.now();
const exercise='Mobilidade simulada PW';
const report=[];
let browser,prof,patient,patientId;
async function step(id,fn){try{await fn();report.push({id,status:'passed'});return true}catch(e){report.push({id,status:'failed',error:String(e.message).split('\n')[0].slice(0,200)});return false}}
async function login(role,home){const p=await browser.newPage();await p.goto(base);await p.locator('#loginEmail').fill(process.env['TEST_'+role+'_EMAIL']);await p.locator('#loginSenha').fill(process.env['TEST_'+role+'_PASSWORD']);await p.locator('#loginSubmit').click({timeout:30000});await p.locator('#page-'+home+'.active').waitFor({timeout:30000});return p}
async function nav(p,n){await p.evaluate(n=>window.navegarPara(n),n);await p.locator('#page-'+n+'.active').waitFor()}
function card(){return prof.locator('#listaPlanosProf .card').filter({has:prof.getByText(title,{exact:true})})}
async function selectPatient(){await nav(prof,'planos-prof');await prof.locator('#pacientePlanoProf').selectOption(patientId);await prof.waitForTimeout(1500)}
(async()=>{browser=await chromium.launch();try{
patient=await login('PACIENTE','inicio');prof=await login('FISIO','profissional');
const name=(await patient.locator('#userNameDisplay').innerText()).trim();
await nav(prof,'planos-prof');
const matches=await prof.locator('#pacientePlanoProf option').evaluateAll((opts,name)=>opts.filter(o=>o.textContent.trim()===name&&o.value).map(o=>o.value),name);
if(matches.length!==1)throw Error('Conta ficticia nao identificada univocamente no seletor; nenhuma escrita realizada');
patientId=matches[0];await selectPatient();
if(await step('CT20-21',async()=>{await prof.locator('#page-planos-prof.active').getByRole('button',{name:'Criar plano terapêutico',exact:true}).filter({visible:true}).first().click();await prof.locator('#nomePlanoProf').fill(title);await prof.getByRole('button',{name:'+ Adicionar exercícios',exact:true}).click();await prof.getByRole('button',{name:'Adicionar manualmente',exact:true}).click();const row=prof.locator('#exerciseConfigRow');await row.locator('[name=exercise]').selectOption('other');await row.locator('[name=customName]').fill(exercise);await prof.getByRole('button',{name:'Concluir inserção',exact:true}).click();await prof.locator('#formPlanoProf button[type=submit]').click();await card().getByText(exercise,{exact:true}).waitFor({timeout:20000})})){
await step('CT23',async()=>{await prof.reload();await prof.locator('#page-profissional.active').waitFor({timeout:30000});await selectPatient();await card().getByText(exercise,{exact:true}).waitFor()});
await step('CT24',async()=>{await patient.reload();await patient.locator('#page-inicio.active').waitFor({timeout:30000});await nav(patient,'exercicios');for(let i=0;i<100;i++){if(await patient.locator('.patient-plan-title').getByText(title,{exact:true}).count())break;const next=patient.getByRole('button',{name:/próximo/i});if(!await next.count()||!await next.first().isEnabled())break;await next.first().click()}await patient.locator('.patient-plan-title').filter({hasText:title}).waitFor({timeout:5000});await patient.locator('.patient-exercise-title').filter({hasText:exercise}).waitFor({timeout:5000})});
}
}catch(e){report.push({id:'setup',status:'blocked',error:String(e.message).split('\n')[0].slice(0,200)})}
finally{if(prof&&patientId){await step('CT30-cleanup',async()=>{await selectPatient();if(!await card().count()){report.push({id:'CT30',status:'not_executed'});return}prof.once('dialog',d=>d.accept());await card().getByRole('button',{name:'Excluir',exact:true}).click();await card().waitFor({state:'detached',timeout:20000})})}await browser.close();fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/playwright-persistence.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(report.some(x=>x.status!=='passed'))process.exitCode=1}})().catch(()=>{process.exitCode=1});
