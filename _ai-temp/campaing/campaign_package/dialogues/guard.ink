EXTERNAL fire_rule(a0)
EXTERNAL get_flag(a0)
EXTERNAL item_count(a0)
EXTERNAL set_flag(a0)
EXTERNAL unlock_codex(a0)

=== main ===
{ not (get_flag("guard_let_in")):
    Стоять. Кто идёт?
}
{ get_flag("guard_let_in"):
    Проходите, инспектор. Только вниз без пропуска — не ходите, там сейчас неспокойно.
    Если что — бумаги у сержанта Гулы, в участке на рынке.
}
-> main_hub

=== main_hub ===
+ {  not (get_flag("guard_let_in"))  } [Инспектор Ревизии. Вот служебная бумага.]
    Бумага с печатью — ну наконец-то. За неделю второй по счёту, и первый, говорят, уже в ямах лежит.
    ~ fire_rule("rule_guard_papers")
    -> main_hub

+ {  not (get_flag("guard_let_in"))  } [Не задерживай. Ревизия не любит ждать.]
    Не люблю и я. Но служба — она для всех служба…
    ~ fire_rule("rule_guard_press")
    -> main_hub

+ {  item_count("item_silver") >= 5 and not (get_flag("guard_let_in"))  } [Вот пять марок. Смена длинная.]
    Смена длинная, да. Проходите, инспектор, только не через ямы.
    ~ fire_rule("rule_guard_bribe")
    -> main_hub

+ [Что тут случилось с инспектором?]
    Гарна нашли в Глубоком штреке, лицо закрыто тряпкой. Казённое объявление висит у стены — прочтите, если охота.
    ~ unlock_codex("codex_garn_case")
    ~ set_flag("notice_read")
    -> main_hub

+ [Кто в городе решает?]
    Дирекция на верхней террасе. Управляющий Валент Корр — он подписывает всё: и руду, и воду, и кого спускать вниз.
    ~ unlock_codex("codex_directorate")
    -> main_hub

+ [Где тут едят и спят?]
    Корчма «Сухой патрубок» — под рынком. Марта держит, похлёбка честная, койка пять марок.
    -> main_hub

+ [До встречи.]
    -> DONE

- -> main_hub
