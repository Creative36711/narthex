"""Мир: регион Котла, карта примитивами и локации с дорогами."""

from common import art, layer, rect, ell, poly, line, text, grad, CANVAS_W, CANVAS_H


def map_art():
    L = []
    L.append(layer("небо над картой", rect(0, 0, CANVAS_W, 130, grad("#1b1a19", "#2a2622", 90))))
    L.append(layer("река", poly([0, 620, 250, 560, 520, 640, 820, 600, 1120, 660, 1280, 620,
                                 1280, 720, 0, 720], grad("#20303a", "#16222a", 90))))
    L.append(layer("берег", poly([0, 600, 260, 540, 520, 620, 820, 580, 1120, 640, 1280, 600,
                                  1280, 630, 1120, 672, 820, 612, 520, 652, 260, 572, 0, 632],
                                 "#3a3228", opacity=0.6)))
    L.append(layer("стена города", ell(640, 340, 470, 285, "#2e2823", opacity=0.55)))
    L.append(layer("стена", ell(640, 340, 452, 268, "#4a4038", opacity=0.55)))
    L.append(layer("кварталы", poly([430, 250, 700, 200, 800, 320, 560, 390], "#544a3d", opacity=0.5)))
    L.append(layer("литейный квартал", poly([520, 150, 760, 190, 700, 300, 480, 250], "#6a5236", opacity=0.45)))
    L.append(layer("слобода", poly([300, 330, 470, 260, 560, 400, 380, 470], "#5d5244", opacity=0.45)))
    L.append(layer("рынок", poly([560, 400, 800, 330, 880, 470, 640, 520], "#63553f", opacity=0.4)))
    L.append(layer("карантин", poly([900, 470, 1090, 430, 1140, 560, 950, 590], "#4e463c", opacity=0.5)))
    L.append(layer("окалины", poly([210, 150, 420, 120, 470, 280, 300, 320, 190, 250], "#3f3a33", opacity=0.55)))
    for i in range(9):
        x = 300 + i * 80
        L.append(layer("труба", line(x, 470 - (i % 3) * 12, x + 60, 300 + (i % 4) * 20,
                                      "#6b5a41", 5, opacity=0.5)))
    for i in range(7):
        y = 470 + i * 22
        L.append(layer("дым", line(980 - i * 10, y, 1140 + i * 8, y - 60, "#7b7a74", 4, opacity=0.25)))
    L.append(layer("подпись квартала", text(560, 250, "ЛИТЕЙНЫЙ КВАРТАЛ", 22, "#d9c9a8", "middle", bold=True, opacity=0.85)))
    L.append(layer("подпись квартала", text(392, 380, "СЛОБОДА", 20, "#cfc0a0", "middle", opacity=0.8)))
    L.append(layer("подпись квартала", text(720, 440, "РЫНОК", 20, "#cfc0a0", "middle", opacity=0.8)))
    L.append(layer("подпись квартала", text(1010, 528, "КАРАНТИН", 20, "#cfc0a0", "middle", opacity=0.8)))
    L.append(layer("подпись квартала", text(320, 216, "ОКАЛИНЫ", 20, "#bfb2a0", "middle", opacity=0.8)))
    L.append(layer("подпись реки", text(180, 690, "река Окалина", 18, "#7f9aa8", "middle", italic=True, opacity=0.9)))
    L.append(layer("ворота", rect(160, 452, 54, 40, "#8a6a3a", radius=4)))
    L.append(layer("ворота, створки", line(187, 452, 187, 492, "#2a2118", 3)))
    L.append(layer("подпись ворот", text(187, 528, "Пропускной двор", 17, "#cbb995", "middle", opacity=0.85)))
    L.append(layer("часовня", poly([820, 150, 860, 120, 900, 150, 900, 196, 820, 196], "#6d5c44")))
    L.append(layer("подпись часовни", text(860, 226, "Остывшее Пламя", 17, "#cbb995", "middle", opacity=0.85)))
    L.append(layer("башня", rect(374, 546, 52, 40, "#5f5446", radius=3)))
    L.append(layer("подпись башни", text(400, 616, "Водонапорная башня", 17, "#cbb995", "middle", opacity=0.85)))
    L.append(layer("пустошь", poly([1040, 240, 1280, 190, 1280, 520, 1040, 470], "#4b4239", opacity=0.5)))
    L.append(layer("подпись пустоши", text(1120, 290, "Пепельная\nпустошь", 18, "#a99a83", "middle", italic=True, opacity=0.9)))
    return art("#151312", *L)


def C(to, ticks, requirements=None, table=None):
    c = {"to": to, "cost_ticks": ticks}
    if requirements:
        c["requirements"] = requirements
    if table:
        c["random_encounter_table"] = table
    return c


