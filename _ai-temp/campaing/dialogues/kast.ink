EXTERNAL npc_known(a0)
EXTERNAL change_disposition(a0, a1)
EXTERNAL fire_rule(a0)
EXTERNAL get_flag(a0)
EXTERNAL has_item(a0)
EXTERNAL present_item(a0, a1, a2)
EXTERNAL remove_item(a0, a1)
EXTERNAL set_dialogue_timer(a0, a1)
EXTERNAL set_entity_state(a0, a1)
EXTERNAL set_flag(a0)

=== Начало ===
Каст не поднимает головы от бумаг. # action # voice: assets/voice/narr_kast_1.mp3
Дело сто тридцать семь. У тебя семьдесят два часа, дознаватель. Говори коротко. # voice: assets/voice/kast_1.mp3
-> Начало_hub

=== Начало_hub ===
+ [Что именно случилось с седьмой помпой?]
    Остановлена. Причина устанавливается. Мастер пропал, вероятно — утонул. # emotion: calm # voice: assets/voice/kast_5.mp3
    Твоя задача: найти причину и назвать её так, чтобы город спал спокойно. # voice: assets/voice/kast_8.mp3
    ~ set_flag("kast_brief")
    -> Начало_hub
+ { get_flag("clue_roster") } [Кто приказал закрыть ярус?]
    Я. И не «закрыть», а «взять на учёт». Ты же видишь разницу, ты человек с образованием. # emotion: calm # voice: assets/voice/kast_11.mp3
    ~ set_flag("kast_alerted")
    ~ fire_rule("rule_lockdown")
    -> Начало_hub
+ { has_item("item_ledger") } [Я нашёл гроссбух.]
    Она наконец поднимает глаза. Улыбка есть, тепла нет. # action # voice: assets/voice/narr_kast_2.mp3
    Покажи. # voice: assets/voice/kast_12.mp3
    -> Гроссбух
+ { has_item("item_note") and not (get_flag("kast_note")) } [Протянуть Каст записку мастера.]
    ~ present_item("Записка", "Записка_мимо", "item_note")
    -> DONE
+ { not (get_flag("resh_found")) and not (npc_known("npc_resh")) } [Где мастер Реш?]
Если бы я знала, ты бы здесь не стоял. Найди — и приведи. Живым желательно, но мне хватит и вины. # emotion: calm # voice: assets/voice/kast_2.mp3
    -> Начало_hub
+ { get_flag("case_full") and not (get_flag("kast_case_shown")) } [Показать сшитое дело.]
    Она смотрит на нитку дольше, чем на сами листы. # action # voice: assets/voice/narr_kast_3.mp3
    Ты сшил дело. Я видела три таких за двадцать лет: два закрыли, одно закрыло дознавателя. # emotion: thoughtful # voice: assets/voice/kast_15.mp3
    ~ set_flag("kast_case_shown")
    -> Начало_hub
+ { has_item("item_glove") } [Под приводом лежала караульная рукавица.]
    Караульная партия. Значит, кто-то из двенадцати снял рукавицу, когда крутил муфту, и забыл в поддоне. # emotion: calm # voice: assets/voice/kast_16.mp3
    Не неси её сюда: масло пачкает сукно. Подшей к делу номер клейма — для трибунала нитка весит больше тряпки. # emotion: thoughtful # voice: assets/voice/kast_17.mp3
    -> Начало_hub
+ { get_flag("case_hand") and not (get_flag("kast_hand")) } [Тот же завиток — на квитанциях за жильное стекло.]
    ~ set_flag("kast_hand")
    Каст кладёт квитанцию рядом с нарядом и долго смотрит на две одинаковые петли. # action # sfx: snd_paper # voice: assets/voice/narr_kast_8.mp3
    Значит, моей подписью не только запирают ярусы. Ею ещё и торгуют. # emotion: angry # voice: assets/voice/kast_18.mp3
    Держать ярус взаперти я не стану. Не ради тебя: пусть он думает, что его не ищут. # emotion: calm # voice: assets/voice/kast_19.mp3
    ~ change_disposition("npc_kast", 10)
    ~ fire_rule("rule_kast_hand")
    -> Начало_hub
