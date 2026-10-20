(() => {
'use strict';
const $=id=>document.getElementById(id),canvas=$('character');
const ASSETS={original:'assets/original.png',expression:'assets/expression.png'};
const motionNames={tilt:'歪头听你说',doubleBlink:'双眨眼',happy:'开心回应'};
const motionButtons=[...document.querySelectorAll('[data-motion]')];
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let paused=false,clock=0,last=performance.now(),blinkStart=-10,nextBlink=2.4,demoEnd=0;
let activeMotion=null,sequenceQueue=null,sequenceNext=0,nextIdle=7;
let pointer={x:0,y:0,until:0},gaze={x:0,y:0};
const gesture={blink:0,mouth:0,sway:0,lookX:0,lookY:0};
let audio=null,audioURL=null,context=null,analyser=null,audioSource=null,audioRequest=0,level=0;
let renderer,ready=false,manualPose=null;
const followers={bust:{x:0,v:0},cloth:{x:0,v:0},hair:{x:0,v:0}};
const state=CharacterRig.zero();
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function status(text){$('status').textContent=text;}
function draw(pose){renderer.draw(pose,$('meshDebug').checked);}
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
   else{stopSequence();motionMessage('三个动作已演示完毕。');}
 }
 if($('idle').checked&&!activeMotion&&!sequenceQueue&&clock>=nextIdle){
   const choices=['doubleBlink','happy'];playGesture(choices[Math.floor(Math.random()*choices.length)]);
 }
 const desired=activeMotion?CharacterMotion.sample(activeMotion.name,clock-activeMotion.start):CharacterMotion.sample('',0);
 for(const key of Object.keys(gesture))gesture[key]+=(desired[key]-gesture[key])*(1-Math.exp(-dt*(key==='blink'?38:15)));
 const tracking=$('follow').checked&&pointer.until>clock;
 gaze.x+=((tracking?pointer.x:0)-gaze.x)*(1-Math.exp(-dt*4));
 gaze.y+=((tracking?pointer.y:0)-gaze.y)*(1-Math.exp(-dt*4));
 state.sway=clamp(gesture.sway*intensity,-1.7,1.7);
 state.breath=$('breath').checked?(Math.sin(clock*1.45)*.85+Math.sin(clock*.73)*.15)*intensity:0;
 state.lookX=clamp(gaze.x*.65+gesture.lookX*intensity,-1.4,1.4);
 state.lookY=clamp(gaze.y*.55+gesture.lookY*intensity,-1,1);
 const wind=$('hair').checked?(Math.sin(clock*.95)+Math.sin(clock*1.7)*.3)*intensity:0;
 state.hair=CharacterRig.spring(followers.hair,wind,dt);
 state.bust=CharacterRig.spring(followers.bust,$('bustMotion').checked?state.breath:0,dt);
 state.cloth=CharacterRig.spring(followers.cloth,$('clothMotion').checked?(state.breath*.65+state.hair*.35):0,dt);
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
 for(const id of ['blink','breath','idle','hair','bustMotion','clothMotion'])$(id).checked=!reduced;
 $('follow').checked=false;
 $('meshDebug').checked=false;
 for(const spring of Object.values(followers)){spring.x=0;spring.v=0;}
 $('mouth').value=0;$('mouthValue').value='0%';$('intensity').value=55;$('intensity').oninput();$('demo').textContent='说话演示 · 无声';
 for(const key of Object.keys(state))state[key]=0;
 status(reduced?'已遵循系统“减少动态效果”设置；可手动开启动作。':'已恢复默认动作。');
}
$('reset').onclick=reset;
document.addEventListener('visibilitychange',()=>{if(document.hidden&&audio&&!audio.paused){audio.pause();paused=true;$('pause').textContent='继续动作';status('页面已切到后台，音频已暂停。');}});
// Public integration surface: mouth 0..1, blink 0..1; head/breath -1..1.
window.characterPreview={play:playGesture,setPose(pose){if(pose===null){manualPose=null;return;}manualPose={...state};for(const key of Object.keys(state)){if(Number.isFinite(pose[key]))manualPose[key]=clamp(pose[key],key==='blink'||key==='mouth'?0:-1,1);}},getState(){return {ready,paused,time:clock,parts:renderer?.partCount||0,vertices:renderer?.vertexCount||0,...(manualPose||state),motion:activeMotion?.name||null,sequence:!!sequenceQueue,audioPlaying:!!audio&&!audio.paused};}};
(async()=>{try{
 renderer=await CharacterMeshRenderer.create(canvas,window.CHARACTER_ASSETS,ASSETS);
 ready=true;$('loading').hidden=true;$('rigInfo').textContent=`${renderer.partCount} 个独立部件 · 已启用分层网格`;
 reset();requestAnimationFrame(frame);
}catch(error){$('loading').textContent='无法加载分层角色。请刷新页面，并使用启用硬件加速的 Chrome 或 Edge。';status('角色加载失败。');console.error(error);}})();
})();
