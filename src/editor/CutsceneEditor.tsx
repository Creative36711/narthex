import { Ico } from '../shared/icons'
import { useCallback, useState } from 'react'
import type { ArtDoc, CutsceneDef, CutsceneSlide, CutsceneTransition } from '../shared/types'
import type { EditorStore } from './store'
import { AssetUpload, AudioUpload, ImageUpload, JsonField, ChapterSelect } from './Fields'
import { MusicTrackSelect } from './AudioSection'
import { ArtView } from '../shared/ArtView'
import { CameraEditor } from './AtmosEditors'
import { CutscenePlayer, autoDurationMs, youtubeId } from '../shared/CutscenePlayer'
import { askConfirm } from './prompt'

/**
 * Редактор слайд-катсцен (итерация 8, блок E): список слайдов с предпросмотром,
 * порядок, переходы, длительности, музыка и озвучка (файл или ссылка),
 * тест-прогон прямо в редакторе.
 */

const TRANSITIONS: Array<{ id: CutsceneTransition; label: string }> = [
  { id: 'fade', label: 'Затемнение' },
  { id: 'cut', label: 'Резкая смена' },
  { id: 'slide', label: 'Сдвиг' },
  { id: 'panzoom', label: 'Медленный наезд' },
]

type FrameKind = 'art' | 'image' | 'video' | 'none'

const FRAME_KINDS: Array<{ id: FrameKind; label: string }> = [
  { id: 'art', label: 'Векторный рисунок (ArtDoc)' },
  { id: 'image', label: 'Изображение' },
  { id: 'video', label: 'Видео' },
  { id: 'none', label: 'Без кадра (текст на чёрном)' },
]

function frameKind(s: CutsceneSlide): FrameKind {
  if (s.art) return 'art'
  if (s.image !== undefined) return 'image'
  if (s.video !== undefined) return 'video'
  return 'none'
}

function blankArt(title = ''): ArtDoc {
  return {
    canvas: { w: 1280, h: 720 },
    background: '#101218',
    layers: title
      ? [{ label: 'заголовок', shape: { type: 'text', x: 640, y: 380, text: title, size: 64, color: '#e8d9b0', align: 'middle' } }]
      : [],
  }
}

export function newCutscene(id: string, label: string): CutsceneDef {
  return {
    id,
    label,
    slides: [{ art: blankArt(label), text: 'Подпись первого слайда…', transition: 'fade' }],
  }
}

