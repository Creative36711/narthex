// Отец Ржав — настоятель часовни Погасшего Молота.
EXTERNAL get_player_name()
EXTERNAL set_flag(f)
EXTERNAL get_flag(f)
EXTERNAL has_item(i)
EXTERNAL get_skill(s)
EXTERNAL change_disposition(t, d)
EXTERNAL set_entity_state(e, s)
EXTERNAL change_need(n, d)
EXTERNAL add_item(i, n)
EXTERNAL fire_rule(r)
EXTERNAL start_quest(q)
EXTERNAL unlock_recipe(r)
EXTERNAL unlock_codex(c)
EXTERNAL get_disposition(t)

=== main ===
Отец Ржав разбирает приношения: гайки, шайбы, обломок косы. Он раскладывает их на алтаре с той же тщательностью, с какой Курия раскладывает бумаги. # action
~ set_entity_state("npc_ryab", "neutral")
— Всё, что у людей лишнее, — мне. Так город платит за тишину. А ты, я вижу, пришёл не платить, а спрашивать.
-> hub

=== hub ===
* [Что под часовней?]
    — Ход. Старики звали его «дном». Двенадцать лет назад мы завалили его камнем и молились, чтобы он остался заваленным.
    — Ключи у меня — и у того, кто теперь живёт в глубине.
    ~ unlock_codex("codex_deep")
    -> hub
+ { get_flag("lens_built") } [У меня есть линза. Покажи, как читать метки.]
    — Линза — это стекло и гордость, девочка-подмастерье её собирала. Смотри в темноте: шёпот пишет на металле, как кузнец — на наковальне.
    — Но не читай вслух, {get_player_name()}. То, что читают вслух, начинает отвечать.
    ~ set_flag("lens_taught")
    ~ set_entity_state("npc_ryab", "scared")
    -> hub
* { get_flag("whisper_heard") } [Я слышу счёт в трубах.]
    — Счёт — это не молитва, это инвентарь. Кто-то в глубине ведёт опись города. Когда опись сойдётся, лишние исчезнут.
    ~ change_need("need_nerve", -3)
    -> hub
+ { get_flag("ledger_taken") } [У меня гроссбух всех долгов.]
    ~ set_entity_state("npc_ryab", "angry")
    — Ты держишь в руках не долги, а имена для жертвы. Сожги его или отдай — не носи. Иначе будешь носить самого себя.
    -> hub
+ { get_flag("deep_gate_open") } [Дверь под алтарём открыта.]
    — Тогда иди с молотом, а не с фонарём. И если встретишь в глубине того, кто поёт колыбельные, — не отвечай ему.
    ~ change_disposition("npc_ryab", 5)
    -> hub
+ { not (get_flag("cold_flame_rite")) } [Научи обряду гашения.]
    — Обряд простой, а рук требует твёрдых: ампула эфирной крови, слово прощения вслух и ладонь на чаше.
    — Скажешь слово — и шёпот отходит от стен. Не навсегда, но на ночь хватит.
    ~ set_flag("cold_flame_rite")
    ~ unlock_codex("codex_rite")
    -> hub
+ { not (get_flag("recipe_lens_found")) } [Дай схему линзы. Я пойду в глубину.]
    — Схема не моя — мастера, которого нет. Но бумага пережила мастера, а мастер переживёт меня.
    ~ set_flag("recipe_lens_found")
    ~ unlock_recipe("recipe_ether_lens")
    ~ start_quest("quest_lens")
    — Нужен сплав, стекло и капля эфирной крови. Кровь — у Клепы в карантине, сплав — в цеху.
    -> hub
+ { get_disposition("npc_ryab") >= 20 } [Благослови.]
    — Благословляю трубы твои и жилы твои. Иди и не дай городу сойти с ума по расписанию.
    ~ change_need("need_nerve", 15)
    ~ fire_rule("rule_blessing")
    -> hub
* [Мне нужно спуститься в крипту.]
    — Ключ холодный, дверь тяжёлая, а крипта — не склад. Если пойдёшь, оставь за дверью то, что тебя держит здесь.
    ~ set_flag("crypt_open")
    ~ unlock_codex("codex_chapel")
    -> DONE
- -> hub
