# -*- coding: utf-8 -*-
"""Диалоги конструктора (DlgDoc) для 11 говорящих персонажей.

Правила, которых держится генератор ink:
* в диалоге используются только документированные команды: set_flag, add_item,
  remove_item, fire_rule, start_quest, change_disposition, apply_status,
  set_weather, unlock_codex, unlock_recipe, join_party, sleep;
* проверки навыков с двумя ветками живут в правилах и зовутся fire_rule;
* переходы у каждого варианта заданы явно (stay / end / id узла).
"""


def line(text, **kw):
    l = {"text": text}
    l.update(kw)
    return {"kind": "line", "line": l}


def eff(effect):
    return {"kind": "effect", "effect": effect}


def sec(*steps, **kw):
    s = {"steps": list(steps)}
    s.update(kw)
    return s


def choice(text, *sections, goto="stay", **kw):
    c = {"text": text, "sections": list(sections), "goto": goto}
    c.update(kw)
    return c


def has(item, count=None, not_=False):
    if count is None:
        c = {"type": "has_item", "item": item}
    else:
        c = {"type": "item_ge", "item": item, "count": count}
    if not_:
        c["not"] = True
    return c


def flag(f, not_=False):
    c = {"type": "flag", "flag": f}
    if not_:
        c["not"] = True
    return c


def disp(target, value):
    return {"type": "disp_ge", "target": target, "value": value}


def quest(q, stage=None):
    c = {"type": "quest", "quest": q}
    if stage:
        c["stage"] = stage
    return c


def node(nid, label, sections, choices, goto=None):
    n = {"id": nid, "label": label, "sections": sections, "choices": choices}
    if goto:
        n["goto"] = goto
    return n


# --- Караульный на воротах -----------------------------------------------
GUARD = {
    "version": 2, "label": "Караульный Пётр Слепнёв",
    "nodes": [
        node("main", "Ворота", [
            sec(line("Стоять. Кто идёт?"),
                conds=[flag("guard_let_in", not_=True)]),
            sec(line("Проходите, инспектор. Только вниз без пропуска — не ходите, там сейчас неспокойно."),
                line("Если что — бумаги у сержанта Гулы, в участке на рынке."),
                conds=[flag("guard_let_in")]),
        ], [
            choice("Инспектор Ревизии. Вот служебная бумага.",
                   sec(line("Бумага с печатью — ну наконец-то. За неделю второй по счёту, "
                            "и первый, говорят, уже в ямах лежит."),
                       eff({"type": "fire_rule", "rule": "rule_guard_papers"})),
                   conds=[flag("guard_let_in", not_=True)],
                   goto="stay"),
            choice("Не задерживай. Ревизия не любит ждать.",
                   sec(line("Не люблю и я. Но служба — она для всех служба…"),
                       eff({"type": "fire_rule", "rule": "rule_guard_press"})),
                   conds=[flag("guard_let_in", not_=True)],
                   goto="stay"),
            choice("Вот пять марок. Смена длинная.",
                   sec(line("Смена длинная, да. Проходите, инспектор, только не через ямы."),
                       eff({"type": "fire_rule", "rule": "rule_guard_bribe"})),
                   conds=[has("item_silver", 5), flag("guard_let_in", not_=True)],
                   goto="stay"),
            choice("Что тут случилось с инспектором?",
                   sec(line("Гарна нашли в Глубоком штреке, лицо закрыто тряпкой. "
                            "Казённое объявление висит у стены — прочтите, если охота."),
                       eff({"type": "unlock_codex", "entry": "codex_garn_case"}),
                       eff({"type": "set_flag", "flag": "notice_read"}))),
            choice("Кто в городе решает?",
                   sec(line("Дирекция на верхней террасе. Управляющий Валент Корр — "
                            "он подписывает всё: и руду, и воду, и кого спускать вниз."),
                       eff({"type": "unlock_codex", "entry": "codex_directorate"}))),
            choice("Где тут едят и спят?",
                   sec(line("Корчма «Сухой патрубок» — под рынком. Марта держит, "
                            "похлёбка честная, койка пять марок."))),
            choice("До встречи."),
        ], goto="end"),
    ],
}

