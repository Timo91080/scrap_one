// Helpers partagés pour le projet: nettoyage des valeurs et formatage Google Sheets

export function cleanValue(value) {
  if (value === undefined || value === null) return '';
  let raw = String(value).trim();
  if (!raw) return '';

  // Protéger contre "=+" (Sheets)
  if (raw.startsWith('=+')) raw = raw.slice(1).trim();

  const normalize = (s) => s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  const n = normalize(raw);
  const invalids = new Set([
    'n/a','na','none','null','undefined','nc','n.c.','nd','n.d.','—','-','--',
    'non communique','non indique','non renseigne','non communique','non renseigne',
    'non disponible','inconnu'
  ]);
  if (invalids.has(n)) return '';

  // Déprefixer mailto:/tel:
  if (raw.toLowerCase().startsWith('mailto:')) return raw.slice(7).trim();
  if (raw.toLowerCase().startsWith('tel:')) return raw.slice(4).trim();

  return raw;
}

export function formatPhone(value) {
  const v = cleanValue(value);
  if (!v) return '';
  const compact = v.replace(/[\s().-]/g, '');
  if (!v.startsWith("'") && (/^\+/.test(compact) || /^0/.test(compact))) {
    return "'" + v; // force texte dans Google Sheets
  }
  return v;
}

export function toSheetRows(companies) {
  const headerRow = [
    'Immatriculation',
    'Raison sociale',
    'Enseigne',
    'Adresse',
    'Code Postal',
    'Ville',
    'Téléphone',
    'Fax',
    'E-mail',
    'Site Web'
  ];

  const rows = companies.map(c => [
    cleanValue(c.immatriculation),
    cleanValue(c.raison_sociale),
    cleanValue(c.enseigne),
    cleanValue(c.adresse),
    cleanValue(c.code_postal),
    cleanValue(c.ville),
    formatPhone(c.telephone),
    formatPhone(c.fax),
    cleanValue(c.email),
    cleanValue(c.site_web)
  ]);

  return { headerRow, rows };
}
