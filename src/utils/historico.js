import { mapWeather } from '../services/clima.js';
import { levels } from '../types/sintomas.js';

export function converterHistorico(records) {
  return records.slice().reverse().map(r=>({
    data:r.recorded_at,
    dorRepouso:r.pain_rest,
    dorMovimento:r.pain_movement,
    rigidez:Math.max(0,levels.indexOf(r.stiffness)),
    fadiga:Math.max(0,levels.indexOf(r.fatigue)),
    clima:mapWeather(r)
  }));
}