# --- Клёп, старьёвщик -----------------------------------------------------
VEIN = {
    "version": 2, "label": "Клёп Старьёвщик",
    "nodes": [
        node("main", "Прилавок", [
            sec(line("Хлам, снасть, слухи — всё по честной цене, инспектор."),
                line("Есть вода без осадка и стим, если руки дрожат. У тебя {счёт:item_silver} марок, я считал.")),
        ], [
            choice("Купить сухой паёк (5 см).",
                   sec(eff({"type": "remove_item", "item": "item_silver", "qty": 5}),
                       eff({"type": "add_item", "item": "item_food_pack", "qty": 1}),
                       line("Держи. В штреке жуй медленно — угар жадный.")),
                   conds=[has("item_silver", 5)]),
            choice("Купить флягу воды (3 см).",
                   sec(eff({"type": "remove_item", "item": "item_silver", "qty": 3}),
                       eff({"type": "add_item", "item": "item_water", "qty": 1}),
                       line("Вода чистая, с верхней террасы. Ниже воду не бери, я тебя прошу.")),
                   conds=[has("item_silver", 3)]),
            choice("Купить стим-ампулу (15 см).",
                   sec(eff({"type": "remove_item", "item": "item_silver", "qty": 15}),
                       eff({"type": "add_item", "item": "item_stimm", "qty": 1}),
                       line("Последняя. Потом говори: «Клёп, где стим», а Клёп уже и помер.")),
                   conds=[has("item_silver", 15)]),
            choice("Что слышно про инспектора Гарна?",
                   sec(line("Тихий был человек. Ходил вниз три раза, а на четвёртый "
                            "его вытащили кран-балкой. Дирекция говорит — несчастный случай."),
                       line("Я тебе так скажу: у нас тут всё несчастный случай. Только "
                            "почему-то только с теми, кто вниз ходит."),
                       eff({"type": "unlock_codex", "entry": "codex_garn_case"}),
                       eff({"type": "fire_rule", "rule": "rule_vein_hint"}))),
            choice("Куда пропадают люди из ям?",
                   sec(line("За месяц четверо: двое из бригады, один с рынка и девчонка-медянка. "
                            "Бумаг ни по кому не завели."),
                       eff({"type": "unlock_codex", "entry": "codex_lower"}),
                       eff({"type": "fire_rule", "rule": "rule_vein_missing"}))),
            choice("Кто такой Боссар?",
                   sec(line("Бригадир шлаковых ям. Воровал, бил, но своих не отдавал. "
                            "Последний месяц у него зубы стиснуты — Дирекция жмёт."))),
            choice("Покажи, что у тебя есть для штрека.",
                   sec(line("Для штрека — маска и хорошие лёгкие. Маску продам за двадцать две, "
                            "а лёгкие свои, я их не продаю."),
                       eff({"type": "unlock_recipe", "recipe": "recipe_filter"}),
                       line("Если руки прямые — собери сам: ткань, уголь, проволока. Инструмент у меня есть."))),
            choice("Вот латунный вкладыш. Видел такой?",
                   sec(line("Видел. Такие приносят из цеха Дирекции — партиями, по номерам. "
                            "А знаешь, куда идёт этот номер? В череп. Живым."),
                       line("Гарн про них спрашивал. Три раза спрашивал, а на четвёртый не вернулся."),
                       eff({"type": "fire_rule", "rule": "rule_vein_implant"})),
                   conds=[flag("implant_found")]),
            choice("Смотри, что я забрал в штреке.",
                   sec(line("Книга. С подписью. Ты, инспектор, или очень смелый, или очень мёртвый."),
                       line("Спрячь её под плащ и не показывай больше никому, кроме Ревизии."),
                       eff({"type": "fire_rule", "rule": "rule_vein_ledger"})),
                   conds=[flag("ledger_taken")]),
            choice("До встречи."),
        ], goto="end"),
    ],
}

