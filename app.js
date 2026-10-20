(() => {
'use strict';
const $=id=>document.getElementById(id),canvas=$('character');
const ASSETS={original:'assets/original.png',expression:'assets/expression.png'};
const motionNames={nod:'轻轻点头',shake:'左右摇头',tilt:'歪头听你说',doubleBlink:'双眨眼',happy:'开心回应'};
const motionButtons=[...document.querySelectorAll('[data-motion]')];
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let paused=false,clock=0,last=performance.now(),blinkStart=-10,nextBlink=2.4,demoEnd=0;
let activeMotion=null,sequenceQueue=null,sequenceNext=0,nextIdle=7;
let pointer={x:0,y:0,until:0},gaze={x:0,y:0};
const gesture={blink:0,mouth:0,sway:0,nod:0,lookX:0,lookY:0};
let audio=null,audioURL=null,context=null,analyser=null,audioSource=null,audioRequest=0,level=0;
let gl,program,locations={},ready=false,manualPose=null;
const state={blink:0,mouth:0,sway:0,breath:0,nod:0,lookX:0,lookY:0,hair:0};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function status(text){$('status').textContent=text;}
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
const fragment=`precision highp float;
varying vec2 uv; uniform sampler2D original; uniform sampler2D expression;
uniform float blink,mouth,sway,breath,nod,lookX,lookY,hair;
const vec2 size=vec2(1086.,1448.);
float area(vec2 p,vec2 center,vec2 radius,float angle){vec2 d=p-center;float c=cos(angle),s=sin(angle);d=mat2(c,-s,s,c)*d;return 1.-smoothstep(.72,1.,length(d/radius));}
void main(){
 vec2 p=uv*size;
 // Continuous deformation around neck and waist: no separated cutout edges.
 float hw=1.-smoothstep(310.,650.,p.y);float a=sway*.023*hw;
 vec2 d=p-vec2(550.,470.);p=vec2(550.,470.)+mat2(cos(a),-sin(a),sin(a),cos(a))*d;
 p.x-=sway*5.*hw+lookX*9.*hw;
 p.y-=lookY*6.*hw;
 p.y=300.+(p.y-300.)/(1.-nod*.014*hw)-nod*8.*hw;
 // Small continuous offsets at the outer hair; the face and torso stay stable.
 float hairWeight=smoothstep(135.,340.,abs(p.x-550.))*smoothstep(350.,700.,p.y)*(1.-smoothstep(1200.,1448.,p.y));
 p.x+=hair*3.5*hairWeight*sin(p.y*.006);
 float bw=exp(-pow((p.y-625.)/250.,2.));p.x=550.+(p.x-550.)/(1.+breath*.006*bw);p.y+=breath*3.2*bw;
 if(p.x<0.||p.y<0.||p.x>1086.||p.y>1448.){gl_FragColor=vec4(0.);return;}
 vec4 color=texture2D(original,p/size);vec4 closed=texture2D(expression,p/size);
 float eyes=max(area(p,vec2(474.,301.),vec2(55.,32.),-.24),area(p,vec2(605.,262.),vec2(53.,32.),-.27));
 color=mix(color,closed,eyes*blink);
 // Closed-mouth paint underneath; opening samples the original mouth at variable height.
 float mm=area(p,vec2(562.,359.),vec2(38.,25.),-.24);
 vec4 lips=closed;vec2 q=p-vec2(562.,359.);float c=cos(-.24),s=sin(-.24);
 vec2 local=vec2(c*q.x+s*q.y,-s*q.x+c*q.y);
 float openness=.23+mouth*1.12;local.y/=openness;
 vec2 sampleP=vec2(c*local.x-s*local.y,s*local.x+c*local.y)+vec2(562.,359.);
 float interior=area(p,vec2(562.,359.),vec2(29.,max(5.,18.*openness)),-.24);
 lips=mix(closed,texture2D(original,sampleP/size),interior*smoothstep(0.,.16,mouth));
 color=mix(color,lips,mm);if(color.a<.032)color=vec4(0.);
 gl_FragColor=color;
}`;
async function texture(url,index,name){const img=new Image();img.src=url;await img.decode();gl.activeTexture(gl.TEXTURE0+index);const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.uniform1i(gl.getUniformLocation(program,name),index);}
function draw(pose){for(const key of Object.keys(state))gl.uniform1f(locations[key],pose[key]);gl.drawArrays(gl.TRIANGLES,0,6);}
function stopAudio(){audioRequest++;if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio=null;}if(audioSource){audioSource.disconnect();audioSource=null;}if(analyser){analyser.disconnect();analyser=null;}if(audioURL){URL.revokeObjectURL(audioURL);audioURL=null;}$('stop').disabled=true;level=0;}
function resume(){
 if(paused&&audio)audio.play().catch(()=>status('音频无法继续，请重新导入。'));
 paused=false;$('pause').textContent='暂停动作';
}
function motionMessage(text){$('motionStatus').textContent=text;}
function stopSequence(){sequenceQueue=null;$('sequence').textContent='轮流演示';$('sequence').setAttribute('aria-pressed','false');}
function playGesture(name,fromSequence=false){
 if(!Object.hasOwn(CharacterMotion.durations,name))return false;
 if(!fromSequence)stopSequence();
 resume();manualPose=null;activeMotion={name,start:clock};nextIdle=clock+9+Math.random()*4;
 motionButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.motion===name)));
 motionMessage('正在'+motionNames[name]+'…');return true;
}
motionButtons.forEach(button=>{button.setAttribute('aria-pressed','false');button.onclick=()=>playGesture(button.dataset.motion);});
$('sequence').onclick=()=>{
 if(sequenceQueue){stopSequence();activeMotion=null;motionButtons.forEach(b=>b.setAttribute('aria-pressed','false'));motionMessage('已停止轮流演示。');return;}
 sequenceQueue=Object.keys(motionNames);sequenceNext=clock;resume();manualPose=null;
 $('sequence').textContent='停止演示';$('sequence').setAttribute('aria-pressed','true');activeMotion=null;
};
function movePointer(event){
 if(!$('follow').checked)return;
 const rect=$('stage').getBoundingClientRect();
 pointer={x:clamp((event.clientX-rect.left)/rect.width*2-1,-1,1),y:clamp((event.clientY-rect.top)/rect.height*2-1,-1,1),until:event.pointerType==='touch'?clock+1.4:Infinity};
}
$('stage').addEventListener('pointermove',movePointer);
$('stage').addEventListener('pointerdown',movePointer);
$('stage').addEventListener('pointerleave',()=>{pointer={x:0,y:0,until:0};});
$('follow').onchange=()=>{pointer={x:0,y:0,until:0};};
$('idle').onchange=()=>{nextIdle=clock+6;};
function frame(now){const dt=Math.min((now-last)/1000,.05);last=now;
 if(!paused){clock+=dt;if($('blink').checked&&clock>=nextBlink){blinkStart=clock;nextBlink=clock+3+Math.random()*2;}
 const age=clock-blinkStart;state.blink=age>=0&&age<.26?Math.pow(Math.sin(age/.26*Math.PI),.65):0;
 const intensity=Number($('intensity').value)/55;
 if(activeMotion&&clock-activeMotion.start>=CharacterMotion.durations[activeMotion.name]){
   activeMotion=null;motionButtons.forEach(b=>b.setAttribute('aria-pressed','false'));sequenceNext=clock+.65;
   if(!sequenceQueue)motionMessage('动作结束，回到自然待机。');
 }
 if(sequenceQueue&&!activeMotion&&clock>=sequenceNext){
   if(sequenceQueue.length)playGesture(sequenceQueue.shift(),true);
   else{stopSequence();motionMessage('五个动作已演示完毕。');}
 }
 if($('idle').checked&&!activeMotion&&!sequenceQueue&&clock>=nextIdle){
   const choices=['nod','tilt','doubleBlink'];playGesture(choices[Math.floor(Math.random()*choices.length)]);
 }
 const desired=activeMotion?CharacterMotion.sample(activeMotion.name,clock-activeMotion.start):CharacterMotion.sample('',0);
 for(const key of Object.keys(gesture))gesture[key]+=(desired[key]-gesture[key])*(1-Math.exp(-dt*(key==='blink'?38:15)));
 const tracking=$('follow').checked&&pointer.until>clock;
 gaze.x+=((tracking?pointer.x:0)-gaze.x)*(1-Math.exp(-dt*4));
 gaze.y+=((tracking?pointer.y:0)-gaze.y)*(1-Math.exp(-dt*4));
 state.sway=clamp((($('sway').checked?Math.sin(clock*.68)*.55+Math.sin(clock*.31)*.15:0)+gesture.sway)*intensity,-1.7,1.7);
 state.breath=$('breath').checked?(Math.sin(clock*1.45)*.85+Math.sin(clock*.73)*.15)*intensity:0;
 state.nod=gesture.nod*intensity;state.lookX=clamp(gaze.x*.65+gesture.lookX*intensity,-1.4,1.4);
 state.lookY=clamp(gaze.y*.55+gesture.lookY*intensity,-1,1);
 state.hair=$('hair').checked?(Math.sin(clock*.95)+Math.sin(clock*1.7)*.3)*intensity:0;
 state.blink=Math.max(state.blink,gesture.blink);
 let target=Number($('mouth').value)/100;
 if(analyser&&audio&&!audio.paused){const samples=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(samples);let power=0;for(const n of samples)power+=n*n;level=Math.min(1,Math.max(0,(Math.sqrt(power/samples.length)-.009)*5));target=level;}
 else if(clock<demoEnd){target=Math.max(0,Math.sin(clock*12)*.42+Math.sin(clock*19)*.2+.27);level=target;}
 else {level=0;if(demoEnd){demoEnd=0;$('demo').textContent='说话演示 · 无声';status('演示结束。也可以导入音频测试嘴形。');}}
 const speaking=(audio&&!audio.paused)||clock<demoEnd;
 if(!speaking)target=Math.max(target,gesture.mouth);
 state.mouth+=(target-state.mouth)*(1-Math.exp(-dt*18));
 }
 $('level').style.width=`${level*100}%`;
 if(ready)draw(manualPose||state);requestAnimationFrame(frame);
}
$('blinkOnce').onclick=()=>{resume();blinkStart=clock;nextBlink=clock+3;};
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'继续动作':'暂停动作';if(audio){if(paused)audio.pause();else audio.play().catch(()=>status('音频无法继续，请重新导入。'));}status(paused?'动作已暂停。':'动作已继续。');};
$('intensity').oninput=()=>{$('intensityValue').value=+$('intensity').value<35?'微弱':+$('intensity').value>75?'明显':'轻柔';};
$('mouth').oninput=()=>{stopAudio();demoEnd=0;$('demo').textContent='说话演示 · 无声';resume();$('mouthValue').value=$('mouth').value+'%';};
$('demo').onclick=()=>{stopAudio();resume();if(demoEnd>clock){demoEnd=0;$('demo').textContent='说话演示 · 无声';status('演示已停止。');}else{demoEnd=clock+8;$('demo').textContent='停止说话演示';status('正在演示说话嘴形（无声），约 8 秒。');}};
$('upload').onclick=()=>$('audioFile').click();
$('audioFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;stopAudio();const token=audioRequest;demoEnd=0;$('demo').textContent='说话演示 · 无声';resume();try{
 context??=new AudioContext();await context.resume();if(token!==audioRequest)return;
 audio=new Audio();audioURL=URL.createObjectURL(file);audio.src=audioURL;
 analyser=context.createAnalyser();analyser.fftSize=1024;audioSource=context.createMediaElementSource(audio);audioSource.connect(analyser);analyser.connect(context.destination);
 audio.onended=()=>{stopAudio();status('音频播放完毕。');};await audio.play();if(token!==audioRequest)return;$('stop').disabled=false;status('正在播放：'+file.name);
 }catch{if(token===audioRequest){stopAudio();status('无法播放这个音频，请换用 MP3 或 WAV 文件。');}}finally{e.target.value='';}};
