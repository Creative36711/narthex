EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL skill_check(s, d)
EXTERNAL change_disposition(t, d)
EXTERNAL change_need(id, d)

=== main ===
{ get_flag("met_boris"):
    Куришь? Я уж бросил. Почти. # emotion: soft
- else:
    ~ set_flag("met_boris")
    Смотри кто явился. Столица тебя не съела — значит, ещё живой. # emotion: warm
    Я тут каждый вечер. Мост помнит нас лучше, чем мы сами. # emotion: soft
}
-> main_hub

=== main_hub ===
+ [Как ты… всё это время?]
    ~ set_flag("boris_story")
    ~ change_disposition("npc_boris", 10)
    Работаю на сортировке. Жена уехала в область. Дочка пишет иногда. Нормальная жизнь — только тихая. # emotion: soft
    А ты бегал от тишины. Теперь она догнала. Не обижайся — я без злости.
    -> main_hub
+ [Лена всё ещё здесь. Ты с ней…]
    ~ set_flag("boris_about_lena")
    Она не ждала. Просто жила. Это другое. Не ломай ей вечер геройством. # emotion: soft
    Если скажешь правду — она услышит. Если спектакль — почувствует.
    -> main_hub
+ [Посоветуй. Остаться или уехать?]
    ~ temp d = 45
    ~ temp r = skill_check("persuade", d)
    { r == "fail" || r == "fumble":
        Брат, я не оракул. Я просто стою на мосту и курю то, чего нет. # emotion: soft
        -> DONE
    - else:
        ~ set_flag("boris_advice_good")
        ~ change_need("need_grief", -10)
        Остаться — не значит сдаться. Уехать — не значит предать. Смотри, кого ты предаёшь, когда выбираешь. # emotion: warm
        -> DONE
    }
+ [Пойду. Спасибо, что ждал.]
    ~ change_disposition("npc_boris", 5)
    Я никого не ждал. Просто здесь ветрено — и видно поезда. # emotion: warm
    -> DONE
- -> main_hub
