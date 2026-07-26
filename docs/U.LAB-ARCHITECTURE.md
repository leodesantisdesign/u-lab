# U.LAB — Architecture, découpage des outils & plan de migration

> Complète et **remplace le §3 du brief** (`U.LAB-BRIEF.md`), qui envisageait encore une réutilisation de l'existant.
> Décision : **on repart de zéro.** u.dither v1 sert de référence fonctionnelle, pas de base de code.
> Juillet 2026.

---

## 1. Pourquoi on ne garde pas u.dither v1

L'existant : Vite + TypeScript vanilla, un `StudioPage.ts` de 833 lignes, une feuille de style de 1725 lignes, un Web Worker de 641 lignes, et surtout un **backend Python FastAPI** (`udither_api`) qui calcule tous les filtres côté serveur.

Trois blocages structurels :

1. **Le backend tue le temps réel.** Chaque changement de paramètre = un aller-retour réseau + un encodage/décodage d'image. Les outils de référence (Ditter, DASCA, artkit) traitent de la 4K en moins de 5 ms sur GPU. On ne rattrape pas cet écart en optimisant : il faut changer d'approche.
2. **Le backend coûte de l'argent en permanence.** Un labo gratuit doit être un site statique, sinon l'hébergement devient un abonnement à vie pour toi.
3. **Un seul outil fourre-tout.** `modes.ts` mélange `halftone`, `bayer`, `floyd_steinberg`, `atkinson` sous une même UI, avec une pile de FX par-dessus. Ce sont des procédés différents → c'est exactement ce que la règle « un outil = une idée » interdit.

**Ce qu'on récupère quand même** (et c'est précieux) : les algorithmes et leurs paramètres, les palettes, les presets, le vocabulaire des réglages, et l'expérience de ce qui rend un rendu joli. On les réimplémente proprement.

---

## 2. La stack, et pourquoi elle

Résumé opérationnel dans `CLAUDE.md` §2. Ici, le raisonnement.

### Astro (shell) + Svelte 5 (îlots)
Un labo, c'est un site **multi-pages** : une accueil, une galerie, N pages d'outils. Astro applique l'architecture *islands* — les pages statiques n'expédient aucun JavaScript, et chaque page d'outil ne charge que le code de cet outil. C'est le meilleur profil pour du contenu + quelques zones très interactives, et ça évite qu'un visiteur de la page d'accueil télécharge le moteur d'effets. Astro a par ailleurs été racheté par Cloudflare en janvier 2026, ce qui aligne bien avec l'hébergement choisi.

Pour l'intérieur des outils (panneaux de contrôles réactifs), **Svelte 5** produit les bundles les plus légers des frameworks applicatifs. On peut aussi rester en TS vanilla pour un outil très simple — Astro accepte les deux.

*Alternative écartée :* Next.js, calibré pour des applis authentifiées côté serveur ; hors sujet pour un site statique d'outils.

