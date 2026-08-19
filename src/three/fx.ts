import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

export interface GradeUniforms {
  uTime: { value: number };
  uGrain: { value: number };
  uAber: { value: number };
  uVign: { value: number };
  uGlitch: { value: number };
  uFade: { value: number };
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.06 },
    uAber: { value: 0.0012 },
    uVign: { value: 0.42 },
    uGlitch: { value: 0 },
    uFade: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    uniform float uAber;
    uniform float uVign;
    uniform float uGlitch;
    uniform float uFade;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;

      // horizontal slice displacement — the city losing its grip
      float g = uGlitch;
      if (g > 0.002) {
        float band = floor(uv.y * 26.0);
        float t = floor(uTime * 14.0);
        float r = hash(vec2(band, t));
        if (r > 1.0 - g * 0.3) {
          uv.x += (r - 0.5) * g * 0.22;
        }
      }

      vec2 c = uv - 0.5;
      float d = length(c);
      float ab = uAber * (0.35 + d * 2.2);

      vec3 col;
      col.r = texture2D(tDiffuse, uv + c * ab).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c * ab).b;

      // vignette
      col *= 1.0 - uVign * smoothstep(0.32, 0.98, d);

      // animated film grain
      float n = hash(uv * vec2(1917.0, 1013.0) + vec2(uTime * 61.7, uTime * 37.3));
      col += (n - 0.5) * uGrain;

      // faint scan shimmer
      col *= 1.0 - 0.045 * uGrain * 6.0 * sin(uv.y * 720.0 + uTime * 9.0);

      col *= (1.0 - uFade);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export interface FXRig {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  grade: ShaderPass;
  gradeUniforms: GradeUniforms;
}

export function createFX(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): FXRig {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.setSize(size.x, size.y);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.42, 0.55, 0.72);
  composer.addPass(bloom);

  const grade = new ShaderPass(GradeShader);
  grade.uniforms.uFade.value = 1; // open on black
  composer.addPass(grade);

  return { composer, bloom, grade, gradeUniforms: grade.uniforms as unknown as GradeUniforms };
}
