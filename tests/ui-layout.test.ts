import {expect,it} from 'vitest';
import {fitsPlayfield} from '../src/ui/layout';
it('rejects a layout that leaves controls on top of the playing area',()=>{
 expect(fitsPlayfield(320,480,-28)).toBe(false);
 expect(fitsPlayfield(320,480,215)).toBe(true);
 expect(fitsPlayfield(320,480,185)).toBe(false);
});
it('adapts to content growth at the same viewport without a device breakpoint',()=>{
 expect(fitsPlayfield(393,873,380)).toBe(true);
 expect(fitsPlayfield(393,873,210)).toBe(false);
});
it('uses the same proportional playfield budget from phone to tablet',()=>{
 for(const scale of [1,1.5,2,3]){
  expect(fitsPlayfield(320*scale,480*scale,215*scale)).toBe(true);
  expect(fitsPlayfield(320*scale,480*scale,100*scale)).toBe(false);
 }
});
