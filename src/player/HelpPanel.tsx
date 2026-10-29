import { Ico } from '../shared/icons'
import { useState } from 'react'
import type { GameEngine } from '../core/engine'
import { featureOn, DEFAULT_DICE_RULES, type CampaignData, type DiceRules } from '../shared/types'
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
        <div className="checks-row"><span className="checks-mark good"><Ico n="star" /></span><span>{specialStart}–{specialEnd} (навык ÷ {rules.special_divisor})</span><span className="checks-res">Уверенный успех</span></div>
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
    id: 'start',
    title: 'Начало и управление',
    body: (
      <>
        <p>История развивается в сценах: читайте текст, выбирайте реплики и нажимайте на отмеченных персонажей, предметы и места. Доступные действия и правила задаёт автор кампании — отдельные возможности могут быть отключены.</p>
        <ul>
          <li><b>Новый забег</b> начинает историю заново. <b>Продолжить</b> открывает автосохранение, если оно есть.</li>
          <li>В верхней панели игры открываются герой, журнал, карта, вещи, сохранения, справка и настройки. Некоторые кнопки появляются только если соответствующая механика включена.</li>
          <li>В сцене нажмите на персонажа, чтобы поговорить, или на интерактивный объект, чтобы осмотреть/использовать его. Если вариантов несколько, игра предложит выбор.</li>
          <li>Кнопка выхода возвращает в меню; текущий забег сохраняется автоматически.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'checks',
    title: 'Проверки навыков (d100)',
    body: <ChecksBody rules={DEFAULT_DICE_RULES} />,
  },
  {
    id: 'growth',
    title: 'Рост навыков и отдых',
    body: (
      <>
        <p>Успешные проверки, атаки, защиты и некоторые другие действия могут отметить использованный навык. Когда сценарий вызывает сон или отдых, движок проверяет отмеченные навыки: бросок d100 выше текущего значения даёт рост на 1d6. После проверки отметки сбрасываются.</p>
        <p>Разбить лагерь можно кнопкой <b>«Лагерь»</b>, если сейчас это безопасно и доступно. Отдых может восстановить здоровье и ресурсы; условия, длительность, риск встречи и другие эффекты определяет кампания.</p>
      </>
    ),
  },
  {
    id: 'combat',
    title: 'Тактический бой',
    body: (
      <>
        <p>В бою ходят по очереди; порядок обычно зависит от Ловкости (DEX). В свой ход перемещайтесь по подсвеченным гексам и выбирайте противника в пределах досягаемости, чтобы атаковать. Интерфейс показывает оставшееся движение, атаки и MP.</p>
        <ul>
          <li>Обычная атака расходует действие; повторные атаки за раунд могут получать штраф. После атаки ход обычно завершается автоматически.</li>
          <li>Для способности выберите её кнопку, затем нажмите на подсвеченную цель. Клик вне цели отменяет выбор.</li>
          <li>Доступные боевые предметы, прицеливание, скрытность, приказы спутникам и отступление появляются по условиям кампании и персонажа.</li>
          <li>Уклонение или парирование движок проверяет автоматически, если защита возможна; повторные защиты за раунд слабее.</li>
          <li>В боевом журнале видны броски, попадания, эффекты и изменения здоровья. Добыча показывается после победы.</li>
        </ul>
        <p className="muted small">Точные действия и правила зависят от экипировки, способностей и настроек кампании. Первую подсказку по бою можно снова включить кнопкой «Обучение заново».</p>
      </>
    ),
  },
  {
    id: 'journal',
    title: 'Журнал, квесты и кодекс',
    body: (
      <>
        <p>Кнопка <b>«Журнал»</b> открывает текущие и завершённые квесты с записями истории, а также недавние события забега. Важные новые записи публикует сама кампания — журнал не требует ручного обновления.</p>
        <p>Разблокированные статьи мира доступны в <b>«Кодексе»</b>. Если кнопка или запись пока не отображается, продолжайте исследовать мир: автор может открыть её событием или диалогом.</p>
      </>
    ),
  },
  {
    id: 'map',
    title: 'Исследование и карта',
    body: (
      <>
        <p>Карта показывает известные места. Нажмите на доступный маркер, проверьте стоимость пути и подтвердите переход кнопкой <b>«В путь»</b>. Дорога продвигает время и может запустить событие или встречу. Колесо мыши меняет масштаб, перетаскивание двигает карту.</p>
        <p>Время и погода, если они включены в кампании, отображаются в верхней панели. Расписание персонажей, опасности и последствия действий зависят от конкретного мира.</p>
      </>
    ),
  },
  {
    id: 'needs',
    title: 'Время, потребности и состояния',
    body: (
      <>
        <p>Продвижение времени и стоимость действий задаёт кампания. Если включены потребности, их значения показаны в верхней панели; низкое значение может привести к штрафу, потере здоровья или другому последствию.</p>
        <p>Подсказки на полосах и значках объясняют конкретные показатели. Проверяйте инвентарь, диалоги и места отдыха, чтобы найти способы восстановить ресурсы. Состояния персонажа и их длительность также видны в панели.</p>
      </>
    ),
  },
  {
    id: 'social',
    title: 'Отношения и торговля',
    body: (
      <>
        <p>Репутация, отношения с фракциями и персонажами могут влиять на доступные реплики, помощь и цены. Их значения и диапазоны задаёт кампания.</p>
        <p>Торговля открывается через подходящих персонажей. Состав ассортимента, цены и доступные операции зависят от торговца и правил мира; перед покупкой проверьте стоимость и количество.</p>
      </>
    ),
  },
  {
    id: 'saves',
    title: 'Сохранения и настройки',
    body: (
      <>
        <p>Забег сохраняется автоматически. Если кампания поддерживает ручные слоты, откройте <b>«Сохранения»</b>, чтобы создать отдельный снимок или загрузить его. Сохранение также можно перенести файлом <code>.cfsave</code> через меню кампаний.</p>
        <p>При обновлении кампании или движка несовместимые данные не должны исчезать молча: перед продолжением может появиться отчёт о переносе или причина, по которой сохранение нельзя открыть.</p>
        <p>В <b>«Настройках»</b> меняются громкость и доступные параметры озвучивания. Горячие клавиши и специальные команды не требуются — основные действия доступны кнопками и кликами.</p>
      </>
    ),
  },
]

