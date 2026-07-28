# Étape 2 — Le moteur, et la parité u.dither

> Objectif : **le premier vrai pixel**. `/create` charge une photo, la trame, l'habille, et exporte un PNG à pleine résolution. À la fin de cette étape, U.LAB fait tout ce que faisait u.dither v1 — et tout est combinable.
> Prérequis : étape 1.5 fusionnée dans `main` · avoir relu `CLAUDE.md` §2 et §4, et `docs/U.LAB-ARCHITECTURE.md` §4, §5 et §6.
> Durée : c'est l'étape la plus lourde du plan. Elle est découpée en **deux vagues** ; la première est livrable seule.

---

## 1. Où on en est vraiment

L'étape 1.5 a tenu sa promesse : le store est bien l'unique propriétaire du document, un geste = une entrée d'historique, la pile se réordonne au doigt et au clavier, le modal d'export existe, le mouvement respecte `prefers-reduced-motion`. Rien de tout ça n'est à refaire.

Il reste **quatre dettes**, toutes petites, toutes sur le chemin du moteur. Elles sont réglées au prompt 0, pas plus tard :

| # | Dette | Pourquoi ça bloque l'étape 2 |
|---|---|---|
| 1 | `apps/lab/src/pages/index.astro` est encore le placeholder de l'étape 0 — aucun lien vers `/create` | Le prompt 6 de l'étape 1.5 n'a pas été fait. Personne ne peut atteindre l'éditeur sans taper l'URL. |
| 2 | `ratio` est un `$state` local de `Editor.svelte`, doublon de `project.format.ratio` | Après un `Ctrl+Z` sur un changement de ratio, le document recule mais l'écran ne suit pas. Le moteur lira `project.format` : deux vérités = un bug garanti. |
| 3 | `instanceWithDefaults()` et `buildDefaults()` font la même chose dans le même fichier | Deux endroits où les valeurs par défaut peuvent diverger. |
| 4 | `FileDrop` ne remonte que `file.name` — le `File` est jeté | Le moteur a besoin du blob. C'est réglé au prompt 3, avec le reste des médias. |

**Ce qui n'existe pas encore du tout :** `packages/engine`, `packages/export` et `packages/palette` sont des dossiers vides, sans `package.json`. Les treize manifestes déclarent tous `fragment: '// TODO(Étape 2)'`.

---

## 2. Le périmètre, et ce qui en sort

### Deux vagues

**Vague A — le moteur.** WebGL2, ping-pong de framebuffers, un canevas dans l'aperçu, et trois modules réellement branchés : `source.image`, `traitement.halftone`, `finition.grain`. Plus l'export image à pleine résolution. **À la fin de la vague A, on déploie et on vérifie en ligne.** C'est l'étape 2 telle que l'architecture la prévoyait.

**Vague B — la parité u.dither.** Le paquet `palette`, le tramage ordonné (Bayer), l'error diffusion en Worker, les réglages d'image, et les shaders des finitions déjà déclarées. À la fin, U.LAB fait strictement plus que u.dither v1, dans une seule interface.

### Ce qui reste dehors, et le reste dehors

- **La vidéo** — `source.video`, `source.webcam`, lecture image par image, export WebCodecs. → étape 4. `source.video` et `source.webcam` restent grisés dans le modal avec la mention « bientôt ».
- **La modulation** — le tiroir reste ce qu'il est : une coquille. Aucune valeur modulée ne traverse le moteur à cette étape. → étape 5.
- **IndexedDB et les projets** — les médias vivent **en mémoire** pendant l'étape 2. Recharger la page perd la photo, et c'est assumé : le message est explicite dans l'UI. → étape 3.
- **L'accueil, la galerie de modèles, les pages `/effets`, la ligne éditoriale.** → après l'étape 3. Le prompt 0 ne fait que rendre l'éditeur atteignable.
- **`traitement.pixel-sort`** — c'est du WebGPU/compute, un chemin de rendu à lui tout seul. Pas maintenant.

---

## 3. Les contrats techniques

**Cette section est la plus importante du document.** Tout ce qui n'y est pas écrit sera inventé, et une invention dans un contrat de rendu se paye à chaque module suivant. Elle est à coller dans les prompts, pas à résumer.

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
uniform float uTime;          // secondes depuis l'ouverture du projet
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

