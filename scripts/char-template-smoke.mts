import { existsSync, readFileSync } from 'node:fs'
import {
  charChoiceProblems,
  charCreationTemplateFindings,
  newCharChoice,
  skillPointsUsed,
  statPointsUsed,
  withCalling,
  withProfession,
} from '../src/core/charcreate'
import { buildAiTaskBrief, buildAiTaskPrompt } from '../src/editor/aiTask'
import type { CampaignMeta, CharCreationDef, NpcDef, ProfessionDef, CallingDef } from '../src/shared/types'

let failed = 0
function check(label: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${label}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}

// Зафиксированный контрпример из загруженного .chronicle: исходные presets
// тратят 57/52/54 из 35 статов и 140–155 из 80 очков навыков.
const professions: ProfessionDef[] = [
  {
    id: 'profession_constable', label: 'Бывший констебль',
    stats: { STR: 11, CON: 11, SIZ: 11, DEX: 11, INT: 13, POW: 11, CHA: 10 },
    skill_bonus: { observation: 10, insight: 5 },
  },
  {
    id: 'profession_academic', label: 'Архивист-любитель',
    stats: { STR: 8, CON: 9, SIZ: 10, DEX: 10, INT: 15, POW: 12, CHA: 9 },
    skill_bonus: { forensics: 10, chemistry: 10 },
  },
  {
    id: 'profession_dockworker', label: 'Портовый вышибала',
    stats: { STR: 13, CON: 12, SIZ: 12, DEX: 11, INT: 9, POW: 10, CHA: 8 },
    skill_bonus: { brawl: 10, stealth: 5 },
  },
]
const callings: CallingDef[] = [
  {
    id: 'calling_observer', label: 'Наблюдатель',
    skills: { observation: 55, forensics: 40, insight: 40, persuade: 30, chemistry: 20, occult: 15, stealth: 20, lockpicking: 20, dodge: 30, brawl: 20 },
  },
  {
    id: 'calling_chemist', label: 'Химик-криминалист',
    skills: { chemistry: 55, forensics: 45, observation: 40, occult: 25, persuade: 25, insight: 30, stealth: 15, lockpicking: 20, dodge: 25, brawl: 15 },
  },
  {
    id: 'calling_interrogator', label: 'Дознаватель',
    skills: { persuade: 55, insight: 50, observation: 40, forensics: 25, occult: 20, chemistry: 15, stealth: 20, lockpicking: 15, dodge: 30, brawl: 25 },
  },
]
const creation: CharCreationDef = {
  total_points: 35,
  stat_limits: { min: 3, max: 18 },
  skill_points: 80,
  skill_cap: 75,
  skill_floor: 10,
  mandatory_skills: ['observation', 'persuade'],
  professions,
  callings,
}
const meta = { skills: [] } as unknown as CampaignMeta
const npc = { label: 'Сыщик', skills: {} } as NpcDef

const findings = charCreationTemplateFindings(creation)
check('аудит находит все 3 неверных происхождения и все 9 сочетаний призваний', findings.length === 12, `найдено ${findings.length}`)
check('аудит показывает перерасход характеристик на 22 очка', findings.some((f) => f.includes('Бывший констебль') && f.includes('перерасход 22')))
check('аудит учитывает бесплатные бонусы профессии для навыков', findings.some((f) => f.includes('Бывший констебль') && f.includes('Наблюдатель') && f.includes('перерасход 65')))

const first = newCharChoice(creation, npc, meta)
check('стартовый шаблон автоматически тратит ровно оба бюджета',
  statPointsUsed(creation, first) === creation.total_points && skillPointsUsed(creation, first) === creation.skill_points)
check('стартовый шаблон после нормализации можно запустить', charChoiceProblems(creation, first).length === 0, charChoiceProblems(creation, first).join('; '))

