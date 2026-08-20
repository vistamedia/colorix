import { h, naviguer, sansAccent, marqueCode } from '../rendu.js';
import { encreSur, plusProches } from '../couleur.js';
import { planche, nuancier, attribuer, feutres, marques, majFeutre, contexteNuancier, cleDeRang, renommerCode } from '../donnees.js';
import { panneauSymbole } from './nommer-symbole.js';

const ETATS = [
  ['possede', 'possédé'],
  ['faible', 'faible'],
  ['a_sec', 'à sec'],
  ['non_possede', 'non possédé']
];

export async function monter(coloriageId, code) {
  const courante = await planche(coloriageId);
  if (!courante) return { element: h('div', { class: 'vue' }, h('p', { class: 'vide' }, 'Planche introuvable.')) };

  const [contexte, tous, listeMarques] = await Promise.all([
    contexteNuancier(courante.livre_id), feutres(), marques()
  ]);
  const n = await nuancier(coloriageId, contexte.jeu);
  const entree = n.entrees.find(e => e.code === code);

  const nomMarque = new Map(listeMarques.map(m => [m.id, m.nom]));
  const parId = new Map(tous.map(f => [f.id, f]));
  const disponibles = tous.filter(f => f.etat !== 'non_possede');

  let choisis = [...(entree?.feutres || [])];

  const zoneChoisis = h('div', { class: 'choisis' });
  const zonePropositions = h('div', { class: 'propositions' });
  const zoneResultats = h('div', { class: 'resultats' });

  const enregistrer = async () => {
    await attribuer(coloriageId, code, choisis, contexte);
    dessinerChoisis();
  };

  function dessinerChoisis() {
    if (!choisis.length) {
      zoneChoisis.replaceChildren(h('p', { class: 'choisis__vide' }, 'Aucun feutre. Choisis-en un ci-dessous.'));
      return;
    }
    zoneChoisis.replaceChildren(...choisis.map((id, rang) => {
      const f = parId.get(id);
      if (!f) return null;
      return h('div', { class: 'choisi' },
        h('span', { class: 'choisi__rang' }, rang === 0 ? 'dessous' : 'dessus'),
        h('span', { class: 'choisi__ref' }, f.reference),
        h('span', { class: 'choisi__nom' }, `${nomMarque.get(f.marque_id) || ''} · ${f.nom}`),
        h('button', {
          class: 'choisi__retirer',
          onclick: async () => { choisis.splice(rang, 1); await enregistrer(); }
        }, '✕'));
    }).filter(Boolean));
  }

  function dessinerPropositions() {
    if (!entree?.pastille_hex) {
      zonePropositions.replaceChildren();
      return;
    }
    const proches = plusProches(entree.pastille_hex, disponibles, 3);
    if (!proches.length) {
      zonePropositions.replaceChildren();
      return;
    }
    zonePropositions.replaceChildren(
      h('h2', { class: 'section__titre' }, 'Les plus proches de la pastille'),
      h('p', { class: 'section__note' }, 'Toujours à valider à l’œil : l’éclairage fausse la mesure.'),
      ...proches.map(({ feutre, ecart }) => ligneFeutre(feutre, Math.round(ecart))));
  }

  function ligneFeutre(f, ecart) {
    const hex = f.hex || '#EFE6F4';
    return h('button', {
      class: 'ligne-feutre',
      onclick: async () => {
        if (!choisis.includes(f.id)) choisis.push(f.id);
        await enregistrer();
      }
    },
      h('span', { class: 'ligne-feutre__pastille', style: `background:${hex}` }),
      h('span', { class: 'ligne-feutre__texte' },
        h('span', { class: 'ligne-feutre__ref' }, f.reference),
        h('span', { class: 'ligne-feutre__nom' }, `${nomMarque.get(f.marque_id) || ''} · ${f.nom}`)),
      ecart !== undefined && h('span', { class: 'ligne-feutre__ecart' }, `ΔE ${ecart}`),
      h('span', {
        class: `etat etat--${f.etat}`,
        onclick: async (e) => {
          e.stopPropagation();
          const rang = ETATS.findIndex(([cle]) => cle === f.etat);
          const suivant = ETATS[(rang + 1) % ETATS.length][0];
          await majFeutre(f.id, { etat: suivant });
          f.etat = suivant;
          e.target.className = `etat etat--${suivant}`;
          e.target.textContent = ETATS.find(([cle]) => cle === suivant)[1];
        }
      }, ETATS.find(([cle]) => cle === f.etat)?.[1] || f.etat));
  }

  const chercher = (texte) => {
    const mots = sansAccent(texte).split(/\s+/).filter(Boolean);
    if (!mots.length) {
      zoneResultats.replaceChildren(h('p', { class: 'section__note' },
        `${disponibles.length} feutres. Cherche une référence ou un nom.`));
      return;
    }
    const trouves = disponibles.filter(f => {
      const cible = sansAccent(`${f.reference} ${f.nom} ${nomMarque.get(f.marque_id) || ''}`);
      return mots.every(m => cible.includes(m));
    }).slice(0, 60);

    zoneResultats.replaceChildren(...(trouves.length
      ? trouves.map(f => ligneFeutre(f))
      : [h('p', { class: 'section__note' }, 'Aucun feutre ne correspond.')]));
  };

  const recherche = h('input', {
    type: 'search', class: 'champ', placeholder: 'Référence ou nom — « 792 », « leaf »',
    inputmode: 'search', oninput: (e) => chercher(e.target.value)
  });

  /* Un code absent de la série du livre appartient à la planche : c'est un
     symbole, et lui seul peut être nommé ou renommé. La photo n'est pas à
     refaire pour cela — le découpage est resté dans l'entrée. */
  const symbole = entree && !contexte.jeu.includes(entree.code);
  const rangCle = cleDeRang(n.entrees.indexOf(entree));

  const nommer = symbole
    ? h('button', {
        class: 'bouton--secondaire',
        onclick: () => panneauSymbole({
          hex: entree.pastille_hex,
          glyphe: entree.glyphe,
          code: entree.code,
          rangCle,
          pris: new Set(n.entrees.filter(e => e !== entree).map(e => e.code)),
          surChoix: async (nouveau) => {
            await renommerCode(coloriageId, entree.code, nouveau, contexte);
            naviguer(`#/planche/${coloriageId}/code/${encodeURIComponent(nouveau)}`);
          }
        })
      }, entree.code === rangCle ? 'Nommer' : 'Renommer')
    : null;

  const hexPastille = entree?.pastille_hex || '#EFE6F4';
  const entete = h('header', { class: 'entete entete--sobre' },
    h('div', { class: 'entete__contenu' },
      h('a', { class: 'retour retour--sombre', href: `#/planche/${coloriageId}` }, `‹ Planche ${courante.numero}`),
      h('div', { class: 'entete__code' },
        h('span', {
          class: 'pastille pastille--grande',
          style: `background:${hexPastille};color:${encreSur(hexPastille)}`
        }, marqueCode(entree, encreSur(hexPastille))),
        h('div', {},
          h('h1', { class: 'titre-code' }, 'Code ', marqueCode(entree, 'var(--encre)')),
          h('p', { class: 'titre-code__note' },
            entree?.pastille_hex ? entree.pastille_hex : 'couleur du livre non relevée')),
        h('a', { class: 'bouton--secondaire', href: `#/pipette/${coloriageId}/${encodeURIComponent(code)}` }, 'Pipetter'),
        nommer)));

  dessinerChoisis();
  dessinerPropositions();
  chercher('');

  const corps = h('div', { class: 'corps corps--attribution' },
    h('h2', { class: 'section__titre' }, 'Feutres de ce code'),
    h('p', { class: 'section__note' }, 'L’ordre est la superposition : le premier est posé dessous.'),
    zoneChoisis,
    zonePropositions,
    h('h2', { class: 'section__titre' }, 'Chercher un feutre'),
    recherche,
    zoneResultats);

  const actions = h('div', { class: 'actions' },
    h('button', {
      class: 'bouton bouton--primaire',
      onclick: () => naviguer(`#/planche/${coloriageId}`)
    }, 'Terminé'));

  return { element: h('div', { class: 'vue' }, entete, corps, actions) };
}
