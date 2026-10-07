EXTERNAL change_disposition(a0, a1)
EXTERNAL open_trade(a0)
EXTERNAL set_flag(a0)
EXTERNAL skill_check(a0, a1)
EXTERNAL unlock_codex(a0)

VAR r = 0

=== Начало ===
Векс поднимает глаза от пульта и долго смотрит на твой жетон. # action # sfx: sfx_click # voice: assets/voice/narr_vex_1.mp3
Ты из конторы? Спускайся, там тепло. Здесь только сквозняк и чужие. # voice: assets/voice/vex_1.mp3
Я своим журналом отвечаю за каждого, кто прошёл. # voice: assets/voice/vex_2.mp3
Журнал врёт редко. Чаще его просто не дописывают до конца смены. # voice: assets/voice/vex_10.mp3
-> Начало_hub

=== Начало_hub ===
+ [Что с седьмой помпой?]
    Стоит. Третий день стоит. # voice: assets/voice/vex_5.mp3
    Он крутит маховик на четверть оборота — тот идёт свободно, как в пустоте. # action # sfx: sfx_gear
Мастер твой Реш спустился в шахту в восемнадцать сорок. Я его сам записал. Обратно — не записал. # voice: assets/voice/vex_3.mp3
    ~ unlock_codex("codex_pumps")
    -> Начало_hub
+ [Кто проходил через шлюз в ночь тринадцатого?]
    ~ r = skill_check("persuade", 45)
    {r: -> Начало_hub_ok1 | -> Начало_hub_no1}
+ [Как спуститься к помпе?]
    Через шлюз, час ходу. Дальше сам машинный зал, в нём — помпа. # voice: assets/voice/vex_8.mp3
    Вниз не ходи: там вода стоит и, говорят, ходит. # voice: assets/voice/vex_6.mp3
    Ты спускался ниже седьмого? Нет? Тогда не спорь со мной про воду. # voice: assets/voice/vex_11.mp3
    На восьмом теперь считают не часы, а уголь: сколько унёс, столько и прожил. # emotion: thoughtful # voice: assets/voice/vex_12.mp3
    -> Начало_hub
+ [Покажи, что есть в продаже.]
    Торг без разговоров. Люблю такие. # emotion: calm # voice: assets/voice/vex_7.mp3
    ~ open_trade("npc_vex")
    -> DONE
+ [Мне пора.]
    -> DONE
- -> Начало_hub

=== Начало_hub_ok1 ===
Взвод Келла Ястреба. Двенадцать человек, все с клеймом стражи. Шли вниз, а запись делали наверх — так быстрее, сказал старшина. # voice: assets/voice/vex_4.mp3
~ change_disposition("npc_vex", 8)
~ set_flag("gate_intro_done")
-> Начало_hub

=== Начало_hub_no1 ===
Записи я веду, а не пересказываю. Приди с бумагой от инспектора — покажу журнал целиком. # voice: assets/voice/vex_9.mp3
~ change_disposition("npc_vex", -4)
-> Начало_hub
