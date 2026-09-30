EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL fire_rule(id)

=== n_start ===
{ not get_flag("echo_met"):
    ЭХО: «...» # emotion: sad
- else:
    ЭХО: «...считайте...» # emotion: whisper
}
~ set_flag("echo_met")
-> n_start_hub

=== n_start_hub ===
* [Ты кто?]
    ЭХО: «Я — запись капитана Роя. Он считал в уме, когда сигнал вошёл. Теперь считает он. Считайте с ним — так легче.» # emotion: sad
    -> n_start_hub
* { get_flag("echo_met") } [Что считать?]
    ЭХО: «Всё. Шаги. Удары. Дни. Вы уже посчитаны — просто ещё не знаете этого.» # emotion: whisper
    ~ fire_rule("rule_echo_count")
    -> DONE
    -> n_start_hub
+ [Замолчи]
    ЭХО: «...я уже молчу...» # emotion: sad
    -> DONE
- -> n_start_hub
