# CLAUDE.md — U.LAB

> Fichier de contexte projet. Lu à chaque session, par Claude Code (CLI) **et** par Claude en mode Cowork.
> C'est la mémoire commune du projet : si une décision compte, elle est écrite ici.
> Dernière révision : juillet 2026.

---

## 1. Ce qu'est U.LAB

Un **laboratoire d'outils créatifs web**, gratuits, sans compte et sans paywall. Image, vidéo, motion, design graphique/web, 3D, code art.

**Trois règles non négociables :**

1. **Un outil = une idée.** Un outil fait *un seul* process, à fond. Dithering ≠ halftone ≠ ASCII : ce sont des procédés différents, donc des outils différents. Ne jamais empiler des directions hétérogènes dans une même interface — c'est l'erreur du u.dither v1 qu'on corrige.
2. **Fonctionnel avant tout.** L'outil doit servir *n'importe quelle* direction artistique, pas seulement celle de son auteur. On expose des paramètres neutres et complets ; la patte de Léo s'exprime dans **le design de l'UI** et dans les exemples montrés, jamais en bridant l'utilisateur.
3. **Temps réel ou rien.** On manipule un paramètre, l'aperçu répond immédiatement. C'est le critère de qualité perçue n°1 sur ce type d'outil.

**Positionnement :** le labo gratuit, d'auteur, cohérent — chaque outil est une pièce signée. Se distingue par le goût et l'UX, pas par une liste de features.

**Public :** tout le monde. Simple et concret à l'usage, sans jargon.

---

## 2. Stack (décidée, à respecter)

| Couche | Choix | Pourquoi |
|---|---|---|
| Shell / site | **Astro** | Architecture *islands* : zéro JS sur les pages statiques, et chaque route d'outil ne charge que le JS de cet outil. Le plus rapide en LCP sur ce type de site multi-pages. |
| Îlots interactifs | **Svelte 5** | Les bundles les plus petits parmi les frameworks applicatifs. Utilisé uniquement à l'intérieur des outils. |
| Langage | **TypeScript**, strict | — |
| Rendu effets | **WebGL2 en socle + WebGPU en option** | WebGL2 marche partout par défaut ; WebGPU (~82 % de support, Firefox encore à la traîne) apporte les *compute shaders*. Détection via `navigator.gpu`, fallback systématique. |
| Monorepo | **pnpm workspaces** (+ Turborepo si besoin) | Gratuit, standard, cache de build. |
| Hébergement | **Cloudflare Pages** | Le plus généreux en bande passante pour du statique. Site 100 % statique = coût quasi nul. |
| Export vidéo | **WebCodecs** + muxer (`mp4-muxer`) | ~20× plus rapide que ffmpeg.wasm (encodage matériel). Fallback `MediaRecorder`/WebM. |
| Export image | `canvas.toBlob()` | — |

**Pas de backend.** Tout tourne dans le navigateur. Le backend Python de u.dither v1 (`udither_api`, FastAPI) est **abandonné** : il empêche le temps réel et impose un serveur à payer. Les fichiers de l'utilisateur ne quittent jamais sa machine — c'est aussi un argument de confiance.

### Points techniques à connaître avant de coder

- **L'error diffusion (Floyd–Steinberg, Atkinson) est séquentielle** : chaque pixel dépend du voisin déjà traité. Elle ne se parallélise pas en fragment shader classique. → chemin **CPU dans un Web Worker** (TS d'abord, WASM si besoin de vitesse), ou approximation GPU par bruit bleu. À décider effet par effet, et à noter ici.
- **Ordered dithering (Bayer), halftone, quantification de palette, post-FX** → parfaitement parallèles, donc **fragment shaders**, gains énormes.
- **Pixel sorting** → nécessite du *compute*, donc chemin **WebGPU** (avec dégradation propre si absent).
- WebCodecs et `SharedArrayBuffer` exigent **HTTPS**. Vérifier le support Safari avant de promettre un export MP4 ; prévoir le fallback WebM.

---

## 3. Structure du monorepo

