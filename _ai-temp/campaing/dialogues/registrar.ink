EXTERNAL add_item(a0, a1)
EXTERNAL advance_time(a0)
EXTERNAL fire_rule(a0)
EXTERNAL has_item(a0)
EXTERNAL set_flag(a0)
EXTERNAL unlock_codex(a0)
EXTERNAL get_flag(a0)

=== Начало ===
Регистратор щёлкает реле: два стеклянных глаза разгораются бирюзой. # action # sfx: sfx_click # voice: assets/voice/narr_registrar_1.mp3
Назовите номер дела, шифр или дату. Говорите чётко: я пишу, как слышу. # voice: assets/voice/registrar_1.mp3 # sfx: sfx_tick
Срок дознания по делу сто тридцать семь — семьдесят два часа. Он идёт, пока вы стоите и молчите. # voice: assets/voice/registrar_8.mp3
Срок дознания не продлевают. Его переписывают — и в новой бумаге он идёт сначала. Так что спешите с первой, а не со второй. # voice: assets/voice/registrar_9.mp3
-> Начало_hub

=== Начало_hub ===
* [Дело сто тридцать шесть.]
Дело сто тридцать шесть. Затопление девятого яруса. Исполнено. Подпись: инспектор Каст. # emotion: calm # voice: assets/voice/registrar_2.mp3
    ~ unlock_codex("codex_case136")
    -> Начало_hub
* { has_item("item_plate") } [Наряд стражи за ночь тринадцатого.]
    Пломба предъявлена. Выдаю. # emotion: calm # voice: assets/voice/registrar_4.mp3 # sfx: snd_latch
    Взвод старшины Келла Ястреба, двенадцать человек, седьмой ярус, с двадцати до шести. Пометки о смене нет. # voice: assets/voice/registrar_5.mp3
    ~ add_item("item_roster", 1)
    ~ fire_rule("rule_roster_got")
    ~ advance_time(1)
    -> Начало_hub
+ { not (has_item("item_plate")) } [Наряд стражи за ночь тринадцатого.]
    Пломба не предъявлена. Наряды без пломбы не выдаются. # emotion: calm # sfx: sfx_error # voice: assets/voice/registrar_7.mp3
    -> Начало_hub
+ [Ведомость седьмой помпы.]
Расход мазута, смены мастера Реша Э. Пометка: «режим тишины — см. приложение». Приложение изъято. # emotion: calm # voice: assets/voice/registrar_3.mp3
    -> Начало_hub
+ [Кто изъял приложение?]
    Инспектор Каст В. Основание: пункт девятый. Пункт девятый гласит: «в интересах яруса». # emotion: calm # voice: assets/voice/registrar_6.mp3
    ~ set_flag("kast_alerted")
    -> Начало_hub
+ { get_flag("case_full") } [Дело № 137 сшито. Запишешь во входящие?]
    Шесть улик на суровой нитке… Давно такого не приносили. Ставлю входящий штамп: теперь эту папку даже инспектор из реестра не вынет. # emotion: calm # sfx: sfx_stamp # voice: assets/voice/registrar_10.mp3
    ~ unlock_codex("codex_case137")
    -> Начало_hub
+ [Отключись.]
    -> DONE
- -> Начало_hub
