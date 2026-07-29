// Matrices de seuil en constantes GLSL, jamais une texture (§3.1 : un
// module ne déclare aucune ressource propre). Valeurs canoniques du
// tramage ordonné dispersé ("dispersed-dot"), avant normalisation.
const float BAYER_2X2[4] = float[4](
  0.0, 2.0,
  3.0, 1.0
);

const float BAYER_4X4[16] = float[16](
  0.0, 8.0, 2.0, 10.0,
  12.0, 4.0, 14.0, 6.0,
  3.0, 11.0, 1.0, 9.0,
  15.0, 7.0, 13.0, 5.0
);

const float BAYER_8X8[64] = float[64](
  0.0, 32.0, 8.0, 40.0, 2.0, 34.0, 10.0, 42.0,
  48.0, 16.0, 56.0, 24.0, 50.0, 18.0, 58.0, 26.0,
  12.0, 44.0, 4.0, 36.0, 14.0, 46.0, 6.0, 38.0,
  60.0, 28.0, 52.0, 20.0, 62.0, 30.0, 54.0, 22.0,
  3.0, 35.0, 11.0, 43.0, 1.0, 33.0, 9.0, 41.0,
  51.0, 19.0, 59.0, 27.0, 49.0, 17.0, 57.0, 25.0,
  15.0, 47.0, 7.0, 39.0, 13.0, 45.0, 5.0, 37.0,
  63.0, 31.0, 55.0, 23.0, 61.0, 29.0, 53.0, 21.0
);

// Seuil normalisé (0..1, centré au milieu de chaque case) pour le pixel de
// cellule donné — 'matrix' suit l'ordre du enum du manifeste (0 = 2×2,
// 1 = 4×4, 2 = 8×8), un contrat public comme pour 'shape' du halftone.
float bayer_threshold(vec2 cellPixel, int matrix) {
  if (matrix == 0) {
    ivec2 p = ivec2(mod(cellPixel, 2.0));
    return (BAYER_2X2[p.y * 2 + p.x] + 0.5) / 4.0;
  }
  if (matrix == 1) {
    ivec2 p = ivec2(mod(cellPixel, 4.0));
    return (BAYER_4X4[p.y * 4 + p.x] + 0.5) / 16.0;
  }
  ivec2 p = ivec2(mod(cellPixel, 8.0));
  return (BAYER_8X8[p.y * 8 + p.x] + 0.5) / 64.0;
}

vec4 ulab_main(vec4 src, vec2 uv) {
  vec2 pixelCoord = uv * uResolution;

  // 'scale' est une taille en pixels DOCUMENT (ETAPE-2.md §3.7), mise à
  // l'échelle du rendu courant par uScale — un pas de matrice = un pixel
  // de rendu au minimum.
  float scale = max(u_scale * uScale, 1.0);
  vec2 cellPixel = floor(pixelCoord / scale);
  float threshold = bayer_threshold(cellPixel, u_matrix);

  float luma = dot(src.rgb, vec3(0.2126, 0.7152, 0.0722));
  if (u_invert) luma = 1.0 - luma;

  // Tramage ordonné généralisé à N niveaux : le seuil de la matrice décide
  // si la fraction restante après quantification arrondit vers le haut ou
  // le bas — c'est ce qui produit le motif géométrique régulier, à
  // l'opposé de la diffusion d'erreur qui reporte cette même fraction sur
  // les pixels voisins.
  float levels = clamp(floor(u_levels + 0.5), 2.0, 8.0);
  float steps = levels - 1.0;
  float scaled = luma * steps;
  float base = floor(scaled);
  float frac = scaled - base;
  float level = frac > threshold ? base + 1.0 : base;
  float value = clamp(level / steps, 0.0, 1.0);

  // Palette 'aucune' (u_palette_count == 0) : ulab_palette_nearest renvoie
  // sa couleur d'entrée inchangée, donc le noir/blanc par défaut reste tel
  // quel — même idiome que traitement.halftone.
  vec3 ink = ulab_palette_nearest(vec3(0.0), u_palette, u_palette_count);
  vec3 paper = ulab_palette_nearest(vec3(1.0), u_palette, u_palette_count);
  return vec4(mix(ink, paper, value), src.a);
}
