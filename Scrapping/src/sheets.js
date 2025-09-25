// Import conditionnel pour éviter les crashes
let google;
try {
  const googleapis = await import('googleapis');
  google = googleapis.google;
  console.log('✅ Google APIs loaded successfully');
} catch (error) {
  console.warn('⚠️ Google APIs not available:', error.message);
  google = null;
}

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getCredentials() {
  // Méthode 1: Essayer la variable d'environnement JSON
  const envJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (envJson) {
    try {
      return JSON.parse(envJson);
    } catch (error) {
      console.error('Erreur parsing GOOGLE_SERVICE_ACCOUNT_JSON:', error.message);
    }
  }
  
  // Méthode 2: Essayer le fichier de credentials
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './credentials/service-account.json';
  try {
    const credentialsFile = await fs.readFile(credentialsPath, 'utf8');
    return JSON.parse(credentialsFile);
  } catch (error) {
    console.error('Erreur lecture fichier credentials:', error.message);
  }
  
  // Méthode 3: Essayer le chemin relatif depuis le script
  try {
    const relativePath = path.join(process.cwd(), 'credentials', 'service-account.json');
    const credentialsFile = await fs.readFile(relativePath, 'utf8');
    return JSON.parse(credentialsFile);
  } catch (error) {
    console.error('Erreur lecture fichier relatif:', error.message);
  }
  
  return null;
}

export async function getSheetsClient(scopes = ['https://www.googleapis.com/auth/spreadsheets']) {
  const creds = await getCredentials();
  if (!creds) {
    throw new Error('Impossible de charger les credentials Google. Vérifiez:\n' +
      '1. Le fichier credentials/service-account.json existe\n' +
      '2. Ou la variable GOOGLE_SERVICE_ACCOUNT_JSON dans .env\n' +
      '3. Ou la variable GOOGLE_APPLICATION_CREDENTIALS dans .env');
  }
  
  console.log('✅ Credentials Google chargés avec succès');
  const auth = new google.auth.GoogleAuth({ credentials: creds, scopes });
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

export async function appendRows({ spreadsheetId, range, values }) {
  // Fallback si Google APIs n'est pas disponible
  if (!google) {
    console.log('📊 MOCK: Google Sheets export (googleapis not available)');
    return {
      success: true,
      updatedRows: values?.length || 0,
      spreadsheetId,
      range,
      mode: 'mock'
    };
  }

  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values },
    });
    return res.data;
  } catch (error) {
    console.error('❌ Error in Google Sheets export:', error.message);
    // Fallback en cas d'erreur
    return {
      success: false,
      error: error.message,
      spreadsheetId,
      range,
      mode: 'error'
    };
  }
}
