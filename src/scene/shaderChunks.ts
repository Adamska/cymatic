import { ShaderChunk } from 'three'
import shapeOrganism from '../shaders/shapeOrganism.glsl?raw'
import simplexNoise from '../shaders/simplexNoise.glsl?raw'

/** Registers the shared GLSL chunks; imported by every material that includes them. */
Object.assign(ShaderChunk, {
  cymatic_simplex: simplexNoise,
  cymatic_shape_organism: shapeOrganism,
})
