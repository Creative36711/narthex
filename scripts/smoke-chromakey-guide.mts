/**
 * Смоук чемоданной вырезки хромакея + регламент гайдов.
 *
 * Урок кампании «Каркас» (2026-10): старая версия принимала бирюзовые детали
 * (вены, звуковые кольца, патину) за зелёный фон и делала их прозрачными —
 * сквозь иконки состояний просвечивал фон. Теперь ключ строгий (яркий зелёный
 * с доминированием, циан/бирюза — не фон), а у инструмента есть --heal:
 * дырки внутри фигуры со сохранившимся цветом залечиваются обратно.
 *
 * Функциональные тесты требуют Pillow: если `python3 -c "import PIL"` падает,
 * секция печатает SKIP и выходит зелёной (на машинах без Pillow тестируется
 * только документация; в деве ставится через venv).
 */
import { readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs'
import { execFileSync, execSync } from 'node:child_process'

const PY = process.env.CHROMA_SMOKE_PYTHON || 'python3'
const TMP = '/tmp/chroma_smoke'
let failures = 0

function check(name: string, cond: boolean, detail = ''): void {
  if (cond) console.log(`✓ ${name}`)
  else {
    failures += 1
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function py(code: string): string {
  return execFileSync(PY, ['-c', code], { encoding: 'utf-8', env: process.env })
}

// ── 0. наличие утилиты по обоим каноничным путям (чемодан + репозиторий) ─────
for (const p of ['public/ai/cutout-chromakey.py', 'scripts/cutout-chromakey.py']) {
  check(`утилита существует: ${p}`, existsSync(p))
}
check(
  'обе копии утилиты идентичны',
  existsSync('scripts/cutout-chromakey.py') &&
    readFileSync('public/ai/cutout-chromakey.py', 'utf-8') === readFileSync('scripts/cutout-chromakey.py', 'utf-8'),
)

// ── 1. функциональные тесты (только когда есть Pillow) ───────────────────────
const hasPIL = (() => {
  try {
    execSync(`${PY} -c "import PIL"`, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
})()

if (!hasPIL) {
  console.log(`… SKIP функциональных тестов: у интерпретатора [${PY}] нет Pillow (установите python3-pil или задайте CHROMA_SMOKE_PYTHON)`)
} else {
  rmSync(TMP, { recursive: true, force: true })
  mkdirSync(TMP, { recursive: true })

  // фикстура 1: зелёный фон #00FF00; фигура с БИРЮЗОВЫМИ деталями (вражеский урок);
  // внутренняя чисто зелёная полость (легальное отверстие)
  py(`
from PIL import Image, ImageDraw
img = Image.new('RGBA', (100, 100), (0, 255, 0, 255))
d = ImageDraw.Draw(img)
d.rectangle([25, 25, 75, 75], fill=(90, 30, 30, 255))            # тело фигуры
d.ellipse([40, 40, 60, 60], fill=(40, 200, 170, 255))            # бирюзовая вставка (b>=75%*g)
d.line([(30, 30), (70, 70)], fill=(30, 190, 160, 255), width=3)  # бирюзовая «вена»
d.rectangle([62, 30, 68, 36], fill=(0, 255, 0, 255))             # внутренняя зелёная полость (окно)
img.save('${TMP}/src.png')
`)

  execFileSync(PY, ['public/ai/cutout-chromakey.py', `${TMP}/src.png`, `${TMP}/auto.png`, '--mode', 'auto', '--no-crop'])

  const probe = (file: string, points: Array<[number, number]>): Array<[number, number, number, number]> =>
    JSON.parse(py(`
from PIL import Image
import json
px = Image.open('${TMP}/${file}').convert('RGBA').load()
pts = ${JSON.stringify(points)}
print(json.dumps([list(px[x, y]) for x, y in pts]))
`))

  const res = probe('auto.png', [[5, 5], [30, 60], [50, 50], [50, 49], [65, 33]])
  check('зелёный фон угла вырезан', res[0]![3] === 0, `corner=${res[0]}`)
  check('тело фигуры непроницаемо', res[1]![3] === 255, `body=${res[1]}`)
  check('БИРЮЗОВАЯ вставка выжила (урок «Каркаса»)', res[2]![3] === 255, `cyan=${res[2]}`)
  check('бирюзовая «вена» выжила', res[3]![3] === 255, `vein=${res[3]}`)
  check('внутренняя чисто зелёная полость (окно) вырезана', res[4]![3] === 0, `hole=${res[4]}`)

  // фикстура 2: повреждённая старой вырезкой иконка — бирюза прозрачна, цвет сохранён
  py(`
from PIL import Image
img = Image.new('RGBA', (100, 100), (0, 0, 0, 0))
d = __import__('PIL.ImageDraw', fromlist=['Draw']).Draw(img)
d.rectangle([25, 25, 75, 75], fill=(90, 30, 30, 255))
d.ellipse([40, 40, 60, 60], fill=(40, 200, 170, 255))
px = img.load()
for y in range(40, 61):
    for x in range(40, 61):
        r, g, b, a = px[x, y]
        if a:
            px[x, y] = (r, g, b, 0)              # «съеденная» бирюза (старый баг)
for y in range(78, 86):                          # легальное зелёное окно: целевым образом прозрачно
    for x in range(78, 86):
        px[x, y] = (0, 255, 0, 0)
img.save('${TMP}/damaged.png')
`)

  const healOut = execFileSync(PY, ['public/ai/cutout-chromakey.py', '--heal', `${TMP}/damaged.png`, `${TMP}/healed.png`], { encoding: 'utf-8' })
  const h = probe('healed.png', [[50, 50], [30, 30], [80, 80], [5, 5]])
  check('heal возвращает непрозрачность съеденной бирюзе', h[0]![3] === 255 && h[0]![1] === 200, `healed-cyan=${h[0]}`)
  check('heal сохраняет тело фигуры', h[1]![3] === 255, `body=${h[1]}`)
  check('heal не трогает легальное зелёное окно', h[2]![3] === 0, `hole=${h[2]}`)
  check('heal не трогает внешний фон', h[3]![3] === 0, `outside=${h[3]}`)
  check('heal отчитывается статистикой', healOut.includes('восстановлено пикселей'), healOut.trim().slice(0, 120))
}

// ── 2. регламенты гайдов (текстовые якоря) ───────────────────────────────────
const checks: Array<[string, string, string[]]> = [
  ['docs/ai-campaign-guide.md', 'гайд ИИ', ['хромакей', 'cutout-chromakey.py', '#00FF00', 'шахматк', '--heal', 'бирюз']],
  ['public/ai/campaign-guide.md', 'гайд чемодана', ['хромакей', 'cutout-chromakey.py', '#00FF00', '--heal', 'бирюз']],
  ['docs/book/04-visual.md', 'книга мастера', ['cutout-chromakey.py', 'Visual Continuity', '#00FF00']],
]
for (const [path, name, anchors] of checks) {
  const text = existsSync(path) ? readFileSync(path, 'utf-8') : ''
  const missing = anchors.filter((a) => !text.includes(a))
  check(`${name}: якоря ${anchors.join(', ')}`, missing.length === 0, `нет: ${missing.join(', ')}`)
}

// ── 3. аудит советует инструмент (и по имени скрипта, и по пути чемодана) ────
const audit = readFileSync('src/editor/campaignAudit.ts', 'utf-8')
check('campaignAudit.ts советует cutout-chromakey.py при непрозрачных углах', audit.includes('cutout-chromakey.py'))
check('campaignAudit.ts проверяет рамку и атмосферные спрайты', audit.includes('frame') && audit.includes('atmospherics'))

console.log(failures === 0 ? '\nхромакей: все проверки зелёные' : `\n${failures} проверок упали`)
process.exit(failures === 0 ? 0 : 1)
