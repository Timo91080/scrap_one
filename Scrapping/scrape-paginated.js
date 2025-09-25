import dotenv from 'dotenv';
import { fetchListLinks, scrapeDetail } from './src/scraper.js';
import { appendRows } from './src/sheets.js';
import { toSheetRows } from './src/utils/sheetFormat.js';

dotenv.config();

const SHEET_ID = process.env.SHEET_ID || '1ofcXp6KwLPbO7TJOdJ3Y4lSh4e4Jc5x2GIQ3GIjEgC4';
const SHEET_RANGE = process.env.SHEET_RANGE || 'ScrapSheet!A1';
const TOTAL_PAGES = 111;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function scrapeOnePage(page) {
  const listUrl = `https://edv.travel/adherer/annuaire-des-adherents/?pagination=${page}`;
  console.log(`\n===== PAGE ${page}/${TOTAL_PAGES} =====`);
  console.log(`Liste: ${listUrl}`);

  const links = await fetchListLinks(listUrl);
  console.log(`Liens à traiter sur cette page: ${links.length}`);
  if (!links.length) return { page, rows: 0, success: 0, errors: 0 };

  const companies = [];
  let success = 0, errors = 0;

  for (let i = 0; i < links.length; i++) {
    const url = links[i];
    process.stdout.write(`Page ${page} (${i + 1}/${links.length}) `);
    try {
      const detail = await scrapeDetail(url);
      companies.push(detail);
      success++;
      console.log(`OK - ${detail.raison_sociale || url}`);
    } catch (e) {
      companies.push({ url, error: e?.message || String(e) });
      errors++;
      console.log(`ERR - ${url} -> ${e?.message || e}`);
    }
    await sleep(120);
  }

  const valid = companies.filter(c => !c.error);
  const { headerRow, rows } = toSheetRows(valid);
  const titleRow = [`=== PAGE ${page} - ${new Date().toLocaleDateString('fr-FR')} - ${rows.length} entreprises ===`];

  if (rows.length) {
    await appendRows({ spreadsheetId: SHEET_ID, range: SHEET_RANGE, values: [titleRow, headerRow, ...rows] });
    console.log(`Export Google Sheets OK (page ${page}, ${rows.length} lignes).`);
  } else {
    console.log(`Aucune donnée à exporter pour la page ${page}.`);
  }

  return { page, rows: rows.length, success, errors };
}

async function main() {
  const start = parseInt(process.argv[2] || '1', 10);
  const end = process.argv[3] ? parseInt(process.argv[3], 10) : TOTAL_PAGES;

  console.log(`\nPagination: pages ${start} → ${end} (sur ${TOTAL_PAGES})`);

  let totalRows = 0, totalSuccess = 0, totalErrors = 0;
  for (let p = start; p <= end; p++) {
    const res = await scrapeOnePage(p);
    totalRows += res.rows;
    totalSuccess += res.success;
    totalErrors += res.errors;
    await sleep(400);
  }
  console.log(`\nFIN. Lignes exportées: ${totalRows}, succès: ${totalSuccess}, erreurs: ${totalErrors}.`);
}

main().catch(err => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