> **Règle nouvelle, à inscrire au journal :** l'ordre des `options` d'un paramètre `enum` est un **contrat public**, au même titre que la clé. Un enum se complète par la fin, jamais par le milieu. Réordonner, c'est changer silencieusement le sens de tous les `.ulab` existants.

### 3.2 Le blend, c'est l'affaire du moteur

Le moteur enveloppe chaque module dans le même épilogue :

```glsl
void main() {
  vec4 src = texture(uSource, vUv);
  vec4 res = ulab_main(src, vUv);
  fragColor = ulab_blend(src, res, u_blendMode, u_blendOpacity);
}
```

`ulab_blend` implémente les six modes de `BlendMode` (`normal`, `multiply`, `screen`, `overlay`, `difference`, `add`) puis interpole vers `src` selon l'opacité. Un module qui essaie de gérer lui-même son opacité est un module à corriger.

Les modules de catégorie `source` sont **exemptés** : ils écrivent `res` directement (leur `blend` n'a pas de sens — l'inspecteur masque déjà l'onglet Effets pour eux).

### 3.3 Ce qu'un module Worker fournit

```ts
// packages/modules/src/<module>/worker.ts
export default function process(
  input: ImageData,
  params: Record<string, ParamValue>,
  ctx: { seed: number; time: number },
): ImageData
```

Le moteur s'occupe de tout le reste : lecture du framebuffer courant, transfert, réinjection en texture, *debounce* de 120 ms, et affichage du **résultat précédent** pendant le calcul — jamais un écran vide, jamais un clignotement.

### 3.4 Le nouveau type de paramètre : `palette`

L'architecture §8 le dit : quand un module a besoin d'un contrôle qui n'existe pas, **on enrichit le vocabulaire commun**, on ne laisse pas le module dessiner son panneau. Le dithering, le halftone, l'ASCII et le duotone ont tous besoin de choisir une palette : c'est donc un type de paramètre, pas un `enum` déguisé.

```ts
export type PaletteParamDef = ParamCommon<'palette'> & {
  default: string;   // nom d'une palette de @ulab/palette, ou 'aucune'
};
```

- `packages/palette` expose les palettes nommées (portées de `_legacy/u-dither-v1/web/src/core/paletteParams.ts`) et les fonctions de quantification.
- `packages/ui` rend un sélecteur avec les échantillons de couleur — un composant `PaletteField.svelte` bâti sur `Select`.
- `packages/engine` résout le nom en tableau `vec3[16]` et l'envoie en uniforme.
- `packages/modules` importe `@ulab/palette` — **la seule dépendance qu'il ait le droit d'avoir** (architecture §6).

Palette `aucune` ⇒ `u_<key>_count = 0`, et le shader garde les niveaux de gris. Pas de branche spéciale ailleurs.

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

**Le moteur ne connaît aucun module en particulier.** Il reçoit un `resolveModule` injecté par l'appelant. Il peut importer des **types** depuis `@ulab/modules` (`import type` uniquement, aucun import de valeur, donc aucun cycle à l'exécution) — c'est la seule entorse tolérée, et elle est documentée ici.

### 3.6 Les règles de performance, en dur dans le code

- **Boucle paresseuse.** On ne dessine que si `dirty === true`, ou si la pile contient une source animée. Une photo statique au repos = **zéro `requestAnimationFrame` actif**. C'est vérifiable dans le profileur, et ça se vérifie.
- **Invalidation en un point.** `Editor.svelte` fait `$effect(() => renderer.setProject(store.project))`. C'est tout. Aucune écoute ailleurs. C'était toute la raison d'être de l'étape 1.5.
- **Qualité d'aperçu :** Basse = 512 px de plus grand côté, Moyenne = 1024, Haute = taille CSS affichée × `devicePixelRatio`, plafonnée à `project.format`. L'export **ignore** ce réglage.
- **Un programme compilé une fois par type de module**, mis en cache. Les uniformes se mettent à jour, ils ne se recompilent pas.
- **Deux FBO alternés**, alloués à la taille du rendu, réalloués seulement quand cette taille change.
- **Espace colorimétrique :** on travaille en sRGB 8 bits d'un bout à l'autre, sans gestion de couleur. C'est un choix : les procédés visés (trame, dither, grain) sont des effets de surface, et le linéaire n'apporterait qu'une couche d'erreurs possibles. À réévaluer le jour où on fait du bloom crédible — pas avant.

---

## 4. Le geste à obtenir à la fin

