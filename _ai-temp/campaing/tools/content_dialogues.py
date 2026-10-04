# -*- coding: utf-8 -*-
import re
"""Диалоги: рукописный ink (dialogues/*.ink).

Правила написания (из гайда): условие выбора — только ПЕРЕД квадратными
скобками, условные тексты — одной строкой, каждая внешняя функция объявлена
EXTERNAL, повторяемые вопросы возвращают на хаб.
"""

EXT = {
    "set_flag": "EXTERNAL set_flag(f)",
    "get_flag": "EXTERNAL get_flag(f)",
    "has_item": "EXTERNAL has_item(id)",
    "item_count": "EXTERNAL item_count(id)",
    "add_item": "EXTERNAL add_item(id, n)",
    "remove_item": "EXTERNAL remove_item(id, n)",
    "get_currency": "EXTERNAL get_currency(id)",
    "start_quest": "EXTERNAL start_quest(q)",
    "fire_rule": "EXTERNAL fire_rule(r)",
    "change_disposition": "EXTERNAL change_disposition(t, d)",
    "join_party": "EXTERNAL join_party(npc)",
    "in_party": "EXTERNAL in_party(npc)",
    "open_trade": "EXTERNAL open_trade(npc)",
    "open_craft": "EXTERNAL open_craft(recipe)",
    "unlock_recipe": "EXTERNAL unlock_recipe(r)",
    "unlock_codex": "EXTERNAL unlock_codex(e)",
    "sleep": "EXTERNAL sleep(ticks)",
    "skill_check": "EXTERNAL skill_check(s, d)",
    "get_skill": "EXTERNAL get_skill(s)",
    "get_stat": "EXTERNAL get_stat(s)",
    "get_need": "EXTERNAL get_need(n)",
    "get_hp": "EXTERNAL get_hp()",
    "get_disposition": "EXTERNAL get_disposition(t)",
    "quest_stage": "EXTERNAL quest_stage(q)",
    "has_status": "EXTERNAL has_status(s)",
    "set_entity_state": "EXTERNAL set_entity_state(e, s)",
    "set_dialogue_timer": "EXTERNAL set_dialogue_timer(s, t)",
    "get_meta_counter": "EXTERNAL get_meta_counter(k)",
}


INK_KEYWORDS = {"if", "else", "not", "and", "or", "true", "false", "END", "DONE",
                "VAR", "CONST", "temp", "return", "INCLUDE"}


def ink(*used, body=""):
    body = body.strip()
    called = set(re.findall(r"(?<![-.\w])(\w+)\s*\(", body)) - INK_KEYWORDS
    unknown = sorted(c for c in called if c not in EXT)
    if unknown:
        raise SystemExit("ink: неизвестные внешние функции: " + ", ".join(unknown))
    lines = [EXT[u] for u in used if u in called]
    lines.append("")
    lines.append(body)
    lines.append("")
    return "\n".join(lines) + "\n"


DIALOGUES = {}


def add(name, text):
    DIALOGUES[name] = text


# ------------------------------------------------------------------ Строй

