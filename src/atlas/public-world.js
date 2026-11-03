(()=>{
 const body=document.body,button=document.querySelector('#world-motion'),cover=document.querySelector('.cover-sequence'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let motion=!reduced.matches,frame=0,px=0,py=0,tx=0,ty=0;
 function paint(){
  frame=0;const browsing=body.dataset.module==='cases';
  const p=browsing?Math.min(1,Math.max(0,scrollY/(innerHeight*.85))):1;
  const moving=browsing&&motion&&!reduced.matches;
  px+=(tx-px)*.13;py+=(ty-py)*.13;
  const fade=Math.max(0,Math.min(1,(p-.12)/.88));
  body.style.setProperty('--cover-opacity',(1-fade*fade*(3-2*fade)).toFixed(3));
  body.style.setProperty('--cover-scale',moving?(1+p*.08).toFixed(3):'1');
  body.style.setProperty('--copy-opacity',Math.max(0,1-p*2.1).toFixed(3));
  body.style.setProperty('--copy-shift',moving?(-p*40).toFixed(1)+'px':'0px');
  body.style.setProperty('--header-fill',Math.min(.95,p*.95).toFixed(3));
  body.classList.toggle('in-archive',p>.45);
  body.dataset.ambient=moving&&p>.7?'on':'off';
  body.style.setProperty('--cosmos-x',moving?(px*10).toFixed(2)+'px':'0px');
  body.style.setProperty('--cosmos-y',moving?(py*7).toFixed(2)+'px':'0px');
  body.style.setProperty('--scroll-depth',moving?Math.min(scrollY*.014,26).toFixed(2)+'px':'0px');
  const archive=document.querySelector('#atlas-content');
  const start=archive.offsetTop-innerHeight*.3;
  const progress=browsing?Math.max(0,Math.min(1,(scrollY-start)/Math.max(1,document.documentElement.scrollHeight-innerHeight-start))):0;
  body.style.setProperty('--world-scale',moving?(1+progress*.028).toFixed(4):'1');
  body.style.setProperty('--reading-progress',progress.toFixed(4));
  cover.querySelector('.cover-stage').inert=!browsing||p>.6;
  if(moving&&(Math.abs(tx-px)>.001||Math.abs(ty-py)>.001))schedule();
 }
 function schedule(){if(!frame&&!document.hidden)frame=requestAnimationFrame(paint)}
 function setMotion(){body.dataset.motion=motion?'on':'off';button.textContent=motion?'Ⅱ':'▶';button.setAttribute('aria-pressed',String(motion));button.setAttribute('aria-label',motion?'暂停动态':'开启动效');button.title=motion?'暂停动态':'开启动效';document.dispatchEvent(new Event('atlas:motion'));schedule()}
 button.addEventListener('click',()=>{motion=!motion;setMotion()});
 reduced.addEventListener('change',()=>{if(reduced.matches){motion=false;setMotion()}});
 window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule,{passive:true});
 window.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||!motion||reduced.matches||body.dataset.module!=='cases')return;tx=e.clientX/innerWidth-.5;ty=e.clientY/innerHeight-.5;schedule()},{passive:true});
 document.addEventListener('pointerleave',()=>{tx=ty=0;schedule()});
 document.addEventListener('visibilitychange',()=>{body.classList.toggle('page-hidden',document.hidden);schedule()});
 document.addEventListener('atlas:module',()=>{px=py=tx=ty=0;paint()});
 setMotion();schedule();
})();
