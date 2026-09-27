import {beforeEach,expect,it,vi} from 'vitest';
import {CafePlayGames,type GamesBridge,type RankingEntry} from '../src/platform/play-games';
import {rankingPanel} from '../src/ui/ranking';
import {setLocale} from '../src/game/i18n';
vi.stubGlobal('document',{documentElement:{lang:'en'}});
beforeEach(()=>setLocale('en'));
const profile={authenticated:true,playerId:'player-a',displayName:'Owner'};
const row=(rank:number):RankingEntry=>({rank,displayName:`Owner ${rank}`,score:1000000-rank,isCurrentPlayer:rank===2});
const bridge=():GamesBridge=>({getProfile:vi.fn(async()=>profile),signIn:vi.fn(async()=>profile),submitScore:vi.fn(async()=>({submitted:true})),showLeaderboard:vi.fn(async()=>{}),getTopScores:vi.fn(async()=>({entries:[row(1),row(2)],stale:false}))});
it('loads at most 50 validated public results without native UI or score submission',async()=>{
 const native=bridge(),games=new CafePlayGames(native);await games.refresh();
 vi.mocked(native.getTopScores).mockResolvedValue({entries:[{...row(1),score:NaN},{...row(1),rank:-1},...Array.from({length:65},(_,i)=>row(65-i))],stale:true});
 await games.showRanking();
 expect(games.state.ranking?.entries).toHaveLength(50);
 expect(games.state.ranking?.entries[0].rank).toBe(1);expect(games.state.ranking?.entries[49].rank).toBe(50);
 expect(games.state.ranking?.stale).toBe(true);
 expect(native.showLeaderboard).not.toHaveBeenCalled();expect(native.submitScore).not.toHaveBeenCalled();
});
it('shows an empty real leaderboard without inventing players and escapes public names',async()=>{
 const native=bridge(),games=new CafePlayGames(native);await games.refresh();
 vi.mocked(native.getTopScores).mockResolvedValue({entries:[],stale:false});await games.showRanking();
 expect(rankingPanel(games.state)).toContain('No public scores yet');expect(rankingPanel(games.state)).not.toContain('<li');
 vi.mocked(native.getTopScores).mockResolvedValue({entries:[{...row(2),displayName:'<img src=x onerror=bad()>'}],stale:false});await games.showRanking();
 const en=rankingPanel(games.state);expect(en).toContain('&lt;img');expect(en).not.toContain('<img');expect(en).toContain('>You<');
 setLocale('tr');expect(rankingPanel(games.state)).toContain('>Sen<');expect(rankingPanel(games.state)).toContain('Tüm zamanlar');
});
it('keeps profile connected after a ranking failure and permits a deliberate retry',async()=>{
 const native=bridge(),games=new CafePlayGames(native);await games.refresh();
 vi.mocked(native.getTopScores).mockRejectedValueOnce(new Error('offline'));await games.showRanking();
 expect(games.state.profile.authenticated).toBe(true);expect(games.state.ranking?.status).toBe('error');expect(rankingPanel(games.state)).toContain('could not be loaded');
 await games.showRanking();expect(games.state.ranking?.status).toBe('ready');expect(native.getTopScores).toHaveBeenCalledTimes(2);
});
it('discards returned rows when the Google account changes during loading',async()=>{
 const native=bridge(),games=new CafePlayGames(native);await games.refresh();
 vi.mocked(native.getProfile).mockResolvedValue({...profile,playerId:'player-b'});await games.showRanking();
 expect(games.state.status).toBe('account-changed');expect(games.state.ranking).toBeUndefined();
 expect(rankingPanel(games.state)).not.toContain('<li');
});
it('clears previous account results on refresh and never loads when signed out',async()=>{
 const native=bridge(),games=new CafePlayGames(native);await games.showRanking();expect(native.getTopScores).not.toHaveBeenCalled();
 await games.refresh();await games.showRanking();expect(games.state.ranking?.entries).toHaveLength(2);
 vi.mocked(native.getProfile).mockResolvedValue({...profile,playerId:'player-b'});await games.refresh();expect(games.state.ranking).toBeUndefined();
 expect(rankingPanel(games.state)).toContain('Refresh to load');expect(rankingPanel(games.state)).not.toContain('No public scores yet');
});
it('clears identity when the native bridge reports a changed or signed-out account',async()=>{
 for(const code of ['ACCOUNT_CHANGED','AUTH_REQUIRED']){
  const native=bridge(),games=new CafePlayGames(native);await games.refresh();
  vi.mocked(native.getTopScores).mockRejectedValue({code});await games.showRanking();
  expect(games.state.profile.authenticated).toBe(false);expect(games.state.ranking).toBeUndefined();
  expect(games.state.status).toBe(code==='ACCOUNT_CHANGED'?'account-changed':'signed-out');
 }
});
it('coalesces rapid ranking taps while exposing a real loading state',async()=>{
 const native=bridge(),games=new CafePlayGames(native);await games.refresh();
 let finish!:(result:{entries:RankingEntry[];stale:boolean})=>void;
 vi.mocked(native.getTopScores).mockReturnValue(new Promise(resolve=>finish=resolve));
 const request=games.showRanking();await games.showRanking();
 expect(games.state.ranking?.status).toBe('loading');expect(rankingPanel(games.state)).toContain('aria-busy="true"');
 expect(native.getTopScores).toHaveBeenCalledTimes(1);finish({entries:[row(1)],stale:false});await request;
 expect(games.state.ranking?.status).toBe('ready');
});
