export type NaturalAdBreak='branch'|'special'|'mastery'|'upgrade';
export const FIRST_INTERSTITIAL_SECONDS=60;
export const BETWEEN_ADS_SECONDS=180;

/** Session-only active play clock. Background/offline time is never supplied.
 * Eligibility is a flag, not a timer callback that can interrupt service. */
export class InterstitialTiming {
 private elapsed=0;
 private threshold=FIRST_INTERSTITIAL_SECONDS;
 advance(seconds:number){if(Number.isFinite(seconds)&&seconds>0)this.elapsed=Math.min(this.threshold,this.elapsed+seconds);}
 get due(){return this.elapsed>=this.threshold;}
 didShow(){this.elapsed=0;this.threshold=BETWEEN_ADS_SECONDS;}
 eligible(point:NaturalAdBreak,ready:boolean){return ready&&this.due&&['branch','special','mastery','upgrade'].includes(point);}
}
