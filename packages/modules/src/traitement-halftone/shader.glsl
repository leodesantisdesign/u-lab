// Deux hash 2D→2D et 2D→1D, déterministes, pour la gigue par cellule.
// `uSeed` (stable par instance) les décorrèle d'un module à l'autre sans
// changer le motif d'une frame à l'autre.
vec2 halftone_hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453123);
}

float halftone_hash1(vec2 p) {
  return fract(sin(dot(p, vec2(41.0, 289.0))) * 43758.5453123);
}

// Distance signée approchée au bord de la forme, dans l'espace normalisé de
// la cellule (nd = 0 au centre du point, |nd| = 1 à son rayon de base).
// Négative dedans, positive dehors — jamais lue comme un booléen : c'est
// l'entrée du smoothstep plus bas, pas un seuil dur.
float halftone_shapeDistance(vec2 nd, int shape, float roundness01) {
  if (shape == 1) {
    // carré
    return max(abs(nd.x), abs(nd.y)) - 1.0;
  }
  if (shape == 2) {
    // carré arrondi : superellipse, roundness 0 -> presque carré, 1 -> presque rond
    float n = 2.0 + (1.0 - clamp(roundness01, 0.0, 1.0)) * 28.0;
    return pow(abs(nd.x), n) + pow(abs(nd.y), n) - 1.0;
  }
  // rond
  return length(nd) - 1.0;
}

vec4 ulab_main(vec4 src, vec2 uv) {
  vec2 pixelCoord = uv * uResolution;

  // Rotation de la grille de trame — l'angle d'impression classique.
  float angle = radians(u_angle);
  float ca = cos(angle);
  float sa = sin(angle);
  mat2 rot = mat2(ca, sa, -sa, ca);
  mat2 invRot = mat2(ca, -sa, sa, ca); // rot est orthonormale : son inverse est sa transposée

  vec2 rotated = rot * pixelCoord;

  float cellSize = max(u_cellSize, 1.0);
  vec2 cell = floor(rotated / cellSize);
  vec2 cellCenterBase = (cell + 0.5) * cellSize;

  // Gigue de position et de rayon, déterministe par cellule.
  float jitter01 = clamp(u_jitter, 0.0, 100.0) / 100.0;
  vec2 jitterRand = halftone_hash2(cell + uSeed * 97.0);
  vec2 cellCenter = cellCenterBase + (jitterRand - 0.5) * jitter01 * cellSize;
  float radiusJitter = 1.0 + (halftone_hash1(cell * 1.7 + uSeed * 53.0) - 0.5) * 0.35 * jitter01;

  // Luminance de la cellule : un échantillon au centre non giguoté, ramené
  // dans l'espace non tourné de la texture source.
  vec2 samplePixel = invRot * cellCenterBase;
  vec3 cellColor = texture(uSource, samplePixel / uResolution).rgb;
  float luma = dot(cellColor, vec3(0.2126, 0.7152, 0.0722));
  if (u_invert) luma = 1.0 - luma;
  float ink = clamp(1.0 - luma, 0.0, 1.0);

  float halfCell = cellSize * 0.5;
  float maxRadius = halfCell * (clamp(u_dotSize, 0.0, 200.0) / 100.0);
  float minRadius = halfCell * (clamp(u_minDot, 0.0, 100.0) / 100.0);

  float baseRadius = min(ink * maxRadius, 0.8 * cellSize) * radiusJitter;
  // 'active' est un mot réservé en GLSL ES 3.00 (erreur de compilation) :
  // dotActive sous le minimum → pas de point, décision binaire par cellule.
  float dotActive = step(minRadius, baseRadius);

  float stretch01 = clamp(u_stretch, 1.0, 1000.0) / 100.0;
  vec2 delta = rotated - cellCenter;
  vec2 nd = vec2(delta.x / max(baseRadius, 1e-4), delta.y / max(baseRadius * stretch01, 1e-4));

  float dist = halftone_shapeDistance(nd, u_shape, clamp(u_roundness, 0.0, 100.0) / 100.0);

  // Lissage du bord de la forme en smoothstep, jamais en seuil dur : la
  // largeur de transition suit la dérivée écran de `dist` (fwidth), donc
  // reste d'environ un pixel quelle que soit la résolution de rendu — pas
  // de paramètre de netteté séparé à régler.
  float edge = max(fwidth(dist), 1e-4);
  float coverage = (1.0 - smoothstep(-edge, edge, dist)) * dotActive;

  vec3 paper = vec3(1.0);
  vec3 inkColor = vec3(0.0);
  return vec4(mix(paper, inkColor, coverage), src.a);
}
