EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL item_count(id)
EXTERNAL remove_item(id, n)
EXTERNAL add_item(id, n)
EXTERNAL change_need(id, d)
EXTERNAL advance_time(t)
EXTERNAL fire_rule(id)
EXTERNAL sleep(t)

=== main ===
{ get_flag("rats_done") && not get_flag("rats_rewarded"):
    ~ set_flag("rats_rewarded")
    Ты разобрался с крысами?! Дай расцелую! # emotion: happy
    ~ add_item("item_bread", 3)
    ~ add_item("item_waterskin", 2)
    Держи: хлеб и вода в дорогу — за мой счёт. И считай, что похлёбка для тебя теперь всегда горячая.
}
{ get_flag("met_maeva"):
    С возвращением. Похлёбка горячая, комната свободна. # emotion: neutral
- else:
    ~ set_flag("met_maeva")
    Добро пожаловать в «Дубовый щит», путник. # emotion: happy
    Я Маэва, хозяйка. Кормлю, пою, даю кров. Серебро вперёд — времена нынче худые.
}
У тебя {item_count("item_silver")} марок серебром.
-> hub

=== hub ===
+ { item_count("item_silver") >= 5 } [Похлёбку и кружку эля. (5 марок, 1 ч)]
    ~ remove_item("item_silver", 5)
    ~ change_need("hunger", 50)
    ~ change_need("thirst", 30)
    ~ advance_time(1)
    Садись к огню. # emotion: happy
    Похлёбка густая, эль тёмный. Час пролетает незаметно, и жизнь кажется чуть добрее. # action
    -> hub
+ { item_count("item_silver") >= 10 } [Комнату на ночь. (10 марок, сон 8 ч)]
    ~ remove_item("item_silver", 10)
    ~ sleep(8)
    ~ change_need("energy", 100)
    Вторая дверь наверху. Бельё чистое, клопов нет — не таверна, а сказка. # emotion: happy
    Вы просыпаетесь отдохнувшим. Правда, желудок успел проголодаться, а во рту пересохло. # action
    -> hub
* { not get_flag("rats_started") } [Слышал, у тебя какая-то беда в подвале?]
    Беда? Погибель! Крысы. Да какие — с собаку ростом! # emotion: neutral
    Прогрызли бочку с элем, тащат припасы. Спуститься сама боюсь, а стража за крыс браться не желает.
    Разберёшься — накормлю до отвала и в дороге не оставлю. Ну что, возьмёшься?
    + + [Веди в подвал. (бой)]
        ~ set_flag("rats_started")
        Вот люк, вот лестница. Осторожнее там! # emotion: happy
        ~ fire_rule("encounter_cellar_rats")
        -> DONE
    + + [Крысы? Нет уж, уволь.]
        Эх... А с виду такой храбрец. # emotion: neutral
        -> hub
+ { get_flag("rats_started") && not get_flag("rats_done") } [Про крыс помню, ещё вернусь к ним.]
    Уж пожалуйста. Они там эль пьют, между прочим. Мой эль! # emotion: neutral
    + + [Спускаюсь в подвал прямо сейчас. (бой)]
        ~ fire_rule("encounter_cellar_rats")
        -> DONE
    + + [Позже.]
        -> hub
* [Какие слухи ходят?]
    Все только о банде с холмов и говорят. # emotion: neutral
    Бран на рынке потерял два каравана. Стража носа за ворота не кажет. А по вечерам сюда заходит Алдрик — стражник с ворот. Спроси его, если хочешь подробностей.
    -> hub
+ [Мне пора.]
    Заглядывай. Очаг тут не гаснет. # emotion: happy
    -> DONE
+ { item_count("item_silver") < 5 } [У меня нет и пяти марок...]
    Сочувствую, но в долг не наливаю. # emotion: neutral
    Заработай — говорят, Бран ищет крепких людей.
    -> hub
