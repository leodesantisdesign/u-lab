# CLAUDE.md — U.LAB

> Fichier de contexte projet. Lu à chaque session, par Claude Code (CLI) **et** par Claude en mode Cowork.
> C'est la mémoire commune du projet : si une décision compte, elle est écrite ici.
> Dernière révision : juillet 2026 — **révision majeure : bascule vers l'éditeur unique** (voir §7).

---

## 1. Ce qu'est U.LAB

Un **atelier de création visuelle** dans le navigateur, gratuit, sans compte et sans paywall. On y charge une **photo ou une vidéo**, on empile des procédés (dither, halftone, ASCII, pixel sort, grain…), on règle chaque procédé un par un, et on exporte en image ou en vidéo.

Ce n'est plus une collection d'outils séparés. C'est **une galerie de modèles en entrée, un éditeur unique derrière.**

**Quatre règles non négociables :**

1. **Un module = un procédé.** L'ancienne règle « un outil = une idée » n'est pas abandonnée : elle **descend d'un cran**. Elle s'appliquait à la page, elle s'applique maintenant au module. Dithering ≠ halftone ≠ ASCII : trois modules distincts, jamais un module fourre-tout à onglets. C'est plus strict qu'avant, pas moins.
2. **Une seule surface de création.** Tout se fait dans `/create`. Un utilisateur qui sait empiler deux modules sait utiliser tout U.LAB, aujourd'hui et dans deux ans. Aucun module ne mérite sa propre interface.
3. **Fonctionnel avant tout.** Un module doit servir *n'importe quelle* direction artistique, pas seulement celle de son auteur. Paramètres neutres et complets ; la patte de Léo s'exprime dans **le design de l'UI**, dans les modèles proposés et dans les valeurs par défaut — jamais en bridant l'utilisateur.
4. **Temps réel ou rien.** On bouge un curseur, l'aperçu répond. C'est le critère de qualité perçue n°1. Si un procédé ne tient pas le temps réel, on baisse la résolution de l'aperçu — jamais la qualité de l'export.

**Positionnement :** l'atelier gratuit, d'auteur, sans compte. Chaque module est une pièce signée, l'assemblage appartient à l'utilisateur.

**Public :** tout le monde. Simple et concret à l'usage, sans jargon.

