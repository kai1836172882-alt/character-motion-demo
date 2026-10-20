(function(root){
'use strict';
const vertex=`attribute vec2 position;attribute vec2 texCoord;attribute vec2 source;
varying vec2 uv;varying vec2 pixel;
void main(){uv=texCoord;pixel=source;gl_Position=vec4(position.x/543.-1.,1.-position.y/724.,0.,1.);}`;
const fragment=`precision highp float;
varying vec2 uv;varying vec2 pixel;
uniform sampler2D image;uniform sampler2D original;uniform sampler2D expression;
uniform float face,blink,mouth,wire;
float area(vec2 p,vec2 center,vec2 radius,float angle){
 vec2 d=p-center;float c=cos(angle),s=sin(angle);d=mat2(c,-s,s,c)*d;
 return 1.-smoothstep(.72,1.,length(d/radius));
}
void main(){
 vec4 color=texture2D(image,uv);
 if(face>.5){
  vec4 open=texture2D(original,pixel/vec2(1086.,1448.));
  vec4 closed=texture2D(expression,pixel/vec2(1086.,1448.));
  float eyes=max(area(pixel,vec2(474.,301.),vec2(55.,32.),-.24),area(pixel,vec2(605.,262.),vec2(53.,32.),-.27));
  float mm=area(pixel,vec2(562.,359.),vec2(38.,25.),-.24);
  float c=cos(-.24),s=sin(-.24);vec2 q=pixel-vec2(562.,359.);
  vec2 local=vec2(c*q.x+s*q.y,-s*q.x+c*q.y);
  float openness=.23+mouth*1.12;local.y/=openness;
  vec2 sampleP=vec2(c*local.x-s*local.y,s*local.x+c*local.y)+vec2(562.,359.);
  float interior=area(pixel,vec2(562.,359.),vec2(29.,max(5.,18.*openness)),-.24);
  vec4 lips=mix(closed,texture2D(original,sampleP/vec2(1086.,1448.)),interior*smoothstep(0.,.16,mouth));
  color=mix(closed,lips,step(.01,mm));color.a*=max(eyes*blink,mm);
 }
 if(wire>.5)color=vec4(.20,.90,.67,color.a*.65);
 if(color.a<.032)discard;
 gl_FragColor=vec4(color.rgb*color.a,color.a);
}`;
async function create(canvas,manifest,assets){
  const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true});
  if(!gl)throw Error('WebGL unavailable');
  const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const loc=Object.fromEntries(['face','blink','mouth','wire','image','original','expression'].map(k=>[k,gl.getUniformLocation(program,k)]));
  const attributes=Object.fromEntries(['position','texCoord','source'].map(k=>[k,gl.getAttribLocation(program,k)]));
  for(const a of Object.values(attributes))gl.enableVertexAttribArray(a);
  async function texture(url){
    const img=new Image();img.src=url;await img.decode();
    const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);return tex;
  }
  function buffer(data,target=gl.ARRAY_BUFFER){const b=gl.createBuffer();gl.bindBuffer(target,b);gl.bufferData(target,data,gl.STATIC_DRAW);return b;}
  const parts=[];
  // Sequential decode bounds transient decoded-image memory on mobile.
  for(const part of [...manifest.parts].reverse()){
    const m=CharacterRig.mesh(part);
    parts.push({...part,m,texture:await texture(part.url),positions:buffer(new Float32Array(m.points.flat())),uv:buffer(new Float32Array(m.uv.flat())),source:buffer(new Float32Array(m.points.flat())),indices:buffer(new Uint16Array(m.indices),gl.ELEMENT_ARRAY_BUFFER),lines:buffer(new Uint16Array(m.lines),gl.ELEMENT_ARRAY_BUFFER),data:new Float32Array(m.points.length*2)});
  }
  const originals=[await texture(assets.original),await texture(assets.expression)];
  const face={id:'face-overlay',kind:'body',left:410,top:220,width:250,height:180};
  const m=CharacterRig.mesh(face,20);
  parts.push({...face,m,face:true,texture:originals[0],positions:buffer(new Float32Array(m.points.flat())),uv:buffer(new Float32Array(m.uv.flat())),source:buffer(new Float32Array(m.points.flat())),indices:buffer(new Uint16Array(m.indices),gl.ELEMENT_ARRAY_BUFFER),data:new Float32Array(m.points.length*2)});
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
  function attribute(name,b){gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.vertexAttribPointer(attributes[name],2,gl.FLOAT,false,0,0);}
  function draw(pose,wire=false){
    gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);
    gl.uniform1f(loc.blink,pose.blink);gl.uniform1f(loc.mouth,pose.mouth);
    for(let i=0;i<2;i++){gl.activeTexture(gl.TEXTURE1+i);gl.bindTexture(gl.TEXTURE_2D,originals[i]);gl.uniform1i(i===0?loc.original:loc.expression,1+i);}
    gl.activeTexture(gl.TEXTURE0);gl.uniform1i(loc.image,0);
    for(const part of parts){
      for(let i=0;i<part.m.points.length;i++){const [x,y]=part.m.points[i],p=CharacterRig.deform(x,y,part,pose);part.data[i*2]=p[0];part.data[i*2+1]=p[1];}
      gl.bindBuffer(gl.ARRAY_BUFFER,part.positions);gl.bufferSubData(gl.ARRAY_BUFFER,0,part.data);
      attribute('position',part.positions);attribute('texCoord',part.uv);attribute('source',part.source);
      gl.bindTexture(gl.TEXTURE_2D,part.texture);gl.uniform1f(loc.face,part.face?1:0);gl.uniform1f(loc.wire,0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,part.indices);gl.drawElements(gl.TRIANGLES,part.m.indices.length,gl.UNSIGNED_SHORT,0);
      if(wire&&!part.face){gl.uniform1f(loc.wire,1);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,part.lines);gl.drawElements(gl.LINES,part.m.lines.length,gl.UNSIGNED_SHORT,0);}
    }
  }
  return {draw,partCount:manifest.parts.length,vertexCount:parts.reduce((n,p)=>n+p.m.points.length,0)};
}
root.CharacterMeshRenderer={create};
})(window);
