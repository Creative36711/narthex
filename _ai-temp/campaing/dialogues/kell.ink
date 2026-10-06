EXTERNAL change_disposition(a0, a1)
EXTERNAL get_flag(a0)
EXTERNAL has_item(a0)
EXTERNAL set_flag(a0)
EXTERNAL skill_check(a0, a1)
EXTERNAL unlock_codex(a0)

VAR r = 0

=== Начало ===
Келл не встаёт. Он просто кладёт руку на рукоять клинка. # action
Дознаватель. Я тебя не вызывал.
-> Начало_hub

=== Начало_hub ===
+ [Где ты был в ночь тринадцатого?]
    ~ r = skill_check("intimidate", 50)
    {r: -> Начало_hub_ok1 | -> Начало_hub_no1}
+ [Что такое режим тишины?]
Это когда ярус закрывают и считают, сколько в нём осталось людей. # emotion: calm # voice: assets/voice/kell_2.mp3
    Хорошая вещь, если ты не из тех, кого считают. # emotion: calm
    -> Начало_hub
+ { get_flag("clue_guard") } [Ты убил стража Ярова.]
    ~ r = skill_check("intimidate", 55)
    {r: -> Начало_hub_ok2 | -> Начало_hub_no2}
+ { has_item("item_roster") } [Наряд тринадцатого: твой взвод шёл вниз, а запись делали наверх.]
    -> Наряд
+ [Пропусти меня к помпе.]
Помпа не моя. Иди, смотри. Только вниз не суйся: там не наша вода. # emotion: thoughtful # voice: assets/voice/kell_1.mp3
    -> Начало_hub
+ [Я иду к инспектору.]
    Иди. Она любит, когда к ней идут с пустыми руками. # emotion: calm
    -> DONE
- -> Начало_hub

=== Наряд ===
Он смотрит на бумагу долго, потом убирает руку с рукояти. # action
Двенадцать человек, седьмой ярус, с двадцати до шести. Моя подпись стоит второй. # emotion: thoughtful # voice: assets/voice/kell_4.mp3
Первую ты уже видел. Я — руки, старшина. Бумагу подписывают не руки.
~ set_flag("clue_roster")
~ set_flag("kell_confessed")
~ change_disposition("npc_kell", -10)
~ unlock_codex("codex_silence")
-> Начало_hub

=== Начало_hub_ok1 ===
На седьмом. Стоял, как велено. Двенадцать человек, все в журнале — спроси у Векса, он записывал.
~ change_disposition("npc_kell", -6)
~ set_flag("kell_pressed")
-> Начало_hub

=== Начало_hub_no1 ===
Ты меня допрашиваешь? Забавно. У тебя бумага, у меня двенадцать свидетелей, которые стояли со мной.
~ change_disposition("npc_kell", -10)
-> Начало_hub

=== Начало_hub_ok2 ===
Не я. Приказ есть приказ: закрыть затвор, никого не выпускать. Он не послушал. Я не спрашивал, почему. # voice: assets/voice/kell_3.mp3
~ set_flag("kell_confessed")
~ change_disposition("npc_kell", -20)
~ change_disposition("faction_nadzor", -15)
-> Начало_hub

=== Начало_hub_no2 ===
За такие слова внизу не отвечают. Считай, я не слышал — пока ты при исполнении.
~ change_disposition("npc_kell", -8)
-> Начало_hub
