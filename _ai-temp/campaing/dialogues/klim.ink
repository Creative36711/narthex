EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL has_item(id)
EXTERNAL remove_item(id, n)
EXTERNAL add_item(id, n)
EXTERNAL start_quest(q)
EXTERNAL change_disposition(t, d)

=== main ===
У жаровни греется пацан в рваном пальто не по размеру. Он смотрит из-под сажи так, будто считает твои монеты. # action
~ start_quest("quest_klim")
Клим: Дознаватель? У вас пуговицы медные, я такие знаю. Купите у голодного новость?
-> klim_hub

=== klim_hub ===
* { not (get_flag("klim_fed")) and has_item("item_bread") } [Дать хлеба.]
    ~ remove_item("item_bread", 1)
    ~ set_flag("klim_fed")
    Клим прячет хлеб за пазуху быстрее, чем моргает. # action
    Клим: Ты не как остальные. Ладно. Спрашивай.
    -> klim_clue
* { not (get_flag("klim_fed")) and has_item("item_stew") } [Дать похлёбки.]
    ~ remove_item("item_stew", 1)
    ~ set_flag("klim_fed")
    ~ change_disposition("npc_klim", 10)
    Клим обжигается, но миску не отдаёт даже ветру. # action
    Клим: О-о. Ты хороший медный. Спрашивай, чего видел.
    -> klim_clue
* { get_flag("klim_fed") and not (get_flag("klim_clue")) } [Расскажи про ту ночь.]
    -> klim_clue
+ [Что собираешь у жаровни?]
    Клим: Тепло. Оно нынче дороже хлеба. Батареи на ярусе — как трупы.
    -> klim_hub
+ [Мне пора.]
    -> DONE
- -> klim_hub

=== klim_clue ===
Клим: Той ночью у насосной был человек. Кожаный фартук, красная бирка на груди — такие только у старших механиков. # action
Клим: Он шёл не на смену. Он шёл вниз, к старому лазу за станцией. А утром Койля нашли в паре.
~ set_flag("klim_clue")
~ add_item("item_mushrooms", 1)
Клим: Это тебе. Печерицы из подвала. Не брезгуй, зимой это еда. # action
-> klim_hub
