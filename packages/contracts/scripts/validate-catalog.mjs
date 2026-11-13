import { catalog, validateCatalog } from '../dist/index.js';
import process from 'node:process';

const errors = validateCatalog(catalog);
if (errors.length) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Catalog valid: ${catalog.length} unique games\n`);
}
