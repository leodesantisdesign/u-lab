// Damier neutre, discret — affiché tant qu'aucun média n'est chargé, et
// dans les marges du cadrage "contain" (les bandes autour d'une image dont
// le ratio ne correspond pas à celui du document). Deux gris proches, pas
// de noir/blanc franc : ce n'est pas un message, juste une absence de sujet.
vec3 checkerboard(vec2 pixelCoord) {
  const float TILE = 16.0;
  vec2 tile = floor(pixelCoord / TILE);
  float parity = mod(tile.x + tile.y, 2.0);
  return mix(vec3(0.09, 0.095, 0.085), vec3(0.13, 0.135, 0.12), parity);
}

vec4 ulab_main(vec4 src, vec2 uv) {
  // uMediaSize : résolution native du média, (0,0) si aucun n'est chargé
  // (moteur, voir program.ts — capacité ajoutée pour ce cadrage).
  if (uMediaSize.x <= 0.0 || uMediaSize.y <= 0.0) {
    return vec4(checkerboard(uv * uResolution), 1.0);
  }

  // Cadrage "contain" : le média entier est visible, centré, sans
  // déformation — l'axe le plus contraignant (largeur ou hauteur) remplit
  // le document, l'autre laisse des bandes.
  float targetAspect = uResolution.x / uResolution.y;
  float mediaAspect = uMediaSize.x / uMediaSize.y;

  vec2 scale = mediaAspect > targetAspect
    ? vec2(1.0, targetAspect / mediaAspect)
    : vec2(mediaAspect / targetAspect, 1.0);

  vec2 mediaUv = (uv - 0.5) / scale + 0.5;

  if (mediaUv.x < 0.0 || mediaUv.x > 1.0 || mediaUv.y < 0.0 || mediaUv.y > 1.0) {
    return vec4(checkerboard(uv * uResolution), 1.0);
  }

  return texture(uSource, mediaUv);
}
