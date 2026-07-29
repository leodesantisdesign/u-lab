# Étape 2, vague B — Les trois familles de tramage

> La vague A est poussée (`2868232`) : moteur WebGL2, ping-pong, `source.image`, `traitement.halftone`, `finition.grain`, export image. Elle a été construite **avant le tri du catalogue** — d'où le prompt B0, qui remet le existant en ligne avant d'ajouter quoi que ce soit.
> À lire avant : **`docs/U.LAB-TRAMAGE.md`** (le sujet, les trois familles, le critère de tri) et **`docs/ETAPE-2.md` §2 et §3** (le catalogue arrêté et les contrats techniques).
> Branche : `git checkout -b etape-2-vague-b`

---

## 1. Ce que la vague B ajoute

Cinq modules, un paquet, un type de paramètre. À la fin, le catalogue compte **huit modules actifs et vingt-quatre paramètres**, et U.LAB fait tout ce que u.dither v1 faisait d'utile.

| | Module | Paramètres | Prompt |
|---|---|---|---|
| ✅ livré | `source.image` | fichier | — |
| ♻️ à corriger | `traitement.halftone` | cellSize · dotSize · shape · angle · invert **· palette** | B0, B1 |
| ♻️ à corriger | `finition.grain` | intensité | B0 |
| ➕ | `traitement.bayer` | matrix · scale · levels · invert · palette | B2 |
| ♻️ à alléger | `traitement.dither` | algorithm · levels · invert · palette | B3 |
| ➕ | `traitement.posterisation` | levels | B4 |
| ➕ | `traitement.pixelisation` | cellSize · shape | B4 |
| ➕ | `finition.reglages` | luminosité · contraste · gamma · saturation | B4 |

---

## 2. Deux corrections à faire d'abord

### Le bug `uScale` est réel, et il est dans le dépôt

`traitement-halftone/shader.glsl` calcule `vec2 pixelCoord = uv * uResolution` et compare `u_cellSize` à cette échelle. Or `computeRenderSize()` dans `renderer.ts` réduit la résolution de rendu selon la qualité d'aperçu. Conséquence, vérifiable en trente secondes : sur un document 1024 × 1024 en qualité **Basse** (512), une cellule réglée à 18 px produit un motif de 18 px de rendu — soit **36 px du document**. L'export sortira une trame deux fois plus fine que celle qu'on a réglée.

C'est le §3.7 de `ETAPE-2.md`, écrit après la vague A. Ça ne se négocie pas : un outil de tramage dont l'aperçu ment sur la finesse de la trame n'est pas un outil de tramage.

`finition.grain` a la même maladie sous une autre forme : son hash porte sur `gl_FragCoord.xy`, donc son grain fait toujours **un pixel de rendu**. En qualité Basse il paraît deux fois plus gros qu'à l'export.

### Le halftone a été livré en version grasse

Neuf paramètres, dont `minDot`, `jitter`, `stretch` et `roundness` — écrits avant le tri de `U.LAB-TRAMAGE.md` §4. Le code est bon ; il ne passe simplement pas le test des 8 secondes, et le halftone est le premier module que les gens ouvrent. Il redescend à cinq paramètres, et gagne deux formes qui, elles, se voient : le **losange** et la **ligne** — la trame à lignes étant la trame historique de Meisenbach (1882) et la plus graphique de toutes.

**Décision assumée :** on jette ~40 lignes de shader qui marchent. Elles restent dans l'historique git et pourront revenir à l'étape 6, en bloc « réglages d'impression fins », avec la page `/effets/halftone` pour les expliquer.

---

## Prompts pour Claude Code

### Prompt B0 — Remettre la vague A en ligne avec le catalogue

