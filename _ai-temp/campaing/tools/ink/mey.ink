// Слепая Мей — девочка у погоста. Считает раньше, чем говорит.
EXTERNAL set_flag(f)
EXTERNAL get_flag(f)
EXTERNAL has_item(i)
EXTERNAL change_disposition(t, d)
EXTERNAL set_entity_state(e, s)
EXTERNAL change_need(n, d)
EXTERNAL add_item(i, n)
EXTERNAL remove_item(i, n)
EXTERNAL get_currency(c)
EXTERNAL unlock_codex(c)
EXTERNAL get_disposition(t)

=== main ===
Мей сидит на плите с закрытыми глазами и камешками в горсти. Она перебирает их большим пальцем — первый, второй, третий, — и на каждом замедляется. # action
~ set_entity_state("npc_mey", "neutral")
— Двадцать два. У тебя внутри двадцать две спицы. У Гверна было девятнадцать, но он их вынимал.
-> hub

=== hub ===
* [О чём она говорит?]
    — Она считает трубы. Видит по звуку, где живые, где нет. Говорит, что в глубине кто-то дышит, и дыхание идёт в такт с колоколом.
    -> hub
+ { get_currency("mark") >= 10 } [Заплатить за ответ.]
    ~ remove_item("item_mark", 10)
    — Под ручьём есть дверь. За дверью — сад из латуни. Там растёт то, что вы называете сердцем.
    ~ unlock_codex("codex_brass")
    ~ set_flag("mey_answer")
    -> hub
+ { has_item("item_sweet") } [У меня есть леденец.]
    ~ change_disposition("npc_mey", 10)
    — Сладкий. Тогда скажу красиво: тот, кто в глубине, не злой. Он просто очень старый и очень один.
    — Он не убивает. Он переносит. Из живых — в книгу.
    -> hub
* [Кто её сюда привёл?]
    — Никто. Я сама. Я знаю, где спят, потому что слышу, какие имена молчат.
    -> hub
+ [Ничего. Дать ей уйти домой.]
    — Я не хожу домой. Дом ходит ко мне.
    -> DONE
- -> hub
