# Winx Colorix — Spécifications

PWA de suivi de coloriages mystère et de correspondance de nuanciers.
Usage strictement mobile, mono-utilisateur, hors ligne.

---

## 1. Intention

Remplacer un carnet papier.

Aujourd'hui, l'utilisatrice note à la main, pour chaque planche : « Winx Club –
page 24 », puis la liste des codes de la légende avec la référence du feutre
choisi pour chacun. Elle refait ce travail à chaque coloriage, sur un carnet
qui peut se perdre, sans historique et sans moyen de savoir ce qu'elle possède
déjà.

L'app doit faire trois choses, dans cet ordre d'importance :

1. **Tenir le nuancier de chaque coloriage** — c'est l'écran ouvert pendant
   qu'elle colorie, quinze fois par soirée.
2. **Suivre sa collection** — quels albums elle possède, quelles planches sont
   faites, avec photo du résultat.
3. **Lui montrer son travail** — statistiques, progression, partage.

Tout le reste est du confort.

---

## 2. Vérifications préalables (bloquantes)

À exécuter sur l'iPhone cible avant d'écrire du code applicatif. Chacune peut
invalider un choix d'architecture.

| # | Vérification | Critère |
|---|---|---|
| V1 | Hébergement HTTPS disponible et joignable | L'URL s'ouvre dans Safari iOS |
| V2 | Installation sur l'écran d'accueil, service worker actif | L'app s'ouvre en mode avion |
| V3 | Persistance du stockage : écrire ~50 Mo, fermer, rouvrir après 72 h | Les données sont intactes |
| V4 | Capture photo via `<input type="file" accept="image/*">` | Vérifier si Safari livre du JPEG ou du HEIC |
| V5 | `navigator.share()` avec un fichier image vers Instagram | La photo arrive dans l'app cible |
| V6 | Wake Lock dans la web app installée | L'écran reste allumé sur la fiche coloriage |

V4 est le plus important : si Safari livre du HEIC brut, il faut un décodage
côté client, ce qui est coûteux. Le comportement attendu est une conversion
automatique en JPEG, à confirmer.

### Résultats relevés sur l'appareil

iPhone, iOS 18.7, Safari 26.6.1, web app installée sur l'écran d'accueil.
Page de diagnostic : `verifications/`.

| # | Résultat |
|---|---|
| V1 | **OK.** HTTPS Let's Encrypt valide, contexte sûr. |
| V2 | **OK.** Service worker actif, sonde servie depuis le cache en mode avion. |
| V3 | **En attente.** 50 Mo écrits et relus intacts, quota annoncé **39,3 Go**. Le verdict à 72 h reste à relever. `navigator.storage.persist()` est **refusé**, y compris en web app installée : la conservation n'est donc garantie par aucun contrat, seulement observée. C'est ce qui donne son poids à l'export du §9. |
| V4 | **OK — pas de HEIC.** Safari livre du JPEG (`ff d8 ff e0`, JFIF), décodé en 57 ms et ré-encodé sans difficulté. **Aucun décodeur à embarquer**, le pipeline du §8 s'écrit tel quel. Une réserve : le ré-encodage 1600 px / qualité 0.8 pèse **548 Ko**, pas les ~300 Ko annoncés au §8 — soit ~275 Mo pour 500 planches, sans conséquence face au quota. |
| V5 | **OK.** `canShare({files})` accepté, feuille de partage validée avec le fichier image. |
| V6 | **Partiel.** L'API existe et le verrou est accordé en web app installée. Le verrou se relâche au passage en arrière-plan — comportement normal de l'API. La durée de maintien écran allumé reste à mesurer. |

---

## 3. Architecture

**PWA statique. Aucun serveur, aucun compte, aucune donnée qui sort.**

- HTML / CSS / JavaScript natifs, modules ES, **zéro dépendance, zéro build**
- Stockage : **IndexedDB** pour tout, y compris les photos (Blob)
- `localStorage` réservé aux préférences légères (thème, dernier album ouvert)
- Service worker en *cache-first* sur la coquille de l'app → fonctionnement
  hors ligne intégral. Un bouton **Actualiser** dans les réglages déclenche la
  mise à jour et affiche la version en place : désinstaller la web app pour la
  mettre à jour effacerait son IndexedDB
- HTTPS obligatoire (exigence du service worker). N'importe quel hébergeur
  statique convient. L'app ne contient aucune donnée sensible : une URL non
  référencée suffit comme protection.