```
Lis d'abord docs/U.LAB-TRAMAGE.md (§2.1, §4 et §5), puis docs/ETAPE-2.md
§2, §3.1 et §3.7. Ces deux documents ont été écrits APRÈS la vague A :
ils font foi sur tout désaccord avec le code existant.

Trois corrections, dans cet ordre.

--- 1. L'uniforme uScale ---

packages/engine/src/program.ts : ajoute `uniform float uScale;` à
ENGINE_PREAMBLE, à côté de uResolution et uMediaSize, avec un commentaire
renvoyant à ETAPE-2.md §3.7.

packages/engine/src/pipeline.ts : alimente-le avec
  renderWidth / project.format.width
soit exactement le facteur appliqué par computeRenderSize(). Il vaut donc
1.0 à l'export, et < 1 en aperçu réduit. Jamais 0 : si format.width est
absurde, replie sur 1.0.

Règle générale à respecter partout ensuite : TOUTE grandeur exprimée en
pixels dans un manifeste est en pixels du DOCUMENT, et le shader la
multiplie par uScale. C'est la règle la plus facile à oublier.

--- 2. Les deux shaders existants ---

traitement-halftone/shader.glsl : `cellSize` est en pixels document ⇒
  float cellSize = max(u_cellSize * uScale, 1.0);
Vérifie qu'aucune autre grandeur en pixels ne traîne sans mise à
l'échelle.

finition-grain/shader.glsl : le hash porte sur gl_FragCoord.xy, donc le
grain fait un pixel de RENDU — il paraît plus gros en qualité Basse qu'à
l'export. Fais porter le hash sur la coordonnée ramenée au document :
  vec2 grainCoord = floor(gl_FragCoord.xy / max(uScale, 1e-4));
La sortie à intensité 0 doit rester identique bit pour bit.

--- 3. Le halftone redescend à cinq paramètres ---

Manifeste final, exactement, rien de plus :

  cellSize  Taille de cellule  number 4..80   pas 1  défaut 18  unité px
  dotSize   Taille du point    number 20..130 pas 1  défaut 96  unité %
  shape     Forme              enum ['rond','carré','losange','ligne']  défaut 'rond'
  angle     Angle              number 0..180  pas 1  défaut 45  unité °
  invert    Inverser           boolean défaut false

Disparaissent : minDot, jitter, stretch, roundness. Retire aussi le code
correspondant du shader (les deux fonctions de hash, la superellipse, la
gigue de position et de rayon, le seuil de point minimum) — pas de code
mort laissé en commentaire.

Ajoute les deux formes manquantes dans halftone_shapeDistance, dans le
même espace normalisé que les existantes :
  - losange : abs(nd.x) + abs(nd.y) - 1.0
  - ligne   : une trame à lignes — seule la distance PERPENDICULAIRE à
    l'axe de la cellule compte, l'épaisseur du trait suit l'encre comme
    le rayon du point suit l'encre pour un rond. C'est la trame de
    Meisenbach : des lignes parallèles d'épaisseur variable, pas des
    points alignés.

L'ordre des options de `shape` est un contrat public (ETAPE-2.md §3.1) :
c'est le dernier moment où on peut le fixer, l'étape 3 le gèle.

Le paramètre palette arrive au prompt suivant, pas ici.

Vérifie, et montre-moi : trois captures du MÊME document avec la même
cellSize, en qualité Basse, Moyenne et Haute, plus l'export. La trame doit
avoir la même finesse relative sur les quatre. C'est tout l'objet de ce
prompt.
```

**Tu vérifies :** les quatre images côte à côte. Si la trame change de finesse entre l'aperçu et l'export, rien d'autre ne sert à rien.

---

### Prompt B1 — Le paquet palette et le type de paramètre `palette`

