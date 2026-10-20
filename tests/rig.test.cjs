const test=require('node:test'),assert=require('node:assert/strict');
let Rig;
try{Rig=require('../rig.js');}catch{}
test('分层网格接口可用',()=>assert(Rig,'需要独立的分层网格模块'));
test('零参数保持原位置，默认身体动作不改变头部',()=>{
  assert(Rig);const zero=Rig.zero();
  for(const kind of ['body','blouse','frontHair','rearHair','tie','accessory','skirt']){
    assert.deepEqual(Rig.deform(600,700,{kind,anchor:[650,650]},zero),[600,700]);
  }
  const p={...zero,breath:1,bust:.8,hair:1,cloth:.8};
  assert.deepEqual(Rig.deform(540,240,{kind:'body'},p),[540,240]);
  assert.deepEqual(Rig.deform(665,670,{kind:'tie',anchor:[665,670]},p),
    Rig.deform(665,670,{kind:'blouse'},p));
  assert.notDeepEqual(Rig.deform(665,840,{kind:'tie',anchor:[665,670]},p),
    Rig.deform(665,840,{kind:'blouse'},p));
});
test('弹簧跟随有延迟，可稳定回到静止位置',()=>{
  assert(Rig);const s={x:0,v:0};
  Rig.spring(s,1,1/60);assert(s.x>0&&s.x<.2);
  for(let i=0;i<300;i++)Rig.spring(s,1,1/60);
  assert(Math.abs(s.x-1)<.001);
  for(let i=0;i<300;i++)Rig.spring(s,0,1/60);
  assert(Math.abs(s.x)<.001);
  assert(Number.isFinite(s.v));
});
test('后发残留层的躯干和腿部像素不能跟随后发摆动',()=>{
  assert(Rig);const p={...Rig.zero(),hair:2.4};
  for(const point of [[540,850],[350,1370],[820,1400]]){
    assert.deepEqual(Rig.deform(...point,{kind:'rearHair'},p),point);
  }
  assert.notDeepEqual(Rig.deform(1000,1000,{kind:'rearHair'},p),[1000,1000]);
});
test('最大幅度下网格三角形不翻转或撕裂',()=>{
  assert(Rig);
  const kinds=['body','blouse','frontHair','rearHair','tie','accessory','skirt','sleeve'];
  for(const kind of kinds){
    const part={kind,anchor:kind==='tie'?[665,670]:[450,420],left:0,top:0,width:1086,height:1448};
    const mesh=Rig.mesh(part,40);
    for(const sign of [-1,1]){
      const pose={...Rig.zero(),breath:1.82*sign,bust:1.82*sign,hair:2.4*sign,cloth:1.82*sign};
      const moved=mesh.points.map(([x,y])=>Rig.deform(x,y,part,pose));
      for(let i=0;i<mesh.indices.length;i+=3){
        const [a,b,c]=mesh.indices.slice(i,i+3).map(j=>moved[j]);
        assert((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0,kind);
      }
    }
  }
});
