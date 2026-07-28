// Hash déterministe à partir de la position écran et de uSeed (stable par
// instance) — même pixel, même image, même bruit d'une frame à l'autre.
float grain_hash(vec2 coord, float seed) {
  vec3 p = fract(vec3(coord.xyx) * 0.1031 + seed);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

vec4 ulab_main(vec4 src, vec2 uv) {
  float amount = clamp(u_amount, 0.0, 100.0) / 100.0;

  // À intensité 0, sortie identique bit pour bit à l'entrée : sortie
  // anticipée, aucun calcul flottant sur `src` en aval.
  if (amount <= 0.0) {
    return src;
  }

  float n = grain_hash(gl_FragCoord.xy, uSeed) - 0.5; // bruit -0.5..0.5
  vec3 grained = clamp(src.rgb + n * amount, 0.0, 1.0);
  return vec4(grained, src.a);
}
