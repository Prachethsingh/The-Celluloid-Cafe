import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let directory = path.dirname(fileURLToPath(import.meta.url));
while (!fs.existsSync(path.join(directory, 'packages/vega-providers/manifest.json'))) {
  const parent = path.dirname(directory);
  if (parent === directory) throw new Error('Cannot locate the vendored Vega packages');
  directory = parent;
}

export const repositoryRoot = directory;
export const providerSourceDirectory = path.join(directory, 'packages/vega-providers');
export const providerBuildDirectory = path.join(directory, '.build/vega-providers');
export const appBuildDirectory = path.join(directory, '.build/vega-app');
