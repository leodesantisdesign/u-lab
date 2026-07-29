# Étape 2 — Le moteur, et un catalogue qui tient debout

> Objectif : **le premier vrai pixel**. `/create` charge une photo, la trame, l'habille, et exporte un PNG à pleine résolution. À la fin, U.LAB fait tout ce que faisait u.dither v1 **de vraiment utile** — avec huit modules au lieu de dix-sept, et chacun défendable en une phrase.
> Prérequis : étape 1.5 fusionnée dans `main` · avoir lu **`docs/U.LAB-TRAMAGE.md`** (le sujet et le tri), `CLAUDE.md` §2 et §4, `docs/U.LAB-ARCHITECTURE.md` §4, §5, §6.
> Découpée en **deux vagues** ; la première est livrable seule.

---

## 1. Où on en est vraiment

L'étape 1.5 a tenu sa promesse : le store est l'unique propriétaire du document, un geste = une entrée d'historique, la pile se réordonne au doigt et au clavier, le modal d'export existe, le mouvement respecte `prefers-reduced-motion`. Rien de tout ça n'est à refaire.

Il reste **quatre dettes**, toutes petites, toutes sur le chemin du moteur. Réglées au prompt 0, pas plus tard :

| # | Dette | Pourquoi ça bloque l'étape 2 |
|---|---|---|
| 1 | `apps/lab/src/pages/index.astro` est encore le placeholder de l'étape 0 | Le prompt 6 de l'étape 1.5 n'a pas été fait. Personne ne peut atteindre l'éditeur sans taper l'URL. |
| 2 | `ratio` est un `$state` local d'`Editor.svelte`, doublon de `project.format.ratio` | Après un `Ctrl+Z` sur un changement de ratio, le document recule mais l'écran ne suit pas. Le moteur lira `project.format` : deux vérités = un bug garanti. |
| 3 | `instanceWithDefaults()` et `buildDefaults()` font la même chose | Deux endroits où les valeurs par défaut peuvent diverger. |
| 4 | `FileDrop` ne remonte que `file.name` — le `File` est jeté | Le moteur a besoin du blob. Réglé au prompt 3. |

**Ce qui n'existe pas encore du tout :** `packages/engine`, `packages/export` et `packages/palette` sont des dossiers vides, sans `package.json`. Les treize manifestes déclarent tous `fragment: '// TODO(Étape 2)'`.

---

## 2. Le catalogue de l'étape 2 : huit modules, pas dix-sept

Le raisonnement complet est dans **`docs/U.LAB-TRAMAGE.md`**. Le résumé opérationnel :

Halftone, Bayer et Dither ne sont pas trois variantes du même effet. Ce sont **trois réponses historiquement distinctes** à la même question — l'imprimerie de 1880 (points de taille variable sur grille fixe), l'écran ordonné de 1973 (matrice de seuils), la diffusion d'erreur de 1976/84 (grain organique). Le catalogue doit rendre cette distinction évidente, et ne rien y mélanger.

Le critère qui a servi au tri, et qui servira à tous les suivants : **le test des 8 secondes** — un module entre s'il se voit dans une boucle Instagram de huit secondes, sur un téléphone, par quelqu'un qui ne connaît pas l'outil.

### Ce qu'on livre

| Catégorie | Module | Paramètres |
|---|---|---|
| **SOURCE** | `source.image` | fichier |
| **TRAITEMENT** | `traitement.halftone` | cellSize · dotSize · shape · angle · invert · palette |
| | `traitement.bayer` | matrix · scale · levels · invert · palette |
| | `traitement.dither` | algorithm · levels · invert · palette |
| | `traitement.posterisation` | levels |
| | `traitement.pixelisation` | cellSize · shape |
| **FINITION** | `finition.reglages` | luminosité · contraste · gamma · saturation |
| | `finition.grain` | intensité |

Vingt-quatre curseurs pour tout le catalogue. C'est le chiffre à défendre.

### Ce qui est retiré, et pourquoi

| Retiré | Raison |
|---|---|
| `finition.bruit`, `finition.nettete` | Ne passent pas le test des 8 secondes. La netteté est une correction, pas un procédé. Le « bruit » était une distinction inventée : le grain suffit. |
| `finition.vignette` | Cliché de filtre photo, hors sujet (voir U.LAB-TRAMAGE §3). |
| `finition.bloom`, `finition.scanlines`, `finition.aberration` | Famille **CRT / vidéo analogique** — cohérente entre elle, incohérente avec la trame. Reportée **en bloc** à l'étape 6, où elle formera un ensemble qui a du sens. |
| `traitement.ascii` | Troisième famille à part entière (substitution de glyphes, 1939). Demande un atlas de glyphes fait correctement. Un ASCII à moitié est pire que pas d'ASCII. → étape 6, avec sa page `/effets`. |
| `contrast`, `brightness`, `gamma` **dans** les modules de tramage | Un module de tramage qui corrige aussi les tons est un fourre-tout (règle 1). La correction de tons a désormais **un seul endroit** : `finition.reglages`. Bénéfice secondaire : ça enseigne l'ordre de la pile en trente secondes. |
| `colorMode` (mono/source/rgb), `serpentine`, `minDot`, `jitter`, `stretch`, matrices « croix/losange/lignes » | Réglages d'expert ou variantes décoratives. `mono` + palette couvre `colorMode` ; le balayage serpentin est câblé en dur (activé) parce qu'il est simplement meilleur ; les trois matrices non-Bayer n'étaient pas des matrices de Bayer. |
| L'éditeur de palette personnalisée | Une UI entière, et la porte ouverte au moche. Six palettes signées valent mieux (voir prompt 7). |

**Ce sont des reports, pas des renoncements.** Ils sont listés ici pour qu'on n'ait pas à re-débattre à chaque étape.

