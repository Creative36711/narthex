EXTERNAL change_disposition(a0, a1)
EXTERNAL fire_rule(a0)
EXTERNAL get_flag(a0)
EXTERNAL has_item(a0)
EXTERNAL remove_item(a0, a1)
EXTERNAL set_dialogue_timer(a0, a1)
EXTERNAL set_entity_state(a0, a1)
EXTERNAL set_flag(a0)
EXTERNAL present_item(a0, a1, a2)

=== Начало ===
Каст не поднимает головы от бумаг. # action
Дело сто тридцать семь. У тебя семьдесят два часа, дознаватель. Говори коротко. # voice: assets/voice/kast_1.mp3
-> Начало_hub

=== Начало_hub ===
+ [Что именно случилось с седьмой помпой?]
    Остановлена. Причина устанавливается. Мастер пропал, вероятно — утонул. # emotion: calm
    Твоя задача: найти причину и назвать её так, чтобы город спал спокойно.
    ~ set_flag("kast_brief")
    -> Начало_hub
+ { get_flag("clue_roster") } [Кто приказал закрыть ярус?]
    Я. И не «закрыть», а «взять на учёт». Ты же видишь разницу, ты человек с образованием. # emotion: calm
    ~ set_flag("kast_alerted")
    ~ fire_rule("rule_lockdown")
    -> Начало_hub
+ { has_item("item_ledger") } [Я нашёл гроссбух.]
    Она наконец поднимает глаза. Улыбка есть, тепла нет. # action
    Покажи.
    -> Гроссбух
+ [Протянуть Каст записку мастера.]
    ~ present_item("Записка", "Отказ", "item_note")
    -> Начало_hub
+ [Где мастер Реш?]
Если бы я знала, ты бы здесь не стоял. Найди — и приведи. Живым желательно, но мне хватит и вины. # emotion: calm # voice: assets/voice/kast_2.mp3
    -> Начало_hub
+ [Мне пора.]
    -> DONE

=== Гроссбух ===
Она листает книгу быстро, почти не глядя — как человек, который знает, что там написано. # action
-> Гроссбух_hub

=== Гроссбух_hub ===
~ set_dialogue_timer(15, "Молчание")
+ [Отдать гроссбух и закрыть дело.]
    Вот и хорошо. Дело закрыто, виновный установлен, город спит. # emotion: calm
    ~ remove_item("item_ledger", 1)
    ~ set_flag("ledger_shown_kast")
    ~ fire_rule("rule_end_closed")
    -> DONE
+ [Я его не отдам.]
    Тогда ты не дознаватель, а свидетель. Разница в том, кого хоронят первым. # emotion: angry
    ~ set_flag("kast_alerted")
    ~ set_entity_state("npc_kast", "angry")
    ~ fire_rule("rule_lockdown")
    -> DONE
+ [Ты подписала расход на режим тишины.]
Подписала. И подпишу ещё: порядок дороже правды, потому что правда не держит воду. # emotion: angry # voice: assets/voice/kast_3.mp3
    ~ change_disposition("npc_kast", -25)
    ~ set_flag("kast_alerted")
    ~ fire_rule("rule_lockdown")
    -> DONE

=== Молчание ===
Молчание длится ровно столько, сколько нужно, чтобы его записали. # action
Молчишь? Я запишу: «показаний не дал, улики не предъявил». Продолжай в том же духе.
~ set_flag("kast_alerted")
~ fire_rule("rule_lockdown")
-> Начало

=== Записка ===
Каст читает, не беря бумагу в руки: только глазами по строчке, туда и обратно. # timer: 4 # action
«Муфту срезали изнутри». Мастер сорок лет молчал не потому, что боялся. Он ждал, кто первый скажет это вслух. # emotion: calm
Наряд на ночь тринадцатого выписан в моём отделе. Подпись моя. Почерк — не мой. # emotion: calm # voice: assets/voice/kast_4.mp3
Кто писал — я не ищу. Но если найдёшь, учти: это человек, чьи бумаги я подписываю не глядя. Таких в отделе девять. Считай, я назвала тебе девятерых и ни одного имени. # emotion: calm
~ set_flag("kast_note")
~ change_disposition("npc_kast", -12)
~ fire_rule("rule_kast_note")
-> Начало_hub

=== Отказ ===
Она даже не смотрит на протянутое. # action
Убери. Дело сто тридцать семь не про это, а время у тебя не резиновое. # emotion: calm
-> Начало_hub
