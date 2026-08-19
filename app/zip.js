const TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let valeur = i;
    for (let bit = 0; bit < 8; bit++) valeur = valeur & 1 ? 0xEDB88320 ^ valeur >>> 1 : valeur >>> 1;
    table[i] = valeur >>> 0;
  }
  return table;
})();

function crc32(octets) {
  let reste = 0xFFFFFFFF;
  for (const octet of octets) reste = TABLE[(reste ^ octet) & 255] ^ reste >>> 8;
  return (reste ^ 0xFFFFFFFF) >>> 0;
}

function horodatageDos(date) {
  const heure = date.getHours() << 11 | date.getMinutes() << 5 | date.getSeconds() >> 1;
  const jour = (date.getFullYear() - 1980) << 9 | (date.getMonth() + 1) << 5 | date.getDate();
  return { heure, jour };
}

function bloc(taille, remplir) {
  const tampon = new ArrayBuffer(taille);
  remplir(new DataView(tampon));
  return new Uint8Array(tampon);
}

/* Écriture ZIP en mode « stored » : aucune compression, les JPEG le sont déjà.
   SPECS §9. */
export async function creerZip(entrees) {
  const encodeur = new TextEncoder();
  const date = new Date();
  const { heure, jour } = horodatageDos(date);

  const morceaux = [];
  const index = [];
  let position = 0;

  for (const entree of entrees) {
    const nom = encodeur.encode(entree.nom);
    const donnees = new Uint8Array(await entree.blob.arrayBuffer());
    const somme = crc32(donnees);

    const enTete = bloc(30, vue => {
      vue.setUint32(0, 0x04034B50, true);
      vue.setUint16(4, 20, true);
      vue.setUint16(6, 0x0800, true);
      vue.setUint16(8, 0, true);
      vue.setUint16(10, heure, true);
      vue.setUint16(12, jour, true);
      vue.setUint32(14, somme, true);
      vue.setUint32(18, donnees.length, true);
      vue.setUint32(22, donnees.length, true);
      vue.setUint16(26, nom.length, true);
      vue.setUint16(28, 0, true);
    });

    morceaux.push(enTete, nom, donnees);
    index.push({ nom, somme, taille: donnees.length, decalage: position });
    position += enTete.length + nom.length + donnees.length;
  }

  const debutIndex = position;
  for (const entree of index) {
    const enTete = bloc(46, vue => {
      vue.setUint32(0, 0x02014B50, true);
      vue.setUint16(4, 20, true);
      vue.setUint16(6, 20, true);
      vue.setUint16(8, 0x0800, true);
      vue.setUint16(10, 0, true);
      vue.setUint16(12, heure, true);
      vue.setUint16(14, jour, true);
      vue.setUint32(16, entree.somme, true);
      vue.setUint32(20, entree.taille, true);
      vue.setUint32(24, entree.taille, true);
      vue.setUint16(28, entree.nom.length, true);
      vue.setUint32(42, entree.decalage, true);
    });
    morceaux.push(enTete, entree.nom);
    position += enTete.length + entree.nom.length;
  }

  morceaux.push(bloc(22, vue => {
    vue.setUint32(0, 0x06054B50, true);
    vue.setUint16(8, index.length, true);
    vue.setUint16(10, index.length, true);
    vue.setUint32(12, position - debutIndex, true);
    vue.setUint32(16, debutIndex, true);
  }));

  return new Blob(morceaux, { type: 'application/zip' });
}

export async function lireZip(blob) {
  const donnees = new Uint8Array(await blob.arrayBuffer());
  const vue = new DataView(donnees.buffer);
  const decodeur = new TextDecoder();

  let fin = donnees.length - 22;
  while (fin >= 0 && vue.getUint32(fin, true) !== 0x06054B50) fin--;
  if (fin < 0) throw new Error('archive illisible');

  let curseur = vue.getUint32(fin + 16, true);
  const nombre = vue.getUint16(fin + 8, true);
  const fichiers = new Map();

  for (let i = 0; i < nombre; i++) {
    const tailleNom = vue.getUint16(curseur + 28, true);
    const tailleExtra = vue.getUint16(curseur + 30, true);
    const tailleCommentaire = vue.getUint16(curseur + 32, true);
    const taille = vue.getUint32(curseur + 24, true);
    const decalage = vue.getUint32(curseur + 42, true);
    const nom = decodeur.decode(donnees.subarray(curseur + 46, curseur + 46 + tailleNom));

    const nomLocal = vue.getUint16(decalage + 26, true);
    const extraLocal = vue.getUint16(decalage + 28, true);
    const debut = decalage + 30 + nomLocal + extraLocal;
    fichiers.set(nom, donnees.slice(debut, debut + taille));

    curseur += 46 + tailleNom + tailleExtra + tailleCommentaire;
  }
  return fichiers;
}
