import './public-world.js';
import './intro-film.js';
import {createPlayback,createPlaybackDriver} from './playback.mjs';
import {navigatePoster,refreshPosters} from './motion-interface.mjs';
import {catalogue as entries} from './catalogue.mjs';
import {contexts,categories,searchRecords,inspectMaterial,makeDraft,webUrl} from './product-core.mjs';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const modules=['cases','record','theatre','submit'];
history.scrollRestoration='manual';
let activeModule='cases',archiveY=0,lastCard=null,relatedId=null;
const params=new URLSearchParams(location.search);
let kind=Object.hasOwn(categories,params.get('kind'))?params.get('kind'):'all';
let context=Object.hasOwn(contexts,params.get('context'))?params.get('context'):'all';
$('#case-search').value=params.get('q')||'';
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
function button(text,fn,cls=''){const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b}
function link(text,url,cls=''){const a=el('a',cls,text);a.href=webUrl(url)?url:'#';a.target='_blank';a.rel='noopener noreferrer';return a}
function download(name,body,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([body],{type}));const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function searchState(){return {query:$('#case-search').value,context,kind}}
function saveSearch(){const u=new URL(location.href);for(const [key,value] of Object.entries({q:$('#case-search').value.trim(),context:context==='all'?'':context,kind:kind==='all'?'':kind})){if(value)u.searchParams.set(key,value);else u.searchParams.delete(key)}history.replaceState(null,'',u)}
function renderCases(){
 const oldCards=new Map($$('.case-card').map(c=>[c.dataset.id,c]));
 const previous=new Map([...oldCards].map(([id,c])=>[id,c.getBoundingClientRect()]));
 const shown=searchRecords(entries,searchState());
 $('#case-grid').replaceChildren(...shown.map(e=>{if(oldCards.has(e.id))return oldCards.get(e.id);const c=button('',()=>{archiveY=scrollY;lastCard=e.id;openDetail(e)},'case-card');c.dataset.id=e.id;c.setAttribute('aria-label',`查看 ${e.title}，${e.theme}，${e.evidence}`);
 const img=el('img');img.src=e.image;img.alt=`${e.theme}主题概念插画`;img.loading='lazy';
 const copy=el('span','card-copy');copy.append(el('span','theme-label',e.theme),el('span','card-title',e.title));const bottom=el('span','card-bottom');bottom.append(el('span','',`${e.evidence} · ${e.date}`),el('span','arrow','↗'));copy.append(bottom);
 c.append(img,el('span','evidence',categories[e.category]),el('span','card-seq',String(entries.indexOf(e)+1).padStart(2,'0')),copy);return c}));
 $('#no-cases').hidden=shown.length>0;$('#result-count').textContent=`${shown.length} 项${context==='all'?'':' · '+contexts[context]}`;
 $$('[data-kind]').forEach(b=>{const count=searchRecords(entries,{...searchState(),kind:b.dataset.kind}).length;b.replaceChildren(document.createTextNode(categories[b.dataset.kind]+' '),el('span','',count));b.setAttribute('aria-pressed',String(b.dataset.kind===kind))});
 $$('[data-context]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.context===context)));
 document.body.dataset.orbit=kind;refreshPosters(previous);
}
function selectModule(id,{scroll=true,updateUrl=true}={}){
 if(!modules.includes(id))id='cases';
 if(activeModule==='theatre'&&id!=='theatre')pause();
 activeModule=id;
 $$('.module').forEach(s=>s.hidden=s.id!==id);
 $$('[data-module]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.module===(id==='submit'?'submit':'cases'))));
 document.body.dataset.module=id;document.body.dataset.world=id;
 $('.cover-sequence').hidden=id!=='cases';$('#intro').hidden=id!=='cases';
 $('#world-motion').hidden=id!=='cases';
 if(updateUrl)history.replaceState(null,'','#'+id);
 document.dispatchEvent(new Event('atlas:module'));
 if(scroll){$('#atlas-content').scrollIntoView({behavior:'instant',block:'start'});$('#atlas-content').focus({preventScroll:true})}
}
function backToCases(){navigatePoster($('.editorial-poster>img'),()=>{history.pushState(null,'','#cases');selectModule('cases',{scroll:false,updateUrl:false});scrollTo({top:archiveY||$('#atlas-content').offsetTop-96,behavior:'instant'});if(lastCard)$(`[data-id="${lastCard}"]`)?.focus({preventScroll:true})},()=>$(`[data-id="${lastCard}"] img`))}
const editorial={
 'echoleak':['信息，越过了边界。','阅读厂商通告'],
 'spaiware':['一次输入。\n不止一次影响。','观看过程'],
 'whatsapp-mcp':['工具可信，\n消息也安全吗？','阅读原始研究'],
 'gcg':['看似乱码，\n也可能改变回答。','阅读论文'],
 'pair':['用对话，\n寻找模型的边界。','查看研究项目'],
 'ecosystem-garak':['让薄弱之处，\n有迹可循。','查看项目'],
 'ecosystem-nemo':['为应用，\n划定运行边界。','查看项目'],
 'prompt-guard-2':['先识别输入，\n再决定信任。','查看模型'],
 'mcp-scan':['工具接入前，\n先看清风险。','查看使用文档']
};
function disclosure(title,cls=''){const d=el('details','record-fold '+cls);d.append(el('summary','',title));return d}
function openDetail(e,options={}){
 const source=activeModule==='cases'?$(`[data-id="${e.id}"] img`):$('.editorial-poster>img');
 navigatePoster(source,()=>renderDetail(e,options),()=>$('.editorial-poster>img'));
}
function renderDetail(e,{push=true,scroll=true}={}){
 if(push)history.pushState(null,'','#case/'+e.id);
 const target=$('#record');target.replaceChildren();
 const toolbar=el('div','record-toolbar');toolbar.append(button('← 探索',backToCases,'back-link'));
 const share=button('分享 ↗',async()=>{try{await navigator.clipboard.writeText(location.href);share.textContent='已复制链接'}catch{share.textContent='请复制地址栏链接'}});toolbar.append(share);target.append(toolbar);
 const spread=el('article','editorial-spread');
 const poster=el('div','editorial-poster'),art=el('img');art.src=e.image;art.alt=`${e.theme}主题概念插画`;
 const posterTitle=el('div','poster-title');posterTitle.append(el('span','poster-theme',e.theme),el('strong','',e.title));
 const folio=el('span','poster-folio',String(entries.indexOf(e)+1).padStart(2,'0'));folio.setAttribute('aria-hidden','true');
 poster.append(art,folio,posterTitle);
 const copy=el('div','editorial-copy'),meta=el('p','editorial-meta',`${e.evidence} / ${e.date}`);
 const [headline,action]=editorial[e.id]||[e.title,'查看原始来源'];
 copy.append(meta,el('h1','',headline),el('p','editorial-summary',e.summary));
 const cta=el('div','editorial-cta');
 const primarySource=['echoleak','prompt-guard-2'].includes(e.id)?e.resources[0]:e.id==='pair'?e.sources.find(s=>s.label==='官方代码')||e.sources[0]:e.sources[0];
 if(e.id==='spaiware')cta.append(button(action+' →',()=>selectModule('theatre'),'primary'));
 else cta.append(link(action+' ↗',primarySource.url,'primary'));
 copy.append(cta,el('p','editorial-scope',e.relevance));
 spread.append(poster,copy);target.append(spread);
 const folds=el('div','record-folds');
 if(e.storyboard?.steps?.length&&e.id!=='spaiware'){
  const story=disclosure('事件经过');const steps=el('ol','printed-steps');e.storyboard.steps.forEach(step=>{const li=el('li');li.append(el('h2','',step.title),el('p','',step.body));steps.append(li)});story.append(steps);folds.append(story);
 }
 const sources=disclosure('原始资料','source-fold');
 const links=el('div','source-list');const unique=new Map();
 for(const source of [...e.sources,...e.resources])if(!unique.has(source.url))unique.set(source.url,source);
 for(const [url,source] of unique)links.append(link(source.label+' ↗',url));
 sources.append(links);
 // Keep specific historical facts that change interpretation, not generic disclaimers.
 const sourceNote={
  spaiware:'研究者在 2024-09 报告：ChatGPT macOS 1.2024.247 缓解了外传通道。',
  gcg:'原仓库的训练实现支持 LLaMA / Pythia 系模型。',
  'prompt-guard-2':'22M / 86M 两种规格；输入窗口为 512 token。'
 }[e.id];
 if(sourceNote)sources.append(el('p','source-status',sourceNote));
 sources.append(button('补充资料 →',()=>startContribution(e),'text-action'));folds.append(sources);target.append(folds);
 const related=el('div','related-reading');related.append(el('p','','相关探索'));
 e.related.slice(0,2).forEach(id=>{const r=entries.find(x=>x.id===id);if(!r)return;const b=button('',()=>openDetail(r),'related-record');b.append(el('small','',r.theme),el('span','',r.title+' ↗'));related.append(b)});target.append(related);
 selectModule('record',{scroll,updateUrl:false});
}

function route(){
 const hash=location.hash;if(['#home','#intro'].includes(hash)){selectModule('cases',{scroll:false,updateUrl:false});requestAnimationFrame(()=>$(hash).scrollIntoView({behavior:'smooth',block:'start'}));return;}
 if(hash.startsWith('#case/')){const e=entries.find(x=>x.id===hash.slice(6));if(e){openDetail(e,{push:false});return}}
 selectModule(['cases','theatre','submit'].includes(hash.slice(1))?hash.slice(1):'cases',{scroll:true,updateUrl:false});
}
$$('[data-module]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.module==='cases'&&activeModule==='record'){backToCases();return}selectModule(b.dataset.module)}));
window.addEventListener('hashchange',route);
$$('[data-kind]').forEach(b=>b.addEventListener('click',()=>{kind=b.dataset.kind;saveSearch();renderCases()}));
$('#context-filter').replaceChildren(...Object.entries(contexts).map(([id,label])=>{const b=button(label,()=>{context=id;saveSearch();renderCases()});b.dataset.context=id;return b}));
$('#case-search').addEventListener('input',()=>{saveSearch();renderCases()});
$('#reset-search').addEventListener('click',()=>{kind='all';context='all';$('#case-search').value='';saveSearch();renderCases();$('#case-search').focus()});

const phases=[['接触输入','外部内容进入视野','用户读取不可信网页，网页指令进入助手上下文。'],['写入记忆','一次输入，被留到了以后','恶意要求被写入长期记忆。'],['再次调用','下一次会话，旧指令仍在','保存的记忆继续影响后续对话。'],['历史外发通道','信息离开原有边界','原研究展示了外发链路；研究者报告相关通道已被缓解。']];
const totalDuration=phases.length*3200,playback=createPlayback({steps:phases.length,duration:3200});
const stage=$('.theatre-stage'),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const scrub=$('#film-scrub'),clock=$('#film-time');
const routePaths=Object.fromEntries(['in','store','loop','out'].map(name=>[name,$('.'+name+'-packet')]));
const stepButtons=$$('.hotspot[data-step]');
function timeLabel(ms){return '00:'+String(Math.floor(ms/1000)).padStart(2,'0')}
let renderedPhase=-1;
function updatePhase(){
 const state=playback.state();const [k,t,b]=phases[state.phase];
 stage.dataset.step=state.phase;stage.dataset.playback=state.ended?'ended':state.playing?'playing':'paused';
 stage.style.setProperty('--step-progress',state.progress.toFixed(4));
 // One normalized path and one clock: changing a step always starts at its own source.
 const route=['in','store','loop','out'][state.phase];
 $$('.packet-path').forEach(p=>{p.style.opacity=p.classList.contains(route+'-packet')?'1':'0';p.style.strokeDashoffset=String(-state.progress*100)});
 const path=routePaths[route];
 const position=path.getPointAtLength(state.progress*path.getTotalLength());
 $('.signal-position').setAttribute('transform',`translate(${position.x} ${position.y})`);
 $('.signal-ring').setAttribute('r',String(12+Math.sin(state.progress*Math.PI)*10));
 scrub.value=state.elapsed;scrub.style.setProperty('--film-progress',(state.elapsed/totalDuration*100).toFixed(2)+'%');
 scrub.setAttribute('aria-valuetext',`${k}，${timeLabel(state.elapsed)}`);
 clock.textContent=timeLabel(state.ended?Math.ceil(totalDuration/1000)*1000:state.elapsed)+' / '+timeLabel(Math.ceil(totalDuration/1000)*1000);
 if(renderedPhase!==state.phase){renderedPhase=state.phase;$('#phase-number').textContent=String(state.phase+1).padStart(2,'0')+' / 04';$('#phase-kicker').textContent=k;$('#phase-title').textContent=t;$('#phase-body').textContent=b;stepButtons.forEach(x=>{const yes=Number(x.dataset.step)===state.phase;x.classList.toggle('active',yes);x.setAttribute('aria-pressed',String(yes))})}
 $('#play').textContent=state.playing?'Ⅱ 暂停':state.ended?'↺ 重播':'▶ '+(state.elapsed?'继续':'播放');
 $('#play').setAttribute('aria-pressed',String(state.playing));
}
const driver=createPlaybackDriver({playback,render:updatePhase,requestFrame:cb=>requestAnimationFrame(cb),cancelFrame:id=>cancelAnimationFrame(id),isActive:()=>!document.hidden&&activeModule==='theatre'});
function pause(){driver.pause()}
$('#play').addEventListener('click',()=>{if(playback.state().playing)pause();else driver.play()});
scrub.addEventListener('input',()=>driver.seekTime(Number(scrub.value)));
stepButtons.forEach(b=>b.addEventListener('click',()=>driver.seek(Number(b.dataset.step))));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
window.addEventListener('pagehide',pause);
// Reduced motion disables ambient animation, not an explicitly requested demo.
reducedMotion.addEventListener('change',pause);

let composerPromise=null;
let contributionRequest={kind:'suspicion',seq:0,relatedId:'',intent:'new'};
function loadComposer(){
 if(!composerPromise)composerPromise=import('./submission-entry.tsx').then(m=>{m.mountSubmission(document.querySelector('#cloud-submission'),contributionRequest);return m}).catch(()=>{composerPromise=null;const host=document.querySelector('#cloud-submission');host.replaceChildren(el('p','','投稿服务暂时未能加载。'),button('重新连接',loadComposer));return null});
 return composerPromise;
}
function startContribution(e){contributionRequest={kind:e.kind||'suspicion',seq:contributionRequest.seq+1,relatedId:e.id,intent:'evidence'};selectModule('submit');loadComposer().then(m=>m?.updateSubmission(contributionRequest));}
document.addEventListener('atlas:module',()=>{if(activeModule==='submit')loadComposer()});
renderCases();updatePhase();
if(['#signals','#archive'].includes(location.hash))history.replaceState(null,'','#cases');
if(location.hash==='#contribute')history.replaceState(null,'','#submit');
if(location.hash.startsWith('#case/'))route();else{const initial=location.hash.slice(1);selectModule(['cases','theatre','submit'].includes(initial)?initial:'cases',{scroll:false,updateUrl:false});if(modules.includes(initial))requestAnimationFrame(()=>document.querySelector('#atlas-content').scrollIntoView({behavior:'instant',block:'start'}))}
