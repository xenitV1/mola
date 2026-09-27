import {beforeEach,expect,it,vi} from 'vitest';
import {Simulation,newBranch} from '../src/game/sim';
import {chainScore,MAX_CHAIN_SCORE} from '../src/game/chain-score';
import {CafePlayGames,type GamesBridge} from '../src/platform/play-games';
import {profilePanel} from '../src/ui/profile';
import {setLocale} from '../src/game/i18n';
vi.stubGlobal('document',{documentElement:{lang:'en'}});
beforeEach(()=>setLocale('en'));
const profile={authenticated:true,playerId:'player-a',displayName:'A café'};
const bridge=():GamesBridge=>({getProfile:vi.fn(async()=>profile),signIn:vi.fn(async()=>profile),submitScore:vi.fn(async()=>({submitted:true})),showLeaderboard:vi.fn(async()=>{}),getTopScores:vi.fn(async()=>({entries:[],stale:false}))});

it('counts only real branch slots, earned stars and services; bought currency adds no points',()=>{
 const game=new Simulation();const before=chainScore(game.s);
 expect(before).toEqual({branches:1,stars:0,services:0,ratingPoints:0,total:1_000_000});
 game.s.coins+=300000;game.s.diamonds={balance:10000,grants:[]};expect(chainScore(game.s)).toEqual(before);
 game.s.branches[1]=newBranch();game.s.branches[1].mastery=2;game.s.branches[1].served=20;game.s.branches[1].rating=4;
 expect(chainScore(game.s).total).toBe(2_200_600);
 game.s.branches[99]=newBranch();expect(chainScore(game.s).branches).toBe(2);
});
it('weights qualified ratings and bounds invalid and excessive local inputs without claiming authority',()=>{
 const game=new Simulation();game.b.served=20;game.b.rating=2;game.s.branches[1]=newBranch();game.s.branches[1].served=60;game.s.branches[1].rating=4;
 expect(chainScore(game.s).ratingPoints).toBe(350);
 for(const id of [0,1,2]){game.s.branches[id]=newBranch();Object.assign(game.s.branches[id],{served:1e9,mastery:99,rating:9});}
 expect(chainScore(game.s).total).toBe(MAX_CHAIN_SCORE);
 Object.assign(game.b,{served:NaN,mastery:Infinity,rating:NaN});expect(Number.isFinite(chainScore(game.s).total)).toBe(true);
});
it('never calls native APIs or fabricates a Google identity on web',async()=>{
 const games=new CafePlayGames(null);await games.refresh(true);await games.share(1);await games.showRanking();
 expect(games.state.status).toBe('unavailable');expect(games.state.profile.authenticated).toBe(false);
 expect(profilePanel(games.state,new Simulation().s)).toContain('available in the Android app');
});
it('requires an explicit share and rejects an account change between view and submit',async()=>{
 const native=bridge(),games=new CafePlayGames(native);await games.refresh();expect(native.submitScore).not.toHaveBeenCalled();
 vi.mocked(native.getProfile).mockResolvedValue({...profile,playerId:'player-b'});
 await games.share(1_000_000);expect(games.state.status).toBe('account-changed');expect(native.submitScore).not.toHaveBeenCalled();
});
it('only reports successful native submission and does not retry failed requests automatically',async()=>{
 const native=bridge(),games=new CafePlayGames(native);await games.refresh(true);await games.share(1_000_010);
 expect(native.submitScore).toHaveBeenCalledWith({score:1_000_010,playerId:'player-a'});expect(games.state.status).toBe('submitted');
 vi.mocked(native.submitScore).mockRejectedValue(new Error('offline'));await games.share(1_000_020);
 expect(games.state.status).toBe('error');expect(native.submitScore).toHaveBeenCalledTimes(2);
});
it('blocks duplicate operations and rejects invalid score bounds',async()=>{
 const native=bridge(),games=new CafePlayGames(native);await games.refresh();
 for(const invalid of [NaN,Infinity,-1,1.5,MAX_CHAIN_SCORE+1])await games.share(invalid);
 expect(native.submitScore).not.toHaveBeenCalled();
 let release!:(value:typeof profile)=>void;vi.mocked(native.getProfile).mockReturnValue(new Promise(resolve=>{release=resolve;}));
 const request=games.refresh();await games.refresh(true);expect(native.signIn).not.toHaveBeenCalled();release(profile);await request;
});
it('escapes Google profile names and explains local-save limits in EN and TR',()=>{
 const state={status:'connected' as const,profile:{...profile,displayName:'<img src=x onerror=alert(1)>'},native:true};const game=new Simulation();
 const en=profilePanel(state,game.s);expect(en).not.toContain('<img src=x');expect(en).toContain('&lt;img');expect(en).toContain('does not move your café save to the cloud');expect(en).toContain('Share my score');
 setLocale('tr');const tr=profilePanel(state,game.s);expect(tr).toContain('Puanımı bu profille paylaş');expect(tr).toContain('bu cihazda kalır');
});
it('coalesces resume refreshes and replaces a late old-account profile before settling',async()=>{
 const native=bridge(),games=new CafePlayGames(native);
 let release!:(value:typeof profile)=>void;
 vi.mocked(native.getProfile).mockReturnValueOnce(new Promise(resolve=>{release=resolve;}))
  .mockResolvedValue({...profile,playerId:'player-b',displayName:'New account'});
 const pending=games.refresh();await games.refresh();await games.refresh();release(profile);await pending;
 expect(native.getProfile).toHaveBeenCalledTimes(2);expect(games.state.profile.playerId).toBe('player-b');
 expect(native.signIn).not.toHaveBeenCalled();expect(native.submitScore).not.toHaveBeenCalled();
});
