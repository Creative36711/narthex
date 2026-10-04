// Сера Дольная — дознавательница Литаой Курии.
EXTERNAL get_player_name()
EXTERNAL set_flag(f)
EXTERNAL get_flag(f)
EXTERNAL change_disposition(t, d)
EXTERNAL set_entity_state(e, s)
EXTERNAL set_description(e, t)
EXTERNAL fire_rule(r)
EXTERNAL change_need(n, d)
EXTERNAL get_disposition(t)
EXTERNAL start_quest(q)

=== main ===
{ get_flag("body_examined"): -> body_talk }
{ get_flag("case_taken"): -> wait_talk }
Сера не оборачивается, когда открывается дверь. Она смотрит на тело так, будто ждёт, что оно заговорит первым. # action
~ set_entity_state("npc_sera", "tired")
— {get_player_name()}. Мне сказали, что ты умеешь читать тела, а не только бумаги. Хорошо. Читай.
-> main_hub

=== main_hub ===
* [Что здесь случилось?]
    — Четвёртое тело за три недели. Все — работники Цеха, все — с вычеркнутым долгом, все — без крови и без масла.
    — Первых трёх записали в угарные списки. Я подписывала. Теперь вот стою и подписывать больше не хочу.
    ~ change_need("need_nerve", -3)
    -> main_hub
+ [Почему этим занимаюсь я, а не стража?]
    — Стража умеет только оцеплять. Курия умеет только подписывать. А ты пока никому не должен.
    — Кроме, может быть, Векселя. У всех в этом городе долг у Векселя.
    -> main_hub
+ [Кто он был?]
    — Тарн, бригадир ночной смены. Сорок лет, жена, дочь. Долг — двенадцать марок. Из-за двенадцати марок, {get_player_name()}.
    ~ change_need("need_nerve", -2)
    -> main_hub
+ { not (get_flag("case_taken")) } [Я возьмусь.]
    ~ set_flag("case_taken")
    ~ set_flag("met_sera")
    ~ start_quest("quest_silent_plague")
    ~ change_disposition("npc_sera", 10)
    ~ set_description("npc_sera", "Дознавательница Курии. Работает с героем по делу о тихом море и впервые не уверена, что дело закроется бумагой.")
    — Только не пиши «угар». Ни в отчёте, ни во сне. Понял?
    — Тело осмотри сам. Я смотрела — у меня глаз замылился.
    -> DONE
+ [Позже.]
    — Иди. Только помни: тела не ждут.
    -> DONE
- -> main_hub

=== wait_talk ===
— Тело всё ещё там, {get_player_name()}. Латунь не выветрится, но и след не станет свежее.
-> wait_hub

=== wait_hub ===
+ [Что ты уже знаешь о смертях?]
    — Одинаково: ночь, работа, ни следов борьбы. Латунь в позвонках — и всё, что было в человеке, уходит.
    -> wait_hub
+ { get_disposition("npc_sera") >= 20 } [Как ты сама держишься?]
    ~ set_entity_state("npc_sera", "tired")
    — Плохо. Двенадцать лет закрываю чужие дела, и впервые мне кажется, что дело закроет меня.
    ~ change_disposition("npc_sera", 5)
    ~ change_need("need_nerve", 4)
    -> wait_hub
+ [Пойду смотреть тело.]
    -> DONE
- -> wait_hub

=== body_talk ===
~ set_entity_state("npc_sera", "thinking")
— Ну? Что показала спина?
-> body_hub

=== body_hub ===
* { get_flag("brass_found") } [Латунь. Две вставки в позвонках.]
    ~ set_entity_state("npc_sera", "angry")
    — Две?.. Значит, не угар и не случай. Покажи их Клепе: она в карантинном бараке, она разбирается в составах лучше любого мастера.
    ~ change_disposition("npc_sera", 5)
    — И к Векселю зайди. Тарн был должен ему — как и все остальные. Ростовщик знает имена пропавших лучше, чем Курия.
    ~ set_flag("ledger_known")
    -> body_hub
+ { not (get_flag("brass_found")) } [Ничего особенного, обычное тело.]
    — Тогда иди и посмотри ещё раз. «Обычные» тела не лежат в цеху лицом в шлак.
    -> body_hub
* { get_flag("gnat_saved") } [Свидетель у меня. Подмастерье, его зовут Гнат.]
    — Шпилька? Он же почти ребёнок. Держи его подальше от цеха, {get_player_name()}: он живой, пока его не нашли.
    -> body_hub
* { get_flag("gnat_dead") } [Свидетель погиб.]
    ~ set_entity_state("npc_sera", "tired")
    — Вот так. Дело ещё не открыто, а человек уже в списке угарных.
    ~ change_need("need_nerve", -4)
    -> body_hub
* { get_flag("ledger_taken") } [Гроссбух Векселя у меня.]
    — Давай сюда. Курия не простит, но и сама расследовать не станет. С книгой у меня будет бумага, а бумага в этом городе сильнее человека.
    -> ledger_choice
* { get_flag("whisper_heard") } [В трубах говорят.]
    ~ set_entity_state("npc_sera", "scared")
    — Ты… ты тоже слышишь? Я думала, это у меня одной. Три недели в ушах ровный голос, будто кто-то читает список вслух.
    ~ change_disposition("npc_sera", 10)
    ~ change_need("need_nerve", 6)
    — Сходи к Ржаву в часовню. Он один говорит про это без смеха.
    -> body_hub
+ { get_flag("lens_built") } [Я собрал линзу, которая видит шёпотные метки.]
    — Тогда иди в крипту под часовней. И возьми с собой кого-нибудь, кто умеет держать молот. Я — не умею.
    ~ change_disposition("npc_sera", 10)
    -> body_hub
* { get_flag("klein_letter") } [В крипте письмо. Он жив, Сера.]
    ~ set_entity_state("npc_sera", "scared")
    — Двенадцать лет… Я подписывала бумаги о его смерти. Своей рукой.
    — Если он жив, то мёртвых — четыре, и это только те, кого нашли.
    ~ change_disposition("npc_sera", 5)
    ~ change_need("need_nerve", -5)
    -> body_hub
+ [Пока ничего.]
    — Тогда иди. Я ещё раз посмотрю на его спину.
    -> DONE
- -> body_hub

=== ledger_choice ===
+ [Отдай Курии.]
    ~ fire_rule("rule_ledger_ceh")
    — Спасибо. Имена попадут в бумагу, бумага — в дело, а дело — под сукно. Это всё, что я умею.
    -> DONE
+ [Я решу сам.]
    ~ change_disposition("npc_sera", -5)
    — Как хочешь. Только не сжигай годы чужих долгов ради двух минут тепла.
    -> DONE
