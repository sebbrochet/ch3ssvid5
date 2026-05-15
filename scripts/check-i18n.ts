/**
 * Checks that all i18n translation files have the same keys as en.json (reference).
 * Reports missing and extra keys per locale. Exits with code 1 on mismatch.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const I18N_DIR = join(import.meta.dirname, '..', 'src', 'i18n');
const REFERENCE = 'en.json';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return flattenKeys(value as Record<string, unknown>, path);
    }
    return [path];
  });
}

const refPath = join(I18N_DIR, REFERENCE);
const refKeys = new Set(flattenKeys(JSON.parse(readFileSync(refPath, 'utf-8'))));

const localeFiles = readdirSync(I18N_DIR)
  .filter((f) => f.endsWith('.json') && f !== REFERENCE)
  .sort();

let hasErrors = false;

for (const file of localeFiles) {
  const filePath = join(I18N_DIR, file);
  const localeKeys = new Set(flattenKeys(JSON.parse(readFileSync(filePath, 'utf-8'))));

  const missing = [...refKeys].filter((k) => !localeKeys.has(k));
  const extra = [...localeKeys].filter((k) => !refKeys.has(k));

  if (missing.length > 0 || extra.length > 0) {
    hasErrors = true;
    console.error(`\n❌ ${basename(file)}:`);
    for (const k of missing) console.error(`  missing: ${k}`);
    for (const k of extra) console.error(`  extra:   ${k}`);
  } else {
    console.log(`✅ ${basename(file)}`);
  }
}

if (hasErrors) {
  console.error('\nTranslation files are out of sync with en.json. Fix the keys above.');
  process.exit(1);
} else {
  console.log('\nAll translation files are aligned with en.json.');
}
