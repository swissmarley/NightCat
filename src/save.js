// Records persisted in localStorage: per-stage bests and the mute preference.
const KEY = 'nightcat.save.v1';

export const RANKS = ['C', 'B', 'A', 'S'];

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') return { records: {}, muted: false, ...data };
    }
  } catch {
    /* private mode / blocked storage — play without records */
  }
  return { records: {}, muted: false };
}

export function storeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/** Merge a finished run into the stage record; returns true if anything improved. */
export function recordRun(data, stageId, { time, sparks, sparksTotal, rank }) {
  const prev = data.records[stageId] || {};
  const next = {
    cleared: true,
    bestTime: prev.bestTime === undefined ? time : Math.min(prev.bestTime, time),
    bestSparks: Math.max(prev.bestSparks || 0, sparks),
    sparksTotal,
    bestRank: RANKS.indexOf(rank) > RANKS.indexOf(prev.bestRank || 'C') || !prev.bestRank ? rank : prev.bestRank,
  };
  data.records[stageId] = next;
  storeSave(data);
  return (
    !prev.cleared || next.bestTime < prev.bestTime || next.bestSparks > prev.bestSparks || next.bestRank !== prev.bestRank
  );
}