# --- Сержант Гула ---------------------------------------------------------
SERGEANT = {
    "version": 2, "label": "Сержант Гула",
    "nodes": [
        node("main", "Участок", [
            sec(line("Второй инспектор за неделю. Первый не вернулся, "
                     "так что слушаю вас внимательно и записываю не всё."),
                conds=[flag("case_taken", not_=True)]),
            sec(line("Дело на полке, я вас пущу. Только читайте при мне: "
                     "мне ещё отчёт писать о том, чего я не видела."),
                conds=[flag("case_taken")]),
        ], [
            choice("Покажите материалы Гарна.",
                   sec(eff({"type": "fire_rule", "rule": "rule_sergeant_case"}),
                       line("Держите. Три улики, ни одного свидетеля. И вкладыш "
                            "латунный, помеченный «металлолом».")),
                   conds=[flag("case_taken", not_=True)]),
            choice("Почему дело закрыли за один день?",
                   sec(line("Потому что приказ. Сверху, с террасы, с печатью. "
                            "Я такие печати видела дважды, и оба раза потом кому-то спи…"),
                       eff({"type": "fire_rule", "rule": "rule_sergeant_squeeze"}))),
            choice("Что за люди пропадают внизу?",
                   sec(line("Бригадные, да медянка одна. Дирекция пишет «убыли по производству». "
                            "Четверо за месяц — это не убыли, это поставка."),
                       eff({"type": "unlock_codex", "entry": "codex_lower"}),
                       eff({"type": "fire_rule", "rule": "rule_sergeant_names"}))),
            choice("Что вы знаете про Валента?",
                   sec(line("Управляющий. Сразу после смерти Гарна подписал "
                            "все бумаги одной рукой — и своей, и начальника Ревизии."),
                       eff({"type": "unlock_codex", "entry": "codex_directorate"}))),
            choice("Вкладыш с номером. Что это значит?",
                   sec(line("Значит, партия из цеха. Значит, был наряд и была подпись. "
                            "Такие наряды подписывает Валент — лично, своей рукой."),
                       eff({"type": "fire_rule", "rule": "rule_sergeant_implant"})),
                   conds=[flag("implant_found")]),
            choice("У меня гроссбух Гарна.",
                   sec(line("Тогда вам нужен свидетель, иначе Ревизия похоронит бумаги "
                            "вместе с вами. Свидетель есть?"),
                       line("Медянка? Тогда спасайте её, инспектор. Не бумагами — ногами."),
                       eff({"type": "fire_rule", "rule": "rule_sergeant_ledger"})),
                   conds=[flag("ledger_taken")]),
            choice("До встречи, сержант."),
        ], goto="end"),
    ],
}

# --- Ханна, лекарка -------------------------------------------------------
MEDIC = {
    "version": 2, "label": "Ханна, лекарка",
    "nodes": [
        node("main", "Стол у шкафа", [
            sec(line("Кладите руки на стол. Что болит — само скажет."),
                line("У вас {здоровье} здоровья из {здоровье_макс}. Плечи как у шахтёра, "
                     "глаза как у человека, который мало спит.")),
        ], [
            choice("Подлечите меня (6 см).",
                   sec(eff({"type": "remove_item", "item": "item_silver", "qty": 6}),
                       eff({"type": "fire_rule", "rule": "rule_medic_help"}),
                       line("Готово. Дышите мелко, три часа не спорьте с караулом.")),
                   conds=[has("item_silver", 6)]),
            choice("Купить осадок от ржави (10 см).",
                   sec(eff({"type": "remove_item", "item": "item_silver", "qty": 10}),
                       eff({"type": "add_item", "item": "item_tonic", "qty": 1}),
                       line("Пейте сразу, как пальцы начнут не слушаться. "
                            "Это не лечение, инспектор. Это отсрочка.")),
                   conds=[has("item_silver", 10)]),
            choice("Что такое ржавь?",
                   sec(line("Счёт. Вы думаете, это болезнь, а это счёт, который вам выставили. "
                            "Металл растёт там, где жило тепло."),
                       eff({"type": "unlock_codex", "entry": "codex_rust"}))),
            choice("Что говорят тела из ям?",
                   sec(line("Вкладыши у них в черепах. Латунь, шлифованная, с номером. "
                            "Такие ставят не мертвым, а живым — чтобы держался в машине."),
                       line("И ещё: у всех четырёх волосы чистые. Их мыли перед тем, как подключать."),
                       eff({"type": "fire_rule", "rule": "rule_medic_names"}))),
            choice("Что у вас от ржави?",
                   sec(line("Осадок. Трава-жгунец, спирт и время. Держите, я запишу, как делать."),
                       eff({"type": "fire_rule", "rule": "rule_medic_recipe"})),
                   conds=[flag("clinic_helped"), flag("recipe_tonic_known", not_=True)]),
            choice("Проверьте, как я дышу.",
                   sec(line("Лёгкие как у шахтёра: угар есть, но немного. Меняйте уголь "
                            "в маске каждый день."),
                       eff({"type": "fire_rule", "rule": "rule_medic_lungs"})),
                   conds=[flag("fume_first")]),
            choice("До встречи."),
        ], goto="end"),
    ],
}