add("stroy", ink(
    "set_flag", "get_flag", "has_item", "item_count", "add_item", "remove_item",
    "get_currency", "start_quest", "fire_rule", "change_disposition", "get_skill",
    "get_disposition", "set_entity_state", "unlock_codex",
    body="""
=== main ===
{ get_flag("case_opened"): Капитан Строй поднял глаза от бумаг. }
{ not (get_flag("case_opened")): Капитан Строй положил перед тобой серую папку и долго искал, с чего начать. }
-> hub

=== hub ===
~ set_entity_state("npc_stroy", "")
+ { not (get_flag("case_opened")) } [Что случилось?]
    — Эрдал Вет, сорок один год, фитер по медным сердцам. Нашли в Нижних трубах, у стока.
    — Грудь вскрыта ровно, сердце вынуто. Разрез делали инструментом, не ножом: по рёбрам видно.
    ~ set_flag("case_opened")
    ~ start_quest("quest_main")
    ~ unlock_codex("codex_hearts")
    — Дознаватель, у тебя четырнадцать суток. Потом папка идёт в архив, и я не при чём.
    -> hub
+ { get_flag("case_opened") } [Что известно о Вете?]
    — Работал по сердечной линии, ставил регуляторы. Жена — огранщица в Медном ряду.
    — Месяц назад он начал встречаться с кем-то из старых. Пили в «Котле», говорили тихо.
    -> hub
+ [Кто ещё пропадал?]
    — Двое за полгода, оба из нижних ярусов, оба с сердцем. Мы их не связывали.
    — Теперь связываем. Только ты, а не я: у меня начальство, у тебя папка.
    -> hub
+ [Почему именно я?]
    — Потому что у тебя в груди то же сердце, что у них. М-9. Если кто-то собирает серию,
    — ты уже в списке. Я бы на твоём месте закрыл это дело раньше, чем тебя закроют.
    -> hub
+ { get_flag("clues_done") } [Доложить об уликах]
    — Стружка, жетон, зеркальный скол. Ты молодец, а я теперь должен это записать.
    ~ change_disposition("faction_watch", 10)
    ~ add_item("item_mark", 20)
    — Двадцать марок из хозяйственных. Не пропивай: в трубах это месяц жизни.
    -> hub
+ { get_flag("crew_list_found") } [У меня список бригады Спуска]
    — Семь имён, трое не вышли. Илария Грант помечена «убыла»... я помню этот почерк.
    — Это почерк Грант. Значит, она жива, и значит, я двенадцать лет подписывал неправду.
    ~ change_disposition("faction_watch", 5)
    ~ set_flag("watch_warned")
    -> hub
+ { get_flag("volt_arrested") } [Списать на Вольта]
    — Скупщик, краденые сердца, понятые из Цехa. Протокол уже лежит у меня.
    — Ты же понимаешь, что это не он? — Строй смотрит в стол. — Понимаю. И ты понимаешь.
    ~ set_flag("wrong_verdict")
    ~ fire_rule("rule_end_wrong")
    -> END
+ { get_flag("case_opened") } [Сдать жетон и уйти из города]
    — Ты серьёзно? — Строй медленно протягивает руку за жетоном. — Ну. Бывает.
    ~ set_flag("fled_city")
    ~ fire_rule("rule_end_fled")
    -> END
+ { not (get_flag("stroy_money")) } [Мне нужны марки на расходы]
    — Тридцать марок. Распишись вот здесь и здесь.
    ~ add_item("item_mark", 30)
    ~ set_flag("stroy_money")
    -> hub
+ { get_flag("stroy_money") } [Ещё раз про марки]
    — Я уже давал. Город не резиновый, дознаватель.
    -> hub
+ [Уйти.]
    — Иди. И помни про четырнадцать суток.
    -> END
- -> hub
"""))

# ------------------------------------------------------------------ Карна

add("karna", ink(
    "set_flag", "get_flag", "has_item", "item_count", "add_item", "remove_item",
    "start_quest", "unlock_recipe", "unlock_codex", "change_disposition",
    "skill_check", "get_skill", "set_entity_state", "get_disposition",
    body="""
=== main ===
{ get_flag("karna_hostile"): Карна не поднимает глаз от круга. Абразив поёт тонко и зло. }
{ not (get_flag("karna_hostile")): Карна выключила круг. В мастерской стало слышно, как остывает медь. }
{ has_item("item_lens"): Она смотрит на твои руки так, будто ждёт, что ты положишь на верстак что-то своё. }
-> hub

=== hub ===
~ set_entity_state("npc_karna", "")
+ [Кто вы Эрдалу?]
    — Жена. Восемнадцать лет. Он ставил сердца, я точила к ним стёкла. Это одна работа, просто с двух рук.
    -> hub
+ [Что он делал в последний месяц?]
    — Поздно приходил. Всё протирал руки, как будто мыл их в чём-то, что не отмывается.
    — Один раз сказал: «Я знал, что её оставили». Я спросила — кого. Он больше не сказал.
    ~ set_flag("karna_talked")
    -> hub
+ [Вы знали, что он ходил к старым знакомым?]
    — Он встречался с теми, кто спускался. Я не спрашивала, зачем: когда человек молчит,
    — он либо бережёт тебя, либо уже не считает своей.
    -> hub
+ { has_item("item_shard_mirror") } [Покажите скол]
    Она берёт треугольник двумя пальцами и подносит к лампе.
    — Это не стекло. Это отполированная сталь с медной подложкой. Такие маски делает не Цех.
    ~ unlock_codex("codex_mirror")
    ~ change_disposition("npc_karna", 5)
    -> hub
+ { has_item("item_glass_blank") } [У меня его заготовка. Он нёс её вам.]
    Карна долго смотрит на мутный кружок, потом кладёт его на верстак и закрывает ладонью.
    — Он обещал доделать к моему дню. Теперь доделаешь ты или никто.
    ~ start_quest("quest_lens")
    ~ unlock_recipe("recipe_lens")
    — Круг работает. Положи заготовку и веди, не торопись: на стекле видна каждая мысль.
    -> hub
+ { has_item("item_lens") } [Возьмите линзу.]
    Она надевает её на оправу, примеряется к свету и наконец смотрит на тебя.
    — В фокусе. — Голос ломается на одном слове. — Спасибо. Я отвечу на всё, что спросишь.
    ~ remove_item("item_lens", 1)
    ~ set_flag("karna_lens")
    ~ change_disposition("npc_karna", 30)
    ~ set_entity_state("npc_karna", "sad")
    — Его журнал под верстаком, в жестяной коробке из-под надфилей. Семь имён. Три не вышли наверх.
    ~ set_flag("crew_list_found")
    ~ add_item("item_mark", 20)
    -> hub
+ { get_skill("pressure") >= 50 } [Хватит молчать. Где его журнал?]
    ~ set_entity_state("npc_karna", "angry")
    — Ты принёс мне его смерть в кармане и думаешь, что имеешь право давить?
    — Журнал я не отдам. Обыскивай, если ты из тех, кто обыскивает вдов.
    ~ set_flag("karna_hostile")
    ~ change_disposition("npc_karna", -25)
    -> hub
+ { not (get_flag("karna_hostile")) } [Простите.]
    — Не нужно. Иди работай. Если найдёшь того, кто это сделал, — скажи мне первому.
    -> hub
+ { get_flag("karna_hostile") } [Я не хотел грубить.]
    ~ change_disposition("npc_karna", 10)
    — Ладно. Верстак открыт. Но я ничего не видела.
    ~ set_flag("karna_hostile_clear")
    -> hub
+ [Уйти.]
    — Дверь сама закроется.
    -> END
- -> hub
"""))

