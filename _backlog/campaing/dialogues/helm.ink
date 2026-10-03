EXTERNAL add_item(a0, a1)
EXTERNAL change_disposition(a0, a1)
EXTERNAL fire_rule(a0)
EXTERNAL get_flag(a0)
EXTERNAL item_count(a0)
EXTERNAL remove_item(a0, a1)
EXTERNAL set_flag(a0)

-> main

=== main ===
«Дознаватель. Раздевайтесь, только если собираетесь умереть: я работаю по записи.»
Вытирает руки о фартук, который чище рук.
-> main__hub


=== main__hub ===
* [Что показало вскрытие Крона?]
    «Официально: сердце не выдержало латуни. Моего мнения в приказе нет. Неофициально: в резонаторе — пыль третьего помола. Такую не продают. Её выдают, и выдают по накладной.»
    ~ add_item("item_autopsy_note", 1)
    ~ set_flag("rust_trace_known")
    ~ change_disposition("npc_helm", 5)
    -> main__hub
+ {not (get_flag("helm_helpful") == 1)} [Мне нужна записка для стражи.]
    -> note
+ [Почему вы отдали в архив банки с сердцами?]
    «Потому что их было два, дознаватель. Два сердца у одного человека. Одно своё, второе — то, которое он собирался отдать Матери. Второе и лежало на верстаке.»
    ~ set_flag("jars_seen")
    -> main__hub
+ [Быстро. Спасибо, доктор.]
    -> DONE
- -> main__hub

=== note ===
«Нужна — значит, упирайтесь. Я человек маленький: подпишу, если дадите причину не бояться Коллегии.»
-> note__hub


=== note__hub ===
* {item_count("item_cinder") >= 20 and not (get_flag("helm_helpful") == 1)} [Заплатить 20 угольков]
    ~ remove_item("item_cinder", 20)
    ~ add_item("item_autopsy_note", 1)
    ~ set_flag("helm_helpful")
    ~ set_flag("rust_trace_known")
    «Угольки — язык, который понимают даже мёртвые. Держите. И не показывайте записку литанистам: они начнут читать над ней молитвы.»
    -> main
* {not (get_flag("helm_helpful") == 1) and not (get_flag("helm_scared") == 1)} [Надавить на него]
    ~ fire_rule("rule_helm_intimidate")
    -> note__hub
* {not (get_flag("helm_helpful") == 1) and not (get_flag("helm_helped_talk") == 1)} [Спросить по-человечески]
    ~ fire_rule("rule_helm_persuade")
    -> note__hub
+ [Вернуться к разговору]
    -> main
+ [Уйти]
    -> DONE
- -> note__hub

=== done ===
{ get_flag("helm_helpful") == 1: Хельм выписывает строку и ставит печать ровно, как на лечебной карте. | Хельм смотрит мимо вас, и пальцы у него дрожат. }
-> done__hub


=== done__hub ===
+ [Вернуться]
    -> main
+ [Уйти]
    -> DONE
- -> done__hub
