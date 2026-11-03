// One clock for the picture, route, labels and draggable timeline.
export function createPlayback({steps=4,duration=3200}={}){
 let elapsed=0,playing=false;
 const total=steps*duration;
 function state(){const ended=elapsed>=total;return {elapsed,playing,ended,phase:Math.min(steps-1,Math.floor(elapsed/duration)),progress:ended?1:(elapsed%duration)/duration}}
 return {state,play(){if(elapsed>=total)elapsed=0;playing=true},pause(){playing=false},seek(step){if(!Number.isFinite(step))return;elapsed=Math.min(steps-1,Math.max(0,Math.floor(step)))*duration;playing=false},seekTime(time){if(!Number.isFinite(time))return;elapsed=Math.min(total,Math.max(0,time));playing=false},advance(delta){if(playing&&Number.isFinite(delta)&&delta>0){elapsed=Math.min(total,elapsed+delta);if(elapsed>=total)playing=false}return state()}};
}

// Own the frame lifecycle separately from presentation. Explicit playback must
// not depend on a delayed IntersectionObserver callback or decorative motion.
export function createPlaybackDriver({playback,render,requestFrame,cancelFrame,isActive}){
 let frame=null,last=null,generation=0;
 function pause(){generation++;if(frame!==null)cancelFrame(frame);frame=null;last=null;playback.pause();render()}
 function play(){
  if(playback.state().playing)return;
  if(!isActive())return;
  playback.play();last=null;const token=++generation;render();
  function tick(now){
   if(token!==generation)return;
   frame=null;
   if(!isActive()){pause();return}
   if(last!==null)playback.advance(Math.max(0,now-last));
   last=now;render();
   if(playback.state().playing)frame=requestFrame(tick);else last=null;
  }
  frame=requestFrame(tick);
 }
 return {play,pause,seekTime(time){pause();playback.seekTime(time);render()},seek(step){pause();playback.seek(step);render()}};
}
