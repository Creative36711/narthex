EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL has_item(id)
EXTERNAL add_item(id, n)
EXTERNAL change_disposition(t, d)
EXTERNAL skill_check(s, d)
EXTERNAL set_dialogue_timer(s, k)

=== main ===
В зале Гильдии пахнет олифой и латунью. Гримм Хальв полирует медальон-шестерню и не предлагает сесть. # action
Гримм: Надзор прислал медную пуговицу на смерть механика? Дело закрыто, дознаватель. Пар не допрашивают.
-> grim_hub

=== grim_hub ===
~ set_dialogue_timer(15, "grim_silence")
* { not (get_flag("grim_pump")) } [Насосную остановили изнутри. Кому был нужен мёртвый пар?]
    ~ set_flag("grim_pump")
    Гримм: Вентили срывает и на честной работе. Койль сам виноват: не следил за железом. # emotion: angry
    -> grim_hub
* { not (get_flag("grim_key_done")) } [Давить: бирка Надзора требует ключ от архива.]
    ~ set_flag("grim_key_done")
    ~ temp press = skill_check("intimidate", 55)
    { press == 1: -> grim_press_ok }
    { press == 0: -> grim_press_fail }
* { not (get_flag("grim_talk_done")) } [Убедить: ярус замерзает, архив спасёт людей.]
    ~ set_flag("grim_talk_done")
    ~ temp talk = skill_check("persuade", 55)
    { talk == 1: -> grim_talk_ok }
    { talk == 0: -> grim_talk_fail }
* { get_flag("ledger_found") } [В архиве журнал подач. В Сердце пишут людей, Гримм.]
    Гримм опускается в кресло, будто из него выпустили пар. # action
    Гримм: Я думал, это слухи стариков. Койль докопался до строк — и вот он где. Подписи — не мои. Это Брант. Красная бирка. # emotion: afraid
    ~ set_flag("depths_open")
    Гримм: Старый лаз за моим архивом. Если спустишься — Гильдия тебя не видела.
    -> grim_hub
+ [Чем живёт Гильдия?]
    Гримм: Ремонтом того, что город ломает страхом. Иди работай, дознаватель.
    -> grim_hub
+ [Мне пора.]
    -> DONE
- -> grim_hub

=== grim_press_ok ===
Гримм зеленеет и долго возится со связкой. # action
Гримм: Бери. Но если тронешь сверх дела — я тебя на ярус больше не пущу.
~ add_item("item_guild_key", 1)
~ set_flag("grim_key_given")
-> grim_hub

=== grim_press_fail ===
Гримм: Надзор пугает? У меня триста механиков и город на плечах. Иди пугай пепельников. # emotion: angry
~ set_flag("grim_hostile")
~ change_disposition("npc_grim", -5)
-> grim_hub

=== grim_talk_ok ===
Гримм тяжело смотрит в окно, где сеет пепел. # action
Гримм: Третий мёрзнет, это правда. Держи ключ. В архиве ищи журнал подач — и не говори, что я дал.
~ add_item("item_guild_key", 1)
~ set_flag("grim_key_given")
-> grim_hub

=== grim_talk_fail ===
Гримм: Слова. Железо слов не понимает. Без ордера архив закрыт. # emotion: angry
~ change_disposition("npc_grim", -3)
-> grim_hub

=== grim_silence ===
Гримм выдерживает паузу дольше тебя. # action
Гримм: Молчишь? Значит, и говорить не о чем. У Надзора всегда так: сначала молчат, потом извиняются. # emotion: angry
~ change_disposition("npc_grim", -5)
-> DONE
