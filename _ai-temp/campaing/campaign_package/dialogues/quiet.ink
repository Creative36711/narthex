EXTERNAL fire_rule(a0)
EXTERNAL get_flag(a0)

=== main ===
Уходи. Я подожду наверху.
-> main_hub

=== main_hub ===
+ [Кто тебя послал?]
    Тот, кто подписывает бумаги. Тот же, кто подписал бумагу на тебя.
    Я не спорю с бумагами. Я их исполняю.
    ~ fire_rule("rule_quiet_talk")
    -> main_hub

+ [Кого ты уже убила?] { get_flag("ledger_taken") }
    Всех, кого подписали. Гарна — не я: его привели мёртвым. Мне приказали найти бумаги, а не человека.
    ~ fire_rule("rule_quiet_garn")
    -> main_hub

+ [Я уйду.]
    Хорошо. Считай, что тебя не было.
    ~ fire_rule("rule_quiet_let_go")
    -> main_hub

+ [Тогда здесь.]
    Здесь. Так даже честнее.
    ~ fire_rule("rule_quiet_fight")
    -> main_hub

+ [(молчать и уходить)]
    -> DONE

- -> main_hub
