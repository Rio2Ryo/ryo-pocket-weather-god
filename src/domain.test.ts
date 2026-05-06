import { describe, expect, it } from 'vitest';
import { applyAction, createInitialState, exportState, importState, replay, scenario, simulateUntil } from './domain';

describe('Pocket Weather God deterministic engine', () => {
  it('replays the same seed deterministically', () => {
    expect(simulateUntil(createInitialState('storm-lab'), 80)).toEqual(simulateUntil(createInitialState('storm-lab'), 80));
  });

  it('different seeds create different worlds', () => {
    expect(createInitialState('storm-lab').world).not.toEqual(createInitialState('sunny-otter').world);
  });

  it('action replay is deterministic', () => {
    const actions = [{ type: 'bless' as const, atTick: 2 }, { type: 'weirdWhisper' as const, atTick: 4, text: 'strange telegram thunder' }];
    expect(replay('ryo', actions, 12)).toEqual(replay('ryo', actions, 12));
  });

  it('export/import round trips state', () => {
    const state = applyAction(simulateUntil(createInitialState('export'), 7), { type: 'paintRain', atTick: 7, amount: 20 });
    expect(importState(exportState(state))).toEqual({ ...state, paused: true });
  });

  it('scenario output is stable', () => {
    expect(scenario('qa-seed', 24)).toEqual(scenario('qa-seed', 24));
  });

  it('rejects weird invalid import', () => {
    expect(() => importState('{"app":"wrong"}')).toThrow();
  });
});
