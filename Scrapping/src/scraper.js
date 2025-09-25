import * as cheerio from 'cheerio';
import { URL } from 'node:url';

// URL de base du site à scraper
const BASE = 'https://edv.travel';

/**
 * Fonction pour faire une requête GET avec fetch natif de Node.js
 * @param {string} url - URL à récupérer
 * @returns {Promise<string>} - Le contenu HTML de la page
 */
async function httpGet(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Connection': 'keep-alive'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${error.message}`);
  }
}

/**
 * Convertit une URL relative en URL absolue
 * @param {string} href - URL relative ou absolue
 * @returns {string|null} - URL absolue ou null si invalide
 */
function toAbs(href) {
  if (!href) return null;
  try {
    const u = new URL(href, BASE);
    return u.toString();
  } catch {
    return null; // URL invalide
  }
}

/**
 * Récupère tous les liens vers les fiches adhérents depuis la page de liste
 * @param {string} listUrl - URL de la page de liste (optionnel)
 * @returns {Promise<string[]>} - Array des URLs des fiches
 */
export async function fetchListLinks(listUrl) {
  // URL par défaut si non fournie
  const url = listUrl || `${BASE}/adherer/annuaire-des-adherents/?pagination=1`;
  
  // Récupération du HTML de la page avec notre fonction native
  const html = await httpGet(url);
  const $ = cheerio.load(html);
  
  // Set pour éviter les doublons de liens
  const links = new Set();
  
  // MÉTHODE 1: Sélecteur spécifique pour les liens de fiches
  // Tous les liens vers fiche-adherent avec un ID
  $('a[href*="fiche-adherent/?id="]').each((_, el) => {
    const href = $(el).attr('href');
    const abs = toAbs(href);
    if (abs && abs.includes('id=')) {
      links.add(abs);
    }
  });
  
  console.log(`📋 Method 1 - Specific selector found: ${links.size} links`);
  
  // MÉTHODE 2: Si pas assez, chercher TOUS les liens qui contiennent 'id=' et sont des fiches
  if (links.size < 20) {
    console.log(`⚠️  Only ${links.size} links found with specific selector, trying broader search...`);
    
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('id=') && href.includes('fiche')) {
        const abs = toAbs(href);
        if (abs) {
          links.add(abs);
        }
      }
    });
    
    console.log(`📋 Method 2 - Broader search found: ${links.size} total links`);
  }
  
  // MÉTHODE 3: Si encore pas assez, analyser le contenu des liens
  if (links.size < 20) {
    console.log(`⚠️  Still only ${links.size} links, trying content-based search...`);
    
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      
      // Liens qui ressemblent à des entreprises (nom + adresse)
      if (href && text && text.length > 20 && text.includes(' - ')) {
        const abs = toAbs(href);
        if (abs && abs.includes('id=')) {
          links.add(abs);
        }
      }
    });
    
    console.log(`� Method 3 - Content-based search found: ${links.size} total links`);
  }
  
  console.log(`📖 Fetching links from: ${url}`);
  console.log(`🔗 Found ${links.size} unique links on this page`);
  
  // Debug: afficher les 5 premiers liens trouvés
  const linksArray = Array.from(links);
  console.log(`📋 Sample links found:`, linksArray.slice(0, 5));
  
  return Array.from(links); // Conversion Set -> Array
}

/**
 * Scrape les détails d'une fiche adhérent spécifique
 * @param {string} detailUrl - URL de la fiche adhérent
 * @returns {Promise<Object>} - Objet contenant toutes les données extraites
 */
