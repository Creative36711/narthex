EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL has_item(id)
EXTERNAL remove_item(id, n)
EXTERNAL start_quest(q)
EXTERNAL unlock_recipe(r)
EXTERNAL open_craft(r)
EXTERNAL fire_rule(r)
EXTERNAL change_disposition(t, d)

=== main ===
В мастерской Тика склонилась над верстаком: очки на лбу, руки в мазуте. На стене — схема насосных станций с красными пометками. # action
Тика: Дознаватель? Если пришёл спрашивать про аварию — это не авария. Я эту станцию с детства знаю.
-> tika_hub

=== tika_hub ===
* { not (get_flag("tika_knows")) } [Насос №3 можно спасти?]
    ~ set_flag("tika_knows")
    ~ start_quest("quest_warmth")
    ~ unlock_recipe("recipe_valve")
    ~ unlock_recipe("recipe_heatpack")
    Тика: Можно. Сорван паровой клапан — без него станция не держит давление. Новый соберёшь на верстаке: три обрезка железа и герметик. Я открою тебе чертежи. # action
    Тика: И ещё грелку из угля и обрезка — ярус скажет спасибо. Смотри на верстаке.
    -> tika_hub
* { has_item("item_valve") and not (get_flag("pump_repaired")) } [Клапан готов. Запускаем насос?]
    ~ remove_item("item_valve", 1)
    Тика: Держи ключ-трещотку. Я буду у вентиля, ты — у манометра. На счёт «пар» — крути до упора. # action
    ~ fire_rule("rule_repair_pump")
    { get_flag("pump_repaired"): Тика: Слышишь? Тянет! Пар пошёл по стояку — ярус будет с теплом! # emotion: happy }
    { not (get_flag("pump_repaired")): Тика: Прокладка не села. Собери ещё один клапан, материал тот же. Не сдавайся. # emotion: sad }
    -> tika_hub
+ { get_flag("tika_knows") } [Открыть верстак.]
    ~ open_craft("recipe_valve")
    -> DONE
+ [Что за «подачи» в журнале Гильдии?]
    Тика: Стариковская байка. Будто Сердце ест не уголь, а людей. Я в железо верю, дознаватель, не в сказки. # action
    { get_flag("ledger_found"): Тика: …Хотя с твоим лицом после архива я бы поостереглась смеяться. }
    -> tika_hub
+ [Кто такие пепельники?]
    Тика: Золой обожжённые. Говорят, это те, кто слишком долго дышал Дымным ярусом. В туннелях их полно — не ходи без грелки и настоя.
    -> tika_hub
+ [Мне пора.]
    -> DONE
- -> tika_hub
