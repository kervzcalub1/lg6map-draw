// scripts/inject-env.js
const fs = require('fs');
const path = require('path');

const outDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const key = process.env.GOOGLE_MAPS_API_KEY || '';

const content = `// This file is generated at build time. Do NOT commit your actual API key.
window.__MAPS_API_KEY = ${JSON.stringify(key)};
`;

fs.writeFileSync(path.join(outDir, 'config.js'), content, 'utf8');
console.log('Wrote public/config.js (length=' + content.length + ')');
