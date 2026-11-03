(()=>{
 const section=document.querySelector('#intro'),stage=section.querySelector('.intro-stage'),video=section.querySelector('video'),header=document.querySelector('.public-header'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let active=false,frame=0,request=0,generation=0,skipped=false,lastY=scrollY,direction='down';
 video.muted=true;video.defaultMuted=true;video.controls=false;video.loop=false;
 const eligible=()=>document.body.dataset.module==='cases'&&!section.hidden&&!document.hidden&&!reduced.matches&&document.body.dataset.motion!=='off';
 function stop(){generation++;request=0;video.pause()}
 async function start(){
  if(!active||skipped||!eligible()||request||!video.paused||video.ended)return;
  const id=++generation;request=id;
  try{await video.play();if(id!==generation||!active||skipped||!eligible())video.pause()}catch{}finally{if(request===id)request=0}
 }
 function paint(){
  frame=0;
  if(document.body.dataset.module!=='cases'||section.hidden){active=false;skipped=true;stop();document.body.classList.remove('in-intro');header.inert=false;lastY=scrollY;return}
  const delta=scrollY-lastY;if(Math.abs(delta)>2)direction=delta<0?'up':'down';lastY=scrollY;
  if(active&&delta< -2){skipped=true;stop()}
  const rect=stage.getBoundingClientRect(),visible=Math.max(0,Math.min(rect.bottom,innerHeight)-Math.max(rect.top,0));
  const next=visible/innerHeight>.6;
  if(next!==active){
   active=next;document.body.classList.toggle('in-intro',active);header.inert=active;
   if(active){skipped=direction==='up';if(!skipped){if(video.readyState>0)video.currentTime=0;start()}else stop()}else stop();
  }
  const progress=Math.min(1,visible/innerHeight);
  section.style.setProperty('--film-scale',reduced.matches?'1':(.965+.035*progress).toFixed(3));
  section.style.setProperty('--film-opacity',reduced.matches?'1':(.6+.4*progress).toFixed(3));
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(paint)}
 window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule,{passive:true});
 document.addEventListener('atlas:module',()=>{stop();active=false;lastY=scrollY;direction='down';paint()});
 document.addEventListener('atlas:motion',()=>{if(!eligible())stop();else start()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else {schedule();start()}});
 reduced.addEventListener('change',()=>{if(reduced.matches)stop();else start();schedule()});
 video.addEventListener('loadeddata',start);
 window.addEventListener('pagehide',stop);window.addEventListener('pageshow',()=>{schedule();start()});
 schedule();
})();
