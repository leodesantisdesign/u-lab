# U.LAB — Architecture de l'éditeur unique

> **Remplace intégralement la version précédente** de ce document (découpage en outils séparés, plan d'étapes 0→6).
> Complète et remplace aussi le §3 du brief (`U.LAB-BRIEF.md`).
> Juillet 2026 — v2.

---

## 1. Le renversement, en une phrase

**Avant :** N outils, N pages, N interfaces. L'utilisateur choisit un outil, subit son cadre, exporte, et recommence ailleurs s'il veut autre chose.

**Maintenant :** une galerie de modèles en entrée, **un éditeur unique** derrière. L'utilisateur charge une photo ou une vidéo, empile des modules, règle chacun d'eux, et exporte. Un module qu'on ajoute au catalogue devient immédiatement combinable avec tous les autres.

Ce que ça débloque concrètement :

| | Modèle « une page par outil » | Modèle éditeur unique |
|---|---|---|
| Enchaîner dither + grain | Exporter, recharger, refaire | Deux lignes dans la pile |
| Ajouter un procédé | Concevoir un écran complet | Un manifeste + un shader |
| Apprendre l'outil | Une fois par outil | Une fois, pour toujours |
| Cohérence visuelle | À maintenir à la main sur N écrans | Structurelle |
| Coût d'un module raté | Une page morte à maintenir | Une ligne retirée du registre |

**La règle « un procédé = une idée » ne saute pas** — elle descend au niveau du module. Un module `traitement.halftone` ne contient pas d'onglet « et aussi du dithering ». C'est plus strict qu'avant.

---

## 2. Ce qu'on a relevé chez Sketch, et ce qu'on en garde

Analyse de [tools.sketchdesign.club](https://tools.sketchdesign.club/) (inspection DOM/CSS + parcours de l'éditeur, juillet 2026).

**Leur mécanique, dans l'ordre :**

1. **Accueil** = « Start New Project » + galerie de modèles (17 vignettes animées). Les projets sont locaux ; le multi-projets est vendu en Premium.
2. **Éditeur** (`/#tools`), une seule surface :
   - **La pile**, centrée en haut : lignes empilables `icône + nom + [Changer] + [⋮]`, poignée de glissement à gauche, bouton `+` en dessous, reliée à l'aperçu par un fil vertical.
   - `[⋮]` ne propose que deux actions : **Cacher** et **Retirer**. Rien de plus.
   - `[Changer]` remplace le module par un autre de la même catégorie, en conservant sa position.
   - **L'inspecteur**, panneau flottant à gauche, déplaçable et fermable, avec deux onglets : **Commandes** et **Effets**. Il affiche le module sélectionné, et rien d'autre.
   - **Le modal « Outils »**, ouvert par `+` : trois colonnes — `ENTRÉES` (liste, choix unique, coche sur l'actif), `GÉNÉRATIF` et `FILTRES` (grilles de vignettes visuelles). Un module déjà présent apparaît grisé.
   - **L'aperçu**, étiquette de pile en haut à gauche, sélecteur de ratio en haut à droite, et sous lui : bascule d'affichage, Publier, **Exporter**.
   - **Le tiroir d'automation** en bas, replié par défaut : chaque ligne = `paramètre ciblé | source de modulation | sensibilité | plage de valeurs | piste sur la timeline`. La timeline est graduée **en temps et en mesures**. Une ligne en mode `Automation` affiche une vraie courbe à points.
   - **Qualité d'aperçu** en haut à gauche (Basse / Moyenne / Haute + images par seconde), assumée devant l'utilisateur.
3. **Export** : onglets Vidéo / Image, qualité (jusqu'à 4K), format, débit, images par seconde, durée, et une ligne d'info honnête — `Res 1.5K × 1.5K · Size 17.9 MB · Codec H.264 4.1`.

**Ce qu'on prend :** toute la mécanique ci-dessus. Elle est juste, éprouvée, et c'est exactement ce que Léo avait en tête.

**Ce qu'on ne prend pas :** le paywall, les exports comptés, le compte obligatoire, le filigrane, et leur domaine (audio-réactif génératif).

**Ce qu'on ajoute :**
- **Photo et vidéo comme sujet**, pas comme accessoire — sources image/vidéo/webcam de premier ordre, export vidéo déterministe.
- **Des signaux extraits du média** comme sources de modulation : luminance, mouvement, contraste. C'est l'équivalent de leur audio-réactivité, transposé à notre domaine — et personne ne le fait.
- **Des pages publiques par effet** (`/effets/halftone`) : démo, explication du procédé, exemples, puis « Ouvrir dans l'éditeur ». Surface de découverte et de référencement qu'un éditeur en SPA n'a pas.

---

## 3. Le modèle de document

C'est la pièce centrale. Tout le reste en découle : l'UI l'affiche, le moteur l'exécute, le fichier `.ulab` le sérialise, l'undo/redo en prend des instantanés.

```ts
type Project = {
  id: string
  name: string
  version: 1                       // version de schéma, pour la migration
  createdAt: number
  updatedAt: number

  format: { ratio: string; width: number; height: number }
  duration: number                 // en secondes ; 0 pour une image fixe
  fps: number

  stack: ModuleInstance[]          // index 0 = source, puis dans l'ordre de rendu
  modulations: Modulation[]
  media: MediaRef[]                // pointeurs vers les blobs stockés dans IndexedDB
}

type ModuleInstance = {
  id: string                       // uuid de l'instance
  type: string                     // 'traitement.halftone' — identifiant stable, jamais renommé
  enabled: boolean                 // « Cacher »
  params: Record<string, ParamValue>
  blend: { mode: BlendMode; opacity: number }   // commun à tous les modules non-source
}

type Modulation = {
  id: string
  enabled: boolean
  target: { moduleId: string; paramKey: string }
  source: ModSource
  sensitivity: number              // 0..1
  range: [number, number]          // remappage vers la plage utile du paramètre
}

type ModSource =
  | { kind: 'keyframes'; points: { t: number; value: number; ease: Ease }[] }
  | { kind: 'audio';  band: 'low' | 'mid' | 'high' | 'rms'; smoothing: number }
  | { kind: 'video';  signal: 'luma' | 'motion' | 'contrast'; region?: Rect }
```

**Trois principes à ne jamais enfreindre :**

1. **Le document est sérialisable en JSON, sans exception.** Aucune fonction, aucune texture, aucun handle GPU dedans. Les médias sont des références ; les blobs vivent dans IndexedDB.
2. **`type` et `paramKey` sont des contrats publics.** Ils sont écrits dans les fichiers `.ulab` des utilisateurs. On peut ajouter un paramètre, jamais en renommer un. Un changement cassant ⇒ `version` incrémentée + fonction de migration.
3. **Une seule source, en tête de pile.** Changer de source ne détruit pas le reste de la pile. C'est ce qui permet d'appliquer un modèle à sa propre photo en un clic — le geste le plus important du produit.

**Résolution d'un paramètre à l'instant `t` :**

```
valeur_finale = params[clé]  ⟶  si une modulation cible ce paramètre :
                                remap(source.échantillon(t) × sensibilité, range)
```

Le paramètre statique reste la valeur de repli. Désactiver une modulation restitue exactement la valeur réglée à la main — **ne jamais écraser `params` avec une valeur modulée.**

---

## 4. Le registre de modules

Un module se déclare, il ne se code pas.

```ts
export const halftone: ModuleDef = {
  type: 'traitement.halftone',
  category: 'traitement',
  name: 'Halftone',
  summary: 'Trame d\'impression : points, lignes, angle, fréquence.',
  thumbnail: './thumb.webp',
  params: [
    { key: 'frequency', label: 'Fréquence', type: 'number',
      min: 4, max: 200, step: 1, default: 40, unit: 'lpi' },
    { key: 'angle',     label: 'Angle',     type: 'number',
      min: 0, max: 180, step: 1, default: 45, unit: '°' },
    { key: 'shape',     label: 'Forme',     type: 'enum',
      options: ['point', 'ligne', 'losange', 'carré'], default: 'point' },
    { key: 'sharpness', label: 'Netteté',   type: 'number',
      min: 0, max: 1, step: 0.01, default: 0.5 },
  ],
  render: { kind: 'shader', fragment: halftoneFrag },
}
```

**`render.kind`** vaut `'shader'` (fragment WebGL2), `'worker'` (CPU, pour l'error diffusion) ou `'compute'` (WebGPU, pour le pixel sort). Le moteur route ; le module ne sait pas comment il est exécuté.

**Types de paramètre :** `number` (curseur), `enum` (select), `boolean` (interrupteur), `color`, `point` (deux valeurs, pincé sur l'aperçu), `curve`, `text`, `file`.

**Ce qu'un module n'a pas le droit de faire :** dessiner une interface, lire le store, déclencher un export, connaître les autres modules. S'il en a besoin, c'est que la capacité manque au moteur — elle remonte dans `packages/engine`, elle ne descend pas dans le module.

### Taxonomie (les trois colonnes du modal)

| Catégorie | Rôle | Modules |
|---|---|---|
| **SOURCE** | Produit l'image de départ. **Une seule à la fois**, en tête de pile. | Image · Vidéo · Webcam · Couleur / Dégradé · Texte |
| **TRAITEMENT** | Transforme la nature de l'image. C'est le cœur du labo. | Dither · Halftone · ASCII · Pixel sort · Pixellisation · Postérisation · Seuil · Palette / Duotone · Glitch |
| **FINITION** | Habille sans transformer. Cumulable sans limite. | Grain · Bruit · Scanlines · Vignette · Netteté · Aberration chromatique · Bloom · Courbes · Balance des couleurs |

La colonne SOURCE est une **liste à choix unique** (comme leurs `ENTRÉES`), les deux autres sont des **grilles de vignettes**. Un module déjà dans la pile apparaît grisé.

*Une quatrième catégorie **COMPOSITION** (masque, fusion de deux branches, transformation) est prévue mais **hors périmètre pour l'instant** : elle transforme la pile linéaire en graphe, et c'est un autre problème. À ne pas anticiper dans le code.*

---

## 5. Le pipeline de rendu

```
source ──▶ [texture]
             │
             ├─▶ module 1 ─▶ FBO A
             ├─▶ module 2 ─▶ FBO B      (ping-pong entre deux FBO)
             ├─▶ module 3 ─▶ FBO A
             │
             └─▶ écran (aperçu, résolution réduite)
                 ou readback (export, pleine résolution)
```

Une boucle, un quad plein écran, deux framebuffers qu'on alterne. Chaque module actif = une passe. Les modules `worker` sortent de la chaîne GPU le temps d'un aller-retour `ImageData` puis y rentrent comme texture.

**Règles de performance :**

- **L'aperçu tourne à résolution réduite** selon le sélecteur de qualité (Basse ≈ 512 px, Moyenne ≈ 1024 px, Haute = taille d'affichage). L'export ignore ce réglage et rend à pleine résolution.
- **On ne redessine que si quelque chose a changé** — sauf si la source est animée (vidéo, webcam) ou qu'une modulation est active. Une photo statique sans modulation ne doit pas consommer de GPU au repos.
- **Un module `worker` est *debouncé*** (~120 ms) : on ne relance pas l'error diffusion à chaque pixel de déplacement de curseur. Pendant le calcul, on affiche le résultat précédent — jamais un écran vide.
- **Les uniformes sont mis à jour, pas recompilés.** Un shader se compile une fois, au moment où le module entre dans la pile.

**Export vidéo (déterministe, pas de capture d'écran) :** pour chaque image `n`, on décode l'image source correspondante (`VideoDecoder`), on échantillonne toutes les modulations à `t = n / fps`, on rend à pleine résolution, on pousse le `VideoFrame` dans `VideoEncoder`, on muxe. Le résultat est identique quelle que soit la machine, et indépendant de la vitesse de rendu.

---

## 6. Découpage des paquets

| Paquet | Contient | Ne contient jamais |
|---|---|---|
| `core` | Types du document, store réactif, historique undo/redo, sérialisation `.ulab`, persistance IndexedDB, migrations de schéma | Du WebGL, du DOM |
| `engine` | Contexte WebGL2/WebGPU, ping-pong FBO, gestion des sources, boucle de rendu, readback, exécution des workers | La connaissance d'un module particulier |
| `modules` | Un dossier par module : manifeste, shader, vignette. Plus l'index du registre | De l'UI, de l'état, de l'export |
| `modulation` | Échantillonnage des keyframes, analyse audio (`AnalyserNode` / hors-ligne), extraction des signaux vidéo, résolution `paramètre × t → valeur` | Du rendu |
| `palette` | Palettes nommées et quantification, partagées par dither, halftone, ASCII et duotone | Du rendu, de l'UI |
| `ui` | Design system + inspecteur généré depuis les manifestes + surfaces de l'éditeur | De la logique métier |
| `export` | Image (`toBlob`) et vidéo (WebCodecs, muxer, fallback) | Du rendu (il appelle `engine`) |

**Sens des dépendances :** `ui → core`, `engine → core`, `modulation → core`, `export → engine + core`, `modules → palette` (et rien d'autre). **Aucun cycle.** `modules` ne dépend de rien qui bouge : c'est ce qui garantit qu'un module reste une déclaration.

---

## 7. Plan d'étapes

L'ancien plan (0→6) est caduc. Le nouveau :

**Étape 0 — Fondations** ✅ *terminée.* Monorepo pnpm, app Astro, déploiement Cloudflare Pages.

**Étape 1 — La coquille de l'éditeur, sans moteur.** Modèle de document + store, et l'écran `/create` complet en statique : pile, inspecteur généré, modal de modules, aperçu, tiroir d'automation replié, barre d'export. Une image en dur dans l'aperçu. → `docs/ETAPE-1.md`

*Pourquoi sans moteur : la mécanique **est** le produit. Il faut la sentir dans un vrai navigateur avant de câbler du GPU dessus. Si l'enchaînement des gestes ne va pas, ça se corrige en dix minutes à ce stade, et en trois jours après.*

**Étape 2 — Le moteur et trois modules.** WebGL2, ping-pong, `source.image`, `traitement.halftone`, `finition.grain`. Le premier vrai rendu, et la preuve que le manifeste suffit à générer l'UI.

**Étape 3 — Les projets.** IndexedDB, accueil « mes projets », modèles, import/export `.ulab`, undo/redo. À partir de là, U.LAB est utilisable.

**Étape 4 — La vidéo.** `source.video`, lecture image par image, durée et timeline, export WebCodecs avec fallback WebM.

**Étape 5 — La modulation.** Keyframes d'abord, puis les signaux vidéo, puis l'audio. C'est la fonctionnalité qui fait dire « ah, d'accord ».

**Étape 6 — Le catalogue.** Les modules restants, puis les pages `/effets/[slug]`.

**Règle inchangée :** on ne démarre pas une étape sans que la précédente soit déployée et vérifiable en ligne. Un éditeur livré et beau > cinq à moitié faits.

---

## 8. Les pièges connus de cette architecture

- **Le manifeste qui ne suffit plus.** Un jour, un module aura besoin d'un contrôle qui n'existe pas (une courbe éditable, un sélecteur de zone). Réflexe correct : **ajouter un type de paramètre** au vocabulaire commun. Réflexe interdit : laisser ce module dessiner son propre panneau — c'est par là que l'architecture se défait.
- **La pile linéaire.** Elle ne fait pas de branches ni de masques. C'est un choix, pas un oubli. Le jour où il faut vraiment des branches, c'est une refonte assumée en graphe — pas un `if` glissé dans le pipeline.
- **La vidéo change tout le calcul de perf.** Un module qui tient 60 fps sur une photo peut s'effondrer sur une vidéo 4K. Mesurer sur vidéo dès l'étape 4, pas après avoir écrit dix modules.
- **L'error diffusion sur vidéo.** Séquentielle, donc CPU, donc lente, et en plus instable d'une image à l'autre (le bruit « grouille »). Prévoir un bruit bleu figé comme option de stabilisation, et l'assumer comme une limite documentée si ça ne tient pas.
- **IndexedDB a des quotas.** Une vidéo source de 500 Mo dans un projet, et le navigateur commence à refuser. Prévoir un message honnête et une option « lier le fichier sans le copier ».

---

## Sources

- Analyse directe de [tools.sketchdesign.club](https://tools.sketchdesign.club/) — DOM, CSS et parcours complet de l'éditeur (galerie, pile, modal Outils, inspecteur, tiroir d'automation, modal d'export), juillet 2026.
- [Astro vs SvelteKit vs Next.js 2026](https://www.pkgpulse.com/guides/nextjs-vs-astro-vs-sveltekit-2026) · [WebGPU Browser Support 2026](https://webo360solutions.com/blog/webgpu-browser-support/) · [Cloudflare Pages — limites & tarifs 2026](https://www.devtoolreviews.com/reviews/cloudflare-pages-pricing-bandwidth-limits-2026)
- [WebCodecs vs ffmpeg.wasm](https://burnsub.com/blog/webcodecs-vs-ffmpeg-wasm/) · [mp4-wasm](https://github.com/mattdesl/mp4-wasm)
- [basementstudio/shader-lab](https://github.com/basementstudio/shader-lab) — modèle de chaîne d'effets à étudier avant d'écrire `packages/engine`.
- [Codrops — Real-Time Dithering Shader](https://tympanus.net/codrops/2025/06/04/building-a-real-time-dithering-shader/) · [Codrops — ASCII & dithering WebGL](https://tympanus.net/codrops/2026/01/04/efecto-building-real-time-ascii-and-dithering-effects-with-webgl-shaders/) · [Real-Time Pixel Sorting (WebGPU)](https://lukecochrane.com/blog/pixel-sorting)
- Code local de référence : `_legacy/u-dither-v1/` (`modes.ts`, `presets.ts`) — algorithmes, palettes et vocabulaire des paramètres à réimplémenter proprement.
