export type MetricsFetch=(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>;
type Timer=ReturnType<typeof globalThis.setTimeout>;
export type MetricsOptions={
 baseURL:string;enabled?:boolean;report?:boolean;fetch?:MetricsFetch;storage?:Storage|null;
 setTimeout?:(handler:()=>void,timeout?:number)=>Timer;clearTimeout?:(handle:Timer)=>void;
};
export const METRICS_INSTALLATION_KEY='mola.metrics.installation.v1';
const INTERVAL=30_000,MAX_RETRY=300_000;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const makeUUID=()=>{try{const id=globalThis.crypto?.randomUUID();return id&&UUID.test(id)?id:null;}catch{return null;}};

export class MetricsClient{
 private readonly fetcher:MetricsFetch;
 private readonly setTimer:NonNullable<MetricsOptions['setTimeout']>;
 private readonly clearTimer:NonNullable<MetricsOptions['clearTimeout']>;
 private readonly installationId:string|null;
 private readonly sessionId=makeUUID();
 private started=false;
 private closed=false;
 private foreground=true;
 private active=false;
 private sequence=0;
 private generation=0;
 private timer?:Timer;
 private retry=INTERVAL;
 constructor(private options:MetricsOptions){
  this.fetcher=options.fetch??((input,init)=>globalThis.fetch(input,init));
  this.setTimer=options.setTimeout??((handler,ms)=>globalThis.setTimeout(handler,ms));
  this.clearTimer=options.clearTimeout??(handle=>globalThis.clearTimeout(handle));
  this.installationId=options.report===false||options.enabled===false?null:this.loadInstallation();
 }
 start(){
  if(this.started||this.closed||!this.installationId||!this.sessionId)return;
  this.started=true;
  if(this.foreground)void this.presence(this.active);
 }
 setActive(value:boolean){
  if(this.closed||this.active===value)return;
  this.active=value;this.cancelTimer();this.retry=INTERVAL;
  if(this.started&&this.foreground)void this.presence(value);
 }
 setForeground(value:boolean){
  if(this.closed||this.foreground===value)return;
  this.foreground=value;this.cancelTimer();
  if(this.started)void this.presence(value&&this.active);
 }
 shutdown(){
  if(this.closed)return;
  this.foreground=false;this.cancelTimer();
  if(this.started)void this.presence(false);
  this.closed=true;
 }
 private loadInstallation(){
  try{
   const storage=this.options.storage===undefined?globalThis.localStorage:this.options.storage;
   if(!storage)return null;
   const saved=storage.getItem(METRICS_INSTALLATION_KEY);
   if(saved&&UUID.test(saved))return saved.toLowerCase();
   const fresh=makeUUID();if(!fresh)return null;
   storage.setItem(METRICS_INSTALLATION_KEY,fresh);
   return storage.getItem(METRICS_INSTALLATION_KEY)===fresh?fresh:null;
  }catch{return null;}
 }
 private async request(active:boolean){
  const abort=new AbortController();let timeout:Timer|undefined;
  const body=JSON.stringify({installationId:this.installationId,sessionId:this.sessionId,sequence:this.sequence++,active});
  const deadline=new Promise<never>((_,reject)=>{timeout=this.setTimer(()=>{abort.abort();reject(new Error('timeout'));},8_000);});
  try{
   await Promise.race([(async()=>{
    const r=await this.fetcher(this.options.baseURL.replace(/\/$/,'')+'/v1/presence',{
     method:'POST',headers:{'content-type':'application/json'},body,keepalive:!active,signal:abort.signal
    });
    if(!r.ok)throw new Error('unavailable');
    const result:unknown=await r.json();
    if(!result||typeof result!=='object'||(result as {ok?:unknown}).ok!==true)throw new Error('invalid acknowledgement');
   })(),deadline]);
  }finally{if(timeout!==undefined)this.clearTimer(timeout);}
 }
 private async presence(active:boolean){
  if(!this.started||this.closed)return;
  const generation=++this.generation;
  let delay=INTERVAL,failed=false;
  try{await this.request(active);if(this.closed||generation!==this.generation)return;this.retry=INTERVAL;}
  catch{if(this.closed||generation!==this.generation)return;failed=true;delay=this.retry;this.retry=Math.min(MAX_RETRY,delay*2);}
  this.cancelTimer();
  if(this.foreground&&!this.closed&&(this.active||failed))this.timer=this.setTimer(()=>{this.timer=undefined;void this.presence(this.active);},delay);
 }
 private cancelTimer(){if(this.timer!==undefined)this.clearTimer(this.timer);this.timer=undefined;}
}
