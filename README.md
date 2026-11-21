# Cymatic

An interactive spatial audio and optical light laboratory. A displaced glass sculpture sits inside a three-point light rig and reacts to sound in real time, while an AI scene director turns a sentence into a complete lighting cue and synthesizer patch.

**Live demo: [cymatic-ten.vercel.app](https://cymatic-ten.vercel.app/)**

![Cymatic rendering the Violet Nebula cue](<img width="640" height="400" alt="cymatic-demo" src="https://github.com/user-attachments/assets/20f3c3ad-eaa5-425a-b0a6-9f6da5dfb6fe" />)

## Highlights

- **One click to sound and light.** `[ ENGAGE ENGINE ]` starts a procedural ambient synthesizer: sub-bass drone, detuned saw pads, an LFO-swept resonant low-pass filter, a pulsing sub envelope and a convolution reverb. No assets are downloaded.
- **Any source.** Pick one of the two bundled sample tracks from the `File` menu, drop an MP3, WAV or OGG anywhere on the page, or switch to the live microphone. The microphone feeds the analyser only and is never routed to the speakers.
- **Custom optics.** The sculpture is a single `ShaderMaterial`. The vertex stage displaces a welded icosphere with curl-warped simplex noise and rebuilds normals by finite differences. Bass swells the whole form into broad lobes, mids twist it into spiralling folds and highs raise sharp, fast ripples, each through a spring with its own weight and inertia, so the form carries momentum after the sound stops. Kicks punch the swell, hi-hats flick the ripples and any sudden jump in loudness gives the whole form a short impulse before it settles back within a second. The live spectrum is also wrapped around the surface by latitude, low frequencies at the equator and highs toward the poles, and each lifted band glows in its own palette color. A slow leveller shared by every band brings a quiet microphone up to the range of a mastered track while keeping the balance between lows and highs and the difference between soft and loud passages, and a tracked noise floor keeps room hiss from moving the form. The fragment stage combines Inigo Quilez cosine palettes, thin-film interference, wrapped diffuse lighting, back-scattered translucency and reflections of an animated Lightformer studio.
- **AI scene director.** Describe a light and a sound in the command bar, and a Zod-validated `SceneDirective` drives the palette, lights, bloom, turbulence and synth patch. Every parameter glides to its new value.
- **Never offline.** Without an `OPENAI_API_KEY`, or when the endpoint is unreachable, prompts are resolved by a deterministic semantic matcher that scores, blends and modifies a library of hand-tuned cues.

## Quick start

```bash
npm install
npm run dev
```

Open the printed URL and press `[ ENGAGE ENGINE ]`. The app is fully functional without any configuration.

To enable the language model, copy `.env.example` to `.env` and set a key:

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
```

`OPENAI_MODEL` is optional and accepts any OpenAI model with structured output support. The dev server mounts `api/direct.ts` at `/api/direct`, so the same handler runs locally and in production.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server with the director endpoint |
| `npm run typecheck` | `tsc --noEmit` in strict mode |
| `npm run build` | Type-check and produce a production bundle in `dist/` |
| `npm run preview` | Serve the production bundle |

## Architecture

```
api/
  direct.ts                 Edge handler: structured LLM output, preset fallback
src/
  audio/
    AudioEngine.ts          Audio graph, sources, analyser, lifecycle
    AmbientSynth.ts         Procedural synthesizer voice graph
    BandTracker.ts          Band energies in decibels, shared leveller, noise floors, kick and hi-hat onsets
    SpectrumGate.ts         Leveled, noise-gated byte spectrum for the visuals
    sampleTracks.ts         Bundled sample tracks offered in the file menu
  shaders/
    opticalCore.vert        Three-octave simplex displacement (lobes, folds, ripples), finite-difference normals
    opticalCore.frag        Cosine palette, thin film, scattering, light rig, reflections
    atmosphere.vert|frag    Backdrop gradient and volumetric halo
  scene/
    Stage.tsx               Canvas, frame driver, camera controls
    SculptureCore.tsx       Displaced mesh and shader uniforms
    OrbitalParticles.tsx    Instanced particles mapped to FFT bins
    LightingRig.tsx         Spot and point lights, animated Lightformer environment
    PostProcessingStack.tsx HDR bloom, chromatic aberration, tone mapping, vignette, grain
    sceneState.ts           Mutable target and live scene values with damping
    motionState.ts          Inertial response per band: springs, sustain, drift and spin
    spectrumField.ts        Smoothed log-frequency spectrum texture mapped onto the sculpture
  ai/
    directiveSchema.ts      SceneDirectiveSchema and parameter ranges
    presets.ts              Hand-tuned directives, keywords and prompt chips
    semanticMatcher.ts      Offline prompt resolution
    directiveMath.ts        Blending and clamping of directives
    directorInstructions.ts System instructions for the model
    sceneDirector.ts        Client: endpoint first, matcher on any failure
  store/
    useStudioStore.ts       Zustand store for UI state and the active directive
  hooks/                    Directive bridge and drag-and-drop
  components/hud/           Glass HUD: command bar, light controls, spectrum, source switch, track menu
public/
  tracks/                   Sample MP3s served as static assets
```

### Data flow

```
prompt -> /api/direct -> SceneDirective -> Zustand store
                                             |-> sceneState target -> damped every frame -> uniforms, lights, effects
                                             '-> AudioEngine.applyPatch -> AudioParam glides

audio source -> AnalyserNode -> BandTracker -> lights, particles, effects
                                   '-> motionState (springs, sustain, momentum) -> displacement, drift, spin
```

React state changes only when the user acts. The render loop never touches React or Zustand: `Stage` advances the audio analysis and scene damping once per frame, and every `useFrame` callback reads those mutable values directly. The spectrum canvas runs its own `requestAnimationFrame` loop on the same analyser data.

### Scene directive

| Group | Fields |
| --- | --- |
| `palette` | `offset`, `amplitude`, `frequency`, `phase` vectors for `a + b * cos(2 * PI * (c * t + d))` |
| `lights` | `key`, `fill`, `rim` colors and overall `intensity` |
| `optics` | `bloom`, `turbulence`, `displacement`, `flow`, `iridescence`, `aberration` |
| `synth` | `rootHz`, `intervals`, `filterCutoff`, `resonance`, `lfoRate`, `subLevel` |

The same schema validates model output on the server, the response on the client, and defines the slider ranges in the HUD.

## Deployment

The project deploys to Vercel without configuration: Vite builds the client and `api/direct.ts` becomes an Edge Function. Add `OPENAI_API_KEY` in the project settings to enable the model. Without it the endpoint answers from the preset library, and on a static host with no endpoint at all the client falls back to the same matcher.

## License

[MIT](LICENSE)
