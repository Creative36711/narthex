EXTERNAL add_item(a0, a1)
EXTERNAL change_disposition(a0, a1)
EXTERNAL fire_rule(a0)
EXTERNAL get_flag(a0)
EXTERNAL item_count(a0)
EXTERNAL remove_item(a0, a1)
EXTERNAL set_flag(a0)

-> main

=== main ===
{ get_flag("striga_angry") == 1: Стрига здоровается так, что видно: нож у неё не для товара. | Стрига перебирает мелочь в ящике, не глядя на монеты. }
«Дознаватель Артели. Дорого стою, честно продаю, лишнего не говорю. Тебе что?»
-> main__hub


=== main__hub ===
+ {not (get_flag("striga_echo_sold") == 1)} [У тебя есть осколок эха Крона.]
    «Есть. Красивый, тяжёлый, дорогой. Крон отдал его за долг, я его держала как залог. Продам — Крона нет, а долг остался.»
    -> main__hub
* {not (get_flag("striga_echo_sold") == 1) and item_count("item_cinder") >= 60} [Куплю за 60 угольков.]
    ~ remove_item("item_cinder", 60)
    ~ add_item("item_echo_part_3", 1)
    ~ set_flag("striga_echo_sold")
    ~ change_disposition("npc_striga", 10)
    «Свободен. Бери и уходи быстро: за такие вещи в Горне убивают медленно.»
    -> main__hub
* {not (get_flag("striga_echo_sold") == 1) and item_count("item_ash_sample") >= 3} [Меняю на три пробы пепла.]
    ~ remove_item("item_ash_sample", 3)
    ~ add_item("item_echo_part_3", 1)
    ~ set_flag("striga_echo_sold")
    ~ set_flag("striga_helped")
    ~ change_disposition("npc_striga", 5)
    «Пробы с третьего помола. Хорошо, что мне нужны не они, а то, что в них. Бери осколок, дознаватель, и не спрашивай, зачем мне пепел мёртвых.»
    -> main__hub
* {not (get_flag("striga_echo_sold") == 1) and not (get_flag("striga_angry") == 1)} [Взять осколок, пока она отвернулась.]
    ~ fire_rule("rule_striga_steal")
    -> main__hub
+ [Расскажи про Стерна.]
    «Стерн честный. Это в нашем городе самый дорогой недостаток. Он тебе осколок отдаст, если ты ему покажешь бумагу: бумага для него — как путь для слепого.»
    -> main__hub
+ {item_count("item_ash_waybill") > 0} [Кто заказывал у тебя чистый пепел?]
    «Коллегия. По накладной, аккуратно, с печатью. Приют привозит — я перепродаю. Круг замкнутый, дознаватель: мёртвые греют живых, живые потом едут в помол. Так город и стоит.»
    -> main__hub
+ [Спасибо. Мне пора.]
    -> DONE
- -> main__hub