let combinations = 0
let exact = true
for (const profession of professions) {
  const withOrigin = withProfession(creation, first, profession.id)
  for (const calling of callings) {
    const choice = withCalling(creation, withOrigin, calling.id)
    combinations++
    if (statPointsUsed(creation, choice) !== creation.total_points || skillPointsUsed(creation, choice) !== creation.skill_points || charChoiceProblems(creation, choice).length) {
      exact = false
      console.error(`  неверно: ${profession.label} / ${calling.label}: stats=${statPointsUsed(creation, choice)}, skills=${skillPointsUsed(creation, choice)}, ${charChoiceProblems(creation, choice).join('; ')}`)
    }
  }
}
check('все 9 сочетаний происхождения и призвания соответствуют точным бюджетам', exact, `${combinations} сочетаний`)
const forbiddenBonusCreation = { ...creation, forbidden_skills: ['observation'] }
const freeBonusChoice = newCharChoice(forbiddenBonusCreation, npc, meta)
check('бесплатный бонус происхождения к запрещённому навыку не считается покупкой',
  skillPointsUsed(forbiddenBonusCreation, freeBonusChoice) === forbiddenBonusCreation.skill_points
    && !charChoiceProblems(forbiddenBonusCreation, freeBonusChoice).some((p) => p.includes('нельзя')))

// Второй образец из локального backlog «Тишина Орфея»: характеристики точны,
// но исходные призвания недорасходуют 10–30 из 40 очков в разных сочетаниях.
// Сам backlog в репозиторий не входит — без него блок пропускается.
const backlogPath = '_backlog/campaign.json'
if (!existsSync(backlogPath)) {
  console.log(`INFO  ${backlogPath} нет — образец «Тишины Орфея» пропущен`)
} else {
const monolith = JSON.parse(readFileSync(backlogPath, 'utf8')) as { campaign: CampaignMeta & { char_creation: CharCreationDef } }
const tishina = monolith.campaign
const tishinaCreation = tishina.char_creation
const tishinaFindings = charCreationTemplateFindings(tishinaCreation)
check('backlog «Тишина Орфея»: аудит видит 9 недорасходов призваний и не ругает характеристики',
  tishinaFindings.length === 9 && tishinaFindings.every((f) => f.includes('не хватает')),
  `найдено ${tishinaFindings.length}`)
const tishinaNpc = { label: 'Герой', skills: {} } as NpcDef
let tishinaExact = true
for (const profession of tishinaCreation.professions ?? []) {
  const origin = withProfession(tishinaCreation, newCharChoice(tishinaCreation, tishinaNpc, tishina), profession.id)
  for (const calling of tishinaCreation.callings ?? []) {
    const choice = withCalling(tishinaCreation, origin, calling.id)
    if (statPointsUsed(tishinaCreation, choice) !== tishinaCreation.total_points
      || skillPointsUsed(tishinaCreation, choice) !== tishinaCreation.skill_points
      || charChoiceProblems(tishinaCreation, choice).length) tishinaExact = false
  }
}
check('backlog «Тишина Орфея»: все 9 сочетаний после подгонки расходуют ровно 45/40 очков', tishinaExact)
}

const omittedBrief = buildAiTaskBrief({ mode: 'new' })
check('по умолчанию бриф не навязывает жанр, масштаб, акценты или боёвку',
  !/Жанр\/сеттинг:|Тон:|Масштаб:|Акценты:|баланс боёвки|акцент на боёвку|акцент на диалоги/.test(omittedBrief))
const requestedBattle = buildAiTaskBrief({ mode: 'new', battle: 10 })
check('соотношение добавляется в задачу только после явного выбора', /акцент на диалоги/i.test(requestedBattle) && !omittedBrief.includes('боёв'))
const prompt = buildAiTaskPrompt('new', omittedBrief, '123', '')
check('системная инструкция явно оставляет пропущенные настройки необязательными', prompt.includes('Настройки брифа необязательны'))
check('задание требует точного расхода бюджета для каждой пары шаблонов', prompt.includes('ровно skill_points для каждого происхождения'))

console.log(failed ? `FAILED: ${failed}` : 'ALL GREEN')
if (failed) process.exitCode = 1
