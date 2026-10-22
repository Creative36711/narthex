EXTERNAL present_item(a0, a1, a2)
EXTERNAL clear_flag(a0)
EXTERNAL set_description(a0, a1)
EXTERNAL join_party(a0)
EXTERNAL leave_party(a0)
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
{ get_flag("met_ira"): -> Снова }
Девушка у пульта стирает мазут с ладоней ветошью и смотрит на тебя исподлобья. # action # voice: assets/voice/narr_ira_1.mp3
Ты насчёт помпы? Я Ира Ярова, помощница мастера. Всё уже рассказала старшине — он велел не мешать. # voice: assets/voice/ira_1.mp3 # emotion: afraid
~ learn_name("npc_ira")
~ set_flag("met_ira")
-> Начало_hub

=== Снова ===
{ in_party("npc_ira"): -> В_пути }
Ира поднимает глаза от пульта и ждёт, что ты скажешь. # action # voice: assets/voice/narr_ira_rep.mp3
-> Начало_hub

=== В_пути ===
Ира идёт рядом, держа фонарь пониже, и ждёт, что ты скажешь. # action # voice: assets/voice/narr_ira_14.mp3
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
* { not (has_item("item_key_resh")) and not (get_flag("resh_room_open")) and not (get_flag("ira_key_asked")) and not (in_party("npc_ira")) } [Где ключ от каморки мастера?]
    ~ set_flag("ira_key_asked")
    ~ r = skill_check("persuade", 50)
    {r: -> Начало_hub_ok1 | -> Начало_hub_no1}
* { get_flag("clue_guard") and not (get_flag("ira_told_brother")) } [Твой брат — Стась Яров?]
    Она замирает. Ветошь падает на пол. # action # voice: assets/voice/narr_ira_3.mp3
    Он в ночную сменился. Тринадцатого. Сказал — к утру вернётся. # voice: assets/voice/ira_8.mp3
    -> Брат
* { has_item("item_guard_token") and get_flag("ira_told_brother") and not (get_flag("ira_saw_body")) } [Я нашёл его жетон.]
    Она берёт жетон двумя руками, как воду. # action # sfx: snd_tag # voice: assets/voice/narr_ira_4.mp3
Спасибо. За то, что не написал «погиб при исполнении». Он не при исполнении. # voice: assets/voice/ira_3.mp3
    ~ fire_rule("rule_ira_brother")
    -> Начало_hub
* { has_item("item_guard_token") and get_flag("ira_saw_body") } [Возьми жетон Стася. Он твой.]
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
+ { not (get_flag("ira_recruited")) and get_disposition("npc_ira") >= 25 } [Пойдём со мной. Здесь тебя не защитят.]
    Она кивает раньше, чем ты договорил. # action # voice: assets/voice/narr_ira_5.mp3
    Только возьму фонарь. И ключ от затвора — у помощницы мастера он свой. # voice: assets/voice/ira_9.mp3
    ~ fire_rule("rule_ira_joins")
    -> Начало_hub
+ { get_flag("clue_glove") and not (get_flag("ira_glove")) } [Показать находку с привода.]
    ~ present_item("Рукавица", "Не_то", "item_glove")
    -> DONE
* { get_flag("pack_tag") and not (get_flag("ira_pack")) } [Ранец из галереи. Бирка: «Смена 13-го. Ярус 8». Чей он?]
    ~ set_flag("ira_pack")
    Лямку узлом он вязал. Устав велит пряжкой, а Стась говорил: пряжка на бегу расстёгивается. Это его ранец. # emotion: sad # voice: assets/voice/ira_28.mp3
    Паёк и флягу бросил... Значит, не прятался. Бежал к затвору — закрывать воду, пока ещё можно было. # emotion: thoughtful # voice: assets/voice/ira_29.mp3
    ~ change_disposition("npc_ira", 4)
    ~ fire_rule("rule_ira_pack")
    -> Начало_hub
+ { get_flag("valve_found") and not (get_flag("ira_valve")) and not (get_flag("sluice_ready")) } [Показать деталь из шахты.]
    ~ present_item("Клапан", "Не_то", "item_valve")
    -> DONE
