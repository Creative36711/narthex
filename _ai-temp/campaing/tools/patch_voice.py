#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Привязывает озвучку к репликам и кадрам катсцен.

Одновременно правит три места:
  * dialogues/<имя>.dlg.json — поле `voice` у строки реплики (конструктор);
  * dialogues/<имя>.ink     — тег `# voice: путь` в конце строки (движок);
  * cutscenes/*.json        — поле `voice` у слайда.

Сопоставление идёт по точному тексту реплики, поэтому текст клипа
должен совпадать с текстом строки один в один.
Запуск: python3 tools/patch_voice.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# диалог -> [(текст реплики, файл озвучки)]
LINES = {
    "vex": [("Ты из конторы? Спускайся, там тепло. Здесь только сквозняк и чужие.",
             "assets/voice/vex_1.mp3"),
            ("Без записи: я своим журналом отвечаю за каждого, кто прошёл.",
             "assets/voice/vex_2.mp3")],
    "kell": [("Помпа не моя. Иди, смотри. Только вниз не суйся: там не наша вода.",
              "assets/voice/kell_1.mp3"),
             ("Это когда ярус закрывают и считают, сколько в нём осталось людей.",
              "assets/voice/kell_2.mp3"),
             ("Не я. Приказ есть приказ: закрыть затвор, никого не выпускать. "
              "Он не послушал. Я не спрашивал, почему.", "assets/voice/kell_3.mp3")],
    "zhuk": [("Не Келл. Келл — руки, а руки дешёвые. Бумага дорогая.",
              "assets/voice/zhuk_1.mp3"),
             ("Ищи, кто подписал расход на режим тишины. Кто подписал, тот и заказал.",
              "assets/voice/zhuk_2.mp3"),
             ("Ниже восьмого. Там, где жила поёт. Хочешь — спускайся, хочешь — живи.",
              "assets/voice/zhuk_3.mp3")],
    "dozh": [("Слышно, что она молчит. А про молчание внизу всегда слышно громче.",
              "assets/voice/dozh_1.mp3"),
             ("Дыхатель — это не товар, это время. Держи, не задохнись.",
              "assets/voice/dozh_2.mp3")],
    "ayla": [("Сядь. У тебя ссадина на костяшках и вид человека, который не спал двое суток.",
              "assets/voice/ayla_1.mp3"),
             ("Яров? Приходил за бинтами тринадцатого, вечером. Уходил не один — со стражей.",
              "assets/voice/ayla_2.mp3")],
    "registrar": [("Назовите номер дела, шифр или дату. Говорите чётко: я пишу, как слышу.",
                   "assets/voice/registrar_1.mp3")],
    "ira": [("Ты насчёт помпы? Я уже всё рассказала старшине. Он велел не мешать.",
             "assets/voice/ira_1.mp3"),
            ("В девятнадцать десять помпа встала. В двадцать ноль-ноль в зал зашёл "
             "Келл со взводом и велел всем выйти.", "assets/voice/ira_2.mp3"),
            ("Спасибо. За то, что не написал «погиб при исполнении». Он не при исполнении.",
             "assets/voice/ira_3.mp3")],
    "kast": [("Дело сто тридцать семь. У тебя семьдесят два часа, дознаватель. Говори коротко.",
              "assets/voice/kast_1.mp3"),
             ("Если бы я знала, ты бы здесь не стоял. Найди — и приведи. "
              "Живым желательно, но мне хватит и вины.", "assets/voice/kast_2.mp3")],
    "resh": [("Ты пришёл меня арестовать или послушать? Арестовывать удобнее: "
              "для этого не надо понимать.", "assets/voice/resh_1.mp3"),
             ("Я снял сердцевину. Пока затвор не ходит, помпу пускать нельзя: "
              "вода пойдёт в восьмой и не вернётся.", "assets/voice/resh_2.mp3"),
             ("Жила на девятом не выработана, она живая. Если её взять, восьмой сядет. "
              "Мне сказали: «сядет — значит, переселим».", "assets/voice/resh_3.mp3")],
    "vein": [("Ты пришёл с чужим жетоном и чужим сроком. Я помню всех, кто брал.",
              "assets/voice/vein_1.mp3"),
             ("Ты молчишь. Я слышала этот ответ от всех, кто брал. Он всегда означал «дам».",
              "assets/voice/vein_2.mp3")],
}

# ход 10: вторая волна озвучки (дополняет LINES)
WAVE_10 = {
    "registrar": [
        ("Дело сто тридцать шесть. Затопление девятого яруса. Исполнено. Подпись: инспектор Каст.",
         "assets/voice/registrar_2.mp3"),
        ("Расход мазута, смены мастера Реша Э. Пометка: «режим тишины — см. приложение». Приложение изъято.",
         "assets/voice/registrar_3.mp3")
    ],
    "vex": [
        ("Мастер твой Реш спустился в шахту в восемнадцать сорок. Я его сам записал. Обратно — не записал.",
         "assets/voice/vex_3.mp3"),
        ("Взвод Келла Ястреба. Двенадцать человек, все с клеймом стражи. Шли вниз, а запись делали наверх — так быстрее, сказал старшина.",
         "assets/voice/vex_4.mp3")
    ],
    "resh": [
        ("Помпы её откачивают, как кровь откачивают из раны. Мы сорок лет делали каркасу больно, чтобы он стоял.",
         "assets/voice/resh_4.mp3"),
        ("Нет. Ты её вставишь, и восьмой ярус утонет за ночь. Я сорок лет слушал, как дышит город.",
         "assets/voice/resh_5.mp3")
    ],
    "vein": [
        ("Я то, что было здесь до города, и то, что будет после. Вы называете это жилой, потому что вам нужно что-то вынимать.",
         "assets/voice/vein_3.mp3"),
        ("Бери. И помни: я помню всех, кто брал, — и всех, кто вернул.",
         "assets/voice/vein_4.mp3")
    ],
    "kast": [
        ("Подписала. И подпишу ещё: порядок дороже правды, потому что правда не держит воду.",
         "assets/voice/kast_3.mp3")
    ],
    "kell": [
        ("Двенадцать человек, седьмой ярус, с двадцати до шести. Моя подпись стоит второй.",
         "assets/voice/kell_4.mp3")
    ]
}

for _k, _v in WAVE_10.items():
    LINES.setdefault(_k, []).extend(_v)

# катсцена -> [(индекс слайда, файл озвучки)]
SLIDES = {
    "cutscene_intro": [(0, "assets/voice/prologue_1.mp3"),
                       (1, "assets/voice/prologue_2.mp3"),
                       (2, "assets/voice/prologue_3.mp3")],
    "cutscene_final_vein": [(0, "assets/voice/final_vein_1.mp3")],
    "cutscene_revelation": [(0, "assets/voice/rev_1.mp3"),
                            (1, "assets/voice/rev_2.mp3"),
                            (2, "assets/voice/rev_3.mp3")],
}


def load(p):
    return json.load(open(p, encoding="utf-8"))


def save(p, o):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(o, f, ensure_ascii=False, indent=1)


def patch_dlg(name, pairs):
    dpath = os.path.join(ROOT, "dialogues", name + ".dlg.json")
    if not os.path.exists(dpath):
        print("нет файла", dpath)
        return []
    doc = load(dpath)
    hit = set()
    for node in doc["nodes"]:
        secs = list(node.get("sections", []))
        for ch in node.get("choices", []):
            secs += list(ch.get("sections", []))
            ck = ch.get("check") or {}
            for br in ("success", "fail"):
                secs += list((ck.get(br) or {}).get("sections", []))
        for sec in secs:
            for step in sec.get("steps", []):
                if step["kind"] != "line":
                    continue
                for text, vf in pairs:
                    if step["line"]["text"] == text:
                        step["line"]["voice"] = vf
                        hit.add(vf)
    save(dpath, doc)
    return hit


def patch_ink(name, pairs):
    ipath = os.path.join(ROOT, "dialogues", name + ".ink")
    if not os.path.exists(ipath):
        print("нет файла", ipath)
        return
    lines = open(ipath, encoding="utf-8").read().split("\n")
    for text, vf in pairs:
        base = text  # текст реплики без тегов
        done = False
        for i, ln in enumerate(lines):
            s = ln.strip()
            if not s or s.startswith(("EXTERNAL", "VAR", "===", "->", "+", "*", "~", "{", "- ")):
                continue
            # отсекаем уже существующие теги
            clean = s.split(" # ")[0].strip()
            if clean == base:
                if "# voice:" in s:      # уже озвучено — ничего не делаем
                    done = True
                    break
                lines[i] = s + " # voice: " + vf
                done = True
                break
        if not done:
            print(f"  ВНИМАНИЕ: в {name}.ink не найдена строка «{base[:40]}…»")

    with open(ipath, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def main():
    for name, pairs in LINES.items():
        for _, vf in pairs:
            if not os.path.exists(os.path.join(ROOT, vf)):
                print("нет файла озвучки:", vf)
        hit = patch_dlg(name, pairs)
        patch_ink(name, pairs)
        print(f"{name}: озвучено реплик — {len(hit)} из {len(pairs)}")

    for cid, pairs in SLIDES.items():
        p = os.path.join(ROOT, "cutscenes", cid + ".json")
        if not os.path.exists(p):
            print("нет катсцены", cid)
            continue
        c = load(p)
        for idx, vf in pairs:
            c["slides"][idx]["voice"] = vf
        save(p, c)
        print(f"{cid}: озвучено слайдов — {len(pairs)}")


if __name__ == "__main__":
    main()
