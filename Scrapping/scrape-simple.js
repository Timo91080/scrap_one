/**
 * Script SIMPLE pour scraper UNE PAGE et l'exporter vers Google Sheets
 * ORDRE EXACT : Immatriculation, Raison sociale, Enseigne, Adresse, Code Postal, Ville, Téléphone, Fax, E-mail, Site Web
 */
import { fetchListLinks, scrapeDetail } from './src/scraper.js';
import { appendRows } from './src/sheets.js';
import { toSheetRows } from './src/utils/sheetFormat.js';

// Paramètres de performance (surchargeables via variables d'environnement)
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '12', 10);   // nb de liens en parallèle
const TIMEOUT_MS  = parseInt(process.env.HTTP_TIMEOUT || '10000', 10); // 10s max par lien
const BATCH_DELAY = parseInt(process.env.BATCH_DELAY || '200', 10);    // pause entre batches

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function withTimeout(promise, ms, url) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout ${ms}ms: ${url}`)), ms))
  ]);
}

async function scrapePage(pageNumber = 1) {
  console.log(`🚀 SCRAPING PAGE ${pageNumber} - EXPORT DIRECT VERS GOOGLE SHEETS (concurrency=${CONCURRENCY})`);
  
  try {
    // 1. Récupérer tous les liens de la page
    const pageUrl = `https://edv.travel/adherer/annuaire-des-adherents/?pagination=${pageNumber}`;
    console.log(`📖 Récupération des liens de la page ${pageNumber}...`);
    const links = await fetchListLinks(pageUrl);
    console.log(`✅ ${links.length} liens trouvés`);
    
    if (links.length === 0) {
      console.log('❌ Aucun lien trouvé');
      return;
    }
    
    // 2. Scraping PARALLÈLE par batches
    console.log(`🕷️ Scraping parallèle de ${links.length} entreprises...`);
    const companies = [];
    let done = 0;

    for (let i = 0; i < links.length; i += CONCURRENCY) {
      const batch = links.slice(i, i + CONCURRENCY);

      const settled = await Promise.allSettled(
        batch.map((url) =>
          withTimeout(scrapeDetail(url), TIMEOUT_MS, url)
            .then((data) => {
              done += 1;
              console.log(`📄 Page ${pageNumber} (${done}/${links.length}) OK - ${data?.raison_sociale || 'N/A'}`);
              return data;
            })
            .catch((err) => {
              done += 1;
              console.log(`📄 Page ${pageNumber} (${done}/${links.length}) ERR - ${err.message}`);
              return null; // on filtrera
            })
        )
      );

      for (const r of settled) {
        if (r.status === 'fulfilled' && r.value) companies.push(r.value);
      }

      if (i + CONCURRENCY < links.length) {
        await sleep(BATCH_DELAY);
      }
    }
    
    console.log(`\n📊 ${companies.length}/${links.length} entreprises scrapées avec succès`);
    
    // 3. FORMATAGE DIRECT pour Google Sheets
    console.log('📋 Formatage pour Google Sheets...');
    
    // Titre
    const dateStr = new Date().toLocaleDateString('fr-FR');
    const titleRow = [`=== PAGE ${pageNumber} - ${dateStr} - ${companies.length} entreprises ===`];
    
    // Données formatées avec helpers partagés
    const { headerRow, rows: dataRows } = toSheetRows(companies);
    
    // 4. EXPORT vers Google Sheets
    console.log(`\n📤 Export vers Google Sheets...`);
    const allRows = [titleRow, headerRow, ...dataRows];
    
    await appendRows({
      spreadsheetId: '1ofcXp6KwLPbO7TJOdJ3Y4lSh4e4Jc5x2GIQ3GIjEgC4',
      range: 'ScrapSheet',
      values: allRows
    });
    
    console.log(`✅ SUCCÈS ! ${companies.length} entreprises exportées vers Google Sheets`);
    console.log('🔍 Vérifiez votre Google Sheet maintenant !');
    
    return {
      success: true,
      count: companies.length,
      page: pageNumber
    };
    
  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    return { success: false, error: error.message };
  }
}

// Lancement du script
const pageNumber = process.argv[2] ? parseInt(process.argv[2]) : 1;

if (isNaN(pageNumber) || pageNumber < 1) {
  console.error('❌ Usage: node scrape-simple.js [numéro_page]');
  console.error('❌ Exemple: node scrape-simple.js 1');
  process.exit(1);
}

console.log(`🕷️ LANCEMENT - PAGE ${pageNumber}\n`);

scrapePage(pageNumber)
  .then(result => {
    if (result && result.success) {
      console.log(`\n🎊 TERMINÉ !`);
      console.log(`✅ ${result.count} entreprises de la page ${result.page} exportées`);
      console.log('📋 Colonnes : Immatriculation | Raison sociale | Enseigne | Adresse | Code Postal | Ville | Téléphone | Fax | E-mail | Site Web');
    } else {
      console.log('\n❌ ÉCHEC');
      if (result?.error) {
        console.log(`Erreur: ${result.error}`);
      }
    }
  })
  .catch(error => {
    console.error('\n💥 ERREUR FATALE:', error.message);
  });
