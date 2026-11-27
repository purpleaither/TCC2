const assert = require("node:assert/strict");
const test = require("node:test");

test("acompanha a caminhada e encerra o GPS ao fechar o mapa", async t => {
  const {createWalkingNavigation} = await import("../services/walkingNavigation.js");
  const button = {};
  const status = {textContent:"",dataset:{}};
  const root = {querySelector:selector => selector.includes("acao") ? button : status};
  const stopped = [];
  const origins = [];
  let gps;
  let time = 1000;
  t.mock.method(globalThis, "fetch", async url => {
    const request = new URL(url);
    assert.equal(request.searchParams.get("steps"),"true");
    const rawOrigin = request.pathname.split("/").at(-1).split(";")[0];
    origins.push(rawOrigin);
    const [lon,lat] = rawOrigin.split(",").map(Number);
    return Response.json({code:"Ok",waypoints:[{distance:0},{distance:0}],routes:[{
      distance:220,duration:160,geometry:{coordinates:[[lon,lat],[lon+.001,lat],[lon+.001,lat+.001]]},
      legs:[{steps:[
        {distance:108,maneuver:{type:"depart"}},
        {distance:112,maneuver:{type:"turn",modifier:"right"},name:"Rua fictícia"},
        {distance:0,maneuver:{type:"arrive"}}
      ]}]
    }]});
  });
  t.mock.method(performance, "now", () => time);
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis,"navigator");
  Object.defineProperty(globalThis,"navigator",{configurable:true,value:{geolocation:{
    watchPosition(success){ gps=success; return 42; },
    clearWatch(id){ stopped.push(id); }
  }}});
  globalThis.document = Object.assign(new EventTarget(),{hidden:false});
  t.after(()=>{
    delete globalThis.document;
    Object.defineProperty(globalThis,"navigator",previousNavigator);
  });

  const signal = new AbortController();
  const updates = [];
  createWalkingNavigation(root,signal.signal,()=>({latitude:-15.81,longitude:-47.91}),
    (...args)=>updates.push(args));
  button.onclick();
  const fix = (latitude,longitude) => gps({coords:{latitude,longitude,accuracy:12}});
  fix(-15.80012,-47.90012);
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(status.textContent,/Vire à direita em .*Rua fictícia/);
  assert.equal(status.dataset.icon,"↱");
  assert.deepEqual(origins,["-47.9,-15.8"]);
  assert.equal(updates[0][0].latitude,-15.80012);
  time += 16000;
  fix(-15.80712,-47.90712);
  assert.equal(origins.length,1);
  fix(-15.80713,-47.90713);
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(origins,["-47.9,-15.8","-47.907,-15.807"]);
  signal.abort();
  assert.deepEqual(stopped,[42]);
  assert.equal(updates.at(-1)[0],undefined);
  assert.equal(button.textContent,"Iniciar trajeto");
});
