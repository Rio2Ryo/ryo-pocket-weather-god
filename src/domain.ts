export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm' | 'wind' | 'fog';
export type Mood = 'sleepy' | 'calm' | 'happy' | 'nervous' | 'ecstatic' | 'haunted';
export type Ritual = 'umbrella parade' | 'frog choir' | 'wind-kite repair' | 'mushroom lanterns' | 'thunder tea' | 'sun apology';

export type WorldState = {
  weather: WeatherKind;
  temperatureC: number;
  humidity: number;
  windKph: number;
  cloudCover: number;
  lightningCharge: number;
  sunAngle: number;
  pond: number;
  crop: number;
  critterMood: Mood;
  ritual: Ritual;
  omen: string;
};

export type UserAction =
  | { type: 'bless'; atTick: number }
  | { type: 'curse'; atTick: number }
  | { type: 'nudgeWind'; atTick: number; delta: number }
  | { type: 'paintRain'; atTick: number; amount: number }
  | { type: 'weirdWhisper'; atTick: number; text: string };

export type TimelineEntry = { tick: number; text: string; weather: WeatherKind; mood: Mood };
export type AppState = {
  version: 1;
  seed: string;
  tick: number;
  world: WorldState;
  actionLog: UserAction[];
  timeline: TimelineEntry[];
  paused: boolean;
};

const weatherCycle: WeatherKind[] = ['clear', 'cloudy', 'rain', 'storm', 'wind', 'fog'];
const rituals: Ritual[] = ['umbrella parade', 'frog choir', 'wind-kite repair', 'mushroom lanterns', 'thunder tea', 'sun apology'];
const omens = ['a snail files a weather report', 'the pond remembers tomorrow', 'three clouds vote no', 'the hill grows a small opinion', 'a lantern blinks in morse', 'the village names a breeze'];

export function normalizeSeed(seed?: string) {
  const s = (seed || '').trim().slice(0, 80);
  return s || 'ryo-storm-lab';
}

function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export function createRng(seed: string) {
  let a = xmur3(seed)();
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(n)));
const pick = <T,>(items: readonly T[], r: number) => items[Math.floor(r * items.length) % items.length];

export function createInitialState(rawSeed?: string): AppState {
  const seed = normalizeSeed(rawSeed);
  const rng = createRng(seed);
  const world: WorldState = {
    weather: pick(weatherCycle, rng()),
    temperatureC: clamp(8 + rng() * 24, -10, 40),
    humidity: clamp(30 + rng() * 55, 0, 100),
    windKph: clamp(rng() * 28, 0, 90),
    cloudCover: clamp(rng() * 75, 0, 100),
    lightningCharge: clamp(rng() * 40, 0, 100),
    sunAngle: clamp(rng() * 360, 0, 360),
    pond: clamp(35 + rng() * 35, 0, 100),
    crop: clamp(35 + rng() * 45, 0, 100),
    critterMood: pick(['sleepy', 'calm', 'happy', 'nervous'], rng()),
    ritual: pick(rituals, rng()),
    omen: pick(omens, rng()),
  };
  return { version: 1, seed, tick: 0, world, actionLog: [], timeline: [event(0, world, `seeded ${seed}: ${world.omen}`)], paused: true };
}

function event(tick: number, world: WorldState, text: string): TimelineEntry {
  return { tick, text, weather: world.weather, mood: world.critterMood };
}

function deriveWeather(w: WorldState): WeatherKind {
  if (w.lightningCharge > 78 && w.humidity > 62) return 'storm';
  if (w.humidity > 70) return 'rain';
  if (w.windKph > 42) return 'wind';
  if (w.cloudCover > 68) return 'cloudy';
  if (w.humidity > 55 && w.windKph < 10) return 'fog';
  return 'clear';
}

function deriveMood(w: WorldState): Mood {
  if (w.lightningCharge > 85) return 'haunted';
  if (w.crop > 82 && w.pond > 45) return 'ecstatic';
  if (w.windKph > 50 || w.pond < 12) return 'nervous';
  if (w.humidity > 70) return 'happy';
  if (w.temperatureC < 3) return 'sleepy';
  return 'calm';
}

