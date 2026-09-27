import {afterEach,expect,it,vi} from 'vitest';
import {CafeAudio} from '../src/platform/audio';
class Param {value=0;cancelScheduledValues(){} setValueAtTime(n:number){this.value=n;}setTargetAtTime(n:number){this.value=n;}linearRampToValueAtTime(n:number){this.value=n;}exponentialRampToValueAtTime(n:number){this.value=n;}}
class Node {gain=new Param();frequency=new Param();connect(){}disconnect(){}start(){}stop(){}type='';loop=false;buffer:unknown;onended?:()=>void;}
class Context {static count=0;static sources=0;currentTime=0;sampleRate=8000;state='running';destination=new Node();constructor(){Context.count++;}createGain(){return new Node();}createMediaElementSource(){return new Node();}createBuffer(_n:number,length:number){return {getChannelData:()=>new Float32Array(length)};}createBufferSource(){Context.sources++;return new Node();}createBiquadFilter(){return new Node();}createOscillator(){return new Node();}async resume(){this.state='running';}async suspend(){this.state='suspended';}}
class Track {static count=0;paused=true;loop=false;preload='';currentTime=0;readyState=4;constructor(public src:string){Track.count++;}async play(){this.paused=false;}pause(){this.paused=true;}}
const environment={outside:false,crowd:.5,musicMode:'playlist' as const,volume:.5};
afterEach(()=>vi.unstubAllGlobals());
it('defers all sound until interaction and reuses persistent ambient/music sources',()=>{
 Context.count=Context.sources=Track.count=0;vi.stubGlobal('AudioContext',Context);vi.stubGlobal('Audio',Track);const audio=new CafeAudio();
 for(let i=0;i<20;i++)audio.ambience(environment);expect(Context.count).toBe(0);expect(Track.count).toBe(0);
 audio.unlock();for(let i=0;i<1000;i++)audio.ambience(environment);expect(Context.count).toBe(1);expect(Track.count).toBe(1);expect(Context.sources).toBe(2);expect(audio.status.playing).toBe(true);
});
it('fades louder street audio outdoors, respects separate mute settings, mode off and overlapping interruptions',()=>{
 vi.stubGlobal('AudioContext',Context);vi.stubGlobal('Audio',Track);const audio=new CafeAudio();audio.ambience(environment);audio.unlock();const indoor=audio.status.streetGain;
 audio.ambience({...environment,outside:true,musicMode:'live'});expect(audio.status.streetGain).toBeGreaterThan(indoor);expect(audio.status.playing).toBe(true);expect(audio.status.track).toBe('live');expect(audio.status.liveGain).toBeGreaterThan(0);
 audio.configure(false,false);expect(audio.status.context).toBe('suspended');audio.configure(true,true);audio.pause('ad');audio.pause('app');audio.resume('ad');expect(audio.status.blocked).toBe(true);expect(audio.status.context).toBe('suspended');audio.resume('app');expect(audio.status.context).toBe('running');
 audio.ambience({...environment,musicMode:'off'});expect(audio.status.playing).toBe(false);expect(audio.status.liveGain).toBe(0);expect(audio.status.streetGain).toBeGreaterThan(0);
 audio.configure(false,true);expect(audio.status.streetGain).toBe(0);
});

it('switches the single streamed source, keeps playlist mix unchanged and attenuates live music outside',()=>{
 Track.count=0;vi.stubGlobal('AudioContext',Context);vi.stubGlobal('Audio',Track);
 const audio=new CafeAudio();audio.ambience(environment);audio.unlock();
 expect(audio.status.gain).toBe(.18*environment.volume);
 audio.ambience({...environment,musicMode:'live'});const indoor=audio.status.gain;
 expect(indoor).toBeGreaterThan(.18*environment.volume);expect(audio.status.playing).toBe(true);
 audio.ambience({...environment,musicMode:'live',outside:true});expect(audio.status.gain).toBeCloseTo(indoor*.55);
 for(let i=0;i<100;i++)audio.ambience({...environment,musicMode:i%2?'live':'playlist'});
 expect(Track.count).toBe(1);expect(audio.status.track).toBe('live');
 audio.configure(true,false);expect(audio.status.playing).toBe(false);expect(audio.status.liveGain).toBe(0);
 audio.configure(false,true);expect(audio.status.playing).toBe(true);expect(audio.status.streetGain).toBe(0);
 audio.ambience({...environment,musicMode:'live',volume:0});expect(audio.status.playing).toBe(false);
});
it.each(['ad','app','mute','off','zero'] as const)('does not let delayed live play escape %s',async interruption=>{
 const settle:Array<()=>void>=[];
 class PendingTrack extends Track {play(){return new Promise<void>(resolve=>settle.push(()=>{this.paused=false;resolve();}));}}
 vi.stubGlobal('AudioContext',Context);vi.stubGlobal('Audio',PendingTrack);
 const audio=new CafeAudio();audio.ambience({...environment,musicMode:'live'});audio.unlock();
 if(interruption==='ad'||interruption==='app')audio.pause(interruption);
 else if(interruption==='mute')audio.configure(true,false);
 else audio.ambience({...environment,musicMode:interruption==='off'?'off':'live',volume:interruption==='zero'?0:.5});
 settle.forEach(resolve=>resolve());await Promise.resolve();await Promise.resolve();
 expect(audio.status.playing).toBe(false);
});
it('an old play completion does not pause the new valid mode',async()=>{
 const settle:Array<()=>void>=[];
 class PendingTrack extends Track {play(){return new Promise<void>(resolve=>settle.push(()=>{this.paused=false;resolve();}));}}
 vi.stubGlobal('AudioContext',Context);vi.stubGlobal('Audio',PendingTrack);
 const audio=new CafeAudio();audio.ambience(environment);audio.unlock();
 audio.ambience({...environment,musicMode:'live'});settle[1]();await Promise.resolve();settle[0]();await Promise.resolve();
 expect(audio.status.track).toBe('live');expect(audio.status.playing).toBe(true);
});
it('a delayed context resume cannot bypass an ad pause',async()=>{
 const settle:Array<()=>void>=[];
 class PendingContext extends Context {resume(){return new Promise<void>(resolve=>settle.push(()=>{this.state='running';resolve();}));}}
 vi.stubGlobal('AudioContext',PendingContext);vi.stubGlobal('Audio',Track);
 const audio=new CafeAudio();audio.ambience({...environment,musicMode:'live'});audio.unlock();audio.pause('ad');
 settle.forEach(resolve=>resolve());await Promise.resolve();await Promise.resolve();
 expect(audio.status.context).toBe('suspended');expect(audio.status.playing).toBe(false);
});
