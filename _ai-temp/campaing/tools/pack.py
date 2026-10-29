#!/usr/bin/env python3
import json, os, sys, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT,"campaign-1.chronicle")
def main():
    m=json.load(open(os.path.join(ROOT,"manifest.json"),encoding="utf-8"))
    files=["campaign.json","world.json","manifest.json"]
    for x in ("meta.json","theme.json","characters.json"):
        if os.path.exists(os.path.join(ROOT,x)): files.append(x)
    if os.path.isdir(os.path.join(ROOT,"config")):
        for n in sorted(os.listdir(os.path.join(ROOT,"config"))):
            if n.endswith(".json"): files.append(f"config/{n}")
    MOD={"scenes":"scenes","entities":"entities","rules":"rules","arenas":"arenas","quests":"quests",
         "cutscenes":"cutscenes","recipes":"recipes","codex":"codex","encounters":"encounters"}
    missing=[]
    for key,sub in MOD.items():
        for n in m.get(key,[]):
            c=os.path.join(sub,os.path.basename(n))
            if os.path.exists(os.path.join(ROOT,c)): files.append(c)
            else: missing.append(c)
    for n in m.get("dialogues",[]):
        stem=n[:-4] if n.endswith(".ink") else n
        c=f"dialogues/{stem}.ink"
        if os.path.exists(os.path.join(ROOT,c)): files.append(c)
        else: missing.append(c)
        cj=f"dialogues/{stem}.dlg.json"
        if os.path.exists(os.path.join(ROOT,cj)): files.append(cj)
    for base,_,names in os.walk(os.path.join(ROOT,"assets")):
        for n in sorted(names):
            files.append(os.path.relpath(os.path.join(base,n),ROOT))
    files=sorted(set(files))
    if missing: print("MISSING:",missing); return 1
    if os.path.exists(OUT): os.remove(OUT)
    with zipfile.ZipFile(OUT,"w",zipfile.ZIP_DEFLATED) as z:
        for rel in files: z.write(os.path.join(ROOT,rel),rel.replace(os.sep,"/"))
    sz=os.path.getsize(OUT); print(f"✓ campaign-1.chronicle: {len(files)} файлов, {sz/1048576:.2f} МБ"); return 0
if __name__=="__main__": sys.exit(main())
