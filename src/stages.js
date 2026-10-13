// Stage definitions. Layouts are hand-authored lists of platforms and gaps.
//
// plat(len, top, obstacles) / gap(len). Obstacle x is relative to the platform
// start. Kinds are theme-specific; 'cp' is a checkpoint marker. Hanging kinds
// (laundry, hangsign, rope, branch) must be slid under.
//
// Authoring rules of thumb (full jump carries ≈5.5u at 7u/s, ≈7.2u at 9.4u/s):
//   - a ground obstacle sits ≥4.5u after a gap landing and ≥5u after a step-up
//   - a ground obstacle sits ≤ len − (jump range + 0.5) so the landing stays dry
//   - a hanging obstacle never sits where a jump would land on it

function make(fn) {
  const items = [];
  const plat = (len, top, obs = []) => items.push({ type: 'plat', len, top, obs });
  const gap = (len) => items.push({ type: 'gap', len });
  fn(plat, gap);
  return items;
}

export const STAGES = [
  {
    id: 1,
    numeral: 'I',
    name: 'a night on the walls',
    blurb: 'rain, lamplight, and the long way home',
    theme: 'street',
    seed: 20261013,
    baseSpeed: 7.0,
    speedGain: 1.6,
    goalOffset: 14,
    extraSparks: [
      { x: 9.5, y: 0.6 },
      { x: 10.9, y: 0.6 },
      { x: 12.3, y: 0.6 },
      { x: 16.0, y: 0.3 },
    ],
    layout: () =>
      make((plat, gap) => {
        plat(20, 0, [{ x: 16, kind: 'laundry' }]); // intro — learn to slide
        gap(2.4);
        plat(11, 0, [{ x: 5.5, kind: 'crate' }]);
        gap(2.8);
        plat(9, 0);
        plat(8, 0.8); // first wall step
        gap(3.2);
        plat(10, 0.8, [{ x: 5, kind: 'bin' }]);
        plat(10, 0, [{ x: 5, kind: 'planter' }]); // step down
        gap(3.0);
        plat(11, 0, [{ x: 5.0, kind: 'crate' }]);
        gap(3.4);
        plat(8, 0.6); // gap + step up
        plat(13, 0.6, [
          { x: 4.5, kind: 'bin' },
          { x: 6.5, kind: 'sign' },
        ]);
        gap(3.6);
        plat(6, 0);
        gap(2.6);
        plat(6, 0);
        gap(2.6);
        plat(11, 0.9, [{ x: 5.5, kind: 'crate' }]);
        gap(3.8);
        plat(10, 0.9, [
          { x: 4.8, kind: 'planter' },
          { x: 8.6, kind: 'cp' },
        ]);
        plat(8, 0.2, [{ x: 4.5, kind: 'laundry' }]);
        gap(4.0);
        plat(11, 0.2, [{ x: 4.8, kind: 'sign' }]);
        gap(3.0);
        plat(7, 1.0);
        plat(9, 1.0, [
          { x: 2.5, kind: 'crate' },
          { x: 4.5, kind: 'crate' },
        ]);
        gap(3.4);
        plat(6, 0.4);
        gap(3.4);
        plat(11, 0.4, [{ x: 5.0, kind: 'bin' }]);
        gap(3.8);
        plat(13, 0, [
          { x: 5, kind: 'planter' },
          { x: 7.5, kind: 'sign' },
        ]);
        gap(4.2);
        plat(8, 0, [{ x: 4.0, kind: 'hangsign' }]);
        plat(13, 0.9, [{ x: 7.0, kind: 'crate' }]);
        gap(3.0);
        plat(5, 0.9);
        gap(3.0);
        plat(5, 0.9);
        gap(3.2);
        plat(13, 0.3, [
          { x: 6.2, kind: 'bin' },
          { x: 8.7, kind: 'crate' },
        ]);
        gap(3.6);
        plat(26, 0, [
          { x: 5, kind: 'laundry' },
          { x: 9, kind: 'hangsign' },
        ]); // home stretch; the gate sits 14u in
      }),
  },
  {
    id: 2,
    numeral: 'II',
    name: 'the shrine path',
    blurb: 'moss, lanterns, and a lake full of moon',
    theme: 'shrine',
    seed: 7071,
    baseSpeed: 7.4,
    speedGain: 2.0,
    goalOffset: 14,
    extraSparks: [
      { x: 8, y: 0.6 },
      { x: 9.4, y: 0.6 },
      { x: 10.8, y: 0.6 },
      { x: 16.0, y: 0.3 },
    ],
    layout: () =>
      make((plat, gap) => {
        plat(22, 0, [{ x: 16, kind: 'rope' }]); // intro; rope under the first torii
        gap(2.6);
        plat(12, 0, [{ x: 6, kind: 'rock' }]);
        gap(3.0);
        plat(10, 0);
        plat(12, 0.8, [{ x: 6.5, kind: 'fence' }]); // wall
        gap(3.4);
        plat(12, 0.8, [{ x: 5.5, kind: 'rope' }]);
        plat(12, 0, [{ x: 5, kind: 'fox' }]); // step down
        gap(3.6);
        plat(16, 0, [
          { x: 5, kind: 'branch' },
          { x: 9.5, kind: 'box' },
        ]);
        gap(4.0);
        plat(9, 0.9); // gap + wall up
        plat(12, 0.9, [
          { x: 3, kind: 'rock' },
          { x: 5.2, kind: 'rock' },
        ]);
        gap(3.8);
        plat(14, 0.9, [
          { x: 5, kind: 'rope' },
          { x: 11, kind: 'cp' },
        ]);
        plat(10, 0.3); // step down
        gap(4.4);
        plat(13, 0.3, [{ x: 6, kind: 'fox' }]);
        gap(3.2);
        plat(8, 1.1); // gap + up
        plat(16, 1.1, [
          { x: 3.5, kind: 'branch' },
          { x: 8.5, kind: 'fence' },
        ]);
        gap(4.0);
        plat(7, 0.5);
        gap(3.0);
        plat(7, 0.5);
        gap(3.6);
        plat(13, 0.5, [
          { x: 5.5, kind: 'box' },
          { x: 11, kind: 'cp' },
        ]);
        gap(4.6);
        plat(16, 0, [
          { x: 4.5, kind: 'rope' },
          { x: 9, kind: 'rock' },
        ]);
        gap(3.4);
        plat(12, 0.9, [{ x: 5.5, kind: 'fence' }]); // gap + wall up
        gap(3.0);
        plat(6, 0.9);
        gap(3.0);
        plat(6, 0.9);
        gap(3.4);
        plat(17, 0.2, [
          { x: 6.6, kind: 'fox' },
          { x: 9.6, kind: 'rock' },
          { x: 14, kind: 'branch' },
        ]);
        gap(4.2);
        plat(28, 0, [{ x: 5, kind: 'rope' }]); // home stretch; the shrine sits 14u in
      }),
  },
];

export function stageById(id) {
  return STAGES.find((s) => s.id === id) || STAGES[0];
}
