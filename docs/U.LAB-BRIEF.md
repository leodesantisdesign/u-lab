# U.LAB — Brief stratégique & technique

> Un laboratoire d'outils créatifs web (image, vidéo, motion, design graphique/web, 3D, code art).
> Ambition : **portfolio personnel d'outils gratuits** — vitrine d'un univers créatif, priorité à l'identité et à la diffusion.
> Premier outil déjà amorcé : **u.dither** (édition photo/vidéo en dithering & effets).
>
> Document de travail — v1, juillet 2026. Basé sur une analyse de brik.space, artkit.cc, endlesstools.io, dasca.studio, de comptes de veille Instagram, et de la base de code u.dither existante.
>
> ⚠️ **Document historique — partiellement périmé.** La **vision et le positionnement (§1, §2) restent valides**, mais tout ce qui touche à l'architecture est caduc : les §3 et §5 décrivent encore le modèle « un outil = une page » avec un dossier `tools/u-dither/`, `tools/u-halftone/` et le préfixe `u.` sur les outils. Ce modèle a été abandonné en juillet 2026 au profit d'un **éditeur unique à pile de modules**. Pour l'architecture en vigueur : `CLAUDE.md` §3 et `docs/U.LAB-ARCHITECTURE.md` v2.

---

## 1. Vision

U.LAB n'est pas *un* outil, c'est **un espace** : une collection cohérente de petits outils créatifs, réunis par une identité visuelle forte et une même manière de faire. Chaque outil fait **une chose, très bien, en temps réel**, avec un export propre en un clic. u.dither est le premier ; il définit le gabarit des suivants.

Le pari : dans un monde saturé de SaaS génériques, un labo d'auteur avec un **parti pris esthétique assumé** et des outils gratuits et « joueurs » se distingue par le goût, pas par les features. La valeur, c'est ta direction artistique — pas une liste de fonctionnalités.

---

## 2. Lecture des références

Les quatre tool-spaces que tu suis ne visent pas la même chose. Bien les distinguer aide à te placer sans les copier.

| Référence | Positionnement | Modèle | Ce qu'on lui vole |
|---|---|---|---|
| **artkit.cc** | Hub de petits outils navigateur (RetroMan = dithering, halftone, ASCII, textures vintage) | Freemium à crédits | **Le format même de U.LAB** : plusieurs outils sous un même toit, chacun mono-tâche |
| **dasca.studio** | VFX temps réel : pixel sorting, dithering, blob tracking, typo cinétique | App desktop (Rust) + playground web | L'**esthétique** proche de u.dither et l'idée du *playground* pour explorer sans but |
| **endlesstools.io** | Multitool 3D/motion no-code, très poli | Freemium 20 $/mois (templates, export 8K, embeds) | Le **niveau de finition** produit et l'idée d'**embeds** (scènes interactives à intégrer) |
| **brik.space** | « Motion design + creative coding », assisté IA (construit sur base44) | Galerie communautaire | La logique de **Gallery / Collections** : montrer ce que les gens créent |

**L'ADN commun aux quatre**, à reprendre :
1. **Une identité visuelle unique et immédiatement reconnaissable.**
2. **Aperçu temps réel** — on manipule, ça répond instantanément.
3. **Export en un clic**, sans friction.
4. **Une galerie / des exemples** qui font vendre le rêve plus que les specs.
5. **Instagram comme moteur de distribution** (démos en boucle, avant/après, process).

Tes comptes IG suivis (opensession.co, yhhydesign/typowow, rndyrbrts, yllead, antoncreations) sont surtout de la **veille d'inspiration et de diffusion** : ils te servent pour le branding de U.LAB et le futur compte IG du labo, pas comme des outils. Traite-les comme ta *moodboard* et ton école de storytelling visuel.

**Ta différenciation possible** (aucune des quatre ne coche tout) : le labo **gratuit, d'auteur, cohérent**, où chaque outil est une pièce signée — entre le hub d'artkit et l'esthétique de dasca, mais sans paywall et avec une patte personnelle plus radicale.

---

## 3. Architecture cible : temps réel in-browser

### Le constat sur u.dither
Ton u.dither actuel = frontend **Vite + TypeScript vanilla** + un **backend Python** (`udither_api`) qui calcule les filtres (`bayer_filter`, `error_diffusion_filter`, `halftone_filter`, `palette`, `post_fx`). Toutes tes références, elles, calculent les effets **dans le navigateur** via des shaders — Ditter traite de la 4K en moins de 5 ms sur GPU.

