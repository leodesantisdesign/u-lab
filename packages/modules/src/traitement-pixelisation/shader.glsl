vec4 ulab_main(vec4 src, vec2 uv) {
  vec2 pixelCoord = uv * uResolution;

  // 'cellSize' est en pixels DOCUMENT (ETAPE-2.md §3.7), mis à l'échelle du
  // rendu courant par uScale.
  float cell = max(u_cellSize * uScale, 1.0);
  vec2 cellIndex = floor(pixelCoord / cell);
  vec2 cellCenter = (cellIndex + 0.5) * cell;

  // Échantillonnage au centre de la cellule, jamais une moyenne : on veut le
  // bloc franc, pas un flou — une seule lecture de texture.
  vec3 blockColor = texture(uSource, cellCenter / uResolution).rgb;

  if (u_shape == 1) {
    // rond : hors du disque inscrit dans la cellule, le fond d'origine
    // passe — pas de lissage de bord (§3.1 : "le bloc franc, pas un flou").
    vec2 delta = pixelCoord - cellCenter;
    float radius = cell * 0.5;
    if (length(delta) > radius) {
      return src;
    }
  }

  return vec4(blockColor, src.a);
}
