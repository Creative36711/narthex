EXTERNAL set_flag(f)
EXTERNAL get_flag(f)
EXTERNAL has_item(id)
EXTERNAL add_item(id, n)
EXTERNAL remove_item(id, q)
EXTERNAL skill_check(s, d)
EXTERNAL change_disposition(t, d)
EXTERNAL fire_rule(r)

=== main ===
Стражник перегораживает шлюз, опираясь на тесак. Глаза его красны от недосыпа и смога.
— Куда прёшь? Литейный квартал закрыт по приказу Гильдии. Иди, откуда пришёл.
-> rud_hub

=== rud_hub ===
+ [У меня дело в мастерской Калеба. Пропусти.]
    { get_flag("caleb_trusts"):
        { skill_check("persuade", 45):
            Он долго смотрит на тебя, потом кивает.
            — Калеб… старик мне глаз подлатал после аварии в третьем цехе. Ладно. Проходи. Но если стража с вышки заметит — я тебя не видел.
            ~ change_disposition("npc_rud", 10)
            ~ set_flag("guild_access")
            ~ fire_rule("rule_open_guild")
            -> DONE
        }
        — Знаю я Калеба. И мне очень не хочется, чтобы меня из-за него вздёрнули на той же вышке. Нет.
        -> rud_hub
    }
    — Калеб? Он больше не решает, кто ходит по кварталу. Нет пропуска — нет входа.
    -> rud_hub
+ [Вот, пятнадцать марок. Ты меня не видел.]
    { has_item("item_silver") >= 15:
        Он оглядывается и быстро прячет монеты в перчатку.
        ~ remove_item("item_silver", 15)
        ~ set_flag("guild_access")
        ~ fire_rule("rule_open_guild")
        — Быстро. И если попадёшься — я тебя первый приколю.
        -> DONE
    }
    — У тебя и десяти марок нет, а хамишь. Проваливай.
    -> rud_hub
+ [У меня бляха дознавателя.]
    { has_item("item_badge"):
        Он вздрагивает и вытягивается.
        — П-простите, я не разглядел. Проходите.
        -> DONE
    }
    — Бляха? Да покажи, раз есть.
    -> rud_hub
+ [Тогда я пройду силой.]
    Он поднимает тесак.
    — Ну иди.
    ~ fire_rule("rule_open_guild")
    -> DONE
+ [Ладно, я пойду.]
    Он молча возвращается к своему посту.
    -> DONE
- -> rud_hub
