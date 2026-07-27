# Étape 1.5 — Refermer la mécanique avant le GPU

> Objectif : **le document redevient le seul propriétaire de l'état**, un geste = une entrée d'historique, la pile se réordonne au doigt et au clavier, et le prompt 7 de l'étape 1 est terminé.
> À la fin, `/create` ne montre toujours rien de plus qu'avant. C'est encore voulu — mais cette fois la mécanique est prête à recevoir le moteur.
> Prérequis : Étape 1 fusionnée dans `main` · avoir relu `CLAUDE.md` §5 et `docs/U.LAB-ARCHITECTURE.md` §3 et §5.

---

## Pourquoi cette étape existe

L'étape 1 a produit une mécanique juste **dans ses gestes** : la pile s'empile, l'inspecteur se génère, le modal filtre, le tiroir se déplie. Rien de tout ça n'est à refaire.

Elle est fausse **dans son flux de données**. L'inspecteur écrit directement dans `instance.params` au lieu de passer par `store.setParam()`. Ça marche à l'écran — les runes Svelte propagent la mutation — et c'est précisément ce qui rend la faute invisible. Trois conséquences, dont la troisième est la seule qui compte vraiment :

1. **L'undo/redo ne couvre aucune modification de paramètre.** Le geste le plus fréquent du produit est le seul qui ne s'annule pas.
2. **La fenêtre de regroupement à 400 ms n'est jamais exercée.** La pièce la plus soignée de `history.ts` ne tourne que dans son propre test unitaire.
3. **Le moteur n'aura nulle part où se brancher.** L'architecture §5 pose comme règle : *« on ne redessine que si quelque chose a changé »*. Cette phrase suppose un point unique par lequel tout changement transite. Si l'UI mutate le document en direct, ce point n'existe pas, et l'invalidation du rendu se fera à coups d'écoutes disséminées — c'est-à-dire mal, et pour toujours.

C'est la même logique que celle qui justifiait l'étape 1 : brancher du WebGL sur une mécanique bancale, c'est se condamner à la garder. La mécanique n'est pas bancale sur ses gestes. Elle l'est sur sa plomberie, et le moteur se greffe exactement là.

**Le reste de l'étape** (glisser-déposer tactile, modal d'export, mouvement) ferme simplement ce que l'étape 1 avait laissé ouvert. C'est peu de travail, mais ça fait partie du même passage.

---

## Ce qui est acquis, ce qui bouge

| Statut | Quoi |
|---|---|
| ✅ **Intact** | `packages/core/src/types.ts` — transcription fidèle du §3, aucun champ inventé. On n'y touche pas. |
| ✅ **Intact** | `packages/modules` — treize manifestes, zéro dépendance. On n'y touche pas. |
| ✅ **Intact** | Les tokens, les polices, les treize composants du design system. Aucun n'est supprimé. |
| ✅ **Intact** | `ToolsModal` (Échap, piège de focus), `ModulationDrawer` (tout passe déjà par des callbacks). Ce sont les deux bons élèves de l'étape 1 — ils servent de modèle au reste. |
| ♻️ **Modifié** | `store.svelte.ts` — signatures d'`addModule` / `replaceModule`, ajout de `setFormat`, `setBlend`, `resetParams`, plafond d'historique |
| ♻️ **Modifié** | `Inspector.svelte` — passe de `bind:` direct à des callbacks |
| ♻️ **Modifié** | `StackItem.svelte` — Pointer Events, clavier, rôles ARIA |
| ➕ **Nouveau** | `ExportModal.svelte` · les animations du prompt 7 |

---

## Le geste à obtenir à la fin

Test de recette. Les dix gestes de l'étape 1 doivent toujours passer, **plus ceux-ci** :

1. Tu ajoutes un module. Un seul `Ctrl+Z` le retire — pas cinq.
2. Tu traînes le curseur **Fréquence** d'un bout à l'autre. Un seul `Ctrl+Z` revient à la valeur de départ.
3. Tu changes le mode de fusion, puis l'opacité. Deux `Ctrl+Z` distincts.
4. Tu changes le ratio d'aperçu. `Ctrl+Z` le rétablit.
5. Tu cliques « Réinitialiser les réglages ». Un seul `Ctrl+Z` restaure tous tes réglages d'un coup.
6. Tu réordonnes la pile **au doigt sur ton téléphone**. Puis au clavier, avec `Alt+↑` / `Alt+↓`.
7. Tu cliques **Exporter** — le modal s'ouvre, options complètes, bouton inerte.
8. Tu ajoutes un module : il apparaît en fondu, une impulsion orange descend le fil, la bordure de l'aperçu s'allume une fois. Une seule fois.
9. Tu actives « réduire les animations » dans ton OS : plus rien ne bouge, tout reste utilisable.

