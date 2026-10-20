const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = {'/':'index.html','/index.html':'index.html','/app.js':'app.js','/motion.js':'motion.js','/style.css':'style.css','/assets/original.png':'assets/original.png','/assets/expression.png':'assets/expression.png'};
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'};
http.createServer((req,res)=>{
  const name=files[new URL(req.url,'http://localhost').pathname];
  if(!name){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(name)],'Cache-Control':'no-store'});
  res.end(fs.readFileSync(path.join(root,name)));
}).listen(0,'127.0.0.1',function(){console.log('http://127.0.0.1:'+this.address().port);});
