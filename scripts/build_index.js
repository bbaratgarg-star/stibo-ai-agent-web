/**
 * Build enrichment index from Products_Hierarchy.xlsx
 * Output: data/enrichment.json  (productId -> { categories, supplier })
 */
const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../../stibo_data/Products_Hierarchy.xlsx');
const OUT  = path.join(__dirname, '../data/enrichment.json');

console.log('Reading Products_Hierarchy.xlsx...');
const wb    = XLSX.readFile(FILE);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows  = XLSX.utils.sheet_to_json(sheet);

console.log(`Processing ${rows.length} rows...`);

const enrichment = {};

for (const row of rows) {
    const id = row['Product ID'];
    if (!id) continue;

    // Collect non-empty category levels
    const categories = [
        row['Level 1 Category'],
        row['Level 2 Category'],
        row['Level 3 Category'],
        row['Level 4 Category'],
        row['Level 5 Category'],
        row['Level 6 Category'],
    ].filter(c => c && String(c).trim() !== '');

    const supplier = row['Supplier'] ? String(row['Supplier']).trim() : '';

    enrichment[id] = { categories, supplier };
}

fs.writeFileSync(OUT, JSON.stringify(enrichment, null, 2));
console.log(`✅ Written ${Object.keys(enrichment).length} entries to data/enrichment.json`);
