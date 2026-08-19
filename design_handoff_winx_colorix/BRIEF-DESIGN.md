# Winx Colorix — Brief interface

Document destiné à Claude Design. Les spécifications fonctionnelles complètes
sont dans `SPECS.md` ; ce brief ne couvre que l'interface.

---

## 1. Le produit

Une PWA qui remplace un carnet papier. Une coloriste tient à jour, pour chaque
planche de ses livres de coloriage mystère, la correspondance entre les codes
imprimés dans le livre et les références de ses propres feutres. Elle suit sa
collection, photographie ses résultats, consulte ses statistiques.

## 2. L'utilisatrice

Une seule personne, 21 ans, fan des Winx. Elle possède plusieurs centaines de
feutres (Posca et GuangNa Pack 360) et colorie le soir, chez elle, souvent
plusieurs heures. Elle est seule utilisatrice : aucun compte, aucune
connexion, aucune fonction sociale interne.

## 3. Contraintes d'affichage

- **iPhone 14 Plus uniquement**, 428 × 926 pt. Pas de version tablette ni
  bureau, aucun point de rupture à prévoir.
- Web app installée sur l'écran d'accueil, **plein écran, sans barre Safari**.
  Prévoir les zones de sécurité haute et basse.
- Usage à une main, pouce. Les actions fréquentes vivent dans le tiers bas de
  l'écran.
- Elle colorie sous une lampe, le téléphone posé à plat sur la table à côté
  d'elle. La lisibilité en oblique compte autant que de face.

## 4. Le grand écart à résoudre

L'app contient deux registres opposés, et c'est le vrai problème de design :

**Un outil.** La fiche coloriage est consultée quinze fois par soirée, du coin
de l'œil, à bout de bras. Contraste maximal, typographie large, aucune
décoration. Un fond pailleté derrière un nuancier le rendrait inutilisable.

**Une galerie.** La bibliothèque et les statistiques sont des écrans de plaisir,
consultés posément, faits pour être montrés aux copines. C'est là que vit le
décoratif.

L'identité doit tenir les deux sans ressembler à deux applications différentes.
C'est pour cette raison que les deux premiers écrans demandés sont ceux qui
occupent les extrémités.

## 5. Direction visuelle

**Les codes de l'univers Winx, jamais les personnages.** Palettes des six fées,
ailes traitées en motif ou en filigrane, éclats, dégradés, typographie
expressive. Aucune reproduction de visuel sous droits.

Deux points à faire trancher par l'utilisatrice avant de figer quoi que ce soit :

- **Quelle époque des Winx ?** La série 2D des débuts, les saisons ultérieures
  en images de synthèse et le reboot récent ont des identités très différentes.
  Ce choix détermine tout le reste.
- **Les six dominantes de couleur** associées à Bloom, Stella, Flora, Musa,
  Tecna et Aisha. Elle les connaît mieux que quiconque ; ne pas les deviner.

## 6. Écran 1 — Fiche coloriage (prioritaire)

L'écran le plus utilisé de l'app. À produire en premier, seul.

**Contenu.**
- En-tête : l'album, le numéro de la planche, le statut
- Le nuancier : une ligne par code présent sur la planche. Chaque ligne porte
  la pastille de couleur imprimée dans le livre, le caractère du code, et la
  référence du ou des feutres attribués — **c'est la référence qui doit être
  la plus grosse chose de l'écran**
- Un code peut recevoir plusieurs feutres, superposés pour créer une nuance
- Un code peut n'être pas encore attribué : cet état doit se repérer d'un
  coup d'œil
- Actions : chronomètre facultatif, bouton « Terminé »

**Comportement.** L'écran ne s'éteint pas tant qu'on est dessus. Un tap sur une
ligne ouvre l'attribution du feutre.

**Données réelles à utiliser dans la maquette.** Album « Coloriages Mystères —
Winx Club », planche n° 24, en cours. Les codes imprimés dans ce livre forment
un jeu de 31 caractères — les lettres ambiguës sont volontairement absentes :

```
1 2 3 4 5 6 7 8 9 0 a b c d e f h k m n p q r t u v x y z ◊ Δ
```

Teintes approximatives relevées sur le nuancier du livre, à affiner :

| Code | Teinte | Code | Teinte | Code | Teinte |
|---|---|---|---|---|---|
| 1 | noir bleuté | b | lavande | q | rose pâle |
| 2 | kaki clair | c | prune très foncé | r | rouge |
| 3 | bleu profond | d | bordeaux | t | orange |
| 4 | bleu moyen | e | framboise | u | jaune orangé |
| 5 | bleu ciel | f | rose vif | v | jaune |
| 6 | bleu clair | h | magenta | x | gris très foncé |
| 7 | bleu très clair | k | rose moyen | y | gris-vert foncé |
| 8 | noir | m | rose clair | z | vert foncé |
| 9 | bleu-gris foncé | n | terracotta | ◊ | vert moyen |
| 0 | violet foncé | p | beige rosé | Δ | vert clair |
| a | violet | | | | |

Correspondances relevées dans son carnet pour cette planche, à corriger par
elle si la lecture est fautive :

```
1 → Posca 8018      6 → GuangNa 888     e → GuangNa 916
2 → GuangNa 657     7 → GuangNa 878     f → GuangNa 910
3 → GuangNa 746     0 → GuangNa 878     z → GuangNa 794
4 → GuangNa 634     c → GuangNa 925     ◊ → GuangNa 649
5 → GuangNa 650     q → GuangNa 913     Δ → GuangNa 645
```

## 7. Écran 2 — Bibliothèque

L'écran d'entrée de l'app, et son visage.

- La liste des albums qu'elle possède, avec couverture et progression
  (« 12 sur 50 »)
- Accès au catalogue complet des livres Hachette pour cocher un nouvel album
- À l'ouverture d'un album : la grille de ses planches numérotées, chacune
  montrant son état — pas commencée, en cours, terminée avec sa photo en
  vignette

C'est ici que la grille de vignettes photo produit l'effet de collection. Elle
doit donner envie d'en remplir une de plus.

## 8. Écrans suivants (ne pas produire tout de suite)

Attribution d'un feutre · Inventaire des feutres et de leur état · Pipette sur
photo de légende · Statistiques et mosaïque annuelle · Paliers de progression ·
Réglages et sauvegarde.

## 9. Ce qu'il ne faut pas dessiner

Écran de connexion, inscription, profil, tutoriel d'accueil, notifications,
fonctions sociales internes, commentaires, classements, série quotidienne à ne
pas rompre. Aucune de ces choses n'existe dans l'app.

## 10. Livrable attendu

Un fichier HTML autonome par écran, données en dur, sans dépendance externe,
ouvrable directement dans Safari sur l'iPhone. Il sera testé sur l'appareil
avant d'être figé, puis transmis à Claude Code pour l'implémentation.