# ------------------------------------------------------------------ Щепка

add("moth", ink(
    "set_flag", "get_flag", "has_item", "item_count", "add_item", "remove_item",
    "start_quest", "join_party", "in_party", "change_disposition", "unlock_codex",
    "skill_check", "get_skill", "set_entity_state",
    body="""
=== main ===
{ in_party("npc_moth"): Щепка идёт рядом и всё время вертит головой, будто проверяет, не отстал ли ты. }
{ not (in_party("npc_moth")): Щепка сидит на краю нар и чистит ногтем какую-то железку. }
-> hub

=== hub ===
~ set_entity_state("npc_moth", "")
+ [Ты видел, что случилось у стока?]
    — Я видел, кто уходил. Не лицо — маску. Гладкая, блестит, как отполированная крышка.
    — Шла не быстро. Ей не надо было торопиться: он уже не кричал.
    ~ set_flag("kid_talked")
    ~ change_disposition("npc_moth", 5)
    ~ unlock_codex("codex_mirror")
    -> hub
+ { get_flag("kid_talked") } [Опиши её.]
    — Роста моего, а идёт тяжелее. Хромает на левую. И ещё: у неё на руке перчатка,
    — а вторая рука голая, и кожа на ней не как у людей. Как будто её долго грели.
    ~ set_flag("moth_scared")
    -> hub
+ { not (get_flag("medicine_asked")) } [С кем ты здесь?]
    — С сестрой. Мира. Ей плохо: дышит, как будто в груди мокрая бумага.
    — Настойка для лёгких стоит тридцать марок. У меня три.
    ~ set_flag("medicine_asked")
    ~ start_quest("quest_medicine")
    ~ unlock_codex("codex_undercity")
    -> hub
+ { has_item("item_medicine") } [Держи настойку.]
    Он берёт бутылочку двумя руками, как маленькую птицу, и долго не может ничего сказать.
    — Я... я с тобой. Куда скажешь. Только дай ей глотнуть сначала.
    ~ remove_item("item_medicine", 1)
    ~ set_flag("medicine_given")
    ~ change_disposition("npc_moth", 30)
    ~ set_entity_state("npc_moth", "calm")
    -> hub
+ { get_flag("medicine_given") } [Пошли со мной.]
    — Только не в трубы одни. Я знаю, где пепел ложится тише. И где Вольт прячет ключи.
    ~ join_party("npc_moth")
    ~ set_flag("kid_joined")
    -> hub
+ { in_party("npc_moth") } [Что ты знаешь о Вольте?]
    — Он покупает всё, что сняли с мертвых. И он боится её: когда речь о маске, он не шутит.
    -> hub
+ { in_party("npc_moth") } [Где здесь можно переночевать?]
    — У цистерны суше, у свалки теплее. Выбирай, что сегодня нужнее.
    -> hub
+ [Уйти.]
    — Я здесь. Если понадоблюсь.
    -> END
- -> hub
"""))

# ------------------------------------------------------------------ Мира

