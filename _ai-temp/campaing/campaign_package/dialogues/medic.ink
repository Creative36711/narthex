EXTERNAL add_item(a0, a1)
EXTERNAL fire_rule(a0)
EXTERNAL get_flag(a0)
EXTERNAL get_hp()
EXTERNAL get_hp_max()
EXTERNAL item_count(a0)
EXTERNAL remove_item(a0, a1)
EXTERNAL unlock_codex(a0)

=== main ===
Кладите руки на стол. Что болит — само скажет.
У вас {get_hp()} здоровья из {get_hp_max()}. Плечи как у шахтёра, глаза как у человека, который мало спит.
-> main_hub

=== main_hub ===
+ {  item_count("item_silver") >= 6  } [Подлечите меня (6 см).]
    ~ remove_item("item_silver", 6)
    ~ fire_rule("rule_medic_help")
    Готово. Дышите мелко, три часа не спорьте с караулом.
    -> main_hub

+ {  item_count("item_silver") >= 10  } [Купить осадок от ржави (10 см).]
    ~ remove_item("item_silver", 10)
    ~ add_item("item_tonic", 1)
    Пейте сразу, как пальцы начнут не слушаться. Это не лечение, инспектор. Это отсрочка.
    -> main_hub

+ [Что такое ржавь?]
    Счёт. Вы думаете, это болезнь, а это счёт, который вам выставили. Металл растёт там, где жило тепло.
    ~ unlock_codex("codex_rust")
    -> main_hub

+ [Что говорят тела из ям?]
    Вкладыши у них в черепах. Латунь, шлифованная, с номером. Такие ставят не мертвым, а живым — чтобы держался в машине.
    И ещё: у всех четырёх волосы чистые. Их мыли перед тем, как подключать.
    ~ fire_rule("rule_medic_names")
    -> main_hub

+ {  get_flag("clinic_helped") and not (get_flag("recipe_tonic_known"))  } [Что у вас от ржави?]
    Осадок. Трава-жгунец, спирт и время. Держите, я запишу, как делать.
    ~ fire_rule("rule_medic_recipe")
    -> main_hub

+ {  get_flag("fume_first")  } [Проверьте, как я дышу.]
    Лёгкие как у шахтёра: угар есть, но немного. Меняйте уголь в маске каждый день.
    ~ fire_rule("rule_medic_lungs")
    -> main_hub

+ [До встречи.]
    -> DONE

- -> main_hub