Test de recette. Tous les gestes de l'étape 1.5 doivent toujours passer, **plus ceux-ci** :

**Après la vague A :**

1. Tu déposes une photo dans le paramètre **Fichier** de la source. Elle apparaît dans l'aperçu, à l'endroit, au bon ratio.
2. Tu ajoutes **Halftone**. La photo se trame. Immédiatement, pas après un temps de chargement.
3. Tu traînes **Taille de cellule** d'un bout à l'autre. L'aperçu suit le curseur sans à-coups.
4. Tu ajoutes **Grain**. Il se superpose sans effacer la trame.
5. Tu passes Grain **au-dessus** de Halftone dans la pile. Le rendu change. Tu le remets : il revient exactement.
6. Tu caches Halftone (`⋮` → Cacher). La photo redevient nette. Tu le réaffiches : la trame revient avec ses réglages.
7. `Ctrl+Z` après un réglage de curseur : l'aperçu revient à la valeur précédente. L'annulation et le rendu sont d'accord.
8. Tu cliques **Exporter → Télécharger**. Tu obtiens un PNG **à la taille du document** (1024 × 1024 en 1:1), pas à la taille de l'aperçu, et sans marches d'escalier dues à un agrandissement.
9. Tu laisses l'onglet ouvert une minute sans rien toucher. Le ventilateur reste silencieux — la boucle de rendu est à l'arrêt.
10. Tu passes la qualité en **Basse** : l'aperçu devient plus grossier, l'export ne bouge pas d'un pixel.

**Après la vague B :**

11. Tu remplaces Halftone par **Bayer**, tu choisis la matrice 8×8, 2 niveaux. Tu retrouves le rendu de u.dither v1.
12. Tu choisis **Dither** (Floyd–Steinberg). Le rendu arrive en moins d'une demi-seconde, et pendant le calcul l'image précédente reste affichée.
13. Tu appliques la palette **Game Boy** au module de tramage. Quatre couleurs, pas une de plus.
14. Tu empiles **Réglages → Bayer → Grain → Vignette**. Chaque curseur répond en temps réel.
15. Tu fais la même chose sur ton téléphone. C'est plus lent, mais rien ne casse et rien ne fond.

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

### Prompt 0 — Les quatre dettes de l'étape 1.5

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
   `quality` et `showBefore` restent locaux — ce sont des états d'affichage,
   ils n'ont rien à faire dans le document.

3. instanceWithDefaults() et buildDefaults() font la même chose. Garde
   buildDefaults(type) comme fonction unique et construis le projet initial
   à partir d'elle.

Puis `pnpm build` et montre-moi le résultat.
```

**Tu vérifies :** change le ratio, `Ctrl+Z`. Le sélecteur ET le cadre d'aperçu reviennent en arrière ensemble.

---

### Prompt 1 — Le squelette du moteur

C'est le prompt fondateur. Il ne produit encore aucun pixel intéressant, et c'est normal.

```
Lis docs/U.LAB-ARCHITECTURE.md §5 et §6, docs/ETAPE-2.md §3 (les contrats
techniques — ils font foi, ne les réinterprète pas), et
packages/modules/src/types.ts.

Crée packages/engine (package.json "@ulab/engine", tsconfig aligné sur
packages/core, TypeScript strict, aucune dépendance runtime).

Contenu :

1. src/gl.ts — création du contexte WebGL2 (antialias: false,
   preserveDrawingBuffer: false, alpha: true), compilation et cache de
   programmes, gestion des erreurs de compilation avec le log GLSL et le
   type de module fautif dans le message.

2. src/quad.ts — un seul triangle plein écran (pas un quad à deux
   triangles), vertex shader fourni par le moteur, sortie vUv en 0..1
   origine bas-gauche.

3. src/program.ts — l'assembleur de programme décrit en §3.1 :
   préambule (#version 300 es, precision highp float, in/out, uniformes
   moteur) + uniformes générés depuis ModuleDef.params + la fonction
   ulab_blend + le corps ulab_main du module + l'épilogue main() de §3.2.
   Les modules de catégorie 'source' sautent le blend.
   Un test unitaire vérifie que l'assemblage d'un manifeste connu produit
   bien les déclarations attendues (comparaison de chaînes, pas de GPU).

4. src/pipeline.ts — ping-pong entre deux FBO (RGBA8, LINEAR, CLAMP),
   réalloués uniquement quand la taille du rendu change. Une passe par
   module actif (enabled === true), dans l'ordre de la pile. La sortie de
   la dernière passe est dessinée dans le canevas.

