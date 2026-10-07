#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ход 19: десять новых реплик (новое содержание + озвучка).

Все spoken-реплики кампании уже озвучены; неозвученное, что осталось, —
это ремарки (`action: true`), а их в кампании принципиально не читают
голосом: это текст от автора, а не голос персонажа. Чтобы не тратить квоту
впустую, добавляем новые spoken-реплики — они же новое содержание.

Что дают новые реплики:
- регистратор произносит вслух срок дознания — ровно в тот ход, когда
  движок научился показывать обратный отсчёт в HUD;
- жила впервые называет цифру: сто тридцать семь лет, которые её качали;
- Айла предупреждает про настой и про бессонницу (связка с её рецептом);
- Векс объясняет, как врёт журнал;
- Реш проговаривает главное различие дела: «не чинили» и «не давали ходу»;
- Ира просит не называть брата погибшим.

Правятся оба источника: `.dlg.json` и `.ink` (конструктор собирает ink
из json, движок исполняет ink). Скрипт перезапускаемый: реплика не
добавляется дважды.

Запуск: python3 tools/content19.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (диалог, узел, начало реплики-якоря, [(текст новой реплики, файл голоса)])
ADD = [
    ("registrar", "Начало", "Назовите номер дела", [
        ("Срок дознания по делу сто тридцать семь — семьдесят два часа. "
         "Он идёт, пока вы стоите и молчите.", "assets/voice/registrar_8.mp3"),
    ]),
    ("vein", "Начало", "Ты пришёл с чужим жетоном", [
        ("Семь помп считали мои годы. Когда седьмая замолчала, я впервые "
         "за сто тридцать семь лет услышала, как тихо.", "assets/voice/vein_6.mp3"),
    ]),
    ("vein", "Молчание", "Ты молчишь. Я слышала", [
        ("Молчание — тоже ответ. Просто не тот, который ты надеялся дать.",
         "assets/voice/vein_7.mp3"),
    ]),
    ("ayla", "Начало", "Сядь. У тебя ссадина", [
        ("Двое суток без сна — это полдела. За трое начинают мерещиться вещи, "
         "которые потом вносят в протокол.", "assets/voice/ayla_8.mp3"),
        ("Если пойдёшь на девятый, возьми мой настой. Он не от воды. Он от того, "
         "что в воде.", "assets/voice/ayla_9.mp3"),
    ]),
    ("vex", "Начало", "Я своим журналом отвечаю", [
        ("Журнал врёт редко. Чаще его просто не дописывают до конца смены.",
         "assets/voice/vex_10.mp3"),
        ("Ты спускался ниже седьмого? Нет? Тогда не спорь со мной про воду.",
         "assets/voice/vex_11.mp3"),
    ]),
    ("resh", "Начало", "Ты пришёл меня арестовать", [
        ("Семёрку не чинили, потому что ей не давали ходу. Это разные вещи, "
         "и разница между ними стоит семьдесят два часа.", "assets/voice/resh_12.mp3"),
        ("Я не прятался. Я ждал, пока кто-нибудь спустится и задаст правильный "
         "вопрос.", "assets/voice/resh_13.mp3"),
    ]),
    ("ira", "Брат", "Говори. Ты же не просто так", [
        ("Только не говори «погиб». Это про него уже сказали, а я его ещё не видела.",
         "assets/voice/ira_15.mp3"),
    ]),
]


def load(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return json.load(f)


def save(rel, data):
    with open(os.path.join(ROOT, rel), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def patch_json(name, node_id, anchor, pairs):
    doc = load("dialogues/%s.dlg.json" % name)
    node = None
    for n in doc["nodes"]:
        if n.get("id") == node_id:
            node = n
            break
    if node is None:
        return -1
    added = 0
    for sec in node.get("sections") or []:
        steps = sec.get("steps") or []
        for i, st in enumerate(steps):
            ln = st.get("line") or {}
            if (ln.get("text") or "").startswith(anchor):
                for text, voice in pairs:
                    if any((s.get("line") or {}).get("text") == text for s in steps):
                        continue
                    steps.insert(i + 1 + added, {
                        "kind": "line",
                        "line": {"text": text, "voice": voice}})
                    added += 1
                break
        if added:
            break
    if added:
        save("dialogues/%s.dlg.json" % name, doc)
    return added


def patch_ink(name, anchor, pairs):
    path = os.path.join(ROOT, "dialogues/%s.ink" % name)
    text = open(path, encoding="utf-8").read()
    if pairs[0][0][:30] in text:
        return 0
    lines = text.split("\n")
    out, added = [], 0
    for line in lines:
        out.append(line)
        body = line.split(" #")[0].strip()
        if body.startswith(anchor):
            for t, voice in pairs:
                out.append("%s # voice: %s" % (t, voice))
                added += 1
    if added:
        open(path, "w", encoding="utf-8").write("\n".join(out))
    return added


def main():
    bad = 0
    for name, node_id, anchor, pairs in ADD:
        if not os.path.exists(os.path.join(ROOT, pairs[0][1])):
            print("НЕТ ФАЙЛА", pairs[0][1])
            bad += 1
            continue
        a = patch_json(name, node_id, anchor, pairs)
        b = patch_ink(name, anchor, pairs)
        flag = "" if a > 0 and b > 0 else "  ← ПРОВЕРИТЬ!"
        if a <= 0 or b <= 0:
            bad += 1
        print(f"{name:10} {node_id:10} json +{a} | ink +{b}{flag}")
    print("проблемных:", bad)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