---

## Avant de commencer

```bash
git checkout main && git pull
git checkout -b etape-1-5
```

Et **avant le premier prompt**, fais tourner ce qui existe :

```bash
pnpm install
pnpm --filter @ulab/core test
pnpm build
```

Les tests de l'étape 1 n'ont pas été rejoués depuis la fusion. On part d'un vert connu, sinon on ne saura pas ce qu'on a cassé.

---

## Prompts pour Claude Code

Un par un, en vérifiant entre chaque. **Le prompt 1 est le seul qui compte vraiment** — les autres sont du rattrapage.

### Prompt 1 — Le document redevient propriétaire de son état

C'est le prompt qui justifie l'étape entière.

```
Lis d'abord packages/core/src/store.svelte.ts, packages/core/src/history.ts,
packages/ui/src/components/Inspector.svelte et
apps/lab/src/components/Editor.svelte.

Constat : l'inspecteur écrit directement dans instance.params[...] et
dans instance.blend via bind:. Le document est donc modifié sans passer
par le store — aucune entrée d'historique, updatedAt jamais mis à jour,
et le regroupement à 400ms de history.ts n'est jamais exercé.

Corrige, dans cet ordre :

1. packages/core — étends l'API du store pour qu'un geste utilisateur
   corresponde à UNE entrée d'historique :
   - addModule(type, initialParams, atIndex?) : les params par défaut
     arrivent à la création, plus après coup. Le core ne connaît
     toujours pas le registre — c'est l'appelant qui fournit l'objet.
   - replaceModule(id, newType, initialParams) : idem.
   - resetParams(moduleId, params) : remplace tout le bloc en un commit.
   - setBlend(moduleId, blend) : mode et opacité, chacun avec sa clé de
     regroupement.
   - setFormat({ ratio, width, height }) : un commit, comme le reste.
   - plafonne l'historique à 100 entrées (on jette les plus anciennes).

2. packages/ui/src/components/Inspector.svelte — supprime toute
   mutation directe. Le composant reçoit :
     onParamChange(key, value)
     onBlendChange(blend)
   et les appelle. Le $bindable de ParamRow reste tel quel : c'est
   l'inspecteur qui convertit le binding en callback.
   Masque l'onglet "Effets" quand def.category === 'source' — le §3 de
   l'architecture dit que blend est commun aux modules NON-source.
   (Un test sur la catégorie est autorisé : la catégorie est
   structurelle. Un test sur def.type ne l'est pas, et ne le sera
   jamais.)

3. apps/lab/src/components/Editor.svelte — câble ces callbacks sur le
   store, et remplace store.project.format = {...} par store.setFormat().
   applyDefaults() disparaît : les défauts passent par addModule /
   replaceModule / resetParams.

4. Ajoute les tests manquants dans packages/core :
   - ajouter un module puis annuler une fois retire bien le module
   - cinquante setParam successifs sur la même clé = une entrée
   - setParam sur deux clés différentes = deux entrées
   - resetParams = une entrée
   - setFormat est annulable
   - l'historique ne dépasse jamais 100 entrées

Fais tourner les tests et montre-moi les résultats.

Contrainte : après ce prompt, `grep -rn "instance\.\(params\|blend\)\s*=" packages/ui apps/lab`
et tout bind: écrivant dans le document doivent ne rien remonter.
Aucun composant d'UI ne modifie le document autrement que par une
méthode du store.
```

**Tu vérifies :** ouvre `/create`, traîne un curseur d'un bout à l'autre, fais `Ctrl+Z` une fois. Tu dois revenir à la valeur de départ, pas reculer d'un pixel. C'est tout le prompt en un geste.

---

### Prompt 2 — La pile se réordonne au doigt et au clavier

