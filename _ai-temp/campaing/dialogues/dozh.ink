EXTERNAL add_item(a0, a1)
EXTERNAL change_disposition(a0, a1)
EXTERNAL has_item(a0)
EXTERNAL item_count(a0)
EXTERNAL open_trade(a0)
EXTERNAL remove_item(a0, a1)
EXTERNAL set_dialogue_timer(a0, a1)
EXTERNAL unlock_codex(a0)

=== Начало ===
Дож что-то взвешивает на ладони и прячет в рукав, не глядя. # action
Смотри, не покупатель. С покупателями я вежливей. # voice: assets/voice/dozh_4.mp3
-> Начало_hub

=== Начало_hub ===
~ set_dialogue_timer(20, "Молчание")
+ [Торговать.]
    Ну наконец-то. Смотри, не трогай руками: руками только платят. # emotion: calm
    ~ open_trade("npc_dozh")
    -> DONE
+ [Что слышно про помпу?]
Слышно, что она молчит. А про молчание внизу всегда слышно громче. # emotion: thoughtful # voice: assets/voice/dozh_1.mp3
    Говорят, на девятом жилу нашли. Живую. Говорят, из-за неё всё. # voice: assets/voice/dozh_3.mp3
    ~ unlock_codex("codex_karkas")
    -> Начало_hub
* [Ищу Жука.]
    У жаровни сидит, греется, как честный человек. # emotion: calm
    Скажи, что от Дожа. Он скинет — не много, но скинет.
    ~ change_disposition("npc_zhuk", 8)
    -> Начало_hub
+ { item_count("item_mark") >= 34 and not (has_item("item_filter")) } [Купить дыхатель (34 марки).]
Дыхатель — это не товар, это время. Держи, не задохнись. # emotion: calm # voice: assets/voice/dozh_2.mp3
    ~ remove_item("item_mark", 34)
    ~ add_item("item_filter", 1)
    -> Начало_hub
+ [Почему у тебя всё дороже, чем наверху?]
    Потому что сверху вещи возят, а сюда их носят на себе. Спина — тоже цена. # emotion: calm
    -> Начало_hub
+ [Пока.]
    -> DONE
- -> Начало_hub

=== Молчание ===
Дож спокойно ждёт: он умеет торговать и молча. # action
Молчишь? И правильно. Кто говорит, тот уже купил.
-> Начало
