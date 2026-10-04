EXTERNAL fire_rule(a0)
EXTERNAL get_flag(a0)
EXTERNAL item_count(a0)
EXTERNAL unlock_codex(a0)

=== main ===
{ not (get_flag("deep_pass")) and not (get_flag("bossar_met")):
    Инспектор. Бумага тут не ходит — ходит железо. Чего надо, говори прямо.
}
{ not (get_flag("deep_pass")) and get_flag("bossar_met"):
    Вернулся, значит. Не помёр в штреке — уже неплохо. Что теперь надо, бумажный человек?
}
{ get_flag("deep_pass"):
    Пропуск у тебя. Штрек за решёткой, решётка за краном. Только не забудь, кто тебя пустил.
}
-> main_hub

=== main_hub ===
+ [Мне нужен Глубокий штрек. Плачу пятнадцать.] { item_count("item_silver") >= 15 and not (get_flag("deep_pass")) }
    Пятнадцать — цена для ревизии. Хорошо: жестянка с клеймом твоя.
    ~ fire_rule("rule_bossar_paid")
    -> main_hub

+ [Дай допуск в долг.] { not (get_flag("deep_pass")) }
    В долг? Люблю. Тогда слушай: вернёшься и отдашь — или я пришлю человека с ключом.
    ~ fire_rule("rule_bossar_debt")
    -> main_hub

+ [Люди из ям пропадают. Ты их продаёшь?]
    Ты думаешь, я тут Дирекция? Я бригадир. Я людей не отдаю — их забирают. Приходят ночью, с печатью, и предлагают выбор: человек или вся бригада без хлеба.
    Я выбираю бригаду. Это плохой выбор, инспектор. Но он мой.
    ~ unlock_codex("codex_directorate")
    ~ fire_rule("rule_bossar_supply")
    -> main_hub

+ [Что вы знаете про Гарна?]
    Ходил тут. Задавал вопросы. Я ему сказал то же, что и тебе: не лезь в штрек один. Он полез.
    ~ fire_rule("rule_bossar_garn")
    -> main_hub

+ [Отойди с дороги.] { not (get_flag("deep_pass")) }
    Значит, по-плохому. Ну, инспектор, ты сам выбрал.
    ~ fire_rule("rule_bossar_fight")
    -> DONE

+ [Кто из твоих видел «Тихую»?] { get_flag("bossar_met") }
    Трое. Один теперь пьёт, двое пропали. Поговори с пьющим: он у Марты, под столом, второй месяц не работает.
    ~ fire_rule("rule_bossar_quiet")
    -> main_hub

+ [Отдай бумаги, которые Гарн оставил у тебя.] { get_flag("case_taken") }
    Ничего у меня нет. Что не сдал на участке — то в штреке, под рогожей у третьей крепи. Если не растащили.
    ~ fire_rule("rule_bossar_ledger_hint")
    -> main_hub

+ [Пока, бригадир.]
    -> DONE

- -> main_hub
