# Deux comptes GitHub sur la même machine

> Situation : le dépôt U.LAB appartient à **leodesantisdesign** (compte design), mais ta machine et VS Code sont configurés avec **leo.desantispro@gmail.com** (compte perso).
> Objectif : que U.LAB utilise le compte design, **sans rien casser** sur tes autres projets.

---

## Comprendre les deux problèmes

Git mélange visuellement deux choses qui n'ont rien à voir :

| | Ce que c'est | Ton état actuel | Gravité |
|---|---|---|---|
| **Identité** | Une étiquette texte (`user.name`, `user.email`) écrite dans chaque commit. Git ne la vérifie jamais. | `Léo De Santis <leo.desantispro@gmail.com>` ❌ | Cosmétique |
| **Authentification** | La preuve que tu as le droit d'écrire dans le dépôt. Vérifiée par GitHub. | Trousseau macOS = compte perso ❌ | **Bloquant (403)** |

On corrige les deux, dans cet ordre.

---

## Règle d'or : jamais de `--global` pour ce projet

Tout se configure **par dépôt** (`--local`). Comme ça :
- U.LAB → compte design
- tous tes autres projets → compte perso, inchangés

Si tu utilises `--global`, tu déplaces le problème au lieu de le résoudre.

---

## Partie 1 — Corriger l'identité (2 min)

Dans le terminal, **dans le dossier U.LAB** :

```bash
git config --local user.name "Leo De Santis"
git config --local user.email "TON-EMAIL-DESIGN@gmail.com"
```

Puis réécris le commit déjà fait avec la bonne identité :

```bash
git commit --amend --reset-author --no-edit
```

Vérifie :

```bash
git log --format='%an <%ae>'
```

→ doit afficher ton email design. *(C'est sans risque : le commit n'a jamais été poussé, tu ne réécris rien de public.)*

---

## Partie 2 — Corriger l'authentification

Deux méthodes. **Je recommande la A** : c'est plus long à mettre en place une fois, mais ensuite ça ne peut plus jamais se tromper de compte.

### Méthode A — Clé SSH dédiée (recommandée)

Le principe : une clé SSH par compte, et un **alias** qui encode le choix du compte **dans l'URL du dépôt**. Impossible de se tromper, puisque c'est écrit dans le projet lui-même.

**A1. Créer une clé pour le compte design**

```bash
ssh-keygen -t ed25519 -C "TON-EMAIL-DESIGN@gmail.com" -f ~/.ssh/id_ed25519_design
```

Appuie sur Entrée aux questions (pas de passphrase nécessaire pour commencer).

**A2. Copier la clé publique**

```bash
pbcopy < ~/.ssh/id_ed25519_design.pub
```

**A3. L'ajouter sur GitHub**

Connecté au compte **design** : [github.com/settings/keys](https://github.com/settings/keys) → *New SSH key* → colle → *Add SSH key*.

**A4. Créer l'alias**

```bash
open -e ~/.ssh/config
```

*(si le fichier n'existe pas : `touch ~/.ssh/config` puis relance)*

Ajoute ces lignes à la fin :

```
Host github-design
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_design
  IdentitiesOnly yes
```

`github-design` est un surnom que tu inventes. Il dit : « pour cet hôte, utilise cette clé-là ».

**A5. Pointer U.LAB sur l'alias**

Dans le dossier U.LAB :

```bash
git remote set-url origin git@github-design:leodesantisdesign/u-lab.git
```

Note bien `github-design` à la place de `github.com` — c'est ce qui aiguille vers le bon compte.

**A6. Tester**

```bash
ssh -T git@github-design
```

→ doit répondre `Hi leodesantisdesign! You've successfully authenticated...`
*(La première fois, il demande de confirmer l'empreinte : tape `yes`.)*

---

### Méthode B — GitHub CLI (plus rapide, moins sûr)

```bash
brew install gh        # si tu ne l'as pas
gh auth login          # choisis GitHub.com, HTTPS, et connecte le compte design
```

⚠️ **Le piège :** `gh` mémorise un compte *actif global*. Le jour où tu travailles sur un projet perso sans avoir fait `gh auth switch`, tu pousseras avec le mauvais compte ou tu te prendras un 403 sans comprendre pourquoi. C'est exactement le problème d'aujourd'hui, repoussé à plus tard.

À réserver si tu veux juste débloquer la situation tout de suite.

---

## Partie 3 — Pousser

```bash
git push -u origin main
```

Si ça passe, c'est réglé définitivement pour ce dépôt.

---

## Vérifier que tout est bon

- [ ] `git log --format='%an <%ae>'` → email **design**
- [ ] `git remote -v` → `git@github-design:...` (méthode A)
- [ ] `git push` fonctionne sans erreur 403
- [ ] Le commit apparaît sur GitHub, attribué au compte design
- [ ] Dans un **autre** projet, `git config user.email` renvoie toujours ton email perso *(la preuve qu'on n'a rien cassé)*

---

## Si ça coince

- **`403 Permission denied`** → macOS envoie encore les identifiants du compte perso. Ouvre *Trousseau d'accès*, cherche `github.com`, supprime l'entrée, recommence. (Avec la méthode A ce problème disparaît : SSH n'utilise pas le Trousseau.)
- **`Permission denied (publickey)`** → la clé n'est pas sur le bon compte GitHub. Vérifie que tu étais bien connecté au compte design en A3.
- **`Repository not found`** → souvent un vrai problème de droits déguisé : tu es authentifié avec le mauvais compte. Relance `ssh -T git@github-design`.
- **VS Code continue d'utiliser le mauvais compte** → VS Code a son propre gestionnaire de comptes GitHub, indépendant du terminal. Palette de commandes → *Sign out of GitHub*, puis reconnecte-toi. Le terminal, lui, obéit à la config ci-dessus.

---

## Pour tes futurs projets design

Une fois la clé créée, tu n'as plus que **deux lignes** à faire sur chaque nouveau dépôt design :

```bash
git config --local user.email "TON-EMAIL-DESIGN@gmail.com"
git remote set-url origin git@github-design:leodesantisdesign/NOM-DU-REPO.git
```

---

## Sources
[Two GitHub accounts, one machine](https://dineshpandiyan.com/blog/two-github-accounts-one-machine/) · [Maintaining multiple GitHub accounts on a single machine (One2N)](https://one2n.io/blog/maintaining-multiple-github-accounts-on-a-single-machine) · [8 Easy Steps to Set Up Multiple Git Accounts (GitGuardian)](https://blog.gitguardian.com/8-easy-steps-to-set-up-multiple-git-accounts/)