5. src/renderer.ts — l'API publique exacte de §3.5 : createRenderer,
   setProject, setQuality, start, stop, renderToBitmap, dispose.
   Boucle PARESSEUSE : un drapeau dirty, un seul requestAnimationFrame
   programmé quand il y a quelque chose à dessiner, aucun rAF actif au
   repos. Vérifie-le toi-même en instrumentant, et dis-moi comment tu l'as
   vérifié.

Contraintes :
- packages/engine ne connaît aucun module en particulier : il reçoit
  resolveModule et resolveMedia. Il peut faire des `import type` depuis
  @ulab/modules, jamais un import de valeur.
- Aucune référence au DOM en dehors du canevas passé en argument.
- Les erreurs WebGL ne remontent jamais en silence : si le contexte est
  perdu ou indisponible, le renderer expose un état d'erreur exploitable
  par l'UI.

Ne branche encore rien sur l'UI. Fais tourner build et tests.
```

---

### Prompt 2 — Les trois premiers shaders

```
Lis docs/ETAPE-2.md §3.1 et §3.2 avant d'écrire une ligne de GLSL.

Écris le corps `vec4 ulab_main(vec4 src, vec2 uv)` de trois modules, dans
un fichier shader.glsl à côté de chaque manifeste, importé en ?raw et
placé dans render.fragment à la place du TODO.

1. source.image — échantillonne uSource (le moteur y aura lié la texture
   du média), avec un cadrage "contain" calculé à partir de uResolution et
   du ratio de la texture. Sans média : un damier neutre discret, pas un
   écran noir, pas un message.

2. traitement.halftone — trame d'impression classique : rotation des
   coordonnées selon l'angle, grille de cellules, distance au centre de
   cellule comparée à la luminance locale. Paramètres du manifeste après
   la mise à jour ci-dessous. Le lissage des bords se fait en
   smoothstep piloté par 'netteté', jamais par un seuil dur : un seuil dur
   crénelle et on le verra à l'export.

3. finition.grain — bruit monochrome déterministe, fonction de hash à
   partir de gl_FragCoord et uSeed. À intensité 0, le rendu doit être
   BIT POUR BIT identique à l'entrée.

Mets à jour packages/modules/src/traitement-halftone/manifest.ts pour
atteindre la parité avec u.dither v1. Référence :
_legacy/u-dither-v1/web/src/core/halftoneParams.ts (à lire, à ne pas
copier — le backend Python est abandonné). Paramètres finaux :

  cellSize  Taille de cellule  number  4..80  pas 1   défaut 18  unité px
  dotSize   Taille du point    number  20..130 pas 1  défaut 96  unité %
  minDot    Point minimum      number  0..100  pas 1  défaut 8   unité %
  shape     Forme              enum    ['rond','carré','carré arrondi']  défaut 'rond'
  roundness Arrondi            number  0..100  pas 1  défaut 60  unité %
  jitter    Gigue              number  0..100  pas 1  défaut 6   unité %
  stretch   Étirement          number  60..160 pas 1  défaut 100 unité %
  angle     Angle              number  0..180  pas 1  défaut 45  unité °
  invert    Inverser           boolean défaut false

'frequency' et 'sharpness' disparaissent au profit de 'cellSize' et
'roundness' : la taille de cellule en pixels est plus prévisible qu'une
fréquence en lpi, et c'est le vocabulaire que les utilisateurs de
u.dither connaissent déjà. C'est la DERNIÈRE fenêtre pour changer une
clé : à partir de l'étape 3 il existe des fichiers .ulab, et les clés
sont gelées. Note ce changement dans le journal de CLAUDE.md §7.

Le paramètre 'palette' du halftone arrive en vague B, pas maintenant.
```

**Tu vérifies :** rien à l'écran encore. C'est le prompt suivant qui allume la lumière.

---

### Prompt 3 — Les médias, pour de vrai

```
Aujourd'hui packages/ui/src/components/FileDrop.svelte ne remonte que
file.name : le File est jeté. Le moteur a besoin du blob.

