# Night Cat

A moody 3D side-scrolling auto-runner. A cat runs through the night — along the walls of a
rain-slicked street, over a lake to a mountain shrine, across the snowy roofs of a hill town,
over the boats of a fishing harbour on a festival night, through a botanical garden in
spring, over the blue roofs of a desert town, along a circus train crossing the country by
moonlight, then over the roofs of a monastery on the cliffs above a sea of clouds — and the
screen never stops. Two verbs: jump and slide.

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
branches, garlands, bells, drying fish, paper lanterns, wisteria, hanging baskets, wind
chimes, rugs hung out to air, brass lanterns, strings of peppers, bunting, a trapeze, strings
of bulbs, prayer flags, victory banners, a gong) only block what you can see: slide under
them, or clear them with a high jump. Old boards laid across an alley hold for a moment after
you land on them, then give way: jump off them in time. The striped awnings of market stalls
(and the circus train's trampolines) throw the cat high the moment it lands on them — no need
to jump. In the gorges of the cloud monastery the wind blows up out of the clouds: jump into
it (or just run off the edge) and it carries the cat up and over to the far side, however it
went in; dive to drop out of it.

### The stages

- **I · a night on the walls** — brick walls and rooftops along a street in the rain. Crates,
  bins, planters and signboards to jump. Jump only — nothing to slide under yet.
- **II · the shrine path** — moss walls and footbridges over a still lake on the way to a
  mountain shrine. Rocks, fences, fox statues and offering boxes to jump; shimenawa ropes
  under torii gates and low maple branches to slide under. Faster.
- **III · the first snow** — along the ridges of steep snowy roofs in a hill town under the
  northern lights. Chimneys, stovepipes, woodpiles, snowdrifts and a snowman to jump; fir
  garlands and a hanging bell (it rings as you pass) to slide under; and old boards across
  the alleys that give way under you — sometimes in a row, hop by hop. Higher walls,
  longer gaps, faster still, three lanterns.
- **IV · the harbour lights** — a fishing harbour on a summer festival night: stone quays,
  the decks of moored fishing boats and the roofs of the fish sheds, with steps up to the
  highest. Fish boxes, herring barrels, lobster pots, bollards and heaps of net to jump; fish
  hung out to dry and strings of paper lanterns to slide under; old jetty planks that give
  way. Harbour cats watch from the quays and the boats, fireworks burst over the bay, a
  lighthouse sweeps the water, and a friend waits at home with a bowl of fish. Three
  lanterns.
- **V · the glass garden** — a botanical garden on a spring night: brick terrace walls,
  clipped hedges to hop across, and the glass ridges of glowing glasshouses, up a terrace of
  them to the tallest. Watering cans, stacks of flowerpots, wheelbarrows, a gnome, bird baths
  and roof vents to jump; wisteria, hanging baskets and wind chimes (they ring as you pass)
  to slide under; old plank bridges over the beds that give way. Behind it, a lily pond full
  of moon with frogs that plop into the water as you run by, blossom petals drifting, and a
  palm house glowing across the water. Cats nap in flowerpots and on the hedges, a kitten
  bats at a moth, and at home a family waits. Three lanterns.
- **VI · the blue city** — the flat roofs at the top of a blue-washed desert town on a summer
  night, arches over the alleys, and the earth towers of the old walls. Water jars, rolled
  rugs, birdcages, braziers and crates of oranges to jump; rugs hung out to air, brass
  lanterns (they clink as you pass) and strings of peppers to slide under; old reed mats that
  give way; and the striped awnings of the market stalls down in the alleys, which throw you
  up onto the towers — once from awning to awning across the souk. Behind it the town falls
  away to a palm grove and the dunes, a caravan crossing them with a lantern, a kasbah on the
  ridge, the Milky Way and a thin moon overhead, and now and then a shooting star. Doves
  doze on the parapets and take off as you run by, cats keep watch from the roofs, and at
  home a family waits by a dish of sardines. Three lanterns.
- **VII · the night train** — along the roofs of a circus train crossing the country under a
  full moon: painted wagons strung with marquee bulbs, the elephant car (the elephant has its
  trunk out of the window), the lion's cage, sleeping coaches, little wheeled wagons riding on
  flatcars. Star tubs, steamer trunks, drums, striped balls and a clown's cannon to jump;
  bunting, a trapeze and strings of bulbs to slide under; planks over open wagons that give
  way; trampolines on the flatcars that throw you up onto the tall cars. The country rushes
  by — telegraph poles, fields and haystacks, a farm, a windmill, a village on the hills — a
  station and level crossings sweep past, two tunnels put the moon out, and the engine's smoke
  streams back over the train. At the front, by the engine, a family waits on a blanket. A
  long night, three lanterns.
- **VIII · the cloud monastery** — along the flat roofs of a monastery on the cliffs above a
  sea of clouds, under a big moon over the snow peaks: whitewashed walls under the dark red
  band with its gilt mirrors, black-framed windows lit by butter lamps, towers with gilt
  roofs, rock pinnacles standing up out of the clouds. Mani stones, prayer wheels (they spin
  as you jump them), copper pots, incense burners and little chortens to jump; prayer flags,
  victory banners and a gong (it rings as you pass) to slide under; what is left of old rope
  bridges, their planks giving way; and the gorges between the cliffs, where the wind blows
  up out of the clouds and carries you over — once gorge, pinnacle, gorge — paper prayer
  horses whirling up with you. Lightning flickers down in the clouds, more of the monastery
  stands on the far pinnacles with flags strung between them, a snow leopard watches from a
  crag, monastery cats doze on the roofs, and at the great hall a family waits by the lamps
  with a bowl of milk. The fastest and longest night, three lanterns.

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
  themes/snow.js   stage III dressing: pitched snowy roofs with icicles, windows and
                   skylights, old boards, the town behind (merged into a few draw calls),
                   pine hills, a clock tower, alley lanterns, chimney smoke, snowfall,
                   the northern lights, obstacles
  themes/harbour.js stage IV dressing: stone quays, procedural boat hulls, fish sheds,
                   jetty planks, the harbour cats, the town across the bay, moored boats,
                   floating lanterns, a lighthouse, fireworks, obstacles
  themes/garden.js stage V dressing: terrace walls, clipped hedges, glasshouses (glass over a
                   painted, glowing interior), plank bridges, the lily pond and its frogs
                   (only what lies behind it is drawn into its mirror), blossom trees and
                   petals, the palm house, glow-worms, moths, obstacles
  themes/city.js   stage VI dressing: rows of limewashed houses (windows, shutters, doors,
                   rugs over the parapets), arches over the alleys, earth towers, market
                   stalls under springy awnings, reed mats, the town down the hill (merged
                   into a few draw calls per row), palms, dunes, a kasbah, a caravan, the
                   Milky Way, shooting stars, doves, obstacles
  themes/train.js  stage VII dressing: circus cars (painted wagons, cage, elephant car, coaches,
                   wagons on flatcars, open wagons, trampolines), wheels that turn, marquee
                   bulbs, the country in strips that repeat and slide past, a station, level
                   crossings and tunnels sweeping by, engine smoke and embers, the engine
  themes/monastery.js stage VIII dressing: whitewashed buildings on their cliffs (the kemar band,
                   rafter ends, Tibetan windows), towers with gilt pavilions, the monastery
                   climbing the cliff behind, rock pinnacles, rope bridges, the gorges (tall
                   flags, flags strung across, paper prayer horses and cloud blown up them),
                   a sea of clouds (one shader-drawn sheet, billows, lightning inside it),
                   snow peaks, far pinnacles with monasteries, prayer wheels that turn,
                   fluttering flags (a vertex shader), the great hall, obstacles
  themes/cats.js   the cats in the scenery of stages IV to VIII (and a snow leopard)
  cat.js           procedural cat (primitives) + procedural animation
  textures.js      canvas-generated textures (brick, moss stone, bark, asphalt, windows,
                   water normals, glow, mist, leaf, snow, plaster, roof tiles, aurora,
                   quay granite, painted boards, lighthouse beam, hedge, lawn, gravel,
                   blossom petal, a glasshouse's palms-and-lamplight interior, limewash,
                   striped awning canvas, rugs, pierced brass, sand, zellige, arched windows,
                   a studded door, reed matting, the Milky Way, circus wagon panels, spoked
                   wheels, stars, fields, an enamel station sign, the kemar band with its
                   mirrors, Tibetan windows, the block print on a prayer flag)
  input.js         keyboard + pointer/touch input
  audio.js         WebAudio synth: rain, mountain-night, winter-wind (with a distant church
                   bell), harbour (water against the quays, rigging on the masts) or garden
                   ambience (a breeze, frogs, now and then a nightingale) or desert-town
                   ambience (a warm wind, crickets, now and then an oud down in the town) or
                   the night train (its rumble, louder in tunnels, wheels clacking over the
                   rail joints, a whistle far ahead) or the monastery (wind on the heights,
                   the long horns far off, a hand bell, flags snapping), fireworks, wind
                   chimes, a crossing bell, a gong, gusts, distant thunder, one-shot effects
  ui.js            DOM overlays (title, stage select, HUD, pause, game over, stage clear)
  save.js          localStorage records
```

- **Lighting.** Physically-based materials; a cool moon directional light whose shadow
  frustum follows the cat; a pool of real point lights handed each frame to the fixtures
  nearest the cat (street lamps, paper lanterns, stone lanterns, lit windows, checkpoints);
  hemisphere ambient; fog; HDR bloom so lamp glass, lanterns, windows and the cat's eyes
  bloom; a soft vignette and grain. Stage II adds planar water reflections (three's `Water`)
  so the moon, lanterns and torii reflect in the lake. Stage III hangs drifting curtains of
  aurora behind the mountains, and lanterns in the alleys light the snow the cat jumps over.
  Stage IV sets fireworks over the bay — shells aimed into the camera's view that burst,
  flash, light the harbour for a moment and boom a little later, doubled in the water —
  and a lighthouse beam sweeping round. Stage V's glasshouses are glass over a painted
  interior of palms and lamplight that glows from within, and the palm house across the
  lily pond is doubled in the water. Stage VI turns the moon to a thin crescent (with
  earthshine on the dark side), lays the Milky Way across the sky over the dunes and sends
  shooting stars across it — a shower of them when the cat gets home. In stage VII the train
  stands still and the country moves: the scenery is built in strips that repeat and slide
  back at the train's speed (the far hills cheated slower, as if much further off), and a
  tunnel dims the moon, the sky and the fog as it passes over. Stage VIII lays a sea of
  clouds under everything — one sheet that follows the camera, its billows and dark hollows
  drawn by noise in world space, lit from the moon's side, the moon's path across it — with
  lightning flickering inside it now and then (and thunder a moment later), and prayer flags
  that flutter in a vertex shader.
- **Scenery cats.** Simpler cats than the hero, built from a handful of primitives, sitting,
  asleep or peeking out of a flowerpot or a water jar: awake ones turn their heads to watch
  the night cat go by (and otherwise the view) and flick their tails, a kitten bats at a
  moth, sleeping ones breathe.
- **Cat animation.** Fully procedural: a rotary-gallop run cycle, stretch/reach poses in the
  air blended by vertical velocity, a dive pose, a belly-down slide, landing squash and
  takeoff stretch, idle breathing and looking around, a sitting pose for the ending, a tail
  that follows a travelling wave, blinking, and a bell on the collar.
- **Physics.** Deterministic 120 Hz fixed step. Variable jump height by releasing early.
  Hit slow-motion and camera shake, landing dust, and a field of view that widens with speed.
  Old boards start a short countdown when first stood on (they sag and tremble meanwhile),
  then drop piece by piece into the alley. Awnings throw the cat up at a fixed speed the
  moment it lands on them (letting go of jump doesn't cut the throw short); the canvas sags
  and springs back. Stage VII's trampolines are the same thing. Over a gorge with the wind in
  it the cat's vertical speed is pulled towards the wind's — up below the float height, a
  gentle sink above it — hard enough to catch a cat already falling, so it crosses from any
  jump (or none) and the camera rises with it.
- **Mobile.** Touch zones (left third slides, the rest jumps), a camera that keeps a constant
  horizontal field of view so portrait phones still see ahead, safe-area-aware HUD, a quality
  tier for phones (lower pixel ratio, half-resolution bloom, smaller reflection texture, fewer
  particles) and adaptive resolution if the frame rate drops. Landscape plays best.

### Debug

- Append `?auto` to the URL for an autopilot that plays the stage by itself; `?stage=3`
  starts on a given stage.
- `window.__catwalk.simulate(stageId)` in the console runs the autopilot through a stage
  without rendering and returns where it ended up (used to verify every stage is completable).
