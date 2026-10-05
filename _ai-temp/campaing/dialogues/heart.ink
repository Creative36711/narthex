EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL has_item(id)
EXTERNAL fire_rule(r)
EXTERNAL unlock_codex(c)

=== main ===
Сердце не говорит — оно пульсирует в такт твоим шагам, и мысли становятся чужими. # action
Сердце: ТЕПЛО. МНОГО. МАЛО. ГОЛОД. # emotion: neutral
-> heart_hub

=== heart_hub ===
+ { not (get_flag("heart_lore")) } [Что ты такое?]
    ~ set_flag("heart_lore")
    ~ unlock_codex("codex_heart")
    Сердце: ОГОНЬ. СВЯЗАН. ЦЕПИ. ГОРОД ПЬЁТ. ЛЮДИ ТЕПЛО. # action
    -> heart_hub
+ { not (get_flag("heart_koil")) } [Койль хотел тебя спасти?]
    ~ set_flag("heart_koil")
    Сердце: МАЛЕНЬКИЙ. ЖАЛЕЛ. РВАЛ ЦЕПИ СЛОВАМИ. ЕГО ЗАБРАЛ ЧЕЛОВЕК С КРАСНЫМ. # emotion: sad
    -> heart_hub
* { (get_flag("brant_dead") or get_flag("brant_arrested")) and not (get_flag("chose_freedom")) } [Разорвать цепи.]
    Сердце: ОГОНЬ ПОМНИТ. ОГОНЬ ОТПЛАТИТ. # action
    ~ fire_rule("rule_end_free")
    -> DONE
+ [Отойти от Сердца.]
    -> DONE
- -> heart_hub
