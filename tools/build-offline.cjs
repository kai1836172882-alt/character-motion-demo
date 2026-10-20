const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),output=process.argv[2];
if(!output)throw new Error('请提供输出 HTML 路径');
const assets=Object.fromEntries(['original','expression'].map(key=>[key,'data:image/png;base64,'+fs.readFileSync(path.join(root,'assets',key+'.png')).toString('base64')]));
const script=fs.readFileSync(path.join(root,'app.js'),'utf8').replace(/const ASSETS=.*?;/,'const ASSETS='+JSON.stringify(assets)+';');
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+fs.readFileSync(path.join(root,'style.css'),'utf8')+'</style>');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/rig/manifest.json'),'utf8'));
for(const part of manifest.parts)part.url='data:image/webp;base64,'+fs.readFileSync(path.join(root,part.url)).toString('base64');
html=html.replace(/<script src="([^"?]+)(?:\?[^"]*)?"><\/script>/g,(_,file)=>{
  const content=file==='app.js'?script:file==='rig-assets.js'?'window.CHARACTER_ASSETS='+JSON.stringify(manifest)+';':fs.readFileSync(path.join(root,file),'utf8');
  return '<script>'+content+'</script>';
});
fs.writeFileSync(output,html);console.log(output);