export function applyAction(state: AppState, action: UserAction): AppState {
  let w = { ...state.world };
  if (action.type === 'bless') { w.crop += 14; w.lightningCharge -= 12; w.omen = 'the frogs stamp a golden approval'; }
  if (action.type === 'curse') { w.lightningCharge += 25; w.cloudCover += 18; w.omen = 'a scarecrow starts negotiating'; }
  if (action.type === 'nudgeWind') { w.windKph += action.delta; w.omen = action.delta > 0 ? 'kites become local government' : 'the flags forget their job'; }
  if (action.type === 'paintRain') { w.humidity += action.amount; w.pond += action.amount / 2; w.cloudCover += action.amount / 3; w.omen = 'rain writes receipts on the pond'; }
  if (action.type === 'weirdWhisper') {
    const glyph = action.text.trim().slice(0, 60) || '(silence)';
    const force = [...glyph].reduce((a, c) => a + c.charCodeAt(0), 0) % 31;
    w.lightningCharge += force - 10; w.windKph += (force % 9) - 4; w.crop += force % 7; w.omen = `whisper accepted: “${glyph}” bent the weather by ${force}`;
  }
  w = finalizeWorld(w);
  return { ...state, world: w, actionLog: [...state.actionLog, action], timeline: [...state.timeline, event(state.tick, w, describeAction(action, w))].slice(-80) };
}

function describeAction(action: UserAction, w: WorldState) {
  if (action.type === 'weirdWhisper') return `the village heard “${action.text.slice(0, 28)}” → ${w.omen}`;
  return `${action.type} changed the sky: ${w.weather}, ${w.critterMood}, ${w.ritual}`;
}

function finalizeWorld(w: WorldState): WorldState {
  const next = { ...w };
  next.humidity = clamp(next.humidity, 0, 100); next.windKph = clamp(next.windKph, 0, 90); next.cloudCover = clamp(next.cloudCover, 0, 100);
  next.lightningCharge = clamp(next.lightningCharge, 0, 100); next.pond = clamp(next.pond, 0, 100); next.crop = clamp(next.crop, 0, 100);
  next.temperatureC = clamp(next.temperatureC, -10, 44); next.sunAngle = ((Math.round(next.sunAngle) % 360) + 360) % 360;
  next.weather = deriveWeather(next); next.critterMood = deriveMood(next);
  return next;
}

export function simulateTick(state: AppState): AppState {
  const rng = createRng(`${state.seed}:${state.tick}:${state.actionLog.length}`);
  let w = { ...state.world };
  w.sunAngle += 9; w.cloudCover += rng() * 12 - 5; w.humidity += rng() * 10 - 4; w.windKph += rng() * 8 - 3;
  w.lightningCharge += (w.cloudCover + w.humidity) / 35 + rng() * 7 - 4; w.pond += w.weather === 'rain' || w.weather === 'storm' ? 2 : -1;
  w.crop += w.weather === 'clear' && w.pond > 25 ? 2 : w.weather === 'storm' ? -2 : 1; w.temperatureC += w.weather === 'clear' ? 1 : -0.4;
  if (state.tick % 12 === 0) w.ritual = pick(rituals, rng());
  if (state.tick % 9 === 0) w.omen = pick(omens, rng());
  w = finalizeWorld(w);
  const newTick = state.tick + 1;
  const timeline = newTick % 5 === 0 ? [...state.timeline, event(newTick, w, `tick ${newTick}: ${w.ritual}; ${w.omen}`)].slice(-80) : state.timeline;
  return { ...state, tick: newTick, world: w, timeline };
}

export function simulateUntil(state: AppState, targetTick: number): AppState {
  let s = state;
  const target = clamp(targetTick, 0, 5000);
  while (s.tick < target) s = simulateTick(s);
  return s;
}

export function replay(seed: string, actions: UserAction[], tick: number): AppState {
  let s = createInitialState(seed);
  for (let i = 0; i <= tick; i++) {
    for (const a of actions.filter((x) => x.atTick === i)) s = applyAction(s, a);
    if (s.tick < tick) s = simulateTick(s);
  }
  return s;
}