```
U.LAB/
├─ CLAUDE.md               # ce fichier — DOIT rester à la racine (Claude Code ne
│                          #   charge automatiquement que ./CLAUDE.md)
├─ apps/
│  └─ lab/                 # Astro : accueil du labo, navigation, pages outils, galerie
├─ tools/
│  ├─ u-dither/            # 1 outil = 1 dossier = 1 idée
│  ├─ u-halftone/
│  └─ .../
├─ packages/
│  ├─ engine/              # pipeline WebGL2/WebGPU : chaîne d'effets, textures, boucle de rendu
│  ├─ ui/                  # design system partagé : contrôles, sliders, layout, tokens
│  ├─ palette/             # palettes de couleurs partagées
│  └─ export/              # export image + vidéo (WebCodecs / MediaRecorder)
├─ _legacy/
│  └─ u-dither-v1/         # ancien code, référence fonctionnelle uniquement, jamais étendu
└─ docs/
   ├─ U.LAB-BRIEF.md       # brief stratégique (vision, références, positionnement)
   ├─ U.LAB-ARCHITECTURE.md # décisions techniques + plan de migration
   └─ ETAPE-0.md           # guide de mise en place des fondations
```

**Principe :** un nouvel outil ne réécrit **jamais** le moteur, l'UI ou l'export. Il déclare ses paramètres et ses shaders, et branche des composants existants. Si un outil a besoin d'un truc générique, ça remonte dans `packages/`.

---

## 4. Conventions

- **Nommage :** `u.` en préfixe de marque (`u.dither`, `u.halftone`…). Dossiers en `kebab-case` (`u-dither`). Fichiers TS en `camelCase`, composants en `PascalCase`.
- **UI cohérente entre outils :** même disposition (aperçu dominant + panneau de contrôles), mêmes contrôles, mêmes raccourcis, même bouton d'export. Un utilisateur qui connaît un outil sait utiliser les autres.
- **Chaque paramètre exposé doit être neutre et documenté** (nom clair, plage sensée, valeur par défaut utile). Pas de valeurs magiques cachées.
- **Presets = points de départ, pas des rails.** Tout preset doit rester entièrement modifiable.
- **Performance :** viser 60 fps sur l'aperçu. Si un effet ne tient pas, on baisse la résolution de l'aperçu — jamais la qualité de l'export.
- **Accessibilité de base :** contrastes lisibles, navigation clavier, cibles tactiles ≥ 44 px.
- **Pas de dépendance lourde sans justification** écrite ici.

---

## 5. Comment travailler avec moi

**Workflow : Explorer → Planifier → Coder → Vérifier & commit.**

1. **Explorer** — je lis les fichiers concernés avant d'écrire quoi que ce soit.
2. **Planifier** — plan validé avant toute édition (dans Claude Code : `Shift+Tab` ×2 = plan mode, lecture seule). Pas de « vibe coding » sur du code qu'on garde.
3. **Coder** — petits incréments.
4. **Vérifier** — c'est la règle la plus importante : je dois toujours avoir un moyen de contrôler ma propre sortie (build qui passe, aperçu visuel, capture d'écran, diff relu). Commits fréquents.

**Gestion du contexte :** me pointer les bons fichiers plutôt que me déverser le repo. Repartir propre entre deux sujets sans rapport.

**Simplicité :** boucles simples et outils bas niveau > usines à gaz. Ne pas sur-architecturer avant d'avoir 2 outils qui tournent.

**Ce fichier est vivant :** toute décision technique ou esthétique importante s'y ajoute (surtout les décisions *négatives* : ce qu'on a essayé et écarté, et pourquoi).

---

## 6. État actuel

- **Étape 0 en cours** (fondations + première mise en ligne). Voir `docs/ETAPE-0.md`.
- `_legacy/u-dither-v1/` = **legacy, à ne jamais étendre**. Vite + TS vanilla + backend FastAPI. Sert de **référence fonctionnelle uniquement** (algorithmes, palettes, presets, vocabulaire des paramètres) — on ne reprend ni son architecture ni son code.
- Les assets lourds (photos, rendus, vidéos de test) vivent **hors du dépôt**, sur le disque de Léo. Ne jamais les réintroduire dans le repo.
- Reconstruction complète selon §2/§3. Découpage des outils et plan de migration : `docs/U.LAB-ARCHITECTURE.md`.
