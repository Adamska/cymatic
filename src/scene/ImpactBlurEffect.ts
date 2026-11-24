import { Effect, EffectAttribute } from 'postprocessing'
import { Uniform } from 'three'

const fragmentShader = /* glsl */ `
  uniform float strength;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    if (strength < 0.0005) {
      outputColor = inputColor;
      return;
    }
    vec2 toCenter = uv - 0.5;
    vec4 sum = inputColor;
    for (int i = 1; i < 10; i++) {
      sum += texture2D(inputBuffer, uv - toCenter * strength * float(i) / 9.0);
    }
    outputColor = sum / 10.0;
  }
`

/** A short radial zoom blur that reads as motion blur when the form is punched outward. */
export class ImpactBlurEffect extends Effect {
  private readonly strengthUniform: Uniform<number>

  constructor() {
    const strength = new Uniform(0)
    super('ImpactBlurEffect', fragmentShader, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([['strength', strength]]),
    })
    this.strengthUniform = strength
  }

  set strength(value: number) {
    this.strengthUniform.value = value
  }
}
