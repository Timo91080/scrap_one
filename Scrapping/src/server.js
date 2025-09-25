import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import { scrapeListPageAndDetails, scrapeDetail, scrapeAllPagesAndDetails, fetchListLinks } from './scraper.js';
import { appendRows } from './sheets.js';
import { cleanValue, formatPhone, toSheetRows } from './utils/sheetFormat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes API (AVANT les fichiers statiques et le fallback)
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, message: 'pong', timestamp: new Date().toISOString() });
});

app.get('/api/scrape', async (req, res) => {
  const { url, limit } = req.query;
  try {
    const data = await scrapeListPageAndDetails(url, limit ? Number(limit) : 50);
    res.json({ ok: true, count: data.length, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.get('/api/scrape/detail', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ ok: false, error: 'url is required' });
  try {
    const data = await scrapeDetail(url);
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Nouvelle route: Scrape 1 page et export vers Google Sheets
app.post('/api/scrape-simple', async (req, res) => {
  const page = Number(req.body?.page) || 1;
  const spreadsheetId = process.env.SHEET_ID || '1ofcXp6KwLPbO7TJOdJ3Y4lSh4e4Jc5x2GIQ3GIjEgC4';
  const range = process.env.SHEET_RANGE || 'ScrapSheet!A1';

  const listUrl = `https://edv.travel/adherer/annuaire-des-adherents/?pagination=${page}`;
  const start = Date.now();

  try {
    const links = await fetchListLinks(listUrl);
    if (!links.length) {
      return res.json({ ok: true, page, count: 0, duration: 0, message: 'Aucun lien trouvé sur la page' });
    }

    const companies = [];
    for (const link of links) {
      try {
        const detail = await scrapeDetail(link);
        companies.push(detail);
        await new Promise(r => setTimeout(r, 150));
      } catch (err) {
        companies.push({ url: link, error: err?.message || String(err) });
      }
    }

    const duration = Math.round((Date.now() - start) / 1000);

    // Formatage + export Google Sheets
    const { headerRow, rows } = toSheetRows(companies);
    const titleRow = [`=== PAGE ${page} - ${new Date().toLocaleDateString('fr-FR')} - ${companies.length} entreprises ===`];

    const gsResult = await appendRows({
      spreadsheetId,
      range,
      values: [titleRow, headerRow, ...rows]
    });

    res.json({
      ok: true,
      page,
      count: companies.length,
      duration,
      googleSheetsResult: gsResult,
      message: 'Scrape simple + export terminé'
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Nouvelle route: Scrape plusieurs pages et export
app.post('/api/scrape-multiple', async (req, res) => {
  const startPage = Number(req.body?.startPage) || 1;
  const endPage = Number(req.body?.endPage) || startPage;
  const spreadsheetId = process.env.SHEET_ID || '1ofcXp6KwLPbO7TJOdJ3Y4lSh4e4Jc5x2GIQ3GIjEgC4';
  const range = process.env.SHEET_RANGE || 'ScrapSheet!A1';

  const t0 = Date.now();

  try {
    const allCompanies = [];
    let errors = 0;

    for (let p = startPage; p <= endPage; p++) {
      const listUrl = `https://edv.travel/adherer/annuaire-des-adherents/?pagination=${p}`;
      const links = await fetchListLinks(listUrl);

      for (const link of links) {
        try {
          const detail = await scrapeDetail(link);
          allCompanies.push(detail);
          await new Promise(r => setTimeout(r, 120));
        } catch (err) {
          errors += 1;
        }
      }
    }

    // Export Google Sheets
    const { headerRow, rows } = toSheetRows(allCompanies);
    const titleRow = [`=== PAGES ${startPage}-${endPage} - ${new Date().toLocaleDateString('fr-FR')} - ${allCompanies.length} entreprises ===`];

    const gsResult = await appendRows({
      spreadsheetId,
      range,
      values: [titleRow, headerRow, ...rows]
    });

    const duration = Math.round((Date.now() - t0) / 1000);

    res.json({
      ok: true,
      startPage,
      endPage,
      totalPages: endPage - startPage + 1,
      count: allCompanies.length,
      averagePerPage: Math.round(allCompanies.length / (endPage - startPage + 1)),
      errors,
      duration,
      googleSheetsResult: gsResult,
      message: 'Scrape multiple + export terminé'
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// NOUVELLE ROUTE: Scrape paginé (export page par page) en mode concurrent
app.post('/api/scrape-paginated', async (req, res) => {
  const startPage = Number(req.body?.startPage) || 1;
  const endPage = Number(req.body?.endPage) || startPage;
  const concurrency = Number(req.body?.concurrency) || 10;
  const timeoutMs = Number(req.body?.timeoutMs) || 10000;
  const batchDelay = Number(req.body?.batchDelay) || 200;

  const spreadsheetId = process.env.SHEET_ID || '1ofcXp6KwLPbO7TJOdJ3Y4lSh4e4Jc5x2GIQ3GIjEgC4';
  const range = process.env.SHEET_RANGE || 'ScrapSheet!A1';

  function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
  function withTimeout(promise, ms, url){
    return Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms: ${url}`)), ms))
    ]);
  }

  const runPage = async (page) => {
    const pageStart = Date.now();
    const listUrl = `https://edv.travel/adherer/annuaire-des-adherents/?pagination=${page}`;

    console.log(`\n===== PAGE ${page} =====`);
    const links = await fetchListLinks(listUrl);
    console.log(`Liens: ${links.length}`);

    const companies = [];
    let done = 0;

    for (let i = 0; i < links.length; i += concurrency) {
      const batch = links.slice(i, i + concurrency);
      const settled = await Promise.allSettled(
        batch.map((url, idx) =>
          withTimeout(scrapeDetail(url), timeoutMs, url)
            .then(data => {
              done += 1;
              const globalIndex = i + idx + 1;
              process.stdout.write(`Page ${page} (${globalIndex}/${links.length}) OK\r`);
              return data;
            })
            .catch(err => {
              done += 1;
              const globalIndex = i + idx + 1;
              process.stdout.write(`Page ${page} (${globalIndex}/${links.length}) ERR\r`);
              return null;
            })
        )
      );

      for (const r of settled) {
        if (r.status === 'fulfilled' && r.value) companies.push(r.value);
      }

      if (i + concurrency < links.length) await sleep(batchDelay);
    }

    // Export immédiat de la page
    const { headerRow, rows } = toSheetRows(companies);
    const titleRow = [`=== PAGE ${page} - ${new Date().toLocaleDateString('fr-FR')} - ${rows.length} entreprises ===`];
    if (rows.length) {
      await appendRows({ spreadsheetId, range, values: [titleRow, headerRow, ...rows] });
    }

    const duration = Math.round((Date.now() - pageStart) / 1000);
    return { page, links: links.length, exported: rows.length, duration };
  };

  const t0 = Date.now();
  const perPage = [];
  try {
    for (let p = startPage; p <= endPage; p++) {
      const resPage = await runPage(p);
      perPage.push(resPage);
      await sleep(300);
    }

    const totalExported = perPage.reduce((a, b) => a + b.exported, 0);
    const totalLinks = perPage.reduce((a, b) => a + b.links, 0);
    const duration = Math.round((Date.now() - t0) / 1000);

    res.json({
      ok: true,
      mode: 'paginated-fast',
      startPage, endPage, concurrency, timeoutMs, batchDelay,
      totalPages: endPage - startPage + 1,
      totalLinks, totalExported, duration,
      pages: perPage
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.post('/api/export', async (req, res) => {
  const { spreadsheetId, range, rows } = req.body || {};
  if (!spreadsheetId || !range || !Array.isArray(rows)) {
    return res.status(400).json({ ok: false, error: 'spreadsheetId, range, rows are required' });
  }
  try {
    const data = await appendRows({ spreadsheetId, range, values: rows });
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.get('/api/scrape/all', async (req, res) => {
  const { maxPages = 111, batchSize = 10 } = req.query;
  try {
    console.log(`🚀 Starting full scrape: ${maxPages} pages, batch ${batchSize}`);
    const data = await scrapeAllPagesAndDetails(null, Number(maxPages), Number(batchSize));
    res.json({ ok: true, count: data.length, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.get('/api/test/links', async (req, res) => {
  const { page = 1 } = req.query;
  try {
    const url = `https://edv.travel/adherer/annuaire-des-adherents/?pagination=${page}`;
    const links = await fetchListLinks(url);
    res.json({ ok: true, page: Number(page), url, totalLinks: links.length, sampleLinks: links.slice(0, 5), links });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.get('/api/scrape/list', async (req, res) => {
  const { page = 1, limit = 5 } = req.query;
  const url = `https://edv.travel/adherer/annuaire-des-adherents/?pagination=${page}`;
  try {
    const data = await scrapeListPageAndDetails(url, Number(limit));
    res.json({ ok: true, page: Number(page), url, count: data.length, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.get('/api/scrape/page', async (req, res) => {
  const { page = 1 } = req.query;
  const url = `https://edv.travel/adherer/annuaire-des-adherents/?pagination=${page}`;
  
  try {
    console.log(`🚀 Starting page scrape for page ${page}...`);
    const startTime = Date.now();
    
    const data = await scrapeListPageAndDetails(url, null);

    const successful = data.filter(d => !d.error).length;
    const errors = data.length - successful;
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    const totalLinks = data.length;
    const successRate = totalLinks ? Math.round((successful / totalLinks) * 100) : 0;
    
    console.log(`✅ Page ${page} complete in ${duration}s! ${successful} success, ${errors} errors`);
    
    res.json({ 
      ok: true, 
      method: 'standard',
      page: Number(page),
      url,
      totalLinks,
      successful,
      errors,
      successRate,
      duration,
      speed: totalLinks ? Math.round(totalLinks / (duration / 60)) + ' fiches/min' : '0 fiches/min',
      results: data 
    });
    
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.get('/api/scrape/page/fast', async (req, res) => {
  const { page = 1, concurrency = 3 } = req.query;
  const url = `https://edv.travel/adherer/annuaire-des-adherents/?pagination=${page}`;
  
  try {
    console.log(`⚡ Starting ultra-fast scrape for page ${page} with concurrency ${concurrency}...`);
    const startTime = Date.now();
    
    // 1. Récupérer tous les liens de la page
    const links = await fetchListLinks(url);
    console.log(`📋 Found ${links.length} company links on page ${page}`);
    
    if (links.length === 0) {
      return res.json({ ok: true, totalLinks: 0, results: [] });
    }
    
    // 2. Traitement en parallèle avec concurrency limitée
    const results = [];
    const errors = [];
    const concurrencyNum = Number(concurrency);
    let successful = 0;
    
    for (let i = 0; i < links.length; i += concurrencyNum) {
      const batch = links.slice(i, i + concurrencyNum);
      
      const batchPromises = batch.map(async (link, batchIndex) => {
        try {
          const companyData = await scrapeDetail(link);
          successful++;
          
          // Log progressif
          const globalIndex = i + batchIndex + 1;
          if (globalIndex % 5 === 0 || globalIndex === links.length) {
            console.log(`📄 Progress: ${globalIndex}/${links.length} (${Math.round((globalIndex/links.length)*100)}%)`);
          }
          
          return companyData;
        } catch (error) {
          console.error(`❌ Error scraping ${link}:`, error.message);
          errors.push({ link, error: error.message });
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(result => result !== null));
      
      // Petite pause entre les batches
      if (i + concurrencyNum < links.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log(`⚡ Ultra-fast page ${page} complete in ${duration}s! ${successful} success, ${errors.length} errors`);
    
    res.json({ 
      ok: true, 
      method: 'ultra-fast-parallel',
      page: Number(page),
      url,
      concurrency: concurrencyNum,
      totalLinks: links.length,
      successful,
      errors: errors.length,
      successRate: Math.round((successful / links.length) * 100),
      duration,
      speed: Math.round(links.length / (duration / 60)) + ' fiches/min',
      results
    });
    
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Fichiers statiques
app.use(express.static(path.join(__dirname, '../public')));

// Fallback index.html pour routes front (APRÈS les routes API)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