### WebGL2 en socle, WebGPU en option
WebGL2 fonctionne dans **tous** les navigateurs majeurs par défaut. WebGPU tourne autour de **82 %** de couverture (Safari 26 l'a ajouté en septembre 2025 ; **Firefox reste désactivé par défaut** mi-2026). La stratégie de référence en 2026, c'est donc : WebGL2 comme socle garanti, chemin WebGPU détecté via `navigator.gpu` là où il apporte quelque chose (compute shaders → pixel sorting, traitements lourds).

### Le pipeline d'effets
Le cœur de `packages/engine` : une **chaîne d'effets empilables**, chaque effet étant un fragment shader qui prend la texture précédente et produit la suivante. C'est exactement le modèle de `basementstudio/shader-lab` (open source, à étudier avant d'écrire quoi que ce soit). Pour éviter le WebGL brut sans embarquer un moteur 3D : **ogl** ou **regl** sont les bons candidats ; three.js est surdimensionné pour du 2D plein écran.

### Export
- **Image :** `canvas.toBlob()`, rendu à pleine résolution hors aperçu.
- **Vidéo : WebCodecs** — encodage matériel, environ **20× plus rapide** que ffmpeg.wasm, avec un muxer JS type `mp4-muxer` pour produire le conteneur. Fallback `canvas.captureStream()` + `MediaRecorder` en WebM.
- ⚠️ **À vérifier avant de promettre du MP4 :** l'état exact du support WebCodecs dans Safari à la date de l'implémentation. WebCodecs et `SharedArrayBuffer` nécessitent HTTPS.

### Hébergement
**Cloudflare Pages.** Site statique → pas de serveur, pas de facture qui grimpe avec le succès. C'est la plateforme la plus généreuse en bande passante sur le tier gratuit (à noter : un plafond de 100 Go/mois a été introduit en juin 2026 sur les domaines gratuits — largement suffisant, et à surveiller si un outil perce).

---

## 3. Découpage des outils

Application de la règle « un outil = une idée ». Ce qui était u.dither v1 devient plusieurs outils, plus des briques partagées.

### Ce qui reste dans **u.dither**
**Idée : réduire la profondeur de couleur en distribuant l'erreur.** C'est *un* procédé cohérent, même s'il a deux familles :
- **Ordered / Bayer** (matrices 2×2 → 8×8) → fragment shader.
- **Error diffusion** (Floyd–Steinberg, Atkinson, et les autres classiques) → Web Worker CPU.
- **Quantification de palette** (le dithering n'a de sens que relativement à une palette cible).

Ces trois éléments répondent à la même question — « comment représenter cette image avec moins de couleurs ? » — donc ils restent ensemble. C'est ça, une idée forte.

### Ce qui sort en outils séparés

| Nouvel outil | Idée | Pourquoi c'est un autre outil | Chemin technique |
|---|---|---|---|
| **u.halftone** | Trames d'impression : points/lignes, angle, fréquence, séparation CMJN | Le halftone simule un **procédé d'impression** (rotation de trames), pas une réduction de couleurs. Paramètres et mentalité totalement différents. | Fragment shader |
| **u.ascii** | Image → mosaïque de caractères | Le résultat est **du texte**, pas des pixels. Jeu de glyphes, métrique de police, export texte : rien à voir. | Fragment shader + atlas de glyphes |
| **u.sort** | Pixel sorting (seuils, direction, masques) | Réordonne les pixels au lieu de les requantifier. Nouveau, aligné avec DASCA. | **WebGPU compute** (dégradation propre si absent) |

### Ce qui devient une brique partagée, pas un outil
La pile de post-FX de v1 (grain, bruit, scanlines, vignette, netteté, décalage chromatique, posterize) **n'est pas une idée d'outil** : c'est une **couche de finition**. Elle va dans `packages/engine` et chaque outil en expose un sous-ensemble discret et cohérent. Idem pour les **palettes** (`packages/palette`), utilisées par dither, halftone et ascii.

*Si un jour tu veux vraiment un outil de glitch*, ce sera **u.glitch** avec sa propre idée forte (corruption de données, datamosh) — pas un fourre-tout d'effets résiduels.

**Ordre de construction conseillé :** `u.dither` (valide le moteur et l'UI) → `u.halftone` (quasi gratuit une fois le moteur là) → `u.ascii` → `u.sort` (ouvre la voie WebGPU).

---

## 4. Plan de migration

**Étape 0 — Fondations.** Monorepo pnpm, app Astro, déploiement Cloudflare Pages d'une page vide. But : avoir une URL en ligne dès le jour 1, pour que tout le reste soit vérifiable en vrai.

**Étape 1 — Le moteur.** `packages/engine` : contexte WebGL2, quad plein écran, chaîne d'effets empilables, chargement d'image, boucle de rendu, aperçu à résolution réduite + rendu pleine résolution pour l'export. Un shader bidon suffit à valider.

**Étape 2 — Le design system.** `packages/ui` : tokens (typo, couleurs, espacements), slider, select, upload, zone d'aperçu, barre d'export. C'est ici que vit ta patte visuelle. Tout outil futur s'y branche.

**Étape 3 — u.dither.** Bayer + palette en shaders ; error diffusion en Worker ; post-FX minimal ; export image. C'est le test grandeur nature de l'architecture.

**Étape 4 — Le shell.** Accueil du labo, page par outil, navigation cohérente. Une fois qu'il y a quelque chose à montrer.

**Étape 5 — Export vidéo.** WebCodecs + muxer, avec fallback. Branché dans `packages/export`, donc disponible pour tous les outils d'un coup.

**Étape 6 — Outils suivants.** u.halftone, puis u.ascii, puis u.sort.

**Règle :** on ne démarre pas une étape sans que la précédente soit déployée et vérifiable en ligne. Un outil livré et beau > cinq à moitié faits.

---

## 5. Claude Code ou Cowork : lequel, quand

Il n'y a pas deux comptes à relier — c'est **le repo et ce `CLAUDE.md` qui font le pont**. Les deux environnements lisent les mêmes fichiers. La vraie question est : lequel est le bon outil pour la tâche du moment.

**Claude Code (CLI, dans ton terminal / VS Code) — pour le code.**
- Écrire et refactorer du code sur plusieurs fichiers.
- Faire tourner le serveur de dev, les builds, les tests, et **itérer sur les erreurs**.
- Travailler avec git : branches, diffs, commits, PR.
- Le *plan mode* (`Shift+Tab` ×2) avant toute grosse modification.
- Les sessions longues où le contexte du dépôt compte.

**Cowork (ici) — pour tout ce qui entoure le code.**
- La recherche et la veille (comme ce document).
- Les décisions d'architecture, les arbitrages, les briefs.
- Les documents et livrables (Markdown, PDF, decks).
- Regarder des images/références, discuter direction artistique.
- Rédiger et maintenir `CLAUDE.md` lui-même.

**En pratique :** tu décides *quoi* faire ici, puis tu fais *faire* là-bas. Cowork produit le plan et le contexte ; Claude Code exécute dans le repo. Et quand une décision est prise d'un côté, **elle atterrit dans `CLAUDE.md`** — c'est comme ça que les deux restent synchronisés.

---

## Sources

- [Astro vs SvelteKit vs Next.js 2026](https://www.pkgpulse.com/guides/nextjs-vs-astro-vs-sveltekit-2026) · [Astro vs Next.js — poids JS mesuré](https://tech-insider.org/astro-vs-nextjs-2026/) · [Guide de décision framework 2026](https://pockit.tools/blog/nextjs-vs-remix-vs-astro-vs-sveltekit-2026-comparison/)
- [WebGPU Browser Support 2026](https://webo360solutions.com/blog/webgpu-browser-support/) · [WebGL 2 Browser Support 2026](https://www.testmuai.com/learning-hub/webgl-2-browser-compatibility/) · [WebGL vs WebGPU performance](https://www.volumeshader.dev/en/blog/webgl-vs-webgpu)
- [Cloudflare Pages — limites & tarifs 2026](https://www.devtoolreviews.com/reviews/cloudflare-pages-pricing-bandwidth-limits-2026) · [Comparatif Vercel / Netlify / Cloudflare 2026](https://www.devtoolreviews.com/reviews/vercel-vs-netlify-vs-cloudflare-pages-pricing-comparison-2026)
- [WebCodecs vs ffmpeg.wasm](https://burnsub.com/blog/webcodecs-vs-ffmpeg-wasm/) · [WebCodecs vs FFmpeg WASM — éditeurs vidéo navigateur](https://vidstudio.app/blog/webcodecs-vs-ffmpeg-wasm) · [mp4-wasm](https://github.com/mattdesl/mp4-wasm)
- [basementstudio/shader-lab](https://github.com/basementstudio/shader-lab) · [Codrops — Real-Time Dithering Shader](https://tympanus.net/codrops/2025/06/04/building-a-real-time-dithering-shader/) · [Codrops — Efecto : ASCII & dithering WebGL](https://tympanus.net/codrops/2026/01/04/efecto-building-real-time-ascii-and-dithering-effects-with-webgl-shaders/) · [Real-Time Pixel Sorting in the Browser (WebGPU)](https://lukecochrane.com/blog/pixel-sorting) · [Ditter](https://ditterstudio.com/)
- [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices) · [Claude Code power user tips](https://support.claude.com/en/articles/14554000-claude-code-power-user-tips)
- Code local analysé : `U.LAB/U.DITHER/app/web` (`modes.ts`, `presets.ts`, `StudioPage.ts`, `renderWorker.ts`) et `U.LAB/U.DITHER/app/api` (`udither_api`).