1. packages/core — ajoute src/media.ts :
   - class MediaStore : Map<string, { blob: Blob; bitmap: ImageBitmap }>,
     add(file: File): Promise<MediaRef> (décode via createImageBitmap),
     get(id), revoke(id), clear().
   - Le store de document gagne addMedia(ref: MediaRef) et
     removeMedia(id) — le document ne contient QUE des MediaRef, jamais
     un blob, jamais un ImageBitmap (architecture §3, principe 1).
   - En mémoire uniquement à cette étape. IndexedDB = étape 3. Écris-le
     en commentaire en tête du fichier pour que personne ne s'y trompe.

2. packages/ui — FileDrop expose onFile(file: File) au lieu d'écrire
   file.name dans la valeur. Il affiche le nom du média courant, résolu
   depuis un `mediaName` passé en propriété. ParamRow et Inspector
   transmettent, ils ne décident pas.

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
   - crée le Renderer dans un $effect avec nettoyage (dispose au démontage,
     et à chaud en dev) ;
   - resolveModule = byType de @ulab/modules, resolveMedia = MediaStore ;
   - UNE seule invalidation : $effect(() => renderer.setProject(store.project)).
     Aucune autre écoute, nulle part. Si tu as besoin d'une deuxième, c'est
     que quelque chose modifie le document en dehors du store — dis-le moi
     au lieu de la rajouter ;
   - le sélecteur de qualité appelle renderer.setQuality(512 | 1024 |
     taille CSS × devicePixelRatio) ;
   - remplace l'<img src="/placeholder.svg"> par le canevas ;
   - si WebGL2 est indisponible, affiche un message clair dans le cadre
     d'aperçu et laisse le reste de l'interface utilisable.

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
   d'aperçu est ignoré, sans exception.

2. src/filename.ts — nom de fichier proposé :
   ulab-<nom-de-projet-en-kebab>-<AAAAMMJJ-HHMM>.<ext>

3. Branche packages/ui/src/components/ExportModal.svelte : le bouton
   Télécharger devient actif dans l'onglet Image. L'onglet Vidéo reste
   désactivé avec l'infobulle "disponible à l'étape 4".
   Pendant le rendu : le bouton passe en état occupé et le modal ne se
   ferme pas tout seul.
   La ligne d'information (résolution · poids estimé · codec) est
   maintenant CALCULÉE sur le blob réel une fois l'export fait — plus une
   estimation. C'est exactement l'honnêteté qu'on vend.

Vérifie sur une photo 4000×3000 en 1:1 : le PNG sorti fait bien la taille
du document, la trame est nette, et l'onglet ne se fige pas plus d'une
seconde (si ça fige, dis-le-moi plutôt que d'ajouter un worker en douce).
```

---

### Prompt 6 — Fin de vague A

```
Avant de committer :
- pnpm build passe sur tout le workspace
- les tests de @ulab/core et @ulab/engine passent
- aucun `if (module.type === ...)` en dehors du registre
- aucune couleur, taille ni durée en dur dans les composants
- packages/modules ne dépend toujours d'aucun paquet (la palette arrive en
  vague B)
- le sens des dépendances de l'architecture §6 est respecté : vérifie-le
  en listant les imports croisés entre paquets et montre-moi la liste
- avec une photo statique et rien qui bouge : zéro rAF actif

Mets à jour CLAUDE.md :
- §6 : étape 2 vague A terminée — moteur WebGL2, source.image,
  traitement.halftone, finition.grain, export image
- §7 : ajoute au journal —
  · "Contrat shader : un module fournit vec4 ulab_main(vec4 src, vec2 uv)
    et RIEN d'autre. Le moteur assemble le programme, déclare les
    uniformes depuis le manifeste et applique le blend. Décision négative
    associée : un module n'écrit jamais son propre void main(), même
    quand ce serait plus court."
  · "L'ordre des options d'un paramètre enum est un contrat public au
    même titre que la clé : on complète par la fin, jamais par le milieu."
  · "Espace colorimétrique sRGB 8 bits de bout en bout, sans gestion de
    couleur. À réévaluer le jour où on fait du bloom crédible."
  · "Halftone : 'frequency'/'sharpness' remplacés par
    'cellSize'/'roundness' avant tout gel des clés (parité u.dither)."

Commit ("feat: le moteur WebGL2 et les trois premiers modules branchés")
et pousse la branche.
```

**Tu vérifies : la preview Cloudflare, sur ton téléphone, avec une vraie photo.** On ne démarre pas la vague B avant.

---

## Vague B — la parité u.dither

### Prompt 7 — Le paquet palette et le type de paramètre `palette`

```
Lis docs/ETAPE-2.md §3.4 et
_legacy/u-dither-v1/web/src/core/paletteParams.ts (référence, pas modèle
de code).