+ { get_flag("ira_recruited") and not (in_party("npc_ira")) } [Пойдём со мной снова.]
    Опять вниз? Пойдём. Фонарь я так и не выпустила из рук. # emotion: calm # voice: assets/voice/ira_38.mp3
    ~ join_party("npc_ira")
    ~ set_flag("ira_joined")
    ~ set_description("npc_ira", "Помощница мастера, пошедшая с дознавателем. Знает помпу по звуку и не верит бумагам.")
    -> DONE
+ { in_party("npc_ira") } [Как ты держишься?]
    { get_flag("ira_worn"): -> Самочувствие_плохо | -> Самочувствие_хорошо }
+ { in_party("npc_ira") } [Возвращайся к пульту. Дальше я сам.]
    Ладно, вернусь к пульту. Только не пропадай там внизу, как он. # emotion: sad # voice: assets/voice/ira_37.mp3
    ~ leave_party("npc_ira")
    ~ clear_flag("ira_joined")
    ~ fire_rule("rule_ira_returns_card")
    ~ set_description("npc_ira", "Помощница мастера. Ходила с дознавателем вниз, теперь снова ждёт у пульта.")
    -> DONE
+ { not (in_party("npc_ira")) } [Мне пора.]
    -> DONE
+ { in_party("npc_ira") } [Идём дальше.]
    -> DONE
- -> Начало_hub

=== Самочувствие_плохо ===
Ноги сами идут, а голова уже нет. Дай поесть или дай поспать — что-нибудь одно, я не гордая. # emotion: tired # voice: assets/voice/ira_35.mp3
-> Начало_hub

=== Самочувствие_хорошо ===
Держусь. Пока ты идёшь — и я иду. Только фонарь у меня, так что не убегай вперёд. # emotion: calm # voice: assets/voice/ira_36.mp3
-> Начало_hub

=== Брат ===
Она поднимает ветошь, но не вытирает руки. # action # voice: assets/voice/narr_ira_7.mp3
Говори. Ты же не просто так спросил. Каждый вопрос здесь чего-нибудь стоит. Моего времени, например. # voice: assets/voice/ira_14.mp3
Только не говори «погиб». Матери сказали — перевели на другой ярус. Пусть это ещё побудет правдой. # voice: assets/voice/ira_15.mp3
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
-> DONE

=== Начало_hub_ok1 ===
У меня был второй, на случай смены. Держи — только не говори, что я дала. # voice: assets/voice/ira_12.mp3
~ add_item("item_key_resh", 1)
~ change_disposition("npc_ira", 6)
-> Начало_hub

=== Начало_hub_no1 ===
Ключ был у мастера. Где мастер — там и ключ. # emotion: sad # voice: assets/voice/ira_13.mp3
~ change_disposition("npc_ira", -3)
-> Начало_hub

=== У_затвора ===
Ира останавливается у края воды и долго смотрит на штурвал. Ключ в её руке висит, как лишний. # action # sfx: sfx_water # voice: assets/voice/narr_ira_10.mp3
Стась здесь стоял каждую смену. Говорил: затвор — как сердце. Пока ходит, ярус живёт. # emotion: sad # voice: assets/voice/ira_21.mp3
{ get_flag("clue_guard"): -> страж }
-> У_затвора_hub
= страж
А его здесь оставили. Одного, у воды. Свои оставили. # emotion: angry # voice: assets/voice/ira_22.mp3
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
{ has_item("item_vein_shard"): -> звон }
-> В_штольне_hub
= звон
И от тебя звенит. Ты носишь стекляшку того, с гогглами? Выбрось, пока она тебя не выбрала. # emotion: angry # voice: assets/voice/ira_27.mp3
-> В_штольне_hub

=== В_штольне_hub ===
* [Что ещё говорил твой отец?]
    Что жилу не продают. Её либо закрывают, либо она закрывает тебя. Он закрыл одну, на седьмом. Потом кашлял до последнего дня. # emotion: sad # voice: assets/voice/ira_26.mp3
    ~ change_disposition("npc_ira", 3)
    ~ unlock_codex("codex_vein")
    -> В_штольне_hub
+ [Пойдём.]
    -> DONE

