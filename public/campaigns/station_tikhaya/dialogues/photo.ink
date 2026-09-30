EXTERNAL set_flag(f)
EXTERNAL change_need(id, d)

=== main ===
~ set_flag("saw_photo")
~ change_need("need_grief", 4)
Трое на мосту: ты, Лена, Борис. Лето, которое казалось бесконечным. У Лены в волосах листок.
-> main_hub

=== main_hub ===
+ [Убрать фото.]
    -> DONE
- -> main_hub
