# U.LAB — Design system

> Dérivé d'une analyse du code de **tools.sketchdesign.club** (tokens, mesures et mécaniques extraits directement du CSS et du DOM), adapté à l'identité et aux règles de U.LAB.
> Juillet 2026 — **v2 : mise à jour pour l'éditeur unique.** Les sections 1 à 3 sont inchangées ; la section 4 est entièrement réécrite.

---

## 1. Le principe directeur

**L'interface se tait pour que l'image parle.**

C'est la leçon centrale de Sketch : fond quasi noir, un seul accent, zéro texture, typographie neutre. Résultat — la seule chose colorée et texturée à l'écran, c'est **l'œuvre de l'utilisateur**.

Ça renverse la direction de u.dither v1, qui décorait le châssis (scanlines, trame dithérée en fond, ombres dures portées) et entrait donc en concurrence avec le rendu.

**Ta patte s'exprime par la retenue, la précision des espacements et la qualité des micro-interactions — pas par la décoration.** Un outil dont l'UI crie est un outil qu'on n'utilise pas deux heures d'affilée. Et dans un éditeur unique, où l'utilisateur reste sur le même écran du début à la fin, ça compte encore plus qu'avant.

Trois règles qui découlent :

1. **L'accent ne décore jamais.** Il signale l'état actif, la valeur courante, l'action principale. Rien d'autre.
2. **Aucune texture sur le chrome.** Pas de grain, pas de scanlines, pas de motif de fond. Ces effets sont ce que l'outil *produit*, pas ce qu'il porte.
3. **Deux graisses maximum** (400 et 500). La hiérarchie se fait par la taille et la couleur, pas par le gras.

---

## 2. Tokens

### Surfaces
| Token | Valeur | Usage |
|---|---|---|
| `--bg-0` | `#0A0A09` | Canvas de la page |
| `--bg-1` | `#161714` | Panneaux, cartes, éléments de pile |
| `--bg-2` | `#1F211D` | Champs de saisie, selects, zones enfoncées |
| `--line` | `#32352F` | Bordure par défaut (1px) |

Noirs légèrement **chauds/verts**, jamais neutres purs : un gris parfaitement neutre paraît mort à côté d'une image.

### Encre
| Token | Valeur | Usage |
|---|---|---|
| `--ink` | `#F7F7F3` | Texte principal (blanc cassé, jamais `#fff`) |
| `--ink-muted` | `#A6AA9B` | Libellés, texte secondaire |
| `--ink-faint` | `#6E7268` | Indications, texte désactivé |

### Accent — signature U.LAB
| Token | Valeur | Usage |
|---|---|---|
| `--accent` | `#FF6606` | **Unique pour tout le labo.** État actif, valeur courante, action principale |
| `--accent-ink` | `#0A0A09` | Texte posé sur l'accent |
| `--danger` | `#FF441A` | Destructif uniquement |

L'orange est hérité de u.dither v1 — c'est déjà ta couleur. Un seul accent : U.LAB se reconnaît au premier coup d'œil.

### Rayons
`--r-sm: 2px` (puces, marqueurs) · `--r: 6px` (cartes, panneaux) · `--r-lg: 8px` (boutons, champs, éléments de pile)

### Typographie
**Geist Sans** pour l'interface, **Geist Mono** pour toute valeur numérique (curseurs, dimensions, temps, compteurs). Le mono aligne les chiffres, donc la valeur ne saute plus quand on manipule un curseur — détail invisible, confort réel. Dans un éditeur où l'on passe sa journée à traîner des curseurs, c'est décisif.

| Token | Taille | Usage |
|---|---|---|
| `--t-micro` | 10px | Métadonnées, badges, graduations de timeline |
| `--t-label` | 11px | Libellés de section (majuscules) |
| `--t-sm` | 12px | Valeurs, texte dense, noms de module |
| `--t-base` | 14px | Interface courante |
| `--t-h4` | 16px | Titre de panneau, titre de modal |
| `--t-h3` | 20px | — |
| `--t-h2` | 28px / `--t-h1` 36px | Accueil, pages d'effets |

Graisses : **400 et 500 uniquement.**

### Espacements
`4 · 6 · 8 · 10 · 12 · 16 · 20 · 24` px. Pas de valeur hors de cette échelle.

### Dimensions de contrôle
| Élément | Valeur |
|---|---|
| Largeur de l'inspecteur | 244px |
| Largeur d'une ligne de pile | 252px |
| Hauteur d'une ligne de pile | 37px |
| Hauteur select / champ | 28px |
| Hauteur bouton | 34px, padding `6px 14px` |
| Pouce de curseur | 14px, piste 2px |
| Hauteur du tiroir déplié | 40 % de la fenêtre, min 280px |
| Cible tactile minimale | 44px |

### Élévation
`--shadow: 0 1px 6px rgba(0,0,0,.5)` — subtile, uniquement sur les éléments flottants (inspecteur, modals, menus). **Jamais d'ombre portée dure.** La profondeur vient des bordures et des surfaces, pas du drame.

---

## 3. Composants

