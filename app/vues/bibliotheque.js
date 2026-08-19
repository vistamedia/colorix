import { h, ailes, degradeCouverture } from '../rendu.js';
import { albumsPossedes } from '../donnees.js';
import { palierAtteint } from '../paliers.js';

function carteAlbum(album) {
  const degrade = degradeCouverture(album.collection, album.ean13);
  const part = album.nb_coloriages ? Math.round(album.faits / album.nb_coloriages * 100) : 0;

  const couverture = h('div', { class: 'couverture', style: `background-image:${degrade}` },
    h('span', { class: 'couverture__court' }, album.court));

  const image = h('img', {
    src: album.couverture,
    alt: '',
    loading: 'lazy',
    onerror: function () { this.remove(); }
  });
  couverture.prepend(image);

  return h('a', { class: 'carte-album', href: `#/album/${album.id}` },
    couverture,
    h('div', { class: 'carte-album__texte' },
      h('div', {},
        h('div', { class: 'carte-album__titre' }, album.titre),
        h('div', { class: 'carte-album__meta' }, `${album.editeur} · ${album.annee}`)),
      h('div', {},
        h('div', { class: 'barre-album' },
          h('div', { class: 'barre-album__part', style: `width:${part}%;background:${degrade}` })),
        h('div', { class: 'carte-album__compte' }, `${album.faits} sur ${album.nb_coloriages}`))));
}

export async function monter() {
  const albums = await albumsPossedes();
  const finies = albums.reduce((n, a) => n + a.faits, 0);
  const palier = palierAtteint(finies);

  const entete = h('header', { class: 'entete entete--decor' },
    ailes(),
    h('div', { class: 'entete__contenu' },
      h('h1', { class: 'titre-ecran' }, 'Ma collection'),
      h('div', { class: 'resumes' },
        h('div', { class: 'resume' },
          h('div', { class: 'resume__valeur' }, finies),
          h('div', { class: 'resume__libelle' }, 'planches finies')),
        h('div', { class: 'resume' },
          h('div', { class: 'resume__valeur' }, albums.length),
          h('div', { class: 'resume__libelle' }, 'albums')),
        h('div', { class: 'resume resume--large' },
          h('div', { class: palier ? 'resume__palier' : 'resume__valeur' }, palier ? palier.nom : '—'),
          h('div', { class: 'resume__libelle' }, palier ? 'palier atteint' : 'aucun palier')))));

  const corps = h('div', { class: 'corps corps--liste' },
    albums.length
      ? albums.map(carteAlbum)
      : h('p', { class: 'vide' },
          h('strong', {}, 'Aucun album'),
          'Coche un livre du catalogue pour créer ses planches.'),
    h('a', { class: 'bouton--pointille', href: '#/catalogue' }, '＋ Cocher un album du catalogue'));

  return { element: h('div', { class: 'vue' }, entete, corps) };
}
