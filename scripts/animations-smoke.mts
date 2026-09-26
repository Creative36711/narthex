import { readFileSync } from 'node:fs'
let failed = 0
const check = (name: string, ok: boolean) => { console.log(`${ok ? '✓' : '✗'} ${name}`); if (!ok) failed++ }
const css = readFileSync('src/index.css', 'utf8')
const settings = readFileSync('src/shared/settings.ts', 'utf8')
const panel = readFileSync('src/shared/SettingsPanel.tsx', 'utf8')
for (const token of ['--dur-fast: 120ms', '--dur: 220ms', '--dur-slow: 450ms', '--ease:', '--ease-out:']) check(`Токен ${token.split(':')[0]} объявлен`, css.includes(token))
for (const keyframe of ['cf-fade-in', 'cf-fade-out', 'cf-rise-in', 'cf-pop-in', 'cf-flash-red', 'cf-float-up', 'cf-shake', 'cf-bar-ghost']) check(`Кейфрейм ${keyframe} объявлен`, css.includes(`@keyframes ${keyframe}`))
check('Учитывается системное снижение движения', css.includes('prefers-reduced-motion: reduce'))
check('Есть класс ручного отключения анимаций', css.includes('html.no-anim'))
check('Настройка анимаций сохраняется', settings.includes('animations: boolean') && settings.includes('animations: true'))
check('Настройка видна в панели параметров', panel.includes('label="Анимации"'))
console.log(failed ? `ПРОВАЛЕНО: ${failed}` : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
