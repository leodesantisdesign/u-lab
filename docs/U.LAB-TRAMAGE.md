# U.LAB — Le tramage : ce qu'on fait, d'où ça vient, et ce que ça exclut

> Document de culture, pas de code. Il fixe **le sujet** de U.LAB, le vocabulaire, et le critère qui décide si un module entre au catalogue ou attend.
> Il alimentera directement les pages publiques `/effets/[slug]`.
> Juillet 2026 — v1.

---

## 1. Le sujet, en une phrase

Toutes les techniques qui nous intéressent répondent à **une seule question, posée deux fois à un siècle d'écart** :

> *Comment donner l'illusion d'une image continue quand on ne dispose que de marques qui sont là ou pas là ?*

L'imprimeur de 1880 n'a que de l'encre ou pas d'encre. Le Macintosh de 1984 n'a qu'un pixel noir ou blanc. **Ce sont deux réponses au même problème**, et ce sont deux langages visuels totalement distincts. C'est ça, U.LAB : le laboratoire où on refait passer une photo par ces contraintes-là.

Ça donne le critère qui manquait : **un module entre au catalogue s'il répond à cette question.** Un module qui embellit, corrige ou pastiche autre chose attend son tour — ou n'entre jamais.

---

## 2. Les trois familles, et pourquoi elles ne se mélangent pas

### 2.1 Le halftone — la réponse de l'imprimerie (1880→)

**L'histoire.** Talbot imagine dès 1852 d'interposer un voile entre le négatif et la plaque. En 1880, le *Daily Graphic* de New York imprime « A Scene in Shantytown », première photographie en demi-teintes d'un quotidien, via le procédé de Stephen Horgan. En 1882, l'Allemand Georg Meisenbach dépose le brevet de l'*autotypie* — il utilisait des trames à lignes simples, tournées pendant l'exposition pour produire un croisement — et c'est le premier à en faire un succès commercial. Peu après, Frederic Ives et les frères Louis et Max Levy industrialisent les trames à lignes croisées de qualité.

**La mécanique.** Une grille **fixe**, des points de **taille variable**. En vocabulaire de reprographie : **modulation d'amplitude (AM)**. Les zones sombres ont de gros points, les claires de petits points, mais toujours au même pas.

**Les artefacts, qui sont devenus le style.** L'angle de trame (45° pour une seule couleur — l'œil est le moins sensible aux motifs diagonaux), le moiré quand deux trames se superposent, et la **rosette** quand on empile les angles standards CMJN (15°, 45°, 75°, 0°). Ces défauts techniques sont exactement ce qu'on cherche à voir aujourd'hui : le point de trame agrandi, c'est le journal, la sérigraphie, Lichtenstein, Warhol, le fanzine photocopié, le riso.

**Ce que ça implique pour nous.** Le halftone est **analogique dans l'âme** : il a une grille, un angle, une forme de point, et il se lit **gros**. Un halftone à une cellule de 3 px n'est pas un halftone, c'est du bruit gris.

### 2.2 Le dithering — la réponse de l'écran (1973→)

**L'histoire.** 1973 : Bryce Bayer, chez Kodak (le même que celui du filtre de Bayer des capteurs), publie la matrice de seuils ordonnée qui porte son nom. 1976 : Robert Floyd et Louis Steinberg publient la diffusion d'erreur, qui devient la référence pour cinquante ans. Milieu des années 80 : Bill Atkinson écrit pour le Macintosh la variante qui ne propage que **3/4 de l'erreur** sur 6 voisins — d'où des blancs qui claquent, un contraste plus dur, et *le* rendu Mac 1 bit qu'on reconnaît entre mille. Elle passe dans QuickDraw et HyperCard, et forme le goût d'une génération.

**La mécanique.** Des points de **taille fixe** (un pixel), de **densité variable**. En vocabulaire de reprographie : **modulation de fréquence (FM)**, ce que l'imprimerie appellera plus tard le tramage stochastique. Contrairement à l'AM, la FM n'a pas d'angle, donc pas de moiré.

