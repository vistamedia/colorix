import { h, sansAccent } from '../rendu.js';
import { feutres, sets, marques, majFeutre, amorcerSet } from '../donnees.js';

const ETATS = [
  ['possede', 'possédé'],
  ['faible', 'faible'],
  ['a_sec', 'à sec'],
  ['non_possede', 'non possédé']
];
const SUIVANT = Object.fromEntries(ETATS.map(([cle], i) => [cle, ETATS[(i + 1) % ETATS.length][0]]));

const NUANCIERS_LIVRES = [
  { chemin: './data/nuanciers/guangna-360.json', nom: 'GuangNa · Pack 360', feutres: 360 }
];

export async function monter() {
  const [tous, listeSets, listeMarques] = await Promise.all([feutres(), sets(), marques()]);
  const nomMarque = new Map(listeMarques.map(m => [m.id, m.nom]));

  if (!tous.length) return { element: ecranAmorcage() };

  let filtre = '';
  let etatRetenu = null;

  const liste = h('div', { class: 'corps corps--feutres' });
  const compte = h('span', { class: 'progression__compte' });

  const dessiner = () => {
    const mots = sansAccent(filtre).split(/\s+/).filter(Boolean);
    const retenus = tous.filter(f => {
      if (etatRetenu && f.etat !== etatRetenu) return false;
      if (!mots.length) return true;
      const cible = sansAccent(`${f.reference} ${f.nom} ${nomMarque.get(f.marque_id) || ''}`);
      return mots.every(m => cible.includes(m));
    });

    compte.textContent = `${retenus.length} sur ${tous.length}`;
    liste.replaceChildren(...(retenus.length
      ? retenus.slice(0, 400).map(ligne)
      : [h('p', { class: 'vide' }, h('strong', {}, 'Aucun feutre'), 'Change le filtre ou la recherche.')]));
  };

  const ligne = (f) => {
    const hex = f.hex || '#EFE6F4';
    const marque = h('span', {
      class: `etat etat--${f.etat}`,
      onclick: async (e) => {
        e.stopPropagation();
        f.etat = SUIVANT[f.etat] || 'possede';
        await majFeutre(f.id, { etat: f.etat });
        marque.className = `etat etat--${f.etat}`;
        marque.textContent = ETATS.find(([c]) => c === f.etat)[1];
        if (etatRetenu) dessiner();
      }
    }, ETATS.find(([c]) => c === f.etat)?.[1] || f.etat);

    const couleur = h('input', {
      type: 'color', class: 'ligne-feutre__couleur', value: f.hex || '#CCCCCC',
      title: 'Couleur relevée sur ton propre nuancier',
      onchange: async (e) => {
        f.hex = e.target.value.toUpperCase();
        await majFeutre(f.id, { hex: f.hex });
      }
    });

    return h('div', { class: 'ligne-feutre ligne-feutre--inventaire' },
      h('span', { class: 'ligne-feutre__pastille', style: `background:${hex}` }, couleur),
      h('span', { class: 'ligne-feutre__texte' },
        h('span', { class: 'ligne-feutre__ref' }, f.reference),
        h('span', { class: 'ligne-feutre__nom' }, `${nomMarque.get(f.marque_id) || ''} · ${f.nom}`)),
      f.pack && h('span', { class: 'ligne-feutre__pack' }, `pack ${f.pack}`),
      marque);
  };

  const filtres = h('div', { class: 'filtres' },
    h('button', {
      class: 'filtre filtre--actif',
      onclick: (e) => { etatRetenu = null; marquerFiltre(e.target); dessiner(); }
    }, 'tous'),
    ...ETATS.map(([cle, libelle]) => h('button', {
      class: 'filtre',
      onclick: (e) => { etatRetenu = cle; marquerFiltre(e.target); dessiner(); }
    }, libelle)));

  const marquerFiltre = (actif) => {
    for (const b of filtres.children) b.classList.toggle('filtre--actif', b === actif);
  };

  const entete = h('header', { class: 'entete entete--sobre' },
    h('div', { class: 'entete__contenu' },
      h('h1', { class: 'titre-album' }, 'Mes feutres'),
      h('p', { class: 'section__note' },
        listeSets.map(s => `${nomMarque.get(s.marque_id)} · ${s.nom}`).join(' · ')),
      h('input', {
        type: 'search', class: 'champ', placeholder: 'Référence ou nom…',
        oninput: (e) => { filtre = e.target.value; dessiner(); }
      }),
      filtres,
      compte));

  dessiner();
  return { element: h('div', { class: 'vue' }, entete, liste) };
}

function ecranAmorcage() {
  const zone = h('div', { class: 'corps corps--liste' });

  for (const nuancier of NUANCIERS_LIVRES) {
    zone.append(h('button', {
      class: 'carte-amorcage',
      onclick: async (e) => {
        e.currentTarget.disabled = true;
        e.currentTarget.textContent = 'Amorçage…';
        await amorcerSet(nuancier.chemin);
        location.reload();
      }
    },
      h('span', { class: 'carte-amorcage__titre' }, nuancier.nom),
      h('span', { class: 'carte-amorcage__note' }, `${nuancier.feutres} feutres · référence et nom`)));
  }

  return h('div', { class: 'vue' },
    h('header', { class: 'entete entete--sobre' },
      h('div', { class: 'entete__contenu' },
        h('h1', { class: 'titre-album' }, 'Mes feutres'),
        h('p', { class: 'section__note' },
          'Coche le set que tu possèdes : tous ses feutres apparaissent d’un coup, marqués possédés. '
          + 'Tu ajusteras les états et les couleurs ensuite.'))),
    zone);
}
