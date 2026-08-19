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

/* Chaque pastille est percée en son centre : on échantillonne un anneau
   rectangulaire autour du trou, et la médiane absorbe ce qui traverse. */
function pointsPastille(m, colonne, rangee, colonnes, rangees) {
  const u = colonnes > 1 ? colonne / (colonnes - 1) : 0.5;
  const v = rangees > 1 ? rangee / (rangees - 1) : 0.5;
  const pasU = colonnes > 1 ? 1 / (colonnes - 1) : 1;
  const pasV = rangees > 1 ? 1 / (rangees - 1) : 1;

  const points = [];
  for (let du = -0.30; du <= 0.301; du += 0.05) {
    for (let dv = -0.22; dv <= 0.221; dv += 0.055) {
      if (Math.hypot(du / 0.30, dv / 0.22) < 0.62) continue;
      points.push(projeter(m, u + du * pasU, v + dv * pasV));
    }
  }
  return points;
}

export function extraire(image, coins, colonnes, rangees) {
  const m = homographie(coins);
  if (!m) return null;
  const cases = [];
  for (let rangee = 0; rangee < rangees; rangee++) {
    for (let colonne = 0; colonne < colonnes; colonne++) {
      cases.push({
        colonne, rangee,
        brut: echantillonner(image, pointsPastille(m, colonne, rangee, colonnes, rangees)),
        centre: projeter(m,
          colonnes > 1 ? colonne / (colonnes - 1) : 0.5,
          rangees > 1 ? rangee / (rangees - 1) : 0.5)
      });
    }
  }
  return cases;
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
    alertes.push({ gravite: 'echec', texte: 'La feuille blanche est brûlée : la référence est perdue. Éloigne-toi de la lumière directe ou baisse l’exposition.' });
  } else if (luminance < 0.25) {
    alertes.push({ gravite: 'echec', texte: 'La feuille blanche est trop sombre : le repère est-il bien posé dessus ?' });
  } else if (satures === 1) {
    alertes.push({ gravite: 'avertissement', texte: 'Un canal de couleur est au maximum sur la feuille blanche : les couleurs restent exploitables, mais une lumière plus neutre les rendrait plus justes.' });
  }

  const dominante = Math.max(...gains) / Math.min(...gains);
  if (dominante > 2.2) {
    alertes.push({ gravite: 'avertissement', texte: 'La lumière est très colorée. La correction va la rattraper, mais une lumière plus neutre donnerait mieux.' });
  }
  return { luminance, dominante, alertes };
}
