EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL game_over_victory(m)

=== main ===
{ not get_flag("stone_match_started"):
    Три раунда. В начале каждого у вас две искры энергии и три карты: «Щит» стоит одну, «Выпад» — одну, «Тяжёлый удар» — две. Смотритель раскрывает намерение до вашего выбора. Наберите пять очков, чтобы взять корону. # action
    ~ set_flag("stone_match_started")
}
{ get_flag("stone_r3_done"):
    -> finale
}
{ get_flag("stone_r2_done"):
    -> round_three
}
{ get_flag("stone_r1_done"):
    -> round_two
}
-> round_one
-> DONE

=== round_one ===
Ход 1 из 3. Смотритель поднимает тяжёлый молот: следующий удар будет сокрушительным.
-> round_one_hub

=== round_one_hub ===
* [Карта «Щит» — закрыть тяжёлый удар (1 энергия).]
    Щит принимает удар. Каменная кромка звенит, но ваша фишка остаётся на поле. # action
    ~ set_flag("stone_r1_high")
    ~ set_flag("stone_r1_done")
    -> round_two
* [Карта «Выпад» — проверить его замах (1 энергия).]
    Вы успеваете задеть рукав, но молот всё же раскалывает край вашей фишки. # action
    ~ set_flag("stone_r1_mid")
    ~ set_flag("stone_r1_done")
    -> round_two
* [Карта «Тяжёлый удар» — перебить замах (2 энергии).]
    Вы бьёте первыми, однако Смотритель уже держит оборону. Очко уходит ему. # action
    ~ set_flag("stone_r1_zero")
    ~ set_flag("stone_r1_done")
    -> round_two
+ [Закончить разговор.]
    -> DONE
- -> round_one_hub

=== round_two ===
Ход 2 из 3. Смотритель прячет руку за каменной пластиной: ждёт прямой атаки.
-> round_two_hub

=== round_two_hub ===
* [Карта «Выпад» — обмануть защиту (1 энергия).]
    Короткий выпад проходит под щитом. Вы забираете темп и очко. # action
    ~ set_flag("stone_r2_high")
    ~ set_flag("stone_r2_done")
    -> round_three
* [Карта «Щит» — выждать и сохранить позицию (1 энергия).]
    Вы не поддаётесь на приманку. Смотритель вынужден первым открыть линию атаки. # action
    ~ set_flag("stone_r2_mid")
    ~ set_flag("stone_r2_done")
    -> round_three
* [Карта «Тяжёлый удар» — вложить обе искры в силовой ход (2 энергии).]
    Пластина гасит удар. Смотритель получает очко, но его стойка становится предсказуемой. # action
    ~ set_flag("stone_r2_zero")
    ~ set_flag("stone_r2_done")
    -> round_three
+ [Закончить разговор.]
    -> DONE
- -> round_two_hub

=== round_three ===
Ход 3 из 3. Смотритель показывает финт, затем переводит клинок к открытой стороне стола.
-> round_three_hub

=== round_three_hub ===
* [Карта «Тяжёлый удар» — наказать открытый фланг (2 энергии).]
    Вы не покупаетесь на финт и ставите последнюю карту точно в открывшееся окно. # action
    ~ set_flag("stone_r3_high")
    ~ set_flag("stone_r3_done")
    -> finale
* [Карта «Щит» — переждать финт и удержать стол (1 энергия).]
    Вы закрываете линию клинка, но упускаете шанс на решающий удар. # action
    ~ set_flag("stone_r3_mid")
    ~ set_flag("stone_r3_done")
    -> finale
* [Карта «Выпад» — ответить на первый жест (1 энергия).]
    Смотритель уводит клинок в сторону. Последнее очко остаётся за ним. # action
    ~ set_flag("stone_r3_zero")
    ~ set_flag("stone_r3_done")
    -> finale
+ [Закончить разговор.]
    -> DONE
- -> round_three_hub

