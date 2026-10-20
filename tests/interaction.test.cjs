const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const CharacterMotion=require('../motion.js');
async function harness(reduced=false){
  const elements=new Map(),buttons=Object.keys(CharacterMotion.durations).map(name=>element({motion:name}));
  function element(dataset={}){return {dataset,checked:true,value:'0',textContent:'',style:{},attributes:{},classList:{add(){},remove(){},toggle(){}},setAttribute(k,v){this.attributes[k]=v;},addEventListener(){},getBoundingClientRect(){return {left:0,top:0,width:1000,height:1000};}};}
  const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  const gl=new Proxy({},{get:(_,key)=>key==='getShaderParameter'||key==='getProgramParameter'?()=>true:()=>0});
  get('character').getContext=()=>gl;
  class FakeAudio{constructor(){this.paused=true;}async play(){this.paused=false;}pause(){this.paused=true;}removeAttribute(){}load(){}}
  class FakeContext{async resume(){}createAnalyser(){return {fftSize:1024,getFloatTimeDomainData(a){a.fill(.1);},connect(){},disconnect(){}};}createMediaElementSource(){return {connect(){},disconnect(){}};}}
  let frame,now=0;
  const context={CharacterMotion,document:{getElementById:get,querySelectorAll:()=>buttons,addEventListener(){}},matchMedia:()=>({matches:reduced}),performance:{now:()=>0},Image:class{async decode(){}},Audio:FakeAudio,AudioContext:FakeContext,URL:{createObjectURL:()=>'',revokeObjectURL(){}},requestAnimationFrame:fn=>{frame=fn;},console,window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  const api=context.window.characterPreview;
  assert(api.getState().ready);
  return {get,buttons,api,step(seconds){for(let i=0;i<Math.ceil(seconds/.02);i++){now+=20;frame(now);}}};
}
test('暂停音频后，点击单个动作或轮流演示能同时恢复声音',async()=>{
  for(const trigger of ['tilt','sequence','blinkOnce']){
    const h=await harness();await h.get('audioFile').onchange({target:{files:[{name:'voice.wav'}],value:'voice.wav'}});
    assert(h.api.getState().audioPlaying);h.get('pause').onclick();assert(h.api.getState().paused);
    if(trigger==='tilt')h.api.play('tilt');else h.get(trigger).onclick();
    assert.equal(h.api.getState().paused,false);
    assert.equal(h.api.getState().audioPlaying,true,trigger+' 未恢复声音');
  }
});
test('动作可以互相打断，轮播结束后解除按钮状态，复位清除所有动作',async()=>{
  const h=await harness();h.get('idle').checked=false;
  h.api.play('tilt');h.step(.8);assert(h.api.getState().sway>0);
  h.api.play('happy');assert.equal(h.api.getState().motion,'happy');
  h.get('sequence').onclick();h.step(20);assert.equal(h.api.getState().sequence,false);
  assert.equal(h.get('sequence').attributes['aria-pressed'],'false');
  h.get('reset').onclick();assert.equal(h.api.getState().motion,null);assert.equal(h.api.getState().mouth,0);
});
test('减少动态效果下不会自行触发新动作，手动动作仍可运行',async()=>{
  const h=await harness(true);h.step(25);
  for(const id of ['idle','follow','hair','blink','breath'])assert.equal(h.get(id).checked,false);
  for(const name of ['blink','lookX','lookY','sway','hair','breath'])assert.equal(h.api.getState()[name],0);
  h.api.play('tilt');h.step(1);assert(h.api.getState().sway>.5);
});
test('默认待机不动头，点头和摇头无法触发',async()=>{
  const h=await harness();
  assert.equal(h.api.play('nod'),false);assert.equal(h.api.play('shake'),false);
  assert.equal(h.get('follow').checked,false);
  for(let i=0;i<400;i++){
    h.step(.1);const pose=h.api.getState();
    for(const key of ['sway','lookX','lookY'])assert.equal(pose[key],0);
    assert(!pose.nod);
  }
});