**Deux sous-familles qui ne se ressemblent pas.**

| | **Ordonné (Bayer)** | **Diffusion d'erreur (Floyd–Steinberg, Atkinson)** |
|---|---|---|
| Principe | Une matrice de seuils fixe, répétée | L'erreur d'arrondi d'un pixel est reportée sur ses voisins |
| Texture | **Motif géométrique visible**, régulier, en croisillon | **Organique**, sans grille, épouse le contenu de l'image |
| Calcul | Parallèle — chaque pixel est indépendant | **Séquentiel** — chaque pixel dépend du précédent |
| En animation | Stable : le motif ne bouge pas | Instable : le grain « grouille » d'une image à l'autre |
| L'image mentale | Game Boy, CGA, écrans 8 bits | Mac Plus, *Return of the Obra Dinn* |

Ce tableau justifie à lui seul deux modules séparés. Ce ne sont pas deux réglages d'un même effet : ce sont **deux esthétiques et deux chemins de calcul**.

**Le retour en grâce.** *Return of the Obra Dinn* (Lucas Pope, 2018) applique du dithering 1 bit à une 3D moderne et fait naître le terme « dither-punk ». Depuis, c'est une des directions artistiques les plus reprises de la décennie — pochettes, jeux indépendants, identités de marque. C'est le contexte dans lequel U.LAB arrive : pas pour inventer le style, pour en faire un **outil d'auteur propre** au moment où tout le monde le cherche.

**Le détail qui compte pour la suite.** Le grain de la diffusion d'erreur est un bruit blanc : en vidéo, il scintille. La parade connue est le **bruit bleu**, qui ne contient que des hautes fréquences, se voit moins et surtout **reste stable dans le temps**. C'est une piste pour l'étape 4, pas pour maintenant — mais c'est écrit ici pour qu'on ne redécouvre pas le problème en panique.

### 2.3 La substitution de glyphes — la réponse de la machine à écrire (1939→)

**L'histoire.** En 1939, Julius Nelson publie *ARTYPING*, un manuel pour dessiner à la machine à écrire. L'art télétype suit dès les années 20 avec le code Baudot ; Kenneth Knowlton produit chez Bell Labs vers 1966 quelques-uns des plus anciens ASCII connus. L'ASCII est normalisé en 1963, l'ANSI ajoute la couleur et 256 caractères, et la demoscene en fait une discipline avec ses compétitions dès les années 80.

**La mécanique.** Une troisième réponse : on ne module ni la taille ni la densité du point, on **remplace un bloc de pixels par le caractère dont la densité d'encre s'en rapproche le plus**.

**Ce que ça implique pour nous.** C'est une famille à part entière, avec ses propres exigences (atlas de glyphes, choix de la police, gestion du ratio de cellule). Fait à moitié, c'est du bruit typographique. → **reporté à l'étape 6**, fait proprement, avec sa page `/effets`.

---

## 3. La carte : ce qui est du tramage, et ce qui n'en est pas

| Procédé | Famille | Statut |
|---|---|---|
| **Halftone** | AM, imprimerie 1880 | ✅ catalogue |
| **Bayer** | FM ordonné, écran 1973 | ✅ catalogue |
| **Dither** (Floyd–Steinberg, Atkinson) | FM diffusion d'erreur, 1976/84 | ✅ catalogue |
| **Postérisation** | Quantification tonale **sans ruse spatiale** | ✅ catalogue — c'est le témoin : elle montre exactement ce que le tramage évite (les bandes) |
| **Pixellisation** | Réduction de **résolution**, pas de tons | ✅ catalogue — c'est le substrat : c'est elle qui donne l'échelle à laquelle les trames se lisent |
| **Palettes** | La contrainte de couleur qui a *engendré* le dithering | ✅ mais **comme paramètre**, jamais comme module — voir §5 |
| **ASCII** | Substitution de glyphes, 1939 | ⏳ étape 6, fait proprement |
| **Pixel sort** | Tri de pixels, art génératif (Asendorf, 2010) | ⏳ demande du WebGPU compute |
| **Scanlines · Aberration chromatique · Bloom** | Famille **CRT / vidéo analogique** | ⏳ étape 6, **en bloc** : ces trois-là forment un langage cohérent entre eux, et incohérent avec la trame |
| **Netteté · Vignette · Courbes** | Retouche photo | ❌ hors sujet. Ce ne sont pas des procédés, ce sont des corrections |