def build_world():
    return {"regions": [{
        "id": "region_cauldron",
        "label": "Котёл",
        "map_image": "",
        "map_art": map_art(),
        "map_size": {"w": CANVAS_W, "h": CANVAS_H},
        "parent_region": None,
        "locations": [
            {
                "id": "loc_passcourt", "label": "Пропускной двор",
                "position": {"x": 200, "y": 470},
                "travel_connections": [
                    C("loc_copperyard", 1), C("loc_market", 2), C("loc_pumphouse", 2),
                    C("loc_ashflats", 2, table="enc_routes"),
                ],
                "scenes": ["scene_passcourt"], "arrival_scene": "scene_passcourt",
                "ambient": ["sfx_metal_step"],
                "music": [{"tracks": ["music_city"], "conditions": []}],
            },
            {
                "id": "loc_copperyard", "label": "Медный цех",
                "position": {"x": 430, "y": 300},
                "travel_connections": [
                    C("loc_passcourt", 1), C("loc_market", 1), C("loc_chapel", 2),
                    C("loc_okaliny", 2, table="enc_tunnels"),
                ],
                "scenes": ["scene_forgehall", "scene_drains"],
                "arrival_scene": "scene_forgehall",
                "ambient": ["sfx_boiler"],
                "music": [{"tracks": ["music_forge"], "conditions": []}],
            },
            {
                "id": "loc_market", "label": "Ржавый рынок",
                "position": {"x": 660, "y": 460},
                "travel_connections": [
                    C("loc_passcourt", 2), C("loc_copperyard", 1), C("loc_tavern", 1),
                    C("loc_sloboda", 2), C("loc_quarantine", 2), C("loc_pumphouse", 2),
                ],
                "scenes": ["scene_market", "scene_marketback"],
                "arrival_scene": "scene_market",
                "ambient": ["sfx_click"],
                "music": [{"tracks": ["music_market"], "conditions": []}],
            },
            {
                "id": "loc_tavern", "label": "Корчма «Тёплый шов»",
                "position": {"x": 850, "y": 400},
                "travel_connections": [
                    C("loc_market", 1), C("loc_sloboda", 1), C("loc_quarantine", 2),
                ],
                "scenes": ["scene_tavern", "scene_room"], "arrival_scene": "scene_tavern",
                "ambient": ["sfx_boiler"],
                "music": [{"tracks": ["music_tavern"], "conditions": []}],
            },
            {
                "id": "loc_sloboda", "label": "Литейная слобода",
                "position": {"x": 620, "y": 250},
                "travel_connections": [
                    C("loc_market", 2), C("loc_tavern", 1), C("loc_chapel", 2),
                    C("loc_okaliny", 3, table="enc_routes"),
                ],
                "scenes": ["scene_sloboda", "scene_gnat_hut"], "arrival_scene": "scene_sloboda",
                "ambient": ["sfx_metal_step"],
                "music": [{"tracks": ["music_city"], "conditions": []}],
            },
            {
                "id": "loc_quarantine", "label": "Карантинный барак",
                "position": {"x": 990, "y": 520},
                "travel_connections": [
                    C("loc_market", 2), C("loc_tavern", 2), C("loc_ashflats", 3, table="enc_flats"),
                ],
                "scenes": ["scene_quarantine"], "arrival_scene": "scene_quarantine",
                "ambient": ["sfx_boiler"],
                "music": [{"tracks": ["music_chapel"], "conditions": []}],
            },
            {
                "id": "loc_chapel", "label": "Часовня Остывшего Пламени",
                "position": {"x": 860, "y": 180},
                "travel_connections": [
                    C("loc_sloboda", 2), C("loc_copperyard", 2),
                    C("loc_deeps", 2, requirements=[{"type": "flag_set", "flag": "deep_gate_open"}]),
                ],
                "scenes": ["scene_chapel", "scene_crypt"], "arrival_scene": "scene_chapel",
                "ambient": ["sfx_whisper"],
                "music": [{"tracks": ["music_chapel"], "conditions": []}],
            },
            {
                "id": "loc_pumphouse", "label": "Водонапорная башня",
                "position": {"x": 400, "y": 570},
                "travel_connections": [
                    C("loc_passcourt", 2), C("loc_market", 2), C("loc_okaliny", 2),
                ],
                "scenes": ["scene_pumphouse"], "arrival_scene": "scene_pumphouse",
                "ambient": ["sfx_water"],
                "music": [{"tracks": ["music_forge"], "conditions": []}],
            },
            {
                "id": "loc_okaliny", "label": "Окалины",
                "position": {"x": 300, "y": 170},
                "travel_connections": [
                    C("loc_copperyard", 2, table="enc_tunnels"),
                    C("loc_sloboda", 3, table="enc_routes"),
                    C("loc_pumphouse", 2),
                ],
                "scenes": ["scene_tunnels"], "arrival_scene": "scene_tunnels",
                "ambient": ["sfx_boiler"],
                "music": [{"tracks": ["music_tunnels"], "conditions": []}],
            },
            {
                "id": "loc_ashflats", "label": "Пепельная пустошь",
                "position": {"x": 1140, "y": 330},
                "travel_connections": [
                    C("loc_passcourt", 2, table="enc_flats"),
                    C("loc_quarantine", 3, table="enc_flats"),
                ],
                "scenes": ["scene_ashflats"], "arrival_scene": "scene_ashflats",
                "camp": True, "ambient": ["sfx_ash_wind"],
                "music": [{"tracks": ["music_tunnels"], "conditions": []}],
            },
            {
                "id": "loc_deeps", "label": "Глубинное зало",
                "position": {"x": 700, "y": 620}, "hidden": True,
                "travel_connections": [C("loc_chapel", 2)],
                "scenes": ["scene_deepcore"], "arrival_scene": "scene_deepcore",
                "ambient": ["sfx_heart"],
                "music": [{"tracks": ["music_deep"], "conditions": []}],
            },
        ],
    }]}
