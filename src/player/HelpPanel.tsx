import { Ico } from '../shared/icons'
import { useState } from 'react'
import type { GameEngine } from '../core/engine'
import { featureOn, DEFAULT_DICE_RULES, type DiceRules } from '../shared/types'
import { resetTips } from './tips'
import { showAlert } from '../shared/modals'

/**
 * Встроенная справка Chronicle Forge (Уровень 1 обучения).
 * Собственное описание механик движка своими словами.
 */

const DEMO_SKILL = 45 // навык для примера в разделе «Проверки»

/** Раздел «Проверки»: пороги берутся из настроек кампании (итерация 8, А7). */
function ChecksBody({ rules }: { rules: DiceRules }) {
  const crit = Math.max(1, Math.floor(DEMO_SKILL / (rules.critical_divisor || 1)))
  const special = Math.max(1, Math.floor(DEMO_SKILL / (rules.special_divisor || 1)))
  const lowSkill = rules.fumble_low_skill
  const fumbleWindow = rules.fumble_from < 100 ? `${rules.fumble_from}–99` : 'дополнительного диапазона нет'
  const fumbleNote =
    rules.fumble_from < 100 && lowSkill != null
      ? `Бросок 100 всегда означает критический провал. В диапазоне ${fumbleWindow} провал становится критическим, если бросок выше итогового навыка; при навыке ниже ${lowSkill} весь диапазон считается критическим провалом.`
      : rules.fumble_from < 100
        ? `Бросок 100 всегда означает критический провал. В диапазоне ${fumbleWindow} критический провал наступает, если бросок выше итогового навыка.`
        : 'Бросок 100 всегда означает критический провал.'
  const specialStart = Math.max(1, crit + 1)
  const specialEnd = Math.max(0, Math.floor(DEMO_SKILL / (rules.special_divisor || 1)))
  const successStart = specialEnd + 1
  const exampleCritical = String(crit).padStart(2, '0')
  return (
    <>
      <p>
        Когда персонаж пытается сделать что-то с неочевидным исходом — убедить стражника,
        заметить ловушку, ударить мечом, — движок бросает виртуальный d100 (число от 1 до 100)
        и сравнивает его со значением навыка.
      </p>
      {/* таблица исходов — строками с переносом, без горизонтального скролла */}
      <div className="checks-table">
        <div className="checks-row"><span className="checks-mark ok">d100</span><span>Целевое значение: навык с модификатором</span><span className="checks-res">Основа проверки</span></div>
        <div className="checks-row"><span className="checks-mark crit">*</span><span>Бросок ≤ {crit} (навык ÷ {rules.critical_divisor})</span><span className="checks-res">Критический успех</span></div>
        <div className="checks-row"><span className="checks-mark good">⭐</span><span>{specialStart}–{specialEnd} (навык ÷ {rules.special_divisor})</span><span className="checks-res">Уверенный успех</span></div>
        <div className="checks-row"><span className="checks-mark ok">+</span><span>{successStart}–навык</span><span className="checks-res">Успех</span></div>
        <div className="checks-row"><span className="checks-mark bad">−</span><span>Бросок выше итогового навыка</span><span className="checks-res">Провал</span></div>
        <div className="checks-row"><span className="checks-mark bad">×</span><span>100 всегда; {fumbleWindow} — по правилу ниже</span><span className="checks-res">Критический провал</span></div>
      </div>
      {fumbleNote && <p className="muted small">{fumbleNote}</p>}
      <p>
        Пример: навык «Убеждение» = {DEMO_SKILL}%.
        <br />• Бросок 23 → 23 ≤ {DEMO_SKILL} → <b>успех</b>, собеседник согласился.
        <br />• Бросок {exampleCritical} → {crit} ≤ {crit} ({DEMO_SKILL}÷{rules.critical_divisor}) → <b>крит</b> —
        согласился с энтузиазмом.
        <br />• Бросок 71 → 71 &gt; {DEMO_SKILL} → <b>провал</b>, разговор не задался.
      </p>
      <p className="muted">
        Особый успех при навыке {DEMO_SKILL} — это бросок {special} или меньше. Чем выше навык,
        тем больше шанс. Результаты всех бросков пишутся в журнал.
      </p>
    </>
  )
}

