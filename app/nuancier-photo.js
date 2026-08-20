import { versHex } from './couleur.js';

const versLineaire = (c) => (c /= 255) > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
const versSrgb = (l) => 255 * (l > 0.0031308 ? 1.055 * l ** (1 / 2.4) - 0.055 : 12.92 * l);

/* Le papier blanc est éclairé comme la carte : on veut qu'il ressorte à cette
   valeur plutôt qu'à 255, pour ne pas écrêter les pastilles les plus claires. */
const CIBLE_BLANC = versLineaire(246);

/* Homographie du carré unité vers les quatre repères, dans l'ordre
   haut-gauche, haut-droite, bas-droite, bas-gauche (Heckbert). */
export function homographie(coins) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = coins;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;

  let g = 0, h = 0;
  if (dx3 !== 0 || dy3 !== 0) {
    const den = dx1 * dy2 - dy1 * dx2;
    if (!den) return null;
    g = (dx3 * dy2 - dy3 * dx2) / den;
    h = (dx1 * dy3 - dy1 * dx3) / den;
  }
  return {
    a: x1 - x0 + g * x1, b: x3 - x0 + h * x3, c: x0,
    d: y1 - y0 + g * y1, e: y3 - y0 + h * y3, f: y0,
    g, h
  };
}

export function projeter(m, u, v) {
  const w = m.g * u + m.h * v + 1;
  return [(m.a * u + m.b * v + m.c) / w, (m.d * u + m.e * v + m.f) / w];
}

function medianeCanal(valeurs) {
  valeurs.sort((x, y) => x - y);
  const milieu = valeurs.length >> 1;
  return valeurs.length % 2 ? valeurs[milieu] : (valeurs[milieu - 1] + valeurs[milieu]) / 2;
}

function echantillonner(image, points) {
  const r = [], v = [], b = [];
  for (const [x, y] of points) {
    const px = Math.round(x), py = Math.round(y);
    if (px < 0 || py < 0 || px >= image.width || py >= image.height) continue;
    const i = (py * image.width + px) * 4;
    r.push(image.data[i]); v.push(image.data[i + 1]); b.push(image.data[i + 2]);
  }
  if (!r.length) return null;
  return [medianeCanal(r), medianeCanal(v), medianeCanal(b)];
}

/* Deux conventions de repérage. Sur la planche de feutres, les quatre repères
   sont posés au centre des pastilles extrêmes ; sur la bande du livre, aux
   quatre coins de la bande, dont les bords imprimés sont bien plus nets à
   viser que le centre d'une case de trente pixels. Chacune rend la position
   du centre de la case et le pas de la grille. */
const GRILLES = {
  centres: (i, n) => n > 1 ? [i / (n - 1), 1 / (n - 1)] : [0.5, 1],
  bords: (i, n) => [(i + 0.5) / n, 1 / n]
};

/* On échantillonne un anneau rectangulaire, jamais le centre : sur la planche
   de feutres il est percé, sur la bande du livre il porte le caractère du
   code. La médiane absorbe ce qui traverse. */
function pointsPastille(m, grille, colonne, rangee, colonnes, rangees) {
  const [u, pasU] = grille(colonne, colonnes);
  const [v, pasV] = grille(rangee, rangees);

  const points = [];
  for (let du = -0.30; du <= 0.301; du += 0.05) {
    for (let dv = -0.22; dv <= 0.221; dv += 0.055) {
      if (Math.hypot(du / 0.30, dv / 0.22) < 0.62) continue;
      points.push(projeter(m, u + du * pasU, v + dv * pasV));
    }
  }
  return points;
}

/* Le code est imprimé au centre de la case : c'est cette zone qu'on découpe
   pour les symboles que le catalogue ne peut pas nommer. Assez large pour un
   « ¶ » ou un « » », assez étroite pour ne pas mordre sur la case voisine. */
const PART_U = 0.40, PART_V = 0.44;

