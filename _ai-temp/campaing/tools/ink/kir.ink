// Кирилл — скупщик на чёрном дворе.
EXTERNAL set_flag(f)
EXTERNAL get_flag(f)
EXTERNAL has_item(i)
EXTERNAL get_skill(s)
EXTERNAL change_disposition(t, d)
EXTERNAL set_entity_state(e, s)
EXTERNAL add_item(i, n)
EXTERNAL remove_item(i, n)
EXTERNAL get_currency(c)
EXTERNAL open_trade(t)
EXTERNAL fire_rule(r)
EXTERNAL change_need(n, d)

=== main ===
Кирилл сидит на перевёрнутом ящике в тени между складами. Он не прячется — он просто стоит так, чтобы его не было видно с улицы. # action
~ set_entity_state("npc_kir", "neutral")
— Тише. Слушаю тебя, но не смотрю. Так безопаснее для нас обоих.
-> hub

=== hub ===
* [Мне нужен человек, который умеет молчать.]
    — Таких много. Дешёвых — нет. Что у тебя есть?
    -> price
+ { get_flag("ledger_taken") } [Хочешь взглянуть на гроссбух Векселя?]
    ~ set_entity_state("npc_kir", "scared")
    — Убери. Я его не видел, ты его не показывал. Такие книги жгут вместе с читателями.
    ~ change_disposition("npc_kir", -5)
    -> hub
* [Кто живёт в дренаже?]
    — Живёт — громко сказано. Там есть человек в сурдине, глухой на левое ухо. Работает ночами, спускается и поднимается по лебёдке у решётки.
    — Если тебе к нему, иди в темноте и не бери света. Он свет не любит.
    ~ set_flag("drain_noise_known")
    -> hub
+ { get_skill("stealth") >= 25 } [Мне нужно пройти мимо стражи незамеченным.]
    — Тогда не через площадь. Через крыши складов, там сигналка натянута только на два пролёта из пяти. Я покажу.
    ~ set_flag("roof_path_known")
    -> hub
+ [Ничего. Просто смотрю.]
    — Смотри. Только недолго: у меня за спиной не пусто.
    -> DONE
- -> hub

=== price ===
+ { get_currency("mark") >= 40 } [Сорок марок.]
    ~ remove_item("item_mark", 40)
    ~ change_disposition("npc_kir", 10)
    — Держи. Отмычка, ломик и молчание до утра. Считай, что мы друзья. Временно.
    ~ add_item("item_lockpicks", 1)
    -> hub
+ { has_item("item_brass_sliver") } [Кусок эфирной латуни.]
    — О. Такой товар я беру сам. Тридцать пять марок и слово, что ты забудешь, где взял.
    ~ remove_item("item_brass_sliver", 1)
    ~ add_item("item_mark", 35)
    -> hub
* [Ничего, позже.] { true }
    — Как хочешь. Цена к утру изменится. Всё меняется, кроме голода.
    -> DONE
- -> hub