Pour un labo de N outils gratuits, le temps réel in-browser gagne presque toujours :
- **aperçu instantané** (pas d'aller-retour réseau),
- **hébergement quasi gratuit** (site statique, pas de serveur à maintenir),
- **fluidité** qui est *le* critère perçu de qualité sur ce type d'outil.

### Ce que la migration implique, honnêtement
Tous les filtres ne se transposent pas au GPU avec la même facilité :

- **Faciles à passer en fragment shader** (parfaitement parallèles, un pixel = un calcul indépendant) : *ordered dithering* (Bayer), *halftone*, quantification de **palette**, et les **post-FX** (contraste, courbes, grain…). Ce sont des gains immédiats et énormes.
- **Le cas épineux : l'error diffusion** (type Floyd–Steinberg). L'algorithme est **séquentiel** — chaque pixel dépend du voisin déjà traité — donc pas trivialement parallélisable en shader classique. Deux options : garder un chemin **WASM/JS rapide** juste pour cet effet, ou utiliser une **approximation GPU** (dithering par bruit bleu / motif) visuellement proche. À trancher outil par outil.

Traduction : la cible « 100 % in-browser » est la bonne, mais l'error diffusion mérite un plan B. C'est le genre de décision qu'on documentera dans le `CLAUDE.md`.

### Structure recommandée : un monorepo « labo »
L'erreur à éviter, c'est de coder chaque outil comme un site isolé. Il faut **un shell partagé + des outils modulaires + un moteur d'effets commun** :

```
U.LAB/
├─ apps/
│  └─ lab/                 # le shell : page d'accueil du labo, navigation, galerie
├─ tools/
│  ├─ u-dither/            # outil 1 (migration de l'existant)
│  ├─ u-pixelsort/         # outil 2 (exemple)
│  └─ .../                 # chaque outil = un module qui s'enregistre dans le shell
├─ packages/
│  ├─ engine/             # moteur WebGL2/WebGPU : pipeline d'effets chaînables, canvas, I/O
│  ├─ ui/                 # design system partagé (contrôles, sliders, layout)
│  └─ export/             # export image (toBlob) + vidéo (WebCodecs / MediaRecorder)
└─ CLAUDE.md              # les « paramètres » lus à chaque session (voir §6)
```

- **Stack** : reste sur **Vite + TypeScript** (tu la maîtrises déjà). Passe en **monorepo pnpm workspaces** quand tu ajoutes le 2ᵉ outil. Garde le vanilla tant que ça tient ; n'introduis un mini-framework que si la complexité UI l'exige.
- **Moteur d'effets** : une petite abstraction au-dessus de **WebGL2** avec une **chaîne d'effets empilables** (chaque effet = un fragment shader qui prend la texture précédente et sort la suivante). C'est exactement le principe de *shader-lab* (basement studio, open source) — à étudier voire réutiliser. Librairies légères possibles pour éviter le WebGL brut : **ogl** (minuscule) ou **regl**. WebGPU seulement là où tu as besoin de *compute* (ex. vrai pixel sorting).
- **Export** : images via `canvas.toBlob` ; vidéo via **WebCodecs** (chemin moderne) ou `canvas.captureStream()` + `MediaRecorder` pour du WebM, comme le fait Ditter.

### Ressources techniques concrètes (à garder sous la main)
- **Codrops** — « Building a Real-Time Dithering Shader » et « Efecto: Real-Time ASCII & Dithering with WebGL Shaders » : tutoriels directement applicables.
- **basementstudio/shader-lab** (GitHub) — toolkit open source qui empile/anime des shaders (ASCII, CRT, halftone, dithering, pixelation, pixel sorting, posterize…). Le modèle architectural à copier.
- **Luke Cochrane — « Real-Time Pixel Sorting in the Browser »** (WebGPU compute) pour le pixel sorting.
- **Ditter (ditterstudio.com)** — référence produit : 28 algos de dithering en WebGL2, vidéo → rendu WebM.
- **terkelg/awesome-creative-coding** et **awesome-webgl** — annuaires pour piocher libs et exemples.

---

## 4. Identité & système de design

Ton avantage concurrentiel, c'est le goût. Il faut donc **industrialiser la cohérence** :

- Un **design system minimal partagé** (`packages/ui`) : mêmes typos, mêmes contrôles (sliders, selects custom — tu en as déjà : `CustomSelect`, `CustomPaletteEditor`), mêmes marges, même grain visuel. Chaque nouvel outil hérite du look sans le réinventer.
- Un **nommage cohérent** : `u.dither`, `u.pixelsort`, `u.halftone`… La marque `u.` comme signature. (À valider : c'est joli et systémique.)
- Une **page d'accueil-labo** qui présente les outils comme une collection (grille, aperçus animés), façon artkit — c'est la première chose qu'on retient.
- Un **compte Instagram U.LAB** dès que 2–3 outils tournent : avant/après en boucle, captures d'écran de manipulation, mini-tutos. C'est ton canal n°1 (toutes tes références en vivent).

Les comptes que tu suis sont ta référence pour ce langage : étudie *comment* ils filment une démo, cadrent un avant/après, rythment une vidéo de 8 secondes. C'est reproductible.

---

## 5. Roadmap suggérée (à ajuster)

Une progression du plus proche de l'existant au plus ambitieux — chaque étape réutilise le moteur commun, donc chaque outil coûte de moins en moins cher.

1. **Consolider u.dither** en migrant Bayer/halftone/palette/post-FX vers le moteur WebGL, error diffusion en chemin JS/WASM. → valide l'architecture.
2. **Extraire le moteur** (`packages/engine`) et le **shell labo** (`apps/lab`) à partir de ce qui marche.
3. **2ᵉ outil image** proche techniquement : *u.halftone* ou *u.pixelsort* — presque gratuit une fois le moteur en place.
4. **Élargir les domaines** un par un : effets vidéo temps réel → typo cinétique (comme dasca) → code art génératif → 3D (three.js/ogl) → embeds intégrables (comme endlesstools).
5. **Galerie / exemples** sur le shell (façon brik) pour donner envie et documenter tes propres créations.

Règle d'or : **un outil livré et beau > cinq outils à moitié faits.** La cohérence et la finition sont le produit.

---

## 6. Comment bosser avec moi (et Claude Code) le plus efficacement

**La question « ton Claude Code est-il connecté à ton Claude classique ? »** — réponse franche : il n'y a pas deux comptes à relier. Ici (mode Cowork) j'ai déjà accès direct à ton dossier U.LAB et à un environnement pour lancer/tester du code. En parallèle tu peux utiliser **Claude Code** (le CLI, dans ton terminal/VS Code) sur le **même dépôt**. Le pont entre les deux, ce n'est pas un compte — **c'est le repo, et surtout le fichier `CLAUDE.md`** que nous lisons tous les deux à chaque session. C'est la brique n°1 recommandée par toutes les sources.

Le **workflow documenté** qui marche (recommandé par Anthropic et confirmé par les retours terrain) :

1. **Explorer** — me laisser lire les fichiers concernés *avant* d'écrire quoi que ce soit.
2. **Planifier** — utiliser le *plan mode* (dans Claude Code : `Shift+Tab` deux fois → lecture seule) pour obtenir un plan validé avant toute édition. « Vibe coding » OK pour un jouet jetable ; pour du code que tu gardes, on planifie.
3. **Coder** — implémenter par petits incréments.
4. **Vérifier & commit** — c'est **le conseil n°1 qui revient partout** : me donner un moyen de contrôler ma propre sortie (aperçu visuel, test, capture d'écran, diff relu). Commits fréquents.

Trois principes complémentaires issus de la même veille :
- **Gérer le contexte** : ne pas me « déverser » tout le repo ; me pointer les bons fichiers. Repartir propre (`/clear`) entre deux sujets sans rapport.
- **Rester simple** : les boucles simples battent les usines à gaz multi-agents ; outils bas niveau (lire/éditer/bash) + quelques abstractions bien choisies.
- **Documenter dans `CLAUDE.md`** : stack, conventions, décisions (ex. « error diffusion reste en JS »). Il devient notre mémoire commune et rend chaque session suivante meilleure.

**Concrètement, ta prochaine action à haute valeur** : me faire générer le `CLAUDE.md` de U.LAB (vision + stack cible in-browser + conventions du monorepo + décisions techniques de §3). C'est le fichier qui me rend — et rend Claude Code — le plus efficace sur ce projet précis. Dis-le-moi et je te le rédige dans la foulée.

---

## Sources

- [Endless Tools](https://endlesstools.io/) · [DASCA – dasca.studio](https://dasca.studio/) · [Artkit – artkit.cc](https://artkit.cc/) et [RetroMan (dithering)](https://artkit.cc/retro-man) · [Brik – brik.space](https://brik.space/) et [Brik Gallery](https://brik.space/Gallery)
- [DASCA sur Product Hunt](https://www.producthunt.com/products/dasca)
- [Codrops — Building a Real-Time Dithering Shader](https://tympanus.net/codrops/2025/06/04/building-a-real-time-dithering-shader/) · [Codrops — Efecto: Real-Time ASCII & Dithering](https://tympanus.net/codrops/2026/01/04/efecto-building-real-time-ascii-and-dithering-effects-with-webgl-shaders/)
- [basementstudio/shader-lab (GitHub)](https://github.com/basementstudio/shader-lab) · [Real-Time Pixel Sorting in the Browser](https://lukecochrane.com/blog/pixel-sorting) · [Ditter](https://ditterstudio.com/)
- [terkelg/awesome-creative-coding](https://github.com/terkelg/awesome-creative-coding) · [sjfricke/awesome-webgl](https://github.com/sjfricke/awesome-webgl)
- [Best practices for Claude Code (docs)](https://code.claude.com/docs/en/best-practices) · [Claude Code power user tips](https://support.claude.com/en/articles/14554000-claude-code-power-user-tips) · [Plan Mode in Claude Code](https://codewithmukesh.com/blog/plan-mode-claude-code/)
- Base de code locale analysée : `U.LAB/U.DITHER/app/web` (Vite + TS) et `U.LAB/U.DITHER/app/api` (`udither_api`, filtres Python).
