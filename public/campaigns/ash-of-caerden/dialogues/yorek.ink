EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL remove_item(id, n)
EXTERNAL item_count(id)
EXTERNAL skill_check(s, d)
EXTERNAL in_party(id)
EXTERNAL fire_rule(id)

=== main ===
{ get_flag("yorek_met"):
    Ты испытываешь моё терпение, наёмник. # emotion: neutral
- else:
    ~ set_flag("yorek_met")
    Смелый гость. Или глупый.
    Седой воин с клейморой за спиной неспешно поднимается от костра. Вокруг из палаток выходят люди — с ножами и дубинами. # action
    Я Йорек. Эта долина кормит моих людей. Говори, зачем пришёл, — и, может быть, уйдёшь на своих ногах.
}
-> main_hub

=== main_hub ===
* [«Уходите из долины — или ляжете в неё». (Убеждение)]
    { get_flag("secret_path_used"):
        Йорек мрачно оглядывается: вы пришли из его собственного тыла, и он это понимает. Лагерь не так неприступен, как он думал. # action
    }
    ~ temp d = 60
    { get_flag("secret_path_used"):
        ~ d = 40
    }
    ~ temp r = skill_check("persuade", d)
    { r == "fail" || r == "fumble":
        Йорек долго смотрит на вас… и сплёвывает. # emotion: neutral # action
        Языкатых я вешаю на осинах вдоль тракта.
        -> fight_starts
    - else:
        Йорек щурится. Долгая пауза. # action
        { in_party("npc_guard_aldric"):
            Стража уже в моём лагере… Значит, город всерьёз взялся за нас.
        }
        Хм. Караваны обмельчали, стража зашевелилась… а теперь ещё и ты. Пожалуй, эта долина и впрямь выжата досуха.
        Мы уходим за холмы. Но запомни, наёмник: дороги длинные, а память у меня долгая.
        ~ set_flag("bandit_deal_made")
        -> DONE
    }
+ { item_count("item_silver") >= 100 } [«Сто марок серебром — и вы уходите». (100 SM)]
    ~ remove_item("item_silver", 100)
    Йорек взвешивает кошель на ладони. # action
    Серебро не пахнет кровью — уже хорошо. По рукам. К рассвету нас здесь не будет.
    ~ set_flag("bandit_deal_made")
    -> DONE
+ [«К оружию!» (бой)]
    -> fight_starts
+ [«Я ещё вернусь». (уйти)]
    Возвращайся с серебром. Или не возвращайся вовсе.
    -> DONE
- -> main_hub

=== fight_starts ===
{ get_flag("secret_path_used"):
    ~ fire_rule("encounter_camp_fight_surprise")
    -> DONE
- else:
    ~ fire_rule("encounter_camp_fight")
    -> DONE
}
-> DONE
