import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import './App.css';
import { applyAction, createInitialState, decodeExactState, exportState, importState, shareUrl, simulateUntil, type AppState, type UserAction } from './domain';

type Event =
  | { type: 'reset'; seed: string }
  | { type: 'tick'; count?: number }
  | { type: 'toggle' }
  | { type: 'act'; action: UserAction }
  | { type: 'import'; json: string };

function reducer(state: AppState, event: Event): AppState {
  if (event.type === 'reset') return createInitialState(event.seed);
  if (event.type === 'toggle') return { ...state, paused: !state.paused };
  if (event.type === 'tick') return simulateUntil(state, state.tick + Math.max(1, Math.min(event.count ?? 1, 250)));
  if (event.type === 'act') return applyAction(state, event.action);
  if (event.type === 'import') return importState(event.json);
  return state;
}

function initialFromUrl() {
  const params = new URLSearchParams(location.search);
  const exact = params.get('state');
  if (exact) {
    try { return decodeExactState(exact); } catch { /* fall back to seed/tick */ }
  }
  return simulateUntil(createInitialState(params.get('seed') || undefined), Number(params.get('tick') || 0));
}

declare global { interface Window { __APP_DEBUG__?: { getState: () => AppState; setSeed: (seed: string) => void; tick: (count?: number) => void; act: (type: string, value?: string | number) => void; exportJson: () => string; importJson: (json: string) => void; shareUrl: () => string; } } }

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialFromUrl);
  const [seed, setSeed] = useState(state.seed);
  const [whisper, setWhisper] = useState('リョウの夜間運用に小さな雷を');
  const [json, setJson] = useState('');
  const [notice, setNotice] = useState('debug API ready: window.__APP_DEBUG__');
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (state.paused) return;
    const id = window.setInterval(() => dispatch({ type: 'tick' }), 700);
    return () => window.clearInterval(id);
  }, [state.paused]);

  useEffect(() => {
    window.__APP_DEBUG__ = {
      getState: () => stateRef.current,
      setSeed: (s) => dispatch({ type: 'reset', seed: s }),
      tick: (count = 1) => dispatch({ type: 'tick', count }),
      act: (type, value) => {
        const atTick = stateRef.current.tick;
        if (type === 'bless' || type === 'curse') dispatch({ type: 'act', action: { type, atTick } });
        else if (type === 'wind') dispatch({ type: 'act', action: { type: 'nudgeWind', atTick, delta: Number(value ?? 8) } });
        else dispatch({ type: 'act', action: { type: 'weirdWhisper', atTick, text: String(value ?? 'debug ghost') } });
      },
      exportJson: () => exportState(stateRef.current),
      importJson: (j) => dispatch({ type: 'import', json: j }),
      shareUrl: () => shareUrl(stateRef.current, location.origin),
    };
  }, []);

  const style = useMemo(() => ({
    '--cloud': `${state.world.cloudCover}%`, '--pond': `${state.world.pond}%`, '--crop': `${state.world.crop}%`, '--sun': `${state.world.sunAngle}deg`,
  }) as React.CSSProperties, [state]);

  const act = (action: UserAction) => dispatch({ type: 'act', action: { ...action, atTick: state.tick } });
  const copyShare = () => {
    const url = shareUrl(state, location.origin);
    void Promise.race([
      navigator.clipboard?.writeText(url) ?? Promise.resolve(),
      new Promise((resolve) => window.setTimeout(resolve, 350)),
    ]).catch(() => undefined);
    setNotice(`exact replay URL ready (${url.length} chars): ${url.slice(0, 120)}…`);
  };
  const doExport = () => { const out = exportState(state); setJson(out); setNotice('JSON export printed into the import/export dock'); };
  const doImport = () => { try { dispatch({ type: 'import', json }); setNotice('imported; the village is now replaying that weather memory'); } catch (e) { setNotice(e instanceof Error ? e.message : 'import failed'); } };

  return <main className={`app weather-${state.world.weather}`} style={style}>
    <section className="hero">
      <div><p className="eyebrow">Pocket Weather God / deterministic tiny ops diorama</p><h1>天気をいじると、村がログで返事する。</h1><p>Seed・tick・介入履歴で再現できる、小さな気象シミュレーション。CLIと <code>window.__APP_DEBUG__</code> からAIも操作できます。</p></div>
      <div className="status"><b>{state.world.weather}</b><span>tick {state.tick}</span><span>{state.world.critterMood}</span></div>
    </section>

    <section className="grid">
      <aside className="panel controls" aria-label="controls">
        <label>Seed<input value={seed} onChange={(e) => setSeed(e.target.value)} /></label>
        <button onClick={() => dispatch({ type: 'reset', seed })}>Reseed world</button>
        <button onClick={() => dispatch({ type: 'toggle' })}>{state.paused ? 'Auto-run weather' : 'Pause'}</button>
        <button onClick={() => dispatch({ type: 'tick', count: 12 })}>Step +12 ticks</button>
        <button onClick={() => act({ type: 'bless', atTick: state.tick })}>Bless crops</button>
        <button onClick={() => act({ type: 'curse', atTick: state.tick })}>Curse cloud</button>
        <button onClick={() => act({ type: 'nudgeWind', atTick: state.tick, delta: 9 })}>Push wind +9</button>
        <button onClick={() => act({ type: 'paintRain', atTick: state.tick, amount: 18 })}>Paint rain</button>
        <label>Weird whisper<input value={whisper} onChange={(e) => setWhisper(e.target.value)} /></label>
        <button onClick={() => act({ type: 'weirdWhisper', atTick: state.tick, text: whisper })}>Whisper into sky</button>
      </aside>

      <section className="diorama" aria-label={`living weather diorama: ${state.world.weather}, ${state.world.critterMood}, ${state.world.omen}`}>
        <div className="sun" aria-hidden="true" /><div className="cloud c1" aria-hidden="true" /><div className="cloud c2" aria-hidden="true" /><div className="rain" aria-hidden="true" /><div className="lightning" aria-hidden="true">⚡</div>
        <div className="hill h1" aria-hidden="true" /><div className="hill h2" aria-hidden="true" /><div className="pond" aria-hidden="true" /><div className="village" aria-hidden="true">⌂ ⌂ ♡ 🐸</div>
        <div className="omen">{state.world.omen}</div>
      </section>

      <aside className="panel inspector">
        <h2>Inspector</h2>
        <dl><dt>temp</dt><dd>{state.world.temperatureC}°C</dd><dt>humidity</dt><dd>{state.world.humidity}%</dd><dt>wind</dt><dd>{state.world.windKph}kph</dd><dt>cloud</dt><dd>{state.world.cloudCover}%</dd><dt>charge</dt><dd>{state.world.lightningCharge}%</dd><dt>pond/crop</dt><dd>{state.world.pond}/{state.world.crop}</dd><dt>ritual</dt><dd>{state.world.ritual}</dd></dl>
        <button onClick={copyShare}>Copy exact replay URL</button><button onClick={doExport}>Export JSON</button><button onClick={doImport}>Import JSON</button>
        <label>Exact replay JSON<textarea value={json} onChange={(e) => setJson(e.target.value)} placeholder="export/import JSON lives here" /></label>
        <div className="opsbox"><b>Replay recipe</b><code>seed + tick + actionLog = exact weather</code><code>npm run scenario -- --seed {state.seed} --ticks {state.tick}</code><code>window.__APP_DEBUG__.tick(50)</code><span>{state.actionLog.length} intervention(s) recorded</span></div>
        <p className="notice" aria-live="polite">{notice}</p>
      </aside>
    </section>

    <section className="timeline"><h2>Village flight recorder</h2>{state.timeline.slice().reverse().map((e) => <article key={`${e.tick}-${e.text}`}><b>t+{e.tick}</b><span>{e.weather}/{e.mood}</span><p>{e.text}</p></article>)}</section>
  </main>;
}
