const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
async function main() {
  const output = path.join(root, '.build/catalog');
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'catalog.json'), '[]');
  console.log('Prepared an empty initial catalog; live titles are synchronized from Cinemeta when the API starts.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
