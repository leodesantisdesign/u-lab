# Étape 1 — La bascule : la coquille de l'éditeur

> Objectif : `/create` en ligne — **l'éditeur complet, entièrement manipulable, zéro pixel rendu par le GPU.**
> À la fin, tu ajoutes un module, tu le réordonnes, tu le règles, tu le caches, tu le retires. Rien n'apparaît dans l'aperçu, et c'est normal.
> Prérequis : Étape 0 terminée ✅ · avoir lu `CLAUDE.md` §1 et §7, et `docs/U.LAB-ARCHITECTURE.md` §3 à §6.

**Pourquoi sans moteur.** Dans ce produit, la mécanique *est* le produit. Un utilisateur juge U.LAB sur la fluidité avec laquelle il empile et règle, pas sur la beauté d'un shader isolé. Donc on construit la mécanique d'abord, on la manipule dans un vrai navigateur, et on la corrige tant que ça coûte dix minutes. Brancher du WebGL sur une mécanique bancale, c'est se condamner à la garder.

---

## Ce que tu gardes, ce que tu jettes

Tu es en train de finir le design system. **Ne jette pas ce travail.**

| Statut | Quoi |
|---|---|
| ✅ **Conservé tel quel** | `packages/ui/src/tokens.css`, `reset.css`, `fonts.css`, les polices Geist |
| ✅ **Conservé** | `SectionLabel`, `SliderRow`, `Select`, `Button`, `Panel` — ils servent tous, et davantage qu'avant |
| ♻️ **Recyclé** | `StackItem` → devient la ligne de pile complète (icône, nom, Changer, ⋮, poignée) |
| ♻️ **Recyclé** | `PreviewFrame` → l'aperçu de l'éditeur, avec ratio et étiquette de pile |
| ♻️ **Conservé** | `packages/palette` (vide pour l'instant) — les palettes restent partagées |
| 🚫 **Jamais créée** | La page `/u-dither`. Tu t'es arrêté juste avant : parfait, ne la crée pas |
| ❌ **Supprimé** | Le dossier `tools/` et sa ligne dans `pnpm-workspace.yaml` |
| ➕ **Nouveau** | `packages/core`, `packages/modules`, `packages/modulation` |

Concrètement, tu as déjà fait les prompts 1 à 3 de l'ancienne étape (tokens, polices, composants) et `/ui` tourne. **Tout ça est acquis.** Cette étape reprend exactement là.

Le design system ne change pas dans ses valeurs. Il gagne des surfaces : inspecteur flottant, modal de modules, tiroir de modulation. Elles sont décrites en **section 4** de `docs/U.LAB-DESIGN-SYSTEM.md` (réécrite pour l'occasion).

---

## Le geste à obtenir à la fin

C'est le test de recette. Si tu peux faire ça de bout en bout, l'étape est réussie :

1. Tu ouvres `/create`. Une pile de trois modules : **Image → Halftone → Grain**.
2. Tu cliques **Halftone** — l'inspecteur affiche ses réglages, générés depuis son manifeste.
3. Tu bouges **Fréquence** — la valeur suit en chiffres monospacés.
4. Tu cliques **+** — le modal Outils s'ouvre, trois colonnes, Halftone et Grain grisés.
5. Tu ajoutes **ASCII** — il s'insère dans la pile, l'inspecteur bascule dessus.
6. Tu le glisses au-dessus de Halftone. Tu fais **⋮ → Cacher**, puis **⋮ → Retirer**.
7. Tu cliques **Changer** sur Halftone — le modal s'ouvre déjà filtré sur les traitements.
8. Tu déplies le tiroir du bas — la timeline est là, vide, graduée en temps.
9. Tu cliques **Exporter** — le modal s'ouvre, options complètes, bouton inerte.
10. Tout ça au clavier aussi, et correct sur téléphone.

---

## Avant de commencer

```bash
git checkout -b pivot-editeur
```

On travaille sur une branche. `main` reste déployable pendant toute l'étape.

---

## Prompts pour Claude Code

Un par un, en vérifiant entre chaque. **Les prompts 0 et 1 sont les seuls qui comptent vraiment** — si le modèle de document est juste, le reste s'écrit tout seul.

### Prompt 0 — Comprendre et faire le ménage

> **En plan mode** (`Shift+Tab` ×2). Tu lis avant de proposer, et tu ne touches à rien tant que tu n'as pas validé le plan.

```
Passe en plan mode. Lis dans cet ordre :
1. CLAUDE.md en entier (il vient d'être réécrit — le §7 explique la bascule)
2. docs/U.LAB-ARCHITECTURE.md sections 3 à 6
3. docs/U.LAB-DESIGN-SYSTEM.md
4. l'état actuel de packages/ui et apps/lab

Le projet bascule d'un modèle "une page par outil" vers "une galerie de
modèles + un éditeur unique à pile de modules".

Propose-moi un plan de bascule qui :
- supprime le dossier tools/ et sa ligne "tools/*" dans
  pnpm-workspace.yaml
- liste ce qui est conservé de packages/ui (tokens, polices, et les
  composants SectionLabel, SliderRow, Select, Button, Panel, StackItem,
  PreviewFrame) — je ne veux perdre aucun de ces fichiers
- crée les paquets packages/core, packages/modules, packages/modulation
  avec leur package.json, et conserve packages/palette tel quel
- signale tout ce que tu trouves dans le repo qui contredirait la
  nouvelle architecture et que je n'aurais pas anticipé

Ne code rien. Montre-moi le plan.
```

**Tu vérifies :** qu'aucun fichier de `packages/ui/src` ne figure dans la liste des suppressions. Rien de ce que tu as construit ces derniers jours ne doit disparaître.

---

### Prompt 1 — Le modèle de document

C'est le prompt le plus important de l'étape. Le reste de U.LAB en dépendra pendant des années.

```
Crée packages/core (@ulab/core), en TypeScript strict.

src/types.ts — recopie fidèlement le modèle de document de
docs/U.LAB-ARCHITECTURE.md §3 : Project, ModuleInstance, Modulation,
ModSource, et les types associés (ParamValue, BlendMode, Ease, Rect).
N'invente aucun champ qui ne soit pas dans le document ; si un champ
te semble manquer, dis-le-moi au lieu de l'ajouter.

src/store.svelte.ts — le store du document, en runes Svelte 5 :
- $state du Project courant
- selectedModuleId
- addModule(type, atIndex?) / removeModule(id) / moveModule(from, to)
- toggleModule(id) / replaceModule(id, newType)
- setParam(moduleId, key, value)
- $derived : le module sélectionné, la source courante

src/history.ts — undo/redo par instantanés JSON du document.
Regroupe les modifications rapprochées d'un même paramètre en une
seule entrée (fenêtre 400ms), sinon un déplacement de curseur crée
cinquante entrées d'historique.

src/serialize.ts — toUlab(project) / fromUlab(json), avec contrôle du
champ version et un point d'entrée pour les futures migrations.

Contraintes :
- le document reste sérialisable en JSON de bout en bout : aucune
  fonction, aucune texture, aucun handle dedans
- aucune dépendance à WebGL ni au DOM dans ce paquet
- des tests unitaires pour store et history (vitest) : ajout,
  suppression, réordonnancement, undo/redo, aller-retour de
  sérialisation

Fais tourner les tests et montre-moi les résultats.
```

**Tu vérifies :** les tests passent. Puis tu relis `types.ts` face au §3 de l'architecture, champ par champ. Une dérive ici se paye pendant deux ans.

---

### Prompt 2 — Le registre de modules

```
Crée packages/modules (@ulab/modules).

src/types.ts : ModuleDef et ParamDef, tels que décrits en
docs/U.LAB-ARCHITECTURE.md §4. Types de paramètre supportés dès
maintenant : number, enum, boolean, color, point, text, file.

Puis un dossier par module, chacun avec son manifeste UNIQUEMENT
(aucun shader à cette étape — render est déclaré mais son fragment
peut être un placeholder) :

SOURCE      : source.image · source.video · source.webcam · source.couleur
TRAITEMENT  : traitement.dither · traitement.halftone · traitement.ascii
              traitement.pixelisation · traitement.posterisation
FINITION    : finition.grain · finition.vignette · finition.scanlines
              finition.aberration

Pour les paramètres, inspire-toi de _legacy/u-dither-v1/ (modes.ts,
presets.ts) : les plages et les valeurs par défaut y ont été éprouvées
à l'usage. Chaque paramètre doit avoir un libellé français clair, une
plage sensée, une unité quand elle existe, et une valeur par défaut qui
donne un résultat correct sans rien toucher.

src/registry.ts : le registre, avec byType(), byCategory(), all().

Contrainte absolue : ce paquet ne dépend de rien d'autre que de ses
propres types. Ni UI, ni store, ni moteur.

Montre-moi les manifestes de halftone et de grain.
```

**Tu vérifies :** un manifeste doit se lire comme une fiche produit. Si tu ne comprends pas à quoi sert un paramètre en lisant son libellé, l'utilisateur ne comprendra pas non plus.

---

### Prompt 3 — L'inspecteur généré

C'est ici que se joue la promesse « ajouter un module ne coûte rien ».

```
Dans packages/ui/src/components/, en Svelte 5 :

ParamRow.svelte — prend un ParamDef + sa valeur, et rend le bon
contrôle : number → SliderRow, enum → Select, boolean → Switch,
color → ColorField, point → PointField, text → TextArea, file → FileDrop.
Crée les contrôles manquants en suivant le design system.
Chaque ligne montre libellé à gauche, valeur en mono à droite.

Inspector.svelte — le panneau flottant :
- en-tête : icône + nom du module + bouton fermer + poignée de
  déplacement
- deux onglets : "Commandes" (les params du manifeste) et
  "Effets" (fusion + opacité, depuis ModuleInstance.blend)
- en bas : "Réinitialiser les réglages"
- déplaçable à la souris, position mémorisée dans le composant
- si aucun module n'est sélectionné : état vide, une phrase, pas plus

L'inspecteur est ENTIÈREMENT généré depuis le manifeste. Aucun `if
(module.type === ...)` nulle part. Si un cas particulier semble
nécessaire, arrête-toi et dis-le-moi : c'est que le vocabulaire des
paramètres est incomplet, et on le corrigera à la racine.

Mets à jour la page /ui pour afficher l'inspecteur sur chacun des
modules du registre, à la suite. C'est notre page de contrôle.
```

**Tu vérifies :** ouvre `/ui`. Passe en revue les treize modules. Aucun panneau ne doit être moche ou vide. Si l'un l'est, c'est son manifeste qu'il faut corriger, pas l'inspecteur.

---

### Prompt 4 — L'écran /create

```
Crée apps/lab/src/pages/create.astro : une page Astro qui monte une
seule île Svelte, <Editor client:only="svelte" />.

Editor.svelte, en suivant la section 4 du design system :

- barre du haut : logo U.LAB à gauche · sélecteur de qualité d'aperçu
  (Basse / Moyenne / Haute + fps) · à droite : Modèles, Sauvegarder
- la PILE, centrée en haut de la zone de travail :
  lignes empilables [poignée] [icône] [nom] [Changer] [⋮]
  ⋮ ne propose que deux actions : Cacher, Retirer
  bouton + rond en dessous, relié par un fil vertical 1px
- l'APERÇU sous la pile, relié par le même fil :
  étiquette "Pile : <nom de la source>" en haut à gauche,
  sélecteur de ratio en haut à droite,
  un placeholder statique à l'intérieur (une image du dossier public)
- sous l'aperçu : [bascule d'affichage] [Exporter]
- l'INSPECTEUR flottant à gauche, sur le module sélectionné
- barre du bas repliée : "MODULATION & AUTOMATISATIONS" + chevron

Le projet par défaut au chargement : Image → Halftone → Grain.

Câblé au store de @ulab/core : ajout, suppression, réordonnancement par
glisser-déposer, masquage, sélection, modification de paramètre — tout
doit fonctionner sur le document.

AUCUN rendu : pas de WebGL, pas de chargement de fichier, pas d'export.
L'aperçu ne change jamais. C'est voulu.

Vérifie que `pnpm --filter lab build` passe, puis montre-moi.
```

**Tu vérifies :** le glisser-déposer de la pile. C'est le geste le plus utilisé de tout le produit — s'il est mou ou imprécis, tout le reste paraîtra bâclé.

---

### Prompt 5 — Le modal Outils

```
ToolsModal.svelte, ouvert par le bouton + ou par "Changer" :

Trois colonnes, alimentées par le registre :
- SOURCE : liste verticale, icône + nom, choix unique, coche sur
  la source actuelle
- TRAITEMENT et FINITION : grilles de vignettes (image + nom)

Comportements :
- ouvert par + → tout est proposé
- ouvert par "Changer" sur un module → filtré sur SA catégorie, et le
  module remplacé garde sa position dans la pile
- un module déjà présent dans la pile s'affiche grisé et non cliquable
  (sauf en catégorie SOURCE, où choisir une nouvelle source REMPLACE
  l'actuelle sans toucher au reste de la pile)
- un champ de recherche filtre les trois colonnes
- fermeture par Échap, par clic extérieur, par la croix
- navigable entièrement au clavier, focus piégé dans le modal

En l'absence de vraies vignettes, génère des placeholders unis avec le
nom du module. On les remplacera par de vrais rendus à l'étape 2.
```

**Tu vérifies :** « choisir une source ne détruit pas la pile ». C'est le geste qui permet d'appliquer un modèle à sa propre photo — le plus important du produit.

---

### Prompt 6 — Le tiroir de modulation (statique)

```
ModulationDrawer.svelte, replié par défaut, déplié par le chevron :

À gauche, un tableau de lignes ; chaque ligne :
[poignée] [œil] [sélecteur de paramètre ciblé] [✕]
[source de modulation] [sensibilité] [plage de valeurs]

Le sélecteur de paramètre liste tous les paramètres modulables de la
pile, groupés par module, sous la forme "Halftone · Fréquence".
Le sélecteur de source propose : Keyframes, Luminance, Mouvement,
Contraste, Audio (grave/médium/aigu/niveau).

À droite, la timeline : règle graduée en temps (00:00 → durée) et en
images. Une tête de lecture. Une piste vide par ligne.
Sous le tableau : "+ Ajouter une modulation".

Barre de transport centrée en haut du tiroir : lecture/pause, stop,
position / durée.

AUCUNE logique : on peut ajouter, retirer et réordonner des lignes dans
le document, mais rien n'est échantillonné et rien ne bouge. Les
keyframes ne sont pas éditables à cette étape.
```

---

### Prompt 7 — Le modal d'export et le mouvement

```
1) ExportModal.svelte, entièrement statique :
   onglets Image / Vidéo · qualité (Basse, Moyenne, Haute, 4K) ·
   format · débit · images par seconde · durée ·
   une ligne d'information calculée honnêtement à partir des réglages
   ("Résolution 1536 × 1536 · ~17,9 Mo · H.264") ·
   bouton Télécharger, désactivé, avec l'infobulle "disponible à
   l'étape 2".

2) Le mouvement, en CSS uniquement, section 5 du design system :
   - survols et focus : var(--dur-fast) var(--ease)
   - ajout d'un module : opacity + translateY(-6px), var(--dur)
   - impulsion --accent le long du fil (~450ms) quand la pile change,
     et bordure de l'aperçu qui s'allume brièvement
   - ouverture des modals et du tiroir : var(--dur) var(--ease)
   - prefers-reduced-motion : toutes les durées à 0

Rien ne s'anime en largeur ni en position sur l'aperçu.
```

---

### Prompt 8 — Vérification et mise en ligne

```
Avant de committer, vérifie et corrige :
- `pnpm build` passe sur tout le workspace
- les tests de @ulab/core passent
- aucune couleur, taille ni durée en dur dans le code : uniquement
  des var(--...) du design system
- aucun `if (module.type === ...)` dans packages/ui
- tout l'éditeur est utilisable au clavier, focus visible partout
- l'écran reste correct à 390px de large
- packages/modules ne dépend d'aucun autre paquet

Puis commit ("feat: bascule vers l'éditeur unique — coquille /create")
et pousse la branche pivot-editeur.
```

Une fois la *preview* Cloudflare vérifiée, tu fusionnes dans `main` et tu vas voir `u-lab.pages.dev/create` **sur ton téléphone**.

---

## Réussite de l'étape

- [ ] Les dix gestes du test de recette passent, à la souris **et** au clavier
- [ ] Ajouter un module au registre le fait apparaître dans le modal et lui donne un inspecteur complet, **sans toucher à `packages/ui`**
- [ ] Aucun `if (module.type === ...)` nulle part dans l'UI
- [ ] Undo/redo fonctionne sur toutes les opérations de pile
- [ ] Le document est sérialisable et se recharge à l'identique
- [ ] `pnpm build` passe et `/create` est en ligne
- [ ] L'écran tient sur téléphone
- [ ] `prefers-reduced-motion` coupe bien les animations

---

## Les deux pièges de cette étape

**1. Le module qui veut son cas particulier.** Au moment de l'inspecteur, il y aura une tentation : « pour ce module-là, juste un petit `if` ». C'est la mort de l'architecture, en une ligne, et elle passera en revue de code sans qu'on la voie. La bonne réponse est toujours la même : **enrichir le vocabulaire des paramètres**, jamais dévier l'UI. Si Claude Code propose un cas particulier, refuse et demande le type de paramètre manquant.

**2. Vouloir voir quelque chose.** À un moment tu vas te dire « je mettrais bien un vrai canvas, juste pour voir ». Non. L'étape 1 n'a pas de moteur, et c'est ce qui la rend rapide et jetable. Le GPU arrive à l'étape 2, sur une mécanique qu'on aura déjà corrigée.

Et le piège hérité de l'ancienne étape, toujours valable : **ne laisse pas Claude Code inventer des valeurs.** Une nuance de gris, un rayon, une durée qui n'est pas dans `docs/U.LAB-DESIGN-SYSTEM.md`, c'est une dérive. Reprends-le.

---

## Ensuite

**Étape 2 — le moteur.** `packages/engine` en WebGL2, le ping-pong de framebuffers, et trois modules réellement branchés : `source.image`, `traitement.halftone`, `finition.grain`. Le jour où le premier halftone apparaît dans cet aperçu, U.LAB existe.
