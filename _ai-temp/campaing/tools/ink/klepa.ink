// Клепа — знахарка карантинного барака.
EXTERNAL get_player_name()
EXTERNAL set_flag(f)
EXTERNAL get_flag(f)
EXTERNAL has_item(i)
EXTERNAL item_count(i)
EXTERNAL add_item(i, n)
EXTERNAL remove_item(i, n)
EXTERNAL get_skill(s)
EXTERNAL change_disposition(t, d)
EXTERNAL set_entity_state(e, s)
EXTERNAL set_description(e, t)
EXTERNAL change_need(n, d)
EXTERNAL change_hp(h)
EXTERNAL open_craft(r)
EXTERNAL open_trade(t)
EXTERNAL sleep(t)
EXTERNAL start_quest(q)
EXTERNAL get_disposition(t)
EXTERNAL unlock_recipe(r)

=== main ===
Клепа сидит у печи и перевязывает руку человеку, который уже не дышит. Она завязывает узел, поправляет одеяло и только потом смотрит на дверь. # action
~ set_entity_state("npc_klepa", "tired")
— Живых — семь. Мёртвых — двенадцать. Лекарств — на четыре дня. Всё, {get_player_name()}. Дальше сам считай.
-> hub

=== hub ===
* [Осмотри латунь из позвонков.]
    ~ set_entity_state("npc_klepa", "thinking")
    — Вытяжка из сплава с сурдином. Тонкая работа. Чтобы это выросло в человеке, нужны часы терпения и генератор.
    — Так умели двое: я и Гверн. Я бросила двенадцать лет назад, когда Божена умерла.
    ~ set_flag("klepa_verified")
    -> hub
* { get_flag("brass_found") } [Кто такой Мастер Гверн?]
    — Он был моим учителем. Потом построил себе дом над дренажем и перестал выходить. Говорят, там у него мастерская.
    — Если он жив, {get_player_name()}, то он и есть тихий мор.
    ~ set_flag("gvern_known")
    ~ change_need("need_nerve", -3)
    -> hub
* [Нужна помощь в карантине.]
    ~ start_quest("quest_quarantine")
    — Тогда воды и еды. И запиши где-нибудь мои цифры: если я умру, чтобы они остались.
    -> hub
+ { get_flag("furnace_fixed") } [Печь налажена. Барак больше не выстывает.]
    — Мёртвым всё равно. Живым — нет. Спасибо.
    ~ change_disposition("npc_klepa", 15)
    ~ change_need("need_warmth", 10)
    -> hub
+ { item_count("item_tonic") >= 3 } [Вот тоники. Три дозы.]
    ~ remove_item("item_tonic", 3)
    ~ set_flag("quarantine_tonics")
    — Три дозы — это трое живых к утру. Ставь на печь, я разведу сама. Спасибо, {get_player_name()}.
    -> hub
+ { get_flag("quarantine_tonics") } [Я принёс тоников.]
    ~ set_flag("klepa_saved")
    — Тогда ладно. Тогда ещё повоюем.
    ~ change_disposition("npc_klepa", 15)
    -> hub
+ { get_flag("lens_built") } [Посмотри на линзу.]
    — Тонкая работа. Ты её не изнашивай — она видит то, что люди пишут на металле. И, {get_player_name()}, ей лучше смотреть в темноте. В свете метки бледнеют.
    -> hub
* { has_item("item_herbs") and not (get_flag("recipe_tonic_learned")) } [Свари меня чему-нибудь, кроме смерти.]
    ~ set_flag("recipe_tonic_learned")
    ~ unlock_recipe("recipe_tonic")
    — Учись. Трава, кипяток, три капли росы. И не наливай полную ложку — сердце не выдержит.
    -> hub
+ { get_disposition("npc_klepa") >= 25 } [Почему ты бросила?]
    — Потому что это работает только на мёртвых. Божена прожила после латуни два месяца. Из них месяц — я носила её на руках.
    ~ change_need("need_nerve", -5)
    -> hub
+ [Что у тебя можно взять?]
    ~ open_trade("npc_klepa")
    — Мох, бинты, вода. Эфирную кровь беру по одной — и только тем, кто не спрашивает, откуда она.
    -> hub
+ [Мне нужен отдых.]
    — Ложись у печи. Я разбужу, если кто-то из живых начнёт уходить.
    ~ sleep(6)
    -> DONE
- -> hub

