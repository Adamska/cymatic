# Cymatic

An interactive spatial audio and optical light laboratory. A displaced glass sculpture sits inside a three-point light rig and reacts to sound in real time, while an AI scene director turns a sentence into a complete lighting cue and synthesizer patch.

**Live demo: [cymatic-ten.vercel.app](https://cymatic-ten.vercel.app/)**

![Cymatic playing a music file and changing theme](https://github.com/user-attachments/assets/20f3c3ad-eaa5-425a-b0a6-9f6da5dfb6fe)

## Highlights

- **One click to sound and light.** `[ Play a track ]` starts a bundled sample track; `Start the synth` runs a procedural ambient synthesizer instead: sub-bass drone, detuned saw pads, an LFO-swept resonant low-pass filter, a pulsing sub envelope and a convolution reverb.
- **Any source.** Pick a sample track, drop an MP3, WAV or OGG anywhere on the page, use the live microphone, or share another browser tab to visualise whatever it plays. The microphone and shared tabs feed the analyser only and are never routed to the speakers.
- **Playlists.** Paste any public Deezer playlist link to play its 30 second previews back to back.
- **Custom optics.** The sculpture is a single `ShaderMaterial`. The vertex stage displaces a welded icosphere with curl-warped simplex noise and rebuilds normals by finite differences. Bass swells the form into broad lobes, mids twist it into spiralling folds and highs raise sharp, fast ripples, each through a spring with its own weight and inertia. Kicks punch the swell, hi-hats flick the ripples and thin-film shimmer, and any sudden jump in loudness gives the whole form a short impulse before it settles back within a second. A slow leveller shared by every band brings a quiet microphone up to the range of a mastered track, and a tracked noise floor keeps room hiss from moving the form.
- **Cymatics.** Behind the sculpture, glowing sand rests on a vibrating plate. Grains only move while the plate rings: they hop off the antinodes and settle on the nodal lines of a Chladni mode chosen by the spectral centroid, so held notes draw rosettes that morph as the pitch moves.
- **Living camera and light.** The orbit speeds up with the energy of the music and the lens punches in on impacts. Cue changes sweep across the form as a bright wave front, shafts of light stream from an eclipse disc behind it, and a radial blur follows each impulse.
- **Touch the form.** Click the sculpture to strike it like a glass bell: ripples spread from the point of impact and the bell rings on a pentatonic ladder above the drone of the current cue.
- **AI scene director.** Describe a light and a sound in the command bar, and a Zod-validated `SceneDirective` drives the palette, lights, bloom, turbulence and synth patch. Every parameter glides to its new value. Turn on `Auto` and the director changes the cue on its own when the music moves into a new section.
- **Never offline.** Without an `OPENAI_API_KEY`, or when the endpoint is unreachable, prompts are resolved by a deterministic semantic matcher that scores, blends and modifies a library of hand-tuned cues.

## Studio tools

| Tool | What it does |
| --- | --- |
| Recent cues | Colored dots under the title recall any of the last eight cues |
| Morph | Crossfades palette, rig, optics and synth between the two latest cues |
| Link | Copies a URL that reopens the studio on the exact cue on stage |
| Still | Saves a PNG rendered at 2.5x pixel ratio |
| Rec | Records ten seconds of video with sound, MP4 where the browser can encode it |
| MIDI | The first knobs turned map to the light rig dials, keys strike the sculpture, program changes step through cues |
| Zen | The interface fades after a few still seconds and comes back on any movement |

| Key | Action |
| --- | --- |
| `Space` | Play or pause the file |
| `1` `2` `3` `4` | Synth, microphone, file menu, shared tab |
| `Left` `Right` | Previous or next cue |
| `[` `]` | Previous or next playlist track |
| `A` | Auto director |
| `H` | Hide the interface |
| `F` | Fullscreen, for a projector or a second screen |
| `L` `S` `R` | Link, still, video |
| `?` | Shortcut help |

## Quick start

```bash
npm install
npm run dev
```

Open the printed URL and press `[ Play a track ]`. The app is fully functional without any configuration.

To enable the language model, copy `.env.example` to `.env` and set a key:

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
```

`OPENAI_MODEL` is optional and accepts any OpenAI model with structured output support. The dev server mounts every handler in `api/` at the same path as in production.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server with the edge handlers |
| `npm run typecheck` | `tsc --noEmit` in strict mode |
| `npm run build` | Type-check and produce a production bundle in `dist/` |
| `npm run preview` | Serve the production bundle |

## Performance

The studio picks a quality tier from the device (pointer type, cores, memory) and adapts it at runtime with a frame rate monitor. A tier sets the pixel ratio, multisampling, sculpture density (40 to 88 subdivisions), particle and sand counts, depth of field and light shafts. The reflection cube map, the most expensive pass, is captured once every two to six frames instead of every frame. A low battery caps the studio at the lightest tier. The 3D stage downloads while a CSS loading screen is already on screen.

## Architecture

```
api/
  direct.ts                 Edge handler: structured LLM output, preset fallback
  music.ts                  Edge handler: Deezer playlists, signed previews, ISRC and title matching
src/
  audio/
    AudioEngine.ts          Sources (synth, file, microphone, tab), analysis, bell strikes
    audioGraph.ts           Signal chain, limiter and the recording output
    FilePlayer.ts           Buffer playback with pause, seek, position and waveform peaks
    AmbientSynth.ts         Procedural synthesizer voice graph
    bell.ts                 FM glass bell for strikes
    BandTracker.ts          Band energies in decibels, shared leveller, noise floors, onsets
    SpectrumGate.ts         Leveled, noise-gated byte spectrum for the visuals
    sampleTracks.ts         Bundled sample tracks
  shaders/
    opticalCore.vert        Simplex displacement, cue wave and strike ripples, finite-difference normals
    opticalCore.frag        Cosine palette with wave front, thin film, scattering, reflections
    simplexNoise.glsl       Shared noise chunk
    atmosphere.vert|frag    Backdrop gradient and volumetric halo
  scene/
    Stage.tsx               Canvas, frame driver, quality monitor, controls
    SculptureCore.tsx       Displaced mesh, level of detail, strikes
    coreMaterial.ts         Shader material and uniforms
    ChladniPlate.tsx        Vibrating sand plate, chladni.ts holds the plate math
    OrbitalParticles.tsx    Instanced particles mapped to FFT bins
    LightingRig.tsx         Spot and point lights, Lightformer panels
    StudioEnvironment.tsx   Throttled reflection cube map
    PostProcessingStack.tsx Bloom, light shafts, depth of field, impact blur, tone mapping, grain
    StageDirectors.tsx      Audio-reactive camera and frame capture
    quality.ts              Quality tiers and device heuristics
    sceneState.ts           Scene targets, damping and the cue wave
    motionState.ts          Springs, sustain, drift, spin and strikes
  ai/                       Directive schema, presets, matcher, blending, director client
  features/                 Auto director, share links, MIDI and studio actions
  capture/                  Stills and video recording
  music/                    Deezer playlist client
  store/                    Studio, interface and playlist stores
  hooks/                    Shortcuts, studio systems, directive bridge, drag-and-drop
  components/hud/           Glass HUD panels
public/
  tracks/                   Sample MP3s served as static assets
```

### Data flow

```
prompt -> /api/direct -> SceneDirective -> Zustand store
                                             |-> sceneState target -> damped every frame -> uniforms, lights, effects
                                             '-> AudioEngine.applyPatch -> AudioParam glides

audio source -> AnalyserNode -> BandTracker -> lights, particles, sand, camera, effects
                                   '-> motionState (springs, sustain, momentum) -> displacement, drift, spin
```

React state changes only when the user acts. The render loop never touches React or Zustand: `Stage` advances the audio analysis and scene damping once per frame, and every `useFrame` callback reads those mutable values directly. The spectrum canvas and the transport write to the DOM from their own animation loops, and the auto director listens on a slow timer.

### Scene directive

| Group | Fields |
| --- | --- |
| `palette` | `offset`, `amplitude`, `frequency`, `phase` vectors for `a + b * cos(2 * PI * (c * t + d))` |
| `lights` | `key`, `fill`, `rim` colors and overall `intensity` |
| `optics` | `bloom`, `turbulence`, `displacement`, `flow`, `iridescence`, `aberration` |
| `synth` | `rootHz`, `intervals`, `filterCutoff`, `resonance`, `lfoRate`, `subLevel` |

The same schema validates model output on the server, the response on the client, shared links, and defines the slider ranges in the HUD.

## Deployment

The project deploys to Vercel without configuration: Vite builds the client and each file in `api/` becomes an Edge Function. Add `OPENAI_API_KEY` in the project settings to enable the model. Without a key the director answers from the preset library, and on a static host with no endpoint at all the client falls back to the same matcher.

Playlist previews are provided by Deezer.

## License

[MIT](LICENSE)
