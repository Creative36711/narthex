// Пепел — стражник пропускного двора.
EXTERNAL get_player_name()
EXTERNAL set_flag(f)
EXTERNAL get_flag(f)
EXTERNAL has_item(i)
EXTERNAL get_skill(s)
EXTERNAL change_disposition(t, d)
EXTERNAL set_entity_state(e, s)
EXTERNAL change_need(n, d)
EXTERNAL change_hp(h)
EXTERNAL add_item(i, n)
EXTERNAL remove_item(i, n)
EXTERNAL get_currency(c)
EXTERNAL get_disposition(t)
EXTERNAL set_dialogue_timer(sec, node)

=== main ===
Пепел стоит у створа ворот, переминаясь с ноги на ногу. Шинель на нём чужая, на два размера больше, зато с иголкой на плече. # action
~ set_entity_state("npc_pepel", "tired")
— Стой. Кто таков? Ночь, комендантский час, а ты по двору ходишь, как по своей кухне.
~ set_dialogue_timer(20, "hurry")
-> hub

=== hurry ===
// молчание затянулось
— Долго думаешь, {get_player_name()} или кто ты там. Считаю до трёх: раз…
-> hub

=== hub ===
+ [Иду в литейную. Курия вызвала.]
    — Курия? Ну-ка, ну-ка. Бумага есть?.. Ладно, нет бумаги, но есть ты, а это тоже довод.
    ~ set_flag("met_pepel")
    ~ change_disposition("npc_pepel", 5)
    — Проходи. И, слушай: если увидишь там тело — не трогай лицо. Мне потом отчитываться.
    -> DONE
* { get_skill("persuade") >= 25 } [Убедить, что ты свой.]
    — Свой, свой… Латка у тебя цеховая, это видно. Ладно, иди, только тихо.
    ~ set_flag("met_pepel")
    -> DONE
+ { get_currency("mark") >= 3 } [Три марки и мы не виделись.]
    ~ remove_item("item_mark", 3)
    ~ change_disposition("npc_pepel", 10)
    — Я тебя не видел, ты меня не видел. Только не через главные ворота — через решётку восточной стены.
    ~ set_flag("met_pepel")
    -> DONE
* { not (get_flag("met_pepel")) } [Спросить про ночную смену.]
    — Смена как смена. Только вот в цеху вторую неделю горит свет до утра, а людей оттуда выходит меньше, чем заходит.
    — Я раз не удержался, посчитал: вошли шестеро, вышли четверо. И никто мне не верит, потому что кто я такой, чтобы считать.
    ~ set_flag("knows_witness")
    -> hub
+ [Просто спрашиваю.]
    — Спрашивать — не по уставу. Иди, не маячь.
    -> DONE
- -> hub
