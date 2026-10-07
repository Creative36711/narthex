EXTERNAL fire_rule(a0)
EXTERNAL get_flag(a0)
EXTERNAL item_count(a0)
EXTERNAL remove_item(a0, a1)
EXTERNAL set_dialogue_timer(a0, a1)
EXTERNAL set_flag(a0)
EXTERNAL skill_check(a0, a1)
EXTERNAL change_disposition(a0, a1)
EXTERNAL has_item(a0)
EXTERNAL present_item(a0, a1, a2)
EXTERNAL learn_name(a0)

VAR r = 0

=== Начало ===
Жук не здоровается. Он просто ждёт, сколько ты заплатишь. # action # voice: assets/voice/narr_zhuk_1.mp3
Слушаю. Дорого. # voice: assets/voice/zhuk_5.mp3
~ learn_name("npc_zhuk")
-> Начало_hub

=== Начало_hub ===
~ set_dialogue_timer(15, "Молчание")
+ [Что ты видел в ночь тринадцатого?]
    ~ r = skill_check("persuade", 50)
    {r: -> Начало_hub_ok1 | -> Начало_hub_no1}
+ { item_count("item_mark") >= 50 and not (get_flag("zhuk_paid")) } [Пятьдесят марок. Вспоминай.]
    Он протягивает руку, не глядя. Марки исчезают в рукаве. # action # sfx: sfx_coin
    Стража Келла, двенадцать человек, вниз. Мастер — наверх, потом снова вниз, с сердцевиной в сумке. А наряд в архиве подшит к делу тринадцать-К: без пломбы тебе его не дадут. # voice: assets/voice/zhuk_11.mp3
    ~ remove_item("item_mark", 50)
    ~ fire_rule("rule_zhuk_info")
    -> Начало_hub
+ { get_flag("zhuk_paid") } [Кто заказал остановку помпы?]
Не Келл. Келл — руки, а руки дешёвые. Бумага дорогая. # emotion: thoughtful # voice: assets/voice/zhuk_1.mp3
Ищи, кто подписал расход на режим тишины. Кто подписал, тот и заказал. # voice: assets/voice/zhuk_2.mp3
    ~ set_flag("kast_alerted")
    -> Начало_hub
+ { get_flag("clue_roster") and not (get_flag("zhuk_cache_hint")) } [Ты и сам знаешь, кто стоял. Что ещё?]
    Жук кривится, но рук не прячет: тогда слушай другое. Гроссбух он не в конторе держал и не в каморке: он его в штольне спрятал, там, где спал, под плитой. Ищи, где у мастера была постель. # emotion: thoughtful # voice: assets/voice/zhuk_12.mp3
    ~ set_flag("zhuk_cache_hint")
    -> Начало_hub
+ { has_item("item_ledger") } [Дать Жуку полистать гроссбух.]
    ~ present_item("Расход", "Расход_мимо", "item_ledger")
    -> DONE
* [Где мастер?]
Ниже восьмого. Там, где жила поёт. Хочешь — спускайся, хочешь — живи. # emotion: calm # voice: assets/voice/zhuk_3.mp3
    ~ fire_rule("rule_reveal_deep")
    -> Начало_hub
+ { has_item("item_glove") } [Узнаёшь рукавицу? Семёрка на манжете, заплата на пальце.]
    Партия седьмого яруса, прошлогодняя выдача. Я сам эти тюки через шлюз принимал — брезент двойной, сносу нет. # emotion: calm # voice: assets/voice/zhuk_13.mp3
    А заплата — это к Айле или к Ире: караульные у нас гордые, но когда палец мёрзнет, идут кланяться в Сухой ряд. # emotion: thoughtful # voice: assets/voice/zhuk_14.mp3
    -> Начало_hub
+ [Пока.]
    -> DONE
- -> Начало_hub

=== Молчание ===
Жук ждёт ровно столько, сколько стоит твоё молчание. # action
Молчишь? Значит, не заплатишь. Бывай. # voice: assets/voice/zhuk_8.mp3
-> Начало

=== Начало_hub_ok1 ===
Келл со взводом, двенадцать человек, вниз — и ни одного обратно до утра. Ещё: мастер выходил из шахты не один. Но это ты не от меня слышал. # voice: assets/voice/zhuk_9.mp3
~ set_flag("zhuk_paid")
~ fire_rule("rule_zhuk_info")
-> Начало_hub

=== Начало_hub_no1 ===
Видел я много. Рассказываю — мало. Пятьдесят марок, и я вспомню всё. # voice: assets/voice/zhuk_10.mp3
-> Начало_hub

=== Расход ===
Жук листает, водя пальцем по столбцам, и считает тихо, одними губами. # timer: 5 # action # sfx: snd_page
Мазут списан на семь смен по двенадцать человек. А тринадцатая ночь в расходе есть, людей в ней нет. # emotion: thoughtful # voice: assets/voice/zhuk_4.mp3
Кто-то платил, чтобы седьмой ярус в ту ночь стоял пустым. Платил не Келл: у Келла таких денег нет, у него только руки. # emotion: thoughtful # voice: assets/voice/zhuk_6.mp3
~ set_flag("zhuk_ledger")
~ change_disposition("npc_zhuk", 8)
~ fire_rule("rule_zhuk_ledger")
-> Начало_hub

=== Расход_мимо ===
Жук тянется было, но рука остаётся при нём. # action
Это я не читаю. Покажи бумагу, где цифры, — тогда поговорим. # emotion: thoughtful # voice: assets/voice/zhuk_7.mp3
-> Начало_hub
