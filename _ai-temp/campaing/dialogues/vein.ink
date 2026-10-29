EXTERNAL get_flag(a0)
EXTERNAL clear_flag(a0)
EXTERNAL apply_status(a0, a1)
EXTERNAL fire_rule(a0)
EXTERNAL has_item(a0)
EXTERNAL remove_item(a0, a1)
EXTERNAL set_dialogue_timer(a0, a1)
EXTERNAL set_flag(a0)
EXTERNAL unlock_codex(a0)

=== Начало ===
{ get_flag("met_vein"): -> Снова }
Стена светится ровно, как бирюза под водой. Звук идёт не из породы — из груди. # action # voice: assets/voice/narr_vein_1.mp3
Ты пришёл с чужим жетоном и чужим сроком. Я помню всех, кто брал. # voice: assets/voice/vein_1.mp3
Семь помп считали мои годы. Когда седьмая замолчала, я впервые за сто тридцать семь лет услышала, как тихо. # voice: assets/voice/vein_6.mp3
Ты считаешь, что спасаешь город. Я под ним стою сто тридцать семь лет: мне виднее, что здесь спасать. # voice: assets/voice/vein_8.mp3
~ set_flag("met_vein")
-> Начало_hub

=== Снова ===
Свет в стене вздрагивает и разгорается ровнее, узнавая тебя. # action # voice: assets/voice/narr_vein_rep.mp3
-> Начало_hub

=== Начало_hub ===
~ set_dialogue_timer(20, "Молчание")
+ [Что ты такое?]
Я то, что было здесь до города, и то, что будет после. Вы называете это жилой, потому что вам нужно что-то вынимать. # emotion: calm # voice: assets/voice/vein_3.mp3
Мастер не прятался от вас. Он сидел у меня и слушал — чтобы вы не услышали, как я прошу. # voice: assets/voice/vein_9.mp3
    -> Начало_hub
+ [Почему помпы молчат?]
    Потому что вы качаете меня наружу уже сто тридцать семь лет. У меня кончается терпение, а не вода. # emotion: calm # voice: assets/voice/vein_5.mp3
    ~ unlock_codex("codex_vein")
    ~ set_flag("vein_heard")
    -> Начало_hub
+ { has_item("item_core") } [Вложить сердцевину в стену.]
    Ты кладёшь ладонь на камень. Он тёплый и отвечает на пульс. # action # sfx: sfx_hum # voice: assets/voice/narr_vein_2.mp3
Бери. И помни: я помню всех, кто брал, — и всех, кто вернул. # emotion: calm # voice: assets/voice/vein_4.mp3
    ~ remove_item("item_core", 1)
    ~ apply_status("status_veinsong", 24)
    ~ clear_flag("vein_braced")
    ~ fire_rule("rule_end_vein")
    -> DONE
+ [Я ухожу.]
    -> DONE

=== Молчание ===
Молчание длится, пока не закладывает уши. # action # sfx: sfx_hum # voice: assets/voice/narr_vein_3.mp3
Ты молчишь. Я слышала этот ответ от всех, кто брал. Он всегда означал «дам». # voice: assets/voice/vein_2.mp3
Молчание — тоже ответ. Просто не тот, который ты надеялся дать. # voice: assets/voice/vein_7.mp3
Если уйдёшь сейчас, седьмая простоит ещё сутки. Я умею ждать. Вода — нет. # voice: assets/voice/vein_10.mp3
-> DONE
