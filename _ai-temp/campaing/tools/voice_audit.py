#!/usr/bin/env python3
"""Аудит озвучки: (1) совпадает ли то, что ЗВУЧИТ в mp3, с текстом реплики; (2) одним ли голосом озвучен персонаж.

Подготовка (пакеты и модель не сохраняются между ходами песочницы):
  pip install --break-system-packages vosk miniaudio rapidfuzz numpy scikit-learn torch librosa webrtcvad-wheels
  pip install --break-system-packages --no-deps resemblyzer
  # русская модель Vosk (88 МБ) лежит закоммиченной в публичном репозитории; качаем блобы через API:
  python3 tools/voice_audit.py --fetch-model          # -> /tmp/vm/vosk-model-small-ru-0.22

Запуск:
  python3 tools/voice_audit.py text  [файлы…]   # распознаёт речь и печатает реплики, где текст ≠ аудио
  python3 tools/voice_audit.py voice [файлы…]   # близость голоса к эталону персонажа (текущий voice-id)
Кэш распознавания: _ai-temp/voice_asr_cache.json (ключ — имя+размер файла).
"""
import os, re, sys, json, glob, difflib, subprocess

MODEL = '/tmp/vm/vosk-model-small-ru-0.22'
CACHE = '_ai-temp/voice_asr_cache.json'
VOICE_TAG = re.compile(r'#\s*voice:\s*(\S+)')

# Эталоны текущих голосов (озвучены выбранными voice-id). Обновлять по мере переозвучки.
REFERENCE = {
    'narr':    ['narr_glazier_1', 'narr_glazier_2', 'final_silence_3', 'narr_resh_3', 'narr_vex_3', 'narr_kast_8', 'narr_ira_10', 'narr_ira_11'],  # voice-03
    'vex':     ['vex_%d' % i for i in range(12, 21)],                                  # voice-06
    'zhuk':    ['zhuk_%d' % i for i in (12, 14, 15, 16, 17, 18, 19)],                  # voice-05
    'ira':     ['ira_%d' % i for i in range(18, 31)],                                  # voice-07
    'kast':    ['kast_18', 'kast_19', 'kast_20', 'kast_21'],                           # voice-07
    'resh':    ['resh_2', 'resh_4', 'resh_11', 'resh_14', 'resh_15', 'resh_16', 'resh_17'],  # voice-04
    'dozh':    ['dozh_1', 'dozh_8', 'dozh_14', 'dozh_15', 'dozh_16'],                  # voice-04
    'glazier': ['glazier_%d' % i for i in range(1, 8)],                                # voice-08
}
NARR_PREFIX = ('narr_', 'intro_', 'prologue', 'final_', 'flood_', 'rev_')


def speaker(fn):
    b = os.path.basename(fn)[:-4]
    return 'narr' if b.startswith(NARR_PREFIX) else re.sub(r'_[^_]*$', '', b)


def fetch_model():
    repo = 'LisovskiyIvan/skibidi'
    tree = json.loads(subprocess.check_output(['gh', 'api', f'repos/{repo}/git/trees/HEAD?recursive=1']))['tree']
    for t in tree:
        if t['type'] == 'blob' and t['path'].startswith('vosk-model-small-ru-0.22/'):
            dst = os.path.join('/tmp/vm', t['path'])
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            with open(dst, 'wb') as f:
                f.write(subprocess.check_output(['gh', 'api', '-H', 'Accept: application/vnd.github.raw',
                                                 f"repos/{repo}/git/blobs/{t['sha']}"]))
    print('model ->', MODEL)


def refs():
    """voice-файл -> [(источник, текст)] из ink и JSON (катсцены, сцены, правила)."""
    out = {}
    for ink in glob.glob('dialogues/*.ink'):
        for ln, line in enumerate(open(ink, encoding='utf-8'), 1):
            m = VOICE_TAG.search(line)
            if m:
                t = line.split('#')[0].strip()
                if t.startswith(('*', '+')):
                    t = re.sub(r'^[\*\+\-\s]*(\{[^}]*\})?\s*(\[[^\]]*\])?\s*', '', t)
                out.setdefault(os.path.basename(m.group(1)), []).append((f'{ink}:{ln}', t))

    def walk(o, src):
        if isinstance(o, dict):
            v = o.get('voice')
            if isinstance(v, str) and 'assets/voice/' in v:
                out.setdefault(os.path.basename(v), []).append((src, o.get('text') or o.get('caption') or o.get('narration') or ''))
            for x in o.values():
                walk(x, src)
        elif isinstance(o, list):
            for x in o:
                walk(x, src)
    for f in glob.glob('**/*.json', recursive=True):
        if f.startswith(('_ai-temp', '__chronicle_ai__')) or f.endswith('.dlg.json'):
            continue
        try:
            walk(json.load(open(f, encoding='utf-8')), f)
        except Exception:
            pass
    return out


