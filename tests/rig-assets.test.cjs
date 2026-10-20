const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),m=require('../assets/rig/manifest.json');
test('每个原始图层仅归属一个绘制部件，纹理和原位坐标完整',()=>{
  const ids=m.parts.flatMap(p=>p.sourceLayers);
  assert.equal(ids.length,102);assert.equal(new Set(ids).size,102);
  assert.equal(m.sourceLayerCount,102);
  assert(m.parts.some(p=>p.id==='body-underpaint'));
  assert(m.hiddenRepainted>0);
  for(const p of m.parts){
    assert(fs.existsSync(path.join(root,p.url)),p.url);
    assert(p.left>=0&&p.top>=0&&p.width>0&&p.height>0);
    assert(p.left+p.width<=1086&&p.top+p.height<=1448,p.id);
    assert(p.width*2<=4096&&p.height*2<=4096,p.id);
  }
});
test('网页清单与离线打包清单一致',()=>{
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'rig-assets.js'),'utf8'),context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.CHARACTER_ASSETS)),m);
});
