# Prompt à donner à Claude Code

Copier-coller le bloc ci-dessous dans Claude Code, dans un dossier vide, avec le
contenu de `design_handoff_winx_colorix/` posé à la racine.

---

Je veux construire **Winx Colorix**, une PWA personnelle qui remplace un carnet
papier de coloriages mystère. Une seule utilisatrice, un seul iPhone, aucun
compte, aucun serveur, aucune donnée qui sort.

Tout le dossier de design est dans ce répertoire. Lis-les dans cet ordre avant
d'écrire une ligne de code :

1. `SPECS.md` — spécifications fonctionnelles. **Fait foi sur le fonctionnel.**
2. `README.md` — spécifications visuelles précises des deux écrans dessinés,
   avec tous les jetons de couleur, typo, rayons, espacements.
3. `icons/README.md` — icônes, manifeste, coquille PWA, zones de sécurité.
4. `captures/` — les quatre vues en PNG.
5. Les fichiers `.dc.html` — les maquettes elles-mêmes, ouvrables dans un
   navigateur. Ce sont des **références de design**, pas du code à reprendre :
   elles s'appuient sur un runtime de maquettage (`support.js`, `image-slot.js`)
   qui n'a rien à faire dans l'application.

## Contraintes non négociables

Elles viennent de `SPECS.md` §3 et ce sont des choix, pas des oublis :

- **HTML, CSS, JavaScript natifs. Modules ES. Zéro dépendance, zéro build.**
  Pas de React, pas de Vite, pas de Tailwind, pas de `package.json` si on peut
  l'éviter. Si tu penses avoir besoin d'une bibliothèque, propose-la-moi et
  explique pourquoi, ne l'installe pas.
- **IndexedDB pour toutes les données**, y compris les photos en Blob.
  `localStorage` uniquement pour les préférences légères.
- **Service worker cache-first** sur la coquille → l'app doit fonctionner en mode
  avion.
- **Cible unique : Safari iOS sur iPhone 14 Plus, 428 × 926 pt.** Pas de
  responsive desktop, pas d'Android, pas de rétrocompatibilité. Cette contrainte
  autorise les API récentes sans repli.
- Plein écran installé sur l'écran d'accueil, zones de sécurité gérées en CSS.

## Ce qu'il ne faut pas construire

`SPECS.md` §9 et `README.md` §8 : aucun écran de connexion, d'inscription, de
profil, de tutoriel d'accueil, de notifications, de fonctions sociales, de
commentaires, de classements, de série quotidienne à ne pas rompre. Rien de tout
cela n'existe dans cette app. Ne les ajoute pas « au cas où ».

## Ordre de travail

Suis les jalons de `SPECS.md` §13, et **arrête-toi à la fin de chaque jalon** pour
que je teste sur l'iPhone avant de continuer.

**Jalon 0 — vérifications.** Avant tout code applicatif, écris une page unique de
diagnostic qui exécute les six vérifications de `SPECS.md` §2 et affiche leur
résultat à l'écran : hébergement HTTPS, installation et service worker actif en
mode avion, persistance de ~50 Mo, format livré par la capture photo (JPEG ou
HEIC), `navigator.share()` avec un fichier image, Wake Lock dans la web app
installée. Je la lance sur l'appareil et je te rapporte les six résultats.
**V4 est le plus important** : si Safari livre du HEIC brut il faudra un décodage
côté client, ce qui change l'architecture des photos. N'écris pas le pipeline
photo avant d'avoir ma réponse.

**Jalon 1 — socle.** PWA installable, manifeste et icônes fournis, catalogue en
lecture seule, coche d'un album, génération des planches numérotées, statuts,
export JSON. La bibliothèque de `captures/ecran2-albums.png` et
`ecran2-album-ouvert.png`.

**Jalon 2 — nuanciers.** Sets amorcés, attribution code → feutre, fiche coloriage
complète. **C'est le jalon qui rend l'app utile** : à la fin de celui-ci elle
remplace le carnet. Ne passe pas au suivant avant qu'il soit irréprochable.

Puis 3 pipette, 4 photos, 5 statistiques, 6 finitions, comme dans `SPECS.md`.

## L'écran qui compte

La fiche coloriage est ouverte quinze fois par soirée, lue à bout de bras, le
téléphone posé à plat sur la table sous une lampe. `SPECS.md` §5 le dit sans
détour : tout le reste de l'app peut être médiocre, celui-ci non.

Concrètement : contraste maximal, référence de feutre en 40–44 px, aucun décor en
fond de liste, aucune statistique, aucun badge, aucune suggestion. La cible
tactile est la rangée entière. Le Wake Lock est actif tant qu'on est dessus.

**Deux mises en page ont été dessinées** — `captures/ecran1-fiche-A.png` (ordre du
livre, sobre) et `ecran1-fiche-B.png` (manquants regroupés en tête, bandes de
couleur pleines). Implémente **A** d'abord, c'est la plus simple ; je tranche
après essai sur l'appareil. Les deux partagent l'en-tête, la barre d'actions et
toutes les valeurs typographiques, donc le second devrait être une variante de
mise en page, pas une réécriture.

## Le piège du jeu de codes

L'album Winx Club utilise **31 codes** :

```
1 2 3 4 5 6 7 8 9 0 a b c d e f h k m n p q r t u v x y z ◊ Δ
```

Trois choses à ne pas rater :

- Ce n'est ni numérique ni alphabétique. `0` vient après `9`, `◊` et `Δ` ferment
  la série. C'est l'ordre de la légende imprimée, et l'app doit le respecter.
- Les caractères ambigus sont volontairement écartés par l'éditeur : `g i j l o s
  w` ne doivent **jamais** être proposés.
- Le jeu de codes est une **propriété du livre**, pas une constante globale. Un
  autre album aura un autre jeu.

Le tableau complet des 31 codes avec leur teinte, leur hexadécimal et le feutre
attribué est dans `README.md` §7. Utilise-le comme jeu d'essai. Le code `c` est le
seul à porter deux feutres superposés : c'est le cas qui prouve la
fonctionnalité, garde-le.

## Deux points à me faire confirmer

- Les **six couleurs de fées** du `README.md` §4.1 sont déduites, pas fournies par
  l'utilisatrice. Elles ne servent que d'accents décoratifs. Pose-les en
  variables CSS nommées pour qu'on les corrige d'un seul endroit.
- Dans les correspondances de la planche 24, `7` et `0` pointent tous deux vers
  GuangNa 878. C'est peut-être une erreur de lecture du carnet manuscrit. Ne
  « corrige » rien : ce sont des données d'essai, l'app les lira dans IndexedDB.

## Comment je veux travailler

- Explique-moi ce que tu vas faire avant de le faire, en français.
- Pas de code mort, pas de fonction « pour plus tard », pas de commentaire qui
  décrit ce que le code dit déjà.
- Les noms de variables, de fonctions et de fichiers en français ou en anglais,
  au choix, mais **un seul des deux** dans tout le projet.
- À la fin de chaque jalon : un résumé court de ce qui marche, ce qui manque, et
  ce que je dois tester sur l'appareil.

Commence par lire les cinq sources, puis dis-moi ce que tu as compris et ce qui te
manque avant d'écrire la page de diagnostic du jalon 0.
