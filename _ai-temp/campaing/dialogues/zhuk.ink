EXTERNAL npc_known(a0)
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
* { not (get_flag("zhuk_paid")) } [Что ты видел в ночь тринадцатого?]
    ~ r = skill_check("persuade", 50)
    {r: -> Начало_hub_ok1 | -> Начало_hub_no1}
+ { item_count("item_mark") >= 35 and get_flag("dozh_who") and not (get_flag("zhuk_paid")) } [Я от Дожа. Тридцать пять марок.]
    От Дожа? Ладно, старику не откажу: он меня кормил, когда я ещё в карманах путался. Тридцать пять, и ни маркой меньше. # emotion: thoughtful # voice: assets/voice/zhuk_19.mp3
    Он протягивает руку, не глядя. Марки исчезают в рукаве. # action # sfx: sfx_coin # voice: assets/voice/narr_zhuk_2.mp3
    Стража Келла, двенадцать человек, вниз. Мастер — наверх, потом снова вниз, с сердцевиной в сумке. А наряд в архиве подшит к делу тринадцать-К: без пломбы тебе его не дадут. # voice: assets/voice/zhuk_11.mp3
    ~ remove_item("item_mark", 35)
    ~ set_flag("zhuk_paid")
    ~ set_flag("zhuk_dozh_price")
    ~ fire_rule("rule_zhuk_info")
    -> Начало_hub
+ { item_count("item_mark") >= 50 and not (get_flag("dozh_who")) and not (get_flag("zhuk_paid")) } [Пятьдесят марок. Вспоминай.]
    Он протягивает руку, не глядя. Марки исчезают в рукаве. # action # sfx: sfx_coin # voice: assets/voice/narr_zhuk_2.mp3
    Стража Келла, двенадцать человек, вниз. Мастер — наверх, потом снова вниз, с сердцевиной в сумке. А наряд в архиве подшит к делу тринадцать-К: без пломбы тебе его не дадут. # voice: assets/voice/zhuk_11.mp3
    ~ remove_item("item_mark", 50)
    ~ set_flag("zhuk_paid")
    ~ fire_rule("rule_zhuk_info")
    -> Начало_hub
+ { get_flag("zhuk_paid") } [Кто заказал остановку помпы?]
Не Келл. Келл — руки, а руки дешёвые. Бумага дорогая. # emotion: thoughtful # voice: assets/voice/zhuk_1.mp3
Ищи, кто подписал расход на режим тишины. Кто подписал, тот и заказал. # voice: assets/voice/zhuk_2.mp3
    ~ set_flag("kast_alerted")
    -> Начало_hub
+ { get_flag("clue_roster") and not (get_flag("zhuk_cache_hint")) } [Ты и сам знаешь, кто стоял. Что ещё?]
    Жук кривится, но ладоней со стола не убирает. # action # voice: assets/voice/narr_zhuk_5.mp3
    Тогда слушай другое. Гроссбух Реш не в конторе держал и не в каморке: он его в штольне девятого яруса спрятал, под чугунной плитой у старой крепи. # emotion: thoughtful # voice: assets/voice/zhuk_12.mp3
    ~ set_flag("zhuk_cache_hint")
    -> Начало_hub
+ { has_item("item_ledger") and not (get_flag("zhuk_ledger")) } [Дать Жуку полистать гроссбух.]
    ~ present_item("Расход", "Расход_мимо", "item_ledger")
    -> DONE
* { not (get_flag("resh_found")) and not (npc_known("npc_resh")) } [Где мастер?]
Ниже восьмого. Там, где жила поёт. Хочешь — спускайся, хочешь — живи. # emotion: calm # voice: assets/voice/zhuk_3.mp3
    ~ fire_rule("rule_reveal_deep")
    -> Начало_hub