def decode(p):
    import miniaudio, numpy as np
    d = miniaudio.decode_file(p, output_format=miniaudio.SampleFormat.FLOAT32, nchannels=1, sample_rate=16000)
    return np.array(d.samples, dtype=np.float32)


def transcribe(files):
    import vosk, numpy as np
    vosk.SetLogLevel(-1)
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    model = None
    for p in files:
        key = f'{os.path.basename(p)}:{os.path.getsize(p)}'
        if key in cache:
            continue
        model = model or vosk.Model(MODEL)
        r = vosk.KaldiRecognizer(model, 16000)
        b = (decode(p) * 32767).astype('int16').tobytes()
        parts = []
        for i in range(0, len(b), 32000):
            if r.AcceptWaveform(b[i:i + 32000]):
                parts.append(json.loads(r.Result())['text'])
        parts.append(json.loads(r.FinalResult())['text'])
        cache[key] = ' '.join(x for x in parts if x)
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    json.dump(cache, open(CACHE, 'w'), ensure_ascii=False, indent=1)
    return {os.path.basename(p): cache[f'{os.path.basename(p)}:{os.path.getsize(p)}'] for p in files}


def norm(s):
    s = s.lower().replace('ё', 'е')
    return re.sub(r'[^а-яa-z0-9 ]', ' ', s).split()


def cmd_text(names):
    R = refs()
    files = [f'assets/voice/{n if n.endswith(".mp3") else n + ".mp3"}' for n in names] if names else \
        sorted(f'assets/voice/{k}' for k in R if os.path.exists(f'assets/voice/{k}'))
    asr = transcribe(files)
    bad = 0
    for f, heard in sorted(asr.items()):
        for src, text in R.get(f, []):
            a, b = norm(heard), norm(text)
            chunks = [(op, ' '.join(a[i1:i2]), ' '.join(b[j1:j2]))
                      for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes()
                      if op != 'equal' and max(i2 - i1, j2 - j1) >= 3]   # 1–2 слова — обычно ошибки распознавания
            if chunks:
                bad += 1
                print(f'{f}  ({src})\n  ТЕКСТ: {text}\n  АУДИО: {heard}')
                for c in chunks:
                    print('   ', c)
    print(f'\nПодозрительных реплик: {bad} (проверь вручную: Vosk путает имена и окончания)')


def cmd_voice(names):
    import numpy as np
    from resemblyzer import VoiceEncoder, preprocess_wav
    enc = VoiceEncoder('cpu', verbose=False)
    emb = lambda p: enc.embed_utterance(preprocess_wav(decode(p), source_sr=16000))
    cent = {}
    for s, ns in REFERENCE.items():
        X = np.array([emb(f'assets/voice/{n}.mp3') for n in ns])
        c = X.mean(0)
        cent[s] = c / np.linalg.norm(c)
    files = [f'assets/voice/{n if n.endswith(".mp3") else n + ".mp3"}' for n in names] if names else \
        sorted(glob.glob('assets/voice/*.mp3'))
    for p in files:
        s = speaker(p)
        if s not in cent:
            continue
        e = emb(p)
        sim = float(e @ cent[s])
        print(f'{os.path.basename(p):28s} {s:8s} {sim:.2f} {"OK" if sim >= 0.85 else "ДРУГОЙ ГОЛОС?"}')


if __name__ == '__main__':
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    if len(sys.argv) < 2 or sys.argv[1] not in ('text', 'voice', '--fetch-model'):
        print(__doc__)
        sys.exit(1)
    if sys.argv[1] == '--fetch-model':
        fetch_model()
    elif sys.argv[1] == 'text':
        cmd_text(sys.argv[2:])
    else:
        cmd_voice(sys.argv[2:])
