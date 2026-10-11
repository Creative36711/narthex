EXTERNAL change_companion_need(a0, a1, a2)
EXTERNAL fire_rule(a0)
EXTERNAL in_party(a0)
EXTERNAL add_item(a0, a1)
EXTERNAL change_disposition(a0, a1)
EXTERNAL get_flag(a0)
EXTERNAL has_item(a0)
EXTERNAL join_party(a0)
EXTERNAL set_flag(a0)
EXTERNAL skill_check(a0, a1)
EXTERNAL unlock_codex(a0)
EXTERNAL unlock_recipe(a0)
EXTERNAL learn_name(a0)

VAR r = 0

=== Начало ===
{ get_flag("met_resh"): -> Снова }
Реш сидит спиной к стене и смотрит не на тебя — в стену. # action # voice: assets/voice/narr_resh_1.mp3
Ты пришёл меня арестовать или послушать? Арестовывать удобнее: для этого не надо понимать. # voice: assets/voice/resh_1.mp3
Семёрку не чинили, потому что ей не давали ходу. Это разные вещи, и разница между ними стоит семьдесят два часа. # voice: assets/voice/resh_12.mp3
Я не прятался. Я ждал, пока кто-нибудь спустится и задаст правильный вопрос. # voice: assets/voice/resh_13.mp3
~ learn_name("npc_resh")
~ set_flag("met_resh")
-> Начало_hub

=== Снова ===
{ in_party("npc_resh"): -> В_пути }
Реш поворачивает голову на звук шагов: он уже знает, кто пришёл. # action # voice: assets/voice/narr_resh_rep.mp3
-> Начало_hub

=== В_пути ===
Реш шагает следом, придерживаясь ладонью за стену, и ждёт, что ты скажешь. # action
-> Начало_hub

=== Начало_hub ===
+ [Почему ты спустился вниз?]
    Потому что сверху решают, сколько мне жить, а снизу — сколько жить ярусу. # emotion: sad # voice: assets/voice/resh_9.mp3
Жила на девятом не выработана, она живая. Если её взять, восьмой сядет. Мне сказали: «сядет — значит, переселим». # voice: assets/voice/resh_3.mp3
Я снял сердцевину. Пока затвор не ходит, помпу пускать нельзя: вода пойдёт в восьмой и не вернётся. # voice: assets/voice/resh_2.mp3
    ~ unlock_codex("codex_vein")
    ~ set_flag("resh_trusts")
    -> Начало_hub
+ [Кто срезал муфту?]
    Стража. Я видел пломбу на их рукавицах: тринадцать-К. У нас на ярусе пломбы только у тех, кто закрывает. # emotion: angry # voice: assets/voice/resh_6.mp3
    Муфту резали ключом на пятьдесят два, в перчатках: на срезе ни одной мозоли. Сорок лет смотрю, как режут, — по металлу видно, чья рука держала ключ. # emotion: thoughtful # voice: assets/voice/resh_14.mp3
    -> Начало_hub
* { not (has_item("item_core")) and not (has_item("item_key_cache")) and not (get_flag("resh_core_asked")) and not (get_flag("sluice_ready")) } [Отдай сердцевину.]
    ~ set_flag("resh_core_asked")
    ~ r = skill_check("persuade", 55)
    {r: -> Начало_hub_ok1 | -> Начало_hub_no1}
+ [Что такое жила?]
    Это не руда и не вода. Это то, что было здесь раньше города и, похоже, останется после. # emotion: thoughtful # voice: assets/voice/resh_7.mp3
Помпы её откачивают, как кровь откачивают из раны. Мы сорок лет делали каркасу больно, чтобы он стоял. # voice: assets/voice/resh_4.mp3
    ~ unlock_codex("codex_heavy_water")
    -> Начало_hub
* { get_flag("resh_trusts") and not (get_flag("resh_charge_recipe")) } [Научи собирать заряд.]
    Сердцевина, лом, масло и ровные руки. Если руки дрожат — не берись, это не лекарство. # emotion: calm # voice: assets/voice/resh_10.mp3
    ~ unlock_recipe("recipe_charge")
    ~ set_flag("resh_charge_recipe")
    -> Начало_hub
