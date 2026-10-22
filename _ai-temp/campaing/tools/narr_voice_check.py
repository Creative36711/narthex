"""Какие реплики рассказчика записаны СТАРЫМ голосом (= voice-15), а какие — голосом voice-03 (к переозвучке).
Простейший классификатор тембра: MFCC (среднее и разброс), z-нормировка, косинус к двум центроидам.
Эталоны A — старый рассказчик, B — voice-03. После переозвучки файл должен попасть в A.
Запуск: pip install --break-system-packages miniaudio librosa numpy; python3 tools/narr_voice_check.py
"""
import os, sys, numpy as np, miniaudio, librosa
sys.path.insert(0, os.path.dirname(__file__))
from narr_list import out as NARR
V = 'assets/voice/'
A = ['prologue_1', 'prologue_2', 'prologue_3', 'intro_gate_hall_1', 'intro_gate_hall_2', 'intro_sluice_1', 'final_pump_1']
B = ['narr_glazier_1', 'narr_glazier_2', 'final_silence_3', 'narr_resh_3', 'narr_vex_3', 'narr_vex_4', 'narr_kast_8', 'narr_ira_9', 'narr_ira_10', 'narr_ira_11']
# Эталоны B, уже переозвученные голосом voice-15, перестают быть эталонами — держим их копии в git-истории:
B_REF_COMMIT = '9955184'
def emb_y(y):
    y, _ = librosa.effects.trim(y, top_db=30)
    m = librosa.feature.mfcc(y=y, sr=16000, n_mfcc=24)
    e = librosa.feature.rms(y=y)[0]; k = e > np.percentile(e, 40)
    m = m[:, :len(k)][:, k]
    return np.concatenate([m.mean(1)[1:], m.std(1)[1:]])
def load(p):
    d = miniaudio.decode_file(p, output_format=miniaudio.SampleFormat.FLOAT32, nchannels=1, sample_rate=16000)
    return np.array(d.samples, dtype=np.float32)
def load_ref(name):
    import subprocess, tempfile
    data = subprocess.run(['git', 'show', f'{B_REF_COMMIT}:{V}{name}.mp3'], capture_output=True).stdout
    t = tempfile.NamedTemporaryFile(suffix='.mp3', delete=False); t.write(data); t.close()
    return load(t.name)
EA = [emb_y(load_ref(n)) for n in A]; EB = [emb_y(load_ref(n)) for n in B]
X = np.array(EA + EB); mu = X.mean(0); sd = X.std(0) + 1e-6
z = lambda v: (v - mu) / sd
cA = np.mean([z(e) for e in EA], 0)
cos = lambda a, b: float(a @ b / np.linalg.norm(a) / np.linalg.norm(b))
old, todo = [], []
for f in sorted(NARR):
    p = V + f
    if not os.path.exists(p): print('НЕТ ФАЙЛА', f); continue
    s = cos(z(emb_y(load(p))), cA)
    (old if s > 0 else todo).append((f, round(s, 2)))
print(f'старый голос (voice-15): {len(old)}; к переозвучке (voice-03 и др.): {len(todo)}')
for f, s in todo: print('  ', f, s)