=== finale ===
{ get_flag("stone_r1_high") && get_flag("stone_r2_high") && get_flag("stone_r3_high"):
    ~ set_flag("stone_table_perfect")
    ~ game_over_victory("Партия завершена: 6 из 6, идеальная рука.")
    -> DONE
}
{ get_flag("stone_r1_high") && get_flag("stone_r2_high") && get_flag("stone_r3_mid"):
    ~ set_flag("stone_table_crown")
    ~ game_over_victory("Партия завершена: 5 из 6, корона ваша.")
    -> DONE
}
{ get_flag("stone_r1_high") && get_flag("stone_r2_high") && get_flag("stone_r3_zero"):
    ~ set_flag("stone_table_draw")
    ~ game_over_victory("Партия завершена: 4 из 6, ничья.")
    -> DONE
}
{ get_flag("stone_r1_high") && get_flag("stone_r2_mid") && get_flag("stone_r3_high"):
    ~ set_flag("stone_table_crown")
    ~ game_over_victory("Партия завершена: 5 из 6, корона ваша.")
    -> DONE
}
{ get_flag("stone_r1_high") && get_flag("stone_r2_mid") && get_flag("stone_r3_mid"):
    ~ set_flag("stone_table_draw")
    ~ game_over_victory("Партия завершена: 4 из 6, ничья.")
    -> DONE
}
{ get_flag("stone_r1_high") && get_flag("stone_r2_mid") && get_flag("stone_r3_zero"):
    ~ set_flag("stone_table_draw")
    ~ game_over_victory("Партия завершена: 3 из 6, ничья.")
    -> DONE
}
{ get_flag("stone_r1_high") && get_flag("stone_r2_zero") && get_flag("stone_r3_high"):
    ~ set_flag("stone_table_draw")
    ~ game_over_victory("Партия завершена: 4 из 6, ничья.")
    -> DONE
}
{ get_flag("stone_r1_high") && get_flag("stone_r2_zero") && get_flag("stone_r3_mid"):
    ~ set_flag("stone_table_draw")
    ~ game_over_victory("Партия завершена: 3 из 6, ничья.")
    -> DONE
}
{ get_flag("stone_r1_high") && get_flag("stone_r2_zero") && get_flag("stone_r3_zero"):
    ~ set_flag("stone_table_lesson")
    ~ game_over_victory("Партия завершена: 2 из 6, Смотритель взял последнюю руку.")
    -> DONE
}
{ get_flag("stone_r1_mid") && get_flag("stone_r2_high") && get_flag("stone_r3_high"):
    ~ set_flag("stone_table_crown")
    ~ game_over_victory("Партия завершена: 5 из 6, корона ваша.")
    -> DONE
}
{ get_flag("stone_r1_mid") && get_flag("stone_r2_high") && get_flag("stone_r3_mid"):
    ~ set_flag("stone_table_draw")
    ~ game_over_victory("Партия завершена: 4 из 6, ничья.")
    -> DONE
}
{ get_flag("stone_r1_mid") && get_flag("stone_r2_high") && get_flag("stone_r3_zero"):
    ~ set_flag("stone_table_draw")
    ~ game_over_victory("Партия завершена: 3 из 6, ничья.")
    -> DONE
}
{ get_flag("stone_r1_mid") && get_flag("stone_r2_mid") && get_flag("stone_r3_high"):
    ~ set_flag("stone_table_draw")
    ~ game_over_victory("Партия завершена: 4 из 6, ничья.")
    -> DONE
}
{ get_flag("stone_r1_mid") && get_flag("stone_r2_mid") && get_flag("stone_r3_mid"):
    ~ set_flag("stone_table_draw")
    ~ game_over_victory("Партия завершена: 3 из 6, ничья.")
    -> DONE
}
{ get_flag("stone_r1_mid") && get_flag("stone_r2_mid") && get_flag("stone_r3_zero"):
    ~ set_flag("stone_table_lesson")
    ~ game_over_victory("Партия завершена: 2 из 6, Смотритель взял последнюю руку.")
    -> DONE
}
{ get_flag("stone_r1_mid") && get_flag("stone_r2_zero") && get_flag("stone_r3_high"):
    ~ set_flag("stone_table_draw")
    ~ game_over_victory("Партия завершена: 3 из 6, ничья.")
    -> DONE
}
{ get_flag("stone_r1_mid") && get_flag("stone_r2_zero") && get_flag("stone_r3_mid"):
    ~ set_flag("stone_table_lesson")
    ~ game_over_victory("Партия завершена: 2 из 6, Смотритель взял последнюю руку.")
    -> DONE
}
{ get_flag("stone_r1_mid") && get_flag("stone_r2_zero") && get_flag("stone_r3_zero"):
    ~ set_flag("stone_table_lesson")
    ~ game_over_victory("Партия завершена: 1 из 6, Смотритель взял последнюю руку.")
    -> DONE
}
{ get_flag("stone_r1_zero") && get_flag("stone_r2_high") && get_flag("stone_r3_high"):
    ~ set_flag("stone_table_draw")
    ~ game_over_victory("Партия завершена: 4 из 6, ничья.")
    -> DONE
}
{ get_flag("stone_r1_zero") && get_flag("stone_r2_high") && get_flag("stone_r3_mid"):
    ~ set_flag("stone_table_draw")
    ~ game_over_victory("Партия завершена: 3 из 6, ничья.")
    -> DONE
}
{ get_flag("stone_r1_zero") && get_flag("stone_r2_high") && get_flag("stone_r3_zero"):
    ~ set_flag("stone_table_lesson")
    ~ game_over_victory("Партия завершена: 2 из 6, Смотритель взял последнюю руку.")
    -> DONE
}
{ get_flag("stone_r1_zero") && get_flag("stone_r2_mid") && get_flag("stone_r3_high"):
    ~ set_flag("stone_table_draw")
    ~ game_over_victory("Партия завершена: 3 из 6, ничья.")
    -> DONE
}
{ get_flag("stone_r1_zero") && get_flag("stone_r2_mid") && get_flag("stone_r3_mid"):
    ~ set_flag("stone_table_lesson")
    ~ game_over_victory("Партия завершена: 2 из 6, Смотритель взял последнюю руку.")
    -> DONE
}
{ get_flag("stone_r1_zero") && get_flag("stone_r2_mid") && get_flag("stone_r3_zero"):
    ~ set_flag("stone_table_lesson")
    ~ game_over_victory("Партия завершена: 1 из 6, Смотритель взял последнюю руку.")
    -> DONE
}
{ get_flag("stone_r1_zero") && get_flag("stone_r2_zero") && get_flag("stone_r3_high"):
    ~ set_flag("stone_table_lesson")
    ~ game_over_victory("Партия завершена: 2 из 6, Смотритель взял последнюю руку.")
    -> DONE
}
{ get_flag("stone_r1_zero") && get_flag("stone_r2_zero") && get_flag("stone_r3_mid"):
    ~ set_flag("stone_table_lesson")
    ~ game_over_victory("Партия завершена: 1 из 6, Смотритель взял последнюю руку.")
    -> DONE
}
{ get_flag("stone_r1_zero") && get_flag("stone_r2_zero") && get_flag("stone_r3_zero"):
    ~ set_flag("stone_table_lesson")
    ~ game_over_victory("Партия завершена: 0 из 6, Смотритель взял последнюю руку.")
    -> DONE
}
-> DONE
