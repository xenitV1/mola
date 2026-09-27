/**
 * Tycoon feedback: capacity/production/cleaning/atmosphere -> visible reviews ->
 * demand. Persona weights create competing investments instead of one best buy.
 * Values are initial tuning hypotheses: a sound basic visit earns four stars;
 * training/comfort can earn five, but cannot hide a severe operating fault.
 * The caller supplies the conditions this guest actually experienced, not the
 * cafe's conditions after they leave. No rating randomness or purchased stars.
 */
export type Persona = 'commuter' | 'connoisseur' | 'quiet' | 'social' | 'tidy';

export const PERSONAS: Record<Persona, { name: string; description: string; hint: string }> = {
  commuter: {name:'Acelesi olan', description:'Kısa bir molası var; siparişini hızlı bekler.', hint:'Hızlı üretim ve servis'},
  connoisseur: {name:'Lezzet tutkunu', description:'Taze ürün ve iyi hazırlanmış tarif ister.', hint:'Tazelik ve ürün kalitesi'},
  quiet: {name:'Sakinlik arayan', description:'Rahatça oturmak ve sessiz bir ortam ister.', hint:'Ferah alan ve düşük gürültü'},
  social: {name:'Sosyalleşen', description:'Müzikli, canlı bir kafeyi sever; aşırı ses yine rahatsız eder.', hint:'Dengeli müzik ve rahat ortam'},
  tidy: {name:'Titiz', description:'Temiz masa ve bakımlı bir mekân bekler.', hint:'Temiz masalar ve düzenli bakım'},
};

export const REASONS = {
  fast:'Hızlı servis', slow:'Servis yavaştı', fresh:'Ürün tazeydi', stale:'Ürün tazeliğini kaybetmişti',
  quality:'Lezzetli ürün', dirty:'Mekân kirliydi', clean:'Mekân temizdi', crowded:'Mekân çok sıkışıktı',
  quiet:'Ortam sakindi', noise:'Çok gürültülüydü', music:'Müzik keyifliydi', comfortable:'Mekân rahattı',
  seat:'Oturacak yer bulamadım', service:'Siparişim gelmedi', stock:'İstediğim ürün kalmamıştı',
} as const;
export type ReviewReason = keyof typeof REASONS;
export type GuestReview = { id: number; persona: Persona; score: number; reasons: ReviewReason[]; time: number };
export type ReviewInput = {
  id:number; persona:Persona; time:number; waitFraction:number; freshness:number; quality:number;
  dirty:number; crowding:number; noise:number; music:number; comfort:number;
  failed?: 'seat' | 'service' | 'stock';
};

const clamp = (n:number,max=1) => Number.isFinite(n) ? Math.max(0,Math.min(max,n)) : 0;
const weights: Record<Persona,{wait:number;fresh:number;dirty:number;crowd:number;noise:number}> = {
  commuter: {wait:2.5,fresh:1.55,dirty:1.25,crowd:.8,noise:1.15},
  connoisseur: {wait:1.4,fresh:2.65,dirty:1.25,crowd:.8,noise:1.15},
  quiet: {wait:1.4,fresh:1.55,dirty:1.25,crowd:1.8,noise:2.5},
  social: {wait:1.4,fresh:1.55,dirty:1.25,crowd:.65,noise:1.2},
  tidy: {wait:1.4,fresh:1.55,dirty:2.6,crowd:.8,noise:1.15},
};

export function evaluateReview(input:ReviewInput):GuestReview {
  const w=weights[input.persona];
  const wait=clamp(input.waitFraction), fresh=clamp(input.freshness), dirty=clamp(input.dirty);
  const crowd=clamp(input.crowding), music=clamp(input.music), comfort=clamp(input.comfort,2.5);
  const quality=clamp(input.quality,3);
  // Volume itself stays audible to guests even when insulation protects neighbours.
  const noise=Math.max(clamp(input.noise),music*.95);
  const faults: {reason:ReviewReason; penalty:number}[] = [
    {reason:'slow',penalty:Math.max(0,wait-.2)/.8*w.wait},
    {reason:'stale',penalty:(1-fresh)*w.fresh},
    {reason:'dirty',penalty:dirty*w.dirty},
    {reason:'crowded',penalty:Math.max(0,crowd-.45)/.55*w.crowd},
    {reason:'noise',penalty:Math.max(0,noise-.35)/.65*w.noise},
  ];
  const pleasantMusic=Math.max(0,1-Math.abs(music-.45)/.45);
  const musicBonus=input.persona==='social' ? .65*pleasantMusic : .08*pleasantMusic;
  let raw=4.2+quality*(input.persona==='connoisseur'?.24:.16)+comfort*.3+musicBonus;
  raw-=faults.reduce((sum,f)=>sum+f.penalty,0);
  let score=Math.round(raw);
  if(wait>.9||fresh<.25||dirty>.8||noise>.9||crowd>.95)score=Math.min(score,3);
  if(input.failed)score=Math.min(score,input.failed==='service'?1:2);
  score=Math.max(1,Math.min(5,score));
  const reasons:ReviewReason[]=input.failed?[input.failed]:[];
  for(const fault of faults.sort((a,b)=>b.penalty-a.penalty)){
    if(fault.penalty>=.35 && reasons.length<3)reasons.push(fault.reason);
  }
  // Failure reviews never praise a product the guest did not receive.
  if(!input.failed){
    const positives: {reason:ReviewReason; value:number}[] = [
      {reason:'fast',value:wait<.15?(input.persona==='commuter'?2:1):0},
      {reason:'fresh',value:fresh>.9?(input.persona==='connoisseur'?1.8:.8):0},
      {reason:'quality',value:quality>=2?(input.persona==='connoisseur'?2:1.2):0},
      {reason:'clean',value:dirty<.1?(input.persona==='tidy'?2:.7):0},
      {reason:'quiet',value:noise<.2?(input.persona==='quiet'?2:.5):0},
      {reason:'music',value:pleasantMusic>.5&&noise<.65?(input.persona==='social'?2:.6):0},
      {reason:'comfortable',value:comfort>.5&&crowd<.65?1.4:0},
    ];
    for(const positive of positives.sort((a,b)=>b.value-a.value)){
      if(positive.value>0&&reasons.length<3)reasons.push(positive.reason);
    }
  }
  return {id:input.id,persona:input.persona,score,reasons,time:input.time};
}

// Neighbourhood mix: local regulars, office rush, then a social garden district.
// The caller owns the seeded RNG. Clamping keeps persisted edge values safe.
export function choosePersona(seedRoll:number,branchIndex:number):Persona {
  const personas:Persona[]=['commuter','connoisseur','quiet','social','tidy'];
  const mixes=[[.2,.2,.2,.2,.2],[.4,.22,.12,.14,.12],[.12,.22,.18,.34,.14]];
  const mix=mixes[Math.max(0,Math.min(2,Math.floor(Number.isFinite(branchIndex)?branchIndex:0)))];
  const roll=clamp(seedRoll);let total=0;
  for(let i=0;i<personas.length;i++){total+=mix[i];if(roll<total)return personas[i];}
  return 'tidy';
}
