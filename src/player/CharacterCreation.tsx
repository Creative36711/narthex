import { useState } from 'react'
import { Ico } from '../shared/icons'
import type { CampaignData, NpcDef } from '../shared/types'
import {
  allSkillIds,
  charChoiceProblems,
  derivedFromChoice,
  newCharChoice,
  rollStat,
  rollStatSet,
  skillMinVal,
  skillPointsUsed,
  statPointsUsed,
  STAT_KEYS,
  withCalling,
  withProfession,
  type CharChoice,
} from '../core/charcreate'
import { skillLabel } from '../shared/skills'

/** русское имя характеристики для подсказок */
const STAT_LABELS: Record<string, string> = {
  STR: 'Сила',
  CON: 'Телосложение',
  SIZ: 'Размер',
  DEX: 'Ловкость',
  INT: 'Интеллект',
  POW: 'Сила воли',
  CHA: 'Обаяние',
}

/**
 * Экран создания персонажа (блок 11 ТЗ «Гибкий движок»).
 * Происхождения, призвания, пороги и бюджеты целиком настраиваются в редакторе;
 * игрок выбирает происхождение и призвание и докручивает очки под себя.
 */
export function CharacterCreation({
  campaign,
  onBack,
  onStart,
}: {
  campaign: CampaignData
  onBack: () => void
  onStart: (choice: CharChoice) => void
}) {
  const creation = campaign.meta.char_creation!
  const template = campaign.entities[campaign.meta.default_player] as NpcDef
  const rollCfg = creation.roll
  // режим кубиков (аудит §5.6 п.5): наборы, выбранный, перебросы, перераспределение
  const [sets, setSets] = useState<Record<string, number>[]>(() =>
    rollCfg ? Array.from({ length: Math.max(1, rollCfg.arrays ?? 1) }, () => rollStatSet(creation)) : [],
  )
  const [pickedSet, setPickedSet] = useState(0)
  const [rerollsLeft, setRerollsLeft] = useState(rollCfg?.rerolls ?? 0)
  const [redSpent, setRedSpent] = useState(0)
  const [choice, setChoice] = useState<CharChoice>(() => {
    const base = newCharChoice(creation, template, campaign.meta)
    return rollCfg ? { ...base, stats: { ...(sets[0] ?? base.stats) } } : base
  })

  const { min, max } = creation.stat_limits
  const statLeft = creation.total_points - statPointsUsed(creation, choice)
  const redTotal = rollCfg?.redistribute ?? 0

  /** перебросить все наборы целиком */
  const rerollAll = () => {
    const next = Array.from({ length: Math.max(1, rollCfg?.arrays ?? 1) }, () => rollStatSet(creation))
    setSets(next)
    setPickedSet(0)
    setRerollsLeft(rollCfg?.rerolls ?? 0)
    setRedSpent(0)
    setChoice({ ...choice, stats: { ...next[0] } })
  }

  /** выбрать один из брошенных наборов */
  const pickSet = (i: number) => {
    if (!sets[i]) return
    setPickedSet(i)
    setRerollsLeft(rollCfg?.rerolls ?? 0)
    setRedSpent(0)
    setChoice({ ...choice, stats: { ...sets[i] } })
  }

  /** переброс одной характеристики (тратит переброс) */
  const rerollOne = (k: string) => {
    if (rerollsLeft <= 0) return
    setRerollsLeft(rerollsLeft - 1)
    setChoice({ ...choice, stats: { ...choice.stats, [k]: rollStat(creation, k) } })
  }
  const skillsOn = creation.skill_points !== undefined
  const skillLeft = skillsOn ? creation.skill_points! - skillPointsUsed(creation, choice) : 0
  const problems = charChoiceProblems(creation, choice, campaign.meta.skills)
  const derived = derivedFromChoice(choice)
  const professions = creation.professions ?? []

  // навыки: реестр кампании + навыки шаблона, по алфавиту
  const skillList = (() => {
    const seen = new Set<string>()
    const out: Array<{ id: string; label: string }> = []
    for (const s of [...allSkillIds(campaign.meta), ...Object.keys(template.skills).map((id) => ({ id, label: skillLabel(id, campaign.meta.skills) }))]) {
      if (seen.has(s.id)) continue
      seen.add(s.id)
      out.push(s)
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  })()
  const forbidden = new Set(creation.forbidden_skills ?? [])
  const mandatory = new Set(creation.mandatory_skills ?? [])

  return (
    <div className="char-create">
      <div className="char-create-inner panel">
        <div className="panel-header">
          <h2><Ico n="user" />  Создание персонажа</h2>
          <button className="btn btn-small" onClick={onBack}><Ico n="close" /> </button>
        </div>

        {(creation.choose_name || creation.choose_age || creation.choose_bio) && (
          <div className="props-group">
            <h4>Герой</h4>
            {creation.choose_name && (
              <input
                className="char-name"
                value={choice.name}
                maxLength={40}
                placeholder={template.label}
                onChange={(e) => setChoice({ ...choice, name: e.target.value })}
              />
            )}
            {creation.choose_age && (
              <label className="fld char-age" style={{ marginTop: creation.choose_name ? 8 : 0 }}>
                <span>Возраст</span>
                <input
                  type="number"
                  min={14}
                  max={120}
                  value={choice.age ?? ''}
                  placeholder="например 28"
                  onChange={(e) => setChoice({ ...choice, age: Number(e.target.value) || undefined })}
                />
              </label>
            )}
            {creation.choose_bio && (
              <label className="fld fld-block" style={{ marginTop: 8 }}>
                <span>Биография (коротко — кто вы и откуда)</span>
                <textarea
                  rows={3}
                  maxLength={600}
                  value={choice.bio ?? ''}
                  placeholder="Пара строк о жизни до того, как началась эта история…"
                  onChange={(e) => setChoice({ ...choice, bio: e.target.value || undefined })}
                />
              </label>
            )}
          </div>
        )}

        {professions.length > 0 && (
          <div className="props-group">
            <h4>Происхождение</h4>
            <div className="muted small" style={{ marginBottom: 6 }}>
              Выберите путь героя: происхождение задаёт стартовые характеристики
              и навыки — потом их можно подстроить под себя.
            </div>
            <div className="char-professions">
              {professions.map((p) => (
                <button
                  key={p.id}
                  className={`char-prof-card ${choice.profession === p.id ? 'sel' : ''}`}
                  onClick={() => setChoice(withProfession(creation, choice, p.id))}
                >
                  <div className="char-prof-label">{p.label}</div>
                  {p.description && <div className="muted small">{p.description}</div>}
                  <div className="char-prof-bonus small">
                    {Object.entries(p.skill_bonus).length
                      ? Object.entries(p.skill_bonus).map(([id, v]) => `+${v} ${skillLabel(id, campaign.meta.skills)}`).join(' · ')
                      : 'без бонусов к навыкам'}
                  </div>
                  {p.items?.length ? (
                    <div className="muted small">
                      Снаряжение: {p.items.map((it) => `${campaign.entities[it.item]?.label ?? it.item}${it.quantity > 1 ? ` ×${it.quantity}` : ''}`).join(', ')}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        )}

        {(creation.callings ?? []).length > 0 && (
          <div className="props-group">
            <h4>Призвание</h4>
            <div className="muted small" style={{ marginBottom: 6 }}>
              Призвание задаёт стартовые навыки героя — их тоже можно подстроить ниже.
            </div>
            <div className="char-professions">
              {(creation.callings ?? []).map((c) => (
                <button
                  key={c.id}
                  className={`char-prof-card ${choice.calling === c.id ? 'sel' : ''}`}
                  onClick={() => setChoice(withCalling(creation, choice, c.id))}
                >
                  <div className="char-prof-label">{c.label}</div>
                  {c.description && <div className="muted small">{c.description}</div>}
                  <div className="char-prof-bonus small">
                    {Object.entries(c.skills).length
                      ? Object.entries(c.skills)
                          .map(([id, v]) => `${skillLabel(id, campaign.meta.skills)} ${v}%`)
                          .sort((a, b) => a.localeCompare(b, 'ru'))
                          .join(' · ')
                      : 'без навыков'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="props-group">
          <h4>Характеристики</h4>
          {rollCfg ? (
            <>
              <div className="char-budget ok">
                Характеристики бросаются кубиками
                {rollCfg.per_stat && Object.keys(rollCfg.per_stat).length > 0 && (
                  <>: {STAT_KEYS.map((k) => `${k} ${rollCfg.per_stat?.[k] ?? rollCfg.notation ?? '3d6'}`).join(' · ')}</>
                )}
                {!(rollCfg.per_stat && Object.keys(rollCfg.per_stat).length > 0) && <> ({rollCfg.notation ?? '3d6'})</>}
                · пороги {min}–{max}
              </div>
              {sets.length > 1 && (
                <div className="char-professions" style={{ marginBottom: 8 }}>
                  {sets.map((s, i) => (
                    <button
                      key={i}
                      className={`char-prof-card ${pickedSet === i ? 'sel' : ''}`}
                      onClick={() => pickSet(i)}
                    >
                      <div className="char-prof-label">Набор {i + 1}</div>
                      <div className="muted small">
                        {STAT_KEYS.map((k) => `${k} ${s[k]}`).join(' · ')}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="char-roll-actions" style={{ marginBottom: 8 }}>
                <button className="btn btn-small" onClick={rerollAll}>
                  <Ico n="dice" />  Бросить заново
                </button>
                {rerollsLeft > 0 && (
                  <span className="muted small">Перебросов отдельных характеристик: {rerollsLeft} (кнопка кубика у значения)</span>
                )}
                {redTotal > 0 && (
                  <span className="muted small">Очков перераспределения: {redTotal - redSpent} из {redTotal} (кнопки − и + переливают очки)</span>
                )}
              </div>
            </>
          ) : (
            <div className={`char-budget ${statLeft > 0 ? 'warn' : 'ok'}`}>
              Свободных очков характеристик: <b>{statLeft}</b> из {creation.total_points} · пороги {min}–{max}
              {statLeft > 0 && (
                <div className="char-budget-warn">
                  В бой с {statLeft} нераспределёнными очками? Это хардкор — герой будет заметно слабее.
                </div>
              )}
            </div>
          )}
          <div className="char-stats">
            {STAT_KEYS.map((k) => (
              <div key={k} className="char-stat-row">
                <span className="char-stat-key" data-tip={`${k} — ${STAT_LABELS[k]}`}>{k}</span>
                <button
                  className="btn btn-small"
                  disabled={
                    rollCfg
                      ? redSpent <= 0 || (choice.stats[k] ?? min) <= min
                      : (choice.stats[k] ?? min) <= min
                  }
                  onClick={() => {
                    if (rollCfg) setRedSpent(redSpent - 1)
                    setChoice({ ...choice, stats: { ...choice.stats, [k]: (choice.stats[k] ?? min) - 1 } })
                  }}
                >
                  −
                </button>
                <span className="char-stat-val">{choice.stats[k] ?? min}</span>
                <button
                  className="btn btn-small"
                  disabled={
                    rollCfg
                      ? redSpent >= redTotal || (choice.stats[k] ?? min) >= max
                      : statLeft <= 0 || (choice.stats[k] ?? min) >= max
                  }
                  onClick={() => {
                    if (rollCfg) setRedSpent(redSpent + 1)
                    setChoice({ ...choice, stats: { ...choice.stats, [k]: (choice.stats[k] ?? min) + 1 } })
                  }}
                >
                  +
                </button>
                {rollCfg && rerollsLeft > 0 && (
                  <button
                    className="btn btn-small"
                    data-tip="Перебросить эту характеристику"
                    onClick={() => rerollOne(k)}
                  >
                    <Ico n="dice" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="muted small">
            Здоровье: <b>{derived.hp}</b> · Магия: <b>{derived.mp}</b>
          </div>
        </div>

        {skillsOn && (
          <div className="props-group">
            <h4>Навыки</h4>
            <div className={`char-budget ${skillLeft > 0 ? 'warn' : 'ok'}`}>
              Свободных очков навыков: <b>{skillLeft}</b> из {creation.skill_points} · пороги {creation.skill_floor ?? 0}–{creation.skill_cap ?? 'без предела'}
              {skillLeft > 0 && (
                <div className="char-budget-warn">
                  {skillLeft} очк. навыков не потрачено — старт будет сложнее (хардкор). Лучше вложить всё.
                </div>
              )}
            </div>
            <div className="char-skills">
              {skillList.map((s) => {
                const v = choice.skills[s.id] ?? 0
                const isForbidden = forbidden.has(s.id)
                const floor = skillMinVal(creation, choice, s.id)
                const cap = creation.skill_cap
                return (
                  <div key={s.id} className={`char-skill-row ${isForbidden ? 'char-skill-forbidden' : ''}`} data-tip={isForbidden ? 'Этот навык покупать нельзя' : undefined}>
                    <span className="char-skill-name">
                      {s.label}
                      {mandatory.has(s.id) && <span className="muted">*</span>}
                    </span>
                    <button
                      className="btn btn-small"
                      disabled={isForbidden || v <= floor}
                      onClick={() => setChoice({ ...choice, skills: { ...choice.skills, [s.id]: v - 1 } })}
                    >
                      −
                    </button>
                    <span className="char-stat-val">{v}%</span>
                    <button
                      className="btn btn-small"
                      disabled={isForbidden || skillLeft <= 0 || (cap !== undefined && v >= cap)}
                      onClick={() => setChoice({ ...choice, skills: { ...choice.skills, [s.id]: v + 1 } })}
                    >
                      +
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="muted small">* — обязательный навык (начинается с 25%).</div>
          </div>
        )}

        {problems.length > 0 && (
          <ul className="char-problems">
            {problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        )}

        <div className="char-create-foot">
          <button className="btn" onClick={onBack}>Назад</button>
          <button className="btn btn-primary" disabled={problems.length > 0} onClick={() => onStart(choice)}>
            Начать забег
          </button>
        </div>
      </div>
    </div>
  )
}
