EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL fire_rule(rule)
EXTERNAL change_disposition(target, delta)
EXTERNAL set_dialogue_timer(seconds, node)

=== Начало ===
Капитан Вейл смотрит на ваш жетон, потом на руку у тревожного рычага. # action
Ответ короткий. Дверь — тоже.
-> Допрос_hub

=== Допрос_hub ===
~ set_dialogue_timer(18, "Молчание")
+ { get_flag("flag_census_trace") and not (get_flag("flag_captain_convinced")) } [Показать сводку и назвать имена.]
    ~ set_flag("flag_captain_convinced")
    ~ change_disposition("npc_captain", 12)
    Вейл читает до конца. Потом снимает ладонь с рычага. # action
    Внутри не было ни одного согласия. Я пропущу вас. Но назад я уже не смогу этого не знать.
    -> DONE
+ { get_flag("flag_nera_trust") and not (get_flag("flag_captain_convinced")) } [Поручиться за Неру и нижний перрон.]
    ~ set_flag("flag_captain_convinced")
    Вейл открывает створку на один проход. # action
    Не благодарите меня — просто вернитесь с ответом.
    -> DONE
+ { get_flag("flag_captain_convinced") } [Попросить открыть дверь.]
    Вейл отходит от прохода. # action
    -> DONE
+ [Сделать шаг к тревожному рычагу.]
    ~ set_flag("flag_captain_alarm")
    ~ fire_rule("rule_gate_alarm")
    -> DONE
+ [Отступить к стене.]
    У капитана остаётся время передумать. У вас — время найти другое доказательство. # action
    -> DONE
- -> Допрос_hub

=== Молчание ===
~ set_flag("flag_captain_alarm")
~ fire_rule("rule_gate_alarm")
Вейл принимает молчание за ответ. # action
    Тревога уже идёт по лестнице. # action
-> DONE
