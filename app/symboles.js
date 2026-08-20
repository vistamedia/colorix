/* Reconnaissance des symboles du livre par gabarits.

   Le répertoire de l'éditeur est petit et ses glyphes sont imprimés proprement :
   dessiner les caractères candidats et comparer les formes suffit. Un moteur
   d'OCR pèserait plusieurs mégaoctets de WebAssembly pour une quinzaine de
   signes, et se débrouille mal sur des caractères isolés et rares — il est
   entraîné à lire des mots.

   Ce qui n'est pas reconnu reste découpé sur la photo : mieux vaut un symbole
   en image que le mauvais caractère. */

const REPERTOIRE = ['ψ', 'Δ', '◊', '»', '?', '$', '¥', '≈', 'φ', '¶', '&', '#', '+', '£', 'œ', 'ж'];

const COTE = 48;
const SCORE_MINIMAL = 0.52;
/* Deux candidats trop proches — « φ » et « ψ » se ressemblent — ne sont pas
   départagés : mieux vaut retomber sur le découpage que poser le mauvais code. */
const AVANCE_MINIMALE = 0.10;

/* Deux formes ne se comparent qu'à taille et position égales : on recadre sur
   l'opaque, puis on inscrit dans un carré en gardant les proportions — « » »
   est large, « + » est carré, la différence porte du sens. */
function enCarre(source, sx, sy, sL, sH) {
  const toile = new OffscreenCanvas(COTE, COTE);
  const pinceau = toile.getContext('2d');
  const facteur = Math.min(COTE / sL, COTE / sH) * 0.92;
  const L = sL * facteur, H = sH * facteur;
  pinceau.drawImage(source, sx, sy, sL, sH, (COTE - L) / 2, (COTE - H) / 2, L, H);

  const donnees = pinceau.getImageData(0, 0, COTE, COTE).data;
  const forme = new Float32Array(COTE * COTE);
  for (let i = 0; i < forme.length; i++) forme[i] = donnees[i * 4 + 3] / 255;
  return forme;
}

function cadreOpaque(donnees, L, H) {
  let xMin = L, yMin = H, xMax = -1, yMax = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < L; x++) {
      if (donnees[(y * L + x) * 4 + 3] < 128) continue;
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }
  }
  return xMax < 0 ? null : [xMin, yMin, xMax - xMin + 1, yMax - yMin + 1];
}

/* On ne sait pas dans quelle fonte le livre est composé : chaque candidat est
   dessiné dans plusieurs familles et dans deux graisses, et c'est la meilleure
   ressemblance qui compte. Un « ¶ » à empattements ne ressemble guère à son
   homologue linéal. */
const FONTES = [
  '700 96px -apple-system, "Helvetica Neue", sans-serif',
  '400 96px -apple-system, "Helvetica Neue", sans-serif',
  '700 96px Georgia, "Times New Roman", serif',
  '400 96px Georgia, "Times New Roman", serif'
];

let gabarits = null;

function construireGabarits() {
  const COTE_RENDU = 160;
  const toile = new OffscreenCanvas(COTE_RENDU, COTE_RENDU);
  const pinceau = toile.getContext('2d');
  pinceau.textAlign = 'center';
  pinceau.textBaseline = 'middle';

  return REPERTOIRE.map(caractere => {
    const formes = [];
    for (const fonte of FONTES) {
      pinceau.clearRect(0, 0, COTE_RENDU, COTE_RENDU);
      pinceau.font = fonte;
      pinceau.fillStyle = '#FFFFFF';
      pinceau.fillText(caractere, COTE_RENDU / 2, COTE_RENDU / 2);
      const cadre = cadreOpaque(pinceau.getImageData(0, 0, COTE_RENDU, COTE_RENDU).data, COTE_RENDU, COTE_RENDU);
      if (cadre) formes.push(enCarre(toile, ...cadre));
    }
    return formes.length ? { caractere, formes } : null;
  }).filter(Boolean);
}

/* Jaccard sur l'opacité : la part commune des deux formes sur leur réunion.
   Insensible à l'épaisseur du trait, contrairement à une simple différence. */
function ressemblance(a, b) {
  let commun = 0, reunion = 0;
  for (let i = 0; i < a.length; i++) {
    commun += Math.min(a[i], b[i]);
    reunion += Math.max(a[i], b[i]);
  }
  return reunion ? commun / reunion : 0;
}

/* Rend le caractère du livre quand la forme découpée en désigne un sans
   ambiguïté, sinon null — auquel cas le découpage tient lieu de nom.
   `exclus` sont les caractères déjà pris sur la même planche : un livre ne
   répète pas un code. */
export function reconnaitre(decoupe, exclus = new Set()) {
  if (!decoupe) return null;
  gabarits = gabarits || construireGabarits();

  const forme = enCarre(decoupe, 0, 0, decoupe.width, decoupe.height);
  const scores = gabarits
    .filter(g => !exclus.has(g.caractere))
    .map(g => ({ caractere: g.caractere, score: Math.max(...g.formes.map(f => ressemblance(forme, f))) }))
    .sort((a, b) => b.score - a.score);

  if (!scores.length || scores[0].score < SCORE_MINIMAL) return null;
  if (scores[1] && scores[0].score - scores[1].score < AVANCE_MINIMALE) return null;
  return scores[0].caractere;
}
