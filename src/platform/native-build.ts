import {registerPlugin} from '@capacitor/core';

export type AdConfiguration={test:boolean;appId:string;rewarded:Record<'coins'|'tips'|'stock',string>;interstitial?:string};
export const CafeBuild=registerPlugin<{markReady():Promise<void>;getAdConfiguration():Promise<AdConfiguration>}>('CafeBuild');
