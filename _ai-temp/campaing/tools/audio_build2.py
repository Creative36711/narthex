#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Вторая волна звука для «Каркаса»: новые Kenney-звуки и три фоновые петли.

Что делает скрипт:
1. Копирует шесть новых коротких звуков из набора Kenney (CC0 1.0):
   страница, бумага, скрип, защёлка, цепь-лебёдка, котелок.
2. Собирает три фоновые петли из CC0-исходников и шума ffmpeg:
   `snd_pump_amb` — ритм работающих помп (шесть остальных всё ещё качают),
   `snd_drip`     — капли в сырых выработках,
   `snd_fire`     — треск жаровни и печки в Сухом ряду.
3. Регистрирует всё в реестре `campaign.sounds`.
4. Развешивает петли по сценам и локациям (`ambient`).
5. Привязывает короткие звуки к действиям предметов
   (`interact_options[].sound`).

Источники (CC0 1.0 Universal, прав не заявляем):
  * Kenney «Audio (295 files)» — репозиторий iwenzhou/kenney;
  * петли собраны из того же набора и из шумовых генераторов ffmpeg,
    то есть являются производными CC0-материалов.

Запуск: python3 tools/audio_build2.py
Клон Kenney ожидается в /tmp/kenney (или укажите KENNEY_DIR).
"""
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "audio")
SFX = os.path.join(OUT, "sfx")
AMB = os.path.join(OUT, "amb")
KENNEY = os.environ.get("KENNEY_DIR", "/tmp/kenney")
RPG = os.path.join(KENNEY, "Audio (295 files)", "RPG sounds (50 sounds)")
UI = os.path.join(KENNEY, "Audio (295 files)", "UI sounds (50 sounds)")

# id звука -> (файл Kenney, подпись в реестре)
ONE_SHOTS = {
    "snd_page":  ("bookFlip1.ogg", "Страница"),
    "snd_paper": ("bookOpen.ogg", "Бумага"),
    "snd_creak": ("creak1.ogg", "Скрип"),
    "snd_latch": ("metalPot2.ogg", "Защёлка"),
    "snd_chain": ("beltHandle1.ogg", "Цепь лебёдки"),
    "snd_pot":   ("metalPot3.ogg", "Котелок"),
}

# фоновая петля -> (длительность, сек) — собирается фильтрами ffmpeg
LOOPS = {"snd_pump_amb": 14.0, "snd_drip": 12.0, "snd_fire": 10.0}

# где какие петли звучат
SCENE_AMBIENT = {
    "scene_gate_hall":     ["snd_wind", "snd_drip"],
    "scene_gate_office":   ["snd_drip"],
    "scene_pump_hall":     ["snd_pump_amb"],
    "scene_pump_shaft":    ["snd_water_amb", "snd_drip"],
    "scene_pump_room":     ["snd_drip"],
    "scene_dry_row":       ["snd_fire"],
    "scene_flood_gallery": ["snd_water_amb", "snd_drip"],
    "scene_sluice":        ["snd_water_amb"],
    "scene_drift":         ["snd_drip"],
    "scene_face":          ["snd_drip"],
    "scene_office":        [],
    "scene_archive":       [],
}
LOCATION_AMBIENT = {
    "loc_surface": ["snd_wind"],
    "loc_gate":    ["snd_wind", "snd_drip"],
    "loc_pump7":   ["snd_pump_amb", "snd_water_amb"],
    "loc_ward8":   ["snd_water_amb", "snd_drip"],
    "loc_deep9":   ["snd_drip"],
}

# предмет -> (подпись действия, id звука)
ITEM_SOUNDS = {
    "item_board":       [("Прочесть объявления", "snd_page")],
    "item_case":        [("Поднять дело №136", "snd_paper"),
                         ("Сверить сводку по помпам", "snd_page"),
                         ("Записать в дело №137", "snd_page")],
    "item_cache":       [("Осмотреть замок", "snd_latch"),
                         ("Взломать крышку", "snd_creak")],
    "item_desk":        [("Разобрать бумаги", "snd_page")],
    "item_hoist":       [("Проверить подъёмник", "snd_chain")],
    "item_locker":      [("Вскрыть шкафчик", "snd_latch")],
    "item_resh_door":   [("Отпереть ключом", "snd_latch"),
                         ("Взломать замок", "snd_creak")],
    "item_resh_notes":  [("Прочесть записи", "snd_page")],
    "item_shelf":       [("Взять сводку по седьмой помпе", "snd_paper"),
                         ("Прочитать дело №136", "snd_page"),
                         ("Поискать ведомость седьмой", "snd_page")],
    "item_stove":       [("Согреться", "snd_pot"),
                         ("Вскипятить воду", "snd_pot")],
    "item_winch":       [("Проверить трос", "snd_chain")],
    "item_pipes":       [("Перекрыть узел", "snd_creak")],
    "item_sluice_mech": [("Осмотреть механизм", "snd_chain"),
                         ("Установить клапан", "snd_latch")],
    "item_niche":       [("Обыскать нишу", "snd_paper")],
    "item_pump_engine": [("Осмотреть привод", "snd_creak"),
                         ("Простучать корпус", "sfx_gear"),
                         ("Вставить сердцевину и запустить помпу", "snd_latch")],
    "item_bench":       [("Открыть мастерскую", "sfx_gear"),
                         ("Собрать заряд из сердцевины", "snd_latch")],
    "item_dead_guard":  [("Осмотреть тело", "sfx_water")],
}


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"


def run(cmd):
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode:
        print("ОШИБКА ffmpeg:\n", r.stderr.decode("utf-8", "replace")[-800:])
    return r.returncode == 0


def build_pump(ff, dst, dur):
    """Ритм работающих помп: рокот, пар и равномерные удары привода."""
    clank = os.path.join(RPG, "metalPot2.ogg")
    hits = [(t, v) for t, v in [(0, 1.0), (2000, 0.75), (3800, 0.9),
                                (5600, 0.7), (7600, 0.85), (9800, 0.65),
                                (12000, 0.8)]]
    parts, labels = [], []
    for i, (t, v) in enumerate(hits):
        parts.append(f"[2:a]atrim=0:0.35,asetpts=N/SR/TB,volume={v},"
                     f"adelay={t}|{t}[h{i}];")
        labels.append(f"[h{i}]")
    fc = ("[0:a]lowpass=f=170,volume=0.9[bed];"
          "[1:a]highpass=f=1200,lowpass=f=6500,volume=0.45,"
          "tremolo=f=0.3:d=0.5[hiss];"
          + "".join(parts)
          + "".join(labels) + f"amix=inputs={len(hits)}:normalize=0,"
          "aecho=0.8:0.85:380|900:0.32|0.2,lowpass=f=2400,volume=0.5[clank];"
          "[bed][hiss][clank]amix=inputs=3:normalize=0,"
          "loudnorm=I=-27:TP=-6[out]")
    cmd = [ff, "-y", "-v", "error",
           "-f", "lavfi", "-i", f"anoisesrc=d={dur}:c=pink:r=44100:a=0.09",
           "-f", "lavfi", "-i", f"anoisesrc=d={dur}:c=white:r=44100:a=0.025",
           "-i", clank,
           "-filter_complex", fc, "-map", "[out]",
           "-t", str(dur), "-ac", "2", "-codec:a", "libmp3lame",
           "-b:a", "64k", "-ar", "44100", dst]
    return run(cmd)


def build_drip(ff, dst, dur):
    """Капли: редкие звонкие капли на тихом гуле сырой выработки."""
    tick = os.path.join(UI, "click1.ogg")
    drops = [(300, 1.0), (1450, 0.7), (2600, 0.85), (4100, 0.6),
             (5300, 0.9), (7000, 0.65), (8600, 0.8), (10400, 0.55)]
    parts, labels = [], []
    for i, (t, v) in enumerate(drops):
        parts.append(f"[1:a]atrim=0:0.06,asetpts=N/SR/TB,asetrate=70560,"
                     f"aresample=44100,highpass=f=320,lowpass=f=2200,"
                     f"aecho=0.9:0.7:90|210:0.45|0.25,volume={v},"
                     f"adelay={t}|{t}[d{i}];")
        labels.append(f"[d{i}]")
    fc = ("[0:a]lowpass=f=300,volume=0.5[room];"
          + "".join(parts)
          + "".join(labels) + f"amix=inputs={len(drops)}:normalize=0[drops];"
          "[room][drops]amix=inputs=2:normalize=0,loudnorm=I=-30:TP=-8[out]")
    cmd = [ff, "-y", "-v", "error",
           "-f", "lavfi", "-i", f"anoisesrc=d={dur}:c=pink:r=44100:a=0.02",
           "-i", tick,
           "-filter_complex", fc, "-map", "[out]",
           "-t", str(dur), "-ac", "2", "-codec:a", "libmp3lame",
           "-b:a", "64k", "-ar", "44100", dst]
    return run(cmd)


def build_fire(ff, dst, dur):
    """Треск жаровни: низкий гул пламени и сухие щёлканья угля."""
    pop = os.path.join(UI, "click1.ogg")
    pops = [(2100, 0.5), (5400, 0.35), (8200, 0.45)]
    parts, labels = [], []
    for i, (t, v) in enumerate(pops):
        parts.append(f"[2:a]atrim=0:0.05,asetpts=N/SR/TB,lowpass=f=700,"
                     f"volume={v},adelay={t}|{t}[p{i}];")
        labels.append(f"[p{i}]")
    fc = ("[0:a]lowpass=f=800,tremolo=f=6:d=0.4,volume=0.9[low];"
          "[1:a]highpass=f=900,lowpass=f=5200,tremolo=f=9:d=0.85,"
          "volume=0.35[crackle];"
          + "".join(parts)
          + "".join(labels) + f"amix=inputs={len(pops)}:normalize=0[pops];"
          "[low][crackle][pops]amix=inputs=3:normalize=0,"
          "loudnorm=I=-28:TP=-6[out]")
    cmd = [ff, "-y", "-v", "error",
           "-f", "lavfi", "-i", f"anoisesrc=d={dur}:c=brown:r=44100:a=0.18",
           "-f", "lavfi", "-i", f"anoisesrc=d={dur}:c=white:r=44100:a=0.05",
           "-i", pop,
           "-filter_complex", fc, "-map", "[out]",
           "-t", str(dur), "-ac", "2", "-codec:a", "libmp3lame",
           "-b:a", "64k", "-ar", "44100", dst]
    return run(cmd)


BUILDERS = {"snd_pump_amb": build_pump, "snd_drip": build_drip, "snd_fire": build_fire}


def main():
    ff = ffmpeg()
    os.makedirs(SFX, exist_ok=True)
    os.makedirs(AMB, exist_ok=True)

    print("== короткие звуки (Kenney, CC0):")
    for sid, (fname, label) in ONE_SHOTS.items():
        src = os.path.join(RPG, fname)
        if not os.path.exists(src):
            sys.exit(f"нет файла {src} — укажите KENNEY_DIR с клоном iwenzhou/kenney")
        dst = os.path.join(SFX, sid + ".ogg")
        shutil.copyfile(src, dst)
        print(f"   {sid:14s} {os.path.getsize(dst)/1024:5.1f} КБ  {label} ({fname})")

    print("== фоновые петли (сборка из CC0 + шум ffmpeg):")
    for sid, dur in LOOPS.items():
        dst = os.path.join(AMB, sid + ".mp3")
        if not BUILDERS[sid](ff, dst, dur):
            return 1
        print(f"   {sid:14s} {os.path.getsize(dst)/1024:5.1f} КБ  {dur:.0f} с")

    # ------------------------------------------------------------- реестр
    camp_path = os.path.join(ROOT, "campaign.json")
    camp = json.load(open(camp_path, encoding="utf-8"))
    known = {s["id"]: s for s in camp["sounds"]}
    for sid, (_, label) in ONE_SHOTS.items():
        known[sid] = {"id": sid, "label": label, "src": f"assets/audio/sfx/{sid}.ogg"}
    labels = {"snd_pump_amb": "Работа помп (фон)",
              "snd_drip": "Капли в выработке (фон)",
              "snd_fire": "Жаровня (фон)"}
    for sid in LOOPS:
        known[sid] = {"id": sid, "label": labels[sid], "loop": True,
                      "src": f"assets/audio/amb/{sid}.mp3"}
    order = list(known)
    camp["sounds"] = [known[i] for i in sorted(
        order, key=lambda i: (not i.startswith("sfx_"), i))]
    json.dump(camp, open(camp_path, "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    open(camp_path, "a").write("\n")
    print(f"\nреестр звуков: {len(camp['sounds'])}")

    # ------------------------------------------------------------- ambient
    print("== ambient сцен:")
    for sid, amb in SCENE_AMBIENT.items():
        p = os.path.join(ROOT, "scenes", sid + ".json")
        d = json.load(open(p, encoding="utf-8"))
        d["ambient"] = amb
        json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        open(p, "a").write("\n")
        print(f"   {sid:20s} {amb or '—'}")

    print("== ambient локаций:")
    w = json.load(open(os.path.join(ROOT, "world.json"), encoding="utf-8"))
    for r in w["regions"]:
        for l in r["locations"]:
            if l["id"] in LOCATION_AMBIENT:
                l["ambient"] = LOCATION_AMBIENT[l["id"]]
                print(f"   {l['id']:14s} {l['ambient']}")
    json.dump(w, open(os.path.join(ROOT, "world.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    open(os.path.join(ROOT, "world.json"), "a").write("\n")

    # --------------------------------------------------------- звуки предметов
    print("== звуки действий предметов:")
    wired = 0
    for eid, opts in ITEM_SOUNDS.items():
        p = os.path.join(ROOT, "entities", eid + ".json")
        d = json.load(open(p, encoding="utf-8"))
        for io in d.get("interact_options", []):
            for label, sid in opts:
                if io.get("label") == label:
                    io["sound"] = sid
                    wired += 1
        json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        open(p, "a").write("\n")
    print(f"   привязано действий: {wired}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
