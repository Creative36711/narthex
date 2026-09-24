EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL item_count(id)
EXTERNAL remove_item(id, n)
EXTERNAL add_item(id, n)
EXTERNAL skill_check(s, d)

=== main ===
{ get_flag("met_bran"):
    Снова ты. Подходи, товар нынче — что уцелело. # emotion: neutral
- else:
    ~ set_flag("met_bran")
    Подходи, не стесняйся! Бран, лучшие товары долины... # emotion: happy
    ...точнее, то, что от них осталось. Два моих каравана взяла банда с холмов. Ещё месяц такой торговли — и я пойду по миру.
}
У тебя {item_count("item_silver")} марок серебром.
+ { item_count("item_silver") >= 3 } [Вяленое мясо. (3 марки)]
    ~ remove_item("item_silver", 3)
    ~ add_item("item_dried_meat", 1)
    Добрая солонина, до Вельдена дотянешь. # emotion: happy
    -> main
+ { item_count("item_silver") >= 2 } [Бурдюк с водой. (2 марки)]
    ~ remove_item("item_silver", 2)
    ~ add_item("item_waterskin", 1)
    Полный, только с колодца. # emotion: neutral
    -> main
* { not get_flag("bran_bargained") } [Цены у тебя грабительские. (Торговля)]
    ~ set_flag("bran_bargained")
    ~ temp r = skill_check("bargain", 50)
    { r == "fail" || r == "fumble":
        Грабительские?! Да я себе в убыток торгую! # emotion: neutral
        Иди поищи дешевле — до Вельдена четыре дня пути.
    - else:
        Тьфу, язык у тебя подвешен... Ладно. Держи хлеб сверху, только отстань. # emotion: happy
        ~ add_item("item_bread", 1)
    }
    -> main
* [Что за банда вас грабит?]
    Организованные, со своим главарём — Серым Йореком. # emotion: angry
    Прячутся где-то в Волчьей балке. Стража туда не суётся, а я бы заплатил сотню марок тому, кто избавит долину от этой заразы. Но в одиночку туда идти — верная смерть.
    -> main
* [Удачи в торговле.]
    И тебе дорог без разбойников. # emotion: neutral
    -> DONE
