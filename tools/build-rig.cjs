// Rebuild from the aligned PSD export; originals are never overwritten.
const fs=require('node:fs'),path=require('node:path');
const sharp=require(process.env.CHARACTER_SHARP_MODULE||'sharp');
const root=path.resolve(__dirname,'..'),source=process.argv[2],paintFile=process.argv[3];
if(!source||!paintFile)throw Error('Usage: node tools/build-rig.cjs PSD_EXPORT_DIR UNDERPAINT.png');
const input=JSON.parse(fs.readFileSync(path.join(source,'图层清单.json'),'utf8'));
const dest=path.join(root,'assets/rig');fs.mkdirSync(dest,{recursive:true});
const W=2172,H=2896;
function binding(id){
  if(/^hair_(green_front|bang_|face_)/.test(id))return {id:'fringe',kind:'body'};
  if(/^hair_left_/.test(id))return {id:'front-left',kind:'frontHair',anchor:[435,405],length:420};
  if(/^hair_right_/.test(id))return {id:'front-right',kind:'frontHair',anchor:[690,335],length:640};
  if(/^(eye_|lid_|brow_|mouth_)/.test(id))return {id:'features',kind:'body'};
  if(/^earring_/.test(id))return {id:'earring',kind:'accessory',anchor:[670,290],length:80};
  if(/^head_bow/.test(id))return {id:'head-bow',kind:'body'};
  if(/^head_(ribbon|gold)/.test(id))return {id:'head-ribbons',kind:'accessory',anchor:[718,204],length:115};
  if(id==='tie_tail')return {id:'tie-tail',kind:'tie',anchor:[665,670],length:210};
  if(/^tie_/.test(id))return {id:id,kind:'blouse'};
  if(/^waist_bow/.test(id))return {id:'waist-bow',kind:'accessory',anchor:[710,903],length:200};
  if(id==='sash')return {id,kind:'skirt'};
  if(/^sleeve_[lr]_(gold|bow|tail)/.test(id))return {id:id.slice(0,8)+'-ornament',kind:'accessory',anchor:id[7]==='l'?[270,810]:[875,940],length:180};
  if(/^blouse_/.test(id))return {id,kind:'blouse'};
  if(/^skirt_/.test(id))return {id:'skirt',kind:'skirt'};
  if(/^sleeve_/.test(id))return {id:id.slice(0,8),kind:'sleeve'};
  if(/^hair_(rear_|remainder|pony)/.test(id))return {id,kind:'rearHair'};
  return {id:'fixed',kind:'body'};
}
function over(dst,src){for(let i=0;i<dst.length;i+=4){const a=src[i+3]/255;if(!a)continue;const b=dst[i+3]/255,o=a+b*(1-a);for(let c=0;c<3;c++)dst[i+c]=Math.round((src[i+c]*a+dst[i+c]*b*(1-a))/o);dst[i+3]=Math.round(o*255);}}
(async()=>{
  const paint=await sharp(paintFile).ensureAlpha().resize(W,H).raw().toBuffer();
  const covered=new Uint8Array(W*H),groups=[];
  let hiddenRepainted=0,bodyCover=null;
  for(const layer of input.layers){
    const b=binding(layer.id);let g=groups.at(-1);
    if(b.kind==='rearHair'&&!bodyCover)bodyCover=covered.slice();
    if(!g||g.key!==b.id){g={...b,key:b.id,id:String(groups.length).padStart(2,'0')+'-'+b.id,sourceLayers:[],items:[]};groups.push(g);}
    const x=layer.left/2,y=layer.top/2,w=layer.width/2,h=layer.height/2;
    const data=await sharp(path.join(source,layer.path)).ensureAlpha().resize(w,h).raw().toBuffer();
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
      const di=(yy*w+xx)*4,global=(y+yy)*W+x+xx;
      if(layer.hiddenPaintSource==='body'&&covered[global]===255&&(y+yy)>850&&(y+yy)<1800&&data[di+3]&&paint[global*4+3]>=248){
        for(let c=0;c<3;c++)data[di+c]=paint[global*4+c];hiddenRepainted++;
      }
      covered[global]=Math.round(data[di+3]+covered[global]*(1-data[di+3]/255));
    }
    g.items.push({x,y,w,h,data});g.sourceLayers.push(layer.id);
  }
  // A continuous painted body backing covers narrow mask gaps exposed by motion.
  // It sits in front of rear hair and behind all original body/clothing layers.
  const original=await sharp(path.join(root,'assets/original.png')).ensureAlpha().resize(W,H).raw().toBuffer();
  const silhouette=await sharp(path.join(__dirname,'body-outline.svg')).ensureAlpha().raw().toBuffer();
  const backing=Buffer.alloc(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=(y*W+x)*4;
    if(original[i+3]<248||silhouette[i+3]===0||bodyCover[y*W+x]!==255)continue;
    const usePaint=x>640&&x<1700&&y>840&&y<1800&&paint[i+3]>=248;
    const source=usePaint?paint:original;
    for(let c=0;c<3;c++)backing[i+c]=source[i+c];
    backing[i+3]=silhouette[i+3];
  }
  groups.splice(groups.findIndex(g=>g.kind==='rearHair'),0,{id:'body-underpaint',key:'body-underpaint',kind:'body',sourceLayers:[],items:[{x:0,y:0,w:W,h:H,data:backing}]});
  const composite=Buffer.alloc(W*H*4),runtime=[];
  for(const g of groups){
    const x=Math.min(...g.items.map(a=>a.x)),y=Math.min(...g.items.map(a=>a.y));
    const w=Math.max(...g.items.map(a=>a.x+a.w))-x,h=Math.max(...g.items.map(a=>a.y+a.h))-y;
    const canvas=Buffer.alloc(w*h*4);
    for(const l of [...g.items].reverse()){
      for(let yy=0;yy<l.h;yy++){
        const dst=canvas.subarray(((yy+l.y-y)*w+l.x-x)*4,((yy+l.y-y)*w+l.x-x+l.w)*4);
        over(dst,l.data.subarray(yy*l.w*4,(yy+1)*l.w*4));
      }
    }
    const file=g.id+'.webp';await sharp(canvas,{raw:{width:w,height:h,channels:4}}).webp({lossless:true,effort:5}).toFile(path.join(dest,file));
    runtime.push({id:g.id,kind:g.kind,anchor:g.anchor,length:g.length,left:x/2,top:y/2,width:w/2,height:h/2,url:'assets/rig/'+file,sourceLayers:g.sourceLayers});
    g.raster={x,y,w,h,data:canvas};delete g.items;
  }
  for(const g of [...groups].reverse()){
    const l=g.raster;for(let yy=0;yy<l.h;yy++)over(composite.subarray(((yy+l.y)*W+l.x)*4,((yy+l.y)*W+l.x+l.w)*4),l.data.subarray(yy*l.w*4,(yy+1)*l.w*4));
  }
  const manifest={width:1086,height:1448,textureScale:2,sourceResolution:[1086,1448],native4K:false,layerOrder:'top-to-bottom',sourceLayerCount:input.layers.length,hiddenRepainted,parts:runtime};
  fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify(manifest,null,2));
  await sharp(composite,{raw:{width:W,height:H,channels:4}}).resize(1086,1448).png().toFile(path.join(dest,'rest-preview.png'));
  await sharp(paintFile).png().toFile(path.join(dest,'underpaint-source.png'));
  fs.writeFileSync(path.join(root,'rig-assets.js'),'window.CHARACTER_ASSETS='+JSON.stringify(manifest)+';\\n'.replace('\\n','\n'));
  console.log(JSON.stringify({parts:runtime.length,hiddenRepainted,sourceLayers:input.layers.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
