const lire = (cle, defaut) => localStorage.getItem(`colorix.${cle}`) ?? defaut;
const ecrire = (cle, valeur) => localStorage.setItem(`colorix.${cle}`, valeur);

export const miseEnPage = () => lire('miseEnPage', 'A');
export const definirMiseEnPage = (valeur) => ecrire('miseEnPage', valeur);

export const dernierAlbum = () => lire('dernierAlbum', null);
export const definirDernierAlbum = (id) => ecrire('dernierAlbum', id);

export const dernierExport = () => lire('dernierExport', null);
export const marquerExport = () => ecrire('dernierExport', new Date().toISOString());

export function joursDepuisExport() {
  const date = dernierExport();
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date)) / 86400000);
}