```
Lis docs/U.LAB-TRAMAGE.md §5 (pourquoi la palette est un paramètre et pas
un module), docs/ETAPE-2.md §3.4, et
_legacy/u-dither-v1/web/src/core/paletteParams.ts (référence, pas modèle
de code).

1. Crée packages/palette ("@ulab/palette", aucune dépendance).
   SIX palettes, pas neuf, et pas d'éditeur personnalisé :

     aucune       —                  (niveaux de gris)
     macintosh    Macintosh 1 bit    #000000 #ffffff
     gameboy      Game Boy           #0f380f #306230 #8bac0f #9bbc0f
     cga          CGA                #000000 #55ffff #ff55ff #ffffff
     warm_print   Impression chaude  #15110f #6b3428 #c06c3e #e7b65a #f6e6c8
     acid_orange  Acid               #070000 #220100 #5b0300 #c11200
                                     #ff2b00 #ff6606 #ffd000 #fff6c9

   Les clés reprennent celles du legacy pour garder la continuité.
   pico8, cold_signal, xerox_heat et l'éditeur "custom" sont REPORTÉS :
   six palettes signées valent mieux qu'un générateur de moche.

   API : byName(name), toFloat3(name) → 16 × vec3 complétée de zéros,
   nearest(color, palette) pour le chemin Worker.
   Tests : 2 à 16 couleurs par palette, hex valides, nearest stable et
   déterministe.

2. packages/modules/src/types.ts — ajoute PaletteParamDef
   (type 'palette', default: string) à l'union ParamDef. C'est le SEUL
   endroit où le vocabulaire de paramètres s'étend, et packages/modules
   gagne @ulab/palette comme unique dépendance (architecture §6).

3. packages/ui — PaletteField.svelte : un Select augmenté d'une bande
   d'échantillons de couleur. Accessible au clavier, focus visible,
   aucune couleur en dur en dehors des palettes elles-mêmes. Câble-le
   dans ParamRow au même titre que les autres types.

4. packages/engine — program.ts déclare, pour un paramètre 'palette' :
     uniform vec3 u_<key>[16];
     uniform int  u_<key>_count;
   et pipeline.ts les alimente via toFloat3. Palette 'aucune' ⇒ count = 0.
   Ajoute une fonction commune au préambule, pour que les trois modules de
   tramage ne la réécrivent pas chacun :
     vec3 ulab_palette_nearest(vec3 c, vec3 pal[16], int count);
   count == 0 ⇒ retourne c inchangé.

5. Ajoute `palette` (défaut 'aucune') au manifeste traitement.halftone et
   adapte son shader : la couleur d'encre et la couleur de papier passent
   par ulab_palette_nearest quand count > 0.
```

---

### Prompt B2 — Bayer : le tramage ordonné

```
Lis docs/U.LAB-TRAMAGE.md §2.2 avant de coder.

Point qui commande tout le reste : Bayer et Dither sont deux modules
distincts parce que ce sont deux esthétiques ET deux chemins de calcul —
motif géométrique stable contre grain organique, shader parallèle contre
CPU séquentiel. Un menu déroulant qui les mélangerait ferait croire que
c'est le même effet avec un bouton différent. C'est exactement la faute
que u.dither v1 avait commise avec ses quatre "modes".

Crée packages/modules/src/traitement-bayer/ sur le modèle exact de
traitement-halftone (manifest.ts + shader.glsl + thumbnail).

  type: 'traitement.bayer'   category: 'traitement'   name: 'Bayer'
  summary : "Tramage ordonné : une matrice de seuils fixe, un motif
             géométrique régulier. La trame des écrans 1 bit."
  render.kind: 'shader'

  matrix   Matrice   enum ['2×2','4×4','8×8']  défaut '8×8'
  scale    Échelle   number 1..16  pas 1  défaut 4  unité px
  levels   Niveaux   number 2..8   pas 1  défaut 2
  invert   Inverser  boolean défaut false
  palette  Palette   palette défaut 'aucune'

Shader :
- les trois matrices de Bayer en constantes GLSL, pas en texture ;
- `scale` est une taille en pixels du DOCUMENT ⇒ multiplie par uScale
  (§3.7), sinon le motif change de taille avec la qualité d'aperçu ;
- seuil comparé à la luminance, quantification sur `levels` niveaux,
  puis ulab_palette_nearest si count > 0 ;
- le motif doit rester parfaitement stable d'une image à l'autre : aucune
  dépendance à uTime ni à uFrame.

Ne reprends PAS du legacy : `contrast` (il appartient désormais à
finition.reglages), `colorMode` (mono + palette le couvre), ni les
matrices "croix", "losange" et "lignes" — ce ne sont pas des matrices de
Bayer, ce sont des variantes décoratives qui brouillent le procédé.
```

---

### Prompt B3 — Dither : la diffusion d'erreur, en Worker

Le seul module non-GPU de l'étape. C'est lui qui teste le chemin Worker de bout en bout.

