# Night Cat

A moody 3D side-scrolling auto-runner. A cat runs along the walls and ledges of a
rain-slicked night street; the screen never stops, and all you control is the jump.

Built with [three.js](https://threejs.org) and [Vite](https://vite.dev). No art assets —
the cat, the street, the brick, the lamps and the sound are all generated in code.

## Play

```sh
npm install
npm run dev        # http://localhost:5173
```

`npm run build` writes a static site to `dist/` (relative paths, so it can be hosted
from any sub-path, e.g. GitHub Pages). `npm run preview` serves that build.

### Controls

| Input                                 | Action                                      |
| ------------------------------------- | ------------------------------------------- |
| `Space` / `↑` / `W` / click / tap     | jump — **hold** for a higher, longer jump   |
| `M`                                   | mute / unmute                               |

Jump buffering (press slightly before landing) and coyote time (press slightly after
running off an edge) are built in, and a landing that just barely misses a ledge still
counts. A cat always finds the ledge.

### The stage — "a night on the walls"

One hand-authored stage, ~40 seconds at pace: gaps, step-ups you must jump onto,
crates, bins, planters and signboards. Collect the floating **sparks** on the way.
The run ends at the lit window at the end of the walk — the cat's home.

Lose the walk (fall into the street or stumble into something) and the night goes on:
press to try again from the start.

## How it is made

```
src/
  main.js      bootstrap
  game.js      state machine (title → run → dead | clear), fixed-step physics, camera
  level.js     stage layout, platform/obstacle geometry, collision data
  cat.js       procedural cat (primitives) + procedural animation
  world.js     sky, street, buildings, lamps, lanterns, rain, lights, post-processing
  textures.js  canvas-generated textures (brick, stone, wet asphalt, windows, glow)
  input.js     one-button input (keyboard + pointer)
  audio.js     WebAudio synth: rain/pad ambience and one-shot effects
  ui.js        DOM overlays (title, HUD, game over, stage clear)
```

- **Lighting.** Physically-based materials, a cool moon directional light with a shadow
  frustum that follows the cat, a warm point light in every nearby street lamp and lantern
  (a pool of real lights is reassigned to the fixtures closest to the cat each frame), a
  hemisphere light for the ambient sky/ground bounce, fog for depth, and an HDR bloom pass
  so the lamp glass, lanterns, windows and the cat's eyes bloom. A final pass adds a soft
  vignette and a little grain.
- **Cat animation.** Fully procedural: a rotary-gallop run cycle, stretch/reach poses in the
  air blended by vertical velocity, landing squash, takeoff stretch, idle breathing and
  looking around, a sitting pose for the ending, and a tail that follows a travelling wave.
  Every joint is smoothed toward its target so transitions stay fluid.
- **Physics.** Deterministic 120 Hz fixed step. Variable jump height by releasing early.

### Debug

- Append `?auto` to the URL for an autopilot that plays the stage by itself.
- `window.__catwalk.simulate()` in the console runs the autopilot through the stage
  without rendering and returns where it ended up (used to verify the stage is completable).