1. Crée packages/palette ("@ulab/palette", aucune dépendance) :
   - les neuf palettes nommées du legacy, clés inchangées : gameboy, cga,
     macintosh, pico8, warm_print, cold_signal, xerox_heat, acid_orange,
     plus 'aucune' (remplace "none") ;
   - byName(name): { label: string; colors: string[] } | undefined
   - toFloat3(name): Float32Array — 16 × vec3, complétée par des zéros
   - nearest(color, palette): quantification, pour le chemin Worker
   Tests : chaque palette a entre 2 et 16 couleurs, tous les hex sont
   valides, nearest est stable.

2. packages/modules/src/types.ts — ajoute PaletteParamDef ('palette',
   default: string). C'est le SEUL endroit où le vocabulaire de paramètres
   s'étend ; packages/modules gagne @ulab/palette comme unique dépendance.

3. packages/ui — PaletteField.svelte : un Select augmenté d'une bande
   d'échantillons de couleur. Accessible au clavier, libellé lisible,
   aucune couleur en dur en dehors des palettes elles-mêmes. Câble-le dans
   ParamRow.

4. packages/engine — résout un paramètre 'palette' en uniformes
   u_<key>[16] et u_<key>_count, conformément à §3.1. Palette 'aucune'
   ⇒ count = 0.

5. Ajoute le paramètre palette (défaut 'aucune') aux manifestes
   traitement.halftone et traitement.ascii, et adapte leur shader : si
   u_palette_count > 0, la sortie est ramenée à la couleur la plus proche.
```

---

### Prompt 8 — Bayer : le tramage ordonné

```
u.dither v1 avait quatre modes ; deux d'entre eux sont du tramage
ordonné (Bayer) et deux de l'error diffusion. Ce sont deux procédés
différents, avec deux chemins de rendu différents (fragment shader
parallèle contre CPU séquentiel) : ce sont donc DEUX modules, jamais un
module à onglets (CLAUDE.md règle 1).

Crée packages/modules/src/traitement-bayer/ :

  type: 'traitement.bayer'  category: 'traitement'  name: 'Bayer'
  summary : "Tramage ordonné par matrice : la trame de l'impression
             numérique, stable et sans grouillement."
  render.kind: 'shader'

Paramètres, portés de _legacy/.../bayerParams.ts :
  matrix     Matrice      enum   ['2×2','4×4','8×8','croix','losange','lignes']  défaut '8×8'
  scale      Échelle      number 1..16   pas 1    défaut 4
  levels     Niveaux      number 2..8    pas 1    défaut 2
  contrast   Contraste    number -50..50 pas 1    défaut 0    unité %
  invert     Inverser     boolean défaut false
  palette    Palette      palette défaut 'aucune'

Shader : matrices de seuil en constantes GLSL (pas de texture), seuil
comparé à la luminance après contraste, quantification sur `levels`
niveaux, puis palette si count > 0.

Le paramètre 'colorMode' du legacy (mono/source/rgb) ne revient PAS :
'mono' plus une palette couvre les deux premiers cas, et le mode rgb sera
un module de tramage par canal si le besoin se confirme. Un paramètre
qu'on n'est pas sûr de savoir expliquer ne rentre pas.
```

---

### Prompt 9 — Dither : l'error diffusion, en Worker

Le seul module non-GPU de l'étape. C'est celui qui teste le chemin Worker de bout en bout.

```
Lis docs/ETAPE-2.md §3.3 et CLAUDE.md §2 (« l'error diffusion est
séquentielle »).

1. packages/engine — implémente le chemin 'worker' de bout en bout :
   lecture du framebuffer courant en ImageData, appel du worker du module,
   réinjection du résultat en texture, poursuite de la chaîne.
   - debounce 120 ms sur les changements de paramètres ;
   - pendant le calcul, on continue d'afficher le résultat PRÉCÉDENT :
     jamais un écran vide, jamais un clignotement ;
   - le worker tourne à la résolution d'aperçu ; à l'export il tourne à
     pleine résolution, sans debounce ;
   - un seul calcul en vol à la fois, le suivant remplace celui en
     attente.