```
Lis docs/U.LAB-TRAMAGE.md §2.2 et §5, docs/ETAPE-2.md §3.3 et §3.7, et
CLAUDE.md §2 (« l'error diffusion est séquentielle »).

1. packages/engine — implémente le chemin render.kind === 'worker' de
   bout en bout, jusqu'ici jamais exercé :
   - lecture du framebuffer courant en ImageData, appel du worker du
     module, réinjection du résultat en texture, poursuite de la chaîne ;
   - debounce de 120 ms sur les changements de paramètres ;
   - pendant le calcul, on continue d'afficher le résultat PRÉCÉDENT :
     jamais un écran vide, jamais un clignotement ;
   - un seul calcul en vol à la fois ; une demande qui arrive pendant un
     calcul remplace celle en attente, elle ne s'empile pas ;
   - à l'export : pleine résolution, aucun debounce, et on attend
     réellement la fin avant d'encoder.
   - le worker reçoit ctx.scale = la même valeur que uScale.

2. packages/modules/src/traitement-dither/worker.ts — Floyd–Steinberg
   (1976) et Atkinson (Macintosh, ~1984 : seuls 3/4 de l'erreur sont
   propagés sur 6 voisins, d'où les blancs qui claquent).
   Le balayage serpentin est câblé EN DUR (activé) : il est simplement
   meilleur, ce n'est pas un arbitrage à faire porter à l'utilisateur.

   Point non négociable : la quantification se fait sur la PALETTE quand
   il y en a une, et l'erreur se calcule par rapport à la couleur de
   palette retenue — pas en gris avec un mapping après coup. C'est tout
   l'objet de U.LAB-TRAMAGE.md §5 : dithérer en gris puis mapper produit
   des bandes et annule l'algorithme.

   Référence d'algorithme (à relire, PAS à transposer littéralement — le
   backend Python est abandonné) :
   _legacy/u-dither-v1/api/src/udither_api/filters/error_diffusion_filter.py

3. Manifeste final — le legacy perd contrast, brightness, gamma et
   serpentine :

  algorithm  Algorithme  enum ['floyd-steinberg','atkinson']  défaut 'floyd-steinberg'
  levels     Niveaux     number 2..8  pas 1  défaut 2
  invert     Inverser    boolean défaut false
  palette    Palette     palette défaut 'aucune'

  summary : "Diffusion d'erreur : l'erreur de chaque pixel est reportée
             sur ses voisins. Le grain organique du Macintosh 1 bit."

4. Une ligne discrète sous le sélecteur de qualité d'aperçu : la texture
   d'une diffusion d'erreur dépend de la résolution de rendu et ne peut
   pas être mise à l'échelle — sa maille EST le pixel. C'est une limite
   inhérente, on la dit au lieu de faire semblant (ETAPE-2.md §3.7).

Mesure et dis-moi le temps de calcul en 1024×1024. Au-delà de 400 ms,
propose-moi une piste AVANT d'optimiser dans ton coin.
```

**Tu vérifies :** traîne le curseur Niveaux d'un bout à l'autre — si l'aperçu clignote ou se vide entre deux valeurs, le debounce est mal placé. Puis mets Bayer et Dither côte à côte à réglages équivalents : si tu hésites à les distinguer, un des deux shaders est faux.

---

### Prompt B4 — Les trois derniers modules, et le ménage du registre