* { get_flag("resh_found") and not (get_flag("kast_resh")) } [Мастер Реш жив.]
    ~ set_flag("kast_resh")
    Жив. Это хуже для всех, кроме него. Живой мастер — это свидетель, а свидетелей в моём отделе не любят. # emotion: thoughtful # voice: assets/voice/kast_20.mp3
    Приведи его, если сможешь. Если нет — больше никому не говори, что он жив. # emotion: calm # voice: assets/voice/kast_21.mp3
    ~ fire_rule("rule_kast_resh")
    -> Начало_hub
* { has_item("item_burn_note") and not (get_flag("kast_burn")) } [Ночью за моим делом приходили. Вот что было у вора.]
    ~ set_flag("kast_burn")
    Каст читает записку дважды, второй раз — подняв её к лампе, будто ищет водяной знак. # action # voice: assets/voice/narr_kast_9.mp3
    «В печь». Даже не подписал: думает, что завиток и есть подпись. И он прав — в моём отделе этот завиток знают все. # emotion: angry # voice: assets/voice/kast_22.mp3
    Оставь записку в деле. Кто приходит за папкой ночью, тот боится её днём. # emotion: calm # voice: assets/voice/kast_23.mp3
    ~ change_disposition("npc_kast", 3)
    ~ fire_rule("rule_kast_burn")
    -> Начало_hub
+ [Мне пора.]
    -> DONE

=== Гроссбух ===
Она листает книгу быстро, почти не глядя — как человек, который знает, что там написано. # action # sfx: snd_page # voice: assets/voice/narr_kast_4.mp3
-> Гроссбух_hub

=== Гроссбух_hub ===
~ set_dialogue_timer(15, "Молчание")
+ [Отдать гроссбух и закрыть дело.]
    Вот и хорошо. Дело закрыто, виновный установлен, город спит. # emotion: calm # voice: assets/voice/kast_13.mp3
    ~ remove_item("item_ledger", 1)
    ~ set_flag("ledger_shown_kast")
    ~ fire_rule("rule_end_closed")
    -> DONE
+ [Я его не отдам.]
    Тогда ты не дознаватель, а свидетель. Разница в том, кого хоронят первым. # emotion: angry # voice: assets/voice/kast_9.mp3
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
Молчание длится ровно столько, сколько нужно, чтобы его записали. # action # voice: assets/voice/narr_kast_5.mp3
Молчишь? Я запишу: «показаний не дал, улики не предъявил». Продолжай в том же духе. # sfx: snd_paper # voice: assets/voice/kast_14.mp3
~ set_flag("kast_alerted")
~ fire_rule("rule_lockdown")
-> Начало

=== Записка ===
Каст читает, не беря бумагу в руки: только глазами по строчке, туда и обратно. # action # voice: assets/voice/narr_kast_6.mp3
«Муфту срезали изнутри». Мастер сорок лет молчал не потому, что боялся. Он ждал, кто первый скажет это вслух. # emotion: calm # voice: assets/voice/kast_6.mp3
Наряд на ночь тринадцатого выписан в моём отделе. Подпись моя. Почерк — не мой. # emotion: calm # voice: assets/voice/kast_4.mp3
Кто писал — я не ищу. Но если найдёшь, учти: это человек, чьи бумаги я подписываю не глядя. Таких в отделе девять. Считай, я назвала тебе девятерых и ни одного имени. # emotion: calm # voice: assets/voice/kast_7.mp3
~ set_flag("kast_note")
~ change_disposition("npc_kast", -12)
~ fire_rule("rule_kast_note")
-> Начало_hub

=== Записка_мимо ===
Она даже не поднимает глаз. # action # voice: assets/voice/narr_kast_7.mp3
Убери. Я разговариваю с делом, а не с твоей сумкой. # emotion: calm # voice: assets/voice/kast_10.mp3
-> Начало_hub
