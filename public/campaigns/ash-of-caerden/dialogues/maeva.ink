EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL item_count(id)
EXTERNAL remove_item(id, n)
EXTERNAL add_item(id, n)
EXTERNAL change_need(id, d)
EXTERNAL advance_time(t)

=== main ===
{ get_flag("met_maeva"):
    С возвращением. Похлёбка горячая, комната свободна. # emotion: neutral
- else:
    ~ set_flag("met_maeva")
    Добро пожаловать в «Дубовый щит», путник. # emotion: happy
    Я Маэва, хозяйка. Кормлю, пою, даю кров. Серебро вперёд — времена нынче худые.
}
У тебя {item_count("item_silver")} марок серебром.
+ { item_count("item_silver") >= 5 } [Похлёбку и кружку эля. (5 марок, 1 ч)]
    ~ remove_item("item_silver", 5)
    ~ change_need("hunger", 50)
    ~ change_need("thirst", 30)
    ~ advance_time(1)
    Садись к огню. # emotion: happy
    Похлёбка густая, эль тёмный. Час пролетает незаметно, и жизнь кажется чуть добрее.
    -> main
+ { item_count("item_silver") >= 10 } [Комнату на ночь. (10 марок, сон 8 ч)]
    ~ remove_item("item_silver", 10)
    ~ advance_time(8)
    ~ change_need("energy", 100)
    Вторая дверь наверху. Бельё чистое, клопов нет — не таверна, а сказка. # emotion: happy
    Вы просыпаетесь отдохнувшим. Правда, желудок успел проголодаться, а во рту пересохло.
    -> main
* [Какие слухи ходят?]
    Все только о банде с холмов и говорят. # emotion: neutral
    Бран на рынке потерял два каравана. Стража носа за ворота не кажет. А по вечерам сюда заходит Алдрик — стражник с ворот. Спроси его, если хочешь подробностей.
    -> main
* [Мне пора.]
    Заглядывай. Очаг тут не гаснет. # emotion: happy
    -> DONE
+ { item_count("item_silver") < 5 } [У меня нет и пяти марок...]
    Сочувствую, но в долг не наливаю. # emotion: neutral
    Заработай — говорят, Бран ищет крепких людей.
    -> main
