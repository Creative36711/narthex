EXTERNAL add_item(a0, a1)
EXTERNAL change_disposition(a0, a1)
EXTERNAL get_flag(a0)
EXTERNAL has_item(a0)
EXTERNAL join_party(a0)
EXTERNAL set_flag(a0)
EXTERNAL skill_check(a0, a1)
EXTERNAL unlock_codex(a0)
EXTERNAL unlock_recipe(a0)

VAR r = 0

=== Начало ===
Реш сидит спиной к стене и смотрит не на тебя — в стену. # action
Ты пришёл меня арестовать или послушать? Арестовывать удобнее: для этого не надо понимать. # voice: assets/voice/resh_1.mp3
Семёрку не чинили, потому что ей не давали ходу. Это разные вещи, и разница между ними стоит семьдесят два часа. # voice: assets/voice/resh_12.mp3
Я не прятался. Я ждал, пока кто-нибудь спустится и задаст правильный вопрос. # voice: assets/voice/resh_13.mp3
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
    -> Начало_hub
+ { not (has_item("item_core")) and not (has_item("item_key_cache")) } [Отдай сердцевину.]
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
+ { get_flag("resh_trusts") } [Пойдём со мной.]
    Он встаёт тяжело, опираясь о стену ладонью. # action # sfx: snd_stone
    Хорошо. Но если я увижу, что ты вставишь сердцевину в привод — я лягу на муфту. # voice: assets/voice/resh_8.mp3
    ~ join_party("npc_resh")
    -> Начало_hub
+ [Мне пора.]
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
