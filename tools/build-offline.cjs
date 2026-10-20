const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),output=process.argv[2];
if(!output)throw new Error('请提供输出 HTML 路径');
const assets=Object.fromEntries(['original','expression'].map(key=>[key,'data:image/png;base64,'+fs.readFileSync(path.join(root,'assets',key+'.png')).toString('base64')]));
const script=fs.readFileSync(path.join(root,'app.js'),'utf8').replace(/const ASSETS=.*?;/,'const ASSETS='+JSON.stringify(assets)+';');
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+fs.readFileSync(path.join(root,'style.css'),'utf8')+'</style>');
html=html.replace('<script src="motion.js"></script><script src="app.js"></script>',()=>'<script>'+fs.readFileSync(path.join(root,'motion.js'),'utf8')+'</script><script>'+script+'</script>');
fs.writeFileSync(output,html);console.log(output);
