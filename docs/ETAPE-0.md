# Étape 0 — Fondations & mise en ligne

> Objectif : **une URL publique en ligne**, mise à jour automatiquement à chaque `git push`.
> À la fin, le site sera quasi vide — c'est voulu : on valide toute la chaîne avant d'écrire le moindre effet.
> Version 2 — réécrite après ton rangement des dossiers.

---

## État de départ (vérifié)

```
U.LAB/                        43 Mo au total
├─ CLAUDE.md                  ← à la racine, c'est correct
├─ CLAUDE/                    ← dossier vide résiduel, à supprimer
├─ docs/                      ← les 3 documents de référence
└─ app/U.DITHER/app/  43 Mo   ← ancien code (dont 41 Mo de node_modules)
```

✅ Les 1 Go de photos sont sortis, le dossier est sain.
✅ Rien n'est encore versionné — on part sur une base propre.
✅ GitHub et Cloudflare : comptes créés.

**Deux corrections déjà faites pour toi :**
- `CLAUDE.md` a été remonté à la racine. C'est indispensable : Claude Code ne charge automatiquement que `./CLAUDE.md`. Dans un sous-dossier il n'est lu qu'à la demande, et un bug connu l'empêche parfois de se charger du tout. C'est le fichier qui fait le pont entre Cowork et Claude Code — il doit rester là.
- Les 3 autres documents sont regroupés dans `docs/`.

**Ce qu'il reste à ranger** (les prompts s'en chargent) :
- Le dossier vide `CLAUDE/` → à supprimer.
- `app/U.DITHER/app/` → triple imbrication inutile, et le nom `app/` va entrer en collision avec le `apps/` du monorepo. Devient `_legacy/u-dither-v1/`, sans les node_modules (~2 Mo au lieu de 43).

---

## Partie A — Les prompts pour Claude Code

Ouvre ton terminal **dans le dossier `U.LAB`**, lance `claude`, et donne les prompts **un par un**. Vérifie entre chaque, ne colle jamais tout d'un coup.

### Prompt 1 — Ranger l'existant

```
Lis CLAUDE.md puis docs/U.LAB-ARCHITECTURE.md pour le contexte.

Range le dossier avant qu'on initialise git :

1. Supprime le dossier vide CLAUDE/ (son contenu a déjà été déplacé).
2. Déplace le code de app/U.DITHER/app/ vers _legacy/u-dither-v1/
   en supprimant au passage node_modules/, dist/ et package-lock.json.
   On ne garde que le code source (web/src, web/index.html, web/package.json,
   web/tsconfig.json, api/src, README.md). Supprime ensuite le dossier app/
   devenu vide.
3. Supprime tous les .DS_Store.

Montre-moi l'arborescence finale et le poids total avant/après.
```

**Tu vérifies :** le poids doit tomber autour de 2–3 Mo. Plus aucun dossier `app/` à la racine, plus de `CLAUDE/`.

---

### Prompt 2 — Le .gitignore, AVANT git init

```
Crée un .gitignore à la racine adapté à un monorepo pnpm + Astro :
- node_modules/ (tous niveaux), dist/, build/, .astro/, .turbo/
- .DS_Store, *.log
- .env et .env.*
- les formats d'assets lourds par sécurité : *.mov, *.mp4, *.HEIC, *.HEIF,
  *.psd, *.ai  (mes photos vivent hors du repo, mais je veux un filet)

Fais ensuite `git init`, puis `git status` et MONTRE-MOI la liste complète
des fichiers qui seraient versionnés. Ne commit pas encore.
```

**Tu vérifies :** une trentaine de fichiers maximum, uniquement du texte (`.md`, `.ts`, `.json`, `.html`, `.css`). **Aucune image, aucun `node_modules`.** Si tu vois autre chose, dis-le-lui avant de continuer.

---

### Prompt 3 — Le squelette du monorepo

```
Mets en place le monorepo pnpm décrit dans CLAUDE.md §3 :

- pnpm-workspace.yaml couvrant apps/*, tools/*, packages/*
- package.json racine (private: true, scripts dev et build)
- Dossiers avec un .gitkeep : tools/, packages/engine/, packages/ui/,
  packages/palette/, packages/export/
- Un README.md court à la racine (ce qu'est U.LAB, comment lancer le projet)
- IMPORTANT : _legacy/ ne doit PAS faire partie du workspace pnpm.

Si pnpm n'est pas installé, active-le avec corepack.
Lance `pnpm install` et montre-moi la sortie.
```