```
packages/ui/src/components/StackItem.svelte et le câblage dans
apps/lab/src/components/Editor.svelte.

Problème : le glisser-déposer utilise l'API HTML5 (draggable,
dragstart, drop). Elle est inopérante au tactile sur iOS Safari et sur
la plupart des navigateurs Android — or le design system §5 appelle ce
geste "le plus fréquent du produit", et l'étape 1 exige que l'écran
soit correct sur téléphone.

Remplace-la par des Pointer Events, qui couvrent souris, tactile et
stylet avec un seul chemin de code :
- pointerdown sur la poignée uniquement (pas sur toute la ligne : on
  doit pouvoir sélectionner un module sans le déplacer)
- setPointerCapture, seuil de 4px avant de considérer que le geste est
  un déplacement
- pendant le déplacement, les autres lignes s'écartent en transform,
  jamais en margin (design system §5)
- l'insertion se fait dans l'INTERSTICE le plus proche, pas sur la
  ligne survolée — c'est ce qui rend le geste précis
- touch-action: none sur la poignée, sinon le navigateur fait défiler
  la page à la place

Ajoute le réordonnancement clavier : sur une ligne focalisée,
Alt+ArrowUp / Alt+ArrowDown la déplacent d'un cran et le focus la
suit. Annonce le déplacement dans une région aria-live.

Corrige aussi l'accessibilité de la ligne : aujourd'hui c'est un div
role="button" tabindex="0" qui contient trois vrais <button>. Des
contrôles interactifs imbriqués dans un rôle bouton, c'est invalide et
l'ordre de tabulation devient confus. Propose-moi une structure
correcte (piste : la pile est une liste, la ligne un élément
sélectionnable) avant de l'appliquer.

Enfin, <svelte:window onclick={closeMenu} /> se déclenche à chaque clic
de l'application : restreins-le à l'ouverture du menu.
```

**Tu vérifies :** sur ton téléphone, en vrai. Puis au clavier, les yeux fermés — si tu ne sais pas où tu en es dans la pile, l'annonce `aria-live` manque.

---

### Prompt 3 — Le modal d'export

Le prompt 7 §1 de l'étape 1 n'a jamais été écrit. Reprends-le tel quel :

```
Crée packages/ui/src/components/ExportModal.svelte, entièrement
statique, en suivant ToolsModal.svelte pour la structure (voile,
Échap, piège de focus, fermeture au clic extérieur) :

- onglets Image / Vidéo
- qualité (Basse, Moyenne, Haute, 4K)
- format · débit · images par seconde · durée
- une ligne d'information calculée honnêtement à partir des réglages
  ("Résolution 1536 × 1536 · ~17,9 Mo · H.264") — calculée, pas écrite
  en dur : c'est cette honnêteté-là qu'on vend
- bouton Télécharger, désactivé, infobulle "disponible à l'étape 2"

L'onglet Vidéo n'est proposé que si la source de la pile est animée
(source.video ou source.webcam) — sinon il est grisé. Le test porte sur
la catégorie et le type de la SOURCE, pas sur un module quelconque.

Câble-le sur le bouton Exporter de l'Editor. Les valeurs proposées
viennent du document (format, duration, fps), pas de constantes.
```

---

### Prompt 4 — Le mouvement

Le prompt 7 §2 n'a pas été fait non plus. Symptôme mesurable : `--dur` n'est utilisé nulle part dans le repo, et il n'existe aucun `@keyframes`.

```
Uniquement du CSS, uniquement les tokens de docs/U.LAB-DESIGN-SYSTEM.md
§5. Aucune valeur de durée ni de courbe en dur.

1. Apparition d'un module dans la pile : opacity + translateY(-6px),
   var(--dur) var(--ease). Disparition symétrique.
2. Le fil entre la pile et l'aperçu : quand la pile change, une
   impulsion --accent le parcourt de haut en bas (~450ms) et la bordure
   de l'aperçu s'allume brièvement. C'est le SEUL retour "quelque chose
   vient d'être branché" — il doit rester seul, sinon il ne veut plus
   rien dire. Ajoute la durée 450ms comme token (--dur-pulse) plutôt
   que de l'écrire en dur, et mets-la à 0 sous prefers-reduced-motion.
3. Ouverture des modals et du tiroir : var(--dur) var(--ease).

Rien ne s'anime en largeur ni en position sur l'aperçu.
Vérifie qu'aucune animation ne survit à prefers-reduced-motion.
```

**Tu vérifies :** ajoute trois modules d'affilée. Si les impulsions se superposent et que ça clignote, l'effet est raté — il doit se relancer, pas s'empiler.

