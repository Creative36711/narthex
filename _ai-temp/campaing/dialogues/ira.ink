EXTERNAL unlock_codex(a0)
EXTERNAL in_party(a0)
EXTERNAL set_flag(a0)
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
* { not (get_flag("ira_story")) } [Расскажи, что случилось в ночь тринадцатого.]
    ~ set_flag("ira_story")
    Смена шла ровно. В восемнадцать сорок мастер спустился в шахту: сказал — проверить привод. # voice: assets/voice/ira_4.mp3
В девятнадцать десять помпа встала. В двадцать ноль-ноль в зал зашёл Келл со взводом и велел всем выйти. # voice: assets/voice/ira_2.mp3
    Она вытирает ладони о штаны. Полотно всё равно чёрное. # action # sfx: snd_cloth # voice: assets/voice/narr_ira_2.mp3
    ~ change_disposition("npc_ira", 6)
    ~ fire_rule("rule_ira_story")
    -> Начало_hub
* { not (has_item("item_key_resh")) and not (get_flag("resh_room_open")) } [Где ключ от его каморки?]
    ~ r = skill_check("persuade", 50)
    {r: -> Начало_hub_ok1 | -> Начало_hub_no1}
* { get_flag("clue_guard") and not (get_flag("ira_told_brother")) } [Твой брат — Стась Яров?]
    Она замирает. Ветошь падает на пол. # action # voice: assets/voice/narr_ira_3.mp3
    Он в ночную сменился. Двенадцатого. Сказал — к утру. # voice: assets/voice/ira_8.mp3
    -> Брат
* { has_item("item_guard_token") and get_flag("ira_told_brother") } [Я нашёл его жетон.]
    Она берёт жетон двумя руками, как воду. # action # sfx: snd_tag # voice: assets/voice/narr_ira_4.mp3
Спасибо. За то, что не написал «погиб при исполнении». Он не при исполнении. # voice: assets/voice/ira_3.mp3
    ~ fire_rule("rule_ira_brother")
    -> Начало_hub
* { not (get_flag("ira_journal")) and get_flag("vex_journal") and get_flag("ira_told_brother") } [Векс записал: вниз ушли двенадцать, вернулись одиннадцать.]
    ~ set_flag("ira_journal")
    Она долго молчит, сжимая ветошь в кулаке. # action # voice: assets/voice/narr_ira_9.mp3
    Одиннадцать. Значит, его не забыли записать. Его не вернули. # emotion: sad # voice: assets/voice/ira_18.mp3
    Келл сказал матери — перевели на другой ярус. На другой ярус без записи не переводят. # emotion: angry # voice: assets/voice/ira_19.mp3
    ~ change_disposition("npc_ira", 6)
    -> Начало_hub
* { not (get_flag("ira_gauge")) and get_flag("vex_job_done") } [Векс говорит: сводки о воде пишут под диктовку.]
    ~ set_flag("ira_gauge")
    Я это по помпе слышала раньше, чем он по рейке. Когда привод стоит, вода стабильной не бывает. Стабильной бывает только ложь. # emotion: angry # voice: assets/voice/ira_20.mp3
    ~ change_disposition("npc_ira", 4)
    -> Начало_hub
+ [Кто, по-твоему, остановил помпу?]
    Кто-то, кому выгодно, чтобы восьмой затопило. # voice: assets/voice/ira_10.mp3
    Надзор два года просил Цех отдать девятый ярус. Теперь он ничей — и под водой. # emotion: thoughtful # voice: assets/voice/ira_5.mp3
    -> Начало_hub
+ { not (get_flag("ira_joined")) and get_disposition("npc_ira") >= 25 } [Пойдём со мной. Здесь тебя не защитят.]
    Она кивает раньше, чем ты договорил. # action # voice: assets/voice/narr_ira_5.mp3
    Только дай взять ключ. И фонарь. И ещё раз ключ. # voice: assets/voice/ira_9.mp3
    ~ fire_rule("rule_ira_joins")
    -> Начало_hub
* { not (get_flag("ira_glove")) and has_item("item_glove") } [Показать рукавицу с привода.]
    ~ set_flag("ira_glove")
    Она берёт рукавицу за манжет двумя пальцами, как чужую вещь. # action # sfx: snd_cloth # voice: assets/voice/narr_ira_6.mp3
    Реш носил кожаные и жаловался, что они жмут. А заплату ставили в Сухом ряду: у Айлы так штопают, когда нечем платить. # emotion: thoughtful # voice: assets/voice/ira_16.mp3
    ~ change_disposition("npc_ira", 4)
    ~ learn_name("npc_ayla")
    -> Начало_hub