---

### Prompt 4 — L'application Astro

```
Crée l'application Astro dans apps/lab :
- template minimal, TypeScript strict
- une seule page d'accueil : le titre "U.LAB" et une ligne de description.
  Aucun style élaboré, on fera le design system à l'Étape 2.
- le package doit s'appeler "lab" pour que `pnpm --filter lab ...` fonctionne

Vérifie que `pnpm --filter lab dev` démarre, puis que
`pnpm --filter lab build` produit bien apps/lab/dist.
Montre-moi la sortie des deux commandes.
```

**Tu vérifies :** ouvre l'URL locale (en général `http://localhost:4321`) et **regarde la page dans ton navigateur**. C'est ta première vérification visuelle — le moment où tu confirmes que ça marche pour de vrai.

---

### Prompt 5 — Commit et publication

```
Fais un premier commit propre ("chore: fondations du monorepo U.LAB"),
puis ajoute ce remote et pousse sur main :

https://github.com/MON-PSEUDO/u-lab.git

Avant de pousser, montre-moi `git status` et la taille de ce qui va partir.
```

*(remplace `MON-PSEUDO` par ton pseudo GitHub, et `u-lab` par le nom exact de ton dépôt)*

**Tu vérifies :** quelques Mo, pas des centaines. Si c'est énorme, **stoppe** et fais corriger le `.gitignore`.

---

## Partie B — Mettre en ligne sur Cloudflare

1. Tableau de bord Cloudflare → **Workers & Pages** → **Create** → onglet **Pages** → **Connect to Git**.
2. Autorise l'accès à ton GitHub, sélectionne le dépôt.
3. Configuration de build :
   - **Framework preset** : `Astro`
   - **Build command** : `pnpm --filter lab build`
   - **Build output directory** : `apps/lab/dist`
   - *(« Root directory », s'il existe : laisse vide — on build depuis la racine du monorepo)*
4. **Save and Deploy**.

Une à deux minutes plus tard, tu as une URL en `.pages.dev`. **C'est ton site, en ligne, sans que rien ne tourne chez toi.**

Désormais, chaque `git push` sur `main` relance le build et met le site à jour tout seul. Cette configuration ne se refait jamais.

---

## Comment savoir que l'Étape 0 est réussie

- [ ] `CLAUDE.md` est bien à la racine du dépôt.
- [ ] Le dépôt GitHub pèse quelques Mo, sans aucune image ni `node_modules`.
- [ ] `pnpm --filter lab dev` affiche la page en local.
- [ ] **L'URL `.pages.dev` s'affiche depuis ton téléphone en 4G, ordinateur éteint.** C'est la preuve que l'hébergement ne dépend pas de ta machine.
- [ ] Tu modifies le texte de la page, tu pousses, et le changement apparaît en ligne en ~1 min.

Toutes cochées → on passe à l'**Étape 1 : le moteur de rendu** (`packages/engine`).

---

## Si ça coince

- **`pnpm: command not found`** → `corepack enable`, puis relance. Sinon `npm install -g pnpm`.
- **Le build Cloudflare échoue** → copie le log de build du dashboard à Claude Code. C'est presque toujours le *build command* ou l'*output directory*.
- **Un fichier trop gros refusé au push** → le `.gitignore` est arrivé trop tard. Signale-le, il nettoiera l'historique.
- **Cloudflare ne trouve pas pnpm** → demande-lui d'ajouter le champ `"packageManager"` dans le `package.json` racine.
- **Doute sur une commande git** → demande-lui d'expliquer *avant* d'exécuter. Tu es là pour apprendre.

---

## Sources
[Claude Code — memory & CLAUDE.md](https://docs.anthropic.com/en/docs/claude-code/memory) · [CLAUDE.md en sous-dossier : bug connu](https://github.com/anthropics/claude-code/issues/2571) · [Deploy Astro to Cloudflare (Astro docs)](https://docs.astro.build/en/guides/deploy/cloudflare/) · [Astro sur Cloudflare Pages (Cloudflare docs)](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/)