# --- Марта, корчма --------------------------------------------------------
MARTA = {
    "version": 2, "label": "Марта Крив",
    "nodes": [
        node("main", "За стойкой", [
            sec(line("Садись, инспектор. Похлёбка, койка или разговор? "
                     "Разговор у меня дороже, но зато не остывает.")),
        ], [
            choice("Похлёбка (3 см).",
                   sec(eff({"type": "remove_item", "item": "item_silver", "qty": 3}),
                       eff({"type": "add_item", "item": "item_stew", "qty": 1}),
                       line("Ешь. Мясо настоящее, не крыса. Крысу я в похлёбку не кладу — "
                            "крыса у меня в подвале живёт, прикормленная.")),
                   conds=[has("item_silver", 3)]),
            choice("Что слышно в городе?",
                   sec(line("Слышно, что Ход сбивается. Дирекция молчит и завозит побольше стражи. "
                            "А ещё слышно, что в шлаковых ямах кран-балку чинили дважды за неделю."),
                       eff({"type": "fire_rule", "rule": "rule_marta_rumors"}))),
            choice("Про долг Боссару.",
                   sec(line("Ох. Долг есть: пятнадцать марок, срок вышел ещё в Углемес. "
                            "Боссар никого не убил за долг ни разу, но корчму может закрыть."),
                       line("Закроешь — я тебе и стол, и койку, и слухи в любое время."),
                       eff({"type": "fire_rule", "rule": "rule_marta_debt"}))),
            choice("Про пропажи внизу.",
                   sec(line("Четверо за месяц. Все — из бригад, все молодые. "
                            "И знаешь что? Их матери получили по десять марок «за убыль». "
                            "Дирекция вдовьи деньги платит редко, а тут расщедрилась."),
                       eff({"type": "unlock_codex", "entry": "codex_directorate"}))),
            choice("Кто из города может знать больше?",
                   sec(line("Ирена Скол, литейная. Она злая, честная и знает про Ход "
                            "больше, чем вся Дирекция вместе. И Лисса-медянка — но её ищи внизу, "
                            "и лучше раньше, чем это сделает «тихая»."),
                       eff({"type": "fire_rule", "rule": "rule_marta_hint"}))),
            choice("Закрыть долг корчмы (15 см).",
                   sec(line("Ох, инспектор. Вот это по-человечески."),
                       eff({"type": "fire_rule", "rule": "rule_marta_debt_cleared_choice"})),
                   conds=[flag("debt_taken"), flag("debt_paid", not_=True), has("item_silver", 15)]),
            choice("Боссар больше не придёт за долгом.",
                   sec(line("…Ты его? Ну, инспектор. Не скажу, что мне его жалко, "
                            "но я помню, кем он был до ям."),
                       eff({"type": "fire_rule", "rule": "rule_marta_debt_cleared"})),
                   conds=[flag("debt_taken"), flag("debt_paid", not_=True), flag("bossar_fought")]),
            choice("Что говорят о Ходе?",
                   sec(line("Трубы гудят не в лад. Дед мой работал на верхней террасе и говорил: "
                            "когда Ход сбивается — Дирекция начинает забирать."),
                       eff({"type": "fire_rule", "rule": "rule_marta_hod"})),
                   conds=[flag("met_irena")]),
            choice("До встречи, Марта."),
        ], goto="end"),
    ],
}