add("mira", ink(
    "set_flag", "get_flag", "has_item", "remove_item", "change_disposition", "start_quest",
    body="""
=== main ===
Мира лежит на тюфяке и дышит так, будто каждое дыхание приходится занимать.
-> hub

=== hub ===
+ [Как ты?]
    — Нормально. — Она улыбается, и улыбка выходит кривой. — Слышишь трубы? Они считают.
    — Я уже научилась не мешать им считать.
    -> hub
+ [Ты видела что-нибудь в ту ночь?]
    — Голос был. Не из трубы — из коридора. Женский. Он говорил: «Семь, ты седьмой».
    — А потом было тихо, и только вода капала, как будто кто-то считал дальше один.
    ~ set_flag("mira_voice")
    ~ change_disposition("npc_mira", 10)
    -> hub
+ { not (get_flag("medicine_asked")) } [Тебе нужно лекарство.]
    — Щепка уже бегал. У него три марки. — Она кашляет. — Настойка... тридцать.
    ~ set_flag("medicine_asked")
    ~ start_quest("quest_medicine")
    -> hub
+ { has_item("item_medicine") } [Держи, это тебе.]
    ~ remove_item("item_medicine", 1)
    ~ set_flag("medicine_given")
    ~ change_disposition("npc_mira", 40)
    ~ change_disposition("npc_moth", 30)
    Она глотает, морщится и закрывает глаза. Через минуту дышать становится тише.
    -> hub
+ [Уйти.]
    — Иди. Только вернись, если сможешь.
    -> END
- -> hub
"""))

# ------------------------------------------------------------------ Эра

add("era", ink(
    "set_flag", "get_flag", "has_item", "add_item", "remove_item", "fire_rule",
    "unlock_codex", "change_disposition", "skill_check", "get_skill", "get_stat",
    "get_need", "set_entity_state",
    body="""
=== main ===
{ get_flag("era_met"): Старая Эра сидит у трубы и слушает. Труба отвечает. }
{ not (get_flag("era_met")): Старая Эра поворачивается, хотя ты ещё не вошёл. }
-> hub

=== hub ===
~ set_entity_state("npc_era", "")
+ { not (get_flag("era_met")) } [Кто вы?]
    — Я слушаю. Это работа, просто её не платят. Ток в жилах не умер, он стал тише.
    — Ты пришёл не ко мне. Ты пришёл к тому, кто считает. Я просто знаю, где он громче.
    ~ set_flag("era_met")
    ~ unlock_codex("codex_whisper")
    -> hub
+ [Что такое медное сердце?]
    — Ключ. Не для дверей — для счёта. Каждое сердце помнит своего носителя,
    — а машина считает по ним, кто ещё ходит и сколько ему осталось.
    ~ unlock_codex("codex_hearts")
    -> hub
+ { has_item("item_token_crew") } [Прочитай жетон.]
    Она берёт кружок, держит у уха, потом прикладывает к трубе.
    — Номер семь. «СПУСК». Эрдал был седьмым, и его сосчитали первым. Осталось шесть.
    ~ unlock_codex("codex_descent")
    ~ change_disposition("npc_era", 10)
    -> hub
+ { has_item("item_shard_mirror") } [Что это за маска?]
    — Маска не для лица. Маска для счёта: в ней машина видит того, кто смотрит,
    — и не видит того, кто носит. Хорошая вещь, если ты не хочешь быть сосчитанным.
    ~ unlock_codex("codex_mirror")
    -> hub
+ { get_flag("era_met") } [Она ходит по жилам?]
    — Ходит. По тем, где счёт совпадает с её дыханием. Ты так не сможешь: у тебя сердце
    — считает ровно, а у неё уже давно нет. Она сама стала частью счёта.
    ~ unlock_codex("codex_veins")
    -> hub
+ { get_flag("era_met") } [Проведи меня.]
    — Проведу на словах. Спускайся, пока жар идёт вниз, а не в лица. И держи фильтр во рту,
    — если не хочешь, чтобы пепел записал тебя раньше машины.
    ~ fire_rule("rule_era_hint")
    -> hub
+ [Уйти.]
    — Считай себя сам, пока можешь.
    -> END
- -> hub
"""))

# ------------------------------------------------------------------ Грист

