import {describe, expect, it} from 'vitest';
import {ToastTiming} from '../src/ui/toasts';

describe('toast timing policy', () => {
  it('shares a cooldown across lost and waste notices', () => {
    const timing = new ToastTiming();
    expect(timing.request('Kayip', 'lost', 0).show).toBe(true);
    expect(timing.request('Israf', 'waste', 3_200).show).toBe(false);
    expect(timing.request('Kayip', 'lost', 11_999).show).toBe(false);
    expect(timing.request('Israf', 'waste', 12_000).show).toBe(true);
  });

  it('does not renew an active message timer on duplicates', () => {
    const timing = new ToastTiming();
    expect(timing.request('Kayıt yapılamadı', 'save-error', 100).show).toBe(true);
    expect(timing.request('Kayıt yapılamadı', 'save-error', 3_000).show).toBe(false);
    expect(timing.current(3_000)?.remainingMs).toBe(3_200 - 2_900);
    expect(timing.current(3_300)).toBeUndefined();
  });

  it('lets an important result replace a routine notice', () => {
    const timing = new ToastTiming();
    expect(timing.request('İsraf', 'waste', 0).show).toBe(true);
    expect(timing.request('Satın alma tamamlandı', 'purchase', 100).show).toBe(true);
    expect(timing.current(100)?.message).toBe('Satın alma tamamlandı');
    expect(timing.request('Yeni kayıp', 'lost', 200).show).toBe(false);
  });

  it('keeps important messages ahead of routine traffic', () => {
    const timing = new ToastTiming();
    expect(timing.request('Ödül hazır', 'reward', 0).show).toBe(true);
    expect(timing.request('İsraf', 'waste', 3_100).show).toBe(false);
    expect(timing.current(3_199)?.message).toBe('Ödül hazır');
  });

  it('replaces a different important message without extending the original timer', () => {
    const timing = new ToastTiming();
    expect(timing.request('Satın alma bekleniyor', 'purchase', 0).show).toBe(true);
    expect(timing.request('Kayıt yapılamadı', 'save-error', 1_000).show).toBe(true);
    expect(timing.current(1_000)?.remainingMs).toBe(3_200);
    expect(timing.request('Kayıt yapılamadı', 'save-error', 2_000).show).toBe(false);
    expect(timing.current(4_199)?.message).toBe('Kayıt yapılamadı');
  });

  it('clears the active notice while retaining the routine cooldown', () => {
    const timing = new ToastTiming();
    expect(timing.request('İsraf', 'waste', 0).show).toBe(true);
    timing.clear();
    expect(timing.current(100)).toBeUndefined();
    expect(timing.request('Kayıp', 'lost', 11_999).show).toBe(false);
    expect(timing.request('Kayıp', 'lost', 12_000).show).toBe(true);
  });

  it('accepts a new important message after the prior one expires', () => {
    const timing = new ToastTiming();
    expect(timing.request('Finans', 'finance', 0).show).toBe(true);
    expect(timing.request('Finans', 'finance', 3_199).show).toBe(false);
    expect(timing.request('Kayıt geri yüklendi', 'info', 3_200).show).toBe(true);
  });

  it('ignores invalid clock values without changing policy state', () => {
    const timing = new ToastTiming();
    expect(timing.request('İsraf', 'waste', Number.NaN).show).toBe(false);
    expect(timing.request('İsraf', 'waste', 0).show).toBe(true);
    expect(timing.request('Kayıt', 'save-error', Number.POSITIVE_INFINITY).show).toBe(false);
    expect(timing.current(100)?.message).toBe('İsraf');
  });
});