function cadreGlyphe(m, grille, colonne, rangee, colonnes, rangees) {
  const [u, pasU] = grille(colonne, colonnes);
  const [v, pasV] = grille(rangee, rangees);
  const points = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
    .map(([su, sv]) => projeter(m, u + su * PART_U * pasU, v + sv * PART_V * pasV));
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function extraire(image, coins, colonnes, rangees, repere) {
  const m = homographie(coins);
  if (!m) return null;
  const grille = GRILLES[repere];
  const cases = [];
  for (let rangee = 0; rangee < rangees; rangee++) {
    for (let colonne = 0; colonne < colonnes; colonne++) {
      cases.push({
        colonne, rangee,
        brut: echantillonner(image, pointsPastille(m, grille, colonne, rangee, colonnes, rangees)),
        centre: projeter(m, grille(colonne, colonnes)[0], grille(rangee, rangees)[0]),
        cadre: cadreGlyphe(m, grille, colonne, rangee, colonnes, rangees)
      });
    }
  }
  return cases;
}

const HAUTEUR_GLYPHE = 60;
const ECART_MINIMAL = 40;
const COUVERTURE_FILET = 0.7;

/* Découpe le code imprimé et le rend en masque : opaque là où l'encre s'écarte
   de la couleur de la case, transparent ailleurs. Les écrans le peignent
   ensuite dans leur encre calculée, comme ils peindraient un caractère.

   Les seuils sont pris sur l'écart maximal de la case, non fixés : le
   contraste d'un symbole blanc sur noir n'a rien de celui d'un symbole noir
   sur jaune. Et les filets qui séparent deux cases sont écartés d'abord — ils
   traversent toute la largeur, ce qu'aucun symbole ne fait, et leur contraste
   écraserait celui du code. */
export function glypheDeCase(image, cadre, brut) {
  const [x0, y0, x1, y1] = cadre.map(Math.round);
  const L = x1 - x0, H = y1 - y0;
  if (!brut || L < 6 || H < 6) return null;

  const ecarts = new Float32Array(L * H);
  let sommet = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < L; x++) {
      const px = x0 + x, py = y0 + y;
      if (px < 0 || py < 0 || px >= image.width || py >= image.height) continue;
      const i = (py * image.width + px) * 4;
      const d = Math.hypot(image.data[i] - brut[0], image.data[i + 1] - brut[1], image.data[i + 2] - brut[2]);
      ecarts[y * L + x] = d;
      if (d > sommet) sommet = d;
    }
  }
  if (sommet < ECART_MINIMAL) return null;

  const rangeeVive = new Uint8Array(H).fill(1);
  for (let y = 0; y < H; y++) {
    let couverts = 0;
    for (let x = 0; x < L; x++) if (ecarts[y * L + x] > sommet * 0.5) couverts++;
    if (couverts > L * COUVERTURE_FILET) rangeeVive[y] = 0;
  }

  /* Le sommet se remesure sans les filets : sinon leur blanc fixe des seuils
     que l'encre du symbole n'atteint jamais. */
  let maximum = 0;
  for (let y = 0; y < H; y++) {
    if (!rangeeVive[y]) continue;
    for (let x = 0; x < L; x++) if (ecarts[y * L + x] > maximum) maximum = ecarts[y * L + x];
  }
  if (maximum < ECART_MINIMAL) return null;

  const bas = maximum * 0.30, haut = maximum * 0.70;
  const source = new OffscreenCanvas(L, H);
  const pinceau = source.getContext('2d');
  const zone = pinceau.createImageData(L, H);

  /* La découpe garde de la marge autour du code : on la resserre sur ce qui est
     opaque, sans quoi un symbole étroit s'afficherait plus petit qu'un large. */
  let xMin = L, yMin = H, xMax = -1, yMax = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < L; x++) {
      const i = y * L + x;
      const alpha = rangeeVive[y]
        ? Math.max(0, Math.min(1, (ecarts[i] - bas) / (haut - bas)))
        : 0;
      zone.data[i * 4] = 255;
      zone.data[i * 4 + 1] = 255;
      zone.data[i * 4 + 2] = 255;
      zone.data[i * 4 + 3] = Math.round(255 * alpha);
      if (alpha > 0.5) {
        if (x < xMin) xMin = x;
        if (x > xMax) xMax = x;
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
    }
  }
  if (xMax < 0) return null;
  pinceau.putImageData(zone, 0, 0);

  const marge = Math.max(1, Math.round(Math.max(xMax - xMin, yMax - yMin) * 0.08));
  const gx = Math.max(0, xMin - marge), gy = Math.max(0, yMin - marge);
  const gL = Math.min(L, xMax + marge + 1) - gx, gH = Math.min(H, yMax + marge + 1) - gy;

  const facteur = HAUTEUR_GLYPHE / gH;
  const cible = new OffscreenCanvas(Math.max(1, Math.round(gL * facteur)), HAUTEUR_GLYPHE);
  cible.getContext('2d').drawImage(source, gx, gy, gL, gH, 0, 0, cible.width, cible.height);
  return cible;
}