**Cible unique : Safari iOS sur iPhone 14 Plus.** Pas de responsive desktop, pas
de support Android, pas de rétrocompatibilité. Cette contrainte est un choix :
elle autorise les API récentes sans repli.

---

## 4. Modèle de données

### 4.1 Catalogue (livré avec l'app, en lecture seule)

`data/catalogue.json`, versionné, remplaçable sans toucher aux données de
l'utilisatrice.

```
Livre {
  id            "hachette-winx-club"
  titre         "Coloriages Mystères — Winx Club"
  collection    "Winx Club" | "Disney" | "Marvel" | "Art-thérapie" | ...
  editeur       "Hachette Heroes"
  ean13         "978..."
  annee         2024
  nb_coloriages 50
  couverture    URL éditeur (chargée en ligne, repli sur une pastille de couleur)
}
```

Les visuels de couverture ne sont **pas** embarqués dans l'app : lien vers
l'image de l'éditeur, mis en cache après premier affichage. Évite le poids et
la question des droits.

### 4.2 Données utilisatrice (IndexedDB)

```
Possession { livre_id, date_acquisition, note }

Coloriage {
  id, livre_id, numero          1..N, généré à la coche du livre
  statut                        pas_commence | en_cours | termine
  sujet_revele                  texte libre, saisi à la fin — c'est le mystère
  date_debut, date_fin
  duree_cumulee_s               chrono facultatif
  difficulte                    1..5
  note                          texte libre
}

Nuancier { coloriage_id, releve_le, entrees: [ Entree ] }
Entree   { code: "1".."0" | "a".."z" | "s30".."sN" pour un symbole
           glyphe,              masque du symbole découpé sur la photo, s'il y en a un
           pastille_hex,        couleur imprimée sur cette planche-là, relevée
           feutres: [feutre_id] ordonnés — superposition pour créer la nuance
           note }

Marque   { id, nom }                          Posca, GuangNa, extensible
Set      { id, marque_id, nom, nb_feutres }   "Pack 360"
Feutre   { id, set_id, reference "792", nom "Leaf green",
           hex, etat: possede | faible | a_sec | non_possede }

Photo    { id, coloriage_id, blob, role: resultat | detail | reference, date }
```

**Le code de légende n'est pas numérique, et il n'est stable qu'en partie.**
Les vingt-neuf premiers rangs ne bougent jamais d'une planche à l'autre :

```
1 2 3 4 5 6 7 8 9 0 a b c d e f h k m n p q r t u v x y z
```

Les caractères ambigus sont volontairement écartés par l'éditeur (pas de
`g i j l o s w`) — l'app doit respecter ce jeu et ne jamais proposer les lettres
exclues.

**Au-delà du vingt-neuvième rang, l'éditeur emploie des symboles qui changent
d'identité et d'ordre d'une planche à l'autre.** Ils ne sont donc pas une
propriété du livre mais de la planche, et le catalogue ne peut pas les porter.
`Nuancier.entrees` tient la série du livre, puis ce que la planche a en propre,
dans son ordre à elle.

**Un symbole est reconnu, ou à défaut découpé.** Le relevé du §6.0 connaît la
position exacte de chaque case : il extrait le code imprimé, puis le compare à
des gabarits qu'il dessine lui-même. Le répertoire de l'éditeur est court et ses
glyphes sont nets — comparer des formes suffit, là où un moteur d'OCR pèserait
plusieurs mégaoctets pour une quinzaine de signes, et lirait mal des caractères
isolés et rares.

Reconnu, le symbole devient un vrai caractère et `Entree.code` le porte. Sinon
le découpage est gardé en masque dans `Entree.glyphe`, que les écrans peignent
dans l'encre calculée comme ils peindraient un caractère, et la clé est le rang
de la case — `s30`, `s31` ; `s` est l'une des lettres écartées par l'éditeur, la
collision est donc impossible.

**Deux candidats trop proches ne sont jamais départagés** : le découpage
l'emporte. Un symbole en image vaut mieux qu'un mauvais caractère, et c'est le
même principe qu'au §6.2 — l'app propose, son œil tranche. Sur l'écran de
vérification, un tap sur une case refuse le caractère reconnu et rend son image.

Le jeu de codes vient du catalogue seul : en garder une copie à la coche de
l'album empêcherait toute correction de la série d'atteindre les planches déjà
ouvertes.

---

## 5. L'écran de travail : la fiche coloriage

C'est l'écran le plus utilisé de l'app. Tout le reste peut être médiocre, celui-ci
non.