=== У_тела ===
~ set_flag("ira_saw_body")
~ set_flag("ira_told_brother")
Ира опускает фонарь. Свет ложится на казённую куртку и на сорванную цепочку в сведённых пальцах. # action # voice: assets/voice/narr_ira_12.mp3
Не свети ему в лицо, я и так знаю, кто это. Матери сказали — перевели на другой ярус. Вот он, другой ярус. # emotion: sad # voice: assets/voice/ira_32.mp3
-> У_тела_hub

=== У_тела_hub ===
~ set_dialogue_timer(12, "У_тела_молчание")
* [Мне жаль, Ира.]
    Не жалей. Запомни, как он лежит и что у него в пальцах. Теперь это улика, а не брат. # emotion: angry # voice: assets/voice/ira_33.mp3
    ~ change_disposition("npc_ira", 8)
    -> У_тела_конец
* [Он держал затвор до последнего.]
    Знал, что вода пойдёт, и всё равно стоял. Только ударили его сзади. Вода так не бьёт. # emotion: sad # voice: assets/voice/ira_34.mp3
    ~ change_disposition("npc_ira", 10)
    -> У_тела_конец

=== У_тела_молчание ===
Ира стоит над братом, пока фонарь в её руке не перестаёт дрожать. # action # voice: assets/voice/narr_ira_13.mp3
Вот и я молчу третий день. Ничего, привыкла. # emotion: sad # voice: assets/voice/ira_17.mp3
~ change_disposition("npc_ira", 4)
-> У_тела_конец

=== У_тела_конец ===
~ fire_rule("rule_ira_body_card")
-> DONE

=== Б_галерея ===
Стась водил меня сюда смотреть, как светится вода. Говорил: не трогай, оно запоминает руки. # emotion: sad # voice: assets/voice/ira_39.mp3
-> DONE

=== Б_ряд ===
В Сухом ряду все друг другу должны, поэтому никто никого не выдаёт. Держи руки на виду. # emotion: thoughtful # voice: assets/voice/ira_40.mp3
-> DONE

=== Б_штольня ===
Дальше Стась не ходил. Говорил, в штольне воздух чужой. # emotion: afraid # voice: assets/voice/ira_41.mp3
-> DONE

=== Б_забой ===
Так вот куда мастер уходил по ночам. Говорил — к больному. # emotion: thoughtful # voice: assets/voice/ira_42.mp3
-> DONE

=== П_ссора ===
Он не вернётся. Сорок лет он выбирал жилу — и сегодня выбрал снова. # emotion: sad # voice: assets/voice/ira_43.mp3
-> DONE

=== П_смерть_реша ===
Он учил меня слушать помпу. Говорил: если замолчит — ищи, кто её заткнул. Теперь замолчал он. # emotion: sad # voice: assets/voice/ira_44.mp3
-> DONE

=== П_уступил ===
Спасибо, мастер. Я запомню, что ты отошёл сам. # emotion: calm # voice: assets/voice/ira_45.mp3
-> DONE

=== Рукавица ===
~ set_flag("ira_glove")
Она берёт рукавицу за манжет двумя пальцами, как чужую вещь. # action # sfx: snd_cloth # voice: assets/voice/narr_ira_6.mp3
Реш носил кожаные и жаловался, что они жмут. А заплату ставили в Сухом ряду: у Айлы так штопают, когда нечем платить. # emotion: thoughtful # voice: assets/voice/ira_16.mp3
~ change_disposition("npc_ira", 4)
~ learn_name("npc_ayla")
-> Начало_hub

=== Клапан ===
~ set_flag("ira_valve")
Она проводит пальцем по выбитой семёрке. # action # sfx: snd_tag # voice: assets/voice/narr_ira_15.mp3
Седьмой номер — с нашего затвора. Резьба целая: его не сорвало водой, его вывернули ключом. Неси на восьмой, к затвору, пока там ещё есть что закрывать. # emotion: thoughtful # voice: assets/voice/ira_31.mp3
~ change_disposition("npc_ira", 3)
~ fire_rule("rule_ira_valve")
-> Начало_hub

=== Не_то ===
Не узнаю. Я помпу знаю, а не чужие карманы. # emotion: thoughtful # voice: assets/voice/ira_46.mp3
-> Начало_hub
