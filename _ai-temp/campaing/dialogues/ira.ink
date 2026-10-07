EXTERNAL add_item(a0, a1)
EXTERNAL change_disposition(a0, a1)
EXTERNAL fire_rule(a0)
EXTERNAL get_disposition(a0)
EXTERNAL get_flag(a0)
EXTERNAL has_item(a0)
EXTERNAL set_dialogue_timer(a0, a1)
EXTERNAL skill_check(a0, a1)
EXTERNAL learn_name(a0)

VAR r = 0

=== Начало ===
Ира стирает мазут с ладоней ветошью и смотрит на тебя исподлобья. # action # voice: assets/voice/narr_ira_1.mp3
Ты насчёт помпы? Я уже всё рассказала старшине. Он велел не мешать. # voice: assets/voice/ira_1.mp3 # emotion: afraid
~ learn_name("npc_ira")
-> Начало_hub

=== Начало_hub ===
+ [Расскажи, что случилось в ночь тринадцатого.]
    Смена шла ровно. В восемнадцать сорок мастер спустился в шахту: сказал — проверить привод. # voice: assets/voice/ira_4.mp3
В девятнадцать десять помпа встала. В двадцать ноль-ноль в зал зашёл Келл со взводом и велел всем выйти. # voice: assets/voice/ira_2.mp3
    Она вытирает ладони о штаны. Полотно всё равно чёрное. # action # sfx: snd_cloth
    ~ change_disposition("npc_ira", 6)
    ~ fire_rule("rule_ira_story")
    -> Начало_hub
+ [Где ключ от его каморки?]
    ~ r = skill_check("persuade", 50)
    {r: -> Начало_hub_ok1 | -> Начало_hub_no1}
+ { get_flag("clue_guard") and not (get_flag("body_returned")) } [Твой брат — Стась Яров?]
    Она замирает. Ветошь падает на пол. # action
    Он в ночную сменился. Двенадцатого. Сказал — к утру. # voice: assets/voice/ira_8.mp3
    -> Брат
+ { has_item("item_guard_token") } [Я нашёл его жетон.]
    Она берёт жетон двумя руками, как воду. # action # sfx: snd_tag
Спасибо. За то, что не написал «погиб при исполнении». Он не при исполнении. # voice: assets/voice/ira_3.mp3
    ~ fire_rule("rule_ira_brother")
    -> Начало_hub
+ [Кто, по-твоему, остановил помпу?]
    Кто-то, кому выгодно, чтобы восьмой затопило. # voice: assets/voice/ira_10.mp3
    Надзор два года просил Цех отдать девятый ярус. Теперь он ничей — и под водой. # emotion: thoughtful # voice: assets/voice/ira_5.mp3
    -> Начало_hub
+ { not (get_flag("ira_joined")) and get_disposition("npc_ira") >= 25 } [Пойдём со мной. Здесь тебя не защитят.]
    Она кивает раньше, чем ты договорил. # action
    Только дай взять ключ. И фонарь. И ещё раз ключ. # voice: assets/voice/ira_9.mp3
    ~ fire_rule("rule_ira_joins")
    -> Начало_hub
+ { has_item("item_glove") } [Показать рукавицу с привода.]
    Она берёт рукавицу за манжет двумя пальцами, как чужую вещь. # action # sfx: snd_cloth
    Реш носил кожаные и жаловался, что они жмут. А заплату ставили в Сухом ряду: у Айлы так штопают, когда нечем платить. # emotion: thoughtful # voice: assets/voice/ira_16.mp3
    ~ change_disposition("npc_ira", 4)
    ~ learn_name("npc_ayla")
    -> Начало_hub
+ [Мне пора.]
    -> DONE
- -> Начало_hub

=== Брат ===
Она поднимает ветошь, но не вытирает руки. # action
Говори. Ты же не просто так спросил. # voice: assets/voice/ira_14.mp3
Только не говори «погиб». Это про него уже сказали, а я его ещё не видела. # voice: assets/voice/ira_15.mp3
-> Брат_hub

=== Брат_hub ===
~ set_dialogue_timer(18, "Молчание")
+ [Он не вышел со смены. Я нашёл тело у затвора.]
    Значит, он всё-таки закрывал затвор. Его послали туда, где он умел. # emotion: sad # voice: assets/voice/ira_7.mp3
    ~ change_disposition("npc_ira", 12)
    -> Брат_hub
+ [Я найду того, кто это сделал.]
    Не надо «найду». Надо «назову». Назови имя, и я поверю. # emotion: angry # voice: assets/voice/ira_6.mp3
    ~ change_disposition("npc_ira", 8)
    -> Брат_hub
+ [Я не знал его. Прости.]
    Никто его не знал. Он стоял внизу, когда все спали. Вот и всё. # emotion: sad # voice: assets/voice/ira_11.mp3
    -> Брат_hub

=== Молчание ===
Ты молчишь. Она ждёт — и поднимает ветошь с пола. # action
Вот и я молчу третий день. Ничего, привыкла. # voice: assets/voice/ira_17.mp3
-> Начало

=== Начало_hub_ok1 ===
У меня был второй, на случай смены. Держи — только не говори, что я дала. # voice: assets/voice/ira_12.mp3
~ add_item("item_key_resh", 1)
~ change_disposition("npc_ira", 6)
-> Начало_hub

=== Начало_hub_no1 ===
У нас был один ключ. Он ушёл вместе с ним. # emotion: sad # voice: assets/voice/ira_13.mp3
~ change_disposition("npc_ira", -3)
-> Начало_hub