* { get_flag("resh_trusts") and not (get_flag("resh_joined")) } [Пойдём со мной.]
    Он встаёт тяжело, опираясь о стену ладонью. # action # sfx: snd_stone # voice: assets/voice/narr_resh_2.mp3
    Хорошо. Но если я увижу, что ты вставишь сердцевину в привод — я лягу на муфту. # voice: assets/voice/resh_8.mp3
    ~ join_party("npc_resh")
    ~ set_flag("resh_joined")
    ~ change_companion_need("npc_resh", "need_hunger", -72)
    ~ change_companion_need("npc_resh", "need_thirst", -50)
    ~ change_companion_need("npc_resh", "need_rest", -45)
    ~ fire_rule("rule_resh_joins_card")
    -> Начало_hub
+ { has_item("item_filter") } [Дыхатель держит только две банки?]
    Первая банка садится ещё в штольне, вторая — у самого забоя. Кто спускается в третий раз со старой маской, тот дышит уже собой. # emotion: thoughtful # voice: assets/voice/resh_15.mp3
    ~ unlock_codex("codex_filter")
    -> Начало_hub
* { in_party("npc_ira") and not (get_flag("resh_ira")) } [Ира пришла со мной.]
    ~ set_flag("resh_ira")
    Реш поднимается со скамьи и долго смотрит на Иру, будто проверяет, не мерещится ли. # action # voice: assets/voice/narr_resh_3.mp3
    Ира... Я думал, тебя увели наверх вместе со сменой. Хорошо, что не послушалась. # emotion: sad # voice: assets/voice/resh_16.mp3
    Я шёл мимо затвора той ночью, вниз, с сердцевиной. Стась был там, живой, ругался на пустую колодку. Больше я его не видел. # emotion: thoughtful # voice: assets/voice/resh_17.mp3
    «Ругался на колодку... Значит, знал, что его поставили к затвору, который не закрыть». # action # voice: assets/voice/ira_30.mp3
    ~ change_disposition("npc_ira", 5)
    ~ change_disposition("npc_resh", 5)
    ~ set_flag("resh_trusts")
    ~ fire_rule("rule_resh_ira")
    -> Начало_hub
* { get_flag("sluice_ready") and not (has_item("item_core")) and not (has_item("item_key_cache")) and not (get_flag("core_taken")) } [Затвор держит. Теперь отдай сердцевину.]
    Слышал, как он сел, — по трубам слышно. Ладно. Бери сердцевину и ключ от схрона. Только не торопи воду: она помнит, кто её торопил. # emotion: thoughtful # voice: assets/voice/resh_18.mp3
    ~ add_item("item_core", 1)
    ~ add_item("item_key_cache", 1)
    ~ set_flag("core_taken")
    ~ fire_rule("rule_resh_core_given")
    -> Начало_hub
+ { get_flag("resh_joined") and not (in_party("npc_resh")) } [Пойдём со мной снова.]
    Он встаёт тяжело, опираясь о стену ладонью. # action # sfx: snd_stone # voice: assets/voice/narr_resh_2.mp3
    Хорошо. Но если я увижу, что ты вставишь сердцевину в привод — я лягу на муфту. # voice: assets/voice/resh_8.mp3
    ~ join_party("npc_resh")
    -> DONE
+ { not (in_party("npc_resh")) } [Мне пора.]
    -> DONE
+ { in_party("npc_resh") } [Идём дальше.]
    -> DONE
- -> Начало_hub

=== Начало_hub_ok1 ===
Бери. Только сначала почини затвор: без него ты затопишь восьмой быстрее, чем они успеют подписать бумагу. # voice: assets/voice/resh_11.mp3
~ add_item("item_core", 1)
~ add_item("item_key_cache", 1)
~ set_flag("core_taken")
-> Начало_hub

=== Начало_hub_no1 ===
Нет. Ты её вставишь, и восьмой ярус утонет за ночь. Я сорок лет слушал, как дышит город. # voice: assets/voice/resh_5.mp3
~ change_disposition("npc_resh", -5)
-> Начало_hub
