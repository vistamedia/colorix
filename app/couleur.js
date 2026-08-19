const SEUIL_LUMINANCE = 0.62;

export function versRvb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}

export function versHex([r, v, b]) {
  return '#' + [r, v, b].map(c => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/* Encre lisible sur une pastille : calculée, jamais choisie à la main —
   les codes du livre vont du noir au jaune vif. README §4.1. */
export function encreSur(hex) {
  const [r, v, b] = versRvb(hex);
  return (0.299 * r + 0.587 * v + 0.114 * b) / 255 > SEUIL_LUMINANCE
    ? 'rgba(20,10,28,.72)'
    : 'rgba(255,255,255,.95)';
}

function versLab(hex) {
  const lineaire = c => {
    c /= 255;
    return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
  };
  const [r, v, b] = versRvb(hex).map(lineaire);

  const x = (r * 0.4124 + v * 0.3576 + b * 0.1805) / 0.95047;
  const y = (r * 0.2126 + v * 0.7152 + b * 0.0722);
  const z = (r * 0.0193 + v * 0.1192 + b * 0.9505) / 1.08883;

  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const [fx, fy, fz] = [f(x), f(y), f(z)];

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/* ΔE76 : suffisant ici, l'écart de perception ne justifie pas ΔE2000
   face à l'imprécision d'une photo prise à la lumière du salon. SPECS §6.2. */
export function ecart(hexA, hexB) {
  const a = versLab(hexA);
  const b = versLab(hexB);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function plusProches(hex, feutres, combien = 3) {
  return feutres
    .filter(f => f.hex)
    .map(f => ({ feutre: f, ecart: ecart(hex, f.hex) }))
    .sort((a, b) => a.ecart - b.ecart)
    .slice(0, combien);
}

/* Moyenne d'une zone de 5 × 5 pixels autour du point pipetté. SPECS §6.1. */
export function moyenneZone(donnees, largeur, x, y, rayon = 2) {
  let r = 0, v = 0, b = 0, n = 0;
  for (let dy = -rayon; dy <= rayon; dy++) {
    for (let dx = -rayon; dx <= rayon; dx++) {
      const i = ((y + dy) * largeur + (x + dx)) * 4;
      if (i < 0 || i + 2 >= donnees.length) continue;
      r += donnees[i]; v += donnees[i + 1]; b += donnees[i + 2]; n++;
    }
  }
  return n ? versHex([r / n, v / n, b / n]) : '#000000';
}