```
Trois modules courts, même moule que les précédents (contrat §3.1, un
shader.glsl par module, uScale sur toute grandeur en pixels).

1. traitement.posterisation — quantification tonale SANS tramage.
   levels 2..16, pas 1, défaut 6. À 2 niveaux c'est un seuillage pur.
   summary : "Réduction du nombre de tons, sans tramage. Ce sont les
              bandes que les autres évitent."
   C'est le témoin du catalogue : il montre exactement ce que le tramage
   sert à éviter. Ne lui ajoute pas de palette — ce serait lui faire
   faire le travail des trois autres.

2. traitement.pixelisation — réduction de résolution.
   cellSize 2..64 pas 1 défaut 8 unité px (document ⇒ uScale),
   shape enum ['carré','rond'] défaut 'carré'.
   Échantillonnage au CENTRE de la cellule, pas de moyenne : on veut le
   bloc franc, pas un flou. En forme 'rond', le pixel hors du disque
   inscrit laisse passer le fond.

3. finition.reglages — 'Réglages', l'entrée du tramage.
   luminosité  -50..50    pas 1     défaut 0  unité %
   contraste   -50..50    pas 1     défaut 0  unité %
   gamma       0.4..3     pas 0.05  défaut 1
   saturation  -100..100  pas 1     défaut 0  unité %
   summary : "Luminosité, contraste, gamma, saturation. À placer avant un
              tramage."
   Défauts neutres : c'est la seule exception à la règle "un module ajouté
   doit se voir", et elle se justifie — un correcteur qui corrigerait tout
   seul serait une trahison. Pas de paramètre 'inverser' ici :
   l'inversion appartient aux modules de tramage, où elle inverse la
   trame, pas l'image.

Pour CHACUN : à valeur neutre, la sortie doit être bit pour bit identique
à l'entrée. Vérifie-le, ne le suppose pas.

--- Ménage du registre ---

packages/modules/src/registry.ts liste treize modules ; huit seulement
sont livrés. Sors du tableau MODULES, sans supprimer leurs dossiers ni
leurs manifestes : traitement.ascii, finition.vignette,
finition.scanlines, finition.aberration. Un commentaire au-dessus
renvoie à docs/ETAPE-2.md §2 et dit qu'ils reviennent à l'étape 6 — le
premier seul, les trois autres en bloc (famille CRT/vidéo).

source.video et source.webcam restent VISIBLES dans le modal mais
désactivés, avec la mention "bientôt" : ils annoncent l'étape 4. Le
ToolsModal doit les afficher grisés et non sélectionnables, pas les
masquer.

source.couleur : garde-le actif s'il rend déjà quelque chose de correct,
sinon sors-le comme les autres et dis-le moi.

--- Vignettes ---

Ajoute les thumbnails manquantes : un rendu 160×160 de chaque module
appliqué à une MÊME image de référence pour tous — sinon la grille du
modal devient un patchwork illisible. Format webp.
```

---

### Prompt B5 — Vérification et fermeture de l'étape 2

```
Recette complète, dans cet ordre. Ne coche rien sans l'avoir exécuté.

1. pnpm build sur tout le workspace ; tests de @ulab/core, @ulab/engine,
   @ulab/palette et @ulab/export.
2. Sens des dépendances (architecture §6) : liste-moi les imports croisés
   entre paquets. Attendu : ui→core, engine→core (+ types de modules),
   modules→palette, export→engine+core. Aucun cycle.
3. Aucun `if (module.type === ...)` en dehors du registre.
4. Chaque module à valeur neutre est l'identité — un verdict par module,
   les huit.
5. uScale : halftone à cellSize 18, captures en qualité Basse, Moyenne,
   Haute et à l'export. Même finesse relative sur les quatre.
6. Bayer et Dither à réglages équivalents : montre-moi les deux, ils
   doivent être distinguables au premier coup d'œil.
7. Photo statique, rien qui bouge : zéro requestAnimationFrame actif.
8. À 390 px de large, tout l'éditeur reste utilisable, y compris le
   sélecteur de palette.
9. Le catalogue compte exactement HUIT modules actifs et VINGT-QUATRE
   paramètres au total, conformes au tableau de docs/ETAPE-2.md §2. Si tu
   as ajouté un paramètre "utile" en cours de route, retire-le et dis-le
   moi.

Puis mets à jour la documentation :

CLAUDE.md §6 : étape 2 terminée (vagues A et B). Prochaine : étape 3, les
projets (IndexedDB, accueil, modèles, import/export .ulab).

CLAUDE.md §7, journal des décisions :
 · "Le sujet de U.LAB est le tramage : comment une image survit à sa
   réduction en marques. Halftone (AM, imprimerie 1880), Bayer (ordonné,
   écran 1973) et Dither (diffusion d'erreur, 1976/84) sont trois
   familles historiquement distinctes, donc trois modules — jamais un
   module à menu déroulant. Voir docs/U.LAB-TRAMAGE.md."
 · "Critère d'entrée au catalogue : le test des 8 secondes — un module
   entre s'il se voit dans une boucle de huit secondes sur un téléphone.
   Éliminés à ce titre : netteté, bruit fin, vignette, et les réglages
   d'impression fins du halftone (minDot, jitter, stretch, roundness),
   pourtant déjà écrits et fonctionnels."
 · "Toute grandeur spatiale est en pixels du DOCUMENT, mise à l'échelle
   au rendu par l'uniforme uScale. Sans ça l'aperçu ment sur la finesse
   de la trame — bug constaté dans la vague A. Limite documentée : la
   diffusion d'erreur ne peut pas être mise à l'échelle, sa maille est le
   pixel, et l'UI le dit."
 · "La palette est un paramètre des modules de tramage, jamais un module
   qui vient après : la diffusion d'erreur doit connaître la palette
   cible pour calculer son erreur. D'où le type de paramètre 'palette',
   application de l'architecture §8 (la capacité monte dans le
   vocabulaire commun, elle ne descend pas dans le module)."
 · "La famille CRT/vidéo (scanlines, aberration, bloom) est reportée EN
   BLOC à l'étape 6 : cohérente entre elle, incohérente avec la trame.
   L'ASCII est reporté seul — c'est une troisième famille (substitution
   de glyphes) qui demande un atlas fait proprement."
 · "La correction de tons a un seul endroit : finition.reglages. Les
   modules de tramage ne portent plus contrast/brightness/gamma."
 · "Six palettes signées, pas d'éditeur personnalisé."
 · "Les médias vivent en mémoire pendant l'étape 2 ; recharger perd la
   photo, et l'UI le dit. IndexedDB à l'étape 3."

docs/U.LAB-ARCHITECTURE.md §7 : étape 2 marquée terminée.

Commit ("feat: les trois familles de tramage, palettes et réglages") et
pousse la branche.
```