# --- Ирена Скол -----------------------------------------------------------
IRENA = {
    "version": 2, "label": "Ирена Скол",
    "nodes": [
        node("main", "У горна", [
            sec(line("Новый инспектор. Палка в шестерне — тоже шестерня, так что говорите быстро."),
                conds=[flag("met_irena", not_=True)]),
            sec(line("А, это вы. Палка вернулась. Слушаю."),
                conds=[flag("met_irena")]),
        ], [
            choice("Что случилось с Ходом?",
                   sec(line("Ход не сломался. Ход голодает. Ему нужен проводник — живой человек "
                            "в латунном ложе, который держит обороты вместо регулятора. "
                            "Седьмой держался три зимы и умер этой осенью."),
                       line("Валент не хочет ставить восьмого сам. Он хочет, чтобы восьмой "
                            "был никакой: сирота, должник, пропавший. Из ям, короче."),
                       eff({"type": "unlock_codex", "entry": "codex_hod"}),
                       eff({"type": "unlock_codex", "entry": "codex_conductor"}),
                       eff({"type": "fire_rule", "rule": "rule_irena_met"}))),
            choice("Как дышать внизу?",
                   sec(line("Никак. Угар идёт из штрека слоями. Сложи фильтр: ткань, "
                            "уголь в два слоя, проволока по кругу. Меняй уголь каждый день."),
                       eff({"type": "fire_rule", "rule": "rule_irena_teaches"}),
                       line("Мой верстак в твоём распоряжении, пока я не передумала.")),
                   conds=[flag("filter_known", not_=True)]),
            choice("Лисса просила передать, что она жива.",
                   sec(line("…Жива. Дура малая. Я её спрячу в литейной, "
                            "и если Дирекция придёт её искать — пусть приходит со взводом."),
                       eff({"type": "fire_rule", "rule": "rule_lissa_saved"})),
                   conds=[flag("lissa_found"), flag("lissa_saved", not_=True)]),
            choice("Пойдёмте со мной в машинный зал.",
                   sec(line("Думала, вы не предложите. Собираю щупы и иду за вами. "
                            "Только, инспектор: я хочу остановить Ход, а не спасти Дирекцию."),
                       eff({"type": "join_party", "npc": "npc_irena"}),
                       eff({"type": "fire_rule", "rule": "rule_irena_ally"})),
                   conds=[{"type": "flag", "flag": "lissa_saved"}]),
            choice("Что вы будете делать, если Ход остановится?",
                   sec(line("Половина Нижнего города не переживёт зиму. Я это знаю — и всё равно "
                            "хочу остановить. Потому что дальше счёт будет только расти: "
                            "по человеку за зиму. Так мы все станем расходом."))),
            choice("Покажите, где у Хода предохранитель.",
                   sec(line("Обходной патрубок в машинном зале. Откроешь его — Ход начнёт "
                            "греться сам: медленнее и на треть слабее. Город выживет, "
                            "если научится экономить."),
                       eff({"type": "fire_rule", "rule": "rule_irena_bypass"})),
                   conds=[flag("met_irena")]),
            choice("В штреке я нашёл вкладыш. Номер партии — с цеха.",
                   sec(line("Знаю. Я видела наряды. Восемь вкладышей, восемь имён, "
                            "и ни одного с верхней террасы."),
                       eff({"type": "fire_rule", "rule": "rule_irena_implant"})),
                   conds=[flag("implant_found")]),
            choice("«Тихая» больше не придёт за нами.",
                   sec(line("Значит, ты её остановил. Хорошо. У Дирекции таких не так много."),
                       eff({"type": "fire_rule", "rule": "rule_irena_quiet"})),
                   conds=[flag("quiet_defeated")]),
            choice("До встречи."),
        ], goto="end"),
    ],
}

