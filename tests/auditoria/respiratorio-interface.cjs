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
window.cenarioAcompanhamento = selecionado => {
  user={id:"prof-ficticio"}; profile={role:"fisioterapeuta"}; patientId=selecionado?"paciente-ficticio":null;
  patients=[{id:"paciente-ficticio",display_name:"Paciente fictício"}];
  plans=[{clinical_domain:"misto"}];
  const data=new Date().toISOString();
  professionalWorkouts=[{completed_at:data}];
  records=[{recorded_at:data,dyspnea_rest:0,cough_level:2,airway_dryness:1,stiffness:"Leve",weather_humidity:29,pm2_5:12,weather_uv_index:0,carbon_dioxide:451}];
  menu(); navigate("registros-prof");
};
window.cenarioLinksMapa = async () => {
  const {desenharMapa}=await import("./services/parksMap.js");
  document.querySelectorAll(".page").forEach(pagina=>pagina.classList.toggle("active",pagina.id==="page-exercicios"));
  const guia=document.getElementById("guiaArLivre");
  guia.replaceChildren(document.getElementById("modeloGuiaArLivre").content.cloneNode(true));
  guia.querySelector("[data-guia-resultado]").hidden=false;
  const figure=guia.querySelector("figure");
  const parques=[
    {nome:"Parque fictício A",latitude:-15.81,longitude:-47.91},
    {nome:"Parque fictício B",latitude:-15.82,longitude:-47.92,entrada:{latitude:-15.821,longitude:-47.921}}
  ];
  desenharMapa(figure,{latitude:-15.8,longitude:-47.9},parques,[],new AbortController().signal);
  document.getElementById("parquesDialog").showModal();
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
    await p.evaluate(()=>window.cenarioAmbiente(true,true));
    assert.equal(await p.locator('#ambientePosRegistro, #sheetClimaDesc, #sheetQualidadeAr').count(),0);
    await p.locator('#conselhoDiaTitulo').waitFor();
    console.log('Paciente: medições ambientais ausentes nas telas');
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
      if(dominio==='misto')
        await p.getByRole('button',{name:'Escolher exercícios ortopédicos e respiratórios',exact:true}).waitFor();
      if(dominio==='respiratorio'){
        await p.getByRole('button',{name:'Escolher na biblioteca respiratória'}).click();
        assert.equal(await p.locator('#exercisebankResults .bank-result').count(),5);
      }
    }
    console.log('Navegador e axe-core: escolha de categoria após nome e orientações');
    await p.evaluate(()=>window.cenarioProf());
    await p.evaluate(()=>window.cenarioAcompanhamento(false));
    await p.evaluate(()=>window.AppAuth.navigate("planos-prof"));
    await p.getByRole('heading',{name:'Selecionar paciente',exact:true}).waitFor();
    assert.equal(await p.locator('#listaPlanosProf').innerText(),'');
    assert.equal(await p.locator('#createPlanEntry').isVisible(),false);
    await p.evaluate(()=>window.AppAuth.navigate("registros-prof"));
    assert.equal(await p.locator("#periodoAcompanhamento").isVisible(),false);
    await p.evaluate(()=>window.cenarioAcompanhamento(true));
    await p.evaluate(()=>window.AppAuth.navigate("planos-prof"));
    await p.getByRole('heading',{name:'Gerenciar planos',exact:true}).waitFor();
    await p.locator('#createPlanEntry').waitFor();
    await p.evaluate(()=>window.AppAuth.navigate("registros-prof"));
    await p.locator("#periodoAcompanhamento").waitFor();
    const blocos=p.locator('#graficosRegistrosProf > details');
    assert.deepEqual(await blocos.locator('> summary').allTextContents(),[
      'Treinos concluídos','Sintomas e atividade física','Registros por dia'
    ]);
    assert.equal(await p.getByRole('radio',{name:'30 dias'}).isChecked(),true);
    await blocos.first().getByText('1 treino concluído no período',{exact:true}).waitFor();
    await p.getByText('Sintomas e atividade física',{exact:true}).click();
    await blocos.nth(1).getByRole('heading',{name:'Falta de ar em repouso'}).waitFor();
    await p.getByText('Registros por dia',{exact:true}).click();
    const tabela=p.locator('.tabela-longitudinal table');
    await tabela.getByRole('columnheader',{name:/Ressecamento/}).waitFor();
    await tabela.getByRole('columnheader',{name:'Índice UV'}).waitFor();
    await tabela.getByRole('columnheader',{name:'CO₂ (ppm)'}).waitFor();
    assert.equal(await blocos.nth(2).locator('details').count(),0);
    assert.ok(await p.locator('.tabela-longitudinal').evaluate(el=>el.scrollWidth>el.clientWidth &&
      el.getBoundingClientRect().right<=window.innerWidth));
    const [download]=await Promise.all([
      p.waitForEvent('download'),
      p.getByRole('button',{name:'Baixar tabela (CSV)'}).click()
    ]);
    const csv=fs.readFileSync(await download.path(),'utf8');
    assert.equal(download.suggestedFilename(),'registros-por-dia.csv');
    assert.match(csv,/Índice UV.*CO₂/);
    assert.match(csv,/"0";"451"/);
    await auditar('#page-registros-prof');
    console.log('Navegador e axe-core: acompanhamento e tabela longitudinal');
    await p.route(/tile.openstreetmap.org/,rota=>rota.abort());
    await p.route(/routing.openstreetmap.de/,rota=>rota.fulfill({json:{
      code:'Ok', waypoints:[{distance:0},{distance:0}],
      routes:[{distance:1500,duration:1000,geometry:{coordinates:[[-47.9,-15.8],[-47.921,-15.821]]}}]
    }}));
    await p.evaluate(()=>{
      const desenhar=CanvasRenderingContext2D.prototype.stroke;
      CanvasRenderingContext2D.prototype.stroke=function(...args){
        if(this.strokeStyle==='#004b80')this.canvas.dataset.espessuraRota=String(this.lineWidth*this.canvas.clientWidth/this.canvas.width);
        return desenhar.apply(this,args);
      };
    });
    await p.evaluate(()=>window.cenarioLinksMapa());
    await p.locator('#parqueSelecionado').selectOption('1');
    const canvas=p.locator('#parquesDialog canvas');
    await p.waitForFunction(()=>Number(document.querySelector('#parquesDialog canvas')?.dataset.espessuraRota)>=4.99);
    assert.ok(Number(await canvas.getAttribute('data-espessura-rota'))>=4.99);
    const atalhos=p.locator('.mapa-aplicativos');
    const inicio=await p.locator('[data-trajeto-acao]').boundingBox();
    const separador=await p.locator('[data-trajeto] .guia-local-ou').boundingBox();
    assert.ok(inicio.y+inicio.height<=separador.y);
    assert.ok(separador.y+separador.height<=(await atalhos.boundingBox()).y);
    for(const icone of await atalhos.locator('img').all()){
      await icone.evaluate(img=>img.decode());
      assert.ok(await icone.evaluate(img=>img.nextElementSibling.getBoundingClientRect().top>=img.getBoundingClientRect().bottom));
    }
    const google=new URL(await p.getByRole('link',{name:'Google Maps'}).getAttribute('href'));
    const waze=new URL(await p.getByRole('link',{name:'Waze'}).getAttribute('href'));
    assert.equal(google.origin,'https://www.google.com');
    assert.equal(google.searchParams.get('travelmode'),'walking');
    assert.equal(google.searchParams.get('destination'),'-15.821,-47.921');
    assert.equal(google.searchParams.has('origin'),false);
    assert.equal(waze.origin,'https://www.waze.com');
    assert.equal(waze.searchParams.get('ll'),'-15.821,-47.921');
    await p.setViewportSize({width:1366,height:768});
    await p.waitForFunction(()=>{
      const espessura=Number(document.querySelector('#parquesDialog canvas')?.dataset.espessuraRota);
      return Math.abs(espessura-5)<.02;
    });
    const mapa=await p.locator('#parquesDialog .guia-mapa-superficie').boundingBox();
    const controles=await p.locator('#parquesDialog figcaption').boundingBox();
    assert.ok(mapa.x+mapa.width<controles.x && Math.abs(mapa.y-controles.y)<2);
    await p.locator('#parquesDialog').getByRole('button',{name:'Fechar'}).click();
    await p.setViewportSize({width:360,height:780});
    console.log('Mapa: Google Maps e Waze seguem o parque selecionado');
    await p.evaluate(()=>window.cenarioProf());
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

    const sessao=await browser.newPage();
    await sessao.route('**/acesso.js',rota=>rota.fulfill({path:path.join(pasta,'acesso.js'),contentType:'text/javascript'}));
    await sessao.route('**/api/database-config',rota=>rota.fulfill({json:{
      configured:true,url:'https://teste.invalid',publishableKey:'ficticia'
    }}));
    await sessao.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',rota=>rota.fulfill({
      contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`
        export function createClient(){
          const usuario={id:"sessao-ficticia",display_name:"Perfil fictício",role:"fisioterapeuta"};
          const sessao=()=>localStorage.getItem("sessao-ficticia")?{user:usuario}:null;
          return {
            auth:{
              getSession:async()=>({data:{session:sessao()}}),
              getUser:async()=>({data:{user:sessao()?.user}}),
              signInWithPassword:async()=>{localStorage.setItem("sessao-ficticia","1");return {data:{session:sessao()}};},
              signOut:async()=>{localStorage.removeItem("sessao-ficticia");return {error:null};},
              onAuthStateChange:()=>{}
            },
            from:tabela=>({select:()=>({eq:()=>tabela==="profiles"
              ?{single:async()=>({data:usuario})}:Promise.resolve({data:[]})})})
          };
        }`
    }));
    await sessao.clock.install();
    await sessao.goto('http://127.0.0.1:'+server.address().port);
    await sessao.locator('#loginEmail').fill('teste@example.com');
    await sessao.locator('#loginSenha').fill('senha-ficticia');
    await sessao.locator('#loginSubmit').click();
    const painelSessao=sessao.locator('#page-profissional.active');
    await painelSessao.waitFor();
    await sessao.clock.fastForward(29*60*1000);
    await sessao.locator('#profGreeting').click();
    const chave='tcc:atividade:sessao-ficticia';
    const ultimo=await sessao.evaluate(chave=>localStorage.getItem(chave),chave);
    await sessao.reload();
    await painelSessao.waitFor();
    assert.equal(await sessao.evaluate(chave=>localStorage.getItem(chave),chave),ultimo);
    await sessao.clock.fastForward(29*60*1000);
    assert.equal(await painelSessao.isVisible(),true);
    await sessao.clock.fastForward(2*60*1000);
    await sessao.locator('#page-login.active').waitFor();
    assert.match(await sessao.locator('#loginStatus').innerText(),/inatividade/);
    await sessao.reload();
    await sessao.locator('#loginSubmit:enabled').waitFor();
    assert.equal(await painelSessao.count(),0);
    await sessao.close();
    console.log('Sessão: login, recarga, renovação por interação e encerramento por inatividade.');

  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
