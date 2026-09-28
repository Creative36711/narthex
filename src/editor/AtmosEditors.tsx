/**
 * Редакторы «кинематографии» и мастерской спецэффектов:
 *  - CameraEditor — пан-зум фона состояния сцены / слайда катсцены / «открытки»;
 *  - ParticleListEditor — реестр атмосферных слоёв кампании (дождь из своих файлов,
 *    листопад, пыль, искры…); слой выбирается в поле «погодный overlay».
 */

import type { CameraDoc } from '../shared/types'
import { Ico } from '../shared/icons'

/** Редактор камеры: зум, сдвиг кадра, длительность перехода. Пустой — фон статичен. */
export function CameraEditor({ value, onChange }: { value?: CameraDoc; onChange: (v: CameraDoc | undefined) => void }) {
  const cam = value
  const set = (patch: Partial<CameraDoc>) => {
    const next = { ...(cam ?? {}), ...patch }
    for (const k of Object.keys(next) as Array<keyof CameraDoc>) {
      if (next[k] === undefined || Number.isNaN(next[k])) delete next[k]
    }
    onChange(Object.keys(next).length ? next : undefined)
  }
  if (!cam) {
    return (
      <button className="btn btn-small" data-tip="Придать фону медленное кинематографическое движение (подходит панорамам и крупным кадрам)" onClick={() => set({ zoom: 1.12, pan_x: 0, pan_y: 0, duration: 10 })}>
        <Ico n="plus" /> Движение камеры
      </button>
    )
  }
  return (
    <div className="fld-row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <span className="fld-label">Камера:</span>
      <label className="fld fld-num" data-tip="Увеличение кадра: 1 — как есть, 1.2 — наезд, 0.9 — отъезд">
        <span>Зум</span>
        <input type="number" step={0.02} min={0.5} max={3} value={cam.zoom ?? 1} onChange={(e) => set({ zoom: +e.target.value || undefined })} />
      </label>
      <label className="fld fld-num" data-tip="Сдвиг кадра влево (-) или вправо (+), % ширины картинки">
        <span>Горизонт, %</span>
        <input type="number" step={1} min={-40} max={40} value={cam.pan_x ?? 0} onChange={(e) => set({ pan_x: +e.target.value || undefined })} />
      </label>
      <label className="fld fld-num" data-tip="Сдвиг кадра вверх (-) или вниз (+), % высоты картинки">
        <span>Вертикаль, %</span>
        <input type="number" step={1} min={-40} max={40} value={cam.pan_y ?? 0} onChange={(e) => set({ pan_y: +e.target.value || undefined })} />
      </label>
      <label className="fld fld-num" data-tip="Секунды, за которые камера доходит до позиции (0 — мгновенно)">
        <span>Секунд</span>
        <input type="number" min={0} max={60} value={cam.duration ?? 8} onChange={(e) => set({ duration: +e.target.value || undefined })} />
      </label>
      <button className="btn btn-small ce-del" data-tip="Убрать движение камеры" onClick={() => onChange(undefined)}>
        <Ico n="close" />
      </button>
    </div>
  )
}

import type { ParticleEffectDef } from '../shared/types'
import type { EditorStore } from './store'
import { ImageUpload } from './Fields'
import { makeId } from './ids'

