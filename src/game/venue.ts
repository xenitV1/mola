import type {Role} from './config';
import type {GuestReview} from './guests';
export type MusicMode='off'|'playlist'|'live';
export const freshVenue=()=>({guestSerial:0,musicMode:'off' as MusicMode,volume:1,noiseConcern:0,warningSeconds:0,patrolSeconds:0,fineCooldown:0,fineCount:0,lastFine:0,totalFines:0,reviews:[] as GuestReview[],reviewCount:0});
// A full café dirties tables and floor faster than two cleaners can follow.
export const staffLimit=(role:Role)=>role==='waiter'||role==='cleaner'?3:2;