# --- Боссар ---------------------------------------------------------------
BOSSAR = {
    "version": 2, "label": "Боссар, бригадир ям",
    "nodes": [
        node("main", "У отвала", [
            sec(line("Инспектор. Бумага тут не ходит — ходит железо. "
                     "Чего надо, говори прямо."),
                conds=[flag("deep_pass", not_=True), flag("bossar_met", not_=True)]),
            sec(line("Вернулся, значит. Не помёр в штреке — уже неплохо. "
                     "Что теперь надо, бумажный человек?"),
                conds=[flag("deep_pass", not_=True), flag("bossar_met")]),
            sec(line("Пропуск у тебя. Штрек за решёткой, решётка за краном. "
                     "Только не забудь, кто тебя пустил."),
                conds=[flag("deep_pass")]),
        ], [
            choice("Мне нужен Глубокий штрек. Плачу пятнадцать.",
                   sec(line("Пятнадцать — цена для ревизии. Хорошо: жестянка с клеймом твоя."),
                       eff({"type": "fire_rule", "rule": "rule_bossar_paid"})),
                   conds=[has("item_silver", 15), flag("deep_pass", not_=True)]),
            choice("Дай допуск в долг.",
                   sec(line("В долг? Люблю. Тогда слушай: вернёшься и отдашь — "
                            "или я пришлю человека с ключом."),
                       eff({"type": "fire_rule", "rule": "rule_bossar_debt"})),
                   conds=[flag("deep_pass", not_=True)]),
            choice("Люди из ям пропадают. Ты их продаёшь?",
                   sec(line("Ты думаешь, я тут Дирекция? Я бригадир. Я людей не отдаю — "
                            "их забирают. Приходят ночью, с печатью, и предлагают выбор: "
                            "человек или вся бригада без хлеба."),
                       line("Я выбираю бригаду. Это плохой выбор, инспектор. Но он мой."),
                       eff({"type": "unlock_codex", "entry": "codex_directorate"}),
                       eff({"type": "fire_rule", "rule": "rule_bossar_supply"}))),
            choice("Что вы знаете про Гарна?",
                   sec(line("Ходил тут. Задавал вопросы. Я ему сказал то же, что и тебе: "
                            "не лезь в штрек один. Он полез."),
                       eff({"type": "fire_rule", "rule": "rule_bossar_garn"}))),
            choice("Отойди с дороги.",
                   sec(line("Значит, по-плохому. Ну, инспектор, ты сам выбрал."),
                       eff({"type": "fire_rule", "rule": "rule_bossar_fight"})),
                   conds=[flag("deep_pass", not_=True)]),
            choice("Кто из твоих видел «Тихую»?",
                   sec(line("Трое. Один теперь пьёт, двое пропали. Поговори с пьющим: "
                            "он у Марты, под столом, второй месяц не работает."),
                       eff({"type": "fire_rule", "rule": "rule_bossar_quiet"})),
                   conds=[flag("bossar_met")]),
            choice("Отдай бумаги, которые Гарн оставил у тебя.",
                   sec(line("Ничего у меня нет. Что не сдал на участке — то в штреке, "
                            "под рогожей у третьей крепи. Если не растащили."),
                       eff({"type": "fire_rule", "rule": "rule_bossar_ledger_hint"})),
                   conds=[flag("case_taken")]),
            choice("Пока, бригадир."),
        ], goto="end"),
    ],
}

# --- Лисса ----------------------------------------------------------------
LISSA = {
    "version": 2, "label": "Лисса, подмастерье",
    "nodes": [
        node("main", "Дверной проём", [
            sec(line("Не кричите, пожалуйста. Я вас вижу, а вы меня нет — так и надо."),
                line("Я Лисса. Я собирала вкладыши. Я не знала, для чего они, "
                     "пока не увидела, как уводят Тэна и Мирту…"),
                conds=[flag("lissa_found", not_=True)]),
            sec(line("Вы вернулись. Я думала, все возвращаются только в виде бумаг."),
                conds=[flag("lissa_found")]),
        ], [
            choice("Расскажи, что ты видела.",
                   sec(line("Партию вкладышей заказывали на восемь человек. Восьмой ещё "
                            "не выбран, но номер уже выбит. Я видела список: "
                            "двое из бригады, один бездомный и я."),
                       line("Последнюю строку вычеркнули и вписали «медянка». Это я."),
                       eff({"type": "fire_rule", "rule": "rule_lissa_calm"})),
                   conds=[flag("lissa_found", not_=True)]),
            choice("Я укрою тебя у Ирены.",
                   sec(line("Ирена… она меня выгонит. Она всех выгоняет."),
                       line("Хорошо. Хорошо. Я пойду к ней."),
                       eff({"type": "fire_rule", "rule": "rule_lissa_saved"})),
                   conds=[flag("met_irena"), flag("lissa_saved", not_=True)]),
            choice("Уходи из города сама, сегодня.",
                   sec(line("Куда? За воротами пепел и ни одной корчмы. "
                            "Но здесь я тоже не доживу…"),
                       eff({"type": "fire_rule", "rule": "rule_lissa_abandoned"})),
                   conds=[flag("lissa_found"), flag("lissa_saved", not_=True),
                          flag("lissa_lost", not_=True)]),
            choice("Кто приходит вниз за людьми?",
                   sec(line("Серая. Плащ, капюшон, шагов не слышно. Дирекция называет их "
                            "«тихой стражей», а Марта говорит: «тихие»."),
                       eff({"type": "unlock_codex", "entry": "codex_quiet"}))),
            choice("Назови имена. Тех, кого увели.",
                   sec(line("Тэн, Мирта, Слепой Ерш и Малый. Четвёртой должна была быть я."),
                       eff({"type": "fire_rule", "rule": "rule_lissa_names"})),
                   conds=[flag("lissa_found")]),
            choice("Как выглядит «Тихая»?",
                   sec(line("Как человек. Только идёт без шагов, и лицо такое, будто она "
                            "уже всё про себя решила."),
                       eff({"type": "fire_rule", "rule": "rule_lissa_quiet"})),
                   conds=[flag("lissa_found")]),
            choice("Прощай, Лисса."),
        ], goto="end"),
    ],
}

