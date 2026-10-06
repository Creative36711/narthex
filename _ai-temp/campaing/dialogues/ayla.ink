EXTERNAL change_disposition(a0, a1)
EXTERNAL change_hp(a0)
EXTERNAL get_flag(a0)
EXTERNAL has_status(a0)
EXTERNAL item_count(a0)
EXTERNAL open_trade(a0)
EXTERNAL remove_item(a0, a1)
EXTERNAL remove_status(a0)
EXTERNAL set_description(a0, a1)
EXTERNAL set_flag(a0)
EXTERNAL unlock_recipe(a0)

=== Начало ===
Айла промокает бинт и не смотрит на твои руки. # action
Сядь. У тебя ссадина на костяшках и вид человека, который не спал двое суток. # voice: assets/voice/ayla_1.mp3
-> Начало_hub

=== Начало_hub ===
+ { item_count("item_mark") >= 10 } [Перевяжи меня (10 марок).]
    Держи. Не дёргайся: я режу ровно, но больно. # emotion: calm
    ~ remove_item("item_mark", 10)
    ~ change_hp(14)
    -> Начало_hub
+ { has_status("status_rot") and item_count("item_mark") >= 30 } [Убери гнилец (30 марок).]
    Отвар горький. Гнилец горше. Глотай, не нюхай. # emotion: calm
    ~ remove_item("item_mark", 30)
    ~ remove_status("status_rot")
    ~ change_hp(4)
    -> Начало_hub
* { not (get_flag("ayla_recipe")) } [Научи готовить настой.]
    Рецепт простой, как всё, что спасает жизнь: трава, вода и терпение. # emotion: calm
    ~ unlock_recipe("recipe_tonic")
    ~ set_flag("ayla_recipe")
    ~ change_disposition("npc_ayla", 10)
    -> Начало_hub
+ [Ты знала стража Ярова?]
Яров? Приходил за бинтами тринадцатого, вечером. Уходил не один — со стражей. # emotion: thoughtful # voice: assets/voice/ayla_2.mp3
    Сказал: «затвор закрывать». Я спросила: «а люди?» Он не ответил. # voice: assets/voice/ayla_3.mp3
    ~ set_description("npc_ayla", "Лекарь Сухого ряда. Знает, кто уходил закрывать затвор — и кто не вернулся.")
    -> Начало_hub
+ [Торговать.]
    Бери, что нужно. И оставь себе на воду — воды всегда нужно больше. # emotion: calm
    ~ open_trade("npc_ayla")
    -> DONE
+ [Пока.]
    -> DONE
- -> Начало_hub
