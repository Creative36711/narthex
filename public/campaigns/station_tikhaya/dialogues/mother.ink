EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL change_disposition(t, d)
EXTERNAL fire_rule(id)
EXTERNAL change_need(id, d)
EXTERNAL unlock_codex(id)

=== main ===
{ get_flag("met_mother"):
    Ты опять ходишь по кругу. Садись, суп ещё тёплый. # emotion: soft
- else:
    ~ set_flag("met_mother")
    ~ change_disposition("npc_mother", 5)
    Ну вот. Приехал. Я знала по шагам на крыльце — чужие бы так не скрипели. # emotion: soft
    Отец… Он ждал письма. Не звонка — письма. Ты так и не написал. # emotion: hurt
}
-> main_hub

=== main_hub ===
+ { not get_flag("mother_forgiven") } [Я должен был быть здесь. Прости.]
    ~ set_flag("mother_forgiven")
    ~ change_disposition("npc_mother", 25)
    ~ change_need("need_grief", -15)
    ~ fire_rule("rule_mother_warm")
    -> DONE
    -> main_hub
+ [Расскажи, как он… в последние дни.]
    ~ set_flag("heard_father")
    ~ change_need("need_grief", 5)
    ~ unlock_codex("codex_father")
    Спал мало. Слушал радио. Спрашивал, не идёт ли поезд с юга — будто ждал не письма, а тебя живьём. # emotion: soft
    Перед тишиной сказал: «Пусть не винит себя. Станция никого не держит силой». # emotion: warm
    -> main_hub
+ { get_flag("mother_forgiven") } [Я могу остаться. Не на день — по-настоящему.]
    ~ set_flag("promise_stay_mother")
    ~ change_disposition("npc_mother", 15)
    Не обещай на бегу. Поезд не прощает громких слов. Если останешься — останься. Если нет — напиши хоть раз. # emotion: soft
    -> DONE
+ [Мне пора. Я ещё зайду.]
    Дверь за тобой не хлопает. Она просто тихо закрывается — как всегда.
    -> DONE
- -> main_hub