$('stop').onclick=()=>{stopAudio();status('音频已停止。');};
$('bust').onclick=()=>{$('stage').classList.remove('full');$('bust').setAttribute('aria-pressed','true');$('full').setAttribute('aria-pressed','false');};
$('full').onclick=()=>{$('stage').classList.add('full');$('bust').setAttribute('aria-pressed','false');$('full').setAttribute('aria-pressed','true');};
let bg=0;$('background').onclick=()=>{bg=(bg+1)%3;$('stage').classList.toggle('dark',bg===1);$('stage').classList.toggle('checker',bg===2);};
function reset(){
 stopAudio();resume();manualPose=null;demoEnd=0;blinkStart=-10;nextBlink=clock+2.4;nextIdle=clock+7;
 stopSequence();activeMotion=null;pointer={x:0,y:0,until:0};gaze={x:0,y:0};
 for(const key of Object.keys(gesture))gesture[key]=0;
 motionButtons.forEach(b=>b.setAttribute('aria-pressed','false'));
 motionMessage('选一个动作，结束后会自然回到待机。');
 for(const id of ['blink','breath','sway','idle','follow','hair'])$(id).checked=!reduced;
 $('mouth').value=0;$('mouthValue').value='0%';$('intensity').value=55;$('intensity').oninput();$('demo').textContent='说话演示 · 无声';
 for(const key of Object.keys(state))state[key]=0;
 status(reduced?'已遵循系统“减少动态效果”设置；可手动开启动作。':'已恢复默认动作。');
}
$('reset').onclick=reset;
document.addEventListener('visibilitychange',()=>{if(document.hidden&&audio&&!audio.paused){audio.pause();paused=true;$('pause').textContent='继续动作';status('页面已切到后台，音频已暂停。');}});
// Public integration surface: mouth 0..1, blink 0..1; head/breath -1..1.
window.characterPreview={play:playGesture,setPose(pose){if(pose===null){manualPose=null;return;}manualPose={...state};for(const key of Object.keys(state)){if(Number.isFinite(pose[key]))manualPose[key]=clamp(pose[key],key==='blink'||key==='mouth'?0:-1,1);}},getState(){return {ready,paused,time:clock,...(manualPose||state),motion:activeMotion?.name||null,sequence:!!sequenceQueue,audioPlaying:!!audio&&!audio.paused};}};
(async()=>{try{gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:true});if(!gl)throw Error('WebGL unavailable');program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 position;varying vec2 uv;void main(){uv=vec2((position.x+1.)*.5,(1.-position.y)*.5);gl_Position=vec4(position,0.,1.);}'));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);for(const key of Object.keys(state))locations[key]=gl.getUniformLocation(program,key);await texture(ASSETS.original,0,'original');await texture(ASSETS.expression,1,'expression');gl.viewport(0,0,canvas.width,canvas.height);ready=true;$('loading').hidden=true;reset();requestAnimationFrame(frame);}catch(error){$('loading').textContent='无法启动动画。请使用启用硬件加速的 Chrome 或 Edge 浏览器。';status('角色加载失败。');console.error(error);}})();
})();
