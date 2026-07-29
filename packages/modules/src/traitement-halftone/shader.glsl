// Distance signée approchée au bord de la forme, dans l'espace normalisé de
// la cellule (nd = 0 au centre de la marque, |nd| = 1 à son rayon de base).
// Négative dedans, positive dehors — jamais lue comme un booléen : c'est
// l'entrée du smoothstep plus bas, pas un seuil dur.
float halftone_shapeDistance(vec2 nd, int shape) {
  if (shape == 1) {
    // carré
    return max(abs(nd.x), abs(nd.y)) - 1.0;
  }
  if (shape == 2) {
    // losange
    return abs(nd.x) + abs(nd.y) - 1.0;
  }
  if (shape == 3) {
    // ligne — trame de Meisenbach : des lignes parallèles d'épaisseur
    // variable, pas des points alignés. Seule la distance perpendiculaire à
    // l'axe de la cellule (nd.y) compte ; l'épaisseur du trait suit l'encre
    // comme le rayon du point suit l'encre pour un rond, nd.x est ignoré.
    return abs(nd.y) - 1.0;
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

  // 'cellSize' est un paramètre en pixels DOCUMENT (ETAPE-2.md §3.7) : jamais
  // utilisé brut, toujours mis à l'échelle du rendu courant par uScale.
  float cellSize = max(u_cellSize * uScale, 1.0);
  vec2 cell = floor(rotated / cellSize);
  vec2 cellCenter = (cell + 0.5) * cellSize;

  // Luminance de la cellule, ramenée dans l'espace non tourné de la texture source.
  vec2 samplePixel = invRot * cellCenter;
  vec3 cellColor = texture(uSource, samplePixel / uResolution).rgb;
  float luma = dot(cellColor, vec3(0.2126, 0.7152, 0.0722));
  if (u_invert) luma = 1.0 - luma;
  float ink = clamp(1.0 - luma, 0.0, 1.0);

  float halfCell = cellSize * 0.5;
  float maxRadius = halfCell * (clamp(u_dotSize, 0.0, 200.0) / 100.0);
  float baseRadius = min(ink * maxRadius, 0.8 * cellSize);

  vec2 delta = rotated - cellCenter;
  vec2 nd = delta / max(baseRadius, 1e-4);

  float dist = halftone_shapeDistance(nd, u_shape);

  // Lissage du bord de la forme en smoothstep, jamais en seuil dur : la
  // largeur de transition suit la dérivée écran de `dist` (fwidth), donc
  // reste d'environ un pixel quelle que soit la résolution de rendu — pas
  // de paramètre de netteté séparé à régler. Elle absorbe aussi le cas
  // d'une encre nulle : `baseRadius` tend vers 0, `dist` devient très
  // positif, la couverture s'annule sans seuil de point minimum séparé.
  float edge = max(fwidth(dist), 1e-4);
  float coverage = 1.0 - smoothstep(-edge, edge, dist);

  // Palette 'aucune' (u_palette_count == 0) : ulab_palette_nearest renvoie
  // sa couleur d'entrée inchangée, donc le noir/blanc du tramage en niveaux
  // de gris reste tel quel — pas de branche spéciale ici (ETAPE-2.md §3.4).
  vec3 paper = ulab_palette_nearest(vec3(1.0), u_palette, u_palette_count);
  vec3 inkColor = ulab_palette_nearest(vec3(0.0), u_palette, u_palette_count);
  return vec4(mix(paper, inkColor, coverage), src.a);
}