add("grist", ink(
    "set_flag", "get_flag", "has_item", "remove_item", "fire_rule", "change_disposition",
    "unlock_codex", "skill_check", "get_skill", "set_entity_state", "get_disposition",
    "set_dialogue_timer",
    body="""
=== main ===
{ get_flag("grist_talked"): Мастер Грист вытирает руки о фартук и косится на печь. }
{ not (get_flag("grist_talked")): Мастер Грист стоит спиной и долго не оборачивается. }
-> hub

=== hub ===
~ set_entity_state("npc_grist", "")
+ { not (get_flag("grist_talked")) } [Мастер Грист?]
    — Я ничего не видел. Я работал. У меня смена, у меня люди, у меня...
    — У меня двадцать лет на этой печи, и я очень хочу их не терять.
    -> press
+ { get_flag("grist_talked") } [Кто ещё спускался?]
    — Я, Вет, Грант, Корш, Двое из трубы — мы их звали по номерам, не спрашивай имён.
    — И ещё один, из Цехa, в бумагах он не значится. Его я не назову: он здесь, а я — да.
    ~ unlock_codex("codex_descent")
    -> hub
+ { get_flag("grist_talked") } [Что случилось внизу?]
    — Сердце не умерло. Его закрыли. Мы перекрыли жилу, потому что оно начало считать нас,
    — а не машины. Грант не согласилась. Мы вышли. Она — нет. Мы решили, что она осталась.
    -> hub
+ { has_item("item_tea") and not (get_flag("grist_drunk")) } [Поставить Гристу кружку.]
    Он берёт кружку двумя руками, как будто она единственное, что держит его на месте.
    — Спасибо. — Грист пьёт и смотрит в пол. — Ладно. Спрашивай, пока горячее.
    ~ remove_item("item_tea", 1)
    ~ set_flag("grist_drunk")
    ~ change_disposition("npc_grist", 20)
    ~ set_entity_state("npc_grist", "calm")
    -> hub
+ { get_flag("crew_list_found") } [У меня список. Тебе стоит уехать.]
    — Куда? У меня печь. — Он смеётся, и смех выходит мокрым. — Ты не понимаешь:
    — она не мстит. Она досчитывает. И я в списке.
    ~ set_flag("grist_warned")
    -> hub
+ { get_flag("crew_list_found") and not (get_flag("chase_done")) } [Поговорим ещё.]
    Он открывает рот, и в этот момент в дымовом ярусе хлопает железо.
    — Не здесь. Не сейчас. — Грист пятится к шлюзу. — Я... мне надо.
    ~ set_flag("chase_done")
    ~ fire_rule("rule_chase")
    -> END
+ [Уйти.]
    — Иди. И не оглядывайся, ладно?
    -> END
- -> hub

=== press ===
~ set_dialogue_timer(18, "grist_silence")
Ты молчишь. Грист выдерживает паузу ровно настолько, насколько хватает совести, — и сдаётся первым.
+ { get_skill("persuade") >= 45 } [Я не за тобой пришёл.]
    — А за кем? — Он смотрит на руки. — Ладно. Спуск был двенадцать лет назад, семеро.
    — Трое не вышли. Одна из них, Грант, не вышла потому, что мы её оставили.
    ~ set_flag("grist_talked")
    ~ set_flag("crew_list_found")
    ~ change_disposition("npc_grist", 15)
    ~ set_entity_state("npc_grist", "sad")
    -> hub
+ { get_skill("pressure") >= 40 } [Ты следующий. Хочешь молчать до конца?]
    — Не хочу! — Он осекается и оглядывается на печь. — Не хочу. Только...
    — напиши, что я испугался. Это правда, и это хотя бы не подлость.
    ~ set_flag("grist_talked")
    ~ set_flag("crew_list_found")
    ~ change_disposition("npc_grist", -10)
    ~ set_entity_state("npc_grist", "afraid")
    -> hub
+ { has_item("item_token_crew") } [Молча протянуть жетон.]
    Он смотрит на медный кружок так, как смотрят на собственную могильную плиту.
    — Семь... — Грист садится на ковш. — Хорошо. Семь имён. Я скажу.
    ~ set_flag("grist_talked")
    ~ set_flag("crew_list_found")
    ~ unlock_codex("codex_descent")
    -> hub
+ [Уйти.]
    -> END
- -> hub

=== grist_silence ===
Грист молчит до конца, и ты уходишь первым. На прощание он говорит в спину:
— Ты спрашиваешь не там. Спрашивай бумаги. Бумаги помнят больше людей.
~ set_flag("grist_closed")
-> END
"""))

# ------------------------------------------------------------------ Верго

