"""Роботизация голоса Регистратора (автомат архива со стеклянными глазами).

Цепочка (реальная запись TTS, никакого синтеза речи с нуля — только обработка):
  1. частичная кольцевая модуляция 50 Гц — металлический «зуб» механизма;
  2. гребенчатый фильтр 3,1 мс с обратной связью — жестяной резонанс корпуса;
  3. полоса 280–3800 Гц — голос из раструба;
  4. лёгкое «зерно»: удержание отсчёта ×2 и 11 бит;
  5. громкость подгоняется под исходную (по RMS), пики мягко ограничены (tanh) до −1 дБ.

Сухие исходники НЕ хранятся в пакете: берутся из git (коммит DRY_REV — последняя
версия до обработки), поэтому повторный запуск не «роботизирует дважды».

  python3 tools/robot_voice.py                    # все registrar_*.mp3 из DRY_REV
  python3 tools/robot_voice.py in.mp3 out.mp3     # новая реплика (сухой файл → готовый)
Нужны: pip install miniaudio lameenc numpy scipy
"""
import sys, glob, os, subprocess, tempfile
import numpy as np, miniaudio, lameenc
from scipy.signal import butter, sosfilt, lfilter

DRY_REV = "985b94f"          # сухие registrar_1..10 (голос voice-13), до роботизации
SR = 24000


def decode(path):
    d = miniaudio.decode_file(path, output_format=miniaudio.SampleFormat.FLOAT32, nchannels=1, sample_rate=SR)
    return np.frombuffer(d.samples, dtype=np.float32).astype(np.float64)


def robot(x):
    t = np.arange(len(x)) / SR
    ring = x * np.sin(2 * np.pi * 50 * t)
    y = 0.62 * x + 0.55 * ring                                   # 1
    D = int(0.0031 * SR)                                          # 2
    b = np.zeros(D + 1); b[0] = 1.0
    a = np.zeros(D + 1); a[0] = 1.0; a[D] = -0.42
    y = lfilter(b, a, y)
    y = sosfilt(butter(4, [280, 3800], btype="band", fs=SR, output="sos"), y)   # 3
    y = np.repeat(y[::2], 2)[: len(y)]                           # 4
    q = 2 ** 10
    y = np.round(y * q) / q
    rms_x = np.sqrt(np.mean(x ** 2)) + 1e-9                       # 5
    rms_y = np.sqrt(np.mean(y ** 2)) + 1e-9
    y *= rms_x / rms_y
    y = 0.89 * np.tanh(y / 0.89)                                  # мягкий лимитер вместо срезания громкости
    return y


def encode(y, path):
    enc = lameenc.Encoder()
    enc.set_bit_rate(64); enc.set_in_sample_rate(SR); enc.set_channels(1); enc.set_quality(2)
    pcm = (np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes()
    open(path, "wb").write(enc.encode(pcm) + enc.flush())


def from_git(rel):
    data = subprocess.run(["git", "show", f"{DRY_REV}:{rel}"], capture_output=True, check=True).stdout
    f = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False); f.write(data); f.close()
    return f.name


if __name__ == "__main__":
    if len(sys.argv) == 3:
        encode(robot(decode(sys.argv[1])), sys.argv[2]); print("ok", sys.argv[2])
    else:
        for i in range(1, 11):
            rel = f"assets/voice/registrar_{i}.mp3"
            src = from_git(rel)
            x = decode(src); os.unlink(src)
            encode(robot(x), rel)
            print(rel, f"{len(x)/SR:.2f} c")
