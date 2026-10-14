# Night Cat

A moody 3D side-scrolling auto-runner. A cat runs through the night — along the walls of a
rain-slicked street, then over a lake to a mountain shrine — and the screen never stops.
Two verbs: jump and slide.

Built with [three.js](https://threejs.org) and [Vite](https://vite.dev). No art assets —
the cat, the stages, the textures and the sound are all generated in code. Plays on
desktop, phones and tablets.

## Play

```sh
npm install
npm run dev        # http://localhost:5173
```

`npm run build` writes a static site to `dist/` (relative paths, so it can be hosted
from any sub-path, e.g. GitHub Pages). `npm run preview` serves that build.

### Controls

| Input                                            | Action                                        |
| ------------------------------------------------ | --------------------------------------------- |
| `Space` / `↑` / `W` / click / tap (right side)   | jump — **hold** for a higher, longer jump     |
| `↓` / `S` / `Shift` / right-click / hold (left third) | slide under hanging things; in the air: dive |
| `P` / `Esc`                                      | pause                                         |
| `R`                                              | restart the stage                             |
| `M` / the corner button                          | mute / unmute                                 |
| `G` / the corner button                          | simple graphics (no post-processing) — use it if the screen ever goes black |

Jump buffering (press slightly before landing) and coyote time (press slightly after
running off an edge) are built in, and a landing that just barely misses a ledge still
counts. A cat always finds the ledge. Hanging things (washing lines, signs, ropes, low
branches) only block what you can see: slide under them, or clear them with a high jump.

### The stages

- **I · a night on the walls** — brick walls and rooftops along a street in the rain. Crates,
  bins, planters and signboards to jump. Jump only — nothing to slide under yet.
- **II · the shrine path** — moss walls and footbridges over a still lake on the way to a
  mountain shrine. Rocks, fences, fox statues and offering boxes to jump; shimenawa ropes
  under torii gates and low maple branches to slide under. Faster.

Each stage has lanterns that act as **checkpoints** — stumble, and you can continue from
the last lantern. Collect the floating **sparks** on the way. Clearing a stage gives a rank
(S: no stumbles and every spark · A: no stumbles · B: ≤2 stumbles · C), and bests are
remembered on the stage select.

## How it is made

```
src/
  main.js          bootstrap
  game.js          flow (title → select → ready → run → dead | clear), physics, camera, stage loading
  stages.js        stage layouts (platforms, gaps, obstacles, checkpoints)
  level.js         generic stage builder + collision data + checkpoints
  world.js         shared engine: light pool, sky, sparks, dust, post-processing
  themes/street.js stage I dressing: buildings, lamps, lanterns, rain, obstacles
  themes/shrine.js stage II dressing: water, mountains, trees, torii, stone lanterns, mist,
                   fireflies, falling leaves, obstacles
  cat.js           procedural cat (primitives) + procedural animation
  textures.js      canvas-generated textures (brick, moss stone, bark, asphalt, windows,
                   water normals, glow, mist, leaf)
  input.js         keyboard + pointer/touch input
  audio.js         WebAudio synth: rain or mountain-night ambience, one-shot effects
  ui.js            DOM overlays (title, stage select, HUD, pause, game over, stage clear)
  save.js          localStorage records
```

- **Lighting.** Physically-based materials; a cool moon directional light whose shadow
  frustum follows the cat; a pool of real point lights handed each frame to the fixtures
  nearest the cat (street lamps, paper lanterns, stone lanterns, lit windows, checkpoints);
  hemisphere ambient; fog; HDR bloom so lamp glass, lanterns, windows and the cat's eyes
  bloom; a soft vignette and grain. Stage I adds fake-volumetric light cones under the lamps;
  stage II adds planar water reflections (three's `Water`) so the moon, lanterns and torii
  reflect in the lake.
- **Cat animation.** Fully procedural: a rotary-gallop run cycle, stretch/reach poses in the
  air blended by vertical velocity, a dive pose, a belly-down slide, landing squash and
  takeoff stretch, idle breathing and looking around, a sitting pose for the ending, a tail
  that follows a travelling wave, blinking, and a bell on the collar.
- **Physics.** Deterministic 120 Hz fixed step. Variable jump height by releasing early.
  Hit slow-motion and camera shake, landing dust, and a field of view that widens with speed.
- **Mobile.** Touch zones (left third slides, the rest jumps), a camera that keeps a constant
  horizontal field of view so portrait phones still see ahead, safe-area-aware HUD, a quality
  tier for phones (lower pixel ratio, half-resolution bloom, smaller reflection texture, fewer
  particles) and adaptive resolution if the frame rate drops. Landscape plays best.

### Debug

- Append `?auto` to the URL for an autopilot that plays the stage by itself; `?stage=2`
  starts on a given stage.
- `window.__catwalk.simulate(stageId)` in the console runs the autopilot through a stage
  without rendering and returns where it ended up (used to verify every stage is completable).
