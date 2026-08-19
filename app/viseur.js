import { h } from './rendu.js';

const LOUPE = 132;
const ZOOM = 5;

/* Le viseur des deux relevés photo : la planche de feutres et la bande du
   livre. Une loupe grossie cinq fois suit le doigt — viser une pastille de
   trente pixels sur une photo réduite à la largeur de l'écran est impossible
   sans elle — et le repère se pose au centre du réticule.
   Rend l'en-tête, la scène et la barre d'actions ; l'écran appelant garde son
   propre enchaînement d'étapes. */
export function ecranReperes({ image, etapes, index, reperes, precedent, suivant }) {
  const etape = etapes[index];
  const dernier = index === etapes.length - 1;

  const toile = h('canvas', { class: 'viseur__toile' });
  const loupe = h('canvas', { class: 'loupe-viseur', width: LOUPE, height: LOUPE, hidden: true });
  const marques = h('div', { class: 'viseur__marques' });
  const scene = h('div', { class: 'viseur' }, toile, marques, loupe);

  const boutonSuivant = h('button', {
    class: 'bouton bouton--primaire',
    disabled: !reperes[etape.cle],
    onclick: suivant
  }, dernier ? 'Voir le résultat' : 'Suivant');

  let vue2d = null;

  const dessinerFond = () => {
    const cadre = scene.getBoundingClientRect();
    toile.width = cadre.width;
    toile.height = cadre.height;
    const facteur = Math.min(cadre.width / image.width, cadre.height / image.height);
    const L = image.width * facteur, H = image.height * facteur;
    const dx = (cadre.width - L) / 2, dy = (cadre.height - H) / 2;

    const tampon = new OffscreenCanvas(image.width, image.height);
    tampon.getContext('2d').putImageData(image, 0, 0);
    const p = toile.getContext('2d');
    p.clearRect(0, 0, toile.width, toile.height);
    p.drawImage(tampon, dx, dy, L, H);
    return { facteur, dx, dy, tampon };
  };

  const versImage = (x, y) => [(x - vue2d.dx) / vue2d.facteur, (y - vue2d.dy) / vue2d.facteur];
  const versEcran = (x, y) => [x * vue2d.facteur + vue2d.dx, y * vue2d.facteur + vue2d.dy];

  const dessinerMarques = () => {
    marques.replaceChildren(...etapes.filter(e => reperes[e.cle]).map(e => {
      const [x, y] = versEcran(...reperes[e.cle]);
      const pose = h('span', {
        class: `marque-posee${e.cle === etape.cle ? ' marque-posee--active' : ''}${e.cle === 'blanc' ? ' marque-posee--blanc' : ''}`
      });
      pose.style.left = `${x}px`;
      pose.style.top = `${y}px`;
      return pose;
    }));
  };

  const viser = (evenement) => {
    const point = evenement.touches?.[0] || evenement;
    const cadre = toile.getBoundingClientRect();
    const x = point.clientX - cadre.left;
    const y = point.clientY - cadre.top;
    const [ix, iy] = versImage(x, y);
    if (ix < 0 || iy < 0 || ix >= image.width || iy >= image.height) return;

    reperes[etape.cle] = [ix, iy];
    dessinerMarques();
    boutonSuivant.disabled = false;

    const p = loupe.getContext('2d');
    p.imageSmoothingEnabled = false;
    p.clearRect(0, 0, LOUPE, LOUPE);
    const zone = LOUPE / ZOOM;
    p.drawImage(vue2d.tampon, ix - zone / 2, iy - zone / 2, zone, zone, 0, 0, LOUPE, LOUPE);
    p.strokeStyle = '#FFFFFF';
    p.lineWidth = 2;
    p.beginPath();
    p.moveTo(LOUPE / 2, LOUPE / 2 - 14); p.lineTo(LOUPE / 2, LOUPE / 2 + 14);
    p.moveTo(LOUPE / 2 - 14, LOUPE / 2); p.lineTo(LOUPE / 2 + 14, LOUPE / 2);
    p.stroke();

    loupe.hidden = false;
    loupe.style.left = `${Math.max(LOUPE / 2 + 6, Math.min(cadre.width - LOUPE / 2 - 6, x))}px`;
    loupe.style.top = `${Math.max(LOUPE / 2 + 6, y - 20)}px`;
  };

  scene.addEventListener('touchstart', (e) => { e.preventDefault(); viser(e); }, { passive: false });
  scene.addEventListener('touchmove', (e) => { e.preventDefault(); viser(e); }, { passive: false });
  scene.addEventListener('touchend', () => { loupe.hidden = true; });
  scene.addEventListener('mousedown', (e) => {
    viser(e);
    const bouger = (ev) => viser(ev);
    const finir = () => { loupe.hidden = true; removeEventListener('mousemove', bouger); removeEventListener('mouseup', finir); };
    addEventListener('mousemove', bouger);
    addEventListener('mouseup', finir);
  });

  const entete = h('header', { class: 'entete entete--sobre entete--viseur' },
    h('div', { class: 'entete__contenu' },
      h('div', { class: 'viseur__compteur' }, `Repère ${index + 1} sur ${etapes.length}`),
      h('h1', { class: 'viseur__titre' }, etape.titre),
      h('p', { class: 'section__note' }, etape.aide)));

  const actions = h('div', { class: 'actions' },
    h('button', { class: 'bouton bouton--chrono', onclick: precedent }, index ? 'Précédent' : 'Reprendre'),
    boutonSuivant);

  requestAnimationFrame(() => {
    vue2d = dessinerFond();
    dessinerMarques();
  });

  return [entete, scene, actions];
}
