import {describe,expect,it} from 'vitest';
import {choosePersona,evaluateReview,PERSONAS,REASONS,type Persona,type ReviewInput} from '../src/game/guests';

const good:ReviewInput={id:4,persona:'commuter',time:120,waitFraction:.1,freshness:1,quality:0,dirty:0,crowding:.25,noise:.1,music:0,comfort:0};
const review=(changes:Partial<ReviewInput>={})=>evaluateReview({...good,...changes});

describe('observable guest reviews',()=>{
  it('makes basic good service four stars, and investment can earn five',()=>{
    expect(review().score).toBe(4);
    expect(review({quality:3,comfort:1}).score).toBe(5);
    expect(review()).toEqual(review());
    expect(review()).toMatchObject({id:4,time:120,persona:'commuter'});
  });
  it.each([
    ['commuter','waitFraction',.85,'slow'],
    ['connoisseur','freshness',.2,'stale'],
    ['tidy','dirty',.8,'dirty'],
    ['quiet','crowding',.9,'crowded'],
    ['quiet','noise',.9,'noise'],
  ] as const)('%s reacts to the experienced %s', (persona,field,value,reason)=>{
    const poor=review({persona,[field]:value});
    expect(poor.score).toBeLessThan(review({persona}).score);
    expect(poor.reasons[0]).toBe(reason);
  });
  it('distinguishes guests under the same imperfect conditions',()=>{
    expect(review({persona:'commuter',waitFraction:.8}).score).toBeLessThan(review({persona:'social',waitFraction:.8}).score);
    expect(review({persona:'tidy',dirty:.7}).score).toBeLessThan(review({persona:'social',dirty:.7}).score);
    expect(review({persona:'connoisseur',freshness:.3}).score).toBeLessThan(review({persona:'social',freshness:.3}).score);
    expect(review({persona:'quiet',noise:.8}).score).toBeLessThan(review({persona:'social',noise:.8}).score);
  });
  it('gives social guests a reason to prefer moderate music, never maximum volume',()=>{
    const quiet=review({persona:'social'});
    const pleasant=review({persona:'social',music:.45});
    const loud=review({persona:'social',music:1});
    expect(pleasant.score).toBeGreaterThan(quiet.score);
    expect(pleasant.reasons).toContain('music');
    expect(loud.score).toBeLessThan(pleasant.score);
    expect(loud.reasons).toContain('noise');
    expect(loud.reasons).not.toContain('music');
  });
  it.each([{freshness:.1},{dirty:1},{waitFraction:1},{noise:1},{crowding:1}])('never lets luxury erase a severe fault %o',fault=>{
    for(const persona of Object.keys(PERSONAS) as Persona[]){
      expect(review({...fault,persona,quality:3,comfort:1,music:.45}).score).toBeLessThanOrEqual(3);
    }
  });
  it.each(['seat','service','stock'] as const)('reports failed %s without praising unserved food', failed=>{
    const r=review({failed,quality:3,comfort:1});
    expect(r.score).toBeLessThanOrEqual(2);expect(r.reasons[0]).toBe(failed);
    expect(r.reasons).not.toContain('quality');expect(r.reasons).not.toContain('fresh');
  });
  it('keeps feedback bounded, valid, deterministic and caused by the visit',()=>{
    for(const persona of Object.keys(PERSONAS) as Persona[])for(let i=0;i<=20;i++){
      const t=i/20;const r=review({persona,waitFraction:t,freshness:1-t,dirty:t,crowding:t,noise:t,music:t,quality:3,comfort:1});
      expect(Number.isInteger(r.score)).toBe(true);expect(r.score).toBeGreaterThanOrEqual(1);expect(r.score).toBeLessThanOrEqual(5);
      expect(r.reasons.length).toBeLessThanOrEqual(3);expect(r.reasons.every(reason=>reason in REASONS)).toBe(true);
    }
    const bad=review({dirty:1,noise:1,freshness:0});expect(bad.reasons).toHaveLength(3);
    expect(bad.reasons).toEqual(expect.arrayContaining(['stale','dirty','noise']));
  });
  it('does not reduce scores when an individual operational problem is improved',()=>{
    for(const persona of Object.keys(PERSONAS) as Persona[])for(const field of ['dirty','crowding','noise','waitFraction'] as const){
      let previous=5;
      for(let i=0;i<=20;i++){
        const score=review({persona,[field]:i/20}).score;
        expect(score).toBeLessThanOrEqual(previous);previous=score;
      }
    }
  });
});

it('chooses all five personas deterministically, with distinct neighbourhood mixes',()=>{
  const counts=(branch:number)=>{
    const result:Record<string,number>={};
    for(let i=0;i<1000;i++){const p=choosePersona((i+.5)/1000,branch);result[p]=(result[p]??0)+1;}
    return result;
  };
  expect(counts(0)).toEqual({commuter:200,connoisseur:200,quiet:200,social:200,tidy:200});
  expect(counts(1).commuter).toBeGreaterThan(counts(0).commuter);
  expect(counts(2).social).toBeGreaterThan(counts(0).social);
  expect(choosePersona(1,0)).toBe('tidy');expect(choosePersona(-1,0)).toBe('commuter');
  expect(choosePersona(NaN,Infinity)).toBe('commuter');
});
