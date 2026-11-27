const browserType = require('./navegador.cjs');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.TCC_BASE_URL || 'https://tcc2-lime.vercel.app/';
const out = path.join(process.cwd(), 'test-results');
fs.mkdirSync(out, {recursive:true});
const roles = [
  {name:'fisioterapeuta',email:process.env.TEST_FISIO_EMAIL,password:process.env.TEST_FISIO_PASSWORD,expected:'profissional',forbidden:'inicio',allowed:'planos-prof'},
  {name:'paciente',email:process.env.TEST_PACIENTE_EMAIL,password:process.env.TEST_PACIENTE_PASSWORD,expected:'inicio',forbidden:'planos-prof',allowed:'historico'}
];
(async()=>{
 const report={date:new Date().toISOString(),url:base,config:{configuredRoles:roles.filter(x=>Boolean(x.email&&x.password)).map(x=>x.name)},scenarios:[]};
 const browser=await browserType.launch({headless:true});
 for(const role of roles){
  const entry={role:role.name,checks:[],errors:[]};
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage();
  page.on('pageerror',err=>entry.errors.push(err.message));
  const check=(name,ok,detail='')=>entry.checks.push({name,ok:Boolean(ok),detail});
  try{
   if(!role.email||!role.password){check('Credentials supplied via secrets',false,'Missing expected GitHub Actions Secrets'); report.scenarios.push(entry);await context.close();continue;}
   await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
   await page.locator('#loginSubmit').waitFor({state:'visible',timeout:15000});
   await page.waitForFunction(()=>!document.querySelector('#loginSubmit').disabled,{timeout:25000});
   await page.locator('#loginEmail').fill(role.email);
   await page.locator('#loginSenha').fill(role.password);
   await page.locator('#loginLoading').evaluate(loading=>{
    const observer=new MutationObserver(()=>{
     if(!loading.hidden && document.getElementById('loginContent').hidden){
      loading.dataset.exibiuCarregamento='true';
      observer.disconnect();
     }
    });
    observer.observe(loading,{attributes:true,attributeFilter:['hidden']});
   });
   await page.locator('#loginSubmit').click();
   await page.locator('#page-'+role.expected+'.active').waitFor({timeout:30000});
   check('Authenticated role dashboard',true);
   const loading=page.locator('#loginLoading');
   await loading.waitFor({state:'hidden'});
   check('Carregamento exibido e encerrado',await loading.getAttribute('data-exibiu-carregamento')==='true' && await loading.getAttribute('hidden')!==null);
   await page.locator('#menuBtn').click();
   const profileMenu=page.locator('[data-perfil="'+role.name+'"]');
   check('Authorized menu is visible',await profileMenu.first().isVisible());
   const unauthorized=page.locator('[data-perfil="'+(role.name==='paciente'?'fisioterapeuta':'paciente')+'"]');
   check('Other role menu hidden',!(await unauthorized.first().isVisible()));
   await page.evaluate(pageName=>window.navegarPara(pageName),role.forbidden);
   check('Unauthorized route redirected',await page.locator('#page-'+role.expected+'.active').count()===1);
   await page.evaluate(pageName=>window.navegarPara(pageName),role.allowed);
   check('Authorized route accessible',await page.locator('#page-'+role.allowed+'.active').count()===1);
   if(role.name==='fisioterapeuta'){
     check('Patient selector linked',await page.locator('#pacienteProf option').count()>0);
   } else {
     await page.evaluate(()=>window.navegarPara('sintomas'));
     check('Symptoms screen accessible',await page.locator('#page-sintomas.active').count()===1);
     await page.evaluate(()=>window.navegarPara('exercicios'));
     check('Exercises screen accessible',await page.locator('#page-exercicios.active').count()===1);
   }
   check('No uncaught page errors',entry.errors.length===0,entry.errors.join(' | ').slice(0,500));
   const painel=page.locator('#abrirAcessibilidade');
   const testarPreferencias=Boolean(process.env.TCC_BASE_URL && await painel.count());
   if(testarPreferencias){
    await painel.click();
    await page.locator('#preferenciaTexto').selectOption('150');
    await page.locator('#preferenciaTema').selectOption('escuro');
    await painel.click();
   }
   await page.evaluate(()=>window.realizarLogout());
   await page.locator('#page-login.active').waitFor({timeout:15000});
   check('Logout returns login screen',true);
   if(process.env.TCC_BASE_URL){
    await page.reload();
    await page.locator('#page-login.active').waitFor({timeout:15000});
    await page.waitForFunction(()=>!document.querySelector('#loginSubmit').disabled);
    check('Sessão encerrada após recarregar',await page.locator('#page-login.active').isVisible());
    if(testarPreferencias)check('CT52, preferências preservadas após sair',await page.locator('html').getAttribute('data-texto')==='150' && await page.locator('html').getAttribute('data-tema')==='escuro');
    const sessaoPersistida=await page.evaluate(()=>Object.keys(localStorage).some(chave=>/^sb-.*-auth-token$/.test(chave)));
    check('Sessão Supabase removida do armazenamento local',!sessaoPersistida);
   }
  }catch(err){
   check('Test execution reached end',false,String(err.message).slice(0,900));
   try{entry.loginStatus=await page.locator('#loginStatus').innerText({timeout:1000})}catch{}
   // Screenshots may contain account information; do not upload on failure.
  }
  report.scenarios.push(entry);
  await context.close();
 }
 await browser.close();
 fs.writeFileSync(path.join(out,'playwright-auth-report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
 if(report.scenarios.some(x=>x.checks.some(y=>!y.ok)))process.exitCode=1;
})().catch(err=>{console.error('Test harness error: '+err.message);process.exitCode=1});