**Les deux exceptions assumées du catalogue :**

- **Grain** — ce n'est pas du tramage, c'est de la matière. Il reste parce qu'une image 1 bit parfaitement propre a l'air d'un fichier, pas d'un tirage. Un seul module de matière, un seul curseur.
- **Réglages** (luminosité, contraste, gamma, saturation) — ce n'est pas un effet, c'est **l'entrée** du tramage. Toute trame est un seuillage : sa qualité dépend entièrement de la courbe de tons qu'on lui donne. Sans ce module, l'utilisateur obtient de la bouillie et accuse l'outil. Avec lui, il comprend en trente secondes que l'ordre de la pile compte — c'est la meilleure leçon que l'éditeur puisse donner.

---

## 4. Le critère de tri : le test des 8 secondes

Tes quatre références (artkit, dasca, endlesstools, brik) et tes comptes de veille vivent tous du même canal : **une boucle de huit secondes qui montre un avant/après**. C'est le format qui décide de la diffusion de U.LAB, donc c'est le format qui doit décider du catalogue.

> **Un module entre à l'étape 2 s'il se voit dans une boucle de huit secondes, sur un téléphone, par quelqu'un qui ne connaît pas l'outil.**

Ce que ça élimine mécaniquement : la netteté, le bruit numérique fin, la vignette, le bloom discret, les micro-réglages d'impression (point minimum, gigue, étirement). Ce sont de bons paramètres pour un utilisateur qui reviendra une centaine de fois — pas pour un catalogue qu'on découvre.

Ce que ça garde : les procédés **radicaux**. Une trame, un dither, une postérisation à 3 niveaux, une pixellisation à 24 px, une palette Game Boy. Des choses qui transforment l'image, pas qui la retouchent.

C'est aussi la traduction directe de la règle 3 de `CLAUDE.md` : la patte de l'auteur passe par le **choix de ce qui existe** et par les **valeurs par défaut**, jamais par un empilement d'options.

---

## 5. Trois décisions que l'histoire tranche pour nous

**1. La palette est un paramètre du module de tramage, pas un module qui vient après.**
Ce n'est pas un choix de confort, c'est une contrainte de calcul : la diffusion d'erreur doit **connaître la palette cible pour calculer son erreur**. Dithérer en gris puis mapper vers une palette après coup donne des bandes et perd tout l'intérêt de l'algorithme. Historiquement, c'est le même fait : le dithering est né *de* la palette limitée (4 verts sur Game Boy, 2 couleurs sur Mac), pas à côté d'elle. → d'où le nouveau type de paramètre `palette`.

**2. On ne fusionne jamais Bayer et Dither dans un module à menu déroulant.**
C'est la tentation permanente — u.dither v1 y avait cédé avec ses quatre « modes » dans un seul panneau. Ce sont deux textures, deux époques, deux chemins de rendu. Un menu qui les mélange fait croire à l'utilisateur que c'est le même effet avec un bouton différent. C'est faux, et c'est la faute que ce document existe pour empêcher.

**3. Le tramage se compte en pixels du document, jamais en pixels d'écran.**
Une cellule de 18 px sur une image de 4000 px de large, ce n'est pas la même chose que 18 px sur un aperçu de 800 px. Si l'aperçu ne compense pas, il **ment** : on règle une trame fine et on exporte une trame grossière. Tout paramètre spatial doit donc être exprimé en pixels du document et mis à l'échelle au rendu. C'est la contrainte technique la plus facile à oublier et la plus visible quand elle manque.

