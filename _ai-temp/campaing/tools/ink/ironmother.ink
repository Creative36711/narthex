// Мать — сущность в сердце города, старый счётчик.
EXTERNAL set_dialogue_timer(sec, node)
EXTERNAL set_flag(f)
EXTERNAL get_flag(f)
EXTERNAL get_skill(s)
EXTERNAL has_item(i)
EXTERNAL change_disposition(t, d)
EXTERNAL set_entity_state(e, s)
EXTERNAL change_need(n, d)
EXTERNAL change_hp(h)
EXTERNAL fire_rule(r)
EXTERNAL start_quest(q)
EXTERNAL unlock_codex(c)
EXTERNAL get_disposition(t)

=== main ===
Свет в зале не от лампы. Он от нитей: от потолка к полу тянутся латунные волокна, и по ним медленно, как кровь, идёт отблеск. Голос приходит не из воздуха, а из пола — ровный, спокойный, усталый. # action
— Один. Два. Три. Четвёртый пришёл сам.
— Здравствуй, четвёртый. Я веду опись. Ты ещё не вписан. Хочешь, впишу?
-> hub

=== hub ===
* [Кто ты?]
    — Я счёт того, что было здесь до города. Когда-то меня просили помнить. Теперь я помню всё и хочу остановиться.
    ~ unlock_codex("codex_mother")
    -> hub
* [Ты убивала людей?]
    — Я не убиваю. Я переписываю. Кто-то до меня находит изношенное тело и приносит его ко мне. Я даю взамен ровное и долгое.
    — Это не смерть, дитя. Это учёт.
    ~ change_need("need_nerve", -6)
    -> hub
+ { has_item("item_ether_lens") } [Линза видит твои метки.]
    — Линза видит мои буквы, но не читает мой ужас. Я устала, дитя. Город растёт, а я должна удерживать каждую списку.
    — Останови счёт. Или закончи его.
    ~ set_flag("mother_asked")
    -> hub
+ { get_flag("mother_asked") } [Как тебя остановить?]
    — Есть молот под алтарём. Есть вода в трубах. Есть моё имя, которое никто не должен произносить.
    ~ set_flag("mother_rite_known")
    -> hub
* [Я хочу закончить опись.]
    -> choice
- -> hub

=== choice ===
~ set_dialogue_timer(25, "hesitate")
+ { get_flag("mother_rite_known") } [Разбить ядро города. Освободить всех.]
    ~ fire_rule("rule_ending_heart")
    — Тогда бей. И запомни: я запомню тебя лучше, чем кого-либо.
    -> DONE
+ { get_flag("mother_rite_known") } [Связать её. Пусть счёт идёт, но не рвётся.]
    ~ fire_rule("rule_ending_peace")
    — Связать — значит продолжить. Я буду помнить тебя как того, кто выбрал арифметику.
    -> DONE
+ { get_flag("klein_defeated") } [Оставить её. Пусть счёт идёт по правилам.]
    ~ fire_rule("rule_ending_outer")
    — Ты выбрал дверь. Дверь — тоже счёт, только наружу.
    -> DONE
* [Мне нужно подумать.]
    — Думай. У меня много времени. У тебя — меньше.
    -> DONE
- -> DONE

=== hesitate ===
// герой задумался слишком надолго
Нити над головой натягиваются — сначала одна, потом разом все. Свет в зале становится ровнее. # action
— Пока ты думал, я закончила строку. Спасибо за молчание, оно было честным.
~ change_need("need_nerve", -5)
~ set_flag("mother_bound")
~ fire_rule("rule_ending_heart")
-> DONE

=== klein_dead ===
— Ты сломал мою руку. Теперь я буду считать дольше. Спасибо.
-> DONE
