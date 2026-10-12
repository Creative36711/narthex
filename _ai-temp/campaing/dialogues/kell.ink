EXTERNAL change_disposition(a0, a1)
EXTERNAL get_flag(a0)
EXTERNAL has_item(a0)
EXTERNAL present_item(a0, a1, a2)
EXTERNAL set_flag(a0)
EXTERNAL skill_check(a0, a1)
EXTERNAL unlock_codex(a0)
EXTERNAL fire_rule(a0)

VAR r = 0

=== Начало ===
{ get_flag("met_kell"): -> Снова }
Келл не встаёт. Он просто кладёт руку на рукоять клинка. # action # sfx: snd_blade # voice: assets/voice/narr_kell_1.mp3
Дознаватель. Я тебя не вызывал. # voice: assets/voice/kell_6.mp3
~ set_flag("met_kell")
-> Начало_hub

=== Снова ===
Келл узнаёт тебя и не убирает руки с рукояти. # action # voice: assets/voice/narr_kell_rep.mp3
-> Начало_hub

=== Начало_hub ===
* { not (get_flag("kell_asked13")) } [Где ты был в ночь тринадцатого?]
    ~ set_flag("kell_asked13")
    ~ r = skill_check("intimidate", 50)
    {r: -> Начало_hub_ok1 | -> Начало_hub_no1}
+ [Что такое режим тишины?]
Это когда ярус закрывают и считают, сколько в нём осталось людей. # emotion: calm # voice: assets/voice/kell_2.mp3
    Хорошая вещь, если ты не из тех, кого считают. # emotion: calm # voice: assets/voice/kell_12.mp3
    -> Начало_hub
* { not (get_flag("kell_accused")) and get_flag("clue_guard") } [Ты убил стража Ярова.]
    ~ set_flag("kell_accused")
    ~ r = skill_check("intimidate", 55)
    {r: -> Начало_hub_ok2 | -> Начало_hub_no2}
+ { has_item("item_roster") and not (get_flag("kell_confessed")) } [Наряд тринадцатого: твой взвод шёл вниз, а запись делали наверх.]
    -> Наряд
+ { not (get_flag("kell_token")) } [Положить перед Келлом находку.]
    ~ present_item("Жетон", "Жетон_мимо", "item_guard_token")
    -> DONE
+ [Пропусти меня к помпе.]
Помпа не моя. Иди, смотри. Только вниз не суйся: там не наша вода. # emotion: thoughtful # voice: assets/voice/kell_1.mp3
    -> Начало_hub
+ [Я иду к инспектору.]
    Иди. Она любит, когда к ней идут с пустыми руками. # emotion: calm # voice: assets/voice/kell_10.mp3
    -> DONE
+ { get_flag("clue_glove") and not (get_flag("kell_glove")) } [Показать находку с привода.]
    ~ present_item("Рукавица", "Жетон_мимо", "item_glove")
    -> DONE
- -> Начало_hub

=== Наряд ===
Он смотрит на бумагу долго, потом убирает руку с рукояти. # action # voice: assets/voice/narr_kell_3.mp3
Двенадцать человек, седьмой ярус, с двадцати до шести. Моя подпись стоит второй. # emotion: thoughtful # voice: assets/voice/kell_4.mp3
Первую подпись ты уже видел. Старшина — это только руки, дознаватель. Бумагу подписывают не руки. # voice: assets/voice/kell_9.mp3
~ set_flag("clue_roster")
~ set_flag("kell_confessed")
~ change_disposition("npc_kell", -10)
~ unlock_codex("codex_silence")
-> Начало_hub

=== Начало_hub_ok1 ===
На седьмом. Стоял, как велено. Двенадцать человек, все в журнале — спроси у Векса, он записывал. # voice: assets/voice/kell_11.mp3
~ change_disposition("npc_kell", -6)
~ set_flag("kell_pressed")
-> Начало_hub

=== Начало_hub_no1 ===
Ты меня допрашиваешь? Забавно. У тебя бумага, у меня двенадцать свидетелей, которые стояли со мной. # voice: assets/voice/kell_14.mp3
~ change_disposition("npc_kell", -10)
-> Начало_hub

=== Начало_hub_ok2 ===
Не я. Приказ есть приказ: закрыть затвор, никого не выпускать. Он не послушал. Я не спрашивал, почему. # voice: assets/voice/kell_3.mp3
~ set_flag("kell_confessed")
~ change_disposition("npc_kell", -20)
~ change_disposition("faction_nadzor", -15)
-> Начало_hub

=== Начало_hub_no2 ===
За такие слова внизу не отвечают. Считай, я не слышал — пока ты при исполнении. # voice: assets/voice/kell_15.mp3
~ change_disposition("npc_kell", -8)
-> Начало_hub

=== Жетон ===
Келл смотрит на медь так, будто она горячая, и не берёт. # action # sfx: snd_tag # voice: assets/voice/narr_kell_4.mp3
Яров. Значит, вода сошла у затвора, и ты нашёл его у решётки. Я три дня не смел зайти к его сестре. # emotion: sad # voice: assets/voice/kell_5.mp3
Отдай ей сам. И скажи: Келл стоял у затвора и не открыл. Это правда, и она хуже любой лжи, которую ты мог бы придумать. # emotion: thoughtful # voice: assets/voice/kell_7.mp3
~ set_flag("kell_token")
~ change_disposition("npc_kell", 10)
~ fire_rule("rule_kell_token")
-> Начало_hub

=== Жетон_мимо ===
Келл смотрит сначала на вещь, потом на тебя — и без всякого интереса. # action # voice: assets/voice/narr_kell_5.mp3
-> Начало_hub

=== Рукавица ===
~ set_flag("kell_glove")
Он берёт рукавицу за манжет, не разворачивая. # action # sfx: snd_cloth # voice: assets/voice/narr_kell_2.mp3
Рукавица. В машинном зале их сто пар лежит: смене выдают по две на руки. Клади в дело, раз нравится. Мне интереснее, кто её первым снимет. # emotion: calm # voice: assets/voice/kell_13.mp3
~ change_disposition("npc_kell", -3)
-> Начало_hub
