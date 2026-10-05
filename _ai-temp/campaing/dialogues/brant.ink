EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL has_item(id)
EXTERNAL skill_check(s, d)
EXTERNAL fire_rule(r)
EXTERNAL set_dialogue_timer(s, k)

=== main ===
Камера Сердца гудит, как собор. Брант стоит у цепей, спиной к жаре, и не удивляется тебе. # action
Брант: Надзор всё-таки спустился. Койль тоже спустился — и лёг в пар. Любопытство, дознаватель, хуже мороза.
-> brant_hub

=== brant_hub ===
~ set_dialogue_timer(20, "brant_pause")
+ [Зачем ты это делаешь?]
    Брант: Сердце старше города. Оно греет ярусы, но уголь ему — что зола. Ему нужно живое тепло. Я не убийца, дознаватель. Я кочегар. # action
    Брант: Койль хотел остановить подачи — и заморозить всех. Я выбрал меньшую цену. Ты бы выбрал большую?
    -> brant_hub
* { has_item("item_ledger") and (has_item("item_note") or has_item("item_receipt")) and not (get_flag("brant_done")) } [Брант, ты арестован. Именем Надзора.]
    ~ set_flag("brant_done")
    ~ temp arrest = skill_check("intimidate", 55)
    { arrest == 1: -> brant_arrested }
    { arrest == 0: -> brant_fight }
* { not (get_flag("brant_done")) } [Город должен узнать правду о подачах.]
    Брант: Город узнает — и сгорит в панике раньше, чем в мороз. Правда не греет, дознаватель. # emotion: angry
    -> brant_hub
* { not (get_flag("brant_done")) } [Отпусти Дарью и прочих. Найдем уголь, найдем всё.]
    Брант: Угля городу не хватает триста лет. Люди — есть всегда. # emotion: angry
    -> brant_hub
* { not (get_flag("brant_done")) } [К цепям! Сердце больше не кормят.]
    Брант вскидывает перчатку: «Только через меня.» # action
    ~ fire_rule("rule_brant_fight")
    -> DONE
* { get_flag("brant_arrested") } [Вести его наверх — пусть город судит.]
    ~ fire_rule("rule_end_truth")
    -> DONE
* { get_flag("brant_dead") } [Разорвать цепи Сердца.]
    ~ fire_rule("rule_end_free")
    -> DONE
+ { get_flag("brant_arrested") or get_flag("brant_dead") } [Оставить Сердце питаться — город должен жить.]
    ~ fire_rule("rule_end_silence")
    -> DONE
+ [Мне пора.]
    -> DONE
- -> brant_hub

=== brant_arrested ===
Брант смотрит на цепи, потом на тебя — и сам протягивает запястья. # action
Брант: Веди. Но запомни: когда Сердце проголодается, город сам приведёт ему еду. И попросит ещё.
~ set_flag("brant_arrested")
-> brant_hub

=== brant_fight ===
Брант кивает, будто ждал. Свет гаснет по дуге, и паровая перчатка шипит. # action
Брант: Тогда ляг рядом с механиком, дознаватель. Пар всё спишет.
~ fire_rule("rule_brant_fight")
-> DONE

=== brant_pause ===
Брант молчит и слушает гул Сердца. Пар шипит на цепях. Ты чувствуешь, как время капает. # action
Брант: Слышишь? Оно дышит. Решайся, дознаватель.
-> brant_hub
