EXTERNAL change_disposition(a0, a1)
EXTERNAL fire_rule(a0)
EXTERNAL get_flag(a0)
EXTERNAL has_item(a0)
EXTERNAL open_trade(a0)
EXTERNAL set_flag(a0)
EXTERNAL skill_check(a0, a1)
EXTERNAL unlock_codex(a0)

VAR r = 0

=== Начало ===
Векс поднимает глаза от пульта и долго смотрит на твой жетон. # action # sfx: sfx_click # voice: assets/voice/narr_vex_1.mp3
Приписной дознаватель? Проходи в контору за дверью, там печка топится. Здесь у затвора только сквозняк и чужие. # voice: assets/voice/vex_1.mp3
Я своим журналом отвечаю за каждого, кто прошёл. # voice: assets/voice/vex_2.mp3
Журнал врёт редко. Чаще его просто не дописывают до конца смены. # voice: assets/voice/vex_10.mp3
-> Начало_hub

=== Начало_hub ===
+ [Что с седьмой помпой?]
    Стоит. Третий день стоит. Механики приходили, слушали, уходили, а вода всё прибывает. # voice: assets/voice/vex_5.mp3
    Он крутит маховик на четверть оборота — тот идёт свободно, как в пустоте. # action # sfx: sfx_gear # voice: assets/voice/narr_vex_2.mp3
Мастер твой Реш спустился в шахту в восемнадцать сорок. Я его сам записал. Обратно — не записал. # voice: assets/voice/vex_3.mp3
    ~ unlock_codex("codex_pumps")
    -> Начало_hub
* { not (get_flag("vex_asked13")) } [Кто проходил через шлюз в ночь тринадцатого?]
    ~ set_flag("vex_asked13")
    ~ r = skill_check("persuade", 45)
    {r: -> Начало_hub_ok1 | -> Начало_hub_no1}
+ [Как спуститься к помпе?]
    Через шлюз, час ходу. Дальше сам машинный зал, в нём — помпа. # voice: assets/voice/vex_8.mp3
    Ниже машинного зала не ходи: там вода стоит и, говорят, ходит. # voice: assets/voice/vex_6.mp3
    Ты спускался ниже седьмого? Нет? Тогда не спорь со мной про воду. # voice: assets/voice/vex_11.mp3
    На восьмом теперь считают не часы, а уголь: сколько унёс, столько и прожил. # emotion: thoughtful # voice: assets/voice/vex_12.mp3
    -> Начало_hub
+ { has_item("item_roster") and not (get_flag("vex_journal")) } [Вот выписка из архива. Покажи журнал целиком.]
    Векс читает выписку, сверяет номер с корешком журнала и только потом разворачивает книгу к тебе. # action # sfx: snd_page # voice: assets/voice/narr_vex_3.mp3
    Двенадцать — вниз в двадцать ноль-ноль. Обратно — одиннадцать, в шесть утра. Одного я так и не записал: решил, что ошибся в счёте. # emotion: thoughtful # voice: assets/voice/vex_13.mp3
    Теперь вижу, что не ошибся. Журнал врёт редко. # emotion: sad # voice: assets/voice/vex_14.mp3
    ~ set_flag("vex_journal")
    ~ change_disposition("npc_vex", 6)
    ~ fire_rule("rule_vex_journal")
    -> Начало_hub
+ { not (get_flag("vex_job")) } [Есть работа для дознавателя?]
    Есть. В галерее восьмого, на трубном узле, стоит мерная рейка. Запиши, где сейчас вода. Надзор шлёт сводки «уровень стабилен», а я своим глазам верю больше, чем их чернилам. Двенадцать марок за цифру. # voice: assets/voice/vex_15.mp3
    ~ set_flag("vex_job")
    -> Начало_hub
+ { get_flag("vex_job") and has_item("item_gauge_note") and not (get_flag("vex_job_done")) } [Вот замер с рейки.]
    Два и три четверти аршина. А тринадцатого стоял один — вон, мелом отмечено. # emotion: thoughtful # voice: assets/voice/vex_16.mp3
    А в сводке Надзора — «стабилен». Значит, сводку пишут не по рейке, а под диктовку. И диктует тот, кому нужно, чтобы восьмой залило тихо. # emotion: angry # voice: assets/voice/vex_17.mp3
    ~ set_flag("vex_job_done")
    ~ change_disposition("npc_vex", 4)
    ~ fire_rule("rule_vex_job_done")
    -> Начало_hub
+ { get_flag("kell_pressed") and not (get_flag("vex_kell_word")) } [Келл сказал: «спроси у Векса, он записывал».]
    ~ set_flag("vex_kell_word")
    ~ set_flag("vex_asked13")
    Векс хмыкает и, не глядя, кладёт ладонь на корешок журнала. # action # sfx: snd_page # voice: assets/voice/narr_vex_4.mp3
    Келл меня назвал? Тогда скажу, раз старшина разрешил. Двенадцать вниз, с клеймом стражи, в двадцать ноль-ноль. # emotion: calm # voice: assets/voice/vex_18.mp3
    А сколько вернулось, я вслух не считаю. Принеси наряд из архива, и посчитаем вместе. # emotion: thoughtful # voice: assets/voice/vex_19.mp3
    ~ change_disposition("npc_vex", 4)
    -> Начало_hub
+ { not (get_flag("coal_job_offered")) and not (get_flag("coal_job_taken")) } [Мне вниз. Передать что-нибудь?]
    Передай. Носильщики после воды вниз не ходят, а в Сухом ряду топить нечем. # emotion: thoughtful # voice: assets/voice/vex_21.mp3
    У ящика стоит мешок с биркой «Сухой ряд», шесть кило. Отдашь старьёвщику — заплатит пятнадцать марок. И не отсыпай: он взвесит. # emotion: calm # voice: assets/voice/vex_22.mp3
    ~ set_flag("coal_job_offered")
    -> Начало_hub
+ [Покажи, что есть в продаже.]
    Торг без разговоров. Люблю такие. # emotion: calm # voice: assets/voice/vex_7.mp3
    ~ open_trade("npc_vex")
    -> DONE
* { get_flag("kast_hand") and not (get_flag("vex_lifted")) } [Режим тишины сняли.]
    ~ set_flag("vex_lifted")
    Сняли. Вводят шёпотом и снимают шёпотом, а журнал всё помнит. Проходи, дознаватель: сегодня тебя записываю я, а не Келл. # emotion: calm # voice: assets/voice/vex_20.mp3
    ~ change_disposition("npc_vex", 3)
    -> Начало_hub
+ [Мне пора.]
    -> DONE
- -> Начало_hub

=== Начало_hub_ok1 ===
Взвод Келла Ястреба. Двенадцать человек, все с клеймом стражи. Шли вниз, а запись делали наверх — так быстрее, сказал старшина. # voice: assets/voice/vex_4.mp3
~ change_disposition("npc_vex", 8)
-> Начало_hub

=== Начало_hub_no1 ===
Записи я веду, а не пересказываю. Приди с бумагой от инспектора — покажу журнал целиком. # voice: assets/voice/vex_9.mp3
~ change_disposition("npc_vex", -4)
-> Начало_hub
