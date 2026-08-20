import * as base from './base.js';

const MAGASINS = ['possessions', 'coloriages', 'nuanciers', 'marques', 'sets', 'feutres'];

let catalogueMemo = null;

export async function catalogue() {
  if (!catalogueMemo) {
    const reponse = await fetch('./data/catalogue.json');
    catalogueMemo = await reponse.json();
  }
  return catalogueMemo;
}

export async function livre(id) {
  return (await catalogue()).livres.find(l => l.id === id) || null;
}

/* ---------- possession et planches ---------- */

export const possessions = () => base.lireTout('possessions');

export async function albumsPossedes() {
  const [liste, cat] = await Promise.all([possessions(), catalogue()]);
  const albums = [];
  for (const p of liste) {
    const fiche = cat.livres.find(l => l.id === p.livre_id);
    if (!fiche) continue;
    const planches = await base.lireParIndex('coloriages', 'livre_id', p.livre_id);
    albums.push({
      ...fiche,
      possession: p,
      nb_coloriages: p.nb_coloriages,
      faits: planches.filter(c => c.statut === 'termine').length,
      en_cours: planches.find(c => c.statut === 'en_cours') || null
    });
  }
  return albums.sort((a, b) => (b.possession.date_acquisition || '').localeCompare(a.possession.date_acquisition || ''));
}

export async function posseder(livreId, nbColoriages) {
  await base.ecrire('possessions', {
    livre_id: livreId,
    date_acquisition: new Date().toISOString(),
    nb_coloriages: nbColoriages,
    note: ''
  });
  const planches = Array.from({ length: nbColoriages }, (_, i) => ({
    id: `${livreId}-${i + 1}`,
    livre_id: livreId,
    numero: i + 1,
    statut: 'pas_commence',
    sujet_revele: '',
    date_debut: null,
    date_fin: null,
    duree_cumulee_s: 0,
    difficulte: null,
    note: ''
  }));
  await base.ecrireLot('coloriages', planches);
}

export async function retirerAlbum(livreId) {
  const planches = await base.lireParIndex('coloriages', 'livre_id', livreId);
  for (const p of planches) {
    await base.supprimer('nuanciers', p.id);
    for (const photo of await base.lireParIndex('photos', 'coloriage_id', p.id)) {
      await base.supprimer('photos', photo.id);
    }
    await base.supprimer('coloriages', p.id);
  }
  await base.supprimer('possessions', livreId);
}

export const planchesDe = async (livreId) =>
  (await base.lireParIndex('coloriages', 'livre_id', livreId)).sort((a, b) => a.numero - b.numero);

export const planche = (id) => base.lire('coloriages', id);

export async function majPlanche(id, champs) {
  const actuelle = await planche(id);
  const suivante = { ...actuelle, ...champs };
  await base.ecrire('coloriages', suivante);
  return suivante;
}

export async function demarrer(id) {
  const p = await planche(id);
  if (p.statut !== 'pas_commence') return p;
  return majPlanche(id, { statut: 'en_cours', date_debut: new Date().toISOString() });
}

export const terminer = (id, sujetRevele) =>
  majPlanche(id, { statut: 'termine', sujet_revele: sujetRevele, date_fin: new Date().toISOString() });

/* ---------- nuanciers ---------- */

/* Les cases naissent vides : la couleur d'un code change d'une planche à
   l'autre, elle vient de la page « Mon nuancier » du livre relevée en photo.
   Rien n'est amorcé depuis le catalogue — une couleur approchée serait plus
   trompeuse qu'une case grise. */
export async function nuancier(coloriageId, jeuCodes) {
  const existant = await base.lire('nuanciers', coloriageId);
  const vide = (code) => ({ code, pastille_hex: null, feutres: [], note: '' });
  if (!jeuCodes?.length) return existant || { coloriage_id: coloriageId, entrees: [] };
  if (!existant) return { coloriage_id: coloriageId, entrees: jeuCodes.map(vide) };

  /* Une planche relevée porte sa propre palette : le nombre de ses cases et
     ses symboles viennent de sa page, plus du livre. On n'y touche pas.
     Les autres suivent la série, et gardent ce qu'elles ont en propre. */
  if (existant.releve_le) return existant;

  const parCode = new Map(existant.entrees.map(e => [e.code, e]));
  const duLivre = new Set(jeuCodes);
  return {
    ...existant,
    entrees: [
      ...jeuCodes.map(code => parCode.get(code) || vide(code)),
      ...existant.entrees.filter(e => !duLivre.has(e.code))
    ]
  };
}

/* Le jeu de codes vient du catalogue, et de lui seul : une copie figée à la
   coche de l'album empêcherait toute correction de la série d'atteindre les
   planches déjà ouvertes. */
export async function contexteNuancier(livreId) {
  const fiche = await livre(livreId);
  return { fiche, jeu: fiche?.jeu_codes || [] };
}

export async function enregistrerNuancier(n) {
  await base.ecrire('nuanciers', n);
  return n;
}

export async function attribuer(coloriageId, code, feutreIds, contexte) {
  const n = await nuancier(coloriageId, contexte.jeu);
  const entree = n.entrees.find(e => e.code === code);
  if (entree) entree.feutres = feutreIds;
  return enregistrerNuancier(n);
}

