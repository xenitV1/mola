/** One streamed music loop and short original cues. No audio before interaction. */
export class CafeAudio {
 private ctx?:AudioContext;
 private track?:HTMLAudioElement;
 private musicGain?:GainNode;
 private streetGain?:GainNode;private crowdGain?:GainNode;
 private trackMode:'playlist'|'live'='playlist';
 private environment={outside:false,crowd:0,musicMode:'off' as 'off'|'playlist'|'live',volume:0};
 private lastAmbient=-1;private lastBird=-10;
 private unlocked=false;
 private interruptions=new Set<string>();
 private get blocked(){return this.interruptions.size>0;}
 private effects=true;
 private music=true;
 private lastCue=-1;
 get enabled(){return this.effects;}
 set enabled(value:boolean){this.effects=value;this.sync();}
 configure(sound:boolean,music:boolean){this.effects=sound;this.music=music;this.sync();}
 unlock(){
  if(!this.ctx){
   try{
    this.ctx=new AudioContext();
    this.track=new Audio('/audio/cafe-bossa.ogg');
    this.track.loop=true;this.track.preload='none';
    this.musicGain=this.ctx.createGain();this.musicGain.gain.value=0;
    this.ctx.createMediaElementSource(this.track).connect(this.musicGain);
    this.musicGain.connect(this.ctx.destination);
    this.createAmbience();
   }catch{return;}
  }
  this.unlocked=true;this.sync();
 }
 private sync(){
  if(!this.unlocked||!this.ctx||!this.track||!this.musicGain)return;
  if(this.blocked||(!this.effects&&!this.music)){
   this.track.pause();void this.ctx.suspend().catch(()=>{});return;
  }
  void this.ctx.resume().then(()=>{
   if(this.blocked||(!this.effects&&!this.music)){this.track?.pause();void this.ctx?.suspend().catch(()=>{});}
  }).catch(()=>{});
  const e=this.environment,mode=e.musicMode;
  if(mode!=='off'&&this.trackMode!==mode){
   this.track.pause();this.trackMode=mode;
   this.track.src=mode==='live'?'/audio/cafe-live.ogg':'/audio/cafe-bossa.ogg';
  }
  this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
  this.musicGain.gain.setTargetAtTime(this.music&&mode!=='off'?e.volume*(mode==='live'?.4*(e.outside?.55:1):.18):0,this.ctx.currentTime,.3);
  if(this.music&&mode!=='off'&&e.volume>0){
   // A pending play may settle after an ad, mute or mode change.
   void this.track.play().then(()=>{if(this.blocked||!this.music||this.environment.musicMode==='off'||this.environment.volume<=0)this.track?.pause();}).catch(()=>{});
  }else this.track.pause();
  this.applyAmbientGains();
 }