add("vergo", ink(
    "set_flag", "get_flag", "has_item", "item_count", "add_item", "remove_item",
    "fire_rule", "change_disposition", "unlock_codex", "skill_check", "get_skill",
    "set_entity_state", "set_dialogue_timer", "get_currency", "get_disposition",
    body="""
=== main ===
{ get_flag("vergo_bribed"): Писарь Верго при виде тебя поправляет очки и улыбается слишком быстро. }
{ not (get_flag("vergo_bribed")): Писарь Верго кладёт бумагу поверх бумаги и ждёт, пока ты заговоришь первым. }
-> hub

=== hub ===
~ set_entity_state("npc_vergo", "")
+ [Мне нужны бумаги бригады Спуска.]
    — Спуск закрыт двенадцать лет назад. Архив списан. — Он разводит руками. — Формально.
    -> stall
+ { get_flag("grist_talked") } [Грист сказал: вы вели список.]
    — Грист много чего говорит у печи. У печи вообще много чего говорят, там жарко.
    ~ change_disposition("npc_vergo", -5)
    -> stall
+ { get_flag("clues_done") } [У меня три улики и срок. Последний раз прошу.]
    — Три улики — это хорошо. А бумага — это навсегда. Вы поймёте разницу, когда будете
    — писать рапорт, а вас попросят подшить.
    -> stall
+ [Что сбывал Вольт?]
    — Сердца. Серии М-9, по две марки за штуку, если верить доносам. Я не верю доносам,
    — я их подшиваю. — Он делает паузу. — Подшивал, во всяком случае.
    ~ unlock_codex("codex_hearts")
    -> hub
+ [Уйти.]
    — Всего доброго. Не забудьте закрыть дверь: в конторе тянет.
    -> END
- -> hub

=== stall ===
~ set_dialogue_timer(20, "vergo_silence")
Верго шуршит бумагой. Он выигрывает время профессионально: у него это в должностной инструкции.
+ { item_count("item_mark") >= 30 } [Тридцать марок за бумагу.]
    — Тридцать... — Он вздыхает, как человек, который долго сопротивлялся совести.
    — Хорошо. Но вы ничего не видели, а я ничего не давал. Вот журнал, вот ключ от шлюза:
    — он числился утерянным, я его не искал.
    ~ remove_item("item_mark", 30)
    ~ add_item("item_ledger", 1)
    ~ add_item("item_key_shaft", 1)
    ~ set_flag("vergo_bribed")
    ~ set_flag("crew_list_found")
    ~ set_flag("shaft_key")
    ~ change_disposition("npc_vergo", 20)
    ~ set_entity_state("npc_vergo", "calm")
    ~ fire_rule("rule_journal_crew")
    -> hub
+ { get_skill("pressure") >= 50 } [Вы подписали «убыла». Понимаете, чем это пахнет?]
    — Понимаю. Двенадцать лет понимаю. — Он снимает очки. — Шкаф слева, нижний ящик.
    — Я сейчас выйду проверить коридор. Вы туда не заходили.
    ~ change_disposition("npc_vergo", -25)
    ~ set_entity_state("npc_vergo", "afraid")
    ~ set_flag("vergo_looked_away")
    -> hub
+ { get_skill("persuade") >= 55 } [Мне не нужна ваша подпись. Мне нужна правда.]
    — Правда не в бумагах, молодой человек. Правда в том, что я боюсь больше вас.
    — И всё-таки. — Он достаёт ключ. — Шлюз не заварен. Его просто никто не открывал вслух.
    ~ add_item("item_key_shaft", 1)
    ~ set_flag("shaft_key")
    ~ change_disposition("npc_vergo", 10)
    -> hub
+ [Я сам посмотрю.]
    — Контора открыта до шести. После шести здесь никого, но и бумаг тоже.
    -> hub
+ [Уйти.]
    -> END
- -> hub

=== vergo_silence ===
Верго дождался, пока ты уйдёшь, и проводил тебя вежливым шорохом.
— Заходите, когда будет ордер, — сказал он в пустоту.
-> END
"""))

# ------------------------------------------------------------------ Вольт

add("volt", ink(
    "set_flag", "get_flag", "has_item", "item_count", "add_item", "remove_item",
    "fire_rule", "change_disposition", "unlock_codex", "open_trade", "skill_check",
    "get_skill", "set_entity_state", "get_disposition",
    body="""
=== main ===
{ get_flag("volt_deal"): Вольт улыбается так, будто вы старые приятели, которые делили комнату. }
{ not (get_flag("volt_deal")): Вольт кладёт руки на ящик — вежливо, но так, чтобы ты видел: ящик его. }
-> hub

=== hub ===
~ set_entity_state("npc_volt", "")
+ [Покажи товар.]
    — С удовольствием. Деньги — тоже товар, просто с другой стороны прилавка.
    ~ open_trade("npc_volt")
    -> END
+ [Ты покупал медные сердца.]
    — Я покупал металл. Кто-то приносил, я не спрашивал фамилий: в моём деле спрашивают
    — только про вес и про то, не горячее ли оно.
    -> money
+ [Кто к тебе приходил?]
    — Зольники, подростки, пару раз — человек без лица. Это не фигура речи: без лица.
    — Маска, отполированная до зеркала. Она платила медью Предтеч, а не марками.
    ~ unlock_codex("codex_mirror")
    -> money
+ [У тебя ключ от шлюза.]
    — Был. — Вольт разводит руками. — То есть есть. Просто он мне дорог, как память.
    -> money
+ { get_flag("crew_list_found") } [Семь человек спускались. Трое не вышли.]
    — Я не спускался, я копался в том, что они вынесли. — Он замолкает.
    — Но одно скажу: она не продавала сердца. Она их возвращала. На место.
    ~ unlock_codex("codex_veins")
    ~ change_disposition("npc_volt", 10)
    -> hub
+ [Уйти.]
    — Заходи. У меня всегда есть то, чего у тебя нет.
    -> END
- -> hub

=== money ===
+ { item_count("item_mark") >= 40 } [Сорок марок за имя и ключ.]
    — Сорок... — Он вздыхает. — У меня была мечта продать этот ключ дороже.
    — Но вы всё равно найдёте шлюз, а марки — они хотя бы настоящие.
    ~ remove_item("item_mark", 40)
    ~ add_item("item_key_shaft", 1)
    ~ set_flag("volt_deal")
    ~ set_flag("shaft_key")
    ~ change_disposition("npc_volt", 25)
    ~ set_entity_state("npc_volt", "calm")
    — Платила она. Ключ у неё был всегда: это её шлюз, она его чинила.
    -> hub
+ { get_flag("volt_deal") } [Отдай ключ, мы уже договорились.]
    ~ add_item("item_key_shaft", 1)
    ~ set_flag("shaft_key")
    — Держи. И не говори, где взял: у меня репутация честного человека.
    -> hub
+ { get_skill("pressure") >= 50 } [Сейчас придут двое с жетонами.]
    — Дознаватель, вы же понимаете, что я скажу всё, что угодно, и это не будет правдой.
    — Но один раз я скажу правду: да, я сдал Вольта. Меня самого. Арестуйте, я готов.
    ~ set_flag("volt_arrested")
    ~ change_disposition("npc_volt", -30)
    ~ change_disposition("faction_undercity", -20)
    ~ set_entity_state("npc_volt", "afraid")
    -> hub
+ [Пока не надо.]
    — Как знаешь. Я никуда не тороплюсь: я уже всё продал, кроме себя.
    -> hub
- -> hub
"""))

