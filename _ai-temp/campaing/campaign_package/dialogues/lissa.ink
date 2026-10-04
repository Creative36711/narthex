EXTERNAL fire_rule(a0)
EXTERNAL get_flag(a0)
EXTERNAL unlock_codex(a0)

=== main ===
{ not (get_flag("lissa_found")):
    Не кричите, пожалуйста. Я вас вижу, а вы меня нет — так и надо.
    Я Лисса. Я собирала вкладыши. Я не знала, для чего они, пока не увидела, как уводят Тэна и Мирту…
}
{ get_flag("lissa_found"):
    Вы вернулись. Я думала, все возвращаются только в виде бумаг.
}
-> main_hub

=== main_hub ===
+ [Расскажи, что ты видела.] { not (get_flag("lissa_found")) }
    Партию вкладышей заказывали на восемь человек. Восьмой ещё не выбран, но номер уже выбит. Я видела список: двое из бригады, один бездомный и я.
    Последнюю строку вычеркнули и вписали «медянка». Это я.
    ~ fire_rule("rule_lissa_calm")
    -> main_hub

+ [Я укрою тебя у Ирены.] { get_flag("met_irena") and not (get_flag("lissa_saved")) }
    Ирена… она меня выгонит. Она всех выгоняет.
    Хорошо. Хорошо. Я пойду к ней.
    ~ fire_rule("rule_lissa_saved")
    -> main_hub

+ [Уходи из города сама, сегодня.] { get_flag("lissa_found") and not (get_flag("lissa_saved")) and not (get_flag("lissa_lost")) }
    Куда? За воротами пепел и ни одной корчмы. Но здесь я тоже не доживу…
    ~ fire_rule("rule_lissa_abandoned")
    -> DONE

+ [Кто приходит вниз за людьми?]
    Серая. Плащ, капюшон, шагов не слышно. Дирекция называет их «тихой стражей», а Марта говорит: «тихие».
    ~ unlock_codex("codex_quiet")
    -> main_hub

+ [Назови имена. Тех, кого увели.] { get_flag("lissa_found") }
    Тэн, Мирта, Слепой Ерш и Малый. Четвёртой должна была быть я.
    ~ fire_rule("rule_lissa_names")
    -> main_hub

+ [Как выглядит «Тихая»?] { get_flag("lissa_found") }
    Как человек. Только идёт без шагов, и лицо такое, будто она уже всё про себя решила.
    ~ fire_rule("rule_lissa_quiet")
    -> main_hub

+ [Прощай, Лисса.]
    -> DONE

- -> main_hub
