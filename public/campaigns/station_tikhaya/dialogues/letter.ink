EXTERNAL set_flag(f)
EXTERNAL change_need(id, d)
EXTERNAL unlock_codex(id)

=== main ===
~ set_flag("read_letter")
~ change_need("need_grief", 8)
~ unlock_codex("codex_letter")
Почерк дрожит к концу страницы. «Не торопись доказывать миру, что уехал. Докажи себе, что умеешь возвращаться».
Внизу — адрес станции. Будто он знал, что письмо найдут именно здесь.
-> main_hub

=== main_hub ===
+ [Сложить письмо.]
    -> DONE
- -> main_hub