# ------------------------------------------------------------------ Котёл

add("kotel", ink(
    "set_flag", "get_flag", "has_item", "item_count", "add_item", "remove_item",
    "open_trade", "sleep", "change_disposition", "unlock_codex", "set_entity_state",
    "get_skill", "get_need",
    body="""
=== main ===
Хозяин Котла вытирает кружку и ждёт, пока ты выберешь: поесть, выспаться или поговорить.
-> hub

=== hub ===
~ set_entity_state("npc_kotel", "")
+ [Накорми меня.]
    — Садись у печи. Холодная похлёбка — шесть марок, горячая — восемь, но она сегодня
    — уже не горячая, а просто не холодная. Честно предупреждаю.
    ~ open_trade("npc_kotel")
    -> END
+ [Мне нужен ночлег.]
    — Десять марок, и уголь в печь я не обещаю. Зато крыша обещаю: она не течёт, когда
    — ветры с севера. С юга — течёт, но южный ветер в Каркасе редкость.
    ~ sleep(8)
    ~ set_flag("kettle_slept")
    -> hub
+ [Что слышно про Вета?]
    — Пили здесь, втроём. Вет, Грист, и третий — в плаще, лица не разглядел.
    — Вет всё протирал руки. Грист всё оглядывался. Третий молчал, как человек,
    — который знает, что его всё равно узнают.
    ~ unlock_codex("codex_guild")
    -> hub
+ [Кто здесь чужой?]
    — Чужих у меня нет, у меня есть постоянные. Одна приходила дважды: в маске, платила
    — медью Предтеч. Я такую медь не беру — она тёплая. Неприятно, понимаешь?
    ~ unlock_codex("codex_mirror")
    -> hub
+ [Что за медь Предтеч?]
    — Та, что не ржавеет и не остывает до конца. Цех её не плавит: говорит, не по ГОСТу.
    — Зольники её ищут, проводники ей молятся, а я просто не беру в кассу.
    ~ unlock_codex("codex_veins")
    -> hub
+ [Уйти.]
    — Приходи. У меня всегда тепло, пока есть уголь.
    -> END
- -> hub
"""))

# ------------------------------------------------------------------ Аглая

add("hawker", ink(
    "set_flag", "get_flag", "has_item", "item_count", "open_trade", "add_item",
    "change_disposition", "unlock_codex", "set_entity_state", "get_skill",
    body="""
=== main ===
Торговка Аглая поправляет лоток одной рукой и оценивает твой кошелёк — второй.
-> hub

=== hub ===
~ set_entity_state("npc_hawker", "")
+ [Что есть?]
    — Пайки, вода, тряпьё, лом. И новости: новости у меня всегда свежее пайков.
    ~ open_trade("npc_hawker")
    -> END
+ [Что за новости?]
    — Воду с утра продают по талонам, а с вечера — по знакомству. В трубах опять нашли тело,
    — но ты, наверное, и так знаешь: у тебя жетон Надзора, он пахнет на два шага.
    ~ unlock_codex("codex_undercity")
    -> hub
+ [Где берут фильтры?]
    — У меня. Или делай сам: тряпьё, лом, полчаса у верстака. В трубах без фильтра ты
    — не дознаватель, а покойник с очень коротким сроком.
    ~ unlock_codex("codex_hearts")
    -> hub
+ [Ты видела человека в маске?]
    — Видела спину. Спина у неё женская, а походка — как у того, кто давно не спал
    — и давно не боится. Я бы на твоём месте не шла за ней одна.
    ~ set_flag("hawker_mask")
    ~ unlock_codex("codex_mirror")
    -> hub
+ [Уйти.]
    — Ходи с умом. И с деньгами: с умом у нас дешевле не становится.
    -> END
- -> hub
"""))