 /** One persistent filtered noise source per layer; frame calls never add loops. */
 private createAmbience(){
  if(!this.ctx)return;const ctx=this.ctx;
  const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);let seed=1729;
  for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=(seed/4294967296)*2-1;}
  const layer=(frequency:number)=>{const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=buffer;source.loop=true;filter.type='lowpass';filter.frequency.value=frequency;gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);source.start();return gain;};
  this.streetGain=layer(480);this.crowdGain=layer(900);
 }
 private applyAmbientGains(){
  if(!this.ctx)return;const now=this.ctx.currentTime,e=this.environment;
  const audible=this.effects&&!this.blocked;
  this.streetGain?.gain.setTargetAtTime(audible?(e.outside?.034:.006)*( .75+.25*Math.sin(now*.35)):0,now,.65);
  this.crowdGain?.gain.setTargetAtTime(audible?e.crowd*(e.outside?.005:.018):0,now,.65);
 }
 ambience(next:{outside:boolean;crowd:number;musicMode:'off'|'playlist'|'live';volume:number}){
  const changed=this.environment.outside!==next.outside||this.environment.musicMode!==next.musicMode||Math.abs(this.environment.volume-next.volume)>.005;
  this.environment={outside:next.outside,crowd:Math.max(0,Math.min(1,next.crowd)),musicMode:next.musicMode,volume:Math.max(0,Math.min(1,next.volume))};
  if(changed)this.sync();
  if(!this.unlocked||this.blocked||!this.ctx||this.ctx.state!=='running')return;
  const now=this.ctx.currentTime;if(now-this.lastAmbient<.15)return;this.lastAmbient=now;this.applyAmbientGains();
  if(this.effects&&now-this.lastBird>4.3){this.lastBird=now;const gain=next.outside?.018:.003;this.ambientNote(2200,now,.14,gain,undefined,2850);this.ambientNote(2600,now+.2,.12,gain,undefined,1950);}
 }
 private ambientNote(hz:number,time:number,duration:number,amplitude:number,destination?:GainNode,endHz?:number){
  if(!this.ctx)return;const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(hz,time);if(endHz)osc.frequency.exponentialRampToValueAtTime(endHz,time+duration);
  gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(amplitude,time+.015);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);osc.connect(gain);gain.connect(destination??this.ctx.destination);osc.start(time);osc.stop(time+duration+.02);osc.onended=()=>{osc.disconnect();gain.disconnect();};
 }
 celebrate(stars:number){
  if(!this.effects||this.blocked||!this.ctx||this.ctx.state!=='running')return;
  const now=this.ctx.currentTime,final=stars===3;
  const notes=final?[392,523.25,659.25,784,1046.5,1318.5]:stars===2?[523.25,659.25,784,1046.5]:[523.25,659.25,1046.5];
  notes.forEach((hz,i)=>this.ambientNote(hz,now+i*.12,final?.55:.38,.05));
  if(final)[261.63,329.63,392].forEach(hz=>this.ambientNote(hz,now+.6,.85,.018));
  // The simulation also emits an upgrade event. Keep its generic cue from
  // overlapping the milestone melody on the following frame.
  this.lastCue=now+1.2;
 }
 tone(type:'coin'|'brew'|'serve'|'upgrade'|'tap'){
  if(!this.effects||this.blocked||!this.ctx||this.ctx.state!=='running')return;
  if(this.ctx.currentTime-this.lastCue<.055)return;
  this.lastCue=this.ctx.currentTime;
  const notes=type==='upgrade'?[523,659,784,1046]:type==='coin'?[880,1175]:type==='serve'?[659,784]:type==='brew'?[440,554]:[350];
  notes.forEach((hz,i)=>{
   const time=this.ctx!.currentTime+i*.065,osc=this.ctx!.createOscillator(),gain=this.ctx!.createGain();
   osc.type='sine';osc.frequency.setValueAtTime(hz,time);gain.gain.setValueAtTime(0,time);
   gain.gain.linearRampToValueAtTime(type==='tap'?.025:.065,time+.012);
   gain.gain.exponentialRampToValueAtTime(.001,time+.23);
   osc.connect(gain);gain.connect(this.ctx!.destination);osc.start(time);osc.stop(time+.25);
   osc.onended=()=>{osc.disconnect();gain.disconnect();};
  });
 }
 pause(reason='app'){this.interruptions.add(reason);this.sync();}
 resume(reason='app'){this.interruptions.delete(reason);this.sync();}
 /** Exposed only through the development/QA bridge, never a production hook. */
 get status(){return {context:this.ctx?.state??'locked',sound:this.effects,music:this.music,blocked:this.blocked,playing:this.track?!this.track.paused:false,time:this.track?.currentTime??0,ready:this.track?.readyState??0,gain:this.musicGain?.gain.value??0,ambience:{...this.environment},streetGain:this.streetGain?.gain.value??0,liveGain:this.environment.musicMode==='live'&&!this.blocked&&this.music?(this.musicGain?.gain.value??0):0,track:this.trackMode};}
}
