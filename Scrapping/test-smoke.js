import { toSheetRows } from './src/utils/sheetFormat.js';

const cases = [
  [{}, 'empty company should be filtered out'],
  [{ raison_sociale: 'ACME' }, 'one field keeps row'],
  [{ adresse: 'Adresse e-mail: x@y.com' }, 'ambiguous adresse should be cleaned -> likely empty row'],
];

for (const [obj, label] of cases) {
  const { rows } = toSheetRows([obj]);
  console.log(label + ' -> rows:', rows.length, rows[0] || null);
}