### Ce qui reste dehors, et le reste dehors

- **La vidéo** → étape 4. `source.video` et `source.webcam` restent grisés avec la mention « bientôt ».
- **La modulation** → étape 5. Le tiroir reste une coquille ; aucune valeur modulée ne traverse le moteur.
- **IndexedDB et les projets** → étape 3. Les médias vivent **en mémoire** ; recharger perd la photo, et l'UI le dit franchement.
- **L'accueil, la galerie, les pages `/effets`, la ligne éditoriale** → après l'étape 3. Le prompt 0 rend seulement l'éditeur atteignable.

---

## 3. Les contrats techniques

**Cette section est la plus importante du document.** Tout ce qui n'y est pas écrit sera inventé, et une invention dans un contrat de rendu se paye à chaque module suivant. À coller dans les prompts, pas à résumer.

### 3.1 Ce qu'un module fournit — le contrat shader

Un module `render.kind === 'shader'` ne fournit **pas** un fragment shader complet. Il fournit **une seule fonction** :

```glsl
vec4 ulab_main(vec4 src, vec2 uv) {
  // src : le pixel entrant (sortie de la passe précédente ; ignoré par une source)
  // uv  : coordonnées 0..1, origine en bas à gauche
  // retour : la couleur produite, non fusionnée — le moteur s'occupe du blend
}
```

Pas de `#version`, pas de `precision`, pas de `void main`, **pas de déclaration d'uniforme**. Le moteur assemble le programme complet autour de cette fonction. Conséquence directe : un shader ne peut pas diverger de son manifeste, puisqu'il ne déclare pas ses propres entrées.

**Uniformes fournis par le moteur, toujours présents :**

```glsl
uniform sampler2D uSource;    // passe précédente, ou la texture source
uniform vec2  uResolution;    // taille du rendu courant, en px
uniform vec2  uTexel;         // 1.0 / uResolution
uniform float uScale;         // uResolution.x / project.format.width  — voir §3.7
uniform float uTime;          // secondes
uniform int   uFrame;
uniform float uSeed;          // stable pour une instance de module donnée
in  vec2 vUv;
out vec4 fragColor;           // écrit par le moteur, pas par le module
```

**Uniformes générés depuis le manifeste**, un par paramètre, nommés `u_<key>` :

| `ParamDef.type` | Uniforme GLSL | Remarque |
|---|---|---|
| `number` | `uniform float u_<key>;` | valeur brute, jamais normalisée par le moteur |
| `boolean` | `uniform bool u_<key>;` | |
| `enum` | `uniform int u_<key>;` | **index dans `options[]`** |
| `color` | `uniform vec3 u_<key>;` | sRGB 0..1 |
| `point` | `uniform vec2 u_<key>;` | |
| `palette` | `uniform vec3 u_<key>[16];` + `uniform int u_<key>_count;` | nouveau type, §3.4 |
| `text`, `file` | — | jamais transmis à un shader |

> **Règle à inscrire au journal :** l'ordre des `options` d'un paramètre `enum` est un **contrat public**, au même titre que la clé. Un enum se complète par la fin, jamais par le milieu. Réordonner, c'est changer silencieusement le sens de tous les `.ulab` existants.

### 3.2 Le blend, c'est l'affaire du moteur

Le moteur enveloppe chaque module dans le même épilogue :

```glsl
void main() {
  vec4 src = texture(uSource, vUv);
  vec4 res = ulab_main(src, vUv);
  fragColor = ulab_blend(src, res, u_blendMode, u_blendOpacity);
}
```

`ulab_blend` implémente les six modes de `BlendMode` (`normal`, `multiply`, `screen`, `overlay`, `difference`, `add`) puis interpole vers `src` selon l'opacité. Un module qui gère lui-même son opacité est un module à corriger. Les modules de catégorie `source` sont **exemptés** : ils écrivent `res` directement.

### 3.3 Ce qu'un module Worker fournit

```ts
// packages/modules/src/<module>/worker.ts
export default function process(
  input: ImageData,
  params: Record<string, ParamValue>,
  ctx: { seed: number; time: number; scale: number },
): ImageData
```

Le moteur s'occupe du reste : lecture du framebuffer courant, transfert, réinjection en texture, *debounce* de 120 ms, et affichage du **résultat précédent** pendant le calcul — jamais un écran vide, jamais un clignotement.

### 3.4 Le nouveau type de paramètre : `palette`

L'architecture §8 le dit : quand un module a besoin d'un contrôle qui n'existe pas, **on enrichit le vocabulaire commun**, on ne laisse pas le module dessiner son panneau.

Et il y a une raison de fond, expliquée dans `U.LAB-TRAMAGE.md` §5 : **la diffusion d'erreur doit connaître la palette cible pour calculer son erreur**. Dithérer en gris puis mapper la palette après coup produit des bandes et annule l'intérêt de l'algorithme. La palette est donc un paramètre du tramage, jamais un module qui vient après.

```ts
export type PaletteParamDef = ParamCommon<'palette'> & {
  default: string;   // nom d'une palette de @ulab/palette, ou 'aucune'
};
```

- `packages/palette` expose les palettes nommées et la quantification.
- `packages/ui` rend un `PaletteField.svelte` avec les échantillons de couleur.
- `packages/engine` résout le nom en `vec3[16]` + un compte, et l'envoie en uniforme.
- `packages/modules` importe `@ulab/palette` — **sa seule dépendance autorisée** (architecture §6).

Palette `aucune` ⇒ `u_<key>_count = 0`, le shader garde les niveaux de gris. Pas de branche spéciale ailleurs.

### 3.5 L'API du moteur

