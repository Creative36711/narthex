/**
 * Озвучка диалогов кампании локальным Piper (итерация 8, блок G).
 *
 * Запуск:
 *   npx tsx scripts/voice-gen.mts [путь-к-кампании] [--voice irina] [--model путь.onnx] [--force]
 *
 * По умолчанию — public/campaigns/ash-of-caerden. Скрипт обходит все
 * dialogues/*.dlg.json, читает реплики без файла озвучки, генерирует wav через
 * piper CLI, конвертирует в ogg (ffmpeg) и кладёт в assets/voice/, прописывая
 * `voice` в реплику; .ink перегенерируется. Повторный запуск добавляет только
 * недостающее («--force» — перегенерировать всё).
 *
 * Если piper не установлен — печатает инструкцию и выходит с кодом 2.
 * Русские голоса: irina, dmitri, denis, ruslan (rhasspy/piper-voices).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateInk, migrateDlgDoc, type DlgDoc, type DlgStep } from '../src/editor/dialogueDoc'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// ── аргументы ──
const args = process.argv.slice(2)
const flag = (name: string): boolean => args.includes(`--${name}`)
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined
}
const positional = args.filter((a) => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true)
const campaignDir = join(root, positional[0] ?? 'public/campaigns/ash-of-caerden')
const voice = opt('voice') ?? process.env.PIPER_VOICE ?? 'irina'
const force = flag('force')

const PIPER_HELP = `
Установите Piper (MIT, бесплатно) и русскую модель:

  1) сам piper — бинарник с https://github.com/rhasspy/piper/releases
     (положите \`piper\` в PATH или укажите PIPER_BIN=/путь/к/piper);
  2) голос (ru) — например irina:
     huggingface.co/rhasspy/piper-voices → ru/ru_RU/irina/medium/
     ru_RU-irina-medium.onnx (+ .onnx.json) — например в ~/piper-voices/;
     другие русские голоса: dmitri, denis, ruslan.
  3) ffmpeg — для конвертации wav → ogg (без него останутся wav-файлы).

Пример:
  PIPER_BIN=piper PIPER_MODEL=~/piper-voices/ru/ru_RU/irina/medium/ru_RU-irina-medium.onnx \\
    npx tsx scripts/voice-gen.mts public/campaigns/ash-of-caerden --voice irina
`

function fail(msg: string): never {
  console.error(msg)
  process.exit(2)
}

const piperBin = process.env.PIPER_BIN ?? 'piper'
const piperOk = spawnSync(piperBin, ['--help'], { encoding: 'utf8' })
if (piperOk.error || (piperOk.status !== 0 && piperOk.status !== 1 && !piperOk.stdout && !piperOk.stderr)) {
  fail(`Piper не найден (команда «${piperBin}»).\n${PIPER_HELP}`)
}

// модель: --model / PIPER_MODEL / стандартное расположение ~/piper-voices
const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
const modelPath =
  opt('model') ??
  process.env.PIPER_MODEL ??
  join(home, 'piper-voices', 'ru', 'ru_RU', voice, 'medium', `ru_RU-${voice}-medium.onnx`)
if (!existsSync(modelPath)) {
  fail(`Модель Piper не найдена: ${modelPath}\n${PIPER_HELP}`)
}

const ffmpegOk = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' })
const hasFfmpeg = !ffmpegOk.error

if (!existsSync(campaignDir)) fail(`Кампания не найдена: ${campaignDir}`)
const dlgDir = join(campaignDir, 'dialogues')
const voiceDir = join(campaignDir, 'assets', 'voice')
mkdirSync(voiceDir, { recursive: true })

/** текст реплики для чтения: без токенов, ремарок и ёлочек */
function ttsText(text: string): string {
  return text
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\*[^*]*\*/g, ' ')
    .replace(/[«»"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function say(text: string, outBase: string): string | null {
  const wav = join(voiceDir, `${outBase}.wav`)
  const ogg = join(voiceDir, `${outBase}.ogg`)
  const res = spawnSync(piperBin, ['--model', modelPath, '--output_file', wav], {
    input: text,
    encoding: 'utf8',
  })
  if (res.error || !existsSync(wav)) {
    console.warn(`  ✗ не удалось синтезировать: «${text.slice(0, 40)}…» (${res.error ?? res.stderr ?? ''})`)
    return null
  }
  if (!hasFfmpeg) return `assets/voice/${outBase}.wav`
  const cv = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libvorbis', ogg], { encoding: 'utf8' })
  if (cv.error || !existsSync(ogg)) {
    console.warn(`  ✗ ffmpeg не смог сконвертировать ${basename(wav)} — оставляю wav`)
    return `assets/voice/${outBase}.wav`
  }
  return `assets/voice/${outBase}.ogg`
}

function walkSteps(steps: DlgStep[], out: DlgStep[]): void {
  for (const st of steps) out.push(st)
}

function allLineSteps(doc: DlgDoc): DlgStep[] {
  const out: DlgStep[] = []
  for (const node of doc.nodes) {
    for (const sec of node.sections) {
      walkSteps(sec.steps, out)
      if (sec.else_steps) walkSteps(sec.else_steps, out)
    }
    for (const c of node.choices) {
      for (const sec of c.sections) {
        walkSteps(sec.steps, out)
        if (sec.else_steps) walkSteps(sec.else_steps, out)
      }
      if (c.check) {
        for (const side of [c.check.success, c.check.fail]) {
          for (const sec of side.sections ?? []) {
            walkSteps(sec.steps, out)
            if (sec.else_steps) walkSteps(sec.else_steps, out)
          }
        }
      }
    }
  }
  return out
}

const files = readdirSync(dlgDir).filter((f) => f.endsWith('.dlg.json')).sort()
if (!files.length) fail(`В ${dlgDir} нет ни одного .dlg.json`)

console.log(`Кампания: ${campaignDir}`)
console.log(`Голос: ${voice} (${modelPath})`)
console.log(hasFfmpeg ? 'Конвертация wav → ogg: ffmpeg' : '⚠ ffmpeg не найден — останутся wav-файлы')

let made = 0
let skipped = 0
for (const f of files) {
  const key = f.replace(/\.dlg\.json$/, '')
  const dlgPath = join(dlgDir, f)
  const doc = migrateDlgDoc(JSON.parse(readFileSync(dlgPath, 'utf8')))
  let n = 0
  let changed = false
  for (const step of allLineSteps(doc)) {
    if (step.kind !== 'line' || step.line.action) continue
    n++
    const text = ttsText(step.line.text)
    if (!text) continue
    if (step.line.voice && !force) {
      skipped++
      continue
    }
    const base = `${key}_${String(n).padStart(2, '0')}`
    process.stdout.write(`  ${key} #${n}: «${text.slice(0, 48)}${text.length > 48 ? '…' : ''}» `)
    const rel = say(text, base)
    if (rel) {
      step.line.voice = rel
      changed = true
      made++
      console.log(`→ ${rel}`)
    }
  }
  if (changed) {
    writeFileSync(dlgPath, JSON.stringify(doc, null, 2) + '\n')
    writeFileSync(join(dlgDir, `${key}.ink`), generateInk(doc))
    console.log(`  сохранено: ${f} + ${key}.ink`)
  }
}

console.log(`\nГотово: озвучено ${made}, пропущено (уже есть файл) ${skipped}.`)
if (!hasFfmpeg) console.log('Совет: поставьте ffmpeg — файлы будут компактнее (ogg).')
if (made === 0 && skipped > 0) console.log('Все реплики уже озвучены. Для перегенерации — с флагом --force.')
