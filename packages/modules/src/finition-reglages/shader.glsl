vec4 ulab_main(vec4 src, vec2 uv) {
  float brightness = clamp(u_brightness, -50.0, 50.0) / 100.0;
  float contrast = clamp(u_contrast, -50.0, 50.0) / 100.0;
  float gamma = clamp(u_gamma, 0.4, 3.0);
  float saturation = clamp(u_saturation, -100.0, 100.0) / 100.0;

  // Défauts neutres (0, 0, 1, 0) : sortie identique bit pour bit à l'entrée,
  // sortie anticipée avant tout calcul flottant sur `src` — seule exception
  // du catalogue à "un module ajouté doit se voir" (ETAPE-2.md, prompt 10).
  if (brightness == 0.0 && contrast == 0.0 && gamma == 1.0 && saturation == 0.0) {
    return src;
  }

  // Ordre repris de _legacy/u-dither-v1/api/src/udither_api/app.py
  // (_apply_image_adjust) : luminosité, gamma, contraste, puis saturation
  // via la luminance — pas l'ordre de déclaration des paramètres, celui du
  // calcul.
  vec3 c = clamp(src.rgb + brightness, 0.0, 1.0);
  c = pow(c, vec3(1.0 / gamma));
  c = clamp((c - 0.5) * (1.0 + contrast) + 0.5, 0.0, 1.0);

  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = clamp(luma + (c - luma) * (1.0 + saturation), 0.0, 1.0);

  return vec4(c, src.a);
}
