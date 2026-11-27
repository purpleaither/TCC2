const browserType = require('../navegador.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const pasta = path.resolve(__dirname, "../..");
const server = http.createServer((req,res) => {
  const pathname = new URL(req.url,'http://localhost').pathname;
  const file = path.join(pasta, pathname === '/' ? 'index.html' : pathname);
  if (!file.startsWith(pasta + path.sep) || !/\.(?:html|css|js|svg|png|webp|ico)$/.test(file)) {
    res.writeHead(404).end();
    return;
  }
  try {
    let body = fs.readFileSync(file);
    // Injeta perfis fictícios no servidor local e evita autenticação e gravações no Supabase.
    if (pathname === '/acesso.js') body = body.toString().replace('document.addEventListener("DOMContentLoaded",init);','') + `
window.cenario = dominio => {
  user={id:"ficticio"}; profile={role:"paciente"}; plans=[{clinical_domain:dominio}]; environmentalColumnsAvailable=true;
  menu(); navigate("sintomas");
};
window.cenarioParques = indicado => {
  plans=[{plan_exercises:[{id:"ex-ficticio",exercise_name:"Elevação de braços",
    exercise_source:"manual",indicacao_ar_livre:indicado}]}];
  renderPatientPlans();
};
window.cenarioAmbiente = (salvo, ar) => {
  records=salvo?[{recorded_at:new Date().toISOString(),dyspnea_rest:6,
    weather_city:"Brasília",weather_temperature:26,weather_humidity:29,weather_pressure:890,
    ...(ar?{pm2_5:12,pm10:20,ozone:35}:{})}]:[];
  navigate("inicio");
};
window.cenarioTabela = () => {
  const now=new Date();
  const data=now.toISOString();
  professionalWorkouts=[{completed_at:data}];
  const tabela=renderLongitudinal([{recorded_at:data,dyspnea_rest:0,cough_level:2,
    airway_dryness:1,weather_humidity:29,pm2_5:12}], [new Date(+now-10000),new Date(+now+10000)]);
  document.getElementById("page-exercise-bank-prof").append(tabela);
};
window.cenarioEditor = () => {
  user={id:"prof-ficticio"}; profile={role:"fisioterapeuta"}; patientId="paciente-ficticio";
  respiratoryColumnsAvailable=true;
  createPlanFromScratch();
};
window.cenarioProf = () => {
  user={id:"prof-ficticio"}; profile={role:"fisioterapeuta"}; respiratoryColumnsAvailable=true;
  menu(); navigate("exercise-bank-prof");
  document.getElementById("dominioBiblioteca").value="respiratorio";
  renderSample();
};`;
    res.setHeader('content-type',{'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml'}[path.extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch(e) {res.writeHead(404).end();}
});

(async () => {
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const engine = browserType.name();
  const browser = await browserType.launch({
    executablePath:engine === 'chromium' ? process.env.CHROME_PATH : undefined,
    timeout:15000,
    args:engine === 'chromium' ? ['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-crash-reporter'] : []
  });
  console.log(engine + ' ' + browser.version());
  try {
    const p = await browser.newPage({viewport:{width:360,height:780}});
    await p.goto('http://127.0.0.1:'+server.address().port);
    await p.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
    const auditar = async (sel) => {
      const violations = await p.evaluate(async sel => (await axe.run(sel,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),sel);
      assert.deepEqual(violations,[]);
    };
    for (const [dominio, total, temDor] of [['musculoesqueletico',3,true],['respiratorio',7,false],['misto',4,true]]) {
      await p.evaluate(d=>window.cenario(d),dominio);
      assert.equal(await p.locator('#diarioEtapa').innerText(),'Etapa 1 de '+total);
      assert.equal(await p.locator('#notaDorParado, #notaDorMovimento').count(),0);
      assert.equal(await p.locator('#dorParadoComparacao').isVisible(),temDor);
      assert.equal(await p.locator('#dyspnea_rest').count(),dominio==='musculoesqueletico'?0:1);
      await auditar('#page-sintomas');
      if (dominio==='misto') {
        await p.locator('#diarioProximo').click();
        for (const id of ['rigidezOptions','fadigaOptions','humorOptions','atividadeOptions']) await p.locator('#'+id+' button').first().click();
        await p.locator('#diarioProximo').click();
      }
      if (dominio!=='musculoesqueletico') {
        const botao=p.locator('#dyspnea_rest button').nth(7);
        await botao.focus();
        await p.keyboard.press('Space');
        assert.equal(await botao.getAttribute('aria-pressed'),'true');
        assert.match(await p.locator('#avisoFaltaDeAr').innerText(),/SAMU/);
        await auditar('#page-sintomas');
        await p.locator('#diarioProximo').click();
        assert.equal(await p.locator('#dyspnea_exertion').isVisible(),true);
        if (dominio==='misto'){
          assert.equal(await p.locator('#diarioEtapa').innerText(),'Etapa 3 de 4');
          assert.equal(await p.locator('#diarioErro').isVisible(),true);
        }
        for (const id of ['dyspnea_exertion','cough_level','secretion_level','airway_dryness']) {
          await p.locator('#'+id+' button').first().click();
          await auditar('#page-sintomas');
          if (dominio!=='misto') await p.locator('#diarioProximo').click();
        }
        if (dominio==='misto'){
          await p.locator('#diarioProximo').click();
          assert.equal(await p.locator('#diarioEtapa').innerText(),'Etapa 4 de 4');
          await p.locator('#diarioSinaisTitulo').waitFor();
        }
      }
      console.log('Navegador e axe-core: '+dominio);
    }
    await p.evaluate(()=>window.cenarioAmbiente(false,false));
    assert.equal(await p.locator('#ambientePosRegistro').isVisible(),false);
    await p.evaluate(()=>window.cenarioAmbiente(true,false));
    assert.match(await p.locator('#ambienteAr').innerText(),/indisponíveis/);
    assert.match(await p.locator('#ambienteClima').innerText(),/29%/);
    await p.evaluate(()=>window.cenarioAmbiente(true,true));
    assert.match(await p.locator('#ambienteAr').innerText(),/Ozônio/);
    await auditar('#ambientePosRegistro');
    console.log('Navegador e axe-core: card após envio, com e sem qualidade do ar');
    await p.evaluate(()=>window.cenarioParques(true));
    assert.equal(await p.locator('#verParquesProximos').getAttribute('hidden'),null);
    await p.evaluate(()=>window.cenarioParques(false));
    assert.notEqual(await p.locator('#verParquesProximos').getAttribute('hidden'),null);
    assert.equal(await p.getByText('Adicionar caminhada ao ar livre',{exact:true}).count(),0);
    for (const [categoria, dominio] of [['Ortopédico','musculoesqueletico'],['Respiratório','respiratorio'],['Misto','misto']]) {
      await p.evaluate(()=>window.cenarioEditor());
      await p.locator('#nomePlanoProf').fill('Plano fictício');
      await p.locator('#avancarPlanoProf').click();
      await p.locator('#tituloCategoriaPlano').waitFor();
      assert.equal(await p.evaluate(()=>document.activeElement.id),'tituloCategoriaPlano');
      await auditar('#page-editor-prof');
      await p.getByRole('button',{name:categoria,exact:true}).click();
      assert.equal(await p.locator('#dominioPlanoProf').inputValue(),dominio);
      await p.locator('#page-exercise-source-prof.active').waitFor();
      if(dominio==='respiratorio'){
        await p.getByRole('button',{name:'Escolher na biblioteca respiratória'}).click();
        assert.equal(await p.locator('#exercisebankResults .bank-result').count(),5);
      }
    }
    console.log('Navegador e axe-core: escolha de categoria após nome e orientações');
    await p.evaluate(()=>window.cenarioProf());
    await p.evaluate(()=>window.cenarioTabela());
    assert.match(await p.locator('.tabela-longitudinal tbody').innerText(),/Ressecamento/);
    await auditar('.tabela-longitudinal');
    console.log('Navegador e axe-core: tabela longitudinal');
    assert.equal(await p.locator('#exercisebankResults .bank-result').count(),5);
    await auditar('#page-exercise-bank-prof');
    await p.locator('#exercisebankResults .bank-result').nth(2).getByRole('button',{name:'Selecionar exercício'}).click();
    const dialog=p.locator('#exerciseConfigDialog');
    assert.equal(await dialog.getByLabel('Ciclos respiratórios').inputValue(),'5');
    assert.equal(await dialog.getByLabel('Sustento inspiratório (segundos)').inputValue(),'3');
    assert.equal(await dialog.getByLabel('Descanso entre séries (segundos)').inputValue(),'90');
    await auditar('#exerciseConfigDialog');
    assert.equal(await dialog.getByLabel('Nome do exercício').inputValue(),'Inspiração Fracionada em Tempos');
    const concluir=dialog.getByRole('button',{name:'Concluir inserção'});
    await concluir.click();
    assert.equal(await dialog.locator('#erroConfigExercicio').innerText(),'Informe a frequência do exercício.');
    assert.equal(await p.evaluate(()=>document.activeElement.name),'frequency');
    await dialog.getByLabel(/Frequência/).fill('2x ao dia');
    await concluir.click();
    await dialog.waitFor({state:'hidden'});
    assert.equal(await p.locator('#itensPlanoProf [name="customName"]').inputValue(),'Inspiração Fracionada em Tempos');

    console.log('Navegador e axe-core: biblioteca e configuração respiratória');

  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