export async function scrapeDetail(detailUrl) {
  // Récupération du HTML de la fiche avec notre fonction native
  const html = await httpGet(detailUrl);
  const $ = cheerio.load(html);

  // DEBUG: Log HTML structure for debugging
  console.log(`🌐 Scraping: ${detailUrl}`);
  console.log(`📄 HTML length: ${html.length} chars`);
  
  // Save HTML to file for inspection (optional debug)
  // import fs from 'node:fs'; fs.writeFileSync('debug.html', html);
  
  console.log(`🏷️  Found ${$('td, th').length} table cells`);
  console.log(`📋 Found ${$('li').length} list items`);
  console.log(`🔗 Found ${$('a').length} links`);

  /**
   * Fonction helper pour extraire une valeur par son label
   * @param {string} label - Label à rechercher (ex: "immatriculation")
   * @returns {string|null} - Valeur trouvée ou null
   */
  const getByLabel = (label) => {
    let val = null;
    
    console.log(`\n🔍 Searching for: ${label}`);
    
    // Méthode 1: Chercher dans toutes les balises qui peuvent contenir des labels
    $('*').each((_, el) => {
      const text = $(el).text().trim();
      const lowerText = text.toLowerCase();
      
      if (lowerText.includes(label.toLowerCase()) && text.length < 200) {
        console.log(`  Found potential match: "${text}"`);
        
        // Si c'est un élément qui contient EXACTEMENT le label recherché (sans autre texte)
        if (lowerText === label.toLowerCase() || lowerText === label.toLowerCase() + ':') {
          console.log(`  🎯 Exact label match found!`);
          
          // Essayer de récupérer l'élément suivant
          const next = $(el).next();
          if (next.length && next.text().trim()) {
            const nextText = next.text().trim().replace(/\s+/g, ' ');
            console.log(`  ✅ Next element value: "${nextText}"`);
            val = nextText;
            return false;
          }
          
          // Essayer le parent puis le suivant
          const parentNext = $(el).parent().next();
          if (parentNext.length && parentNext.text().trim()) {
            const parentNextText = parentNext.text().trim().replace(/\s+/g, ' ');
            console.log(`  ✅ Parent next value: "${parentNextText}"`);
            val = parentNextText;
            return false;
          }
        }
        
        // Sinon, si le texte contient le label + ":" + valeur dans le même élément
        else if (text.includes(':')) {
          const parts = text.split(':');
          if (parts.length >= 2) {
            const labelPart = parts[0].trim().toLowerCase();
            if (labelPart === label.toLowerCase()) {
              const value = parts.slice(1).join(':').trim().replace(/\s+/g, ' ');
              if (value && value.length > 0) {
                console.log(`  ✅ Inline value: "${value}"`);
                val = value;
                return false; // break
              }
            }
          }
        }
      }
    });
    
    console.log(`  Result for ${label}: ${val || 'NULL'}`);
    return val;
  };

  // Extraction de l'email : d'abord par sélecteur mailto, sinon par label
  const email = $('a[href^="mailto:"]').first().text().trim() || getByLabel('e-mail');
  
  // Extraction du site web : liens http(s) non-mailto
  const site = $('a[href^="http" i]').filter((_, a) => !$(a).attr('href')?.startsWith('mailto:')).first().attr('href') || getByLabel('site web');

  // Extraction de l'ID depuis l'URL (paramètre ?id=xxx)
  let id = null;
  try {
    id = new URL(detailUrl).searchParams.get('id');
  } catch { 
    // Ignore les erreurs d'URL
  }

  // Retourne un objet structuré avec toutes les données
  return {
    id,                                                    // ID de la fiche
    url: detailUrl,                                       // URL source
    immatriculation: getByLabel('immatriculation') || null,   // Numéro d'immatriculation
    raison_sociale: getByLabel('raison sociale') || null,    // Nom de l'entreprise
    enseigne: getByLabel('enseigne') || null,               // Nom commercial
    adresse: getByLabel('adresse') || null,                 // Adresse complète
    code_postal: getByLabel('code postal') || null,         // Code postal
    ville: getByLabel('ville') || null,                     // Ville
    telephone: getByLabel('téléphone') || getByLabel('telephone') || null, // Téléphone (avec/sans accent)
    email: email || null,                                   // Email
    site_web: site || null,                                 // Site web
  };

  console.log(`Scraped detail: ${detailUrl}`);
}

/**
 * Récupère tous les liens de toutes les pages (avec pagination)
 * @param {string} baseUrl - URL de base de la liste
 * @param {number} maxPages - Nombre maximum de pages à scraper (défaut: 111)
 * @returns {Promise<string[]>} - Array de tous les URLs des fiches
 */