**La palette appartient à la planche, pas au livre.** Chaque planche a sa page
« Mon nuancier #N » dans le livre, où sa bande de codes est imprimée avec ses
couleurs à elle. Le jeu de codes reste une propriété du livre, mais **une
planche en prend le début, pas la totalité** : le nombre de nuances varie d'un
coloriage à l'autre — 17 sur la planche 47, qui s'arrête à `h`, bien davantage
sur la 50 — et jamais avec de trou au milieu. Aucune couleur n'est donc livrée
avec le catalogue : tant qu'une planche n'a pas été relevée, ses cases sont
grises — une couleur approchée serait plus trompeuse que rien.

**Contenu.** L'album et le numéro en en-tête. Puis la liste des codes du nuancier :
pour chacun, la pastille de couleur du livre, le caractère du code — ou, au-delà
de `z`, le symbole découpé sur la photo — et la ou les références de feutre en
très gros. Lisible à bout de bras, sur une table, sans
lunettes.

**Comportements.**
- Wake Lock actif : l'écran ne s'éteint pas tant qu'on est sur cette fiche
- Tap sur une ligne → attribution ou changement de feutre
- Bouton « Relever le nuancier en photo » → §6.0, toujours accessible : un
  mauvais cadrage se voit souvent après coup
- Bouton « Reprendre le nuancier de… » → copie les correspondances d'un autre
  coloriage du même album, puis on ajuste. Les feutres seulement : les couleurs
  imprimées appartiennent à la planche
- Chrono facultatif, un seul bouton, pas de compte à rebours
- Bouton « Terminé » → demande le sujet révélé et propose la photo

**Ce qu'il ne faut pas y mettre :** statistiques, badges, suggestions,
notifications. C'est un outil de travail.

---

## 6. Attribution d'un feutre à un code

Trois voies, de la plus rapide à la plus manuelle. Toutes partent de
`pastille_hex`, que le relevé du §6.0 remplit d'un coup.

**6.0 Relevé de la palette de la planche.** Elle photographie la page
« Mon nuancier #N » du livre. Quatre repères aux coins de la bande de couleurs
donnent l'homographie, un cinquième sur le blanc de la page donne la référence
colorimétrique — la page étant elle-même blanche, aucune feuille n'est à
ajouter dans le cadre. Chaque repère se pose au doigt sous une loupe grossie
cinq fois, puis s'affine aux quatre flèches, un pixel par appui : le doigt
masque ce qu'il vise, la flèche non. Les couleurs sont ensuite écrites d'un coup
dans le nuancier de la planche.

**Le compte de cases vient de la page, jamais du jeu de codes.** Avant la photo,
la série du livre est proposée et elle **tape le dernier code de la bande** ; le
reste se grise. Si la bande continue au-delà de `z`, elle **compte les cases à
symbole** au lieu de les nommer. Un compte faux ne donne pas un relevé incomplet
mais un relevé **décalé** : l'homographie étalerait N cases sur K rangées et
chaque couleur tomberait sur le mauvais code. Les codes au-delà du dernier
désigné restent gris, ils ne sont pas effacés.

**6.1 Pipette.** Pour un code isolé, ou pour corriger. Elle photographie la
bande de légende de la planche. L'app affiche la photo, elle tape sur une
pastille : moyenne des pixels sur une zone de 5 × 5, conversion en
hexadécimal, enregistrée comme `pastille_hex`.

**6.2 Proposition automatique.** À partir de `pastille_hex`, l'app calcule la
distance colorimétrique avec tous les feutres possédés et propose les trois plus
proches. Conversion sRGB → Lab puis ΔE76 : une soixantaine de lignes, aucune
dépendance. ΔE2000 est inutile ici, l'écart de perception ne le justifie pas
face à l'imprécision d'une photo prise à la lumière du salon.

**La proposition est toujours validée par elle.** Jamais d'attribution automatique
silencieuse : l'éclairage fausse tout, et c'est son œil qui décide.

**Une passe globale** propose un feutre pour tous les codes à pourvoir d'une
planche, chaque rangée montrant la couleur du livre, celle du feutre et l'écart.
Elle en écarte ce qu'elle veut, puis valide le reste d'un bouton — quarante-cinq
allers-retours deviennent un écran. La règle du paragraphe précédent tient
toujours : chaque ligne reste visible et refusable avant l'enregistrement, un
code déjà pourvu n'est jamais proposé donc jamais écrasé, et au-delà de ΔE 25
rien n'est retenu d'avance.

**6.3 Saisie directe.** Recherche par référence (« 792 ») ou par nom
(« leaf green »), avec filtre sur le set. Nécessaire pour les feutres qu'elle
connaît par cœur.