**Référence assumée :** [tools.sketchdesign.club](https://tools.sketchdesign.club/) — mécanique de la pile, modal de modules, tiroir d'automation, retenue visuelle. On reprend **la mécanique et la philosophie**, pas les valeurs ni le domaine (eux : audio et génératif ; nous : photo et vidéo). Ce qu'on ne copie pas est listé en §7.

---

## 2. Stack (décidée, à respecter)

| Couche | Choix | Pourquoi |
|---|---|---|
| Shell / site | **Astro** | Accueil, galerie de modèles et pages d'effets restent 100 % statiques, zéro JS. L'éditeur est une île, chargée uniquement sur `/create`. Un visiteur qui regarde la galerie ne télécharge pas le moteur. |
| Éditeur | **Une île Svelte 5** montée sur `/create` | Les bundles les plus légers des frameworks applicatifs, et des *runes* (`$state`, `$derived`) taillées pour un store de document réactif. |
| Langage | **TypeScript**, strict | — |
| Rendu | **WebGL2 en socle + WebGPU en option** | WebGL2 marche partout par défaut ; WebGPU (~82 %, Firefox encore à la traîne) apporte les *compute shaders* (pixel sort, signaux vidéo). Détection via `navigator.gpu`, fallback systématique. |
| Document | **Store maison dans `packages/core`** | Un projet est un objet sérialisable. Pas de bibliothèque d'état : le modèle est simple, l'undo/redo se fait par instantanés. |
| Persistance | **IndexedDB** (projets + médias) + **fichier `.ulab`** (import/export) | Projets illimités en local, et l'utilisateur possède son travail. Zéro compte, zéro serveur. |
| Monorepo | **pnpm workspaces** (+ Turborepo si besoin) | Gratuit, standard, cache de build. |
| Hébergement | **Cloudflare Pages** | Le plus généreux en bande passante pour du statique. Site 100 % statique = coût quasi nul. |
| Export vidéo | **WebCodecs** + muxer (`mp4-muxer`) | ~20× plus rapide que ffmpeg.wasm (encodage matériel). Fallback `MediaRecorder`/WebM. |
| Export image | `canvas.toBlob()`, rendu hors aperçu à pleine résolution | — |

**Pas de backend.** Tout tourne dans le navigateur. Le backend Python de u.dither v1 (`udither_api`, FastAPI) est **abandonné** : il empêche le temps réel et impose un serveur à payer. Les fichiers de l'utilisateur ne quittent jamais sa machine — c'est aussi un argument de confiance, et un argument frontal contre les concurrents qui font transiter les médias.

### Points techniques à connaître avant de coder

- **L'error diffusion (Floyd–Steinberg, Atkinson) est séquentielle** : chaque pixel dépend du voisin déjà traité, donc pas de fragment shader classique. → chemin **CPU dans un Web Worker**, exécuté en résolution d'aperçu réduite et *debouncé* au repos. Ordered dithering (Bayer), halftone, quantification, finition → **fragment shaders**, parallèles, gains énormes.
- **Pixel sorting** → *compute*, donc chemin **WebGPU**, avec dégradation propre si absent.
- **Un module peut donc être GPU, Worker ou compute.** Le manifeste le déclare (`render.kind`), l'éditeur s'adapte. C'est prévu dès le départ, pas bricolé après.
- WebCodecs et `SharedArrayBuffer` exigent **HTTPS**. Vérifier le support Safari avant de promettre du MP4 ; prévoir le fallback WebM.
- **La vidéo doit être lue image par image** pour un export déterministe : `requestVideoFrameCallback` en aperçu, `VideoDecoder` (WebCodecs) à l'export. Ne jamais exporter en filmant la lecture temps réel.

---

## 3. Structure du monorepo

```
U.LAB/
├─ CLAUDE.md               # ce fichier — DOIT rester à la racine
├─ apps/
│  └─ lab/                 # Astro
│     └─ src/pages/
│        ├─ index.astro         # accueil : mes projets + galerie de modèles
│        ├─ create.astro        # l'éditeur (une seule île Svelte)
│        └─ effets/[slug].astro # une page vitrine par module → ouvre /create préchargé
├─ packages/
│  ├─ core/                # modèle de document, store, historique, sérialisation .ulab, IndexedDB
│  ├─ engine/              # WebGL2/WebGPU : contexte, ping-pong FBO, passes, sources, boucle, readback
│  ├─ modules/             # LE registre : un dossier par module (manifeste + shader + vignette)
│  ├─ modulation/          # keyframes, analyse audio, signaux vidéo, échantillonnage par image
│  ├─ palette/             # palettes partagées + quantification (dither, halftone, ascii, duotone)
│  ├─ ui/                  # design system + panneau d'inspecteur généré depuis les manifestes
│  └─ export/              # image (toBlob) + vidéo (WebCodecs / MediaRecorder)
├─ _legacy/
│  └─ u-dither-v1/         # ancien code, référence fonctionnelle uniquement, jamais étendu
└─ docs/
   ├─ U.LAB-BRIEF.md
   ├─ U.LAB-ARCHITECTURE.md   # modèle de document, registre, pipeline, plan d'étapes
   ├─ U.LAB-DESIGN-SYSTEM.md  # tokens, composants, surfaces de l'éditeur
   └─ ETAPE-*.md
```

**`tools/` n'existe plus.** Un module ne vit plus dans son propre dossier d'application : il vit dans `packages/modules/`, et il ne contient **ni UI, ni gestion d'état, ni logique d'export**. Il déclare des paramètres et fournit un shader (ou un worker). Tout le reste est fourni par l'éditeur.

**Test de conception :** si l'ajout d'un module oblige à toucher `packages/ui` ou `apps/lab`, c'est que l'abstraction est ratée. Un nouveau module = un dossier dans `packages/modules/` + une ligne dans le registre. Rien d'autre.

---

## 4. Conventions

- **Marque et nommage.** `U.LAB` est le produit. Les modules portent des noms simples et descriptifs — `Halftone`, `Dither`, `ASCII`, `Pixel sort` — **sans préfixe `u.`** : ce ne sont plus des produits. Le préfixe `u.` est réservé à la marque. Dossiers en `kebab-case`, fichiers TS en `camelCase`, composants en `PascalCase`.
- **Identifiants de module** : `categorie.nom` — `source.image`, `source.video`, `traitement.halftone`, `finition.grain`. Ces identifiants sont écrits dans les fichiers `.ulab` : **ils ne changent jamais** une fois publiés.
- **Chaque paramètre est déclaré dans le manifeste** : clé, libellé, type, min/max/pas, défaut, unité. L'UI est générée à partir de là. Aucune valeur magique, aucun contrôle écrit à la main.
- **Les modèles sont des points de départ, pas des rails.** Tout modèle ouvre une pile entièrement modifiable.
- **Design system : voir `docs/U.LAB-DESIGN-SYSTEM.md`.** Principe directeur : *l'interface se tait pour que l'image parle*. Aucune texture sur le chrome, un seul accent (`#FF6606`) réservé à l'état actif et à l'action principale, deux graisses maximum.
- **Performance :** 60 fps sur l'aperçu. Sélecteur de qualité d'aperçu explicite (Basse / Moyenne / Haute) — on assume le compromis devant l'utilisateur au lieu de le cacher.
- **Accessibilité de base :** contrastes lisibles, navigation clavier complète, cibles tactiles ≥ 44 px.
- **Pas de dépendance lourde sans justification** écrite ici.

---

## 5. Comment travailler avec moi

**Workflow : Explorer → Planifier → Coder → Vérifier & commit.**

1. **Explorer** — je lis les fichiers concernés avant d'écrire quoi que ce soit.
2. **Planifier** — plan validé avant toute édition (dans Claude Code : `Shift+Tab` ×2 = plan mode, lecture seule). Pas de « vibe coding » sur du code qu'on garde.
3. **Coder** — petits incréments.
4. **Vérifier** — la règle la plus importante : je dois toujours avoir un moyen de contrôler ma propre sortie (build qui passe, aperçu visuel, capture d'écran, diff relu). Commits fréquents.

**Répartition Cowork / Claude Code :** Cowork décide (architecture, arbitrages, documents, `CLAUDE.md` lui-même) ; Claude Code exécute dans le repo (code, build, git). Quand une décision est prise d'un côté, **elle atterrit dans `CLAUDE.md`** — c'est comme ça que les deux restent synchronisés.

**Gestion du contexte :** me pointer les bons fichiers plutôt que me déverser le repo. Repartir propre entre deux sujets sans rapport.

**Simplicité :** boucles simples et outils bas niveau > usines à gaz. Ne pas sur-architecturer avant que trois modules tournent réellement.

**Ce fichier est vivant :** toute décision technique ou esthétique importante s'y ajoute — surtout les décisions *négatives* (ce qu'on a essayé et écarté, et pourquoi).

---

## 6. État actuel

- **Étape 0 terminée** ✅ — monorepo pnpm + Astro, déployé sur Cloudflare Pages : **u-lab.pages.dev**, mis à jour à chaque push sur `main`.
- **Étape 1 en cours** — bascule vers l'éditeur unique. Voir `docs/ETAPE-1.md`.
- **Ce qui survit du design system déjà commencé :** les tokens, les polices et les composants de base (`SectionLabel`, `SliderRow`, `Select`, `Button`, `Panel`) sont **valides et conservés**. Seule la mise en page d'écran change.
- **Ce qui est abandonné :** l'idée d'une page par outil — la page `/u-dither` n'a jamais été construite, et ne le sera pas ; le dossier `tools/` est supprimé.
- `_legacy/u-dither-v1/` = **legacy, à ne jamais étendre**. Sert de **référence fonctionnelle uniquement** (algorithmes, palettes, presets, vocabulaire des paramètres).
- Les assets lourds (photos, rendus, vidéos de test) vivent **hors du dépôt**, sur le disque de Léo. Ne jamais les réintroduire dans le repo.

---

## 7. Journal des décisions

### Juillet 2026 — Bascule vers l'éditeur unique

**Ce qui a changé.** On abandonne « une page par outil » au profit de « une galerie de modèles + un éditeur unique à pile de modules ».

**Pourquoi.** Une page par outil produisait quatre interfaces à concevoir, maintenir et apprendre, pour un utilisateur qui veut de toute façon enchaîner les procédés — dithérer *puis* ajouter du grain n'était possible qu'en exportant et rechargeant. L'éditeur unique règle ça, et rend chaque nouveau module quasi gratuit à ajouter au lieu de coûter un écran complet.

**Ce qu'on ne copie pas à Sketch.** Le paywall et les exports gratuits comptés ; l'obligation de compte pour sauvegarder plus d'un projet ; le filigrane. U.LAB reste gratuit, sans compte, sans limite d'export — et ajoute deux choses qu'eux n'ont pas : des **signaux extraits de la vidéo** (luminance, mouvement, contraste) comme sources de modulation, et des **pages publiques par effet** qui expliquent le procédé avant d'ouvrir l'éditeur.

**Décisions négatives associées :**
- *SPA complète (SvelteKit) écartée* — l'accueil et les pages d'effets n'ont aucune raison d'embarquer du JS. Astro les garde statiques et l'île n'est chargée que sur `/create`.
- *Modules avec UI propre écartés* — un module qui dessine sa propre interface ramène le problème des quatre interfaces. L'UI est générée depuis le manifeste, sans exception.
- *Bibliothèque d'état tierce écartée* — le document est un objet simple ; les runes Svelte 5 et des instantanés suffisent pour l'undo/redo.