---

### Prompt 5 — Vérification

```
Avant de committer, vérifie et corrige :
- `pnpm build` passe sur tout le workspace
- les tests de @ulab/core passent, y compris les nouveaux
- aucun composant d'UI ne modifie le document directement : tout passe
  par une méthode du store
- aucun `if (module.type === ...)` nulle part (les tests sur
  ParamDef.type et sur ModuleDef.category sont légitimes)
- aucune couleur, taille ni durée en dur : uniquement des var(--...)
- tout l'éditeur est utilisable au clavier, focus visible partout
- l'écran reste correct à 390px de large
- packages/modules ne dépend toujours d'aucun autre paquet

Puis mets à jour CLAUDE.md :
- §6 : l'étape 1 est terminée, l'étape 1.5 aussi, la suivante est
  l'étape 2 (le moteur)
- §7 : ajoute deux décisions au journal —
  · "Aucun composant d'UI ne modifie le document directement : tout
    passe par une méthode du store. Raison : c'est le seul point où le
    moteur pourra brancher l'invalidation du rendu (architecture §5).
    Décision négative associée : le bind: direct sur le document est
    interdit, même quand il marche."
  · "Un geste utilisateur = une entrée d'historique. Les valeurs par
    défaut arrivent à la création du module, pas par une série de
    setParam après coup."

Commit ("refactor: le store redevient propriétaire de l'état + export,
mouvement, pile tactile") et pousse la branche etape-1-5.
```

---

### Prompt 6 — L'accueil, en passant

Petit, mais aujourd'hui personne ne peut atteindre l'éditeur :

```
apps/lab/src/pages/index.astro est resté le placeholder de l'étape 0.
Sans refaire la galerie de modèles (elle viendra plus tard), donne-lui
le strict minimum : le logo, la phrase de positionnement, et un lien
vers /create. Statique, zéro JS, avec les tokens du design system.
```

---

## Réussite de l'étape

- [ ] Les neuf gestes du test de recette passent, à la souris, au doigt **et** au clavier
- [ ] Un geste utilisateur = une entrée d'historique, sans exception
- [ ] Aucune écriture directe dans le document depuis `packages/ui` ou `apps/lab`
- [ ] La pile se réordonne sur téléphone
- [ ] `--dur` et `--dur-pulse` sont réellement utilisés ; aucun `@keyframes` ne survit à `prefers-reduced-motion`
- [ ] Le modal d'export s'ouvre et affiche une estimation calculée
- [ ] `pnpm build` passe, les tests de `@ulab/core` passent
- [ ] `CLAUDE.md` §6 et §7 sont à jour
- [ ] La preview Cloudflare est vérifiée avant fusion dans `main`

---

## Les deux pièges de cette étape

**1. « Ça marchait déjà. »** C'est vrai, et c'est le problème. Le `bind:` direct fonctionne parfaitement à l'écran — il ne casse rien de visible, il rend juste une catégorie entière de fonctionnalités impossible à construire plus tard. Une faute d'architecture qui produit un bug immédiat se corrige toute seule ; celle-ci non. Si Claude Code propose de « garder le binding pour les cas simples », refuse : la règle ne vaut que si elle n'a pas d'exception.

**2. Vouloir enchaîner sur le moteur.** L'étape 1.5 est courte et ingrate — aucun pixel nouveau à l'écran. La tentation sera de la faire à moitié pour arriver plus vite au premier halftone. C'est exactement l'ordre inverse du bon : chaque heure passée ici s'économise trois fois à l'étape 2, quand le moteur cherchera où se brancher.

Et le piège permanent, toujours valable : **ne laisse pas Claude Code inventer des valeurs.** Une durée, un rayon, une nuance qui n'est pas dans `docs/U.LAB-DESIGN-SYSTEM.md`, c'est une dérive. Reprends-le.

---

## Ensuite

**Étape 2 — le moteur.** `packages/engine` en WebGL2, le ping-pong de framebuffers, et trois modules réellement branchés : `source.image`, `traitement.halftone`, `finition.grain`. Le store étant redevenu le point de passage unique, l'invalidation du rendu tient en une ligne : *le document a changé → redessine*. C'était tout l'objet de cette étape.

Le jour où le premier halftone apparaît dans cet aperçu, U.LAB existe.