---

## 6. Le vocabulaire qu'on emploie

Les noms des modules sont **techniquement justes et courts**. On n'invente pas de nom poétique : c'est un labo, pas une boîte de filtres.

| Module | Ce qu'on écrit dans le résumé |
|---|---|
| **Halftone** | « Trame d'impression : une grille de points dont la taille varie. Le journal, la sérigraphie, le riso. » |
| **Bayer** | « Tramage ordonné : une matrice de seuils fixe, un motif géométrique régulier. La trame des écrans 1 bit. » |
| **Dither** | « Diffusion d'erreur : l'erreur de chaque pixel est reportée sur ses voisins. Le grain organique du Macintosh 1 bit. » |
| **Postérisation** | « Réduction du nombre de tons, sans tramage. Ce sont les bandes que les autres évitent. » |
| **Pixellisation** | « Réduction de la résolution. C'est elle qui donne son échelle à tout le reste. » |
| **Réglages** | « Luminosité, contraste, gamma, saturation. À placer avant un tramage. » |
| **Grain** | « Grain de pellicule monochrome, superposé sans transformer le reste. » |

« Tramage » est le mot-parapluie pour les trois premiers. Il n'apparaît pas comme nom de module — il apparaîtra dans les pages `/effets`, qui sont exactement l'endroit fait pour expliquer ce que ce document raconte.

---

## Sources

- [Halftone — HandWiki](https://handwiki.org/wiki/Halftone) · [Halftone screen angles — The Print Guide](http://the-print-guide.blogspot.com/2009/05/halftone-screen-angles.html) · [Halftone screens — Pixartprinting](https://www.pixartprinting.co.uk/blog/halftones-screens/)
- [AM / FM screening](https://printing.santhipriya.com/2015/02/am-fm-screening-process/) · [Stochastic screening — Wikipedia](https://en.wikipedia.org/wiki/Stochastic_screening) · [Halftoning — Nx Color](https://nxcolor.com/halftoning/)
- [The Complete Guide to Dithering](https://www.ascii-magic.com/blog/complete-guide-to-dithering) · [Atkinson dithering — Wikipedia](https://en.wikipedia.org/wiki/Atkinson_dithering) · [Dithering and the Engoodening of Computer Graphics](https://beltoforion.de/en/dithering/) · [Ordered dithering vs error diffusion](https://www.turbodither.com/learn/ordered-dithering-vs-error-diffusion)
- [Lucas Pope and the rise of the 1-bit « dither-punk » aesthetic — Game Developer](https://www.gamedeveloper.com/design/lucas-pope-and-the-rise-of-the-1-bit-dither-punk-aesthetic) · [Lucas Pope on Obra Dinn's 1-bit art style — PlayStation Blog](https://blog.playstation.com/archive/2019/10/17/lucas-pope-on-return-of-the-obra-dinns-art-style/)
- [Blue noise dithering — Andrew Bauer](https://abau.io/blog/blue_noise_dithering/) · [Spatiotemporal Blue Noise Masks (UCSD)](https://cseweb.ucsd.edu/~ravir/stbn.pdf) · [Dithering part three — Bart Wronski](https://bartwronski.com/2016/10/30/dithering-part-three-real-world-2d-quantization-dithering/)
- [The history of ASCII Art — ASCII Art Archive](https://www.asciiart.eu/history-of-ascii-art) · [ASCII Art History: From 19th Century Typewriters to TikTok](https://inkmeascii.com/blog/ascii-art-history/)
- Références produit et esthétiques du projet : `docs/U.LAB-BRIEF.md` §2 (artkit.cc, dasca.studio, endlesstools.io, brik.space, comptes de veille).
