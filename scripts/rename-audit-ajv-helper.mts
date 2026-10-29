import { readFile, writeFile } from 'node:fs/promises'

const FROM = /\buseKeyword\b/g
const TO = 'keywordRef'
const EXPECTED_REFERENCES = 3

/** Rename Ajv's non-React helper so react-hooks does not misclassify it. */
export function renameAjvHelper(source: string): string {
  let replacements = 0
  const output = source.replace(FROM, () => {
    replacements++
    return TO
  })
  if (replacements !== EXPECTED_REFERENCES) {
    throw new Error(
      `Expected ${EXPECTED_REFERENCES} Ajv useKeyword identifiers, found ${replacements}; ` +
        'review the upstream bundle before updating this transform.',
    )
  }
  return output
}

if (import.meta.main) {
  const target = process.argv[2]
  if (!target) throw new Error('Usage: tsx scripts/rename-audit-ajv-helper.mts <bundle>')
  const source = await readFile(target, 'utf8')
  await writeFile(target, renameAjvHelper(source), 'utf8')
  console.log(`Renamed ${EXPECTED_REFERENCES} non-React Ajv useKeyword references in ${target}.`)
}
