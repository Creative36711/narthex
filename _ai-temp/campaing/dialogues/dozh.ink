EXTERNAL add_item(a0, a1)
EXTERNAL change_disposition(a0, a1)
EXTERNAL get_flag(a0)
EXTERNAL has_item(a0)
EXTERNAL item_count(a0)
EXTERNAL learn_name(a0)
EXTERNAL open_trade(a0)
EXTERNAL present_item(a0, a1, a2)
EXTERNAL remove_item(a0, a1)
EXTERNAL set_dialogue_timer(a0, a1)
EXTERNAL set_flag(a0)
EXTERNAL unlock_codex(a0)

=== Начало ===
Дож что-то взвешивает на ладони и прячет в рукав, не глядя. # action # voice: assets/voice/narr_dozh_1.mp3
Смотри, не покупатель. С покупателями я вежливей. # voice: assets/voice/dozh_4.mp3
~ learn_name("npc_dozh")
-> Начало_hub

=== Начало_hub ===
~ set_dialogue_timer(20, "Молчание")
+ [Торговать.]
    Ну наконец-то. Смотри, не трогай руками: руками только платят. # emotion: calm # voice: assets/voice/dozh_10.mp3
    ~ open_trade("npc_dozh")
    -> DONE
+ [Что слышно про помпу?]
Слышно, что она молчит. А про молчание внизу всегда слышно громче. # emotion: thoughtful # voice: assets/voice/dozh_1.mp3
    Говорят, на девятом жилу нашли. Живую. Говорят, из-за неё всё. # voice: assets/voice/dozh_3.mp3
    ~ unlock_codex("codex_karkas")
    -> Начало_hub
* { not (get_flag("dozh_who")) } [Кто там сидит у жаровни?]
    ~ set_flag("dozh_who")
    Жук у жаровни сидит. Греется, как честный человек. # emotion: calm # voice: assets/voice/dozh_8.mp3
    Скажи, что от Дожа. Он скинет — не много, но скинет. # voice: assets/voice/dozh_9.mp3
    ~ change_disposition("npc_zhuk", 8)
    ~ learn_name("npc_zhuk")
    -> Начало_hub
+ { item_count("item_mark") >= 34 and not (has_item("item_filter")) } [Купить дыхатель (34 марки).]
Дыхатель — это не товар, это время. Держи, не задохнись. # emotion: calm # voice: assets/voice/dozh_2.mp3
    ~ remove_item("item_mark", 34)
    ~ add_item("item_filter", 1)
    -> Начало_hub
* [Показать Дожу вещь.]
    ~ present_item("Оценка", "Оценка_мимо", "")
    -> DONE
* { not (get_flag("dozh_kit")) } [Что берут с собой те, кто ходит ниже восьмого?]
    ~ set_flag("dozh_kit")
    Дож оглядывает тебя, как товар, который не продаётся. # action # voice: assets/voice/narr_dozh_5.mp3
    Гнилец медленный, но крепкий: пока он идёт, бей издалека. Самострел у меня один, болты — по две марки. # emotion: calm # voice: assets/voice/dozh_15.mp3
    Пёс быстрый, а держит плохо: не беги от него, бей в ответ. И с голой грудью вниз не ходи — жилеты у людей Келла хорошие, только снимают их с себя неохотно. # emotion: thoughtful # voice: assets/voice/dozh_16.mp3
    ~ change_disposition("npc_dozh", 2)
    -> Начало_hub
* { not (get_flag("dozh_back")) } [Как тут таскают тяжёлое?]
    ~ set_flag("dozh_back")
    Тяжёлое тут таскают на горбу, а горб у каждого один. Кто нагрузится сверх меры, тот идёт вдвое дольше — и дышит вдвое чаще. # emotion: thoughtful # voice: assets/voice/dozh_17.mp3
    Возьми короб: плетёный, на ремнях, с ним ещё девять кило унесёшь. Восемнадцать марок — дешевле, чем надорваться. # emotion: calm # voice: assets/voice/dozh_18.mp3
    -> Начало_hub
+ [Почему у тебя всё дороже, чем наверху?]
    Потому что сверху вещи возят, а сюда их носят на себе. Спина — тоже цена. # emotion: calm # voice: assets/voice/dozh_5.mp3
    Уголь — три марки штука, и это ещё по-людски. Как вода пришла, уголь у нас дороже воды стал. Ведром не продаю: ведро самому топить. # emotion: calm # voice: assets/voice/dozh_14.mp3
    -> Начало_hub
+ [Пока.]
    -> DONE
- -> Начало_hub

=== Молчание ===
Дож спокойно ждёт: он умеет торговать и молча. # action # voice: assets/voice/narr_dozh_2.mp3
Молчишь? И правильно. Кто говорит, тот уже купил. # voice: assets/voice/dozh_7.mp3
-> Начало

=== Оценка ===
Дож вертит вещь двумя пальцами, прищурившись. # action # sfx: snd_latch # voice: assets/voice/narr_dozh_3.mp3
Вещь стоящая — для того, кто её ищет. Я таких не знаю, но за полцены возьму. # emotion: calm # voice: assets/voice/dozh_6.mp3
~ change_disposition("npc_dozh", 2)
-> Начало_hub

=== Оценка_мимо ===
Дож разводит руками: пусто. # action # voice: assets/voice/narr_dozh_4.mp3
Руки показывай, когда они полные. Пустыми торгуют только нищие. # emotion: calm # voice: assets/voice/dozh_11.mp3
-> Начало_hub