---

## 7. L'inventaire des feutres

Le point de friction principal : le Pack 360 GuangNa représente 360 saisies.

**Amorçage.** Les nuanciers de référence des sets sont livrés avec l'app sous
forme de `data/nuanciers/guangna-360.json` et `posca.json` — référence, nom,
hexadécimal. À l'installation, elle coche ses sets et tout apparaît d'un coup.

Les 360 couleurs du Pack 360 y sont, relevées **dans l'app** sur les planches du
nuancier papier puis reversées dans le fichier — et non générées hors app comme
le prévoyait ce paragraphe. Sur les 132 codes de quatre planches relevées,
l'écart au feutre le plus proche est de **ΔE 7 en médiane, 15 au pire** : le set
couvre la palette du livre sans trou.

**État de chaque feutre.** `possédé / faible / à sec / non possédé`, modifiable
d'un tap depuis n'importe quel écran où le feutre apparaît. C'est ce qui
alimente la liste de courses.

**Ajout manuel** pour les feutres hors set : marque, référence, nom, couleur
prise à la pipette sur son propre aplat.

**Précision.** La couleur du fabricant n'est pas la couleur rendue sur son
papier. L'app doit permettre de **remplacer l'hexadécimal d'amorçage par une
valeur pipettée sur son propre nuancier papier**, feutre par feutre. C'est ce qui
rend les propositions automatiques réellement justes.

---

## 8. Photos

- Capture ou choix depuis la photothèque, via `<input type="file" capture>`
- Redimensionnement à 1600 px sur le grand côté, JPEG qualité 0.8, via canvas
- Environ 300 Ko par photo. 500 coloriages ≈ 150 Mo : tenable
- Plusieurs photos par coloriage, avec un rôle : résultat, détail, référence
- Une photo est désignée comme vignette de la planche

---

## 9. Sauvegarde et export

**Fonction de premier plan, pas un réglage enterré.**

- Export : archive ZIP contenant `data.json` et le dossier `photos/`.
  Écriture ZIP en mode *stored*, sans compression — les JPEG sont déjà
  compressés. Environ 80 lignes, aucune dépendance.
- Import : restauration complète ou fusion, avec écran de confirmation
- `navigator.storage.persist()` demandé au premier lancement
- Rappel non intrusif si aucun export depuis 30 jours

Si deux ans de travail disparaissent avec le téléphone, l'app a échoué, quelles
que soient ses autres qualités.

---

## 10. Partage

Bouton unique sur une planche terminée. `navigator.share()` avec le fichier
image et une légende pré-remplie (album, numéro, sujet révélé, feutres
principaux utilisés). Elle choisit l'app de destination, elle écrit ce qu'elle
veut, elle publie là-bas.

**L'app ne rapatrie aucun commentaire, ne stocke aucun identifiant de réseau
social, n'appelle aucune API de plateforme.** Publier automatiquement sur
Instagram ou TikTok exigerait un compte professionnel et une validation
applicative, pour un résultat moins souple que le partage natif.

---

## 11. Statistiques

Écran de consultation, jamais de pression.

- **Progression par album** — barre, N sur M
- **Mosaïque** — toutes les planches terminées en grille, par mois. L'écran
  qu'on montre
- **Calendrier** — un carré par jour colorié, sur douze mois
- **Palmarès des couleurs** — codes et feutres les plus employés, en dégradé
- **Usure** — nombre de planches par feutre, croisé avec l'état déclaré. Sert
  aussi de liste de courses
- **Durée moyenne** par planche, si le chrono a été utilisé

**Progression.** L'échelle des transformations Winx comme paliers :
Charmix, Enchantix, Believix, Harmonix, Sirenix, Bloomix, Mythix, Butterflix,
Tynix, Onyrix. Seuils à fixer avec elle — c'est elle qui connaît l'ordre canonique
et qui doit trouver la progression juste. Une animation au franchissement, rien
de plus. Pas de série à ne pas rompre, pas de rappel quotidien : le coloriage est
une détente, l'app ne doit pas en faire une obligation.

---

## 12. Habillage

Confié à Claude Design, avec deux contraintes.

**Les codes de l'univers, pas les personnages.** Palettes des six fées, ailes
traitées en motif, éclats, typographie. Aucune reproduction de visuel sous
droits — et une identité qui cite l'univers sans le photocopier vieillira
beaucoup mieux.

**La fiche coloriage échappe au décor.** Contraste maximal, aplats de couleur
fidèles, typographie large. Un fond pailleté derrière un nuancier rendrait
l'outil inutilisable. Le décoratif vit dans le catalogue, les statistiques et
les transitions.