+ { get_flag("lockdown") and not (get_flag("zhuk_patrol_tip")) and not (get_flag("patrol_pump_met")) and item_count("item_mark") >= 10 } [Сколько стоит пройти мимо дежурных у помпы? (10 марок)]
    Жук пересчитывает марки на ощупь, не опуская глаз. # action # sfx: sfx_coin # voice: assets/voice/narr_zhuk_7.mp3
    Дежурным у седьмой платят за смену, не за кровь. Старший — тот, что с перебитым носом: у него жена на девятом, и он считает часы до конца вахты. # emotion: thoughtful # voice: assets/voice/zhuk_15.mp3
    Назови ему дело и скажи, что после тебя придёт Надзор, а не ты. Ключ держи за поясом: потянешься — разговор кончится, а их там двое. # emotion: calm # voice: assets/voice/zhuk_16.mp3
    ~ remove_item("item_mark", 10)
    ~ set_flag("zhuk_patrol_tip")
    -> Начало_hub
+ { has_item("item_glove") } [Узнаёшь рукавицу? Семёрка на манжете, заплата на пальце.]
    Партия седьмого яруса, прошлогодняя выдача. Я сам эти тюки через шлюз принимал — брезент двойной, сносу нет. # emotion: calm # voice: assets/voice/zhuk_13.mp3
    А заплата — это к Айле или к Ире: караульные у нас гордые, но когда палец мёрзнет, идут кланяться в Сухой ряд. # emotion: thoughtful # voice: assets/voice/zhuk_14.mp3
    -> Начало_hub
+ { get_flag("glazier_named") and not (get_flag("zhuk_glazier")) } [Сыч носит стекло наверх. Мимо тебя.]
    ~ set_flag("zhuk_glazier")
    Мимо меня, это правда. Мне стекло ни к чему: на нём внизу долго не живут. # emotion: calm # voice: assets/voice/zhuk_17.mp3
    Квитанции с завитком, говоришь? Внизу так не пишут, внизу ставят крестик. Сверь завиток с любой бумагой из конторы — увидишь, чья рука. # emotion: thoughtful # voice: assets/voice/zhuk_18.mp3
    ~ change_disposition("npc_zhuk", 3)
    -> Начало_hub
* { get_flag("kell_pressed") and not (get_flag("case_registered")) and not (get_flag("zhuk_warn")) } [Что слышно про Келла?]
    ~ set_flag("zhuk_warn")
    Слыхал, ты Келлу на мозоль наступил. Ночью в конторе дверь подпирай: бумагу, которой нет в реестре, жгут вместе с печкой. # emotion: thoughtful # voice: assets/voice/zhuk_20.mp3
    -> Начало_hub
+ [Пока.]
    -> DONE
- -> Начало_hub

=== Молчание ===
Жук ждёт ровно столько, сколько стоит твоё молчание. # action # voice: assets/voice/narr_zhuk_3.mp3
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
Жук листает, водя пальцем по столбцам, и считает тихо, одними губами. # timer: 5 # action # sfx: snd_page # voice: assets/voice/narr_zhuk_4.mp3
Мазут списан на семь смен по двенадцать человек. А тринадцатая ночь в расходе есть, людей в ней нет. # emotion: thoughtful # voice: assets/voice/zhuk_4.mp3
Кто-то платил, чтобы седьмой ярус в ту ночь стоял пустым. Платил не Келл: у Келла таких денег нет, у него только руки. # emotion: thoughtful # voice: assets/voice/zhuk_6.mp3
~ set_flag("zhuk_ledger")
~ change_disposition("npc_zhuk", 8)
~ fire_rule("rule_zhuk_ledger")
-> Начало_hub

=== Расход_мимо ===
Жук тянется было, но рука остаётся при нём. # action # voice: assets/voice/narr_zhuk_6.mp3
Это я не читаю. Покажи бумагу, где цифры, — тогда поговорим. # emotion: thoughtful # voice: assets/voice/zhuk_7.mp3
-> Начало_hub