export async function enDonnees(toile) {
  const blob = await toile.convertToBlob({ type: 'image/png' });
  return new Promise(resolve => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(lecteur.result);
    lecteur.readAsDataURL(blob);
  });
}

export function mesurerBlanc(image, point, rayon = 9) {
  const points = [];
  for (let dy = -rayon; dy <= rayon; dy++) {
    for (let dx = -rayon; dx <= rayon; dx++) points.push([point[0] + dx, point[1] + dy]);
  }
  return echantillonner(image, points);
}

/* Correction de von Kries : le papier blanc dit ce que l'appareil a vu du blanc,
   on ramène chaque canal à la cible dans l'espace linéaire. */
export function gainsDepuisBlanc(blanc) {
  const lin = blanc.map(versLineaire);
  if (lin.some(c => c <= 0.0001)) return null;
  return lin.map(c => CIBLE_BLANC / c);
}

export const corriger = (brut, gains) =>
  brut.map((c, i) => Math.max(0, Math.min(255, versSrgb(versLineaire(c) * gains[i]))));

export const enHex = (couleur) => versHex(couleur);

/* Contrôles avant de retenir une photo : ce qui rendrait les couleurs fausses
   se voit sur le blanc de référence et sur l'écart des gains. */
export function qualite(blanc, gains) {
  const alertes = [];
  const luminance = (0.299 * blanc[0] + 0.587 * blanc[1] + 0.114 * blanc[2]) / 255;

  /* Un seul canal au plafond, c'est la dominante de la lumière, pas une
     surexposition : la correction tient encore. Deux, et le blanc est perdu. */
  const satures = blanc.filter(c => c >= 252).length;
  if (satures >= 2) {
    alertes.push({ gravite: 'echec', texte: 'Le blanc de référence est brûlé : les couleurs ne peuvent plus être corrigées. Éloigne-toi de la lumière directe ou baisse l’exposition.' });
  } else if (luminance < 0.25) {
    alertes.push({ gravite: 'echec', texte: 'Le blanc de référence est trop sombre : le repère est-il bien posé dessus ?' });
  } else if (satures === 1) {
    alertes.push({ gravite: 'avertissement', texte: 'Un canal de couleur est au maximum sur le blanc de référence : les couleurs restent exploitables, mais une lumière plus neutre les rendrait plus justes.' });
  }

  const dominante = Math.max(...gains) / Math.min(...gains);
  if (dominante > 2.2) {
    alertes.push({ gravite: 'avertissement', texte: 'La lumière est très colorée. La correction va la rattraper, mais une lumière plus neutre donnerait mieux.' });
  }
  return { luminance, dominante, alertes };
}