### Libellé de section
`11px / 500 / majuscules / interlettrage 0.66px / --ink-muted à 70%`. Sépare les groupes de réglages. Jamais de trait de séparation en plus — l'espace suffit.

### Ligne de réglage (`SliderRow`)
```
Libellé (14px, --ink-muted)          Valeur (12px mono, --ink)
[━━━━━●━━━━━━━━━━━━━]
```
Libellé et valeur sur la même ligne, justifiés aux extrémités. Piste 2px `--line`, remplissage `--ink`, pouce blanc 14px. **L'accent n'est pas sur le curseur** — il serait partout, donc nulle part.

Un paramètre piloté par une modulation affiche sa piste en `--accent` à 30 % et sa valeur en `--accent` : c'est le seul signal qui dit « ce réglage ne t'obéit plus directement ».

### Select · Interrupteur · Champ couleur · Champ point
- **Select** : 28px, fond `--bg-2` à 30 %, bordure `--line`, rayon `--r-lg`, chevron `--ink-muted`.
- **Interrupteur** : 32×18px, piste `--bg-2`, pastille `--ink`, piste `--accent` à l'état actif. Le seul contrôle où l'accent remplit une surface.
- **Champ couleur** : pastille 20px rayon `--r-sm` + valeur hexadécimale en mono.
- **Champ point** : deux champs numériques `X` et `Y`, plus une pastille déplaçable sur l'aperçu.
- **Dépôt de fichier** : zone en pointillés `--line`, 88px de haut, `--accent` au survol d'un fichier.

### Bouton
- **Principal** : fond `--accent`, texte `--accent-ink`
- **Secondaire** : transparent, bordure `--line`, texte `--ink`
- **Fantôme** : transparent, texte `--ink-muted`

**Un seul bouton principal visible par écran.** Dans l'éditeur, c'est `Exporter`.

### Onglets
Deux ou trois maximum, texte 12px, soulignement 1px `--ink` sur l'onglet actif. Pas de fond, pas de pilule, pas d'accent : les onglets naviguent, ils n'agissent pas.

### Ligne de pile
```
⠿  ▣  Halftone                      Changer   ⋮
```
Carte 252×37px, fond `--bg-1`, bordure `--line`, rayon `--r-lg`. Poignée de glissement `--ink-faint` à gauche (visible au survol), icône 16px, nom 12px, action `Changer` en `--accent` texte seul, menu `⋮`.

- **Sélectionnée** : bordure `--accent`.
- **Masquée** : contenu à 40 % d'opacité, bordure inchangée.
- **En cours de glissement** : `--shadow`, légère élévation, les autres lignes s'écartent.

Le menu `⋮` ne contient que **Cacher** et **Retirer** (en `--danger`). Résister à l'envie d'y ajouter quoi que ce soit : chaque entrée supplémentaire coûte une décision à l'utilisateur, mille fois par jour.

### Bouton d'ajout
Cercle 20px, bordure `--line`, `+` en `--ink-muted`. Placé **sous** la pile, sur le fil.

### Vignette de module
Carte 96×96px dans le modal Outils : rendu du procédé en fond, nom en dessous (12px). Bordure `--accent` si le module est celui qu'on remplace, opacité 35 % et curseur interdit s'il est déjà dans la pile.

### Cadre d'aperçu
Fond `--bg-1`, bordure `--line`, rayon `--r-lg`. Étiquette « Pile : *source* » en haut à gauche (`--t-micro`), sélecteur de ratio en haut à droite, dimensions en bas à droite. L'image est centrée, `image-rendering: pixelated`.

---

## 4. Mise en page de l'éditeur

Une seule surface, `/create`. Tout ce que l'utilisateur peut faire tient ici.

```
┌─ U.LAB ── Qualité d'aperçu: Moyenne 30 i/s ········· Modèles · Sauvegarder ─┐
│                                                                            │
│                          ⠿ ▣ Image        Changer ⋮                        │
│                          ⠿ ▣ Halftone     Changer ⋮   ← la pile, centrée   │
│  ┌──────────────┐        ⠿ ▣ Grain        Changer ⋮                        │
│  │ ▣ Halftone ✕ │                  ⊕                                       │
│  │              │                  │                                       │
│  │ Commandes    │      Pile: Image │                            1:1        │
│  │ ─────────    │   ┌──────────────┴───────────────────────────────┐       │
│  │ Fréquence 40 │   │                                              │       │
│  │ [━━●━━━━━━━] │   │                                              │       │
│  │ Angle     45 │   │                  APERÇU                      │       │
│  │ [━━━━●━━━━━] │   │                                              │       │
│  │ Forme  Point │   │                                              │       │
│  │              │   └──────────────────────────────────────────────┘       │
│  │ Réinitialiser│              [◨]        [ Exporter ]                     │
│  └──────────────┘                                                          │
│                                                                            │
├─ MODULATION & AUTOMATISATIONS ······················ ▶ ‖ ■  00:04 / 01:00 ⌄┤
└────────────────────────────────────────────────────────────────────────────┘
```

**Cinq surfaces, et pas une de plus.**

