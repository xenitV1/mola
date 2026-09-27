// Keep entry investments reachable; advanced equipment and furniture are longer-term goals.
export function developmentGold(previous:number,advanced=false){
 return Math.ceil(previous*(advanced?2.5:1.5)/5)*5;
}