---

## 3. Réussite de la vague B

- [ ] La trame a la même finesse en aperçu Basse / Moyenne / Haute et à l'export
- [ ] Bayer et Dither sont distinguables au premier coup d'œil
- [ ] Le dither avec palette Game Boy sort **quatre** couleurs, pas une de plus
- [ ] Traîner un curseur du module Dither ne fait jamais clignoter ni vider l'aperçu
- [ ] Réglages → Dither → Grain : monter le contraste change complètement le caractère du dither
- [ ] Chaque module à valeur neutre est l'identité, vérifié un par un
- [ ] Huit modules actifs, vingt-quatre paramètres
- [ ] `packages/modules` ne dépend que de `@ulab/palette`
- [ ] Zéro rAF actif sur une photo statique
- [ ] Tout tient à 390 px de large
- [ ] `CLAUDE.md` §6/§7 et `U.LAB-ARCHITECTURE.md` §7 à jour
- [ ] La preview Cloudflare est vérifiée sur téléphone avant fusion dans `main`
- [ ] **Tu filmes huit secondes de manipulation.** Si ça ne se voit pas, c'est le tri qu'on a raté, pas le code.

---

## 4. Les trois pièges de cette vague

**1. « Le paramètre est déjà écrit, autant le garder. »** C'est l'argument qui a produit u.dither v1, et il reviendra à chaque prompt — sur `roundness`, sur `serpentine`, sur `contrast` dans les modules de tramage. Le coût d'un paramètre n'est pas son code, c'est la place qu'il prend dans la tête de quelqu'un qui découvre l'outil. Le tableau du §1 est un contrat, pas une suggestion.

**2. Faire de la palette un module.** Ça paraîtra plus propre — « un procédé, un module ». C'est faux ici pour une raison de calcul, pas de goût : la diffusion d'erreur a besoin de la palette cible pour calculer son erreur. Si Claude Code propose de sortir la palette en module de fin de pile, refuse et renvoie-le à `U.LAB-TRAMAGE.md` §5.

**3. Le shader qui s'échappe.** Le premier module qui « aurait juste besoin » de son propre uniforme, de son propre `main` ou d'une passe en plus, c'est la fin du contrat — donc la fin du « ajouter un module est quasi gratuit ». Si un besoin légitime n'est pas couvert, la capacité **monte dans `packages/engine`** (comme `uMediaSize` et `uScale` l'ont fait) ; elle ne descend jamais dans le module.

---

## 5. Ensuite

**Étape 3 — les projets.** IndexedDB pour les documents *et* les médias, l'accueil « mes projets », les modèles, l'import/export `.ulab`. À partir de là on peut fermer l'onglet sans perdre son travail, et **les clés de paramètres se gèlent pour de bon**. Tout ce qu'on n'aura pas renommé d'ici là coûtera une migration.
