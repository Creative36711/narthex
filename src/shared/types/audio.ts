import type { ArtDoc, CameraDoc } from './scene-art'


import type { TimeOfDay } from './world'


import type { Condition } from './rules'


// ───────────────────────── катсцены (итерация 8, блок E) ─────────────────────────

/** переход к слайду: резкая смена, затемнение, сдвиг, медленный наезд */
export type CutsceneTransition = 'cut' | 'fade' | 'slide' | 'panzoom'

/**
 * Слайд катсцены. Кадр — ОДНО из: `art` (ArtDoc, рисуется примитивами),
 * `image` (файл пакета или ссылка), `video` (mp4-ссылка или YouTube —
 * работает только онлайн). Без кадра — подпись на чёрном фоне.
 */
export interface CutsceneSlide {
  art?: ArtDoc
  image?: string
  video?: string
  /** подпись: печатается поверх кадра, снизу */
  text?: string
  /** озвучка слайда: файл пакета (assets/voice/…) или ссылка */
  voice?: string
  /** длительность в секундах; по умолчанию — по длине текста или озвучки */
  duration?: number
  /** кинематографическая камера фона слайда (пан-зум) */
  camera?: CameraDoc
  transition: CutsceneTransition
}

/**
 * Слайд-катсцена: запускается эффектом `play_cutscene` из правила или
 * диалога, показывается оверлеем поверх всего. Целиком описывается JSON'ом
 * (слайды — ArtDoc), поэтому её можно сгенерировать без единого файла.
 */
export interface CutsceneDef {
  id: string
  label: string
  /** музыка на всю катсцену: id трека реестра, файл пакета или ссылка */
  music?: string
  slides: CutsceneSlide[]
  /** глава (id из meta.chapters) — группировка в редакторе */
  chapter?: string
}

// ─────────────────── аудио: музыка, звуки, синтез (итерация 8, блок H) ───────────────────

/**
 * Параметрический SFX в духе ZzFX/jsfxr: числа в порядке параметров zzfx
 * (громкость, случайность, частота, атака/сустейн/декей, форма волны…).
 * Рендерится Web Audio на лету (с кэшем буфера). Ретро-характер приемлем.
 */
export interface SoundDoc {
  zzfx: number[]
}

/** настроение генеративного трека */
export type MusicMood = 'тревожная' | 'спокойная' | 'боевая' | 'торжественная' | 'таинственная'

// ─────────────── состояния портрета (реестр эмоций, фидбек 9.14) ───────────────

/**
 * Состояние портрета НПС: ключ картинки `npc.portrait[id]` и тег `# emotion:`
 * в диалоге. Общий реестр кампании — чтобы состояние, заведённое у одного НПС,
 * предлагалось в диалогах всех остальных, и ИИ-генератору было на что сослаться.
 */
export interface EmotionDef {
  id: string
  label: string
}

/**
 * Дефолтное состояние портрета — существует всегда, в реестр не входит
 * и в списке состояний не показывается. Картинка, загруженная персонажу,
 * попадает именно сюда.
 */
export const DEFAULT_EMOTION: EmotionDef = { id: 'neutral', label: 'Обычный' }
/** лад генеративного трека */
export type MusicScale = 'минор' | 'мажор' | 'дорийский' | 'фригийский' | 'пентатоника'
/** слои аранжировки */
export type MusicLayer = 'пад-аккорды' | 'арпеджио' | 'бас' | 'перкуссия'

/**
 * Высокоуровневый генеративный формат музыки (НЕ ноты вручную).
 * Рантайм-генератор собирает бесшовный эмбиент-луп по гамме — «мимо»
 * сыграть не может; детерминизм от `seed`.
 */
export interface MusicDoc {
  mood: MusicMood
  /** ударов в минуту (по умолчанию зависит от настроения) */
  tempo?: number
  /** тональность: "C", "D#", "Fis"… (по умолчанию — от настроения) */
  key?: string
  scale: MusicScale
  layers: MusicLayer[]
  /** аккордовая последовательность ступенями гаммы: ["i","VI","III","VII"] */
  progression?: string[]
  /** зерно случайности (одинаковый seed — одна и та же музыка) */
  seed?: number
}

/** источник звука: файл/ссылка ИЛИ синтез из JSON; массив — случайный вариант */
export type SoundSource = string | SoundDoc

export interface SoundDef {
  id: string
  label: string
  src: SoundSource | SoundSource[]
  /** зацикленный фон (птицы, гул): играет слоем, пока не остановят (фидбек 9.6) */
  loop?: boolean
}

/** источник музыки: файл/ссылка ИЛИ генеративный MusicDoc */
export type MusicSource = string | MusicDoc

export interface MusicTrackDef {
  id: string
  label: string
  src: MusicSource
  /** громкость трека 0…1 (поверх настроек игрока) */
  volume?: number
  /** зацикливать (один трек) или играть как плейлист */
  loop?: boolean
}

/** условие музыкальной записи (паттерн состояния; все условия — по «И») */
export interface MusicCondition {
  time_of_day?: TimeOfDay | TimeOfDay[]
  flag?: string
  not_flag?: string
  /** текущая погода (блок 9 ТЗ) */
  weather?: string
}

/**
 * Запись «условия → музыка» (у локации/сцены): `tracks` — ВСЕГДА список
 * (один трек — луп, несколько — плейлист со сменой и кроссфейдом,
 * `shuffle` — в случайном порядке без повтора подряд); побеждает первая
 * истинная запись.
 */
export interface MusicRule {
  tracks: string[]
  shuffle?: boolean
  /** условия переключения музыки: как специализированные (time_of_day, weather, flag), так и любые Condition движка */
  conditions?: Array<MusicCondition | Condition>
}

/** хуки звуков взаимодействий (звук сущности/категории/типа слота) — открытая строка с каскадом */
export type SoundHook = string

/** карта «хук → id звука реестра» */
export type SoundHookMap = Record<string, string>
