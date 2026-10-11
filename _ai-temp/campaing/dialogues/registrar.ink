EXTERNAL add_item(a0, a1)
EXTERNAL advance_time(a0)
EXTERNAL fire_rule(a0)
EXTERNAL has_item(a0)
EXTERNAL set_flag(a0)
EXTERNAL unlock_codex(a0)
EXTERNAL get_flag(a0)

=== Начало ===
{ get_flag("met_registrar"): -> Снова }
Регистратор щёлкает реле: два стеклянных глаза разгораются бирюзой. # action # sfx: sfx_click # voice: assets/voice/narr_registrar_1.mp3
Назовите номер дела, шифр или дату. Говорите чётко: я пишу, как слышу. # voice: assets/voice/registrar_1.mp3 # sfx: sfx_tick
Срок дознания по делу сто тридцать семь — семьдесят два часа. Чтение и разговор время не расходуют. Переходы и работа учитываются отдельно. # voice: assets/voice/registrar_8.mp3
Срок дознания не продлевают. Новая бумага не остановит воду. До истечения срока вы должны решить судьбу седьмой помпы. # voice: assets/voice/registrar_9.mp3
~ set_flag("met_registrar")
-> Начало_hub

=== Снова ===
Реле щёлкают, стеклянные глаза регистратора снова разгораются бирюзой. # action # sfx: sfx_click # voice: assets/voice/narr_registrar_2.mp3
-> Начало_hub

=== Начало_hub ===
* [Дело сто тридцать шесть.]
Дело сто тридцать шесть. Затопление девятого яруса. Исполнено. Подпись: инспектор Каст. # emotion: calm # voice: assets/voice/registrar_2.mp3
    ~ unlock_codex("codex_case136")
    -> Начало_hub
* { has_item("item_plate") and not (get_flag("clue_roster")) } [Наряд стражи за ночь тринадцатого.]
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
    ~ set_flag("reg_ledger_seen")
Расход мазута, смены мастера Реша Э. Пометка: «режим тишины — смотри приложение». Приложение изъято. # emotion: calm # voice: assets/voice/registrar_3.mp3
    -> Начало_hub
+ { get_flag("reg_ledger_seen") } [Кто изъял приложение?]
    Инспектор Каст В. Основание: пункт девятый. Пункт девятый гласит: «в интересах яруса». # emotion: calm # voice: assets/voice/registrar_6.mp3
    ~ set_flag("kast_alerted")
    -> Начало_hub
* { get_flag("case_full") and not (get_flag("case_registered")) } [Зарегистрировать сшитое дело №137 (1 ч).]
    Материалы подшиты. Ставлю входящий штамп. Дело сто тридцать семь внесено в реестр. Изъятие оставит запись. Даже инспектор обязан указать основание. # emotion: calm # sfx: sfx_stamp # voice: assets/voice/registrar_10.mp3
    ~ fire_rule("rule_register_case")
    -> Начало_hub
+ { get_flag("clue_roster") } [Перечитать полученный наряд.]
    Взвод старшины Келла Ястреба, двенадцать человек, седьмой ярус, с двадцати до шести. Пометки о смене нет. # emotion: calm # voice: assets/voice/registrar_5.mp3
    -> Начало_hub
+ [Повторите условия срока.]
    Срок дознания по делу сто тридцать семь — семьдесят два часа. Чтение и разговор время не расходуют. Переходы и работа учитываются отдельно. # voice: assets/voice/registrar_8.mp3
    Срок дознания не продлевают. Новая бумага не остановит воду. До истечения срока вы должны решить судьбу седьмой помпы. # voice: assets/voice/registrar_9.mp3
    -> Начало_hub
+ [Отключись.]
    -> DONE
- -> Начало_hub
