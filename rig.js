(function(root){
'use strict';
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const zero=()=>({blink:0,mouth:0,sway:0,lookX:0,lookY:0,breath:0,bust:0,hair:0,cloth:0});
function spring(s,target,dt){
  // Substeps keep the damped follower stable after a slow browser frame.
  const n=Math.max(1,Math.ceil(dt/.012)),h=Math.min(dt,.05)/n;
  for(let i=0;i<n;i++){s.v+=(42*(target-s.x)-9*s.v)*h;s.x+=s.v*h;}
  return s.x;
}
function body(x,y,p){
  const chest=smooth(415,545,y)*(1-smooth(750,875,y));
  const horizontal=Math.exp(-Math.pow((x-630)/240,4));
  let dx=(x-630)*.006*p.breath*chest*horizontal;
  let dy=-3.5*p.breath*chest*horizontal;
  // One shared garment field keeps the blouse halves, neckline and tie root joined.
  const volume=Math.exp(-Math.pow((x-640)/190,4))*smooth(540,640,y)*(1-smooth(745,815,y));
  dx+=(x-640)*.009*p.bust*volume;dy+=4.8*p.bust*volume;
  const hw=1-smooth(310,650,y),a=-p.sway*.023*hw,c=Math.cos(a),s=Math.sin(a);
  dx+=(x-550)*(c-1)-(y-470)*s+p.sway*5*hw+p.lookX*9*hw;
  dy+=(x-550)*s+(y-470)*(c-1)+p.lookY*6*hw;
  return [x+dx,y+dy];
}
function deform(x,y,part,p){
  const out=body(x,y,p),anchor=part.anchor||[0,0];
  const tip=smooth(anchor[1],anchor[1]+(part.length||320),y);
  if(part.kind==='frontHair'){
    out[0]+=p.hair*1.1*tip*Math.sin(y*.004+anchor[0]*.006);
    out[1]+=p.hair*.25*tip;
  }else if(part.kind==='rearHair'){
    // A continuous field across adjacent rear-hair cuts prevents seams.
    const outer=smooth(170,330,Math.abs(x-565));
    const w=smooth(350,1000,y)*(1-smooth(1190,1300,y))*outer,side=x<550?-1:1;
    out[0]+=p.hair*4*w*Math.sin(y*.003+side*.55);
    out[1]+=p.hair*.8*w*side;
  }else if(part.kind==='tie'){
    // Tie inherits the movement of its knot, not the cloth under its free end.
    const base=body(anchor[0],anchor[1],p);
    out[0]=base[0]+(x-anchor[0])+p.cloth*5*tip;
    out[1]=base[1]+(y-anchor[1])+p.cloth*2*tip;
  }else if(part.kind==='accessory'){
    const free=tip*(1-smooth(1190,1280,y));
    out[0]+=p.cloth*1.2*free;out[1]+=p.cloth*.35*free;
  }else if(part.kind==='skirt'){
    const w=smooth(900,1140,y)*(1-smooth(1190,1260,y));
    out[0]+=p.cloth*.8*w*Math.sin((x-550)*.006);
  }else if(part.kind==='sleeve'){
    const w=smooth(760,1120,y)*(1-smooth(1180,1320,y));
    out[0]+=p.cloth*.6*w;
  }
  return out;
}
function mesh(part,step=28){
  const nx=Math.max(1,Math.ceil(part.width/step)),ny=Math.max(1,Math.ceil(part.height/step));
  const points=[],uv=[],indices=[],lines=[];
  for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
    points.push([part.left+x/nx*part.width,part.top+y/ny*part.height]);uv.push([x/nx,y/ny]);
  }
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const a=y*(nx+1)+x,b=a+1,c=a+nx+1,d=c+1;
    indices.push(a,b,c,b,d,c);lines.push(a,b,a,c,b,c);
  }
  return {points,uv,indices,lines};
}
const api={zero,spring,deform,mesh};
if(typeof module!=='undefined')module.exports=api;else root.CharacterRig=api;
})(typeof window!=='undefined'?window:globalThis);
