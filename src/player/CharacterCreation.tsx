import { useState } from 'react'
import { Ico } from '../shared/icons'
import type { CampaignData, NpcDef } from '../shared/types'
import {
  allSkillIds,
  charChoiceProblems,
  derivedFromChoice,
  newCharChoice,
  skillPointsUsed,
  statPointsUsed,
  STAT_KEYS,
  type CharChoice,
} from '../core/charcreate'
import { skillLabel } from '../shared/skills'

/**
 * Экран создания персонажа (блок 11 ТЗ «Гибкий движок»):
 * имя, распределение характеристик, профессия, покупка навыков.
 * Показывается перед новым забегом, если задан `meta.char_creation`.
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
  const [choice, setChoice] = useState<CharChoice>(() => newCharChoice(creation, template))

  const { min, max } = creation.stat_limits
  const statLeft = creation.total_points - statPointsUsed(creation, choice)
  const skillsOn = creation.skill_points !== undefined
  const skillLeft = skillsOn ? creation.skill_points! - skillPointsUsed(creation, template, choice) : 0
  const problems = charChoiceProblems(creation, template, choice)
  const derived = derivedFromChoice(choice)
  const professions = creation.professions ?? []

  const setProfession = (id: string) => {
    setChoice((c) => {
      const oldP = professions.find((p) => p.id === c.profession)
      const newP = professions.find((p) => p.id === id)
      const skills = { ...c.skills }
      for (const s of skillList) {
        const ob = oldP?.skill_bonus[s.id] ?? 0
        const nb = newP?.skill_bonus[s.id] ?? 0
        if (ob || nb) skills[s.id] = Math.max(0, (skills[s.id] ?? 0) - ob + nb)
      }
      return { ...c, profession: id, skills }
    })
  }

  // навыки: реестр + встроенные + навыки шаблона, по алфавиту
  const skillList = (() => {
    const seen = new Set<string>()
    const out: Array<{ id: string; label: string }> = []
    for (const s of [...allSkillIds(campaign.meta), ...Object.keys(template.skills).map((id) => ({ id, label: skillLabel(id, campaign.meta.skills) }))]) {
      if (seen.has(s.id)) continue
      seen.add(s.id)
      out.push({ id: s.id, label: s.label })
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  })()
  const forbidden = new Set(creation.forbidden_skills ?? [])
  const mandatory = new Set(creation.mandatory_skills ?? [])

  const skillFloor = (id: string): number => {
    const base = template.skills[id] ?? 0
    return mandatory.has(id) ? Math.max(base, 25) : base
  }

  return (
    <div className="char-create">
      <div className="char-create-inner panel">
        <div className="panel-header">
          <h2><Ico n="user" />  Создание персонажа</h2>
          <button className="btn btn-small" onClick={onBack}><Ico n="close" /> </button>
        </div>

        {creation.choose_name && (
          <div className="props-group">
            <h4>Имя героя</h4>
            <input
              className="char-name"
              value={choice.name}
              maxLength={40}
              placeholder={template.label}
              onChange={(e) => setChoice({ ...choice, name: e.target.value })}
            />
          </div>
        )}

        <div className="props-group">
          <h4>Характеристики</h4>
          <div className="muted small" style={{ marginBottom: 6 }}>
            Осталось очков: <b>{statLeft}</b> из {creation.total_points}. Рамки: {min}–{max}.
          </div>
          <div className="char-stats">
            {STAT_KEYS.map((k) => (
              <div key={k} className="char-stat-row">
                <span className="char-stat-key" data-tip={k}>{k}</span>
                <button
                  className="btn btn-small"
                  disabled={(choice.stats[k] ?? min) <= min}
                  onClick={() => setChoice({ ...choice, stats: { ...choice.stats, [k]: (choice.stats[k] ?? min) - 1 } })}
                >
                  −
                </button>
                <span className="char-stat-val">{choice.stats[k] ?? min}</span>
                <button
                  className="btn btn-small"
                  disabled={statLeft <= 0 || (choice.stats[k] ?? min) >= max}
                  onClick={() => setChoice({ ...choice, stats: { ...choice.stats, [k]: (choice.stats[k] ?? min) + 1 } })}
                >
                  +
                </button>
              </div>
            ))}
          </div>
          <div className="muted small">
            Здоровье: <b>{derived.hp}</b> · Магия: <b>{derived.mp}</b>
          </div>
        </div>

        {professions.length > 0 && (
          <div className="props-group">
            <h4>Происхождение</h4>
            <div className="char-professions">
              {professions.map((p) => (
                <button
                  key={p.id}
                  className={`char-prof-card ${choice.profession === p.id ? 'sel' : ''}`}
                  onClick={() => setProfession(p.id)}
                >
                  <div className="char-prof-label">{p.label}</div>
                  {p.description && <div className="muted small">{p.description}</div>}
                  <div className="char-prof-bonus small">
                    {Object.entries(p.skill_bonus).map(([id, v]) => `+${v} ${skillLabel(id, campaign.meta.skills)}`).join(' · ') || 'без бонусов навыков'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {skillsOn && (
          <div className="props-group">
            <h4>Навыки</h4>
            <div className="muted small" style={{ marginBottom: 6 }}>
              Осталось очков: <b>{skillLeft}</b> из {creation.skill_points}. Предел на старте: {creation.skill_cap ?? '—'}.
            </div>
            <div className="char-skills">
              {skillList.map((s) => {
                const v = choice.skills[s.id] ?? 0
                const isForbidden = forbidden.has(s.id)
                const floor = skillFloor(s.id)
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
