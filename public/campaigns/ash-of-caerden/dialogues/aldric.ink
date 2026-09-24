EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL add_item(id, n)
EXTERNAL skill_check(s, d)
EXTERNAL get_disposition(t)
EXTERNAL join_party(id)
EXTERNAL in_party(id)
EXTERNAL quest_stage(q)

=== first_meeting ===
Стой, путник. # emotion: neutral
Немногие нынче добираются до Каэрдена по тракту. Дороги кишат бандитами. С чем пожаловал?
* [Ищу работу. Слышал, у вас неспокойно.]
    Неспокойно — мягко сказано. # emotion: angry
    Банда с холмов грабит караваны уже третью неделю. Торговцы воют, склады пустеют.
    ~ set_flag("heard_about_bandits")
    Если ищешь монету за работу мечом — поговори с торговцем Браном на рынке. Он пострадал больше всех.
* [Просто путник. Переночую и дальше.]
    Тогда тебе в «Дубовый щит», это за рынком. # emotion: neutral
    Хозяйка Маэва дерёт недорого, а похлёбка у неё лучшая в долине.
- Ворота открыты до заката. Ночью в город не пускаем — приказ капитана.
Да, и вот ещё: вода в бочке у стены — бесплатная. Пей, сколько влезет.
-> DONE

=== main ===
{ get_flag("heard_about_bandits"):
    А, это снова ты. # emotion: neutral
    Про бандитов новостей нет. Караван из Вельдена так и не пришёл.
- else:
    Стой... а, это ты. Проходи. # emotion: neutral
}
-> hub

=== hub ===
* [Расскажи о городе.]
    Каэрден — перекрёсток трёх трактов. Был богат, пока дороги были чисты. # emotion: neutral
    Рынок — прямо за воротами. Таверна «Дубовый щит» — дальше по улице. В лес на западе без нужды не ходи.
* { not get_flag("heard_about_bandits") } [Что тут у вас происходит?]
    Банда с холмов душит торговлю. Третью неделю ни один караван не дошёл. # emotion: angry
    ~ set_flag("heard_about_bandits")
    Поговори с Браном на рынке, если хочешь заработать на этом мечом.
* { quest_stage("quest_bandit_threat") != "" && quest_stage("quest_bandit_threat") != "completed_fight" && quest_stage("quest_bandit_threat") != "completed_deal" && not in_party("npc_guard_aldric") } [Пойдёшь со мной против банды Йорека?]
    { get_disposition("faction_town_guard") >= 10:
        Алдрик долго смотрит на вас, потом сплёвывает и снимает щит со спины. # emotion: happy # action
        А, пропади оно всё. Капитан всё равно носа за стены не кажет. Идём — только чур, махать мечом в полную силу.
        ~ join_party("npc_guard_aldric")
        -> DONE
    - else:
        Я тебя второй день знаю, а ты меня — в самое пекло зовёшь. # emotion: neutral
        Докажи, что ты не пустозвон: помоги городу — тогда и поговорим. Стража ценит дела, не слова.
    }
* { not get_flag("aldric_gave_ration") } [Поделишься едой, служивый? (Убеждение)]
    ~ temp r = skill_check("persuade", 40)
    { r == "fail" || r == "fumble":
        Я тебе не богадельня. Иди к Маэве, у неё похлёбка за пять марок. # emotion: angry
    - else:
        Эх... ладно. Держи, у меня в караулке ещё остался паёк. # emotion: happy
        ~ set_flag("aldric_gave_ration")
        ~ add_item("item_bread", 1)
        Только не болтай, а то вся голытьба сбежится.
    }
+ [Бывай.]
    Смотри в оба на дорогах. # emotion: neutral
    -> DONE
- -> hub