```ts
// packages/engine/src/index.ts
export type ModuleResolver = (type: string) => RenderableModule | undefined;
export type MediaResolver  = (id: string) => ImageBitmap | undefined;

export function createRenderer(canvas: HTMLCanvasElement, opts: {
  resolveModule: ModuleResolver;
  resolveMedia: MediaResolver;
}): Renderer;

export interface Renderer {
  setProject(project: Project): void;   // marque sale, ne dessine pas
  setQuality(maxSide: number): void;
  start(): void;                        // boucle paresseuse
  stop(): void;
  renderToBitmap(project: Project, size: { width: number; height: number }): Promise<ImageBitmap>;
  dispose(): void;
}
```

**Le moteur ne connaît aucun module en particulier.** Il reçoit un `resolveModule` injecté. Il peut importer des **types** depuis `@ulab/modules` (`import type` uniquement — aucun import de valeur, donc aucun cycle à l'exécution). C'est la seule entorse tolérée, et elle est documentée ici.

### 3.6 Les règles de performance, en dur dans le code

- **Boucle paresseuse.** On ne dessine que si `dirty === true`, ou si la pile contient une source animée. Une photo statique au repos = **zéro `requestAnimationFrame` actif**.
- **Invalidation en un point.** `Editor.svelte` fait `$effect(() => renderer.setProject(store.project))`. C'est tout. Aucune écoute ailleurs. C'était toute la raison d'être de l'étape 1.5.
- **Qualité d'aperçu :** Basse = 512 px de plus grand côté, Moyenne = 1024, Haute = taille CSS × `devicePixelRatio`, plafonnée à `project.format`. L'export **ignore** ce réglage.
- **Un programme compilé une fois par type de module**, mis en cache. Les uniformes se mettent à jour, ils ne se recompilent pas.
- **Deux FBO alternés**, réalloués seulement quand la taille du rendu change.
- **Espace colorimétrique :** sRGB 8 bits de bout en bout, sans gestion de couleur. Les procédés visés sont des effets de surface ; le linéaire n'ajouterait qu'une couche d'erreurs possibles. À réévaluer le jour où on fait du bloom crédible.

### 3.7 L'échelle du trame — la règle qu'on oublie et qui se voit

**Toute grandeur spatiale d'un module est exprimée en pixels du document, jamais en pixels de rendu.**

Une cellule de 18 px sur un document de 4000 px n'a rien à voir avec 18 px sur un aperçu de 800 px. Sans compensation, **l'aperçu ment** : on règle une trame fine, on exporte une trame grossière. C'est l'erreur la plus facile à commettre et la plus visible.

D'où l'uniforme `uScale = uResolution.x / project.format.width`. Tout shader qui manipule une taille en pixels (halftone, pixellisation, grain) la multiplie par `uScale`. Le chemin Worker reçoit la même valeur dans `ctx.scale`.

**Conséquence assumée :** un dither en diffusion d'erreur ne peut *pas* être mis à l'échelle ainsi — sa maille est le pixel lui-même. En qualité Basse, la texture d'un dither sera donc plus grossière qu'à l'export. C'est inhérent à l'algorithme, pas un bug : on le documente dans l'UI (une ligne sous le sélecteur de qualité) plutôt que de faire semblant.

---

## 4. Le geste à obtenir à la fin

Test de recette. Tous les gestes de l'étape 1.5 doivent toujours passer, **plus ceux-ci** :

**Après la vague A :**

1. Tu déposes une photo dans le paramètre **Fichier** de la source. Elle apparaît dans l'aperçu, à l'endroit, au bon ratio.
2. Tu ajoutes **Halftone**. La photo se trame. Immédiatement, pas après un temps de chargement.
3. Tu traînes **Taille de cellule** d'un bout à l'autre. L'aperçu suit le curseur sans à-coups.
4. Tu ajoutes **Grain**. Il se superpose sans effacer la trame.
5. Tu passes Grain **au-dessus** de Halftone. Le rendu change. Tu le remets : il revient exactement.
6. Tu caches Halftone (`⋮` → Cacher). La photo redevient nette. Tu le réaffiches : la trame revient avec ses réglages.
7. `Ctrl+Z` après un réglage de curseur : l'aperçu revient à la valeur précédente. L'annulation et le rendu sont d'accord.
8. Tu exportes. Tu obtiens un PNG **à la taille du document**, pas à celle de l'aperçu.
9. **Tu compares l'aperçu et l'export côte à côte : la trame a la même finesse.** C'est le test de `uScale` (§3.7), et c'est celui qu'on rate.
10. Tu laisses l'onglet ouvert une minute sans rien toucher. Le ventilateur reste silencieux.

**Après la vague B :**

11. Tu remplaces Halftone par **Bayer**, matrice 8×8, 2 niveaux. Tu retrouves la trame géométrique des écrans 1 bit.
12. Tu passes à **Dither** (Atkinson). La texture devient organique, sans grille — et la différence avec Bayer **saute aux yeux**. Si elle ne saute pas aux yeux, un des deux shaders est faux.
13. Tu appliques la palette **Game Boy**. Quatre couleurs, pas une de plus.
14. Tu empiles **Réglages → Dither → Grain**. Tu montes le contraste dans Réglages : le dither change complètement de caractère. C'est la leçon que la pile est censée donner.
15. Tu fais la même chose sur ton téléphone. C'est plus lent, mais rien ne casse et rien ne fond.
16. **Tu filmes huit secondes de manipulation.** Si ça ne se voit pas, on a raté le tri, pas le code.

---

## 5. Avant de commencer

```bash
git checkout main && git pull
git checkout -b etape-2
pnpm install
pnpm --filter @ulab/core test
pnpm build
```

**On part d'un vert connu.** Si l'un des deux échoue, on répare avant d'écrire une ligne de moteur — pas pendant.

---

## Vague A — le moteur

### Prompt 0 — Les dettes de l'étape 1.5

```
Trois corrections courtes avant d'attaquer le moteur. Lis d'abord
apps/lab/src/components/Editor.svelte et apps/lab/src/pages/index.astro.

1. apps/lab/src/pages/index.astro est resté le placeholder de l'étape 0.
   Sans refaire la galerie de modèles (elle viendra plus tard) : le logo,
   la phrase de positionnement, un lien vers /create. Statique, zéro JS,
   uniquement les tokens de packages/ui/src/tokens.css. Aucune couleur ni
   taille en dur.

2. Dans Editor.svelte, `ratio` est un $state local qui double
   project.format.ratio. Résultat : un Ctrl+Z sur un changement de ratio
   fait reculer le document sans que l'écran suive. Supprime l'état local.
   Le ratio affiché se dérive de store.project.format.ratio, et le
   sélecteur appelle store.setFormat(). Même traitement pour la taille
   passée à PreviewFrame : elle vient de store.project.format, pas de la
   table RATIOS.
   `quality` et `showBefore` restent locaux — ce sont des états
   d'affichage, ils n'ont rien à faire dans le document.

3. instanceWithDefaults() et buildDefaults() font la même chose. Garde
   buildDefaults(type) comme fonction unique et construis le projet
   initial à partir d'elle.

Puis `pnpm build` et montre-moi le résultat.
```

**Tu vérifies :** change le ratio, `Ctrl+Z`. Le sélecteur ET le cadre d'aperçu reviennent en arrière ensemble.

---

### Prompt 1 — Le squelette du moteur

Le prompt fondateur. Il ne produit encore aucun pixel intéressant, et c'est normal.

```
Lis docs/U.LAB-ARCHITECTURE.md §5 et §6, docs/ETAPE-2.md §3 (les contrats
techniques — ils font foi, ne les réinterprète pas), et
packages/modules/src/types.ts.

Crée packages/engine (package.json "@ulab/engine", tsconfig aligné sur
packages/core, TypeScript strict, aucune dépendance runtime).

Contenu :

1. src/gl.ts — contexte WebGL2 (antialias: false, preserveDrawingBuffer:
   false, alpha: true), compilation et cache de programmes, erreurs de
   compilation remontées avec le log GLSL ET le type du module fautif.

2. src/quad.ts — un seul triangle plein écran (pas un quad à deux
   triangles), vertex shader fourni par le moteur, sortie vUv en 0..1
   origine bas-gauche.

3. src/program.ts — l'assembleur décrit en §3.1 : préambule
   (#version 300 es, precision highp float, in/out, uniformes moteur dont
   uScale) + uniformes générés depuis ModuleDef.params + ulab_blend + le
   corps ulab_main du module + l'épilogue main() de §3.2. Les modules de
   catégorie 'source' sautent le blend.
   Un test unitaire vérifie que l'assemblage d'un manifeste connu produit
   les déclarations attendues (comparaison de chaînes, pas de GPU).

4. src/pipeline.ts — ping-pong entre deux FBO (RGBA8, LINEAR, CLAMP),
   réalloués uniquement quand la taille du rendu change. Une passe par
   module actif (enabled === true), dans l'ordre de la pile. La dernière
   passe est dessinée dans le canevas.

5. src/renderer.ts — l'API publique exacte de §3.5. Boucle PARESSEUSE :
   un drapeau dirty, un seul requestAnimationFrame programmé quand il y a
   quelque chose à dessiner, aucun rAF actif au repos. Vérifie-le en
   instrumentant, et dis-moi comment tu l'as vérifié.

Contraintes :
- packages/engine ne connaît aucun module en particulier : il reçoit
  resolveModule et resolveMedia. `import type` depuis @ulab/modules
  autorisé, import de valeur interdit.
- Aucune référence au DOM en dehors du canevas passé en argument.
- Les erreurs WebGL ne remontent jamais en silence : contexte perdu ou
  indisponible ⇒ état d'erreur exploitable par l'UI.

Ne branche encore rien sur l'UI. Fais tourner build et tests.
```

---

### Prompt 2 — Les trois premiers shaders

```
Lis docs/ETAPE-2.md §3.1, §3.2 et §3.7, puis docs/U.LAB-TRAMAGE.md §2.1
(ce qu'est un halftone, et pourquoi il a une grille et un angle) AVANT
d'écrire une ligne de GLSL.

Écris le corps `vec4 ulab_main(vec4 src, vec2 uv)` de trois modules, dans
un shader.glsl à côté de chaque manifeste, importé en ?raw et placé dans
render.fragment à la place du TODO.

1. source.image — échantillonne uSource (le moteur y aura lié la texture
   du média), cadrage "contain" calculé depuis uResolution et le ratio de
   la texture. Sans média : un damier neutre discret, pas un écran noir,
   pas un message.

2. traitement.halftone — trame d'impression AM : rotation des
   coordonnées selon l'angle, grille de cellules, distance au centre de
   cellule comparée à la luminance locale. Le lissage des bords se fait
   en smoothstep, jamais par un seuil dur : un seuil dur crénelle et ça
   se verra à l'export.
   cellSize est en pixels du DOCUMENT : multiplie par uScale (§3.7).

3. finition.grain — bruit monochrome déterministe, hash sur gl_FragCoord
   et uSeed, taille de grain mise à l'échelle par uScale. À intensité 0,
   la sortie doit être BIT POUR BIT identique à l'entrée.

Mets à jour packages/modules/src/traitement-halftone/manifest.ts.
Paramètres finaux, et rien de plus :

  cellSize  Taille de cellule  number 4..80   pas 1  défaut 18  unité px
  dotSize   Taille du point    number 20..130 pas 1  défaut 96  unité %
  shape     Forme              enum ['rond','carré','losange','ligne']  défaut 'rond'
  angle     Angle              number 0..180  pas 1  défaut 45  unité °
  invert    Inverser           boolean défaut false

'frequency' et 'sharpness' disparaissent : la taille de cellule en pixels
est plus prévisible qu'une fréquence en lpi, et c'est le vocabulaire des
utilisateurs de u.dither. 'ligne' entre dans les formes parce que la
trame à lignes est la trame historique (Meisenbach, 1882) et la plus
graphique. minDot, jitter, stretch, roundness, gamma, contrast et
colorMode du legacy ne reviennent PAS — voir docs/ETAPE-2.md §2.
Le paramètre 'palette' arrive en vague B.

C'est la DERNIÈRE fenêtre pour changer une clé : à partir de l'étape 3 il
existe des .ulab et les clés sont gelées. Note le changement dans
CLAUDE.md §7.
```

---

### Prompt 3 — Les médias, pour de vrai

```
Aujourd'hui packages/ui/src/components/FileDrop.svelte ne remonte que
file.name : le File est jeté. Le moteur a besoin du blob.

1. packages/core — ajoute src/media.ts :
   - class MediaStore : Map<string, { blob: Blob; bitmap: ImageBitmap }>,
     add(file: File): Promise<MediaRef> (décode via createImageBitmap),
     get(id), revoke(id), clear().
   - Le store de document gagne addMedia(ref) et removeMedia(id) — le
     document ne contient QUE des MediaRef, jamais un blob, jamais un
     ImageBitmap (architecture §3, principe 1).
   - En mémoire uniquement à cette étape. IndexedDB = étape 3. Écris-le
     en commentaire en tête du fichier.

2. packages/ui — FileDrop expose onFile(file: File) au lieu d'écrire
   file.name dans la valeur. Il affiche le nom du média courant, résolu
   depuis une propriété `mediaName`. ParamRow et Inspector transmettent,
   ils ne décident pas.

3. apps/lab/src/components/Editor.svelte — sur onFile : MediaStore.add,
   store.addMedia(ref), puis store.setParam(instanceId, key, ref.id).
   Un seul geste, une seule entrée d'historique.
   Refuse proprement un fichier non-image (message dans l'UI, pas une
   exception dans la console) et un fichier > 40 Mo.

4. Un message honnête et discret sous l'aperçu tant qu'IndexedDB n'existe
   pas : "Les médias ne sont pas encore enregistrés : recharger la page
   les perd." Pas de modal, pas d'alerte — une ligne en --ink-faint.

Tests dans @ulab/core : le document ne contient jamais autre chose que
des MediaRef ; JSON.stringify(project) reste valide après ajout d'un
média.
```

---

### Prompt 4 — Le canevas dans l'aperçu

Le prompt qui allume la lumière.

```
Branche le moteur sur l'écran.

1. packages/ui/src/components/PreviewFrame.svelte — accepte un canevas en
   enfant sans changer sa structure : étiquette de pile, sélecteur de
   ratio, dimensions et impulsion de bordure restent EXACTEMENT tels
   quels. Le canevas remplit .preview-frame__content en object-fit
   contain, image-rendering: pixelated.

2. apps/lab/src/components/Editor.svelte :
   - crée le Renderer dans un $effect avec nettoyage (dispose au
     démontage et à chaud en dev) ;
   - resolveModule = byType de @ulab/modules, resolveMedia = MediaStore ;
   - UNE seule invalidation :
     $effect(() => renderer.setProject(store.project)).
     Aucune autre écoute, nulle part. Si tu en veux une deuxième, c'est
     que quelque chose modifie le document en dehors du store — dis-le
     moi au lieu de la rajouter ;
   - le sélecteur de qualité appelle renderer.setQuality(512 | 1024 |
     taille CSS × devicePixelRatio), et une ligne discrète sous le
     sélecteur prévient que la texture d'un dither dépend de la
     résolution de rendu (§3.7) ;
   - remplace l'<img src="/placeholder.svg"> par le canevas ;
   - si WebGL2 est indisponible : message clair dans le cadre d'aperçu,
     reste de l'interface utilisable.

3. Le bouton "Avant / après" affiche la source seule, sans reconstruire le
   pipeline : on rend la pile tronquée à son premier module. Pas de
   deuxième canevas.

Mesure et dis-moi : le nombre de rAF par seconde avec une photo statique
sans rien toucher (attendu : 0), et le temps d'une passe halftone en
1024×1024 sur ta machine.
```

**Tu vérifies :** les gestes 1 à 7 du test de recette. C'est le moment où U.LAB existe. Prends une capture, garde-la.

---

### Prompt 5 — L'export image

```
Crée packages/export ("@ulab/export", dépend de @ulab/engine et
@ulab/core, de rien d'autre).

1. src/image.ts — exportImage(project, { resolveModule, resolveMedia },
   { width, height, format: 'png' | 'jpeg' | 'webp', quality }): Promise<Blob>
   Rend hors écran, à PLEINE résolution (project.format), sur un canevas
   dédié — jamais en agrandissant l'aperçu. Le réglage de qualité
   d'aperçu est ignoré, sans exception. uScale vaut donc exactement 1 à
   l'export : vérifie-le, c'est le test du geste 9.

2. src/filename.ts — nom proposé :
   ulab-<nom-de-projet-en-kebab>-<AAAAMMJJ-HHMM>.<ext>

3. Branche packages/ui/src/components/ExportModal.svelte : le bouton
   Télécharger devient actif dans l'onglet Image. L'onglet Vidéo reste
   désactivé, infobulle "disponible à l'étape 4".
   Pendant le rendu : bouton en état occupé, le modal ne se ferme pas
   tout seul.
   La ligne d'information (résolution · poids · format) est maintenant
   CALCULÉE sur le blob réel une fois l'export fait — plus une
   estimation. C'est exactement l'honnêteté qu'on vend.

Vérifie sur une photo 4000×3000 en 1:1 : le PNG fait la taille du
document, la trame a la même finesse que dans l'aperçu, et l'onglet ne
fige pas plus d'une seconde (si ça fige, dis-le-moi plutôt que d'ajouter
un worker en douce).
```

---

### Prompt 6 — Fin de vague A

```
Avant de committer :
- pnpm build passe sur tout le workspace
- les tests de @ulab/core et @ulab/engine passent
- aucun `if (module.type === ...)` en dehors du registre
- aucune couleur, taille ni durée en dur dans les composants
- packages/modules ne dépend d'aucun paquet (la palette arrive en vague B)
- le sens des dépendances de l'architecture §6 est respecté : liste-moi
  les imports croisés entre paquets
- photo statique, rien qui bouge : zéro rAF actif

Mets à jour CLAUDE.md :
- §6 : étape 2 vague A terminée — moteur WebGL2, source.image,
  traitement.halftone, finition.grain, export image
- §7 : ajoute au journal —
  · "Contrat shader : un module fournit vec4 ulab_main(vec4 src, vec2 uv)
    et RIEN d'autre. Le moteur assemble le programme, déclare les
    uniformes depuis le manifeste et applique le blend. Décision négative
    associée : un module n'écrit jamais son propre void main()."
  · "L'ordre des options d'un paramètre enum est un contrat public au
    même titre que la clé : on complète par la fin, jamais par le milieu."
  · "Toute grandeur spatiale est en pixels du DOCUMENT, mise à l'échelle
    au rendu par l'uniforme uScale. Sans ça l'aperçu ment sur la finesse
    de la trame. Limite documentée : la diffusion d'erreur ne peut pas
    être mise à l'échelle, sa maille est le pixel."
  · "Espace colorimétrique sRGB 8 bits de bout en bout, sans gestion de
    couleur."
  · "Halftone : paramètres réduits à cellSize, dotSize, shape, angle,
    invert (+ palette en vague B). 'frequency'/'sharpness' supprimés
    avant tout gel des clés."

Commit ("feat: le moteur WebGL2 et les trois premiers modules branchés")
et pousse la branche.
```

**Tu vérifies : la preview Cloudflare, sur ton téléphone, avec une vraie photo.** On ne démarre pas la vague B avant.

---

## Vague B — les trois familles de tramage

### Prompt 7 — Le paquet palette et le type de paramètre `palette`

```
Lis docs/U.LAB-TRAMAGE.md §5 (pourquoi la palette est un paramètre et pas
un module), docs/ETAPE-2.md §3.4, et
_legacy/u-dither-v1/web/src/core/paletteParams.ts (référence, pas modèle
de code).

1. Crée packages/palette ("@ulab/palette", aucune dépendance).
   SIX palettes, pas neuf, et pas d'éditeur personnalisé :

     aucune       —  (niveaux de gris)
     macintosh    Macintosh 1 bit    #000000 #ffffff
     gameboy      Game Boy           #0f380f #306230 #8bac0f #9bbc0f
     cga          CGA                #000000 #55ffff #ff55ff #ffffff
     warm_print   Impression chaude  #15110f #6b3428 #c06c3e #e7b65a #f6e6c8
     acid_orange  Acid              #070000 #220100 #5b0300 #c11200
                                     #ff2b00 #ff6606 #ffd000 #fff6c9

   Les clés reprennent celles du legacy pour garder la continuité.
   pico8, cold_signal, xerox_heat et l'éditeur "custom" sont REPORTÉS —
   six palettes signées valent mieux qu'un générateur de moche.

   API : byName(name), toFloat3(name) (16 × vec3, complétée de zéros),
   nearest(color, palette). Tests : 2 à 16 couleurs par palette, hex
   valides, nearest stable.

2. packages/modules/src/types.ts — ajoute PaletteParamDef ('palette',
   default: string). C'est le SEUL endroit où le vocabulaire de
   paramètres s'étend ; packages/modules gagne @ulab/palette comme unique
   dépendance.

3. packages/ui — PaletteField.svelte : un Select augmenté d'une bande
   d'échantillons. Accessible au clavier, aucune couleur en dur en dehors
   des palettes. Câble-le dans ParamRow.

4. packages/engine — résout un paramètre 'palette' en u_<key>[16] et
   u_<key>_count (§3.1). Palette 'aucune' ⇒ count = 0.

5. Ajoute palette (défaut 'aucune') au manifeste traitement.halftone et
   adapte son shader : si count > 0, la sortie est ramenée à la couleur
   la plus proche.
```

---

### Prompt 8 — Bayer : le tramage ordonné

```
Lis docs/U.LAB-TRAMAGE.md §2.2 avant de coder. Point important : Bayer et
Dither sont deux modules distincts parce que ce sont deux esthétiques et
deux chemins de calcul — un menu déroulant qui les mélangerait ferait
croire à l'utilisateur que c'est le même effet. C'est la faute que
u.dither v1 avait commise.

Crée packages/modules/src/traitement-bayer/ :

  type: 'traitement.bayer'  category: 'traitement'  name: 'Bayer'
  summary : "Tramage ordonné : une matrice de seuils fixe, un motif
             géométrique régulier. La trame des écrans 1 bit."
  render.kind: 'shader'

  matrix   Matrice   enum ['2×2','4×4','8×8']  défaut '8×8'
  scale    Échelle   number 1..16  pas 1  défaut 4
  levels   Niveaux   number 2..8   pas 1  défaut 2
  invert   Inverser  boolean défaut false
  palette  Palette   palette défaut 'aucune'

Shader : matrices de seuil en constantes GLSL (pas de texture), seuil
comparé à la luminance, quantification sur `levels` niveaux, puis palette
si count > 0. `scale` est une taille en pixels du document ⇒ uScale.

Ne reprends PAS du legacy : contrast (il appartient à finition.reglages),
colorMode (mono + palette le couvre), ni les matrices "croix", "losange"
et "lignes" (ce ne sont pas des matrices de Bayer — des variantes
décoratives qui brouillent le procédé).
```

---

### Prompt 9 — Dither : la diffusion d'erreur, en Worker

Le seul module non-GPU de l'étape. C'est celui qui teste le chemin Worker de bout en bout.

```
Lis docs/U.LAB-TRAMAGE.md §2.2, docs/ETAPE-2.md §3.3 et §3.7, et
CLAUDE.md §2 (« l'error diffusion est séquentielle »).

1. packages/engine — implémente le chemin 'worker' de bout en bout :
   lecture du framebuffer courant en ImageData, appel du worker, réinjection
   du résultat en texture, poursuite de la chaîne.
   - debounce 120 ms sur les changements de paramètres ;
   - pendant le calcul, on continue d'afficher le résultat PRÉCÉDENT :
     jamais un écran vide, jamais un clignotement ;
   - le worker tourne à la résolution d'aperçu ; à l'export, à pleine
     résolution, sans debounce ;
   - un seul calcul en vol, le suivant remplace celui en attente.

2. packages/modules/src/traitement-dither/worker.ts — Floyd–Steinberg et
   Atkinson, quantification sur `levels` niveaux OU sur la palette.
   La palette doit être passée au worker et servir au calcul de l'erreur :
   c'est tout l'objet de docs/U.LAB-TRAMAGE.md §5. Dithérer en gris puis
   mapper après coup est FAUX.
   Le balayage serpentin est câblé en dur (activé) : il est simplement
   meilleur, ce n'est pas un choix à faire porter à l'utilisateur.
   Référence d'algorithme :
   _legacy/u-dither-v1/api/src/udither_api/filters/error_diffusion_filter.py
   (à relire, pas à transposer littéralement).

3. Manifeste final — le legacy perd contrast, brightness, gamma et
   serpentine :

  algorithm  Algorithme  enum ['floyd-steinberg','atkinson']  défaut 'floyd-steinberg'
  levels     Niveaux     number 2..8  pas 1  défaut 2
  invert     Inverser    boolean défaut false
  palette    Palette     palette défaut 'aucune'

  summary : "Diffusion d'erreur : l'erreur de chaque pixel est reportée
             sur ses voisins. Le grain organique du Macintosh 1 bit."

Mesure et dis-moi le temps de calcul en 1024×1024. Au-delà de 400 ms,
propose-moi une piste AVANT d'optimiser dans ton coin.
```

**Tu vérifies :** traîne le curseur Niveaux d'un bout à l'autre. Si l'aperçu clignote ou se vide entre deux valeurs, le debounce est mal placé. Puis compare Bayer et Dither à réglages équivalents : si tu hésites à les distinguer, un des deux est faux.

---

### Prompt 10 — Les trois derniers modules

```
Trois modules courts, même moule que les précédents (contrat §3.1, un
shader.glsl par module, uScale sur toute grandeur en pixels).

1. traitement.posterisation — quantification tonale SANS tramage.
   levels 2..16, défaut 6. À 2 niveaux, c'est un seuillage pur.
   summary : "Réduction du nombre de tons, sans tramage. Ce sont les
              bandes que les autres évitent."
   C'est le témoin du catalogue : il montre exactement ce que le tramage
   sert à éviter. Ne lui ajoute pas de palette.

2. traitement.pixelisation — réduction de résolution.
   cellSize 2..64 défaut 8 (px document ⇒ uScale), shape enum
   ['carré','rond'] défaut 'carré'.
   Échantillonnage au centre de cellule, pas de moyenne : on veut le bloc
   franc, pas un flou.

3. finition.reglages — 'Réglages', l'entrée du tramage.
   luminosité  -50..50   défaut 0   unité %
   contraste   -50..50   défaut 0   unité %
   gamma       0.4..3    défaut 1
   saturation  -100..100 défaut 0   unité %
   summary : "Luminosité, contraste, gamma, saturation. À placer avant un
              tramage."
   Défauts neutres : c'est la seule exception à la règle "un module ajouté
   doit se voir", et elle se justifie — un correcteur qui corrige tout
   seul serait une trahison. Pas de paramètre 'inverser' ici :
   l'inversion appartient aux modules de tramage, où elle inverse la
   trame.

Pour CHACUN : à valeur neutre, la sortie doit être bit pour bit identique
à l'entrée. Vérifie-le, ne le suppose pas.

Enfin : retire du registre les modules reportés à l'étape 6 —
traitement.ascii, finition.vignette, finition.scanlines,
finition.aberration — en gardant leurs dossiers et leurs manifestes
intacts, simplement décommissionnés du tableau MODULES avec un
commentaire renvoyant à docs/ETAPE-2.md §2. Ils reviendront tels quels.
source.video et source.webcam restent listés mais grisés ("bientôt").

Ajoute les vignettes manquantes (thumbnail) : un rendu 160×160 du module
appliqué à une MÊME image de référence pour tous — sinon la grille du
modal devient illisible.
```

---

### Prompt 11 — Vérification et fermeture de l'étape

```
Recette complète, dans cet ordre :

1. pnpm build sur tout le workspace, tests de core, engine et palette.
2. Sens des dépendances (architecture §6) : liste-moi les imports croisés
   entre paquets. Attendu : ui→core, engine→core (+ types de modules),
   modules→palette, export→engine+core. Aucun cycle.
3. Aucun `if (module.type === ...)` en dehors du registre.
4. Chaque module à valeur neutre est l'identité — liste avec un verdict
   par module.
5. uScale : à qualité Basse, Moyenne et Haute, la trame d'un halftone à
   cellSize 18 a la même finesse relative, et elle est identique à
   l'export. Montre-moi trois captures.
6. Photo statique, rien qui bouge : zéro rAF actif.
7. À 390 px de large, tout l'éditeur reste utilisable.
8. Le catalogue compte exactement huit modules actifs, et les paramètres
   correspondent au tableau de docs/ETAPE-2.md §2 — ni un de plus, ni un
   de moins. Si tu as ajouté un paramètre "utile" en cours de route,
   retire-le et dis-le moi.

Puis CLAUDE.md :
- §6 : étape 2 terminée. Prochaine : étape 3, les projets (IndexedDB,
  accueil, modèles, import/export .ulab).
- §7 : ajoute au journal —
  · "Le sujet de U.LAB est le tramage : comment une image survit à sa
    réduction en marques. Halftone (AM, 1880), Bayer (ordonné, 1973) et
    Dither (diffusion d'erreur, 1976/84) sont trois familles distinctes,
    donc trois modules — jamais un module à menu déroulant. Voir
    docs/U.LAB-TRAMAGE.md."
  · "Critère d'entrée au catalogue : le test des 8 secondes. Un module
    entre s'il se voit dans une boucle de huit secondes sur un téléphone.
    Éliminés à ce titre : netteté, bruit fin, vignette, et les réglages
    d'impression fins (minDot, jitter, stretch)."
  · "La palette est un paramètre des modules de tramage, jamais un module
    qui vient après : la diffusion d'erreur doit connaître la palette
    cible pour calculer son erreur."
  · "La famille CRT/vidéo (scanlines, aberration, bloom) est reportée EN
    BLOC à l'étape 6 : cohérente entre elle, incohérente avec la trame."
  · "La correction de tons a un seul endroit : finition.reglages. Les
    modules de tramage ne portent plus contrast/brightness/gamma."
  · "Les médias vivent en mémoire pendant l'étape 2 ; recharger perd la
    photo, et l'UI le dit. IndexedDB à l'étape 3."
- docs/U.LAB-ARCHITECTURE.md §7 : étape 2 marquée terminée.

Commit ("feat: les trois familles de tramage, palettes et réglages") et
pousse.
```

---

## 6. Réussite de l'étape

**Vague A**

- [ ] Les gestes 1 à 10 du test de recette passent, à la souris et au doigt
- [ ] Une seule ligne invalide le rendu : `$effect(() => renderer.setProject(store.project))`
- [ ] Zéro `requestAnimationFrame` actif sur une photo statique au repos
- [ ] L'export sort à la taille du document, et la trame y a la même finesse que dans l'aperçu
- [ ] `packages/engine` ne contient le nom d'aucun module
- [ ] Un shader de module ne contient ni `#version`, ni `void main`, ni déclaration d'uniforme
- [ ] La preview Cloudflare est vérifiée sur téléphone avant de passer à la vague B

**Vague B**

- [ ] Les gestes 11 à 16 passent
- [ ] Bayer et Dither sont visuellement distinguables au premier coup d'œil
- [ ] Chaque module à valeur neutre est l'identité, vérifié un par un
- [ ] Le catalogue compte **huit** modules actifs et **vingt-quatre** paramètres au total
- [ ] `packages/modules` ne dépend que de `@ulab/palette`
- [ ] `CLAUDE.md` §6 et §7, et `U.LAB-ARCHITECTURE.md` §7, sont à jour

---

## 7. Les pièges de cette étape

**1. Le shader qui prend le pouvoir.** Le premier module qui « aurait juste besoin » de déclarer son propre uniforme, son propre `main`, sa propre passe — c'est la fin du contrat, donc la fin du « ajouter un module est quasi gratuit ». Si un besoin légitime n'est pas couvert, **le contrat s'enrichit dans `packages/engine`** ; le module ne s'échappe pas. Même logique que le type `palette` : la capacité monte, elle ne descend jamais.

**2. Le paramètre « pendant qu'on y est ».** C'est le piège de cette étape précise, et c'est celui qui a produit u.dither v1. Chaque paramètre ajouté est défendable seul ; c'est leur somme qui tue l'outil. Le tableau du §2 est un **contrat, pas une suggestion** : un paramètre en plus doit passer par une discussion, pas par un commit.

**3. Optimiser avant de mesurer.** Interdit tant qu'un chiffre n'a pas été relevé. Les prompts 4, 5 et 9 demandent des mesures : elles ne sont pas décoratives, ce sont elles qui décident.

**4. Les valeurs inventées.** Une plage de curseur inventée produit un module qui *marche* mais dont la moitié de la course ne sert à rien. Toute plage vient soit du legacy, soit de ce document. Sinon, Claude Code demande — il ne choisit pas.

**5. Confondre parité et exhaustivité.** L'objectif n'est pas de reproduire u.dither v1 bouton pour bouton. C'est d'en garder ce qui produisait des images, et d'abandonner ce qui produisait des menus.

---

## 8. Ensuite

**Étape 3 — les projets.** IndexedDB (documents *et* médias), l'accueil « mes projets », les modèles, l'import/export `.ulab`. À partir de là, on peut fermer l'onglet sans perdre son travail.

C'est aussi le moment où les clés de paramètres se gèlent pour de bon. D'ici là, tout changement de vocabulaire est encore gratuit ; après, il coûte une migration.

**Étape 6 — le catalogue.** Les reports de cette étape reviennent en trois blocs cohérents : l'ASCII (avec son atlas de glyphes), la famille CRT/vidéo (scanlines, aberration, bloom), et les réglages d'impression fins du halftone pour ceux qui les cherchent. Chacun avec sa page `/effets`, qui est l'endroit où `docs/U.LAB-TRAMAGE.md` devient public.
