const browserType = require('./navegador.cjs');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.TCC_BASE_URL || 'https://tcc2-lime.vercel.app/';
const out = path.join(process.cwd(),'test-results');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await browserType.launch({headless:true});
 const result={url:base,date:new Date().toISOString(),scenarios:[]};
 for(const config of [{name:'desktop',viewport:{width:1366,height:768}},{name:'mobile',viewport:{width:390,height:844}}]){
  const page=await browser.newPage({viewport:config.viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const scenario={name:config.name};
  try {
   const response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForTimeout(1500);
   scenario.httpStatus=response?.status()||null;
   scenario.title=await page.title();
   scenario.visibleText=(await page.locator('body').innerText()).slice(0,300);
   scenario.hasForm=(await page.locator('input,button,form').count())>0;
   scenario.horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
   scenario.pageErrors=errors;
   await page.screenshot({path:path.join(out,config.name+'.png'),fullPage:true});
   scenario.ok=Boolean(response&&response.ok()&&scenario.hasForm&&!scenario.horizontalOverflow);
  }catch(e){scenario.ok=false;scenario.error=e.message;}
  result.scenarios.push(scenario);
  await page.close();
 }
 await browser.close();
 fs.writeFileSync(path.join(out,'playwright-report.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
 if(result.scenarios.some(x=>!x.ok))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
