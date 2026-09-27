import {Capacitor} from '@capacitor/core';
import {CafeBuild} from './native-build';

export function markLaunchReady(){
 if(Capacitor.isNativePlatform())void CafeBuild.markReady().catch(()=>{/* Native fallback has a bounded timeout. */});
}