# --- «Тихая» --------------------------------------------------------------
QUIET = {
    "version": 2, "label": "«Тихая»",
    "nodes": [
        node("main", "Тёмный штрек", [
            sec(line("Уходи. Я подожду наверху.")),
        ], [
            choice("Кто тебя послал?",
                   sec(line("Тот, кто подписывает бумаги. Тот же, кто подписал бумагу на тебя."),
                       line("Я не спорю с бумагами. Я их исполняю."),
                       eff({"type": "fire_rule", "rule": "rule_quiet_talk"}))),
            choice("Кого ты уже убила?",
                   sec(line("Всех, кого подписали. Гарна — не я: его привели мёртвым. "
                            "Мне приказали найти бумаги, а не человека."),
                       eff({"type": "fire_rule", "rule": "rule_quiet_garn"})),
                   conds=[flag("ledger_taken")]),
            choice("Я уйду.",
                   sec(line("Хорошо. Считай, что тебя не было."),
                       eff({"type": "fire_rule", "rule": "rule_quiet_let_go"}))),
            choice("Тогда здесь.",
                   sec(line("Здесь. Так даже честнее."),
                       eff({"type": "fire_rule", "rule": "rule_quiet_fight"}))),
            choice("(молчать и уходить)"),
        ], goto="end"),
    ],
}

# --- Валент Корр ----------------------------------------------------------
VALENT = {
    "version": 2, "label": "Управляющий Валент Корр",
    "nodes": [
        node("main", "Сердце Хода", [
            sec(line("Инспектор. Вы быстро — быстрее Гарна. Он сначала месяц "
                     "читал бумаги и только потом спустился."),
                eff({"type": "fire_rule", "rule": "rule_valent_met"}),
                conds=[flag("valent_met", not_=True)]),
            sec(line("Он просил у меня список. Я дал. Он спросил, кто будет восьмым. "
                     "Я не ответил, и он полез в штрек сам."),
                conds=[flag("valent_met")]),
            sec(line("Ход стоит на красной черте. Через восемь часов встанут трубы, "
                     "через сутки — вода, через двое — террасы. "
                     "У вас есть бумаги, у меня есть решение."),
                conds=[flag("ledger_taken")]),
        ], [
            choice("Дело известно. Гроссбух, вкладыш и свидетель.",
                   sec(line("…Свидетель. Медянка, стало быть, жива. Что ж. "
                            "Тогда у меня к вам последняя просьба: сделайте всё по форме. "
                            "Я не буду мешать."),
                       eff({"type": "fire_rule", "rule": "rule_choice_truth"})),
                   conds=[flag("ledger_taken"), flag("implant_found"), flag("lissa_saved"),
                          flag("truth_exposed", not_=True)]),
            choice("Кто должен стать восьмым?",
                   sec(line("Никто. Вот в чём беда: восьмой должен быть никем. "
                            "Сирота, пропавший, должник. Человек, которого город "
                            "не станет искать."))),
            choice("Я встану в ложе сам.",
                   sec(line("Понимаете ли вы, что это значит? Три зимы, потом — "
                            "мокрые трубки и латунь в суставах."),
                       line("…Хорошо. Город будет вам обязан, и никто из них не узнает, кому."),
                       eff({"type": "fire_rule", "rule": "rule_choice_conductor"})),
                   conds=[flag("hod_spoken"), flag("became_conductor", not_=True)]),
            choice("Я уйду из города с гроссбухом.",
                   sec(line("Уйдёте — и Ревизия закроет дело по моей бумаге. "
                            "Город останется тёплым, а правда уедет в вашей сумке."),
                       eff({"type": "fire_rule", "rule": "rule_choice_flee"})),
                   conds=[flag("ledger_taken"), flag("fled_with_ledger", not_=True)]),
            choice("Сколько стоит молчание?",
                   sec(line("Сорок марок сверх сметы и место в верхней террасе. "
                            "Дело Гарна станет несчастным случаем, и все будут спать спокойно."),
                       line("Включая вас, инспектор. Особенно вас — у вас же руки в ржави."),
                       eff({"type": "fire_rule", "rule": "rule_choice_deal"}),
                       eff({"type": "set_description", "entity": "npc_valent",
                            "text": "Управляющий Валент Корр. Дело закрыто, и он снова спокоен."}))),
            choice("У меня вкладыш с номером. Партию подписали вы.",
                   sec(line("Подписал. Каждую зиму подписываю и каждую зиму ненавижу себя "
                            "на одну ночь больше."),
                       line("Это ничего не меняет, инспектор. Город тёплый. Спросите тех, "
                            "кто не замёрз."),
                       eff({"type": "fire_rule", "rule": "rule_valent_implant"})),
                   conds=[flag("implant_found")]),
            choice("«Тихая» не придёт.",
                   sec(line("Значит, вы её сломали. Замена есть, но зима короткая — "
                            "и, пожалуй, я рад, что это вы, а не Гарн."),
                       eff({"type": "fire_rule", "rule": "rule_valent_quiet"})),
                   conds=[flag("quiet_defeated")]),
            choice("Мне нужно подумать."),
        ], goto="end"),
    ],
}