export async function fetchAllListLinks(baseUrl, maxPages = 111) {
  const baseListUrl = baseUrl || `${BASE}/adherer/annuaire-des-adherents`;
  const allLinks = new Set();
  
  console.log(`🚀 Starting to scrape ${maxPages} pages...`);
  
  for (let page = 1; page <= maxPages; page++) {
    try {
      const pageUrl = `${baseListUrl}/?pagination=${page}`;
      console.log(`📖 Scraping page ${page}/${maxPages}: ${pageUrl}`);
      
      // Récupérer les liens de cette page
      const pageLinks = await fetchListLinks(pageUrl);
      
      if (pageLinks.length === 0) {
        console.log(`⚠️  Page ${page} has no links, stopping pagination`);
        break;
      }
      
      // Ajouter tous les liens trouvés
      pageLinks.forEach(link => allLinks.add(link));
      console.log(`✅ Page ${page}: found ${pageLinks.length} links (total: ${allLinks.size})`);
      
      // Délai pour éviter de surcharger le serveur
      if (page < maxPages) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 seconde entre chaque page
      }
      
    } catch (error) {
      console.error(`❌ Error scraping page ${page}:`, error.message);
      // Continuer avec la page suivante même en cas d'erreur
    }
  }
  
  console.log(`🎉 Pagination complete! Found ${allLinks.size} unique links across ${maxPages} pages`);
  return Array.from(allLinks);
}

/**
 * Scrape TOUTES les pages ET toutes les fiches détail
 * @param {string} baseUrl - URL de base de la liste 
 * @param {number} maxPages - Nombre maximum de pages (défaut: 111)
 * @param {number} batchSize - Nombre de fiches à traiter par batch (défaut: 10)
 * @returns {Promise<Object[]>} - Array d'objets contenant les données ou erreurs
 */
export async function scrapeAllPagesAndDetails(baseUrl, maxPages = 111, batchSize = 10) {
  console.log(`🌍 Starting full scrape: ${maxPages} pages, batch size: ${batchSize}`);
  
  // Étape 1: Récupération de tous les liens de toutes les pages
  const allLinks = await fetchAllListLinks(baseUrl, maxPages);
  console.log(`📊 Total links to scrape: ${allLinks.length}`);
  
  const results = [];
  
  // Étape 2: Scraping par batch pour éviter de surcharger
  for (let i = 0; i < allLinks.length; i += batchSize) {
    const batch = allLinks.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(allLinks.length / batchSize);
    
    console.log(`🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`);
    
    // Scraper chaque fiche du batch
    for (const url of batch) {
      try {
        const data = await scrapeDetail(url);
        results.push(data);
        console.log(`✅ Scraped ${results.length}/${allLinks.length}: ${data.raison_sociale || 'N/A'}`);
      } catch (error) {
        console.error(`❌ Error scraping ${url}:`, error.message);
        results.push({ url, error: error.message });
      }
      
      // Petit délai entre chaque requête
      await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 seconde
    }
    
    console.log(`✅ Batch ${batchNumber} complete. Total scraped: ${results.length}`);
  }
  
  console.log(`🎊 Full scrape complete! Scraped ${results.length} records`);
  return results;
}

/**
 * Scrape une page de liste ET toutes les fiches détail associées
 * @param {string} listUrl - URL de la page de liste
 * @param {number} limit - Nombre maximum de fiches à traiter (défaut: 50)
 * @returns {Promise<Object[]>} - Array d'objets contenant les données ou erreurs
 */
export async function scrapeListPageAndDetails(listUrl, limit = 50) {
  // Étape 1: Récupération de tous les liens
  const links = await fetchListLinks(listUrl);
  
  // Limitation du nombre de fiches à traiter
  const slice = links.slice(0, limit);
  const results = [];
  
  // Étape 2: Scraping de chaque fiche individuellement
  for (const u of slice) {
    try {
      const d = await scrapeDetail(u); // Scrape la fiche
      results.push(d);
    } catch (e) {
      // En cas d'erreur, on ajoute l'URL et l'erreur
      results.push({ url: u, error: e?.message || String(e) });
    }
  }

  console.log(`Scraped ${results.length} details from list page.`);
  
  return results;
}