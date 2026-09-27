export type ScreenRect={x:number;y:number;width:number;height:number};
export type PlayArea={left:number;right:number;top:number;bottom:number};
export type LayoutDensity='full'|'compact'|'minimal';

export function fitsPlayfield(width:number,height:number,clearHeight:number){
 return clearHeight>=Math.min(width*1.1,height*.42);
}

export class GameLayout{
 private frame=0;
 private probe:HTMLDivElement;
 private fontProbe:HTMLSpanElement;
 private observer:ResizeObserver;
 private last='';
 private density:LayoutDensity='full';
 private elements:HTMLElement[];
 constructor(private root:HTMLElement,private apply:(area:PlayArea,blocked:ScreenRect[])=>void){
  this.probe=document.createElement('div');this.probe.className='safe-area-probe';this.probe.ariaHidden='true';
  this.fontProbe=document.createElement('span');this.fontProbe.textContent='M';this.probe.append(this.fontProbe);root.append(this.probe);
  this.elements=['.top-ui','.bottom','#joystick','#unlock-open','.feedback'].map(s=>root.querySelector<HTMLElement>(s)!);
  this.observer=new ResizeObserver(()=>this.schedule());
  for(const el of [root,this.probe,this.fontProbe,...this.elements])this.observer.observe(el,{box:'border-box'});
  window.addEventListener('resize',this.schedule);
  window.visualViewport?.addEventListener('resize',this.schedule);
  window.visualViewport?.addEventListener('scroll',this.schedule);
  void document.fonts.ready.then(()=>this.schedule());
  this.schedule();
 }
 schedule=()=>{if(!this.frame)this.frame=requestAnimationFrame(()=>{this.frame=0;this.update();});};
 private update(){
  const bounds=this.root.getBoundingClientRect(),{width,height}=bounds,safe=getComputedStyle(this.probe);
  const top=parseFloat(safe.paddingTop),bottom=parseFloat(safe.paddingBottom),left=parseFloat(safe.paddingLeft),right=parseFloat(safe.paddingRight);
  const fontHeight=this.fontProbe.getBoundingClientRect().height;
  const large=parseFloat(getComputedStyle(document.documentElement).fontSize)>24||fontHeight>20;
  document.documentElement.dataset.largeText=String(large);
  const rect=(el:HTMLElement):ScreenRect=>{const r=el.getBoundingClientRect();return {x:r.left-bounds.left,y:r.top-bounds.top,width:r.width,height:r.height};};
  const [upper,lower,joystick,offer,feedback]=this.elements;
  const gap=parseFloat(getComputedStyle(upper).gap)||8;
  let upperRect=rect(upper),lowerRect=rect(lower);
  // Try richer layouts before paint; content size, not a device breakpoint, decides.
  const densities=['full','compact','minimal'] as const;
  for(const density of densities){
   this.root.dataset.compact=String(density!=='full');this.root.dataset.minimal=String(density==='minimal');
   upperRect=rect(upper);lowerRect=rect(lower);
   this.root.dataset.layout=density;
   const expansionRoom=densities.indexOf(density)<densities.indexOf(this.density)?gap*2:0;
   if(density==='minimal'||fitsPlayfield(width-left-right,height-top-bottom,lowerRect.y-upperRect.y-upperRect.height-rect(joystick).height-gap*3-expansionRoom)){this.density=density;break;}
  }
  const area={left:left+gap,right:width-right-gap,top:upperRect.y+upperRect.height+gap,bottom:lowerRect.y-gap};
  this.root.style.setProperty('--play-top',`${area.top}px`);
  this.root.style.setProperty('--controls-bottom',`${height-lowerRect.y+gap}px`);
  const feedbackSpace=area.bottom-area.top-rect(joystick).height-gap*2;
  this.root.style.setProperty('--feedback-max',`${Math.max(48,feedbackSpace)}px`);
  const blocked=[upper,lower,joystick,offer,feedback].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden').map(rect).filter(r=>r.width>0&&r.height>0);
  const key=JSON.stringify([area,blocked,large]);
  if(key!==this.last){this.last=key;this.apply(area,blocked);}
 }
}
