"""Мини-валидатор JSON-Schema (подмножество, достаточное для campaign.schema.json)."""
import json

SCHEMA = json.load(open("/home/user/campaign-1/__chronicle_ai__/campaign.schema.json"))
DEFS = SCHEMA["$defs"]


class V:
    def __init__(self):
        self.errors = []

    def err(self, path, msg):
        self.errors.append("%s: %s" % (path, msg))

    def resolve(self, sch):
        seen = 0
        while "$ref" in sch and seen < 20:
            ref = sch["$ref"].split("/")[-1]
            sch = DEFS[ref]
            seen += 1
        return sch

    def check(self, inst, sch, path=""):
        sch = self.resolve(sch)
        if "oneOf" in sch:
            self.one_of(inst, sch["oneOf"], path, "oneOf")
            return
        if "anyOf" in sch:
            self.one_of(inst, sch["anyOf"], path, "anyOf")
            return
        if "allOf" in sch:
            for s in sch["allOf"]:
                self.check(inst, s, path)
        t = sch.get("type")
        if isinstance(t, list):
            if not any(self.is_type(inst, x) for x in t):
                self.err(path, "expected %s got %s" % (t, type(inst).__name__))
                return
            t = None
        if t and not self.is_type(inst, t):
            self.err(path, "expected %s got %r" % (t, inst if isinstance(inst, (str, int, float, bool, type(None))) else type(inst).__name__))
            return
        if "enum" in sch and inst not in sch["enum"]:
            self.err(path, "value %r not in enum %s" % (inst, str(sch["enum"])[:200]))
        if "const" in sch and inst != sch["const"]:
            self.err(path, "expected const %r" % (sch["const"],))
        if isinstance(inst, str) and "pattern" in sch:
            import re
            if not re.search(sch["pattern"], inst):
                self.err(path, "pattern mismatch %s" % sch["pattern"])
        if isinstance(inst, dict):
            props = sch.get("properties", {})
            for r in sch.get("required", []):
                if r not in inst:
                    self.err(path, "missing required '%s'" % r)
            for k, v in inst.items():
                if k in props:
                    self.check(v, props[k], path + "." + k)
                elif sch.get("additionalProperties") is False:
                    self.err(path, "additional property '%s'" % k)
                elif isinstance(sch.get("additionalProperties"), dict):
                    self.check(v, sch["additionalProperties"], path + "." + k)
        if isinstance(inst, list) and "items" in sch:
            for i, v in enumerate(inst):
                self.check(v, sch["items"], "%s[%d]" % (path, i))

    def is_type(self, inst, t):
        return {
            "object": isinstance(inst, dict), "array": isinstance(inst, list),
            "string": isinstance(inst, str), "number": isinstance(inst, (int, float)) and not isinstance(inst, bool),
            "integer": isinstance(inst, int) and not isinstance(inst, bool),
            "boolean": isinstance(inst, bool), "null": inst is None,
        }.get(t, True)

    def one_of(self, inst, options, path, kind):
        best = None
        best_cnt = 10 ** 9
        for opt in options:
            sub = V()
            sub.check(inst, opt, path)
            if not sub.errors:
                return
            if len(sub.errors) < best_cnt:
                best_cnt = len(sub.errors)
                best = sub
        detail = "; ".join(best.errors[:4]) if best else "?"
        self.errors.append("%s: no %s variant matched (%d errors in closest: %s)" % (path, kind, best_cnt, detail))


def validate(inst, defname, path=""):
    v = V()
    v.check(inst, {"$ref": "#/$defs/" + defname}, path)
    return v.errors


if __name__ == "__main__":
    import sys
    print("defs:", len(DEFS))
