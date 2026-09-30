/**
 * Настройки игрока (итерация 8, блоки G/H): громкость общая/музыка/эффекты/
 * голос, озвучка реплик файлами и синтезатором браузера (Web Speech API).
 * Хранение — shared/settings.ts (localStorage); открывается из главного меню
 * и HUD. Никаких prompt/confirm/alert — обычный React-оверлей.
 */
import { Ico } from './icons'
import { useState } from 'react'
import { setSettings, useSettings, type PlayerSettings } from './settings'
import { speak, ttsSupported, useTtsVoices } from './speech'
import { applyMusicVolume } from './music'

interface Props {
  open: boolean
  onClose: () => void
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <span className="settings-label">{label}</span>
      <div className="settings-control">{children}</div>
    </div>
  )
}

function VolumeSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Row label={label}>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      <span className="settings-num">{Math.round(value * 100)}%</span>
    </Row>
  )
}

export function SettingsPanel({ open, onClose }: Props) {
  const s = useSettings()
  const voices = useTtsVoices()
  const [testing, setTesting] = useState(false)
  if (!open) return null

  const patch = (p: Partial<PlayerSettings>) => setSettings(p)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box settings-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title"><Ico n="settings" />  Настройки</div>

        <VolumeSlider label="Общая громкость" value={s.volume} onChange={(v) => patch({ volume: v })} />
        <VolumeSlider label="Музыка" value={s.music_volume} onChange={(v) => { patch({ music_volume: v }); applyMusicVolume() }} />
        <VolumeSlider label="Звуковые эффекты" value={s.sfx_volume} onChange={(v) => patch({ sfx_volume: v })} />
        <VolumeSlider label="Голос (озвучка реплик)" value={s.voice_volume} onChange={(v) => patch({ voice_volume: v })} />

        <Row label="Озвучка">
          <label className="fld-check small">
            <input type="checkbox" checked={!s.voice_muted} onChange={(e) => patch({ voice_muted: !e.target.checked })} />
            <span>включена (файлы озвучки реплик и слайдов)</span>
          </label>
        </Row>

        <Row label="Анимации">
          <label className="fld-check small">
            <input type="checkbox" checked={s.animations} onChange={(e) => patch({ animations: e.target.checked })} />
            <span>движение интерфейса включено</span>
          </label>
        </Row>

        <Row label="Размер текста">
          <select value={s.text_scale} onChange={(e) => patch({ text_scale: Number(e.target.value) })}>
            <option value={0.9}>Мельче</option>
            <option value={1}>Обычный</option>
            <option value={1.15}>Крупнее</option>
          </select>
        </Row>

        <div className="settings-divider">Синтезатор речи (Web Speech)</div>

        {ttsSupported() ? (
          <>
            <Row label="Озвучивать реплики и подписи катсцен без файла синтезатором">
              <label className="fld-check small">
                <input type="checkbox" checked={s.tts_enabled} onChange={(e) => patch({ tts_enabled: e.target.checked })} />
                <span>включить</span>
              </label>
            </Row>
            <Row label="Голос">
              <select
                value={s.tts_voice}
                disabled={!s.tts_enabled}
                onChange={(e) => patch({ tts_voice: e.target.value })}
              >
                <option value="">Авто (русский по умолчанию)</option>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Скорость речи">
              <input
                type="range"
                min={50}
                max={200}
                value={Math.round(s.tts_rate * 100)}
                disabled={!s.tts_enabled}
                onChange={(e) => patch({ tts_rate: Number(e.target.value) / 100 })}
              />
              <span className="settings-num">{s.tts_rate.toFixed(1)}×</span>
            </Row>
            <Row label="Проверка">
              <button
                className="btn btn-small"
                disabled={testing}
                onClick={() => {
                  setTesting(true)
                  speak('Проверка голоса. Здравствуй, путник!', {
                    voice: s.tts_voice,
                    rate: s.tts_rate,
                    volume: s.voice_muted ? 0 : s.volume * s.voice_volume,
                    onEnd: () => setTesting(false),
                  })
                }}
              >
                <Ico n="sound" />  Прослушать
              </button>
            </Row>
          </>
        ) : (
          <div className="muted small">Браузер не поддерживает синтез речи (Web Speech API).</div>
        )}

        <div className="modal-buttons">
          <button className="btn btn-small btn-primary" onClick={onClose}>
            Готово
          </button>
        </div>
      </div>
    </div>
  )
}
