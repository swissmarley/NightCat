// Stage definitions. Layouts are hand-authored lists of platforms and gaps.
//
// plat(len, top, obstacles) / gap(len) / boards(len, top). Obstacle x is
// relative to the platform start. Kinds are theme-specific; 'cp' is a checkpoint
// marker. Hanging kinds (laundry, hangsign, rope, branch, garland, bell, fishline,
// lanterns, wisteria, basket, chimes, carpet, fanous, peppers, bunting, trapeze,
// bulbs) are slid under or jumped; stage I has none.
// Boards are a platform that gives way BRITTLE_DELAY seconds after it is first
// stood on: jump off them in time. An awning(len, top) is a stretched canvas that
// throws the cat up (BOUNCE_V) the moment it lands on it: from anywhere on it the
// throw must clear the next roof's wall, so leave ≥1.6u between its far end and
// a wall up to 2.2u higher.
//
// Authoring rules of thumb (full jump carries ≈5.5u at 7u/s, ≈7.2u at 9.4u/s):
//   - a ground obstacle sits ≥4.5u after a gap landing and ≥5u after a step-up
//     (≥9u after a step-up from stage IV on: a full jump onto a wall lands 5–7u in)
//   - a ground obstacle sits ≤ len − (jump range + 0.5) so the landing stays dry
//   - a hanging obstacle never sits where a jump would land on it

