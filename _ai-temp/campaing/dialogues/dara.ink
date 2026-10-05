EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL has_item(id)
EXTERNAL remove_item(id, n)
EXTERNAL change_disposition(t, d)
EXTERNAL skill_check(s, d)
EXTERNAL fire_rule(r)

=== main ===
За решёткой технического загона сидит женщина в сером. Она не кричит — кричать здесь устали. # action
Дарья: Ты не из подач. У подач красные бирки. Кто ты?
-> dara_hub

=== dara_hub ===
* { not (get_flag("dara_freed")) } [Сорвать замок запора.]
    ~ temp lock = skill_check("mechanics", 45)
    { lock == 1: -> dara_free }
    { lock == 0: -> dara_lock_fail }
* { not (get_flag("dara_water")) and has_item("item_condensate") } [Дать конденсата.]
    ~ set_flag("dara_water")
    ~ remove_item("item_condensate", 1)
    ~ change_disposition("npc_dara", 10)
    Дарья пьёт медленно, как пьют только после долгого пепла. # action
    Дарья: Спасибо. Здесь нас сушат, как грибы, — тепло вытягивают по капле.
    -> dara_hub
+ [Кто ещё внизу?]
    Дарья: Нас было девять с Третьего. Осталось трое. Остальных Сердце… выпило. # emotion: sad
    -> dara_hub
+ { get_flag("dara_freed") } [Иди наверх. Зойя ждёт.]
    -> DONE
+ [Я вернусь за тобой.]
    -> DONE
- -> dara_hub

=== dara_free ===
Замок щёлкает, решётка ползёт вверх. Дарья не верит собственным ногам. # action
Дарья: Лаз наверх открыт. Я запомню твоё лицо, дознаватель.
~ fire_rule("rule_dara_free")
-> DONE

=== dara_lock_fail ===
Замок старый, но злой. Пальцы соскальзывают с мёрзлых дужек. # action
Дарья: Тише. Сторожа слышат скрежет. Попробуй ещё, когда рука отдохнёт.
-> dara_hub
