import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayback,createPlaybackDriver} from '../src/atlas/playback.mjs';

function player(){
 const playback=createPlayback(),callbacks=new Map();let id=0,active=true;
 const driver=createPlaybackDriver({playback,render(){},isActive:()=>active,
  requestFrame:fn=>{callbacks.set(++id,fn);return id},cancelFrame:id=>callbacks.delete(id)});
 return {playback,driver,callbacks,setActive(v){active=v},tick(time){const pending=[...callbacks.values()];callbacks.clear();pending.forEach(fn=>fn(time))}};
}
test('explicit playback needs no visibility observer and advances all four scenes',()=>{
 const p=player();p.driver.play();p.tick(0);
 for(let i=1;i<=3;i++){p.tick(i*3200);assert.equal(p.playback.state().phase,i);assert.equal(p.playback.state().playing,true)}
 p.tick(12800);assert.equal(p.playback.state().ended,true);assert.equal(p.callbacks.size,0);
});
test('rapid play calls never install duplicate animation loops',()=>{
 const p=player();p.driver.play();p.driver.play();p.driver.play();assert.equal(p.callbacks.size,1);p.tick(0);p.tick(500);assert.equal(p.playback.state().elapsed,500);
});
test('pause and resume preserve progress without including time away',()=>{
 const p=player();p.driver.play();p.tick(0);p.tick(1400);p.driver.pause();assert.equal(p.callbacks.size,0);
 p.driver.play();p.tick(60000);assert.equal(p.playback.state().elapsed,1400);p.tick(61800);assert.equal(p.playback.state().elapsed,3200);
});
test('stale callbacks after pause cannot restart an animation',()=>{
 const p=player();p.driver.play();const stale=[...p.callbacks.values()][0];p.driver.pause();p.driver.play();stale(1000);assert.equal(p.callbacks.size,1);assert.equal(p.playback.state().elapsed,0);
});
test('changing route or hiding document suspends playback, returning does not jump',()=>{
 const p=player();p.driver.play();p.tick(0);p.tick(2400);p.setActive(false);p.tick(4800);
 assert.equal(p.playback.state().elapsed,2400);assert.equal(p.playback.state().playing,false);assert.equal(p.callbacks.size,0);
 p.setActive(true);p.driver.play();p.tick(12000);p.tick(12800);assert.equal(p.playback.state().elapsed,3200);
});
test('scrubbing while playing freezes the exact frame, then resumes there',()=>{
 const p=player();p.driver.play();p.tick(0);p.tick(600);p.driver.seekTime(8000);
 assert.equal(p.callbacks.size,0);assert.equal(p.playback.state().phase,2);assert.equal(p.playback.state().progress,.5);
 p.driver.play();p.tick(10000);p.tick(11600);assert.equal(p.playback.state().elapsed,9600);
});
test('a completed pass stops and replay always starts at zero',()=>{
 const p=player();p.driver.play();p.tick(0);p.tick(20000);assert.equal(p.playback.state().elapsed,12800);assert.equal(p.playback.state().playing,false);
 p.driver.play();assert.equal(p.playback.state().elapsed,0);p.tick(30000);p.tick(31000);assert.equal(p.playback.state().elapsed,1000);
});
test('seeking clamps boundaries and selecting a scene resets its own progress',()=>{
 const p=player();p.driver.seekTime(-100);assert.equal(p.playback.state().elapsed,0);p.driver.seekTime(20000);assert.equal(p.playback.state().elapsed,12800);p.driver.seekTime(NaN);assert.equal(p.playback.state().elapsed,12800);p.driver.seek(2);assert.equal(p.playback.state().elapsed,6400);assert.equal(p.playback.state().progress,0);
});
