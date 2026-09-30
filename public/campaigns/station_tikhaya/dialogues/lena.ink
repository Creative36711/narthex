EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL get_disposition(t)
EXTERNAL change_disposition(t, d)
EXTERNAL fire_rule(id)
EXTERNAL advance_time(t)
EXTERNAL change_need(id, d)
EXTERNAL get_player_name()

=== main ===
{ get_flag("met_lena"):
    Снова ты. Чай ещё горячий — если не убежал на перрон. # emotion: soft
- else:
    ~ set_flag("met_lena")
    ~ change_disposition("npc_lena", 5)
    …{get_player_name()}. Ты всё-таки приехал. Я думала — только на похороны и сразу обратно. # emotion: hurt
    Садись. Чай по старым ценам. Разговор — бесплатно, если честный. # emotion: soft
}
-> main_hub

=== main_hub ===
+ { not get_flag("lena_apology") } [Мне жаль, что так вышло. Правда жаль.]
    ~ set_flag("lena_apology")
    ~ change_disposition("npc_lena", 15)
    ~ change_need("need_grief", -8)
    Она молчит дольше, чем удобно. Потом кивает — коротко, будто ставит печать. # emotion: soft
    Жаль — это слово дешёвое. Но ты хотя бы произнёс его вслух. Спасибо. # emotion: warm
    -> main_hub
+ { not get_flag("lena_bridge_invite") } [Помнишь наш мост? Можно сходить.]
    ~ set_flag("lena_bridge_invite")
    ~ change_disposition("npc_lena", 8)
    Мост… Там всё ещё скрипит перила. Я иногда хожу, когда смена кончается. # emotion: soft
    Если дойдёшь — буду. Не обещаю, что будет легко.
    -> main_hub
+ { get_flag("lena_apology") && get_disposition("npc_lena") >= 40 } [Поедем вместе. Последний поезд — не приговор.]
    ~ set_flag("lena_will_go")
    ~ change_disposition("npc_lena", 20)
    ~ fire_rule("rule_lena_warm")
    -> DONE
    -> DONE
+ [Мне нужно время. Я ещё вернусь до отправления.]
    Времени у нас ровно столько, сколько до гудка. Не больше. # emotion: soft
    -> DONE
+ [Просто посидеть. Без разговоров.]
    ~ change_need("need_warmth", 12)
    ~ change_need("need_grief", -5)
    ~ advance_time(1)
    Она наливает чай. Молчание не пустое — оно как одеяло, которое наконец разрешили надеть. # emotion: warm
    -> DONE
- -> main_hub