2. packages/modules/src/traitement-dither/worker.ts — Floyd–Steinberg et
   Atkinson, balayage serpentin optionnel, quantification sur `levels`
   niveaux ou sur la palette. Référence :
   _legacy/u-dither-v1/api/src/udither_api/filters/error_diffusion_filter.py
   (algorithme à relire, code Python à ne pas transposer littéralement).

3. Complète le manifeste existant avec le paramètre palette (défaut
   'aucune'). Les clés existantes (algorithm, levels, contrast,
   brightness, gamma, serpentine, invert) ne changent pas.

Mesure et dis-moi le temps de calcul en 1024×1024 sur ta machine. Au-delà
de 400 ms, propose-moi une piste AVANT d'optimiser dans ton coin.
```

**Tu vérifies :** traîne le curseur Niveaux d'un bout à l'autre. Si l'aperçu clignote ou se vide entre deux valeurs, le debounce est mal placé.

---

### Prompt 10 — Les finitions et les réglages

Dix petits shaders. Un seul prompt, parce qu'ils partagent le même moule.

```
Écris le ulab_main de chaque module ci-dessous (contrat §3.1, un fichier
shader.glsl par module) et remplace les TODO des manifestes. Référence
des plages et des défauts : _legacy/u-dither-v1/web/src/core/fxParams.ts
et imageAdjustParams.ts.

Déjà déclarés, à brancher tels quels :
- finition.vignette      assombrissement radial, centre paramétrable
- finition.scanlines     lignes sombres alternées, épaisseur et intensité
- finition.aberration    décalage R/B opposé, en px
- traitement.posterisation  quantification sur N niveaux
- traitement.pixelisation   cellules carrées ou rondes
- traitement.ascii       cellule, jeu de caractères, contraste, couleur
                         source, palette. Atlas de glyphes généré une
                         fois dans un canevas hors écran et envoyé en
                         texture — pas de police chargée à chaque image.

Nouveaux modules (parité u.dither) :
- finition.bruit    'Bruit'    bruit fin déterministe, distinct du grain :
                     le grain imite la pellicule, le bruit est numérique.
                     amount 0..100, défaut 18
- finition.nettete  'Netteté'  rehaussement de contraste local (kernel 3×3),
                     amount 0..100, défaut 28
- finition.bloom    'Bloom'    halo autour des pixels lumineux. seuil,
                     intensité, rayon, ET une couleur (défaut #FF6606 —
                     c'est l'"Acid Glow" de u.dither, rendu neutre :
                     l'utilisateur choisit sa couleur, on ne lui impose
                     pas la nôtre)
- finition.reglages 'Réglages' luminosité -50..50, contraste -50..50,
                     gamma 0.4..3, saturation -100..100, inverser.
                     Défauts neutres : le module ajouté ne change rien
                     tant qu'on n'y touche pas. C'est la seule exception
                     à la règle "un module ajouté doit se voir" — et elle
                     se justifie : un correcteur qui corrige tout seul
                     serait une trahison.

Pour CHACUN : à valeur neutre, la sortie doit être bit pour bit identique
à l'entrée. Vérifie-le, ne le suppose pas.

Ajoute les vignettes manquantes (thumbnail) : un rendu 160×160 du module
appliqué à une même image de référence, en webp. Même image pour tous,
sinon la grille du modal devient illisible.
```

---

### Prompt 11 — Vérification et fermeture de l'étape

```
Recette complète, dans cet ordre :

1. pnpm build sur tout le workspace, tests de core, engine et palette.
2. Le sens des dépendances de l'architecture §6 : liste-moi les imports
   croisés entre paquets. Attendu : ui→core, engine→core (+ types de
   modules), modules→palette, export→engine+core. Aucun cycle.
3. Aucun `if (module.type === ...)` en dehors du registre.
4. Chaque module à valeur neutre est l'identité (test visuel, module par
   module) — montre-moi la liste avec un verdict par module.
5. Une photo statique, rien qui bouge : zéro rAF actif.
6. À 390 px de large, tout l'éditeur reste utilisable.
7. Parité u.dither v1 — vérifie point par point et dis-moi ce qui manque
   ENCORE, sans arrondir :
   chargement d'image · réglages d'image · halftone · Bayer ·
   Floyd–Steinberg · Atkinson · palettes · grain · bruit · scanlines ·
   netteté · vignette · postérisation · aberration chromatique · ASCII ·
   bloom · export PNG pleine résolution.