/** реестр «мастерской спецэффектов»: слои атмосферы из файла-частицы */
export function ParticleListEditor({ list, store, commit }: { list: ParticleEffectDef[]; store: EditorStore; commit: () => void }) {
  return (
    <div>
      {list.map((a, i) => (
        <details key={a.id} className="need-conds" style={{ marginBottom: 6 }}>
          <summary>
            {a.label || '(слой без названия)'}
            <button
              className="btn btn-small ce-del"
              data-tip="Удалить слой"
              onClick={(e) => {
                e.preventDefault(); e.stopPropagation()
                list.splice(i, 1); commit()
              }}
            ><Ico n="close" /></button>
          </summary>
          <div className="fld-row" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <label className="fld">
              <span>Название слоя</span>
              <input value={a.label} onChange={(e) => ((a.label = e.target.value), commit())} />
            </label>
            <ImageUpload
              label="Файл-частица (PNG с прозрачным полем)"
              value={a.sprite ?? ''}
              dir="assets/img/weather"
              store={store}
              onChange={(path) => {
                if (path) a.sprite = path
                else delete a.sprite
                commit()
              }}
            />
          </div>
          <div className="fld-row" style={{ flexWrap: 'wrap' }}>
            <label className="fld fld-num" data-tip="Штук на экран (умолчание 60)">
              <span>Кол-во</span>
              <input type="number" min={4} max={400} value={a.count ?? ''} placeholder="60" onChange={(e) => ((a.count = e.target.value ? Math.max(4, Math.min(400, +e.target.value)) : undefined), commit())} />
            </label>
            <label className="fld fld-num" data-tip="Размер частицы, px: от — до (умолчание 3…6)">
              <span>Размер от</span>
              <input type="number" min={1} max={200} value={a.size_min ?? ''} placeholder="3" onChange={(e) => ((a.size_min = e.target.value ? +e.target.value : undefined), commit())} />
            </label>
            <label className="fld fld-num">
              <span>до</span>
              <input type="number" min={1} max={200} value={a.size_max ?? ''} placeholder="6" onChange={(e) => ((a.size_max = e.target.value ? +e.target.value : undefined), commit())} />
            </label>
            <label className="fld fld-num" data-tip="Скорость вниз/вверх px/с: от — до (умолчание 40…80)">
              <span>Вниз от</span>
              <input type="number" min={-600} max={600} value={a.vy_min ?? ''} placeholder="40" onChange={(e) => ((a.vy_min = e.target.value ? +e.target.value : undefined), commit())} />
            </label>
            <label className="fld fld-num">
              <span>до</span>
              <input type="number" min={-600} max={600} value={a.vy_max ?? ''} placeholder="80" onChange={(e) => ((a.vy_max = e.target.value ? +e.target.value : undefined), commit())} />
            </label>
            <label className="fld fld-num" data-tip="Скорость влево/вправо px/с (умолчание -5…5)">
              <span>Бок от</span>
              <input type="number" min={-600} max={600} value={a.vx_min ?? ''} placeholder="-5" onChange={(e) => ((a.vx_min = e.target.value ? +e.target.value : undefined), commit())} />
            </label>
            <label className="fld fld-num">
              <span>до</span>
              <input type="number" min={-600} max={600} value={a.vx_max ?? ''} placeholder="5" onChange={(e) => ((a.vx_max = e.target.value ? +e.target.value : undefined), commit())} />
            </label>
            <label className="fld fld-num" data-tip="Вращение частицы, градусов в секунду (умолчание 0)">
              <span>Вращение</span>
              <input type="number" min={-360} max={360} value={a.spin ?? ''} placeholder="0" onChange={(e) => ((a.spin = e.target.value ? +e.target.value : undefined), commit())} />
            </label>
            <label className="fld fld-num" data-tip="Непрозрачность частицы 0..1 (умолчание 0.8)">
              <span>Непрозр.</span>
              <input type="number" min={0} max={1} step={0.05} value={a.opacity ?? ''} placeholder="0.8" onChange={(e) => ((a.opacity = e.target.value ? Math.max(0, Math.min(1, +e.target.value)) : undefined), commit())} />
            </label>
            <label className="fld fld-num" data-tip="Размытие частицы, px (туман; умолчание 0)">
              <span>Расплыв.</span>
              <input type="number" min={0} max={24} value={a.blur ?? ''} placeholder="0" onChange={(e) => ((a.blur = e.target.value ? +e.target.value : undefined), commit())} />
            </label>
            <label className="fld" data-tip="Наложение: «свет» — частицы светятся (искры/пресвет)">
              <span>Наложение</span>
              <select
                value={a.blend ?? 'normal'}
                onChange={(e) => {
                  if (e.target.value === 'screen') a.blend = 'screen'
                  else delete a.blend
                  commit()
                }}
              >
                <option value="normal">Обычное</option>
                <option value="screen">Свет (искры)</option>
              </select>
            </label>
          </div>
          <label className="fld fld-check" data-tip="Частицы возрождаются за краем экрана (умолчание — да)">
            <input type="checkbox" checked={a.loop !== false} onChange={(e) => { if (!e.target.checked) a.loop = false; else delete a.loop; commit() }} />
            <span>Бесконечная атмосфера</span>
          </label>
        </details>
      ))}
      <button
        className="btn btn-small"
        onClick={() => {
          const label = `Новый слой ${list.length + 1}`
          list.push({
            id: makeId('atmos_', label, list.map((x) => x.id)),
            label,
            count: 60,
            vy_min: 40,
            vy_max: 80,
          })
          commit()
        }}
      ><Ico n="plus" /> Слой атмосферы</button>
    </div>
  )
}
