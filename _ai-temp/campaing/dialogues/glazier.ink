EXTERNAL present_item(a0, a1, a2)
EXTERNAL clear_flag(flag)
EXTERNAL add_item(a0, a1)
EXTERNAL change_disposition(a0, a1)
EXTERNAL fire_rule(a0)
EXTERNAL get_flag(a0)
EXTERNAL learn_name(a0)
EXTERNAL open_trade(a0)
EXTERNAL set_flag(a0)
EXTERNAL skill_check(a0, a1)
EXTERNAL unlock_codex(a0)

VAR r = 0

=== Начало ===
{ get_flag("glazier_downed"): -> DONE }
{ get_flag("glazier_robbed") or get_flag("glazier_beaten"): -> Ушёл }
{ get_flag("glazier_met"): -> Снова }
Из бокового штрека выходит человек с заплечным коробом, обмотанным мешковиной. Сквозь мешковину сочится бирюзовый свет. # action # sfx: snd_cloth # voice: assets/voice/narr_glazier_1.mp3
Тихо, дознаватель. Ты меня не видел, я тебя не видел. Внизу так договариваются. # emotion: thoughtful # voice: assets/voice/glazier_1.mp3
~ set_flag("glazier_met")
~ set_flag("glazier_trades")
-> Начало_hub

=== Ушёл ===
Короб с бирюзовым светом снова выныривает из темноты штрека. Человек узнаёт тебя раньше, чем ты его. # action # voice: assets/voice/narr_glazier_2.mp3
Зря ты так, дознаватель. Внизу Надзора нет. # emotion: angry # voice: assets/voice/glazier_7.mp3
-> DONE

=== Снова ===
Короб с бирюзовым светом снова выныривает из темноты штрека. Человек узнаёт тебя раньше, чем ты его. # action # voice: assets/voice/narr_glazier_2.mp3
-> Начало_hub

=== Начало_hub ===
+ { not (get_flag("glazier_box")) } [Что у тебя в коробе?]
    Стекло. Жильное. Наверху за осколок дают больше, чем за ведро угля и ведро воды вместе. А здесь его никто не считает: помпа стоит, смены нет. Сычом меня зовут, если что. # emotion: calm # voice: assets/voice/glazier_2.mp3
    ~ set_flag("glazier_box")
    ~ learn_name("npc_glazier")
    ~ unlock_codex("codex_glass")
    -> Начало_hub
+ { not (get_flag("glazier_named")) and not (get_flag("glazier_asked")) } [Кому ты его несёшь?]
    ~ set_flag("glazier_asked")
    ~ r = skill_check("persuade", 45)
    {r: -> Назвал | -> Не_назвал}
+ [Что продаёшь?]
    Осколок — двенадцать марок. Бинт и вода дороже, чем наверху: сюда их никто, кроме меня, не носит. # emotion: calm # voice: assets/voice/glazier_5.mp3
    ~ open_trade("npc_glazier")
    -> DONE
+ { not (get_flag("glazier_robbed")) and not (get_flag("glazier_beaten")) } [Короб на землю. Именем Надзора.]
    ~ r = skill_check("intimidate", 50)
    {r: -> Отдал | -> Драка}
+ [Показать ему вещь.]
    ~ present_item("Вещь", "Вещь", "")
    -> DONE
+ [Иди своей дорогой.]
    -> DONE

=== Назвал ===
Скупщику в Сухом ряду? Нет, выше. Квитанции без печати, подпись с завитком. Такой завиток я видел только на нарядах из конторы. # emotion: thoughtful # voice: assets/voice/glazier_3.mp3
~ set_flag("glazier_named")
~ fire_rule("rule_glazier_named")
-> Начало_hub

=== Не_назвал ===
Кому надо, тому и несу. Ты спрашиваешь, как наверху, а мы внизу. # emotion: angry # voice: assets/voice/glazier_4.mp3
-> Начало_hub

=== Отдал ===
Ладно, ладно! Забирай осколок, мне шея дороже стекла. А короб не трогай — он не мой. # emotion: afraid # voice: assets/voice/glazier_6.mp3
~ set_flag("glazier_robbed")
~ clear_flag("glazier_trades")
~ add_item("item_vein_shard", 1)
~ change_disposition("npc_glazier", -15)
-> DONE

=== Драка ===
Зря ты так, дознаватель. Внизу Надзора нет. # emotion: angry # voice: assets/voice/glazier_7.mp3
~ clear_flag("glazier_trades")
~ fire_rule("rule_glazier_fight")
-> DONE

=== Вещь ===
Не покупаю. Стекло — да, а это неси в Сухой ряд. # emotion: calm # voice: assets/voice/glazier_8.mp3
-> Начало_hub