**4.1 · La barre du haut** — 48px, fond `--bg-0`, bordure basse `--line`. Logo à gauche, sélecteur de qualité d'aperçu juste après (assumé, jamais caché : l'utilisateur doit savoir que l'aperçu n'est pas l'export). À droite : `Modèles`, `Sauvegarder`, et sous ce dernier une mention discrète « Modifications non enregistrées » en `--t-micro` `--ink-faint`.

**4.2 · La pile** — centrée horizontalement, ancrée en haut. C'est le centre de gravité de l'interface, littéralement. Les lignes s'empilent dans l'ordre de rendu, source en premier. Un fil vertical 1px `--line` descend du bas de la pile vers l'aperçu, avec le bouton `+` posé dessus.

Pourquoi centrée en haut et pas dans une barre latérale : la pile et l'aperçu doivent être **sur le même axe visuel**, parce qu'ils décrivent la même chose — l'un est la recette, l'autre le plat.

**4.3 · L'inspecteur** — panneau flottant 244px, `--bg-1`, `--shadow`, déplaçable par son en-tête et fermable. Il affiche le module sélectionné, deux onglets (`Commandes`, `Effets`), et rien d'autre. Flottant plutôt qu'ancré : sur un écran étroit ou face à une image en portrait, l'utilisateur le déplace au lieu de subir une colonne fixe.

Contenu **entièrement généré** depuis le manifeste du module (voir `U.LAB-ARCHITECTURE.md` §4). Aucun panneau écrit à la main, jamais.

**4.4 · L'aperçu** — dominant, centré, ratio réglable. En dessous : la bascule d'affichage et `Exporter` (le seul bouton principal de l'écran).

**4.5 · Le tiroir de modulation** — replié par défaut, réduit à une barre de 40px avec son titre, la barre de transport et un chevron. Déplié, il occupe 40 % de la hauteur : à gauche le tableau des modulations, à droite la timeline graduée en temps et en images. Replié par défaut parce que la majorité des sessions sont des photos fixes — la modulation ne doit pas taxer ceux qui n'en veulent pas.

**Le modal Outils**, ouvert par `+` ou par `Changer` : trois colonnes `SOURCE` (liste, choix unique) · `TRAITEMENT` · `FINITION` (grilles de vignettes), avec un champ de recherche. Largeur 664px, `--bg-1`, `--shadow`, voile `rgba(10,10,9,.6)` derrière. Échap ferme, focus piégé dedans.

---

## 5. Mouvement

**CSS pur.** Aucune bibliothèque d'animation par défaut — c'est aussi le choix de Sketch (inspection du code : zéro GSAP, zéro Framer Motion, uniquement des transitions CSS).

| Token | Valeur | Usage |
|---|---|---|
| `--ease` | `cubic-bezier(.4, 0, .2, 1)` | **Le seul easing du projet.** Jamais d'autre courbe. |
| `--dur-fast` | `150ms` | Survols, focus, changements d'état |
| `--dur` | `250ms` | Apparition/disparition, modals, tiroir |

Ce qui s'anime : couleurs de bordure et de fond, opacité, `transform`. Ce qui ne s'anime **jamais** : la largeur de l'inspecteur, la position de l'aperçu, quoi que ce soit qui déplacerait l'image pendant que l'utilisateur travaille.

**Le fil** entre la pile et l'aperçu : trait 1px `--line` dans un calque absolu `pointer-events: none`. À l'ajout d'un module, une impulsion `--accent` le parcourt (~450ms) et la bordure de l'aperçu s'allume brièvement. C'est le seul feedback « quelque chose vient d'être branché » — et il doit rester seul, sinon il ne veut plus rien dire.

**Le glisser-déposer de la pile** est le geste le plus fréquent du produit : les lignes s'écartent en `transform`, jamais en `margin`. Si le CSS ne suffit pas, **GSAP Flip** est autorisé ici et nulle part ailleurs — chargé uniquement sur `/create`.

Respecter `prefers-reduced-motion` : durées à 0, l'interface reste utilisable.

---

## 6. Ce qu'on ne fait pas

- ❌ Textures, grain, scanlines sur l'interface
- ❌ Ombres portées dures (`Npx Npx 0 black`)
- ❌ Graisses 600 / 700
- ❌ Plus d'un accent, ou l'accent utilisé décorativement
- ❌ Blanc pur `#FFFFFF` ou noir pur `#000000`
- ❌ Valeurs d'espacement hors échelle
- ❌ Majuscules ailleurs que sur les libellés de section
- ❌ Un panneau de réglages écrit à la main pour un module particulier
- ❌ Une entrée de plus dans le menu `⋮`

---

## 7. Sources

Tokens, mesures et mécaniques relevés directement dans [tools.sketchdesign.club](https://tools.sketchdesign.club/) (inspection du CSS et du DOM, parcours complet de l'éditeur, juillet 2026). Leur palette est acide `#c9ff41` sur `#080906` avec Inter ; U.LAB reprend la **structure, les mécaniques et la philosophie de retenue**, pas les valeurs.

Typographies : [Geist](https://vercel.com/font) (open source, sans + mono). Alternatives libres : Switzer, General Sans ([Fontshare](https://www.fontshare.com/)).
