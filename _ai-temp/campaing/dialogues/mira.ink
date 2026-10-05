EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL start_quest(q)
EXTERNAL has_item(id)
EXTERNAL remove_item(id, n)
EXTERNAL add_item(id, n)
EXTERNAL unlock_recipe(recipe)
EXTERNAL change_disposition(target, delta)

=== Начало ===
Мира пересчитывает пустые кровати. Когда доходит до седьмой, начинает сначала. # action
Я не помню своего имени. Зато помню, как мой сосед напевал, когда чинил фильтр. Вы слышали его в проводе?
-> Начало_hub

=== Начало_hub ===
+ { not (get_flag("flag_names_quest_started")) } [Помочь вернуть имена пропавшим.]
    ~ set_flag("flag_names_quest_started")
    ~ start_quest("quest_missing_names")
    Если найдёте стену пластин под городом, сравните пустые места со сводкой. Там кто-то всё ещё отвечает.
    -> Начало_hub
+ { get_flag("flag_names_quest_started") } [Спросить о соседе, которого она помнит.]
    Его звали Сава или Савай — я не знаю, какой вариант настоящий. Он чинил фильтры, напевая один и тот же мотив на трёх нотах. Когда его имя исчезло, я всё ещё помнила мелодию, но уже не могла вспомнить, кому она принадлежала.
    -> Начало_hub
+ { get_flag("flag_names_restored") } [Спросить, кого она узнала первым.]
    Мальчика с соседней койки. Я вспомнила, что он боялся не темноты, а того, что однажды проснётся и не узнает мать. Он первым произнёс своё имя, а потом назвал её.
    -> Начало_hub
+ { get_flag("flag_census_trace") and not (get_flag("flag_filter_quest_started")) } [Помочь лазарету собрать фильтры.]
    ~ set_flag("flag_filter_quest_started")
    ~ start_quest("quest_filter_supply")
    ~ unlock_recipe("recipe_filter_patch")
    Ордо знает старую сборку. Нам нужны войлок и серебряная нить; заплата спасёт ещё одну смену.
    -> Начало_hub
+ { has_item("item_filter_patch") and not (get_flag("flag_filter_delivered")) } [Передать Мире заплату фильтра.]
    ~ remove_item("item_filter_patch", 1)
    ~ set_flag("flag_filter_delivered")
    ~ add_item("item_filter_cartridge", 1)
    ~ change_disposition("npc_mira", 10)
    Мира вставляет заплату в стойку. # action
    Возьмите последний чистый картридж.
    -> Начало_hub
+ { get_flag("flag_names_restored") } [Назвать вслух найденные имена.]
    Мира повторяет их по одному. # action
    На третьем голос у неё перестаёт дрожать. # action
    -> Начало_hub
+ { get_flag("flag_filter_delivered") } [Спросить, как держится лазарет.]
    Пока держится. Теперь люди хотя бы знают, чего именно им не хватает.
    -> Начало_hub
+ { get_flag("flag_filter_delivered") } [Спросить, что она помнит о старом лазарете.]
    Здесь когда-то был приют, потом приёмная, потом склад. Стены помнят больше названий, чем люди. Я не знаю, какое из них моё, но знаю, где поставить чашку, чтобы её не сдуло вентиляцией.
    -> Начало_hub
+ { get_flag("flag_evacuation_completed") } [Сказать, что нижний перрон больше не пустой.]
    Она прикрывает глаза и слушает далёкий ход трамвая. # action
    Если они доедут, пусть хотя бы выберут, как будут называть этот перрон.
    -> Начало_hub
+ [Остаться рядом.]
    Тишина в палате на мгновение перестаёт быть пустой. # action
    -> DONE
- -> Начало_hub
