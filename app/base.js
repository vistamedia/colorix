const NOM = 'colorix';
const VERSION = 1;

let connexion = null;

export function ouvrir() {
  if (connexion) return Promise.resolve(connexion);
  return new Promise((resoudre, rejeter) => {
    const requete = indexedDB.open(NOM, VERSION);
    requete.onupgradeneeded = () => construire(requete.result);
    requete.onsuccess = () => {
      connexion = requete.result;
      resoudre(connexion);
    };
    requete.onerror = () => rejeter(requete.error);
  });
}

function construire(base) {
  const possessions = base.createObjectStore('possessions', { keyPath: 'livre_id' });
  possessions.createIndex('date_acquisition', 'date_acquisition');

  const coloriages = base.createObjectStore('coloriages', { keyPath: 'id' });
  coloriages.createIndex('livre_id', 'livre_id');
  coloriages.createIndex('statut', 'statut');
  coloriages.createIndex('date_fin', 'date_fin');

  base.createObjectStore('nuanciers', { keyPath: 'coloriage_id' });
  base.createObjectStore('marques', { keyPath: 'id' });

  const sets = base.createObjectStore('sets', { keyPath: 'id' });
  sets.createIndex('marque_id', 'marque_id');

  const feutres = base.createObjectStore('feutres', { keyPath: 'id' });
  feutres.createIndex('set_id', 'set_id');
  feutres.createIndex('reference', 'reference');
  feutres.createIndex('etat', 'etat');

  const photos = base.createObjectStore('photos', { keyPath: 'id' });
  photos.createIndex('coloriage_id', 'coloriage_id');
}

function promettre(requete) {
  return new Promise((resoudre, rejeter) => {
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

async function transaction(magasins, mode, traitement) {
  const base = await ouvrir();
  const liste = Array.isArray(magasins) ? magasins : [magasins];
  return new Promise((resoudre, rejeter) => {
    const tr = base.transaction(liste, mode);
    let resultat;
    Promise.resolve(traitement(...liste.map(nom => tr.objectStore(nom))))
      .then(valeur => { resultat = valeur; })
      .catch(rejeter);
    tr.oncomplete = () => resoudre(resultat);
    tr.onerror = () => rejeter(tr.error);
    tr.onabort = () => rejeter(tr.error);
  });
}

export const lire = (magasin, cle) =>
  transaction(magasin, 'readonly', m => promettre(m.get(cle)));

/* Plusieurs clés en une seule transaction : la grille d'un album interroge
   cinquante nuanciers, et `lireTout` rapporterait au passage les masques de
   symboles de tous les autres albums. */
export const lirePlusieurs = (magasin, cles) =>
  transaction(magasin, 'readonly', m => Promise.all(cles.map(cle => promettre(m.get(cle)))));

export const lireTout = (magasin) =>
  transaction(magasin, 'readonly', m => promettre(m.getAll()));

export const lireParIndex = (magasin, index, valeur) =>
  transaction(magasin, 'readonly', m => promettre(m.index(index).getAll(valeur)));

export const compterParIndex = (magasin, index, valeur) =>
  transaction(magasin, 'readonly', m => promettre(m.index(index).count(valeur)));

export const ecrire = (magasin, valeur) =>
  transaction(magasin, 'readwrite', m => promettre(m.put(valeur)));

export const ecrireLot = (magasin, valeurs) =>
  transaction(magasin, 'readwrite', m => Promise.all(valeurs.map(v => promettre(m.put(v)))));

export const supprimer = (magasin, cle) =>
  transaction(magasin, 'readwrite', m => promettre(m.delete(cle)));

export const vider = (magasins) =>
  transaction(magasins, 'readwrite', (...m) => Promise.all(m.map(x => promettre(x.clear()))));

export { transaction, promettre };
