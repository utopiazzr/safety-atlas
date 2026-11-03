// Motion follows intent: scrolling, choosing a poster, and changing a filter.
// No input interception, scroll locks, animation dependency or extra user controls.
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
export const motionAllowed=()=>!reduced.matches&&document.body.dataset.motion!=='off'&&!document.hidden;
let transition=null,revision=0,named=[];
export function navigatePoster(source,update,destination){
 const ticket=++revision;
 transition?.skipTransition();
 named.forEach(node=>node.style.viewTransitionName='');named=[];
 const rect=source?.getBoundingClientRect();
 if(!motionAllowed()||!document.startViewTransition||!rect||!rect.width||!rect.height||rect.bottom<0||rect.top>innerHeight){update();return}
 source.style.viewTransitionName='case-art';
 named.push(source);
 let target;
 const current=document.startViewTransition(()=>{
  source.style.viewTransitionName='';
  if(ticket!==revision)return;
  update();target=destination();
  if(target){target.style.viewTransitionName='case-art';named.push(target)}
 });
 transition=current;
 current.finished.catch(()=>{}).finally(()=>{
  if(transition!==current)return;
  named.forEach(node=>node.style.viewTransitionName='');named=[];transition=null;
 });
}
const entrances=new WeakSet(),pending=new Set();
const reveal=new IntersectionObserver(entries=>{
 for(const entry of entries){
  if(!entry.isIntersecting)continue;
  reveal.unobserve(entry.target);pending.delete(entry.target);
  if(!motionAllowed())continue;
  entry.target.animate([{opacity:.35,transform:'translateY(25px)'},{opacity:1,transform:'translateY(0)'}],{duration:560,easing:'cubic-bezier(.22,1,.36,1)'});
 }
},{threshold:.08});
export function refreshPosters(previous=new Map()){
 for(const node of pending)if(!node.isConnected){reveal.unobserve(node);pending.delete(node)}
 const cards=[...document.querySelectorAll('.case-card')];
 for(const [index,card] of cards.entries()){
  const old=previous.get(card.dataset.id),rect=card.getBoundingClientRect();
  if(old&&old.bottom>0&&old.top<innerHeight&&motionAllowed()&&rect.bottom>0&&rect.top<innerHeight){
   const dx=old.left-rect.left,dy=old.top-rect.top;
   if(Math.abs(dx)+Math.abs(dy)>1)card.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:380,easing:'cubic-bezier(.22,1,.36,1)'});
  }else if(!entrances.has(card)){
   entrances.add(card);pending.add(card);reveal.observe(card);
  }else if(previous.size&&motionAllowed()&&rect.bottom>0&&rect.top<innerHeight){
   card.animate([{opacity:.2,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,delay:(index%2)*30,easing:'ease-out'});
  }
 }
 updateIndicator();
}
function updateIndicator(){
 const group=document.querySelector('.kind-filter'),selected=group?.querySelector('[aria-pressed=true]');
 if(!selected)return;
 const a=group.getBoundingClientRect(),b=selected.getBoundingClientRect();
 group.style.setProperty('--selected-x',`${b.left-a.left}px`);
 group.style.setProperty('--selected-y',`${b.bottom-a.top-1}px`);
 group.style.setProperty('--selected-width',`${b.width}px`);
}
const grid=document.querySelector('#case-grid');
let pointerFrame=0,point=null,pointed=null;
grid.addEventListener('pointermove',event=>{
 if(event.pointerType!=='mouse'||!motionAllowed())return;
 const card=event.target.closest('.case-card');if(!card)return;
 point={x:event.clientX,y:event.clientY,card};
 if(pointerFrame)return;
 pointerFrame=requestAnimationFrame(()=>{
  pointerFrame=0;if(!point)return;
  if(pointed&&pointed!==point.card)resetPoint(pointed);
  pointed=point.card;const r=pointed.getBoundingClientRect();
  pointed.style.setProperty('--art-x',`${((point.x-r.left)/r.width-.5)*12}px`);
  pointed.style.setProperty('--art-y',`${((point.y-r.top)/r.height-.5)*10}px`);
 });
},{passive:true});
function resetPoint(card){card.style.removeProperty('--art-x');card.style.removeProperty('--art-y')}
grid.addEventListener('pointerleave',()=>{point=null;if(pointed)resetPoint(pointed);pointed=null});
function stopMotion(){
 if(motionAllowed())return;
 transition?.skipTransition();
 document.querySelectorAll('.case-card,.editorial-copy').forEach(node=>node.getAnimations().forEach(a=>a.cancel()));
 if(pointed)resetPoint(pointed);
}
document.addEventListener('atlas:motion',stopMotion);reduced.addEventListener('change',stopMotion);
document.addEventListener('visibilitychange',stopMotion);
window.addEventListener('resize',updateIndicator,{passive:true});
document.addEventListener('atlas:module',()=>{
 updateIndicator();
 if(motionAllowed()&&document.body.dataset.module==='record')document.querySelector('.editorial-copy')?.animate([{opacity:.5,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:380,easing:'ease-out'});
});
