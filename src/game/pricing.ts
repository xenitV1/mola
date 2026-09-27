import {MENU,type Menu} from './config';

export type PriceMode='cheap'|'normal'|'high';
export const PRICING:Record<PriceMode,{name:string;price:number;demand:number}>={
 cheap:{name:'Ucuz',price:.8,demand:1.2},
 normal:{name:'Normal',price:1,demand:1},
 high:{name:'Pahalı',price:1.3,demand:.75},
};
export const freshPrices=():Record<Menu,PriceMode>=>Object.fromEntries(Object.keys(MENU).map(kind=>[kind,'normal'])) as Record<Menu,PriceMode>;
