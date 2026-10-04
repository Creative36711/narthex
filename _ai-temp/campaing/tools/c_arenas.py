"""Арены боёв: гексовые поля с разметкой."""

ARENAS = {}


def arena(ident, label, cols, rows, hex_size, blocked, difficult, player, enemy,
          cover=None, music="music_battle", ambient=None):
    a = {
        "id": ident, "label": label, "image": "",
        "hex_grid": {"cols": cols, "rows": rows, "hex_size": hex_size,
                     "offset": "odd-r", "blocked_hexes": blocked,
                     "difficult_terrain": difficult},
        "spawn_zones": {"player": {"hexes": player}, "enemy": {"hexes": enemy}},
        "music": music,
    }
    if cover:
        a["hex_grid"]["cover_hexes"] = cover
    if ambient:
        a["ambient_audio"] = ambient
    return a


def grid_block(cols, rows, cells):
    return [[c, r] for c, r in cells]


ARENAS["arena_yard"] = arena(
    "arena_yard", "Пропускной двор (бой)", 12, 8, 40,
    blocked=grid_block(12, 8, [(5, 0), (5, 1), (5, 6), (5, 7), (6, 3), (6, 4)]),
    difficult=grid_block(12, 8, [(3, 3), (3, 4), (8, 2)]),
    player=grid_block(12, 8, [(0, 1), (0, 2), (0, 3), (0, 4), (0, 5)]),
    enemy=grid_block(12, 8, [(11, 1), (11, 2), (11, 3), (11, 4), (11, 5)]),
    cover=grid_block(12, 8, [(1, 2), (10, 4)]),
    ambient="snd_ash_wind",
)

ARENAS["arena_forge"] = arena(
    "arena_forge", "Медная литейная (бой)", 12, 8, 40,
    blocked=grid_block(12, 8, [(1, 0), (1, 1), (1, 6), (1, 7), (4, 3), (4, 4), (7, 3), (7, 4)]),
    difficult=grid_block(12, 8, [(2, 3), (2, 4), (5, 2), (5, 5), (8, 3), (8, 4)]),
    player=grid_block(12, 8, [(0, 2), (0, 3), (0, 4)]),
    enemy=grid_block(12, 8, [(11, 2), (11, 3), (11, 4), (10, 1), (10, 5)]),
    cover=grid_block(12, 8, [(3, 2), (6, 5), (9, 3)]),
    ambient="snd_boiler",
)

ARENAS["arena_tunnels"] = arena(
    "arena_tunnels", "Трубы Окалин (бой)", 14, 6, 40,
    blocked=grid_block(14, 6, [(0, 0), (0, 5), (3, 0), (3, 5), (7, 0), (7, 5), (11, 0), (11, 5),
                               (13, 0), (13, 5)]),
    difficult=grid_block(14, 6, [(5, 1), (5, 4), (9, 1), (9, 4)]),
    player=grid_block(14, 6, [(0, 1), (0, 2), (0, 3), (0, 4)]),
    enemy=grid_block(14, 6, [(13, 1), (13, 2), (13, 3), (13, 4)]),
    cover=grid_block(14, 6, [(6, 2), (6, 3), (10, 2)]),
    ambient="sfx_water",
)

ARENAS["arena_core"] = arena(
    "arena_core", "Глубинное зало (бой)", 14, 8, 40,
    blocked=grid_block(14, 8, [(4, 0), (4, 7), (9, 0), (9, 7), (2, 3), (2, 4)]),
    difficult=grid_block(14, 8, [(5, 3), (5, 4), (6, 2), (6, 5), (10, 3), (10, 4)]),
    player=grid_block(14, 8, [(0, 2), (0, 3), (0, 4), (1, 1), (1, 5)]),
    enemy=grid_block(14, 8, [(13, 2), (13, 3), (13, 4), (12, 1), (12, 5)]),
    cover=grid_block(14, 8, [(3, 1), (3, 6), (8, 3), (8, 4), (11, 2)]),
    ambient="sfx_heart",
)


def build_arenas():
    return ARENAS