export async function pipetter(coloriageId, code, hex, contexte) {
  const n = await nuancier(coloriageId, contexte.jeu);
  const entree = n.entrees.find(e => e.code === code);
  if (entree) entree.pastille_hex = hex;
  return enregistrerNuancier(n);
}

/* Le relevé photo de la page « Mon nuancier » définit la palette de la planche :
   ses codes, leur nombre, et les symboles qu'elle a en propre — découpés sur la
   photo puisque le livre ne les nomme pas deux fois pareil. Ce qui était déjà
   attribué sur un code survit au relevé. */
export async function releverPalette(coloriageId, releves, contexte) {
  const n = await nuancier(coloriageId, contexte.jeu);
  const parCode = new Map(n.entrees.map(e => [e.code, e]));
  const memeLongueur = n.entrees.length === releves.length;
  const entrees = releves.map(({ code, hex, glyphe }, rang) => {
    /* Un symbole peut changer de nom d'un relevé à l'autre — reconnu cette
       fois, découpé la précédente. À nombre de cases égal, le rang retrouve
       ce qui avait été attribué. */
    const ancienne = parCode.get(code) || (memeLongueur ? n.entrees[rang] : null);
    return {
      code,
      feutres: ancienne?.feutres || [],
      note: ancienne?.note || '',
      pastille_hex: hex,
      ...(glyphe ? { glyphe } : {})
    };
  });
  return enregistrerNuancier({ ...n, entrees, releve_le: new Date().toISOString() });
}

/* Copie les correspondances d'une autre planche du même album. SPECS §5.
   Les feutres seulement : les couleurs imprimées appartiennent à la planche. */
export async function reprendreNuancier(sourceId, cibleId, contexte) {
  const source = await base.lire('nuanciers', sourceId);
  if (!source) return null;
  const cible = await nuancier(cibleId, contexte.jeu);
  for (const entree of cible.entrees) {
    const modele = source.entrees.find(e => e.code === entree.code);
    if (modele && modele.feutres.length) entree.feutres = [...modele.feutres];
  }
  return enregistrerNuancier(cible);
}

/* ---------- photos ---------- */

export const photosDe = (coloriageId) => base.lireParIndex('photos', 'coloriage_id', coloriageId);

export async function ajouterPhoto(coloriageId, blob, role) {
  const existantes = await photosDe(coloriageId);
  const photo = {
    id: `${coloriageId}-${Date.now()}`,
    coloriage_id: coloriageId,
    blob,
    role,
    vignette: role === 'resultat' && !existantes.some(p => p.vignette),
    date: new Date().toISOString()
  };
  await base.ecrire('photos', photo);
  return photo;
}

export async function designerVignette(coloriageId, photoId) {
  for (const photo of await photosDe(coloriageId)) {
    await base.ecrire('photos', { ...photo, vignette: photo.id === photoId });
  }
}

export const supprimerPhoto = (id) => base.supprimer('photos', id);

/* ---------- feutres ---------- */

export const feutres = () => base.lireTout('feutres');
export const sets = () => base.lireTout('sets');
export const marques = () => base.lireTout('marques');

export const feutre = (id) => base.lire('feutres', id);

export const majFeutre = async (id, champs) =>
  base.ecrire('feutres', { ...(await feutre(id)), ...champs });

export async function amorcerSet(chemin) {
  const donnees = await (await fetch(chemin)).json();
  const marqueId = donnees.marque.toLowerCase().replace(/\s+/g, '-');
  const setId = `${marqueId}-${donnees.nb_feutres}`;

  await base.ecrire('marques', { id: marqueId, nom: donnees.marque });
  await base.ecrire('sets', { id: setId, marque_id: marqueId, nom: donnees.set, nb_feutres: donnees.nb_feutres });

  const existants = new Map((await base.lireParIndex('feutres', 'set_id', setId)).map(f => [f.id, f]));
  await base.ecrireLot('feutres', donnees.feutres.map(f => {
    const id = `${setId}-${f.reference}`;
    const ancien = existants.get(id);
    return {
      id,
      set_id: setId,
      marque_id: marqueId,
      reference: f.reference,
      nom: f.nom,
      pack: f.pack,
      planche: f.planche,
      position: f.position,
      hex: ancien?.hex ?? f.hex,
      etat: ancien?.etat ?? 'possede'
    };
  }));
  return setId;
}

/* ---------- sauvegarde ---------- */

export async function exporter() {
  const contenu = { version: 1, exporte_le: new Date().toISOString() };
  for (const magasin of MAGASINS) contenu[magasin] = await base.lireTout(magasin);
  const photos = await base.lireTout('photos');
  contenu.photos = photos.map(({ blob, ...reste }) => reste);
  return contenu;
}

export async function importer(contenu, fusionner) {
  if (!fusionner) await base.vider(MAGASINS);
  for (const magasin of MAGASINS) {
    if (Array.isArray(contenu[magasin]) && contenu[magasin].length) {
      await base.ecrireLot(magasin, contenu[magasin]);
    }
  }
}
