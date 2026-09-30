EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL fire_rule(id)

=== main ===
Билеты. Последний на юг сегодня. Дальше — только утренний, через десять часов тишины.
-> main_hub

=== main_hub ===
+ [Уезжаю. Один.]
    ~ set_flag("boarded_alone")
    ~ fire_rule("rule_ending_leave")
    -> DONE
    -> DONE
+ { get_flag("lena_will_go") } [Мы вдвоём. (Лена рядом)]
    ~ set_flag("boarded_with_lena")
    ~ fire_rule("rule_ending_together")
    -> DONE
    -> DONE
+ [Я передумал. Остаюсь.]
    ~ set_flag("refused_train")
    ~ fire_rule("rule_ending_stay")
    -> DONE
    -> DONE
+ [Ещё не сейчас. Сколько минут?]
    Сколько успеешь наговорить правды. Гудок — и разговор кончится без тебя.
    -> DONE
- -> main_hub
