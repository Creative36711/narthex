#!/usr/bin/env python3
import json, os, sys, glob
from jsonschema import Draft202012Validator
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMA = os.path.join(ROOT,"__chronicle_ai__","campaign.schema.json")
MOD = {"scenes":"SceneDef","entities":"EntityDef","rules":"RuleDef","arenas":"ArenaDef",
       "quests":"QuestDef","cutscenes":"CutsceneDef","recipes":"RecipeDef","codex":"CodexEntryDef","encounters":"EncounterFileDef"}
ROOTF = {"campaign.json":"CampaignMeta","world.json":"WorldDef","manifest.json":"CampaignManifest"}
def lj(p):
    with open(p,encoding="utf-8") as f: return json.load(f)
def v(inst, did, sch, errs, rel):
    sub = {"$ref":f"#/$defs/{did}","$defs":sch["$defs"]}
    for e in Draft202012Validator(sub).iter_errors(inst):
        loc = "/".join(str(p) for p in e.absolute_path) or "(root)"
        errs.append(f"{rel} :: {loc}: {e.message}")
def main():
    sch = lj(SCHEMA); m = lj(os.path.join(ROOT,"manifest.json"))
    errs=[]; warns=[]; fc=0
    for fn,did in ROOTF.items():
        p=os.path.join(ROOT,fn)
        if not os.path.exists(p): errs.append(f"{fn}: missing"); continue
        fc+=1; v(lj(p),did,sch,errs,fn)
    for key,did in MOD.items():
        for n in m.get(key,[]):
            rel=f"{key}/{os.path.basename(n)}"; p=os.path.join(ROOT,rel)
            if not os.path.exists(p): errs.append(f"{rel}: missing"); continue
            fc+=1
            try: v(lj(p),did,sch,errs,rel)
            except Exception as e: errs.append(f"{rel}: bad json: {e}")
    for n in m.get("dialogues",[]):
        stem=n[:-4] if n.endswith(".ink") else n
        rel=f"dialogues/{stem}.ink"
        if not os.path.exists(os.path.join(ROOT,rel)): errs.append(f"{rel}: missing ink")
        else: fc+=1
        import re as _re
        for _f in (rel, f"dialogues/{stem}.dlg.json"):
            _p=os.path.join(ROOT,_f)
            if os.path.exists(_p):
                for _v in set(_re.findall(r'assets/voice/[\w\-]+\.mp3', open(_p,encoding='utf-8').read())):
                    if not os.path.exists(os.path.join(ROOT,_v)): errs.append(f"{_f}: нет озвучки {_v}")
        dj=os.path.join(ROOT,f"dialogues/{stem}.dlg.json")
        if os.path.exists(dj):
            fc+=1
            try: v(lj(dj),"DlgDoc",sch,errs,f"dialogues/{stem}.dlg.json")
            except Exception as e: errs.append(f"dialogues/{stem}.dlg.json: bad json: {e}")
    # media
    SKIP=("sfx_","bgm_","mus_","amb_","snd_","@","http:","https:","#")
    MK={"image","sprite","icon","sound","portrait","combat_figure","scene_sprite","title_art","frame","background_image","audio","voice"}
    refs=[]
    def walk(o):
        if isinstance(o,dict):
            for k,vv in o.items():
                if k in MK and isinstance(vv,str) and not any(vv.startswith(p) for p in SKIP): refs.append(vv)
                walk(vv)
        elif isinstance(o,list):
            for x in o: walk(x)
    for key in MOD:
        for n in m.get(key,[]):
            p=os.path.join(ROOT,key,os.path.basename(n))
            if os.path.exists(p):
                try: walk(lj(p))
                except: pass
    for fn in ROOTF:
        p=os.path.join(ROOT,fn)
        if os.path.exists(p):
            try: walk(lj(p))
            except: pass
    seen=set(); miss=0
    for r in refs:
        if r in seen: continue
        seen.add(r)
        if not os.path.exists(os.path.join(ROOT,r)):
            errs.append(f"медиа не найдено: {r}"); miss+=1
    # png transparency audit for sprites/figs/title/frame
    from PIL import Image
    def audit(path,rel,kind):
        try: im=Image.open(path)
        except: warns.append(f"{rel}: не открывается"); return
        if im.mode!="RGBA":
            warns.append(f"{rel} ({kind}): нет альфа (mode={im.mode})"); return
        a=im.getchannel("A"); ex=a.getextrema()
        if ex[0]!=0: warns.append(f"{rel} ({kind}): alpha min={ex[0]}≠0")
        tot=a.size[0]*a.size[1]
        # tobytes() вместо getdata(): последний помечен deprecated (Pillow 14)
        t=sum(1 for x in a.tobytes() if x<128)/tot*100
        if t<20: warns.append(f"{rel} ({kind}): мало прозрачных ({t:.1f}%)")
        if kind=="combat_figure":
            w,h=im.size; r=h/w
            if r>1.7: warns.append(f"{rel} ({kind}): h/w={r:.2f} — не top-down")
    for pat in ("assets/**/sprite_*.png","assets/**/fig_*.png"):
        for f in glob.glob(pat,recursive=True):
            audit(f,f,"sprite" if "/sprite_" in f else "combat_figure")
    # тема оформления живёт внутри campaign.json (поле theme), а не в theme.json —
    # раньше этот блок молча пропускался, потому что файла theme.json нет (аудит 2026-10)
    th=lj(os.path.join(ROOT,"campaign.json")).get("theme") or {}
    menu=th.get("menu") or {}
    v2=menu.get("title_art")
    if v2 and v2.endswith(".png") and os.path.exists(os.path.join(ROOT,v2)):
        audit(os.path.join(ROOT,v2),v2,"title_art")
    fr=th.get("frame") or {}; v3=fr.get("image")
    if v3 and v3.endswith(".png") and os.path.exists(os.path.join(ROOT,v3)):
        audit(os.path.join(ROOT,v3),v3,"frame")
    # флаги реестра с описаниями живут в campaign.json.flags (список {id,label,description}) —
    # meta.json никогда не существовало в этом формате (аудит 2026-10)
    for fdef in (lj(os.path.join(ROOT,"campaign.json")).get("flags") or []):
        if isinstance(fdef,dict) and not fdef.get("description"):
            warns.append(f"campaign.flags.{fdef.get('id','?')}: нет description")
    # главы: каждое поле chapter должно ссылаться на объявленную главу
    try:
        _c=lj(os.path.join(ROOT,"campaign.json")); _ch={x["id"] for x in _c.get("chapters",[])}
        for _k in ("rules","scenes","quests","cutscenes"):
            for _f in glob.glob(os.path.join(ROOT,_k,"*.json")):
                _ci=lj(_f).get("chapter")
                if _ci and _ci not in _ch: errs.append(f"{_k}/{os.path.basename(_f)}: неизвестная глава {_ci}")
    except Exception as e: warns.append(f"проверка глав: {e}")
    # честный счётчик (аудит 2026-10): проверка покрывает ССЫЛКИ на медиа,
    # а не файлы на диске. Разница — запасные/неподключённые файлы: движок их
    # не удаляет и лимитов размера не накладывает (политика «без лимитов»).
    disk_media=sum(len(files) for _r,_dn,files in os.walk(os.path.join(ROOT,"assets")))
    print(f"Файлов: {fc}, медиа-ссылок упомянуто: {len(seen)} (проверено покрытие ссылок; файлов на диске в assets/: {disk_media}), отсутствует: {miss}")
    print(f"\nERRORS: {len(errs)}")
    for e in errs[:80]: print(f"  ✗ {e}")
    print(f"\nWARNINGS: {len(warns)}")
    for w in warns[:50]: print(f"  ! {w}")
    if errs: print(f"\n❌ {len(errs)} errors"); return 1
    print("\n✓ OK"); return 0
if __name__=="__main__": sys.exit(main())
