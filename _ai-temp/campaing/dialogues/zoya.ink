EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL has_item(id)
EXTERNAL start_quest(q)
EXTERNAL unlock_recipe(r)
EXTERNAL unlock_codex(c)
EXTERNAL change_disposition(t, d)
EXTERNAL change_need(nd, d)
EXTERNAL open_trade(npc)

=== main ===
Старуха у жаровни перебирает сажу в жестянке. Пепел на её шали лежит, как родной. # action
Зойя: Медный человек пришел к золе. Говори, чего ищешь: тепло или правду. Оба дорого стоят.
-> zoya_hub

=== zoya_hub ===
+ [Чем торгуешь, бабушка?]
    Зойя: Печерицы, уголь, тряпьё. И отмычки — на ярусе замки мёрзнут чаще людей. # action
    ~ open_trade("npc_zoya")
    -> DONE
* { not (get_flag("zoya_told")) } [Кто такие Забираемые?]
    ~ set_flag("zoya_told")
    ~ start_quest("quest_taken")
    ~ unlock_codex("codex_taken")
    ~ unlock_recipe("recipe_decoction")
    Зойя: Раз в месяц Гильдия берёт с яруса «лишних». Долги, сироты, чужие. Ведут вниз, за старые лазы. Назад никто не поднимался. # action
    Зойя: Я варю от золы настой: две печерицы на конденсат. Научу — пригодится внизу. А ты узнай, куда их ведут.
    -> zoya_hub
* { get_flag("zoya_told") and has_item("item_ledger") } [Показать журнал подач.]
    Зойя водит пальцем по строкам, и палец дрожит. # action
    Зойя: «Подача живого тепла»… Значит, и моя Дарья — в Сердце. Лаз под Гильдией, за архивом. Иди. И верни её. # emotion: sad
    ~ set_flag("depths_open")
    -> zoya_hub
* { get_flag("depths_open") and not (get_flag("zoya_bless")) } [Попросить благословения перед спуском.]
    ~ set_flag("zoya_bless")
    ~ change_need("need_warmth", 15)
    Зойя сыпет тебе за ворот горсть тёплой золы. # action
    Зойя: Зола к золе не липнет. Иди.
    -> zoya_hub
+ [Почему ярус мёрзнет?]
    Зойя: Сердце просит больше, чем трубы дают. Город топят не углем, медный человек. Запомни это.
    -> zoya_hub
* { get_flag("dara_freed") } [Дарья свободна. Она наверху.]
    ~ change_disposition("npc_zoya", 20)
    Зойя впервые поднимает бельма к твоему лицу. # action
    Зойя: Зола помнит добро, дознаватель. Ярус будет помнить тоже.
    -> zoya_hub
+ [Мне пора.]
    -> DONE
- -> zoya_hub
