/* Seuils à valider avec l'utilisatrice — SPECS §11 les laisse ouverts.
   Calés pour que 37 planches donnent Believix, comme la maquette. */
export const PALIERS = [
  { nom: 'Charmix', seuil: 1 },
  { nom: 'Enchantix', seuil: 10 },
  { nom: 'Believix', seuil: 25 },
  { nom: 'Harmonix', seuil: 50 },
  { nom: 'Sirenix', seuil: 80 },
  { nom: 'Bloomix', seuil: 120 },
  { nom: 'Mythix', seuil: 170 },
  { nom: 'Butterflix', seuil: 230 },
  { nom: 'Tynix', seuil: 300 },
  { nom: 'Onyrix', seuil: 400 }
];

export const palierAtteint = (finies) =>
  [...PALIERS].reverse().find(p => finies >= p.seuil) || null;

export const palierSuivant = (finies) =>
  PALIERS.find(p => finies < p.seuil) || null;
