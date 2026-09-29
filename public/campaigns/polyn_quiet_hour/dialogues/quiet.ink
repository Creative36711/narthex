EXTERNAL change_need(id, d)
EXTERNAL set_flag(f)
EXTERNAL fire_rule(id)
EXTERNAL apply_status(id, dur)

=== main ===
Он не идёт. Он стоит там, где ты оставил свет: в конце коридора, лицом к шкафу, спиной к тебе, и держит в руке обходной журнал без обложек. # action
Он не оборачивается. Он ждёт, что ты сам назовёшь причину своего шума. На это у тебя ровно столько, сколько нужно, чтобы не дышать.
-> main_hub

=== main_hub ===
+ [Лечь на пол, закрыть глаза, не дышать.]
    ~ set_flag("flag_quiet_obeyed")
    ~ change_need("need_noise", -35)
    ~ fire_rule("rule_bridge_calm")
    -> DONE
+ [Сказать вслух: «я не твой дежурный».]
    ~ apply_status("status_numbed", 10)
    ~ change_need("need_nerve", -20)
    ~ fire_rule("rule_bridge_scare")
    -> DONE
+ [Встать и пойти ему навстречу.]
    ~ fire_rule("rule_catch_take")
    -> DONE
- -> main_hub