export function exportState(state: AppState) {
  return JSON.stringify({ app: 'pocket-weather-god', version: 1, exportedAt: new Date().toISOString(), state }, null, 2);
}

function validateState(input: unknown): AppState {
  if (!input || typeof input !== 'object') throw new Error('State is not an object');
  const s = input as Partial<AppState>;
  if (s.version !== 1 || typeof s.seed !== 'string' || typeof s.tick !== 'number' || !s.world || typeof s.world !== 'object') throw new Error('Invalid state shape');
  const w = s.world as Partial<WorldState>;
  const weatherOk = weatherCycle.includes(w.weather as WeatherKind);
  const moodOk = ['sleepy', 'calm', 'happy', 'nervous', 'ecstatic', 'haunted'].includes(String(w.critterMood));
  if (!weatherOk || !moodOk) throw new Error('Invalid world values');
  const num = (value: unknown, name: string) => {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`Invalid numeric field: ${name}`);
    return n;
  };
  const world = finalizeWorld({
    weather: w.weather as WeatherKind,
    temperatureC: num(w.temperatureC, 'temperatureC'), humidity: num(w.humidity, 'humidity'), windKph: num(w.windKph, 'windKph'), cloudCover: num(w.cloudCover, 'cloudCover'),
    lightningCharge: num(w.lightningCharge, 'lightningCharge'), sunAngle: num(w.sunAngle, 'sunAngle'), pond: num(w.pond, 'pond'), crop: num(w.crop, 'crop'),
    critterMood: w.critterMood as Mood, ritual: rituals.includes(w.ritual as Ritual) ? w.ritual as Ritual : 'frog choir', omen: String(w.omen || 'imported weather memory'),
  });
  const validAction = (a: unknown): a is UserAction => {
    if (!a || typeof a !== 'object') return false;
    const x = a as Partial<UserAction>;
    if (!Number.isFinite(Number(x.atTick))) return false;
    if (x.type === 'bless' || x.type === 'curse') return true;
    if (x.type === 'nudgeWind') return Number.isFinite(Number((x as { delta?: unknown }).delta));
    if (x.type === 'paintRain') return Number.isFinite(Number((x as { amount?: unknown }).amount));
    if (x.type === 'weirdWhisper') return typeof (x as { text?: unknown }).text === 'string';
    return false;
  };
  const actionLog = Array.isArray(s.actionLog) ? s.actionLog.filter(validAction).map((a) => ({ ...a, atTick: clamp(a.atTick, 0, 5000) })).slice(-120) : [];
  const timeline = Array.isArray(s.timeline) ? s.timeline.filter((t): t is TimelineEntry => !!t && typeof t === 'object' && typeof (t as TimelineEntry).text === 'string').slice(-80) : [event(s.tick, world, 'imported weather memory')];
  return { version: 1, seed: normalizeSeed(s.seed), tick: clamp(s.tick, 0, 5000), world, actionLog, timeline, paused: true };
}

export function importState(json: string): AppState {
  if (json.length > 500_000) throw new Error('Import too large');
  const parsed = JSON.parse(json) as { app?: string; version?: number; state?: unknown };
  if (parsed.app !== 'pocket-weather-god' || parsed.version !== 1 || !parsed.state) throw new Error('Not a Pocket Weather God export');
  return validateState(parsed.state);
}

export function encodeExactState(state: AppState) {
  return encodeURIComponent(exportState(state));
}

export function decodeExactState(value: string) {
  return importState(decodeURIComponent(value));
}

export function shareUrl(state: AppState, origin = '') {
  const params = new URLSearchParams({ state: encodeExactState(state) });
  return `${origin}/?${params.toString()}`;
}

export function scenario(seed: string, ticks: number) {
  const initial = createInitialState(seed);
  const final = simulateUntil(initial, ticks);
  return { seed: initial.seed, ticks: final.tick, summary: final.world, timeline: final.timeline };
}