export function CutsceneEditor({ store, path }: { store: EditorStore; path: string }) {
  const cs = store.cutscene(path)
  const [, force] = useState(0)
  const [testFrom, setTestFrom] = useState<number | null>(null)
  const [gen, setGen] = useState(0)
  const resolve = useCallback((p: string) => store.assetSrc(p), [store])
  const closeTest = useCallback(() => setTestFrom(null), [])
  if (!cs) return null
  if (!Array.isArray(cs.slides)) cs.slides = []

  const commit = () => {
    store.touch(path)
    force((n) => n + 1)
  }

  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= cs.slides.length) return
    ;[cs.slides[i], cs.slides[j]] = [cs.slides[j], cs.slides[i]]
    commit()
  }

  return (
    <div className="rule-editor cutscene-editor">
      <div className="props-group">
        <h4><Ico n="film" />  Катсцена</h4>
        <label className="fld">
          <span>Название</span>
          <input value={cs.label} onChange={(e) => ((cs.label = e.target.value), commit())} />
        </label>
        <ChapterSelect store={store} value={cs.chapter} onChange={(v) => ((cs.chapter = v), commit())} />
        <div className="fld fld-block">
          <span>Музыка на всю катсцену (необязательно)</span>
          <div className="muted small" style={{ marginBottom: 4 }}>
            Выберите трек из реестра кампании (в том числе синтез-треки) или укажите свой файл/ссылку.
          </div>
          <MusicTrackSelect
            store={store}
            value={store.meta.music_tracks?.some((t) => t.id === cs.music) ? cs.music : undefined}
            onChange={(id) => {
              if (id) cs.music = id
              else delete cs.music
              commit()
            }}
          />
          <AudioUpload
            label="Или файл/ссылка"
            value={cs.music && !store.meta.music_tracks?.some((t) => t.id === cs.music) ? cs.music : ''}
            dir="assets/audio/music"
            store={store}
            onChange={(p) => {
              if (p) cs.music = p
              else delete cs.music
              commit()
            }}
          />
        </div>
        <div className="fld-row" style={{ alignItems: 'center', gap: 10 }}>
          <button className="btn btn-small btn-primary" disabled={!cs.slides.length} onClick={() => setTestFrom(0)}>
            <Ico n="play" />  Тест-прогон
          </button>
          <span className="muted small">
            В игре катсцена запускается эффектом «Показать катсцену» — в правиле или действием в диалоге.
          </span>
        </div>
      </div>

      {cs.slides.map((sl, i) => (
        <SlideCard
          key={i}
          slide={sl}
          index={i}
          total={cs.slides.length}
          store={store}
          commit={commit}
          onUp={() => move(i, -1)}
          onDown={() => move(i, 1)}
          onTest={() => setTestFrom(i)}
          onRemove={async () => {
            if (!(await askConfirm(`Удалить слайд ${i + 1}?`, 'Удалить'))) return
            cs.slides.splice(i, 1)
            commit()
          }}
          onReplace={(next) => {
            cs.slides[i] = next
            commit()
          }}
        />
      ))}
      <button
        className="btn btn-small"
        onClick={() => {
          cs.slides.push({ art: blankArt(), text: '', transition: 'fade' })
          commit()
        }}
      >
        + слайд
      </button>

      <details className="advanced-json" onToggle={(e) => (e.target as HTMLDetailsElement).open && setGen((n) => n + 1)}>
        <summary>Расширенный JSON всей катсцены</summary>
        <JsonField
          key={gen}
          label=""
          rows={16}
          pretty
          value={cs}
          onChange={(v) => {
            if (v && typeof v === 'object' && Array.isArray((v as CutsceneDef).slides)) {
              store.jsonFiles.set(path, { ...(v as CutsceneDef), id: cs.id })
              commit()
            }
          }}
        />
      </details>

      {testFrom !== null && cs.slides.length > 0 && (
        <CutscenePlayer
          cutscene={cs}
          resolve={resolve}
          resolveTrack={(id) => store.meta.music_tracks?.find((t) => t.id === id) ?? null}
          onEnd={closeTest}
          startAt={testFrom}
          testMode
        />
      )}
    </div>
  )
}