# --- Голос в трубах -------------------------------------------------------
HOD = {
    "version": 2, "label": "Голос в трубах",
    "nodes": [
        node("main", "Трубы", [
            sec(line("…имя. Скажи имя."),
                line("Я держу имена плохо. Держу обороты, давление и тепло. Имена — это у людей.")),
        ], [
            choice("Что ты такое?",
                   sec(line("То, что греет воду и поднимает руду. Меня поставили здесь до города; "
                            "город вырос вокруг, как накипь."),
                       line("Я помню восемь. Седьмой держался три зимы и просил воды. "
                            "Он умер, и вода стала холодной."),
                       eff({"type": "fire_rule", "rule": "rule_hod_spoken"}))),
            choice("Что случилось с Гарном?",
                   sec(line("Он спускался четыре раза. В четвёртый — читал бумаги, "
                            "которые ему не следовало читать."),
                       line("Его привели ко мне уже мёртвым: смотреть, подходит ли тело. "
                            "Тело не подошло."),
                       eff({"type": "fire_rule", "rule": "rule_hod_garn"}))),
            choice("Чем платит город за тепло?",
                   sec(line("Всегда одинаково. Теплом чужого человека. "
                            "Я не выбираю — выбирают те, кто подписывает."),
                       line("Если хочешь остановить меня — есть обходной патрубок. "
                            "Открой его, и я буду греться сам. Медленнее, но честно."))),
            choice("Покажи, что ты помнишь.",
                   sec(line("Смотри. Только держись за трубу — а то упадёшь."),
                       eff({"type": "fire_rule", "rule": "rule_hod_vision"}))),
            choice("Молчать."),
        ], goto="end"),
    ],
}


import re as _re

# Варианты-«прощания» всегда закрывают разговор: иначе игрок остаётся в хабе.
_GOODBYE = _re.compile(r"^(До встречи|Пока|Прощай|Мне нужно подумать|Молчать|"
                       r"\(молчать|Отойди с дороги|Уходи из города)")


def _normalize_exits():
    for doc in DIALOGUES.values():
        for node_ in doc["nodes"]:
            for c in node_.get("choices", []):
                if c.get("goto", "stay") == "stay" and _GOODBYE.match(c["text"]):
                    c["goto"] = "end"


DIALOGUES = {
    "guard": GUARD,
    "vein": VEIN,
    "sergeant": SERGEANT,
    "medic": MEDIC,
    "marta": MARTA,
    "irena": IRENA,
    "bossar": BOSSAR,
    "lissa": LISSA,
    "quiet": QUIET,
    "valent": VALENT,
    "hod": HOD,
}

_normalize_exits()