---

## 13. Jalons

| # | Livrable | Critère de fin |
|---|---|---|
| 0 | Vérifications §2 | Les six comportements sont confirmés sur l'iPhone |
| 1 | Socle | PWA installable, catalogue, coche d'un album, génération des planches, statuts, export JSON |
| 2 | Nuanciers | Sets amorcés, attribution code → feutre, fiche coloriage complète |
| 3 | Pipette | Photo de légende, extraction des couleurs, proposition par ΔE |
| 4 | Photos | Capture, compression, galerie, export ZIP complet |
| 5 | Statistiques | Mosaïque, calendrier, palmarès, paliers Winx |
| 6 | Finitions | Partage, Wake Lock, icônes, animations |

**Le jalon 2 est déjà utilisable au quotidien** — il remplace le carnet, ce qui
est l'objectif. Le jalon 3 fait gagner du temps, les suivants font plaisir.

### État

Jalons 0 à 6 construits et déployés. Le jalon 0 reste ouvert sur V3 et V6, qui
demandent du temps d'observation et non du code.

Le §6.0 est venu après coup, et en trois corrections successives — chacune née
d'avoir pris une planche observée pour une règle du livre :

1. Le catalogue portait une **palette unique**, relevée à l'œil sur la planche
   24 et servie à toutes les planches. Retirée : la couleur d'un code appartient
   à la planche.
2. Le **nombre de nuances** était déduit du jeu de codes. Il vient désormais de
   la page, car un compte faux ne tronque pas le relevé, il le décale.
3. La **série de codes** finissait par `◊ Δ`. Seuls les vingt-neuf premiers rangs
   sont stables ; au-delà, les symboles appartiennent à la planche.

Deux écarts assumés par rapport à ce document :

- Les **couvertures d'album sont embarquées** (`data/couvertures/`) plutôt que
  chargées depuis l'éditeur comme le prévoit le §4.1, pour que le catalogue
  reste consultable en mode avion. Le repli de couleur demeure pour ce qui
  manque. Elles restent hors du dépôt tant qu'il est public.
- Le **nombre de planches d'un livre** n'est pas dans le catalogue : l'éditeur
  ne publie que le nombre de pages. Il est demandé à la coche d'un album.

Les propositions automatiques du §6.2 ne piochent que dans les feutres qui ont
un hexadécimal — proposer sur des couleurs fausses serait pire que ne rien
proposer. Les 360 du Pack GuangNa l'ont désormais, et sont livrés avec l'app ;
la réserve ne vaut plus que pour les sets à venir.

---

## 14. Limites connues

- Le catalogue ne contient que les livres, pas le sujet des planches : elles sont
  générées vides et numérotées, nommées au fil des révélations
- La couleur pipettée dépend de l'éclairage de la photo — d'où la validation
  systématique par l'œil
- Les couvertures ne s'affichent qu'en ligne, tant qu'elles n'ont pas été mises
  en cache
- Un seul profil, aucune synchronisation entre appareils
- Safari iOS uniquement
- La reconnaissance des symboles du §6.0 peut se tromper : deux candidats trop
  proches sont laissés en image plutôt que départagés, mais une lecture fausse
  reste possible. D'où le refus d'un tap sur l'écran de vérification

## 15. Évolutions envisageables

- ~~Reconnaissance automatique de la grille sur une photo de nuancier papier, pour
  pipetter les 360 aplats d'un coup~~ — **fait.** Écran « Importer un nuancier » :
  quatre repères posés au doigt sur les pastilles des coins donnent
  l'homographie, un cinquième sur une feuille de papier blanc donne la référence
  colorimétrique. Le papier de la carte étant lui-même coloré, il ne peut pas
  servir de blanc : sans référence neutre dans le cadre, teinte du papier,
  température de la lumière et gradient d'éclairage sont indissociables.
- ~~Fabriquer le nuancier d'une planche depuis la photo de sa page « Mon
  nuancier »~~ — **fait.** Même géométrie que ci-dessus, sur une bande d'une
  seule colonne : les repères se posent aux quatre coins de la bande, dont les
  bords imprimés se visent bien mieux qu'un centre de case.
- Filtre « planches réalisables avec ce que je possède », et liste des feutres
  manquants pour les autres
- Détection du numéro de planche par OCR sur la photo de la légende — la
  reconnaissance par gabarits du §6.0 pourrait y servir, le répertoire étant
  alors les dix chiffres
- Import du catalogue à jour depuis un fichier, sans réinstaller l'app