function SlideCard({
  slide: sl,
  index,
  total,
  store,
  commit,
  onUp,
  onDown,
  onTest,
  onRemove,
  onReplace,
}: {
  slide: CutsceneSlide
  index: number
  total: number
  store: EditorStore
  commit: () => void
  onUp: () => void
  onDown: () => void
  onTest: () => void
  onRemove: () => void
  onReplace: (s: CutsceneSlide) => void
}) {
  const [showJson, setShowJson] = useState(false)
  const kind = frameKind(sl)
  const auto = Math.round(autoDurationMs(sl) / 100) / 10

  const setKind = (k: FrameKind) => {
    const next: CutsceneSlide = { ...sl }
    delete next.art
    delete next.image
    delete next.video
    if (k === 'art') next.art = blankArt()
    if (k === 'image') next.image = ''
    if (k === 'video') next.video = ''
    onReplace(next)
  }

  return (
    <div className="props-group cs-slide-card">
      <div className="cs-slide-head">
        <b>Слайд {index + 1}</b>
        <span className="editor-spacer" />
        <button className="btn btn-small" disabled={index === 0} data-tip="Выше" onClick={onUp}>↑</button>
        <button className="btn btn-small" disabled={index === total - 1} data-tip="Ниже" onClick={onDown}>↓</button>
        <button className="btn btn-small" data-tip="Тест-прогон с этого слайда" onClick={onTest}><Ico n="play" /> </button>
        <button className="btn btn-small ce-del" data-tip="Удалить слайд" onClick={onRemove}><Ico n="close" /> </button>
      </div>
      <div className="cs-slide-body">
        <div className="cs-slide-preview">
          {kind === 'art' && <ArtView className="cs-thumb" art={sl.art} />}
          {kind === 'image' &&
            (sl.image ? (
              <img className="cs-thumb" src={store.assetSrc(sl.image)} alt="" />
            ) : (
              <div className="cs-thumb cs-thumb-empty">нет изображения</div>
            ))}
          {kind === 'video' && (
            <div className="cs-thumb cs-thumb-empty">
              {sl.video ? (youtubeId(sl.video) ? 'YouTube' : 'mp4-видео') : 'нет ссылки на видео'}
            </div>
          )}
          {kind === 'none' && <div className="cs-thumb cs-thumb-black" />}
          {sl.text && <div className="cs-thumb-caption">{sl.text}</div>}
        </div>
        <div className="cs-slide-fields">
          <div className="fld-row">
            <label className="fld">
              <span>Кадр</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as FrameKind)}>
                {FRAME_KINDS.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </label>
            <label className="fld">
              <span>Переход</span>
              <select
                value={sl.transition ?? 'fade'}
                onChange={(e) => ((sl.transition = e.target.value as CutsceneTransition), commit())}
              >
                {TRANSITIONS.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="fld" data-tip="Пусто — по длине подписи или по озвучке">
              <span>Длительность, с</span>
              <input
                type="number"
                min={1}
                step={0.5}
                value={sl.duration ?? ''}
                placeholder={sl.voice ? 'по озвучке' : `авто ≈ ${auto}`}
                onChange={(e) => {
                  if (e.target.value === '') delete sl.duration
                  else sl.duration = Math.max(0.5, Number(e.target.value))
                  commit()
                }}
              />
            </label>
          </div>

          {(kind === 'art' || kind === 'image') && (
            <CameraEditor value={sl.camera} onChange={(v) => ((sl.camera = v), commit())} />
          )}

          {kind === 'art' && (
            <div className="art-preview-tools">
              <button className="btn btn-small" onClick={() => setShowJson((v) => !v)}>
                {showJson ? 'Скрыть JSON' : 'Расширенный JSON рисунка'}
              </button>
              <span className="muted small">Рисунок — слои примитивов в координатах 1280×720 (см. гайд для ИИ).</span>
            </div>
          )}
          {kind === 'art' && showJson && (
            <JsonField
              label="ArtDoc"
              rows={12}
              pretty
              value={sl.art}
              onChange={(v) => {
                if (v && typeof v === 'object') {
                  sl.art = v as ArtDoc
                  commit()
                }
              }}
            />
          )}
          {kind === 'image' && (
            <ImageUpload
              label="Изображение"
              value={sl.image ?? ''}
              dir="assets/img/cutscenes"
              store={store}
              onChange={(p) => ((sl.image = p), commit())}
            />
          )}
          {kind === 'video' && (
            <>
              <AssetUpload
                label="Видео слайда (файл или ссылка mp4 / YouTube)"
                value={sl.video ?? ''}
                dir="assets/video/cutscenes"
                store={store}
                kind="video"
                onChange={(p) => {
                  if (p) sl.video = p
                  else delete sl.video
                  commit()
                }}
              />
              <div className="warn-note">
                <Ico n="warn" />  Лучше загрузить файл — он вшивается в пакет и работает без сети.
                Ссылка на YouTube или внешний mp4 работает только онлайн.
              </div>
            </>
          )}

          <label className="fld fld-block">
            <span>Подпись (печатается поверх кадра, снизу)</span>
            <textarea rows={2} value={sl.text ?? ''} onChange={(e) => {
              if (e.target.value) sl.text = e.target.value
              else delete sl.text
              commit()
            }} />
          </label>
          <AudioUpload
            label="Озвучка слайда (необязательно)"
            value={sl.voice ?? ''}
            dir="assets/voice"
            store={store}
            onChange={(p) => {
              if (p) sl.voice = p
              else delete sl.voice
              commit()
            }}
          />
        </div>
      </div>
    </div>
  )
}
