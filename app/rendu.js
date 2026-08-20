export const naviguer = (route) => { location.hash = route; };

export const sansAccent = (t) =>
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function h(balise, attributs = {}, ...enfants) {
  const el = document.createElement(balise);
  for (const [cle, valeur] of Object.entries(attributs)) {
    if (valeur === null || valeur === undefined || valeur === false) continue;
    if (cle === 'class') el.className = valeur;
    else if (cle === 'style') el.style.cssText = valeur;
    else if (cle.startsWith('on')) el.addEventListener(cle.slice(2).toLowerCase(), valeur);
    else el.setAttribute(cle, valeur === true ? '' : valeur);
  }
  ajouter(el, enfants);
  return el;
}

export function ajouter(el, enfants) {
  for (const enfant of enfants.flat(Infinity)) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    el.append(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
  }
  return el;
}

const TRACES = {
  albums: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H9v16H5.5A1.5 1.5 0 0 1 4 18.5zM9 4h5.5A1.5 1.5 0 0 1 16 5.5v13a1.5 1.5 0 0 1-1.5 1.5H9M18 6.5l2.6.7a1 1 0 0 1 .7 1.2l-2.8 10.4',
  feutres: 'M15.5 3.5 20 8 9.6 18.4a2 2 0 0 1-1 .5l-4.3.9.9-4.3a2 2 0 0 1 .5-1zM13.5 5.5 18 10',
  stats: 'M4 20h16M7.5 20v-6M12 20V6.5M16.5 20v-9',
  reglages: 'M6 7h12M6 12h12M6 17h12M10 5v4M15 10v4M9 15v4'
};

export const icone = (nom) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const trace = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  trace.setAttribute('d', TRACES[nom]);
  svg.append(trace);
  return svg;
};

export const ailes = () => [
  h('div', { class: 'halo' }),
  h('div', { class: 'aile aile--grande' }),
  h('div', { class: 'aile aile--petite' }),
  h('div', { class: 'eclat eclat--a' }),
  h('div', { class: 'eclat eclat--b' })
];

/* Le code d'une rangée : son caractère quand la case en porte un — celui du
   livre, celui que la reconnaissance a trouvé, ou celui qu'elle a tapé — sinon
   le symbole découpé sur la photo du nuancier de la planche. Le masque est
   peint dans l'encre calculée pour la pastille, comme le serait un caractère.
   Faute des deux — photo trop floue pour découper quoi que ce soit — reste le
   rang de la case, qui se lit encore sur la bande.

   Le découpage est gardé même sur une case nommée : c'est le code seul qui
   tranche. Sans cela, nommer un symbole jetterait son image, et se raviser
   imposerait de refaire la photo. */
export function marqueCode(entree, encre) {
  const rang = /^s(\d+)$/.exec(entree?.code || '');
  if (!rang) return entree?.code ?? '';
  if (entree?.glyphe) {
    return h('span', {
      class: 'glyphe',
      style: `-webkit-mask-image:url(${entree.glyphe});mask-image:url(${entree.glyphe});background-color:${encre}`
    });
  }
  return h('span', { class: 'rang-case' }, rang[1]);
}

export const deuxChiffres = (n) => String(n).padStart(2, '0');

export function dureeCourte(secondes) {
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = secondes % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

/* Dégradé de repli d'une couverture, tant que l'image de l'éditeur n'est pas
   en cache. README §6.1 : état permanent hors ligne, pas un bouche-trou. */
const DEGRADES = {
  'Winx Club': ['#C4218F', '#7A2B7E'],
  'Disney': ['#2C7BE8', '#17AFA6'],
  'Marvel': ['#F2542D', '#7A1230'],
  'Art-thérapie': ['#63C36A', '#FFC22E'],
  'Astérix': ['#FFC22E', '#63C36A'],
  'Mangas': ['#7A4BC4', '#2C7BE8'],
  'Pokémon': ['#FFC22E', '#F2542D'],
  'Harry Potter': ['#3B1E5C', '#7A2B7E'],
  'Star Wars': ['#17101E', '#2C7BE8'],
  'My Little Pony': ['#F0428A', '#7A4BC4'],
  'Bisounours': ['#F27BAE', '#FFC22E'],
  'Totally Spies': ['#63C36A', '#2C7BE8'],
  'Dragons': ['#4C5A46', '#17AFA6'],
  'Marsupilami': ['#FFC22E', '#F27A16'],
  'Japon': ['#DC2020', '#F0428A'],
  'Safari': ['#C4653A', '#FBB014']
};

export function degradeCouverture(collection, ean) {
  const paire = DEGRADES[collection];
  if (paire) return `linear-gradient(160deg, ${paire[0]}, ${paire[1]})`;
  const teinte = [...String(ean)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 360, 7);
  return `linear-gradient(160deg, hsl(${teinte} 58% 46%), hsl(${(teinte + 42) % 360} 52% 32%))`;
}