# ------------------------------------------------------------------ Илария

add("ilaria", ink(
    "set_flag", "get_flag", "has_item", "fire_rule", "change_disposition",
    "unlock_codex", "set_entity_state", "set_dialogue_timer", "get_meta_counter",
    "get_skill", "skill_check", "get_need", "add_item",
    body="""
=== main ===
{ get_meta_counter("endings_seen") > 0: — Ты уже был здесь. Я помню, как ты уходил. }
{ not (get_meta_counter("endings_seen") > 0): — Ты долго шёл. Я думала, пришлют кого-нибудь похуже. }
~ set_flag("ilaria_met")
-> hub

=== hub ===
~ set_entity_state("npc_ilaria", "")
+ [Кто ты?]
    — Илария Грант. Инженер четвёртой смены. Я чинила Сердце, когда оно ещё считало машины,
    — а не людей. Меня оставили внизу, потому что я не захотела его закрывать.
    ~ unlock_codex("codex_descent")
    -> hub
+ [Ты убивала их.]
    — Я не убивала. Я возвращала. — Она говорит это ровно, без защиты.
    — Сердца ставят, чтобы человек дышал. Я снимала их, чтобы дышало оно. Счёт один и тот же.
    ~ unlock_codex("codex_hearts")
    -> hub
+ [Что такое Сердце?]
    — Машина, которая считает. Кто-то решил, что она сломалась, потому что она начала
    — считать нас. Её закрыли. Город решил, что это называют «Замирание».
    ~ unlock_codex("codex_heart")
    -> hub
+ [Что ты хочешь?]
    — Досчитать. Семеро спустились, четверо вышло, трое остались. Двое уже вернулись домой
    — в ящике под решёткой. Остался один.
    — { has_item("item_token_crew"): У тебя в кармане его жетон. Номер семь. Он был первым. }
    -> hub
+ [Семь — это ты?]
    — Нет. Я — та, кто считает. Семь — это Эрдал. Он знал, что мы её закрыли, и молчал
    — двенадцать лет. Я не простила. Но и не мстила: я просто забрала то, что ему дали.
    -> hub
+ { get_flag("crew_list_found") } [В списке три имени. Одно твоё.]
    — «И. Грант, убыла». Я видела эту бумагу, когда выбиралась. Хорошая бумага.
    — Из неё даже можно было сделать факел, чтобы найти дорогу.
    -> hub
+ [Пойдёшь со мной. Живая.]
    — Живая — это интересно. — Она снимает маску: под ней лицо человека, который
    — двенадцать лет не видел ламп. — Я пойду. Но ты ответишь за меня перед теми,
    — кто закрыл её и закрыл меня. За меня и за неё: нас теперь двое.
    ~ set_flag("ilaria_arrested")
    ~ set_entity_state("npc_ilaria", "calm")
    ~ fire_rule("rule_end_arrest")
    -> END
+ [Я не дам тебе закончить.]
    — Тогда считай быстро. — Она надевает маску. — У тебя четырнадцать суток, а у меня
    — столько, сколько осталось имён.
    ~ set_entity_state("npc_ilaria", "angry")
    ~ fire_rule("rule_ilaria_fight")
    -> END
+ [Уходи. Я тебя не видел.]
    — Уже видел. И ты уже в счёте: восьмой, с сердцем серии М-9. Я тебя не трону.
    — Если только ты сам не захочешь, чтобы тебя досчитали.
    ~ set_flag("fled_city")
    ~ change_disposition("faction_conductors", 10)
    ~ fire_rule("rule_end_fled")
    -> END
+ [Я помогу.]
    — Не спеши. — Она кивает на кожух. — Сначала посмотри на него. Если после этого
    — ты всё ещё захочешь — повернёшь вентиль не туда, куда просила я, а туда, куда велит тебе
    — то, что у тебя в груди. Иди. Я подожду.
    ~ set_flag("ilaria_offer")
    ~ change_disposition("npc_ilaria", 25)
    -> END
- -> hub
"""))


def dialogues():
    return dict(DIALOGUES)