const SECTIONS: Array<{ id: string; title: string; body: React.ReactNode }> = [
  {
    id: 'checks',
    title: 'Проверки навыков (d100)',
    body: <ChecksBody rules={DEFAULT_DICE_RULES} />,
  },
  {
    id: 'growth',
    title: 'Рост навыков',
    body: (
      <>
        <p>
          Некоторые успешные проверки навыков отмечаются для роста (<Ico n="check" /> в листе персонажа):
          удачная атака, защита, убеждение, торговля…
        </p>
        <p>
          При действии отдыха по каждому отмеченному навыку бросается d100. Если результат
          <b> выше</b> текущего значения, навык растёт на 1d6. После отдыха отметки сбрасываются.
        </p>
      </>
    ),
  },
  {
    id: 'combat',
    title: 'Бой на гексах',
    body: (
      <>
        <p>
          Бой пошаговый. Порядок ходов определяет <b>Ловкость (DEX)</b>. В свой ход можно
          <b> двигаться</b> (подсвеченные гексы; сложная местность — в 2 раза дороже) и совершить
          одно <b>действие</b>: атаковать соседнего врага или использовать предмет. После атаки
          ход завершается сам; кнопка <b>«Пропустить ход»</b> нужна, чтобы закончить ход без атаки.
        </p>
        <p>
          <b>Атака</b> — проверка навыка оружия. При попадании защитник автоматически пробует
          <b> уклониться или парировать</b> (каждая повторная защита в раунде слабее на 30%).
          Урон = кости оружия + бонус силы − броня. Критическое попадание наносит максимальный
          урон и игнорирует броню.
        </p>
        <p>
          Здоровье не восстанавливается само. Лечение зависит от предметов, способностей и
          эффектов кампании. Смерть в бою завершает забег (см. «Рогалик»).
        </p>
      </>
    ),
  },
  {
    id: 'needs',
    title: 'Время и потребности',
    body: (
      <>
        <p>
          Время идёт <b>тиками</b>. Длину тика и стоимость действий задаёт кампания. Путешествие,
          бой и некоторые эффекты продвигают время. Расписание персонажей и событий зависит от
          кампании — проверяйте описания сцен и диалоги.
        </p>
        <p>
          Потребности и скорость их изменения тоже задаёт кампания. Нулевое значение может
          привести к смерти или другому эффекту. Способы восстановления ищите в инвентаре,
          диалогах и описаниях мира.
        </p>
      </>
    ),
  },
  {
    id: 'social',
    title: 'Репутация и торговля',
    body: (
      <>
        <p>
          Отношение к фракции меняется в пределах от −100 до +100. Кампания может использовать
          его в условиях диалогов, спутников и торговли. Отношение к НПС складывается из отношения
          к его фракции и личной поправки персонажа.
        </p>
        <p>
          Цена у торговца зависит от отношения и навыка <b>Торговли</b>. Условия покупки и продажи
          задаются кампанией и могут различаться.
        </p>
      </>
    ),
  },
  {
    id: 'roguelike',
    title: 'Рогалик: смерть и новый забег',
    body: (
      <>
        <p>
          Состояние забега сохраняется автоматически. После смерти сохранение удаляется.
          Новый забег начинается с начального состояния и новым случайным зерном для бросков.
        </p>
        <p>
          Сами сцены и события кампании не меняются, если автор отдельно не настроил случайные
          варианты. Ваши знания о мире остаются с вами — используйте их в следующей попытке.
        </p>
      </>
    ),
  },
]

export function HelpPanel({ onClose, engine }: { onClose: () => void; engine?: GameEngine }) {
  const meta = engine?.campaign.meta
  // разделы справки по выключенным механикам профиля кампании скрываются
  const enabled = (id: string): boolean => {
    if (!meta) return true
    if ((id === 'checks' || id === 'growth') && !featureOn(meta, 'skills')) return false
    if (id === 'combat' && !featureOn(meta, 'combat')) return false
    if (id === 'needs' && !featureOn(meta, 'needs') && !featureOn(meta, 'time')) return false
    if (id === 'social' && !featureOn(meta, 'trade') && !featureOn(meta, 'relationships')) return false
    return true
  }
  const [open, setOpen] = useState<string>(meta && !featureOn(meta, 'skills') ? '' : 'checks')
  // пороги берём из кампании: у каждой кампании могут быть свои правила (итерация 8, А7)
  const sections = SECTIONS.filter((s) => enabled(s.id)).map((s) =>
    s.id === 'checks' && engine
      ? { ...s, body: <ChecksBody rules={engine.diceRules} /> }
      : s,
  )
  return (
    <div className="overlay panel-overlay help-overlay" onClick={onClose}>
      <div className="panel side-panel help-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2><Ico n="book" />  Справка</h2>
          <button className="btn btn-small" onClick={onClose}><Ico n="close" /> </button>
        </div>
        <p className="muted small">
          Chronicle Forge использует классическую процентную систему проверок (d100). Всё, что
          нужно для игры, — на этой странице.
        </p>
        {sections.map((s) => (
          <div key={s.id} className={`help-section ${open === s.id ? 'open' : ''}`}>
            <button className="help-title" onClick={() => setOpen(open === s.id ? '' : s.id)}>
              {s.title} <span className="muted">{open === s.id ? '▾' : '▸'}</span>
            </button>
            {open === s.id && <div className="help-body">{s.body}</div>}
          </div>
        ))}
        <div className="help-foot">
          <button
            className="btn btn-small"
            data-tip="Игровые подсказки показываются один раз; эта кнопка включает их снова"
            onClick={async () => {
              resetTips()
              await showAlert(
                'Обучение включено заново',
                'Интерактивные подсказки (первый бой, проверки в диалогах, рост навыков) снова появятся по ходу игры.',
              )
            }}
          >
            <Ico n="book" />  Обучение заново
          </button>
        </div>
      </div>
    </div>
  )
}
