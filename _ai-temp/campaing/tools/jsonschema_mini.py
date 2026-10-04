"""Минимальный валидатор JSON Schema (нужное подмножество) — без внешних зависимостей."""

import json
import os


class Errors:
    def __init__(self):
        self.items = []

    def add(self, path, msg):
        self.items.append(f"{path}: {msg}")

    def __bool__(self):
        return bool(self.items)


def _type_ok(value, t):
    if t == "object":
        return isinstance(value, dict)
    if t == "array":
        return isinstance(value, list)
    if t == "string":
        return isinstance(value, str)
    if t == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if t == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if t == "boolean":
        return isinstance(value, bool)
    if t == "null":
        return value is None
    return True


def validate(value, schema, root, errs, path="$"):
    if "$ref" in schema:
        ref = schema["$ref"]
        assert ref.startswith("#/$defs/"), ref
        target = root["$defs"][ref.split("/")[-1]]
        return validate(value, target, root, errs, path)

    if "const" in schema and value != schema["const"]:
        errs.add(path, f"должно быть {schema['const']!r}, получено {value!r}")
        return
    if "enum" in schema and value not in schema["enum"]:
        errs.add(path, f"значение {value!r} вне перечня {schema['enum']}")
        return

    t = schema.get("type")
    if t:
        types = t if isinstance(t, list) else [t]
        if not any(_type_ok(value, tt) for tt in types):
            errs.add(path, f"ожидался тип {t}, получено {type(value).__name__}")
            return

    if "anyOf" in schema:
        sub = Errors()
        for s in schema["anyOf"]:
            e2 = Errors()
            validate(value, s, root, e2, path)
            if not e2:
                sub = None
                break
            sub.items.extend(e2.items)
        if sub is not None:
            # пробуем по одному варианту, чтобы сообщение было короче
            errs.add(path, "не подошло ни одному из anyOf: " + "; ".join(sub.items[:4]))
        return
    if "oneOf" in schema:
        ok = 0
        msgs = []
        for s in schema["oneOf"]:
            e2 = Errors()
            validate(value, s, root, e2, path)
            if not e2:
                ok += 1
            else:
                msgs.extend(e2.items)
        if ok == 0:
            errs.add(path, "не подошло ни одному из oneOf: " + "; ".join(msgs[:5]))
        elif ok > 1:
            errs.add(path, f"подошло под {ok} варианта oneOf (должен быть ровно один)")
        return

    if isinstance(value, dict):
        for req in schema.get("required", []):
            if req not in value:
                errs.add(path, f"нет обязательного поля '{req}'")
        props = schema.get("properties", {})
        for k, v in value.items():
            if k in props:
                validate(v, props[k], root, errs, f"{path}.{k}")
            else:
                ap = schema.get("additionalProperties", True)
                if ap is False:
                    errs.add(path, f"лишнее поле '{k}'")
                elif isinstance(ap, dict):
                    validate(v, ap, root, errs, f"{path}.{k}")
    elif isinstance(value, list):
        if "prefixItems" in schema:
            pi = schema["prefixItems"]
            for i, (v, s) in enumerate(zip(value, pi)):
                validate(v, s, root, errs, f"{path}[{i}]")
            if len(value) < len(pi):
                errs.add(path, f"ожидалось минимум {len(pi)} элементов")
        if "items" in schema:
            s = schema["items"]
            for i, v in enumerate(value[len(schema.get("prefixItems", [])):]):
                validate(v, s, root, errs, f"{path}[{i}]")
        if "minItems" in schema and len(value) < schema["minItems"]:
            errs.add(path, f"слишком короткий список ({len(value)} < {schema['minItems']})")
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            errs.add(path, f"слишком длинный список ({len(value)} > {schema['maxItems']})")


def validate_doc(doc, schema, root=None):
    errs = Errors()
    validate(doc, schema, root or schema, errs, "$")
    return errs.items
