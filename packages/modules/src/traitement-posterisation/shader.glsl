vec4 ulab_main(vec4 src, vec2 uv) {
  // 'levels' n'est jamais un entier venu tel quel de l'UI (curseur, mais la
  // valeur transite en float côté uniforme) : round() avant clamp, pas de
  // troncature qui décalerait le seuil d'un niveau.
  float levels = clamp(floor(u_levels + 0.5), 2.0, 16.0);
  float steps = levels - 1.0;

  // À 2 niveaux, steps == 1.0 : round(src * 1) / 1, un seuillage pur à 0.5 —
  // aucune branche séparée nécessaire, c'est le même calcul aux deux bornes.
  vec3 quantized = floor(src.rgb * steps + 0.5) / steps;

  return vec4(quantized, src.a);
}