export function HelpPanel({ onClose, engine, campaign }: { onClose: () => void; engine?: GameEngine; campaign?: CampaignData }) {
  const meta = engine?.campaign.meta ?? campaign?.meta
  // разделы справки по выключенным механикам профиля кампании скрываются
  const enabled = (id: string): boolean => {
    if (!meta) return true
    if ((id === 'checks' || id === 'growth') && !featureOn(meta, 'skills')) return false
    if (id === 'combat' && !featureOn(meta, 'combat')) return false
    if (id === 'map' && !featureOn(meta, 'map')) return false
    if (id === 'needs' && !featureOn(meta, 'needs') && !featureOn(meta, 'time')) return false
    if (id === 'social' && !featureOn(meta, 'trade') && !featureOn(meta, 'relationships') && !meta.reputation) return false
    return true
  }
  const [open, setOpen] = useState<string>('start')
  // пороги берём из кампании: у каждой кампании могут быть свои правила (итерация 8, А7)
  const diceRules = engine?.diceRules ?? campaign?.meta.dice_rules ?? DEFAULT_DICE_RULES
  const sections = SECTIONS.filter((s) => enabled(s.id)).map((s) =>
    s.id === 'checks' ? { ...s, body: <ChecksBody rules={diceRules} /> } : s,
  )
  return (
    <div className="overlay panel-overlay help-overlay" onClick={onClose}>
      <div className="panel side-panel help-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2><Ico n="book" />  Как играть</h2>
          <button className="btn btn-small" onClick={onClose}><Ico n="close" /> </button>
        </div>
        <p className="muted small">
          Краткое руководство по интерфейсу и механикам Chronicle Forge. Кампания может отключать отдельные системы и задавать собственные правила; поэтому в справке показаны только применимые разделы, а детали конкретного действия уточняйте по подсказкам на экране.
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
              resetTips(engine?.campaign.meta.id)
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
