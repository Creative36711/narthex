EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL has_item(id)
EXTERNAL remove_item(id, n)
EXTERNAL add_item(id, n)
EXTERNAL change_disposition(t, d)
EXTERNAL change_need(nd, d)
EXTERNAL open_trade(npc)
EXTERNAL sleep(t)
EXTERNAL get_player_name()

=== main ===
За стойкой пахнет грибной похлёбкой и тёплой древесиной. Марта вытирает кружку и смотрит внимательно. # action
Марта: {get_player_name()}, верно? Дознаватель, что приехал на мёртвый пар. Садись к печке.
-> mila_hub

=== mila_hub ===
+ [Покажи, чем торгуешь.]
    Марта: Еда, питье, уголь. Дёшево не будет — ярус мёрзнет. # action
    ~ open_trade("npc_mila")
    -> DONE
+ { has_item("item_mark") >= 3 } [Взять койку на ночь (3 марки).]
    ~ remove_item("item_mark", 3)
    ~ sleep(8)
    Марта: Постель вон там, за занавеской. Сны у нас нынче тёплые, дармовые. # action
    -> DONE
+ { not (get_flag("mila_koil")) } [Расскажи про Койля.]
    ~ set_flag("mila_koil")
    Марта крестится угольным пальцем. # action
    Марта: Март? Тихий, как конденсат. Последнюю неделю сам не свой: всё шептал «они пишут, они пишут». Я думала, перегрелся у котла.
    -> mila_hub
+ { not (get_flag("mila_zoya")) } [Кто такая Зойя?]
    ~ set_flag("mila_zoya")
    Марта: Старшая зольщиков. Собирает сажу и чужие беды. Спроси у жаровни — она не кусается. Пока.
    -> mila_hub
+ [Что говорят на ярусе?]
    Марта: Говорят, Гильдия меряет дома под «расселение». А кто расселяется — того больше не видят. Вот и все сказки. # emotion: sad
    -> mila_hub
* { get_flag("pump_repaired") and not (get_flag("mila_grateful")) } [Насос запущен. Ярус будет с теплом.]
    ~ set_flag("mila_grateful")
    ~ change_disposition("npc_mila", 15)
    ~ add_item("item_stew", 1)
    Марта наливает полную кружку и придвигает миску похлёбки. # action
    Марта: Ешь, дознаватель. Сегодня в моём доме тебя кормят бесплатно.
    -> mila_hub
+ [Мне пора.]
    -> DONE
- -> mila_hub