Puis CLAUDE.md :
- §6 : étape 2 terminée (vagues A et B). Prochaine : étape 3, les projets
  (IndexedDB, accueil, modèles, import/export .ulab).
- §7 : ajoute au journal —
  · "Le tramage ordonné (Bayer) et l'error diffusion (Dither) sont deux
    modules, pas un module à onglets : deux procédés, deux chemins de
    rendu. Application directe de la règle 1."
  · "Nouveau type de paramètre 'palette', partagé par dither, bayer,
    halftone et ascii. Application de l'architecture §8 : le vocabulaire
    s'enrichit, le module ne dessine jamais son propre panneau."
  · "Les médias vivent en mémoire pendant l'étape 2 ; recharger perd la
    photo, et l'UI le dit. IndexedDB à l'étape 3."
  · "'colorMode' du legacy n'est pas repris : mono + palette couvre le
    besoin."

Commit ("feat: parité u.dither — palettes, bayer, error diffusion,
finitions") et pousse.
```

---

## 6. Réussite de l'étape

**Vague A**

- [ ] Les gestes 1 à 10 du test de recette passent, à la souris et au doigt
- [ ] Une seule ligne invalide le rendu : `$effect(() => renderer.setProject(store.project))`
- [ ] Zéro `requestAnimationFrame` actif sur une photo statique au repos
- [ ] L'export sort à la taille du document, pas à celle de l'aperçu
- [ ] `packages/engine` ne contient le nom d'aucun module
- [ ] Un shader de module ne contient ni `#version`, ni `void main`, ni déclaration d'uniforme
- [ ] La preview Cloudflare est vérifiée sur téléphone avant de passer à la vague B

**Vague B**

- [ ] Les gestes 11 à 15 passent
- [ ] Les dix-sept points de parité u.dither sont cochés, ou l'écart est écrit noir sur blanc
- [ ] Chaque module à valeur neutre est l'identité, vérifié un par un
- [ ] `packages/modules` ne dépend que de `@ulab/palette`
- [ ] `CLAUDE.md` §6 et §7 sont à jour
- [ ] `docs/U.LAB-ARCHITECTURE.md` §7 : l'étape 2 est marquée terminée

---

## 7. Les pièges de cette étape

**1. Le shader qui prend le pouvoir.** Le premier module qui « aurait juste besoin » de déclarer son propre uniforme, son propre `main`, sa propre passe supplémentaire — c'est la fin du contrat, et donc la fin du « ajouter un module est quasi gratuit ». Si un module a un besoin légitime que le contrat ne couvre pas, **le contrat s'enrichit dans `packages/engine`** ; le module ne s'échappe pas. Même logique que le type `palette` : la capacité monte, elle ne descend jamais.

**2. Optimiser avant de mesurer.** Le réflexe sera d'ajouter un cache, un worker, un `OffscreenCanvas` dès la première seconde qui traîne. Interdit tant qu'un chiffre n'a pas été relevé. Les prompts 4, 5 et 9 demandent explicitement des mesures : elles ne sont pas décoratives, ce sont elles qui décident.

**3. Les valeurs inventées.** Toujours valable, et plus dangereux ici qu'ailleurs : une plage de curseur inventée produit un module qui *marche* mais dont la moitié de la course ne sert à rien. Toute plage vient soit du legacy, soit de ce document. Si ni l'un ni l'autre ne la donne, Claude Code demande — il ne choisit pas.

**4. Vouloir la vidéo tout de suite.** Elle est à trois modules de distance et elle change tout le calcul de performance (architecture §8). L'étape 2 se termine sur une image fixe qui marche, se déploie et s'exporte. C'est déjà le moment où U.LAB devient un outil.

**5. Confondre parité et exhaustivité.** L'objectif n'est pas de reproduire u.dither v1 bouton pour bouton, c'est de ne rien perdre de ce qu'il savait faire. `colorMode`, les presets et le panneau à onglets ne reviennent pas : la pile les rend inutiles.

---

## 8. Ensuite

**Étape 3 — les projets.** IndexedDB (documents *et* médias), l'accueil « mes projets », les modèles, l'import/export `.ulab`. À partir de là, on peut fermer l'onglet sans perdre son travail — et U.LAB devient utilisable au sens plein, pas seulement démontrable.

C'est aussi le moment où les clés de paramètres se gèlent pour de bon. D'ici là, tout changement de vocabulaire est encore gratuit ; après, il coûte une migration.