function make(fn) {
  const items = [];
  const plat = (len, top, obs = []) => items.push({ type: 'plat', len, top, obs });
  const gap = (len) => items.push({ type: 'gap', len });
  const boards = (len, top) => items.push({ type: 'plat', len, top, obs: [], brittle: true });
  const awning = (len, top) => items.push({ type: 'plat', len, top, obs: [], bouncy: true });
  fn(plat, gap, boards, awning);
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
        plat(20, 0); // intro — nothing but the walk and the sparks
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
        plat(12, 0.2);
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
        plat(13, 0, [{ x: 5, kind: 'crate' }]);
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
        plat(26, 0, [{ x: 6, kind: 'bin' }]); // home stretch; the gate sits 14u in
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
        plat(22, 0, [{ x: 15, kind: 'rope' }]); // intro; rope under the first torii
        gap(2.6);
        plat(12, 0, [{ x: 6, kind: 'rock' }]);
        gap(3.0);
        plat(10, 0);
        plat(12, 0.8, [{ x: 6.5, kind: 'fence' }]); // wall
        gap(3.4);
        plat(12, 0.8, [{ x: 5.5, kind: 'rope' }]);
        plat(12, 0, [{ x: 5, kind: 'fox' }]); // step down
        gap(3.6);
        plat(20, 0, [
          { x: 5.8, kind: 'branch' },
          { x: 14, kind: 'box' },
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
        plat(18, 1.1, [
          { x: 3.5, kind: 'branch' },
          { x: 11, kind: 'fence' },
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
        plat(22, 0, [
          { x: 5.5, kind: 'rope' },
          { x: 13.5, kind: 'rock' },
        ]);
        gap(3.4);
        plat(12, 0.9, [{ x: 5.5, kind: 'fence' }]); // gap + wall up
        gap(3.0);
        plat(6, 0.9);
        gap(3.0);
        plat(6, 0.9);
        gap(3.4);
        plat(23, 0.2, [
          { x: 6.6, kind: 'fox' },
          { x: 9.6, kind: 'rock' },
          { x: 15.5, kind: 'branch' },
        ]);
        gap(4.2);
        plat(28, 0, [{ x: 6.5, kind: 'rope' }]); // home stretch; the shrine sits 14u in
      }),
  },
  {
    id: 3,
    numeral: 'III',
    name: 'the first snow',
    blurb: 'snow, chimneys, and the northern lights',
    theme: 'snow',
    seed: 31122,
    baseSpeed: 7.8,
    speedGain: 2.2,
    goalOffset: 14,
    extraSparks: [
      { x: 9, y: 0.6 },
      { x: 10.4, y: 0.6 },
      { x: 11.8, y: 0.6 },
      { x: 16.0, y: 0.3 },
    ],
    layout: () =>
      make((plat, gap, boards) => {
        plat(20, 0); // intro — the first roofs: nothing but the walk and the sparks
        gap(2.6);
        plat(13, 0, [{ x: 5, kind: 'chimney' }]);
        gap(3.0);
        plat(9, 0);
        boards(6, 0); // the first old boards across an alley: jump off them
        plat(15, 0, [{ x: 8, kind: 'drift' }]);
        gap(3.2);
        plat(10, 0.8, [{ x: 6, kind: 'garland' }]); // gap + up
        plat(13, 0, [{ x: 6, kind: 'logs' }]); // step down
        gap(3.4);
        plat(19, 0.4, [
          { x: 5.5, kind: 'bell' },
          { x: 10, kind: 'cp' },
        ]);
        gap(3.6);
        plat(14, 0.4, [{ x: 5, kind: 'pipe' }]);
        plat(8, 1.2); // wall
        boards(6, 1.2); // boards, then a gap: leave them early
        gap(1.6);
        plat(16, 0.6, [{ x: 8, kind: 'snowman' }]);
        gap(3.6);
        plat(12, 0.6, [{ x: 5.5, kind: 'garland' }]);
        plat(16, 0, [
          { x: 5.5, kind: 'chimney' },
          { x: 7.7, kind: 'logs' },
        ]); // step down; one jump clears both
        gap(3.8);
        plat(20, 0.5, [
          { x: 5.5, kind: 'cp' },
          { x: 12, kind: 'drift' },
        ]);
        gap(1.8); // stepping boards: hop, hop, hop
        boards(6.5, 0.5);
        gap(1.8);
        boards(6.5, 0.5);
        gap(2.0);
        plat(16, 0.5, [{ x: 9, kind: 'bell' }]);
        plat(9, 1.4); // wall
        gap(3.0);
        plat(17, 0.6, [{ x: 7.5, kind: 'pipe' }]); // gap + step down: a long landing
        gap(4.0);
        plat(8, 0.6);
        boards(6, 0.6);
        plat(16, 0.6, [{ x: 7.5, kind: 'snowman' }]);
        gap(3.8);
        plat(20, 1.0, [
          { x: 6, kind: 'cp' },
          { x: 13, kind: 'garland' },
        ]); // gap + up
        plat(16, 0.3, [
          { x: 6, kind: 'chimney' },
          { x: 8.3, kind: 'pipe' },
        ]); // step down
        boards(6, 0.3);
        gap(1.6);
        plat(9, 0.9); // gap + up off the boards
        plat(16, 0.9, [{ x: 6, kind: 'drift' }]);
        gap(4.2);
        plat(24, 0.2, [
          { x: 7, kind: 'logs' },
          { x: 15.8, kind: 'bell' },
        ]); // gap + step down: a long landing
        gap(4.4);
        plat(30, 0, [{ x: 7.5, kind: 'garland' }]); // home stretch; home sits 14u in
      }),
  },
  {
    id: 4,
    numeral: 'IV',
    name: 'the harbour lights',
    blurb: 'fish, boats, and fireworks over the bay',
    theme: 'harbour',
    seed: 40817,
    baseSpeed: 8.2,
    speedGain: 2.4,
    goalOffset: 14,
    extraSparks: [
      { x: 9, y: 0.6 },
      { x: 10.4, y: 0.6 },
      { x: 11.8, y: 0.6 },
      { x: 16.0, y: 0.3 },
      // an arc over the first shed roof, for a held jump taken about 170
      { x: 172.3, y: 3.92 },
      { x: 173.4, y: 4.18 },
      { x: 174.6, y: 3.94 },
    ],
    // A short platform with water on both sides is dressed as a moored boat, and
    // one 1.5u or more up as the roof of a fish shed; the rest are stone quays.
    layout: () =>
      make((plat, gap, boards) => {
        plat(22, 0); // the fish quay: nothing but the walk, a harbour cat and the sparks
        gap(2.4);
        plat(13, 0, [{ x: 5.6, kind: 'crate' }]);
        gap(2.8);
        plat(6.5, -0.2); // the first boats: hop, hop
        gap(2.4);
        plat(6.5, 0.3);
        gap(2.8);
        plat(16, 0, [{ x: 7.5, kind: 'fishline' }]); // fish hung out to dry: slide under
        plat(15, 0.8, [{ x: 8.4, kind: 'barrel' }]); // wall
        gap(3.4);
        plat(7, 0.5); // a trawler
        gap(3.2);
        plat(17, 0.4, [
          { x: 5.8, kind: 'nets' },
          { x: 10, kind: 'cp' },
        ]);
        gap(3.2); // the old jetty: planks between the boats that give way
        plat(7, 0.4);
        gap(2.0);
        boards(6, 0.4);
        gap(1.8);
        plat(6.5, 0.4);
        gap(2.2);
        plat(16, 0.4, [{ x: 6.6, kind: 'bollard' }]);
        plat(10, 1.6); // wall: up onto the fish sheds
        plat(16, 1.6, [{ x: 7, kind: 'creel' }]);
        gap(3.6);
        plat(13, 1.0, [{ x: 9.5, kind: 'lanterns' }]); // gap + step down
        plat(15, 0.2, [{ x: 7.4, kind: 'crate' }]); // step down
        gap(4.0);
        plat(7, 0.6); // boats again
        gap(3.0);
        plat(7.5, 1.0); // a big trawler
        gap(3.4);
        plat(18, 0.5, [
          { x: 7.5, kind: 'fishline' },
          { x: 13, kind: 'cp' },
        ]);
        gap(1.8); // stepping planks: hop, hop, hop
        boards(6, 0.5);
        gap(1.8);
        boards(6, 0.5);
        gap(2.0);
        plat(17, 0.5, [{ x: 11, kind: 'lanterns' }]);
        plat(4.5, 1.0); // up the steps: hop, hop, hop
        plat(4.5, 1.5);
        plat(18, 2.0, [{ x: 10.5, kind: 'barrel' }]); // the high shed
        gap(3.6);
        plat(15, 1.2, [{ x: 6.5, kind: 'nets' }]); // gap + step down
        plat(17, 0.3, [
          { x: 7.4, kind: 'creel' },
          { x: 9.6, kind: 'bollard' },
        ]); // step down; one jump clears both
        gap(4.2);
        plat(6.5, 0); // boats, wider apart
        gap(2.8);
        plat(6.5, 0.6);
        gap(2.8);
        plat(20, 0.4, [
          { x: 6, kind: 'cp' },
          { x: 12.5, kind: 'fishline' },
        ]);
        plat(19, 1.0, [{ x: 9.5, kind: 'crate' }]); // wall
        boards(6, 1.0); // planks, then a gap: leave them early
        gap(1.6);
        plat(20, 0.6, [{ x: 11.5, kind: 'lanterns' }]);
        gap(4.4);
        plat(30, 0, [{ x: 9, kind: 'lanterns' }]); // home stretch; home sits 14u in
      }),
  },
  {
    id: 5,
    numeral: 'V',
    name: 'the glass garden',
    blurb: 'blossom, glasshouses, and frogs singing to the moon',
    theme: 'garden',
    seed: 52317,
    baseSpeed: 8.5,
    speedGain: 2.4,
    goalOffset: 14,
    extraSparks: [
      { x: 9, y: 0.6 },
      { x: 10.4, y: 0.6 },
      { x: 11.8, y: 0.6 },
      { x: 16.0, y: 0.3 },
    ],
    // A short platform with gaps either side is dressed as a clipped hedge, and
    // one 1.3u or more up as the ridge of a glasshouse; the rest are terrace walls.
    layout: () =>
      make((plat, gap, boards) => {
        plat(22, 0); // the garden wall: nothing but the walk, a cat in a flowerpot and the sparks
        gap(2.5);
        plat(13, 0, [{ x: 5.6, kind: 'can' }]);
        gap(2.8);
        plat(4.6, -0.1); // clipped hedges: hop, hop, hop
        gap(2.2);
        plat(4.6, 0.3);
        gap(2.2);
        plat(4.6, 0.0);
        gap(2.6);
        plat(17, 0.2, [{ x: 9.5, kind: 'wisteria' }]); // wisteria hung low: slide under
        plat(18, 1.4, [{ x: 10, kind: 'vent' }]); // wall: up onto the first glasshouse
        gap(3.4);
        plat(18, 0.6, [
          { x: 6, kind: 'gnome' },
          { x: 12, kind: 'cp' },
        ]);
        gap(3.0); // an old plank bridge between two hedges
        plat(4.6, 0.6);
        gap(1.8);
        boards(6, 0.6);
        gap(1.8);
        plat(4.6, 0.6);
        gap(2.4);
        plat(20, 0.4, [{ x: 8, kind: 'pots' }]);
        plat(15, 1.6, [{ x: 10.5, kind: 'vent' }]); // wall: the second glasshouse
        plat(14, 1.6, [{ x: 7.5, kind: 'basket' }]);
        gap(3.6);
        plat(14, 1.0, [{ x: 8, kind: 'barrow' }]); // gap + down onto a wall
        plat(16, 0.2, [{ x: 8, kind: 'birdbath' }]); // step down
        gap(4.0);
        plat(4.6, 0.5); // hedges, taller and further apart
        gap(2.8);
        plat(4.6, 0.9);
        gap(3.2);
        plat(19, 0.5, [
          { x: 9, kind: 'chimes' },
          { x: 14, kind: 'cp' },
        ]);
        gap(1.8); // the old planks again: hop, hop, hop
        boards(6, 0.5);
        gap(1.8);
        boards(6, 0.5);
        gap(2.0);
        plat(18, 0.5, [{ x: 11, kind: 'wisteria' }]);
        plat(4.5, 1.0); // up a terrace of glasshouses, one step at a time
        plat(4.5, 1.5);
        plat(4.5, 2.0);
        plat(18, 2.4, [{ x: 10.5, kind: 'vent' }]); // the tallest
        gap(3.8);
        plat(16, 1.6, [{ x: 9.5, kind: 'basket' }]); // gap + down: a lower glasshouse
        plat(17, 0.4, [
          { x: 7.4, kind: 'pots' },
          { x: 8.8, kind: 'can' },
        ]); // step down; one jump clears both
        gap(4.2);
        plat(4.6, 0); // hedges again
        gap(2.8);
        plat(5.6, 0.6);
        gap(2.8);
        plat(21, 0.4, [
          { x: 6, kind: 'cp' },
          { x: 13, kind: 'chimes' },
        ]);
        plat(19, 1.0, [{ x: 9.5, kind: 'gnome' }]); // wall
        boards(6, 1.0); // planks, then a gap: leave them early
        gap(1.6);
        plat(20, 0.6, [{ x: 11.5, kind: 'basket' }]);
        gap(4.4);
        plat(5, 0.2); // the last hedges, long enough for a full jump at this speed
        gap(2.6);
        plat(6, 0.7);
        gap(2.6);
        plat(16, 0.4, [{ x: 7.5, kind: 'birdbath' }]);
        gap(4.0);
        plat(30, 0, [{ x: 9, kind: 'wisteria' }]); // home stretch; home sits 14u in
      }),
  },
  {
    id: 6,
    numeral: 'VI',
    name: 'the blue city',
    blurb: 'blue walls, brass lanterns, and dunes under the Milky Way',
    theme: 'city',
    seed: 60621,
    baseSpeed: 8.8,
    speedGain: 2.4,
    goalOffset: 14,
    extraSparks: [
      { x: 9, y: 0.6 },
      { x: 10.4, y: 0.6 },
      { x: 11.8, y: 0.6 },
      { x: 16.0, y: 0.3 },
    ],
    // A platform 1.8u or more up is dressed as a tower of the old earth walls, and a
    // short one with gaps either side as an arch over an alley; the rest are rows of
    // houses. Awnings are market stalls down in the alleys.
    layout: () =>
      make((plat, gap, boards, awning) => {
        plat(22, 0); // the top of the town: nothing but the walk, a cat on a roof and the sparks
        gap(2.6);
        plat(13, 0, [{ x: 5.8, kind: 'oranges' }]); // low enough for a quick hop
        gap(2.8);
        plat(5, 0.3); // arches over the alleys: hop, hop
        gap(2.4);
        plat(5, 0);
        gap(2.6);
        plat(17, 0.2, [{ x: 9, kind: 'carpet' }]); // rugs hung out to air: slide under
        plat(18, 1.0, [{ x: 9.5, kind: 'rugs' }]); // wall
        gap(2.2); // the first awning: drop onto it and it throws you up onto the tower
        awning(4.5, -0.4);
        gap(2.3);
        plat(21, 1.9, [{ x: 12, kind: 'cage' }]);
        gap(3.6);
        plat(15, 1.2, [{ x: 9, kind: 'fanous' }]); // gap + down
        plat(18, 0.4, [
          { x: 7.4, kind: 'brazier' },
          { x: 13, kind: 'cp' },
        ]); // step down
        gap(3.0); // old reed mats between two arches
        plat(5, 0.4);
        gap(1.8);
        boards(6, 0.4);
        gap(1.8);
        plat(5, 0.4);
        gap(2.4);
        plat(19, 0.6, [{ x: 8.5, kind: 'oranges' }]);
        gap(2.4); // the souk: awning to awning, then up onto the walls
        awning(4.5, -0.6);
        gap(4.2);
        awning(5.5, -0.6);
        gap(2.2);
        plat(22, 1.6, [{ x: 13, kind: 'peppers' }]);
        plat(16, 0.8, [{ x: 9.5, kind: 'jar' }]); // step down
        gap(3.6);
        plat(18, 0.5, [
          { x: 7, kind: 'carpet' },
          { x: 13.5, kind: 'cp' },
        ]);
        gap(1.8); // the old mats again: hop, hop, hop
        boards(6, 0.5);
        gap(1.8);
        boards(6, 0.5);
        gap(2.0);
        plat(18, 0.5, [{ x: 11, kind: 'fanous' }]);
        plat(4.5, 1.0); // up the steps: hop, hop, hop
        plat(4.5, 1.5);
        plat(19, 2.0, [{ x: 10.5, kind: 'cage' }]); // a high tower
        gap(2.2); // down to an awning and back up onto the tallest
        awning(4.5, 0.2);
        gap(2.6);
        plat(21, 2.6, [{ x: 11, kind: 'brazier' }]);
        gap(3.8);
        plat(16, 1.6, [{ x: 9.5, kind: 'peppers' }]); // gap + down
        plat(17, 0.4, [
          { x: 7.4, kind: 'rugs' },
          { x: 9.0, kind: 'oranges' },
        ]); // step down; one jump clears both
        gap(4.0);
        plat(21, 0.4, [
          { x: 6, kind: 'cp' },
          { x: 13, kind: 'fanous' },
        ]);
        plat(19, 1.0, [{ x: 9.5, kind: 'brazier' }]); // wall
        boards(6, 1.0); // mats, then a gap: leave them early
        gap(1.6);
        plat(18, 0.6, [{ x: 11.5, kind: 'carpet' }]);
        gap(2.4); // the last market: awning to awning
        awning(4.5, -0.4);
        gap(4.6);
        awning(6.5, -0.4);
        gap(2.4);
        plat(24, 1.4, [{ x: 13.5, kind: 'cage' }]);
        gap(4.2);
        plat(30, 0, [{ x: 9, kind: 'fanous' }]); // home stretch; home sits 14u in
      }),
  },
  {
    id: 7,
    numeral: 'VII',
    name: 'the night train',
    blurb: 'a circus train, a full moon, and the country rushing by',
    theme: 'train',
    seed: 70719,
    baseSpeed: 9.0,
    speedGain: 2.4,
    goalOffset: 14,
    extraSparks: [
      { x: 9, y: 0.6 },
      { x: 10.4, y: 0.6 },
      { x: 11.8, y: 0.6 },
      { x: 16.0, y: 0.3 },
    ],
    // Platforms that touch are one car of the train; the gaps are the couplings.
    // A lone short platform is a little wheeled wagon riding on a flatcar, a tall
    // one the elephant car; old boards are planks over an open wagon, and the
    // trampolines (awnings, to the engine) stand on flatcars.
    layout: () =>
      make((plat, gap, boards, tramp) => {
        plat(24, 0); // the first coach: nothing but the walk, a cat on a tub and the sparks
        gap(2.6);
        plat(13, 0, [{ x: 5.8, kind: 'pedestal' }]); // low enough for a quick hop
        gap(2.8);
        plat(5.5, 0.3); // little wagons on flatcars: hop, hop, hop
        gap(2.4);
        plat(5.5, -0.1);
        gap(2.4);
        plat(5.5, 0.3);
        gap(2.6);
        plat(18, 0.2, [{ x: 9, kind: 'bunting' }]); // bunting strung over the roof: slide under
        plat(18, 1.0, [{ x: 9.5, kind: 'trunk' }]); // wall
        gap(2.2); // the first trampoline: drop onto it and it throws you up onto the elephant car
        tramp(4.5, -0.4);
        gap(2.3);
        plat(21, 1.9, [{ x: 12, kind: 'drum' }]);
        gap(3.6);
        plat(15, 1.2, [{ x: 9, kind: 'bulbs' }]); // gap + down
        plat(18, 0.4, [
          { x: 7.4, kind: 'ball' },
          { x: 13, kind: 'cp' },
        ]); // step down
        gap(3.0); // planks over an open wagon, between two little wagons
        plat(5, 0.4);
        gap(1.8);
        boards(6, 0.4);
        gap(1.8);
        plat(5, 0.4);
        gap(2.4);
        plat(19, 0.6, [{ x: 8.5, kind: 'cannon' }]);
        gap(2.4); // two trampolines: one to the other, then up
        tramp(4.5, -0.6);
        gap(4.2);
        tramp(5.5, -0.6);
        gap(2.2);
        plat(22, 1.6, [{ x: 13, kind: 'trapeze' }]);
        plat(16, 0.8, [{ x: 9.5, kind: 'pedestal' }]); // step down
        gap(3.3);
        plat(18, 0.5, [
          { x: 7, kind: 'bunting' },
          { x: 13.5, kind: 'cp' },
        ]);
        gap(1.8); // the open wagons again: hop, hop, hop
        boards(6, 0.5);
        gap(1.8);
        boards(6, 0.5);
        gap(2.0);
        plat(18, 0.5, [{ x: 11, kind: 'bulbs' }]);
        plat(4.5, 1.0); // up the steps: hop, hop, hop
        plat(4.5, 1.5);
        plat(19, 2.0, [{ x: 10.5, kind: 'drum' }]); // a tall car
        gap(2.2); // down to a trampoline and back up onto the tallest
        tramp(4.5, 0.2);
        gap(2.6);
        plat(21, 2.6, [{ x: 11, kind: 'cannon' }]);
        gap(3.8);
        plat(16, 1.6, [{ x: 9.5, kind: 'trapeze' }]); // gap + down
        plat(17, 0.4, [
          { x: 7.4, kind: 'pedestal' },
          { x: 9.0, kind: 'trunk' },
        ]); // step down; one jump clears both
        gap(4.0);
        plat(21, 0.4, [
          { x: 6, kind: 'cp' },
          { x: 13, kind: 'bulbs' },
        ]);
        plat(19, 1.0, [{ x: 9.5, kind: 'ball' }]); // wall
        boards(6, 1.0); // planks, then a gap: leave them early
        gap(1.6);
        plat(18, 0.6, [{ x: 11.5, kind: 'trapeze' }]);
        gap(2.4); // the last trampolines: one to the other
        tramp(4.5, -0.4);
        gap(4.6);
        tramp(6.5, -0.4);
        gap(2.4);
        plat(24, 1.4, [{ x: 13.5, kind: 'trunk' }]);
        gap(3.0);
        plat(5.5, 0.4); // the last little wagons, long enough for a full jump at this speed
        gap(2.6);
        plat(6, 0.8);
        gap(2.6);
        plat(16, 0.4, [{ x: 7.5, kind: 'drum' }]);
        gap(4.0);
        plat(28, 0, [{ x: 9, kind: 'bunting' }]); // home: the family's coach; home sits 14u in
      }),
  },
];

export function stageById(id) {
  return STAGES.find((s) => s.id === id) || STAGES[0];
}