* { get_flag("pack_tag") and not (get_flag("ira_pack")) } [В галерее лежит казённый ранец. Бирка: «Смена 13-го. Ярус 8».]
    ~ set_flag("ira_pack")
    Лямку узлом он вязал. Устав велит пряжкой, а Стась говорил: пряжка на бегу расстёгивается. Это его ранец. # emotion: sad # voice: assets/voice/ira_28.mp3
    Паёк и флягу бросил... Значит, не прятался. Бежал к затвору — закрывать воду, пока ещё можно было. # emotion: thoughtful # voice: assets/voice/ira_29.mp3
    ~ change_disposition("npc_ira", 4)
    ~ fire_rule("rule_ira_pack")
    -> Начало_hub
+ [Мне пора.]
    -> DONE
- -> Начало_hub

=== Брат ===
Она поднимает ветошь, но не вытирает руки. # action # voice: assets/voice/narr_ira_7.mp3
Говори. Ты же не просто так спросил. # voice: assets/voice/ira_14.mp3
Только не говори «погиб». Это про него уже сказали, а я его ещё не видела. # voice: assets/voice/ira_15.mp3
~ set_flag("ira_told_brother")
-> Брат_hub

=== Брат_hub ===
~ set_dialogue_timer(18, "Молчание")
* [Он не вышел со смены. Я нашёл тело у затвора.]
    Значит, он всё-таки закрывал затвор. Его послали туда, где он умел. # emotion: sad # voice: assets/voice/ira_7.mp3
    ~ change_disposition("npc_ira", 12)
    -> Начало_hub
* [Я найду того, кто это сделал.]
    Не надо «найду». Надо «назову». Назови имя, и я поверю. # emotion: angry # voice: assets/voice/ira_6.mp3
    ~ change_disposition("npc_ira", 8)
    -> Начало_hub
* [Я не знал его. Прости.]
    Никто его не знал. Он стоял внизу, когда все спали. Вот и всё. # emotion: sad # voice: assets/voice/ira_11.mp3
    -> Начало_hub

=== Молчание ===
Ты молчишь. Она ждёт — и поднимает ветошь с пола. # action # voice: assets/voice/narr_ira_8.mp3
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

=== У_затвора ===
Ира останавливается у края воды и долго смотрит на штурвал. Ключ в её руке висит, как лишний. # action # sfx: sfx_water # voice: assets/voice/narr_ira_10.mp3
Стась здесь стоял каждую смену. Говорил: затвор — как сердце. Пока ходит, ярус живёт. # emotion: sad # voice: assets/voice/ira_21.mp3
{ get_flag("clue_guard"):
    А его здесь оставили. Одного, у воды. Свои оставили. # emotion: angry # voice: assets/voice/ira_22.mp3
}
-> У_затвора_hub

=== У_затвора_hub ===
* [Мы закончим то, что он не успел.]
    Тогда по-честному. Чтобы в отчёте стояло его имя, а не «пропал без вести». # emotion: calm # voice: assets/voice/ira_23.mp3
    ~ change_disposition("npc_ira", 5)
    -> У_затвора_hub
* { not (get_flag("ira_rig_tip")) } [Ты знаешь, как он устроен?]
    ~ set_flag("ira_rig_tip")
    Стась показывал. Под нижними мостками есть ригель. К нему можно подойти по воде, и сверху тебя не видно. Он там от старшины прятался, когда курил. # emotion: thoughtful # voice: assets/voice/ira_24.mp3
    ~ fire_rule("rule_ira_rig_tip")
    -> У_затвора_hub
+ [Пойдём.]
    -> DONE

=== В_штольне ===
Ира поднимает фонарь и замирает. Из-за крепи доносится тонкий звон, будто кто-то ведёт пальцем по краю стакана. # action # sfx: sfx_hum # voice: assets/voice/narr_ira_11.mp3
Слышишь? Отец говорил: жила поёт тем, кто стоит к ней слишком долго. Не стой долго. # emotion: afraid # voice: assets/voice/ira_25.mp3
{ has_item("item_vein_shard"):
    И от тебя звенит. Ты носишь стекляшку того, с гогглами? Выбрось, пока она тебя не выбрала. # emotion: angry # voice: assets/voice/ira_27.mp3
}
-> В_штольне_hub

=== В_штольне_hub ===
* [Что ещё говорил твой отец?]
    Что жилу не продают. Её либо закрывают, либо она закрывает тебя. Он закрыл одну, на седьмом. Потом кашлял до последнего дня. # emotion: sad # voice: assets/voice/ira_26.mp3
    ~ change_disposition("npc_ira", 3)
    ~ unlock_codex("codex_vein")
    -> В_штольне_hub
+ [Пойдём.]
    -> DONE
