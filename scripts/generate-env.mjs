import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fallbackApiUrl = 'https://caverna-digital-api.vercel.app/api';
const apiUrl = process.env.KAUA_LIPPERT_API_URL || fallbackApiUrl;

const configFile = `window.KAUA_LIPPERT_API_URL = ${JSON.stringify(apiUrl)};
`;

writeFileSync(resolve('env.js'), configFile);
console.log(`Web environment generated with KAUA_LIPPERT_API_URL=${apiUrl}`);
