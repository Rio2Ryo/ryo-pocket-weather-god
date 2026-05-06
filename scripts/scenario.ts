import { scenario } from '../src/domain';

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const seed = arg('seed', 'ryo-storm-lab') || 'ryo-storm-lab';
const ticks = Number(arg('ticks', '120'));
const result = scenario(seed, Number.isFinite(ticks) ? ticks : 120);
console.log(JSON.stringify(result, null, 2));
