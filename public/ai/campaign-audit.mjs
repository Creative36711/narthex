#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/shared/migrate.ts
function migrateNeedCondition(c) {
  const any = c;
  switch (any.type) {
    case "in_location": {
      if (Array.isArray(any.locations)) return c;
      const one = any.location ?? any.locations ?? "";
      return { type: "in_location", locations: one ? [one] : [], not: any.not };
    }
    case "has_item":
    case "equipped": {
      if (Array.isArray(any.items)) return c;
      const one = any.item ?? any.items ?? "";
      return { type: any.type, items: one ? [one] : [], not: any.not };
    }
    default:
      return c;
  }
}
function migrateNeedConditions(list) {
  if (!list) return list;
  return list.map(migrateNeedCondition);
}
function migrateMeta(meta) {
  for (const need of meta.needs ?? []) {
    if (need.decay_when) need.decay_when = migrateNeedConditions(need.decay_when);
    if (need.restore_when) need.restore_when = migrateNeedConditions(need.restore_when);
  }
  const cc = meta.char_creation;
  if (cc) {
    if (Array.isArray(cc.allowed_professions)) delete cc.allowed_professions;
    if (!Array.isArray(cc.mandatory_skills)) cc.mandatory_skills = cc.mandatory_skills ? [String(cc.mandatory_skills)] : [];
    if (!Array.isArray(cc.forbidden_skills)) cc.forbidden_skills = cc.forbidden_skills ? [String(cc.forbidden_skills)] : [];
  }
  const legacyBuiltins = [
    { id: "neutral", label: "\u041E\u0431\u044B\u0447\u043D\u044B\u0439" },
    { id: "happy", label: "\u0420\u0430\u0434\u043E\u0441\u0442\u044C" },
    { id: "angry", label: "\u0413\u043D\u0435\u0432" },
    { id: "sad", label: "\u041F\u0435\u0447\u0430\u043B\u044C" },
    { id: "fear", label: "\u0421\u0442\u0440\u0430\u0445" }
  ];
  meta.emotions = (meta.emotions ?? []).filter(
    (e) => !legacyBuiltins.some((b) => b.id === e.id && b.label === e.label)
  );
  return meta;
}
function migrateNavigation(scene, world) {
  let changed = false;
  const out = scene.navigation.map((nav) => {
    const legacy = nav.go_to_location;
    if (!legacy) return nav;
    changed = true;
    const next = { ...nav };
    delete next.go_to_location;
    if (legacy === scene.location) {
      const loc = findLocation(world, legacy);
      const target = loc?.arrival_scene ?? loc?.scenes[0];
      if (target && target !== scene.id) next.go_to_scene = target;
      else next.open_map = true;
    } else {
      next.open_map = true;
    }
    return next;
  });
  if (changed) scene.navigation = out;
  return out;
}
function findLocation(world, id) {
  const walk = (regions) => {
    for (const r of regions) {
      const l = r.locations.find((x) => x.id === id);
      if (l) return l;
      const sub = r.sub_regions ? walk(r.sub_regions) : void 0;
      if (sub) return sub;
    }
    return void 0;
  };
  return walk(world.regions);
}
function allLocations(world) {
  const out = [];
  const walk = (regions) => {
    for (const r of regions) {
      out.push(...r.locations);
      if (r.sub_regions) walk(r.sub_regions);
    }
  };
  walk(world.regions);
  return out;
}
var init_migrate = __esm({
  "src/shared/migrate.ts"() {
  }
});

// src/shared/aiBaseline.ts
function aiDiffSnapshotKey(basePath) {
  return `cf_editor_ai_baseline:${basePath}`;
}
var init_aiBaseline = __esm({
  "src/shared/aiBaseline.ts"() {
  }
});

// src/shared/ruleFiles.ts
function isEncounterFile(obj) {
  return Array.isArray(obj.encounter_tables);
}
function isBareTable(obj) {
  return !("id" in obj) && !("conditions" in obj) && !("effects" in obj) && Array.isArray(obj.entries);
}
function parseRuleFile(file, raw) {
  const warnings = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    warnings.push(`rules/${file}: \u0444\u0430\u0439\u043B \u043D\u0435 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043D\u0438 \u043F\u0440\u0430\u0432\u0438\u043B\u043E\u043C, \u043D\u0438 \u0442\u0430\u0431\u043B\u0438\u0446\u0435\u0439 \u0432\u0441\u0442\u0440\u0435\u0447 \u2014 \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D.`);
    return { kind: "invalid", warnings };
  }
  const obj = raw;
  if (isEncounterFile(obj) || isBareTable(obj)) {
    const tables = isEncounterFile(obj) ? obj.encounter_tables : [obj];
    const clean = tables.filter((t) => !!t && typeof t === "object" && typeof t.id === "string");
    warnings.push(
      `rules/${file}: \u044D\u0442\u043E \u0442\u0430\u0431\u043B\u0438\u0446\u0430 \u0432\u0441\u0442\u0440\u0435\u0447, \u0430 \u043D\u0435 \u043F\u0440\u0430\u0432\u0438\u043B\u043E. \u0422\u0430\u043A\u0438\u0435 \u0444\u0430\u0439\u043B\u044B \u043F\u0435\u0440\u0435\u0447\u0438\u0441\u043B\u044F\u044E\u0442 \u0432 manifest.encounters, \u0430 \u043D\u0435 \u0432 manifest.rules; \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043E \u043A\u0430\u043A \u0432\u0441\u0442\u0440\u0435\u0447${clean.length === 1 ? "\u0430" : clean.length > 1 ? ` (${clean.length})` : ""}.`
    );
    return { kind: "encounters", tables: clean, warnings };
  }
  const rule = raw;
  if (!rule.id || typeof rule.id !== "string") {
    warnings.push(`rules/${file}: \u0443 \u043F\u0440\u0430\u0432\u0438\u043B\u0430 \u043D\u0435\u0442 id \u2014 \u0444\u0430\u0439\u043B \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D (\u0438\u043D\u0430\u0447\u0435 \u043E\u043D \u043F\u043E\u043F\u0430\u043B \u0431\u044B \u0432 \u0440\u0435\u0435\u0441\u0442\u0440 \u043F\u043E\u0434 \u043A\u043B\u044E\u0447\u043E\u043C \xABundefined\xBB).`);
    return { kind: "invalid", warnings };
  }
  if (!Array.isArray(rule.conditions)) {
    warnings.push(`rules/${file}: \u0443 \u043F\u0440\u0430\u0432\u0438\u043B\u0430 \xAB${rule.id}\xBB \u043D\u0435 \u0431\u044B\u043B\u043E \u043C\u0430\u0441\u0441\u0438\u0432\u0430 conditions \u2014 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D \u043F\u0443\u0441\u0442\u044B\u043C.`);
    rule.conditions = [];
  }
  if (!Array.isArray(rule.effects)) {
    warnings.push(`rules/${file}: \u0443 \u043F\u0440\u0430\u0432\u0438\u043B\u0430 \xAB${rule.id}\xBB \u043D\u0435 \u0431\u044B\u043B\u043E \u043C\u0430\u0441\u0441\u0438\u0432\u0430 effects \u2014 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D \u043F\u0443\u0441\u0442\u044B\u043C.`);
    rule.effects = [];
  }
  if (rule.conditions_any !== void 0 && !Array.isArray(rule.conditions_any)) {
    warnings.push(`rules/${file}: \u0443 \u043F\u0440\u0430\u0432\u0438\u043B\u0430 \xAB${rule.id}\xBB conditions_any \u043D\u0435 \u043C\u0430\u0441\u0441\u0438\u0432 \u2014 \u043F\u043E\u043B\u0435 \u043E\u0442\u0431\u0440\u043E\u0448\u0435\u043D\u043E.`);
    delete rule.conditions_any;
  }
  return { kind: "rule", rule, warnings };
}
var init_ruleFiles = __esm({
  "src/shared/ruleFiles.ts"() {
  }
});

// src/shared/versions.ts
function readEngineVersion() {
  if (typeof __CF_ENGINE_VERSION__ === "string" && __CF_ENGINE_VERSION__) return __CF_ENGINE_VERSION__;
  const fromEnv = globalThis.process?.env?.npm_package_version;
  return fromEnv || "0.0.0-dev";
}
function parseVersion(text) {
  const m = /^v?\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?/.exec(String(text ?? "").trim());
  if (!m) return { major: 0, minor: 0, patch: 0 };
  return {
    major: Number(m[1]),
    minor: m[2] === void 0 ? 0 : Number(m[2]),
    patch: m[3] === void 0 ? 0 : Number(m[3]),
    pre: m[4]
  };
}
function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (x.major !== y.major) return x.major < y.major ? -1 : 1;
  if (x.minor !== y.minor) return x.minor < y.minor ? -1 : 1;
  if (x.patch !== y.patch) return x.patch < y.patch ? -1 : 1;
  if (x.pre === y.pre) return 0;
  if (x.pre === void 0) return 1;
  if (y.pre === void 0) return -1;
  return x.pre < y.pre ? -1 : x.pre > y.pre ? 1 : 0;
}
var ENGINE_VERSION;
var init_versions = __esm({
  "src/shared/versions.ts"() {
    ENGINE_VERSION = readEngineVersion();
  }
});

// src/core/loader.ts
function isExternalUrl(path) {
  return /^(?:https?:)?\/\//i.test(path) || /^(?:asset|tauri|ipc):\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:");
}
var init_loader = __esm({
  "src/core/loader.ts"() {
    init_migrate();
    init_ruleFiles();
    init_versions();
  }
});

// src/shared/types.ts
function featureOn(meta, key) {
  return meta.features?.[key] !== false;
}
var DEFAULT_EMOTION;
var init_types = __esm({
  "src/shared/types.ts"() {
    DEFAULT_EMOTION = { id: "neutral", label: "\u041E\u0431\u044B\u0447\u043D\u044B\u0439" };
  }
});

// src/shared/skills.ts
function skillLabel(id, campaignSkills) {
  const fromCampaign = campaignSkills?.find((s) => s.id === id)?.label;
  return fromCampaign ?? BUILTIN_SKILL_LABELS[id] ?? id;
}
var BUILTIN_SKILL_LABELS;
var init_skills = __esm({
  "src/shared/skills.ts"() {
    BUILTIN_SKILL_LABELS = {
      sword: "\u041C\u0435\u0447\u0438",
      axe: "\u0422\u043E\u043F\u043E\u0440\u044B",
      spear: "\u041A\u043E\u043F\u044C\u044F",
      mace: "\u0414\u0440\u043E\u0431\u044F\u0449\u0435\u0435",
      dagger: "\u041A\u0438\u043D\u0436\u0430\u043B\u044B",
      bow: "\u041B\u0443\u043A\u0438",
      crossbow: "\u0410\u0440\u0431\u0430\u043B\u0435\u0442\u044B",
      throw: "\u041C\u0435\u0442\u0430\u043D\u0438\u0435",
      brawl: "\u041A\u0443\u043B\u0430\u0447\u043D\u044B\u0439 \u0431\u043E\u0439",
      shield: "\u0429\u0438\u0442\u044B",
      dodge: "\u0423\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0435",
      stealth: "\u0421\u043A\u0440\u044B\u0442\u043D\u043E\u0441\u0442\u044C",
      spot: "\u041D\u0430\u0431\u043B\u044E\u0434\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C",
      listen: "\u0421\u043B\u0443\u0445",
      search: "\u041E\u0431\u044B\u0441\u043A",
      track: "\u0421\u043B\u0435\u0434\u043E\u043F\u044B\u0442\u0441\u0442\u0432\u043E",
      persuade: "\u0423\u0431\u0435\u0436\u0434\u0435\u043D\u0438\u0435",
      bargain: "\u0422\u043E\u0440\u0433\u043E\u0432\u043B\u044F",
      intimidate: "\u0417\u0430\u043F\u0443\u0433\u0438\u0432\u0430\u043D\u0438\u0435",
      charm: "\u041E\u0431\u0430\u044F\u043D\u0438\u0435",
      deceive: "\u041E\u0431\u043C\u0430\u043D",
      etiquette: "\u042D\u0442\u0438\u043A\u0435\u0442",
      first_aid: "\u041F\u0435\u0440\u0432\u0430\u044F \u043F\u043E\u043C\u043E\u0449\u044C",
      medicine: "\u041C\u0435\u0434\u0438\u0446\u0438\u043D\u0430",
      herbalism: "\u0422\u0440\u0430\u0432\u043D\u0438\u0447\u0435\u0441\u0442\u0432\u043E",
      athletics: "\u0410\u0442\u043B\u0435\u0442\u0438\u043A\u0430",
      climb: "\u041B\u0430\u0437\u0430\u043D\u0438\u0435",
      swim: "\u041F\u043B\u0430\u0432\u0430\u043D\u0438\u0435",
      jump: "\u041F\u0440\u044B\u0436\u043A\u0438",
      ride: "\u0412\u0435\u0440\u0445\u043E\u0432\u0430\u044F \u0435\u0437\u0434\u0430",
      survival: "\u0412\u044B\u0436\u0438\u0432\u0430\u043D\u0438\u0435",
      craft: "\u0420\u0435\u043C\u0435\u0441\u043B\u043E",
      repair: "\u041F\u043E\u0447\u0438\u043D\u043A\u0430",
      lore: "\u0417\u043D\u0430\u043D\u0438\u044F",
      occult: "\u041E\u043A\u043A\u0443\u043B\u044C\u0442\u0438\u0437\u043C",
      navigate: "\u041E\u0440\u0438\u0435\u043D\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435",
      sleight: "\u041B\u043E\u0432\u043A\u043E\u0441\u0442\u044C \u0440\u0443\u043A",
      lockpick: "\u0412\u0437\u043B\u043E\u043C",
      bite: "\u0423\u043A\u0443\u0441",
      club: "\u0414\u0443\u0431\u0438\u043D\u044B",
      claw: "\u041A\u043E\u0433\u0442\u0438"
    };
  }
});

// src/editor/store.ts
var store_exports = {};
__export(store_exports, {
  EditorStore: () => EditorStore,
  FIRE_RULE_MAX_DEPTH: () => FIRE_RULE_MAX_DEPTH
});
function walkEffects(effects, fn) {
  for (const e of effects ?? []) {
    fn(e);
    if (e.type === "skill_check_gate") {
      walkEffects(e.success_effects ?? [], fn);
      walkEffects(e.fail_effects ?? [], fn);
    } else if (e.type === "stat_check") {
      walkEffects(e.success_effects ?? [], fn);
      walkEffects(e.fail_effects ?? [], fn);
    } else if (e.type === "opposed_check") {
      walkEffects(e.success_effects ?? [], fn);
      walkEffects(e.fail_effects ?? [], fn);
    } else if (e.type === "group_stat_check") {
      walkEffects(e.success_effects ?? [], fn);
      walkEffects(e.fail_effects ?? [], fn);
    } else if (e.type === "start_pursuit") {
      walkEffects(e.on_fail ?? [], fn);
    }
  }
}
var FIRE_RULE_MAX_DEPTH, EditorStore;
var init_store = __esm({
  "src/editor/store.ts"() {
    init_migrate();
    init_aiBaseline();
    init_loader();
    init_ruleFiles();
    init_versions();
    init_types();
    init_skills();
    FIRE_RULE_MAX_DEPTH = 2;
    EditorStore = class _EditorStore {
      basePath;
      // "/campaigns/ash-of-caerden"
      // до load() — безопасные пустые значения: рендер между сменой кампании
      // и загрузкой не должен падать (фидбек №4–5 шестого раунда)
      meta = { id: "", title: "" };
      world = { regions: [] };
      manifest = { scenes: [], entities: [], rules: [], arenas: [], quests: [], encounters: [], cutscenes: [], dialogues: [] };
      /** JSON-документы по путям пакета */
      jsonFiles = /* @__PURE__ */ new Map();
      /** текстовые документы (.ink) по путям пакета */
      textFiles = /* @__PURE__ */ new Map();
      /** предупреждения загрузки (битые/перепутанные файлы пакета): показывает баннер */
      loadWarnings = [];
      dirty = /* @__PURE__ */ new Set();
      listeners = /* @__PURE__ */ new Set();
      /** undo: снимки «до изменения» (path + сериализация), максимум 100 шагов */
      undoStack = [];
      /** текущая сериализация файлов — чтобы снять снимок «до» в момент touch */
      snapshots = /* @__PURE__ */ new Map();
      /** содержимое файлов на диске (на момент загрузки/сохранения) — для точного счётчика «несохранено» */
      saved = /* @__PURE__ */ new Map();
      /** исходные снимки файлов на момент загрузки/импорта кампании для фиксации изменений мастера */
      baseline = /* @__PURE__ */ new Map();
      lastTouch = { path: "", group: "", at: 0 };
      /** версия формата сохранённого снимка базы правок мастера (при смене формата старые ключи игнорируются) */
      static AI_BASELINE_VERSION = 1;
      /** верхний лимит сохраняемого снимка в символах JSON — страховка от квоты localStorage (~5 МБ в браузерах) */
      static AI_BASELINE_LIMIT = 4 * 1024 * 1024;
      constructor(basePath) {
        this.basePath = basePath;
      }
      subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
      }
      notify() {
        for (const fn of this.listeners) fn();
      }
      async load() {
        const get = async (rel) => {
          const res = await fetch(`${this.basePath}/${rel}?t=${Date.now()}`);
          if (!res.ok) throw new Error(`\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C ${rel}: ${res.status}`);
          return res;
        };
        const getJson = async (rel) => {
          const text = await (await get(rel)).text();
          try {
            return JSON.parse(text);
          } catch {
            throw new Error(`\u0424\u0430\u0439\u043B ${rel} \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0438\u043B\u0438 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D (\u043A\u0430\u043C\u043F\u0430\u043D\u0438\u044F \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u0430 \u043D\u0435 \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E?)`);
          }
        };
        this.meta = await getJson("campaign.json");
        this.world = await getJson("world.json");
        this.manifest = await getJson("manifest.json");
        const jobs = [];
        const loadJson = (rel) => jobs.push(get(rel).then(async (r) => void this.jsonFiles.set(rel, await r.json())));
        const loadText = (rel) => jobs.push(get(rel).then(async (r) => void this.textFiles.set(rel, await r.text())));
        for (const f of this.manifest.scenes) loadJson(`scenes/${f}`);
        for (const f of this.manifest.entities) loadJson(`entities/${f}`);
        for (const f of this.manifest.rules) loadJson(`rules/${f}`);
        for (const f of this.manifest.arenas ?? []) loadJson(`arenas/${f}`);
        for (const f of this.manifest.quests ?? []) loadJson(`quests/${f}`);
        for (const f of this.manifest.encounters ?? []) {
          jobs.push(
            (async () => {
              let r = await fetch(`${this.basePath}/encounters/${f}?t=${Date.now()}`);
              let path = `encounters/${f}`;
              if (!r.ok) {
                r = await fetch(`${this.basePath}/rules/${f}?t=${Date.now()}`);
                path = `rules/${f}`;
              }
              if (r.ok) {
                try {
                  this.jsonFiles.set(path, await r.json());
                } catch {
                }
              }
            })()
          );
        }
        for (const f of this.manifest.cutscenes ?? []) loadJson(`cutscenes/${f}`);
        for (const f of this.manifest.recipes ?? []) loadJson(`recipes/${f}`);
        for (const f of this.manifest.codex ?? []) loadJson(`codex/${f}`);
        for (const f of this.manifest.dialogues) loadText(`dialogues/${f}`);
        for (const f of this.manifest.dialogues) {
          const rel = `dialogues/${f.replace(/\.ink$/, ".dlg.json")}`;
          jobs.push(
            fetch(`${this.basePath}/${rel}?t=${Date.now()}`).then(async (r) => {
              if (r.ok && (r.headers.get("content-type") ?? "").includes("json")) {
                this.jsonFiles.set(rel, await r.json());
              }
            }).catch(() => void 0)
          );
        }
        await Promise.all(jobs);
        this.sanitizeRules();
        this.migrateContent();
        for (const p of this.allPaths()) {
          this.snapshots.set(p, this.fileText(p));
          this.saved.set(p, this.fileText(p));
        }
        if (!this.restoreBaseline()) this.captureBaseline();
      }
      /**
       * Разбор файлов из manifest.rules: таблицы встреч уходят в manifest.encounters,
       * файлы без id отбрасываются, у правил восстанавливаются массивы conditions/
       * effects. Всё предупреждениями в loadWarnings — их показывает баннер редактора.
       */
      sanitizeRules() {
        this.loadWarnings = [];
        const kept = [];
        const seenIds = /* @__PURE__ */ new Set();
        for (const f of this.manifest.rules) {
          const rel = `rules/${f}`;
          const verdict = parseRuleFile(f, this.jsonFiles.get(rel));
          if (verdict.warnings.length) this.loadWarnings.push(...verdict.warnings);
          if (verdict.kind === "rule") {
            if (seenIds.has(verdict.rule.id)) {
              this.loadWarnings.push(`rules/${f}: \u0434\u0443\u0431\u043B\u044C id \xAB${verdict.rule.id}\xBB \u2014 \u0444\u0430\u0439\u043B \u0438\u0441\u043A\u043B\u044E\u0447\u0451\u043D \u0438\u0437 manifest.rules.`);
              continue;
            }
            seenIds.add(verdict.rule.id);
            this.jsonFiles.set(rel, verdict.rule);
            kept.push(f);
          } else if (verdict.kind === "encounters") {
            this.jsonFiles.set(rel, { encounter_tables: verdict.tables });
            if (!this.manifest.encounters) this.manifest.encounters = [];
            if (!this.manifest.encounters.includes(f)) this.manifest.encounters.push(f);
          }
        }
        const dropped = this.manifest.rules.length - kept.length;
        if (dropped > 0) this.manifest.rules = kept;
      }
      // ─────────────── доступ с типами ───────────────
      scenePaths() {
        return this.manifest.scenes.map((f) => `scenes/${f}`);
      }
      entityPaths() {
        return this.manifest.entities.map((f) => `entities/${f}`);
      }
      rulePaths() {
        return this.manifest.rules.map((f) => `rules/${f}`);
      }
      arenaPaths() {
        return (this.manifest.arenas ?? []).map((f) => `arenas/${f}`);
      }
      questPaths() {
        return (this.manifest.quests ?? []).map((f) => `quests/${f}`);
      }
      /**
       * Персонаж, который ведёт этот диалог (ссылка `dialogue` в сущности NPC).
       * Нужен, чтобы в списках вместо имени файла стояло человеческое имя.
       */
      npcForDialogue(inkPath) {
        for (const p of this.entityPaths()) {
          const e = this.entity(p);
          if (e?.type === "npc" && e.dialogue === inkPath) return e;
        }
        return void 0;
      }
      /** Читаемое имя диалога: подпись документа → имя ведущего персонажа → русское имя или имя файла словами. */
      dialogueLabel(inkPath) {
        const doc = this.jsonFiles.get(inkPath.replace(/\.ink$/, ".dlg.json"));
        if (doc?.label) return doc.label;
        const npc = this.npcForDialogue(inkPath);
        if (npc) return npc.label;
        const base = inkPath.replace("dialogues/", "").replace(/\.ink$/, "");
        const DIALOGUE_RU = {
          heart: "\u0421\u0435\u0440\u0434\u0446\u0435",
          core: "\u042F\u0434\u0440\u043E",
          choir: "\u0425\u043E\u0440",
          clock: "\u0427\u0430\u0441\u044B",
          guard: "\u0421\u0442\u0440\u0430\u0436\u0430",
          abbot: "\u041D\u0430\u0441\u0442\u043E\u044F\u0442\u0435\u043B\u044C"
        };
        if (DIALOGUE_RU[base.toLowerCase()]) return DIALOGUE_RU[base.toLowerCase()];
        const allEnts = this.entityPaths().map((p) => this.entity(p));
        for (const ent of allEnts) {
          if (ent && (ent.id === base || ent.id === `item_${base}` || ent.id === `npc_${base}`) && ent.label) {
            return ent.label;
          }
        }
        return base.replace(/[_-]+/g, " ").replace(/^./, (ch) => ch.toUpperCase());
      }
      dialoguePaths() {
        return this.manifest.dialogues.map((f) => `dialogues/${f}`);
      }
      cutscenePaths() {
        return (this.manifest.cutscenes ?? []).map((f) => `cutscenes/${f}`);
      }
      recipePaths() {
        return (this.manifest.recipes ?? []).map((f) => `recipes/${f}`);
      }
      codexPaths() {
        return (this.manifest.codex ?? []).map((f) => `codex/${f}`);
      }
      scene(path) {
        return this.jsonFiles.get(path);
      }
      entity(path) {
        const e = this.jsonFiles.get(path);
        if (e && e.type === "npc" && typeof e.description !== "string") {
          ;
          e.description = "";
        }
        return e;
      }
      rule(path) {
        return this.jsonFiles.get(path);
      }
      arena(path) {
        return this.jsonFiles.get(path);
      }
      quest(path) {
        return this.jsonFiles.get(path);
      }
      cutscene(path) {
        return this.jsonFiles.get(path);
      }
      recipe(path) {
        return this.jsonFiles.get(path);
      }
      codexEntry(path) {
        return this.jsonFiles.get(path);
      }
      /** id всех рецептов кампании (для ссылок unlock_recipe) */
      recipeIds() {
        return new Set(this.recipePaths().map((p) => this.recipe(p)?.id).filter((x) => !!x));
      }
      /**
       * Ключи состояний облика НПЦ: его собственные портреты и спрайты сцены
       * плюс общий реестр состояний meta.emotions. Пустая строка — обычный облик.
       */
      entityStateKeys(entityId) {
        const out = /* @__PURE__ */ new Set(["", DEFAULT_EMOTION.id]);
        for (const e of this.meta.emotions ?? []) out.add(e.id);
        const npc = this.entityPaths().map((p) => this.entity(p)).find((e) => e?.id === entityId);
        if (npc && npc.type === "npc") {
          for (const k of Object.keys(npc.portrait ?? {})) out.add(k);
          for (const k of Object.keys(npc.scene_sprite_states ?? {})) out.add(k);
          for (const k of Object.keys(npc.combat_figure_states ?? {})) out.add(k);
        }
        return out;
      }
      /**
       * Циклы правил через эффект fire_rule (прямой вызов себя и транзитивные
       * петли). Возвращает список замкнутых цепочек для отчёта «Проверить кампанию».
       */
      fireRuleCycles() {
        const edges = /* @__PURE__ */ new Map();
        for (const p of this.rulePaths()) {
          const r = this.rule(p);
          if (!r) continue;
          const to = [];
          walkEffects(r.effects ?? [], (e) => {
            if (e.type === "fire_rule") to.push(e.rule);
          });
          edges.set(r.id, to);
        }
        const cycles = [];
        const state = /* @__PURE__ */ new Map();
        const stack = [];
        const labels = /* @__PURE__ */ new Map();
        for (const p of this.rulePaths()) {
          const r = this.rule(p);
          if (r) labels.set(r.id, r.label || r.id);
        }
        const visit = (id) => {
          const st = state.get(id) ?? 0;
          if (st === 2) return;
          if (st === 1) {
            const from = stack.indexOf(id);
            if (from >= 0) cycles.push([...stack.slice(from), id]);
            return;
          }
          state.set(id, 1);
          stack.push(id);
          for (const next of edges.get(id) ?? []) visit(next);
          stack.pop();
          state.set(id, 2);
        };
        for (const id of edges.keys()) visit(id);
        return cycles.map((c) => c.map((id) => `\xAB${labels.get(id) ?? id}\xBB`));
      }
      /** списки id для подсказок в полях */
      /** все флаги, упомянутые в правилах/квестах/ink — для подсказок в конструкторах */
      knownFlags() {
        const flags = /* @__PURE__ */ new Set();
        const scan = (o) => {
          if (Array.isArray(o)) {
            o.forEach(scan);
            return;
          }
          if (o && typeof o === "object") {
            const r = o;
            if (typeof r.flag === "string") flags.add(r.flag);
            for (const v of Object.values(r)) scan(v);
          }
        };
        for (const p of this.rulePaths()) scan(this.rule(p));
        for (const p of this.questPaths()) scan(this.quest(p));
        for (const [, text] of this.textFiles) {
          for (const m of text.matchAll(/(?:get_flag|set_flag)\("([^"]+)"\)/g)) flags.add(m[1]);
        }
        return [...flags].sort();
      }
      /** пары id+label для выпадающих списков (в UI мастер видит названия, не id) */
      options(kind) {
        const out = [];
        if (kind === "currency") {
          for (const c of this.meta.currencies ?? []) out.push({ id: c.id, label: c.label });
        } else if (kind === "entity" || kind === "item" || kind === "npc") {
          for (const p of this.entityPaths()) {
            const e = this.entity(p);
            if (!e) continue;
            if (kind === "entity" || e.type === kind) out.push({ id: e.id, label: e.label || e.id });
          }
        } else if (kind === "scene") {
          for (const p of this.scenePaths()) {
            const sc = this.scene(p);
            if (sc) out.push({ id: sc.id, label: sc.label || sc.id });
          }
        } else if (kind === "quest") {
          for (const p of this.questPaths()) {
            const q = this.quest(p);
            if (q) out.push({ id: q.id, label: q.label || q.id });
          }
        } else if (kind === "arena") {
          for (const p of this.arenaPaths()) {
            const a = this.arena(p);
            if (a) out.push({ id: a.id, label: a.label || a.id });
          }
        } else if (kind === "rule") {
          for (const p of this.rulePaths()) {
            const r = this.rule(p);
            if (r) out.push({ id: r.id, label: r.label || r.id });
          }
        } else if (kind === "cutscene") {
          for (const p of this.cutscenePaths()) {
            const c = this.cutscene(p);
            if (c) out.push({ id: c.id, label: c.label || c.id });
          }
        } else if (kind === "location") {
          const walk = (regions) => {
            for (const r of regions) {
              for (const l of r.locations) out.push({ id: l.id, label: l.label || l.id });
              if (r.sub_regions) walk(r.sub_regions);
            }
          };
          walk(this.world.regions);
        } else if (kind === "dialogue") {
          for (const p of this.dialoguePaths()) out.push({ id: p, label: this.dialogueLabel(p) });
        } else if (kind === "faction") {
          for (const f of this.meta.factions ?? []) out.push({ id: f.id, label: f.label || f.id });
        } else if (kind === "skill") {
          for (const sk of this.meta.skills ?? []) out.push({ id: sk.id, label: sk.label || skillLabel(sk.id, this.meta.skills) });
        } else if (kind === "need") {
          for (const n of this.meta.needs) out.push({ id: n.id, label: n.label || n.id });
        } else if (kind === "status") {
          for (const s of this.meta.statuses ?? []) out.push({ id: s.id, label: s.label || s.id });
        } else if (kind === "ability") {
          for (const a of this.meta.abilities ?? []) out.push({ id: a.id, label: a.label || a.id });
        } else if (kind === "weather") {
          out.push({ id: "", label: "\u042F\u0441\u043D\u043E" });
          for (const w of this.meta.weathers ?? []) out.push({ id: w.id, label: w.label || w.id });
        } else if (kind === "codex") {
          for (const p of this.codexPaths()) {
            const c = this.codexEntry(p);
            if (c) out.push({ id: c.id, label: c.label || c.id });
          }
        } else if (kind === "recipe") {
          for (const p of this.recipePaths()) {
            const r = this.recipe(p);
            if (r) out.push({ id: r.id, label: r.label || r.id });
          }
        } else if (kind === "emotion") {
          out.push({ id: DEFAULT_EMOTION.id, label: DEFAULT_EMOTION.label });
          for (const e of this.meta.emotions ?? []) out.push({ id: e.id, label: e.label || e.id });
        } else if (kind === "disposition") {
          for (const f of this.meta.factions ?? []) out.push({ id: f.id, label: `${f.label || f.id} (\u0444\u0440\u0430\u043A\u0446\u0438\u044F)` });
          for (const o of this.options("npc")) out.push({ id: o.id, label: `${o.label} (NPC)` });
        } else if (kind === "duration_action") {
          for (const d of this.meta.duration_actions ?? []) out.push({ id: d.id, label: d.label || d.id });
        } else if (kind === "itemCategory") {
          for (const c of this.meta.item_categories ?? []) out.push({ id: c.id, label: c.label || c.id });
        } else if (kind === "flag") {
          const seen = /* @__PURE__ */ new Set();
          for (const f of this.meta.flags ?? []) {
            out.push({ id: f.id, label: f.label || f.id });
            seen.add(f.id);
          }
          for (const f of this.knownFlags()) if (!seen.has(f)) out.push({ id: f, label: f });
        }
        return out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
      }
      /** название стадии или журнальной записи квеста (для сводок правил) */
      questStageLabel(questId, key) {
        for (const p of this.questPaths()) {
          const q = this.quest(p);
          if (q?.id !== questId) continue;
          const st = q.stages.find((s) => s.id === key);
          return st?.label ?? key;
        }
        return key;
      }
      /** src для предпросмотра ассета: файл пакета или внешняя ссылка (итерация 8, блок C) */
      assetSrc(path) {
        if (!path) return "";
        if (isExternalUrl(path)) return path;
        return `${this.basePath}/${path}`;
      }
      /** название по id (для сводок) */
      labelFor(kind, id) {
        return this.options(kind).find((o) => o.id === id)?.label ?? id;
      }
      /** сохранить бинарный файл (картинку) в кампанию; возвращает путь внутри кампании */
      async saveBinary(relPath, file) {
        const buf = await file.arrayBuffer();
        let bin = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        const b64 = btoa(bin);
        const res = await fetch(this.saveEndpoint(), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path: `${this.campaignRel()}/${relPath}`, base64: b64 })
        });
        if (!res.ok) throw new Error(`${relPath}: ${res.status} ${await res.text()}`);
        return relPath;
      }
      ids(kind) {
        const out = [];
        if (kind === "entity" || kind === "item" || kind === "npc") {
          for (const p of this.entityPaths()) {
            const e = this.entity(p);
            if (!e) continue;
            if (kind === "entity" || e.type === kind) out.push(e.id);
          }
        } else if (kind === "scene") {
          for (const p of this.scenePaths()) out.push(this.scene(p)?.id ?? "");
        } else if (kind === "quest") {
          for (const p of this.questPaths()) out.push(this.quest(p)?.id ?? "");
        } else if (kind === "arena") {
          for (const p of this.arenaPaths()) out.push(this.arena(p)?.id ?? "");
        } else if (kind === "rule") {
          for (const p of this.rulePaths()) out.push(this.rule(p)?.id ?? "");
        } else if (kind === "cutscene") {
          for (const p of this.cutscenePaths()) out.push(this.cutscene(p)?.id ?? "");
        } else if (kind === "recipe") {
          for (const p of this.recipePaths()) out.push(this.recipe(p)?.id ?? "");
        } else if (kind === "codex") {
          for (const p of this.codexPaths()) out.push(this.codexEntry(p)?.id ?? "");
        } else if (kind === "location") {
          const walk = (regions) => {
            for (const r of regions) {
              for (const l of r.locations) out.push(l.id);
              if (r.sub_regions) walk(r.sub_regions);
            }
          };
          walk(this.world.regions);
        }
        return out.filter(Boolean).sort();
      }
      // ─────────────── миграции и валидация ───────────────
      /**
       * Мягкие миграции контента (итерация 8). Старый формат остаётся читаемым:
       * одиночные location/item в условиях потребностей превращаются в списки,
       * переходы «в локацию» из сцен — в «открыть карту».
       */
      migrateContent() {
        const notes = [];
        migrateMeta(this.meta);
        const soundIds = new Set((this.meta.sounds ?? []).map((s) => s.id));
        for (const w of this.meta.weathers ?? []) {
          if (!w.ambient?.length) continue;
          w.ambient = w.ambient.map((id) => {
            if (soundIds.has(id)) return id;
            const alt = id.startsWith("snd_") ? id.replace(/^snd_/, "sfx_") : id.startsWith("sfx_") ? id.replace(/^sfx_/, "snd_") : "";
            return alt && soundIds.has(alt) ? alt : id;
          });
        }
        for (const p of this.scenePaths()) {
          const sc = this.scene(p);
          if (!sc) continue;
          const before = JSON.stringify(sc.navigation);
          migrateNavigation(sc, this.world);
          if (JSON.stringify(sc.navigation) !== before) {
            notes.push(`\u0421\u0446\u0435\u043D\u0430 \xAB${sc.label}\xBB: \u043F\u0435\u0440\u0435\u0445\u043E\u0434 \xAB\u0432 \u043B\u043E\u043A\u0430\u0446\u0438\u044E\xBB \u0437\u0430\u043C\u0435\u043D\u0451\u043D \u043D\u0430 \xAB\u043E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u0430\u0440\u0442\u0443\xBB`);
          }
        }
        return notes;
      }
      /**
       * Проверка целостности кампании (итерация 8, А6/блок F).
       * Возвращает список проблем по-русски — импорт и загрузка не падают,
       * мастеру показывается отчёт.
       */
      validateContent() {
        const issues = [];
        const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
        if (!this.meta.version) issues.push("\u041A\u0430\u043C\u043F\u0430\u043D\u0438\u044F: \u043D\u0435 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u0430 \u0432\u0435\u0440\u0441\u0438\u044F (\u043D\u0443\u0436\u043D\u0430 \u0434\u043B\u044F \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0439 \u0438 \u0441\u043E\u0432\u043C\u0435\u0441\u0442\u0438\u043C\u043E\u0441\u0442\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0439)");
        else if (!semver.test(this.meta.version)) issues.push(`\u041A\u0430\u043C\u043F\u0430\u043D\u0438\u044F: \u0432\u0435\u0440\u0441\u0438\u044F \xAB${this.meta.version}\xBB \u043D\u0435 \u043F\u043E\u0445\u043E\u0436\u0430 \u043D\u0430 semver (\u043E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F \u0432\u0438\u0434 1.4.2)`);
        const minEngine = this.meta.min_engine ?? this.meta.engine_version;
        if (minEngine && !/^\d+(\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?$/.test(minEngine)) {
          issues.push(`\u041A\u0430\u043C\u043F\u0430\u043D\u0438\u044F: \u043C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u044B\u0439 \u0434\u0432\u0438\u0436\u043E\u043A \xAB${minEngine}\xBB \u043D\u0435 \u043F\u043E\u0445\u043E\u0436 \u043D\u0430 \u043D\u043E\u043C\u0435\u0440 \u0432\u0435\u0440\u0441\u0438\u0438`);
        }
        if (this.meta.save_base_version) {
          if (!semver.test(this.meta.save_base_version)) issues.push(`\u041A\u0430\u043C\u043F\u0430\u043D\u0438\u044F: \u0433\u0440\u0430\u043D\u0438\u0446\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0439 \xAB${this.meta.save_base_version}\xBB \u043D\u0435 \u043F\u043E\u0445\u043E\u0436\u0430 \u043D\u0430 semver`);
          else if (compareVersions(this.meta.save_base_version, this.meta.version) > 0) {
            issues.push(`\u041A\u0430\u043C\u043F\u0430\u043D\u0438\u044F: \u0433\u0440\u0430\u043D\u0438\u0446\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0439 ${this.meta.save_base_version} \u043D\u043E\u0432\u0435\u0435 \u0432\u0435\u0440\u0441\u0438\u0438 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 ${this.meta.version} \u2014 \u0442\u0430\u043A \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043D\u0435 \u043E\u0442\u043A\u0440\u043E\u044E\u0442\u0441\u044F \u043D\u0438 \u0443 \u043A\u043E\u0433\u043E`);
          }
        }
        const scenes = {};
        for (const p of this.scenePaths()) {
          const sc = this.scene(p);
          if (sc) scenes[sc.id] = sc;
        }
        const locationIds = new Set(this.ids("location"));
        const sceneIds = new Set(Object.keys(scenes));
        const entityIds = new Set(this.ids("entity"));
        const questIds = new Set(this.ids("quest"));
        const arenaIds = new Set(this.ids("arena"));
        const ruleIds = new Set(this.ids("rule"));
        const cutsceneIds = new Set(this.ids("cutscene"));
        for (const p of this.cutscenePaths()) {
          const c = this.cutscene(p);
          if (!c) continue;
          if (!c.slides?.length) issues.push(`\u041A\u0430\u0442\u0441\u0446\u0435\u043D\u0430 \xAB${c.label}\xBB: \u043D\u0435\u0442 \u043D\u0438 \u043E\u0434\u043D\u043E\u0433\u043E \u0441\u043B\u0430\u0439\u0434\u0430`);
        }
        for (const loc of allLocations(this.world)) {
          for (const sc of loc.scenes) {
            if (!sceneIds.has(sc)) issues.push(`\u041B\u043E\u043A\u0430\u0446\u0438\u044F \xAB${loc.label}\xBB: \u0441\u0446\u0435\u043D\u044B \xAB${sc}\xBB \u043D\u0435\u0442 \u0432 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438`);
          }
          if (loc.arrival_scene && !loc.scenes.includes(loc.arrival_scene)) {
            issues.push(`\u041B\u043E\u043A\u0430\u0446\u0438\u044F \xAB${loc.label}\xBB: \u0441\u0446\u0435\u043D\u0430 \u043F\u043E \u043F\u0440\u0438\u0431\u044B\u0442\u0438\u0438 \xAB${loc.arrival_scene}\xBB \u043D\u0435 \u0432\u0445\u043E\u0434\u0438\u0442 \u0432 \u0441\u043F\u0438\u0441\u043E\u043A \u0435\u0451 \u0441\u0446\u0435\u043D`);
          }
          if (loc.arena && !arenaIds.has(loc.arena)) {
            issues.push(`\u041B\u043E\u043A\u0430\u0446\u0438\u044F \xAB${loc.label}\xBB: \u0430\u0440\u0435\u043D\u0430 \xAB${loc.arena}\xBB \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430`);
          }
          for (const tc of loc.travel_connections) {
            if (!locationIds.has(tc.to)) issues.push(`\u041B\u043E\u043A\u0430\u0446\u0438\u044F \xAB${loc.label}\xBB: \u0434\u043E\u0440\u043E\u0433\u0430 \u0432\u0435\u0434\u0451\u0442 \u0432 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0443\u044E \u043B\u043E\u043A\u0430\u0446\u0438\u044E \xAB${tc.to}\xBB`);
          }
        }
        for (const p of this.scenePaths()) {
          const sc = this.scene(p);
          if (!sc) continue;
          if (sc.location && !locationIds.has(sc.location)) {
            issues.push(`\u0421\u0446\u0435\u043D\u0430 \xAB${sc.label}\xBB: \u043B\u043E\u043A\u0430\u0446\u0438\u044F \xAB${sc.location}\xBB \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430`);
          }
          for (const nav of sc.navigation) {
            if (!nav.go_to_scene) continue;
            const target = scenes[nav.go_to_scene];
            if (!target) {
              issues.push(`\u0421\u0446\u0435\u043D\u0430 \xAB${sc.label}\xBB: \u043F\u0435\u0440\u0435\u0445\u043E\u0434 \xAB${nav.label}\xBB \u0432\u0435\u0434\u0451\u0442 \u0432 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0443\u044E \u0441\u0446\u0435\u043D\u0443 \xAB${nav.go_to_scene}\xBB`);
            } else if (target.location !== sc.location) {
              issues.push(
                `\u0421\u0446\u0435\u043D\u0430 \xAB${sc.label}\xBB: \u043F\u0435\u0440\u0435\u0445\u043E\u0434 \xAB${nav.label}\xBB \u0432\u0435\u0434\u0451\u0442 \u0432 \u0441\u0446\u0435\u043D\u0443 \u0434\u0440\u0443\u0433\u043E\u0439 \u043B\u043E\u043A\u0430\u0446\u0438\u0438 \xAB${target.label}\xBB (\u043C\u0435\u0436\u0434\u0443 \u043B\u043E\u043A\u0430\u0446\u0438\u044F\u043C\u0438 \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0435\u0440\u0435\u0437 \u043A\u0430\u0440\u0442\u0443)`
              );
            }
          }
          for (const slot of sc.slots) {
            if (slot.default_entity && !entityIds.has(slot.default_entity)) {
              issues.push(`\u0421\u0446\u0435\u043D\u0430 \xAB${sc.label}\xBB: \u0432 \u0441\u043B\u043E\u0442\u0435 \u0441\u0442\u043E\u0438\u0442 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0430\u044F \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C \xAB${slot.default_entity}\xBB`);
            }
          }
          if (!sc.states.length) issues.push(`\u0421\u0446\u0435\u043D\u0430 \xAB${sc.label}\xBB: \u043D\u0435\u0442 \u043D\u0438 \u043E\u0434\u043D\u043E\u0433\u043E \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F (\u0444\u043E\u043D\u0430)`);
          for (const st of sc.states) {
            if (!st.image && !st.art) issues.push(`\u0421\u0446\u0435\u043D\u0430 \xAB${sc.label}\xBB: \u0443 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F \xAB${st.label}\xBB \u043D\u0435\u0442 \u043D\u0438 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F, \u043D\u0438 \u0432\u0435\u043A\u0442\u043E\u0440\u043D\u043E\u0433\u043E \u0444\u043E\u043D\u0430`);
          }
        }
        for (const p of this.entityPaths()) {
          const e = this.entity(p);
          if (!e || e.type !== "npc") continue;
          if (e.dialogue && !this.textFiles.has(e.dialogue)) {
            issues.push(`\u041F\u0435\u0440\u0441\u043E\u043D\u0430\u0436 \xAB${e.label}\xBB: \u0434\u0438\u0430\u043B\u043E\u0433 \xAB${e.dialogue}\xBB \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D`);
          }
          for (const s of e.schedule ?? []) {
            if (!sceneIds.has(s.scene)) issues.push(`\u041F\u0435\u0440\u0441\u043E\u043D\u0430\u0436 \xAB${e.label}\xBB: \u0440\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0441\u0441\u044B\u043B\u0430\u0435\u0442\u0441\u044F \u043D\u0430 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0443\u044E \u0441\u0446\u0435\u043D\u0443 \xAB${s.scene}\xBB`);
            else if (scenes[s.scene] && !scenes[s.scene].slots.some((sl) => sl.id === s.slot)) {
              issues.push(`\u041F\u0435\u0440\u0441\u043E\u043D\u0430\u0436 \xAB${e.label}\xBB: \u0432 \u0441\u0446\u0435\u043D\u0435 \xAB${scenes[s.scene].label}\xBB \u043D\u0435\u0442 \u0441\u043B\u043E\u0442\u0430 \xAB${s.slot}\xBB`);
            }
          }
          for (const ov of e.presence_overrides ?? []) {
            if (!sceneIds.has(ov.scene)) {
              issues.push(`\u041F\u0435\u0440\u0441\u043E\u043D\u0430\u0436 \xAB${e.label}\xBB: \u043E\u0441\u043E\u0431\u043E\u0435 \u043C\u0435\u0441\u0442\u043E \u0441\u0441\u044B\u043B\u0430\u0435\u0442\u0441\u044F \u043D\u0430 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0443\u044E \u0441\u0446\u0435\u043D\u0443 \xAB${ov.scene}\xBB`);
            }
          }
          for (const s of e.trader?.sells ?? []) {
            if (!entityIds.has(s.item)) issues.push(`\u041F\u0435\u0440\u0441\u043E\u043D\u0430\u0436 \xAB${e.label}\xBB: \u0432 \u043F\u0440\u0438\u043B\u0430\u0432\u043A\u0435 \u043D\u0435\u0442 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \xAB${s.item}\xBB`);
          }
        }
        for (const p of this.rulePaths()) {
          const r = this.rule(p);
          if (!r) continue;
          for (const cond of r.conditions ?? []) {
            if (cond.type === "player_enters_scene" && !sceneIds.has(cond.scene)) {
              issues.push(`\u041F\u0440\u0430\u0432\u0438\u043B\u043E \xAB${r.label}\xBB: \u0443\u0441\u043B\u043E\u0432\u0438\u0435 \u0441\u0441\u044B\u043B\u0430\u0435\u0442\u0441\u044F \u043D\u0430 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0443\u044E \u0441\u0446\u0435\u043D\u0443 \xAB${cond.scene}\xBB`);
            }
          }
          for (const ef of r.effects ?? []) {
            if (ef.type === "start_quest" && !questIds.has(ef.quest)) {
              issues.push(`\u041F\u0440\u0430\u0432\u0438\u043B\u043E \xAB${r.label}\xBB: \u043A\u0432\u0435\u0441\u0442 \xAB${ef.quest}\xBB \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D`);
            }
            if (ef.type === "play_cutscene" && !cutsceneIds.has(ef.cutscene)) {
              issues.push(`\u041F\u0440\u0430\u0432\u0438\u043B\u043E \xAB${r.label}\xBB: \u043A\u0430\u0442\u0441\u0446\u0435\u043D\u0430 \xAB${ef.cutscene}\xBB \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430`);
            }
            if (ef.type === "fire_rule" && !ruleIds.has(ef.rule)) {
              issues.push(`\u041F\u0440\u0430\u0432\u0438\u043B\u043E \xAB${r.label}\xBB: \u044D\u0444\u0444\u0435\u043A\u0442 \u0432\u044B\u0437\u044B\u0432\u0430\u0435\u0442 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0435\u0435 \u043F\u0440\u0430\u0432\u0438\u043B\u043E \xAB${ef.rule}\xBB`);
            }
            if (ef.type === "unlock_recipe" && !this.recipeIds().has(ef.recipe)) {
              issues.push(`\u041F\u0440\u0430\u0432\u0438\u043B\u043E \xAB${r.label}\xBB: \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0439 \u0440\u0435\u0446\u0435\u043F\u0442 \xAB${ef.recipe}\xBB`);
            }
            if (ef.type === "set_entity_state") {
              if (!entityIds.has(ef.entity)) {
                issues.push(`\u041F\u0440\u0430\u0432\u0438\u043B\u043E \xAB${r.label}\xBB: \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043E\u0431\u043B\u0438\u043A\u0430 \u043D\u0430\u0437\u043D\u0430\u0447\u0430\u0435\u0442\u0441\u044F \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0435\u043C\u0443 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0443 \xAB${ef.entity}\xBB`);
              } else if (ef.state && !this.entityStateKeys(ef.entity).has(ef.state)) {
                issues.push(
                  `\u041F\u0440\u0430\u0432\u0438\u043B\u043E \xAB${r.label}\xBB: \u0443 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430 \xAB${ef.entity}\xBB \u043D\u0435\u0442 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F \u043E\u0431\u043B\u0438\u043A\u0430 \xAB${ef.state}\xBB (\u0435\u0441\u0442\u044C: ${[...this.entityStateKeys(ef.entity)].join(", ") || "\u2014"})`
                );
              }
            }
          }
        }
        for (const cyc of this.fireRuleCycles()) {
          issues.push(
            `\u041F\u0440\u0430\u0432\u0438\u043B\u0430 \u0432\u044B\u0437\u044B\u0432\u0430\u044E\u0442 \u0434\u0440\u0443\u0433 \u0434\u0440\u0443\u0433\u0430 \u043F\u043E \u043A\u0440\u0443\u0433\u0443: ${cyc.join(" \u2192 ")}. \u0420\u0430\u0437\u043E\u0440\u0432\u0438\u0442\u0435 \u0446\u0435\u043F\u043E\u0447\u043A\u0443: \u0432\u043B\u043E\u0436\u0435\u043D\u043D\u044B\u0445 \u0432\u044B\u0437\u043E\u0432\u043E\u0432 \u043F\u0440\u0430\u0432\u0438\u043B \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043D\u0435 \u0431\u043E\u043B\u044C\u0448\u0435 ${FIRE_RULE_MAX_DEPTH}, \u0430 \u043F\u0440\u0430\u0432\u0438\u043B\u043E \u043D\u0435 \u0434\u043E\u043B\u0436\u043D\u043E \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0442\u044C\u0441\u044F \u0432 \u0441\u0435\u0431\u044F.`
          );
        }
        for (const p of this.questPaths()) {
          const q = this.quest(p);
          if (!q) continue;
          if (!q.stages.length) issues.push(`\u041A\u0432\u0435\u0441\u0442 \xAB${q.label}\xBB: \u043D\u0435\u0442 \u043D\u0438 \u043E\u0434\u043D\u043E\u0439 \u0441\u0442\u0430\u0434\u0438\u0438`);
          else {
            const ids = new Set(q.stages.map((s) => s.id));
            for (const st of q.stages) {
              for (const t of st.transitions ?? []) {
                if (!ids.has(t.to)) issues.push(`\u041A\u0432\u0435\u0441\u0442 \xAB${q.label}\xBB: \u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u0441\u0442\u0430\u0434\u0438\u0438 \xAB${st.label ?? st.id}\xBB \u0432 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0443\u044E \u0441\u0442\u0430\u0434\u0438\u044E \xAB${t.to}\xBB`);
              }
            }
            if (this.meta.starting_scene && !sceneIds.has(this.meta.starting_scene)) {
              issues.push(`\u041A\u0430\u043C\u043F\u0430\u043D\u0438\u044F: \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u0430\u044F \u0441\u0446\u0435\u043D\u0430 \xAB${this.meta.starting_scene}\xBB \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430`);
            }
          }
        }
        if (!locationIds.has(this.meta.starting_location)) {
          issues.push(`\u041A\u0430\u043C\u043F\u0430\u043D\u0438\u044F: \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u0430\u044F \u043B\u043E\u043A\u0430\u0446\u0438\u044F \xAB${this.meta.starting_location}\xBB \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430`);
        }
        if (!entityIds.has(this.meta.default_player)) {
          issues.push(`\u041A\u0430\u043C\u043F\u0430\u043D\u0438\u044F: \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436 \u0438\u0433\u0440\u043E\u043A\u0430 \xAB${this.meta.default_player}\xBB \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D`);
        }
        for (const need of this.meta.needs ?? []) {
          if (need.on_zero_effect && need.on_zero_effect !== "death" && !ruleIds.has(need.on_zero_effect)) {
            issues.push(`\u041F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u044C \xAB${need.label}\xBB: \u043F\u0440\u0430\u0432\u0438\u043B\u043E \xAB${need.on_zero_effect}\xBB \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E`);
          }
        }
        const designDoc = (this.meta.design_doc ?? "").trim();
        if (designDoc) {
          const npcIds = /* @__PURE__ */ new Set();
          for (const p of this.entityPaths()) {
            const e = this.entity(p);
            if (e?.type === "npc") npcIds.add(e.id);
          }
          const known = [...sceneIds, ...questIds, ...npcIds];
          if (known.length && !known.some((id) => designDoc.includes(id))) {
            const firstScene = this.scene(this.scenePaths()[0] ?? "");
            issues.push(
              firstScene ? `\u0414\u0438\u0437\u0430\u0439\u043D-\u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043D\u0435 \u043E\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442 \u0441\u0446\u0435\u043D\u0443 \xAB${firstScene.label}\xBB: \u043F\u043E\u043F\u0440\u043E\u0441\u0438\u0442\u0435 \u0430\u0433\u0435\u043D\u0442\u0430 \u0434\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u044C` : "\u0414\u0438\u0437\u0430\u0439\u043D-\u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043D\u0435 \u043E\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442 \u043D\u0438 \u043E\u0434\u043D\u043E\u0439 \u0441\u0446\u0435\u043D\u044B, \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430 \u0438\u043B\u0438 \u043A\u0432\u0435\u0441\u0442\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438: \u043F\u043E\u043F\u0440\u043E\u0441\u0438\u0442\u0435 \u0430\u0433\u0435\u043D\u0442\u0430 \u0434\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u044C"
            );
          }
        }
        return issues;
      }
      // ─────────────── правки ───────────────
      touch(path, group = "") {
        const now = Date.now();
        const prev = this.snapshots.get(path);
        const sameBurst = group !== "" && this.lastTouch.path === path && this.lastTouch.group === group && now - this.lastTouch.at < 900;
        if (prev !== void 0 && !sameBurst) {
          this.undoStack.push({ path, text: prev });
          if (this.undoStack.length > 100) this.undoStack.shift();
        }
        this.lastTouch = { path, group, at: now };
        this.snapshots.set(path, this.fileText(path));
        if (this.saved.get(path) === this.fileText(path)) this.dirty.delete(path);
        else this.dirty.add(path);
        this.notify();
      }
      canUndo() {
        return this.undoStack.length > 0;
      }
      /** откат последнего изменения */
      undo() {
        const step = this.undoStack.pop();
        if (!step) return null;
        const { path, text } = step;
        if (path === "campaign.json") this.meta = JSON.parse(text);
        else if (path === "world.json") this.world = JSON.parse(text);
        else if (path === "manifest.json") this.manifest = JSON.parse(text);
        else if (this.textFiles.has(path)) this.textFiles.set(path, text);
        else this.jsonFiles.set(path, JSON.parse(text));
        this.snapshots.set(path, text);
        if (this.saved.get(path) === text) this.dirty.delete(path);
        else this.dirty.add(path);
        this.lastTouch = { path: "", group: "", at: 0 };
        this.notify();
        return path;
      }
      setJson(path, data) {
        this.jsonFiles.set(path, data);
        this.touch(path);
      }
      setText(path, text) {
        this.textFiles.set(path, text);
        this.touch(path);
      }
      setMeta(meta) {
        this.meta = meta;
        this.touch("campaign.json");
      }
      setWorld(world) {
        this.world = world;
        this.touch("world.json");
      }
      /** создать новый файл и внести в манифест */
      createFile(section, filename, data) {
        const dir = section;
        const path = `${dir}/${filename}`;
        const list = this.manifest[section] ?? (this.manifest[section] = []);
        if (!list.includes(filename)) list.push(filename);
        if (typeof data === "string") this.textFiles.set(path, data);
        else this.jsonFiles.set(path, data);
        this.dirty.add(path);
        this.dirty.add("manifest.json");
        this.notify();
        return path;
      }
      deleteFile(section, filename) {
        const dir = section;
        const path = `${dir}/${filename}`;
        const list = this.manifest[section] ?? [];
        const i = list.indexOf(filename);
        if (i >= 0) list.splice(i, 1);
        this.jsonFiles.delete(path);
        if (section === "encounters") this.jsonFiles.delete(`encounters/${filename}`);
        this.textFiles.delete(path);
        this.dirty.delete(path);
        if (section === "encounters") this.dirty.delete(`encounters/${filename}`);
        this.dirty.add("manifest.json");
        this.notify();
      }
      // ─────────────── сохранение ───────────────
      fileText(path) {
        if (path === "campaign.json") return JSON.stringify(this.meta, null, 2);
        if (path === "world.json") return JSON.stringify(this.world, null, 2);
        if (path === "manifest.json") return JSON.stringify(this.manifest, null, 2);
        if (this.textFiles.has(path)) return this.textFiles.get(path);
        return JSON.stringify(this.jsonFiles.get(path), null, 2);
      }
      hasFile(path) {
        return path === "campaign.json" || path === "world.json" || path === "manifest.json" || this.jsonFiles.has(path) || this.textFiles.has(path);
      }
      /** Зафиксировать текущее состояние кампании как исходную базу для диффа изменений */
      captureBaseline() {
        this.baseline.clear();
        for (const p of this.allPaths()) {
          this.baseline.set(p, this.fileText(p));
        }
        this.persistBaseline();
        this.notify();
      }
      /**
       * Принять один файл в базовый снимок: убрать его из списка ручных правок,
       * не сбрасывая отслеживание остальных (нужна мастеру ИИ кнопка «убрать
       * правку» рядом с каждой строкой). Удалённым файлам снимок попросту не нужен.
       */
      acceptChangeAsBaseline(path) {
        if (this.hasFile(path)) this.baseline.set(path, this.fileText(path));
        else this.baseline.delete(path);
        this.persistBaseline();
        this.notify();
      }
      /** ключ localStorage, по которому лежит снимок базы правок мастера для этой кампании */
      get aiBaselineKey() {
        return aiDiffSnapshotKey(this.basePath);
      }
      /**
       * Сохранить базу правок мастера между сессиями. Снимок живёт в localStorage,
       * поэтому отслеживание изменений продолжается после закрытия редактора и самой
       * игры. Если кампания слишком велика для localStorage, слежение остаётся только
       * в рамках текущей сессии (поведение по умолчанию).
       */
      persistBaseline() {
        try {
          const payload = JSON.stringify({
            v: _EditorStore.AI_BASELINE_VERSION,
            campaign: this.meta?.id ?? "",
            capturedAt: Date.now(),
            files: Object.fromEntries(this.baseline)
          });
          if (payload.length > _EditorStore.AI_BASELINE_LIMIT) {
            localStorage.removeItem(this.aiBaselineKey);
            console.warn("[ai-diff] \u0441\u043D\u0438\u043C\u043E\u043A \u0431\u0430\u0437\u044B \u043F\u0440\u0430\u0432\u043E\u043A \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0432\u0435\u043B\u0438\u043A \u0434\u043B\u044F localStorage; \u043E\u0442\u0441\u043B\u0435\u0436\u0438\u0432\u0430\u043D\u0438\u0435 \u043D\u0435 \u043F\u0435\u0440\u0435\u0436\u0438\u0432\u0451\u0442 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u043A");
            return;
          }
          localStorage.setItem(this.aiBaselineKey, payload);
        } catch {
        }
      }
      /**
       * Восстановить сохранённую базу правок мастера. Возвращает true, если снимок
       * найден и принят; иначе false — вызывающий код фиксирует новую точку отсчёта.
       * Чужой кампании снимок не достанется: он кешируется по basePath и сверяется
       * с id кампании из campaign.json.
       */
      restoreBaseline() {
        try {
          const raw = localStorage.getItem(this.aiBaselineKey);
          if (!raw) return false;
          const data = JSON.parse(raw);
          if (data.v !== _EditorStore.AI_BASELINE_VERSION) return false;
          if (typeof data.files !== "object" || data.files === null) return false;
          if (typeof data.campaign === "string" && data.campaign && this.meta?.id && data.campaign !== this.meta.id) return false;
          const files = data.files;
          this.baseline.clear();
          for (const [p, text] of Object.entries(files)) {
            if (typeof p === "string" && p && typeof text === "string") this.baseline.set(p, text);
          }
          return this.baseline.size > 0;
        } catch {
          return false;
        }
      }
      /** Имеются ли зафиксированные данные базового снимка */
      hasBaseline() {
        return this.baseline.size > 0;
      }
      /**
       * Список файлов, которые реально изменились относительно исходного состояния
       * (добавленные, изменённые или удалённые файлы).
       */
      /** каноничная строка JSON для сравнения: ключи по алфавиту рекурсивно.
       *  Защита от ложного «изменилось»: перестановка ключей или перевод
       *  сериализации (отступы/переносы) не считается правкой мастера (фидбек:
       *  «просто просмотрел диалог — ИИ-мастер записал как изменение»). */
      static canonJson(o) {
        if (Array.isArray(o)) return `[${o.map((x) => _EditorStore.canonJson(x)).join(",")}]`;
        if (o && typeof o === "object") {
          return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${_EditorStore.canonJson(o[k])}`).join(",")}}`;
        }
        return JSON.stringify(o);
      }
      textsEqualForDiff(path, a, b) {
        if (a === b) return true;
        if (!path.endsWith(".json")) return false;
        try {
          return _EditorStore.canonJson(JSON.parse(a)) === _EditorStore.canonJson(JSON.parse(b));
        } catch {
          return false;
        }
      }
      getModifiedFiles() {
        const list = [];
        const currentPaths = new Set(this.allPaths());
        for (const p of currentPaths) {
          const currentText = this.fileText(p);
          const baseText = this.baseline.get(p);
          if (baseText === void 0) {
            list.push({
              path: p,
              status: "added",
              category: this.categorizePath(p),
              title: this.titleForPath(p)
            });
          } else if (!this.textsEqualForDiff(p, baseText, currentText)) {
            list.push({
              path: p,
              status: "modified",
              category: this.categorizePath(p),
              title: this.titleForPath(p),
              diffSummary: this.buildDiffSummary(p, baseText, currentText)
            });
          }
        }
        for (const [p] of this.baseline) {
          if (!currentPaths.has(p)) {
            list.push({
              path: p,
              status: "deleted",
              category: this.categorizePath(p),
              title: this.titleForPath(p)
            });
          }
        }
        return list.sort((a, b) => a.path.localeCompare(b.path, "ru"));
      }
      categorizePath(path) {
        if (path === "campaign.json") return "meta";
        if (path === "world.json") return "world";
        if (path.startsWith("scenes/")) return "scene";
        if (path.startsWith("dialogues/")) return "dialogue";
        if (path.startsWith("entities/")) return "entity";
        if (path.startsWith("quests/")) return "quest";
        if (path.startsWith("rules/")) return "rule";
        if (path.startsWith("recipes/")) return "recipe";
        if (path.startsWith("arenas/")) return "arena";
        if (path.startsWith("cutscenes/")) return "cutscene";
        if (path.startsWith("codex/")) return "codex";
        return "other";
      }
      titleForPath(path) {
        if (path === "campaign.json") return `\u041F\u0430\u0441\u043F\u043E\u0440\u0442 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \xAB${this.meta.title || this.meta.id}\xBB`;
        if (path === "world.json") return "\u041A\u0430\u0440\u0442\u0430 \u043C\u0438\u0440\u0430 \u0438 \u043B\u043E\u043A\u0430\u0446\u0438\u0438";
        if (path === "manifest.json") return "\u041C\u0430\u043D\u0438\u0444\u0435\u0441\u0442 \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u044B";
        if (path.startsWith("scenes/")) {
          const doc = this.jsonFiles.get(path);
          return doc?.label ? `\u0421\u0446\u0435\u043D\u0430: ${doc.label}` : path;
        }
        if (path.startsWith("entities/")) {
          const doc = this.jsonFiles.get(path);
          const kind = doc?.type === "npc" ? "\u041F\u0435\u0440\u0441\u043E\u043D\u0430\u0436" : "\u041F\u0440\u0435\u0434\u043C\u0435\u0442";
          return doc?.label ? `${kind}: ${doc.label}` : path;
        }
        if (path.startsWith("dialogues/")) {
          const clean = path.replace(/^dialogues\//, "").replace(/\.(ink|dlg\.json)$/, "");
          return `\u0414\u0438\u0430\u043B\u043E\u0433: ${clean}`;
        }
        if (path.startsWith("quests/")) {
          const doc = this.jsonFiles.get(path);
          return doc?.label ? `\u041A\u0432\u0435\u0441\u0442: ${doc.label}` : path;
        }
        if (path.startsWith("recipes/")) {
          const doc = this.jsonFiles.get(path);
          return doc?.label ? `\u0420\u0435\u0446\u0435\u043F\u0442: ${doc.label}` : path;
        }
        if (path.startsWith("rules/")) {
          const doc = this.jsonFiles.get(path);
          return doc?.label || doc?.id ? `\u041F\u0440\u0430\u0432\u0438\u043B\u043E: ${doc.label || doc.id}` : path;
        }
        if (path.startsWith("cutscenes/")) {
          const doc = this.jsonFiles.get(path);
          return doc?.label ? `\u041A\u0430\u0442\u0441\u0446\u0435\u043D\u0430: ${doc.label}` : path;
        }
        if (path.startsWith("arenas/")) {
          const doc = this.jsonFiles.get(path);
          return doc?.label ? `\u0410\u0440\u0435\u043D\u0430: ${doc.label}` : path;
        }
        if (path.startsWith("codex/")) {
          const doc = this.jsonFiles.get(path);
          return doc?.label ? `\u041A\u043E\u0434\u0435\u043A\u0441: ${doc.label}` : path;
        }
        return path;
      }
      buildDiffSummary(path, baseText, currentText) {
        if (path.endsWith(".json")) {
          try {
            const baseObj = JSON.parse(baseText);
            const curObj = JSON.parse(currentText);
            if (typeof baseObj === "object" && baseObj && typeof curObj === "object" && curObj) {
              const changedKeys = [];
              const allKeys = /* @__PURE__ */ new Set([...Object.keys(baseObj), ...Object.keys(curObj)]);
              for (const k of allKeys) {
                if (JSON.stringify(baseObj[k]) !== JSON.stringify(curObj[k])) {
                  changedKeys.push(k);
                }
              }
              if (changedKeys.length > 0 && changedKeys.length <= 4) {
                return `\u0438\u0437\u043C\u0435\u043D\u0435\u043D\u044B \u043F\u043E\u043B\u044F: ${changedKeys.join(", ")}`;
              } else if (changedKeys.length > 4) {
                return `\u0438\u0437\u043C\u0435\u043D\u0435\u043D\u043E ${changedKeys.length} \u043F\u043E\u043B\u0435\u0439 (${changedKeys.slice(0, 3).join(", ")}\u2026)`;
              }
            }
          } catch {
          }
        }
        return void 0;
      }
      /**
       * Сформировать понятную сводку изменений для чата с ИИ
       */
      getChangesSummaryText() {
        const mods = this.getModifiedFiles();
        if (mods.length === 0) {
          return `\u041A\u0430\u043C\u043F\u0430\u043D\u0438\u044F \xAB${this.meta.title}\xBB (${this.meta.id}): \u043D\u0435\u0442 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439 \u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0435\u043B\u044C\u043D\u043E \u0438\u0441\u0445\u043E\u0434\u043D\u043E\u0433\u043E \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F.`;
        }
        const lines = [
          `### \u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043C\u0430\u0441\u0442\u0435\u0440\u0430 \u0432 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \xAB${this.meta.title}\xBB (${this.meta.id}):`,
          `\u0412\u0441\u0435\u0433\u043E \u0437\u0430\u0442\u0440\u043E\u043D\u0443\u0442\u043E \u0444\u0430\u0439\u043B\u043E\u0432: ${mods.length}`,
          ""
        ];
        for (let i = 0; i < mods.length; i++) {
          const m = mods[i];
          const statusLabel = m.status === "added" ? "\u041D\u043E\u0432\u044B\u0439" : m.status === "deleted" ? "\u0423\u0434\u0430\u043B\u0451\u043D" : "\u0418\u0437\u043C\u0435\u043D\u0451\u043D";
          const detail = m.diffSummary ? ` \u2014 ${m.diffSummary}` : "";
          lines.push(`${i + 1}. [${statusLabel}] ${m.title} (\`${m.path}\`)${detail}`);
        }
        lines.push("");
        lines.push("\u041F\u0440\u0438\u043C\u0435\u043D\u0438 \u044D\u0442\u0438 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043F\u043E\u0432\u0435\u0440\u0445 \u0441\u0432\u043E\u0435\u0439 \u0432\u0435\u0440\u0441\u0438\u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u0438 \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u0439 \u0440\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u043A\u0443 \u0441 \u0438\u0445 \u0443\u0447\u0451\u0442\u043E\u043C.");
        return lines.join("\n");
      }
      allPaths() {
        return [
          "campaign.json",
          "world.json",
          "manifest.json",
          ...this.jsonFiles.keys(),
          ...this.textFiles.keys()
        ];
      }
      /** Сменить каталог назначения (используется при импорте новой кампании). */
      setBasePath(basePath) {
        this.basePath = basePath;
      }
      /** Задать id новой кампании и пометить метаданные для сохранения. */
      setCampaignId(id) {
        this.meta.id = id;
        this.dirty.add("campaign.json");
        this.notify();
      }
      /** "campaigns/<id>" — относительный путь пакета внутри public/ */
      campaignRel() {
        const path = this.basePath.startsWith("http") ? new URL(this.basePath).pathname : this.basePath;
        return path.replace(/^\//, "");
      }
      /** URL dev-эндпоинта сохранения (работает и в браузере, и в node-тестах) */
      saveEndpoint() {
        return this.basePath.startsWith("http") ? new URL("/__editor/save", this.basePath).toString() : "/__editor/save";
      }
      /** сохранить на диск через dev-эндпоинт vite */
      async saveToDisk(paths) {
        const targets = paths ?? [...this.dirty];
        const campaignRel = this.campaignRel();
        for (const p of targets) {
          const res = await fetch(this.saveEndpoint(), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ path: `${campaignRel}/${p}`, text: this.fileText(p) })
          });
          if (!res.ok) throw new Error(`\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 ${p}: ${res.status} ${await res.text()}`);
          this.saved.set(p, this.fileText(p));
          this.dirty.delete(p);
        }
        this.notify();
      }
    };
  }
});

// node_modules/ajv/dist/compile/codegen/code.js
var require_code = __commonJS({
  "node_modules/ajv/dist/compile/codegen/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.regexpCode = exports.getEsmExportName = exports.getProperty = exports.safeStringify = exports.stringify = exports.strConcat = exports.addCodeArg = exports.str = exports._ = exports.nil = exports._Code = exports.Name = exports.IDENTIFIER = exports._CodeOrName = void 0;
    var _CodeOrName = class {
    };
    exports._CodeOrName = _CodeOrName;
    exports.IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;
    var Name = class extends _CodeOrName {
      constructor(s) {
        super();
        if (!exports.IDENTIFIER.test(s))
          throw new Error("CodeGen: name must be a valid identifier");
        this.str = s;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        return false;
      }
      get names() {
        return { [this.str]: 1 };
      }
    };
    exports.Name = Name;
    var _Code = class extends _CodeOrName {
      constructor(code) {
        super();
        this._items = typeof code === "string" ? [code] : code;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        if (this._items.length > 1)
          return false;
        const item = this._items[0];
        return item === "" || item === '""';
      }
      get str() {
        var _a;
        return (_a = this._str) !== null && _a !== void 0 ? _a : this._str = this._items.reduce((s, c) => `${s}${c}`, "");
      }
      get names() {
        var _a;
        return (_a = this._names) !== null && _a !== void 0 ? _a : this._names = this._items.reduce((names, c) => {
          if (c instanceof Name)
            names[c.str] = (names[c.str] || 0) + 1;
          return names;
        }, {});
      }
    };
    exports._Code = _Code;
    exports.nil = new _Code("");
    function _(strs, ...args) {
      const code = [strs[0]];
      let i = 0;
      while (i < args.length) {
        addCodeArg(code, args[i]);
        code.push(strs[++i]);
      }
      return new _Code(code);
    }
    exports._ = _;
    var plus = new _Code("+");
    function str(strs, ...args) {
      const expr = [safeStringify(strs[0])];
      let i = 0;
      while (i < args.length) {
        expr.push(plus);
        addCodeArg(expr, args[i]);
        expr.push(plus, safeStringify(strs[++i]));
      }
      optimize(expr);
      return new _Code(expr);
    }
    exports.str = str;
    function addCodeArg(code, arg) {
      if (arg instanceof _Code)
        code.push(...arg._items);
      else if (arg instanceof Name)
        code.push(arg);
      else
        code.push(interpolate(arg));
    }
    exports.addCodeArg = addCodeArg;
    function optimize(expr) {
      let i = 1;
      while (i < expr.length - 1) {
        if (expr[i] === plus) {
          const res = mergeExprItems(expr[i - 1], expr[i + 1]);
          if (res !== void 0) {
            expr.splice(i - 1, 3, res);
            continue;
          }
          expr[i++] = "+";
        }
        i++;
      }
    }
    function mergeExprItems(a, b) {
      if (b === '""')
        return a;
      if (a === '""')
        return b;
      if (typeof a == "string") {
        if (b instanceof Name || a[a.length - 1] !== '"')
          return;
        if (typeof b != "string")
          return `${a.slice(0, -1)}${b}"`;
        if (b[0] === '"')
          return a.slice(0, -1) + b.slice(1);
        return;
      }
      if (typeof b == "string" && b[0] === '"' && !(a instanceof Name))
        return `"${a}${b.slice(1)}`;
      return;
    }
    function strConcat(c1, c2) {
      return c2.emptyStr() ? c1 : c1.emptyStr() ? c2 : str`${c1}${c2}`;
    }
    exports.strConcat = strConcat;
    function interpolate(x) {
      return typeof x == "number" || typeof x == "boolean" || x === null ? x : safeStringify(Array.isArray(x) ? x.join(",") : x);
    }
    function stringify(x) {
      return new _Code(safeStringify(x));
    }
    exports.stringify = stringify;
    function safeStringify(x) {
      return JSON.stringify(x).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    }
    exports.safeStringify = safeStringify;
    function getProperty(key) {
      return typeof key == "string" && exports.IDENTIFIER.test(key) ? new _Code(`.${key}`) : _`[${key}]`;
    }
    exports.getProperty = getProperty;
    function getEsmExportName(key) {
      if (typeof key == "string" && exports.IDENTIFIER.test(key)) {
        return new _Code(`${key}`);
      }
      throw new Error(`CodeGen: invalid export name: ${key}, use explicit $id name mapping`);
    }
    exports.getEsmExportName = getEsmExportName;
    function regexpCode(rx) {
      return new _Code(rx.toString());
    }
    exports.regexpCode = regexpCode;
  }
});

// node_modules/ajv/dist/compile/codegen/scope.js
var require_scope = __commonJS({
  "node_modules/ajv/dist/compile/codegen/scope.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ValueScope = exports.ValueScopeName = exports.Scope = exports.varKinds = exports.UsedValueState = void 0;
    var code_1 = require_code();
    var ValueError = class extends Error {
      constructor(name) {
        super(`CodeGen: "code" for ${name} not defined`);
        this.value = name.value;
      }
    };
    var UsedValueState;
    (function(UsedValueState2) {
      UsedValueState2[UsedValueState2["Started"] = 0] = "Started";
      UsedValueState2[UsedValueState2["Completed"] = 1] = "Completed";
    })(UsedValueState || (exports.UsedValueState = UsedValueState = {}));
    exports.varKinds = {
      const: new code_1.Name("const"),
      let: new code_1.Name("let"),
      var: new code_1.Name("var")
    };
    var Scope = class {
      constructor({ prefixes, parent } = {}) {
        this._names = {};
        this._prefixes = prefixes;
        this._parent = parent;
      }
      toName(nameOrPrefix) {
        return nameOrPrefix instanceof code_1.Name ? nameOrPrefix : this.name(nameOrPrefix);
      }
      name(prefix) {
        return new code_1.Name(this._newName(prefix));
      }
      _newName(prefix) {
        const ng = this._names[prefix] || this._nameGroup(prefix);
        return `${prefix}${ng.index++}`;
      }
      _nameGroup(prefix) {
        var _a, _b;
        if (((_b = (_a = this._parent) === null || _a === void 0 ? void 0 : _a._prefixes) === null || _b === void 0 ? void 0 : _b.has(prefix)) || this._prefixes && !this._prefixes.has(prefix)) {
          throw new Error(`CodeGen: prefix "${prefix}" is not allowed in this scope`);
        }
        return this._names[prefix] = { prefix, index: 0 };
      }
    };
    exports.Scope = Scope;
    var ValueScopeName = class extends code_1.Name {
      constructor(prefix, nameStr) {
        super(nameStr);
        this.prefix = prefix;
      }
      setValue(value, { property, itemIndex }) {
        this.value = value;
        this.scopePath = (0, code_1._)`.${new code_1.Name(property)}[${itemIndex}]`;
      }
    };
    exports.ValueScopeName = ValueScopeName;
    var line = (0, code_1._)`\n`;
    var ValueScope = class extends Scope {
      constructor(opts) {
        super(opts);
        this._values = {};
        this._scope = opts.scope;
        this.opts = { ...opts, _n: opts.lines ? line : code_1.nil };
      }
      get() {
        return this._scope;
      }
      name(prefix) {
        return new ValueScopeName(prefix, this._newName(prefix));
      }
      value(nameOrPrefix, value) {
        var _a;
        if (value.ref === void 0)
          throw new Error("CodeGen: ref must be passed in value");
        const name = this.toName(nameOrPrefix);
        const { prefix } = name;
        const valueKey = (_a = value.key) !== null && _a !== void 0 ? _a : value.ref;
        let vs = this._values[prefix];
        if (vs) {
          const _name = vs.get(valueKey);
          if (_name)
            return _name;
        } else {
          vs = this._values[prefix] = /* @__PURE__ */ new Map();
        }
        vs.set(valueKey, name);
        const s = this._scope[prefix] || (this._scope[prefix] = []);
        const itemIndex = s.length;
        s[itemIndex] = value.ref;
        name.setValue(value, { property: prefix, itemIndex });
        return name;
      }
      getValue(prefix, keyOrRef) {
        const vs = this._values[prefix];
        if (!vs)
          return;
        return vs.get(keyOrRef);
      }
      scopeRefs(scopeName, values = this._values) {
        return this._reduceValues(values, (name) => {
          if (name.scopePath === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return (0, code_1._)`${scopeName}${name.scopePath}`;
        });
      }
      scopeCode(values = this._values, usedValues, getCode) {
        return this._reduceValues(values, (name) => {
          if (name.value === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return name.value.code;
        }, usedValues, getCode);
      }
      _reduceValues(values, valueCode, usedValues = {}, getCode) {
        let code = code_1.nil;
        for (const prefix in values) {
          const vs = values[prefix];
          if (!vs)
            continue;
          const nameSet = usedValues[prefix] = usedValues[prefix] || /* @__PURE__ */ new Map();
          vs.forEach((name) => {
            if (nameSet.has(name))
              return;
            nameSet.set(name, UsedValueState.Started);
            let c = valueCode(name);
            if (c) {
              const def = this.opts.es5 ? exports.varKinds.var : exports.varKinds.const;
              code = (0, code_1._)`${code}${def} ${name} = ${c};${this.opts._n}`;
            } else if (c = getCode === null || getCode === void 0 ? void 0 : getCode(name)) {
              code = (0, code_1._)`${code}${c}${this.opts._n}`;
            } else {
              throw new ValueError(name);
            }
            nameSet.set(name, UsedValueState.Completed);
          });
        }
        return code;
      }
    };
    exports.ValueScope = ValueScope;
  }
});

// node_modules/ajv/dist/compile/codegen/index.js
var require_codegen = __commonJS({
  "node_modules/ajv/dist/compile/codegen/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.or = exports.and = exports.not = exports.CodeGen = exports.operators = exports.varKinds = exports.ValueScopeName = exports.ValueScope = exports.Scope = exports.Name = exports.regexpCode = exports.stringify = exports.getProperty = exports.nil = exports.strConcat = exports.str = exports._ = void 0;
    var code_1 = require_code();
    var scope_1 = require_scope();
    var code_2 = require_code();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return code_2._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return code_2.str;
    } });
    Object.defineProperty(exports, "strConcat", { enumerable: true, get: function() {
      return code_2.strConcat;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return code_2.nil;
    } });
    Object.defineProperty(exports, "getProperty", { enumerable: true, get: function() {
      return code_2.getProperty;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return code_2.stringify;
    } });
    Object.defineProperty(exports, "regexpCode", { enumerable: true, get: function() {
      return code_2.regexpCode;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return code_2.Name;
    } });
    var scope_2 = require_scope();
    Object.defineProperty(exports, "Scope", { enumerable: true, get: function() {
      return scope_2.Scope;
    } });
    Object.defineProperty(exports, "ValueScope", { enumerable: true, get: function() {
      return scope_2.ValueScope;
    } });
    Object.defineProperty(exports, "ValueScopeName", { enumerable: true, get: function() {
      return scope_2.ValueScopeName;
    } });
    Object.defineProperty(exports, "varKinds", { enumerable: true, get: function() {
      return scope_2.varKinds;
    } });
    exports.operators = {
      GT: new code_1._Code(">"),
      GTE: new code_1._Code(">="),
      LT: new code_1._Code("<"),
      LTE: new code_1._Code("<="),
      EQ: new code_1._Code("==="),
      NEQ: new code_1._Code("!=="),
      NOT: new code_1._Code("!"),
      OR: new code_1._Code("||"),
      AND: new code_1._Code("&&"),
      ADD: new code_1._Code("+")
    };
    var Node = class {
      optimizeNodes() {
        return this;
      }
      optimizeNames(_names, _constants) {
        return this;
      }
    };
    var Def = class extends Node {
      constructor(varKind, name, rhs) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.rhs = rhs;
      }
      render({ es5, _n }) {
        const varKind = es5 ? scope_1.varKinds.var : this.varKind;
        const rhs = this.rhs === void 0 ? "" : ` = ${this.rhs}`;
        return `${varKind} ${this.name}${rhs};` + _n;
      }
      optimizeNames(names, constants) {
        if (!names[this.name.str])
          return;
        if (this.rhs)
          this.rhs = optimizeExpr(this.rhs, names, constants);
        return this;
      }
      get names() {
        return this.rhs instanceof code_1._CodeOrName ? this.rhs.names : {};
      }
    };
    var Assign = class extends Node {
      constructor(lhs, rhs, sideEffects) {
        super();
        this.lhs = lhs;
        this.rhs = rhs;
        this.sideEffects = sideEffects;
      }
      render({ _n }) {
        return `${this.lhs} = ${this.rhs};` + _n;
      }
      optimizeNames(names, constants) {
        if (this.lhs instanceof code_1.Name && !names[this.lhs.str] && !this.sideEffects)
          return;
        this.rhs = optimizeExpr(this.rhs, names, constants);
        return this;
      }
      get names() {
        const names = this.lhs instanceof code_1.Name ? {} : { ...this.lhs.names };
        return addExprNames(names, this.rhs);
      }
    };
    var AssignOp = class extends Assign {
      constructor(lhs, op, rhs, sideEffects) {
        super(lhs, rhs, sideEffects);
        this.op = op;
      }
      render({ _n }) {
        return `${this.lhs} ${this.op}= ${this.rhs};` + _n;
      }
    };
    var Label = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        return `${this.label}:` + _n;
      }
    };
    var Break = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        const label = this.label ? ` ${this.label}` : "";
        return `break${label};` + _n;
      }
    };
    var Throw = class extends Node {
      constructor(error) {
        super();
        this.error = error;
      }
      render({ _n }) {
        return `throw ${this.error};` + _n;
      }
      get names() {
        return this.error.names;
      }
    };
    var AnyCode = class extends Node {
      constructor(code) {
        super();
        this.code = code;
      }
      render({ _n }) {
        return `${this.code};` + _n;
      }
      optimizeNodes() {
        return `${this.code}` ? this : void 0;
      }
      optimizeNames(names, constants) {
        this.code = optimizeExpr(this.code, names, constants);
        return this;
      }
      get names() {
        return this.code instanceof code_1._CodeOrName ? this.code.names : {};
      }
    };
    var ParentNode = class extends Node {
      constructor(nodes = []) {
        super();
        this.nodes = nodes;
      }
      render(opts) {
        return this.nodes.reduce((code, n) => code + n.render(opts), "");
      }
      optimizeNodes() {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i].optimizeNodes();
          if (Array.isArray(n))
            nodes.splice(i, 1, ...n);
          else if (n)
            nodes[i] = n;
          else
            nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      optimizeNames(names, constants) {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i];
          if (n.optimizeNames(names, constants))
            continue;
          subtractNames(names, n.names);
          nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      get names() {
        return this.nodes.reduce((names, n) => addNames(names, n.names), {});
      }
    };
    var BlockNode = class extends ParentNode {
      render(opts) {
        return "{" + opts._n + super.render(opts) + "}" + opts._n;
      }
    };
    var Root = class extends ParentNode {
    };
    var Else = class extends BlockNode {
    };
    Else.kind = "else";
    var If = class _If extends BlockNode {
      constructor(condition, nodes) {
        super(nodes);
        this.condition = condition;
      }
      render(opts) {
        let code = `if(${this.condition})` + super.render(opts);
        if (this.else)
          code += "else " + this.else.render(opts);
        return code;
      }
      optimizeNodes() {
        super.optimizeNodes();
        const cond = this.condition;
        if (cond === true)
          return this.nodes;
        let e = this.else;
        if (e) {
          const ns = e.optimizeNodes();
          e = this.else = Array.isArray(ns) ? new Else(ns) : ns;
        }
        if (e) {
          if (cond === false)
            return e instanceof _If ? e : e.nodes;
          if (this.nodes.length)
            return this;
          return new _If(not(cond), e instanceof _If ? [e] : e.nodes);
        }
        if (cond === false || !this.nodes.length)
          return void 0;
        return this;
      }
      optimizeNames(names, constants) {
        var _a;
        this.else = (_a = this.else) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
        if (!(super.optimizeNames(names, constants) || this.else))
          return;
        this.condition = optimizeExpr(this.condition, names, constants);
        return this;
      }
      get names() {
        const names = super.names;
        addExprNames(names, this.condition);
        if (this.else)
          addNames(names, this.else.names);
        return names;
      }
    };
    If.kind = "if";
    var For = class extends BlockNode {
    };
    For.kind = "for";
    var ForLoop = class extends For {
      constructor(iteration) {
        super();
        this.iteration = iteration;
      }
      render(opts) {
        return `for(${this.iteration})` + super.render(opts);
      }
      optimizeNames(names, constants) {
        if (!super.optimizeNames(names, constants))
          return;
        this.iteration = optimizeExpr(this.iteration, names, constants);
        return this;
      }
      get names() {
        return addNames(super.names, this.iteration.names);
      }
    };
    var ForRange = class extends For {
      constructor(varKind, name, from, to) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.from = from;
        this.to = to;
      }
      render(opts) {
        const varKind = opts.es5 ? scope_1.varKinds.var : this.varKind;
        const { name, from, to } = this;
        return `for(${varKind} ${name}=${from}; ${name}<${to}; ${name}++)` + super.render(opts);
      }
      get names() {
        const names = addExprNames(super.names, this.from);
        return addExprNames(names, this.to);
      }
    };
    var ForIter = class extends For {
      constructor(loop, varKind, name, iterable) {
        super();
        this.loop = loop;
        this.varKind = varKind;
        this.name = name;
        this.iterable = iterable;
      }
      render(opts) {
        return `for(${this.varKind} ${this.name} ${this.loop} ${this.iterable})` + super.render(opts);
      }
      optimizeNames(names, constants) {
        if (!super.optimizeNames(names, constants))
          return;
        this.iterable = optimizeExpr(this.iterable, names, constants);
        return this;
      }
      get names() {
        return addNames(super.names, this.iterable.names);
      }
    };
    var Func = class extends BlockNode {
      constructor(name, args, async) {
        super();
        this.name = name;
        this.args = args;
        this.async = async;
      }
      render(opts) {
        const _async = this.async ? "async " : "";
        return `${_async}function ${this.name}(${this.args})` + super.render(opts);
      }
    };
    Func.kind = "func";
    var Return = class extends ParentNode {
      render(opts) {
        return "return " + super.render(opts);
      }
    };
    Return.kind = "return";
    var Try = class extends BlockNode {
      render(opts) {
        let code = "try" + super.render(opts);
        if (this.catch)
          code += this.catch.render(opts);
        if (this.finally)
          code += this.finally.render(opts);
        return code;
      }
      optimizeNodes() {
        var _a, _b;
        super.optimizeNodes();
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNodes();
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNodes();
        return this;
      }
      optimizeNames(names, constants) {
        var _a, _b;
        super.optimizeNames(names, constants);
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNames(names, constants);
        return this;
      }
      get names() {
        const names = super.names;
        if (this.catch)
          addNames(names, this.catch.names);
        if (this.finally)
          addNames(names, this.finally.names);
        return names;
      }
    };
    var Catch = class extends BlockNode {
      constructor(error) {
        super();
        this.error = error;
      }
      render(opts) {
        return `catch(${this.error})` + super.render(opts);
      }
    };
    Catch.kind = "catch";
    var Finally = class extends BlockNode {
      render(opts) {
        return "finally" + super.render(opts);
      }
    };
    Finally.kind = "finally";
    var CodeGen = class {
      constructor(extScope, opts = {}) {
        this._values = {};
        this._blockStarts = [];
        this._constants = {};
        this.opts = { ...opts, _n: opts.lines ? "\n" : "" };
        this._extScope = extScope;
        this._scope = new scope_1.Scope({ parent: extScope });
        this._nodes = [new Root()];
      }
      toString() {
        return this._root.render(this.opts);
      }
      // returns unique name in the internal scope
      name(prefix) {
        return this._scope.name(prefix);
      }
      // reserves unique name in the external scope
      scopeName(prefix) {
        return this._extScope.name(prefix);
      }
      // reserves unique name in the external scope and assigns value to it
      scopeValue(prefixOrName, value) {
        const name = this._extScope.value(prefixOrName, value);
        const vs = this._values[name.prefix] || (this._values[name.prefix] = /* @__PURE__ */ new Set());
        vs.add(name);
        return name;
      }
      getScopeValue(prefix, keyOrRef) {
        return this._extScope.getValue(prefix, keyOrRef);
      }
      // return code that assigns values in the external scope to the names that are used internally
      // (same names that were returned by gen.scopeName or gen.scopeValue)
      scopeRefs(scopeName) {
        return this._extScope.scopeRefs(scopeName, this._values);
      }
      scopeCode() {
        return this._extScope.scopeCode(this._values);
      }
      _def(varKind, nameOrPrefix, rhs, constant) {
        const name = this._scope.toName(nameOrPrefix);
        if (rhs !== void 0 && constant)
          this._constants[name.str] = rhs;
        this._leafNode(new Def(varKind, name, rhs));
        return name;
      }
      // `const` declaration (`var` in es5 mode)
      const(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.const, nameOrPrefix, rhs, _constant);
      }
      // `let` declaration with optional assignment (`var` in es5 mode)
      let(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.let, nameOrPrefix, rhs, _constant);
      }
      // `var` declaration with optional assignment
      var(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.var, nameOrPrefix, rhs, _constant);
      }
      // assignment code
      assign(lhs, rhs, sideEffects) {
        return this._leafNode(new Assign(lhs, rhs, sideEffects));
      }
      // `+=` code
      add(lhs, rhs) {
        return this._leafNode(new AssignOp(lhs, exports.operators.ADD, rhs));
      }
      // appends passed SafeExpr to code or executes Block
      code(c) {
        if (typeof c == "function")
          c();
        else if (c !== code_1.nil)
          this._leafNode(new AnyCode(c));
        return this;
      }
      // returns code for object literal for the passed argument list of key-value pairs
      object(...keyValues) {
        const code = ["{"];
        for (const [key, value] of keyValues) {
          if (code.length > 1)
            code.push(",");
          code.push(key);
          if (key !== value || this.opts.es5) {
            code.push(":");
            (0, code_1.addCodeArg)(code, value);
          }
        }
        code.push("}");
        return new code_1._Code(code);
      }
      // `if` clause (or statement if `thenBody` and, optionally, `elseBody` are passed)
      if(condition, thenBody, elseBody) {
        this._blockNode(new If(condition));
        if (thenBody && elseBody) {
          this.code(thenBody).else().code(elseBody).endIf();
        } else if (thenBody) {
          this.code(thenBody).endIf();
        } else if (elseBody) {
          throw new Error('CodeGen: "else" body without "then" body');
        }
        return this;
      }
      // `else if` clause - invalid without `if` or after `else` clauses
      elseIf(condition) {
        return this._elseNode(new If(condition));
      }
      // `else` clause - only valid after `if` or `else if` clauses
      else() {
        return this._elseNode(new Else());
      }
      // end `if` statement (needed if gen.if was used only with condition)
      endIf() {
        return this._endBlockNode(If, Else);
      }
      _for(node, forBody) {
        this._blockNode(node);
        if (forBody)
          this.code(forBody).endFor();
        return this;
      }
      // a generic `for` clause (or statement if `forBody` is passed)
      for(iteration, forBody) {
        return this._for(new ForLoop(iteration), forBody);
      }
      // `for` statement for a range of values
      forRange(nameOrPrefix, from, to, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.let) {
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForRange(varKind, name, from, to), () => forBody(name));
      }
      // `for-of` statement (in es5 mode replace with a normal for loop)
      forOf(nameOrPrefix, iterable, forBody, varKind = scope_1.varKinds.const) {
        const name = this._scope.toName(nameOrPrefix);
        if (this.opts.es5) {
          const arr = iterable instanceof code_1.Name ? iterable : this.var("_arr", iterable);
          return this.forRange("_i", 0, (0, code_1._)`${arr}.length`, (i) => {
            this.var(name, (0, code_1._)`${arr}[${i}]`);
            forBody(name);
          });
        }
        return this._for(new ForIter("of", varKind, name, iterable), () => forBody(name));
      }
      // `for-in` statement.
      // With option `ownProperties` replaced with a `for-of` loop for object keys
      forIn(nameOrPrefix, obj, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.const) {
        if (this.opts.ownProperties) {
          return this.forOf(nameOrPrefix, (0, code_1._)`Object.keys(${obj})`, forBody);
        }
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForIter("in", varKind, name, obj), () => forBody(name));
      }
      // end `for` loop
      endFor() {
        return this._endBlockNode(For);
      }
      // `label` statement
      label(label) {
        return this._leafNode(new Label(label));
      }
      // `break` statement
      break(label) {
        return this._leafNode(new Break(label));
      }
      // `return` statement
      return(value) {
        const node = new Return();
        this._blockNode(node);
        this.code(value);
        if (node.nodes.length !== 1)
          throw new Error('CodeGen: "return" should have one node');
        return this._endBlockNode(Return);
      }
      // `try` statement
      try(tryBody, catchCode, finallyCode) {
        if (!catchCode && !finallyCode)
          throw new Error('CodeGen: "try" without "catch" and "finally"');
        const node = new Try();
        this._blockNode(node);
        this.code(tryBody);
        if (catchCode) {
          const error = this.name("e");
          this._currNode = node.catch = new Catch(error);
          catchCode(error);
        }
        if (finallyCode) {
          this._currNode = node.finally = new Finally();
          this.code(finallyCode);
        }
        return this._endBlockNode(Catch, Finally);
      }
      // `throw` statement
      throw(error) {
        return this._leafNode(new Throw(error));
      }
      // start self-balancing block
      block(body, nodeCount) {
        this._blockStarts.push(this._nodes.length);
        if (body)
          this.code(body).endBlock(nodeCount);
        return this;
      }
      // end the current self-balancing block
      endBlock(nodeCount) {
        const len = this._blockStarts.pop();
        if (len === void 0)
          throw new Error("CodeGen: not in self-balancing block");
        const toClose = this._nodes.length - len;
        if (toClose < 0 || nodeCount !== void 0 && toClose !== nodeCount) {
          throw new Error(`CodeGen: wrong number of nodes: ${toClose} vs ${nodeCount} expected`);
        }
        this._nodes.length = len;
        return this;
      }
      // `function` heading (or definition if funcBody is passed)
      func(name, args = code_1.nil, async, funcBody) {
        this._blockNode(new Func(name, args, async));
        if (funcBody)
          this.code(funcBody).endFunc();
        return this;
      }
      // end function definition
      endFunc() {
        return this._endBlockNode(Func);
      }
      optimize(n = 1) {
        while (n-- > 0) {
          this._root.optimizeNodes();
          this._root.optimizeNames(this._root.names, this._constants);
        }
      }
      _leafNode(node) {
        this._currNode.nodes.push(node);
        return this;
      }
      _blockNode(node) {
        this._currNode.nodes.push(node);
        this._nodes.push(node);
      }
      _endBlockNode(N1, N2) {
        const n = this._currNode;
        if (n instanceof N1 || N2 && n instanceof N2) {
          this._nodes.pop();
          return this;
        }
        throw new Error(`CodeGen: not in block "${N2 ? `${N1.kind}/${N2.kind}` : N1.kind}"`);
      }
      _elseNode(node) {
        const n = this._currNode;
        if (!(n instanceof If)) {
          throw new Error('CodeGen: "else" without "if"');
        }
        this._currNode = n.else = node;
        return this;
      }
      get _root() {
        return this._nodes[0];
      }
      get _currNode() {
        const ns = this._nodes;
        return ns[ns.length - 1];
      }
      set _currNode(node) {
        const ns = this._nodes;
        ns[ns.length - 1] = node;
      }
    };
    exports.CodeGen = CodeGen;
    function addNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) + (from[n] || 0);
      return names;
    }
    function addExprNames(names, from) {
      return from instanceof code_1._CodeOrName ? addNames(names, from.names) : names;
    }
    function optimizeExpr(expr, names, constants) {
      if (expr instanceof code_1.Name)
        return replaceName(expr);
      if (!canOptimize(expr))
        return expr;
      return new code_1._Code(expr._items.reduce((items, c) => {
        if (c instanceof code_1.Name)
          c = replaceName(c);
        if (c instanceof code_1._Code)
          items.push(...c._items);
        else
          items.push(c);
        return items;
      }, []));
      function replaceName(n) {
        const c = constants[n.str];
        if (c === void 0 || names[n.str] !== 1)
          return n;
        delete names[n.str];
        return c;
      }
      function canOptimize(e) {
        return e instanceof code_1._Code && e._items.some((c) => c instanceof code_1.Name && names[c.str] === 1 && constants[c.str] !== void 0);
      }
    }
    function subtractNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) - (from[n] || 0);
    }
    function not(x) {
      return typeof x == "boolean" || typeof x == "number" || x === null ? !x : (0, code_1._)`!${par(x)}`;
    }
    exports.not = not;
    var andCode = mappend(exports.operators.AND);
    function and(...args) {
      return args.reduce(andCode);
    }
    exports.and = and;
    var orCode = mappend(exports.operators.OR);
    function or(...args) {
      return args.reduce(orCode);
    }
    exports.or = or;
    function mappend(op) {
      return (x, y) => x === code_1.nil ? y : y === code_1.nil ? x : (0, code_1._)`${par(x)} ${op} ${par(y)}`;
    }
    function par(x) {
      return x instanceof code_1.Name ? x : (0, code_1._)`(${x})`;
    }
  }
});

// node_modules/ajv/dist/compile/util.js
var require_util = __commonJS({
  "node_modules/ajv/dist/compile/util.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.checkStrictMode = exports.getErrorPath = exports.Type = exports.useFunc = exports.setEvaluated = exports.evaluatedPropsToName = exports.mergeEvaluated = exports.eachItem = exports.unescapeJsonPointer = exports.escapeJsonPointer = exports.escapeFragment = exports.unescapeFragment = exports.schemaRefOrVal = exports.schemaHasRulesButRef = exports.schemaHasRules = exports.checkUnknownRules = exports.alwaysValidSchema = exports.toHash = void 0;
    var codegen_1 = require_codegen();
    var code_1 = require_code();
    function toHash(arr) {
      const hash = {};
      for (const item of arr)
        hash[item] = true;
      return hash;
    }
    exports.toHash = toHash;
    function alwaysValidSchema(it, schema2) {
      if (typeof schema2 == "boolean")
        return schema2;
      if (Object.keys(schema2).length === 0)
        return true;
      checkUnknownRules(it, schema2);
      return !schemaHasRules(schema2, it.self.RULES.all);
    }
    exports.alwaysValidSchema = alwaysValidSchema;
    function checkUnknownRules(it, schema2 = it.schema) {
      const { opts, self: self2 } = it;
      if (!opts.strictSchema)
        return;
      if (typeof schema2 === "boolean")
        return;
      const rules = self2.RULES.keywords;
      for (const key in schema2) {
        if (!rules[key])
          checkStrictMode(it, `unknown keyword: "${key}"`);
      }
    }
    exports.checkUnknownRules = checkUnknownRules;
    function schemaHasRules(schema2, rules) {
      if (typeof schema2 == "boolean")
        return !schema2;
      for (const key in schema2)
        if (rules[key])
          return true;
      return false;
    }
    exports.schemaHasRules = schemaHasRules;
    function schemaHasRulesButRef(schema2, RULES) {
      if (typeof schema2 == "boolean")
        return !schema2;
      for (const key in schema2)
        if (key !== "$ref" && RULES.all[key])
          return true;
      return false;
    }
    exports.schemaHasRulesButRef = schemaHasRulesButRef;
    function schemaRefOrVal({ topSchemaRef, schemaPath }, schema2, keyword, $data) {
      if (!$data) {
        if (typeof schema2 == "number" || typeof schema2 == "boolean")
          return schema2;
        if (typeof schema2 == "string")
          return (0, codegen_1._)`${schema2}`;
      }
      return (0, codegen_1._)`${topSchemaRef}${schemaPath}${(0, codegen_1.getProperty)(keyword)}`;
    }
    exports.schemaRefOrVal = schemaRefOrVal;
    function unescapeFragment(str) {
      return unescapeJsonPointer(decodeURIComponent(str));
    }
    exports.unescapeFragment = unescapeFragment;
    function escapeFragment(str) {
      return encodeURIComponent(escapeJsonPointer(str));
    }
    exports.escapeFragment = escapeFragment;
    function escapeJsonPointer(str) {
      if (typeof str == "number")
        return `${str}`;
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
    exports.escapeJsonPointer = escapeJsonPointer;
    function unescapeJsonPointer(str) {
      return str.replace(/~1/g, "/").replace(/~0/g, "~");
    }
    exports.unescapeJsonPointer = unescapeJsonPointer;
    function eachItem(xs, f) {
      if (Array.isArray(xs)) {
        for (const x of xs)
          f(x);
      } else {
        f(xs);
      }
    }
    exports.eachItem = eachItem;
    function makeMergeEvaluated({ mergeNames, mergeToName, mergeValues, resultToName }) {
      return (gen, from, to, toName) => {
        const res = to === void 0 ? from : to instanceof codegen_1.Name ? (from instanceof codegen_1.Name ? mergeNames(gen, from, to) : mergeToName(gen, from, to), to) : from instanceof codegen_1.Name ? (mergeToName(gen, to, from), from) : mergeValues(from, to);
        return toName === codegen_1.Name && !(res instanceof codegen_1.Name) ? resultToName(gen, res) : res;
      };
    }
    exports.mergeEvaluated = {
      props: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => {
          gen.if((0, codegen_1._)`${from} === true`, () => gen.assign(to, true), () => gen.assign(to, (0, codegen_1._)`${to} || {}`).code((0, codegen_1._)`Object.assign(${to}, ${from})`));
        }),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => {
          if (from === true) {
            gen.assign(to, true);
          } else {
            gen.assign(to, (0, codegen_1._)`${to} || {}`);
            setEvaluated(gen, to, from);
          }
        }),
        mergeValues: (from, to) => from === true ? true : { ...from, ...to },
        resultToName: evaluatedPropsToName
      }),
      items: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => gen.assign(to, (0, codegen_1._)`${from} === true ? true : ${to} > ${from} ? ${to} : ${from}`)),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => gen.assign(to, from === true ? true : (0, codegen_1._)`${to} > ${from} ? ${to} : ${from}`)),
        mergeValues: (from, to) => from === true ? true : Math.max(from, to),
        resultToName: (gen, items) => gen.var("items", items)
      })
    };
    function evaluatedPropsToName(gen, ps) {
      if (ps === true)
        return gen.var("props", true);
      const props = gen.var("props", (0, codegen_1._)`{}`);
      if (ps !== void 0)
        setEvaluated(gen, props, ps);
      return props;
    }
    exports.evaluatedPropsToName = evaluatedPropsToName;
    function setEvaluated(gen, props, ps) {
      Object.keys(ps).forEach((p) => gen.assign((0, codegen_1._)`${props}${(0, codegen_1.getProperty)(p)}`, true));
    }
    exports.setEvaluated = setEvaluated;
    var snippets = {};
    function useFunc(gen, f) {
      return gen.scopeValue("func", {
        ref: f,
        code: snippets[f.code] || (snippets[f.code] = new code_1._Code(f.code))
      });
    }
    exports.useFunc = useFunc;
    var Type;
    (function(Type2) {
      Type2[Type2["Num"] = 0] = "Num";
      Type2[Type2["Str"] = 1] = "Str";
    })(Type || (exports.Type = Type = {}));
    function getErrorPath(dataProp, dataPropType, jsPropertySyntax) {
      if (dataProp instanceof codegen_1.Name) {
        const isNumber = dataPropType === Type.Num;
        return jsPropertySyntax ? isNumber ? (0, codegen_1._)`"[" + ${dataProp} + "]"` : (0, codegen_1._)`"['" + ${dataProp} + "']"` : isNumber ? (0, codegen_1._)`"/" + ${dataProp}` : (0, codegen_1._)`"/" + ${dataProp}.replace(/~/g, "~0").replace(/\\//g, "~1")`;
      }
      return jsPropertySyntax ? (0, codegen_1.getProperty)(dataProp).toString() : "/" + escapeJsonPointer(dataProp);
    }
    exports.getErrorPath = getErrorPath;
    function checkStrictMode(it, msg, mode = it.opts.strictSchema) {
      if (!mode)
        return;
      msg = `strict mode: ${msg}`;
      if (mode === true)
        throw new Error(msg);
      it.self.logger.warn(msg);
    }
    exports.checkStrictMode = checkStrictMode;
  }
});

// node_modules/ajv/dist/compile/names.js
var require_names = __commonJS({
  "node_modules/ajv/dist/compile/names.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var names = {
      // validation function arguments
      data: new codegen_1.Name("data"),
      // data passed to validation function
      // args passed from referencing schema
      valCxt: new codegen_1.Name("valCxt"),
      // validation/data context - should not be used directly, it is destructured to the names below
      instancePath: new codegen_1.Name("instancePath"),
      parentData: new codegen_1.Name("parentData"),
      parentDataProperty: new codegen_1.Name("parentDataProperty"),
      rootData: new codegen_1.Name("rootData"),
      // root data - same as the data passed to the first/top validation function
      dynamicAnchors: new codegen_1.Name("dynamicAnchors"),
      // used to support recursiveRef and dynamicRef
      // function scoped variables
      vErrors: new codegen_1.Name("vErrors"),
      // null or array of validation errors
      errors: new codegen_1.Name("errors"),
      // counter of validation errors
      this: new codegen_1.Name("this"),
      // "globals"
      self: new codegen_1.Name("self"),
      scope: new codegen_1.Name("scope"),
      // JTD serialize/parse name for JSON string and position
      json: new codegen_1.Name("json"),
      jsonPos: new codegen_1.Name("jsonPos"),
      jsonLen: new codegen_1.Name("jsonLen"),
      jsonPart: new codegen_1.Name("jsonPart")
    };
    exports.default = names;
  }
});

// node_modules/ajv/dist/compile/errors.js
var require_errors = __commonJS({
  "node_modules/ajv/dist/compile/errors.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendErrors = exports.resetErrorsCount = exports.reportExtraError = exports.reportError = exports.keyword$DataError = exports.keywordError = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    exports.keywordError = {
      message: ({ keyword }) => (0, codegen_1.str)`must pass "${keyword}" keyword validation`
    };
    exports.keyword$DataError = {
      message: ({ keyword, schemaType }) => schemaType ? (0, codegen_1.str)`"${keyword}" keyword must be ${schemaType} ($data)` : (0, codegen_1.str)`"${keyword}" keyword is invalid ($data)`
    };
    function reportError(cxt, error = exports.keywordError, errorPaths, overrideAllErrors) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      if (overrideAllErrors !== null && overrideAllErrors !== void 0 ? overrideAllErrors : compositeRule || allErrors) {
        addError(gen, errObj);
      } else {
        returnErrors(it, (0, codegen_1._)`[${errObj}]`);
      }
    }
    exports.reportError = reportError;
    function reportExtraError(cxt, error = exports.keywordError, errorPaths) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      addError(gen, errObj);
      if (!(compositeRule || allErrors)) {
        returnErrors(it, names_1.default.vErrors);
      }
    }
    exports.reportExtraError = reportExtraError;
    function resetErrorsCount(gen, errsCount) {
      gen.assign(names_1.default.errors, errsCount);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} !== null`, () => gen.if(errsCount, () => gen.assign((0, codegen_1._)`${names_1.default.vErrors}.length`, errsCount), () => gen.assign(names_1.default.vErrors, null)));
    }
    exports.resetErrorsCount = resetErrorsCount;
    function extendErrors({ gen, keyword, schemaValue, data, errsCount, it }) {
      if (errsCount === void 0)
        throw new Error("ajv implementation error");
      const err = gen.name("err");
      gen.forRange("i", errsCount, names_1.default.errors, (i) => {
        gen.const(err, (0, codegen_1._)`${names_1.default.vErrors}[${i}]`);
        gen.if((0, codegen_1._)`${err}.instancePath === undefined`, () => gen.assign((0, codegen_1._)`${err}.instancePath`, (0, codegen_1.strConcat)(names_1.default.instancePath, it.errorPath)));
        gen.assign((0, codegen_1._)`${err}.schemaPath`, (0, codegen_1.str)`${it.errSchemaPath}/${keyword}`);
        if (it.opts.verbose) {
          gen.assign((0, codegen_1._)`${err}.schema`, schemaValue);
          gen.assign((0, codegen_1._)`${err}.data`, data);
        }
      });
    }
    exports.extendErrors = extendErrors;
    function addError(gen, errObj) {
      const err = gen.const("err", errObj);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} === null`, () => gen.assign(names_1.default.vErrors, (0, codegen_1._)`[${err}]`), (0, codegen_1._)`${names_1.default.vErrors}.push(${err})`);
      gen.code((0, codegen_1._)`${names_1.default.errors}++`);
    }
    function returnErrors(it, errs) {
      const { gen, validateName, schemaEnv } = it;
      if (schemaEnv.$async) {
        gen.throw((0, codegen_1._)`new ${it.ValidationError}(${errs})`);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, errs);
        gen.return(false);
      }
    }
    var E = {
      keyword: new codegen_1.Name("keyword"),
      schemaPath: new codegen_1.Name("schemaPath"),
      // also used in JTD errors
      params: new codegen_1.Name("params"),
      propertyName: new codegen_1.Name("propertyName"),
      message: new codegen_1.Name("message"),
      schema: new codegen_1.Name("schema"),
      parentSchema: new codegen_1.Name("parentSchema")
    };
    function errorObjectCode(cxt, error, errorPaths) {
      const { createErrors } = cxt.it;
      if (createErrors === false)
        return (0, codegen_1._)`{}`;
      return errorObject(cxt, error, errorPaths);
    }
    function errorObject(cxt, error, errorPaths = {}) {
      const { gen, it } = cxt;
      const keyValues = [
        errorInstancePath(it, errorPaths),
        errorSchemaPath(cxt, errorPaths)
      ];
      extraErrorProps(cxt, error, keyValues);
      return gen.object(...keyValues);
    }
    function errorInstancePath({ errorPath }, { instancePath }) {
      const instPath = instancePath ? (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(instancePath, util_1.Type.Str)}` : errorPath;
      return [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, instPath)];
    }
    function errorSchemaPath({ keyword, it: { errSchemaPath } }, { schemaPath, parentSchema }) {
      let schPath = parentSchema ? errSchemaPath : (0, codegen_1.str)`${errSchemaPath}/${keyword}`;
      if (schemaPath) {
        schPath = (0, codegen_1.str)`${schPath}${(0, util_1.getErrorPath)(schemaPath, util_1.Type.Str)}`;
      }
      return [E.schemaPath, schPath];
    }
    function extraErrorProps(cxt, { params, message }, keyValues) {
      const { keyword, data, schemaValue, it } = cxt;
      const { opts, propertyName, topSchemaRef, schemaPath } = it;
      keyValues.push([E.keyword, keyword], [E.params, typeof params == "function" ? params(cxt) : params || (0, codegen_1._)`{}`]);
      if (opts.messages) {
        keyValues.push([E.message, typeof message == "function" ? message(cxt) : message]);
      }
      if (opts.verbose) {
        keyValues.push([E.schema, schemaValue], [E.parentSchema, (0, codegen_1._)`${topSchemaRef}${schemaPath}`], [names_1.default.data, data]);
      }
      if (propertyName)
        keyValues.push([E.propertyName, propertyName]);
    }
  }
});

// node_modules/ajv/dist/compile/validate/boolSchema.js
var require_boolSchema = __commonJS({
  "node_modules/ajv/dist/compile/validate/boolSchema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.boolOrEmptySchema = exports.topBoolOrEmptySchema = void 0;
    var errors_1 = require_errors();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var boolError = {
      message: "boolean schema is false"
    };
    function topBoolOrEmptySchema(it) {
      const { gen, schema: schema2, validateName } = it;
      if (schema2 === false) {
        falseSchemaError(it, false);
      } else if (typeof schema2 == "object" && schema2.$async === true) {
        gen.return(names_1.default.data);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, null);
        gen.return(true);
      }
    }
    exports.topBoolOrEmptySchema = topBoolOrEmptySchema;
    function boolOrEmptySchema(it, valid) {
      const { gen, schema: schema2 } = it;
      if (schema2 === false) {
        gen.var(valid, false);
        falseSchemaError(it);
      } else {
        gen.var(valid, true);
      }
    }
    exports.boolOrEmptySchema = boolOrEmptySchema;
    function falseSchemaError(it, overrideAllErrors) {
      const { gen, data } = it;
      const cxt = {
        gen,
        keyword: "false schema",
        data,
        schema: false,
        schemaCode: false,
        schemaValue: false,
        params: {},
        it
      };
      (0, errors_1.reportError)(cxt, boolError, void 0, overrideAllErrors);
    }
  }
});

// node_modules/ajv/dist/compile/rules.js
var require_rules = __commonJS({
  "node_modules/ajv/dist/compile/rules.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getRules = exports.isJSONType = void 0;
    var _jsonTypes = ["string", "number", "integer", "boolean", "null", "object", "array"];
    var jsonTypes = new Set(_jsonTypes);
    function isJSONType(x) {
      return typeof x == "string" && jsonTypes.has(x);
    }
    exports.isJSONType = isJSONType;
    function getRules() {
      const groups = {
        number: { type: "number", rules: [] },
        string: { type: "string", rules: [] },
        array: { type: "array", rules: [] },
        object: { type: "object", rules: [] }
      };
      return {
        types: { ...groups, integer: true, boolean: true, null: true },
        rules: [{ rules: [] }, groups.number, groups.string, groups.array, groups.object],
        post: { rules: [] },
        all: {},
        keywords: {}
      };
    }
    exports.getRules = getRules;
  }
});

// node_modules/ajv/dist/compile/validate/applicability.js
var require_applicability = __commonJS({
  "node_modules/ajv/dist/compile/validate/applicability.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.shouldUseRule = exports.shouldUseGroup = exports.schemaHasRulesForType = void 0;
    function schemaHasRulesForType({ schema: schema2, self: self2 }, type) {
      const group = self2.RULES.types[type];
      return group && group !== true && shouldUseGroup(schema2, group);
    }
    exports.schemaHasRulesForType = schemaHasRulesForType;
    function shouldUseGroup(schema2, group) {
      return group.rules.some((rule) => shouldUseRule(schema2, rule));
    }
    exports.shouldUseGroup = shouldUseGroup;
    function shouldUseRule(schema2, rule) {
      var _a;
      return schema2[rule.keyword] !== void 0 || ((_a = rule.definition.implements) === null || _a === void 0 ? void 0 : _a.some((kwd) => schema2[kwd] !== void 0));
    }
    exports.shouldUseRule = shouldUseRule;
  }
});

// node_modules/ajv/dist/compile/validate/dataType.js
var require_dataType = __commonJS({
  "node_modules/ajv/dist/compile/validate/dataType.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.reportTypeError = exports.checkDataTypes = exports.checkDataType = exports.coerceAndCheckDataType = exports.getJSONTypes = exports.getSchemaTypes = exports.DataType = void 0;
    var rules_1 = require_rules();
    var applicability_1 = require_applicability();
    var errors_1 = require_errors();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var DataType;
    (function(DataType2) {
      DataType2[DataType2["Correct"] = 0] = "Correct";
      DataType2[DataType2["Wrong"] = 1] = "Wrong";
    })(DataType || (exports.DataType = DataType = {}));
    function getSchemaTypes(schema2) {
      const types = getJSONTypes(schema2.type);
      const hasNull = types.includes("null");
      if (hasNull) {
        if (schema2.nullable === false)
          throw new Error("type: null contradicts nullable: false");
      } else {
        if (!types.length && schema2.nullable !== void 0) {
          throw new Error('"nullable" cannot be used without "type"');
        }
        if (schema2.nullable === true)
          types.push("null");
      }
      return types;
    }
    exports.getSchemaTypes = getSchemaTypes;
    function getJSONTypes(ts) {
      const types = Array.isArray(ts) ? ts : ts ? [ts] : [];
      if (types.every(rules_1.isJSONType))
        return types;
      throw new Error("type must be JSONType or JSONType[]: " + types.join(","));
    }
    exports.getJSONTypes = getJSONTypes;
    function coerceAndCheckDataType(it, types) {
      const { gen, data, opts } = it;
      const coerceTo = coerceToTypes(types, opts.coerceTypes);
      const checkTypes = types.length > 0 && !(coerceTo.length === 0 && types.length === 1 && (0, applicability_1.schemaHasRulesForType)(it, types[0]));
      if (checkTypes) {
        const wrongType = checkDataTypes(types, data, opts.strictNumbers, DataType.Wrong);
        gen.if(wrongType, () => {
          if (coerceTo.length)
            coerceData(it, types, coerceTo);
          else
            reportTypeError(it);
        });
      }
      return checkTypes;
    }
    exports.coerceAndCheckDataType = coerceAndCheckDataType;
    var COERCIBLE = /* @__PURE__ */ new Set(["string", "number", "integer", "boolean", "null"]);
    function coerceToTypes(types, coerceTypes) {
      return coerceTypes ? types.filter((t) => COERCIBLE.has(t) || coerceTypes === "array" && t === "array") : [];
    }
    function coerceData(it, types, coerceTo) {
      const { gen, data, opts } = it;
      const dataType = gen.let("dataType", (0, codegen_1._)`typeof ${data}`);
      const coerced = gen.let("coerced", (0, codegen_1._)`undefined`);
      if (opts.coerceTypes === "array") {
        gen.if((0, codegen_1._)`${dataType} == 'object' && Array.isArray(${data}) && ${data}.length == 1`, () => gen.assign(data, (0, codegen_1._)`${data}[0]`).assign(dataType, (0, codegen_1._)`typeof ${data}`).if(checkDataTypes(types, data, opts.strictNumbers), () => gen.assign(coerced, data)));
      }
      gen.if((0, codegen_1._)`${coerced} !== undefined`);
      for (const t of coerceTo) {
        if (COERCIBLE.has(t) || t === "array" && opts.coerceTypes === "array") {
          coerceSpecificType(t);
        }
      }
      gen.else();
      reportTypeError(it);
      gen.endIf();
      gen.if((0, codegen_1._)`${coerced} !== undefined`, () => {
        gen.assign(data, coerced);
        assignParentData(it, coerced);
      });
      function coerceSpecificType(t) {
        switch (t) {
          case "string":
            gen.elseIf((0, codegen_1._)`${dataType} == "number" || ${dataType} == "boolean"`).assign(coerced, (0, codegen_1._)`"" + ${data}`).elseIf((0, codegen_1._)`${data} === null`).assign(coerced, (0, codegen_1._)`""`);
            return;
          case "number":
            gen.elseIf((0, codegen_1._)`${dataType} == "boolean" || ${data} === null
              || (${dataType} == "string" && ${data} && ${data} == +${data})`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "integer":
            gen.elseIf((0, codegen_1._)`${dataType} === "boolean" || ${data} === null
              || (${dataType} === "string" && ${data} && ${data} == +${data} && !(${data} % 1))`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "boolean":
            gen.elseIf((0, codegen_1._)`${data} === "false" || ${data} === 0 || ${data} === null`).assign(coerced, false).elseIf((0, codegen_1._)`${data} === "true" || ${data} === 1`).assign(coerced, true);
            return;
          case "null":
            gen.elseIf((0, codegen_1._)`${data} === "" || ${data} === 0 || ${data} === false`);
            gen.assign(coerced, null);
            return;
          case "array":
            gen.elseIf((0, codegen_1._)`${dataType} === "string" || ${dataType} === "number"
              || ${dataType} === "boolean" || ${data} === null`).assign(coerced, (0, codegen_1._)`[${data}]`);
        }
      }
    }
    function assignParentData({ gen, parentData, parentDataProperty }, expr) {
      gen.if((0, codegen_1._)`${parentData} !== undefined`, () => gen.assign((0, codegen_1._)`${parentData}[${parentDataProperty}]`, expr));
    }
    function checkDataType(dataType, data, strictNums, correct = DataType.Correct) {
      const EQ = correct === DataType.Correct ? codegen_1.operators.EQ : codegen_1.operators.NEQ;
      let cond;
      switch (dataType) {
        case "null":
          return (0, codegen_1._)`${data} ${EQ} null`;
        case "array":
          cond = (0, codegen_1._)`Array.isArray(${data})`;
          break;
        case "object":
          cond = (0, codegen_1._)`${data} && typeof ${data} == "object" && !Array.isArray(${data})`;
          break;
        case "integer":
          cond = numCond((0, codegen_1._)`!(${data} % 1) && !isNaN(${data})`);
          break;
        case "number":
          cond = numCond();
          break;
        default:
          return (0, codegen_1._)`typeof ${data} ${EQ} ${dataType}`;
      }
      return correct === DataType.Correct ? cond : (0, codegen_1.not)(cond);
      function numCond(_cond = codegen_1.nil) {
        return (0, codegen_1.and)((0, codegen_1._)`typeof ${data} == "number"`, _cond, strictNums ? (0, codegen_1._)`isFinite(${data})` : codegen_1.nil);
      }
    }
    exports.checkDataType = checkDataType;
    function checkDataTypes(dataTypes, data, strictNums, correct) {
      if (dataTypes.length === 1) {
        return checkDataType(dataTypes[0], data, strictNums, correct);
      }
      let cond;
      const types = (0, util_1.toHash)(dataTypes);
      if (types.array && types.object) {
        const notObj = (0, codegen_1._)`typeof ${data} != "object"`;
        cond = types.null ? notObj : (0, codegen_1._)`!${data} || ${notObj}`;
        delete types.null;
        delete types.array;
        delete types.object;
      } else {
        cond = codegen_1.nil;
      }
      if (types.number)
        delete types.integer;
      for (const t in types)
        cond = (0, codegen_1.and)(cond, checkDataType(t, data, strictNums, correct));
      return cond;
    }
    exports.checkDataTypes = checkDataTypes;
    var typeError = {
      message: ({ schema: schema2 }) => `must be ${schema2}`,
      params: ({ schema: schema2, schemaValue }) => typeof schema2 == "string" ? (0, codegen_1._)`{type: ${schema2}}` : (0, codegen_1._)`{type: ${schemaValue}}`
    };
    function reportTypeError(it) {
      const cxt = getTypeErrorContext(it);
      (0, errors_1.reportError)(cxt, typeError);
    }
    exports.reportTypeError = reportTypeError;
    function getTypeErrorContext(it) {
      const { gen, data, schema: schema2 } = it;
      const schemaCode = (0, util_1.schemaRefOrVal)(it, schema2, "type");
      return {
        gen,
        keyword: "type",
        data,
        schema: schema2.type,
        schemaCode,
        schemaValue: schemaCode,
        parentSchema: schema2,
        params: {},
        it
      };
    }
  }
});

// node_modules/ajv/dist/compile/validate/defaults.js
var require_defaults = __commonJS({
  "node_modules/ajv/dist/compile/validate/defaults.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.assignDefaults = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function assignDefaults(it, ty) {
      const { properties, items } = it.schema;
      if (ty === "object" && properties) {
        for (const key in properties) {
          assignDefault(it, key, properties[key].default);
        }
      } else if (ty === "array" && Array.isArray(items)) {
        items.forEach((sch, i) => assignDefault(it, i, sch.default));
      }
    }
    exports.assignDefaults = assignDefaults;
    function assignDefault(it, prop, defaultValue) {
      const { gen, compositeRule, data, opts } = it;
      if (defaultValue === void 0)
        return;
      const childData = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(prop)}`;
      if (compositeRule) {
        (0, util_1.checkStrictMode)(it, `default is ignored for: ${childData}`);
        return;
      }
      let condition = (0, codegen_1._)`${childData} === undefined`;
      if (opts.useDefaults === "empty") {
        condition = (0, codegen_1._)`${condition} || ${childData} === null || ${childData} === ""`;
      }
      gen.if(condition, (0, codegen_1._)`${childData} = ${(0, codegen_1.stringify)(defaultValue)}`);
    }
  }
});

// node_modules/ajv/dist/vocabularies/code.js
var require_code2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateUnion = exports.validateArray = exports.usePattern = exports.callValidateCode = exports.schemaProperties = exports.allSchemaProperties = exports.noPropertyInData = exports.propertyInData = exports.isOwnProperty = exports.hasPropFunc = exports.reportMissingProp = exports.checkMissingProp = exports.checkReportMissingProp = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    var util_2 = require_util();
    function checkReportMissingProp(cxt, prop) {
      const { gen, data, it } = cxt;
      gen.if(noPropertyInData(gen, data, prop, it.opts.ownProperties), () => {
        cxt.setParams({ missingProperty: (0, codegen_1._)`${prop}` }, true);
        cxt.error();
      });
    }
    exports.checkReportMissingProp = checkReportMissingProp;
    function checkMissingProp({ gen, data, it: { opts } }, properties, missing) {
      return (0, codegen_1.or)(...properties.map((prop) => (0, codegen_1.and)(noPropertyInData(gen, data, prop, opts.ownProperties), (0, codegen_1._)`${missing} = ${prop}`)));
    }
    exports.checkMissingProp = checkMissingProp;
    function reportMissingProp(cxt, missing) {
      cxt.setParams({ missingProperty: missing }, true);
      cxt.error();
    }
    exports.reportMissingProp = reportMissingProp;
    function hasPropFunc(gen) {
      return gen.scopeValue("func", {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        ref: Object.prototype.hasOwnProperty,
        code: (0, codegen_1._)`Object.prototype.hasOwnProperty`
      });
    }
    exports.hasPropFunc = hasPropFunc;
    function isOwnProperty(gen, data, property) {
      return (0, codegen_1._)`${hasPropFunc(gen)}.call(${data}, ${property})`;
    }
    exports.isOwnProperty = isOwnProperty;
    function propertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} !== undefined`;
      return ownProperties ? (0, codegen_1._)`${cond} && ${isOwnProperty(gen, data, property)}` : cond;
    }
    exports.propertyInData = propertyInData;
    function noPropertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} === undefined`;
      return ownProperties ? (0, codegen_1.or)(cond, (0, codegen_1.not)(isOwnProperty(gen, data, property))) : cond;
    }
    exports.noPropertyInData = noPropertyInData;
    function allSchemaProperties(schemaMap) {
      return schemaMap ? Object.keys(schemaMap).filter((p) => p !== "__proto__") : [];
    }
    exports.allSchemaProperties = allSchemaProperties;
    function schemaProperties(it, schemaMap) {
      return allSchemaProperties(schemaMap).filter((p) => !(0, util_1.alwaysValidSchema)(it, schemaMap[p]));
    }
    exports.schemaProperties = schemaProperties;
    function callValidateCode({ schemaCode, data, it: { gen, topSchemaRef, schemaPath, errorPath }, it }, func, context, passSchema) {
      const dataAndSchema = passSchema ? (0, codegen_1._)`${schemaCode}, ${data}, ${topSchemaRef}${schemaPath}` : data;
      const valCxt = [
        [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, errorPath)],
        [names_1.default.parentData, it.parentData],
        [names_1.default.parentDataProperty, it.parentDataProperty],
        [names_1.default.rootData, names_1.default.rootData]
      ];
      if (it.opts.dynamicRef)
        valCxt.push([names_1.default.dynamicAnchors, names_1.default.dynamicAnchors]);
      const args = (0, codegen_1._)`${dataAndSchema}, ${gen.object(...valCxt)}`;
      return context !== codegen_1.nil ? (0, codegen_1._)`${func}.call(${context}, ${args})` : (0, codegen_1._)`${func}(${args})`;
    }
    exports.callValidateCode = callValidateCode;
    var newRegExp = (0, codegen_1._)`new RegExp`;
    function usePattern({ gen, it: { opts } }, pattern) {
      const u = opts.unicodeRegExp ? "u" : "";
      const { regExp } = opts.code;
      const rx = regExp(pattern, u);
      return gen.scopeValue("pattern", {
        key: rx.toString(),
        ref: rx,
        code: (0, codegen_1._)`${regExp.code === "new RegExp" ? newRegExp : (0, util_2.useFunc)(gen, regExp)}(${pattern}, ${u})`
      });
    }
    exports.usePattern = usePattern;
    function validateArray(cxt) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      if (it.allErrors) {
        const validArr = gen.let("valid", true);
        validateItems(() => gen.assign(validArr, false));
        return validArr;
      }
      gen.var(valid, true);
      validateItems(() => gen.break());
      return valid;
      function validateItems(notValid) {
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        gen.forRange("i", 0, len, (i) => {
          cxt.subschema({
            keyword,
            dataProp: i,
            dataPropType: util_1.Type.Num
          }, valid);
          gen.if((0, codegen_1.not)(valid), notValid);
        });
      }
    }
    exports.validateArray = validateArray;
    function validateUnion(cxt) {
      const { gen, schema: schema2, keyword, it } = cxt;
      if (!Array.isArray(schema2))
        throw new Error("ajv implementation error");
      const alwaysValid = schema2.some((sch) => (0, util_1.alwaysValidSchema)(it, sch));
      if (alwaysValid && !it.opts.unevaluated)
        return;
      const valid = gen.let("valid", false);
      const schValid = gen.name("_valid");
      gen.block(() => schema2.forEach((_sch, i) => {
        const schCxt = cxt.subschema({
          keyword,
          schemaProp: i,
          compositeRule: true
        }, schValid);
        gen.assign(valid, (0, codegen_1._)`${valid} || ${schValid}`);
        const merged = cxt.mergeValidEvaluated(schCxt, schValid);
        if (!merged)
          gen.if((0, codegen_1.not)(valid));
      }));
      cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
    }
    exports.validateUnion = validateUnion;
  }
});

// node_modules/ajv/dist/compile/validate/keyword.js
var require_keyword = __commonJS({
  "node_modules/ajv/dist/compile/validate/keyword.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateKeywordUsage = exports.validSchemaType = exports.funcKeywordCode = exports.macroKeywordCode = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var code_1 = require_code2();
    var errors_1 = require_errors();
    function macroKeywordCode(cxt, def) {
      const { gen, keyword, schema: schema2, parentSchema, it } = cxt;
      const macroSchema = def.macro.call(it.self, schema2, parentSchema, it);
      const schemaRef = useKeyword(gen, keyword, macroSchema);
      if (it.opts.validateSchema !== false)
        it.self.validateSchema(macroSchema, true);
      const valid = gen.name("valid");
      cxt.subschema({
        schema: macroSchema,
        schemaPath: codegen_1.nil,
        errSchemaPath: `${it.errSchemaPath}/${keyword}`,
        topSchemaRef: schemaRef,
        compositeRule: true
      }, valid);
      cxt.pass(valid, () => cxt.error(true));
    }
    exports.macroKeywordCode = macroKeywordCode;
    function funcKeywordCode(cxt, def) {
      var _a;
      const { gen, keyword, schema: schema2, parentSchema, $data, it } = cxt;
      checkAsyncKeyword(it, def);
      const validate = !$data && def.compile ? def.compile.call(it.self, schema2, parentSchema, it) : def.validate;
      const validateRef = useKeyword(gen, keyword, validate);
      const valid = gen.let("valid");
      cxt.block$data(valid, validateKeyword);
      cxt.ok((_a = def.valid) !== null && _a !== void 0 ? _a : valid);
      function validateKeyword() {
        if (def.errors === false) {
          assignValid();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => cxt.error());
        } else {
          const ruleErrs = def.async ? validateAsync() : validateSync();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => addErrs(cxt, ruleErrs));
        }
      }
      function validateAsync() {
        const ruleErrs = gen.let("ruleErrs", null);
        gen.try(() => assignValid((0, codegen_1._)`await `), (e) => gen.assign(valid, false).if((0, codegen_1._)`${e} instanceof ${it.ValidationError}`, () => gen.assign(ruleErrs, (0, codegen_1._)`${e}.errors`), () => gen.throw(e)));
        return ruleErrs;
      }
      function validateSync() {
        const validateErrs = (0, codegen_1._)`${validateRef}.errors`;
        gen.assign(validateErrs, null);
        assignValid(codegen_1.nil);
        return validateErrs;
      }
      function assignValid(_await = def.async ? (0, codegen_1._)`await ` : codegen_1.nil) {
        const passCxt = it.opts.passContext ? names_1.default.this : names_1.default.self;
        const passSchema = !("compile" in def && !$data || def.schema === false);
        gen.assign(valid, (0, codegen_1._)`${_await}${(0, code_1.callValidateCode)(cxt, validateRef, passCxt, passSchema)}`, def.modifying);
      }
      function reportErrs(errors) {
        var _a2;
        gen.if((0, codegen_1.not)((_a2 = def.valid) !== null && _a2 !== void 0 ? _a2 : valid), errors);
      }
    }
    exports.funcKeywordCode = funcKeywordCode;
    function modifyData(cxt) {
      const { gen, data, it } = cxt;
      gen.if(it.parentData, () => gen.assign(data, (0, codegen_1._)`${it.parentData}[${it.parentDataProperty}]`));
    }
    function addErrs(cxt, errs) {
      const { gen } = cxt;
      gen.if((0, codegen_1._)`Array.isArray(${errs})`, () => {
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`).assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
        (0, errors_1.extendErrors)(cxt);
      }, () => cxt.error());
    }
    function checkAsyncKeyword({ schemaEnv }, def) {
      if (def.async && !schemaEnv.$async)
        throw new Error("async keyword in sync schema");
    }
    function useKeyword(gen, keyword, result) {
      if (result === void 0)
        throw new Error(`keyword "${keyword}" failed to compile`);
      return gen.scopeValue("keyword", typeof result == "function" ? { ref: result } : { ref: result, code: (0, codegen_1.stringify)(result) });
    }
    function validSchemaType(schema2, schemaType, allowUndefined = false) {
      return !schemaType.length || schemaType.some((st) => st === "array" ? Array.isArray(schema2) : st === "object" ? schema2 && typeof schema2 == "object" && !Array.isArray(schema2) : typeof schema2 == st || allowUndefined && typeof schema2 == "undefined");
    }
    exports.validSchemaType = validSchemaType;
    function validateKeywordUsage({ schema: schema2, opts, self: self2, errSchemaPath }, def, keyword) {
      if (Array.isArray(def.keyword) ? !def.keyword.includes(keyword) : def.keyword !== keyword) {
        throw new Error("ajv implementation error");
      }
      const deps = def.dependencies;
      if (deps === null || deps === void 0 ? void 0 : deps.some((kwd) => !Object.prototype.hasOwnProperty.call(schema2, kwd))) {
        throw new Error(`parent schema must have dependencies of ${keyword}: ${deps.join(",")}`);
      }
      if (def.validateSchema) {
        const valid = def.validateSchema(schema2[keyword]);
        if (!valid) {
          const msg = `keyword "${keyword}" value is invalid at path "${errSchemaPath}": ` + self2.errorsText(def.validateSchema.errors);
          if (opts.validateSchema === "log")
            self2.logger.error(msg);
          else
            throw new Error(msg);
        }
      }
    }
    exports.validateKeywordUsage = validateKeywordUsage;
  }
});

// node_modules/ajv/dist/compile/validate/subschema.js
var require_subschema = __commonJS({
  "node_modules/ajv/dist/compile/validate/subschema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendSubschemaMode = exports.extendSubschemaData = exports.getSubschema = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function getSubschema(it, { keyword, schemaProp, schema: schema2, schemaPath, errSchemaPath, topSchemaRef }) {
      if (keyword !== void 0 && schema2 !== void 0) {
        throw new Error('both "keyword" and "schema" passed, only one allowed');
      }
      if (keyword !== void 0) {
        const sch = it.schema[keyword];
        return schemaProp === void 0 ? {
          schema: sch,
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}`
        } : {
          schema: sch[schemaProp],
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}${(0, codegen_1.getProperty)(schemaProp)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}/${(0, util_1.escapeFragment)(schemaProp)}`
        };
      }
      if (schema2 !== void 0) {
        if (schemaPath === void 0 || errSchemaPath === void 0 || topSchemaRef === void 0) {
          throw new Error('"schemaPath", "errSchemaPath" and "topSchemaRef" are required with "schema"');
        }
        return {
          schema: schema2,
          schemaPath,
          topSchemaRef,
          errSchemaPath
        };
      }
      throw new Error('either "keyword" or "schema" must be passed');
    }
    exports.getSubschema = getSubschema;
    function extendSubschemaData(subschema, it, { dataProp, dataPropType: dpType, data, dataTypes, propertyName }) {
      if (data !== void 0 && dataProp !== void 0) {
        throw new Error('both "data" and "dataProp" passed, only one allowed');
      }
      const { gen } = it;
      if (dataProp !== void 0) {
        const { errorPath, dataPathArr, opts } = it;
        const nextData = gen.let("data", (0, codegen_1._)`${it.data}${(0, codegen_1.getProperty)(dataProp)}`, true);
        dataContextProps(nextData);
        subschema.errorPath = (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(dataProp, dpType, opts.jsPropertySyntax)}`;
        subschema.parentDataProperty = (0, codegen_1._)`${dataProp}`;
        subschema.dataPathArr = [...dataPathArr, subschema.parentDataProperty];
      }
      if (data !== void 0) {
        const nextData = data instanceof codegen_1.Name ? data : gen.let("data", data, true);
        dataContextProps(nextData);
        if (propertyName !== void 0)
          subschema.propertyName = propertyName;
      }
      if (dataTypes)
        subschema.dataTypes = dataTypes;
      function dataContextProps(_nextData) {
        subschema.data = _nextData;
        subschema.dataLevel = it.dataLevel + 1;
        subschema.dataTypes = [];
        it.definedProperties = /* @__PURE__ */ new Set();
        subschema.parentData = it.data;
        subschema.dataNames = [...it.dataNames, _nextData];
      }
    }
    exports.extendSubschemaData = extendSubschemaData;
    function extendSubschemaMode(subschema, { jtdDiscriminator, jtdMetadata, compositeRule, createErrors, allErrors }) {
      if (compositeRule !== void 0)
        subschema.compositeRule = compositeRule;
      if (createErrors !== void 0)
        subschema.createErrors = createErrors;
      if (allErrors !== void 0)
        subschema.allErrors = allErrors;
      subschema.jtdDiscriminator = jtdDiscriminator;
      subschema.jtdMetadata = jtdMetadata;
    }
    exports.extendSubschemaMode = extendSubschemaMode;
  }
});

// node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS({
  "node_modules/fast-deep-equal/index.js"(exports, module) {
    "use strict";
    module.exports = function equal(a, b) {
      if (a === b) return true;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return false;
        var length, i, keys;
        if (Array.isArray(a)) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0; )
            if (!equal(a[i], b[i])) return false;
          return true;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;
        for (i = length; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        for (i = length; i-- !== 0; ) {
          var key = keys[i];
          if (!equal(a[key], b[key])) return false;
        }
        return true;
      }
      return a !== a && b !== b;
    };
  }
});

// node_modules/json-schema-traverse/index.js
var require_json_schema_traverse = __commonJS({
  "node_modules/json-schema-traverse/index.js"(exports, module) {
    "use strict";
    var traverse = module.exports = function(schema2, opts, cb) {
      if (typeof opts == "function") {
        cb = opts;
        opts = {};
      }
      cb = opts.cb || cb;
      var pre = typeof cb == "function" ? cb : cb.pre || function() {
      };
      var post = cb.post || function() {
      };
      _traverse(opts, pre, post, schema2, "", schema2);
    };
    traverse.keywords = {
      additionalItems: true,
      items: true,
      contains: true,
      additionalProperties: true,
      propertyNames: true,
      not: true,
      if: true,
      then: true,
      else: true
    };
    traverse.arrayKeywords = {
      items: true,
      allOf: true,
      anyOf: true,
      oneOf: true
    };
    traverse.propsKeywords = {
      $defs: true,
      definitions: true,
      properties: true,
      patternProperties: true,
      dependencies: true
    };
    traverse.skipKeywords = {
      default: true,
      enum: true,
      const: true,
      required: true,
      maximum: true,
      minimum: true,
      exclusiveMaximum: true,
      exclusiveMinimum: true,
      multipleOf: true,
      maxLength: true,
      minLength: true,
      pattern: true,
      format: true,
      maxItems: true,
      minItems: true,
      uniqueItems: true,
      maxProperties: true,
      minProperties: true
    };
    function _traverse(opts, pre, post, schema2, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex) {
      if (schema2 && typeof schema2 == "object" && !Array.isArray(schema2)) {
        pre(schema2, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
        for (var key in schema2) {
          var sch = schema2[key];
          if (Array.isArray(sch)) {
            if (key in traverse.arrayKeywords) {
              for (var i = 0; i < sch.length; i++)
                _traverse(opts, pre, post, sch[i], jsonPtr + "/" + key + "/" + i, rootSchema, jsonPtr, key, schema2, i);
            }
          } else if (key in traverse.propsKeywords) {
            if (sch && typeof sch == "object") {
              for (var prop in sch)
                _traverse(opts, pre, post, sch[prop], jsonPtr + "/" + key + "/" + escapeJsonPtr(prop), rootSchema, jsonPtr, key, schema2, prop);
            }
          } else if (key in traverse.keywords || opts.allKeys && !(key in traverse.skipKeywords)) {
            _traverse(opts, pre, post, sch, jsonPtr + "/" + key, rootSchema, jsonPtr, key, schema2);
          }
        }
        post(schema2, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
      }
    }
    function escapeJsonPtr(str) {
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
  }
});

// node_modules/ajv/dist/compile/resolve.js
var require_resolve = __commonJS({
  "node_modules/ajv/dist/compile/resolve.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getSchemaRefs = exports.resolveUrl = exports.normalizeId = exports._getFullPath = exports.getFullPath = exports.inlineRef = void 0;
    var util_1 = require_util();
    var equal = require_fast_deep_equal();
    var traverse = require_json_schema_traverse();
    var SIMPLE_INLINED = /* @__PURE__ */ new Set([
      "type",
      "format",
      "pattern",
      "maxLength",
      "minLength",
      "maxProperties",
      "minProperties",
      "maxItems",
      "minItems",
      "maximum",
      "minimum",
      "uniqueItems",
      "multipleOf",
      "required",
      "enum",
      "const"
    ]);
    function inlineRef(schema2, limit = true) {
      if (typeof schema2 == "boolean")
        return true;
      if (limit === true)
        return !hasRef(schema2);
      if (!limit)
        return false;
      return countKeys(schema2) <= limit;
    }
    exports.inlineRef = inlineRef;
    var REF_KEYWORDS = /* @__PURE__ */ new Set([
      "$ref",
      "$recursiveRef",
      "$recursiveAnchor",
      "$dynamicRef",
      "$dynamicAnchor"
    ]);
    function hasRef(schema2) {
      for (const key in schema2) {
        if (REF_KEYWORDS.has(key))
          return true;
        const sch = schema2[key];
        if (Array.isArray(sch) && sch.some(hasRef))
          return true;
        if (typeof sch == "object" && hasRef(sch))
          return true;
      }
      return false;
    }
    function countKeys(schema2) {
      let count = 0;
      for (const key in schema2) {
        if (key === "$ref")
          return Infinity;
        count++;
        if (SIMPLE_INLINED.has(key))
          continue;
        if (typeof schema2[key] == "object") {
          (0, util_1.eachItem)(schema2[key], (sch) => count += countKeys(sch));
        }
        if (count === Infinity)
          return Infinity;
      }
      return count;
    }
    function getFullPath(resolver, id = "", normalize) {
      if (normalize !== false)
        id = normalizeId(id);
      const p = resolver.parse(id);
      return _getFullPath(resolver, p);
    }
    exports.getFullPath = getFullPath;
    function _getFullPath(resolver, p) {
      const serialized = resolver.serialize(p);
      return serialized.split("#")[0] + "#";
    }
    exports._getFullPath = _getFullPath;
    var TRAILING_SLASH_HASH = /#\/?$/;
    function normalizeId(id) {
      return id ? id.replace(TRAILING_SLASH_HASH, "") : "";
    }
    exports.normalizeId = normalizeId;
    function resolveUrl(resolver, baseId, id) {
      id = normalizeId(id);
      return resolver.resolve(baseId, id);
    }
    exports.resolveUrl = resolveUrl;
    var ANCHOR = /^[a-z_][-a-z0-9._]*$/i;
    function getSchemaRefs(schema2, baseId) {
      if (typeof schema2 == "boolean")
        return {};
      const { schemaId, uriResolver } = this.opts;
      const schId = normalizeId(schema2[schemaId] || baseId);
      const baseIds = { "": schId };
      const pathPrefix = getFullPath(uriResolver, schId, false);
      const localRefs = {};
      const schemaRefs = /* @__PURE__ */ new Set();
      traverse(schema2, { allKeys: true }, (sch, jsonPtr, _, parentJsonPtr) => {
        if (parentJsonPtr === void 0)
          return;
        const fullPath = pathPrefix + jsonPtr;
        let innerBaseId = baseIds[parentJsonPtr];
        if (typeof sch[schemaId] == "string")
          innerBaseId = addRef.call(this, sch[schemaId]);
        addAnchor.call(this, sch.$anchor);
        addAnchor.call(this, sch.$dynamicAnchor);
        baseIds[jsonPtr] = innerBaseId;
        function addRef(ref) {
          const _resolve = this.opts.uriResolver.resolve;
          ref = normalizeId(innerBaseId ? _resolve(innerBaseId, ref) : ref);
          if (schemaRefs.has(ref))
            throw ambiguos(ref);
          schemaRefs.add(ref);
          let schOrRef = this.refs[ref];
          if (typeof schOrRef == "string")
            schOrRef = this.refs[schOrRef];
          if (typeof schOrRef == "object") {
            checkAmbiguosRef(sch, schOrRef.schema, ref);
          } else if (ref !== normalizeId(fullPath)) {
            if (ref[0] === "#") {
              checkAmbiguosRef(sch, localRefs[ref], ref);
              localRefs[ref] = sch;
            } else {
              this.refs[ref] = fullPath;
            }
          }
          return ref;
        }
        function addAnchor(anchor) {
          if (typeof anchor == "string") {
            if (!ANCHOR.test(anchor))
              throw new Error(`invalid anchor "${anchor}"`);
            addRef.call(this, `#${anchor}`);
          }
        }
      });
      return localRefs;
      function checkAmbiguosRef(sch1, sch2, ref) {
        if (sch2 !== void 0 && !equal(sch1, sch2))
          throw ambiguos(ref);
      }
      function ambiguos(ref) {
        return new Error(`reference "${ref}" resolves to more than one schema`);
      }
    }
    exports.getSchemaRefs = getSchemaRefs;
  }
});

// node_modules/ajv/dist/compile/validate/index.js
var require_validate = __commonJS({
  "node_modules/ajv/dist/compile/validate/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getData = exports.KeywordCxt = exports.validateFunctionCode = void 0;
    var boolSchema_1 = require_boolSchema();
    var dataType_1 = require_dataType();
    var applicability_1 = require_applicability();
    var dataType_2 = require_dataType();
    var defaults_1 = require_defaults();
    var keyword_1 = require_keyword();
    var subschema_1 = require_subschema();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var errors_1 = require_errors();
    function validateFunctionCode(it) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          topSchemaObjCode(it);
          return;
        }
      }
      validateFunction(it, () => (0, boolSchema_1.topBoolOrEmptySchema)(it));
    }
    exports.validateFunctionCode = validateFunctionCode;
    function validateFunction({ gen, validateName, schema: schema2, schemaEnv, opts }, body) {
      if (opts.code.es5) {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${names_1.default.valCxt}`, schemaEnv.$async, () => {
          gen.code((0, codegen_1._)`"use strict"; ${funcSourceUrl(schema2, opts)}`);
          destructureValCxtES5(gen, opts);
          gen.code(body);
        });
      } else {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${destructureValCxt(opts)}`, schemaEnv.$async, () => gen.code(funcSourceUrl(schema2, opts)).code(body));
      }
    }
    function destructureValCxt(opts) {
      return (0, codegen_1._)`{${names_1.default.instancePath}="", ${names_1.default.parentData}, ${names_1.default.parentDataProperty}, ${names_1.default.rootData}=${names_1.default.data}${opts.dynamicRef ? (0, codegen_1._)`, ${names_1.default.dynamicAnchors}={}` : codegen_1.nil}}={}`;
    }
    function destructureValCxtES5(gen, opts) {
      gen.if(names_1.default.valCxt, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.instancePath}`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentData}`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentDataProperty}`);
        gen.var(names_1.default.rootData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.rootData}`);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.dynamicAnchors}`);
      }, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`""`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.rootData, names_1.default.data);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`{}`);
      });
    }
    function topSchemaObjCode(it) {
      const { schema: schema2, opts, gen } = it;
      validateFunction(it, () => {
        if (opts.$comment && schema2.$comment)
          commentKeyword(it);
        checkNoDefault(it);
        gen.let(names_1.default.vErrors, null);
        gen.let(names_1.default.errors, 0);
        if (opts.unevaluated)
          resetEvaluated(it);
        typeAndKeywords(it);
        returnResults(it);
      });
      return;
    }
    function resetEvaluated(it) {
      const { gen, validateName } = it;
      it.evaluated = gen.const("evaluated", (0, codegen_1._)`${validateName}.evaluated`);
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicProps`, () => gen.assign((0, codegen_1._)`${it.evaluated}.props`, (0, codegen_1._)`undefined`));
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicItems`, () => gen.assign((0, codegen_1._)`${it.evaluated}.items`, (0, codegen_1._)`undefined`));
    }
    function funcSourceUrl(schema2, opts) {
      const schId = typeof schema2 == "object" && schema2[opts.schemaId];
      return schId && (opts.code.source || opts.code.process) ? (0, codegen_1._)`/*# sourceURL=${schId} */` : codegen_1.nil;
    }
    function subschemaCode(it, valid) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          subSchemaObjCode(it, valid);
          return;
        }
      }
      (0, boolSchema_1.boolOrEmptySchema)(it, valid);
    }
    function schemaCxtHasRules({ schema: schema2, self: self2 }) {
      if (typeof schema2 == "boolean")
        return !schema2;
      for (const key in schema2)
        if (self2.RULES.all[key])
          return true;
      return false;
    }
    function isSchemaObj(it) {
      return typeof it.schema != "boolean";
    }
    function subSchemaObjCode(it, valid) {
      const { schema: schema2, gen, opts } = it;
      if (opts.$comment && schema2.$comment)
        commentKeyword(it);
      updateContext(it);
      checkAsyncSchema(it);
      const errsCount = gen.const("_errs", names_1.default.errors);
      typeAndKeywords(it, errsCount);
      gen.var(valid, (0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
    }
    function checkKeywords(it) {
      (0, util_1.checkUnknownRules)(it);
      checkRefsAndKeywords(it);
    }
    function typeAndKeywords(it, errsCount) {
      if (it.opts.jtd)
        return schemaKeywords(it, [], false, errsCount);
      const types = (0, dataType_1.getSchemaTypes)(it.schema);
      const checkedTypes = (0, dataType_1.coerceAndCheckDataType)(it, types);
      schemaKeywords(it, types, !checkedTypes, errsCount);
    }
    function checkRefsAndKeywords(it) {
      const { schema: schema2, errSchemaPath, opts, self: self2 } = it;
      if (schema2.$ref && opts.ignoreKeywordsWithRef && (0, util_1.schemaHasRulesButRef)(schema2, self2.RULES)) {
        self2.logger.warn(`$ref: keywords ignored in schema at path "${errSchemaPath}"`);
      }
    }
    function checkNoDefault(it) {
      const { schema: schema2, opts } = it;
      if (schema2.default !== void 0 && opts.useDefaults && opts.strictSchema) {
        (0, util_1.checkStrictMode)(it, "default is ignored in the schema root");
      }
    }
    function updateContext(it) {
      const schId = it.schema[it.opts.schemaId];
      if (schId)
        it.baseId = (0, resolve_1.resolveUrl)(it.opts.uriResolver, it.baseId, schId);
    }
    function checkAsyncSchema(it) {
      if (it.schema.$async && !it.schemaEnv.$async)
        throw new Error("async schema in sync schema");
    }
    function commentKeyword({ gen, schemaEnv, schema: schema2, errSchemaPath, opts }) {
      const msg = schema2.$comment;
      if (opts.$comment === true) {
        gen.code((0, codegen_1._)`${names_1.default.self}.logger.log(${msg})`);
      } else if (typeof opts.$comment == "function") {
        const schemaPath = (0, codegen_1.str)`${errSchemaPath}/$comment`;
        const rootName = gen.scopeValue("root", { ref: schemaEnv.root });
        gen.code((0, codegen_1._)`${names_1.default.self}.opts.$comment(${msg}, ${schemaPath}, ${rootName}.schema)`);
      }
    }
    function returnResults(it) {
      const { gen, schemaEnv, validateName, ValidationError, opts } = it;
      if (schemaEnv.$async) {
        gen.if((0, codegen_1._)`${names_1.default.errors} === 0`, () => gen.return(names_1.default.data), () => gen.throw((0, codegen_1._)`new ${ValidationError}(${names_1.default.vErrors})`));
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, names_1.default.vErrors);
        if (opts.unevaluated)
          assignEvaluated(it);
        gen.return((0, codegen_1._)`${names_1.default.errors} === 0`);
      }
    }
    function assignEvaluated({ gen, evaluated, props, items }) {
      if (props instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.props`, props);
      if (items instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.items`, items);
    }
    function schemaKeywords(it, types, typeErrors, errsCount) {
      const { gen, schema: schema2, data, allErrors, opts, self: self2 } = it;
      const { RULES } = self2;
      if (schema2.$ref && (opts.ignoreKeywordsWithRef || !(0, util_1.schemaHasRulesButRef)(schema2, RULES))) {
        gen.block(() => keywordCode(it, "$ref", RULES.all.$ref.definition));
        return;
      }
      if (!opts.jtd)
        checkStrictTypes(it, types);
      gen.block(() => {
        for (const group of RULES.rules)
          groupKeywords(group);
        groupKeywords(RULES.post);
      });
      function groupKeywords(group) {
        if (!(0, applicability_1.shouldUseGroup)(schema2, group))
          return;
        if (group.type) {
          gen.if((0, dataType_2.checkDataType)(group.type, data, opts.strictNumbers));
          iterateKeywords(it, group);
          if (types.length === 1 && types[0] === group.type && typeErrors) {
            gen.else();
            (0, dataType_2.reportTypeError)(it);
          }
          gen.endIf();
        } else {
          iterateKeywords(it, group);
        }
        if (!allErrors)
          gen.if((0, codegen_1._)`${names_1.default.errors} === ${errsCount || 0}`);
      }
    }
    function iterateKeywords(it, group) {
      const { gen, schema: schema2, opts: { useDefaults } } = it;
      if (useDefaults)
        (0, defaults_1.assignDefaults)(it, group.type);
      gen.block(() => {
        for (const rule of group.rules) {
          if ((0, applicability_1.shouldUseRule)(schema2, rule)) {
            keywordCode(it, rule.keyword, rule.definition, group.type);
          }
        }
      });
    }
    function checkStrictTypes(it, types) {
      if (it.schemaEnv.meta || !it.opts.strictTypes)
        return;
      checkContextTypes(it, types);
      if (!it.opts.allowUnionTypes)
        checkMultipleTypes(it, types);
      checkKeywordTypes(it, it.dataTypes);
    }
    function checkContextTypes(it, types) {
      if (!types.length)
        return;
      if (!it.dataTypes.length) {
        it.dataTypes = types;
        return;
      }
      types.forEach((t) => {
        if (!includesType(it.dataTypes, t)) {
          strictTypesError(it, `type "${t}" not allowed by context "${it.dataTypes.join(",")}"`);
        }
      });
      narrowSchemaTypes(it, types);
    }
    function checkMultipleTypes(it, ts) {
      if (ts.length > 1 && !(ts.length === 2 && ts.includes("null"))) {
        strictTypesError(it, "use allowUnionTypes to allow union type keyword");
      }
    }
    function checkKeywordTypes(it, ts) {
      const rules = it.self.RULES.all;
      for (const keyword in rules) {
        const rule = rules[keyword];
        if (typeof rule == "object" && (0, applicability_1.shouldUseRule)(it.schema, rule)) {
          const { type } = rule.definition;
          if (type.length && !type.some((t) => hasApplicableType(ts, t))) {
            strictTypesError(it, `missing type "${type.join(",")}" for keyword "${keyword}"`);
          }
        }
      }
    }
    function hasApplicableType(schTs, kwdT) {
      return schTs.includes(kwdT) || kwdT === "number" && schTs.includes("integer");
    }
    function includesType(ts, t) {
      return ts.includes(t) || t === "integer" && ts.includes("number");
    }
    function narrowSchemaTypes(it, withTypes) {
      const ts = [];
      for (const t of it.dataTypes) {
        if (includesType(withTypes, t))
          ts.push(t);
        else if (withTypes.includes("integer") && t === "number")
          ts.push("integer");
      }
      it.dataTypes = ts;
    }
    function strictTypesError(it, msg) {
      const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
      msg += ` at "${schemaPath}" (strictTypes)`;
      (0, util_1.checkStrictMode)(it, msg, it.opts.strictTypes);
    }
    var KeywordCxt = class {
      constructor(it, def, keyword) {
        (0, keyword_1.validateKeywordUsage)(it, def, keyword);
        this.gen = it.gen;
        this.allErrors = it.allErrors;
        this.keyword = keyword;
        this.data = it.data;
        this.schema = it.schema[keyword];
        this.$data = def.$data && it.opts.$data && this.schema && this.schema.$data;
        this.schemaValue = (0, util_1.schemaRefOrVal)(it, this.schema, keyword, this.$data);
        this.schemaType = def.schemaType;
        this.parentSchema = it.schema;
        this.params = {};
        this.it = it;
        this.def = def;
        if (this.$data) {
          this.schemaCode = it.gen.const("vSchema", getData(this.$data, it));
        } else {
          this.schemaCode = this.schemaValue;
          if (!(0, keyword_1.validSchemaType)(this.schema, def.schemaType, def.allowUndefined)) {
            throw new Error(`${keyword} value must be ${JSON.stringify(def.schemaType)}`);
          }
        }
        if ("code" in def ? def.trackErrors : def.errors !== false) {
          this.errsCount = it.gen.const("_errs", names_1.default.errors);
        }
      }
      result(condition, successAction, failAction) {
        this.failResult((0, codegen_1.not)(condition), successAction, failAction);
      }
      failResult(condition, successAction, failAction) {
        this.gen.if(condition);
        if (failAction)
          failAction();
        else
          this.error();
        if (successAction) {
          this.gen.else();
          successAction();
          if (this.allErrors)
            this.gen.endIf();
        } else {
          if (this.allErrors)
            this.gen.endIf();
          else
            this.gen.else();
        }
      }
      pass(condition, failAction) {
        this.failResult((0, codegen_1.not)(condition), void 0, failAction);
      }
      fail(condition) {
        if (condition === void 0) {
          this.error();
          if (!this.allErrors)
            this.gen.if(false);
          return;
        }
        this.gen.if(condition);
        this.error();
        if (this.allErrors)
          this.gen.endIf();
        else
          this.gen.else();
      }
      fail$data(condition) {
        if (!this.$data)
          return this.fail(condition);
        const { schemaCode } = this;
        this.fail((0, codegen_1._)`${schemaCode} !== undefined && (${(0, codegen_1.or)(this.invalid$data(), condition)})`);
      }
      error(append, errorParams, errorPaths) {
        if (errorParams) {
          this.setParams(errorParams);
          this._error(append, errorPaths);
          this.setParams({});
          return;
        }
        this._error(append, errorPaths);
      }
      _error(append, errorPaths) {
        ;
        (append ? errors_1.reportExtraError : errors_1.reportError)(this, this.def.error, errorPaths);
      }
      $dataError() {
        (0, errors_1.reportError)(this, this.def.$dataError || errors_1.keyword$DataError);
      }
      reset() {
        if (this.errsCount === void 0)
          throw new Error('add "trackErrors" to keyword definition');
        (0, errors_1.resetErrorsCount)(this.gen, this.errsCount);
      }
      ok(cond) {
        if (!this.allErrors)
          this.gen.if(cond);
      }
      setParams(obj, assign) {
        if (assign)
          Object.assign(this.params, obj);
        else
          this.params = obj;
      }
      block$data(valid, codeBlock, $dataValid = codegen_1.nil) {
        this.gen.block(() => {
          this.check$data(valid, $dataValid);
          codeBlock();
        });
      }
      check$data(valid = codegen_1.nil, $dataValid = codegen_1.nil) {
        if (!this.$data)
          return;
        const { gen, schemaCode, schemaType, def } = this;
        gen.if((0, codegen_1.or)((0, codegen_1._)`${schemaCode} === undefined`, $dataValid));
        if (valid !== codegen_1.nil)
          gen.assign(valid, true);
        if (schemaType.length || def.validateSchema) {
          gen.elseIf(this.invalid$data());
          this.$dataError();
          if (valid !== codegen_1.nil)
            gen.assign(valid, false);
        }
        gen.else();
      }
      invalid$data() {
        const { gen, schemaCode, schemaType, def, it } = this;
        return (0, codegen_1.or)(wrong$DataType(), invalid$DataSchema());
        function wrong$DataType() {
          if (schemaType.length) {
            if (!(schemaCode instanceof codegen_1.Name))
              throw new Error("ajv implementation error");
            const st = Array.isArray(schemaType) ? schemaType : [schemaType];
            return (0, codegen_1._)`${(0, dataType_2.checkDataTypes)(st, schemaCode, it.opts.strictNumbers, dataType_2.DataType.Wrong)}`;
          }
          return codegen_1.nil;
        }
        function invalid$DataSchema() {
          if (def.validateSchema) {
            const validateSchemaRef = gen.scopeValue("validate$data", { ref: def.validateSchema });
            return (0, codegen_1._)`!${validateSchemaRef}(${schemaCode})`;
          }
          return codegen_1.nil;
        }
      }
      subschema(appl, valid) {
        const subschema = (0, subschema_1.getSubschema)(this.it, appl);
        (0, subschema_1.extendSubschemaData)(subschema, this.it, appl);
        (0, subschema_1.extendSubschemaMode)(subschema, appl);
        const nextContext = { ...this.it, ...subschema, items: void 0, props: void 0 };
        subschemaCode(nextContext, valid);
        return nextContext;
      }
      mergeEvaluated(schemaCxt, toName) {
        const { it, gen } = this;
        if (!it.opts.unevaluated)
          return;
        if (it.props !== true && schemaCxt.props !== void 0) {
          it.props = util_1.mergeEvaluated.props(gen, schemaCxt.props, it.props, toName);
        }
        if (it.items !== true && schemaCxt.items !== void 0) {
          it.items = util_1.mergeEvaluated.items(gen, schemaCxt.items, it.items, toName);
        }
      }
      mergeValidEvaluated(schemaCxt, valid) {
        const { it, gen } = this;
        if (it.opts.unevaluated && (it.props !== true || it.items !== true)) {
          gen.if(valid, () => this.mergeEvaluated(schemaCxt, codegen_1.Name));
          return true;
        }
      }
    };
    exports.KeywordCxt = KeywordCxt;
    function keywordCode(it, keyword, def, ruleType) {
      const cxt = new KeywordCxt(it, def, keyword);
      if ("code" in def) {
        def.code(cxt, ruleType);
      } else if (cxt.$data && def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      } else if ("macro" in def) {
        (0, keyword_1.macroKeywordCode)(cxt, def);
      } else if (def.compile || def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      }
    }
    var JSON_POINTER = /^\/(?:[^~]|~0|~1)*$/;
    var RELATIVE_JSON_POINTER = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
    function getData($data, { dataLevel, dataNames, dataPathArr }) {
      let jsonPointer;
      let data;
      if ($data === "")
        return names_1.default.rootData;
      if ($data[0] === "/") {
        if (!JSON_POINTER.test($data))
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        jsonPointer = $data;
        data = names_1.default.rootData;
      } else {
        const matches = RELATIVE_JSON_POINTER.exec($data);
        if (!matches)
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        const up = +matches[1];
        jsonPointer = matches[2];
        if (jsonPointer === "#") {
          if (up >= dataLevel)
            throw new Error(errorMsg("property/index", up));
          return dataPathArr[dataLevel - up];
        }
        if (up > dataLevel)
          throw new Error(errorMsg("data", up));
        data = dataNames[dataLevel - up];
        if (!jsonPointer)
          return data;
      }
      let expr = data;
      const segments = jsonPointer.split("/");
      for (const segment of segments) {
        if (segment) {
          data = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)((0, util_1.unescapeJsonPointer)(segment))}`;
          expr = (0, codegen_1._)`${expr} && ${data}`;
        }
      }
      return expr;
      function errorMsg(pointerType, up) {
        return `Cannot access ${pointerType} ${up} levels up, current level is ${dataLevel}`;
      }
    }
    exports.getData = getData;
  }
});

// node_modules/ajv/dist/runtime/validation_error.js
var require_validation_error = __commonJS({
  "node_modules/ajv/dist/runtime/validation_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ValidationError = class extends Error {
      constructor(errors) {
        super("validation failed");
        this.errors = errors;
        this.ajv = this.validation = true;
      }
    };
    exports.default = ValidationError;
  }
});

// node_modules/ajv/dist/compile/ref_error.js
var require_ref_error = __commonJS({
  "node_modules/ajv/dist/compile/ref_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var resolve_1 = require_resolve();
    var MissingRefError = class extends Error {
      constructor(resolver, baseId, ref, msg) {
        super(msg || `can't resolve reference ${ref} from id ${baseId}`);
        this.missingRef = (0, resolve_1.resolveUrl)(resolver, baseId, ref);
        this.missingSchema = (0, resolve_1.normalizeId)((0, resolve_1.getFullPath)(resolver, this.missingRef));
      }
    };
    exports.default = MissingRefError;
  }
});

// node_modules/ajv/dist/compile/index.js
var require_compile = __commonJS({
  "node_modules/ajv/dist/compile/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.resolveSchema = exports.getCompilingSchema = exports.resolveRef = exports.compileSchema = exports.SchemaEnv = void 0;
    var codegen_1 = require_codegen();
    var validation_error_1 = require_validation_error();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var validate_1 = require_validate();
    var SchemaEnv = class {
      constructor(env) {
        var _a;
        this.refs = {};
        this.dynamicAnchors = {};
        let schema2;
        if (typeof env.schema == "object")
          schema2 = env.schema;
        this.schema = env.schema;
        this.schemaId = env.schemaId;
        this.root = env.root || this;
        this.baseId = (_a = env.baseId) !== null && _a !== void 0 ? _a : (0, resolve_1.normalizeId)(schema2 === null || schema2 === void 0 ? void 0 : schema2[env.schemaId || "$id"]);
        this.schemaPath = env.schemaPath;
        this.localRefs = env.localRefs;
        this.meta = env.meta;
        this.$async = schema2 === null || schema2 === void 0 ? void 0 : schema2.$async;
        this.refs = {};
      }
    };
    exports.SchemaEnv = SchemaEnv;
    function compileSchema(sch) {
      const _sch = getCompilingSchema.call(this, sch);
      if (_sch)
        return _sch;
      const rootId = (0, resolve_1.getFullPath)(this.opts.uriResolver, sch.root.baseId);
      const { es5, lines } = this.opts.code;
      const { ownProperties } = this.opts;
      const gen = new codegen_1.CodeGen(this.scope, { es5, lines, ownProperties });
      let _ValidationError;
      if (sch.$async) {
        _ValidationError = gen.scopeValue("Error", {
          ref: validation_error_1.default,
          code: (0, codegen_1._)`require("ajv/dist/runtime/validation_error").default`
        });
      }
      const validateName = gen.scopeName("validate");
      sch.validateName = validateName;
      const schemaCxt = {
        gen,
        allErrors: this.opts.allErrors,
        data: names_1.default.data,
        parentData: names_1.default.parentData,
        parentDataProperty: names_1.default.parentDataProperty,
        dataNames: [names_1.default.data],
        dataPathArr: [codegen_1.nil],
        // TODO can its length be used as dataLevel if nil is removed?
        dataLevel: 0,
        dataTypes: [],
        definedProperties: /* @__PURE__ */ new Set(),
        topSchemaRef: gen.scopeValue("schema", this.opts.code.source === true ? { ref: sch.schema, code: (0, codegen_1.stringify)(sch.schema) } : { ref: sch.schema }),
        validateName,
        ValidationError: _ValidationError,
        schema: sch.schema,
        schemaEnv: sch,
        rootId,
        baseId: sch.baseId || rootId,
        schemaPath: codegen_1.nil,
        errSchemaPath: sch.schemaPath || (this.opts.jtd ? "" : "#"),
        errorPath: (0, codegen_1._)`""`,
        opts: this.opts,
        self: this
      };
      let sourceCode;
      try {
        this._compilations.add(sch);
        (0, validate_1.validateFunctionCode)(schemaCxt);
        gen.optimize(this.opts.code.optimize);
        const validateCode = gen.toString();
        sourceCode = `${gen.scopeRefs(names_1.default.scope)}return ${validateCode}`;
        if (this.opts.code.process)
          sourceCode = this.opts.code.process(sourceCode, sch);
        const makeValidate = new Function(`${names_1.default.self}`, `${names_1.default.scope}`, sourceCode);
        const validate = makeValidate(this, this.scope.get());
        this.scope.value(validateName, { ref: validate });
        validate.errors = null;
        validate.schema = sch.schema;
        validate.schemaEnv = sch;
        if (sch.$async)
          validate.$async = true;
        if (this.opts.code.source === true) {
          validate.source = { validateName, validateCode, scopeValues: gen._values };
        }
        if (this.opts.unevaluated) {
          const { props, items } = schemaCxt;
          validate.evaluated = {
            props: props instanceof codegen_1.Name ? void 0 : props,
            items: items instanceof codegen_1.Name ? void 0 : items,
            dynamicProps: props instanceof codegen_1.Name,
            dynamicItems: items instanceof codegen_1.Name
          };
          if (validate.source)
            validate.source.evaluated = (0, codegen_1.stringify)(validate.evaluated);
        }
        sch.validate = validate;
        return sch;
      } catch (e) {
        delete sch.validate;
        delete sch.validateName;
        if (sourceCode)
          this.logger.error("Error compiling schema, function code:", sourceCode);
        throw e;
      } finally {
        this._compilations.delete(sch);
      }
    }
    exports.compileSchema = compileSchema;
    function resolveRef(root, baseId, ref) {
      var _a;
      ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, ref);
      const schOrFunc = root.refs[ref];
      if (schOrFunc)
        return schOrFunc;
      let _sch = resolve2.call(this, root, ref);
      if (_sch === void 0) {
        const schema2 = (_a = root.localRefs) === null || _a === void 0 ? void 0 : _a[ref];
        const { schemaId } = this.opts;
        if (schema2)
          _sch = new SchemaEnv({ schema: schema2, schemaId, root, baseId });
      }
      if (_sch === void 0)
        return;
      return root.refs[ref] = inlineOrCompile.call(this, _sch);
    }
    exports.resolveRef = resolveRef;
    function inlineOrCompile(sch) {
      if ((0, resolve_1.inlineRef)(sch.schema, this.opts.inlineRefs))
        return sch.schema;
      return sch.validate ? sch : compileSchema.call(this, sch);
    }
    function getCompilingSchema(schEnv) {
      for (const sch of this._compilations) {
        if (sameSchemaEnv(sch, schEnv))
          return sch;
      }
    }
    exports.getCompilingSchema = getCompilingSchema;
    function sameSchemaEnv(s1, s2) {
      return s1.schema === s2.schema && s1.root === s2.root && s1.baseId === s2.baseId;
    }
    function resolve2(root, ref) {
      let sch;
      while (typeof (sch = this.refs[ref]) == "string")
        ref = sch;
      return sch || this.schemas[ref] || resolveSchema.call(this, root, ref);
    }
    function resolveSchema(root, ref) {
      const p = this.opts.uriResolver.parse(ref);
      const refPath = (0, resolve_1._getFullPath)(this.opts.uriResolver, p);
      let baseId = (0, resolve_1.getFullPath)(this.opts.uriResolver, root.baseId, void 0);
      if (Object.keys(root.schema).length > 0 && refPath === baseId) {
        return getJsonPointer.call(this, p, root);
      }
      const id = (0, resolve_1.normalizeId)(refPath);
      const schOrRef = this.refs[id] || this.schemas[id];
      if (typeof schOrRef == "string") {
        const sch = resolveSchema.call(this, root, schOrRef);
        if (typeof (sch === null || sch === void 0 ? void 0 : sch.schema) !== "object")
          return;
        return getJsonPointer.call(this, p, sch);
      }
      if (typeof (schOrRef === null || schOrRef === void 0 ? void 0 : schOrRef.schema) !== "object")
        return;
      if (!schOrRef.validate)
        compileSchema.call(this, schOrRef);
      if (id === (0, resolve_1.normalizeId)(ref)) {
        const { schema: schema2 } = schOrRef;
        const { schemaId } = this.opts;
        const schId = schema2[schemaId];
        if (schId)
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        return new SchemaEnv({ schema: schema2, schemaId, root, baseId });
      }
      return getJsonPointer.call(this, p, schOrRef);
    }
    exports.resolveSchema = resolveSchema;
    var PREVENT_SCOPE_CHANGE = /* @__PURE__ */ new Set([
      "properties",
      "patternProperties",
      "enum",
      "dependencies",
      "definitions"
    ]);
    function getJsonPointer(parsedRef, { baseId, schema: schema2, root }) {
      var _a;
      if (((_a = parsedRef.fragment) === null || _a === void 0 ? void 0 : _a[0]) !== "/")
        return;
      for (const part of parsedRef.fragment.slice(1).split("/")) {
        if (typeof schema2 === "boolean")
          return;
        const partSchema = schema2[(0, util_1.unescapeFragment)(part)];
        if (partSchema === void 0)
          return;
        schema2 = partSchema;
        const schId = typeof schema2 === "object" && schema2[this.opts.schemaId];
        if (!PREVENT_SCOPE_CHANGE.has(part) && schId) {
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        }
      }
      let env;
      if (typeof schema2 != "boolean" && schema2.$ref && !(0, util_1.schemaHasRulesButRef)(schema2, this.RULES)) {
        const $ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schema2.$ref);
        env = resolveSchema.call(this, root, $ref);
      }
      const { schemaId } = this.opts;
      env = env || new SchemaEnv({ schema: schema2, schemaId, root, baseId });
      if (env.schema !== env.root.schema)
        return env;
      return void 0;
    }
  }
});

// node_modules/ajv/dist/refs/data.json
var require_data = __commonJS({
  "node_modules/ajv/dist/refs/data.json"(exports, module) {
    module.exports = {
      $id: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#",
      description: "Meta-schema for $data reference (JSON AnySchema extension proposal)",
      type: "object",
      required: ["$data"],
      properties: {
        $data: {
          type: "string",
          anyOf: [{ format: "relative-json-pointer" }, { format: "json-pointer" }]
        }
      },
      additionalProperties: false
    };
  }
});

// node_modules/fast-uri/lib/utils.js
var require_utils = __commonJS({
  "node_modules/fast-uri/lib/utils.js"(exports, module) {
    "use strict";
    var isUUID = RegExp.prototype.test.bind(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu);
    var isIPv4 = RegExp.prototype.test.bind(/^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/u);
    var isPort = RegExp.prototype.test.bind(/^\d*$/u);
    var isHexPair = RegExp.prototype.test.bind(/^[\da-f]{2}$/iu);
    var isUnreserved = RegExp.prototype.test.bind(/^[\da-z\-._~]$/iu);
    var isPathCharacter = RegExp.prototype.test.bind(/^[A-Za-z0-9\-._~!$&'()*+,;=:@/]$/u);
    var isQueryFragmentCharacter = RegExp.prototype.test.bind(/^[A-Za-z0-9\-._~!$&'()*+,;=:@/?]$/u);
    var isUserinfoCharacter = RegExp.prototype.test.bind(/^[A-Za-z0-9\-._~!$&'()*+,;=:]$/u);
    var BYTE_HEX = new Array(256);
    {
      const HEX_DIGITS = "0123456789ABCDEF";
      for (let i = 0; i < 256; i++) {
        BYTE_HEX[i] = "%" + HEX_DIGITS[i >> 4] + HEX_DIGITS[i & 15];
      }
    }
    function percentEncodeNonAscii(cp) {
      if (cp < 2048) {
        return BYTE_HEX[192 | cp >> 6] + BYTE_HEX[128 | cp & 63];
      }
      if (cp < 65536) {
        return BYTE_HEX[224 | cp >> 12] + BYTE_HEX[128 | cp >> 6 & 63] + BYTE_HEX[128 | cp & 63];
      }
      return BYTE_HEX[240 | cp >> 18] + BYTE_HEX[128 | cp >> 12 & 63] + BYTE_HEX[128 | cp >> 6 & 63] + BYTE_HEX[128 | cp & 63];
    }
    function stringArrayToHexStripped(input) {
      let acc = "";
      let code = 0;
      let i = 0;
      for (i = 0; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (code === 48) {
          continue;
        }
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
        break;
      }
      for (i += 1; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
      }
      return acc;
    }
    var isHextet = RegExp.prototype.test.bind(/^[\dA-Fa-f]{1,4}$/);
    var isIPvFuture = RegExp.prototype.test.bind(/^[vV][\dA-Fa-f]+\.[A-Za-z\d\-._~!$&'()*+,;=:]+$/);
    var isZoneCharacter = RegExp.prototype.test.bind(/^[A-Za-z\d\-._~]$/);
    var nonSimpleDomain = RegExp.prototype.test.bind(/[^!"$&'()*+,\-.;=_`a-z{}~]/u);
    function isZoneIdentifier(zone) {
      if (zone.length === 0) return false;
      for (let i = 0; i < zone.length; i++) {
        if (isZoneCharacter(zone[i])) continue;
        if (zone[i] === "%" && i + 2 < zone.length && isHexPair(zone.slice(i + 1, i + 3))) {
          i += 2;
          continue;
        }
        return false;
      }
      return true;
    }
    function compressIPv6ZeroRun(hextets) {
      let bestStart = -1;
      let bestLength = 0;
      let runStart = -1;
      let runLength = 0;
      for (let i = 0; i < hextets.length; i++) {
        if (hextets[i] === "0") {
          if (runStart === -1) runStart = i;
          runLength++;
          if (runLength > bestLength) {
            bestLength = runLength;
            bestStart = runStart;
          }
        } else {
          runStart = -1;
          runLength = 0;
        }
      }
      if (bestLength < 2) return hextets.join(":");
      const head = hextets.slice(0, bestStart).join(":");
      const tail = hextets.slice(bestStart + bestLength).join(":");
      return head + "::" + tail;
    }
    function normalizeIPv6Address(input) {
      const compression = input.indexOf("::");
      if (compression !== -1 && input.indexOf("::", compression + 1) !== -1) return void 0;
      const left = compression === -1 ? input.split(":") : input.slice(0, compression).split(":");
      const right = compression === -1 ? [] : input.slice(compression + 2).split(":");
      if (compression !== -1) {
        if (left.length === 1 && left[0] === "") left.length = 0;
        if (right.length === 1 && right[0] === "") right.length = 0;
      }
      const parts = left.concat(right);
      let hextetCount = 0;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part === "") return void 0;
        if (part.indexOf(".") !== -1) {
          if (i !== parts.length - 1 || compression !== -1 && right.length === 0 || !isIPv4(part)) return void 0;
          hextetCount += 2;
          continue;
        }
        if (!isHextet(part)) return void 0;
        parts[i] = parseInt(part, 16).toString(16);
        hextetCount++;
      }
      if (compression === -1) {
        if (hextetCount !== 8) return void 0;
        return compressIPv6ZeroRun(parts);
      }
      if (hextetCount >= 8) return void 0;
      const expanded = parts.slice(0, left.length);
      for (let i = hextetCount; i < 8; i++) expanded.push("0");
      for (let i = left.length; i < parts.length; i++) expanded.push(parts[i]);
      return compressIPv6ZeroRun(expanded);
    }
    function normalizeIPv6(host) {
      const bracketed = host[0] === "[" && host[host.length - 1] === "]";
      const hasBracket = host[0] === "[" || host[host.length - 1] === "]";
      if (hasBracket && !bracketed) return { host, isIPV6: false, error: true };
      let input = bracketed ? host.slice(1, -1) : host;
      if (bracketed && isIPvFuture(input)) {
        input = input.toLowerCase();
        return { host: `[${input}]`, escapedHost: input, isIPV6: false, isIPVFuture: true };
      }
      if (findToken(input, ":") < 2) {
        return { host, isIPV6: false, error: bracketed };
      }
      let zoneIdentifier = "";
      const zoneSeparator = input.indexOf("%");
      if (zoneSeparator !== -1) {
        const separatorLength = input.slice(zoneSeparator, zoneSeparator + 3).toLowerCase() === "%25" ? 3 : 1;
        zoneIdentifier = input.slice(zoneSeparator + separatorLength);
        if (!isZoneIdentifier(zoneIdentifier)) return { host, isIPV6: false, error: true };
        input = input.slice(0, zoneSeparator);
      }
      const address = normalizeIPv6Address(input);
      if (address === void 0) return { host, isIPV6: false, error: true };
      return {
        host: address + (zoneIdentifier ? "%" + zoneIdentifier : ""),
        escapedHost: address + (zoneIdentifier ? "%25" + zoneIdentifier : ""),
        isIPV6: true
      };
    }
    function findToken(str, token) {
      let ind = 0;
      for (let i = 0; i < str.length; i++) {
        if (str[i] === token) ind++;
      }
      return ind;
    }
    function removeDotSegments(path) {
      let input = path;
      const output = [];
      let nextSlash = -1;
      let len = 0;
      while (len = input.length) {
        if (len === 1) {
          if (input === ".") {
            break;
          } else if (input === "/") {
            output.push("/");
            break;
          } else {
            output.push(input);
            break;
          }
        } else if (len === 2) {
          if (input[0] === ".") {
            if (input[1] === ".") {
              break;
            } else if (input[1] === "/") {
              input = input.slice(2);
              continue;
            }
          } else if (input[0] === "/") {
            if (input[1] === "." || input[1] === "/") {
              output.push("/");
              break;
            }
          }
        } else if (len === 3) {
          if (input === "/..") {
            if (output.length !== 0) {
              output.pop();
            }
            output.push("/");
            break;
          }
        }
        if (input[0] === ".") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(3);
              continue;
            }
          } else if (input[1] === "/") {
            input = input.slice(2);
            continue;
          }
        } else if (input[0] === "/") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(2);
              continue;
            } else if (input[2] === ".") {
              if (input[3] === "/") {
                input = input.slice(3);
                if (output.length !== 0) {
                  output.pop();
                }
                continue;
              }
            }
          }
        }
        if ((nextSlash = input.indexOf("/", 1)) === -1) {
          output.push(input);
          break;
        } else {
          output.push(input.slice(0, nextSlash));
          input = input.slice(nextSlash);
        }
      }
      return output.join("");
    }
    var HOST_DELIMS = { "@": "%40", "/": "%2F", "?": "%3F", "#": "%23", ":": "%3A" };
    var HOST_DELIM_RE = /[@/?#:]/g;
    var HOST_DELIM_NO_COLON_RE = /[@/?#]/g;
    function reescapeHostDelimiters(host, isIP) {
      const re = isIP ? HOST_DELIM_NO_COLON_RE : HOST_DELIM_RE;
      re.lastIndex = 0;
      return host.replace(re, (ch) => HOST_DELIMS[ch]);
    }
    function normalizePercentEncoding(input, decodeUnreserved = false) {
      if (input.indexOf("%") === -1) {
        return input;
      }
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (decodeUnreserved && isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        output += input[i];
      }
      return output;
    }
    function normalizePathEncoding(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (decoded !== "." && isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        if (isPathCharacter(ch)) {
          output += ch;
        } else {
          const code = input.charCodeAt(i);
          if (code < 128) {
            output += isEscapeSafe(code) ? ch : BYTE_HEX[code];
          } else if (code < 55296 || code > 57343) {
            output += percentEncodeNonAscii(code);
          } else if (code <= 56319 && i + 1 < input.length) {
            const low = input.charCodeAt(i + 1);
            if (low >= 56320 && low <= 57343) {
              output += percentEncodeNonAscii(65536 + (code - 55296 << 10) + (low - 56320));
              i++;
            } else {
              output += percentEncodeNonAscii(65533);
            }
          } else {
            output += percentEncodeNonAscii(65533);
          }
        }
      }
      return output;
    }
    function serializePathEncoding(input, pathNoScheme = false) {
      let output = "";
      let firstSegment = pathNoScheme && input[0] !== "/";
      for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            output += "%" + hex.toUpperCase();
            i += 2;
            continue;
          }
        }
        if (ch === "/") {
          firstSegment = false;
        }
        if (isPathCharacter(ch) && (ch !== ":" || !firstSegment)) {
          output += ch;
        } else {
          const code = input.charCodeAt(i);
          if (code < 128) {
            output += BYTE_HEX[code];
          } else if (code < 55296 || code > 57343) {
            output += percentEncodeNonAscii(code);
          } else if (code <= 56319 && i + 1 < input.length) {
            const low = input.charCodeAt(i + 1);
            if (low >= 56320 && low <= 57343) {
              output += percentEncodeNonAscii(65536 + (code - 55296 << 10) + (low - 56320));
              i++;
            } else {
              output += percentEncodeNonAscii(65533);
            }
          } else {
            output += percentEncodeNonAscii(65533);
          }
        }
      }
      return output;
    }
    function encodeComponent(input, isAllowed) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            output += "%" + hex.toUpperCase();
            i += 2;
            continue;
          }
        }
        if (isAllowed(ch)) {
          output += ch;
        } else {
          const code = input.charCodeAt(i);
          if (code < 128) {
            output += BYTE_HEX[code];
          } else if (code < 55296 || code > 57343) {
            output += percentEncodeNonAscii(code);
          } else if (code <= 56319 && i + 1 < input.length) {
            const low = input.charCodeAt(i + 1);
            if (low >= 56320 && low <= 57343) {
              output += percentEncodeNonAscii(65536 + (code - 55296 << 10) + (low - 56320));
              i++;
            } else {
              output += percentEncodeNonAscii(65533);
            }
          } else {
            output += percentEncodeNonAscii(65533);
          }
        }
      }
      return output;
    }
    function encodeUserinfo(input) {
      return encodeComponent(input, isUserinfoCharacter);
    }
    function encodeQuery(input) {
      return encodeComponent(input, isQueryFragmentCharacter);
    }
    function encodeFragment(input) {
      return encodeComponent(input, isQueryFragmentCharacter);
    }
    function isEscapeSafe(cp) {
      return cp >= 48 && cp <= 57 || cp >= 65 && cp <= 90 || cp >= 97 && cp <= 122 || cp === 42 || cp === 43 || cp === 45 || cp === 46 || cp === 47 || cp === 64 || cp === 95;
    }
    function normalizeQueryFragmentEncoding(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        if (isQueryFragmentCharacter(ch)) {
          output += ch;
        } else {
          const code = input.charCodeAt(i);
          if (code < 128) {
            output += isEscapeSafe(code) ? ch : BYTE_HEX[code];
          } else if (code < 55296 || code > 57343) {
            output += percentEncodeNonAscii(code);
          } else if (code <= 56319 && i + 1 < input.length) {
            const low = input.charCodeAt(i + 1);
            if (low >= 56320 && low <= 57343) {
              output += percentEncodeNonAscii(65536 + (code - 55296 << 10) + (low - 56320));
              i++;
            } else {
              output += percentEncodeNonAscii(65533);
            }
          } else {
            output += percentEncodeNonAscii(65533);
          }
        }
      }
      return output;
    }
    function escapePreservingEscapes(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            output += "%" + hex.toUpperCase();
            i += 2;
            continue;
          }
        }
        output += escape(input[i]);
      }
      return output;
    }
    function recomposeAuthority(component) {
      const uriTokens = [];
      if (component.userinfo !== void 0) {
        uriTokens.push(encodeUserinfo(component.userinfo));
        uriTokens.push("@");
      }
      if (component.host !== void 0) {
        let host = component.host;
        if (!isIPv4(host)) {
          let ipV6res = normalizeIPv6(host);
          if (ipV6res.isIPV6 !== true && ipV6res.isIPVFuture !== true) {
            host = normalizePercentEncoding(host, true);
            ipV6res = normalizeIPv6(host);
          }
          if (ipV6res.isIPV6 === true || ipV6res.isIPVFuture === true) {
            host = `[${ipV6res.escapedHost}]`;
          } else {
            host = reescapeHostDelimiters(host, false);
          }
        }
        uriTokens.push(host);
      }
      if (typeof component.port === "number" || typeof component.port === "string") {
        const port = String(component.port);
        if (!isPort(port)) {
          throw new TypeError("URI port is malformed.");
        }
        uriTokens.push(":");
        uriTokens.push(port);
      }
      return uriTokens.length ? uriTokens.join("") : void 0;
    }
    module.exports = {
      nonSimpleDomain,
      recomposeAuthority,
      reescapeHostDelimiters,
      normalizePercentEncoding,
      normalizePathEncoding,
      serializePathEncoding,
      normalizeQueryFragmentEncoding,
      encodeUserinfo,
      encodeQuery,
      encodeFragment,
      escapePreservingEscapes,
      removeDotSegments,
      isIPv4,
      isUUID,
      normalizeIPv6,
      stringArrayToHexStripped
    };
  }
});

// node_modules/fast-uri/lib/schemes.js
var require_schemes = __commonJS({
  "node_modules/fast-uri/lib/schemes.js"(exports, module) {
    "use strict";
    var { isUUID } = require_utils();
    var URN_REG = /^([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-./:;=@]|%[\da-f]{2})+)$/iu;
    var supportedSchemeNames = (
      /** @type {const} */
      [
        "http",
        "https",
        "ws",
        "wss",
        "urn",
        "urn:uuid"
      ]
    );
    function isValidSchemeName(name) {
      return supportedSchemeNames.indexOf(
        /** @type {*} */
        name
      ) !== -1;
    }
    function wsIsSecure(wsComponent) {
      if (wsComponent.secure === true) {
        return true;
      } else if (wsComponent.secure === false) {
        return false;
      } else if (wsComponent.scheme) {
        return wsComponent.scheme.length === 3 && (wsComponent.scheme[0] === "w" || wsComponent.scheme[0] === "W") && (wsComponent.scheme[1] === "s" || wsComponent.scheme[1] === "S") && (wsComponent.scheme[2] === "s" || wsComponent.scheme[2] === "S");
      } else {
        return false;
      }
    }
    function httpParse(component) {
      if (!component.host) {
        component.error = component.error || "HTTP URIs must have a host.";
      }
      return component;
    }
    function httpSerialize(component) {
      const secure = String(component.scheme).toLowerCase() === "https";
      if (component.port === (secure ? 443 : 80) || component.port === "") {
        component.port = void 0;
      }
      if (!component.path) {
        component.path = "/";
      }
      return component;
    }
    function wsParse(wsComponent) {
      wsComponent.secure = wsIsSecure(wsComponent);
      wsComponent.resourceName = (wsComponent.path || "/") + (wsComponent.query ? "?" + wsComponent.query : "");
      wsComponent.path = void 0;
      wsComponent.query = void 0;
      return wsComponent;
    }
    function wsSerialize(wsComponent) {
      if (wsComponent.port === (wsIsSecure(wsComponent) ? 443 : 80) || wsComponent.port === "") {
        wsComponent.port = void 0;
      }
      if (typeof wsComponent.secure === "boolean") {
        wsComponent.scheme = wsComponent.secure ? "wss" : "ws";
        wsComponent.secure = void 0;
      }
      if (wsComponent.resourceName) {
        const queryIndex = wsComponent.resourceName.indexOf("?");
        const path = queryIndex === -1 ? wsComponent.resourceName : wsComponent.resourceName.slice(0, queryIndex);
        wsComponent.path = path && path !== "/" ? path : void 0;
        wsComponent.query = queryIndex === -1 ? void 0 : wsComponent.resourceName.slice(queryIndex + 1);
        wsComponent.resourceName = void 0;
      }
      wsComponent.fragment = void 0;
      return wsComponent;
    }
    function urnParse(urnComponent, options) {
      if (!urnComponent.path) {
        urnComponent.error = "URN can not be parsed";
        return urnComponent;
      }
      const matches = urnComponent.path.match(URN_REG);
      if (matches && matches[0] === urnComponent.path) {
        const scheme = options.scheme || urnComponent.scheme || "urn";
        urnComponent.nid = matches[1].toLowerCase();
        urnComponent.nss = matches[2];
        const urnScheme = `${scheme}:${options.nid || urnComponent.nid}`;
        const schemeHandler = getSchemeHandler(urnScheme);
        urnComponent.path = void 0;
        if (schemeHandler) {
          urnComponent = schemeHandler.parse(urnComponent, options);
        }
      } else {
        urnComponent.error = urnComponent.error || "URN can not be parsed.";
      }
      return urnComponent;
    }
    function urnSerialize(urnComponent, options) {
      if (urnComponent.nid === void 0) {
        throw new Error("URN without nid cannot be serialized");
      }
      const scheme = options.scheme || urnComponent.scheme || "urn";
      const nid = urnComponent.nid.toLowerCase();
      const urnScheme = `${scheme}:${options.nid || nid}`;
      const schemeHandler = getSchemeHandler(urnScheme);
      if (schemeHandler) {
        urnComponent = schemeHandler.serialize(urnComponent, options);
      }
      const uriComponent = urnComponent;
      const nss = urnComponent.nss;
      uriComponent.path = `${nid || options.nid}:${nss}`;
      options.skipEscape = true;
      return uriComponent;
    }
    function urnuuidParse(urnComponent, options) {
      const uuidComponent = urnComponent;
      uuidComponent.uuid = uuidComponent.nss;
      uuidComponent.nss = void 0;
      if (!options.tolerant && (!uuidComponent.uuid || !isUUID(uuidComponent.uuid))) {
        uuidComponent.error = uuidComponent.error || "UUID is not valid.";
      }
      return uuidComponent;
    }
    function urnuuidSerialize(uuidComponent) {
      const urnComponent = uuidComponent;
      urnComponent.nss = (uuidComponent.uuid || "").toLowerCase();
      return urnComponent;
    }
    var http = (
      /** @type {SchemeHandler} */
      {
        scheme: "http",
        domainHost: true,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var https = (
      /** @type {SchemeHandler} */
      {
        scheme: "https",
        domainHost: http.domainHost,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var ws = (
      /** @type {SchemeHandler} */
      {
        scheme: "ws",
        domainHost: true,
        parse: wsParse,
        serialize: wsSerialize
      }
    );
    var wss = (
      /** @type {SchemeHandler} */
      {
        scheme: "wss",
        domainHost: ws.domainHost,
        parse: ws.parse,
        serialize: ws.serialize
      }
    );
    var urn = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn",
        parse: urnParse,
        serialize: urnSerialize,
        skipNormalize: true
      }
    );
    var urnuuid = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn:uuid",
        parse: urnuuidParse,
        serialize: urnuuidSerialize,
        skipNormalize: true
      }
    );
    var SCHEMES = (
      /** @type {Record<SchemeName, SchemeHandler>} */
      {
        http,
        https,
        ws,
        wss,
        urn,
        "urn:uuid": urnuuid
      }
    );
    Object.setPrototypeOf(SCHEMES, null);
    function getSchemeHandler(scheme) {
      return scheme && (SCHEMES[
        /** @type {SchemeName} */
        scheme
      ] || SCHEMES[
        /** @type {SchemeName} */
        scheme.toLowerCase()
      ]) || void 0;
    }
    module.exports = {
      wsIsSecure,
      SCHEMES,
      isValidSchemeName,
      getSchemeHandler
    };
  }
});

// node_modules/fast-uri/index.js
var require_fast_uri = __commonJS({
  "node_modules/fast-uri/index.js"(exports, module) {
    "use strict";
    var { normalizeIPv6, removeDotSegments, recomposeAuthority, normalizePercentEncoding, normalizePathEncoding, serializePathEncoding, normalizeQueryFragmentEncoding, encodeQuery, encodeFragment, reescapeHostDelimiters, isIPv4, nonSimpleDomain } = require_utils();
    var { SCHEMES, getSchemeHandler } = require_schemes();
    var VALID_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*$/u;
    var MALFORMED_SCHEME_ERROR = "URI scheme is malformed.";
    function decodeValidScheme(scheme) {
      const decodedScheme = unescape(String(scheme));
      if (!VALID_SCHEME.test(decodedScheme)) {
        throw new TypeError(MALFORMED_SCHEME_ERROR);
      }
      return decodedScheme;
    }
    function normalize(uri, options) {
      if (typeof uri === "string") {
        uri = /** @type {T} */
        normalizeString(uri, options);
      } else if (typeof uri === "object") {
        uri = /** @type {T} */
        parse(serialize(uri, options), options);
      }
      return uri;
    }
    function resolve2(baseURI, relativeURI, options) {
      const schemelessOptions = options ? Object.assign({ scheme: "null" }, options) : { scheme: "null" };
      const {
        parsed: baseParsed,
        malformedAuthorityOrPort: baseMalformed,
        malformedPercentEncoding: baseMalformedPercentEncoding,
        malformedSchemeSpecific: baseMalformedSchemeSpecific,
        malformedHost: baseMalformedHost,
        malformedScheme: baseMalformedScheme
      } = parseWithStatus(baseURI, schemelessOptions);
      const {
        parsed: relativeParsed,
        malformedAuthorityOrPort: relativeMalformed,
        malformedPercentEncoding: relativeMalformedPercentEncoding,
        malformedSchemeSpecific: relativeMalformedSchemeSpecific,
        malformedHost: relativeMalformedHost,
        malformedScheme: relativeMalformedScheme
      } = parseWithStatus(relativeURI, schemelessOptions);
      if (baseMalformed || relativeMalformed || baseMalformedPercentEncoding || relativeMalformedPercentEncoding || baseMalformedSchemeSpecific || relativeMalformedSchemeSpecific || baseMalformedHost || relativeMalformedHost || baseMalformedScheme || relativeMalformedScheme) {
        throw new Error(baseParsed.error || relativeParsed.error || "URI is malformed.");
      }
      const resolved = resolveComponent(baseParsed, relativeParsed, schemelessOptions, true);
      const resolvedSchemeHandler = getSchemeHandler(options && options.scheme || resolved.scheme);
      const resolvedHost = resolved.host;
      const resolvedHostIsIP = resolvedHost !== void 0 && resolvedHost !== "" && (isIPv4(resolvedHost) || normalizeIPv6(resolvedHost).isIPV6);
      canonicalizeHost(resolved, options || {}, resolvedSchemeHandler, resolvedHostIsIP);
      const encodedASCIIHost = resolvedHost && resolvedHost.indexOf("%") !== -1 && !new RegExp("\\P{ASCII}", "u").test(resolvedHost);
      if (resolved.error && !encodedASCIIHost) {
        throw new Error(resolved.error);
      }
      schemelessOptions.skipEscape = true;
      return serialize(resolved, schemelessOptions);
    }
    function resolveComponent(base, relative, options, skipNormalization) {
      const target = {};
      if (!skipNormalization) {
        base = parse(serialize(base, options), options);
        relative = parse(serialize(relative, options), options);
      }
      options = options || {};
      if (!options.tolerant && relative.scheme) {
        target.scheme = relative.scheme;
        target.userinfo = relative.userinfo;
        target.host = relative.host;
        target.port = relative.port;
        target.path = removeDotSegments(relative.path || "");
        target.query = relative.query;
      } else {
        if (relative.userinfo !== void 0 || relative.host !== void 0 || relative.port !== void 0) {
          target.userinfo = relative.userinfo;
          target.host = relative.host;
          target.port = relative.port;
          target.path = removeDotSegments(relative.path || "");
          target.query = relative.query;
        } else {
          if (!relative.path) {
            target.path = base.path;
            if (relative.query !== void 0) {
              target.query = relative.query;
            } else {
              target.query = base.query;
            }
          } else {
            if (relative.path[0] === "/") {
              target.path = removeDotSegments(relative.path);
            } else {
              if ((base.userinfo !== void 0 || base.host !== void 0 || base.port !== void 0) && !base.path) {
                target.path = "/" + relative.path;
              } else if (!base.path) {
                target.path = relative.path;
              } else {
                target.path = base.path.slice(0, base.path.lastIndexOf("/") + 1) + relative.path;
              }
              target.path = removeDotSegments(target.path);
            }
            target.query = relative.query;
          }
          target.userinfo = base.userinfo;
          target.host = base.host;
          target.port = base.port;
        }
        target.scheme = base.scheme;
      }
      target.fragment = relative.fragment;
      return target;
    }
    function equal(uriA, uriB, options) {
      const normalizedA = normalizeComparableURI(uriA, options);
      const normalizedB = normalizeComparableURI(uriB, options);
      return normalizedA !== void 0 && normalizedB !== void 0 && normalizedA === normalizedB;
    }
    function serialize(cmpts, opts) {
      const component = {
        host: cmpts.host,
        scheme: cmpts.scheme,
        userinfo: cmpts.userinfo,
        port: cmpts.port,
        path: cmpts.path,
        query: cmpts.query,
        nid: cmpts.nid,
        nss: cmpts.nss,
        uuid: cmpts.uuid,
        fragment: cmpts.fragment,
        reference: cmpts.reference,
        resourceName: cmpts.resourceName,
        secure: cmpts.secure,
        error: ""
      };
      const options = Object.assign({}, opts);
      const uriTokens = [];
      if (component.scheme) {
        component.scheme = decodeValidScheme(component.scheme);
      }
      const schemeHandler = getSchemeHandler(options.scheme || component.scheme);
      if (schemeHandler && schemeHandler.serialize) schemeHandler.serialize(component, options);
      const hasAuthority = component.userinfo !== void 0 || component.host !== void 0 || component.port !== void 0;
      const pathNoScheme = !options.skipEscape && component.scheme === void 0 && !hasAuthority;
      if (component.path !== void 0) {
        if (!options.skipEscape) {
          component.path = serializePathEncoding(component.path, pathNoScheme);
        } else {
          component.path = normalizePercentEncoding(component.path);
        }
      }
      if (options.reference !== "suffix" && component.scheme) {
        component.scheme = decodeValidScheme(component.scheme);
        uriTokens.push(component.scheme, ":");
      }
      const authority = recomposeAuthority(component);
      if (authority !== void 0) {
        if (options.reference !== "suffix") {
          uriTokens.push("//");
        }
        uriTokens.push(authority);
        if (component.path && component.path[0] !== "/") {
          uriTokens.push("/");
        }
      }
      if (component.path !== void 0) {
        let s = component.path;
        if (!options.absolutePath && (!schemeHandler || !schemeHandler.absolutePath)) {
          s = removeDotSegments(s);
        }
        if (pathNoScheme) {
          s = serializePathEncoding(s, true);
        }
        if (authority === void 0 && s[0] === "/" && s[1] === "/") {
          s = "/%2F" + s.slice(2);
        }
        uriTokens.push(s);
      }
      if (component.query !== void 0) {
        uriTokens.push("?", encodeQuery(component.query));
      }
      if (component.fragment !== void 0) {
        uriTokens.push("#", encodeFragment(component.fragment));
      }
      return uriTokens.join("");
    }
    var URI_PARSE = /^(?:([^#/:?]+):)?(?:\/\/((?:([^#/?@]*)@)?(\[[^#/?\]]+\]|[^#/:?]*)(?::(\d*))?))?([^#?]*)(?:\?([^#]*))?(?:#((?:.|[\n\r])*))?/u;
    var AUTHORITY_PREFIX = /^(?:[^#/:?]+:)?\/\/([^/?#]*)/;
    var AUTHORITY_INTRODUCER_REGION = /^(?:[^#/:?]+:)?([/\\\t\n\r]*)/;
    function getParseError(parsed, matches) {
      if (matches[2] !== void 0 && parsed.path && parsed.path[0] !== "/") {
        return 'URI path must start with "/" when authority is present.';
      }
      if (typeof parsed.port === "number" && (parsed.port < 0 || parsed.port > 65535)) {
        return "URI port is malformed.";
      }
      return void 0;
    }
    function hasMalformedPercentEncoding(component) {
      if (component === void 0) return false;
      let percent = component.indexOf("%");
      while (percent !== -1) {
        if (percent + 2 >= component.length || !/^[\da-f]{2}$/iu.test(component.slice(percent + 1, percent + 3))) {
          return true;
        }
        percent = component.indexOf("%", percent + 3);
      }
      return false;
    }
    function isIPLiteral(host) {
      return host[0] === "[" && host[host.length - 1] === "]";
    }
    function hasMalformedComponentPercentEncoding(matches) {
      const host = matches[4];
      return hasMalformedPercentEncoding(matches[3]) || host !== void 0 && !isIPLiteral(host) && hasMalformedPercentEncoding(host) || hasMalformedPercentEncoding(matches[6]) || hasMalformedPercentEncoding(matches[7]) || hasMalformedPercentEncoding(matches[8]);
    }
    function canonicalizeHost(parsed, options, schemeHandler, isIP) {
      if (!options.unicodeSupport && (!schemeHandler || !schemeHandler.unicodeSupport) && parsed.host && !isIPLiteral(parsed.host) && (options.domainHost || schemeHandler && schemeHandler.domainHost) && isIP === false && nonSimpleDomain(parsed.host)) {
        try {
          parsed.host = new URL("http://" + parsed.host).hostname;
        } catch (e) {
          parsed.error = parsed.error || "Host's domain name can not be converted to ASCII: " + e;
          return true;
        }
      }
      return false;
    }
    function parseWithStatus(uri, opts) {
      const options = Object.assign({}, opts);
      const parsed = {
        scheme: void 0,
        userinfo: void 0,
        host: "",
        port: void 0,
        path: "",
        query: void 0,
        fragment: void 0
      };
      let malformedAuthorityOrPort = false;
      let malformedPercentEncoding = false;
      let malformedSchemeSpecific = false;
      let malformedHost = false;
      let malformedIPLiteral = false;
      let malformedScheme = false;
      let isIP = false;
      if (options.reference === "suffix") {
        if (options.scheme) {
          uri = options.scheme + ":" + uri;
        } else {
          uri = "//" + uri;
        }
      }
      const authorityMatch = uri.match(AUTHORITY_PREFIX);
      if (authorityMatch !== null && authorityMatch[1].indexOf("\\") !== -1) {
        parsed.error = "URI authority must not contain a literal backslash.";
        malformedAuthorityOrPort = true;
      }
      const introducerMatch = uri.match(AUTHORITY_INTRODUCER_REGION);
      if (introducerMatch !== null) {
        const region = introducerMatch[1];
        const normalizedRegion = region.replace(/[\t\n\r]/g, "");
        if (normalizedRegion.length >= 2) {
          if (normalizedRegion.slice(0, 2) !== "//") {
            parsed.error = parsed.error || "URI authority must not contain a literal backslash.";
            malformedAuthorityOrPort = true;
          } else if (region.length !== normalizedRegion.length) {
            parsed.error = parsed.error || "URI authority introducer must not contain whitespace.";
            malformedAuthorityOrPort = true;
          }
        }
      }
      const matches = uri.match(URI_PARSE);
      if (matches) {
        parsed.scheme = matches[1];
        parsed.userinfo = matches[3];
        parsed.host = matches[4];
        parsed.port = parseInt(matches[5], 10);
        parsed.path = matches[6] || "";
        parsed.query = matches[7];
        parsed.fragment = matches[8];
        if (parsed.scheme !== void 0) {
          const decodedScheme = unescape(parsed.scheme);
          if (VALID_SCHEME.test(decodedScheme)) {
            parsed.scheme = decodedScheme.toLowerCase();
          } else {
            parsed.error = parsed.error || MALFORMED_SCHEME_ERROR;
            malformedScheme = true;
          }
        }
        malformedPercentEncoding = hasMalformedComponentPercentEncoding(matches);
        if (malformedPercentEncoding) {
          parsed.error = parsed.error || "URI contains malformed percent-encoding.";
        }
        if (isNaN(parsed.port)) {
          parsed.port = matches[5];
        }
        const parseError = getParseError(parsed, matches);
        if (parseError !== void 0) {
          parsed.error = parsed.error || parseError;
          malformedAuthorityOrPort = true;
        }
        if (parsed.host) {
          const ipv4result = isIPv4(parsed.host);
          if (ipv4result === false) {
            const bracketedIPLiteral = isIPLiteral(parsed.host);
            const hasIPLiteralBracket = parsed.host.indexOf("[") !== -1 || parsed.host.indexOf("]") !== -1;
            const ipv6result = normalizeIPv6(parsed.host);
            isIP = ipv6result.isIPV6 || ipv6result.isIPVFuture === true;
            malformedIPLiteral = hasIPLiteralBracket && (!bracketedIPLiteral || ipv6result.error === true);
            parsed.host = isIP ? ipv6result.host : ipv6result.host.toLowerCase();
            if (malformedIPLiteral) {
              parsed.error = parsed.error || "URI host is malformed.";
              malformedAuthorityOrPort = true;
            }
          } else {
            isIP = true;
          }
        }
        if (parsed.scheme === void 0 && parsed.userinfo === void 0 && parsed.host === void 0 && parsed.port === void 0 && parsed.query === void 0 && !parsed.path) {
          parsed.reference = "same-document";
        } else if (parsed.scheme === void 0) {
          parsed.reference = "relative";
        } else if (parsed.fragment === void 0) {
          parsed.reference = "absolute";
        } else {
          parsed.reference = "uri";
        }
        if (options.reference && options.reference !== "suffix" && options.reference !== parsed.reference) {
          parsed.error = parsed.error || "URI is not a " + options.reference + " reference.";
        }
        const schemeHandler = getSchemeHandler(options.scheme || parsed.scheme);
        if (!malformedIPLiteral) {
          malformedHost = canonicalizeHost(parsed, options, schemeHandler, isIP);
        }
        if (uri.indexOf("%") !== -1 && parsed.host !== void 0 && !malformedIPLiteral) {
          let host = isIP ? parsed.host : normalizePercentEncoding(parsed.host, true);
          if (!isIP) {
            host = normalizePercentEncoding(host.toLowerCase());
          }
          parsed.host = reescapeHostDelimiters(host, isIP);
        }
        if (!schemeHandler || schemeHandler && !schemeHandler.skipNormalize) {
          if (parsed.path) {
            parsed.path = normalizePathEncoding(parsed.path);
          }
          if (parsed.query) {
            parsed.query = normalizeQueryFragmentEncoding(parsed.query);
          }
          if (parsed.fragment) {
            parsed.fragment = normalizeQueryFragmentEncoding(parsed.fragment);
          }
        }
        if (schemeHandler && schemeHandler.parse) {
          schemeHandler.parse(parsed, options);
          if (schemeHandler === SCHEMES.urn && parsed.nid === void 0) {
            malformedSchemeSpecific = true;
          }
        }
      } else {
        parsed.error = parsed.error || "URI can not be parsed.";
      }
      return { parsed, malformedAuthorityOrPort, malformedPercentEncoding, malformedSchemeSpecific, malformedHost, malformedScheme };
    }
    function parse(uri, opts) {
      return parseWithStatus(uri, opts).parsed;
    }
    function normalizeString(uri, opts) {
      return normalizeStringWithStatus(uri, opts).normalized;
    }
    function normalizeStringWithStatus(uri, opts) {
      const { parsed, malformedAuthorityOrPort, malformedPercentEncoding, malformedSchemeSpecific, malformedHost, malformedScheme } = parseWithStatus(uri, opts);
      return {
        normalized: malformedAuthorityOrPort || malformedPercentEncoding || malformedSchemeSpecific || malformedHost || malformedScheme ? uri : serialize(parsed, opts),
        malformedAuthorityOrPort,
        malformedPercentEncoding,
        malformedSchemeSpecific,
        malformedHost,
        malformedScheme
      };
    }
    function normalizeComparableURI(uri, opts) {
      if (typeof uri !== "string" && typeof uri !== "object") {
        return void 0;
      }
      let value;
      try {
        value = typeof uri === "string" ? uri : serialize(uri, opts);
      } catch {
        return void 0;
      }
      const { normalized, malformedAuthorityOrPort, malformedPercentEncoding, malformedSchemeSpecific, malformedHost, malformedScheme } = normalizeStringWithStatus(value, opts);
      return malformedAuthorityOrPort || malformedPercentEncoding || malformedSchemeSpecific || malformedHost || malformedScheme ? void 0 : normalized;
    }
    var fastUri = {
      SCHEMES,
      normalize,
      resolve: resolve2,
      resolveComponent,
      equal,
      serialize,
      parse
    };
    module.exports = fastUri;
    module.exports.default = fastUri;
    module.exports.fastUri = fastUri;
  }
});

// node_modules/ajv/dist/runtime/uri.js
var require_uri = __commonJS({
  "node_modules/ajv/dist/runtime/uri.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var uri = require_fast_uri();
    uri.code = 'require("ajv/dist/runtime/uri").default';
    exports.default = uri;
  }
});

// node_modules/ajv/dist/core.js
var require_core = __commonJS({
  "node_modules/ajv/dist/core.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = void 0;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    var ref_error_1 = require_ref_error();
    var rules_1 = require_rules();
    var compile_1 = require_compile();
    var codegen_2 = require_codegen();
    var resolve_1 = require_resolve();
    var dataType_1 = require_dataType();
    var util_1 = require_util();
    var $dataRefSchema = require_data();
    var uri_1 = require_uri();
    var defaultRegExp = (str, flags) => new RegExp(str, flags);
    defaultRegExp.code = "new RegExp";
    var META_IGNORE_OPTIONS = ["removeAdditional", "useDefaults", "coerceTypes"];
    var EXT_SCOPE_NAMES = /* @__PURE__ */ new Set([
      "validate",
      "serialize",
      "parse",
      "wrapper",
      "root",
      "schema",
      "keyword",
      "pattern",
      "formats",
      "validate$data",
      "func",
      "obj",
      "Error"
    ]);
    var removedOptions = {
      errorDataPath: "",
      format: "`validateFormats: false` can be used instead.",
      nullable: '"nullable" keyword is supported by default.',
      jsonPointers: "Deprecated jsPropertySyntax can be used instead.",
      extendRefs: "Deprecated ignoreKeywordsWithRef can be used instead.",
      missingRefs: "Pass empty schema with $id that should be ignored to ajv.addSchema.",
      processCode: "Use option `code: {process: (code, schemaEnv: object) => string}`",
      sourceCode: "Use option `code: {source: true}`",
      strictDefaults: "It is default now, see option `strict`.",
      strictKeywords: "It is default now, see option `strict`.",
      uniqueItems: '"uniqueItems" keyword is always validated.',
      unknownFormats: "Disable strict mode or pass `true` to `ajv.addFormat` (or `formats` option).",
      cache: "Map is used as cache, schema object as key.",
      serialize: "Map is used as cache, schema object as key.",
      ajvErrors: "It is default now."
    };
    var deprecatedOptions = {
      ignoreKeywordsWithRef: "",
      jsPropertySyntax: "",
      unicode: '"minLength"/"maxLength" account for unicode characters by default.'
    };
    var MAX_EXPRESSION = 200;
    function requiredOptions(o) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
      const s = o.strict;
      const _optz = (_a = o.code) === null || _a === void 0 ? void 0 : _a.optimize;
      const optimize = _optz === true || _optz === void 0 ? 1 : _optz || 0;
      const regExp = (_c = (_b = o.code) === null || _b === void 0 ? void 0 : _b.regExp) !== null && _c !== void 0 ? _c : defaultRegExp;
      const uriResolver = (_d = o.uriResolver) !== null && _d !== void 0 ? _d : uri_1.default;
      return {
        strictSchema: (_f = (_e = o.strictSchema) !== null && _e !== void 0 ? _e : s) !== null && _f !== void 0 ? _f : true,
        strictNumbers: (_h = (_g = o.strictNumbers) !== null && _g !== void 0 ? _g : s) !== null && _h !== void 0 ? _h : true,
        strictTypes: (_k = (_j = o.strictTypes) !== null && _j !== void 0 ? _j : s) !== null && _k !== void 0 ? _k : "log",
        strictTuples: (_m = (_l = o.strictTuples) !== null && _l !== void 0 ? _l : s) !== null && _m !== void 0 ? _m : "log",
        strictRequired: (_p = (_o = o.strictRequired) !== null && _o !== void 0 ? _o : s) !== null && _p !== void 0 ? _p : false,
        code: o.code ? { ...o.code, optimize, regExp } : { optimize, regExp },
        loopRequired: (_q = o.loopRequired) !== null && _q !== void 0 ? _q : MAX_EXPRESSION,
        loopEnum: (_r = o.loopEnum) !== null && _r !== void 0 ? _r : MAX_EXPRESSION,
        meta: (_s = o.meta) !== null && _s !== void 0 ? _s : true,
        messages: (_t = o.messages) !== null && _t !== void 0 ? _t : true,
        inlineRefs: (_u = o.inlineRefs) !== null && _u !== void 0 ? _u : true,
        schemaId: (_v = o.schemaId) !== null && _v !== void 0 ? _v : "$id",
        addUsedSchema: (_w = o.addUsedSchema) !== null && _w !== void 0 ? _w : true,
        validateSchema: (_x = o.validateSchema) !== null && _x !== void 0 ? _x : true,
        validateFormats: (_y = o.validateFormats) !== null && _y !== void 0 ? _y : true,
        unicodeRegExp: (_z = o.unicodeRegExp) !== null && _z !== void 0 ? _z : true,
        int32range: (_0 = o.int32range) !== null && _0 !== void 0 ? _0 : true,
        uriResolver
      };
    }
    var Ajv = class {
      constructor(opts = {}) {
        this.schemas = {};
        this.refs = {};
        this.formats = /* @__PURE__ */ Object.create(null);
        this._compilations = /* @__PURE__ */ new Set();
        this._loading = {};
        this._cache = /* @__PURE__ */ new Map();
        opts = this.opts = { ...opts, ...requiredOptions(opts) };
        const { es5, lines } = this.opts.code;
        this.scope = new codegen_2.ValueScope({ scope: {}, prefixes: EXT_SCOPE_NAMES, es5, lines });
        this.logger = getLogger(opts.logger);
        const formatOpt = opts.validateFormats;
        opts.validateFormats = false;
        this.RULES = (0, rules_1.getRules)();
        checkOptions.call(this, removedOptions, opts, "NOT SUPPORTED");
        checkOptions.call(this, deprecatedOptions, opts, "DEPRECATED", "warn");
        this._metaOpts = getMetaSchemaOptions.call(this);
        if (opts.formats)
          addInitialFormats.call(this);
        this._addVocabularies();
        this._addDefaultMetaSchema();
        if (opts.keywords)
          addInitialKeywords.call(this, opts.keywords);
        if (typeof opts.meta == "object")
          this.addMetaSchema(opts.meta);
        addInitialSchemas.call(this);
        opts.validateFormats = formatOpt;
      }
      _addVocabularies() {
        this.addKeyword("$async");
      }
      _addDefaultMetaSchema() {
        const { $data, meta, schemaId } = this.opts;
        let _dataRefSchema = $dataRefSchema;
        if (schemaId === "id") {
          _dataRefSchema = { ...$dataRefSchema };
          _dataRefSchema.id = _dataRefSchema.$id;
          delete _dataRefSchema.$id;
        }
        if (meta && $data)
          this.addMetaSchema(_dataRefSchema, _dataRefSchema[schemaId], false);
      }
      defaultMeta() {
        const { meta, schemaId } = this.opts;
        return this.opts.defaultMeta = typeof meta == "object" ? meta[schemaId] || meta : void 0;
      }
      validate(schemaKeyRef, data) {
        let v;
        if (typeof schemaKeyRef == "string") {
          v = this.getSchema(schemaKeyRef);
          if (!v)
            throw new Error(`no schema with key or ref "${schemaKeyRef}"`);
        } else {
          v = this.compile(schemaKeyRef);
        }
        const valid = v(data);
        if (!("$async" in v))
          this.errors = v.errors;
        return valid;
      }
      compile(schema2, _meta) {
        const sch = this._addSchema(schema2, _meta);
        return sch.validate || this._compileSchemaEnv(sch);
      }
      compileAsync(schema2, meta) {
        if (typeof this.opts.loadSchema != "function") {
          throw new Error("options.loadSchema should be a function");
        }
        const { loadSchema } = this.opts;
        return runCompileAsync.call(this, schema2, meta);
        async function runCompileAsync(_schema, _meta) {
          await loadMetaSchema.call(this, _schema.$schema);
          const sch = this._addSchema(_schema, _meta);
          return sch.validate || _compileAsync.call(this, sch);
        }
        async function loadMetaSchema($ref) {
          if ($ref && !this.getSchema($ref)) {
            await runCompileAsync.call(this, { $ref }, true);
          }
        }
        async function _compileAsync(sch) {
          try {
            return this._compileSchemaEnv(sch);
          } catch (e) {
            if (!(e instanceof ref_error_1.default))
              throw e;
            checkLoaded.call(this, e);
            await loadMissingSchema.call(this, e.missingSchema);
            return _compileAsync.call(this, sch);
          }
        }
        function checkLoaded({ missingSchema: ref, missingRef }) {
          if (this.refs[ref]) {
            throw new Error(`AnySchema ${ref} is loaded but ${missingRef} cannot be resolved`);
          }
        }
        async function loadMissingSchema(ref) {
          const _schema = await _loadSchema.call(this, ref);
          if (!this.refs[ref])
            await loadMetaSchema.call(this, _schema.$schema);
          if (!this.refs[ref])
            this.addSchema(_schema, ref, meta);
        }
        async function _loadSchema(ref) {
          const p = this._loading[ref];
          if (p)
            return p;
          try {
            return await (this._loading[ref] = loadSchema(ref));
          } finally {
            delete this._loading[ref];
          }
        }
      }
      // Adds schema to the instance
      addSchema(schema2, key, _meta, _validateSchema = this.opts.validateSchema) {
        if (Array.isArray(schema2)) {
          for (const sch of schema2)
            this.addSchema(sch, void 0, _meta, _validateSchema);
          return this;
        }
        let id;
        if (typeof schema2 === "object") {
          const { schemaId } = this.opts;
          id = schema2[schemaId];
          if (id !== void 0 && typeof id != "string") {
            throw new Error(`schema ${schemaId} must be string`);
          }
        }
        key = (0, resolve_1.normalizeId)(key || id);
        this._checkUnique(key);
        this.schemas[key] = this._addSchema(schema2, _meta, key, _validateSchema, true);
        return this;
      }
      // Add schema that will be used to validate other schemas
      // options in META_IGNORE_OPTIONS are alway set to false
      addMetaSchema(schema2, key, _validateSchema = this.opts.validateSchema) {
        this.addSchema(schema2, key, true, _validateSchema);
        return this;
      }
      //  Validate schema against its meta-schema
      validateSchema(schema2, throwOrLogError) {
        if (typeof schema2 == "boolean")
          return true;
        let $schema;
        $schema = schema2.$schema;
        if ($schema !== void 0 && typeof $schema != "string") {
          throw new Error("$schema must be a string");
        }
        $schema = $schema || this.opts.defaultMeta || this.defaultMeta();
        if (!$schema) {
          this.logger.warn("meta-schema not available");
          this.errors = null;
          return true;
        }
        const valid = this.validate($schema, schema2);
        if (!valid && throwOrLogError) {
          const message = "schema is invalid: " + this.errorsText();
          if (this.opts.validateSchema === "log")
            this.logger.error(message);
          else
            throw new Error(message);
        }
        return valid;
      }
      // Get compiled schema by `key` or `ref`.
      // (`key` that was passed to `addSchema` or full schema reference - `schema.$id` or resolved id)
      getSchema(keyRef) {
        let sch;
        while (typeof (sch = getSchEnv.call(this, keyRef)) == "string")
          keyRef = sch;
        if (sch === void 0) {
          const { schemaId } = this.opts;
          const root = new compile_1.SchemaEnv({ schema: {}, schemaId });
          sch = compile_1.resolveSchema.call(this, root, keyRef);
          if (!sch)
            return;
          this.refs[keyRef] = sch;
        }
        return sch.validate || this._compileSchemaEnv(sch);
      }
      // Remove cached schema(s).
      // If no parameter is passed all schemas but meta-schemas are removed.
      // If RegExp is passed all schemas with key/id matching pattern but meta-schemas are removed.
      // Even if schema is referenced by other schemas it still can be removed as other schemas have local references.
      removeSchema(schemaKeyRef) {
        if (schemaKeyRef instanceof RegExp) {
          this._removeAllSchemas(this.schemas, schemaKeyRef);
          this._removeAllSchemas(this.refs, schemaKeyRef);
          return this;
        }
        switch (typeof schemaKeyRef) {
          case "undefined":
            this._removeAllSchemas(this.schemas);
            this._removeAllSchemas(this.refs);
            this._cache.clear();
            return this;
          case "string": {
            const sch = getSchEnv.call(this, schemaKeyRef);
            if (typeof sch == "object")
              this._cache.delete(sch.schema);
            delete this.schemas[schemaKeyRef];
            delete this.refs[schemaKeyRef];
            return this;
          }
          case "object": {
            const cacheKey = schemaKeyRef;
            this._cache.delete(cacheKey);
            let id = schemaKeyRef[this.opts.schemaId];
            if (id) {
              id = (0, resolve_1.normalizeId)(id);
              delete this.schemas[id];
              delete this.refs[id];
            }
            return this;
          }
          default:
            throw new Error("ajv.removeSchema: invalid parameter");
        }
      }
      // add "vocabulary" - a collection of keywords
      addVocabulary(definitions) {
        for (const def of definitions)
          this.addKeyword(def);
        return this;
      }
      addKeyword(kwdOrDef, def) {
        let keyword;
        if (typeof kwdOrDef == "string") {
          keyword = kwdOrDef;
          if (typeof def == "object") {
            this.logger.warn("these parameters are deprecated, see docs for addKeyword");
            def.keyword = keyword;
          }
        } else if (typeof kwdOrDef == "object" && def === void 0) {
          def = kwdOrDef;
          keyword = def.keyword;
          if (Array.isArray(keyword) && !keyword.length) {
            throw new Error("addKeywords: keyword must be string or non-empty array");
          }
        } else {
          throw new Error("invalid addKeywords parameters");
        }
        checkKeyword.call(this, keyword, def);
        if (!def) {
          (0, util_1.eachItem)(keyword, (kwd) => addRule.call(this, kwd));
          return this;
        }
        keywordMetaschema.call(this, def);
        const definition = {
          ...def,
          type: (0, dataType_1.getJSONTypes)(def.type),
          schemaType: (0, dataType_1.getJSONTypes)(def.schemaType)
        };
        (0, util_1.eachItem)(keyword, definition.type.length === 0 ? (k) => addRule.call(this, k, definition) : (k) => definition.type.forEach((t) => addRule.call(this, k, definition, t)));
        return this;
      }
      getKeyword(keyword) {
        const rule = this.RULES.all[keyword];
        return typeof rule == "object" ? rule.definition : !!rule;
      }
      // Remove keyword
      removeKeyword(keyword) {
        const { RULES } = this;
        delete RULES.keywords[keyword];
        delete RULES.all[keyword];
        for (const group of RULES.rules) {
          const i = group.rules.findIndex((rule) => rule.keyword === keyword);
          if (i >= 0)
            group.rules.splice(i, 1);
        }
        return this;
      }
      // Add format
      addFormat(name, format) {
        if (typeof format == "string")
          format = new RegExp(format);
        this.formats[name] = format;
        return this;
      }
      errorsText(errors = this.errors, { separator = ", ", dataVar = "data" } = {}) {
        if (!errors || errors.length === 0)
          return "No errors";
        return errors.map((e) => `${dataVar}${e.instancePath} ${e.message}`).reduce((text, msg) => text + separator + msg);
      }
      $dataMetaSchema(metaSchema, keywordsJsonPointers) {
        const rules = this.RULES.all;
        metaSchema = JSON.parse(JSON.stringify(metaSchema));
        for (const jsonPointer of keywordsJsonPointers) {
          const segments = jsonPointer.split("/").slice(1);
          let keywords = metaSchema;
          for (const seg of segments)
            keywords = keywords[seg];
          for (const key in rules) {
            const rule = rules[key];
            if (typeof rule != "object")
              continue;
            const { $data } = rule.definition;
            const schema2 = keywords[key];
            if ($data && schema2)
              keywords[key] = schemaOrData(schema2);
          }
        }
        return metaSchema;
      }
      _removeAllSchemas(schemas, regex) {
        for (const keyRef in schemas) {
          const sch = schemas[keyRef];
          if (!regex || regex.test(keyRef)) {
            if (typeof sch == "string") {
              delete schemas[keyRef];
            } else if (sch && !sch.meta) {
              this._cache.delete(sch.schema);
              delete schemas[keyRef];
            }
          }
        }
      }
      _addSchema(schema2, meta, baseId, validateSchema2 = this.opts.validateSchema, addSchema = this.opts.addUsedSchema) {
        let id;
        const { schemaId } = this.opts;
        if (typeof schema2 == "object") {
          id = schema2[schemaId];
        } else {
          if (this.opts.jtd)
            throw new Error("schema must be object");
          else if (typeof schema2 != "boolean")
            throw new Error("schema must be object or boolean");
        }
        let sch = this._cache.get(schema2);
        if (sch !== void 0)
          return sch;
        baseId = (0, resolve_1.normalizeId)(id || baseId);
        const localRefs = resolve_1.getSchemaRefs.call(this, schema2, baseId);
        sch = new compile_1.SchemaEnv({ schema: schema2, schemaId, meta, baseId, localRefs });
        this._cache.set(sch.schema, sch);
        if (addSchema && !baseId.startsWith("#")) {
          if (baseId)
            this._checkUnique(baseId);
          this.refs[baseId] = sch;
        }
        if (validateSchema2)
          this.validateSchema(schema2, true);
        return sch;
      }
      _checkUnique(id) {
        if (this.schemas[id] || this.refs[id]) {
          throw new Error(`schema with key or id "${id}" already exists`);
        }
      }
      _compileSchemaEnv(sch) {
        if (sch.meta)
          this._compileMetaSchema(sch);
        else
          compile_1.compileSchema.call(this, sch);
        if (!sch.validate)
          throw new Error("ajv implementation error");
        return sch.validate;
      }
      _compileMetaSchema(sch) {
        const currentOpts = this.opts;
        this.opts = this._metaOpts;
        try {
          compile_1.compileSchema.call(this, sch);
        } finally {
          this.opts = currentOpts;
        }
      }
    };
    Ajv.ValidationError = validation_error_1.default;
    Ajv.MissingRefError = ref_error_1.default;
    exports.default = Ajv;
    function checkOptions(checkOpts, options, msg, log = "error") {
      for (const key in checkOpts) {
        const opt = key;
        if (opt in options)
          this.logger[log](`${msg}: option ${key}. ${checkOpts[opt]}`);
      }
    }
    function getSchEnv(keyRef) {
      keyRef = (0, resolve_1.normalizeId)(keyRef);
      return this.schemas[keyRef] || this.refs[keyRef];
    }
    function addInitialSchemas() {
      const optsSchemas = this.opts.schemas;
      if (!optsSchemas)
        return;
      if (Array.isArray(optsSchemas))
        this.addSchema(optsSchemas);
      else
        for (const key in optsSchemas)
          this.addSchema(optsSchemas[key], key);
    }
    function addInitialFormats() {
      for (const name in this.opts.formats) {
        const format = this.opts.formats[name];
        if (format)
          this.addFormat(name, format);
      }
    }
    function addInitialKeywords(defs) {
      if (Array.isArray(defs)) {
        this.addVocabulary(defs);
        return;
      }
      this.logger.warn("keywords option as map is deprecated, pass array");
      for (const keyword in defs) {
        const def = defs[keyword];
        if (!def.keyword)
          def.keyword = keyword;
        this.addKeyword(def);
      }
    }
    function getMetaSchemaOptions() {
      const metaOpts = { ...this.opts };
      for (const opt of META_IGNORE_OPTIONS)
        delete metaOpts[opt];
      return metaOpts;
    }
    var noLogs = { log() {
    }, warn() {
    }, error() {
    } };
    function getLogger(logger) {
      if (logger === false)
        return noLogs;
      if (logger === void 0)
        return console;
      if (logger.log && logger.warn && logger.error)
        return logger;
      throw new Error("logger must implement log, warn and error methods");
    }
    var KEYWORD_NAME = /^[a-z_$][a-z0-9_$:-]*$/i;
    function checkKeyword(keyword, def) {
      const { RULES } = this;
      (0, util_1.eachItem)(keyword, (kwd) => {
        if (RULES.keywords[kwd])
          throw new Error(`Keyword ${kwd} is already defined`);
        if (!KEYWORD_NAME.test(kwd))
          throw new Error(`Keyword ${kwd} has invalid name`);
      });
      if (!def)
        return;
      if (def.$data && !("code" in def || "validate" in def)) {
        throw new Error('$data keyword must have "code" or "validate" function');
      }
    }
    function addRule(keyword, definition, dataType) {
      var _a;
      const post = definition === null || definition === void 0 ? void 0 : definition.post;
      if (dataType && post)
        throw new Error('keyword with "post" flag cannot have "type"');
      const { RULES } = this;
      let ruleGroup = post ? RULES.post : RULES.rules.find(({ type: t }) => t === dataType);
      if (!ruleGroup) {
        ruleGroup = { type: dataType, rules: [] };
        RULES.rules.push(ruleGroup);
      }
      RULES.keywords[keyword] = true;
      if (!definition)
        return;
      const rule = {
        keyword,
        definition: {
          ...definition,
          type: (0, dataType_1.getJSONTypes)(definition.type),
          schemaType: (0, dataType_1.getJSONTypes)(definition.schemaType)
        }
      };
      if (definition.before)
        addBeforeRule.call(this, ruleGroup, rule, definition.before);
      else
        ruleGroup.rules.push(rule);
      RULES.all[keyword] = rule;
      (_a = definition.implements) === null || _a === void 0 ? void 0 : _a.forEach((kwd) => this.addKeyword(kwd));
    }
    function addBeforeRule(ruleGroup, rule, before) {
      const i = ruleGroup.rules.findIndex((_rule) => _rule.keyword === before);
      if (i >= 0) {
        ruleGroup.rules.splice(i, 0, rule);
      } else {
        ruleGroup.rules.push(rule);
        this.logger.warn(`rule ${before} is not defined`);
      }
    }
    function keywordMetaschema(def) {
      let { metaSchema } = def;
      if (metaSchema === void 0)
        return;
      if (def.$data && this.opts.$data)
        metaSchema = schemaOrData(metaSchema);
      def.validateSchema = this.compile(metaSchema, true);
    }
    var $dataRef = {
      $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#"
    };
    function schemaOrData(schema2) {
      return { anyOf: [schema2, $dataRef] };
    }
  }
});

// node_modules/ajv/dist/vocabularies/core/id.js
var require_id = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/id.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var def = {
      keyword: "id",
      code() {
        throw new Error('NOT SUPPORTED: keyword "id", use "$id" for schema ID');
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/ref.js
var require_ref = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/ref.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.callRef = exports.getValidate = void 0;
    var ref_error_1 = require_ref_error();
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var compile_1 = require_compile();
    var util_1 = require_util();
    var def = {
      keyword: "$ref",
      schemaType: "string",
      code(cxt) {
        const { gen, schema: $ref, it } = cxt;
        const { baseId, schemaEnv: env, validateName, opts, self: self2 } = it;
        const { root } = env;
        if (($ref === "#" || $ref === "#/") && baseId === root.baseId)
          return callRootRef();
        const schOrEnv = compile_1.resolveRef.call(self2, root, baseId, $ref);
        if (schOrEnv === void 0)
          throw new ref_error_1.default(it.opts.uriResolver, baseId, $ref);
        if (schOrEnv instanceof compile_1.SchemaEnv)
          return callValidate(schOrEnv);
        return inlineRefSchema(schOrEnv);
        function callRootRef() {
          if (env === root)
            return callRef(cxt, validateName, env, env.$async);
          const rootName = gen.scopeValue("root", { ref: root });
          return callRef(cxt, (0, codegen_1._)`${rootName}.validate`, root, root.$async);
        }
        function callValidate(sch) {
          const v = getValidate(cxt, sch);
          callRef(cxt, v, sch, sch.$async);
        }
        function inlineRefSchema(sch) {
          const schName = gen.scopeValue("schema", opts.code.source === true ? { ref: sch, code: (0, codegen_1.stringify)(sch) } : { ref: sch });
          const valid = gen.name("valid");
          const schCxt = cxt.subschema({
            schema: sch,
            dataTypes: [],
            schemaPath: codegen_1.nil,
            topSchemaRef: schName,
            errSchemaPath: $ref
          }, valid);
          cxt.mergeEvaluated(schCxt);
          cxt.ok(valid);
        }
      }
    };
    function getValidate(cxt, sch) {
      const { gen } = cxt;
      return sch.validate ? gen.scopeValue("validate", { ref: sch.validate }) : (0, codegen_1._)`${gen.scopeValue("wrapper", { ref: sch })}.validate`;
    }
    exports.getValidate = getValidate;
    function callRef(cxt, v, sch, $async) {
      const { gen, it } = cxt;
      const { allErrors, schemaEnv: env, opts } = it;
      const passCxt = opts.passContext ? names_1.default.this : codegen_1.nil;
      if ($async)
        callAsyncRef();
      else
        callSyncRef();
      function callAsyncRef() {
        if (!env.$async)
          throw new Error("async schema referenced by sync schema");
        const valid = gen.let("valid");
        gen.try(() => {
          gen.code((0, codegen_1._)`await ${(0, code_1.callValidateCode)(cxt, v, passCxt)}`);
          addEvaluatedFrom(v);
          if (!allErrors)
            gen.assign(valid, true);
        }, (e) => {
          gen.if((0, codegen_1._)`!(${e} instanceof ${it.ValidationError})`, () => gen.throw(e));
          addErrorsFrom(e);
          if (!allErrors)
            gen.assign(valid, false);
        });
        cxt.ok(valid);
      }
      function callSyncRef() {
        cxt.result((0, code_1.callValidateCode)(cxt, v, passCxt), () => addEvaluatedFrom(v), () => addErrorsFrom(v));
      }
      function addErrorsFrom(source) {
        const errs = (0, codegen_1._)`${source}.errors`;
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`);
        gen.assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
      }
      function addEvaluatedFrom(source) {
        var _a;
        if (!it.opts.unevaluated)
          return;
        const schEvaluated = (_a = sch === null || sch === void 0 ? void 0 : sch.validate) === null || _a === void 0 ? void 0 : _a.evaluated;
        if (it.props !== true) {
          if (schEvaluated && !schEvaluated.dynamicProps) {
            if (schEvaluated.props !== void 0) {
              it.props = util_1.mergeEvaluated.props(gen, schEvaluated.props, it.props);
            }
          } else {
            const props = gen.var("props", (0, codegen_1._)`${source}.evaluated.props`);
            it.props = util_1.mergeEvaluated.props(gen, props, it.props, codegen_1.Name);
          }
        }
        if (it.items !== true) {
          if (schEvaluated && !schEvaluated.dynamicItems) {
            if (schEvaluated.items !== void 0) {
              it.items = util_1.mergeEvaluated.items(gen, schEvaluated.items, it.items);
            }
          } else {
            const items = gen.var("items", (0, codegen_1._)`${source}.evaluated.items`);
            it.items = util_1.mergeEvaluated.items(gen, items, it.items, codegen_1.Name);
          }
        }
      }
    }
    exports.callRef = callRef;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/index.js
var require_core2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var id_1 = require_id();
    var ref_1 = require_ref();
    var core = [
      "$schema",
      "$id",
      "$defs",
      "$vocabulary",
      { keyword: "$comment" },
      "definitions",
      id_1.default,
      ref_1.default
    ];
    exports.default = core;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitNumber.js
var require_limitNumber = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitNumber.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var ops = codegen_1.operators;
    var KWDs = {
      maximum: { okStr: "<=", ok: ops.LTE, fail: ops.GT },
      minimum: { okStr: ">=", ok: ops.GTE, fail: ops.LT },
      exclusiveMaximum: { okStr: "<", ok: ops.LT, fail: ops.GTE },
      exclusiveMinimum: { okStr: ">", ok: ops.GT, fail: ops.LTE }
    };
    var error = {
      message: ({ keyword, schemaCode }) => (0, codegen_1.str)`must be ${KWDs[keyword].okStr} ${schemaCode}`,
      params: ({ keyword, schemaCode }) => (0, codegen_1._)`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`
    };
    var def = {
      keyword: Object.keys(KWDs),
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        cxt.fail$data((0, codegen_1._)`${data} ${KWDs[keyword].fail} ${schemaCode} || isNaN(${data})`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/multipleOf.js
var require_multipleOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/multipleOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must be multiple of ${schemaCode}`,
      params: ({ schemaCode }) => (0, codegen_1._)`{multipleOf: ${schemaCode}}`
    };
    var def = {
      keyword: "multipleOf",
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, schemaCode, it } = cxt;
        const prec = it.opts.multipleOfPrecision;
        const res = gen.let("res");
        const invalid = prec ? (0, codegen_1._)`Math.abs(Math.round(${res}) - ${res}) > 1e-${prec}` : (0, codegen_1._)`${res} !== parseInt(${res})`;
        cxt.fail$data((0, codegen_1._)`(${schemaCode} === 0 || (${res} = ${data}/${schemaCode}, ${invalid}))`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS({
  "node_modules/ajv/dist/runtime/ucs2length.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function ucs2length(str) {
      const len = str.length;
      let length = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length++;
        value = str.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str.charCodeAt(pos);
          if ((value & 64512) === 56320)
            pos++;
        }
      }
      return length;
    }
    exports.default = ucs2length;
    ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitLength.js
var require_limitLength = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitLength.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var ucs2length_1 = require_ucs2length();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxLength" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} characters`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxLength", "minLength"],
      type: "string",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode, it } = cxt;
        const op = keyword === "maxLength" ? codegen_1.operators.GT : codegen_1.operators.LT;
        const len = it.opts.unicode === false ? (0, codegen_1._)`${data}.length` : (0, codegen_1._)`${(0, util_1.useFunc)(cxt.gen, ucs2length_1.default)}(${data})`;
        cxt.fail$data((0, codegen_1._)`${len} ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/pattern.js
var require_pattern = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/pattern.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var util_1 = require_util();
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match pattern "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{pattern: ${schemaCode}}`
    };
    var def = {
      keyword: "pattern",
      type: "string",
      schemaType: "string",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema: schema2, schemaCode, it } = cxt;
        const u = it.opts.unicodeRegExp ? "u" : "";
        if ($data) {
          const { regExp } = it.opts.code;
          const regExpCode = regExp.code === "new RegExp" ? (0, codegen_1._)`new RegExp` : (0, util_1.useFunc)(gen, regExp);
          const valid = gen.let("valid");
          gen.try(() => gen.assign(valid, (0, codegen_1._)`${regExpCode}(${schemaCode}, ${u}).test(${data})`), () => gen.assign(valid, false));
          cxt.fail$data((0, codegen_1._)`!${valid}`);
        } else {
          const regExp = (0, code_1.usePattern)(cxt, schema2);
          cxt.fail$data((0, codegen_1._)`!${regExp}.test(${data})`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitProperties.js
var require_limitProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxProperties" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} properties`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxProperties", "minProperties"],
      type: "object",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxProperties" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`Object.keys(${data}).length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/required.js
var require_required = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/required.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { missingProperty } }) => (0, codegen_1.str)`must have required property '${missingProperty}'`,
      params: ({ params: { missingProperty } }) => (0, codegen_1._)`{missingProperty: ${missingProperty}}`
    };
    var def = {
      keyword: "required",
      type: "object",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, schema: schema2, schemaCode, data, $data, it } = cxt;
        const { opts } = it;
        if (!$data && schema2.length === 0)
          return;
        const useLoop = schema2.length >= opts.loopRequired;
        if (it.allErrors)
          allErrorsMode();
        else
          exitOnErrorMode();
        if (opts.strictRequired) {
          const props = cxt.parentSchema.properties;
          const { definedProperties } = cxt.it;
          for (const requiredKey of schema2) {
            if ((props === null || props === void 0 ? void 0 : props[requiredKey]) === void 0 && !definedProperties.has(requiredKey)) {
              const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
              const msg = `required property "${requiredKey}" is not defined at "${schemaPath}" (strictRequired)`;
              (0, util_1.checkStrictMode)(it, msg, it.opts.strictRequired);
            }
          }
        }
        function allErrorsMode() {
          if (useLoop || $data) {
            cxt.block$data(codegen_1.nil, loopAllRequired);
          } else {
            for (const prop of schema2) {
              (0, code_1.checkReportMissingProp)(cxt, prop);
            }
          }
        }
        function exitOnErrorMode() {
          const missing = gen.let("missing");
          if (useLoop || $data) {
            const valid = gen.let("valid", true);
            cxt.block$data(valid, () => loopUntilMissing(missing, valid));
            cxt.ok(valid);
          } else {
            gen.if((0, code_1.checkMissingProp)(cxt, schema2, missing));
            (0, code_1.reportMissingProp)(cxt, missing);
            gen.else();
          }
        }
        function loopAllRequired() {
          gen.forOf("prop", schemaCode, (prop) => {
            cxt.setParams({ missingProperty: prop });
            gen.if((0, code_1.noPropertyInData)(gen, data, prop, opts.ownProperties), () => cxt.error());
          });
        }
        function loopUntilMissing(missing, valid) {
          cxt.setParams({ missingProperty: missing });
          gen.forOf(missing, schemaCode, () => {
            gen.assign(valid, (0, code_1.propertyInData)(gen, data, missing, opts.ownProperties));
            gen.if((0, codegen_1.not)(valid), () => {
              cxt.error();
              gen.break();
            });
          }, codegen_1.nil);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitItems.js
var require_limitItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxItems" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} items`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxItems", "minItems"],
      type: "array",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxItems" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`${data}.length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/equal.js
var require_equal = __commonJS({
  "node_modules/ajv/dist/runtime/equal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var equal = require_fast_deep_equal();
    equal.code = 'require("ajv/dist/runtime/equal").default';
    exports.default = equal;
  }
});

// node_modules/ajv/dist/vocabularies/validation/uniqueItems.js
var require_uniqueItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/uniqueItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dataType_1 = require_dataType();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: ({ params: { i, j } }) => (0, codegen_1.str)`must NOT have duplicate items (items ## ${j} and ${i} are identical)`,
      params: ({ params: { i, j } }) => (0, codegen_1._)`{i: ${i}, j: ${j}}`
    };
    var def = {
      keyword: "uniqueItems",
      type: "array",
      schemaType: "boolean",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema: schema2, parentSchema, schemaCode, it } = cxt;
        if (!$data && !schema2)
          return;
        const valid = gen.let("valid");
        const itemTypes = parentSchema.items ? (0, dataType_1.getSchemaTypes)(parentSchema.items) : [];
        cxt.block$data(valid, validateUniqueItems, (0, codegen_1._)`${schemaCode} === false`);
        cxt.ok(valid);
        function validateUniqueItems() {
          const i = gen.let("i", (0, codegen_1._)`${data}.length`);
          const j = gen.let("j");
          cxt.setParams({ i, j });
          gen.assign(valid, true);
          gen.if((0, codegen_1._)`${i} > 1`, () => (canOptimize() ? loopN : loopN2)(i, j));
        }
        function canOptimize() {
          return itemTypes.length > 0 && !itemTypes.some((t) => t === "object" || t === "array");
        }
        function loopN(i, j) {
          const item = gen.name("item");
          const wrongType = (0, dataType_1.checkDataTypes)(itemTypes, item, it.opts.strictNumbers, dataType_1.DataType.Wrong);
          const indices = gen.const("indices", (0, codegen_1._)`{}`);
          gen.for((0, codegen_1._)`;${i}--;`, () => {
            gen.let(item, (0, codegen_1._)`${data}[${i}]`);
            gen.if(wrongType, (0, codegen_1._)`continue`);
            if (itemTypes.length > 1)
              gen.if((0, codegen_1._)`typeof ${item} == "string"`, (0, codegen_1._)`${item} += "_"`);
            gen.if((0, codegen_1._)`typeof ${indices}[${item}] == "number"`, () => {
              gen.assign(j, (0, codegen_1._)`${indices}[${item}]`);
              cxt.error();
              gen.assign(valid, false).break();
            }).code((0, codegen_1._)`${indices}[${item}] = ${i}`);
          });
        }
        function loopN2(i, j) {
          const eql = (0, util_1.useFunc)(gen, equal_1.default);
          const outer = gen.name("outer");
          gen.label(outer).for((0, codegen_1._)`;${i}--;`, () => gen.for((0, codegen_1._)`${j} = ${i}; ${j}--;`, () => gen.if((0, codegen_1._)`${eql}(${data}[${i}], ${data}[${j}])`, () => {
            cxt.error();
            gen.assign(valid, false).break(outer);
          })));
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/const.js
var require_const = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/const.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to constant",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValue: ${schemaCode}}`
    };
    var def = {
      keyword: "const",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schemaCode, schema: schema2 } = cxt;
        if ($data || schema2 && typeof schema2 == "object") {
          cxt.fail$data((0, codegen_1._)`!${(0, util_1.useFunc)(gen, equal_1.default)}(${data}, ${schemaCode})`);
        } else {
          cxt.fail((0, codegen_1._)`${schema2} !== ${data}`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/enum.js
var require_enum = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/enum.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to one of the allowed values",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValues: ${schemaCode}}`
    };
    var def = {
      keyword: "enum",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema: schema2, schemaCode, it } = cxt;
        if (!$data && schema2.length === 0)
          throw new Error("enum must have non-empty array");
        const useLoop = schema2.length >= it.opts.loopEnum;
        let eql;
        const getEql = () => eql !== null && eql !== void 0 ? eql : eql = (0, util_1.useFunc)(gen, equal_1.default);
        let valid;
        if (useLoop || $data) {
          valid = gen.let("valid");
          cxt.block$data(valid, loopEnum);
        } else {
          if (!Array.isArray(schema2))
            throw new Error("ajv implementation error");
          const vSchema = gen.const("vSchema", schemaCode);
          valid = (0, codegen_1.or)(...schema2.map((_x, i) => equalCode(vSchema, i)));
        }
        cxt.pass(valid);
        function loopEnum() {
          gen.assign(valid, false);
          gen.forOf("v", schemaCode, (v) => gen.if((0, codegen_1._)`${getEql()}(${data}, ${v})`, () => gen.assign(valid, true).break()));
        }
        function equalCode(vSchema, i) {
          const sch = schema2[i];
          return typeof sch === "object" && sch !== null ? (0, codegen_1._)`${getEql()}(${data}, ${vSchema}[${i}])` : (0, codegen_1._)`${data} === ${sch}`;
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/index.js
var require_validation = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var limitNumber_1 = require_limitNumber();
    var multipleOf_1 = require_multipleOf();
    var limitLength_1 = require_limitLength();
    var pattern_1 = require_pattern();
    var limitProperties_1 = require_limitProperties();
    var required_1 = require_required();
    var limitItems_1 = require_limitItems();
    var uniqueItems_1 = require_uniqueItems();
    var const_1 = require_const();
    var enum_1 = require_enum();
    var validation = [
      // number
      limitNumber_1.default,
      multipleOf_1.default,
      // string
      limitLength_1.default,
      pattern_1.default,
      // object
      limitProperties_1.default,
      required_1.default,
      // array
      limitItems_1.default,
      uniqueItems_1.default,
      // any
      { keyword: "type", schemaType: ["string", "array"] },
      { keyword: "nullable", schemaType: "boolean" },
      const_1.default,
      enum_1.default
    ];
    exports.default = validation;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalItems.js
var require_additionalItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateAdditionalItems = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "additionalItems",
      type: "array",
      schemaType: ["boolean", "object"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { parentSchema, it } = cxt;
        const { items } = parentSchema;
        if (!Array.isArray(items)) {
          (0, util_1.checkStrictMode)(it, '"additionalItems" is ignored when "items" is not an array of schemas');
          return;
        }
        validateAdditionalItems(cxt, items);
      }
    };
    function validateAdditionalItems(cxt, items) {
      const { gen, schema: schema2, data, keyword, it } = cxt;
      it.items = true;
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      if (schema2 === false) {
        cxt.setParams({ len: items.length });
        cxt.pass((0, codegen_1._)`${len} <= ${items.length}`);
      } else if (typeof schema2 == "object" && !(0, util_1.alwaysValidSchema)(it, schema2)) {
        const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items.length}`);
        gen.if((0, codegen_1.not)(valid), () => validateItems(valid));
        cxt.ok(valid);
      }
      function validateItems(valid) {
        gen.forRange("i", items.length, len, (i) => {
          cxt.subschema({ keyword, dataProp: i, dataPropType: util_1.Type.Num }, valid);
          if (!it.allErrors)
            gen.if((0, codegen_1.not)(valid), () => gen.break());
        });
      }
    }
    exports.validateAdditionalItems = validateAdditionalItems;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items.js
var require_items = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateTuple = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "array", "boolean"],
      before: "uniqueItems",
      code(cxt) {
        const { schema: schema2, it } = cxt;
        if (Array.isArray(schema2))
          return validateTuple(cxt, "additionalItems", schema2);
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema2))
          return;
        cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    function validateTuple(cxt, extraItems, schArr = cxt.schema) {
      const { gen, parentSchema, data, keyword, it } = cxt;
      checkStrictTuple(parentSchema);
      if (it.opts.unevaluated && schArr.length && it.items !== true) {
        it.items = util_1.mergeEvaluated.items(gen, schArr.length, it.items);
      }
      const valid = gen.name("valid");
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      schArr.forEach((sch, i) => {
        if ((0, util_1.alwaysValidSchema)(it, sch))
          return;
        gen.if((0, codegen_1._)`${len} > ${i}`, () => cxt.subschema({
          keyword,
          schemaProp: i,
          dataProp: i
        }, valid));
        cxt.ok(valid);
      });
      function checkStrictTuple(sch) {
        const { opts, errSchemaPath } = it;
        const l = schArr.length;
        const fullTuple = l === sch.minItems && (l === sch.maxItems || sch[extraItems] === false);
        if (opts.strictTuples && !fullTuple) {
          const msg = `"${keyword}" is ${l}-tuple, but minItems or maxItems/${extraItems} are not specified or different at path "${errSchemaPath}"`;
          (0, util_1.checkStrictMode)(it, msg, opts.strictTuples);
        }
      }
    }
    exports.validateTuple = validateTuple;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/prefixItems.js
var require_prefixItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/prefixItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var items_1 = require_items();
    var def = {
      keyword: "prefixItems",
      type: "array",
      schemaType: ["array"],
      before: "uniqueItems",
      code: (cxt) => (0, items_1.validateTuple)(cxt, "items")
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items2020.js
var require_items2020 = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items2020.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var additionalItems_1 = require_additionalItems();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { schema: schema2, parentSchema, it } = cxt;
        const { prefixItems } = parentSchema;
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema2))
          return;
        if (prefixItems)
          (0, additionalItems_1.validateAdditionalItems)(cxt, prefixItems);
        else
          cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/contains.js
var require_contains = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/contains.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1.str)`must contain at least ${min} valid item(s)` : (0, codegen_1.str)`must contain at least ${min} and no more than ${max} valid item(s)`,
      params: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1._)`{minContains: ${min}}` : (0, codegen_1._)`{minContains: ${min}, maxContains: ${max}}`
    };
    var def = {
      keyword: "contains",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema: schema2, parentSchema, data, it } = cxt;
        let min;
        let max;
        const { minContains, maxContains } = parentSchema;
        if (it.opts.next) {
          min = minContains === void 0 ? 1 : minContains;
          max = maxContains;
        } else {
          min = 1;
        }
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        cxt.setParams({ min, max });
        if (max === void 0 && min === 0) {
          (0, util_1.checkStrictMode)(it, `"minContains" == 0 without "maxContains": "contains" keyword ignored`);
          return;
        }
        if (max !== void 0 && min > max) {
          (0, util_1.checkStrictMode)(it, `"minContains" > "maxContains" is always invalid`);
          cxt.fail();
          return;
        }
        if ((0, util_1.alwaysValidSchema)(it, schema2)) {
          let cond = (0, codegen_1._)`${len} >= ${min}`;
          if (max !== void 0)
            cond = (0, codegen_1._)`${cond} && ${len} <= ${max}`;
          cxt.pass(cond);
          return;
        }
        it.items = true;
        const valid = gen.name("valid");
        if (max === void 0 && min === 1) {
          validateItems(valid, () => gen.if(valid, () => gen.break()));
        } else if (min === 0) {
          gen.let(valid, true);
          if (max !== void 0)
            gen.if((0, codegen_1._)`${data}.length > 0`, validateItemsWithCount);
        } else {
          gen.let(valid, false);
          validateItemsWithCount();
        }
        cxt.result(valid, () => cxt.reset());
        function validateItemsWithCount() {
          const schValid = gen.name("_valid");
          const count = gen.let("count", 0);
          validateItems(schValid, () => gen.if(schValid, () => checkLimits(count)));
        }
        function validateItems(_valid, block) {
          gen.forRange("i", 0, len, (i) => {
            cxt.subschema({
              keyword: "contains",
              dataProp: i,
              dataPropType: util_1.Type.Num,
              compositeRule: true
            }, _valid);
            block();
          });
        }
        function checkLimits(count) {
          gen.code((0, codegen_1._)`${count}++`);
          if (max === void 0) {
            gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true).break());
          } else {
            gen.if((0, codegen_1._)`${count} > ${max}`, () => gen.assign(valid, false).break());
            if (min === 1)
              gen.assign(valid, true);
            else
              gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true));
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/dependencies.js
var require_dependencies = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/dependencies.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateSchemaDeps = exports.validatePropertyDeps = exports.error = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    exports.error = {
      message: ({ params: { property, depsCount, deps } }) => {
        const property_ies = depsCount === 1 ? "property" : "properties";
        return (0, codegen_1.str)`must have ${property_ies} ${deps} when property ${property} is present`;
      },
      params: ({ params: { property, depsCount, deps, missingProperty } }) => (0, codegen_1._)`{property: ${property},
    missingProperty: ${missingProperty},
    depsCount: ${depsCount},
    deps: ${deps}}`
      // TODO change to reference
    };
    var def = {
      keyword: "dependencies",
      type: "object",
      schemaType: "object",
      error: exports.error,
      code(cxt) {
        const [propDeps, schDeps] = splitDependencies(cxt);
        validatePropertyDeps(cxt, propDeps);
        validateSchemaDeps(cxt, schDeps);
      }
    };
    function splitDependencies({ schema: schema2 }) {
      const propertyDeps = {};
      const schemaDeps = {};
      for (const key in schema2) {
        if (key === "__proto__")
          continue;
        const deps = Array.isArray(schema2[key]) ? propertyDeps : schemaDeps;
        deps[key] = schema2[key];
      }
      return [propertyDeps, schemaDeps];
    }
    function validatePropertyDeps(cxt, propertyDeps = cxt.schema) {
      const { gen, data, it } = cxt;
      if (Object.keys(propertyDeps).length === 0)
        return;
      const missing = gen.let("missing");
      for (const prop in propertyDeps) {
        const deps = propertyDeps[prop];
        if (deps.length === 0)
          continue;
        const hasProperty = (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties);
        cxt.setParams({
          property: prop,
          depsCount: deps.length,
          deps: deps.join(", ")
        });
        if (it.allErrors) {
          gen.if(hasProperty, () => {
            for (const depProp of deps) {
              (0, code_1.checkReportMissingProp)(cxt, depProp);
            }
          });
        } else {
          gen.if((0, codegen_1._)`${hasProperty} && (${(0, code_1.checkMissingProp)(cxt, deps, missing)})`);
          (0, code_1.reportMissingProp)(cxt, missing);
          gen.else();
        }
      }
    }
    exports.validatePropertyDeps = validatePropertyDeps;
    function validateSchemaDeps(cxt, schemaDeps = cxt.schema) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      for (const prop in schemaDeps) {
        if ((0, util_1.alwaysValidSchema)(it, schemaDeps[prop]))
          continue;
        gen.if(
          (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties),
          () => {
            const schCxt = cxt.subschema({ keyword, schemaProp: prop }, valid);
            cxt.mergeValidEvaluated(schCxt, valid);
          },
          () => gen.var(valid, true)
          // TODO var
        );
        cxt.ok(valid);
      }
    }
    exports.validateSchemaDeps = validateSchemaDeps;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/propertyNames.js
var require_propertyNames = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/propertyNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "property name must be valid",
      params: ({ params }) => (0, codegen_1._)`{propertyName: ${params.propertyName}}`
    };
    var def = {
      keyword: "propertyNames",
      type: "object",
      schemaType: ["object", "boolean"],
      error,
      code(cxt) {
        const { gen, schema: schema2, data, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema2))
          return;
        const valid = gen.name("valid");
        gen.forIn("key", data, (key) => {
          cxt.setParams({ propertyName: key });
          cxt.subschema({
            keyword: "propertyNames",
            data: key,
            dataTypes: ["string"],
            propertyName: key,
            compositeRule: true
          }, valid);
          gen.if((0, codegen_1.not)(valid), () => {
            cxt.error(true);
            if (!it.allErrors)
              gen.break();
          });
        });
        cxt.ok(valid);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js
var require_additionalProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var util_1 = require_util();
    var error = {
      message: "must NOT have additional properties",
      params: ({ params }) => (0, codegen_1._)`{additionalProperty: ${params.additionalProperty}}`
    };
    var def = {
      keyword: "additionalProperties",
      type: ["object"],
      schemaType: ["boolean", "object"],
      allowUndefined: true,
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema: schema2, parentSchema, data, errsCount, it } = cxt;
        if (!errsCount)
          throw new Error("ajv implementation error");
        const { allErrors, opts } = it;
        it.props = true;
        if (opts.removeAdditional !== "all" && (0, util_1.alwaysValidSchema)(it, schema2))
          return;
        const props = (0, code_1.allSchemaProperties)(parentSchema.properties);
        const patProps = (0, code_1.allSchemaProperties)(parentSchema.patternProperties);
        checkAdditionalProperties();
        cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
        function checkAdditionalProperties() {
          gen.forIn("key", data, (key) => {
            if (!props.length && !patProps.length)
              additionalPropertyCode(key);
            else
              gen.if(isAdditional(key), () => additionalPropertyCode(key));
          });
        }
        function isAdditional(key) {
          let definedProp;
          if (props.length > 8) {
            const propsSchema = (0, util_1.schemaRefOrVal)(it, parentSchema.properties, "properties");
            definedProp = (0, code_1.isOwnProperty)(gen, propsSchema, key);
          } else if (props.length) {
            definedProp = (0, codegen_1.or)(...props.map((p) => (0, codegen_1._)`${key} === ${p}`));
          } else {
            definedProp = codegen_1.nil;
          }
          if (patProps.length) {
            definedProp = (0, codegen_1.or)(definedProp, ...patProps.map((p) => (0, codegen_1._)`${(0, code_1.usePattern)(cxt, p)}.test(${key})`));
          }
          return (0, codegen_1.not)(definedProp);
        }
        function deleteAdditional(key) {
          gen.code((0, codegen_1._)`delete ${data}[${key}]`);
        }
        function additionalPropertyCode(key) {
          if (opts.removeAdditional === "all" || opts.removeAdditional && schema2 === false) {
            deleteAdditional(key);
            return;
          }
          if (schema2 === false) {
            cxt.setParams({ additionalProperty: key });
            cxt.error();
            if (!allErrors)
              gen.break();
            return;
          }
          if (typeof schema2 == "object" && !(0, util_1.alwaysValidSchema)(it, schema2)) {
            const valid = gen.name("valid");
            if (opts.removeAdditional === "failing") {
              applyAdditionalSchema(key, valid, false);
              gen.if((0, codegen_1.not)(valid), () => {
                cxt.reset();
                deleteAdditional(key);
              });
            } else {
              applyAdditionalSchema(key, valid);
              if (!allErrors)
                gen.if((0, codegen_1.not)(valid), () => gen.break());
            }
          }
        }
        function applyAdditionalSchema(key, valid, errors) {
          const subschema = {
            keyword: "additionalProperties",
            dataProp: key,
            dataPropType: util_1.Type.Str
          };
          if (errors === false) {
            Object.assign(subschema, {
              compositeRule: true,
              createErrors: false,
              allErrors: false
            });
          }
          cxt.subschema(subschema, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/properties.js
var require_properties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/properties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var validate_1 = require_validate();
    var code_1 = require_code2();
    var util_1 = require_util();
    var additionalProperties_1 = require_additionalProperties();
    var def = {
      keyword: "properties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema: schema2, parentSchema, data, it } = cxt;
        if (it.opts.removeAdditional === "all" && parentSchema.additionalProperties === void 0) {
          additionalProperties_1.default.code(new validate_1.KeywordCxt(it, additionalProperties_1.default, "additionalProperties"));
        }
        const allProps = (0, code_1.allSchemaProperties)(schema2);
        for (const prop of allProps) {
          it.definedProperties.add(prop);
        }
        if (it.opts.unevaluated && allProps.length && it.props !== true) {
          it.props = util_1.mergeEvaluated.props(gen, (0, util_1.toHash)(allProps), it.props);
        }
        const properties = allProps.filter((p) => !(0, util_1.alwaysValidSchema)(it, schema2[p]));
        if (properties.length === 0)
          return;
        const valid = gen.name("valid");
        for (const prop of properties) {
          if (hasDefault(prop)) {
            applyPropertySchema(prop);
          } else {
            gen.if((0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties));
            applyPropertySchema(prop);
            if (!it.allErrors)
              gen.else().var(valid, true);
            gen.endIf();
          }
          cxt.it.definedProperties.add(prop);
          cxt.ok(valid);
        }
        function hasDefault(prop) {
          return it.opts.useDefaults && !it.compositeRule && schema2[prop].default !== void 0;
        }
        function applyPropertySchema(prop) {
          cxt.subschema({
            keyword: "properties",
            schemaProp: prop,
            dataProp: prop
          }, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/patternProperties.js
var require_patternProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/patternProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var util_2 = require_util();
    var def = {
      keyword: "patternProperties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema: schema2, data, parentSchema, it } = cxt;
        const { opts } = it;
        const patterns = (0, code_1.allSchemaProperties)(schema2);
        const alwaysValidPatterns = patterns.filter((p) => (0, util_1.alwaysValidSchema)(it, schema2[p]));
        if (patterns.length === 0 || alwaysValidPatterns.length === patterns.length && (!it.opts.unevaluated || it.props === true)) {
          return;
        }
        const checkProperties = opts.strictSchema && !opts.allowMatchingProperties && parentSchema.properties;
        const valid = gen.name("valid");
        if (it.props !== true && !(it.props instanceof codegen_1.Name)) {
          it.props = (0, util_2.evaluatedPropsToName)(gen, it.props);
        }
        const { props } = it;
        validatePatternProperties();
        function validatePatternProperties() {
          for (const pat of patterns) {
            if (checkProperties)
              checkMatchingProperties(pat);
            if (it.allErrors) {
              validateProperties(pat);
            } else {
              gen.var(valid, true);
              validateProperties(pat);
              gen.if(valid);
            }
          }
        }
        function checkMatchingProperties(pat) {
          for (const prop in checkProperties) {
            if (new RegExp(pat).test(prop)) {
              (0, util_1.checkStrictMode)(it, `property ${prop} matches pattern ${pat} (use allowMatchingProperties)`);
            }
          }
        }
        function validateProperties(pat) {
          gen.forIn("key", data, (key) => {
            gen.if((0, codegen_1._)`${(0, code_1.usePattern)(cxt, pat)}.test(${key})`, () => {
              const alwaysValid = alwaysValidPatterns.includes(pat);
              if (!alwaysValid) {
                cxt.subschema({
                  keyword: "patternProperties",
                  schemaProp: pat,
                  dataProp: key,
                  dataPropType: util_2.Type.Str
                }, valid);
              }
              if (it.opts.unevaluated && props !== true) {
                gen.assign((0, codegen_1._)`${props}[${key}]`, true);
              } else if (!alwaysValid && !it.allErrors) {
                gen.if((0, codegen_1.not)(valid), () => gen.break());
              }
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/not.js
var require_not = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/not.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "not",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      code(cxt) {
        const { gen, schema: schema2, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema2)) {
          cxt.fail();
          return;
        }
        const valid = gen.name("valid");
        cxt.subschema({
          keyword: "not",
          compositeRule: true,
          createErrors: false,
          allErrors: false
        }, valid);
        cxt.failResult(valid, () => cxt.reset(), () => cxt.error());
      },
      error: { message: "must NOT be valid" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/anyOf.js
var require_anyOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/anyOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var def = {
      keyword: "anyOf",
      schemaType: "array",
      trackErrors: true,
      code: code_1.validateUnion,
      error: { message: "must match a schema in anyOf" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/oneOf.js
var require_oneOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/oneOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "must match exactly one schema in oneOf",
      params: ({ params }) => (0, codegen_1._)`{passingSchemas: ${params.passing}}`
    };
    var def = {
      keyword: "oneOf",
      schemaType: "array",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema: schema2, parentSchema, it } = cxt;
        if (!Array.isArray(schema2))
          throw new Error("ajv implementation error");
        if (it.opts.discriminator && parentSchema.discriminator)
          return;
        const schArr = schema2;
        const valid = gen.let("valid", false);
        const passing = gen.let("passing", null);
        const schValid = gen.name("_valid");
        cxt.setParams({ passing });
        gen.block(validateOneOf);
        cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
        function validateOneOf() {
          schArr.forEach((sch, i) => {
            let schCxt;
            if ((0, util_1.alwaysValidSchema)(it, sch)) {
              gen.var(schValid, true);
            } else {
              schCxt = cxt.subschema({
                keyword: "oneOf",
                schemaProp: i,
                compositeRule: true
              }, schValid);
            }
            if (i > 0) {
              gen.if((0, codegen_1._)`${schValid} && ${valid}`).assign(valid, false).assign(passing, (0, codegen_1._)`[${passing}, ${i}]`).else();
            }
            gen.if(schValid, () => {
              gen.assign(valid, true);
              gen.assign(passing, i);
              if (schCxt)
                cxt.mergeEvaluated(schCxt, codegen_1.Name);
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/allOf.js
var require_allOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/allOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "allOf",
      schemaType: "array",
      code(cxt) {
        const { gen, schema: schema2, it } = cxt;
        if (!Array.isArray(schema2))
          throw new Error("ajv implementation error");
        const valid = gen.name("valid");
        schema2.forEach((sch, i) => {
          if ((0, util_1.alwaysValidSchema)(it, sch))
            return;
          const schCxt = cxt.subschema({ keyword: "allOf", schemaProp: i }, valid);
          cxt.ok(valid);
          cxt.mergeEvaluated(schCxt);
        });
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/if.js
var require_if = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/if.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params }) => (0, codegen_1.str)`must match "${params.ifClause}" schema`,
      params: ({ params }) => (0, codegen_1._)`{failingKeyword: ${params.ifClause}}`
    };
    var def = {
      keyword: "if",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, parentSchema, it } = cxt;
        if (parentSchema.then === void 0 && parentSchema.else === void 0) {
          (0, util_1.checkStrictMode)(it, '"if" without "then" and "else" is ignored');
        }
        const hasThen = hasSchema(it, "then");
        const hasElse = hasSchema(it, "else");
        if (!hasThen && !hasElse)
          return;
        const valid = gen.let("valid", true);
        const schValid = gen.name("_valid");
        validateIf();
        cxt.reset();
        if (hasThen && hasElse) {
          const ifClause = gen.let("ifClause");
          cxt.setParams({ ifClause });
          gen.if(schValid, validateClause("then", ifClause), validateClause("else", ifClause));
        } else if (hasThen) {
          gen.if(schValid, validateClause("then"));
        } else {
          gen.if((0, codegen_1.not)(schValid), validateClause("else"));
        }
        cxt.pass(valid, () => cxt.error(true));
        function validateIf() {
          const schCxt = cxt.subschema({
            keyword: "if",
            compositeRule: true,
            createErrors: false,
            allErrors: false
          }, schValid);
          cxt.mergeEvaluated(schCxt);
        }
        function validateClause(keyword, ifClause) {
          return () => {
            const schCxt = cxt.subschema({ keyword }, schValid);
            gen.assign(valid, schValid);
            cxt.mergeValidEvaluated(schCxt, valid);
            if (ifClause)
              gen.assign(ifClause, (0, codegen_1._)`${keyword}`);
            else
              cxt.setParams({ ifClause: keyword });
          };
        }
      }
    };
    function hasSchema(it, keyword) {
      const schema2 = it.schema[keyword];
      return schema2 !== void 0 && !(0, util_1.alwaysValidSchema)(it, schema2);
    }
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/thenElse.js
var require_thenElse = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/thenElse.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: ["then", "else"],
      schemaType: ["object", "boolean"],
      code({ keyword, parentSchema, it }) {
        if (parentSchema.if === void 0)
          (0, util_1.checkStrictMode)(it, `"${keyword}" without "if" is ignored`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/index.js
var require_applicator = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var additionalItems_1 = require_additionalItems();
    var prefixItems_1 = require_prefixItems();
    var items_1 = require_items();
    var items2020_1 = require_items2020();
    var contains_1 = require_contains();
    var dependencies_1 = require_dependencies();
    var propertyNames_1 = require_propertyNames();
    var additionalProperties_1 = require_additionalProperties();
    var properties_1 = require_properties();
    var patternProperties_1 = require_patternProperties();
    var not_1 = require_not();
    var anyOf_1 = require_anyOf();
    var oneOf_1 = require_oneOf();
    var allOf_1 = require_allOf();
    var if_1 = require_if();
    var thenElse_1 = require_thenElse();
    function getApplicator(draft2020 = false) {
      const applicator = [
        // any
        not_1.default,
        anyOf_1.default,
        oneOf_1.default,
        allOf_1.default,
        if_1.default,
        thenElse_1.default,
        // object
        propertyNames_1.default,
        additionalProperties_1.default,
        dependencies_1.default,
        properties_1.default,
        patternProperties_1.default
      ];
      if (draft2020)
        applicator.push(prefixItems_1.default, items2020_1.default);
      else
        applicator.push(additionalItems_1.default, items_1.default);
      applicator.push(contains_1.default);
      return applicator;
    }
    exports.default = getApplicator;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/dynamicAnchor.js
var require_dynamicAnchor = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/dynamicAnchor.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.dynamicAnchor = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var compile_1 = require_compile();
    var ref_1 = require_ref();
    var def = {
      keyword: "$dynamicAnchor",
      schemaType: "string",
      code: (cxt) => dynamicAnchor(cxt, cxt.schema)
    };
    function dynamicAnchor(cxt, anchor) {
      const { gen, it } = cxt;
      it.schemaEnv.root.dynamicAnchors[anchor] = true;
      const v = (0, codegen_1._)`${names_1.default.dynamicAnchors}${(0, codegen_1.getProperty)(anchor)}`;
      const validate = it.errSchemaPath === "#" ? it.validateName : _getValidate(cxt);
      gen.if((0, codegen_1._)`!${v}`, () => gen.assign(v, validate));
    }
    exports.dynamicAnchor = dynamicAnchor;
    function _getValidate(cxt) {
      const { schemaEnv, schema: schema2, self: self2 } = cxt.it;
      const { root, baseId, localRefs, meta } = schemaEnv.root;
      const { schemaId } = self2.opts;
      const sch = new compile_1.SchemaEnv({ schema: schema2, schemaId, root, baseId, localRefs, meta });
      compile_1.compileSchema.call(self2, sch);
      return (0, ref_1.getValidate)(cxt, sch);
    }
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/dynamicRef.js
var require_dynamicRef = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/dynamicRef.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.dynamicRef = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var ref_1 = require_ref();
    var def = {
      keyword: "$dynamicRef",
      schemaType: "string",
      code: (cxt) => dynamicRef(cxt, cxt.schema)
    };
    function dynamicRef(cxt, ref) {
      const { gen, keyword, it } = cxt;
      if (ref[0] !== "#")
        throw new Error(`"${keyword}" only supports hash fragment reference`);
      const anchor = ref.slice(1);
      if (it.allErrors) {
        _dynamicRef();
      } else {
        const valid = gen.let("valid", false);
        _dynamicRef(valid);
        cxt.ok(valid);
      }
      function _dynamicRef(valid) {
        if (it.schemaEnv.root.dynamicAnchors[anchor]) {
          const v = gen.let("_v", (0, codegen_1._)`${names_1.default.dynamicAnchors}${(0, codegen_1.getProperty)(anchor)}`);
          gen.if(v, _callRef(v, valid), _callRef(it.validateName, valid));
        } else {
          _callRef(it.validateName, valid)();
        }
      }
      function _callRef(validate, valid) {
        return valid ? () => gen.block(() => {
          (0, ref_1.callRef)(cxt, validate);
          gen.let(valid, true);
        }) : () => (0, ref_1.callRef)(cxt, validate);
      }
    }
    exports.dynamicRef = dynamicRef;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/recursiveAnchor.js
var require_recursiveAnchor = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/recursiveAnchor.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicAnchor_1 = require_dynamicAnchor();
    var util_1 = require_util();
    var def = {
      keyword: "$recursiveAnchor",
      schemaType: "boolean",
      code(cxt) {
        if (cxt.schema)
          (0, dynamicAnchor_1.dynamicAnchor)(cxt, "");
        else
          (0, util_1.checkStrictMode)(cxt.it, "$recursiveAnchor: false is ignored");
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/recursiveRef.js
var require_recursiveRef = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/recursiveRef.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicRef_1 = require_dynamicRef();
    var def = {
      keyword: "$recursiveRef",
      schemaType: "string",
      code: (cxt) => (0, dynamicRef_1.dynamicRef)(cxt, cxt.schema)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/index.js
var require_dynamic = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicAnchor_1 = require_dynamicAnchor();
    var dynamicRef_1 = require_dynamicRef();
    var recursiveAnchor_1 = require_recursiveAnchor();
    var recursiveRef_1 = require_recursiveRef();
    var dynamic = [dynamicAnchor_1.default, dynamicRef_1.default, recursiveAnchor_1.default, recursiveRef_1.default];
    exports.default = dynamic;
  }
});

// node_modules/ajv/dist/vocabularies/validation/dependentRequired.js
var require_dependentRequired = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/dependentRequired.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependencies_1 = require_dependencies();
    var def = {
      keyword: "dependentRequired",
      type: "object",
      schemaType: "object",
      error: dependencies_1.error,
      code: (cxt) => (0, dependencies_1.validatePropertyDeps)(cxt)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/dependentSchemas.js
var require_dependentSchemas = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/dependentSchemas.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependencies_1 = require_dependencies();
    var def = {
      keyword: "dependentSchemas",
      type: "object",
      schemaType: "object",
      code: (cxt) => (0, dependencies_1.validateSchemaDeps)(cxt)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitContains.js
var require_limitContains = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitContains.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: ["maxContains", "minContains"],
      type: "array",
      schemaType: "number",
      code({ keyword, parentSchema, it }) {
        if (parentSchema.contains === void 0) {
          (0, util_1.checkStrictMode)(it, `"${keyword}" without "contains" is ignored`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/next.js
var require_next = __commonJS({
  "node_modules/ajv/dist/vocabularies/next.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependentRequired_1 = require_dependentRequired();
    var dependentSchemas_1 = require_dependentSchemas();
    var limitContains_1 = require_limitContains();
    var next = [dependentRequired_1.default, dependentSchemas_1.default, limitContains_1.default];
    exports.default = next;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedProperties.js
var require_unevaluatedProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    var error = {
      message: "must NOT have unevaluated properties",
      params: ({ params }) => (0, codegen_1._)`{unevaluatedProperty: ${params.unevaluatedProperty}}`
    };
    var def = {
      keyword: "unevaluatedProperties",
      type: "object",
      schemaType: ["boolean", "object"],
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema: schema2, data, errsCount, it } = cxt;
        if (!errsCount)
          throw new Error("ajv implementation error");
        const { allErrors, props } = it;
        if (props instanceof codegen_1.Name) {
          gen.if((0, codegen_1._)`${props} !== true`, () => gen.forIn("key", data, (key) => gen.if(unevaluatedDynamic(props, key), () => unevaluatedPropCode(key))));
        } else if (props !== true) {
          gen.forIn("key", data, (key) => props === void 0 ? unevaluatedPropCode(key) : gen.if(unevaluatedStatic(props, key), () => unevaluatedPropCode(key)));
        }
        it.props = true;
        cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
        function unevaluatedPropCode(key) {
          if (schema2 === false) {
            cxt.setParams({ unevaluatedProperty: key });
            cxt.error();
            if (!allErrors)
              gen.break();
            return;
          }
          if (!(0, util_1.alwaysValidSchema)(it, schema2)) {
            const valid = gen.name("valid");
            cxt.subschema({
              keyword: "unevaluatedProperties",
              dataProp: key,
              dataPropType: util_1.Type.Str
            }, valid);
            if (!allErrors)
              gen.if((0, codegen_1.not)(valid), () => gen.break());
          }
        }
        function unevaluatedDynamic(evaluatedProps, key) {
          return (0, codegen_1._)`!${evaluatedProps} || !${evaluatedProps}[${key}]`;
        }
        function unevaluatedStatic(evaluatedProps, key) {
          const ps = [];
          for (const p in evaluatedProps) {
            if (evaluatedProps[p] === true)
              ps.push((0, codegen_1._)`${key} !== ${p}`);
          }
          return (0, codegen_1.and)(...ps);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedItems.js
var require_unevaluatedItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "unevaluatedItems",
      type: "array",
      schemaType: ["boolean", "object"],
      error,
      code(cxt) {
        const { gen, schema: schema2, data, it } = cxt;
        const items = it.items || 0;
        if (items === true)
          return;
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        if (schema2 === false) {
          cxt.setParams({ len: items });
          cxt.fail((0, codegen_1._)`${len} > ${items}`);
        } else if (typeof schema2 == "object" && !(0, util_1.alwaysValidSchema)(it, schema2)) {
          const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items}`);
          gen.if((0, codegen_1.not)(valid), () => validateItems(valid, items));
          cxt.ok(valid);
        }
        it.items = true;
        function validateItems(valid, from) {
          gen.forRange("i", from, len, (i) => {
            cxt.subschema({ keyword: "unevaluatedItems", dataProp: i, dataPropType: util_1.Type.Num }, valid);
            if (!it.allErrors)
              gen.if((0, codegen_1.not)(valid), () => gen.break());
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/index.js
var require_unevaluated = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var unevaluatedProperties_1 = require_unevaluatedProperties();
    var unevaluatedItems_1 = require_unevaluatedItems();
    var unevaluated = [unevaluatedProperties_1.default, unevaluatedItems_1.default];
    exports.default = unevaluated;
  }
});

// node_modules/ajv/dist/vocabularies/format/format.js
var require_format = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/format.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match format "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{format: ${schemaCode}}`
    };
    var def = {
      keyword: "format",
      type: ["number", "string"],
      schemaType: "string",
      $data: true,
      error,
      code(cxt, ruleType) {
        const { gen, data, $data, schema: schema2, schemaCode, it } = cxt;
        const { opts, errSchemaPath, schemaEnv, self: self2 } = it;
        if (!opts.validateFormats)
          return;
        if ($data)
          validate$DataFormat();
        else
          validateFormat();
        function validate$DataFormat() {
          const fmts = gen.scopeValue("formats", {
            ref: self2.formats,
            code: opts.code.formats
          });
          const fDef = gen.const("fDef", (0, codegen_1._)`${fmts}[${schemaCode}]`);
          const fType = gen.let("fType");
          const format = gen.let("format");
          gen.if((0, codegen_1._)`typeof ${fDef} == "object" && !(${fDef} instanceof RegExp)`, () => gen.assign(fType, (0, codegen_1._)`${fDef}.type || "string"`).assign(format, (0, codegen_1._)`${fDef}.validate`), () => gen.assign(fType, (0, codegen_1._)`"string"`).assign(format, fDef));
          cxt.fail$data((0, codegen_1.or)(unknownFmt(), invalidFmt()));
          function unknownFmt() {
            if (opts.strictSchema === false)
              return codegen_1.nil;
            return (0, codegen_1._)`${schemaCode} && !${format}`;
          }
          function invalidFmt() {
            const callFormat = schemaEnv.$async ? (0, codegen_1._)`(${fDef}.async ? await ${format}(${data}) : ${format}(${data}))` : (0, codegen_1._)`${format}(${data})`;
            const validData = (0, codegen_1._)`(typeof ${format} == "function" ? ${callFormat} : ${format}.test(${data}))`;
            return (0, codegen_1._)`${format} && ${format} !== true && ${fType} === ${ruleType} && !${validData}`;
          }
        }
        function validateFormat() {
          const formatDef = self2.formats[schema2];
          if (!formatDef) {
            unknownFormat();
            return;
          }
          if (formatDef === true)
            return;
          const [fmtType, format, fmtRef] = getFormat(formatDef);
          if (fmtType === ruleType)
            cxt.pass(validCondition());
          function unknownFormat() {
            if (opts.strictSchema === false) {
              self2.logger.warn(unknownMsg());
              return;
            }
            throw new Error(unknownMsg());
            function unknownMsg() {
              return `unknown format "${schema2}" ignored in schema at path "${errSchemaPath}"`;
            }
          }
          function getFormat(fmtDef) {
            const code = fmtDef instanceof RegExp ? (0, codegen_1.regexpCode)(fmtDef) : opts.code.formats ? (0, codegen_1._)`${opts.code.formats}${(0, codegen_1.getProperty)(schema2)}` : void 0;
            const fmt = gen.scopeValue("formats", { key: schema2, ref: fmtDef, code });
            if (typeof fmtDef == "object" && !(fmtDef instanceof RegExp)) {
              return [fmtDef.type || "string", fmtDef.validate, (0, codegen_1._)`${fmt}.validate`];
            }
            return ["string", fmtDef, fmt];
          }
          function validCondition() {
            if (typeof formatDef == "object" && !(formatDef instanceof RegExp) && formatDef.async) {
              if (!schemaEnv.$async)
                throw new Error("async format in sync schema");
              return (0, codegen_1._)`await ${fmtRef}(${data})`;
            }
            return typeof format == "function" ? (0, codegen_1._)`${fmtRef}(${data})` : (0, codegen_1._)`${fmtRef}.test(${data})`;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/format/index.js
var require_format2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var format_1 = require_format();
    var format = [format_1.default];
    exports.default = format;
  }
});

// node_modules/ajv/dist/vocabularies/metadata.js
var require_metadata = __commonJS({
  "node_modules/ajv/dist/vocabularies/metadata.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.contentVocabulary = exports.metadataVocabulary = void 0;
    exports.metadataVocabulary = [
      "title",
      "description",
      "default",
      "deprecated",
      "readOnly",
      "writeOnly",
      "examples"
    ];
    exports.contentVocabulary = [
      "contentMediaType",
      "contentEncoding",
      "contentSchema"
    ];
  }
});

// node_modules/ajv/dist/vocabularies/draft2020.js
var require_draft2020 = __commonJS({
  "node_modules/ajv/dist/vocabularies/draft2020.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var core_1 = require_core2();
    var validation_1 = require_validation();
    var applicator_1 = require_applicator();
    var dynamic_1 = require_dynamic();
    var next_1 = require_next();
    var unevaluated_1 = require_unevaluated();
    var format_1 = require_format2();
    var metadata_1 = require_metadata();
    var draft2020Vocabularies = [
      dynamic_1.default,
      core_1.default,
      validation_1.default,
      (0, applicator_1.default)(true),
      format_1.default,
      metadata_1.metadataVocabulary,
      metadata_1.contentVocabulary,
      next_1.default,
      unevaluated_1.default
    ];
    exports.default = draft2020Vocabularies;
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/types.js
var require_types = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DiscrError = void 0;
    var DiscrError;
    (function(DiscrError2) {
      DiscrError2["Tag"] = "tag";
      DiscrError2["Mapping"] = "mapping";
    })(DiscrError || (exports.DiscrError = DiscrError = {}));
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/index.js
var require_discriminator = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var types_1 = require_types();
    var compile_1 = require_compile();
    var ref_error_1 = require_ref_error();
    var util_1 = require_util();
    var error = {
      message: ({ params: { discrError, tagName } }) => discrError === types_1.DiscrError.Tag ? `tag "${tagName}" must be string` : `value of tag "${tagName}" must be in oneOf`,
      params: ({ params: { discrError, tag, tagName } }) => (0, codegen_1._)`{error: ${discrError}, tag: ${tagName}, tagValue: ${tag}}`
    };
    var def = {
      keyword: "discriminator",
      type: "object",
      schemaType: "object",
      error,
      code(cxt) {
        const { gen, data, schema: schema2, parentSchema, it } = cxt;
        const { oneOf } = parentSchema;
        if (!it.opts.discriminator) {
          throw new Error("discriminator: requires discriminator option");
        }
        const tagName = schema2.propertyName;
        if (typeof tagName != "string")
          throw new Error("discriminator: requires propertyName");
        if (schema2.mapping)
          throw new Error("discriminator: mapping is not supported");
        if (!oneOf)
          throw new Error("discriminator: requires oneOf keyword");
        const valid = gen.let("valid", false);
        const tag = gen.const("tag", (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(tagName)}`);
        gen.if((0, codegen_1._)`typeof ${tag} == "string"`, () => validateMapping(), () => cxt.error(false, { discrError: types_1.DiscrError.Tag, tag, tagName }));
        cxt.ok(valid);
        function validateMapping() {
          const mapping = getMapping();
          gen.if(false);
          for (const tagValue in mapping) {
            gen.elseIf((0, codegen_1._)`${tag} === ${tagValue}`);
            gen.assign(valid, applyTagSchema(mapping[tagValue]));
          }
          gen.else();
          cxt.error(false, { discrError: types_1.DiscrError.Mapping, tag, tagName });
          gen.endIf();
        }
        function applyTagSchema(schemaProp) {
          const _valid = gen.name("valid");
          const schCxt = cxt.subschema({ keyword: "oneOf", schemaProp }, _valid);
          cxt.mergeEvaluated(schCxt, codegen_1.Name);
          return _valid;
        }
        function getMapping() {
          var _a;
          const oneOfMapping = {};
          const topRequired = hasRequired(parentSchema);
          let tagRequired = true;
          for (let i = 0; i < oneOf.length; i++) {
            let sch = oneOf[i];
            if ((sch === null || sch === void 0 ? void 0 : sch.$ref) && !(0, util_1.schemaHasRulesButRef)(sch, it.self.RULES)) {
              const ref = sch.$ref;
              sch = compile_1.resolveRef.call(it.self, it.schemaEnv.root, it.baseId, ref);
              if (sch instanceof compile_1.SchemaEnv)
                sch = sch.schema;
              if (sch === void 0)
                throw new ref_error_1.default(it.opts.uriResolver, it.baseId, ref);
            }
            const propSch = (_a = sch === null || sch === void 0 ? void 0 : sch.properties) === null || _a === void 0 ? void 0 : _a[tagName];
            if (typeof propSch != "object") {
              throw new Error(`discriminator: oneOf subschemas (or referenced schemas) must have "properties/${tagName}"`);
            }
            tagRequired = tagRequired && (topRequired || hasRequired(sch));
            addMappings(propSch, i);
          }
          if (!tagRequired)
            throw new Error(`discriminator: "${tagName}" must be required`);
          return oneOfMapping;
          function hasRequired({ required }) {
            return Array.isArray(required) && required.includes(tagName);
          }
          function addMappings(sch, i) {
            if (sch.const) {
              addMapping(sch.const, i);
            } else if (sch.enum) {
              for (const tagValue of sch.enum) {
                addMapping(tagValue, i);
              }
            } else {
              throw new Error(`discriminator: "properties/${tagName}" must have "const" or "enum"`);
            }
          }
          function addMapping(tagValue, i) {
            if (typeof tagValue != "string" || tagValue in oneOfMapping) {
              throw new Error(`discriminator: "${tagName}" values must be unique strings`);
            }
            oneOfMapping[tagValue] = i;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/schema.json
var require_schema = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/schema.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/schema",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/core": true,
        "https://json-schema.org/draft/2020-12/vocab/applicator": true,
        "https://json-schema.org/draft/2020-12/vocab/unevaluated": true,
        "https://json-schema.org/draft/2020-12/vocab/validation": true,
        "https://json-schema.org/draft/2020-12/vocab/meta-data": true,
        "https://json-schema.org/draft/2020-12/vocab/format-annotation": true,
        "https://json-schema.org/draft/2020-12/vocab/content": true
      },
      $dynamicAnchor: "meta",
      title: "Core and Validation specifications meta-schema",
      allOf: [
        { $ref: "meta/core" },
        { $ref: "meta/applicator" },
        { $ref: "meta/unevaluated" },
        { $ref: "meta/validation" },
        { $ref: "meta/meta-data" },
        { $ref: "meta/format-annotation" },
        { $ref: "meta/content" }
      ],
      type: ["object", "boolean"],
      $comment: "This meta-schema also defines keywords that have appeared in previous drafts in order to prevent incompatible extensions as they remain in common use.",
      properties: {
        definitions: {
          $comment: '"definitions" has been replaced by "$defs".',
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          deprecated: true,
          default: {}
        },
        dependencies: {
          $comment: '"dependencies" has been split and replaced by "dependentSchemas" and "dependentRequired" in order to serve their differing semantics.',
          type: "object",
          additionalProperties: {
            anyOf: [{ $dynamicRef: "#meta" }, { $ref: "meta/validation#/$defs/stringArray" }]
          },
          deprecated: true,
          default: {}
        },
        $recursiveAnchor: {
          $comment: '"$recursiveAnchor" has been replaced by "$dynamicAnchor".',
          $ref: "meta/core#/$defs/anchorString",
          deprecated: true
        },
        $recursiveRef: {
          $comment: '"$recursiveRef" has been replaced by "$dynamicRef".',
          $ref: "meta/core#/$defs/uriReferenceString",
          deprecated: true
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/applicator.json
var require_applicator2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/applicator.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/applicator",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/applicator": true
      },
      $dynamicAnchor: "meta",
      title: "Applicator vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        prefixItems: { $ref: "#/$defs/schemaArray" },
        items: { $dynamicRef: "#meta" },
        contains: { $dynamicRef: "#meta" },
        additionalProperties: { $dynamicRef: "#meta" },
        properties: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          default: {}
        },
        patternProperties: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          propertyNames: { format: "regex" },
          default: {}
        },
        dependentSchemas: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          default: {}
        },
        propertyNames: { $dynamicRef: "#meta" },
        if: { $dynamicRef: "#meta" },
        then: { $dynamicRef: "#meta" },
        else: { $dynamicRef: "#meta" },
        allOf: { $ref: "#/$defs/schemaArray" },
        anyOf: { $ref: "#/$defs/schemaArray" },
        oneOf: { $ref: "#/$defs/schemaArray" },
        not: { $dynamicRef: "#meta" }
      },
      $defs: {
        schemaArray: {
          type: "array",
          minItems: 1,
          items: { $dynamicRef: "#meta" }
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/unevaluated.json
var require_unevaluated2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/unevaluated.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/unevaluated",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/unevaluated": true
      },
      $dynamicAnchor: "meta",
      title: "Unevaluated applicator vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        unevaluatedItems: { $dynamicRef: "#meta" },
        unevaluatedProperties: { $dynamicRef: "#meta" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/content.json
var require_content = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/content.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/content",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/content": true
      },
      $dynamicAnchor: "meta",
      title: "Content vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        contentEncoding: { type: "string" },
        contentMediaType: { type: "string" },
        contentSchema: { $dynamicRef: "#meta" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/core.json
var require_core3 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/core.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/core",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/core": true
      },
      $dynamicAnchor: "meta",
      title: "Core vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        $id: {
          $ref: "#/$defs/uriReferenceString",
          $comment: "Non-empty fragments not allowed.",
          pattern: "^[^#]*#?$"
        },
        $schema: { $ref: "#/$defs/uriString" },
        $ref: { $ref: "#/$defs/uriReferenceString" },
        $anchor: { $ref: "#/$defs/anchorString" },
        $dynamicRef: { $ref: "#/$defs/uriReferenceString" },
        $dynamicAnchor: { $ref: "#/$defs/anchorString" },
        $vocabulary: {
          type: "object",
          propertyNames: { $ref: "#/$defs/uriString" },
          additionalProperties: {
            type: "boolean"
          }
        },
        $comment: {
          type: "string"
        },
        $defs: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" }
        }
      },
      $defs: {
        anchorString: {
          type: "string",
          pattern: "^[A-Za-z_][-A-Za-z0-9._]*$"
        },
        uriString: {
          type: "string",
          format: "uri"
        },
        uriReferenceString: {
          type: "string",
          format: "uri-reference"
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/format-annotation.json
var require_format_annotation = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/format-annotation.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/format-annotation",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/format-annotation": true
      },
      $dynamicAnchor: "meta",
      title: "Format vocabulary meta-schema for annotation results",
      type: ["object", "boolean"],
      properties: {
        format: { type: "string" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/meta-data.json
var require_meta_data = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/meta-data.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/meta-data",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/meta-data": true
      },
      $dynamicAnchor: "meta",
      title: "Meta-data vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        title: {
          type: "string"
        },
        description: {
          type: "string"
        },
        default: true,
        deprecated: {
          type: "boolean",
          default: false
        },
        readOnly: {
          type: "boolean",
          default: false
        },
        writeOnly: {
          type: "boolean",
          default: false
        },
        examples: {
          type: "array",
          items: true
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/validation.json
var require_validation2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/validation.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/validation",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/validation": true
      },
      $dynamicAnchor: "meta",
      title: "Validation vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        type: {
          anyOf: [
            { $ref: "#/$defs/simpleTypes" },
            {
              type: "array",
              items: { $ref: "#/$defs/simpleTypes" },
              minItems: 1,
              uniqueItems: true
            }
          ]
        },
        const: true,
        enum: {
          type: "array",
          items: true
        },
        multipleOf: {
          type: "number",
          exclusiveMinimum: 0
        },
        maximum: {
          type: "number"
        },
        exclusiveMaximum: {
          type: "number"
        },
        minimum: {
          type: "number"
        },
        exclusiveMinimum: {
          type: "number"
        },
        maxLength: { $ref: "#/$defs/nonNegativeInteger" },
        minLength: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        pattern: {
          type: "string",
          format: "regex"
        },
        maxItems: { $ref: "#/$defs/nonNegativeInteger" },
        minItems: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        uniqueItems: {
          type: "boolean",
          default: false
        },
        maxContains: { $ref: "#/$defs/nonNegativeInteger" },
        minContains: {
          $ref: "#/$defs/nonNegativeInteger",
          default: 1
        },
        maxProperties: { $ref: "#/$defs/nonNegativeInteger" },
        minProperties: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        required: { $ref: "#/$defs/stringArray" },
        dependentRequired: {
          type: "object",
          additionalProperties: {
            $ref: "#/$defs/stringArray"
          }
        }
      },
      $defs: {
        nonNegativeInteger: {
          type: "integer",
          minimum: 0
        },
        nonNegativeIntegerDefault0: {
          $ref: "#/$defs/nonNegativeInteger",
          default: 0
        },
        simpleTypes: {
          enum: ["array", "boolean", "integer", "null", "number", "object", "string"]
        },
        stringArray: {
          type: "array",
          items: { type: "string" },
          uniqueItems: true,
          default: []
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/index.js
var require_json_schema_2020_12 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var metaSchema = require_schema();
    var applicator = require_applicator2();
    var unevaluated = require_unevaluated2();
    var content = require_content();
    var core = require_core3();
    var format = require_format_annotation();
    var metadata = require_meta_data();
    var validation = require_validation2();
    var META_SUPPORT_DATA = ["/properties"];
    function addMetaSchema2020($data) {
      ;
      [
        metaSchema,
        applicator,
        unevaluated,
        content,
        core,
        with$data(this, format),
        metadata,
        with$data(this, validation)
      ].forEach((sch) => this.addMetaSchema(sch, void 0, false));
      return this;
      function with$data(ajv2, sch) {
        return $data ? ajv2.$dataMetaSchema(sch, META_SUPPORT_DATA) : sch;
      }
    }
    exports.default = addMetaSchema2020;
  }
});

// node_modules/ajv/dist/2020.js
var require__ = __commonJS({
  "node_modules/ajv/dist/2020.js"(exports, module) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MissingRefError = exports.ValidationError = exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = exports.Ajv2020 = void 0;
    var core_1 = require_core();
    var draft2020_1 = require_draft2020();
    var discriminator_1 = require_discriminator();
    var json_schema_2020_12_1 = require_json_schema_2020_12();
    var META_SCHEMA_ID = "https://json-schema.org/draft/2020-12/schema";
    var Ajv20202 = class extends core_1.default {
      constructor(opts = {}) {
        super({
          ...opts,
          dynamicRef: true,
          next: true,
          unevaluated: true
        });
      }
      _addVocabularies() {
        super._addVocabularies();
        draft2020_1.default.forEach((v) => this.addVocabulary(v));
        if (this.opts.discriminator)
          this.addKeyword(discriminator_1.default);
      }
      _addDefaultMetaSchema() {
        super._addDefaultMetaSchema();
        const { $data, meta } = this.opts;
        if (!meta)
          return;
        json_schema_2020_12_1.default.call(this, $data);
        this.refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
      }
      defaultMeta() {
        return this.opts.defaultMeta = super.defaultMeta() || (this.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : void 0);
      }
    };
    exports.Ajv2020 = Ajv20202;
    module.exports = exports = Ajv20202;
    module.exports.Ajv2020 = Ajv20202;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = Ajv20202;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function() {
      return validation_error_1.default;
    } });
    var ref_error_1 = require_ref_error();
    Object.defineProperty(exports, "MissingRefError", { enumerable: true, get: function() {
      return ref_error_1.default;
    } });
  }
});

// docs/campaign.schema.json
var campaign_schema_default;
var init_campaign_schema = __esm({
  "docs/campaign.schema.json"() {
    campaign_schema_default = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://chronicle-forge.local/docs/campaign.schema.json",
      title: "Chronicle Forge \u2014 \u043C\u043E\u043D\u043E\u043B\u0438\u0442\u043D\u0430\u044F \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u044F \u0438 \u0441\u0445\u0435\u043C\u044B \u0444\u0430\u0439\u043B\u043E\u0432 \u043F\u0430\u043A\u0435\u0442\u0430",
      description: "\u041C\u043E\u043D\u043E\u043B\u0438\u0442\u043D\u044B\u0439 JSON Chronicle Forge: \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u043A\u043B\u044E\u0447\u0438 campaign, world, scenes, entities, rules, quests, arenas, cutscenes, dialogues; \u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0435 encounters, recipes, codex. \u0412 $defs \u0442\u0430\u043A\u0436\u0435 CampaignIndexEntry, CampaignManifest \u0438 EncounterFileDef \u0434\u043B\u044F \u0440\u0435\u0435\u0441\u0442\u0440\u0430 \u0438 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0445 \u0444\u0430\u0439\u043B\u043E\u0432 Campaign Package. \u0421\u0433\u0435\u043D\u0435\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u043E \u0438\u0437 src/shared/types.ts (scripts/gen-schema.mts). \u0413\u0430\u0439\u0434 \u0434\u043B\u044F \u0418\u0418-\u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440\u043E\u0432: docs/ai-campaign-guide.md.",
      $ref: "#/$defs/MonolithDoc",
      $defs: {
        TimeOfDayThresholds: {
          type: "object",
          properties: {
            morning: {
              type: "number",
              description: "\u0447\u0430\u0441 \u043D\u0430\u0447\u0430\u043B\u0430 \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u043F\u0435\u0440\u0438\u043E\u0434\u0430 (\u0432 \u0442\u0438\u043A\u0430\u0445 \u043E\u0442 \u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u0443\u0442\u043E\u043A)"
            },
            day: {
              type: "number"
            },
            evening: {
              type: "number"
            },
            night: {
              type: "number"
            }
          },
          required: [
            "morning",
            "day",
            "evening",
            "night"
          ],
          additionalProperties: false
        },
        TimeOfDay: {
          type: "string",
          enum: [
            "morning",
            "day",
            "evening",
            "night"
          ]
        },
        NeedCondition: {
          anyOf: [
            {
              type: "object",
              properties: {
                type: {
                  const: "time_of_day"
                },
                values: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/TimeOfDay"
                  }
                }
              },
              required: [
                "type",
                "values"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "flag"
                },
                flag: {
                  type: "string"
                },
                not: {
                  type: "boolean"
                }
              },
              required: [
                "type",
                "flag"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "in_location"
                },
                locations: {
                  type: "array",
                  items: {
                    type: "string"
                  }
                },
                not: {
                  type: "boolean"
                },
                location: {
                  type: "string"
                }
              },
              required: [
                "type",
                "locations"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "has_item"
                },
                items: {
                  type: "array",
                  items: {
                    type: "string"
                  }
                },
                not: {
                  type: "boolean"
                },
                item: {
                  type: "string"
                }
              },
              required: [
                "type",
                "items"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "equipped"
                },
                items: {
                  type: "array",
                  items: {
                    type: "string"
                  }
                },
                not: {
                  type: "boolean"
                },
                item: {
                  type: "string"
                }
              },
              required: [
                "type",
                "items"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "weather"
                },
                weather: {
                  type: "string"
                },
                not: {
                  type: "boolean"
                }
              },
              required: [
                "type",
                "weather"
              ],
              additionalProperties: false
            }
          ],
          description: "\u0423\u0441\u043B\u043E\u0432\u0438\u0435 \u0434\u043B\u044F \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0438 (\u0444\u0438\u0434\u0431\u0435\u043A \u21161/\u21163 \u0441\u0435\u0434\u044C\u043C\u043E\u0433\u043E \u0440\u0430\u0443\u043D\u0434\u0430): \u043A\u043E\u0433\u0434\u0430 \u043E\u043D\u0430 \u0443\u0431\u044B\u0432\u0430\u0435\u0442\n\u0438 \u043A\u043E\u0433\u0434\u0430 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u0442\u0441\u044F. \u041F\u0440\u0438\u043C\u0435\u0440 \xAB\u0422\u0435\u043F\u043B\u043E\xBB: \u0443\u0431\u044B\u0432\u0430\u0435\u0442 \u043D\u043E\u0447\u044C\u044E, \u0435\u0441\u043B\u0438 \u043D\u0435\u0442 \u0442\u0451\u043F\u043B\u043E\u0439\n\u043E\u0434\u0435\u0436\u0434\u044B \u0438 \u0433\u0435\u0440\u043E\u0439 \u043D\u0435 \u0432 \u0442\u0430\u0432\u0435\u0440\u043D\u0435; \u0432 \u0442\u0430\u0432\u0435\u0440\u043D\u0435 \u2014 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u0442\u0441\u044F.\n\n\u0418\u0442\u0435\u0440\u0430\u0446\u0438\u044F 8, \u04103: \u043C\u043D\u043E\u0436\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F. \xAB\u0413\u0435\u0440\u043E\u0439 \u0432 \u043B\u043E\u043A\u0430\u0446\u0438\u0438\xBB \u0438 \xAB\u0435\u0441\u0442\u044C/\u043D\u0430\u0434\u0435\u0442\n\u043F\u0440\u0435\u0434\u043C\u0435\u0442\xBB \u043F\u0440\u0438\u043D\u0438\u043C\u0430\u044E\u0442 \u0421\u041F\u0418\u0421\u041E\u041A id \u0438 \u043E\u0437\u043D\u0430\u0447\u0430\u044E\u0442 \xAB\u043B\u044E\u0431\u043E\u0439 \u0438\u0437\xBB (\u0443\u0441\u043B\u043E\u0432\u0438\u044F \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0438\n\u0441\u043E\u0435\u0434\u0438\u043D\u044F\u044E\u0442\u0441\u044F \u043F\u043E \xAB\u0418\xBB, \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u0438\u0445 \u043B\u043E\u043A\u0430\u0446\u0438\u0439 \u043E\u0434\u043D\u0438\u043C \u0443\u0441\u043B\u043E\u0432\u0438\u0435\u043C \u0440\u0430\u043D\u044C\u0448\u0435 \u0431\u044B\u043B\u043E\n\u043D\u0435 \u0432\u044B\u0440\u0430\u0437\u0438\u0442\u044C). \u041E\u0434\u0438\u043D\u043E\u0447\u043D\u044B\u0435 \u043F\u043E\u043B\u044F \u0441\u0442\u0430\u0440\u043E\u0433\u043E \u0444\u043E\u0440\u043C\u0430\u0442\u0430 (`location`, `item`)\n\u043C\u0438\u0433\u0440\u0438\u0440\u0443\u044E\u0442\u0441\u044F \u043F\u0440\u0438 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0435 (\u0441\u043C. shared/migrate.ts)."
        },
        NeedDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            description: {
              type: "string",
              description: "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0438 \u0434\u043B\u044F \u0438\u0433\u0440\u043E\u043A\u0430 (\u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u0432 \u0442\u0443\u043B\u0442\u0438\u043F\u0435)"
            },
            short_label: {
              type: "string",
              description: "\u041A\u043E\u0440\u043E\u0442\u043A\u0430\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u044C \u0434\u043B\u044F \u043A\u043E\u043C\u043F\u0430\u043A\u0442\u043D\u043E\u0433\u043E \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0432 HUD"
            },
            max: {
              type: "number"
            },
            decay_per_tick: {
              type: "number"
            },
            critical_threshold: {
              type: "number"
            },
            on_zero_effect: {
              type: "string"
            },
            decay_when: {
              type: "array",
              items: {
                $ref: "#/$defs/NeedCondition"
              },
              description: "\u0443\u0431\u044B\u0432\u0430\u0435\u0442, \u0442\u043E\u043B\u044C\u043A\u043E \u043A\u043E\u0433\u0434\u0430 \u0412\u0421\u0415 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u044B (\u043F\u0443\u0441\u0442\u043E \u2014 \u0432\u0441\u0435\u0433\u0434\u0430)"
            },
            restore_per_tick: {
              type: "number",
              description: "\u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u0437\u0430 \u0442\u0438\u043A, \u043A\u043E\u0433\u0434\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u044B \u0443\u0441\u043B\u043E\u0432\u0438\u044F restore_when"
            },
            restore_when: {
              type: "array",
              items: {
                $ref: "#/$defs/NeedCondition"
              }
            }
          },
          required: [
            "id",
            "label",
            "max",
            "decay_per_tick",
            "critical_threshold"
          ],
          additionalProperties: false
        },
        SkillDifficulty: {
          anyOf: [
            {
              type: "number"
            },
            {
              const: "easy"
            },
            {
              const: "normal"
            },
            {
              const: "difficult"
            },
            {
              const: "impossible"
            }
          ],
          description: "\u0421\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u043D\u0430\u0432\u044B\u043A\u0430 (\u0430\u0443\u0434\u0438\u0442 \xA75.6 \u043F.7): \u0447\u0438\u0441\u043B\u043E \u2014 \u0441\u0442\u0430\u0440\u044B\u0439 \u043F\u043E\u0440\u043E\u0433\n(50 \u043D\u0435\u0439\u0442\u0440\u0430\u043B\u044C\u043D\u043E, \u0431\u043E\u043B\u044C\u0448\u0435 \u2014 \u0442\u0440\u0443\u0434\u043D\u0435\u0435), \u0441\u0442\u0440\u043E\u043A\u0430 \u2014 \u043A\u043D\u0438\u0436\u043D\u044B\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C:\n'easy' \xD72, 'normal' \xD71, 'difficult' \xBD, 'impossible' \xBC."
        },
        ArtFill: {
          anyOf: [
            {
              type: "string"
            },
            {
              type: "object",
              properties: {
                color: {
                  type: "string"
                },
                gradient: {
                  type: "object",
                  properties: {
                    from: {
                      type: "string"
                    },
                    to: {
                      type: "string"
                    },
                    angle: {
                      type: "number"
                    }
                  },
                  required: [
                    "from",
                    "to"
                  ],
                  additionalProperties: false
                }
              },
              additionalProperties: false
            }
          ],
          description: "\u0417\u0430\u043B\u0438\u0432\u043A\u0430 \u043F\u0440\u0438\u043C\u0438\u0442\u0438\u0432\u0430: \u0441\u043F\u043B\u043E\u0448\u043D\u043E\u0439 \u0446\u0432\u0435\u0442 \u0438\u043B\u0438 \u043B\u0438\u043D\u0435\u0439\u043D\u044B\u0439 \u0433\u0440\u0430\u0434\u0438\u0435\u043D\u0442.\n`angle` \u2014 \u043D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0433\u0440\u0430\u0434\u0438\u0435\u043D\u0442\u0430 \u0432 \u0433\u0440\u0430\u0434\u0443\u0441\u0430\u0445 (0 \u2014 \u0441\u043B\u0435\u0432\u0430 \u043D\u0430\u043F\u0440\u0430\u0432\u043E)."
        },
        ArtRect: {
          type: "object",
          properties: {
            opacity: {
              type: "number",
              description: "\u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u043E\u0441\u0442\u044C 0\u20261"
            },
            rotate: {
              type: "number",
              description: "\u043F\u043E\u0432\u043E\u0440\u043E\u0442 \u0432\u043E\u043A\u0440\u0443\u0433 \u0441\u0432\u043E\u0435\u0433\u043E \u0446\u0435\u043D\u0442\u0440\u0430, \u0433\u0440\u0430\u0434\u0443\u0441\u044B"
            },
            type: {
              const: "rect"
            },
            x: {
              type: "number"
            },
            y: {
              type: "number"
            },
            w: {
              type: "number"
            },
            h: {
              type: "number"
            },
            fill: {
              $ref: "#/$defs/ArtFill"
            },
            stroke: {
              type: "string"
            },
            stroke_width: {
              type: "number"
            },
            radius: {
              type: "number"
            }
          },
          required: [
            "type",
            "x",
            "y",
            "w",
            "h"
          ],
          additionalProperties: false
        },
        ArtEllipse: {
          type: "object",
          properties: {
            opacity: {
              type: "number",
              description: "\u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u043E\u0441\u0442\u044C 0\u20261"
            },
            rotate: {
              type: "number",
              description: "\u043F\u043E\u0432\u043E\u0440\u043E\u0442 \u0432\u043E\u043A\u0440\u0443\u0433 \u0441\u0432\u043E\u0435\u0433\u043E \u0446\u0435\u043D\u0442\u0440\u0430, \u0433\u0440\u0430\u0434\u0443\u0441\u044B"
            },
            type: {
              const: "ellipse"
            },
            cx: {
              type: "number"
            },
            cy: {
              type: "number"
            },
            rx: {
              type: "number"
            },
            ry: {
              type: "number"
            },
            fill: {
              $ref: "#/$defs/ArtFill"
            },
            stroke: {
              type: "string"
            },
            stroke_width: {
              type: "number"
            }
          },
          required: [
            "type",
            "cx",
            "cy",
            "rx",
            "ry"
          ],
          additionalProperties: false
        },
        ArtPolygon: {
          type: "object",
          properties: {
            opacity: {
              type: "number",
              description: "\u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u043E\u0441\u0442\u044C 0\u20261"
            },
            rotate: {
              type: "number",
              description: "\u043F\u043E\u0432\u043E\u0440\u043E\u0442 \u0432\u043E\u043A\u0440\u0443\u0433 \u0441\u0432\u043E\u0435\u0433\u043E \u0446\u0435\u043D\u0442\u0440\u0430, \u0433\u0440\u0430\u0434\u0443\u0441\u044B"
            },
            type: {
              const: "polygon"
            },
            points: {
              type: "array",
              items: {
                type: "number"
              },
              description: "\u0442\u043E\u0447\u043A\u0438 \u0432 \u0432\u0438\u0434\u0435 [x1, y1, x2, y2, \u2026] \u0432 \u043A\u043E\u043E\u0440\u0434\u0438\u043D\u0430\u0442\u0430\u0445 \u0445\u043E\u043B\u0441\u0442\u0430"
            },
            fill: {
              $ref: "#/$defs/ArtFill"
            },
            stroke: {
              type: "string"
            },
            stroke_width: {
              type: "number"
            }
          },
          required: [
            "type",
            "points"
          ],
          additionalProperties: false
        },
        ArtLine: {
          type: "object",
          properties: {
            opacity: {
              type: "number",
              description: "\u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u043E\u0441\u0442\u044C 0\u20261"
            },
            rotate: {
              type: "number",
              description: "\u043F\u043E\u0432\u043E\u0440\u043E\u0442 \u0432\u043E\u043A\u0440\u0443\u0433 \u0441\u0432\u043E\u0435\u0433\u043E \u0446\u0435\u043D\u0442\u0440\u0430, \u0433\u0440\u0430\u0434\u0443\u0441\u044B"
            },
            type: {
              const: "line"
            },
            x1: {
              type: "number"
            },
            y1: {
              type: "number"
            },
            x2: {
              type: "number"
            },
            y2: {
              type: "number"
            },
            color: {
              type: "string"
            },
            width: {
              type: "number"
            }
          },
          required: [
            "type",
            "x1",
            "y1",
            "x2",
            "y2"
          ],
          additionalProperties: false
        },
        ArtText: {
          type: "object",
          properties: {
            opacity: {
              type: "number",
              description: "\u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u043E\u0441\u0442\u044C 0\u20261"
            },
            rotate: {
              type: "number",
              description: "\u043F\u043E\u0432\u043E\u0440\u043E\u0442 \u0432\u043E\u043A\u0440\u0443\u0433 \u0441\u0432\u043E\u0435\u0433\u043E \u0446\u0435\u043D\u0442\u0440\u0430, \u0433\u0440\u0430\u0434\u0443\u0441\u044B"
            },
            type: {
              const: "text"
            },
            x: {
              type: "number"
            },
            y: {
              type: "number"
            },
            text: {
              type: "string"
            },
            size: {
              type: "number"
            },
            color: {
              type: "string"
            },
            align: {
              type: "string",
              enum: [
                "start",
                "middle",
                "end"
              ],
              description: "'start' | 'middle' | 'end' \u2014 \u043A\u0430\u043A \u0432 SVG"
            },
            bold: {
              type: "boolean"
            },
            italic: {
              type: "boolean"
            },
            font: {
              type: "string"
            }
          },
          required: [
            "type",
            "x",
            "y",
            "text"
          ],
          additionalProperties: false
        },
        ArtShape: {
          anyOf: [
            {
              $ref: "#/$defs/ArtRect"
            },
            {
              $ref: "#/$defs/ArtEllipse"
            },
            {
              $ref: "#/$defs/ArtPolygon"
            },
            {
              $ref: "#/$defs/ArtLine"
            },
            {
              $ref: "#/$defs/ArtText"
            }
          ]
        },
        ArtLayer: {
          type: "object",
          properties: {
            label: {
              type: "string",
              description: "\u043F\u043E\u0434\u043F\u0438\u0441\u044C \u0441\u043B\u043E\u044F \u0434\u043B\u044F \u043C\u0430\u0441\u0442\u0435\u0440\u0430 (\xAB\u043D\u0435\u0431\u043E\xBB, \xAB\u0433\u043E\u0440\u0430\xBB, \xAB\u0441\u0442\u0435\u043D\u0430\xBB)"
            },
            shape: {
              $ref: "#/$defs/ArtShape"
            },
            opacity: {
              type: "number"
            },
            rotate: {
              type: "number"
            }
          },
          required: [
            "shape"
          ],
          additionalProperties: false
        },
        ArtDoc: {
          type: "object",
          properties: {
            canvas: {
              type: "object",
              properties: {
                w: {
                  type: "number"
                },
                h: {
                  type: "number"
                }
              },
              required: [
                "w",
                "h"
              ],
              additionalProperties: false
            },
            background: {
              type: "string"
            },
            layers: {
              type: "array",
              items: {
                $ref: "#/$defs/ArtLayer"
              }
            }
          },
          required: [
            "layers"
          ],
          additionalProperties: false,
          description: "\u0412\u0435\u043A\u0442\u043E\u0440\u043D\u0430\u044F \xAB\u043A\u0430\u0440\u0442\u0438\u043D\u043A\u0430 \u0438\u0437 JSON\xBB: \u0441\u043B\u043E\u0438 \u043F\u0440\u0438\u043C\u0438\u0442\u0438\u0432\u043E\u0432 \u0432 \u043A\u043E\u043E\u0440\u0434\u0438\u043D\u0430\u0442\u0430\u0445 \u0445\u043E\u043B\u0441\u0442\u0430\n(\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 1280\xD7720 \u2014 \u0442\u0430 \u0436\u0435 \u0441\u0438\u0441\u0442\u0435\u043C\u0430, \u0447\u0442\u043E \u0443 \u0441\u043B\u043E\u0442\u043E\u0432 \u0441\u0446\u0435\u043D\u044B).\n\u0424\u043E\u0440\u043C\u0430\u0442 \u0440\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u043D \u043D\u0430 \u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u044E \u0418\u0418: \u043D\u0430\u0440\u0438\u0441\u043E\u0432\u0430\u0432 \u0441\u0446\u0435\u043D\u0443 \u043F\u0440\u0438\u043C\u0438\u0442\u0438\u0432\u0430\u043C\u0438, \u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440\n\u0441\u0430\u043C \u0437\u043D\u0430\u0435\u0442 \u043A\u043E\u043E\u0440\u0434\u0438\u043D\u0430\u0442\u044B \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u0432 \u0438 \u0441\u0442\u0430\u0432\u0438\u0442 \u0441\u043B\u043E\u0442\u044B \u0442\u043E\u0447\u043D\u043E \u043D\u0430 \u043D\u0438\u0445."
        },
        CameraDoc: {
          type: "object",
          properties: {
            zoom: {
              type: "number",
              description: "\u0446\u0435\u043B\u0435\u0432\u043E\u0439 \u0437\u0443\u043C (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 1)"
            },
            pan_x: {
              type: "number",
              description: "\u0433\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u0430\u043B\u044C\u043D\u044B\u0439 \u0441\u0434\u0432\u0438\u0433 \u043A\u0430\u0434\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F, -50\u202650 % \u0448\u0438\u0440\u0438\u043D\u044B (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 0)"
            },
            pan_y: {
              type: "number",
              description: "\u0432\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0441\u0434\u0432\u0438\u0433 \u043A\u0430\u0434\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F, -50\u202650 % \u0432\u044B\u0441\u043E\u0442\u044B (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 0)"
            },
            duration: {
              type: "number",
              description: "\u0441\u0435\u043A\u0443\u043D\u0434\u044B \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0430 \u043A \u043F\u043E\u0437\u0438\u0446\u0438\u0438 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 8; 0 \u2014 \u043C\u0433\u043D\u043E\u0432\u0435\u043D\u043D\u043E)"
            }
          },
          additionalProperties: false,
          description: "\u041A\u0438\u043D\u0435\u043C\u0430\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043A\u0430\u043C\u0435\u0440\u0430 \u0444\u043E\u043D\u0430: \u043C\u0435\u0434\u043B\u0435\u043D\u043D\u044B\u0439 \u043F\u0430\u043D-\u0437\u0443\u043C \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F \u0441\u0446\u0435\u043D\u044B \u0438\u043B\u0438\n\u0441\u043B\u0430\u0439\u0434\u0430 \u043A\u0430\u0442\u0441\u0446\u0435\u043D\u044B (\xAB\u043F\u0440\u043E\u043B\u0451\u0442\xBB \u043F\u043E \u043A\u0430\u0440\u0442\u0438\u043D\u0435, \u043F\u0440\u0438\u0431\u043B\u0438\u0436\u0435\u043D\u0438\u0435 \u043D\u0430 \u043B\u0438\u0446\u043E). \u041F\u0440\u043E\u0446\u0435\u043D\u0442\u044B \u2014 \u043E\u0442\n\u043E\u0431\u0449\u0435\u0439 \u0448\u0438\u0440\u0438\u043D\u044B/\u0432\u044B\u0441\u043E\u0442\u044B \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F; \u0437\u0443\u043C >1 \u043F\u0440\u0438\u0431\u043B\u0438\u0436\u0430\u0435\u0442, <1 \u043E\u0442\u0434\u0430\u043B\u044F\u0435\u0442."
        },
        Effect: {
          anyOf: [
            {
              type: "object",
              properties: {
                type: {
                  const: "set_flag"
                },
                flag: {
                  type: "string"
                },
                value: {
                  anyOf: [
                    {
                      type: "boolean"
                    },
                    {
                      type: "number"
                    },
                    {
                      type: "string"
                    }
                  ]
                }
              },
              required: [
                "type",
                "flag"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "clear_flag"
                },
                flag: {
                  type: "string"
                }
              },
              required: [
                "type",
                "flag"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "apply_status"
                },
                target: {
                  const: "player"
                },
                status: {
                  type: "string"
                },
                duration: {
                  type: "number"
                }
              },
              required: [
                "type",
                "target",
                "status"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "remove_status"
                },
                target: {
                  const: "player"
                },
                status: {
                  type: "string"
                }
              },
              required: [
                "type",
                "target",
                "status"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "set_weather"
                },
                weather: {
                  type: "string"
                }
              },
              required: [
                "type",
                "weather"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "unlock_codex"
                },
                entry: {
                  type: "string"
                }
              },
              required: [
                "type",
                "entry"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "unlock_recipe"
                },
                recipe: {
                  type: "string"
                }
              },
              required: [
                "type",
                "recipe"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "open_craft"
                },
                recipe: {
                  type: "string"
                }
              },
              required: [
                "type"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "set_entity_state"
                },
                entity: {
                  type: "string"
                },
                state: {
                  type: "string"
                }
              },
              required: [
                "type",
                "entity",
                "state"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "learn_name"
                },
                entity: {
                  type: "string"
                },
                silent: {
                  type: "boolean"
                }
              },
              required: [
                "type",
                "entity"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "set_variable"
                },
                var: {
                  type: "string"
                },
                value: {
                  anyOf: [
                    {
                      type: "number"
                    },
                    {
                      type: "string"
                    }
                  ]
                }
              },
              required: [
                "type",
                "var",
                "value"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "change_variable"
                },
                var: {
                  type: "string"
                },
                delta: {
                  type: "number"
                }
              },
              required: [
                "type",
                "var",
                "delta"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "start_dialogue"
                },
                entity: {
                  type: "string"
                },
                dialogue_knot: {
                  type: "string"
                }
              },
              required: [
                "type",
                "entity"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "start_duration_action"
                },
                action: {
                  type: "string"
                },
                ticks: {
                  type: "number"
                }
              },
              required: [
                "type",
                "action"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "start_combat"
                },
                enemies: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      entity: {
                        type: "string"
                      },
                      count: {
                        type: "number"
                      }
                    },
                    required: [
                      "entity",
                      "count"
                    ],
                    additionalProperties: false
                  }
                },
                allies: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      entity: {
                        type: "string"
                      },
                      count: {
                        type: "number"
                      }
                    },
                    required: [
                      "entity",
                      "count"
                    ],
                    additionalProperties: false
                  },
                  description: "\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0435 \u0441\u043E\u044E\u0437\u043D\u0438\u043A\u0438 \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430 \u044D\u0442\u043E\u0442 \u0431\u043E\u0439 (\u043D\u0435 \u0432\u0445\u043E\u0434\u044F\u0442 \u0432 \u043F\u0430\u0440\u0442\u0438\u044E)"
                },
                arena: {
                  type: "string"
                },
                intro: {
                  type: "string"
                },
                on_victory: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/Effect"
                  }
                },
                no_flee: {
                  type: "boolean",
                  description: "\u0437\u0430\u043F\u0440\u0435\u0442\u0438\u0442\u044C \u0431\u0435\u0433\u0441\u0442\u0432\u043E \u0438\u0433\u0440\u043E\u043A\u0430 \u0438\u043C\u0435\u043D\u043D\u043E \u0432 \u044D\u0442\u043E\u043C \u0431\u043E\u044E (\u0431\u043E\u0441\u0441, \u0437\u0430\u0441\u0430\u0434\u0430)"
                },
                no_hide: {
                  type: "boolean",
                  description: "\u0441\u043A\u0440\u044B\u0442\u043D\u043E\u0441\u0442\u044C \u043D\u0435 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0432 \u044D\u0442\u043E\u043C \u0431\u043E\u044E (\u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0435 \u043F\u043E\u043B\u0435, \u0442\u0435\u0441\u043D\u0430\u044F \u043A\u043E\u043C\u043D\u0430\u0442\u0430)"
                },
                surprise: {
                  type: "string",
                  enum: [
                    "player",
                    "enemy"
                  ],
                  description: "\u0431\u043E\u0439 \u043D\u0430\u0447\u0438\u043D\u0430\u0435\u0442\u0441\u044F \u0432\u043D\u0435\u0437\u0430\u043F\u043D\u043E \u0434\u043B\u044F \u0433\u0435\u0440\u043E\u044F: \u043F\u0440\u043E\u043F\u0443\u0441\u043A \u043F\u0435\u0440\u0432\u043E\u0433\u043E \u0440\u0430\u0443\u043D\u0434\u0430"
                },
                on_fled: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/Effect"
                  },
                  description: "\u044D\u0444\u0444\u0435\u043A\u0442\u044B, \u0435\u0441\u043B\u0438 \u0438\u0433\u0440\u043E\u043A \u0441\u0431\u0435\u0436\u0430\u043B \u0438\u0437 \u0431\u043E\u044F (\u0430\u0443\u0434\u0438\u0442 \xA75.6 \u043F.2)"
                },
                on_defeat: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/Effect"
                  },
                  description: "\u042D\u0444\u0444\u0435\u043A\u0442\u044B \u043F\u0440\u043E\u0438\u0433\u0440\u044B\u0448\u0430 \u0432 \u0440\u0435\u0436\u0438\u043C\u0435 `combat.death.mode='brp'`, \u043A\u043E\u0433\u0434\u0430 \u0433\u0435\u0440\u043E\u0439\n\u0432\u044B\u0436\u0438\u043B \u0431\u0435\u0437 \u0441\u043E\u0437\u043D\u0430\u043D\u0438\u044F: \u043F\u043B\u0435\u043D, \u043E\u0433\u0440\u0430\u0431\u043B\u0435\u043D\u0438\u0435, \u0441\u043F\u0430\u0441\u0435\u043D\u0438\u0435 \u2014 \u0447\u0442\u043E \u043F\u0440\u0438\u0434\u0443\u043C\u0430\u0435\u0442\n\u043C\u0430\u0441\u0442\u0435\u0440. \u041D\u0435 \u0437\u0430\u0434\u0430\u043D\u043E \u2014 \u043F\u0440\u043E\u0438\u0433\u0440\u044B\u0448 \u0432 \u0431\u043E\u044E \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u0441\u043C\u0435\u0440\u0442\u044C\u044E."
                }
              },
              required: [
                "type",
                "enemies",
                "arena"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "teleport_player"
                },
                location: {
                  type: "string"
                },
                scene: {
                  type: "string"
                }
              },
              required: [
                "type",
                "location"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "change_scene_state"
                },
                scene: {
                  type: "string"
                },
                state: {
                  type: "string"
                }
              },
              required: [
                "type",
                "scene",
                "state"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "add_item"
                },
                item: {
                  type: "string"
                },
                quantity: {
                  type: "number"
                }
              },
              required: [
                "type",
                "item"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "remove_item"
                },
                item: {
                  type: "string"
                },
                quantity: {
                  type: "number"
                }
              },
              required: [
                "type",
                "item"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "change_need"
                },
                need: {
                  type: "string"
                },
                delta: {
                  type: "number"
                }
              },
              required: [
                "type",
                "need",
                "delta"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "change_hp"
                },
                delta: {
                  type: "number"
                }
              },
              required: [
                "type",
                "delta"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "change_companion_need"
                },
                entity: {
                  type: "string"
                },
                need: {
                  type: "string"
                },
                delta: {
                  type: "number"
                }
              },
              required: [
                "type",
                "entity",
                "need",
                "delta"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "transfer_to_companion"
                },
                entity: {
                  type: "string"
                },
                item: {
                  type: "string"
                },
                quantity: {
                  type: "number"
                }
              },
              required: [
                "type",
                "entity",
                "item"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "change_skill"
                },
                skill: {
                  type: "string"
                },
                delta: {
                  type: "number"
                }
              },
              required: [
                "type",
                "skill",
                "delta"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "skill_check_gate"
                },
                skill: {
                  type: "string"
                },
                difficulty: {
                  $ref: "#/$defs/SkillDifficulty"
                },
                success_effects: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/Effect"
                  }
                },
                fail_effects: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/Effect"
                  }
                }
              },
              required: [
                "type",
                "skill",
                "difficulty",
                "success_effects",
                "fail_effects"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "change_disposition"
                },
                target: {
                  type: "string"
                },
                delta: {
                  type: "number"
                }
              },
              required: [
                "type",
                "target",
                "delta"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "start_quest"
                },
                quest: {
                  type: "string"
                }
              },
              required: [
                "type",
                "quest"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "advance_quest"
                },
                quest: {
                  type: "string"
                },
                stage: {
                  type: "string"
                }
              },
              required: [
                "type",
                "quest",
                "stage"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "fail_quest"
                },
                quest: {
                  type: "string"
                }
              },
              required: [
                "type",
                "quest"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "journal_update"
                },
                quest: {
                  type: "string"
                },
                text_key: {
                  type: "string"
                }
              },
              required: [
                "type",
                "quest",
                "text_key"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "give_reward"
                },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      item: {
                        type: "string"
                      },
                      quantity: {
                        type: "number"
                      }
                    },
                    required: [
                      "item",
                      "quantity"
                    ],
                    additionalProperties: false
                  }
                }
              },
              required: [
                "type"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "stat_check",
                  description: "\u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0425\u0410\u0420\u0410\u041A\u0422\u0415\u0420\u0418\u0421\u0422\u0418\u041A\u0418 \xD7 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C (\u0430\u0443\u0434\u0438\u0442 \xA75.6 \u043F.6): POW\xD75 \u2014 \u0443\u0434\u0430\u0447\u0430, INT\xD75 \u2014 \u0438\u0434\u0435\u044F\u2026"
                },
                stat: {
                  type: "string"
                },
                multiplier: {
                  type: "number",
                  description: "\u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 5 \u2014 \u043A\u043D\u0438\u0436\u043D\u044B\u0439)"
                },
                modifier: {
                  type: "number",
                  description: "\u0434\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u043C\u043E\u0434\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440 \u043A \u0446\u0435\u043B\u0438 (\u0441\u0438\u0442\u0443\u0430\u0446\u0438\u044F \u043C\u0430\u0441\u0442\u0435\u0440\u0430)"
                },
                augment_passion: {
                  type: "string",
                  description: "\u0430\u0443\u0433\u043C\u0435\u043D\u0442 \u0441\u0442\u0440\u0430\u0441\u0442\u0438 (\u0430\u0443\u0434\u0438\u0442 B6): id \u0441\u0442\u0440\u0430\u0441\u0442\u0438 \u0438\u0437 meta.passions_list; \u043F\u043E\u0440\u043E\u0433 \u0438 \u0431\u043E\u043D\u0443\u0441 \u2014 meta.augments"
                },
                assist_entity: {
                  type: "string",
                  description: "\u043F\u043E\u0434\u043C\u043E\u0433\u0430 \u0441\u043E\u044E\u0437\u043D\u0438\u043A\u0430 (\u0430\u0443\u0434\u0438\u0442 B6): id NPC-\u0441\u0443\u0449\u043D\u043E\u0441\u0442\u0438; \u0435\u0451 \u043D\u0430\u0432\u044B\u043A \u2014 assist_skill \u0438\u043B\u0438 \u0441\u0430\u043C\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 stat?"
                },
                assist_skill: {
                  type: "string",
                  description: "\u043D\u0430\u0432\u044B\u043A \u043F\u043E\u0434\u043C\u043E\u0433\u0438 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 \u2014 \u043D\u0430\u0432\u044B\u043A \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 / \u0434\u043B\u044F stat_check \u2014 'support')"
                },
                success_effects: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/Effect"
                  }
                },
                fail_effects: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/Effect"
                  }
                }
              },
              required: [
                "type",
                "stat",
                "success_effects",
                "fail_effects"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "opposed_check",
                  description: "\u041F\u0440\u043E\u0442\u0438\u0432\u043E\u0431\u043E\u0440\u0441\u0442\u0432\u043E \u043D\u0430\u0432\u044B\u043A\u043E\u043C (\u0430\u0443\u0434\u0438\u0442 \xA75.6 \u043F.6): \u0433\u0435\u0440\u043E\u0439 \u043F\u0440\u043E\u0442\u0438\u0432 NPC \u0438\u043B\u0438 \u043F\u043E\u0440\u043E\u0433\u0430.\n\u0420\u0430\u043D\u0433\u0438 \u0441\u0440\u0430\u0432\u043D\u0438\u0432\u0430\u044E\u0442\u0441\u044F (\u043F\u0440\u043E\u0432\u0430\u043B < \u0443\u0441\u043F\u0435\u0445 < \u0442\u0432\u0451\u0440\u0434\u044B\u0439 < \u043A\u0440\u0438\u0442); \u043F\u0440\u0438 \u0440\u0430\u0432\u0435\u043D\u0441\u0442\u0432\u0435\n\u043F\u043E\u0431\u0435\u0436\u0434\u0430\u0435\u0442 `tie` (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 'player')."
                },
                skill: {
                  type: "string"
                },
                entity: {
                  type: "string",
                  description: "\u0446\u0435\u043B\u044C \u2014 NPC (\u0431\u0440\u043E\u0441\u0430\u0435\u0442 \u0442\u0435\u043C \u0436\u0435 \u0438\u043B\u0438 \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u044B\u043C \u043D\u0430\u0432\u044B\u043A\u043E\u043C)"
                },
                against_skill: {
                  type: "string",
                  description: "\u043D\u0430\u0432\u044B\u043A \u0446\u0435\u043B\u0438 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 \u2014 \u0442\u043E\u0442 \u0436\u0435 \u043D\u0430\u0432\u044B\u043A)"
                },
                against_value: {
                  type: "number",
                  description: "\u0438\u043B\u0438 \u0447\u0438\u0441\u043B\u043E\u0432\u043E\u0439 \u043F\u043E\u0440\u043E\u0433 \u0432\u043C\u0435\u0441\u0442\u043E \u0431\u0440\u043E\u0441\u043A\u0430 NPC (\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u043D\u0430\u0432\u044B\u043A\u0430 \u043E\u043F\u043F\u043E\u043D\u0435\u043D\u0442\u0430)"
                },
                tie: {
                  type: "string",
                  enum: [
                    "player",
                    "opponent"
                  ]
                },
                augment_passion: {
                  type: "string",
                  description: "\u0430\u0443\u0433\u043C\u0435\u043D\u0442 \u0441\u0442\u0440\u0430\u0441\u0442\u0438 \u0433\u0435\u0440\u043E\u044F \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0441\u043F\u043E\u0440\u0430 (\u0430\u0443\u0434\u0438\u0442 B6)"
                },
                success_effects: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/Effect"
                  }
                },
                fail_effects: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/Effect"
                  }
                }
              },
              required: [
                "type",
                "skill",
                "success_effects",
                "fail_effects"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "group_stat_check",
                  description: "\u0413\u0440\u0443\u043F\u043F\u043E\u0432\u0430\u044F \u0441\u0446\u0435\u043F\u043B\u0435\u043D\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 (\u0430\u0443\u0434\u0438\u0442 \xA75.6): \u0431\u0440\u043E\u0441\u0430\u0435\u0442 \u0433\u0435\u0440\u043E\u0439 \u0438 \u0434\u043E\n`helpers` \u0441\u043E\u044E\u0437\u043D\u0438\u043A\u043E\u0432 \u0438\u0437 \u043F\u0430\u0440\u0442\u0438\u0438 \u2014 \u043E\u0434\u043D\u043E\u0439 \u0446\u0435\u043F\u044C\u044E. \u0415\u0441\u043B\u0438 \u0443\u0441\u043F\u0435\u0448\u043D\u044B\u0445 \u0431\u0440\u043E\u0441\u043A\u043E\u0432\n\u0441\u0440\u0435\u0434\u0438 \u0432\u0441\u0435\u0445 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432 \u2265 `need` (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 \u2014 \u0431\u043E\u043B\u044C\u0448\u0438\u043D\u0441\u0442\u0432\u043E), \u0441\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u0442\n\u041E\u0414\u041D\u0410 \u0432\u0435\u0442\u0432\u044C \u0443\u0441\u043F\u0435\u0445\u0430, \u0438\u043D\u0430\u0447\u0435 \u2014 \u0432\u0435\u0442\u0432\u044C \u043F\u0440\u043E\u0432\u0430\u043B\u0430. \u041F\u043E\u0434\u0445\u043E\u0434\u0438\u0442 \u0434\u043B\u044F \u0442\u0438\u0445\u0438\u0445\n\u043E\u0431\u0445\u043E\u0434\u043E\u0432 (\u0432\u0441\u0435 \u043A\u0440\u0430\u0434\u0443\u0442\u0441\u044F), \u0440\u044B\u0432\u043A\u043E\u0432 (\u0432\u0441\u043F\u043E\u043C\u043D\u0438\u043B\u0438 \u0432\u043C\u0435\u0441\u0442\u0435), \u0441\u043B\u0435\u0434\u043E\u043F\u044B\u0442\u0441\u0442\u0432\u0430."
                },
                mode: {
                  type: "string",
                  enum: [
                    "skill",
                    "stat"
                  ],
                  description: "\u0447\u0435\u043C \u0431\u0440\u043E\u0441\u0430\u0435\u043C: \u043D\u0430\u0432\u044B\u043A\u043E\u043C (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435) \u0438\u043B\u0438 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u043E\u0439 \xD7\u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C"
                },
                skill: {
                  type: "string",
                  description: "\u043D\u0430\u0432\u044B\u043A (mode='skill')"
                },
                stat: {
                  type: "string",
                  description: "\u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0430 (mode='stat')"
                },
                multiplier: {
                  type: "number",
                  description: "\u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 5)"
                },
                difficulty: {
                  $ref: "#/$defs/SkillDifficulty",
                  description: "\u0441\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u044C \u0431\u0440\u043E\u0441\u043A\u0430 \u043D\u0430\u0432\u044B\u043A\u0430 \u0443 \u0432\u0441\u0435\u0445 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432"
                },
                modifier: {
                  type: "number",
                  description: "\u0434\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u043C\u043E\u0434\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440 \u043A \u0446\u0435\u043B\u0438 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438"
                },
                helpers: {
                  type: "number",
                  description: "\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043F\u0435\u0440\u0432\u044B\u0445 \u0441\u043E\u044E\u0437\u043D\u0438\u043A\u043E\u0432 \u0438\u0437 \u043F\u0430\u0440\u0442\u0438\u0438 \u0443\u0447\u0430\u0441\u0442\u0432\u0443\u0435\u0442 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 2)"
                },
                need: {
                  type: "number",
                  description: "\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0443\u0441\u043F\u0435\u0448\u043D\u044B\u0445 \u0431\u0440\u043E\u0441\u043A\u043E\u0432 \u043D\u0443\u0436\u043D\u043E (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 \u2014 \u0431\u043E\u043B\u044C\u0448\u0438\u043D\u0441\u0442\u0432\u043E \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432)"
                },
                success_effects: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/Effect"
                  }
                },
                fail_effects: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/Effect"
                  }
                }
              },
              required: [
                "type",
                "success_effects",
                "fail_effects"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "change_luck"
                },
                delta: {
                  type: "number"
                }
              },
              required: [
                "type",
                "delta"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "change_fatigue"
                },
                delta: {
                  type: "number"
                }
              },
              required: [
                "type",
                "delta"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "change_sanity"
                },
                delta: {
                  type: "number"
                }
              },
              required: [
                "type",
                "delta"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "change_reputation"
                },
                delta: {
                  type: "number"
                }
              },
              required: [
                "type",
                "delta"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "change_wealth"
                },
                levels: {
                  type: "number"
                }
              },
              required: [
                "type",
                "levels"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "change_passion"
                },
                id: {
                  type: "string"
                },
                delta: {
                  type: "number"
                },
                set: {
                  type: "number"
                }
              },
              required: [
                "type",
                "id"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "change_allegiance"
                },
                id: {
                  type: "string"
                },
                points: {
                  type: "number"
                }
              },
              required: [
                "type",
                "id",
                "points"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "train_stat"
                },
                stat: {
                  type: "string"
                },
                delta: {
                  type: "number"
                }
              },
              required: [
                "type",
                "stat",
                "delta"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "hazard_fall"
                },
                meters: {
                  type: "number"
                },
                skill: {
                  type: "string"
                }
              },
              required: [
                "type",
                "meters"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "start_pursuit",
                  description: "\u041D\u0430\u0447\u0430\u0442\u044C \u043F\u0440\u0435\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0433\u0435\u0440\u043E\u044F (\u0430\u0443\u0434\u0438\u0442 \xA75.6): \u043F\u043E\u043A\u0430 \u0430\u043A\u0442\u0438\u0432\u043D\u043E, \u043A\u0430\u0436\u0434\u044B\u0435\n`every_ticks` \u0442\u0438\u043A\u043E\u0432 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 4) \u0433\u0435\u0440\u043E\u0439 \u0438 \u0434\u043E \u0434\u0432\u0443\u0445 \u0441\u043E\u044E\u0437\u043D\u0438\u043A\u043E\u0432 \u043F\u0430\u0440\u0442\u0438\u0438\n\u043F\u0440\u043E\u0432\u0435\u0440\u044F\u044E\u0442 \u0446\u0435\u043F\u043E\u0447\u043A\u043E\u0439 \u043D\u0430\u0432\u044B\u043A `skill` (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 stealth). \u0426\u0435\u043F\u043E\u0447\u043A\u0430\n\u043F\u0440\u043E\u0432\u0430\u043B\u043E\u0432 \u043F\u043E\u0434\u0440\u044F\u0434 \u2265 fails_to_catch (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 1) \u2014 \u043F\u043E\u0433\u043E\u043D\u044F \u043D\u0430\u0441\u0442\u0438\u0433\u043B\u0430:\n\u0441\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u044E\u0442 `on_fail` (\u043E\u0431\u044B\u0447\u043D\u043E start_combat), \u043F\u0440\u0435\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0433\u0430\u0441\u043D\u0435\u0442.\n\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0437\u0430\u0440\u0430\u043D\u0435\u0435 \u043C\u043E\u0436\u043D\u043E \u044D\u0444\u0444\u0435\u043A\u0442\u043E\u043C stop_pursuit (\u043E\u0442\u043E\u0440\u0432\u0430\u043B\u0438\u0441\u044C \u0432 \u0441\u0446\u0435\u043D\u0435)."
                },
                label: {
                  type: "string",
                  description: "\u043A\u0442\u043E \u0433\u043E\u043D\u0438\u0442\u0441\u044F (\u0434\u043B\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u0438 \u0432 \u0436\u0443\u0440\u043D\u0430\u043B\u0435)"
                },
                skill: {
                  type: "string"
                },
                every_ticks: {
                  type: "number"
                },
                fails_to_catch: {
                  type: "number"
                },
                on_fail: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/Effect"
                  }
                }
              },
              required: [
                "type",
                "on_fail"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "stop_pursuit"
                }
              },
              required: [
                "type"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "fire_rule"
                },
                rule: {
                  type: "string"
                }
              },
              required: [
                "type",
                "rule"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "commit_crime"
                },
                id: {
                  type: "string"
                },
                bounty: {
                  type: "number"
                }
              },
              required: [
                "type",
                "id"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "set_price_event"
                },
                id: {
                  type: "string"
                }
              },
              required: [
                "type",
                "id"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "clear_price_event"
                },
                id: {
                  type: "string"
                }
              },
              required: [
                "type"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "banner"
                },
                text: {
                  type: "string",
                  description: "\u0442\u0435\u043A\u0441\u0442 \u043D\u0430\u0434\u043F\u0438\u0441\u0438; \u043F\u043E\u043D\u0438\u043C\u0430\u0435\u0442 \u0442\u043E\u043A\u0435\u043D\u044B {var}/\xAB\u0441\u043A\u043E\u0431\u043A\u0438\xBB \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u043E\u0439 \u0440\u0430\u0441\u043A\u043B\u0430\u0434\u043A\u0438"
                },
                preset: {
                  type: "string",
                  enum: [
                    "\u0433\u043B\u0430\u0432\u0430",
                    "\u0448\u0451\u043F\u043E\u0442",
                    "\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A",
                    "\u043F\u0440\u043E\u043A\u043B\u044F\u0442\u044C\u0435",
                    "\u0437\u0430\u043F\u0438\u0441\u043E\u0447\u043D\u044B\u0439"
                  ]
                },
                enter: {
                  type: "string",
                  enum: [
                    "\u0432\u0441\u043F\u043B\u0435\u0441\u043A",
                    "\u0442\u044F\u043D\u0443\u0442\u044C",
                    "\u0441\u0431\u043E\u043A\u0443",
                    "\u043C\u043E\u043B\u043D\u0438\u0435\u043D\u043E\u0441\u043D\u043E"
                  ],
                  description: "\u043F\u043E\u044F\u0432\u043B\u0435\u043D\u0438\u0435: \u0432\u0441\u043F\u043B\u0435\u0441\u043A | \u0442\u044F\u043D\u0443\u0442\u044C | \u0441\u0431\u043E\u043A\u0443 | \u043C\u043E\u043B\u043D\u0438\u0435\u043D\u043E\u0441\u043D\u043E"
                },
                seconds: {
                  type: "number",
                  description: "\u0441\u0435\u043A\u0443\u043D\u0434\u044B \u043D\u0430 \u044D\u043A\u0440\u0430\u043D\u0435 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 \u2014 \u043E\u0442 \u0434\u043B\u0438\u043D\u044B \u0442\u0435\u043A\u0441\u0442\u0430, \u043C\u0438\u043D\u0438\u043C\u0443\u043C 3)"
                },
                position: {
                  type: "string",
                  enum: [
                    "\u0432\u0435\u0440\u0445",
                    "\u0446\u0435\u043D\u0442\u0440"
                  ],
                  description: "\u0433\u0434\u0435: \u0432\u0435\u0440\u0445 | \u0446\u0435\u043D\u0442\u0440 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 \u0446\u0435\u043D\u0442\u0440)"
                },
                accent: {
                  type: "string",
                  description: "\u0446\u0432\u0435\u0442\u043E\u0432\u043E\u0435 \u043D\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435 (HEX; \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 \u2014 \u0446\u0432\u0435\u0442 \u043F\u0440\u0435\u0441\u0435\u0442\u0430)"
                }
              },
              required: [
                "type",
                "text"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "postcard"
                },
                image: {
                  type: "string"
                },
                art: {
                  $ref: "#/$defs/ArtDoc"
                },
                text: {
                  type: "string",
                  description: "\u043F\u043E\u0434\u043F\u0438\u0441\u044C \u043F\u043E\u0434/\u043F\u043E\u0432\u0435\u0440\u0445 \u0438\u043B\u043B\u044E\u0441\u0442\u0440\u0430\u0446\u0438\u0438"
                },
                preset: {
                  type: "string",
                  enum: [
                    "\u0433\u043B\u0430\u0432\u0430",
                    "\u0448\u0451\u043F\u043E\u0442",
                    "\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A",
                    "\u043F\u0440\u043E\u043A\u043B\u044F\u0442\u044C\u0435",
                    "\u0437\u0430\u043F\u0438\u0441\u043E\u0447\u043D\u044B\u0439"
                  ]
                },
                seconds: {
                  type: "number",
                  description: "\u0441\u0435\u043A\u0443\u043D\u0434\u044B \u043F\u043E\u043A\u0430\u0437\u0430 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 6; 0 \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u043E \u0442\u0430\u043F\u0443)"
                },
                camera: {
                  $ref: "#/$defs/CameraDoc",
                  description: "\u043A\u0438\u043D\u0435\u043C\u0430\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043F\u0430\u043D-\u0437\u0443\u043C \u0444\u043E\u043D\u0430 (\u043A\u0430\u043A \u0443 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F \u0441\u0446\u0435\u043D\u044B)"
                }
              },
              required: [
                "type"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "grant_xp"
                },
                points: {
                  type: "number"
                }
              },
              required: [
                "type",
                "points"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "meta_currency"
                },
                id: {
                  type: "string"
                },
                amount: {
                  type: "number"
                }
              },
              required: [
                "type",
                "id",
                "amount"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "roll_event_table"
                },
                table: {
                  type: "string"
                },
                ignore_filters: {
                  type: "boolean"
                }
              },
              required: [
                "type",
                "table"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "generate_variables"
                },
                generator: {
                  type: "string"
                },
                seed: {
                  type: "string"
                },
                pack: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      key: {
                        type: "string"
                      },
                      as: {
                        type: "string"
                      }
                    },
                    required: [
                      "key"
                    ],
                    additionalProperties: false
                  }
                }
              },
              required: [
                "type",
                "generator",
                "pack"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "grant_feat"
                },
                id: {
                  type: "string"
                }
              },
              required: [
                "type",
                "id"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "join_party"
                },
                entity: {
                  type: "string"
                }
              },
              required: [
                "type",
                "entity"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "leave_party"
                },
                entity: {
                  type: "string"
                }
              },
              required: [
                "type",
                "entity"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "block_path"
                },
                from: {
                  type: "string"
                },
                to: {
                  type: "string"
                }
              },
              required: [
                "type",
                "from",
                "to"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "unblock_path"
                },
                from: {
                  type: "string"
                },
                to: {
                  type: "string"
                }
              },
              required: [
                "type",
                "from",
                "to"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "show_message"
                },
                text: {
                  type: "string"
                },
                portrait: {
                  type: "string"
                }
              },
              required: [
                "type",
                "text"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "reveal_location"
                },
                location: {
                  type: "string"
                }
              },
              required: [
                "type",
                "location"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "advance_time"
                },
                ticks: {
                  type: "number"
                }
              },
              required: [
                "type",
                "ticks"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "remove_entity"
                },
                entity: {
                  type: "string"
                }
              },
              required: [
                "type",
                "entity"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "spawn_entity"
                },
                entity: {
                  type: "string"
                },
                scene: {
                  type: "string"
                },
                slot: {
                  type: "string"
                }
              },
              required: [
                "type",
                "entity",
                "scene",
                "slot"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "set_description"
                },
                entity: {
                  type: "string"
                },
                text: {
                  type: "string"
                }
              },
              required: [
                "type",
                "entity",
                "text"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "game_over_victory"
                }
              },
              required: [
                "type"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "game_over_death"
                },
                reason: {
                  type: "string"
                }
              },
              required: [
                "type"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "play_cutscene"
                },
                cutscene: {
                  type: "string"
                }
              },
              required: [
                "type",
                "cutscene"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "play_sound"
                },
                sound: {
                  type: "string"
                },
                volume: {
                  type: "number"
                }
              },
              required: [
                "type",
                "sound"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "stop_sound"
                },
                sound: {
                  type: "string"
                }
              },
              required: [
                "type"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "override_music"
                },
                tracks: {
                  type: "array",
                  items: {
                    type: "string"
                  }
                },
                fade: {
                  type: "number"
                }
              },
              required: [
                "type",
                "tracks"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "clear_music_override"
                },
                fade: {
                  type: "number"
                }
              },
              required: [
                "type"
              ],
              additionalProperties: false
            }
          ]
        },
        StatusDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            short_label: {
              type: "string",
              description: "\u041A\u043E\u0440\u043E\u0442\u043A\u0430\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u044C \u0434\u043B\u044F \u043A\u043E\u043C\u043F\u0430\u043A\u0442\u043D\u043E\u0433\u043E \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0432 HUD"
            },
            description: {
              type: "string"
            },
            icon: {
              type: "string",
              description: "\u0438\u043A\u043E\u043D\u043A\u0430-\u0444\u0430\u0439\u043B/\u0441\u0441\u044B\u043B\u043A\u0430; \u043D\u0435\u0442 \u2014 \u0442\u0435\u043A\u0441\u0442\u043E\u0432\u044B\u0439 \u0447\u0438\u043F"
            },
            apply_sound: {
              type: "string",
              description: "\u0438\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u0437\u0432\u0443\u043A \u043F\u0440\u0438 \u043D\u0430\u043B\u043E\u0436\u0435\u043D\u0438\u0438 \u0441\u0442\u0430\u0442\u0443\u0441\u0430"
            },
            remove_sound: {
              type: "string",
              description: "\u0438\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u0437\u0432\u0443\u043A \u043F\u0440\u0438 \u0441\u043F\u0430\u0434\u0435/\u0441\u043D\u044F\u0442\u0438\u0438 \u0441\u0442\u0430\u0442\u0443\u0441\u0430"
            },
            scope: {
              type: "string",
              enum: [
                "world",
                "combat",
                "both"
              ],
              description: "\u043C\u0438\u0440 \u2014 \u0442\u0438\u043A\u0438, \u0431\u043E\u0439 \u2014 \u0440\u0430\u0443\u043D\u0434\u044B; 'both' \u2014 \u0438 \u0442\u0430\u043C \u0438 \u0442\u0430\u043C"
            },
            duration: {
              type: "number",
              description: "\u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E (\u043C\u0438\u0440\u043E\u0432\u044B\u0435 \u0442\u0438\u043A\u0438 / \u0431\u043E\u0435\u0432\u044B\u0435 \u0440\u0430\u0443\u043D\u0434\u044B)"
            },
            dot: {
              type: "object",
              properties: {
                hp: {
                  type: "number"
                },
                mp: {
                  type: "number"
                }
              },
              additionalProperties: false,
              description: "\u0443\u0440\u043E\u043D \u0437\u0430 \u0442\u0438\u043A (\u043C\u0438\u0440) / \u0437\u0430 \u0440\u0430\u0443\u043D\u0434 (\u0431\u043E\u0439)"
            },
            skill_mods: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  skill: {
                    type: "string"
                  },
                  delta: {
                    type: "number"
                  }
                },
                required: [
                  "skill",
                  "delta"
                ],
                additionalProperties: false
              },
              description: "\u043C\u043E\u0434\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u044B \u043D\u0430\u0432\u044B\u043A\u043E\u0432 \u043D\u0430 \u0432\u0440\u0435\u043C\u044F \u0441\u0442\u0430\u0442\u0443\u0441\u0430"
            },
            mov_mod: {
              type: "number",
              description: "\u0430\u0434\u0434\u0438\u0442\u0438\u0432 \u043A \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u044E (\u0438\u0442\u043E\u0433 \u043D\u0435 \u043D\u0438\u0436\u0435 1)"
            },
            on_apply: {
              type: "array",
              items: {
                $ref: "#/$defs/Effect"
              }
            },
            on_expire: {
              type: "array",
              items: {
                $ref: "#/$defs/Effect"
              }
            },
            apply_message: {
              type: "string"
            },
            expire_message: {
              type: "string"
            },
            disease: {
              type: "object",
              properties: {
                interval_ticks: {
                  type: "number",
                  description: "\u043F\u0435\u0440\u0438\u043E\u0434 \u0441\u043F\u0430\u0441\u0431\u0440\u043E\u0441\u043A\u043E\u0432 CON, \u043C\u0438\u0440\u043E\u0432\u044B\u0445 \u0442\u0438\u043A\u043E\u0432"
                },
                con_multiplier: {
                  type: "number",
                  description: "\u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C CON (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 5)"
                },
                severity_max: {
                  type: "number",
                  description: "\u043F\u0440\u0435\u0434\u0435\u043B \u0442\u044F\u0436\u0435\u0441\u0442\u0438 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 5)"
                }
              },
              required: [
                "interval_ticks"
              ],
              additionalProperties: false,
              description: "\u0411\u043E\u043B\u0435\u0437\u043D\u0438 \u0438 \u044F\u0434\u044B \u0441 \u0442\u0435\u0447\u0435\u043D\u0438\u0435\u043C (\u0430\u0443\u0434\u0438\u0442 B7): \u043A\u0430\u0436\u0434\u044B\u0435 interval_ticks \u043C\u0438\u0440\u043E\u0432\u044B\u0445\n\u0442\u0438\u043A\u043E\u0432 \u2014 \u0441\u043F\u0430\u0441\u0431\u0440\u043E\u0441\u043E\u043A CON \xD7 con_multiplier. \u0423\u0441\u043F\u0435\u0445 \u2014 \u0442\u044F\u0436\u0435\u0441\u0442\u044C \u22121 (0 \u2014\n\u0432\u044B\u0437\u0434\u043E\u0440\u043E\u0432\u043B\u0435\u043D\u0438\u0435), \u043F\u0440\u043E\u0432\u0430\u043B \u2014 +1 (\u043D\u0430\u0440\u0430\u0441\u0442\u0430\u0435\u0442 \u0434\u043E severity_max). \u0423\u0440\u043E\u043D \u043E\u0442\n\u0442\u0435\u0447\u0435\u043D\u0438\u044F \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u0438 \u043C\u043E\u0434\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u044B \u043D\u0430\u0432\u044B\u043A\u043E\u0432 \u0443\u043C\u043D\u043E\u0436\u0430\u044E\u0442\u0441\u044F \u043D\u0430 \u0442\u0435\u043A\u0443\u0449\u0443\u044E \u0442\u044F\u0436\u0435\u0441\u0442\u044C."
            }
          },
          required: [
            "id",
            "label",
            "scope",
            "duration"
          ],
          additionalProperties: false,
          description: "\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0438\u0437\u043C\u0435\u043D\u044F\u044E\u0449\u0435\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435: \u044F\u0434, \u043A\u0440\u043E\u0432\u043E\u0442\u0435\u0447\u0435\u043D\u0438\u0435, \u0431\u0430\u0444\u0444. \u0412 \u043C\u0438\u0440\u0435 \u0436\u0438\u0432\u0451\u0442 \u0432\n\u0442\u0438\u043A\u0430\u0445, \u0432 \u0431\u043E\u044E \u2014 \u0432 \u0440\u0430\u0443\u043D\u0434\u0430\u0445. \u0420\u0435\u0435\u0441\u0442\u0440 \u0441\u0442\u0430\u0442\u0443\u0441\u043E\u0432 \u2014 \u0432 `campaign.json` (meta.statuses)."
        },
        AbilityDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            description: {
              type: "string"
            },
            mp_cost: {
              type: "number"
            },
            cooldown_rounds: {
              type: "number",
              description: "\u043A\u0443\u043B\u0434\u0430\u0443\u043D \u0432 \u0440\u0430\u0443\u043D\u0434\u0430\u0445 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 0)"
            },
            range: {
              type: "number",
              description: "\u0434\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0432 \u0433\u0435\u043A\u0441\u0430\u0445 (1 = \u0432\u043F\u043B\u043E\u0442\u043D\u0443\u044E)"
            },
            skill: {
              type: "string",
              description: "\u043D\u0430\u0432\u044B\u043A \u043F\u043E\u043F\u0430\u0434\u0430\u043D\u0438\u044F; \u043D\u0435\u0442 \u2014 \u0433\u0430\u0440\u0430\u043D\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0435 \u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u0438\u0435"
            },
            kind: {
              type: "string",
              enum: [
                "damage",
                "status",
                "heal"
              ]
            },
            damage: {
              type: "string",
              description: "\u0434\u043B\u044F kind 'damage', \u043D\u0430\u043F\u0440. '1d6+2' (\u0431\u043E\u043D\u0443\u0441 \u0441\u0438\u043B\u044B \u041D\u0415 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F)"
            },
            status: {
              type: "string",
              description: "\u0434\u043B\u044F kind 'status'"
            },
            status_duration: {
              type: "number"
            },
            heal: {
              type: "string",
              description: "\u0434\u043B\u044F kind 'heal', \u043D\u0430\u043F\u0440. '1d6'"
            },
            prepare: {
              type: "boolean",
              description: "\u0422\u0440\u0435\u0431\u0443\u0435\u0442 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438 \u0432 \u0441\u043B\u043E\u0442 (\u0430\u0443\u0434\u0438\u0442 \xA75.6, \u043C\u0430\u0433\u0438\u044F): \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442, \u043A\u043E\u0433\u0434\u0430 \u0443 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438\n\u0437\u0430\u0434\u0430\u043D\u043E meta.magic.slots \u2014 \u0433\u0435\u0440\u043E\u0439 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442 \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C, \u0442\u043E\u043B\u044C\u043A\u043E \u0435\u0441\u043B\u0438 \u043E\u043D\u0430\n\u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u0430 \u0437\u0430\u0440\u0430\u043D\u0435\u0435 (\u0432 \u043B\u0438\u0441\u0442\u0435 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430, \u0432\u043D\u0435 \u0431\u043E\u044F). \u0411\u0435\u0437 \u0441\u043B\u043E\u0442\u043E\u0432 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u2014\n\u043F\u043E\u043B\u0435 \u043D\u0438 \u043D\u0430 \u0447\u0442\u043E \u043D\u0435 \u0432\u043B\u0438\u044F\u0435\u0442."
            },
            backlash_table: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  weight: {
                    type: "number"
                  },
                  text: {
                    type: "string",
                    description: "\u0441\u0442\u0440\u043E\u043A\u0430 \u0432 \u0436\u0443\u0440\u043D\u0430\u043B (\u043D\u0435\u0442 \u2014 \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u0430\u044F \xAB\u041D\u0430\u0440\u0443\u0448\u0435\u043D\u0438\u0435 \u0441\u0438\u043B\u044B\xBB)"
                  },
                  hp_delta: {
                    type: "number"
                  },
                  mp_delta: {
                    type: "number"
                  },
                  status: {
                    type: "string"
                  },
                  status_duration: {
                    type: "number"
                  }
                },
                required: [
                  "weight"
                ],
                additionalProperties: false
              },
              description: "\u041E\u0442\u043A\u0430\u0442 \u0441\u0438\u043B\u044B \u043F\u0440\u0438 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u043C \u043F\u0440\u043E\u0432\u0430\u043B\u0435 \u0431\u0440\u043E\u0441\u043A\u0430 \u043D\u0430\u0432\u044B\u043A\u0430 \u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u0438\u044F (\u043C\u0430\u0433\u0438\u0447\u0435\u0441\u043A\u0438\u0439\nbacklash, \u0430\u0443\u0434\u0438\u0442 \xA75.6): \u0431\u0440\u043E\u0441\u043E\u043A \u043F\u043E \u0432\u0435\u0441\u0430\u043C, \u0437\u0430\u043F\u0438\u0441\u044C \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u043D\u0430 \u0417\u0410\u041A\u041B\u0418\u041D\u0410\u0422\u0415\u041B\u042F.\nhp_delta/mp_delta \u2014 \u0437\u043D\u0430\u043A\u043E\u0432\u044B\u0435 (\u043C\u0438\u043D\u0443\u0441 \u2014 \u0443\u0440\u043E\u043D/\u043F\u043E\u0442\u0435\u0440\u044F), status \u2014 \u0438\u0437 \u0440\u0435\u0435\u0441\u0442\u0440\u0430.\n\u041D\u0435\u0442 \u0442\u0430\u0431\u043B\u0438\u0446\u044B \u2014 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043F\u0440\u043E\u0432\u0430\u043B \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u043F\u0440\u043E\u0441\u0442\u043E \u043F\u0440\u043E\u043C\u0430\u0445\u043E\u043C."
            }
          },
          required: [
            "id",
            "label",
            "mp_cost",
            "range",
            "kind"
          ],
          additionalProperties: false,
          description: "\u0421\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C \u0431\u043E\u0439\u0446\u0430: \u0442\u0440\u0430\u0442\u0438\u0442 MP, \u0438\u043C\u0435\u0435\u0442 \u043A\u0443\u043B\u0434\u0430\u0443\u043D, \u0431\u044C\u0451\u0442/\u043B\u0435\u0447\u0438\u0442/\u0432\u0435\u0448\u0430\u0435\u0442 \u0441\u0442\u0430\u0442\u0443\u0441.\n\u0420\u0435\u0435\u0441\u0442\u0440 \u2014 \u0432 `campaign.json` (meta.abilities); \u041D\u041F\u0421 \u043F\u043E\u043B\u0443\u0447\u0430\u044E\u0442 `abilities: [id\u2026]`."
        },
        DifficultyPreset: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            description: {
              type: "string",
              description: "\u0447\u0442\u043E \u044D\u0442\u043E \u0437\u043D\u0430\u0447\u0438\u0442 \u2014 \u0432\u0438\u0434\u043D\u043E \u0438\u0433\u0440\u043E\u043A\u0443 \u043F\u0440\u0438 \u0432\u044B\u0431\u043E\u0440\u0435"
            },
            enemy_damage: {
              type: "number",
              description: "\u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0443\u0440\u043E\u043D\u0430 \u0432\u0440\u0430\u0433\u043E\u0432 \u043F\u043E \u0433\u0435\u0440\u043E\u044E \u0432 \u0431\u043E\u044E (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 1; 0.5 \u2014 \u043C\u044F\u0433\u043A\u0438\u0439 \u0431\u043E\u0439, 1.5 \u2014 \u043B\u0438\u0445\u043E)"
            },
            need_decay: {
              type: "number",
              description: "\u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u0438 \u0443\u0431\u044B\u043B\u0438 \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0435\u0439 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 1)"
            },
            prices: {
              type: "number",
              description: "\u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0446\u0435\u043D \u043F\u0440\u0438 \u043F\u043E\u043A\u0443\u043F\u043A\u0435/\u043F\u0440\u043E\u0434\u0430\u0436\u0435 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 1; \u0443 \u0442\u043E\u0440\u0433\u043E\u0432\u0446\u0430 \u0434\u043E\u0440\u043E\u0436\u0435)"
            },
            no_autosave: {
              type: "boolean",
              description: "\u043D\u0430 \u044D\u0442\u043E\u043C \u0443\u0440\u043E\u0432\u043D\u0435 \u0430\u0432\u0442\u043E\u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u044B (\u043F\u0443\u0442\u044C \u0436\u0435\u043B\u0435\u0437\u043D\u043E\u0433\u043E \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0430)"
            }
          },
          required: [
            "id",
            "label"
          ],
          additionalProperties: false,
          description: "\u0423\u0440\u043E\u0432\u0435\u043D\u044C \u0441\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u0438, \u043A\u043E\u0442\u043E\u0440\u044B\u0439 \u043C\u0430\u0441\u0442\u0435\u0440 \u043F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u0435\u0442 \u0438\u0433\u0440\u043E\u043A\u0443 (meta.difficulties)."
        },
        SpeciesTemplate: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            description: {
              type: "string",
              description: "\u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0430 \u043C\u0430\u0441\u0442\u0435\u0440\u0443: \u0447\u0435\u043C \u044D\u0442\u043E\u0442 \u0432\u0438\u0434 \u043F\u0440\u0438\u043C\u0435\u0447\u0430\u0442\u0435\u043B\u0435\u043D"
            },
            stats: {
              type: "object",
              additionalProperties: {
                type: "number"
              }
            },
            skills: {
              type: "object",
              additionalProperties: {
                type: "number"
              }
            },
            armor: {
              type: "number",
              description: "\u0431\u0440\u043E\u043D\u044F \u0432 \u043E\u0447\u043A\u0430\u0445 (\u043D\u0435\u0442 \u2014 0)"
            },
            natural_weapon: {
              type: "object",
              properties: {
                skill: {
                  type: "string"
                },
                damage: {
                  type: "string"
                },
                label: {
                  type: "string"
                },
                damage_bonus: {
                  type: "boolean"
                },
                range: {
                  type: "number"
                },
                attacks_per_round: {
                  type: "number"
                },
                parry_capable: {
                  type: "boolean"
                }
              },
              required: [
                "skill",
                "damage"
              ],
              additionalProperties: false
            },
            abilities: {
              type: "array",
              items: {
                type: "string"
              },
              description: "id \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u0435\u0439 \u0438\u0437 \u0440\u0435\u0435\u0441\u0442\u0440\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438"
            },
            morale: {
              type: "object",
              properties: {
                below_hp_pct: {
                  type: "number"
                },
                flee_chance: {
                  type: "number"
                }
              },
              required: [
                "below_hp_pct",
                "flee_chance"
              ],
              additionalProperties: false
            },
            carry_capacity_bonus: {
              type: "number",
              description: "\u0420\u0430\u0441\u043E\u0432\u044B\u0439/\u0432\u0438\u0434\u043E\u0432\u043E\u0439 \u0431\u043E\u043D\u0443\u0441 \u043A \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0438\u043C\u043E\u043C\u0443 \u0432\u0435\u0441\u0443 (+\u043A\u0433)"
            },
            carry_capacity_mult: {
              type: "number",
              description: "\u0420\u0430\u0441\u043E\u0432\u044B\u0439/\u0432\u0438\u0434\u043E\u0432\u043E\u0439 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0438\u043C\u043E\u0433\u043E \u0432\u0435\u0441\u0430 (\u043D\u0430\u043F\u0440. 3.0 \u0434\u043B\u044F \u0432\u044C\u044E\u0447\u043D\u044B\u0445 \u0436\u0438\u0432\u043E\u0442\u043D\u044B\u0445 \u0438\u043B\u0438 \u043C\u0443\u0442\u0430\u043D\u0442\u043E\u0432)"
            }
          },
          required: [
            "id",
            "label"
          ],
          additionalProperties: false,
          description: "\u0428\u0430\u0431\u043B\u043E\u043D \u0432\u0438\u0434\u0430 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0430 (meta.species): \u0431\u043E\u0435\u0432\u043E\u0439 \u043A\u043E\u0441\u0442\u044F\u043A NPC \u043F\u043E \u043D\u0430\u0436\u0430\u0442\u0438\u044E\n\xAB\u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C \u0432\u0438\u0434\xBB \u0432 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0435 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430. \u0412\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0445 \u0432\u0438\u0434\u043E\u0432 \u0432 \u0434\u0432\u0438\u0436\u043A\u0435 \u043D\u0435\u0442 \u2014\n\u0432\u0438\u0434\u044B \u0437\u0430\u0434\u0430\u0451\u0442 \u043C\u0430\u0441\u0442\u0435\u0440 \u043F\u043E\u0434 \u0441\u0432\u043E\u044E \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u044E (\u043A\u043E\u043D\u0442\u0435\u043D\u0442, \u043D\u0435 \u043A\u043E\u0434)."
        },
        WeatherDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            overlay: {
              type: "string",
              description: "\u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u0441\u043B\u043E\u0439 \u043F\u043E\u0432\u0435\u0440\u0445 \u0441\u0446\u0435\u043D\u044B (\u0447\u0438\u0441\u0442\u044B\u0439 CSS), \u0437\u0430\u0434\u0430\u0451\u0442\u0441\u044F \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0435\u0439.\n\u0414\u0432\u0438\u0436\u043E\u043A \u0440\u0438\u0441\u0443\u0435\u0442 \u043A\u043B\u0430\u0441\u0441 `weather-<overlay>`; \u0432\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0435 \u0441\u043B\u043E\u0438 \u0434\u0432\u0438\u0436\u043A\u0430:\n`rain`, `snow`, `fog`, `ash`. \u041D\u0435\u0442/'none' \u2014 \u0431\u0435\u0437 \u0441\u043B\u043E\u044F. \u0412\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0445\n\xAB\u043F\u043E\u0433\u043E\u0434 \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E\xBB \u043D\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442 \u2014 \u0440\u0435\u0435\u0441\u0442\u0440 \u0446\u0435\u043B\u0438\u043A\u043E\u043C \u0441\u043E\u0437\u0434\u0430\u0451\u0442 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u044F."
            },
            ambient: {
              type: "array",
              items: {
                type: "string"
              },
              description: "\u0437\u0430\u0446\u0438\u043A\u043B\u0435\u043D\u043D\u044B\u0435 \u0437\u0432\u0443\u043A\u0438 (id \u0438\u0437 \u0440\u0435\u0435\u0441\u0442\u0440\u0430 \u0437\u0432\u0443\u043A\u043E\u0432) \u2014 \u0441\u043B\u043E\u0438 \u043A \u044D\u043C\u0431\u0438\u0435\u043D\u0442\u0443"
            },
            combat: {
              type: "object",
              properties: {
                skill_mods: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      skill: {
                        type: "string"
                      },
                      delta: {
                        type: "number"
                      }
                    },
                    required: [
                      "skill",
                      "delta"
                    ],
                    additionalProperties: false
                  }
                },
                mov_penalty: {
                  type: "number",
                  description: "\u0430\u0434\u0434\u0438\u0442\u0438\u0432 \u043A \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u044E \u0432\u0441\u0435\u0445 \u0431\u043E\u0439\u0446\u043E\u0432, \u0438\u0442\u043E\u0433 \u2265 1"
                },
                range_penalty: {
                  type: "number",
                  description: "\u0441\u0440\u0435\u0437\u0430\u043D\u0438\u0435 \u0434\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u0438 \u043E\u0440\u0443\u0436\u0438\u044F (\u0434\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u2265 1)"
                },
                status: {
                  type: "string",
                  description: "\u0441\u0442\u0430\u0442\u0443\u0441, \u043D\u0430\u043A\u043B\u0430\u0434\u044B\u0432\u0430\u0435\u043C\u044B\u0439 \u0432\u0441\u0435\u043C \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
                }
              },
              additionalProperties: false,
              description: "\u0412\u043B\u0438\u044F\u043D\u0438\u0435 \u043F\u043E\u0433\u043E\u0434\u044B \u043D\u0430 \u0431\u043E\u0439 (\u0430\u0443\u0434\u0438\u0442 B7): \u0441\u0434\u0432\u0438\u0433 \u043D\u0430\u0432\u044B\u043A\u043E\u0432 (\u043C\u0435\u0442\u0435\u043B\u044C \u2212\u0441\u0442\u0440\u0435\u043B\u044C\u0431\u0435),\n\u0448\u0442\u0440\u0430\u0444 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u044F, \u0443\u0440\u0435\u0437\u0430\u043D\u0438\u0435 \u0434\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u0438 \u043E\u0440\u0443\u0436\u0438\u044F (\u0442\u0443\u043C\u0430\u043D), \u0441\u0442\u0430\u0442\u0443\u0441 \u0432\u0441\u0435\u043C\n\u0431\u043E\u0439\u0446\u0430\u043C \u043F\u0440\u0438 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F \u0432 \u044D\u0442\u0443 \u043F\u043E\u0433\u043E\u0434\u0443. \u0414\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u043D\u0430 \u043E\u0431\u0435 \u0441\u0442\u043E\u0440\u043E\u043D\u044B."
            }
          },
          required: [
            "id",
            "label"
          ],
          additionalProperties: false
        },
        ParticleEffectDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            sprite: {
              type: "string",
              description: "PNG/WEBP \u0441 \u0430\u043B\u044C\u0444\u043E\u0439 (\u0447\u0430\u0441\u0442\u0438\u0446\u0430 \u043B\u044E\u0431\u043E\u0439 \u0444\u043E\u0440\u043C\u044B); \u043F\u0443\u0441\u0442\u043E \u2014 \u0442\u043E\u0447\u043A\u0430-\u0433\u0440\u0430\u0434\u0438\u0435\u043D\u0442"
            },
            count: {
              type: "number",
              description: "\u0448\u0442\u0443\u043A \u043D\u0430 \u044D\u043A\u0440\u0430\u043D (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 60)"
            },
            size_min: {
              type: "number"
            },
            size_max: {
              type: "number"
            },
            vy_min: {
              type: "number",
              description: "\u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u043F\u043E \u0432\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u0438, px/\u0441; \u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u2014 \u0432\u043D\u0438\u0437 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 40\u202680)"
            },
            vy_max: {
              type: "number"
            },
            vx_min: {
              type: "number",
              description: "\u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u043F\u043E \u0433\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u0430\u043B\u0438, px/\u0441 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 -5\u20265)"
            },
            vx_max: {
              type: "number"
            },
            spin: {
              type: "number",
              description: "\u0432\u0440\u0430\u0449\u0435\u043D\u0438\u0435, \u0433\u0440\u0430\u0434/\u0441 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 0)"
            },
            opacity: {
              type: "number",
              description: "\u043D\u0435\u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u043E\u0441\u0442\u044C 0..1 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 0.8)"
            },
            blur: {
              type: "number",
              description: "\u0440\u0430\u0437\u043C\u044B\u0442\u0438\u0435, px (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 0; \u0434\u043B\u044F \u0442\u0443\u043C\u0430\u043D\u0430)"
            },
            blend: {
              type: "string",
              enum: [
                "normal",
                "screen"
              ]
            },
            loop: {
              type: "boolean"
            },
            color_inner: {
              type: "string",
              description: "\u0446\u0432\u0435\u0442 \u0446\u0435\u043D\u0442\u0440\u0430 \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u043D\u043E\u0439 \u0447\u0430\u0441\u0442\u0438\u0446\u044B (rgba/hex, \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u0431\u0435\u043B\u043E\u0435/\u0437\u043E\u043B\u043E\u0442\u043E\u0435 \u0441\u0432\u0435\u0447\u0435\u043D\u0438\u0435)"
            },
            color_outer: {
              type: "string",
              description: "\u0446\u0432\u0435\u0442 \u0432\u043D\u0435\u0448\u043D\u0435\u0433\u043E \u043E\u0440\u0435\u043E\u043B\u0430 \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u043D\u043E\u0439 \u0447\u0430\u0441\u0442\u0438\u0446\u044B"
            }
          },
          required: [
            "id",
            "label"
          ],
          additionalProperties: false,
          description: "\u0434\u0435\u043A\u043B\u0430\u0440\u0430\u0442\u0438\u0432\u043D\u044B\u0439 \u0441\u043B\u043E\u0439 \u0430\u0442\u043C\u043E\u0441\u0444\u0435\u0440\u044B (\xAB\u043C\u0430\u0441\u0442\u0435\u0440\u0441\u043A\u0430\u044F \u0441\u043F\u0435\u0446\u044D\u0444\u0444\u0435\u043A\u0442\u043E\u0432\xBB): \u043B\u0435\u0442\u044F\u0449\u0438\u0435 \u0447\u0430\u0441\u0442\u0438\u0446\u044B \u0438\u0437\n\u0444\u0430\u0439\u043B\u0430-\u0441\u043F\u0440\u0430\u0439\u0442\u0430 \u0441 \u043F\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u0435\u043C. WeatherDef.overlay = id \u044D\u0444\u0444\u0435\u043A\u0442\u0430 (\u0432\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0435\nrain/snow/fog/ash \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u044E\u0442 \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C)."
        },
        EncumbranceRules: {
          type: "object",
          properties: {
            enabled: {
              type: "boolean",
              description: "\u0412\u043A\u043B\u044E\u0447\u0435\u043D\u0430 \u043B\u0438 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0437\u0430 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E true)"
            },
            formula: {
              type: "string",
              enum: [
                "str_siz",
                "str_siz_sum",
                "str_con",
                "str_only",
                "str_x2",
                "siz_x2",
                "str_plus_half_siz",
                "fixed"
              ],
              description: "\u0424\u043E\u0440\u043C\u0443\u043B\u0430 \u0431\u0430\u0437\u043E\u0432\u043E\u0439 \u0433\u0440\u0443\u0437\u043E\u043F\u043E\u0434\u044A\u0451\u043C\u043D\u043E\u0441\u0442\u0438:\n'str_siz' | 'str_siz_sum' \u2014 \u043A\u043B\u0430\u0441\u0441\u0438\u043A\u0430 BRP (STR + SIZ \u0432 \u043A\u0433), \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E\n'str_con' \u2014 \u0441\u0438\u043B\u0430 + \u0442\u0435\u043B\u043E\u0441\u043B\u043E\u0436\u0435\u043D\u0438\u0435 (STR + CON \u0432 \u043A\u0433)\n'str_only' | 'str_x2' \u2014 \u0447\u0438\u0441\u0442\u0430\u044F \u0441\u0438\u043B\u0430 (STR * 2 \u0432 \u043A\u0433)\n'siz_x2' \u2014 \u0447\u0438\u0441\u0442\u044B\u0435 \u0433\u0430\u0431\u0430\u0440\u0438\u0442\u044B (SIZ * 2 \u0432 \u043A\u0433)\n'str_plus_half_siz' \u2014 STR + (SIZ / 2) \u0432 \u043A\u0433\n'fixed' \u2014 \u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0438\u0437 base_capacity"
            },
            base_capacity: {
              type: "number",
              description: "\u0424\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u0430\u044F \u0431\u0430\u0437\u043E\u0432\u0430\u044F \u0432\u043C\u0435\u0441\u0442\u0438\u043C\u043E\u0441\u0442\u044C \u0432 \u043A\u0433 (\u043F\u0440\u0438 formula === 'fixed', \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 25)"
            },
            capacity_multiplier: {
              type: "number",
              description: "\u0413\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u044B\u0439 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0433\u0440\u0443\u0437\u043E\u043F\u043E\u0434\u044A\u0451\u043C\u043D\u043E\u0441\u0442\u0438 \u043C\u0438\u0440\u0430 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 1.0)"
            },
            travel_penalty: {
              type: "boolean",
              description: "\u0412\u043B\u0438\u044F\u0435\u0442 \u043B\u0438 \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0437 \u043D\u0430 \u0432\u0440\u0435\u043C\u044F \u043F\u0443\u0442\u0435\u0448\u0435\u0441\u0442\u0432\u0438\u0439 \u043C\u0435\u0436\u0434\u0443 \u043B\u043E\u043A\u0430\u0446\u0438\u044F\u043C\u0438 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E true)"
            },
            light_travel_multiplier: {
              type: "number",
              description: "\u041C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u043F\u0440\u0438 \u043B\u0451\u0433\u043A\u043E\u043C \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0437\u0435 (>1.0x, \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 1.5)"
            },
            heavy_travel_multiplier: {
              type: "number",
              description: "\u041C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u043F\u0440\u0438 \u0442\u044F\u0436\u0451\u043B\u043E\u043C \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0437\u0435 (>1.5x, \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 2.0)"
            },
            critical_threshold: {
              type: "number",
              description: "\u041F\u043E\u0440\u043E\u0433 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0437\u0430, \u0431\u043B\u043E\u043A\u0438\u0440\u0443\u044E\u0449\u0435\u0433\u043E \u043F\u0435\u0440\u0435\u043C\u0435\u0449\u0435\u043D\u0438\u0435 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 2.0x, 0 = \u043D\u0435 \u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u0442\u044C)"
            },
            light_dodge_penalty: {
              type: "number",
              description: "\u0428\u0442\u0440\u0430\u0444 \u043A \u0443\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u044E \u0432 \u0431\u043E\u044E \u043F\u0440\u0438 \u043B\u0451\u0433\u043A\u043E\u043C \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0437\u0435 (%, \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 10)"
            },
            light_mov_penalty: {
              type: "number",
              description: "\u0428\u0442\u0440\u0430\u0444 \u043A \u043F\u0435\u0440\u0435\u043C\u0435\u0449\u0435\u043D\u0438\u044E \u0432 \u0431\u043E\u044E \u043F\u0440\u0438 \u043B\u0451\u0433\u043A\u043E\u043C \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0437\u0435 (MOV, \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 1)"
            },
            light_agility_skills_penalty: {
              type: "number",
              description: "\u0428\u0442\u0440\u0430\u0444 \u043A \u043B\u043E\u0432\u043A\u043E\u0441\u0442\u043D\u044B\u043C \u043D\u0430\u0432\u044B\u043A\u0430\u043C \u043F\u0440\u0438 \u043B\u0451\u0433\u043A\u043E\u043C \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0437\u0435 (%, \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 10)"
            },
            heavy_dodge_penalty: {
              type: "number",
              description: "\u0428\u0442\u0440\u0430\u0444 \u043A \u0443\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u044E \u0432 \u0431\u043E\u044E \u043F\u0440\u0438 \u0442\u044F\u0436\u0451\u043B\u043E\u043C \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0437\u0435 (%, \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 25)"
            },
            heavy_mov_penalty: {
              type: "number",
              description: "\u0428\u0442\u0440\u0430\u0444 \u043A \u043F\u0435\u0440\u0435\u043C\u0435\u0449\u0435\u043D\u0438\u044E \u0432 \u0431\u043E\u044E \u043F\u0440\u0438 \u0442\u044F\u0436\u0451\u043B\u043E\u043C \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0437\u0435 (MOV, \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 2)"
            },
            heavy_agility_skills_penalty: {
              type: "number",
              description: "\u0428\u0442\u0440\u0430\u0444 \u043A \u043B\u043E\u0432\u043A\u043E\u0441\u0442\u043D\u044B\u043C \u043D\u0430\u0432\u044B\u043A\u0430\u043C \u043F\u0440\u0438 \u0442\u044F\u0436\u0451\u043B\u043E\u043C \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0437\u0435 (%, \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 25)"
            },
            critical_dodge_penalty: {
              type: "number",
              description: "\u0428\u0442\u0440\u0430\u0444 \u043A \u0443\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u044E \u0432 \u0431\u043E\u044E \u043F\u0440\u0438 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u043C \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0437\u0435 (%, \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 50)"
            },
            critical_mov_penalty: {
              type: "number",
              description: "\u0428\u0442\u0440\u0430\u0444 \u043A \u043F\u0435\u0440\u0435\u043C\u0435\u0449\u0435\u043D\u0438\u044E \u0432 \u0431\u043E\u044E \u043F\u0440\u0438 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u043C \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0437\u0435 (MOV, \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 3)"
            },
            critical_agility_skills_penalty: {
              type: "number",
              description: "\u0428\u0442\u0440\u0430\u0444 \u043A \u043B\u043E\u0432\u043A\u043E\u0441\u0442\u043D\u044B\u043C \u043D\u0430\u0432\u044B\u043A\u0430\u043C \u043F\u0440\u0438 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u043C \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0437\u0435 (%, \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 50)"
            }
          },
          additionalProperties: false
        },
        Condition: {
          anyOf: [
            {
              type: "object",
              properties: {
                type: {
                  const: "player_enters_location"
                },
                location: {
                  type: "string"
                }
              },
              required: [
                "type",
                "location"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "player_enters_scene"
                },
                scene: {
                  type: "string"
                }
              },
              required: [
                "type",
                "scene"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "flag_set"
                },
                flag: {
                  type: "string"
                }
              },
              required: [
                "type",
                "flag"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "flag_not_set"
                },
                flag: {
                  type: "string"
                }
              },
              required: [
                "type",
                "flag"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "variable_compare"
                },
                var: {
                  type: "string"
                },
                operator: {
                  type: "string",
                  enum: [
                    "==",
                    "!=",
                    "<",
                    ">",
                    "<=",
                    ">="
                  ]
                },
                value: {
                  anyOf: [
                    {
                      type: "number"
                    },
                    {
                      type: "string"
                    }
                  ]
                }
              },
              required: [
                "type",
                "var",
                "operator",
                "value"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "time_of_day"
                },
                value: {
                  anyOf: [
                    {
                      $ref: "#/$defs/TimeOfDay"
                    },
                    {
                      type: "array",
                      items: {
                        $ref: "#/$defs/TimeOfDay"
                      }
                    }
                  ]
                }
              },
              required: [
                "type",
                "value"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "tick_elapsed"
                },
                min_tick: {
                  type: "number"
                }
              },
              required: [
                "type",
                "min_tick"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "elapsed_ge"
                },
                min: {
                  type: "number"
                }
              },
              required: [
                "type",
                "min"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "quest_at_stage"
                },
                quest: {
                  type: "string"
                },
                stage: {
                  type: "string"
                }
              },
              required: [
                "type",
                "quest",
                "stage"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "has_item"
                },
                item: {
                  type: "string"
                },
                min_quantity: {
                  type: "number"
                }
              },
              required: [
                "type",
                "item"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "equipped"
                },
                item: {
                  type: "string"
                }
              },
              required: [
                "type",
                "item"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "skill_ge"
                },
                skill: {
                  type: "string"
                },
                threshold: {
                  type: "number"
                }
              },
              required: [
                "type",
                "skill",
                "threshold"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "stat_ge"
                },
                stat: {
                  type: "string"
                },
                threshold: {
                  type: "number"
                }
              },
              required: [
                "type",
                "stat",
                "threshold"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "hp_le"
                },
                threshold: {
                  type: "number"
                }
              },
              required: [
                "type",
                "threshold"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "hp_ge"
                },
                threshold: {
                  type: "number"
                }
              },
              required: [
                "type",
                "threshold"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "luck_ge"
                },
                threshold: {
                  type: "number"
                }
              },
              required: [
                "type",
                "threshold"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "fatigue_ge"
                },
                threshold: {
                  type: "number"
                }
              },
              required: [
                "type",
                "threshold"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "fatigue_le"
                },
                threshold: {
                  type: "number"
                }
              },
              required: [
                "type",
                "threshold"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "sanity_ge"
                },
                threshold: {
                  type: "number"
                }
              },
              required: [
                "type",
                "threshold"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "sanity_le"
                },
                threshold: {
                  type: "number"
                }
              },
              required: [
                "type",
                "threshold"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "reputation_ge"
                },
                threshold: {
                  type: "number"
                }
              },
              required: [
                "type",
                "threshold"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "wealth_ge"
                },
                level: {
                  type: "number"
                }
              },
              required: [
                "type",
                "level"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "crime_committed"
                },
                id: {
                  type: "string"
                },
                min_bounty: {
                  type: "number"
                }
              },
              required: [
                "type"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "bounty_total_ge"
                },
                threshold: {
                  type: "number"
                }
              },
              required: [
                "type",
                "threshold"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "level_ge"
                },
                level: {
                  type: "number"
                }
              },
              required: [
                "type",
                "level"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "meta_currency_ge"
                },
                currency: {
                  type: "string"
                },
                threshold: {
                  type: "number"
                }
              },
              required: [
                "type",
                "currency",
                "threshold"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "meta_achievement"
                },
                id: {
                  type: "string"
                }
              },
              required: [
                "type",
                "id"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "meta_counter"
                },
                key: {
                  type: "string"
                },
                ge: {
                  type: "number"
                }
              },
              required: [
                "type",
                "key",
                "ge"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "has_feat"
                },
                id: {
                  type: "string"
                }
              },
              required: [
                "type",
                "id"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "passion_ge"
                },
                id: {
                  type: "string"
                },
                value: {
                  type: "number"
                }
              },
              required: [
                "type",
                "id",
                "value"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "allegiance_ge"
                },
                id: {
                  type: "string"
                },
                points: {
                  type: "number"
                }
              },
              required: [
                "type",
                "id",
                "points"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "power_level_ge"
                },
                level: {
                  type: "string",
                  enum: [
                    "normal",
                    "heroic",
                    "epic",
                    "superhuman"
                  ]
                }
              },
              required: [
                "type",
                "level"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "need_le"
                },
                need: {
                  type: "string"
                },
                threshold: {
                  type: "number"
                }
              },
              required: [
                "type",
                "need",
                "threshold"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "need_ge"
                },
                need: {
                  type: "string"
                },
                threshold: {
                  type: "number"
                }
              },
              required: [
                "type",
                "need",
                "threshold"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "entity_alive"
                },
                entity: {
                  type: "string"
                }
              },
              required: [
                "type",
                "entity"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "entity_dead"
                },
                entity: {
                  type: "string"
                }
              },
              required: [
                "type",
                "entity"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "disposition_ge"
                },
                target: {
                  type: "string"
                },
                threshold: {
                  type: "number"
                }
              },
              required: [
                "type",
                "target",
                "threshold"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "disposition_le"
                },
                target: {
                  type: "string"
                },
                threshold: {
                  type: "number"
                }
              },
              required: [
                "type",
                "target",
                "threshold"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "in_party"
                },
                entity: {
                  type: "string"
                }
              },
              required: [
                "type",
                "entity"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "companion_need_le"
                },
                entity: {
                  type: "string"
                },
                need: {
                  type: "string"
                },
                threshold: {
                  type: "number"
                }
              },
              required: [
                "type",
                "entity",
                "need",
                "threshold"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "companion_need_ge"
                },
                entity: {
                  type: "string"
                },
                need: {
                  type: "string"
                },
                threshold: {
                  type: "number"
                }
              },
              required: [
                "type",
                "entity",
                "need",
                "threshold"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "random_chance"
                },
                probability: {
                  type: "number"
                }
              },
              required: [
                "type",
                "probability"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "has_status"
                },
                status: {
                  type: "string"
                }
              },
              required: [
                "type",
                "status"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "weather_is"
                },
                weather: {
                  type: "string"
                }
              },
              required: [
                "type",
                "weather"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "npc_known"
                },
                entity: {
                  type: "string"
                },
                known: {
                  type: "boolean"
                }
              },
              required: [
                "type",
                "entity"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "and"
                },
                conditions: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/Condition"
                  }
                }
              },
              required: [
                "type",
                "conditions"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "or"
                },
                conditions: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/Condition"
                  }
                }
              },
              required: [
                "type",
                "conditions"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "not"
                },
                condition: {
                  $ref: "#/$defs/Condition"
                }
              },
              required: [
                "type",
                "condition"
              ],
              additionalProperties: false
            }
          ]
        },
        DurationActionDef: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "\u0423\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0439 id \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F (\u043D\u0430 \u043D\u0435\u0433\u043E \u0441\u0441\u044B\u043B\u0430\u0435\u0442\u0441\u044F \u044D\u0444\u0444\u0435\u043A\u0442 start_duration_action)."
            },
            label: {
              type: "string",
              description: "\u0418\u043C\u044F \u0434\u043B\u044F \u043E\u043A\u043D\u0430 \u0432\u044B\u0431\u043E\u0440\u0430 \u0438 \u0436\u0443\u0440\u043D\u0430\u043B\u0430 (\xAB\u041D\u043E\u0447\u043D\u043E\u0439 \u0441\u043E\u043D\xBB, \xAB\u041C\u0435\u0434\u0438\u0442\u0430\u0446\u0438\u044F\xBB)."
            },
            min_ticks: {
              type: "number",
              description: "\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0432 \u0442\u0438\u043A\u0430\u0445 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 1, \u043C\u0438\u043D\u0438\u043C\u0443\u043C 1)."
            },
            max_ticks: {
              type: "number",
              description: "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0432 \u0442\u0438\u043A\u0430\u0445 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E = min_ticks \u2014 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0439 \u0434\u043B\u0438\u043D\u044B)."
            },
            step: {
              type: "number",
              description: "\u0428\u0430\u0433 \u0432\u044B\u0431\u043E\u0440\u0430 \u0434\u043B\u0438\u043D\u044B \u0432 \u043E\u043A\u043D\u0435 \u0432\u044B\u0431\u043E\u0440\u0430 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 1: \u0432\u044B\u0431\u0440\u0430\u0442\u044C 3, 4, 5\u2026 \u0447\u0430\u0441\u043E\u0432)."
            },
            per_tick: {
              type: "array",
              items: {
                $ref: "#/$defs/Effect"
              },
              description: "\u041F\u043E\u0447\u0430\u0441\u043E\u0432\u044B\u0435 \u044D\u0444\u0444\u0435\u043A\u0442\u044B \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F: \u043A\u0430\u0436\u0434\u044B\u0439 \u0442\u0438\u043A \u0414\u041E \u0442\u0438\u043A\u0430\u043D\u0438\u044F \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0435\u0439.\n\u0411\u0435\u043B\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A (\u043F\u0440\u043E\u0447\u0435\u0435 \u0434\u0432\u0438\u0436\u043E\u043A \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u0442, audit \u0440\u0443\u0433\u0430\u0435\u0442\u0441\u044F):\n  change_need \u2014 +\u0434\u0435\u043B\u044C\u0442\u0430 \u043E\u0431\u0449\u0435\u0433\u043E \u0441\u0442\u043E\u043B\u0430 / \u2212\u043B\u0438\u0447\u043D\u0430\u044F \u0434\u0435\u0433\u0440\u0430\u0434\u0430\u0446\u0438\u044F;\n  change_hp / change_fatigue / change_sanity \u2014 \u043B\u0438\u0447\u043D\u044B\u0435 \u0447\u0438\u0441\u043B\u0430.\n\u0426\u0435\u043B\u044B\u0435 \u0434\u0435\u043B\u044C\u0442\u044B \u0432 \u0441\u043F\u0438\u0441\u043A\u0435 \u0441\u0445\u0435\u043C\u044B \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435/\u043E\u0442\u0440\u0438\u0446\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0446\u0435\u043B\u044B\u0435."
            },
            interrupt_chance_per_tick: {
              type: "number",
              description: "\u0428\u0430\u043D\u0441 \u043F\u0440\u0435\u0440\u044B\u0432\u0430\u043D\u0438\u044F \u0437\u0430 \u043E\u0434\u0438\u043D \u0442\u0438\u043A (0..1). \u0421\u0440\u0430\u0432\u043D\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u043F\u0440\u043E\u0436\u0438\u0442\u043E\u0433\u043E \u0447\u0430\u0441\u0430."
            },
            interrupt_rule: {
              type: "string",
              description: "\u041F\u0440\u0430\u0432\u0438\u043B\u043E, \u0441\u0442\u0440\u0435\u043B\u044F\u044E\u0449\u0435\u0435 \u043F\u0440\u0438 \u043F\u0440\u0435\u0440\u044B\u0432\u0430\u043D\u0438\u0438 (\u043D\u0430\u0431\u0435\u0433, \u043A\u043E\u0448\u043C\u0430\u0440, \u0441\u0442\u0440\u0430\u0436\u043D\u0438\u043A \u043F\u043E\u0442\u0440\u0435\u0432\u043E\u0436\u0438\u043B). \u041F\u043E\u0441\u043B\u0435 \u043F\u0440\u0430\u0432\u0438\u043B\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0430\u0435\u0442\u0441\u044F \u2014 \u0432\u0435\u0440\u043D\u0443\u0432\u0448\u0438\u0439\u0441\u044F \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436 \xAB\u043D\u0435 \u043F\u0440\u043E\u0441\u043D\u0443\u043B\u0441\u044F\xBB, \u0430 \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u043B\u0441\u044F."
            },
            break_when: {
              type: "array",
              items: {
                $ref: "#/$defs/Condition"
              },
              description: "\u0423\u0441\u043B\u043E\u0432\u0438\u044F-\u0441\u0442\u0430\u043D\u043D\u044B\u0435 \xAB\u0445\u0432\u0430\u0442\u0438\u0442\xBB: \u043F\u043E\u0441\u043B\u0435 \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u0442\u0438\u043A\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u044E\u0442\u0441\u044F; \u0435\u0441\u043B\u0438 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u043E \u0438\u0441\u0442\u0438\u043D\u043D\u043E \u2014 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0430\u0435\u0442\u0441\u044F \u043A\u0430\u043A \u043F\u0440\u0435\u0440\u044B\u0432\u0430\u043D\u0438\u0435 (\u0441 \u043F\u0440\u0430\u0432\u0438\u043B\u043E\u043C interrupt_rule, \u0435\u0441\u043B\u0438 \u0437\u0430\u0434\u0430\u043D). \u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u0431\u0443\u0434\u0438\u0442\u044C, \u043A\u043E\u0433\u0434\u0430 need_energy >= 100."
            },
            on_finish: {
              type: "array",
              items: {
                $ref: "#/$defs/Effect"
              },
              description: "\u042D\u0444\u0444\u0435\u043A\u0442\u044B \u041D\u041E\u0420\u041C\u0410\u041B\u042C\u041D\u041E\u0413\u041E \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F (\u0434\u043E\u0441\u043F\u0430\u043B): \u0441\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u044E\u0442 \u043E\u0434\u0438\u043D \u0440\u0430\u0437, \u0442\u043E\u043B\u044C\u043A\u043E \u0435\u0441\u043B\u0438 \u0446\u0438\u043A\u043B \u0434\u043E\u0448\u0451\u043B \u0434\u043E \u043A\u043E\u043D\u0446\u0430 \u0431\u0435\u0437 \u043F\u0440\u0435\u0440\u044B\u0432\u0430\u043D\u0438\u044F/\u0441\u043C\u0435\u0440\u0442\u0438."
            },
            available_when: {
              type: "array",
              items: {
                $ref: "#/$defs/Condition"
              },
              description: "\u0415\u0441\u043B\u0438 \u0437\u0430\u0434\u0430\u043D\u044B, \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u0438 \u0438\u0441\u0442\u0438\u043D\u043D\u043E\u0441\u0442\u0438 \u0432\u0441\u0435\u0445 \u0443\u0441\u043B\u043E\u0432\u0438\u0439 (\u0434\u0435\u043D\u044C/\u043D\u043E\u0447\u044C, \u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u0430\u044F, \u043D\u0443\u0436\u043D\u0430 \u0441\u043A\u0430\u043C\u0435\u0439\u043A\u0430 \u0432 \u043B\u043E\u043A\u0430\u0446\u0438\u0438 \u0438 \u0442.\u043F.)."
            }
          },
          required: [
            "id",
            "label"
          ],
          additionalProperties: false,
          description: "\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 (dz.20): \u0441\u043E\u043D \u043D\u0430 N \u0447\u0430\u0441\u043E\u0432, \u043C\u0435\u0434\u0438\u0442\u0430\u0446\u0438\u044F, \u0434\u0435\u0436\u0443\u0440\u0441\u0442\u0432\u043E, \u0447\u0442\u0435\u043D\u0438\u0435 \u2014\n\u043B\u044E\u0431\u043E\u0435 \u0437\u0430\u043D\u044F\u0442\u0438\u0435, \u043A\u043E\u0442\u043E\u0440\u043E\u0435 \u0441\u0442\u043E\u0438\u0442 \u0447\u0430\u0441\u044B \u0438\u0433\u0440\u043E\u0432\u043E\u0433\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u0431\u0435\u0437 \u0440\u0430\u0437\u0431\u0438\u0432\u043A\u0438 \u043F\u043E \u0442\u0438\u043A\u0430\u043C-\u0448\u0430\u0433\u0430\u043C.\n\n\u0411\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u044C intentionally BRP-\u0434\u0430\u0440\u0451\u043D\u0430\u044F:\n\u2014 \u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u0438\u0435 per_tick \u0438\u0434\u0451\u0442 \u041F\u041E\u0427\u0410\u0421\u041E\u0412\u041E (\u0432\u043D\u0443\u0442\u0440\u0438 \u0446\u0438\u043A\u043B\u0430 advanceTicks(1)), \u043F\u043E\u044D\u0442\u043E\u043C\u0443\n  \u043F\u0440\u0435\u0440\u0432\u0430\u0432\u0448\u0438\u0439\u0441\u044F \u0441\u043E\u043D \u0434\u0430\u043B \u0441\u0442\u043E\u043B\u044C\u043A\u043E \u043F\u043E\u043B\u044C\u0437\u044B, \u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0447\u0430\u0441\u043E\u0432 \u043F\u0440\u043E\u0441\u043F\u0430\u043B\u0438;\n\u2014 \u0441\u043C\u0435\u0440\u0442\u044C/\u043A\u043E\u043D\u0435\u0446 \u0438\u0433\u0440\u044B \u043F\u043E\u0441\u0440\u0435\u0434\u0438 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u043E\u0431\u0440\u044B\u0432\u0430\u044E\u0442 \u0446\u0438\u043A\u043B (on_zero_effect \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0435\u0439\n  \u0441\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u0442 \u0447\u0435\u0441\u0442\u043D\u043E, \xAB\u0443\u0431\u0438\u0442\u044C \u0432\u043E \u0441\u043D\u0435\xBB \u2014 \u0434\u0435\u043B\u043E \u043F\u0440\u0430\u0432\u0438\u043B \u043C\u0430\u0441\u0442\u0435\u0440\u0430);\n\u2014 \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u044C \u043F\u0440\u0435\u0440\u044B\u0432\u0430\u043D\u0438\u044F \u0447\u0435\u0441\u0442\u043D\u0430\u044F: interrupt_chance_per_tick \u2014 \u0448\u0430\u043D\u0441 \u0437\u0430 \u041E\u0414\u0418\u041D \u0442\u0438\u043A;\n  \u0448\u0430\u043D\u0441 \xAB\u0445\u043E\u0442\u044F \u0431\u044B \u0440\u0430\u0437 \u0437\u0430 n \u0442\u0438\u043A\u043E\u0432\xBB = 1 \u2212 (1\u2212p)\u207F (\u0434\u043B\u044F p=0.05 \u0438 n=8 \u044D\u0442\u043E \u2248 34%);\n\u2014 \u043F\u0435\u0440 BD-\u0440\u043E\u043B\u043B\u043E\u0432\u0435\u0440\u0442\u0435\u043B\u044C: roll \u0432 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0438 \u0441\u043D\u0430 \u041D\u0415 \u043F\u0440\u043E\u0438\u0441\u0445\u043E\u0434\u0438\u0442 (\u043F\u0440\u043E\u0441\u0442\u043E \xAB\u0441\u043E\u043D +8 \u0447\u0430\u0441\u043E\u0432\xBB);\n  \u043F\u043E\u043F\u0443\u0449\u0435\u043D\u043D\u043E\u0435 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 HP \u043F\u043E \u043A\u043E\u0441\u0442\u0438 meta.rest.hp \u0438\u0434\u0451\u0442 \u041F\u041E\u0421\u041B\u0415\n  \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F (BRP-\u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u043D\u043E\u0435 \u043B\u0435\u0447\u0435\u043D\u0438\u0435 \u2014 \u043D\u0435 \u0442\u0443\u0442, \u0430 \u0432 \u043B\u0430\u0433\u0435\u0440\u0435 campRest)."
        },
        EndingDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string",
              description: "\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0432 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0435"
            },
            title: {
              type: "string",
              description: "\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A \u0444\u0438\u043D\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u044D\u043A\u0440\u0430\u043D\u0430"
            },
            text: {
              type: "string",
              description: "\u0442\u0435\u043A\u0441\u0442 \u043A\u043E\u043D\u0446\u043E\u0432\u043A\u0438"
            },
            tone: {
              type: "string",
              enum: [
                "death",
                "victory",
                "neutral"
              ],
              description: "\u0442\u043E\u043D \u044D\u043A\u0440\u0430\u043D\u0430: \u0433\u0438\u0431\u0435\u043B\u044C / \u043F\u043E\u0431\u0435\u0434\u0430 / \u043D\u0435\u0439\u0442\u0440\u0430\u043B\u044C\u043D\u044B\u0439"
            },
            on: {
              type: "string",
              enum: [
                "death",
                "victory"
              ],
              description: "\u043A \u043A\u0430\u043A\u043E\u043C\u0443 \u0438\u0441\u0445\u043E\u0434\u0443 \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u043C\u0430 \u043A\u043E\u043D\u0446\u043E\u0432\u043A\u0430 (\u043D\u0435\u0442 \u2014 \u043A \u043B\u044E\u0431\u043E\u043C\u0443)"
            },
            image: {
              type: "string",
              description: "\u0444\u043E\u043D \u0444\u0438\u043D\u0430\u043B\u0430 (\u0444\u0430\u0439\u043B \u043F\u0430\u043A\u0435\u0442\u0430 \u0438\u043B\u0438 \u0441\u0441\u044B\u043B\u043A\u0430); \u043D\u0435\u0442 \u2014 \u0444\u043E\u043D \u0442\u0435\u043C\u044B"
            },
            conditions: {
              type: "array",
              items: {
                $ref: "#/$defs/Condition"
              },
              description: "\u0443\u0441\u043B\u043E\u0432\u0438\u044F, \u043F\u0440\u0438 \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u044D\u0442\u0430 \u043A\u043E\u043D\u0446\u043E\u0432\u043A\u0430 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442\u0441\u044F (\u0432\u0441\u0435 \u0441\u0440\u0430\u0437\u0443)"
            }
          },
          required: [
            "id",
            "label",
            "title"
          ],
          additionalProperties: false,
          description: "\u0424\u0438\u043D\u0430\u043B\u044C\u043D\u044B\u0439 \u044D\u043A\u0440\u0430\u043D (\u043A\u043E\u043D\u0446\u043E\u0432\u043A\u0430). \u041C\u0430\u0441\u0442\u0435\u0440 \u0437\u0430\u0434\u0430\u0451\u0442 \u0441\u0442\u043E\u043B\u044C\u043A\u043E \u043A\u043E\u043D\u0446\u043E\u0432\u043E\u043A, \u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0445\u043E\u0447\u0435\u0442;\n\u043F\u0440\u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0438 \u0437\u0430\u0431\u0435\u0433\u0430 \u0434\u0432\u0438\u0436\u043E\u043A \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u0442 \u041F\u0415\u0420\u0412\u0423\u042E, \u0443 \u043A\u043E\u0442\u043E\u0440\u043E\u0439 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u0435\u0442 \u0438\u0441\u0445\u043E\u0434\n(`on`) \u0438 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u044B \u0432\u0441\u0435 `conditions`. \u0415\u0441\u043B\u0438 \u043D\u0438 \u043E\u0434\u043D\u0430 \u043D\u0435 \u043F\u043E\u0434\u043E\u0448\u043B\u0430 \u2014 \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u044B\u0439\n\u044D\u043A\u0440\u0430\u043D \u0438\u0441\u0445\u043E\u0434\u0430 (\xAB\u0417\u0430\u0431\u0435\u0433 \u043E\u043A\u043E\u043D\u0447\u0435\u043D\xBB / \xAB\u041F\u043E\u0431\u0435\u0434\u0430\xBB)."
        },
        DiceRules: {
          type: "object",
          properties: {
            critical_divisor: {
              type: "number",
              description: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0443\u0441\u043F\u0435\u0445: \u0431\u0440\u043E\u0441\u043E\u043A \u2264 \u043D\u0430\u0432\u044B\u043A / critical_divisor"
            },
            special_divisor: {
              type: "number",
              description: "\u043E\u0441\u043E\u0431\u044B\u0439 (\u0445\u043E\u0440\u043E\u0448\u0438\u0439) \u0443\u0441\u043F\u0435\u0445: \u0431\u0440\u043E\u0441\u043E\u043A \u2264 \u043D\u0430\u0432\u044B\u043A / special_divisor"
            },
            fumble_from: {
              type: "number",
              description: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043F\u0440\u043E\u0432\u0430\u043B \u043D\u0430\u0447\u0438\u043D\u0430\u0435\u0442\u0441\u044F \u0441 \u044D\u0442\u043E\u0433\u043E \u0431\u0440\u043E\u0441\u043A\u0430 (fumble_from\u2026100)"
            },
            fumble_low_skill: {
              type: "number",
              description: "\u041A\u043B\u0430\u0441\u0441\u0438\u0447\u0435\u0441\u043A\u0438\u0439 BRP: \u043F\u0440\u0438 \u043D\u0430\u0432\u044B\u043A\u0435 \u043D\u0438\u0436\u0435 \u044D\u0442\u043E\u0433\u043E \u043F\u043E\u0440\u043E\u0433\u0430 \u043A\u0440\u0438\u0442-\u043F\u0440\u043E\u0432\u0430\u043B \u2014 \u0432\u0435\u0441\u044C\n\u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D fumble_from\u202699 (\u0430 \u043D\u0435 \u0442\u043E\u043B\u044C\u043A\u043E 100). \u041F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u043E."
            }
          },
          required: [
            "critical_divisor",
            "special_divisor",
            "fumble_from"
          ],
          additionalProperties: false,
          description: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0431\u0440\u043E\u0441\u043A\u043E\u0432 d100 (\u0438\u0442\u0435\u0440\u0430\u0446\u0438\u044F 8, \u04107). \u0425\u0440\u0430\u043D\u044F\u0442\u0441\u044F \u0432 campaign.json \u2014\n\u0443 \u043A\u0430\u0436\u0434\u043E\u0439 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u043C\u043E\u0433\u0443\u0442 \u0431\u044B\u0442\u044C \u0441\u0432\u043E\u0438 \u043F\u043E\u0440\u043E\u0433\u0438, \u0434\u0432\u0438\u0436\u043E\u043A \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u0445\u0430\u0440\u0434\u043A\u043E\u0434\u0438\u0442."
        },
        SoundHookMap: {
          type: "object",
          additionalProperties: {
            type: "string"
          },
          description: "\u043A\u0430\u0440\u0442\u0430 \xAB\u0445\u0443\u043A \u2192 id \u0437\u0432\u0443\u043A\u0430 \u0440\u0435\u0435\u0441\u0442\u0440\u0430\xBB"
        },
        ItemCategoryDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            restores_hp: {
              type: "boolean",
              description: "\u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \u043C\u043E\u0436\u043D\u043E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C \u0434\u043B\u044F \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u0437\u0434\u043E\u0440\u043E\u0432\u044C\u044F"
            },
            restores_needs: {
              type: "array",
              items: {
                type: "string"
              },
              description: "\u043A\u0430\u043A\u0438\u0435 \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0438 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u044E\u0442 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 (id \u0438\u0437 \u0440\u0435\u0435\u0441\u0442\u0440\u0430 needs)"
            },
            is_weapon: {
              type: "boolean",
              description: "\u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \u2014 \u043E\u0440\u0443\u0436\u0438\u0435 (\u043D\u0430\u0432\u044B\u043A, \u0443\u0440\u043E\u043D \u0438 \u0442.\u0434.)"
            },
            is_armor: {
              type: "boolean",
              description: "\u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \u2014 \u0431\u0440\u043E\u043D\u044F (\u043E\u0447\u043A\u0438 \u043F\u043E\u0433\u043B\u043E\u0449\u0435\u043D\u0438\u044F \u0443\u0440\u043E\u043D\u0430)"
            },
            sounds: {
              $ref: "#/$defs/SoundHookMap",
              description: "\u0437\u0432\u0443\u043A\u0438 \u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0439 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432 (\u0445\u0443\u043A \u2192 id \u0437\u0432\u0443\u043A\u0430)"
            }
          },
          required: [
            "id",
            "label"
          ],
          additionalProperties: false,
          description: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432: \u0437\u0430\u0434\u0430\u0451\u0442, \u043A\u0430\u043A\u0438\u0435 \u0441\u0432\u043E\u0439\u0441\u0442\u0432\u0430 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0443 (\u0444\u0438\u0434\u0431\u0435\u043A \u21168)."
        },
        EmotionDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            }
          },
          required: [
            "id",
            "label"
          ],
          additionalProperties: false,
          description: "\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043F\u043E\u0440\u0442\u0440\u0435\u0442\u0430 \u041D\u041F\u0421: \u043A\u043B\u044E\u0447 \u043A\u0430\u0440\u0442\u0438\u043D\u043A\u0438 `npc.portrait[id]` \u0438 \u0442\u0435\u0433 `# emotion:`\n\u0432 \u0434\u0438\u0430\u043B\u043E\u0433\u0435. \u041E\u0431\u0449\u0438\u0439 \u0440\u0435\u0435\u0441\u0442\u0440 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u2014 \u0447\u0442\u043E\u0431\u044B \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435, \u0437\u0430\u0432\u0435\u0434\u0451\u043D\u043D\u043E\u0435 \u0443 \u043E\u0434\u043D\u043E\u0433\u043E \u041D\u041F\u0421,\n\u043F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u043B\u043E\u0441\u044C \u0432 \u0434\u0438\u0430\u043B\u043E\u0433\u0430\u0445 \u0432\u0441\u0435\u0445 \u043E\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0445, \u0438 \u0418\u0418-\u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440\u0443 \u0431\u044B\u043B\u043E \u043D\u0430 \u0447\u0442\u043E \u0441\u043E\u0441\u043B\u0430\u0442\u044C\u0441\u044F."
        },
        CurrencyDef: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "id \u0432\u0430\u043B\u044E\u0442\u044B \u0434\u043B\u044F \u0446\u0435\u043D \u0438 value \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432"
            },
            label: {
              type: "string"
            },
            symbol: {
              type: "string"
            },
            item_id: {
              type: "string",
              description: "\u043F\u0440\u0435\u0434\u043C\u0435\u0442-\u043C\u043E\u043D\u0435\u0442\u0430 \u0432 \u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u0435; \u0441\u0442\u0430\u0440\u044B\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044E\u0442 \u0441\u043E\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435 item_<id>"
            },
            exchange_rate: {
              type: "object",
              additionalProperties: {
                type: "number"
              }
            }
          },
          required: [
            "id",
            "label",
            "symbol"
          ],
          additionalProperties: false
        },
        FactionDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            base_disposition: {
              type: "number"
            },
            description: {
              type: "string",
              description: "\u043A\u0440\u0430\u0442\u043A\u0430\u044F \u0441\u043F\u0440\u0430\u0432\u043A\u0430 \u043E \u0444\u0440\u0430\u043A\u0446\u0438\u0438"
            },
            hidden: {
              type: "boolean",
              description: "\u0441\u043B\u0443\u0436\u0435\u0431\u043D\u0430\u044F \u0444\u0440\u0430\u043A\u0446\u0438\u044F: \u043E\u0442\u043D\u043E\u0448\u0435\u043D\u0438\u0435 \u043D\u0435 \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F, \u0438\u0433\u0440\u043E\u043A\u0443 \u043D\u0435 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442\u0441\u044F"
            }
          },
          required: [
            "id",
            "label",
            "base_disposition"
          ],
          additionalProperties: false
        },
        MusicMood: {
          type: "string",
          enum: [
            "\u0442\u0440\u0435\u0432\u043E\u0436\u043D\u0430\u044F",
            "\u0441\u043F\u043E\u043A\u043E\u0439\u043D\u0430\u044F",
            "\u0431\u043E\u0435\u0432\u0430\u044F",
            "\u0442\u043E\u0440\u0436\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u0430\u044F",
            "\u0442\u0430\u0438\u043D\u0441\u0442\u0432\u0435\u043D\u043D\u0430\u044F"
          ],
          description: "\u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u0438\u0435 \u0433\u0435\u043D\u0435\u0440\u0430\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u0442\u0440\u0435\u043A\u0430"
        },
        MusicScale: {
          type: "string",
          enum: [
            "\u043C\u0438\u043D\u043E\u0440",
            "\u043C\u0430\u0436\u043E\u0440",
            "\u0434\u043E\u0440\u0438\u0439\u0441\u043A\u0438\u0439",
            "\u0444\u0440\u0438\u0433\u0438\u0439\u0441\u043A\u0438\u0439",
            "\u043F\u0435\u043D\u0442\u0430\u0442\u043E\u043D\u0438\u043A\u0430"
          ],
          description: "\u043B\u0430\u0434 \u0433\u0435\u043D\u0435\u0440\u0430\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u0442\u0440\u0435\u043A\u0430"
        },
        MusicLayer: {
          type: "string",
          enum: [
            "\u043F\u0430\u0434-\u0430\u043A\u043A\u043E\u0440\u0434\u044B",
            "\u0430\u0440\u043F\u0435\u0434\u0436\u0438\u043E",
            "\u0431\u0430\u0441",
            "\u043F\u0435\u0440\u043A\u0443\u0441\u0441\u0438\u044F"
          ],
          description: "\u0441\u043B\u043E\u0438 \u0430\u0440\u0430\u043D\u0436\u0438\u0440\u043E\u0432\u043A\u0438"
        },
        MusicDoc: {
          type: "object",
          properties: {
            mood: {
              $ref: "#/$defs/MusicMood"
            },
            tempo: {
              type: "number",
              description: "\u0443\u0434\u0430\u0440\u043E\u0432 \u0432 \u043C\u0438\u043D\u0443\u0442\u0443 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u0437\u0430\u0432\u0438\u0441\u0438\u0442 \u043E\u0442 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u0438\u044F)"
            },
            key: {
              type: "string",
              description: '\u0442\u043E\u043D\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u044C: "C", "D#", "Fis"\u2026 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u2014 \u043E\u0442 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u0438\u044F)'
            },
            scale: {
              $ref: "#/$defs/MusicScale"
            },
            layers: {
              type: "array",
              items: {
                $ref: "#/$defs/MusicLayer"
              }
            },
            progression: {
              type: "array",
              items: {
                type: "string"
              },
              description: '\u0430\u043A\u043A\u043E\u0440\u0434\u043E\u0432\u0430\u044F \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0441\u0442\u0443\u043F\u0435\u043D\u044F\u043C\u0438 \u0433\u0430\u043C\u043C\u044B: ["i","VI","III","VII"]'
            },
            seed: {
              type: "number",
              description: "\u0437\u0435\u0440\u043D\u043E \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u043E\u0441\u0442\u0438 (\u043E\u0434\u0438\u043D\u0430\u043A\u043E\u0432\u044B\u0439 seed \u2014 \u043E\u0434\u043D\u0430 \u0438 \u0442\u0430 \u0436\u0435 \u043C\u0443\u0437\u044B\u043A\u0430)"
            }
          },
          required: [
            "mood",
            "scale",
            "layers"
          ],
          additionalProperties: false,
          description: "\u0412\u044B\u0441\u043E\u043A\u043E\u0443\u0440\u043E\u0432\u043D\u0435\u0432\u044B\u0439 \u0433\u0435\u043D\u0435\u0440\u0430\u0442\u0438\u0432\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 \u043C\u0443\u0437\u044B\u043A\u0438 (\u041D\u0415 \u043D\u043E\u0442\u044B \u0432\u0440\u0443\u0447\u043D\u0443\u044E).\n\u0420\u0430\u043D\u0442\u0430\u0439\u043C-\u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440 \u0441\u043E\u0431\u0438\u0440\u0430\u0435\u0442 \u0431\u0435\u0441\u0448\u043E\u0432\u043D\u044B\u0439 \u044D\u043C\u0431\u0438\u0435\u043D\u0442-\u043B\u0443\u043F \u043F\u043E \u0433\u0430\u043C\u043C\u0435 \u2014 \xAB\u043C\u0438\u043C\u043E\xBB\n\u0441\u044B\u0433\u0440\u0430\u0442\u044C \u043D\u0435 \u043C\u043E\u0436\u0435\u0442; \u0434\u0435\u0442\u0435\u0440\u043C\u0438\u043D\u0438\u0437\u043C \u043E\u0442 `seed`."
        },
        MusicSource: {
          anyOf: [
            {
              type: "string"
            },
            {
              $ref: "#/$defs/MusicDoc"
            }
          ],
          description: "\u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u043C\u0443\u0437\u044B\u043A\u0438: \u0444\u0430\u0439\u043B/\u0441\u0441\u044B\u043B\u043A\u0430 \u0418\u041B\u0418 \u0433\u0435\u043D\u0435\u0440\u0430\u0442\u0438\u0432\u043D\u044B\u0439 MusicDoc"
        },
        MusicTrackDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            src: {
              $ref: "#/$defs/MusicSource"
            },
            volume: {
              type: "number",
              description: "\u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u044C \u0442\u0440\u0435\u043A\u0430 0\u20261 (\u043F\u043E\u0432\u0435\u0440\u0445 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A \u0438\u0433\u0440\u043E\u043A\u0430)"
            },
            loop: {
              type: "boolean",
              description: "\u0437\u0430\u0446\u0438\u043A\u043B\u0438\u0432\u0430\u0442\u044C (\u043E\u0434\u0438\u043D \u0442\u0440\u0435\u043A) \u0438\u043B\u0438 \u0438\u0433\u0440\u0430\u0442\u044C \u043A\u0430\u043A \u043F\u043B\u0435\u0439\u043B\u0438\u0441\u0442"
            }
          },
          required: [
            "id",
            "label",
            "src"
          ],
          additionalProperties: false
        },
        CampaignChapter: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            order: {
              type: "number",
              description: "\u043F\u043E\u0440\u044F\u0434\u043E\u043A \u0432 \u043E\u0433\u043B\u0430\u0432\u043B\u0435\u043D\u0438\u0438 (\u043C\u0435\u043D\u044C\u0448\u0435 \u2014 \u0440\u0430\u043D\u044C\u0448\u0435; \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 \u2014 \u043F\u043E\u0440\u044F\u0434\u043E\u043A \u0432 \u0441\u043F\u0438\u0441\u043A\u0435)"
            },
            description: {
              type: "string",
              description: "\u043A\u0440\u0430\u0442\u043A\u043E \u043E \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u0438 \u0433\u043B\u0430\u0432\u044B (\u0434\u043B\u044F \u043C\u0430\u0441\u0442\u0435\u0440\u0430 \u0438 \u0431\u0443\u0434\u0443\u0449\u0435\u0439 \u0432\u044B\u043B\u043E\u0436. \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B \u0447\u0430\u0441\u0442\u0438)"
            }
          },
          required: [
            "id",
            "label"
          ],
          additionalProperties: false,
          description: "\u0413\u043B\u0430\u0432\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438: \u043E\u043F\u043E\u0440\u043D\u0430\u044F \u0433\u0440\u0443\u043F\u043F\u0438\u0440\u043E\u0432\u043A\u0430 \u043A\u043E\u043D\u0442\u0435\u043D\u0442\u0430 \u0434\u043B\u044F \u043C\u0430\u0441\u0442\u0435\u0440\u0430 \u0438 \xAB\u043F\u0440\u043E\u043B\u043E\u0433 \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u043E\xBB \u2014\n\u0441\u0446\u0435\u043D\u044B/\u043F\u0440\u0430\u0432\u0438\u043B\u0430/\u043A\u0432\u0435\u0441\u0442\u044B/\u043A\u0430\u0442\u0441\u0446\u0435\u043D\u044B \u043F\u043E\u043C\u0435\u0447\u0430\u044E\u0442 \u043F\u043E\u043B\u0435\u043C `chapter`; \u0434\u0432\u0438\u0433\u0430\u0442\u0435\u043B\u044C \u043D\u0435 \u0440\u0430\u0437\u043B\u0438\u0447\u0430\u0435\u0442 \u0433\u043B\u0430\u0432\u044B."
        },
        SoundDoc: {
          type: "object",
          properties: {
            zzfx: {
              type: "array",
              items: {
                type: "number"
              }
            }
          },
          required: [
            "zzfx"
          ],
          additionalProperties: false,
          description: "\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u0438\u0447\u0435\u0441\u043A\u0438\u0439 SFX \u0432 \u0434\u0443\u0445\u0435 ZzFX/jsfxr: \u0447\u0438\u0441\u043B\u0430 \u0432 \u043F\u043E\u0440\u044F\u0434\u043A\u0435 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u043E\u0432 zzfx\n(\u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u044C, \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u043E\u0441\u0442\u044C, \u0447\u0430\u0441\u0442\u043E\u0442\u0430, \u0430\u0442\u0430\u043A\u0430/\u0441\u0443\u0441\u0442\u0435\u0439\u043D/\u0434\u0435\u043A\u0435\u0439, \u0444\u043E\u0440\u043C\u0430 \u0432\u043E\u043B\u043D\u044B\u2026).\n\u0420\u0435\u043D\u0434\u0435\u0440\u0438\u0442\u0441\u044F Web Audio \u043D\u0430 \u043B\u0435\u0442\u0443 (\u0441 \u043A\u044D\u0448\u0435\u043C \u0431\u0443\u0444\u0435\u0440\u0430). \u0420\u0435\u0442\u0440\u043E-\u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440 \u043F\u0440\u0438\u0435\u043C\u043B\u0435\u043C."
        },
        SoundSource: {
          anyOf: [
            {
              type: "string"
            },
            {
              $ref: "#/$defs/SoundDoc"
            }
          ],
          description: "\u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u0437\u0432\u0443\u043A\u0430: \u0444\u0430\u0439\u043B/\u0441\u0441\u044B\u043B\u043A\u0430 \u0418\u041B\u0418 \u0441\u0438\u043D\u0442\u0435\u0437 \u0438\u0437 JSON; \u043C\u0430\u0441\u0441\u0438\u0432 \u2014 \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u044B\u0439 \u0432\u0430\u0440\u0438\u0430\u043D\u0442"
        },
        SoundDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            src: {
              anyOf: [
                {
                  $ref: "#/$defs/SoundSource"
                },
                {
                  type: "array",
                  items: {
                    $ref: "#/$defs/SoundSource"
                  }
                }
              ]
            },
            loop: {
              type: "boolean",
              description: "\u0437\u0430\u0446\u0438\u043A\u043B\u0435\u043D\u043D\u044B\u0439 \u0444\u043E\u043D (\u043F\u0442\u0438\u0446\u044B, \u0433\u0443\u043B): \u0438\u0433\u0440\u0430\u0435\u0442 \u0441\u043B\u043E\u0435\u043C, \u043F\u043E\u043A\u0430 \u043D\u0435 \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u044F\u0442 (\u0444\u0438\u0434\u0431\u0435\u043A 9.6)"
            }
          },
          required: [
            "id",
            "label",
            "src"
          ],
          additionalProperties: false
        },
        CampaignFeatures: {
          type: "object",
          properties: {
            map: {
              type: "boolean",
              description: "\u043A\u0430\u0440\u0442\u0430 \u043C\u0438\u0440\u0430 \u0438 \u043F\u0443\u0442\u0435\u0448\u0435\u0441\u0442\u0432\u0438\u044F \u043C\u0435\u0436\u0434\u0443 \u043B\u043E\u043A\u0430\u0446\u0438\u044F\u043C\u0438"
            },
            inventory: {
              type: "boolean",
              description: "\u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u044C, \u044D\u043A\u0438\u043F\u0438\u0440\u043E\u0432\u043A\u0430, \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u0432 \u0431\u043E\u044E (\u044D\u0444\u0444\u0435\u043A\u0442\u044B \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432 \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u044E\u0442 \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C)"
            },
            needs: {
              type: "boolean",
              description: "\u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0438 \u0438 \u0438\u0445 \u0443\u0431\u044B\u0432\u0430\u043D\u0438\u0435/\u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435"
            },
            skills: {
              type: "boolean",
              description: "\u043D\u0430\u0432\u044B\u043A\u0438: \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0440\u0435\u0437\u043E\u043B\u0432\u044F\u0442\u0441\u044F \u0443\u0441\u043F\u0435\u0445\u043E\u043C \u0431\u0435\u0437 \u0431\u0440\u043E\u0441\u043A\u0430, \u0440\u043E\u0441\u0442 \u043E\u0442\u043A\u043B\u044E\u0447\u0451\u043D"
            },
            relationships: {
              type: "boolean",
              description: "\u043F\u0430\u043D\u0435\u043B\u044C \u043E\u0442\u043D\u043E\u0448\u0435\u043D\u0438\u0439 (\u0441\u0430\u043C\u0438 \u043E\u0442\u043D\u043E\u0448\u0435\u043D\u0438\u044F \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u044E\u0442 \u043C\u0435\u043D\u044F\u0442\u044C\u0441\u044F \u2014 \u043C\u043E\u0433\u0443\u0442 \u0433\u0435\u0439\u0442\u0438\u0442\u044C \u0434\u0438\u0430\u043B\u043E\u0433\u0438)"
            },
            trade: {
              type: "boolean",
              description: "\u0442\u043E\u0440\u0433\u043E\u0432\u043B\u044F"
            },
            combat: {
              type: "boolean",
              description: "\u0442\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0431\u043E\u0439: \u043A\u043E\u043D\u0444\u043B\u0438\u043A\u0442\u044B \u0440\u0435\u0437\u043E\u043B\u0432\u044F\u0442\u0441\u044F \u043D\u0435\u043C\u0435\u0434\u043B\u0435\u043D\u043D\u043E\u0439 \u043F\u043E\u0431\u0435\u0434\u043E\u0439"
            },
            time: {
              type: "boolean",
              description: "\u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0447\u0430\u0441\u043E\u0432 \u0438 \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u0441\u0443\u0442\u043E\u043A (\u0445\u043E\u0434 \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F)"
            }
          },
          additionalProperties: false,
          description: "\u041F\u0440\u043E\u0444\u0438\u043B\u044C \u043C\u0435\u0445\u0430\u043D\u0438\u043A \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 (\u0431\u043B\u043E\u043A 1 \u0422\u0417 \xAB\u0413\u0438\u0431\u043A\u0438\u0439 \u0434\u0432\u0438\u0436\u043E\u043A\xBB). \u041A\u0430\u0436\u0434\u043E\u0435 \u043F\u043E\u043B\u0435 \u2014\n\u0432\u044B\u043A\u043B\u044E\u0447\u0430\u0442\u0435\u043B\u044C \u043F\u043E\u0434\u0441\u0438\u0441\u0442\u0435\u043C\u044B; \u041E\u0422\u0421\u0423\u0422\u0421\u0422\u0412\u0423\u042E\u0429\u0415\u0415 \u043F\u043E\u043B\u0435 (\u0438\u043B\u0438 \u0432\u0435\u0441\u044C `features`) \u043E\u0437\u043D\u0430\u0447\u0430\u0435\u0442,\n\u0447\u0442\u043E \u043C\u0435\u0445\u0430\u043D\u0438\u043A\u0430 \u0412\u041A\u041B\u042E\u0427\u0415\u041D\u0410 \u2014 \u0441\u0442\u0430\u0440\u044B\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0442 \u0431\u0435\u0437 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439.\n\u0422\u0443\u043C\u0431\u043B\u0435\u0440\u044B \u0441\u043A\u0440\u044B\u0432\u0430\u044E\u0442 \u043F\u043E\u0434\u0441\u0438\u0441\u0442\u0435\u043C\u0443 \u0438 \u0432 \u0434\u0432\u0438\u0436\u043A\u0435, \u0438 \u0432 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0435 \u0438\u0433\u0440\u043E\u043A\u0430."
        },
        FontDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            src: {
              type: "string"
            },
            weight: {
              type: "string",
              description: "\u043D\u0430\u0447\u0435\u0440\u0442\u0430\u043D\u0438\u0435 \u0434\u043B\u044F"
            },
            style: {
              type: "string",
              enum: [
                "normal",
                "italic"
              ]
            },
            size_adjust: {
              type: "number",
              description: "\u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u0430\u044F \u043F\u043E\u043F\u0440\u0430\u0432\u043A\u0430 \u0440\u0430\u0437\u043C\u0435\u0440\u0430 \u0434\u043B\u044F \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E\u0433\u043E \u0448\u0440\u0438\u0444\u0442\u0430 (0.8 .. 1.3, \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 1)"
            }
          },
          required: [
            "id",
            "label",
            "src"
          ],
          additionalProperties: false,
          description: "\u0428\u0440\u0438\u0444\u0442 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 (\u0431\u043B\u043E\u043A 2 \u0422\u0417 \xAB\u0413\u0438\u0431\u043A\u0438\u0439 \u0434\u0432\u0438\u0436\u043E\u043A\xBB): \u0444\u0430\u0439\u043B \u043F\u0430\u043A\u0435\u0442\u0430 (\u043E\u0431\u044B\u0447\u043D\u043E\n`assets/fonts/\u2026`) \u0438\u043B\u0438 \u0432\u043D\u0435\u0448\u043D\u044F\u044F \u0441\u0441\u044B\u043B\u043A\u0430. \u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u0435\u0442\u0441\u044F `@font-face` \u043D\u0430 \u043B\u0435\u0442\u0443."
        },
        VisualProfileId: {
          type: "string",
          enum: [
            "forge",
            "epic-fantasy",
            "dark-fantasy",
            "myth-folklore",
            "gothic-horror",
            "cosmic-horror",
            "noir",
            "historical",
            "wilderness",
            "postapocalypse",
            "scifi",
            "cyberpunk",
            "modern"
          ],
          description: "\u0418\u0433\u0440\u043E\u0432\u043E\u0439 \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C (\u0440\u0435\u0434\u0438\u0437\u0430\u0439\u043D 2026): \xAB\u0441\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0439 \u0445\u0443\u0434\u043E\u0436\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439 \u043D\u0430\u0431\u043E\u0440\xBB,\n\u0430 \u043D\u0435 \u0442\u0438\u043F \u043C\u0435\u0445\u0430\u043D\u0438\u043A\u0438. \u041F\u0440\u043E\u0444\u0438\u043B\u044C \u0437\u0430\u0434\u0430\u0451\u0442 \u043F\u0430\u043B\u0438\u0442\u0440\u0443, \u0442\u0438\u043F\u043E\u0433\u0440\u0430\u0444\u0438\u043A\u0443, \u0444\u043E\u0440\u043C\u044B, \u0441\u0442\u0438\u043B\u044C \u043F\u0430\u043D\u0435\u043B\u0435\u0439\n\u0438 \u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0430\u0442\u043C\u043E\u0441\u0444\u0435\u0440\u043D\u044B\u0439 \u044D\u0444\u0444\u0435\u043A\u0442; \u043F\u043E\u0432\u0435\u0440\u0445 \u043D\u0435\u0433\u043E \u0430\u0432\u0442\u043E\u0440 \u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u043E\n\u043F\u0435\u0440\u0435\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u0435\u0442 \u0430\u043A\u0446\u0435\u043D\u0442, \u0448\u0440\u0438\u0444\u0442\u043E\u0432\u044B\u0435 \u0440\u043E\u043B\u0438, \u0444\u043E\u043D\u044B \u0438 \u0430\u0442\u043C\u043E\u0441\u0444\u0435\u0440\u0443 (\u0441\u043C. ThemeDoc).\n\u041C\u0435\u043D\u044F\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u0435 \u2014 \u043D\u0438 \u043F\u0440\u0430\u0432\u0438\u043B, \u043D\u0438 dice_rules, \u043D\u0438 \u0434\u0430\u043D\u043D\u044B\u0445."
        },
        ThemeDoc: {
          type: "object",
          properties: {
            profile: {
              $ref: "#/$defs/VisualProfileId",
              description: "\u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u0438\u0433\u0440\u044B: \xAB\u0424\u044D\u043D\u0442\u0435\u0437\u0438\xBB / \xAB\u0425\u043E\u0440\u0440\u043E\u0440\xBB / \xAB\u0412\u044B\u0436\u0438\u0432\u0430\u043D\u0438\u0435\xBB.\n\u041D\u0435 \u0437\u0430\u0434\u0430\u043D \u2014 \xAB\u0424\u044D\u043D\u0442\u0435\u0437\u0438\xBB (\u043D\u0430\u0441\u043B\u0435\u0434\u0438\u0435 \u0442\u0435\u043C\u044B \xAB\u041F\u0435\u043F\u043B\u0430 \u041A\u0430\u044D\u0440\u0434\u0435\u043D\u0430\xBB).\n\u0421\u0442\u0430\u0440\u044B\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u0431\u0435\u0437 \u044D\u0442\u043E\u0433\u043E \u043F\u043E\u043B\u044F \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u0431\u0435\u0437 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439."
            },
            atmosphere: {
              type: "boolean",
              description: "\u0430\u0442\u043C\u043E\u0441\u0444\u0435\u0440\u043D\u044B\u0439 \u044D\u0444\u0444\u0435\u043A\u0442 \u043F\u0440\u043E\u0444\u0438\u043B\u044F (\u0432\u0438\u043D\u044C\u0435\u0442\u043A\u0430/\u0437\u0435\u0440\u043D\u043E/\u0447\u0438\u0441\u0442\u044B\u0439 \u043A\u0430\u0434\u0440).\n\u041D\u0435 \u0437\u0430\u0434\u0430\u043D \u0438\u043B\u0438 true \u2014 \u044D\u0444\u0444\u0435\u043A\u0442 \u043F\u0440\u043E\u0444\u0438\u043B\u044F \u0432\u043A\u043B\u044E\u0447\u0451\u043D; false \u2014 \u0447\u0438\u0441\u0442\u044B\u0439 \u043A\u0430\u0434\u0440."
            },
            fonts: {
              type: "object",
              properties: {
                body: {
                  type: "string",
                  description: "\u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0442\u0435\u043A\u0441\u0442: \u0434\u0438\u0430\u043B\u043E\u0433\u0438, \u043F\u0430\u043D\u0435\u043B\u0438, \u043A\u043D\u043E\u043F\u043A\u0438"
                },
                display: {
                  type: "string",
                  description: "\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u0438: \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F \u0441\u0446\u0435\u043D \u0438 \u043F\u0430\u043D\u0435\u043B\u0435\u0439, \u043C\u0435\u043D\u044E"
                },
                hand: {
                  type: "string",
                  description: "\xAB\u0440\u0443\u043A\u043E\u043F\u0438\u0441\u043D\u044B\u0439\xBB: \u0436\u0443\u0440\u043D\u0430\u043B, \u0437\u0430\u043F\u0438\u0441\u043A\u0438, \u043A\u043E\u0434\u0435\u043A\u0441"
                }
              },
              additionalProperties: false,
              description: "\u0440\u043E\u043B\u0438 \u0448\u0440\u0438\u0444\u0442\u043E\u0432 \u2014 id \u0438\u0437 `meta.fonts`; \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0440\u043E\u043B\u044C \u2014 \u0441\u0438\u0441\u0442\u0435\u043C\u043D\u044B\u0439 \u0448\u0440\u0438\u0444\u0442"
            },
            font_scale: {
              type: "number",
              description: "\u043E\u0431\u0449\u0438\u0439 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0440\u0430\u0437\u043C\u0435\u0440\u0430 \u0448\u0440\u0438\u0444\u0442\u0430 \u0438\u0433\u0440\u044B (0.8 .. 1.4, \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 1)"
            },
            font_sizes: {
              type: "object",
              properties: {
                body: {
                  type: "number",
                  description: "\u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0442\u0435\u043A\u0441\u0442: \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u044F, \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 15)"
                },
                display: {
                  type: "number",
                  description: "\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u0438: \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F \u043B\u043E\u043A\u0430\u0446\u0438\u0439, \u0441\u0446\u0435\u043D, \u043F\u0430\u043D\u0435\u043B\u0435\u0439 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 20)"
                },
                dialogue: {
                  type: "number",
                  description: "\u0440\u0435\u043F\u043B\u0438\u043A\u0438 \u0438 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u044B \u043E\u0442\u0432\u0435\u0442\u043E\u0432 \u0432 \u0434\u0438\u0430\u043B\u043E\u0433\u0430\u0445 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 16)"
                },
                ui: {
                  type: "number",
                  description: "\u043A\u043D\u043E\u043F\u043A\u0438, \u0441\u043F\u0438\u0441\u043A\u0438, \u043C\u0435\u043B\u043A\u0438\u0435 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u044B \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 13)"
                }
              },
              additionalProperties: false,
              description: "\u0442\u043E\u0447\u043D\u044B\u0435 \u0440\u0430\u0437\u043C\u0435\u0440\u044B \u0448\u0440\u0438\u0444\u0442\u043E\u0432 \u0432 \u043F\u0438\u043A\u0441\u0435\u043B\u044F\u0445"
            },
            line_height: {
              type: "number",
              description: "\u043C\u0435\u0436\u0441\u0442\u0440\u043E\u0447\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B (\u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C 1.2 .. 2.0, \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 1.5)"
            },
            letter_spacing: {
              type: "string",
              description: "\u043C\u0435\u0436\u0431\u0443\u043A\u0432\u0435\u043D\u043D\u043E\u0435 \u0440\u0430\u0441\u0441\u0442\u043E\u044F\u043D\u0438\u0435 (\u0432 em, \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 0.01em..0.05em)"
            },
            menu: {
              type: "object",
              properties: {
                background: {
                  type: "string",
                  description: "\u0444\u043E\u043D \u0433\u043B\u0430\u0432\u043D\u043E\u0433\u043E \u043C\u0435\u043D\u044E (\u0444\u0430\u0439\u043B \u043F\u0430\u043A\u0435\u0442\u0430 \u0438\u043B\u0438 \u0441\u0441\u044B\u043B\u043A\u0430)"
                },
                dim: {
                  type: "number",
                  description: "\u0437\u0430\u0442\u0435\u043C\u043D\u0435\u043D\u0438\u0435 \u0444\u043E\u043D\u0430 0\u20260.9 \u0434\u043B\u044F \u0447\u0438\u0442\u0430\u0435\u043C\u043E\u0441\u0442\u0438 \u0442\u0435\u043A\u0441\u0442\u0430 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 0.5)"
                },
                ken_burns: {
                  type: "boolean",
                  description: "\u043C\u0435\u0434\u043B\u0435\u043D\u043D\u044B\u0439 \u0437\u0443\u043C \u0444\u043E\u043D\u0430 (\xAB\u043A\u0435\u043D-\u0431\u0451\u0440\u043D\u0441\xBB)"
                },
                title_art: {
                  type: "string",
                  description: "\u0430\u0440\u0442/\u043B\u043E\u0433\u043E \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u043D\u0430\u0434 \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u043E\u043C. \u041E\u0411\u042F\u0417\u0410\u0422\u0415\u041B\u042C\u041D\u041E \u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u044B\u0439 \u0444\u043E\u043D (PNG \u0441\n\u0430\u043B\u044C\u0444\u043E\u0439): \u0430\u0440\u0442 \u043B\u0435\u0436\u0438\u0442 \u043F\u043E\u0432\u0435\u0440\u0445 \u0444\u043E\u043D\u0430 \u043C\u0435\u043D\u044E, \u0441 \u0444\u043E\u043D\u043E\u043C \u0432\u044B\u0433\u043B\u044F\u0434\u0438\u0442 \u0447\u0451\u0440\u043D\u044B\u043C \u043A\u0432\u0430\u0434\u0440\u0430\u0442\u043E\u043C."
                }
              },
              additionalProperties: false
            },
            end: {
              type: "object",
              properties: {
                background: {
                  type: "string"
                }
              },
              additionalProperties: false,
              description: "\u0444\u043E\u043D \u044D\u043A\u0440\u0430\u043D\u0430 \u0444\u0438\u043D\u0430\u043B\u0430; \u043D\u0435\u0442 \u2014 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u0444\u043E\u043D \u043C\u0435\u043D\u044E"
            },
            accent: {
              type: "string",
              description: "\u0430\u043A\u0446\u0435\u043D\u0442\u043D\u044B\u0439 \u0446\u0432\u0435\u0442 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 (\u0437\u0430\u043C\u0435\u043D\u044F\u0435\u0442 \u0437\u043E\u043B\u043E\u0442\u043E \u0442\u0435\u043C\u044B)"
            },
            tokens: {
              type: "object",
              properties: {
                panel: {
                  type: "string",
                  description: "\u0444\u043E\u043D \u043F\u0430\u043D\u0435\u043B\u0435\u0439 \u0438 \u0448\u0430\u043F\u043E\u043A (\u043F\u0430\u043D\u0435\u043B\u044C, \u043A\u043E\u043B\u043E\u0434\u0446\u044B \u0434\u0438\u0430\u043B\u043E\u0433\u043E\u0432)"
                },
                cards: {
                  type: "string",
                  description: "\u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438, \u043A\u043D\u043E\u043F\u043A\u0438, \u044F\u0447\u0435\u0439\u043A\u0438 \u0441\u0442\u0430\u0442\u043E\u0432, \u0447\u0438\u043F\u044B"
                },
                inset: {
                  type: "string",
                  description: "\u0443\u0433\u043B\u0443\u0431\u043B\u0435\u043D\u0438\u044F (\u043F\u043E\u043B\u044F \u0432\u0432\u043E\u0434\u0430, \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441-\u043F\u043E\u043B\u043E\u0441\u044B)"
                },
                log: {
                  type: "string",
                  description: "\u0444\u043E\u043D \u0441\u043F\u0438\u0441\u043A\u0430 \u0436\u0443\u0440\u043D\u0430\u043B\u0430 \u0441\u043E\u0431\u044B\u0442\u0438\u0439"
                }
              },
              additionalProperties: false,
              description: "\u0422\u043E\u043D\u044B \u043F\u043E\u0432\u0435\u0440\u0445\u043D\u043E\u0441\u0442\u0435\u0439 (\u043C\u0430\u0441\u0442\u0435\u0440\u0441\u043A\u0430\u044F \u0434\u043E\u043A\u0440\u0443\u0442\u043A\u0430 \u043F\u0430\u043B\u0438\u0442\u0440\u044B): \u043F\u0430\u043D\u0435\u043B\u0438, \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438/\u043A\u043D\u043E\u043F\u043A\u0438,\n\u043A\u043E\u043B\u043E\u0434\u0446\u044B, \u0444\u043E\u043D \u0441\u0442\u0440\u043E\u043A \u0436\u0443\u0440\u043D\u0430\u043B\u0430. HEX (#rrggbb). \u041F\u0443\u0441\u0442\u043E \u2014 \u0442\u043E\u043D \u043F\u0440\u043E\u0444\u0438\u043B\u044F."
            },
            frame: {
              type: "object",
              properties: {
                image: {
                  type: "string",
                  description: "\u0444\u0430\u0439\u043B \u043F\u0430\u043A\u0435\u0442\u0430 \u0438\u043B\u0438 \u0441\u0441\u044B\u043B\u043A\u0430 (PNG \u0441 \u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u043E\u0439 \u0441\u0435\u0440\u0434\u0446\u0435\u0432\u0438\u043D\u043E\u0439, \u043E\u0440\u043D\u0430\u043C\u0435\u043D\u0442 \u043F\u043E \u043A\u0440\u0430\u044F\u043C)"
                },
                slice: {
                  type: "number",
                  description: "\u0442\u043E\u043B\u0449\u0438\u043D\u0430 \u0441\u0440\u0435\u0437\u0430 \u0440\u0430\u043C\u043A\u0438 \u0432 px (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 30)"
                },
                width: {
                  type: "number",
                  description: "\u0432\u0438\u0434\u0438\u043C\u0430\u044F \u0442\u043E\u043B\u0449\u0438\u043D\u0430 \u0440\u0430\u043C\u043A\u0438 \u0432 px (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 20)"
                }
              },
              additionalProperties: false,
              description: "\u0440\u0430\u043C\u043A\u0430-\xAB\u043A\u0430\u0434\u0440\xBB \u0432\u043E\u043A\u0440\u0443\u0433 \u043F\u0430\u043D\u0435\u043B\u0435\u0439: \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 9-\u0441\u0440\u0435\u0437 (border-image)"
            },
            custom_css: {
              type: "string"
            }
          },
          additionalProperties: false,
          description: "\u0422\u0435\u043C\u0430 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u044F \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 (\u0431\u043B\u043E\u043A 2 \u0422\u0417). \u041F\u0440\u0438\u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u0422\u041E\u041B\u042C\u041A\u041E \u043A Player Mode;\n\u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u0432 \u0444\u0438\u0440\u043C\u0435\u043D\u043D\u043E\u043C \u0441\u0442\u0438\u043B\u0435. \u041F\u0430\u043B\u0438\u0442\u0440\u0430 \u043F\u0435\u0440\u0435\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u0435\u0442\u0441\u044F \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u043D\u043E:\n\u0430\u043A\u0446\u0435\u043D\u0442 \u0438 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0442\u043E\u043D\u043E\u0432 \u043F\u043E\u0432\u0435\u0440\u0445\u043D\u043E\u0441\u0442\u0435\u0439; \u0434\u0432\u0438\u0436\u043E\u043A \u043F\u043E\u0434\u0431\u0438\u0440\u0430\u0435\u0442 \u0447\u0438\u0442\u0430\u0435\u043C\u044B\u0435 \u0442\u0435\u043A\u0441\u0442\u043E\u0432\u044B\u0435 \u0440\u043E\u043B\u0438."
        },
        ProfessionDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            description: {
              type: "string"
            },
            skill_bonus: {
              type: "object",
              additionalProperties: {
                type: "number"
              },
              description: "\u0431\u043E\u043D\u0443\u0441\u044B \u043A \u043D\u0430\u0432\u044B\u043A\u0430\u043C (\u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u044B\u0435, \u043D\u0435 \u0442\u0440\u0430\u0442\u044F\u0442 \u0431\u044E\u0434\u0436\u0435\u0442)"
            },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: {
                    type: "string"
                  },
                  quantity: {
                    type: "number"
                  }
                },
                required: [
                  "item",
                  "quantity"
                ],
                additionalProperties: false
              },
              description: "\u0441\u0442\u0430\u0440\u0442\u043E\u0432\u043E\u0435 \u0441\u043D\u0430\u0440\u044F\u0436\u0435\u043D\u0438\u0435"
            },
            stats: {
              type: "object",
              additionalProperties: {
                type: "number"
              },
              description: "\u0441\u0442\u0430\u0440\u0442\u043E\u0432\u043E\u0435 \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A, \u043A\u043E\u0442\u043E\u0440\u043E\u0435 \u0437\u0430\u0434\u0430\u0451\u0442 \u043C\u0430\u0441\u0442\u0435\u0440:\n\u0430\u0431\u0441\u043E\u043B\u044E\u0442\u043D\u044B\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F \u0441\u0435\u043C\u0438 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A (\u0432 \u0440\u0430\u043C\u043A\u0430\u0445 stat_limits).\n\u041D\u0435\u0442 \u2014 \u0432\u0441\u0435 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 \u043D\u0430\u0447\u0438\u043D\u0430\u044E\u0442 \u0441 \u043C\u0438\u043D\u0438\u043C\u0443\u043C\u0430."
            }
          },
          required: [
            "id",
            "label",
            "skill_bonus"
          ],
          additionalProperties: false,
          description: "\xAB\u043F\u0440\u043E\u0438\u0441\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u0435\xBB \u0433\u0435\u0440\u043E\u044F \u043F\u0440\u0438 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0438 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430 (\u0431\u043B\u043E\u043A 11 \u0422\u0417)"
        },
        CallingDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            description: {
              type: "string"
            },
            skills: {
              type: "object",
              additionalProperties: {
                type: "number"
              },
              description: "\u0441\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F \u043D\u0430\u0432\u044B\u043A\u043E\u0432 (\u0430\u0431\u0441\u043E\u043B\u044E\u0442\u043D\u044B\u0435, \u2265 \u043D\u0438\u0436\u043D\u0435\u0433\u043E \u043F\u043E\u0440\u043E\u0433\u0430)"
            }
          },
          required: [
            "id",
            "label",
            "skills"
          ],
          additionalProperties: false,
          description: "\xAB\u041F\u0440\u0438\u0437\u0432\u0430\u043D\u0438\u0435\xBB \u2014 \u0432\u0442\u043E\u0440\u043E\u0439 \u0448\u0430\u0431\u043B\u043E\u043D \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430 (\u0444\u0438\u0434\u0431\u0435\u043A 19): \u0435\u0441\u043B\u0438\n\u043F\u0440\u043E\u0438\u0441\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u0435 \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u0435\u0442 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438, \u0442\u043E \u043F\u0440\u0438\u0437\u0432\u0430\u043D\u0438\u0435 \u2014 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0435\n\u041D\u0410\u0412\u042B\u041A\u0418. \u041C\u0430\u0441\u0442\u0435\u0440 \u043E\u0431\u044F\u0437\u0430\u043D \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u0432\u0435\u0441\u044C \u0431\u044E\u0434\u0436\u0435\u0442 skill_points (\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F \u2014\n\u0430\u0431\u0441\u043E\u043B\u044E\u0442\u043D\u044B\u0435 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0435 \u043F\u0440\u043E\u0446\u0435\u043D\u0442\u044B, \u0441\u0447\u0438\u0442\u0430\u044F \u043E\u0442 \u043D\u0438\u0436\u043D\u0435\u0433\u043E \u043F\u043E\u0440\u043E\u0433\u0430), \u0438\u0433\u0440\u043E\u043A \u043F\u043E\u0441\u043B\u0435\n\u0432\u044B\u0431\u043E\u0440\u0430 \u043C\u043E\u0436\u0435\u0442 \u0443\u0431\u0430\u0432\u043B\u044F\u0442\u044C/\u043F\u0440\u0438\u0431\u0430\u0432\u043B\u044F\u0442\u044C \u0432 \u0440\u0430\u043C\u043A\u0430\u0445 \u0431\u044E\u0434\u0436\u0435\u0442\u0430."
        },
        SheetDoc: {
          type: "object",
          properties: {
            sheet: {
              type: "string",
              description: "\u0444\u0430\u0439\u043B \u043F\u0430\u043A\u0435\u0442\u0430 \u0438\u043B\u0438 \u0441\u0441\u044B\u043B\u043A\u0430 (PNG/WEBP \u0441 \u0440\u0430\u0441\u043A\u043B\u0430\u0434\u043A\u043E\u0439)"
            },
            cols: {
              type: "number",
              description: "\u0447\u0438\u0441\u043B\u043E \u043A\u043E\u043B\u043E\u043D\u043E\u043A \u043A\u0430\u0434\u0440\u043E\u0432"
            },
            rows: {
              type: "number",
              description: "\u0447\u0438\u0441\u043B\u043E \u0441\u0442\u0440\u043E\u043A \u043A\u0430\u0434\u0440\u043E\u0432"
            },
            fps: {
              type: "number",
              description: "\u043A\u0430\u0434\u0440\u043E\u0432 \u0432 \u0441\u0435\u043A\u0443\u043D\u0434\u0443 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 8)"
            },
            loop: {
              type: "boolean",
              description: "\u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0442\u044C \u0446\u0438\u043A\u043B (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 true)"
            }
          },
          required: [
            "sheet",
            "cols",
            "rows"
          ],
          additionalProperties: false,
          description: "\u0421\u043F\u0440\u0430\u0439\u0442-\u043B\u0438\u0441\u0442: \u043E\u0434\u0438\u043D \u0444\u0430\u0439\u043B-\u043B\u0438\u0441\u0442 \u0441 \u043A\u0430\u0434\u0440\u0430\u043C\u0438 \u0440\u0430\u0441\u043A\u043B\u0430\u0434\u043A\u0438 N\xD7M (\u043C\u0430\u0441\u0442\u0435\u0440\u0441\u043A\u0430\u044F \u0430\u043D\u0438\u043C\u0430\u0446\u0438\u044F\n\u0431\u0435\u0437 \u043D\u0430\u0440\u0435\u0437\u043A\u0438: \xAB\u0438\u0434\u0451\u0442 \u0434\u044B\u043C\xBB, \xAB\u0433\u043E\u0440\u0438\u0442 \u043E\u043A\u043D\u043E\xBB, \u043F\u043E\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u0435 \u043C\u043E\u0440\u044F). \u0420\u0430\u0437\u043C\u0435\u0440 \u043A\u0430\u0434\u0440\u0430\n\u0432\u044B\u0432\u043E\u0434\u0438\u0442\u0441\u044F \u0438\u0437 \u0440\u0430\u0437\u043C\u0435\u0440\u043E\u0432 \u0444\u0430\u0439\u043B\u0430 / \u0441\u0435\u0442\u043A\u0438."
        },
        ImageValue: {
          anyOf: [
            {
              type: "string"
            },
            {
              type: "array",
              items: {
                type: "string"
              }
            },
            {
              type: "object",
              properties: {
                frames: {
                  type: "array",
                  items: {
                    type: "string"
                  }
                },
                fps: {
                  type: "number"
                },
                loop: {
                  type: "boolean"
                }
              },
              required: [
                "frames"
              ],
              additionalProperties: false
            },
            {
              $ref: "#/$defs/SheetDoc"
            }
          ],
          description: "\u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u043F\u0430\u043A\u0435\u0442\u0430 \u043B\u0438\u0431\u043E \u0446\u0438\u043A\u043B \u043A\u0430\u0434\u0440\u043E\u0432 \u0434\u043B\u044F \xAB\u0436\u0438\u0432\u044B\u0445\xBB \u0441\u0446\u0435\u043D (frame-swap \u0430\u043D\u0438\u043C\u0430\u0446\u0438\u044F):\n\u0441\u0442\u0440\u043E\u043A\u0430 \u2014 \u0441\u0442\u0430\u0442\u0438\u0447\u043D\u043E (\u0432\u0441\u0435 \u0441\u0442\u0430\u0440\u044B\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438); \u043C\u0430\u0441\u0441\u0438\u0432 \u0441\u0442\u0440\u043E\u043A \u2014 \u043A\u0430\u0434\u0440\u044B \u0431\u0435\u0437 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A;\n\u043E\u0431\u044A\u0435\u043A\u0442 \u2014 \u043A\u0430\u0434\u0440\u044B + \u0442\u0435\u043C\u043F (\u043A\u0430\u0434\u0440/\u0441, \u0443\u043C\u043E\u043B\u0447. 2) + \u0437\u0430\u0446\u0438\u043A\u043B\u0435\u043D\u043D\u043E\u0441\u0442\u044C (\u0443\u043C\u043E\u043B\u0447. true)."
        },
        HeroPortraitOption: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            image: {
              $ref: "#/$defs/ImageValue"
            },
            states: {
              type: "object",
              additionalProperties: {
                $ref: "#/$defs/ImageValue"
              }
            },
            combat_figure: {
              $ref: "#/$defs/ImageValue",
              description: "\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u0430\u044F \u0444\u0438\u0433\u0443\u0440\u043A\u0430 \u0431\u043E\u044F, \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u043C\u0430\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u0438 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0438 \u0433\u0435\u0440\u043E\u044F"
            },
            combat_figure_mode: {
              type: "string",
              enum: [
                "topdown",
                "side",
                "static"
              ]
            },
            combat_facing_offset: {
              type: "number",
              description: "\u0441\u0434\u0432\u0438\u0433 \u0440\u0430\u0437\u0432\u043E\u0440\u043E\u0442\u0430 \u044D\u0442\u043E\u0439 \u0444\u0438\u0433\u0443\u0440\u043A\u0438, \u0433\u0440\u0430\u0434\u0443\u0441\u044B (\u0441\u043C. NpcDef.facing_offset)"
            }
          },
          required: [
            "id",
            "label",
            "image"
          ],
          additionalProperties: false,
          description: "\u041F\u043E\u0440\u0442\u0440\u0435\u0442 \u0433\u0435\u0440\u043E\u044F \u0438\u0437 \u0433\u0430\u043B\u0435\u0440\u0435\u0438 \u043C\u0430\u0441\u0442\u0435\u0440\u0430 (char_creation.portraits): \u0438\u0433\u0440\u043E\u043A \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u0442\n\u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443 \u043F\u0440\u0438 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0438 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430. states \u2014 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u044B \u043E\u0431\u043B\u0438\u043A\u0430 \u043F\u043E \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044E\n(\u043A\u043B\u044E\u0447\u0438 \u0438\u0437 \u043E\u0431\u0449\u0435\u0433\u043E \u0440\u0435\u0435\u0441\u0442\u0440\u0430 meta.emotions: \xAB\u0440\u0430\u043D\u0435\u043D\xBB, \xAB\u0443\u0441\u0442\u0430\u043B\xBB\u2026)."
        },
        HeroPortraitLayerDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string",
              description: "\u043F\u043E\u0434\u043F\u0438\u0441\u044C \u0441\u0435\u0433\u043C\u0435\u043D\u0442\u0430 \u0434\u043B\u044F \u0438\u0433\u0440\u043E\u043A\u0430 (\xAB\u041B\u0438\u0446\u043E\xBB, \xAB\u0426\u0432\u0435\u0442 \u043A\u043E\u0436\u0438\xBB, \xAB\u0422\u0430\u0442\u0443\u0438\u0440\u043E\u0432\u043A\u0430\xBB)"
            },
            category: {
              type: "string",
              enum: [
                "identity",
                "skin",
                "build",
                "face",
                "hair",
                "clothing",
                "markings",
                "other"
              ],
              description: "\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u0434\u043B\u044F \u0433\u0440\u0443\u043F\u043F\u0438\u0440\u043E\u0432\u043A\u0438 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A \u043D\u0430 \u044D\u043A\u0440\u0430\u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F"
            },
            options: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string"
                  },
                  label: {
                    type: "string"
                  },
                  image: {
                    $ref: "#/$defs/ImageValue"
                  },
                  states: {
                    type: "object",
                    additionalProperties: {
                      $ref: "#/$defs/ImageValue"
                    }
                  },
                  combat_figure: {
                    $ref: "#/$defs/ImageValue",
                    description: "\u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u0430\u044F \u0444\u0438\u0433\u0443\u0440\u043A\u0430 \u0431\u043E\u044F, \u0435\u0441\u043B\u0438 \u044D\u0442\u043E\u0442 \u0432\u044B\u0431\u043E\u0440 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0437\u0443\u0435\u0442 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0439 \u043E\u0431\u043B\u0438\u043A"
                  },
                  combat_figure_mode: {
                    type: "string",
                    enum: [
                      "topdown",
                      "side",
                      "static"
                    ]
                  },
                  combat_facing_offset: {
                    type: "number",
                    description: "\u0441\u0434\u0432\u0438\u0433 \u0440\u0430\u0437\u0432\u043E\u0440\u043E\u0442\u0430 \u044D\u0442\u043E\u0439 \u0444\u0438\u0433\u0443\u0440\u043A\u0438, \u0433\u0440\u0430\u0434\u0443\u0441\u044B (\u0441\u043C. NpcDef.facing_offset)"
                  }
                },
                required: [
                  "id",
                  "label",
                  "image"
                ],
                additionalProperties: false
              }
            }
          },
          required: [
            "id",
            "label",
            "options"
          ],
          additionalProperties: false,
          description: "\u0421\u043B\u043E\u0439 \u0441\u043E\u0441\u0442\u0430\u0432\u043D\u043E\u0433\u043E \u043F\u043E\u0440\u0442\u0440\u0435\u0442\u0430 (char_creation.portrait_layers): \xAB\u043B\u0438\u0446\u043E\xBB,\n\xAB\u0432\u043E\u043B\u043E\u0441\u044B\xBB, \xAB\u043E\u0434\u0435\u0436\u0434\u0430\xBB \u2014 \u0438\u0433\u0440\u043E\u043A \u0441\u043E\u0431\u0438\u0440\u0430\u0435\u0442 \u043E\u0431\u043B\u0438\u043A \u0438\u0437 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432 \u0441\u043B\u043E\u0451\u0432 \u043C\u0430\u0441\u0442\u0435\u0440\u0430,\n\u0438\u0442\u043E\u0433 \u2014 \u0441\u0442\u0435\u043A \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0439 \u043F\u043E \u043F\u043E\u0440\u044F\u0434\u043A\u0443 \u0441\u043B\u043E\u0451\u0432."
        },
        CharCreationDef: {
          type: "object",
          properties: {
            total_points: {
              type: "number",
              description: "\u0431\u044E\u0434\u0436\u0435\u0442 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A (\u043E\u0447\u043A\u0438 \u0441\u0432\u0435\u0440\u0445 \u043C\u0438\u043D\u0438\u043C\u0443\u043C\u0430)"
            },
            stat_limits: {
              type: "object",
              properties: {
                min: {
                  type: "number"
                },
                max: {
                  type: "number"
                }
              },
              required: [
                "min",
                "max"
              ],
              additionalProperties: false,
              description: "\u043F\u043E\u0440\u043E\u0433\u0438 \u043A\u0430\u0436\u0434\u043E\u0439 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 (\u0437\u0430\u0434\u0430\u0451\u0442 \u043C\u0430\u0441\u0442\u0435\u0440)"
            },
            skill_points: {
              type: "number",
              description: "\u0431\u044E\u0434\u0436\u0435\u0442 \u043D\u0430\u0432\u044B\u043A\u043E\u0432 (\u043D\u0435\u0442 \u2014 \u043F\u043E\u043A\u0443\u043F\u043A\u0438 \u043D\u0430\u0432\u044B\u043A\u043E\u0432 \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u044B)"
            },
            skill_cap: {
              type: "number",
              description: "\u043F\u043E\u0440\u043E\u0433 \u043D\u0430\u0432\u044B\u043A\u0430 \u0441\u0432\u0435\u0440\u0445\u0443 (\u043D\u0435\u0442 \u2014 \u0431\u0435\u0437 \u0432\u0435\u0440\u0445\u043D\u0435\u0433\u043E \u043F\u043E\u0440\u043E\u0433\u0430)"
            },
            skill_floor: {
              type: "number",
              description: "\u043F\u043E\u0440\u043E\u0433 \u043D\u0430\u0432\u044B\u043A\u0430 \u0441\u043D\u0438\u0437\u0443 (\u043D\u0435\u0442 \u2014 0)"
            },
            mandatory_skills: {
              type: "array",
              items: {
                type: "string"
              },
              description: "\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u043D\u0430\u0432\u044B\u043A\u0438 (\u0441\u0442\u0430\u0440\u0442\u0443\u044E\u0442 \u0441 25%)"
            },
            forbidden_skills: {
              type: "array",
              items: {
                type: "string"
              },
              description: "\u043D\u0435\u043B\u044C\u0437\u044F \u043F\u043E\u043A\u0443\u043F\u0430\u0442\u044C"
            },
            professions: {
              type: "array",
              items: {
                $ref: "#/$defs/ProfessionDef"
              },
              description: "\xAB\u043F\u0440\u043E\u0438\u0441\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u044F\xBB \u2014 \u0448\u0430\u0431\u043B\u043E\u043D\u044B \u0433\u0435\u0440\u043E\u044F (\u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u044E\u0442 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438)"
            },
            callings: {
              type: "array",
              items: {
                $ref: "#/$defs/CallingDef"
              },
              description: "\xAB\u043F\u0440\u0438\u0437\u0432\u0430\u043D\u0438\u044F\xBB \u2014 \u0448\u0430\u0431\u043B\u043E\u043D\u044B \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0445 \u043D\u0430\u0432\u044B\u043A\u043E\u0432 (\u0444\u0438\u0434\u0431\u0435\u043A 19)"
            },
            choose_name: {
              type: "boolean",
              description: "\u0432\u0432\u043E\u0434 \u0438\u043C\u0435\u043D\u0438 \u0433\u0435\u0440\u043E\u044F"
            },
            choose_age: {
              type: "boolean",
              description: "\u043F\u043E\u043B\u0435 \xAB\u0412\u043E\u0437\u0440\u0430\u0441\u0442\xBB \u043F\u0440\u0438 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0438 \u0433\u0435\u0440\u043E\u044F (\u0430\u0443\u0434\u0438\u0442 \xA75.6)"
            },
            choose_bio: {
              type: "boolean",
              description: "\u043F\u043E\u043B\u0435 \xAB\u0411\u0438\u043E\u0433\u0440\u0430\u0444\u0438\u044F\xBB \u2014 \u043A\u043E\u0440\u043E\u0442\u043A\u0430\u044F \u043F\u0440\u0435\u0434\u044B\u0441\u0442\u043E\u0440\u0438\u044F \u0441\u0432\u043E\u0438\u043C\u0438 \u0441\u043B\u043E\u0432\u0430\u043C\u0438"
            },
            portraits: {
              type: "array",
              items: {
                $ref: "#/$defs/HeroPortraitOption"
              },
              description: "\u0413\u0430\u043B\u0435\u0440\u0435\u044F \u043F\u043E\u0440\u0442\u0440\u0435\u0442\u043E\u0432 \u0433\u0435\u0440\u043E\u044F (\u043F\u0443\u043D\u043A\u0442 \xAB\u043F\u043E\u0440\u0442\u0440\u0435\u0442 \u0433\u0435\u0440\u043E\u044F\xBB): \u0438\u0433\u0440\u043E\u043A \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u0442 \u043E\u0434\u043D\u0443\n\u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443. \u041F\u0443\u0441\u0442\u043E \u2014 \u044D\u043A\u0440\u0430\u043D \u043F\u043E\u0440\u0442\u0440\u0435\u0442\u0430 \u043D\u0435 \u043F\u043E\u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F."
            },
            portrait_layers: {
              type: "array",
              items: {
                $ref: "#/$defs/HeroPortraitLayerDef"
              },
              description: "\u0421\u043E\u0441\u0442\u0430\u0432\u043D\u043E\u0439 \u043F\u043E\u0440\u0442\u0440\u0435\u0442 \u043F\u043E \u0441\u0435\u0433\u043C\u0435\u043D\u0442\u0430\u043C (\xAB\u043B\u0438\u0446\u043E\xBB, \xAB\u0432\u043E\u043B\u043E\u0441\u044B\xBB, \xAB\u043E\u0434\u0435\u0436\u0434\u0430\xBB): \u0438\u0433\u0440\u043E\u043A\n\u0441\u043E\u0431\u0438\u0440\u0430\u0435\u0442 \u043E\u0431\u043B\u0438\u043A \u0438\u0437 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432 \u043C\u0430\u0441\u0442\u0435\u0440\u0430. \u041C\u043E\u0436\u043D\u043E \u0441\u043E\u0447\u0435\u0442\u0430\u0442\u044C \u0441 \u0433\u0430\u043B\u0435\u0440\u0435\u0435\u0439 \u2014\n\u0441\u043E\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043F\u043E\u0440\u0442\u0440\u0435\u0442 \u043F\u0435\u0440\u0435\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u0443\u044E \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443, \u0435\u0441\u043B\u0438 \u0441\u0434\u0435\u043B\u0430\u043D \u0432\u044B\u0431\u043E\u0440\n\u0445\u043E\u0442\u044F \u0431\u044B \u0432 \u043E\u0434\u043D\u043E\u043C \u0441\u0435\u0433\u043C\u0435\u043D\u0442\u0435."
            },
            roll: {
              type: "object",
              properties: {
                notation: {
                  type: "string",
                  description: "\u0431\u0430\u0437\u043E\u0432\u0430\u044F \u0444\u043E\u0440\u043C\u0443\u043B\u0430 \u0434\u043B\u044F \u0432\u0441\u0435\u0445 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 '3d6', BRP)"
                },
                per_stat: {
                  type: "object",
                  additionalProperties: {
                    type: "string"
                  },
                  description: "\u043F\u0435\u0440\u0435\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044F \u043F\u043E \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0430\u043C (BRP: INT/SIZ \u2014 '2d6+6')"
                },
                arrays: {
                  type: "number",
                  description: "\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043D\u0430\u0431\u043E\u0440\u043E\u0432 \u0431\u0440\u043E\u0441\u0430\u0442\u044C \u0437\u0430 \u0440\u0430\u0437, \u0438\u0433\u0440\u043E\u043A \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u0442 \u043E\u0434\u0438\u043D (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 1;\nBRP-\u043F\u0440\u0430\u043A\u0442\u0438\u043A\u0430 \xAB\u0431\u0440\u043E\u0441\u044C \u0442\u0440\u0438 \u043D\u0430\u0431\u043E\u0440\u0430 \u2014 \u0432\u043E\u0437\u044C\u043C\u0438 \u043E\u0434\u0438\u043D\xBB \u0431\u0435\u0437 \u043F\u0435\u0440\u0435\u0431\u0440\u043E\u0441\u043E\u0432)"
                },
                rerolls: {
                  type: "number",
                  description: "\u043F\u0435\u0440\u0435\u0431\u0440\u043E\u0441\u044B: \u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A \u043C\u043E\u0436\u043D\u043E \u043F\u0435\u0440\u0435\u043A\u0438\u043D\u0443\u0442\u044C \u043F\u043E \u043E\u0434\u043D\u043E\u0439 \u0448\u0442\u0443\u043A\u0435\n\u043F\u043E\u0441\u043B\u0435 \u0432\u044B\u0431\u043E\u0440\u0430 \u043D\u0430\u0431\u043E\u0440\u0430 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 0)"
                },
                redistribute: {
                  type: "number",
                  description: "\u043E\u0447\u043A\u043E\u0432 \u043D\u0430 \u043F\u0435\u0440\u0435\u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u043C\u0435\u0436\u0434\u0443 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0430\u043C\u0438 \u043F\u043E\u0441\u043B\u0435 \u0432\u044B\u0431\u043E\u0440\u0430\n\u043D\u0430\u0431\u043E\u0440\u0430 (BRP \u0440\u0430\u0437\u0440\u0435\u0448\u0430\u0435\u0442 \u0441\u0434\u0432\u0438\u043D\u0443\u0442\u044C \u0434\u043E 3; \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 0)"
                }
              },
              additionalProperties: false,
              description: "\u0413\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u044F \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A \u041A\u0423\u0411\u0418\u041A\u0410\u041C\u0418 (\u0430\u0443\u0434\u0438\u0442 \xA75.6 \u043F.5, \u0431\u0430\u0437\u043E\u0432\u044B\u0439 \u043C\u0435\u0442\u043E\u0434 BRP).\n\u0417\u0430\u0434\u0430\u043D\u043E \u2014 \u043D\u0430 \u044D\u043A\u0440\u0430\u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F \u043F\u043E\u044F\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u0431\u0440\u043E\u0441\u043A\u0438 \u0432\u043C\u0435\u0441\u0442\u043E \u0431\u044E\u0434\u0436\u0435\u0442\u0430 \u043E\u0447\u043A\u043E\u0432;\n\u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 `profession.stats` \u0432 \u044D\u0442\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435 \u0438\u0433\u043D\u043E\u0440\u0438\u0440\u0443\u0435\u0442\u0441\u044F."
            }
          },
          required: [
            "total_points",
            "stat_limits"
          ],
          additionalProperties: false
        },
        CombatRulesDef: {
          type: "object",
          properties: {
            flee: {
              anyOf: [
                {
                  type: "boolean"
                },
                {
                  type: "object",
                  properties: {
                    skill: {
                      type: "string"
                    }
                  },
                  additionalProperties: false
                }
              ],
              description: "\u0411\u0435\u0433\u0441\u0442\u0432\u043E \u0438\u0433\u0440\u043E\u043A\u0430 \u0438\u0437 \u0431\u043E\u044F. \u0423\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 `true` (\u043A\u043D\u043E\u043F\u043A\u0430 \xAB\u0411\u0435\u0436\u0430\u0442\u044C\xBB \u0432 \u0431\u043E\u044E);\n`false` \u2014 \u0431\u0435\u0433\u0441\u0442\u0432\u043E \u0437\u0430\u043F\u0440\u0435\u0449\u0435\u043D\u043E \u0432\u043E \u0432\u0441\u0435\u0439 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438. \u041E\u0431\u044A\u0435\u043A\u0442: `{ skill }` \u2014\n\u043D\u0430\u0432\u044B\u043A \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u043E\u0442\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u044F (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 `dodge`; \u043D\u0435\u0442 \u0442\u0430\u043A\u043E\u0433\u043E \u043D\u0430\u0432\u044B\u043A\u0430 \u0443\n\u0433\u0435\u0440\u043E\u044F \u2014 \u0431\u0440\u043E\u0441\u043E\u043A DEX\xD75). \u0422\u043E\u0447\u0435\u0447\u043D\u044B\u0439 \u0437\u0430\u043F\u0440\u0435\u0442 \u0431\u043E\u044F \u2014 `no_flee` \u0432 start_combat."
            },
            multi_attack_penalty: {
              type: "number",
              description: "\u0428\u0442\u0440\u0430\u0444 \u043A\u0430\u0436\u0434\u043E\u0439 \u0421\u041B\u0415\u0414\u0423\u042E\u0429\u0415\u0419 \u0430\u0442\u0430\u043A\u0438 \u0431\u043E\u0439\u0446\u0430 \u0432 \u0442\u043E\u043C \u0436\u0435 \u0440\u0430\u0443\u043D\u0434\u0435 (\u043E\u0440\u0443\u0436\u0438\u0435 \u0441\n`attacks_per_round > 1`): \u0432\u0442\u043E\u0440\u043E\u0439 \u0443\u0434\u0430\u0440 \u0438\u0434\u0451\u0442 \u043D\u0430 penalty\xD71, \u0442\u0440\u0435\u0442\u0438\u0439 \u2014 \xD72\u2026\n\u0423\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 \u221220 (\u0440\u0430\u0437\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u043D\u0430\u0432\u044B\u043A\u0430 \u043F\u043E \u0434\u0443\u0445\u0443 BRP); 0 \u2014 \u0432\u0441\u0435 \u0430\u0442\u0430\u043A\u0438 \u0440\u043E\u0432\u043D\u044B\u0435."
            },
            aim: {
              anyOf: [
                {
                  type: "boolean"
                },
                {
                  type: "object",
                  properties: {
                    bonus: {
                      type: "number"
                    }
                  },
                  additionalProperties: false
                }
              ],
              description: "\u041F\u0440\u0438\u0446\u0435\u043B\u044C\u043D\u0430\u044F \u0430\u0442\u0430\u043A\u0430: \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \xAB\u041F\u0440\u0438\u0446\u0435\u043B\u0438\u0442\u044C\u0441\u044F\xBB \u0442\u0440\u0430\u0442\u0438\u0442 \u043E\u0434\u043D\u0443 \u0430\u0442\u0430\u043A\u0443 \u0438\u0437 \u043A\u0440\u0430\u044F \u0438\n\u0434\u0430\u0451\u0442 +bonus \u043A \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 \u0432\u043A\u043B., \u0431\u043E\u043D\u0443\u0441 +20). false \u2014 \u0432\u044B\u043A\u043B."
            },
            opportunity_attacks: {
              type: "boolean",
              description: "\u0410\u0442\u0430\u043A\u0438 \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0438 (\u0430\u0443\u0434\u0438\u0442 B5): \u0443\u0445\u043E\u0434 \u0438\u0437 \u0433\u0435\u043A\u0441\u0430, \u0443\u0433\u0440\u043E\u0436\u0430\u0435\u043C\u043E\u0433\u043E \u0432\u0440\u0430\u0433\u043E\u043C,\n\u0432\u044B\u0437\u044B\u0432\u0430\u0435\u0442 \u0443 \u043D\u0435\u0433\u043E \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u044B\u0439 \u0443\u0434\u0430\u0440. \u0423\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 \u0432\u043A\u043B. (\u043A\u043D\u0438\u0436\u043D\u043E); false \u2014 \u0432\u044B\u043A\u043B."
            },
            fumble_table: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  weight: {
                    type: "number"
                  },
                  kind: {
                    type: "string",
                    enum: [
                      "drop_weapon",
                      "stuck",
                      "self_hit",
                      "skip_next"
                    ],
                    description: "\u0447\u0442\u043E \u0441\u043B\u0443\u0447\u0430\u0435\u0442\u0441\u044F \u0441 \u0431\u043E\u0439\u0446\u043E\u043C"
                  },
                  text: {
                    type: "string",
                    description: "\u0441\u0442\u0440\u043E\u043A\u0430 \u0434\u043B\u044F \u0436\u0443\u0440\u043D\u0430\u043B\u0430 (\u043D\u0435\u0442 \u2014 \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u0430\u044F)"
                  }
                },
                required: [
                  "weight",
                  "kind"
                ],
                additionalProperties: false
              },
              description: "\u0422\u0430\u0431\u043B\u0438\u0446\u0430 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u043F\u0440\u043E\u0432\u0430\u043B\u043E\u0432 \u043C\u0430\u0441\u0442\u0435\u0440\u0430: \u0431\u0440\u043E\u0441\u043E\u043A \u043F\u043E \u0432\u0435\u0441\u0430\u043C \u043F\u0440\u0438 fumble.\n\u041D\u0435\u0442 \u2014 fumble \u043B\u0438\u0448\u044C \u043F\u0440\u043E\u043C\u0430\u0445 (\u0438 \u0438\u0437\u043D\u043E\u0441 \u043E\u0440\u0443\u0436\u0438\u044F, \u0435\u0441\u043B\u0438 \u0437\u0430\u0434\u0430\u043D\u0430 \u043F\u0440\u043E\u0447\u043D\u043E\u0441\u0442\u044C)."
            },
            crit_table: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  weight: {
                    type: "number"
                  },
                  kind: {
                    type: "string",
                    enum: [
                      "max_damage",
                      "double_damage",
                      "disarm",
                      "status"
                    ]
                  },
                  status: {
                    type: "string",
                    description: "id \u0441\u0442\u0430\u0442\u0443\u0441\u0430 \u0440\u0435\u0435\u0441\u0442\u0440\u0430 (kind='status')"
                  },
                  duration: {
                    type: "number",
                    description: "\u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0441\u0442\u0430\u0442\u0443\u0441\u0430 \u0432 \u0445\u043E\u0434\u0430\u0445 (\u043D\u0435\u0442 \u2014 \u043A\u0430\u043A \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u043E \u0432 \u0440\u0435\u0435\u0441\u0442\u0440\u0435)"
                  },
                  text: {
                    type: "string",
                    description: "\u0441\u0442\u0440\u043E\u043A\u0430 \u0434\u043B\u044F \u0436\u0443\u0440\u043D\u0430\u043B\u0430 (\u043D\u0435\u0442 \u2014 \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u0430\u044F)"
                  }
                },
                required: [
                  "weight",
                  "kind"
                ],
                additionalProperties: false
              },
              description: "\u0422\u0430\u0431\u043B\u0438\u0446\u0430 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u0443\u0441\u043F\u0435\u0445\u043E\u0432 \u043C\u0430\u0441\u0442\u0435\u0440\u0430 (\u0431\u043B\u0438\u0437\u043D\u0435\u0446 fumble_table): \u0431\u0440\u043E\u0441\u043E\u043A\n\u043F\u043E \u0432\u0435\u0441\u0430\u043C \u043F\u0440\u0438 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u043C \u0443\u0434\u0430\u0440\u0435.\n- max_damage \u2014 \u043A\u043D\u0438\u0436\u043D\u044B\u0439 \u043A\u0440\u0438\u0442: \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C \u043A\u043E\u0441\u0442\u0435\u0439, \u0431\u0440\u043E\u043D\u044F \u043D\u0435 \u0441\u043F\u0430\u0441\u0430\u0435\u0442 (\u043A\u0430\u043A \u043E\u0431\u044B\u0447\u043D\u043E);\n- double_damage \u2014 \u0443\u0440\u043E\u043D \u0431\u0440\u043E\u0441\u0430\u0435\u0442\u0441\u044F \u043E\u0431\u044B\u0447\u043D\u043E \u0438 \u0443\u0434\u0432\u0430\u0438\u0432\u0430\u0435\u0442\u0441\u044F (\u0431\u0440\u043E\u043D\u044F \u0443\u0447\u0438\u0442\u044B\u0432\u0430\u0435\u0442\u0441\u044F);\n- disarm \u2014 \u043A\u043D\u0438\u0436\u043D\u044B\u0439 \u043A\u0440\u0438\u0442 + \u0446\u0435\u043B\u044C \u0440\u0430\u0437\u043E\u0440\u0443\u0436\u0435\u043D\u0430;\n- status \u2014 \u043A\u043D\u0438\u0436\u043D\u044B\u0439 \u043A\u0440\u0438\u0442 + \u043D\u0430 \u0446\u0435\u043B\u044C \u0441\u0442\u0430\u0442\u0443\u0441 \u0438\u0437 \u0440\u0435\u0435\u0441\u0442\u0440\u0430.\n\u041D\u0435\u0442 \u2014 \u043A\u0440\u0438\u0442 \u0432\u0441\u0435\u0433\u0434\u0430 \u043A\u043D\u0438\u0436\u043D\u044B\u0439 (max_damage)."
            },
            flank: {
              anyOf: [
                {
                  type: "boolean"
                },
                {
                  type: "object",
                  properties: {
                    arc: {
                      type: "number"
                    },
                    damage_bonus: {
                      type: "string"
                    }
                  },
                  additionalProperties: false
                }
              ],
              description: "\u0423\u0434\u0430\u0440 \u0432 \u0441\u043F\u0438\u043D\u0443 / \u0444\u043B\u0430\u043D\u0433\u043E\u0432\u044B\u0439 \u0443\u0434\u0430\u0440 (\u0430\u0443\u0434\u0438\u0442 \xA75.6): \u0430\u0442\u0430\u043A\u0430 \u0438\u0437 \u0437\u0430\u0434\u043D\u0435\u0439 \u0434\u0443\u0433\u0438 \u0446\u0435\u043B\u0438\n(\u0437\u0430 \u043D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435\u043C \u0435\u0451 \u0432\u0437\u0433\u043B\u044F\u0434\u0430; \u0434\u0443\u0433\u0430 \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 120\xB0 \u2014 \u0437\u0430\u0434\u043D\u0438\u0439 \u0433\u0435\u043A\u0441 \u0438 \u0434\u0432\u0430\n\u0437\u0430\u0434\u043D\u0435-\u0444\u043B\u0430\u043D\u0433\u043E\u0432\u044B\u0445) \u043B\u0438\u0448\u0430\u0435\u0442 \u0446\u0435\u043B\u044C \u0437\u0430\u0449\u0438\u0442\u044B, \u0430 \u043F\u0440\u0438 damage_bonus \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0435\u0442\n\u043A\u043E\u0441\u0442\u0438 \u0443\u0440\u043E\u043D\u0430 (\xAB1d4\xBB). false/\u043D\u0435\u0442 \u2014 \u043C\u0435\u0445\u0430\u043D\u0438\u043A\u0430 \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u0430."
            },
            cover: {
              anyOf: [
                {
                  type: "boolean"
                },
                {
                  type: "object",
                  properties: {
                    penalty: {
                      type: "number"
                    }
                  },
                  additionalProperties: false
                }
              ],
              description: "\u0423\u043A\u0440\u044B\u0442\u0438\u044F \u043D\u0430 \u0430\u0440\u0435\u043D\u0435: \u0434\u0430\u043B\u044C\u043D\u043E\u0431\u043E\u0439\u043D\u0430\u044F \u0430\u0442\u0430\u043A\u0430 (\u0434\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u043E\u0440\u0443\u0436\u0438\u044F > 1) \u043F\u043E \u0431\u043E\u0439\u0446\u0443,\n\u0441\u0442\u043E\u044F\u0449\u0435\u043C\u0443 \u043D\u0430 \u0433\u0435\u043A\u0441\u0435 \u0443\u043A\u0440\u044B\u0442\u0438\u044F (cover_hexes \u0432 \u0440\u0430\u0437\u043C\u0435\u0442\u043A\u0435 \u0430\u0440\u0435\u043D\u044B), \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442\n\u0448\u0442\u0440\u0430\u0444 \u043A \u043D\u0430\u0432\u044B\u043A\u0443 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 \u221220). \u041D\u0430 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435 \u0443\u043A\u0440\u044B\u0442\u0438\u044F \u043D\u0435 \u0432\u043B\u0438\u044F\u044E\u0442.\nfalse/\u043D\u0435\u0442 \u2014 \u043C\u0435\u0445\u0430\u043D\u0438\u043A\u0430 \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u0430."
            },
            hit_locations: {
              type: "object",
              properties: {
                table: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      from: {
                        type: "number"
                      },
                      to: {
                        type: "number"
                      },
                      label: {
                        type: "string",
                        description: "\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043B\u043E\u043A\u0430\u0446\u0438\u0438 (\xAB\u0433\u043E\u043B\u043E\u0432\u0430\xBB, \xAB\u0442\u0435\u043B\u043E\xBB, \xAB\u043F\u0440\u0430\u0432\u0430\u044F \u0440\u0443\u043A\u0430\xBB\u2026)"
                      },
                      damage_mult: {
                        type: "number",
                        description: "\u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0443\u0440\u043E\u043D\u0430 \u043B\u043E\u043A\u0430\u0446\u0438\u0438 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 \xD71)"
                      },
                      armor: {
                        type: "number",
                        description: "\u0431\u0440\u043E\u043D\u044F \u043B\u043E\u043A\u0430\u0446\u0438\u0438 \u0432 \u043E\u0447\u043A\u0430\u0445 (\u043D\u0435\u0442 \u2014 \u043E\u0431\u0449\u0430\u044F \u0431\u0440\u043E\u043D\u044F \u0437\u0430\u0449\u0438\u0442\u043D\u0438\u043A\u0430)"
                      },
                      status_on_hit: {
                        type: "string",
                        description: "\u0441\u0442\u0430\u0442\u0443\u0441 \u0446\u0435\u043B\u0438 \u043F\u0440\u0438 \u043F\u0440\u043E\u0431\u0438\u0432\u0448\u0435\u043C \u0443\u0434\u0430\u0440\u0435"
                      },
                      status_on_crit: {
                        type: "string",
                        description: "\u0441\u0442\u0430\u0442\u0443\u0441 \u0446\u0435\u043B\u0438 \u043F\u0440\u0438 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u043C \u0443\u0434\u0430\u0440\u0435"
                      },
                      text: {
                        type: "string",
                        description: "\u0441\u0442\u0440\u043E\u043A\u0430 \u0436\u0443\u0440\u043D\u0430\u043B\u0430 (\u043D\u0435\u0442 \u2014 \xAB\u041F\u043E\u043F\u0430\u0434\u0430\u043D\u0438\u0435: <label>\xBB)"
                      }
                    },
                    required: [
                      "from",
                      "to",
                      "label"
                    ],
                    additionalProperties: false
                  },
                  description: "\u043F\u0440\u043E\u0446\u0435\u043D\u0442\u043D\u0430\u044F \u0442\u0430\u0431\u043B\u0438\u0446\u0430; \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u044B [from..to] \u0434\u043E\u043B\u0436\u043D\u044B \u043F\u043E\u043A\u0440\u044B\u0442\u044C 1..100"
                }
              },
              required: [
                "table"
              ],
              additionalProperties: false,
              description: "\u0425\u0438\u0442-\u043B\u043E\u043A\u0430\u0446\u0438\u0438 (\u043A\u043D\u0438\u0436\u043D\u0430\u044F \u043E\u043F\u0446\u0438\u044F, \u0430\u0443\u0434\u0438\u0442 \xA75.6 \u2014 \u0420\u0415\u0428\u0415\u041D\u0418\u0415 \u041C\u0410\u0421\u0422\u0415\u0420\u0410).\n\u041F\u0440\u0438 \u0443\u0434\u0430\u0447\u043D\u043E\u043C \u0443\u0434\u0430\u0440\u0435 \u0431\u0440\u043E\u0441\u0430\u0435\u0442\u0441\u044F d100 \u0438 \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u0442\u0441\u044F \u043B\u043E\u043A\u0430\u0446\u0438\u044E \u043F\u043E\u043F\u0430\u0434\u0430\u043D\u0438\u044F:\n\u0443 \u043D\u0435\u0451 \u0441\u0432\u043E\u0439 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0443\u0440\u043E\u043D\u0430, \u0441\u0432\u043E\u044F \u0431\u0440\u043E\u043D\u044F (\u043D\u0435\u0442 \u2014 \u043E\u0431\u0449\u0430\u044F) \u0438 \u0441\u0442\u0430\u0442\u0443\u0441\u044B\n\u043F\u0440\u0438 \u0440\u0430\u043D\u0435\u043D\u0438\u0438/\u043A\u0440\u0438\u0442\u0435. \u0423\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 \u2014 \u0412\u042B\u041A\u041B\u042E\u0427\u0415\u041D\u041E (\u0435\u0434\u0438\u043D\u043E\u0435 \u0442\u0435\u043B\u043E)."
            },
            death: {
              type: "object",
              properties: {
                mode: {
                  type: "string",
                  enum: [
                    "instant",
                    "brp"
                  ]
                },
                con_multiplier: {
                  type: "number"
                }
              },
              additionalProperties: false,
              description: "\u041F\u0440\u0430\u0432\u0438\u043B\u0430 \u0433\u0438\u0431\u0435\u043B\u0438 \u0433\u0435\u0440\u043E\u044F.\n`instant` (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435) \u2014 0 HP = \u0441\u043C\u0435\u0440\u0442\u044C (\u0440\u043E\u0433\u0430\u043B\u0438\u043A-\u043A\u043B\u0430\u0441\u0441\u0438\u043A\u0430).\n`brp` \u2014 \u043A\u043D\u0438\u0436\u043D\u044B\u0439 \u0432\u0430\u0440\u0438\u0430\u043D\u0442: \u0435\u0434\u0438\u043D\u0438\u0447\u043D\u044B\u0439 \u0443\u0434\u0430\u0440 \u2265 \u043F\u043E\u043B\u043E\u0432\u0438\u043D\u044B \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C\u0430 HP \u2014\n\u0442\u044F\u0436\u0451\u043B\u0430\u044F \u0440\u0430\u043D\u0430 (\u0441\u043F\u0430\u0441\u0431\u0440\u043E\u0441\u043E\u043A CON\xD7con_multiplier, \u043F\u0440\u043E\u0432\u0430\u043B \u2014 \u043F\u043E\u0442\u0435\u0440\u044F \u0441\u043E\u0437\u043D\u0430\u043D\u0438\u044F\n\u0434\u043E \u043A\u043E\u043D\u0446\u0430 \u0431\u043E\u044F); \u043F\u0440\u0438 \u043F\u0430\u0434\u0435\u043D\u0438\u0438 HP \u0434\u043E \u043D\u0443\u043B\u044F \u2014 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0441\u043F\u0430\u0441\u0431\u0440\u043E\u0441\u043E\u043A CON:\n\u0443\u0441\u043F\u0435\u0445 \u2014 \u0433\u0435\u0440\u043E\u0439 \u0432\u044B\u0436\u0438\u0432\u0430\u0435\u0442 \u0431\u0435\u0437 \u0441\u043E\u0437\u043D\u0430\u043D\u0438\u044F (1 HP), \u0431\u043E\u0439 \u043F\u0440\u043E\u0438\u0433\u0440\u0430\u043D, \u0430 \u043F\u043E\u0441\u043B\u0435\u0434\u0441\u0442\u0432\u0438\u044F\n\u043F\u0440\u043E\u0438\u0433\u0440\u044B\u0448\u0430 \u0437\u0430\u0434\u0430\u0451\u0442 \u043C\u0430\u0441\u0442\u0435\u0440 (`on_defeat` \u0443 \u044D\u0444\u0444\u0435\u043A\u0442\u0430 start_combat; \u043D\u0435 \u0437\u0430\u0434\u0430\u043D\u043E \u2014\n\u0440\u0430\u043D\u044B \u0441\u043C\u0435\u0440\u0442\u0435\u043B\u044C\u043D\u044B, \u0441\u043C\u0435\u0440\u0442\u044C \u043A\u0430\u043A \u043E\u0431\u044B\u0447\u043D\u043E). \u041F\u0440\u043E\u0432\u0430\u043B \u0441\u043F\u0430\u0441\u0431\u0440\u043E\u0441\u043A\u0430 \u2014 \u0441\u043C\u0435\u0440\u0442\u044C.\n\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u0438 \u043D\u0430 \u043C\u0438\u0440\u043E\u0432\u043E\u0439 \u0443\u0440\u043E\u043D \u0432\u043D\u0435 \u0431\u043E\u044F (change_hp)."
            }
          },
          additionalProperties: false,
          description: "\u0411\u043E\u0435\u0432\u044B\u0435 \u043F\u0440\u0430\u0432\u0438\u043B\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438: \u0432\u0441\u0451 \u043E\u0442\u0434\u0430\u0451\u0442\u0441\u044F \u043C\u0430\u0441\u0442\u0435\u0440\u0443, \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435 \u043F\u043E\u043B\u044F \u2014\n\u043F\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0439 \u0434\u043E \u043F\u043E\u044F\u0432\u043B\u0435\u043D\u0438\u044F \u0431\u043B\u043E\u043A\u0430 (\u043E\u0431\u0440\u0430\u0442\u043D\u0430\u044F \u0441\u043E\u0432\u043C\u0435\u0441\u0442\u0438\u043C\u043E\u0441\u0442\u044C)."
        },
        FeatDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            description: {
              type: "string"
            },
            requires: {
              type: "array",
              items: {
                $ref: "#/$defs/Condition"
              },
              description: "\u0443\u0441\u043B\u043E\u0432\u0438\u044F-\u043F\u0440\u0435\u0434\u043F\u043E\u0441\u044B\u043B\u043A\u0438: \u0432\u0441\u0435 \u0438\u0441\u0442\u0438\u043D\u043D\u044B \u2014 \u0447\u0435\u0440\u0442\u0443 \u043C\u043E\u0436\u043D\u043E \u0432\u0437\u044F\u0442\u044C"
            },
            mods: {
              type: "object",
              properties: {
                skills: {
                  type: "object",
                  additionalProperties: {
                    type: "number"
                  }
                },
                stats: {
                  type: "object",
                  additionalProperties: {
                    type: "number"
                  }
                },
                hp: {
                  type: "number"
                },
                mp: {
                  type: "number"
                },
                mov: {
                  type: "number"
                }
              },
              additionalProperties: false,
              description: "\u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0435 \u043F\u0440\u0438\u0431\u0430\u0432\u043A\u0438 \u043F\u0440\u0438 \u0432\u0437\u044F\u0442\u0438\u0438"
            }
          },
          required: [
            "id",
            "label"
          ],
          additionalProperties: false,
          description: "\u0427\u0435\u0440\u0442\u0430 \u043F\u0440\u043E\u043A\u0430\u0447\u043A\u0438 (\u0430\u0443\u0434\u0438\u0442 B8, meta.progression.feats): \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0439 \u0431\u043E\u043D\u0443\u0441 \u0433\u0435\u0440\u043E\u044F.\n\u041C\u0435\u0441\u044F\u0435\u0442 \u043D\u0430\u0432\u044B\u043A\u0438, \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438, HP/MP, \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435; \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E\u0441\u0442\u0438 \u2014\n\u043E\u0431\u044B\u0447\u043D\u044B\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 (requires)."
        },
        MetaCurrencyDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            icon: {
              type: "string"
            },
            description: {
              type: "string"
            }
          },
          required: [
            "id",
            "label"
          ],
          additionalProperties: false,
          description: "\u041C\u0435\u0442\u0430\u0432\u0430\u043B\u044E\u0442\u0430: \u043A\u043E\u043F\u0438\u0442\u0441\u044F \u043C\u0435\u0436\u0434\u0443 \u0437\u0430\u0431\u0435\u0433\u0430\u043C\u0438, \u0442\u0440\u0430\u0442\u0438\u0442\u0441\u044F \u043D\u0430 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0435 \u0443\u0441\u0438\u043B\u0435\u043D\u0438\u044F."
        },
        AchievementDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            description: {
              type: "string"
            },
            icon: {
              type: "string"
            },
            hidden: {
              type: "boolean",
              description: "\u043D\u0435 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0432 \u0441\u043F\u0438\u0441\u043A\u0435 \u0434\u043E \u043E\u0442\u043A\u0440\u044B\u0442\u0438\u044F"
            },
            conditions: {
              type: "array",
              items: {
                $ref: "#/$defs/Condition"
              },
              description: "\u0443\u0441\u043B\u043E\u0432\u0438\u044F \u2014 \u0432\u0441\u0435 \u0438\u0441\u0442\u0438\u043D\u043D\u044B \u0434\u043B\u044F \u043E\u0442\u043A\u0440\u044B\u0442\u0438\u044F (\u0438\u043D\u0430\u0447\u0435 \u0441\u0447\u0451\u0442\u0447\u0438\u043A)"
            },
            counter: {
              type: "object",
              properties: {
                stat: {
                  type: "string",
                  enum: [
                    "travels",
                    "dialogues",
                    "ticks_survived",
                    "kills",
                    "quests_completed"
                  ]
                },
                target: {
                  type: "number"
                }
              },
              required: [
                "stat",
                "target"
              ],
              additionalProperties: false,
              description: "\u043D\u0430\u043A\u043E\u043F\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u043C\u0435\u0442\u0440\u0438\u043A\u0430: \u043F\u043E\u043B\u0435 stats_run \u0441\u0443\u043C\u043C\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u043F\u043E \u0432\u0441\u0435\u043C \u0437\u0430\u0431\u0435\u0433\u0430\u043C"
            },
            reward: {
              type: "object",
              properties: {
                currency: {
                  type: "string"
                },
                amount: {
                  type: "number"
                },
                xp: {
                  type: "number"
                }
              },
              additionalProperties: false,
              description: "\u043D\u0430\u0433\u0440\u0430\u0434\u0430 \u043F\u0440\u0438 \u043E\u0442\u043A\u0440\u044B\u0442\u0438\u0438"
            }
          },
          required: [
            "id",
            "label"
          ],
          additionalProperties: false,
          description: "\u0414\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438: \u0443\u0441\u043B\u043E\u0432\u0438\u0435 \u0438\u0441\u0442\u0438\u043D\u043D\u043E \u043F\u0440\u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0435 (\u0442\u0438\u043A, \u044D\u0444\u0444\u0435\u043A\u0442\u044B, \u043A\u043E\u043D\u0435\u0446\n\u0437\u0430\u0431\u0435\u0433\u0430) \u2192 \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043D\u0430\u0432\u0441\u0435\u0433\u0434\u0430. \u041B\u0438\u0431\u043E \u0441\u0447\u0451\u0442\u0447\u0438\u043A stats-\u0441\u0443\u043C\u043C\u044B \u043A \u0446\u0435\u043B\u0438.\n\u041D\u0430\u0433\u0440\u0430\u0434\u0430 \u2014 \u0432 \u043C\u0435\u0442\u0430\u0432\u0430\u043B\u044E\u0442\u0435 \u0438\u043B\u0438 \u0432 \u043E\u043F\u044B\u0442\u0435 \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u0437\u0430\u0431\u0435\u0433\u0430."
        },
        MetaUnlockDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            description: {
              type: "string"
            },
            icon: {
              type: "string"
            },
            cost: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  currency: {
                    type: "string"
                  },
                  amount: {
                    type: "number"
                  }
                },
                required: [
                  "currency",
                  "amount"
                ],
                additionalProperties: false
              },
              description: "\u0446\u0435\u043D\u0430 \u0432 \u043C\u0435\u0442\u0430\u0432\u0430\u043B\u044E\u0442\u0430\u0445"
            },
            grants: {
              type: "array",
              items: {
                $ref: "#/$defs/Effect"
              },
              description: "\u044D\u0444\u0444\u0435\u043A\u0442\u044B, \u0438\u0441\u043F\u043E\u043B\u043D\u044F\u0435\u043C\u044B\u0435 \u043E\u0434\u0438\u043D \u0440\u0430\u0437 \u043F\u0440\u0438 \u0441\u0442\u0430\u0440\u0442\u0435 \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u043D\u043E\u0432\u043E\u0433\u043E \u0437\u0430\u0431\u0435\u0433\u0430"
            },
            requires: {
              type: "array",
              items: {
                $ref: "#/$defs/Condition"
              },
              description: "\u0443\u0441\u043B\u043E\u0432\u0438\u044F \u0432\u0438\u0434\u0438\u043C\u043E\u0441\u0442\u0438/\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E\u0441\u0442\u0438 \u0432 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0435 (\u0432\u0441\u0435 \u0438\u0441\u0442\u0438\u043D\u043D\u044B)"
            }
          },
          required: [
            "id",
            "label",
            "cost",
            "grants"
          ],
          additionalProperties: false,
          description: "\u041F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u043E\u0435 \u0443\u0441\u0438\u043B\u0435\u043D\u0438\u0435, \u043A\u0443\u043F\u043B\u0435\u043D\u043D\u043E\u0435 \u0437\u0430 \u043C\u0435\u0442\u0430\u0432\u0430\u043B\u044E\u0442\u0443; \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u043A\u0430\u0436\u0434\u043E\u043C \u043D\u043E\u0432\u043E\u043C \u0437\u0430\u0431\u0435\u0433\u0435."
        },
        MetaProgressDef: {
          type: "object",
          properties: {
            currencies: {
              type: "array",
              items: {
                $ref: "#/$defs/MetaCurrencyDef"
              },
              description: "\u043C\u0435\u0442\u0430\u0432\u0430\u043B\u044E\u0442\u044B"
            },
            achievements: {
              type: "array",
              items: {
                $ref: "#/$defs/AchievementDef"
              },
              description: "\u0440\u0435\u0435\u0441\u0442\u0440 \u0434\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u0439"
            },
            unlocks: {
              type: "array",
              items: {
                $ref: "#/$defs/MetaUnlockDef"
              },
              description: "\u043C\u0430\u0433\u0430\u0437\u0438\u043D \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0445 \u0443\u0441\u0438\u043B\u0435\u043D\u0438\u0439"
            }
          },
          additionalProperties: false,
          description: "\u041A\u043E\u043D\u0444\u0438\u0433 \u043C\u0435\u0442\u0430-\u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 (\u0432\u043A\u043B\u044E\u0447\u0451\u043D \u0441\u0430\u043C\u0438\u043C \u043D\u0430\u043B\u0438\u0447\u0438\u0435\u043C \u0431\u043B\u043E\u043A\u0430)."
        },
        EventTableDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            description: {
              type: "string"
            },
            disabled: {
              type: "boolean",
              description: "\u0442\u0430\u0431\u043B\u0438\u0446\u0430 \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0430"
            },
            interval_ticks: {
              type: "number",
              description: "\u043F\u043E\u043B\u043D\u044B\u0439 \u043F\u043E\u0440\u044F\u0434\u043E\u043A: \u043A\u0430\u0436\u0434\u044B\u0435 interval_ticks \u0442\u0438\u043A\u043E\u0432 \u043C\u0438\u0440\u0430 \u2014 \u043E\u0434\u0438\u043D \u0431\u0440\u043E\u0441\u043E\u043A \u043D\u0430 \u0441\u043E\u0431\u044B\u0442\u0438\u0435"
            },
            chance: {
              type: "number",
              description: "\u0448\u0430\u043D\u0441, \u0447\u0442\u043E \u043D\u0430 \u044D\u0442\u043E\u043C \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u0435 \u0432\u043E\u043E\u0431\u0449\u0435 \u043F\u0440\u043E\u0438\u0437\u043E\u0439\u0434\u0451\u0442 \u0441\u043E\u0431\u044B\u0442\u0438\u0435 (0..1; \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 1)"
            },
            time_of_day: {
              type: "array",
              items: {
                $ref: "#/$defs/TimeOfDay"
              },
              description: "\u0432\u0440\u0435\u043C\u044F \u0441\u0443\u0442\u043E\u043A, \u043A\u043E\u0433\u0434\u0430 \u0442\u0430\u0431\u043B\u0438\u0446\u0430 \u0430\u043A\u0442\u0438\u0432\u043D\u0430 (\u043D\u0435\u0442 \u2014 \u0432\u0441\u0435\u0433\u0434\u0430)"
            },
            locations: {
              type: "array",
              items: {
                type: "string"
              },
              description: "\u043B\u043E\u043A\u0430\u0446\u0438\u0438, \u0433\u0434\u0435 \u0442\u0430\u0431\u043B\u0438\u0446\u0430 \u0430\u043A\u0442\u0438\u0432\u043D\u0430 (\u043D\u0435\u0442 \u2014 \u0432\u0435\u0437\u0434\u0435)"
            },
            rules: {
              type: "array",
              items: {
                type: "string"
              },
              description: "\u0420\u0443\u0447\u043D\u044B\u0435 \u043F\u0440\u0430\u0432\u0438\u043B\u0430-\u043A\u0430\u043D\u0434\u0438\u0434\u0430\u0442\u044B. \u0412 \u0431\u0440\u043E\u0441\u043A\u0435 \u0443\u0447\u0430\u0441\u0442\u0432\u0443\u044E\u0442 \u0442\u0435, \u0447\u044C\u0438 \u041F\u0420\u0415\u0414\u041F\u041E\u0421\u042B\u041B\u041A\u0418\n(rule.conditions) \u0438\u0441\u0442\u0438\u043D\u043D\u044B \u043F\u0440\u044F\u043C\u043E \u0441\u0435\u0439\u0447\u0430\u0441; \u0432\u044B\u043F\u0430\u0432\u0448\u0435\u0435 \u043F\u0440\u0430\u0432\u0438\u043B\u043E \u0438\u0441\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F\n(\u043A\u0430\u043A \u043F\u0440\u0438 fire_rule). \u041F\u043E\u0432\u0442\u043E\u0440\u044B \u2014 \u043A\u0430\u043A \u0443 \u043F\u0440\u0430\u0432\u0438\u043B: once-\u043F\u0440\u0430\u0432\u0438\u043B\u043E \u0441\u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442\n\u0435\u0434\u0438\u043D\u043E\u0436\u0434\u044B, \u043E\u0431\u044B\u0447\u043D\u043E\u0435 \u043C\u043E\u0436\u0435\u0442 \u0432\u044B\u043F\u0430\u0441\u0442\u044C \u0441\u043D\u043E\u0432\u0430."
            }
          },
          required: [
            "id",
            "label",
            "interval_ticks",
            "rules"
          ],
          additionalProperties: false,
          description: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u043E\u0434\u043D\u043E\u0439 \u0442\u0430\u0431\u043B\u0438\u0446\u044B \u0441\u043E\u0431\u044B\u0442\u0438\u0439 (\u043C\u0430\u0441\u0442\u0435\u0440 \u0440\u0435\u0448\u0430\u0435\u0442 \u0442\u0430\u0439\u043C\u0438\u043D\u0433 \u0438 \u0448\u0430\u043D\u0441\u044B)."
        },
        GenWeightedItem: {
          type: "object",
          properties: {
            value: {
              type: "string"
            },
            weight: {
              type: "number"
            }
          },
          required: [
            "value"
          ],
          additionalProperties: false,
          description: "\u0412\u043E\u043B\u044C\u043D\u044B\u0439 \u044D\u043B\u0435\u043C\u0435\u043D\u0442 \u0441\u043F\u0438\u0441\u043A\u0430 \u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440\u0430 \u0441 \u0432\u0435\u0441\u043E\u043C."
        },
        NamePatternPart: {
          type: "object",
          properties: {
            list: {
              type: "string"
            },
            literal: {
              type: "string"
            }
          },
          additionalProperties: false,
          description: "\u041A\u043E\u043C\u043F\u043E\u043D\u043E\u0432\u043A\u0430 \u0438\u043C\u0435\u043D\u0438: \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0441\u043F\u0438\u0441\u043A\u043E\u0432 {list}/\u0447\u0430\u0441\u0442\u0435\u0439 {literal}."
        },
        NpcGeneratorDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            description: {
              type: "string"
            },
            lists: {
              type: "object",
              additionalProperties: {
                type: "array",
                items: {
                  $ref: "#/$defs/GenWeightedItem"
                }
              },
              description: "\u0441\u043F\u0438\u0441\u043A\u0438 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0439 (id \u2192 \u0432\u0437\u0432\u0435\u0448\u0435\u043D\u043D\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A \u0441\u0442\u0440\u043E\u043A)"
            },
            name: {
              type: "array",
              items: {
                $ref: "#/$defs/NamePatternPart"
              },
              description: "\u041A\u043E\u043C\u043F\u043E\u043D\u043E\u0432\u043A\u0430: {field \u2192 \u0441\u043F\u0438\u0441\u043E\u043A-\u043A\u043B\u044E\u0447}. \u041F\u043E\u043B\u044F:\n`name` (\u043A\u043E\u043C\u043F\u043E\u043D\u043E\u0432\u043A\u0430 \u0447\u0435\u0440\u0435\u0437 parts: {list} \u0438\u043B\u0438 {literal}),\n\u0441\u0442\u0440\u043E\u043A\u043E\u0432\u044B\u0435 \u043F\u043E\u043B\u044F \u2014 \u043B\u044E\u0431\u044B\u0435 \u0438\u0437 NameableEntity-\u043F\u043E\u0434\u043E\u0431\u043D\u044B\u0445: description, disposition_label \u0438 \u043F\u0440."
            },
            fields: {
              type: "object",
              additionalProperties: {
                type: "string"
              },
              description: "\u043F\u043E\u043B\u0435 \u2192 \u043A\u043B\u044E\u0447 \u0441\u043F\u0438\u0441\u043A\u0430 (description, stats.X, skills.Y, item.weapon \u2026)"
            }
          },
          required: [
            "id",
            "label",
            "lists"
          ],
          additionalProperties: false,
          description: "\u0413\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440 NPC: \u043C\u0430\u0441\u0442\u0435\u0440 \u0441\u043E\u0431\u0438\u0440\u0430\u0435\u0442 \u0438\u043C\u044F/\u043E\u0431\u043B\u0438\u043A/\u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440 \u0438\u0437 \u0441\u0432\u043E\u0438\u0445 \u0442\u0430\u0431\u043B\u0438\u0446.\n\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u043A \u0446\u0435\u043B\u0435\u0432\u043E\u043C\u0443 NPC (effect generate_npc) \u0438\u043B\u0438 \u043A \u043D\u043E\u0432\u043E\u0439\n\u0441\u0443\u0449\u043D\u043E\u0441\u0442\u0438 (spawn_template): \u0441\u043E\u0437\u0434\u0430\u0451\u0442\u0441\u044F \u043A\u043E\u043F\u0438\u044F \u0448\u0430\u0431\u043B\u043E\u043D\u0430 \u0441 \u043D\u043E\u0432\u044B\u043C id."
        },
        SceneGeneratorDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            description: {
              type: "string"
            },
            lists: {
              type: "object",
              additionalProperties: {
                type: "array",
                items: {
                  $ref: "#/$defs/GenWeightedItem"
                }
              }
            },
            slots: {
              type: "object",
              additionalProperties: {
                type: "string"
              },
              description: "id \u0441\u043B\u043E\u0442\u0430 \u0441\u0446\u0435\u043D\u044B \u2192 \u043A\u043B\u044E\u0447 \u0441\u043F\u0438\u0441\u043A\u0430: \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0432\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043A\u0430\u043A \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0441\u043B\u043E\u0442\u0430 (set_description-\u0441\u0442\u0438\u043B\u044C)"
            }
          },
          required: [
            "id",
            "label",
            "lists",
            "slots"
          ],
          additionalProperties: false,
          description: "\u0413\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440 \u0441\u0446\u0435\u043D \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0439: \u0437\u0430\u043F\u043E\u043B\u043D\u044F\u0435\u0442 \u0441\u043B\u043E\u0442\u044B \u0441\u0446\u0435\u043D\u044B \u0442\u0435\u043A\u0441\u0442\u0430\u043C\u0438 \u043F\u043E \u0441\u043B\u043E\u0432\u0430\u0440\u044F\u043C."
        },
        AdventureGeneratorDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            description: {
              type: "string"
            },
            lists: {
              type: "object",
              additionalProperties: {
                type: "array",
                items: {
                  $ref: "#/$defs/GenWeightedItem"
                }
              }
            },
            goals: {
              type: "array",
              items: {
                type: "string"
              },
              description: "\u0446\u0435\u043B\u044C \u043A\u0432\u0435\u0441\u0442\u0430: \u0448\u0430\u0431\u043B\u043E\u043D \u0441\u0442\u0440\u043E\u043A\u0438 \u0441 \u043F\u043E\u0434\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430\u043C\u0438 {list:key}"
            }
          },
          required: [
            "id",
            "label",
            "lists",
            "goals"
          ],
          additionalProperties: false,
          description: "\u0413\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440 \u043F\u0440\u0438\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0439: \u0446\u0435\u043F\u043E\u0447\u043A\u0430 \u0446\u0435\u043B\u0435\u0439 (\u043A\u0432\u0435\u0441\u0442\u043E-\u0441\u0442\u0440\u043E\u043A) \u0438\u0437 \u0442\u0430\u0431\u043B\u0438\u0446."
        },
        GeneratorsDef: {
          type: "object",
          properties: {
            event_tables: {
              type: "array",
              items: {
                $ref: "#/$defs/EventTableDef"
              },
              description: "\u0442\u0430\u0431\u043B\u0438\u0446\u044B \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u044B\u0445 \u0441\u043E\u0431\u044B\u0442\u0438\u0439 (\u043A\u0430\u0436\u0434\u0430\u044F \u0441\u043E \u0441\u0432\u043E\u0438\u043C \u0442\u0430\u0439\u043C\u0438\u043D\u0433\u043E\u043C/\u0448\u0430\u043D\u0441\u043E\u043C/\u0444\u0438\u043B\u044C\u0442\u0440\u0430\u043C\u0438)"
            },
            npc: {
              type: "array",
              items: {
                $ref: "#/$defs/NpcGeneratorDef"
              },
              description: "\u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440\u044B NPC"
            },
            scenes: {
              type: "array",
              items: {
                $ref: "#/$defs/SceneGeneratorDef"
              },
              description: "\u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440\u044B \u0441\u0446\u0435\u043D"
            },
            adventures: {
              type: "array",
              items: {
                $ref: "#/$defs/AdventureGeneratorDef"
              },
              description: "\u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440\u044B \u043F\u0440\u0438\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0439"
            }
          },
          additionalProperties: false,
          description: "\u041E\u0431\u0449\u0438\u0439 \u0431\u043B\u043E\u043A \u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440\u043E\u0432 \u0432 meta \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 (\u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435 \u2014 \u043F\u043E\u0434\u0441\u0438\u0441\u0442\u0435\u043C\u044B \u043D\u0435\u0442)."
        },
        CampaignMeta: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "\u0421\u0442\u0430\u0431\u0438\u043B\u044C\u043D\u0430\u044F \u043B\u0438\u0447\u043D\u043E\u0441\u0442\u044C \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438, \u0430 \u043D\u0435 \u0438\u043C\u044F/slug. \u041D\u043E\u0432\u044B\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u043F\u043E\u043B\u0443\u0447\u0430\u044E\u0442 UUID\n\u043E\u0442 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0430; \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0439 id \u043F\u0440\u0438 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0438, \u043F\u0435\u0440\u0435\u0441\u044B\u043B\u043A\u0435 \u0438 \u043F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0438.\n\u0414\u043B\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u0439 \u043A\u043E\u043F\u0438\u0438 \u043D\u043E\u0432\u044B\u0439 id \u0432\u044B\u0434\u0430\u0451\u0442 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435."
            },
            title: {
              type: "string"
            },
            version: {
              type: "string",
              description: "\u0432\u0435\u0440\u0441\u0438\u044F \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 (semver). \u0417\u0430\u0434\u0430\u0451\u0442 \u043C\u0430\u0441\u0442\u0435\u0440; \u043D\u0430 \u043D\u0435\u0439 \u0437\u0430\u0432\u044F\u0437\u0430\u043D\u0430 \u0441\u043E\u0432\u043C\u0435\u0441\u0442\u0438\u043C\u043E\u0441\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0439"
            },
            engine_version: {
              type: "string",
              description: "\u0423\u0421\u0422\u0410\u0420\u0415\u0412\u0428\u0415\u0415 \u0438\u043C\u044F \u043C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0439 \u0432\u0435\u0440\u0441\u0438\u0438 \u0434\u0432\u0438\u0436\u043A\u0430. \u041D\u043E\u0432\u043E\u0435 \u043F\u043E\u043B\u0435 \u2014 `min_engine`;\n\u0434\u0432\u0438\u0436\u043E\u043A \u0447\u0438\u0442\u0430\u0435\u0442 \u043E\u0431\u0430 (`effectiveMinEngine`), \u0441\u0442\u0430\u0440\u044B\u0435 \u043F\u0430\u043A\u0435\u0442\u044B \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u044E\u0442 \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C."
            },
            package_format: {
              type: "number",
              description: "\u0412\u0435\u0440\u0441\u0438\u044F \u0444\u043E\u0440\u043C\u0430\u0442\u0430 Campaign Package, \u043F\u043E\u0434 \u043A\u043E\u0442\u043E\u0440\u0443\u044E \u0441\u043E\u0431\u0440\u0430\u043D \u043F\u0430\u043A\u0435\u0442\n(`PACKAGE_FORMAT` \u0432 `shared/versions.ts` \u043D\u0430 \u043C\u043E\u043C\u0435\u043D\u0442 \u044D\u043A\u0441\u043F\u043E\u0440\u0442\u0430).\n\u041D\u0435\u0442 \u043F\u043E\u043B\u044F \u2014 \u043F\u0430\u043A\u0435\u0442 \u0441\u043E\u0431\u0440\u0430\u043D \u0434\u043E \u0432\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u0444\u043E\u0440\u043C\u0430\u0442\u0430 (\u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F v1)."
            },
            min_engine: {
              type: "string",
              description: "\u043C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F \u0434\u0432\u0438\u0436\u043A\u0430, \u043D\u0430 \u043A\u043E\u0442\u043E\u0440\u043E\u0439 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u044F \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E"
            },
            save_base_version: {
              type: "string",
              description: "\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043E\u0442 \u043A\u0430\u043A\u043E\u0439 \u0432\u0435\u0440\u0441\u0438\u0438 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u0435\u0449\u0451 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044E\u0442\u0441\u044F. \u0417\u0430\u0434\u0430\u0451\u0442 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\n\u043F\u0440\u0438 \u043F\u0443\u0431\u043B\u0438\u043A\u0430\u0446\u0438\u0438 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F (\u0441\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0435 \u043F\u0430\u043A\u0435\u0442\u043E\u0432), \u043C\u0430\u0441\u0442\u0435\u0440 \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u0435\u0442.\n\u041D\u0435\u0442 \u043F\u043E\u043B\u044F \u2014 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u043B\u044E\u0431\u044B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u044D\u0442\u043E\u0439 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 (\u0447\u0438\u043D\u044F\u0442\u0441\u044F\n\u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438, `core/savemigrate.ts`)."
            },
            author: {
              type: "string"
            },
            description: {
              type: "string"
            },
            design_doc: {
              type: "string",
              description: "\u0413\u0435\u0439\u043C-\u0434\u0438\u0437\u0430\u0439\u043D\u0435\u0440\u0441\u043A\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 (Markdown, \u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E). \u0418\u0418-\u0430\u0433\u0435\u043D\u0442\n\u0441\u043D\u0430\u0447\u0430\u043B\u0430 \u0437\u0430\u043F\u043E\u043B\u043D\u044F\u0435\u0442 \u0435\u0433\u043E \u0447\u0435\u043B\u043E\u0432\u0435\u0447\u0435\u0441\u043A\u0438\u043C \u044F\u0437\u044B\u043A\u043E\u043C, \u0437\u0430\u0442\u0435\u043C \u0432 \u0442\u043E\u043C \u0436\u0435 \u043E\u0442\u0432\u0435\u0442\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\n\u0437\u0430\u0434\u0430\u0447\u0443 \u0446\u0435\u043B\u0438\u043A\u043E\u043C; \u043D\u0435 \u0436\u0434\u0451\u0442 \xAB\u043E\u043A\xBB \u0438 \u043D\u0435 \u0437\u0430\u0434\u0430\u0451\u0442 \u0443\u0442\u043E\u0447\u043D\u044F\u044E\u0449\u0438\u0445 \u0432\u043E\u043F\u0440\u043E\u0441\u043E\u0432. \u041F\u0440\u0438 \u043D\u0435\u0445\u0432\u0430\u0442\u043A\u0435\n\u0432\u0432\u043E\u0434\u043D\u044B\u0445 \u0444\u0438\u043A\u0441\u0438\u0440\u0443\u0435\u0442 \u0440\u0430\u0437\u0443\u043C\u043D\u044B\u0435 \u0434\u043E\u043F\u0443\u0449\u0435\u043D\u0438\u044F; \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043E\u0431\u043D\u043E\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043D\u0430 \u043A\u0430\u0436\u0434\u043E\u0439\n\u0438\u0442\u0435\u0440\u0430\u0446\u0438\u0438. \u0420\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u0435\u0433\u043E \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u0439 \u043F\u0430\u043D\u0435\u043B\u044C\u044E (\xA7R7, \xA7R8).\n\u0421\u0442\u0430\u0440\u044B\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u0431\u0435\u0437 \u043F\u043E\u043B\u044F \u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0442 \u043A\u0430\u043A \u0440\u0430\u043D\u044C\u0448\u0435."
            },
            tick_label: {
              type: "string"
            },
            ticks_per_day: {
              type: "number"
            },
            time_of_day: {
              $ref: "#/$defs/TimeOfDayThresholds"
            },
            starting_region: {
              type: "string"
            },
            starting_location: {
              type: "string"
            },
            starting_scene: {
              type: "string"
            },
            starting_tick: {
              type: "number"
            },
            deadline_ticks: {
              type: "number",
              description: "\u041E\u0431\u0449\u0438\u0439 \u0434\u0435\u0434\u043B\u0430\u0439\u043D \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 (\u0447\u0438\u0441\u043B\u043E \u0442\u0438\u043A\u043E\u0432 \u043E\u0442 \u0441\u0442\u0430\u0440\u0442\u0430 \u0434\u043E \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0444\u0438\u043D\u0430\u043B\u0430).\n\u0415\u0441\u043B\u0438 \u0437\u0430\u0434\u0430\u043D\u043E (>0) \u2014 \u0432 HUD \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0430\u0435\u0442\u0441\u044F \u0438\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440 \u043E\u0431\u0440\u0430\u0442\u043D\u043E\u0433\u043E \u043E\u0442\u0441\u0447\u0451\u0442\u0430."
            },
            deadline_label: {
              type: "string",
              description: "\u043F\u043E\u0434\u043F\u0438\u0441\u044C \u0434\u0435\u0434\u043B\u0430\u0439\u043D\u0430 \u0432 HUD (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, \xAB\u0414\u043E \u0437\u0430\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u044F\xBB, \xAB\u0414\u043E \u043E\u0442\u0431\u044B\u0442\u0438\u044F \u043F\u043E\u0435\u0437\u0434\u0430\xBB)"
            },
            needs: {
              type: "array",
              items: {
                $ref: "#/$defs/NeedDef"
              }
            },
            statuses: {
              type: "array",
              items: {
                $ref: "#/$defs/StatusDef"
              },
              description: "\u0440\u0435\u0435\u0441\u0442\u0440 \u0441\u0442\u0430\u0442\u0443\u0441\u043E\u0432: \u044F\u0434\u044B, \u043A\u0440\u043E\u0432\u043E\u0442\u0435\u0447\u0435\u043D\u0438\u044F, \u0431\u0430\u0444\u0444\u044B (\u0431\u043B\u043E\u043A 5 \u0422\u0417)"
            },
            abilities: {
              type: "array",
              items: {
                $ref: "#/$defs/AbilityDef"
              },
              description: "\u0440\u0435\u0435\u0441\u0442\u0440 \u0431\u043E\u0435\u0432\u044B\u0445 \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u0435\u0439 (\u0431\u043B\u043E\u043A 6 \u0422\u0417)"
            },
            magic: {
              type: "object",
              properties: {
                slots: {
                  type: "number"
                }
              },
              additionalProperties: false,
              description: "\u041C\u0430\u0433\u0438\u044F \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 (\u0430\u0443\u0434\u0438\u0442 \xA75.6): slots \u2014 \u0447\u0438\u0441\u043B\u043E \xAB\u0441\u043B\u043E\u0442\u043E\u0432 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438\xBB \u0433\u0435\u0440\u043E\u044F.\n\u0417\u0430\u0434\u0430\u043D\u043E \u2014 \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u0438 \u0441 prepare:true \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u044E\u0442 \u043B\u0438\u0448\u044C \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0435\n(\u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0432 \u043B\u0438\u0441\u0442\u0435 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430). \u041D\u0435\u0442 \u2014 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u0430."
            },
            difficulties: {
              type: "array",
              items: {
                $ref: "#/$defs/DifficultyPreset"
              },
              description: "\u0423\u0440\u043E\u0432\u043D\u0438 \u0441\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u0438, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043C\u0430\u0441\u0442\u0435\u0440 \u043F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u0435\u0442 \u0438\u0433\u0440\u043E\u043A\u0443 \u043F\u0440\u0438 \u0441\u0442\u0430\u0440\u0442\u0435 \u0437\u0430\u0431\u0435\u0433\u0430\n(\u0430\u0443\u0434\u0438\u0442 \xA75.6 \u2014 \u0440\u0435\u0448\u0435\u043D\u0438\u0435 \u043C\u0430\u0441\u0442\u0435\u0440\u0430). \u0421\u043F\u0438\u0441\u043E\u043A \u0437\u0430\u0434\u0430\u043D \u2014 \u043D\u0430 \u044D\u043A\u0440\u0430\u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F\n\u043F\u043E\u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0432\u044B\u0431\u043E\u0440; \u043F\u0443\u0441\u0442\u043E \u2014 \u0441\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u044C \u043E\u0434\u043D\u0430, \xAB\u043A\u0430\u043A \u0437\u0430\u0434\u0443\u043C\u0430\u043D\u043E\xBB.\n\u041F\u0435\u0440\u0432\u044B\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C \u2014 \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435."
            },
            new_game_plus: {
              type: "object",
              properties: {
                label: {
                  type: "string",
                  description: "\u043F\u043E\u0434\u043F\u0438\u0441\u044C \u043A\u043D\u043E\u043F\u043A\u0438 \u043D\u0430 \u044D\u043A\u0440\u0430\u043D\u0435 \u0444\u0438\u043D\u0430\u043B\u0430 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 \xAB\u041D\u043E\u0432\u0430\u044F \u0438\u0433\u0440\u0430+\xBB)"
                },
                keep: {
                  type: "array",
                  items: {
                    type: "string"
                  }
                },
                boost: {
                  type: "object",
                  properties: {
                    enemy_damage_step: {
                      type: "number"
                    },
                    need_decay_step: {
                      type: "number"
                    },
                    prices_step: {
                      type: "number"
                    }
                  },
                  additionalProperties: false
                }
              },
              additionalProperties: false,
              description: "New Game+ (\u0440\u0435\u0448\u0435\u043D\u0438\u0435 \u043C\u0430\u0441\u0442\u0435\u0440\u0430): \u043F\u0440\u0438 \u043F\u043E\u0431\u0435\u0434\u0435 \u0438\u0433\u0440\u043E\u043A \u043C\u043E\u0436\u0435\u0442 \u043D\u0430\u0447\u0430\u0442\u044C \u0437\u0430\u043D\u043E\u0432\u043E \u0441\n\u043D\u0430\u0441\u043B\u0435\u0434\u0438\u0435\u043C. keep \u2014 \u0447\u0442\u043E \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0438\u0442\u0441\u044F (\u0441\u0442\u0440\u043E\u043A\u0438: 'skills', 'skill_marks',\n'stats', 'inventory', 'feats', 'prepared'); \u043F\u0443\u0441\u0442\u043E \u2014 \u0432\u0441\u0435 \u0438\u0437 \u0441\u043F\u0438\u0441\u043A\u0430.\nboost \u2014 \u0448\u0430\u0433\u0438 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u0435\u0439 \u0437\u0430 \u043A\u0430\u0436\u0434\u044B\u0439 \u043A\u0440\u0443\u0433 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0433\u043E \u0437\u0430\u0431\u0435\u0433\u0430 (\u043D\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0439\n\u043F\u0440\u0435\u0441\u0435\u0442 \u0441\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u0438): 0.25 = +25% \u0443\u0440\u043E\u043D\u0430 \u0432\u0440\u0430\u0433\u043E\u0432 \u0437\u0430 \u043A\u0440\u0443\u0433."
            },
            species: {
              type: "array",
              items: {
                $ref: "#/$defs/SpeciesTemplate"
              },
              description: "\u0448\u0430\u0431\u043B\u043E\u043D\u044B \u0432\u0438\u0434\u043E\u0432 \u0441\u0443\u0449\u0435\u0441\u0442\u0432 \u2014 \u043C\u0430\u0441\u0442\u0435\u0440\u0441\u043A\u0438\u0435 \u0437\u0430\u0433\u043E\u0442\u043E\u0432\u043A\u0438 \u0431\u043E\u0435\u0432\u044B\u0445 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u043E\u0432 NPC (\u043A\u043E\u043D\u0442\u0435\u043D\u0442, \u043D\u0435 \u0434\u0432\u0438\u0436\u043E\u043A)"
            },
            equipment_slots: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string"
                  },
                  label: {
                    type: "string"
                  }
                },
                required: [
                  "id",
                  "label"
                ],
                additionalProperties: false
              },
              description: "\u0440\u0435\u0435\u0441\u0442\u0440 \u0441\u043B\u043E\u0442\u043E\u0432 \u044D\u043A\u0438\u043F\u0438\u0440\u043E\u0432\u043A\u0438 (\u0431\u043B\u043E\u043A 7 \u0422\u0417); \u0432\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0435 \u041E\u0440\u0443\u0436\u0438\u0435/\u0411\u0440\u043E\u043D\u044F \u0435\u0441\u0442\u044C \u0432\u0441\u0435\u0433\u0434\u0430"
            },
            calendar: {
              type: "object",
              properties: {
                year_label: {
                  type: "string",
                  description: "\xAB\u041B\u0435\u0442\u043E\u043F\u0438\u0441\u044C \u041A\u0430\u044D\u0440\u0434\u0435\u043D\u0430\xBB, \xAB\u0433.\u044D.\xBB\u2026"
                },
                start_year: {
                  type: "number",
                  description: "default 1"
                },
                days_per_month: {
                  type: "number",
                  description: "default 30"
                },
                months: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  description: "\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F \u043C\u0435\u0441\u044F\u0446\u0435\u0432 (\u0446\u0438\u043A\u043B\u044B); \u043D\u0435\u0442 \u2014 \xAB\u041C\u0435\u0441\u044F\u0446 1\xBB"
                },
                day_names: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  description: "\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F \u0434\u043D\u0435\u0439 \u043D\u0435\u0434\u0435\u043B\u0438 (\u0446\u0438\u043A\u043B\u044B); \u043D\u0435\u0442 \u2014 \u0431\u0435\u0437 \u0438\u043C\u0451\u043D"
                }
              },
              additionalProperties: false,
              description: "\u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438: \u0441\u0432\u043E\u0438 \u043C\u0435\u0441\u044F\u0446\u044B \u0438 \u0434\u043D\u0438 \u043D\u0435\u0434\u0435\u043B\u0438 (\u0431\u043B\u043E\u043A 9 \u0422\u0417)"
            },
            weathers: {
              type: "array",
              items: {
                $ref: "#/$defs/WeatherDef"
              },
              description: "\u0440\u0435\u0435\u0441\u0442\u0440 \u043F\u043E\u0433\u043E\u0434 (\u0431\u043B\u043E\u043A 9 \u0422\u0417)"
            },
            atmospherics: {
              type: "array",
              items: {
                $ref: "#/$defs/ParticleEffectDef"
              },
              description: "\u0440\u0435\u0435\u0441\u0442\u0440 \u0430\u0442\u043C\u043E\u0441\u0444\u0435\u0440\u043D\u044B\u0445 \u0441\u043B\u043E\u0451\u0432 \u0438\u0437 \u0444\u0430\u0439\u043B\u043E\u0432 \u043C\u0430\u0441\u0442\u0435\u0440\u0430 (\u043C\u0430\u0441\u0442\u0435\u0440\u0441\u043A\u0430\u044F \u0441\u043F\u0435\u0446\u044D\u0444\u0444\u0435\u043A\u0442\u043E\u0432)"
            },
            encumbrance: {
              $ref: "#/$defs/EncumbranceRules",
              description: "\u041F\u0440\u0430\u0432\u0438\u043B\u0430 \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0437\u0430 \u0438 \u0433\u0440\u0443\u0437\u043E\u043F\u043E\u0434\u044A\u0451\u043C\u043D\u043E\u0441\u0442\u0438 \u043C\u0438\u0440\u0430 (\u0443\u043D\u0438\u0432\u0435\u0440\u0441\u0430\u043B\u044C\u043D\u0430\u044F \u0430\u0434\u0430\u043F\u0442\u0430\u0446\u0438\u044F BRP).\n\u041F\u043E\u0437\u0432\u043E\u043B\u044F\u0435\u0442 \u043D\u0430\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u0442\u044C \u043C\u0438\u0440\u044B \u0434\u043B\u044F \u0433\u0438\u0433\u0430\u043D\u0442\u043E\u0432, \u043C\u0443\u0442\u0430\u043D\u0442\u043E\u0432, \u0445\u043E\u0431\u0431\u0438\u0442\u043E\u0432, \u0444\u0430\u043D\u0442\u0430\u0441\u0442\u0438\u043A\u0438\n\u0438 \u044D\u043A\u0437\u043E\u0441\u043A\u0435\u043B\u0435\u0442\u043E\u0432 \u0431\u0435\u0437 \u043F\u0440\u0430\u0432\u043E\u043A \u0434\u0432\u0438\u0436\u043A\u0430."
            },
            camping: {
              type: "object",
              properties: {
                ticks: {
                  type: "number"
                },
                min_ticks: {
                  type: "number",
                  description: "\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u043D\u043E\u0447\u043B\u0435\u0433\u0430 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E = ticks: \u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0441\u043E\u043D).\n\u0415\u0441\u043B\u0438 min_ticks < max_ticks \u2014 \u0438\u0433\u0440\u043E\u043A \u0441\u0430\u043C \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u0442, \u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0441\u043F\u0430\u0442\u044C, \u0438\u0437 \u043E\u043A\u043D\u0430 \u0432\u044B\u0431\u043E\u0440\u0430."
                },
                max_ticks: {
                  type: "number",
                  description: "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u043D\u043E\u0447\u043B\u0435\u0433\u0430 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E = ticks)."
                },
                per_tick: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/Effect"
                  },
                  description: "\u041F\u043E\u0447\u0430\u0441\u043E\u0432\u044B\u0435 \u044D\u0444\u0444\u0435\u043A\u0442\u044B \u043D\u043E\u0447\u043B\u0435\u0433\u0430: \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u044E\u0442\u0441\u044F \u041A\u0410\u0416\u0414\u042B\u0419 \u0442\u0438\u043A \u0441\u043D\u0430 \u0414\u041E \u0442\u0438\u043A\u0430\u043D\u0438\u044F \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0435\u0439,\n\u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u0433\u043E\u043B\u043E\u0434 \u0442\u0438\u043A\u0430\u0435\u0442, \u0430 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F \u0437\u0430 \u043A\u0430\u0436\u0434\u044B\u0439 \u0447\u0430\u0441 \u0447\u0435\u0441\u0442\u043D\u043E.\n\u0411\u0435\u043B\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A \u044D\u0444\u0444\u0435\u043A\u0442\u043E\u0432: change_need, change_hp, change_fatigue, change_sanity \u2014\n\u043E\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0435 \u0434\u0432\u0438\u0436\u043E\u043A \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u0442 \u0441 \u0437\u0430\u043F\u0438\u0441\u044C\u044E \u0432 \u0436\u0443\u0440\u043D\u0430\u043B (audit \u0432\u044B\u0434\u0430\u0441\u0442 \u043E\u0448\u0438\u0431\u043A\u0443 \u043C\u0430\u0441\u0442\u0435\u0440\u0443)."
                },
                ambush_chance: {
                  type: "number"
                },
                ambush_rule: {
                  type: "string"
                },
                restore: {
                  type: "object",
                  additionalProperties: {
                    type: "number"
                  },
                  description: '\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0435\u0439 \u0437\u0430 \u043D\u043E\u0447\u043B\u0435\u0433: `need_id \u2192 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435` (\u043D\u0430\u043F\u0440.\n{ "need_rest": 100 }). \u0418\u0434\u0451\u0442 \u0447\u0435\u0440\u0435\u0437 changeNeed: \u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u0434\u0435\u043B\u044C\u0442\u0430\n\u0434\u0435\u043B\u0438\u0442\u0441\u044F \u0441 \u043D\u0430\u043F\u0430\u0440\u043D\u0438\u043A\u0430\u043C\u0438 (\xAB\u043E\u0431\u0449\u0438\u0439 \u0441\u0442\u043E\u043B\xBB), \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F \u043A\u043B\u0430\u043F\u044F\u0442\u0441\u044F \u0432 0..100.\n\u041F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u043B\u0430\u0433\u0435\u0440\u044C \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0438 \u041D\u0415 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u0442 \u2014 \u0443\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F\n\u0442\u043E\u043B\u044C\u043A\u043E \u0441\u0430\u043C\u0438\u043C\u0438 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430\u043C\u0438-\u043A\u043E\u043D\u0442\u0435\u043D\u0442\u043E\u043C (\u043A\u0440\u043E\u0432\u0430\u0442\u044C \u0438 \u0442.\u043F.). \u0412\u043D\u0438\u043C\u0430\u043D\u0438\u0435: \u043F\u043E\u0441\u043B\u0435\nadvanceTicks(ticks) \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0438 \u0443\u0436\u0435 \u043F\u0440\u043E\u0441\u0435\u043B\u0438, \u043F\u043E\u044D\u0442\u043E\u043C\u0443 100 \u0442\u0443\u0442 \u2260 \xAB\u043A\u0430\u043A\n\u0431\u044B\u043B\u043E \u043F\u0440\u0438 \u043E\u0442\u043A\u0440\u044B\u0442\u0438\u0438 \u043C\u0435\u043D\u044E\xBB. \u0414\u043B\u044F \u043F\u0440\u043E\u043F\u043E\u0440\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u043A \u0447\u0430\u0441\u0430\u043C \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F\n\u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 per_tick \u0432\u043C\u0435\u0441\u0442\u043E \u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0439 \u0441\u0443\u043C\u043C\u044B.'
                }
              },
              additionalProperties: false,
              description: "\u041B\u0430\u0433\u0435\u0440\u044C \u0438 \u043D\u043E\u0447\u043B\u0435\u0433 (\u0430\u0443\u0434\u0438\u0442 B7): \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \xAB\u0420\u0430\u0437\u0431\u0438\u0442\u044C \u043B\u0430\u0433\u0435\u0440\u044C\xBB \u0432 HUD, \u043A\u043E\u0433\u0434\u0430\n\u0433\u0435\u0440\u043E\u0439 \u0432 \u043B\u043E\u043A\u0430\u0446\u0438\u0438 \u0441 `camp: true`. \u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435 \u0431\u043B\u043E\u043A\u0430 \u2014 \u043A\u043D\u043E\u043F\u043A\u0438 \u043D\u0435\u0442 \u043D\u0438 \u0433\u0434\u0435!\nMaster \u0440\u0435\u0448\u0430\u0435\u0442 \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C (ticks, \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 8), \u0440\u0438\u0441\u043A \u0432\u044B\u043B\u0430\u0437\u043A\u0438 \u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438\n(ambush_chance 0..1, \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 0 \u2014 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u044B\u0439 \u043B\u0430\u0433\u0435\u0440\u044C) \u0438 \u0441\u044E\u0436\u0435\u0442 \u0437\u0430\u0441\u0430\u0434\u044B\n(ambush_rule \u2014 \u043F\u0440\u0430\u0432\u0438\u043B\u043E \u0438\u0437 \u0440\u0435\u0435\u0441\u0442\u0440\u0430 rules)."
            },
            duration_actions: {
              type: "array",
              items: {
                $ref: "#/$defs/DurationActionDef"
              },
              description: "\u0420\u0435\u0435\u0441\u0442\u0440 \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0445 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0439 (\u0441\u043E\u043D/\u043C\u0435\u0434\u0438\u0442\u0430\u0446\u0438\u044F/\u0434\u0435\u0436\u0443\u0440\u0441\u0442\u0432\u043E/\u0447\u0442\u0435\u043D\u0438\u0435 \u2014 \u0431\u0435\u0437\n\u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0438 \u043A \u043B\u0430\u0433\u0435\u0440\u044E): \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0441\u0442\u043E\u0438\u0442 \u0442\u0438\u043A\u0438 \u0438\u0433\u0440\u043E\u0432\u043E\u0433\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438, \u044D\u0444\u0444\u0435\u043A\u0442\n\u043F\u0440\u043E\u043F\u043E\u0440\u0446\u0438\u043E\u043D\u0430\u043B\u0435\u043D \u043F\u043E\u0442\u0440\u0430\u0447\u0435\u043D\u043D\u044B\u043C \u0442\u0438\u043A\u0430\u043C, \u0434\u043B\u0438\u043D\u0443 \u0432 \u043F\u0440\u0435\u0434\u0435\u043B\u0430\u0445 min..max \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u0442\n\u0438\u0433\u0440\u043E\u043A \u0432 \u043E\u043A\u043D\u0435 \u0432\u044B\u0431\u043E\u0440\u0430. \u0417\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F \u044D\u0444\u0444\u0435\u043A\u0442\u043E\u043C start_duration_action \u0438\u0437\n\u0434\u0438\u0430\u043B\u043E\u0433\u0430, \u043F\u0440\u0430\u0432\u0438\u043B\u0430, use_with \u0438\u043B\u0438 interact_options \u043A\u0440\u043E\u0432\u0430\u0442\u0438/\u0441\u043A\u0430\u043C\u044C\u0438."
            },
            hazards: {
              type: "object",
              properties: {
                fall_meters_per_die: {
                  type: "number"
                },
                fall_damage: {
                  type: "string"
                }
              },
              additionalProperties: false,
              description: "\u0427\u0438\u0441\u043B\u0430 \u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0435\u0439 (\u0430\u0443\u0434\u0438\u0442 B7): \u043F\u0430\u0434\u0435\u043D\u0438\u0435 \u2014 \u043F\u043E {fall_meters_per_die} \u043C\u0435\u0442\u0440\u0430\u043C\n\u043D\u0430 \u043E\u0434\u0438\u043D \u043A\u0443\u0431\u0438\u043A \u0443\u0440\u043E\u043D\u0430 {fall_damage} (\u043A\u043D\u0438\u0436\u043D\u043E\u0435 \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 3 \u043C \u043D\u0430 1d6);\n\u043D\u0430\u0432\u044B\u043A \u0441\u043C\u044F\u0433\u0447\u0435\u043D\u0438\u044F \u2014 \u044D\u0444\u0444\u0435\u043A\u0442\u043E\u043C (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 dodge)."
            },
            crimes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string"
                  },
                  label: {
                    type: "string"
                  }
                },
                required: [
                  "id",
                  "label"
                ],
                additionalProperties: false
              },
              description: "\u0420\u0435\u0435\u0441\u0442\u0440 \u043F\u0440\u0435\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0439 (\u0430\u0443\u0434\u0438\u0442 B7): \u043F\u0440\u0435\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0435 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u044D\u0444\u0444\u0435\u043A\u0442\u043E\u043C\ncommit_crime; \u043F\u043E\u0441\u043B\u0435\u0434\u0441\u0442\u0432\u0438\u044F (\u043D\u0430\u0433\u0440\u0430\u0434\u0430 \u0437\u0430 \u0433\u043E\u043B\u043E\u0432\u0443, \u0440\u0435\u0430\u043A\u0446\u0438\u044F \u0441\u0442\u0440\u0430\u0436\u0438) \u2014 \u043F\u0440\u0430\u0432\u0438\u043B\u0430\u043C\u0438\n\u043C\u0430\u0441\u0442\u0435\u0440\u0430 \u043F\u043E \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u043C crime_committed / bounty_total_ge"
            },
            price_events: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string"
                  },
                  label: {
                    type: "string"
                  },
                  multiplier: {
                    type: "number",
                    description: "\u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0446\u0435\u043D\u044B (1.5 = +50% \u043A \u0432\u044B\u043A\u0443\u043F\u0443 \u0443 \u0438\u0433\u0440\u043E\u043A\u0430; \u043F\u0440\u043E\u0434\u0430\u0436\u0430 \u2014 \u043E\u0431\u0440\u0430\u0442\u043D\u043E \u043F\u0440\u043E\u043F\u043E\u0440\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u043E)"
                  },
                  items: {
                    type: "array",
                    items: {
                      type: "string"
                    },
                    description: "\u0442\u043E\u043B\u044C\u043A\u043E \u044D\u0442\u0438 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B; \u043D\u0435\u0442 \u2014 \u0432\u0441\u0435"
                  },
                  categories: {
                    type: "array",
                    items: {
                      type: "string"
                    },
                    description: "\u0442\u043E\u043B\u044C\u043A\u043E \u044D\u0442\u0438 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438; \u043D\u0435\u0442 \u2014 \u0432\u0441\u0435"
                  }
                },
                required: [
                  "id",
                  "label",
                  "multiplier"
                ],
                additionalProperties: false
              },
              description: "\u0426\u0435\u043D\u043D\u0438\u043A\u0438 \u043F\u043E\u0434 \u0441\u043E\u0431\u044B\u0442\u0438\u0435\u043C (\u0430\u0443\u0434\u0438\u0442 B7): \u0432\u043E\u0439\u043D\u0430, \u0431\u043B\u043E\u043A\u0430\u0434\u0430, \u044F\u0440\u043C\u0430\u0440\u043A\u0430.\n\u0421\u043E\u0431\u044B\u0442\u0438\u0435 \u0430\u043A\u0442\u0438\u0432\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u044D\u0444\u0444\u0435\u043A\u0442\u043E\u043C set_price_event (\u0432\u044B\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u2014\nclear_price_event) \u0438 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u043D\u0430 \u0432\u0435\u0441\u044C \u043A\u0430\u0442\u0430\u043B\u043E\u0433, \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0439\n\u0435\u0433\u043E \u0444\u0438\u043B\u044C\u0442\u0440\u0430\u043C (\u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u0438/\u0438\u043B\u0438 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438; \u0431\u0435\u0437 \u0444\u0438\u043B\u044C\u0442\u0440\u043E\u0432 \u2014 \u043D\u0430 \u0432\u0441\u0451)."
            },
            endings: {
              type: "array",
              items: {
                $ref: "#/$defs/EndingDef"
              },
              description: "\u0444\u0438\u043D\u0430\u043B\u044C\u043D\u044B\u0435 \u044D\u043A\u0440\u0430\u043D\u044B (\u043A\u043E\u043D\u0446\u043E\u0432\u043A\u0438): \u043C\u0430\u0441\u0442\u0435\u0440 \u0437\u0430\u0434\u0430\u0451\u0442 \u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0443\u0433\u043E\u0434\u043D\u043E; \u043F\u0440\u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0438\n\u0437\u0430\u0431\u0435\u0433\u0430 \u0434\u0432\u0438\u0436\u043E\u043A \u0431\u0435\u0440\u0451\u0442 \u041F\u0415\u0420\u0412\u0423\u042E \u043A\u043E\u043D\u0446\u043E\u0432\u043A\u0443, \u0447\u044C\u0438 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u044B (\u0438 \u0447\u0435\u0439 `on`\n\u0441\u043E\u0432\u043F\u0430\u0434\u0430\u0435\u0442 \u0441 \u0438\u0441\u0445\u043E\u0434\u043E\u043C). \u041D\u0435\u0442 \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0435\u0439 \u2014 \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u044B\u0439 \u044D\u043A\u0440\u0430\u043D \u0438\u0441\u0445\u043E\u0434\u0430."
            },
            overlay_layers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string"
                  },
                  label: {
                    type: "string"
                  }
                },
                required: [
                  "id",
                  "label"
                ],
                additionalProperties: false
              },
              description: "\u0440\u0435\u0435\u0441\u0442\u0440 \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u044B\u0445 \u0441\u043B\u043E\u0451\u0432 \u043F\u043E\u0433\u043E\u0434\u044B (id + \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435) \u2014 \xAB\u0431\u0435\u0437 \u0445\u0430\u0440\u0434\u043A\u043E\u0434\u0430\xBB: \u0441\u043F\u0438\u0441\u043E\u043A\n\u0434\u043B\u044F \u0441\u0435\u043B\u0435\u043A\u0442\u0430 \xAB\u0421\u043B\u043E\u0439\xBB \u0446\u0435\u043B\u0438\u043A\u043E\u043C \u0437\u0430\u0434\u0430\u0451\u0442 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u044F. \u0414\u0432\u0438\u0436\u043E\u043A \u0443\u043C\u0435\u0435\u0442 \u0440\u0438\u0441\u043E\u0432\u0430\u0442\u044C \u0441\u043B\u043E\u0438\n`rain`, `snow`, `fog`, `ash`; \u0441\u0432\u043E\u0438 id \u0440\u0438\u0441\u0443\u044E\u0442\u0441\u044F \u043A\u043B\u0430\u0441\u0441\u043E\u043C `weather-<id>`\n(\u0441\u0442\u0438\u043B\u0438 \u043C\u0430\u0441\u0442\u0435\u0440 \u043C\u043E\u0436\u0435\u0442 \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432 \u0442\u0435\u043C\u0443 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u044F)."
            },
            codex_categories: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string"
                  },
                  label: {
                    type: "string"
                  }
                },
                required: [
                  "id",
                  "label"
                ],
                additionalProperties: false
              },
              description: "\u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \u043A\u043E\u0434\u0435\u043A\u0441\u0430 (\u0431\u043B\u043E\u043A 10 \u0422\u0417); \u043D\u0435\u0442 \u2014 \u0432\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0435 \u0442\u0440\u0438"
            },
            dice_rules: {
              $ref: "#/$defs/DiceRules",
              description: "\u043F\u0440\u0430\u0432\u0438\u043B\u0430 \u0431\u0440\u043E\u0441\u043A\u043E\u0432 d100 (\u043F\u043E\u0440\u043E\u0433\u0438 \u043A\u0440\u0438\u0442\u0430/\u043E\u0441\u043E\u0431\u043E\u0433\u043E \u0443\u0441\u043F\u0435\u0445\u0430/\u043F\u0440\u043E\u0432\u0430\u043B\u0430); \u0441\u043C. DEFAULT_DICE_RULES"
            },
            skills: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string"
                  },
                  label: {
                    type: "string"
                  },
                  category: {
                    type: "string",
                    description: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u043D\u0430\u0432\u044B\u043A\u0430 (\u0430\u0443\u0434\u0438\u0442 B6): id \u0438\u0437 meta.skill_categories;\n\u043F\u0430\u043D\u0435\u043B\u0438 \u043D\u0430\u0432\u044B\u043A\u043E\u0432 \u0433\u0440\u0443\u043F\u043F\u0438\u0440\u0443\u044E\u0442 \u043F\u043E \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F\u043C."
                  },
                  base: {
                    anyOf: [
                      {
                        type: "number"
                      },
                      {
                        type: "string"
                      }
                    ],
                    description: "\u0411\u0430\u0437\u043E\u0432\u044B\u0439 \u0448\u0430\u043D\u0441 \u043D\u0430\u0432\u044B\u043A\u0430 \u0431\u0435\u0437 \u043E\u0431\u0443\u0447\u0435\u043D\u0438\u044F (\u0430\u0443\u0434\u0438\u0442 B6, \u043A\u043D\u0438\u0436\u043D\u044B\u0435 \xAB\u0431\u0430\u0437\u043E\u0432\u044B\u0435 \u0448\u0430\u043D\u0441\u044B\xBB):\n\u0447\u0438\u0441\u043B\u043E (\u043D\u0430\u043F\u0440. 25) \u0438\u043B\u0438 \u0444\u043E\u0440\u043C\u0443\u043B\u0430 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A \xABDEX\xD72\xBB, \xABINT\xD75\xBB.\n\u041D\u0435\u0442 \u2014 \u043D\u0435\u043E\u0431\u0443\u0447\u0435\u043D\u043D\u044B\u0439 \u043D\u0430\u0432\u044B\u043A \u0434\u0430\u0451\u0442 0% (\u043A\u0430\u043A \u0440\u0430\u043D\u044C\u0448\u0435)."
                  }
                },
                required: [
                  "id",
                  "label"
                ],
                additionalProperties: false
              },
              description: "\u0440\u0435\u0435\u0441\u0442\u0440 \u043D\u0430\u0432\u044B\u043A\u043E\u0432 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 (id + \u0440\u0443\u0441\u0441\u043A\u043E\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435); \u0441\u043C. shared/skills.ts"
            },
            skill_categories: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string"
                  },
                  label: {
                    type: "string"
                  }
                },
                required: [
                  "id",
                  "label"
                ],
                additionalProperties: false
              },
              description: "\u0440\u0435\u0435\u0441\u0442\u0440 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0439 \u043D\u0430\u0432\u044B\u043A\u043E\u0432 (\u0430\u0443\u0434\u0438\u0442 B6): \u0431\u043E\u0439/\u043E\u0431\u0449\u0435\u043D\u0438\u0435/\u0437\u043D\u0430\u043D\u0438\u044F/\u043A\u0440\u0430\u0444\u0442\u2026"
            },
            vitals: {
              type: "object",
              properties: {
                fatigue: {
                  anyOf: [
                    {
                      type: "boolean"
                    },
                    {
                      type: "object",
                      properties: {
                        multiplier: {
                          type: "number"
                        },
                        rest_restore: {
                          type: "boolean"
                        }
                      },
                      additionalProperties: false
                    }
                  ]
                },
                sanity: {
                  anyOf: [
                    {
                      type: "boolean"
                    },
                    {
                      type: "object",
                      properties: {
                        multiplier: {
                          type: "number"
                        }
                      },
                      additionalProperties: false
                    }
                  ]
                }
              },
              additionalProperties: false,
              description: "\u041F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u043D\u044B\u0435 \u043E\u043F\u0446\u0438\u0438 BRP (\u0430\u0443\u0434\u0438\u0442 B6), \u0432\u0441\u0451 \u0432\u044B\u043A\u043B\u044E\u0447\u0430\u0435\u043C\u043E \u043C\u0430\u0441\u0442\u0435\u0440\u043E\u043C:\n- fatigue \u2014 \u043E\u0447\u043A\u0438 \u0443\u0441\u0442\u0430\u043B\u043E\u0441\u0442\u0438, max = (STR+CON)\xD7multiplier (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 \xD71);\n  \u043D\u0430 \u043E\u0442\u0434\u044B\u0445\u0435 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u044E\u0442\u0441\u044F (rest_restore \u2260 false); \u0442\u0440\u0430\u0442\u044B \u0437\u0430\u0434\u0430\u0451\u0442\n  \u043C\u0430\u0441\u0442\u0435\u0440 \u044D\u0444\u0444\u0435\u043A\u0442\u0430\u043C\u0438 change_fatigue (\u0431\u0435\u0433, \u0431\u0435\u0441\u0441\u043E\u043D\u043D\u0438\u0446\u0430, \u0442\u044F\u0436\u0451\u043B\u044B\u0439 \u0434\u043E\u0441\u043F\u0435\u0445);\n- sanity \u2014 \u0440\u0430\u0441\u0441\u0443\u0434\u043E\u043A = POW\xD7multiplier (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 \xD75), \u0442\u0440\u0430\u0442\u044B \u044D\u0444\u0444\u0435\u043A\u0442\u0430\u043C\u0438\n  change_sanity; \u043F\u043E\u0440\u043E\u0433\u0438/\u043F\u0441\u0438\u0445\u043E\u0437\u044B \u2014 \u043F\u0440\u0430\u0432\u0438\u043B\u0430\u043C\u0438 \u043D\u0430 \u0443\u0441\u043B\u043E\u0432\u0438\u044F sanity_le.\n\u0411\u0435\u0437 \u0431\u043B\u043E\u043A\u0430 \u0441\u0438\u0441\u0442\u0435\u043C \u043D\u0435\u0442 (\u043A\u0430\u043A \u0440\u0430\u043D\u044C\u0448\u0435)."
            },
            reputation: {
              anyOf: [
                {
                  type: "boolean"
                },
                {
                  type: "object",
                  properties: {
                    label: {
                      type: "string"
                    }
                  },
                  additionalProperties: false
                }
              ],
              description: "\u0440\u0435\u043F\u0443\u0442\u0430\u0446\u0438\u044F (\u0430\u0443\u0434\u0438\u0442 B6): \u0432\u043A\u043B. \u2014 \u0447\u0438\u043F \u0432 HUD \u0438 \u0441\u0442\u0440\u043E\u043A\u0430 \u0432 \u043F\u0430\u043D\u0435\u043B\u0438 \u0433\u0435\u0440\u043E\u044F"
            },
            wealth_levels: {
              type: "array",
              items: {
                type: "string"
              },
              description: "\u0448\u043A\u0430\u043B\u0430 \u0434\u043E\u0441\u0442\u0430\u0442\u043A\u0430 (\u0430\u0443\u0434\u0438\u0442 B6): \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F \u043E\u0442 \u043D\u0438\u0437\u0448\u0435\u0433\u043E \u043A \u0432\u044B\u0441\u0448\u0435\u043C\u0443, \u043D\u0430\u043F\u0440. ['\u041D\u0438\u0449\u0438\u0439','\u0411\u0435\u0434\u043D\u044B\u0439','\u0421\u0432\u043E\u0431\u043E\u0434\u043D\u044B\u0439','\u0417\u043D\u0430\u0442\u043D\u044B\u0439']"
            },
            passions_list: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string"
                  },
                  label: {
                    type: "string"
                  }
                },
                required: [
                  "id",
                  "label"
                ],
                additionalProperties: false
              },
              description: "\u0440\u0435\u0435\u0441\u0442\u0440 \u0441\u0442\u0440\u0430\u0441\u0442\u0435\u0439 (\u0430\u0443\u0434\u0438\u0442 B6): id + \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435; \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F 0..100+"
            },
            allegiances: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string"
                  },
                  label: {
                    type: "string"
                  }
                },
                required: [
                  "id",
                  "label"
                ],
                additionalProperties: false
              },
              description: "\u0440\u0435\u0435\u0441\u0442\u0440 \u0441\u0438\u043B \u043F\u0440\u0438\u0447\u0430\u0441\u0442\u043D\u043E\u0441\u0442\u0438 (\u0430\u0443\u0434\u0438\u0442 B6): \u0431\u043E\u0433\u0438, \u0434\u0443\u0445\u0438, \u0441\u0442\u0438\u0445\u0438\u0438; \u043E\u0447\u043A\u0438 \u0434\u043E 100+"
            },
            power_level: {
              type: "string",
              enum: [
                "normal",
                "heroic",
                "epic",
                "superhuman"
              ],
              description: "\u0423\u0440\u043E\u0432\u0435\u043D\u044C \u043C\u043E\u0449\u0438 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 (\u0430\u0443\u0434\u0438\u0442 B6, \u043A\u043D\u0438\u0436\u043D\u044B\u0435 normal/heroic/epic/superhuman):\n\u043C\u0435\u0442\u043A\u0430 \u0434\u043B\u044F \u0443\u0441\u043B\u043E\u0432\u0438\u0439 power_level_ge \u0438 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0438; \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438/\u043D\u0430\u0432\u044B\u043A\u0438\n\u043C\u0430\u0441\u0442\u0435\u0440 \u0437\u0430\u0434\u0430\u0451\u0442 \u0447\u0435\u0440\u0435\u0437 char_creation (\u0434\u043B\u044F heroic \u2014 \u0444\u043E\u0440\u043C\u0443\u043B\u044B 2d6+6 \u0432 roll)."
            },
            augments: {
              type: "object",
              properties: {
                threshold: {
                  type: "number"
                },
                bonus: {
                  type: "number"
                }
              },
              additionalProperties: false,
              description: "\u0410\u0443\u0433\u043C\u0435\u043D\u0442\u044B \u0441\u0442\u0440\u0430\u0441\u0442\u0435\u0439 \u0438 \u043F\u043E\u0434\u043C\u043E\u0433\u0430 \u0441\u043E\u044E\u0437\u043D\u0438\u043A\u043E\u0432 (\u0430\u0443\u0434\u0438\u0442 B6): \u043E\u0434\u0438\u043D\u0430\u043A\u043E\u0432\u044B\u0435 \u0447\u0438\u0441\u043B\u0430 \u0434\u043B\u044F\n\u0432\u0441\u0435\u0445 \u043F\u0440\u043E\u0432\u0435\u0440\u043E\u043A. threshold \u2014 \u043C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0441\u0442\u0440\u0430\u0441\u0442\u0438/\u043D\u0430\u0432\u044B\u043A\u0430 \u0441\u043E\u044E\u0437\u043D\u0438\u043A\u0430\n(\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 50), bonus \u2014 \u043F\u0440\u0438\u0431\u0430\u0432\u043A\u0430 \u043A \u0431\u0440\u043E\u0441\u043A\u0443 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 +20, \u043A\u043D\u0438\u0436\u043D\u043E)."
            },
            item_categories: {
              type: "array",
              items: {
                $ref: "#/$defs/ItemCategoryDef"
              },
              description: "\u0440\u0435\u0435\u0441\u0442\u0440 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432: \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u0435\u0442, \u0447\u0442\u043E \u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u0443\u043C\u0435\u0435\u0442"
            },
            slot_types: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string"
                  },
                  label: {
                    type: "string"
                  },
                  sounds: {
                    $ref: "#/$defs/SoundHookMap"
                  }
                },
                required: [
                  "id",
                  "label"
                ],
                additionalProperties: false
              },
              description: "\u0440\u0435\u0435\u0441\u0442\u0440 \u0442\u0438\u043F\u043E\u0432 \u0441\u043B\u043E\u0442\u043E\u0432 \u0441\u0446\u0435\u043D\u044B (\u0447\u0442\u043E \u043C\u043E\u0436\u043D\u043E \u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0432 \u0441\u043B\u043E\u0442); \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u2014 \u0432\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0435"
            },
            flags: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string"
                  },
                  label: {
                    type: "string"
                  },
                  description: {
                    type: "string",
                    description: "\u0434\u043B\u044F \u0447\u0435\u0433\u043E \u043D\u0443\u0436\u0435\u043D: \u043A\u0430\u043A\u043E\u0435 \u0441\u043E\u0431\u044B\u0442\u0438\u0435 \u0437\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u0435\u0442 \u0438 \u0433\u0434\u0435 \u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F (\u043F\u0440\u0430\u0432\u0438\u043B\u0430,\n\u0434\u0438\u0430\u043B\u043E\u0433\u0438, \u043A\u0432\u0435\u0441\u0442\u044B). \u0414\u043B\u044F \u0418\u0418-\u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0439 \u041E\u0411\u042F\u0417\u0410\u0422\u0415\u041B\u042C\u041D\u041E\u0415 \u043F\u043E\u043B\u0435 (\u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u0435 \u0447\u0435\u043C\u043E\u0434\u0430\u043D\u0430)."
                  }
                },
                required: [
                  "id",
                  "label"
                ],
                additionalProperties: false
              },
              description: "\u0440\u0435\u0435\u0441\u0442\u0440 \u0444\u043B\u0430\u0433\u043E\u0432: \u0440\u0443\u0441\u0441\u043A\u043E\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0438 \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 (\u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F, \u0434\u0432\u0438\u0436\u043A\u0443 \u0432\u0430\u0436\u0435\u043D \u0442\u043E\u043B\u044C\u043A\u043E id)"
            },
            emotions: {
              type: "array",
              items: {
                $ref: "#/$defs/EmotionDef"
              },
              description: "\u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F \u043F\u043E\u0440\u0442\u0440\u0435\u0442\u043E\u0432 (\u0432\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0435 + \u0441\u0432\u043E\u0438), \u0444\u0438\u0434\u0431\u0435\u043A 9.14"
            },
            currencies: {
              type: "array",
              items: {
                $ref: "#/$defs/CurrencyDef"
              }
            },
            factions: {
              type: "array",
              items: {
                $ref: "#/$defs/FactionDef"
              }
            },
            music_tracks: {
              type: "array",
              items: {
                $ref: "#/$defs/MusicTrackDef"
              },
              description: "\u0440\u0435\u0435\u0441\u0442\u0440 \u043C\u0443\u0437\u044B\u043A\u0430\u043B\u044C\u043D\u044B\u0445 \u0442\u0440\u0435\u043A\u043E\u0432 (\u0438\u0442\u0435\u0440\u0430\u0446\u0438\u044F 8, \u0431\u043B\u043E\u043A H): \u0444\u0430\u0439\u043B/\u0441\u0441\u044B\u043B\u043A\u0430 \u0418\u041B\u0418 \u0441\u0438\u043D\u0442\u0435\u0437 MusicDoc"
            },
            chapters: {
              type: "array",
              items: {
                $ref: "#/$defs/CampaignChapter"
              },
              description: "\u041A\u043D\u0438\u0433\u0430 2.0 (\u043F\u0440\u043E\u0435\u043A\u0442\u043D\u044B\u0435 \u0434\u043E\u0431\u0430\u0432\u043A\u0438 \u043F\u043E\u0441\u043B\u0435 \u0444\u0438\u0434\u0431\u0435\u043A\u0430 28-09): \u0433\u043B\u0430\u0432\u044B \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438.\n\u041C\u0435\u0445\u0430\u043D\u0438\u043A\u0430 \xAB\u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u044B\u0439 \u043F\u0440\u043E\u043B\u043E\u0433 \u2192 \u043F\u043B\u0430\u0442\u043D\u043E\u0435 \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0435\u043D\u0438\u0435\xBB \u0441\u043F\u0440\u043E\u0435\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0430 \u043D\u0430\n\u0443\u0440\u043E\u0432\u043D\u0435 \u043F\u0430\u043A\u0435\u0442\u043E\u0432: \u043F\u0440\u043E\u043B\u043E\u0433 \u2014 \u0433\u043B\u0430\u0432\u0430(\u044B), \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0435\u043D\u0438\u0435 \u2014 \u043F\u0430\u043A\u0435\u0442 \u0441 `series.base`,\n\u043F\u043B\u0430\u0442\u0451\u0436\u043D\u044B\u0439 \u0433\u0435\u0439\u0442 \u2014 \u0441 \u043C\u0430\u0441\u0442\u0435\u0440\u0441\u043A\u043E\u0439; \u0437\u0434\u0435\u0441\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u0430\u043D\u043D\u044B\u0435 \u0438 \u0433\u0440\u0443\u043F\u043F\u0438\u0440\u043E\u0432\u043A\u0430."
            },
            series: {
              type: "object",
              properties: {
                base: {
                  type: "string"
                },
                part: {
                  type: "number"
                },
                label: {
                  type: "string"
                }
              },
              additionalProperties: false,
              description: "\u041C\u0435\u0441\u0442\u043E \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u0432 \u0441\u0435\u0440\u0438\u0438 (DLC/\u0447\u0430\u0441\u0442\u0438): `base` \u2014 id \u0431\u0430\u0437\u043E\u0432\u043E\u0439 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438,\n`part` \u2014 \u043D\u043E\u043C\u0435\u0440 \u0447\u0430\u0441\u0442\u0438 (\u043E\u0441\u043D\u043E\u0432\u043D\u0430\u044F \u0438\u0433\u0440\u0430 \u2014 1), `label` \u2014 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0447\u0430\u0441\u0442\u0438.\n\u041C\u043E\u0434\u0443\u043B\u044C\u043D\u0430\u044F \u0441\u043E\u0432\u043C\u0435\u0441\u0442\u0438\u043C\u043E\u0441\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0439/\u044D\u043A\u0441\u043F\u043E\u0440\u0442\u0430 \u043D\u0435 \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F."
            },
            attribution: {
              type: "object",
              properties: {
                author: {
                  type: "string"
                },
                origin_url: {
                  type: "string",
                  description: "\u043A\u0430\u043D\u043E\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0430\u0434\u0440\u0435\u0441 \u043F\u0443\u0431\u043B\u0438\u043A\u0430\u0446\u0438\u0438 (GitHub \u0440\u0435\u043F\u043E\u0437\u0438\u0442\u043E\u0440\u0438\u0439 \u043C\u0430\u0441\u0442\u0435\u0440\u0430)"
                },
                published_at: {
                  type: "string",
                  description: "\u0434\u0430\u0442\u0430 \u043F\u0435\u0440\u0432\u043E\u0439 \u043F\u0443\u0431\u043B\u0438\u0447\u043D\u043E\u0439 \u0432\u0435\u0440\u0441\u0438\u0438 (ISO)"
                },
                note: {
                  type: "string",
                  description: "\u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0435 \u0440\u0430\u0441\u043A\u0440\u044B\u0442\u0438\u0435: \u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0435, \u0432\u0434\u043E\u0445\u043D\u043E\u0432\u0435\u043D\u0438\u0435, \u0441\u0441\u044B\u043B\u043A\u0438 \u043D\u0430 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0438"
                }
              },
              additionalProperties: false,
              description: "\u0411\u043B\u043E\u043A \u0430\u0432\u0442\u043E\u0440\u0441\u0442\u0432\u0430 (\u043F\u0443\u0431\u043B\u0438\u043A\u0430\u0446\u0438\u044F): \u043A\u0442\u043E \u043F\u0440\u0438\u0434\u0443\u043C\u0430\u043B \u0438 \u0441\u043E\u0431\u0440\u0430\u043B, \u043E\u0442\u043A\u0443\u0434\u0430 \u043A\u0430\u043D\u043E\u043D\u0438\u0447\u0435\u0441\u043A\u0430\u044F\n\u043A\u043E\u043F\u0438\u044F. \u041C\u0430\u0441\u0442\u0435\u0440\u0441\u043A\u0430\u044F \u0441\u0432\u0435\u0440\u044F\u0435\u0442 \u043E\u0442\u043F\u0435\u0447\u0430\u0442\u043A\u0438 \u0438 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u044D\u0442\u043E\u0442 \u0431\u043B\u043E\u043A; \u043F\u043E\u043B\u044F\n\u0432\u043B\u0438\u044F\u044E\u0442 \u043D\u0430 \u0434\u0430\u043D\u043D\u044B\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438, \u043D\u043E \u043D\u0435 \u043D\u0430 \u0438\u0433\u0440\u043E\u0432\u043E\u0439 \u043F\u0440\u043E\u0446\u0435\u0441\u0441."
            },
            sounds: {
              type: "array",
              items: {
                $ref: "#/$defs/SoundDef"
              },
              description: "\u0440\u0435\u0435\u0441\u0442\u0440 \u0437\u0432\u0443\u043A\u043E\u0432: \u0444\u0430\u0439\u043B/\u0441\u0441\u044B\u043B\u043A\u0430 \u0418\u041B\u0418 \u0441\u0438\u043D\u0442\u0435\u0437 SoundDoc (\u043C\u0430\u0441\u0441\u0438\u0432 \u2014 \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u044B\u0439 \u0432\u0430\u0440\u0438\u0430\u043D\u0442)"
            },
            ui_sounds: {
              type: "object",
              additionalProperties: {
                type: "string"
              },
              description: "\u0437\u0432\u0443\u043A\u043E\u0432\u0430\u044F \u0442\u0435\u043C\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438: \u0445\u0443\u043A \u2192 id \u0437\u0432\u0443\u043A\u0430 \u0438\u0437 \u0440\u0435\u0435\u0441\u0442\u0440\u0430 (\u043F\u0443\u0441\u0442\u043E\u0439 \u0445\u0443\u043A \u2014 \u0442\u0438\u0448\u0438\u043D\u0430)"
            },
            ui_labels: {
              type: "object",
              additionalProperties: {
                type: "string"
              },
              description: '\u041D\u0430\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u0435\u043C\u044B\u0435 \u043D\u0430\u0434\u043F\u0438\u0441\u0438 \u0441\u0438\u0441\u0442\u0435\u043C\u043D\u044B\u0445 \u043C\u0435\u043D\u044E \u0438 \u043A\u043D\u043E\u043F\u043E\u043A \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 (design-doc \xA79).\n\u041F\u043E\u0437\u0432\u043E\u043B\u044F\u0435\u0442 \u043C\u0430\u0441\u0442\u0435\u0440\u0443 \u0437\u0430\u0434\u0430\u0442\u044C \u0430\u0442\u043C\u043E\u0441\u0444\u0435\u0440\u043D\u044B\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F:\n"inventory": "\u0421\u0443\u043C\u043A\u0430 \u0434\u043E\u0437\u043D\u0430\u0432\u0430\u0442\u0435\u043B\u044F", "journal": "\u0414\u0435\u043B\u043E \u2116 137", "map": "\u0421\u0445\u0435\u043C\u0430 \u044F\u0440\u0443\u0441\u043E\u0432",\n"camp": "\u041F\u0435\u0440\u0435\u043A\u0443\u0440", "codex": "\u0410\u0440\u0445\u0438\u0432 \u041D\u0430\u0434\u0437\u043E\u0440\u0430", "pass_turn": "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044C \u0445\u043E\u0434" \u0438 \u0442.\u043F.'
            },
            default_music: {
              type: "array",
              items: {
                type: "string"
              },
              description: "\u0442\u0440\u0435\u043A(\u0438) \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E, \u043A\u043E\u0433\u0434\u0430 \u0443 \u043B\u043E\u043A\u0430\u0446\u0438\u0438/\u0441\u0446\u0435\u043D\u044B \u0441\u0432\u043E\u0435\u0439 \u043C\u0443\u0437\u044B\u043A\u0438 \u043D\u0435\u0442"
            },
            combat_music: {
              type: "array",
              items: {
                type: "string"
              },
              description: "\u0442\u0440\u0435\u043A(\u0438) \u0431\u043E\u044F \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E (\u0435\u0441\u043B\u0438 \u0443 \u0430\u0440\u0435\u043D\u044B \u043D\u0435\u0442 \u0441\u0432\u043E\u0435\u0433\u043E arena.music)"
            },
            features: {
              $ref: "#/$defs/CampaignFeatures",
              description: "\u043F\u0440\u043E\u0444\u0438\u043B\u044C \u043C\u0435\u0445\u0430\u043D\u0438\u043A: \u0447\u0442\u043E \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u043E \u0432 \u044D\u0442\u043E\u0439 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 (\u043D\u0435\u0442 \u043F\u043E\u043B\u044F \u2014 \u0432\u0441\u0451 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u043E)"
            },
            fonts: {
              type: "array",
              items: {
                $ref: "#/$defs/FontDef"
              },
              description: "\u0440\u0435\u0435\u0441\u0442\u0440 \u0448\u0440\u0438\u0444\u0442\u043E\u0432 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 (\u0431\u043B\u043E\u043A 2 \u0422\u0417)"
            },
            theme: {
              $ref: "#/$defs/ThemeDoc",
              description: "\u0442\u0435\u043C\u0430 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u044F: \u0448\u0440\u0438\u0444\u0442\u043E\u0432\u044B\u0435 \u0440\u043E\u043B\u0438, \u0444\u043E\u043D \u043C\u0435\u043D\u044E/\u0444\u0438\u043D\u0430\u043B\u0430, \u0430\u043A\u0446\u0435\u043D\u0442 (\u0431\u043B\u043E\u043A 2 \u0422\u0417)"
            },
            max_load_formula: {
              const: "str_plus_siz",
              description: "\u043C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u044B\u0439 \u0433\u0440\u0443\u0437 \u0432 \u043A\u0433: STR + SIZ (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E)"
            },
            max_companions: {
              type: "number"
            },
            char_creation: {
              $ref: "#/$defs/CharCreationDef"
            },
            combat: {
              $ref: "#/$defs/CombatRulesDef",
              description: "\u0431\u043E\u0435\u0432\u044B\u0435 \u043F\u0440\u0430\u0432\u0438\u043B\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438: \u043F\u043E\u0431\u0435\u0433, \u043C\u0443\u043B\u044C\u0442\u0438\u0430\u0442\u0430\u043A\u0438, \u0442\u044F\u0436\u0451\u043B\u044B\u0435 \u0440\u0430\u043D\u044B (\u0430\u0443\u0434\u0438\u0442 \xA75.6)"
            },
            luck: {
              type: "object",
              properties: {
                multiplier: {
                  type: "number"
                },
                reroll_cost: {
                  type: "number"
                },
                rest_luck: {
                  type: "boolean"
                }
              },
              additionalProperties: false,
              description: "\u041E\u0447\u043A\u0438 \u0443\u0434\u0430\u0447\u0438 \u0433\u0435\u0440\u043E\u044F (\u0430\u0443\u0434\u0438\u0442 \xA75.6 \u043F.8, \u043A\u043D\u0438\u0436\u043D\u0430\u044F \u0423\u0434\u0430\u0447\u0430 = POW\xD75): \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C =\nPOW \xD7 multiplier (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 5; \u0437\u0430\u0434\u0430\u0439\u0442\u0435 0, \u0447\u0442\u043E\u0431\u044B \u0432\u044B\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0443\u0434\u0430\u0447\u0443).\n\u041D\u0430 \u043F\u0440\u043E\u0432\u0430\u043B\u044C\u043D\u044B\u0439 \u043C\u0438\u0440\u043E\u0432\u043E\u0439/\u0434\u0438\u0430\u043B\u043E\u0433\u043E\u0432\u044B\u0439 \u0431\u0440\u043E\u0441\u043E\u043A \u0438\u0433\u0440\u043E\u043A \u043C\u043E\u0436\u0435\u0442 \u043F\u043E\u0442\u0440\u0430\u0442\u0438\u0442\u044C\n`reroll_cost` \u0443\u0434\u0430\u0447\u0438 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 1) \u0438 \u043F\u0435\u0440\u0435\u0431\u0440\u043E\u0441\u0438\u0442\u044C. \u0423\u0434\u0430\u0447\u0430 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u0442\u0441\u044F\n\u043D\u0430 \u043E\u0442\u0434\u044B\u0445\u0435 (`rest_luck` \u2260 false) \u2014 \u043A\u043D\u0438\u0436\u043D\u043E \u0443\u0434\u0430\u0447\u0430 \u043D\u0435 \u0432\u043E\u0441\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F, \u043D\u043E \u0434\u043B\u044F\n\u0440\u043E\u0433\u0430\u043B\u0438\u043A\u0430 \u043F\u0440\u0438\u044F\u0442\u043D\u0435\u0435 \u043C\u044F\u0433\u0447\u0435; \u043C\u0430\u0441\u0442\u0435\u0440 \u0440\u0435\u0448\u0430\u0435\u0442 \u0441\u0430\u043C."
            },
            progression: {
              type: "object",
              properties: {
                xp_per_level: {
                  type: "number",
                  description: "\u0431\u0430\u0437\u0430 \u043F\u043E\u0440\u043E\u0433\u0430 \u0443\u0440\u043E\u0432\u043D\u044F: \u0443\u0440\u043E\u0432\u0435\u043D\u044C N \u0441\u0442\u043E\u0438\u0442 base\xD7N \u043E\u0447\u043A\u043E\u0432 \u043E\u043F\u044B\u0442\u0430 (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 100)"
                },
                feats_per_level: {
                  type: "number",
                  description: "\u0447\u0435\u0440\u0442 \u0437\u0430 \u0443\u0440\u043E\u0432\u0435\u043D\u044C (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 1; 0 \u2014 \u0443\u0440\u043E\u0432\u043D\u0435\u0432\u0430\u044F \u043F\u0440\u043E\u043A\u0430\u0447\u043A\u0430 \u0431\u0435\u0437 \u0447\u0435\u0440\u0442)"
                },
                max_level: {
                  type: "number",
                  description: "\u043F\u043E\u0442\u043E\u043B\u043E\u043A \u0443\u0440\u043E\u0432\u043D\u044F; \u043D\u0435\u0442 \u2014 \u0431\u0435\u0437 \u043F\u043E\u0442\u043E\u043B\u043A\u0430"
                },
                feats: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/FeatDef"
                  },
                  description: "\u0440\u0435\u0435\u0441\u0442\u0440 \u0447\u0435\u0440\u0442, \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0445 \u0433\u0435\u0440\u043E\u044E"
                }
              },
              additionalProperties: false,
              description: "\u0423\u0440\u043E\u0432\u043D\u0438 \u0438 \u0447\u0435\u0440\u0442\u044B \u2014 \u041E\u041F\u0426\u0418\u041E\u041D\u0410\u041B\u042C\u041D\u0410\u042F \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441\u0438\u044F \u043F\u043E\u0432\u0435\u0440\u0445 BRP (\u0430\u0443\u0434\u0438\u0442 B8).\n\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435 \u0431\u043B\u043E\u043A\u0430 \u2014 \u0441\u0438\u0441\u0442\u0435\u043C \u043D\u0435\u0442 (\u043A\u043B\u0430\u0441\u0441\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0440\u043E\u0433\u0430\u043B\u0438\u043A: \u0440\u043E\u0441\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430\u0432\u044B\u043A\u043E\u0432).\n\u041E\u043F\u044B\u0442 \u2014 \u044D\u0444\u0444\u0435\u043A\u0442\u043E\u043C grant_xp (\u0438\u043B\u0438 \u043D\u0430\u0433\u0440\u0430\u0434\u044B \u0434\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u0439), \u043F\u043E\u0440\u043E\u0433\u0438:\nxp_per_level (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 100 \u0437\u0430 \u0443\u0440\u043E\u0432\u0435\u043D\u044C, \u043A\u0443\u043C\u0443\u043B\u044F\u0442\u0438\u0432\u043D\u043E base\xD7(1..n))."
            },
            metaprogress: {
              $ref: "#/$defs/MetaProgressDef",
              description: "\u041C\u0435\u0442\u0430-\u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441 \u043C\u0435\u0436\u0434\u0443 \u0437\u0430\u0431\u0435\u0433\u0430\u043C\u0438 (\u0430\u0443\u0434\u0438\u0442 B8b): \u0434\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u044F, \u043C\u0435\u0442\u0430\u0432\u0430\u043B\u044E\u0442\u044B \u0438\n\u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0435 \u0443\u0441\u0438\u043B\u0435\u043D\u0438\u044F. \u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u2014 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u043A\u043B\u044E\u0447\u043E\u043C localStorage\n`chronicle-forge:meta:<campaignId>`, \u0436\u0438\u0432\u0451\u0442 \u043F\u0435\u0440\u0435\u043A\u0440\u0451\u0441\u0442\u043D\u043E \u043C\u0435\u0436\u0434\u0443 \u0441\u0435\u0439\u0432\u0430\u043C\u0438.\n\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435 \u0431\u043B\u043E\u043A\u0430 \u2014 \u043C\u0435\u0442\u0430-\u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441\u0430 \u043D\u0435\u0442 (\u043C\u0430\u0441\u0442\u0435\u0440 \u043C\u043E\u0436\u0435\u0442 \u043E\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0432\u0435\u0441\u044C \u043F\u043B\u0430\u0441\u0442)."
            },
            generators: {
              $ref: "#/$defs/GeneratorsDef",
              description: "\u0422\u0430\u0431\u043B\u0438\u0446\u044B \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u044B\u0445 \u0441\u043E\u0431\u044B\u0442\u0438\u0439 \u0438 \u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440\u044B \u043A\u043E\u043D\u0442\u0435\u043D\u0442\u0430 (\u0430\u0443\u0434\u0438\u0442 B9).\n\u041C\u0430\u0441\u0442\u0435\u0440 \u0440\u0435\u0448\u0430\u0435\u0442: \u043C\u043E\u0436\u043D\u043E \u043E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0432\u0441\u0451 (\u043D\u0435\u0442 \u0431\u043B\u043E\u043A\u0430), \u043E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0435\n\u0442\u0430\u0431\u043B\u0438\u0446\u044B (table.disabled) \u0438\u043B\u0438 \u0441\u043E\u0431\u0438\u0440\u0430\u0442\u044C \u0441\u0432\u043E\u0438 \u2014 \u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440\u044B \u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0442\n\u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430 \u0442\u0430\u0431\u043B\u0438\u0446\u0430\u0445, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043E\u043F\u0438\u0441\u0430\u043B \u043C\u0430\u0441\u0442\u0435\u0440."
            },
            stealth: {
              type: "object",
              properties: {
                skill: {
                  type: "string"
                },
                perception_skill: {
                  type: "string"
                }
              },
              additionalProperties: false,
              description: "\u0421\u043A\u0440\u044B\u0442\u043D\u043E\u0441\u0442\u044C \u0438 \u043E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u0438\u0435 (\u0430\u0443\u0434\u0438\u0442 \xA75.6 \u043F.12). \u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435 \u0431\u043B\u043E\u043A\u0430 \u2014 \u0441\u0438\u0441\u0442\u0435\u043C\u044B\n\u043D\u0435\u0442 (\u0434\u043B\u044F \u0441\u0442\u0435\u043B\u0441-\u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0439 \u043C\u0430\u0441\u0442\u0435\u0440 \u0432\u043A\u043B\u044E\u0447\u0430\u0435\u0442 \u044F\u0432\u043D\u043E).\n- `skill` \u2014 \u043D\u0430\u0432\u044B\u043A \u0441\u043A\u0440\u044B\u0442\u043D\u043E\u0441\u0442\u0438 \u0433\u0435\u0440\u043E\u044F (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 'stealth');\n- `perception_skill` \u2014 \u043D\u0430\u0432\u044B\u043A \u043E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u0438\u044F \u0443 NPC (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 'perception';\n  \u0443 NPC \u0431\u0435\u0437 \u043D\u0435\u0433\u043E \u0431\u0435\u0440\u0451\u0442\u0441\u044F INT\xD72);\n- `combat_hide_penalty` \u2014 \u0448\u0442\u0440\u0430\u0444 \u0430\u0442\u0430\u043A\u0438 \u0432\u0440\u0430\u0433\u043E\u0432 \u043F\u043E \u0441\u043A\u0440\u044B\u0442\u043E\u043C\u0443 \u0433\u0435\u0440\u043E\u044E\u2026 \u043D\u0435\u0442:\n  \u0441\u043A\u0440\u044B\u0442\u044B\u0439 \u0433\u0435\u0440\u043E\u0439 \u043F\u0440\u043E\u0441\u0442\u043E \u043D\u0435 \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u0442\u0441\u044F \u0446\u0435\u043B\u044C\u044E."
            },
            rest: {
              type: "object",
              properties: {
                hp: {
                  type: "string"
                },
                mp_full: {
                  type: "boolean"
                }
              },
              additionalProperties: false,
              description: "\u041E\u0442\u0434\u044B\u0445 \u0438 \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0435 \u043B\u0435\u0447\u0435\u043D\u0438\u0435 (\u0430\u0443\u0434\u0438\u0442 \xA75.6 \u043F.3): \u0441\u043E\u043D \u0447\u0435\u0440\u0435\u0437 ink-\u0432\u044B\u0437\u043E\u0432\n`sleep` \u0440\u0430\u043D\u044C\u0448\u0435 \u0442\u043E\u043B\u044C\u043A\u043E \u0440\u0430\u0441\u0442\u0438\u043B \u043D\u0430\u0432\u044B\u043A\u0438. \u0422\u0435\u043F\u0435\u0440\u044C: `hp` \u2014 \u043A\u043E\u0441\u0442\u0438 \u043B\u0435\u0447\u0435\u043D\u0438\u044F \u0437\u0430\n\u0441\u043E\u043D (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 '1d3', \u043C\u0430\u0441\u0442\u0435\u0440 \u0441\u0430\u043C \u0440\u0435\u0448\u0430\u0435\u0442 \u0449\u0435\u0434\u0440\u043E\u0441\u0442\u044C); `mp_full` \u2014 MP\n\u0432\u043E\u0441\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 true)."
            },
            default_player: {
              type: "string",
              description: "id \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u0438-\u0448\u0430\u0431\u043B\u043E\u043D\u0430 \u0438\u0433\u0440\u043E\u043A\u0430 (\u0424\u0430\u0437\u0430 0: \u043F\u0440\u0435\u0434\u0441\u043E\u0437\u0434\u0430\u043D\u043D\u044B\u0439 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436)"
            },
            roguelike: {
              type: "object",
              properties: {
                permadeath: {
                  type: "boolean"
                },
                meta_progress: {
                  type: "array",
                  items: {
                    type: "string"
                  }
                },
                randomize_on_restart: {
                  type: "array",
                  items: {
                    type: "string"
                  }
                }
              },
              required: [
                "permadeath",
                "meta_progress",
                "randomize_on_restart"
              ],
              additionalProperties: false
            },
            save_slots: {
              type: "number",
              description: "\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u0440\u0443\u0447\u043D\u044B\u0445 \u0441\u043B\u043E\u0442\u043E\u0432 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0443 \u0438\u0433\u0440\u043E\u043A\u0430 \u0441\u0432\u0435\u0440\u0445 \u0430\u0432\u0442\u043E\u0441\u0435\u0439\u0432\u0430\n(\u0430\u0443\u0434\u0438\u0442 \xA75.6 \u043F.9). \u0423\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 3; 0 \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u0430\u0432\u0442\u043E\u0441\u0435\u0439\u0432 (\u043A\u043B\u0430\u0441\u0441\u0438\u0447\u0435\u0441\u043A\u0438\u0439\n\u0440\u043E\u0433\u0430\u043B\u0438\u043A). \u041F\u0435\u0440\u043C\u0430\u0434\u0435\u0442 \u0441\u0442\u0438\u0440\u0430\u0435\u0442 \u0430\u0432\u0442\u043E\u0441\u0435\u0439\u0432; \u0440\u0443\u0447\u043D\u044B\u0435 \u0441\u043B\u043E\u0442\u044B \u043F\u0435\u0440\u0435\u0436\u0438\u0432\u0430\u044E\u0442 \u0437\u0430\u0431\u0435\u0433 \u2014\n\u044D\u0442\u043E \u0447\u0435\u0441\u0442\u043D\u044B\u0439 \xAB\u0441\u043D\u0438\u043C\u043E\u043A \u043D\u0430 \u0432\u0441\u044F\u043A\u0438\u0439 \u0441\u043B\u0443\u0447\u0430\u0439\xBB, \u043C\u0430\u0441\u0442\u0435\u0440 \u043C\u043E\u0436\u0435\u0442 \u0437\u0430\u043F\u0440\u0435\u0442\u0438\u0442\u044C."
            }
          },
          required: [
            "id",
            "title",
            "version",
            "engine_version",
            "author",
            "description",
            "tick_label",
            "ticks_per_day",
            "starting_region",
            "starting_location",
            "starting_scene",
            "needs",
            "currencies",
            "default_player"
          ],
          additionalProperties: false
        },
        TravelConnection: {
          type: "object",
          properties: {
            to: {
              type: "string"
            },
            cost_ticks: {
              type: "number"
            },
            requirements: {
              type: "array",
              items: {
                $ref: "#/$defs/Condition"
              }
            },
            random_encounter_table: {
              type: "string"
            },
            sound: {
              type: "string",
              description: "\u0438\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u0437\u0432\u0443\u043A \u043F\u0443\u0442\u0438 (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, \u0448\u0443\u043C \u043F\u043E\u0435\u0437\u0434\u0430, \u043F\u043B\u0435\u0441\u043A \u0432\u043E\u043B\u043D, \u0441\u0442\u0443\u043A \u043A\u043E\u043F\u044B\u0442)"
            },
            sound_volume: {
              type: "number"
            },
            depart_sound: {
              type: "string",
              description: "\u0438\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u0437\u0432\u0443\u043A \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F (\u0441\u0432\u0438\u0441\u0442\u043E\u043A \u043F\u0430\u0440\u043E\u0432\u043E\u0437\u0430, \u0441\u043A\u0440\u0438\u043F \u0442\u0440\u0430\u043F\u0430)"
            },
            depart_sound_volume: {
              type: "number"
            },
            arrive_sound: {
              type: "string",
              description: "\u0438\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u0437\u0432\u0443\u043A \u043F\u0440\u0438\u0431\u044B\u0442\u0438\u044F (\u0441\u043A\u0440\u0438\u043F \u0442\u043E\u0440\u043C\u043E\u0437\u043E\u0432, \u0437\u0432\u043E\u043D \u0441\u0442\u0430\u043D\u0446\u0438\u043E\u043D\u043D\u043E\u0433\u043E \u043A\u043E\u043B\u043E\u043A\u043E\u043B\u0430)"
            },
            arrive_sound_volume: {
              type: "number"
            }
          },
          required: [
            "to",
            "cost_ticks"
          ],
          additionalProperties: false
        },
        AmbientRule: {
          type: "object",
          properties: {
            conditions: {
              type: "array",
              items: {
                $ref: "#/$defs/Condition"
              },
              description: "\u0443\u0441\u043B\u043E\u0432\u0438\u044F \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u0437\u0432\u0443\u043A\u043E\u0432\u043E\u0433\u043E \u0441\u043B\u043E\u044F (\u0435\u0441\u043B\u0438 \u0443\u0441\u043B\u043E\u0432\u0438\u0439 \u043D\u0435\u0442 \u2014 \u0437\u0432\u0443\u0447\u0438\u0442 \u0432\u0441\u0435\u0433\u0434\u0430)"
            },
            sounds: {
              type: "array",
              items: {
                type: "string"
              },
              description: "\u0437\u0430\u0446\u0438\u043A\u043B\u0435\u043D\u043D\u044B\u0435 \u0437\u0432\u0443\u043A\u0438 (id \u0438\u0437 \u0440\u0435\u0435\u0441\u0442\u0440\u0430 meta.sounds \u0438\u043B\u0438 \u043F\u0443\u0442\u044C \u043A \u0444\u0430\u0439\u043B\u0443)"
            },
            sound: {
              type: "string",
              description: "\u043E\u0434\u0438\u043D\u043E\u0447\u043D\u044B\u0439 id \u0437\u0432\u0443\u043A\u0430 \u0434\u043B\u044F \u043A\u0440\u0430\u0442\u043A\u043E\u0441\u0442\u0438"
            },
            volume: {
              type: "number",
              description: "\u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u044C \u0441\u043B\u043E\u044F 0..1 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 1)"
            }
          },
          additionalProperties: false,
          description: "\u0444\u043E\u043D\u043E\u0432\u044B\u0439 \u0437\u0430\u0446\u0438\u043A\u043B\u0435\u043D\u043D\u044B\u0439 \u0437\u0432\u0443\u043A\u043E\u0432\u043E\u0439 \u0441\u043B\u043E\u0439 \u0441 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u043C\u0438 \u0430\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u0438"
        },
        MusicCondition: {
          type: "object",
          properties: {
            time_of_day: {
              anyOf: [
                {
                  $ref: "#/$defs/TimeOfDay"
                },
                {
                  type: "array",
                  items: {
                    $ref: "#/$defs/TimeOfDay"
                  }
                }
              ]
            },
            flag: {
              type: "string"
            },
            not_flag: {
              type: "string"
            },
            weather: {
              type: "string",
              description: "\u0442\u0435\u043A\u0443\u0449\u0430\u044F \u043F\u043E\u0433\u043E\u0434\u0430 (\u0431\u043B\u043E\u043A 9 \u0422\u0417)"
            }
          },
          additionalProperties: false,
          description: "\u0443\u0441\u043B\u043E\u0432\u0438\u0435 \u043C\u0443\u0437\u044B\u043A\u0430\u043B\u044C\u043D\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u0438 (\u043F\u0430\u0442\u0442\u0435\u0440\u043D \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F; \u0432\u0441\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u2014 \u043F\u043E \xAB\u0418\xBB)"
        },
        MusicRule: {
          type: "object",
          properties: {
            tracks: {
              type: "array",
              items: {
                type: "string"
              }
            },
            shuffle: {
              type: "boolean"
            },
            conditions: {
              type: "array",
              items: {
                anyOf: [
                  {
                    $ref: "#/$defs/MusicCondition"
                  },
                  {
                    $ref: "#/$defs/Condition"
                  }
                ]
              },
              description: "\u0443\u0441\u043B\u043E\u0432\u0438\u044F \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u043C\u0443\u0437\u044B\u043A\u0438: \u043A\u0430\u043A \u0441\u043F\u0435\u0446\u0438\u0430\u043B\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0435 (time_of_day, weather, flag), \u0442\u0430\u043A \u0438 \u043B\u044E\u0431\u044B\u0435 Condition \u0434\u0432\u0438\u0436\u043A\u0430"
            }
          },
          required: [
            "tracks"
          ],
          additionalProperties: false,
          description: "\u0417\u0430\u043F\u0438\u0441\u044C \xAB\u0443\u0441\u043B\u043E\u0432\u0438\u044F \u2192 \u043C\u0443\u0437\u044B\u043A\u0430\xBB (\u0443 \u043B\u043E\u043A\u0430\u0446\u0438\u0438/\u0441\u0446\u0435\u043D\u044B): `tracks` \u2014 \u0412\u0421\u0415\u0413\u0414\u0410 \u0441\u043F\u0438\u0441\u043E\u043A\n(\u043E\u0434\u0438\u043D \u0442\u0440\u0435\u043A \u2014 \u043B\u0443\u043F, \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u2014 \u043F\u043B\u0435\u0439\u043B\u0438\u0441\u0442 \u0441\u043E \u0441\u043C\u0435\u043D\u043E\u0439 \u0438 \u043A\u0440\u043E\u0441\u0441\u0444\u0435\u0439\u0434\u043E\u043C,\n`shuffle` \u2014 \u0432 \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u043E\u043C \u043F\u043E\u0440\u044F\u0434\u043A\u0435 \u0431\u0435\u0437 \u043F\u043E\u0432\u0442\u043E\u0440\u0430 \u043F\u043E\u0434\u0440\u044F\u0434); \u043F\u043E\u0431\u0435\u0436\u0434\u0430\u0435\u0442 \u043F\u0435\u0440\u0432\u0430\u044F\n\u0438\u0441\u0442\u0438\u043D\u043D\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C."
        },
        LocationDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            position: {
              type: "object",
              properties: {
                x: {
                  type: "number"
                },
                y: {
                  type: "number"
                }
              },
              required: [
                "x",
                "y"
              ],
              additionalProperties: false
            },
            travel_connections: {
              type: "array",
              items: {
                $ref: "#/$defs/TravelConnection"
              }
            },
            scenes: {
              type: "array",
              items: {
                type: "string"
              }
            },
            arrival_scene: {
              type: "string",
              description: "\u0421\u0446\u0435\u043D\u0430, \u0432 \u043A\u043E\u0442\u043E\u0440\u0443\u044E \u043F\u043E\u043F\u0430\u0434\u0430\u0435\u0442 \u0438\u0433\u0440\u043E\u043A, \u043F\u0440\u0438\u0434\u044F \u0432 \u043B\u043E\u043A\u0430\u0446\u0438\u044E \u0441 \u043A\u0430\u0440\u0442\u044B (\u0438\u0442\u0435\u0440\u0430\u0446\u0438\u044F 8, \u04105).\n\u041F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u2014 \u043F\u0435\u0440\u0432\u0430\u044F \u0441\u0446\u0435\u043D\u0430 \u043B\u043E\u043A\u0430\u0446\u0438\u0438."
            },
            arena: {
              type: "string"
            },
            on_enter_rules: {
              type: "array",
              items: {
                type: "string"
              }
            },
            hidden: {
              type: "boolean"
            },
            ambient_audio: {
              type: "string"
            },
            ambient: {
              type: "array",
              items: {
                anyOf: [
                  {
                    type: "string"
                  },
                  {
                    $ref: "#/$defs/AmbientRule"
                  }
                ]
              },
              description: "\u0444\u043E\u043D\u043E\u0432\u044B\u0435 \u0437\u0430\u0446\u0438\u043A\u043B\u0435\u043D\u043D\u044B\u0435 \u0437\u0432\u0443\u043A\u0438 (\u043F\u0442\u0438\u0446\u044B, \u0433\u0443\u043B): \u0441\u043A\u043B\u0430\u0434\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u0441\u043B\u043E\u044F\u043C\u0438. \u0421\u0442\u0440\u043E\u043A\u0438 id \u0438\u043B\u0438 AmbientRule \u0441 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u043C\u0438"
            },
            camp: {
              type: "boolean",
              description: "\u0437\u0434\u0435\u0441\u044C \u043C\u043E\u0436\u043D\u043E \u0440\u0430\u0437\u0431\u0438\u0442\u044C \u043B\u0430\u0433\u0435\u0440\u044C (\u0430\u0443\u0434\u0438\u0442 B7); \u043A\u043E\u043D\u0444\u0438\u0433 \u043D\u043E\u0447\u043B\u0435\u0433\u0430 \u2014 meta.camping"
            },
            music: {
              anyOf: [
                {
                  type: "string"
                },
                {
                  type: "array",
                  items: {
                    $ref: "#/$defs/MusicRule"
                  }
                }
              ],
              description: "\u043C\u0443\u0437\u044B\u043A\u0430 \u043B\u043E\u043A\u0430\u0446\u0438\u0438: \u0441\u043F\u0438\u0441\u043E\u043A \u0437\u0430\u043F\u0438\u0441\u0435\u0439 \xAB\u0443\u0441\u043B\u043E\u0432\u0438\u044F \u2192 \u0442\u0440\u0435\u043A\u0438\xBB (\u043F\u043E\u0431\u0435\u0436\u0434\u0430\u0435\u0442 \u043F\u0435\u0440\u0432\u0430\u044F\n\u0438\u0441\u0442\u0438\u043D\u043D\u0430\u044F). \u0421\u0442\u0430\u0440\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 \u2014 \u0441\u0442\u0440\u043E\u043A\u0430 (id \u0442\u0440\u0435\u043A\u0430 \u0438\u043B\u0438 \u0441\u0441\u044B\u043B\u043A\u0430) \u2014 \u043C\u0438\u0433\u0440\u0438\u0440\u0443\u0435\u0442\u0441\u044F\n\u0432 `[{ tracks: [s] }]` \u043F\u0440\u0438 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0435."
            }
          },
          required: [
            "id",
            "label",
            "position",
            "travel_connections",
            "scenes"
          ],
          additionalProperties: false
        },
        RegionDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            map_image: {
              type: "string"
            },
            map_art: {
              $ref: "#/$defs/ArtDoc",
              description: "\u0444\u043E\u043D \u043A\u0430\u0440\u0442\u044B, \u043D\u0430\u0440\u0438\u0441\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u043F\u0440\u0438\u043C\u0438\u0442\u0438\u0432\u0430\u043C\u0438 (\u0432\u043C\u0435\u0441\u0442\u043E map_image) \u2014 \u0438\u0442\u0435\u0440\u0430\u0446\u0438\u044F 8, \u0431\u043B\u043E\u043A D"
            },
            map_size: {
              type: "object",
              properties: {
                w: {
                  type: "number"
                },
                h: {
                  type: "number"
                }
              },
              required: [
                "w",
                "h"
              ],
              additionalProperties: false
            },
            parent_region: {
              anyOf: [
                {
                  type: "string"
                },
                {
                  const: null
                }
              ]
            },
            locations: {
              type: "array",
              items: {
                $ref: "#/$defs/LocationDef"
              }
            },
            sub_regions: {
              type: "array",
              items: {
                $ref: "#/$defs/RegionDef"
              }
            }
          },
          required: [
            "id",
            "label",
            "map_image",
            "parent_region",
            "locations"
          ],
          additionalProperties: false
        },
        WorldDef: {
          type: "object",
          properties: {
            regions: {
              type: "array",
              items: {
                $ref: "#/$defs/RegionDef"
              }
            }
          },
          required: [
            "regions"
          ],
          additionalProperties: false
        },
        SceneCondition: {
          type: "object",
          properties: {
            time_of_day: {
              anyOf: [
                {
                  $ref: "#/$defs/TimeOfDay"
                },
                {
                  type: "array",
                  items: {
                    $ref: "#/$defs/TimeOfDay"
                  }
                }
              ]
            },
            flag: {
              type: "string"
            },
            not_flag: {
              type: "string"
            },
            weather: {
              type: "string",
              description: "\u0442\u0435\u043A\u0443\u0449\u0430\u044F \u043F\u043E\u0433\u043E\u0434\u0430 (\u0431\u043B\u043E\u043A 9 \u0422\u0417)"
            }
          },
          additionalProperties: false,
          description: "\u041F\u0440\u043E\u0441\u0442\u043E\u0435 \u0434\u0435\u043A\u043B\u0430\u0440\u0430\u0442\u0438\u0432\u043D\u043E\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u0435 \u0434\u043B\u044F \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0439 \u0441\u0446\u0435\u043D\u044B / \u0441\u043B\u043E\u0442\u043E\u0432"
        },
        SceneStateDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            image: {
              $ref: "#/$defs/ImageValue",
              description: "\u0444\u043E\u043D-\u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 (\u0444\u0430\u0439\u043B \u043F\u0430\u043A\u0435\u0442\u0430 \u0438\u043B\u0438 \u0441\u0441\u044B\u043B\u043A\u0430); \u043C\u043E\u0436\u043D\u043E \u0446\u0438\u043A\u043B \u043A\u0430\u0434\u0440\u043E\u0432 (ImageValue)"
            },
            art: {
              $ref: "#/$defs/ArtDoc",
              description: "\u0444\u043E\u043D, \u043D\u0430\u0440\u0438\u0441\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u043F\u0440\u0438\u043C\u0438\u0442\u0438\u0432\u0430\u043C\u0438 (\u0432\u043C\u0435\u0441\u0442\u043E image)"
            },
            camera: {
              $ref: "#/$defs/CameraDoc",
              description: "\u043A\u0438\u043D\u0435\u043C\u0430\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043A\u0430\u043C\u0435\u0440\u0430 \u0444\u043E\u043D\u0430 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F (\u043F\u0430\u043D-\u0437\u0443\u043C)"
            },
            sound: {
              type: "string",
              description: "\u0437\u0432\u0443\u043A, \u0432\u043E\u0441\u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u043C\u044B\u0439 \u043E\u0434\u0438\u043D \u0440\u0430\u0437 \u043F\u0440\u0438 \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0438 \u0441\u0446\u0435\u043D\u044B \u0432 \u044D\u0442\u043E \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435"
            },
            sound_volume: {
              type: "number"
            },
            condition: {
              anyOf: [
                {
                  $ref: "#/$defs/SceneCondition"
                },
                {
                  const: null
                }
              ]
            }
          },
          required: [
            "id",
            "label",
            "condition"
          ],
          additionalProperties: false
        },
        SlotType: {
          type: "string",
          description: "\u0442\u0438\u043F \u0441\u043B\u043E\u0442\u0430 \u2014 id \u0438\u0437 \u0440\u0435\u0435\u0441\u0442\u0440\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 slot_types (\u043C\u0430\u0441\u0442\u0435\u0440 \u043C\u043E\u0436\u0435\u0442 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0442\u044C \u0441\u0432\u043E\u0438)"
        },
        SlotUseWith: {
          type: "object",
          properties: {
            item: {
              type: "string",
              description: "\u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u0438\u0437 \u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u044F \u0438\u0433\u0440\u043E\u043A\u0430"
            },
            consume: {
              type: "boolean",
              description: "\u0438\u0437\u0440\u0430\u0441\u0445\u043E\u0434\u043E\u0432\u0430\u0442\u044C \u043F\u0440\u0435\u0434\u043C\u0435\u0442 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u043D\u0435\u0442)"
            },
            effects: {
              type: "array",
              items: {
                $ref: "#/$defs/Effect"
              }
            },
            message: {
              type: "string"
            }
          },
          required: [
            "item",
            "effects"
          ],
          additionalProperties: false,
          description: "\u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u044F \u043A \u0441\u043B\u043E\u0442\u0443 \u0441\u0446\u0435\u043D\u044B \u2014 \xAB\u043A\u043B\u044E\u0447 \u043A \u0434\u0432\u0435\u0440\u0438\xBB (\u0431\u043B\u043E\u043A 8 \u0422\u0417)"
        },
        SlotDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string",
              description: "\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0441\u043B\u043E\u0442\u0430 \u0434\u043B\u044F \u043C\u0430\u0441\u0442\u0435\u0440\u0430 (\u0432 \u0441\u043F\u0438\u0441\u043A\u0430\u0445 \u0432\u043C\u0435\u0441\u0442\u043E id)"
            },
            type: {
              type: "array",
              items: {
                $ref: "#/$defs/SlotType"
              }
            },
            shape: {
              const: "rect"
            },
            x: {
              type: "number"
            },
            y: {
              type: "number"
            },
            w: {
              type: "number"
            },
            h: {
              type: "number"
            },
            default_entity: {
              type: "string"
            },
            condition: {
              anyOf: [
                {
                  $ref: "#/$defs/SceneCondition"
                },
                {
                  const: null
                }
              ]
            },
            sprite_scale: {
              type: "number",
              description: "\u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0440\u0430\u0437\u043C\u0435\u0440\u0430 \u0441\u043F\u0440\u0430\u0439\u0442\u0430 \u0441\u0446\u0435\u043D\u044B \u0432 \u044D\u0442\u043E\u043C \u0441\u043B\u043E\u0442\u0435 (1 = \u043F\u043E \u0432\u044B\u0441\u043E\u0442\u0435 \u0441\u043B\u043E\u0442\u0430)"
            },
            sprite_state: {
              type: "string",
              description: "\u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0441\u043F\u0440\u0430\u0439\u0442\u0430 \u0441\u0446\u0435\u043D\u044B \u0434\u043B\u044F \u0437\u0430\u043D\u044F\u0442\u043E\u0433\u043E \u041D\u041F\u0421 (\u043A\u043B\u044E\u0447 \u0438\u0437 scene_sprite_states,\nid \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438); \u043F\u0443\u0441\u0442\u043E \u2014 \u043E\u0431\u044B\u0447\u043D\u044B\u0439 \u0441\u043F\u0440\u0430\u0439\u0442"
            },
            sound: {
              type: "string",
              description: "\u0438\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u0437\u0432\u0443\u043A \u043A\u043B\u0438\u043A\u0430/\u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0441\u043E \u0441\u043B\u043E\u0442\u043E\u043C"
            },
            sound_volume: {
              type: "number"
            },
            use_with: {
              type: "array",
              items: {
                $ref: "#/$defs/SlotUseWith"
              },
              description: "\u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B, \u043A\u043E\u0442\u043E\u0440\u044B\u043C\u0438 \u043C\u043E\u0436\u043D\u043E \u0432\u043E\u0437\u0434\u0435\u0439\u0441\u0442\u0432\u043E\u0432\u0430\u0442\u044C \u043D\u0430 \u0441\u043B\u043E\u0442 (\u0431\u043B\u043E\u043A 8 \u0422\u0417)"
            },
            environmental: {
              type: "boolean",
              description: "\u0445\u043E\u0442\u0441\u043F\u043E\u0442 \u043E\u043A\u0440\u0443\u0436\u0435\u043D\u0438\u044F (\u043D\u0430\u0440\u0438\u0441\u043E\u0432\u0430\u043D \u043F\u0440\u044F\u043C\u043E \u043D\u0430 \u0444\u043E\u043D\u0435 \u0441\u0446\u0435\u043D\u044B; \u0432 \u043F\u043E\u043A\u043E\u0435 \u043D\u0435\u0432\u0438\u0434\u0438\u043C, \u043F\u0440\u043E\u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043F\u0440\u0438 \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u0438 \u0438\u043B\u0438 Tab)"
            }
          },
          required: [
            "id",
            "type",
            "shape",
            "x",
            "y",
            "w",
            "h",
            "condition"
          ],
          additionalProperties: false
        },
        NavigationZone: {
          type: "object",
          properties: {
            area: {
              type: "object",
              properties: {
                x: {
                  type: "number"
                },
                y: {
                  type: "number"
                },
                w: {
                  type: "number"
                },
                h: {
                  type: "number"
                }
              },
              required: [
                "x",
                "y",
                "w",
                "h"
              ],
              additionalProperties: false
            },
            go_to_scene: {
              type: "string"
            },
            open_map: {
              type: "boolean"
            },
            label: {
              type: "string"
            },
            cost_ticks: {
              type: "number"
            },
            hide_label: {
              type: "boolean",
              description: "\u0441\u043A\u0440\u044B\u0432\u0430\u0442\u044C \u043F\u043E\u0434\u043F\u0438\u0441\u044C \u0434\u043E \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043A\u0443\u0440\u0441\u043E\u0440\u0430 (\u0437\u043E\u043D\u0430 \u043A\u0430\u043A \u043D\u0435\u0432\u0438\u0434\u0438\u043C\u044B\u0439 \u0445\u043E\u0442\u0441\u043F\u043E\u0442)"
            },
            conditions: {
              type: "array",
              items: {
                $ref: "#/$defs/Condition"
              },
              description: "\u0443\u0441\u043B\u043E\u0432\u0438\u044F \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E\u0441\u0442\u0438 \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0430 (\u0432\u0441\u0435 \u0434\u043E\u043B\u0436\u043D\u044B \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C\u0441\u044F)"
            },
            blocked_message: {
              type: "string",
              description: "\u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0438\u0433\u0440\u043E\u043A\u0443, \u0435\u0441\u043B\u0438 \u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D"
            },
            intercept_dialogue: {
              type: "string",
              description: "\u043F\u0435\u0440\u0435\u0445\u0432\u0430\u0442: \u0432\u043C\u0435\u0441\u0442\u043E \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0430 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0434\u0438\u0430\u043B\u043E\u0433 (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, \u043E\u043A\u043B\u0438\u043A\u0430\u0435\u0442 \u0441\u0442\u0440\u0430\u0436 \u043F\u0440\u0438 \u043F\u043E\u043F\u044B\u0442\u043A\u0435 \u0432\u044B\u0439\u0442\u0438)"
            },
            intercept_rule: {
              type: "string",
              description: "\u043F\u0435\u0440\u0435\u0445\u0432\u0430\u0442: id \u043F\u0440\u0430\u0432\u0438\u043B\u0430-\u043F\u0435\u0440\u0435\u0445\u0432\u0430\u0442\u0447\u0438\u043A\u0430"
            }
          },
          required: [
            "area",
            "label"
          ],
          additionalProperties: false,
          description: "\u0417\u043E\u043D\u0430 \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0430 \u043D\u0430 \u0441\u0446\u0435\u043D\u0435 (\u0438\u0442\u0435\u0440\u0430\u0446\u0438\u044F 8, \u04106): \u0442\u043E\u043B\u044C\u043A\u043E \u0412\u041D\u0423\u0422\u0420\u0418 \u043B\u043E\u043A\u0430\u0446\u0438\u0438 \u2014\n\u0432 \u0434\u0440\u0443\u0433\u0443\u044E \u0441\u0446\u0435\u043D\u0443 \u0438\u043B\u0438 \xAB\u043E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u0430\u0440\u0442\u0443\xBB (\u044D\u0442\u043E \u0438 \u0435\u0441\u0442\u044C \u0432\u044B\u0445\u043E\u0434 \u0438\u0437 \u043B\u043E\u043A\u0430\u0446\u0438\u0438).\n\u0421\u0442\u0430\u0440\u044B\u0435 `go_to_location` \u043C\u0438\u0433\u0440\u0438\u0440\u0443\u044E\u0442\u0441\u044F \u043F\u0440\u0438 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0435 (shared/migrate.ts)."
        },
        SceneParticlesPreset: {
          type: "string",
          enum: [
            "dust",
            "steam",
            "rain",
            "snow",
            "fog",
            "ash",
            "sparks",
            "embers",
            "none"
          ]
        },
        SceneParticlesConfig: {
          type: "object",
          properties: {
            type: {
              $ref: "#/$defs/SceneParticlesPreset"
            },
            density: {
              type: "string",
              enum: [
                "low",
                "medium",
                "high"
              ]
            },
            speed: {
              type: "string",
              enum: [
                "slow",
                "normal",
                "fast"
              ]
            },
            wind: {
              type: "string",
              enum: [
                "left",
                "none",
                "right"
              ]
            },
            color: {
              type: "string"
            }
          },
          required: [
            "type"
          ],
          additionalProperties: false
        },
        SceneParticles: {
          anyOf: [
            {
              $ref: "#/$defs/SceneParticlesPreset"
            },
            {
              $ref: "#/$defs/SceneParticlesConfig"
            }
          ]
        },
        NarrativeIntroEntry: {
          anyOf: [
            {
              type: "string"
            },
            {
              type: "object",
              properties: {
                text: {
                  type: "string"
                },
                voice: {
                  type: "string"
                },
                sfx: {
                  type: "string"
                },
                image: {
                  type: "string"
                },
                camera: {
                  anyOf: [
                    {
                      type: "string"
                    },
                    {
                      $ref: "#/$defs/CameraDoc"
                    }
                  ]
                },
                conditions: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/Condition"
                  }
                },
                duration: {
                  type: "number"
                }
              },
              required: [
                "text"
              ],
              additionalProperties: false
            }
          ]
        },
        SceneDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            location: {
              type: "string"
            },
            canvas: {
              type: "object",
              properties: {
                w: {
                  type: "number"
                },
                h: {
                  type: "number"
                }
              },
              required: [
                "w",
                "h"
              ],
              additionalProperties: false,
              description: "\u0440\u0430\u0437\u043C\u0435\u0440, \u0432 \u043A\u043E\u043E\u0440\u0434\u0438\u043D\u0430\u0442\u0430\u0445 \u043A\u043E\u0442\u043E\u0440\u043E\u0433\u043E \u0440\u0430\u0437\u043C\u0435\u0447\u0435\u043D\u044B \u0441\u043B\u043E\u0442\u044B/\u0437\u043E\u043D\u044B"
            },
            states: {
              type: "array",
              items: {
                $ref: "#/$defs/SceneStateDef"
              }
            },
            slots: {
              type: "array",
              items: {
                $ref: "#/$defs/SlotDef"
              }
            },
            navigation: {
              type: "array",
              items: {
                $ref: "#/$defs/NavigationZone"
              }
            },
            music: {
              type: "array",
              items: {
                $ref: "#/$defs/MusicRule"
              },
              description: "\u043F\u0435\u0440\u0435\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u043C\u0443\u0437\u044B\u043A\u0438 \u0441\u0446\u0435\u043D\u044B (\u0442\u043E\u0442 \u0436\u0435 \u0444\u043E\u0440\u043C\u0430\u0442, \u0447\u0442\u043E \u0443 \u043B\u043E\u043A\u0430\u0446\u0438\u0438)"
            },
            ambient: {
              type: "array",
              items: {
                anyOf: [
                  {
                    type: "string"
                  },
                  {
                    $ref: "#/$defs/AmbientRule"
                  }
                ]
              },
              description: "\u0444\u043E\u043D\u043E\u0432\u044B\u0435 \u0437\u0430\u0446\u0438\u043A\u043B\u0435\u043D\u043D\u044B\u0435 \u0437\u0432\u0443\u043A\u0438 \u0441\u0446\u0435\u043D\u044B (\u0441\u043B\u0430\u0433\u0430\u044E\u0442\u0441\u044F \u0441 \u0444\u043E\u043D\u043E\u043C \u043B\u043E\u043A\u0430\u0446\u0438\u0438). \u0421\u0442\u0440\u043E\u043A\u0430 id \u0438\u043B\u0438 AmbientRule \u0441 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u043C\u0438"
            },
            lighting: {
              type: "string",
              enum: [
                "outdoor",
                "indoor",
                "none"
              ],
              description: "\u0442\u0438\u043F \u043E\u0441\u0432\u0435\u0449\u0435\u043D\u0438\u044F \u0441\u0446\u0435\u043D\u044B: outdoor (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E, \u0444\u0430\u0437\u044B \u0441\u0443\u0442\u043E\u043A), indoor (\u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435), none (\u0431\u0435\u0437 \u0444\u0438\u043B\u044C\u0442\u0440\u043E\u0432)"
            },
            particles: {
              $ref: "#/$defs/SceneParticles",
              description: "\u0430\u0442\u043C\u043E\u0441\u0444\u0435\u0440\u043D\u044B\u0435 \u0447\u0430\u0441\u0442\u0438\u0446\u044B \u0441\u0446\u0435\u043D\u044B (\u043F\u044B\u043B\u044C, \u043F\u0430\u0440, \u0438\u0441\u043A\u0440\u044B, \u0434\u043E\u0436\u0434\u044C, \u0441\u043D\u0435\u0433, \u0442\u0443\u043C\u0430\u043D) \u2014 \u0441\u0442\u0440\u043E\u043A\u0430 \u043F\u0440\u0435\u0441\u0435\u0442\u0430 \u0438\u043B\u0438 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u043D\u044B\u0439 \u043A\u043E\u043D\u0444\u0438\u0433"
            },
            narrative_intro: {
              type: "array",
              items: {
                $ref: "#/$defs/NarrativeIntroEntry"
              },
              description: "\u0432\u0432\u043E\u0434\u043D\u043E\u0435 \u0430\u0442\u043C\u043E\u0441\u0444\u0435\u0440\u043D\u043E\u0435 \u043F\u043E\u0432\u0435\u0441\u0442\u0432\u043E\u0432\u0430\u043D\u0438\u0435 \u043E\u0442 \u0430\u0432\u0442\u043E\u0440\u0430 (\u043C\u044B\u0441\u043B\u0438/\u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043F\u0440\u0438 \u0432\u0445\u043E\u0434\u0435)"
            },
            narrative_intro_once: {
              type: "boolean",
              description: "\u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0432\u0432\u043E\u0434\u043D\u043E\u0435 \u043F\u043E\u0432\u0435\u0441\u0442\u0432\u043E\u0432\u0430\u043D\u0438\u0435 \u0442\u043E\u043B\u044C\u043A\u043E \u043E\u0434\u0438\u043D \u0440\u0430\u0437 \u0437\u0430 \u0437\u0430\u0431\u0435\u0433 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E true)"
            },
            narrative_intro_next_label: {
              type: "string",
              description: "\u043F\u0435\u0440\u0435\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u0442\u0435\u043A\u0441\u0442\u0430 \u043A\u043D\u043E\u043F\u043A\u0438 \xAB\u0414\u0430\u043B\u0435\u0435\xBB"
            },
            narrative_intro_done_label: {
              type: "string",
              description: "\u043F\u0435\u0440\u0435\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u0442\u0435\u043A\u0441\u0442\u0430 \u043A\u043D\u043E\u043F\u043A\u0438 \xAB\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044C / \u041E\u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C\u0441\u044F\xBB"
            },
            chapter: {
              type: "string",
              description: "\u0433\u043B\u0430\u0432\u0430 (id \u0438\u0437 meta.chapters) \u2014 \u0433\u0440\u0443\u043F\u043F\u0438\u0440\u043E\u0432\u043A\u0430 \u0432 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0435; \u0434\u0432\u0438\u0433\u0430\u0442\u0435\u043B\u044C \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F \u043D\u0435 \u0436\u0434\u0451\u0442"
            }
          },
          required: [
            "id",
            "label",
            "location",
            "states",
            "slots",
            "navigation"
          ],
          additionalProperties: false
        },
        StatBlock: {
          type: "object",
          properties: {
            STR: {
              type: "number"
            },
            CON: {
              type: "number"
            },
            SIZ: {
              type: "number"
            },
            DEX: {
              type: "number"
            },
            INT: {
              type: "number"
            },
            POW: {
              type: "number"
            },
            CHA: {
              type: "number"
            },
            HP: {
              type: "number"
            },
            MP: {
              type: "number"
            }
          },
          required: [
            "STR",
            "CON",
            "SIZ",
            "DEX",
            "INT",
            "POW",
            "CHA"
          ],
          additionalProperties: false
        },
        InventoryEntry: {
          type: "object",
          properties: {
            item: {
              type: "string"
            },
            quantity: {
              type: "number"
            },
            durability: {
              type: "number",
              description: "\u041F\u0440\u043E\u0447\u043D\u043E\u0441\u0442\u044C \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E\u0433\u043E \u044D\u043A\u0437\u0435\u043C\u043F\u043B\u044F\u0440\u0430 (\u0430\u0443\u0434\u0438\u0442 \xA75.6 \u043F.10): \u0437\u0430\u043F\u0438\u0441\u044C \u0441 \u044D\u0442\u0438\u043C \u043F\u043E\u043B\u0435\u043C \u2014\n\u043E\u0442\u0434\u0435\u043B\u044C\u043D\u0430\u044F \u043A\u043E\u043F\u0438\u044F \u043C\u043D\u043E\u0433\u043E\u0440\u0430\u0437\u043E\u0432\u043E\u0433\u043E \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430, \u0441\u0442\u0430\u043A\u0430\u0435\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0441 \u0441\u0435\u0431\u0435 \u0440\u0430\u0432\u043D\u044B\u043C\u0438."
            },
            freshness: {
              type: "number",
              description: "\u0421\u0440\u043E\u043A \u0433\u043E\u0434\u043D\u043E\u0441\u0442\u0438 / \u0441\u0432\u0435\u0436\u0435\u0441\u0442\u044C \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E\u0433\u043E \u044D\u043A\u0437\u0435\u043C\u043F\u043B\u044F\u0440\u0430 \u0432 \u0438\u0433\u0440\u043E\u0432\u044B\u0445 \u0442\u0438\u043A\u0430\u0445 (\u0447\u0430\u0441\u0430\u0445):\n\u0423\u0431\u044B\u0432\u0430\u0435\u0442 \u043A\u0430\u0436\u0434\u044B\u0439 \u0442\u0438\u043A; \u043F\u0440\u0438 \u0434\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u0438 0 \u043F\u0440\u0435\u0432\u0440\u0430\u0449\u0430\u0435\u0442\u0441\u044F \u0432 spoil_into \u0438\u043B\u0438 \u0443\u043D\u0438\u0447\u0442\u043E\u0436\u0430\u0435\u0442\u0441\u044F."
            }
          },
          required: [
            "item",
            "quantity"
          ],
          additionalProperties: false
        },
        ScheduleEntry: {
          type: "object",
          properties: {
            time_range: {
              type: "array",
              prefixItems: [
                {
                  type: "number"
                },
                {
                  type: "number"
                }
              ],
              minItems: 2,
              maxItems: 2,
              description: "[\u043E\u0442, \u0434\u043E) \u0432 \u0442\u0438\u043A\u0430\u0445 \u0441\u0443\u0442\u043E\u043A; \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u0447\u0435\u0440\u0435\u0437 \u043F\u043E\u043B\u043D\u043E\u0447\u044C"
            },
            location: {
              type: "string"
            },
            scene: {
              type: "string"
            },
            slot: {
              type: "string"
            }
          },
          required: [
            "time_range",
            "location",
            "scene",
            "slot"
          ],
          additionalProperties: false
        },
        PresenceOverride: {
          type: "object",
          properties: {
            flag: {
              type: "string",
              description: "\u0430\u043A\u0442\u0438\u0432\u0435\u043D, \u043A\u043E\u0433\u0434\u0430 \u0444\u043B\u0430\u0433 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D"
            },
            not_flag: {
              type: "string",
              description: "\u2026\u0438 (\u043E\u043F\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u043E) \u043A\u043E\u0433\u0434\u0430 \u044D\u0442\u043E\u0442 \u0444\u043B\u0430\u0433 \u041D\u0415 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D"
            },
            location: {
              type: "string"
            },
            scene: {
              type: "string"
            },
            slot: {
              type: "string"
            }
          },
          required: [
            "location",
            "scene",
            "slot"
          ],
          additionalProperties: false,
          description: "\xAB\u043F\u0440\u0438 \u0441\u043E\u0431\u044B\u0442\u0438\u0438 \u2014 \u0432 \u044D\u0442\u043E\u043C \u043C\u0435\u0441\u0442\u0435\xBB: \u0430\u043A\u0442\u0438\u0432\u043D\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u0432\u0430\u0436\u043D\u0435\u0435 \u0440\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u044F"
        },
        TraderDef: {
          type: "object",
          properties: {
            sells: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: {
                    type: "string"
                  },
                  price: {
                    type: "number"
                  },
                  stock: {
                    type: "number"
                  }
                },
                required: [
                  "item"
                ],
                additionalProperties: false
              },
              description: "\u0442\u043E\u0432\u0430\u0440\u044B: id \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u0438 \u0446\u0435\u043D\u0430 \u0432 \u0441\u0435\u0440\u0435\u0431\u0440\u0435 (\u043F\u0435\u0440\u0435\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u0435\u0442 value)"
            },
            buys: {
              type: "boolean",
              description: "\u0441\u043A\u0443\u043F\u0430\u0435\u0442 \u043B\u0438 \u0442\u043E\u0440\u0433\u043E\u0432\u0435\u0446 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u0438\u0433\u0440\u043E\u043A\u0430"
            },
            buy_rate: {
              type: "number",
              description: "\u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0437\u0430\u043A\u0443\u043F\u043A\u0438 (\u0434\u043E\u043B\u044F \u043E\u0442 \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u0438)"
            }
          },
          required: [
            "sells",
            "buys"
          ],
          additionalProperties: false
        },
        WeaponData: {
          type: "object",
          properties: {
            skill: {
              type: "string"
            },
            damage: {
              type: "string"
            },
            damage_bonus: {
              type: "boolean"
            },
            range: {
              type: "number"
            },
            attacks_per_round: {
              type: "number"
            },
            parry_capable: {
              type: "boolean"
            },
            label: {
              type: "string"
            },
            durability: {
              type: "number",
              description: "\u0418\u0437\u043D\u043E\u0441 (\u0430\u0443\u0434\u0438\u0442 \xA75.6 \u043F.10): \u043C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u043F\u0440\u043E\u0447\u043D\u043E\u0441\u0442\u044C. \u041D\u0435\u0442 \u2014 \u043E\u0440\u0443\u0436\u0438\u0435 \u0432\u0435\u0447\u043D\u043E.\n\u0421\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u043D\u0438\u0435: \u0437\u0430 \u0431\u043E\u0439 \u0438\u0437\u043D\u0430\u0448\u0438\u0432\u0430\u0435\u0442\u0441\u044F 1 \u0440\u0430\u0437 \u043D\u0430 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043F\u0440\u043E\u0432\u0430\u043B.\n\u0421\u043B\u043E\u043C\u0430\u043D\u043D\u043E\u0435 \u043E\u0440\u0443\u0436\u0438\u0435 \u0437\u0430\u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u043A\u0443\u043B\u0430\u043A\u0430\u043C\u0438, \u0447\u0438\u043D\u0438\u0442\u0441\u044F \u0440\u0435\u0446\u0435\u043F\u0442\u043E\u043C (`repair: true`)."
            },
            ammo_item: {
              type: "string",
              description: "\u0411\u043E\u0435\u043F\u0440\u0438\u043F\u0430\u0441\u044B (\u0430\u0443\u0434\u0438\u0442 B5): id \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430-\u0440\u0430\u0441\u0445\u043E\u0434\u043D\u0438\u043A\u0430 (\u0441\u0442\u0440\u0435\u043B\u044B, \u043F\u0430\u0442\u0440\u043E\u043D\u044B). \u041A\u0430\u0436\u0434\u0430\u044F\n\u0430\u0442\u0430\u043A\u0430 \u0438\u0433\u0440\u043E\u043A\u0430 \u0442\u0440\u0430\u0442\u0438\u0442 1 \u0448\u0442. \u0438\u0437 \u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u044F; NPC \u2014 \u0431\u0435\u0437 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u0439.\n\u041D\u0435\u0442 \u0431\u043E\u0435\u043F\u0440\u0438\u043F\u0430\u0441\u043E\u0432 \u0443 \u0438\u0433\u0440\u043E\u043A\u0430 \u2014 \u043E\u0440\u0443\u0436\u0438\u0435 \u043D\u0435 \u0441\u0442\u0440\u0435\u043B\u044F\u0435\u0442."
            },
            traits: {
              type: "array",
              items: {
                type: "string",
                enum: [
                  "impale",
                  "knockback",
                  "disarm",
                  "grapple",
                  "push_harmless"
                ]
              },
              description: "\u041E\u0441\u043E\u0431\u044B\u0435 \u0443\u0434\u0430\u0440\u044B (\u0430\u0443\u0434\u0438\u0442 B5): \u0441\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u044E\u0442 \u043F\u0440\u0438 \u0443\u0432\u0435\u0440\u0435\u043D\u043D\u043E\u043C \u0443\u0441\u043F\u0435\u0445\u0435 \u0438 \u043A\u0440\u0438\u0442\u0435\n(\u043D\u0430 \u0432\u044B\u0431\u043E\u0440 \u043C\u0430\u0441\u0442\u0435\u0440\u0430 \u043D\u0430 \u043E\u0440\u0443\u0436\u0438\u0435):\n- 'impale' \u2014 \u043F\u0440\u043E\u043D\u0437\u0430\u043D\u0438\u0435: \u0434\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u0431\u0440\u043E\u0441\u043E\u043A \u0443\u0440\u043E\u043D\u0430 \u0431\u0435\u0437 \u0443\u0447\u0451\u0442\u0430 \u0431\u0440\u043E\u043D\u0438;\n- 'knockback' \u2014 \u043E\u0442\u0431\u0440\u043E\u0441 \u043D\u0430 1 \u0433\u0435\u043A\u0441 \u043E\u0442 \u0430\u0442\u0430\u043A\u0443\u044E\u0449\u0435\u0433\u043E;\n- 'disarm' \u2014 \u0440\u0430\u0437\u043E\u0440\u0443\u0436\u0435\u043D\u0438\u0435: \u0446\u0435\u043B\u044C \u0442\u0435\u0440\u044F\u0435\u0442 \u043E\u0440\u0443\u0436\u0438\u0435 (NPC \u2014 \u0433\u043E\u043B\u044B\u043C\u0438 \u0440\u0443\u043A\u0430\u043C\u0438);\n- 'grapple' \u2014 \u0437\u0430\u0445\u0432\u0430\u0442: \u0446\u0435\u043B\u044C \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u0442 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0445\u043E\u0434;\n- 'push_harmless' \u2014 \u0442\u043E\u043B\u0447\u043E\u043A \u0431\u0435\u0437 \u0443\u0440\u043E\u043D\u0430 (\u0443\u0434\u0430\u0440 \u043D\u0435 \u043D\u0430\u043D\u043E\u0441\u0438\u0442 \u0443\u0440\u043E\u043D\u0430 \u0432\u043E\u043E\u0431\u0449\u0435)."
            }
          },
          required: [
            "skill",
            "damage",
            "damage_bonus",
            "range",
            "attacks_per_round",
            "parry_capable"
          ],
          additionalProperties: false
        },
        NpcDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            type: {
              const: "npc"
            },
            label: {
              type: "string"
            },
            unknown_label: {
              type: "string",
              description: "\u0438\u043C\u044F/\u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0434\u043E \u0437\u043D\u0430\u043A\u043E\u043C\u0441\u0442\u0432\u0430 (\u043C\u0435\u0445\u0430\u043D\u0438\u043A\u0430 \xAB\u041D\u0435\u0437\u043D\u0430\u043A\u043E\u043C\u0435\u0446\xBB, \u043D\u0430\u043F\u0440. \xAB\u041D\u0435\u0437\u043D\u0430\u043A\u043E\u043C\u043A\u0430 \u0432 \u043F\u043B\u0430\u0442\u043A\u0435\xBB). \u041F\u043E\u043A\u0430 \u0438\u043C\u044F \u043D\u0435 \u0440\u0430\u0441\u043A\u0440\u044B\u0442\u043E \u0447\u0435\u0440\u0435\u0437 learn_name / \u0434\u0438\u0430\u043B\u043E\u0433, \u0438\u0433\u0440\u043E\u043A \u0432\u0438\u0434\u0438\u0442 \u044D\u0442\u0443 \u043F\u043E\u0434\u043F\u0438\u0441\u044C"
            },
            description: {
              type: "string",
              description: "\u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u0438 (\u043F\u0440\u0438 \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u0438); \u043C\u043E\u0436\u043D\u043E \u043C\u0435\u043D\u044F\u0442\u044C \u0434\u0438\u043D\u0430\u043C\u0438\u0447\u0435\u0441\u043A\u0438 (set_description)"
            },
            portrait: {
              type: "object",
              additionalProperties: {
                type: "string"
              },
              description: "\u041F\u041E\u0420\u0422\u0420\u0415\u0422 (\u0434\u0438\u0430\u043B\u043E\u0433): \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u2192 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 (\u0431\u043B\u043E\u043A 3 \u0422\u0417 \xAB\u0413\u0438\u0431\u043A\u0438\u0439 \u0434\u0432\u0438\u0436\u043E\u043A\xBB)"
            },
            scene_sprite: {
              $ref: "#/$defs/ImageValue",
              description: "\u0421\u041F\u0420\u0410\u0419\u0422 \u0412 \u0421\u0426\u0415\u041D\u0415: \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0441 \u0432\u044B\u0440\u0435\u0437\u0430\u043D\u043D\u044B\u043C \u0444\u043E\u043D\u043E\u043C (\u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u044B\u0439 PNG, \u041E\u0411\u042F\u0417\u0410\u0422\u0415\u041B\u042C\u041D\u041E);\n\u043D\u0435\u0442 \u2014 \u0432 \u0441\u0446\u0435\u043D\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u043F\u043E\u0440\u0442\u0440\u0435\u0442 (\u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \xAB\u041E\u0431\u044B\u0447\u043D\u044B\u0439\xBB).\n\u041C\u043E\u0436\u043D\u043E \u0446\u0438\u043A\u043B \u043A\u0430\u0434\u0440\u043E\u0432 (ImageValue) \u2014 \xAB\u0436\u0438\u0432\u043E\u0439\xBB \u0441\u043F\u0440\u0430\u0439\u0442."
            },
            scene_sprite_states: {
              type: "object",
              additionalProperties: {
                $ref: "#/$defs/ImageValue"
              },
              description: "\u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F \u0441\u043F\u0440\u0430\u0439\u0442\u0430 \u0441\u0446\u0435\u043D\u044B \u2014 \u043F\u043E \u043E\u0431\u0440\u0430\u0437\u0446\u0443 \u043F\u043E\u0440\u0442\u0440\u0435\u0442\u043E\u0432: \u043A\u043B\u044E\u0447 \u2014 id \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F \u0438\u0437\n\u0440\u0435\u0435\u0441\u0442\u0440\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 (`meta.emotions`); \xAB\u041A\u0443\u0434\u0430 \u0434\u0435\u0432\u0430\u0442\u044C\xBB \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u0435\u0442 \u0441\u043B\u043E\u0442 \u0441\u0446\u0435\u043D\u044B\n(SlotDef.sprite_state). \u041F\u0443\u0441\u0442\u043E\u0433\u043E \u043A\u043B\u044E\u0447\u0430 \u043D\u0435\u0442: \xAB\u041E\u0431\u044B\u0447\u043D\u044B\u0439\xBB \u2014 \u044D\u0442\u043E scene_sprite."
            },
            combat_figure: {
              $ref: "#/$defs/ImageValue",
              description: "\u0424\u0418\u0413\u0423\u0420\u041A\u0410 \u0411\u041E\u042F: \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0430\u0435\u0442\u0441\u044F \u043D\u0430 \u0430\u0440\u0435\u043D\u0435 \u0412\u041C\u0415\u0421\u0422\u041E \u0436\u0435\u0442\u043E\u043D\u0430 (\u0431\u0435\u0437 \u043A\u0440\u0443\u0433\u043B\u043E\u0439 \u043C\u0430\u0441\u043A\u0438\n\u0438 \u0440\u0430\u043C\u043A\u0438 \u0441\u0442\u043E\u0440\u043E\u043D\u044B); \u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u044B\u0439 \u0444\u043E\u043D \u041E\u0411\u042F\u0417\u0410\u0422\u0415\u041B\u0415\u041D; \u043D\u0435\u0442 \u2014 \u043A\u0440\u0443\u0433\u043B\u044B\u0439 \u0436\u0435\u0442\u043E\u043D \u0438\u0437\n`token ?? portrait.neutral`. \u041C\u043E\u0436\u043D\u043E \u0446\u0438\u043A\u043B \u043A\u0430\u0434\u0440\u043E\u0432 (ImageValue)."
            },
            combat_figure_states: {
              type: "object",
              additionalProperties: {
                $ref: "#/$defs/ImageValue"
              },
              description: "\u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F \u0444\u0438\u0433\u0443\u0440\u043A\u0438 \u0431\u043E\u044F: 'dead' \u2014 \u043F\u043E\u0433\u0438\u0431, 'down' \u2014 \u0431\u0435\u0437 \u0441\u043E\u0437\u043D\u0430\u043D\u0438\u044F/\u0432\u044B\u0432\u0435\u0434\u0435\u043D,\nid \u0441\u0442\u0430\u0442\u0443\u0441\u0430 \u2014 \u043F\u043E\u043A\u0430 \u0441\u0442\u0430\u0442\u0443\u0441 \u0430\u043A\u0442\u0438\u0432\u0435\u043D. \u041F\u0443\u0441\u0442\u043E\u0439 \u043A\u043B\u044E\u0447 = \u043E\u0431\u044B\u0447\u043D\u0430\u044F (combat_figure)."
            },
            figure_mode: {
              type: "string",
              enum: [
                "topdown",
                "side",
                "static"
              ],
              description: "\u043A\u0430\u043A \u0440\u0430\u0437\u0432\u043E\u0440\u0430\u0447\u0438\u0432\u0430\u0442\u044C \u0444\u0438\u0433\u0443\u0440\u043A\u0443: 'topdown' \u2014 \u043F\u043E\u0432\u043E\u0440\u043E\u0442 \u043A\u0430\u0440\u0442\u0438\u043D\u043A\u0438 \u043A \u0446\u0435\u043B\u0438 (\u0430\u0440\u0442\u0443 \xAB\u0432\u0438\u0434 \u0441\u0432\u0435\u0440\u0445\u0443\xBB),\n'side' \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u0437\u0435\u0440\u043A\u0430\u043B\u043E \u0432\u043B\u0435\u0432\u043E/\u0432\u043F\u0440\u0430\u0432\u043E, \u0411\u0415\u0417 \u043F\u043E\u0432\u043E\u0440\u043E\u0442\u0430 (\u0438\u0441\u043A\u043B\u044E\u0447\u0438\u0442\u0435\u043B\u044C\u043D\u043E \u0434\u043B\u044F \u0444\u0440\u043E\u043D\u0442\u0430\u043B\u044C\u043D\u043E\u0433\u043E/\n\u0432\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0430\u0440\u0442\u0430; \u043D\u0430 \u0430\u0440\u0442\u0435 \xAB\u0441\u0432\u0435\u0440\u0445\u0443\xBB \u0444\u0438\u0433\u0443\u0440\u043A\u0430 \u0432\u0435\u0447\u043D\u043E \u0441\u043C\u043E\u0442\u0440\u0438\u0442 \u0432 \u043A\u0430\u043C\u0435\u0440\u0443 \u2014 \u0447\u0430\u0441\u0442\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430),\n'static' \u2014 \u043D\u0435 \u0440\u0430\u0437\u0432\u043E\u0440\u0430\u0447\u0438\u0432\u0430\u0442\u044C; \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 'topdown'. \u0420\u0435\u0436\u0438\u043C \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u0442\u0441\u044F \u0441\u0442\u0438\u043B\u0435\u043C \u0430\u0440\u0442\u0430 \u0438\n\u0432 \u043E\u0434\u043D\u043E\u0439 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438, \u043A\u0430\u043A \u043F\u0440\u0430\u0432\u0438\u043B\u043E, \u043E\u0434\u0438\u043D \u043D\u0430 \u0432\u0441\u0435\u0445 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u0435\u0439 \u2014 \u043F\u0440\u0438 \u043F\u0435\u0440\u0435\u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u0438 \u0430\u0440\u0442\u0430\n\u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0438\u0440\u0443\u0439 figure_mode/facing_offset \u0443 \u0432\u0441\u0435\u0445."
            },
            facing_offset: {
              type: "number",
              description: "\u0441\u0434\u0432\u0438\u0433 \u0440\u0430\u0437\u0432\u043E\u0440\u043E\u0442\u0430 \u0444\u0438\u0433\u0443\u0440\u043A\u0438, \u0433\u0440\u0430\u0434\u0443\u0441\u044B \u043F\u043E \u0447\u0430\u0441\u043E\u0432\u043E\u0439 (\u0442\u043E\u043B\u044C\u043A\u043E \u0440\u0435\u0436\u0438\u043C 'topdown'):\n\u043F\u0440\u0438\u0431\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043A \u0432\u044B\u0447\u0438\u0441\u043B\u0435\u043D\u043D\u043E\u043C\u0443 \u0434\u0432\u0438\u0436\u043A\u043E\u043C \u043D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044E \u043F\u0440\u0438 \u043E\u0442\u0440\u0438\u0441\u043E\u0432\u043A\u0435. \u041D\u0443\u0436\u0435\u043D,\n\u0435\u0441\u043B\u0438 \u0433\u043E\u0442\u043E\u0432\u044B\u0439 \u0430\u0440\u0442 \u0441\u043C\u043E\u0442\u0440\u0438\u0442 \u043D\u0435 \u0441\u0442\u0440\u043E\u0433\u043E \xAB\u0432\u0432\u0435\u0440\u0445\xBB (0\xB0): 180 \u2014 \u0444\u0438\u0433\u0443\u0440\u043A\u0430 \u043D\u0430\u0440\u0438\u0441\u043E\u0432\u0430\u043D\u0430\n\u0432\u043D\u0438\u0437 (\u043D\u0430 \u044E\u0433), 90 \u2014 \u0432\u043F\u0440\u0430\u0432\u043E, -90 \u2014 \u0432\u043B\u0435\u0432\u043E. \u0412\u043B\u0438\u044F\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430 \u043A\u0430\u0440\u0442\u0438\u043D\u043A\u0443:\n\u0438\u0433\u0440\u043E\u0432\u0430\u044F \u043B\u043E\u0433\u0438\u043A\u0430 (\u0437\u0430\u0434\u043D\u044F\u044F \u0434\u0443\u0433\u0430 \u0443\u0434\u0430\u0440\u0430 \u0432 \u0441\u043F\u0438\u043D\u0443 \u0438 \u0442.\u043F.) \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F \u043F\u043E \u0440\u0435\u0430\u043B\u044C\u043D\u043E\u043C\u0443\n\u043D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044E \u0431\u043E\u0439\u0446\u0430. \u041F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 0."
            },
            shadow: {
              type: "boolean",
              description: "\u043C\u044F\u0433\u043A\u0430\u044F \u0442\u0435\u043D\u044C \u043F\u043E\u0434 \u0441\u043F\u0440\u0430\u0439\u0442\u043E\u043C/\u0444\u0438\u0433\u0443\u0440\u043A\u043E\u0439 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0430)"
            },
            breathe: {
              type: "boolean",
              description: "\u042D\u0444\u0444\u0435\u043A\u0442 \xAB\u0436\u0438\u0432\u043E\u0433\u043E \u0434\u044B\u0445\u0430\u043D\u0438\u044F\xBB \u0441\u043F\u0440\u0430\u0439\u0442\u0430 \u0432 \u0441\u0446\u0435\u043D\u0435:\n\u0414\u043B\u044F NPC \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u0432\u043A\u043B\u044E\u0447\u0451\u043D (true). \u0414\u043B\u044F \u0440\u043E\u0431\u043E\u0442\u043E\u0432, \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u043E\u043D\u043E\u0432, \u043C\u0435\u0445\u0430\u043D\u0438\u0437\u043C\u043E\u0432\n\u0438 \u043D\u0435\u0436\u0438\u0442\u0438 \u043C\u043E\u0436\u043D\u043E \u043E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C (false)."
            },
            token: {
              type: "string",
              description: "\u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0436\u0435\u0442\u043E\u043D\u0430 \u0432 \u0431\u043E\u044E (\u043A\u043E\u0433\u0434\u0430 \u0444\u0438\u0433\u0443\u0440\u043A\u0430 \u043D\u0435 \u0437\u0430\u0434\u0430\u043D\u0430)"
            },
            stats: {
              $ref: "#/$defs/StatBlock"
            },
            skills: {
              type: "object",
              additionalProperties: {
                type: "number"
              }
            },
            equipment: {
              type: "object",
              additionalProperties: {
                type: "string"
              }
            },
            inventory: {
              type: "array",
              items: {
                $ref: "#/$defs/InventoryEntry"
              }
            },
            loot_table: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: {
                    type: "string"
                  },
                  chance: {
                    type: "number"
                  },
                  min: {
                    type: "number"
                  },
                  max: {
                    type: "number"
                  }
                },
                required: [
                  "item",
                  "chance"
                ],
                additionalProperties: false
              }
            },
            dialogue: {
              type: "string"
            },
            slot_type: {
              type: "string",
              description: "\u0442\u0438\u043F \u0432 \u0441\u043B\u043E\u0442\u0430\u0445 \u0441\u0446\u0435\u043D\u044B (id \u0438\u0437 \u0440\u0435\u0435\u0441\u0442\u0440\u0430 slot_types); \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \xAB\u041F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\xBB"
            },
            schedule: {
              type: "array",
              items: {
                $ref: "#/$defs/ScheduleEntry"
              }
            },
            presence_overrides: {
              type: "array",
              items: {
                $ref: "#/$defs/PresenceOverride"
              },
              description: "\u043E\u0441\u043E\u0431\u044B\u0435 \u043C\u0435\u0441\u0442\u0430 \u043F\u043E \u0441\u043E\u0431\u044B\u0442\u0438\u044F\u043C: \u043F\u043E\u043A\u0430 \u0430\u043A\u0442\u0438\u0432\u0435\u043D \u0444\u043B\u0430\u0433 \u2014 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436 \u0437\u0434\u0435\u0441\u044C, \u0440\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043D\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442"
            },
            faction: {
              type: "string"
            },
            base_disposition: {
              type: "number"
            },
            carry_capacity_bonus: {
              type: "number",
              description: "\u0420\u0430\u0441\u043E\u0432\u044B\u0439/\u0438\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u0431\u043E\u043D\u0443\u0441 \u043A \u0433\u0440\u0443\u0437\u043E\u043F\u043E\u0434\u044A\u0451\u043C\u043D\u043E\u0441\u0442\u0438 (+\u043A\u0433, \u043D\u0430\u043F\u0440. +5 \u043A\u0433 \u0434\u043B\u044F \u0432\u044B\u043D\u043E\u0441\u043B\u0438\u0432\u044B\u0445 \u0440\u0430\u0441)"
            },
            carry_capacity_mult: {
              type: "number",
              description: "\u0420\u0430\u0441\u043E\u0432\u044B\u0439/\u0438\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0433\u0440\u0443\u0437\u043E\u043F\u043E\u0434\u044A\u0451\u043C\u043D\u043E\u0441\u0442\u0438 (\u043D\u0430\u043F\u0440. 2.5 \u0434\u043B\u044F \u043C\u0443\u0442\u0430\u043D\u0442\u043E\u0432, \u0433\u0438\u0433\u0430\u043D\u0442\u043E\u0432, \u0447\u0435\u0442\u0432\u0435\u0440\u043E\u043D\u043E\u0433\u0438\u0445)"
            },
            companion_needs: {
              type: "array",
              items: {
                type: "string"
              },
              description: "\u041D\u0410\u041F\u0410\u0420\u041D\u0418\u041A: \u043D\u0430\u0431\u043E\u0440 \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0435\u0439, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0442\u0438\u043A\u0430\u044E\u0442 \u0443 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0430 \u0432 \u043E\u0442\u0440\u044F\u0434\u0435 (id \u0438\u0437\n\u0440\u0435\u0435\u0441\u0442\u0440\u0430 `meta.needs`; \u043F\u0443\u0441\u0442\u043E/\u043D\u0435\u0442 \u2014 \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0435\u0439 \u043D\u0435\u0442: \u0440\u043E\u0431\u043E\u0442, \u043D\u0435\u0436\u0438\u0442\u044C).\n\u0423\u0431\u044B\u0432\u0430\u044E\u0442 \u0438 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u043F\u043E \u0442\u0438\u043A\u0430\u043C \u0442\u0435\u043C\u0438 \u0436\u0435 \u043F\u0440\u0430\u0432\u0438\u043B\u0430\u043C\u0438, \u0447\u0442\u043E \u0443 \u0433\u0435\u0440\u043E\u044F; \u043E\u0431\u0449\u0438\u0439\n\u0441\u0442\u043E\u043B: \u043A\u043E\u0433\u0434\u0430 \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u044C \u0433\u0435\u0440\u043E\u044F \u0440\u0430\u0441\u0442\u0451\u0442 (\u0435\u0434\u0430, \u0441\u043E\u043D \u2014 \u044D\u0444\u0444\u0435\u043A\u0442 change_need \u0441\n\u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0439 \u0434\u0435\u043B\u044C\u0442\u043E\u0439), \u043D\u0430\u043F\u0430\u0440\u043D\u0438\u043A, \u043E\u0442\u0441\u043B\u0435\u0436\u0438\u0432\u0430\u044E\u0449\u0438\u0439 \u0442\u0443 \u0436\u0435 \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u044C, \u0440\u0430\u0441\u0442\u0451\u0442\n\u043D\u0430 \u0441\u0442\u043E\u043B\u044C\u043A\u043E \u0436\u0435. \u041D\u0438\u0436\u0435 `critical_threshold` \u0441\u043E\u0431\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0439 \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0438 \u2014 \u0448\u0442\u0440\u0430\u0444\n\u043D\u0430\u0432\u044B\u043A\u0430\u043C \u0432 \u0431\u043E\u044E \u0438 \u043C\u0435\u0442\u043A\u0430 \xAB\u0438\u0441\u0442\u043E\u0449\u0451\u043D\xBB. \u0427\u0438\u0442\u0430\u0442\u044C/\u043C\u0435\u043D\u044F\u0442\u044C \u0438\u0437 \u043F\u0440\u0430\u0432\u0438\u043B \u0438 ink:\n\u0443\u0441\u043B\u043E\u0432\u0438\u044F `companion_need_le`/`companion_need_ge`, \u044D\u0444\u0444\u0435\u043A\u0442\n`change_companion_need`."
            },
            companion_carry: {
              type: "boolean",
              description: "\u041D\u0410\u041F\u0410\u0420\u041D\u0418\u041A: \xAB\u0432\u0442\u043E\u0440\u0430\u044F \u0441\u0443\u043C\u043A\u0430\xBB \u2014 \u0443 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0430 \u0435\u0441\u0442\u044C \u0441\u043E\u0431\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439 \u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u044C, \u043C\u0435\u0436\u0434\u0443\n\u0433\u0435\u0440\u043E\u0435\u043C \u0438 \u043D\u0430\u043F\u0430\u0440\u043D\u0438\u043A\u043E\u043C \u043C\u043E\u0436\u043D\u043E \u043F\u0435\u0440\u0435\u0434\u0430\u0432\u0430\u0442\u044C \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B; \u043D\u0430\u0434\u0435\u0442\u044B\u0435 \u043D\u0430\u043F\u0430\u0440\u043D\u0438\u043A\u043E\u043C \u043E\u0440\u0443\u0436\u0438\u0435\n\u0438 \u0431\u0440\u043E\u043D\u044F \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044E\u0442\u0441\u044F \u0438\u043C \u0432 \u0431\u043E\u044E. \u0413\u0440\u0443\u0437\u043E\u043F\u043E\u0434\u044A\u0451\u043C\u043D\u043E\u0441\u0442\u044C \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F \u043F\u043E \u0442\u0435\u043C \u0436\u0435\n\u0444\u043E\u0440\u043C\u0443\u043B\u0430\u043C \u044D\u043D\u043A\u0430\u0434\u043C\u0435\u043D\u0441\u0430, \u0447\u0442\u043E \u0443 \u0433\u0435\u0440\u043E\u044F"
            },
            trader: {
              anyOf: [
                {
                  $ref: "#/$defs/TraderDef"
                },
                {
                  const: null
                }
              ]
            },
            combat_ai: {
              type: "string"
            },
            armor: {
              type: "number",
              description: "\u0431\u0440\u043E\u043D\u044F \u0432 \u043E\u0447\u043A\u0430\u0445 (\u0435\u0441\u043B\u0438 \u043D\u0435\u0442 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430-\u0431\u0440\u043E\u043D\u0438)"
            },
            perception: {
              type: "number",
              description: "\u0412\u043D\u0438\u043C\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0434\u043B\u044F \u0441\u043A\u0440\u044B\u0442\u043D\u043E\u0441\u0442\u0438 (\u0430\u0443\u0434\u0438\u0442 \xA75.6 \u043F.12): \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438\n\u043E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u0438\u044F. \u041D\u0435\u0442 \u2014 \u043D\u0430\u0432\u044B\u043A meta.stealth.perception_skill, \u0430 \u0431\u0435\u0437 \u043D\u0435\u0433\u043E INT\xD72."
            },
            natural_weapon: {
              $ref: "#/$defs/WeaponData",
              description: "\u043F\u0440\u0438\u0440\u043E\u0434\u043D\u043E\u0435 \u043E\u0440\u0443\u0436\u0438\u0435 (\u043A\u043E\u0433\u0442\u0438, \u0443\u043A\u0443\u0441) \u2014 \u0435\u0441\u043B\u0438 \u043D\u0435\u0442 equipment.weapon"
            },
            abilities: {
              type: "array",
              items: {
                type: "string"
              },
              description: "\u0431\u043E\u0435\u0432\u044B\u0435 \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u0438 (\u0441\u043F\u0438\u0441\u043E\u043A id \u0438\u0437 \u0440\u0435\u0435\u0441\u0442\u0440\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438; \u0431\u043B\u043E\u043A 6 \u0422\u0417)"
            },
            morale: {
              type: "object",
              properties: {
                below_hp_pct: {
                  type: "number"
                },
                flee_chance: {
                  type: "number"
                }
              },
              required: [
                "below_hp_pct",
                "flee_chance"
              ],
              additionalProperties: false,
              description: "\u043C\u043E\u0440\u0430\u043B\u044C: \u043F\u0440\u0438 \u043A\u0430\u043A\u043E\u043C % HP \u0438 \u0441 \u043A\u0430\u043A\u0438\u043C \u0448\u0430\u043D\u0441\u043E\u043C \u0432\u0440\u0430\u0433 \u043C\u043E\u0436\u0435\u0442 \u0441\u0431\u0435\u0436\u0430\u0442\u044C (\u0431\u043B\u043E\u043A 6 \u0422\u0417)"
            },
            sounds: {
              $ref: "#/$defs/SoundHookMap",
              description: "\u0437\u0432\u0443\u043A\u0438 \u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0439 (\u0445\u0443\u043A \u2192 id \u0437\u0432\u0443\u043A\u0430 \u0440\u0435\u0435\u0441\u0442\u0440\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438)"
            }
          },
          required: [
            "id",
            "type",
            "label",
            "description",
            "portrait",
            "stats",
            "skills"
          ],
          additionalProperties: false
        },
        ItemInteractOption: {
          type: "object",
          properties: {
            label: {
              type: "string",
              description: "\u043F\u043E\u0434\u043F\u0438\u0441\u044C \u043A\u043D\u043E\u043F\u043A\u0438 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F"
            },
            emotion: {
              type: "string",
              description: "\u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043F\u043E\u0440\u0442\u0440\u0435\u0442\u0430 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u043F\u0440\u0438 \u0432\u044B\u0431\u043E\u0440\u0435 (\u043A\u043B\u044E\u0447 \u0438\u0437 portrait)"
            },
            hint: {
              type: "string",
              description: "\u043F\u043E\u044F\u0441\u043D\u0435\u043D\u0438\u0435 \u043F\u043E\u0434 \u043A\u043D\u043E\u043F\u043A\u043E\u0439: \u0443\u0441\u043B\u043E\u0432\u0438\u044F, \u0440\u0430\u0441\u0445\u043E\u0434, \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430"
            },
            conditions: {
              type: "array",
              items: {
                $ref: "#/$defs/Condition"
              },
              description: "\u0443\u0441\u043B\u043E\u0432\u0438\u044F \u043F\u043E\u043A\u0430\u0437\u0430 (\u0432\u0441\u0435 \u0438\u0441\u0442\u0438\u043D\u043D\u044B \u2014 \u0432\u0430\u0440\u0438\u0430\u043D\u0442 \u0432\u0438\u0434\u0435\u043D)"
            },
            effects: {
              type: "array",
              items: {
                $ref: "#/$defs/Effect"
              },
              description: "\u0440\u0435\u0430\u043A\u0446\u0438\u044F"
            },
            consume: {
              type: "boolean",
              description: "\u043F\u043E\u0441\u043B\u0435 \u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u0438\u0441\u0447\u0435\u0437\u0430\u0435\u0442 \u0441\u043E \u0441\u0446\u0435\u043D\u044B"
            },
            once: {
              type: "boolean",
              description: "\u043E\u0434\u043D\u043E\u0440\u0430\u0437\u043E\u0432\u044B\u0439 \u0432\u0430\u0440\u0438\u0430\u043D\u0442: \u0438\u0441\u0447\u0435\u0437\u0430\u0435\u0442 \u043F\u043E\u0441\u043B\u0435 \u0432\u044B\u0431\u043E\u0440\u0430 (\u0432 \u0442\u0435\u043A\u0443\u0449\u0435\u043C \u0437\u0430\u0431\u0435\u0433\u0435)"
            },
            message: {
              type: "string",
              description: "\u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043F\u043E\u0441\u043B\u0435 \u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u0438\u044F (\u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u043E \u043F\u043E\u0440\u0442\u0440\u0435\u0442\u043E\u043C \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430)"
            },
            sound: {
              type: "string",
              description: "\u0437\u0432\u0443\u043A\u043E\u0432\u043E\u0439 \u0445\u0443\u043A \u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F (\u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u0435 'use' \u0438\u043B\u0438 'open' \u0434\u043B\u044F \u043A\u043E\u043D\u0442\u0435\u0439\u043D\u0435\u0440\u0430)"
            },
            sound_volume: {
              type: "number"
            }
          },
          required: [
            "label",
            "effects"
          ],
          additionalProperties: false,
          description: "\u0412\u0430\u0440\u0438\u0430\u043D\u0442 \u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0441 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u043C \u0432 \u0441\u0446\u0435\u043D\u0435 (\u0444\u0438\u0434\u0431\u0435\u043A: \xAB\u0441\u043E\u0431\u0440\u0430\u0442\u044C \u0442\u0440\u0430\u0432\u0443\xBB,\n\xAB\u0441\u0440\u0435\u0437\u0430\u0442\u044C\xBB, \xAB\u043F\u043E\u0434\u0436\u0435\u0447\u044C\xBB). \u041A\u043B\u0438\u043A \u043F\u043E \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0443 \u0441 \u0442\u0430\u043A\u0438\u043C \u0441\u043F\u0438\u0441\u043A\u043E\u043C \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\n\u043E\u043A\u043D\u043E \u0432\u044B\u0431\u043E\u0440\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u2014 \u043A\u0430\u043A \u043C\u0438\u043D\u0438-\u0434\u0438\u0430\u043B\u043E\u0433 \u0441 \u043F\u043E\u0440\u0442\u0440\u0435\u0442\u043E\u043C \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430."
        },
        UseEffectDef: {
          type: "object",
          properties: {
            effects: {
              type: "array",
              items: {
                $ref: "#/$defs/Effect"
              }
            },
            consume: {
              type: "boolean"
            },
            message: {
              type: "string"
            }
          },
          required: [
            "effects"
          ],
          additionalProperties: false
        },
        ItemDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            type: {
              const: "item"
            },
            category: {
              type: "string"
            },
            slot_type: {
              type: "string",
              description: "\u0442\u0438\u043F \u0432 \u0441\u043B\u043E\u0442\u0430\u0445 \u0441\u0446\u0435\u043D\u044B (id \u0438\u0437 \u0440\u0435\u0435\u0441\u0442\u0440\u0430 slot_types); \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \xAB\u041F\u0440\u0435\u0434\u043C\u0435\u0442\xBB/\xAB\u041A\u043E\u043D\u0442\u0435\u0439\u043D\u0435\u0440\xBB"
            },
            label: {
              type: "string"
            },
            description: {
              type: "string"
            },
            image: {
              type: "string"
            },
            shadow: {
              type: "boolean",
              description: "\u043C\u044F\u0433\u043A\u0430\u044F \u0442\u0435\u043D\u044C \u043F\u043E\u0434 \u0441\u043F\u0440\u0430\u0439\u0442\u043E\u043C \u0432 \u0441\u0446\u0435\u043D\u0435 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0430)"
            },
            portrait: {
              type: "object",
              additionalProperties: {
                type: "string"
              },
              description: "\u041F\u041E\u0420\u0422\u0420\u0415\u0422\u042B (\u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F) \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u0434\u043B\u044F \u043E\u043A\u043D\u0430 \u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F: emotion \u2192 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435.\n\xAB\u041E\u0431\u044B\u0447\u043D\u044B\u0439\xBB \u2014 \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E; \u0431\u0435\u0437 \u043F\u043E\u0440\u0442\u0440\u0435\u0442\u043E\u0432 \u043E\u043A\u043D\u043E \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0442\u0435\u043A\u0441\u0442."
            },
            scene_sprite: {
              $ref: "#/$defs/ImageValue",
              description: "\u0421\u041F\u0420\u0410\u0419\u0422 \u0412 \u0421\u0426\u0415\u041D\u0415: \u043A\u0430\u0440\u0442\u0438\u043D\u043A\u0430 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u0432 \u0435\u0433\u043E \u0441\u043B\u043E\u0442\u0435 (\u0446\u0435\u043B\u0438\u043A\u043E\u043C, \u0431\u0435\u0437 \u043E\u0431\u0440\u0435\u0437\u043A\u0438).\n\u041D\u0435\u0442 \u2014 \u0432 \u0441\u043B\u043E\u0442\u0435 \u043D\u0435 \u0440\u0438\u0441\u0443\u0435\u0442\u0441\u044F \u043D\u0438\u0447\u0435\u0433\u043E (\u043D\u0438 \u043F\u043E\u0440\u0442\u0440\u0435\u0442, \u043D\u0438 \u0438\u043A\u043E\u043D\u043A\u0430).\n\u041C\u043E\u0436\u043D\u043E \u0446\u0438\u043A\u043B \u043A\u0430\u0434\u0440\u043E\u0432 (ImageValue) \u2014 \xAB\u0436\u0438\u0432\u043E\u0439\xBB \u043F\u0440\u0435\u0434\u043C\u0435\u0442."
            },
            breathe: {
              type: "boolean",
              description: "\u042D\u0444\u0444\u0435\u043A\u0442 \xAB\u0436\u0438\u0432\u043E\u0433\u043E \u0434\u044B\u0445\u0430\u043D\u0438\u044F\xBB \u0441\u043F\u0440\u0430\u0439\u0442\u0430 \u0432 \u0441\u0446\u0435\u043D\u0435:\n\u041F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u043E\u0442\u043A\u043B\u044E\u0447\u0451\u043D (false). \u041C\u043E\u0436\u043D\u043E \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0434\u043B\u044F \u0436\u0438\u0432\u044B\u0445 \u0438\u043B\u0438 \u043F\u0443\u043B\u044C\u0441\u0438\u0440\u0443\u044E\u0449\u0438\u0445 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432 (\u0431\u0438\u043E-\u0441\u0435\u0440\u0434\u0446\u0435, \u043C\u0438\u043C\u0438\u043A)."
            },
            interactable_when: {
              type: "array",
              items: {
                $ref: "#/$defs/Condition"
              },
              description: "\u0412\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u043E\u0432\u0430\u0442\u044C \u043C\u043E\u0436\u043D\u043E \u0442\u043E\u043B\u044C\u043A\u043E \u043A\u043E\u0433\u0434\u0430 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u0438\u0441\u0442\u0438\u043D\u043D\u044B; \u043F\u043E\u043A\u0430 \u043B\u043E\u0436\u043D\u044B \u2014\n\u043F\u0440\u0435\u0434\u043C\u0435\u0442 \xAB\u0434\u0435\u043A\u043E\u0440\u0430\u0446\u0438\u044F\xBB: \u0432\u0438\u0434\u0435\u043D \u0432 \u0441\u043B\u043E\u0442\u0435, \u043D\u043E \u043D\u0435 \u043D\u0430\u0436\u0438\u043C\u0430\u0435\u0442\u0441\u044F \u0438 \u043D\u0435 \u043F\u043E\u0434\u0441\u0432\u0435\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F."
            },
            interact_hint: {
              type: "string",
              description: "\u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u043F\u043E\u0434 \u043A\u0443\u0440\u0441\u043E\u0440\u043E\u043C \u0432 \u0441\u0446\u0435\u043D\u0435 (\xAB\u041E\u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u0437\u0430\u043C\u043E\u043A\xBB, \xAB\u041F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u044C \u0432\u0435\u043D\u0442\u0438\u043B\u044C\xBB)"
            },
            interact_options: {
              type: "array",
              items: {
                $ref: "#/$defs/ItemInteractOption"
              },
              description: "\u0432\u0430\u0440\u0438\u0430\u043D\u0442\u044B \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0439 \u043F\u043E \u043A\u043B\u0438\u043A\u0443 (\u0432\u044B\u0431\u043E\u0440 \u043A\u0430\u043A \u0432 \u0434\u0438\u0430\u043B\u043E\u0433\u0435); \u043F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442 \u043D\u0430\u0434 on_interact"
            },
            weight: {
              type: "number"
            },
            value: {
              type: "object",
              additionalProperties: {
                type: "number"
              }
            },
            stackable: {
              type: "boolean"
            },
            quest_item: {
              type: "boolean",
              description: "\u0441\u044E\u0436\u0435\u0442\u043D\u044B\u0439/\u043A\u0432\u0435\u0441\u0442\u043E\u0432\u044B\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442: \u043D\u0435\u043B\u044C\u0437\u044F \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u043E \u0432\u044B\u0431\u0440\u043E\u0441\u0438\u0442\u044C, \u043F\u0440\u043E\u0434\u0430\u0442\u044C \u0438\u043B\u0438 \u043F\u0435\u0440\u0435\u0434\u0430\u0442\u044C\n\u043D\u0430\u043F\u0430\u0440\u043D\u0438\u043A\u0443 \u0447\u0435\u0440\u0435\u0437 \u0441\u0443\u043C\u043A\u0443 (\u0443\u0445\u043E\u0434/\u0433\u0438\u0431\u0435\u043B\u044C \u043D\u0430\u043F\u0430\u0440\u043D\u0438\u043A\u0430 \u043D\u0435 \u0441\u044A\u0435\u0441\u0442 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0443\u044E \u0432\u0435\u0449\u044C).\n\u0421\u043A\u0440\u0438\u043F\u0442\u043E\u0432\u0430\u044F \u043F\u0435\u0440\u0435\u0434\u0430\u0447\u0430 \u044D\u0444\u0444\u0435\u043A\u0442\u043E\u043C transfer_to_companion \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u0440\u0435\u0448\u0435\u043D\u0438\u0435\u043C \u043C\u0430\u0441\u0442\u0435\u0440\u0430."
            },
            decay_ticks: {
              type: "number",
              description: "\u0421\u0440\u043E\u043A \u0433\u043E\u0434\u043D\u043E\u0441\u0442\u0438 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u0432 \u0438\u0433\u0440\u043E\u0432\u044B\u0445 \u0442\u0438\u043A\u0430\u0445 (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, 24 = 24 \u0447\u0430\u0441\u0430). \u0415\u0441\u043B\u0438 \u043D\u0435 \u0437\u0430\u0434\u0430\u043D \u2014 \u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u043D\u0435 \u043F\u043E\u0440\u0442\u0438\u0442\u0441\u044F"
            },
            spoil_into: {
              type: "string",
              description: "\u0412 \u043A\u0430\u043A\u043E\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u043F\u0440\u0435\u0432\u0440\u0430\u0449\u0430\u0435\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u0440\u0447\u0438 (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 item_meat_spoiled \u0438\u043B\u0438 item_scrap)"
            },
            spoil_action: {
              type: "string",
              enum: [
                "transform",
                "destroy",
                "rule"
              ],
              description: "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043F\u0440\u0438 \u043F\u043E\u0440\u0447\u0435: 'transform' (\u0432 spoil_into), 'destroy' (\u0438\u0441\u0447\u0435\u0437\u0430\u0435\u0442), 'rule' (\u0437\u0430\u043F\u0443\u0441\u043A \u043F\u0440\u0430\u0432\u0438\u043B\u0430)"
            },
            spoil_rule: {
              type: "string",
              description: "\u0418\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440 \u043F\u0440\u0430\u0432\u0438\u043B\u0430, \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u043C\u043E\u0433\u043E \u043F\u0440\u0438 \u043F\u043E\u0440\u0447\u0435 (\u0435\u0441\u043B\u0438 spoil_action === 'rule')"
            },
            spoil_msg: {
              type: "string",
              description: "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0432 \u0436\u0443\u0440\u043D\u0430\u043B \u043F\u0440\u0438 \u043F\u043E\u0440\u0447\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430"
            },
            weapon_data: {
              $ref: "#/$defs/WeaponData"
            },
            armor_data: {
              type: "object",
              properties: {
                points: {
                  type: "number"
                },
                durability: {
                  type: "number",
                  description: "\u0438\u0437\u043D\u043E\u0441 \u0431\u0440\u043E\u043D\u0438: \u043C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u043F\u0440\u043E\u0447\u043D\u043E\u0441\u0442\u044C (\u043D\u0435\u0442 \u2014 \u0432\u0435\u0447\u043D\u0430\u044F)"
                }
              },
              required: [
                "points"
              ],
              additionalProperties: false,
              description: "\u0431\u0440\u043E\u043D\u044F: \u043E\u0447\u043A\u0438 \u043F\u043E\u0433\u043B\u043E\u0449\u0435\u043D\u0438\u044F \u0443\u0440\u043E\u043D\u0430"
            },
            equip_slot: {
              type: "string",
              description: "\u0441\u043B\u043E\u0442 \u044D\u043A\u0438\u043F\u0438\u0440\u043E\u0432\u043A\u0438 (\u0431\u043B\u043E\u043A 7 \u0422\u0417): \u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u043D\u0430\u0434\u0435\u0432\u0430\u0435\u0442\u0441\u044F \u0432 \u044D\u0442\u043E\u0442 \u0441\u043B\u043E\u0442;\n\u043D\u0435\u0442 \u2014 \u043D\u0435 \u044D\u043A\u0438\u043F\u0438\u0440\u0443\u0435\u0442\u0441\u044F. \u0421\u0442\u0430\u0440\u044B\u043C \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430\u043C \u0432\u044B\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043C\u0438\u0433\u0440\u0430\u0446\u0438\u0435\u0439."
            },
            carry_bonus: {
              type: "number",
              description: "\u0411\u043E\u043D\u0443\u0441 \u043A \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0438\u043C\u043E\u043C\u0443 \u0432\u0435\u0441\u0443 \u043F\u0440\u0438 \u044D\u043A\u0438\u043F\u0438\u0440\u043E\u0432\u043A\u0435 (+\u043A\u0433, \u043D\u0430\u043F\u0440. +10 \u043A\u0433 \u0434\u043B\u044F \u043F\u043E\u0445\u043E\u0434\u043D\u043E\u0433\u043E \u0440\u044E\u043A\u0437\u0430\u043A\u0430)"
            },
            carry_mult: {
              type: "number",
              description: "\u041C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0433\u0440\u0443\u0437\u043E\u043F\u043E\u0434\u044A\u0451\u043C\u043D\u043E\u0441\u0442\u0438 \u043F\u0440\u0438 \u044D\u043A\u0438\u043F\u0438\u0440\u043E\u0432\u043A\u0435 (\u043D\u0430\u043F\u0440. 2.0 \u0434\u043B\u044F \u0441\u0438\u043B\u043E\u0432\u043E\u0433\u043E \u044D\u043A\u0437\u043E\u0441\u043A\u0435\u043B\u0435\u0442\u0430)"
            },
            hero_appearance: {
              type: "object",
              properties: {
                overlay: {
                  $ref: "#/$defs/ImageValue"
                },
                order: {
                  type: "number"
                }
              },
              required: [
                "overlay"
              ],
              additionalProperties: false,
              description: "\u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u044B\u0439 \u0441\u043B\u043E\u0439 \u043F\u043E\u0432\u0435\u0440\u0445 \u043F\u043E\u0440\u0442\u0440\u0435\u0442\u0430 \u0433\u0435\u0440\u043E\u044F, \u043A\u043E\u0433\u0434\u0430 \u044D\u0442\u043E\u0442 \u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u043D\u0430\u0434\u0435\u0442"
            },
            on_interact: {
              $ref: "#/$defs/UseEffectDef",
              description: "\u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432 \u0441\u0446\u0435\u043D\u0435 (\u0431\u043E\u0447\u043A\u0430 \u0441 \u0432\u043E\u0434\u043E\u0439 \u0438 \u0442.\u043F.)"
            },
            on_use: {
              $ref: "#/$defs/UseEffectDef",
              description: "\u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435 \u0438\u0437 \u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u044F"
            },
            sounds: {
              $ref: "#/$defs/SoundHookMap",
              description: "\u0437\u0432\u0443\u043A\u0438 \u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0439 (\u0445\u0443\u043A \u2192 id \u0437\u0432\u0443\u043A\u0430 \u0440\u0435\u0435\u0441\u0442\u0440\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438)"
            }
          },
          required: [
            "id",
            "type",
            "category",
            "label",
            "description",
            "weight",
            "stackable"
          ],
          additionalProperties: false
        },
        EntityDef: {
          anyOf: [
            {
              $ref: "#/$defs/NpcDef"
            },
            {
              $ref: "#/$defs/ItemDef"
            }
          ]
        },
        RuleDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            once: {
              type: "boolean"
            },
            manual: {
              type: "boolean",
              description: "manual-\u043F\u0440\u0430\u0432\u0438\u043B\u043E \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u0432\u044B\u0437\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043F\u043E id (on_zero_effect \u0438 \u0442.\u043F.)"
            },
            trigger: {
              type: "string",
              enum: [
                "always",
                "enter_scene",
                "leave_scene",
                "interact",
                "time_tick"
              ],
              description: "\u0442\u0440\u0438\u0433\u0433\u0435\u0440 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438: always (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E), enter_scene (\u0432\u0445\u043E\u0434 \u043D\u0430 \u0441\u0446\u0435\u043D\u0443), leave_scene (\u043F\u043E\u043F\u044B\u0442\u043A\u0430 \u0443\u0439\u0442\u0438 \u0441\u043E \u0441\u0446\u0435\u043D\u044B), interact (\u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435), time_tick"
            },
            conditions: {
              type: "array",
              items: {
                $ref: "#/$defs/Condition"
              },
              description: "\u0423\u0421\u041B\u041E\u0412\u0418\u042F \u043F\u0440\u0430\u0432\u0438\u043B\u0430 (\u0432\u0441\u0435 \u0434\u043E\u043B\u0436\u043D\u044B \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C\u0441\u044F). \u041E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u043C\u0430\u0441\u0441\u0438\u0432; \u043F\u0443\u0441\u0442\u043E\u0439 \u2014\n\u043F\u0440\u0430\u0432\u0438\u043B\u043E \u0441\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u0442 \u043F\u0440\u0438 \u043A\u0430\u0436\u0434\u043E\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0435 (\u0435\u0441\u043B\u0438 \u043D\u0435 once/manual).\n\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435 \u043F\u043E\u043B\u044F \u043B\u043E\u043C\u0430\u0435\u0442 \u0434\u0432\u0438\u0436\u043E\u043A \u043F\u0440\u0438 \u0441\u0442\u0430\u0440\u0442\u0435 \u0437\u0430\u0431\u0435\u0433\u0430."
            },
            conditions_any: {
              type: "array",
              items: {
                type: "array",
                items: {
                  $ref: "#/$defs/Condition"
                }
              },
              description: "\u0418\u041B\u0418-\u0433\u0440\u0443\u043F\u043F\u044B \u0443\u0441\u043B\u043E\u0432\u0438\u0439: \u0418 \u0432\u043D\u0443\u0442\u0440\u0438 \u0433\u0440\u0443\u043F\u043F\u044B, \u0418\u041B\u0418 \u043C\u0435\u0436\u0434\u0443 \u0433\u0440\u0443\u043F\u043F\u0430\u043C\u0438. \u041F\u0440\u0430\u0432\u0438\u043B\u043E \u0430\u043A\u0442\u0438\u0432\u043D\u043E,\n\u043A\u043E\u0433\u0434\u0430 \u0432\u0435\u0440\u043D\u044B \u0432\u0441\u0435 `conditions` \u0418 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u0430 \u0433\u0440\u0443\u043F\u043F\u0430. \u041F\u0443\u0441\u0442\u043E/\u043D\u0435\u0442 \u2014 \u043A\u0430\u043A \u0440\u0430\u043D\u044C\u0448\u0435.\n\u0412\u043B\u043E\u0436\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u0435\u0449\u0451 \u0433\u043B\u0443\u0431\u0436\u0435 \u043D\u0435 \u0434\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F (\u0434\u043E\u0432\u043E\u043B\u044C\u043D\u043E \u0438 `and`/`or` \u0432 \u0441\u0430\u043C\u0438\u0445 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u0445)."
            },
            effects: {
              type: "array",
              items: {
                $ref: "#/$defs/Effect"
              },
              description: "\u042D\u0424\u0424\u0415\u041A\u0422\u042B \u043F\u0440\u0430\u0432\u0438\u043B\u0430 \u043F\u043E \u043F\u043E\u0440\u044F\u0434\u043A\u0443. \u041E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u043C\u0430\u0441\u0441\u0438\u0432 (\u043F\u0443\u0441\u0442\u043E\u0439 \u2014 \u043F\u0440\u0430\u0432\u0438\u043B\u043E-\u043F\u0443\u0441\u0442\u044B\u0448\u043A\u0430).\n\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435 \u043F\u043E\u043B\u044F \u043B\u043E\u043C\u0430\u0435\u0442 \u0434\u0432\u0438\u0436\u043E\u043A \u043F\u0440\u0438 \u0441\u0442\u0430\u0440\u0442\u0435 \u0437\u0430\u0431\u0435\u0433\u0430."
            },
            chapter: {
              type: "string",
              description: "\u0433\u043B\u0430\u0432\u0430 (id \u0438\u0437 meta.chapters) \u2014 \u0433\u0440\u0443\u043F\u043F\u0438\u0440\u043E\u0432\u043A\u0430 \u0432 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0435"
            }
          },
          required: [
            "id",
            "label",
            "once",
            "conditions",
            "effects"
          ],
          additionalProperties: false
        },
        QuestStageDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string",
              description: "\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0441\u0442\u0430\u0434\u0438\u0438 \u0434\u043B\u044F \u043C\u0430\u0441\u0442\u0435\u0440\u0430 (\u0432 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0435)"
            },
            final: {
              type: "boolean"
            },
            outcome: {
              type: "string",
              enum: [
                "success",
                "failure"
              ]
            },
            on_enter_effects: {
              type: "array",
              items: {
                $ref: "#/$defs/Effect"
              }
            },
            transitions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  to: {
                    type: "string"
                  },
                  conditions: {
                    type: "array",
                    items: {
                      $ref: "#/$defs/Condition"
                    }
                  }
                },
                required: [
                  "to",
                  "conditions"
                ],
                additionalProperties: false
              }
            }
          },
          required: [
            "id"
          ],
          additionalProperties: false
        },
        QuestDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            description: {
              type: "string"
            },
            journal_entries: {
              type: "object",
              additionalProperties: {
                type: "string"
              }
            },
            stages: {
              type: "array",
              items: {
                $ref: "#/$defs/QuestStageDef"
              }
            },
            chapter: {
              type: "string",
              description: "\u0433\u043B\u0430\u0432\u0430 (id \u0438\u0437 meta.chapters) \u2014 \u0433\u0440\u0443\u043F\u043F\u0438\u0440\u043E\u0432\u043A\u0430 \u0432 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0435"
            }
          },
          required: [
            "id",
            "label",
            "description",
            "journal_entries",
            "stages"
          ],
          additionalProperties: false
        },
        HexCoord: {
          type: "array",
          prefixItems: [
            {
              type: "number"
            },
            {
              type: "number"
            }
          ],
          minItems: 2,
          maxItems: 2
        },
        ArenaDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            image: {
              type: "string"
            },
            canvas: {
              type: "object",
              properties: {
                w: {
                  type: "number"
                },
                h: {
                  type: "number"
                }
              },
              required: [
                "w",
                "h"
              ],
              additionalProperties: false
            },
            hex_grid: {
              type: "object",
              properties: {
                cols: {
                  type: "number"
                },
                rows: {
                  type: "number"
                },
                hex_size: {
                  type: "number"
                },
                offset: {
                  const: "odd-r"
                },
                origin: {
                  type: "object",
                  properties: {
                    x: {
                      type: "number"
                    },
                    y: {
                      type: "number"
                    }
                  },
                  required: [
                    "x",
                    "y"
                  ],
                  additionalProperties: false,
                  description: "\u043F\u0438\u043A\u0441\u0435\u043B\u044C\u043D\u044B\u0439 \u0441\u0434\u0432\u0438\u0433 \u0446\u0435\u043D\u0442\u0440\u0430 \u0433\u0435\u043A\u0441\u0430 (0,0); \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u0441\u0435\u0442\u043A\u0430 \u0446\u0435\u043D\u0442\u0440\u0438\u0440\u0443\u0435\u0442\u0441\u044F"
                },
                blocked_hexes: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/HexCoord"
                  }
                },
                difficult_terrain: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/HexCoord"
                  }
                },
                cover_hexes: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/HexCoord"
                  },
                  description: "\u0433\u0435\u043A\u0441\u044B-\u0443\u043A\u0440\u044B\u0442\u0438\u044F (\u043C\u0430\u0441\u0442\u0435\u0440 \u0440\u0430\u0437\u043C\u0435\u0447\u0430\u0435\u0442 \u043A\u0438\u0441\u0442\u044C\u044E \xAB\u0423\u043A\u0440\u044B\u0442\u0438\u0435\xBB); \u0432\u043B\u0438\u044F\u044E\u0442 \u043D\u0430 \u0441\u0442\u0440\u0435\u043B\u044C\u0431\u0443, \u0435\u0441\u043B\u0438 \u0432 \u043F\u0440\u0430\u0432\u0438\u043B\u0430\u0445 \u0431\u043E\u044F \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u044B \u0443\u043A\u0440\u044B\u0442\u0438\u044F"
                }
              },
              required: [
                "cols",
                "rows",
                "hex_size",
                "offset",
                "blocked_hexes",
                "difficult_terrain"
              ],
              additionalProperties: false
            },
            spawn_zones: {
              type: "object",
              properties: {
                player: {
                  type: "object",
                  properties: {
                    hexes: {
                      type: "array",
                      items: {
                        $ref: "#/$defs/HexCoord"
                      }
                    }
                  },
                  required: [
                    "hexes"
                  ],
                  additionalProperties: false
                },
                enemy: {
                  type: "object",
                  properties: {
                    hexes: {
                      type: "array",
                      items: {
                        $ref: "#/$defs/HexCoord"
                      }
                    }
                  },
                  required: [
                    "hexes"
                  ],
                  additionalProperties: false
                }
              },
              required: [
                "player",
                "enemy"
              ],
              additionalProperties: false,
              description: "\u0437\u043E\u043D\u044B \u043F\u043E\u044F\u0432\u043B\u0435\u043D\u0438\u044F \u0441\u0442\u043E\u0440\u043E\u043D. player \u2014 \u0441\u043F\u0430\u0432\u043D \u0412\u0421\u0415\u0413\u041E \u043E\u0442\u0440\u044F\u0434\u0430: \u0442\u043E\u0447\u043A\u0438 \u0432\u044B\u0434\u0430\u044E\u0442\u0441\u044F \u043F\u043E \u043E\u0447\u0435\u0440\u0435\u0434\u0438\n(\u043F\u0435\u0440\u0432\u0430\u044F \u2014 \u0433\u0435\u0440\u043E\u044E, \u0434\u0430\u043B\u044C\u0448\u0435 \u2014 \u043D\u0430\u043F\u0430\u0440\u043D\u0438\u043A\u0430\u043C \u043F\u043E \u043F\u043E\u0440\u044F\u0434\u043A\u0443 \u043E\u0442\u0440\u044F\u0434\u0430); \u0433\u0435\u043A\u0441\u043E\u0432 \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C\n\u043D\u0435 \u043C\u0435\u043D\u044C\u0448\u0435, \u0447\u0435\u043C \u0433\u0435\u0440\u043E\u0439 + \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C \u043D\u0430\u043F\u0430\u0440\u043D\u0438\u043A\u043E\u0432 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438. \u041D\u0435\u043F\u0440\u043E\u0445\u043E\u0434\u0438\u043C\u044B\u0435 \u0442\u043E\u0447\u043A\u0438 \u0437\u043E\u043D\u044B\n\u0434\u0432\u0438\u0436\u043E\u043A \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u0442; \u043F\u0435\u0440\u0435\u043F\u043E\u043B\u043D\u0435\u043D\u043D\u044B\u0439 \u0431\u043E\u0435\u0446 \u0432\u0441\u0442\u0430\u0451\u0442 \u0432 \u0431\u043B\u0438\u0436\u0430\u0439\u0448\u0438\u0439 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u044B\u0439 \u043A \u0433\u0435\u0440\u043E\u044E."
            },
            ambient_audio: {
              type: "string"
            },
            music: {
              type: "string",
              description: "id \u0442\u0440\u0435\u043A\u0430 \u0440\u0435\u0435\u0441\u0442\u0440\u0430 music_tracks (\u0435\u0441\u043B\u0438 \u043D\u0435\u0442 \u2014 \u0442\u0440\u0435\u043A \u0431\u043E\u044F \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E)"
            }
          },
          required: [
            "id",
            "label",
            "image",
            "hex_grid",
            "spawn_zones"
          ],
          additionalProperties: false
        },
        CutsceneTransition: {
          type: "string",
          enum: [
            "cut",
            "fade",
            "slide",
            "panzoom"
          ],
          description: "\u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u043A \u0441\u043B\u0430\u0439\u0434\u0443: \u0440\u0435\u0437\u043A\u0430\u044F \u0441\u043C\u0435\u043D\u0430, \u0437\u0430\u0442\u0435\u043C\u043D\u0435\u043D\u0438\u0435, \u0441\u0434\u0432\u0438\u0433, \u043C\u0435\u0434\u043B\u0435\u043D\u043D\u044B\u0439 \u043D\u0430\u0435\u0437\u0434"
        },
        CutsceneSlide: {
          type: "object",
          properties: {
            art: {
              $ref: "#/$defs/ArtDoc"
            },
            image: {
              type: "string"
            },
            video: {
              type: "string"
            },
            text: {
              type: "string",
              description: "\u043F\u043E\u0434\u043F\u0438\u0441\u044C: \u043F\u0435\u0447\u0430\u0442\u0430\u0435\u0442\u0441\u044F \u043F\u043E\u0432\u0435\u0440\u0445 \u043A\u0430\u0434\u0440\u0430, \u0441\u043D\u0438\u0437\u0443"
            },
            voice: {
              type: "string",
              description: "\u043E\u0437\u0432\u0443\u0447\u043A\u0430 \u0441\u043B\u0430\u0439\u0434\u0430: \u0444\u0430\u0439\u043B \u043F\u0430\u043A\u0435\u0442\u0430 (assets/voice/\u2026) \u0438\u043B\u0438 \u0441\u0441\u044B\u043B\u043A\u0430"
            },
            duration: {
              type: "number",
              description: "\u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0432 \u0441\u0435\u043A\u0443\u043D\u0434\u0430\u0445; \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u2014 \u043F\u043E \u0434\u043B\u0438\u043D\u0435 \u0442\u0435\u043A\u0441\u0442\u0430 \u0438\u043B\u0438 \u043E\u0437\u0432\u0443\u0447\u043A\u0438"
            },
            camera: {
              $ref: "#/$defs/CameraDoc",
              description: "\u043A\u0438\u043D\u0435\u043C\u0430\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043A\u0430\u043C\u0435\u0440\u0430 \u0444\u043E\u043D\u0430 \u0441\u043B\u0430\u0439\u0434\u0430 (\u043F\u0430\u043D-\u0437\u0443\u043C)"
            },
            transition: {
              $ref: "#/$defs/CutsceneTransition"
            }
          },
          required: [
            "transition"
          ],
          additionalProperties: false,
          description: "\u0421\u043B\u0430\u0439\u0434 \u043A\u0430\u0442\u0441\u0446\u0435\u043D\u044B. \u041A\u0430\u0434\u0440 \u2014 \u041E\u0414\u041D\u041E \u0438\u0437: `art` (ArtDoc, \u0440\u0438\u0441\u0443\u0435\u0442\u0441\u044F \u043F\u0440\u0438\u043C\u0438\u0442\u0438\u0432\u0430\u043C\u0438),\n`image` (\u0444\u0430\u0439\u043B \u043F\u0430\u043A\u0435\u0442\u0430 \u0438\u043B\u0438 \u0441\u0441\u044B\u043B\u043A\u0430), `video` (mp4-\u0441\u0441\u044B\u043B\u043A\u0430 \u0438\u043B\u0438 YouTube \u2014\n\u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u043E\u043D\u043B\u0430\u0439\u043D). \u0411\u0435\u0437 \u043A\u0430\u0434\u0440\u0430 \u2014 \u043F\u043E\u0434\u043F\u0438\u0441\u044C \u043D\u0430 \u0447\u0451\u0440\u043D\u043E\u043C \u0444\u043E\u043D\u0435."
        },
        CutsceneDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            music: {
              type: "string",
              description: "\u043C\u0443\u0437\u044B\u043A\u0430 \u043D\u0430 \u0432\u0441\u044E \u043A\u0430\u0442\u0441\u0446\u0435\u043D\u0443: id \u0442\u0440\u0435\u043A\u0430 \u0440\u0435\u0435\u0441\u0442\u0440\u0430, \u0444\u0430\u0439\u043B \u043F\u0430\u043A\u0435\u0442\u0430 \u0438\u043B\u0438 \u0441\u0441\u044B\u043B\u043A\u0430"
            },
            slides: {
              type: "array",
              items: {
                $ref: "#/$defs/CutsceneSlide"
              }
            },
            chapter: {
              type: "string",
              description: "\u0433\u043B\u0430\u0432\u0430 (id \u0438\u0437 meta.chapters) \u2014 \u0433\u0440\u0443\u043F\u043F\u0438\u0440\u043E\u0432\u043A\u0430 \u0432 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0435"
            }
          },
          required: [
            "id",
            "label",
            "slides"
          ],
          additionalProperties: false,
          description: "\u0421\u043B\u0430\u0439\u0434-\u043A\u0430\u0442\u0441\u0446\u0435\u043D\u0430: \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F \u044D\u0444\u0444\u0435\u043A\u0442\u043E\u043C `play_cutscene` \u0438\u0437 \u043F\u0440\u0430\u0432\u0438\u043B\u0430 \u0438\u043B\u0438\n\u0434\u0438\u0430\u043B\u043E\u0433\u0430, \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043E\u0432\u0435\u0440\u043B\u0435\u0435\u043C \u043F\u043E\u0432\u0435\u0440\u0445 \u0432\u0441\u0435\u0433\u043E. \u0426\u0435\u043B\u0438\u043A\u043E\u043C \u043E\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442\u0441\u044F JSON'\u043E\u043C\n(\u0441\u043B\u0430\u0439\u0434\u044B \u2014 ArtDoc), \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u0435\u0451 \u043C\u043E\u0436\u043D\u043E \u0441\u0433\u0435\u043D\u0435\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0431\u0435\u0437 \u0435\u0434\u0438\u043D\u043E\u0433\u043E \u0444\u0430\u0439\u043B\u0430."
        },
        EncounterEntry: {
          anyOf: [
            {
              type: "object",
              properties: {
                weight: {
                  type: "number"
                },
                type: {
                  const: "nothing"
                }
              },
              required: [
                "weight",
                "type"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                weight: {
                  type: "number"
                },
                type: {
                  const: "combat"
                },
                enemies: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      entity: {
                        type: "string"
                      },
                      count_min: {
                        type: "number"
                      },
                      count_max: {
                        type: "number"
                      }
                    },
                    required: [
                      "entity",
                      "count_min",
                      "count_max"
                    ],
                    additionalProperties: false
                  }
                },
                arena: {
                  type: "string"
                },
                intro: {
                  type: "string"
                }
              },
              required: [
                "weight",
                "type",
                "enemies",
                "arena"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                weight: {
                  type: "number"
                },
                type: {
                  const: "dialogue"
                },
                entity: {
                  type: "string"
                },
                knot: {
                  type: "string"
                }
              },
              required: [
                "weight",
                "type",
                "entity"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                weight: {
                  type: "number"
                },
                type: {
                  const: "skill_check"
                },
                skill: {
                  type: "string"
                },
                difficulty: {
                  $ref: "#/$defs/SkillDifficulty"
                },
                message: {
                  type: "string"
                },
                success_effects: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/Effect"
                  }
                },
                fail_effects: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/Effect"
                  }
                }
              },
              required: [
                "weight",
                "type",
                "skill",
                "difficulty",
                "success_effects",
                "fail_effects"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                weight: {
                  type: "number"
                },
                type: {
                  const: "event"
                },
                effects: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/Effect"
                  }
                },
                message: {
                  type: "string"
                }
              },
              required: [
                "weight",
                "type",
                "effects"
              ],
              additionalProperties: false
            }
          ]
        },
        EncounterTableDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            rolls: {
              type: "number"
            },
            entries: {
              type: "array",
              items: {
                $ref: "#/$defs/EncounterEntry"
              }
            }
          },
          required: [
            "id",
            "rolls",
            "entries"
          ],
          additionalProperties: false
        },
        RecipeDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            description: {
              type: "string"
            },
            inputs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: {
                    type: "string"
                  },
                  quantity: {
                    type: "number"
                  }
                },
                required: [
                  "item",
                  "quantity"
                ],
                additionalProperties: false
              },
              description: "\u0440\u0430\u0441\u0445\u043E\u0434\u0443\u0435\u043C\u044B\u0435 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u044B"
            },
            tools: {
              type: "array",
              items: {
                type: "string"
              },
              description: "\u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B: \u043D\u0443\u0436\u043D\u044B \u0432 \u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u0435, \u041D\u0415 \u0440\u0430\u0441\u0445\u043E\u0434\u0443\u044E\u0442\u0441\u044F"
            },
            repair: {
              type: "boolean",
              description: "\u0420\u0435\u0446\u0435\u043F\u0442 \u043F\u043E\u0447\u0438\u043D\u043A\u0438 (\u0430\u0443\u0434\u0438\u0442 \xA75.6 \u043F.10): \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u2014 \u043D\u0435 \u043D\u043E\u0432\u044B\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442, \u0430\n\u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u0430\u044F \u043F\u0440\u043E\u0447\u043D\u043E\u0441\u0442\u044C \u0441\u043B\u043E\u043C\u0430\u043D\u043D\u043E\u0433\u043E/\u0438\u0437\u043D\u043E\u0448\u0435\u043D\u043D\u043E\u0433\u043E \u044D\u043A\u0437\u0435\u043C\u043F\u043B\u044F\u0440\u0430 `output.item`\n\u0434\u043E \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C\u0430. \u0418\u0433\u0440\u043E\u043A \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u0442, \u043A\u0430\u043A\u043E\u0439 \u044D\u043A\u0437\u0435\u043C\u043F\u043B\u044F\u0440 \u0447\u0438\u043D\u0438\u0442\u044C."
            },
            requires: {
              type: "array",
              items: {
                $ref: "#/$defs/Condition"
              },
              description: "\u0434\u0435\u043A\u043B\u0430\u0440\u0430\u0442\u0438\u0432\u043D\u044B\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0438 \u043A\u0440\u0430\u0444\u0442\u0430 (\u043B\u043E\u043A\u0430\u0446\u0438\u044F, \u0444\u043B\u0430\u0433, \u2026)"
            },
            skill: {
              type: "object",
              properties: {
                id: {
                  type: "string"
                },
                difficulty: {
                  $ref: "#/$defs/SkillDifficulty"
                }
              },
              required: [
                "id",
                "difficulty"
              ],
              additionalProperties: false,
              description: "\u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0430\u0432\u044B\u043A\u0430 \u043F\u0440\u0438 \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u0438\u0438; \u0443\u0441\u043F\u0435\u0445 = \u0441\u043E\u0437\u0434\u0430\u043B, \u043F\u0440\u043E\u0432\u0430\u043B = \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u044B \u0446\u0435\u043B\u044B"
            },
            time_ticks: {
              type: "number",
              description: "\u0432\u0440\u0435\u043C\u044F \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u0438\u044F (\u043F\u0440\u043E\u043C\u043E\u0442\u043A\u0430 \u0442\u0438\u043A\u043E\u0432 \u043F\u043E\u0441\u043B\u0435 \u0443\u0441\u043F\u0435\u0445\u0430)"
            },
            output: {
              type: "object",
              properties: {
                item: {
                  type: "string"
                },
                quantity: {
                  type: "number"
                }
              },
              required: [
                "item",
                "quantity"
              ],
              additionalProperties: false,
              description: "\u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442"
            },
            message: {
              type: "string",
              description: "\u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043E\u0431 \u0443\u0441\u043F\u0435\u0445\u0435 (\u043D\u0435\u0442 \u2014 \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u043E\u0435)"
            },
            known: {
              type: "boolean",
              description: "`false` \u2014 \u0440\u0435\u0446\u0435\u043F\u0442 \u0441\u043A\u0440\u044B\u0442 \u043E\u0442 \u0438\u0433\u0440\u043E\u043A\u0430 \u0434\u043E \u044D\u0444\u0444\u0435\u043A\u0442\u0430 `unlock_recipe` (\u043F\u0440\u0430\u0432\u0438\u043B\u043E,\n\u0434\u0438\u0430\u043B\u043E\u0433, \u0441\u043E\u0431\u044B\u0442\u0438\u0435). \u0421\u0442\u0430\u0440\u044B\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u0438 \u0441\u0435\u0439\u0432\u044B \u043D\u0435 \u0442\u0440\u043E\u0433\u0430\u0435\u043C: \u043F\u043E\u043B\u044F \u043D\u0435\u0442 \u2014 \u0440\u0435\u0446\u0435\u043F\u0442\n\u0438\u0437\u0432\u0435\u0441\u0442\u0435\u043D \u0441 \u0441\u0430\u043C\u043E\u0433\u043E \u043D\u0430\u0447\u0430\u043B\u0430."
            },
            sound: {
              type: "string",
              description: "\u0438\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u0437\u0432\u0443\u043A \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u0438\u044F (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, \u0437\u0432\u043E\u043D \u043D\u0430\u043A\u043E\u0432\u0430\u043B\u044C\u043D\u0438, \u0448\u0438\u043F\u0435\u043D\u0438\u0435 \u0440\u0435\u0430\u043A\u0442\u0438\u0432\u043E\u0432, \u0448\u043E\u0440\u043E\u0445 \u0448\u0438\u0442\u044C\u044F)"
            },
            sound_volume: {
              type: "number"
            },
            conditions: {
              type: "array",
              items: {
                $ref: "#/$defs/Condition"
              },
              description: "\u0434\u0438\u043D\u0430\u043C\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u0437\u043D\u0430\u043D\u0438\u044F/\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E\u0441\u0442\u0438 \u0440\u0435\u0446\u0435\u043F\u0442\u0430 (\u043D\u0430\u0432\u044B\u043A\u0438, \u0444\u043B\u0430\u0433\u0438, \u0447\u0435\u0440\u0442\u044B, \u043A\u0432\u0435\u0441\u0442\u044B)"
            },
            workbench: {
              anyOf: [
                {
                  type: "boolean"
                },
                {
                  type: "string"
                }
              ],
              description: "\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u0441\u0442\u0430\u0446\u0438\u043E\u043D\u0430\u0440\u043D\u044B\u0439 \u0432\u0435\u0440\u0441\u0442\u0430\u043A / \u043C\u0430\u0441\u0442\u0435\u0440\u0441\u043A\u0430\u044F (boolean \u0438\u043B\u0438 id \u0440\u0430\u0431\u043E\u0447\u0435\u0433\u043E \u043C\u0435\u0441\u0442\u0430).\n\u0411\u0435\u0437 \u0432\u0435\u0440\u0441\u0442\u0430\u043A\u0430 \u0432 \u043F\u043E\u043B\u0435\u0432\u044B\u0445 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u0445 \u0442\u0430\u043A\u043E\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F."
            },
            category: {
              type: "string",
              description: "\u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u0440\u0435\u0446\u0435\u043F\u0442\u0430 \u0434\u043B\u044F \u0444\u0438\u043B\u044C\u0442\u0440\u0430\u0446\u0438\u0438 \u043C\u0430\u0441\u0442\u0435\u0440\u0430 \u0438 \u0438\u0433\u0440\u043E\u043A\u0430"
            }
          },
          required: [
            "id",
            "label",
            "inputs",
            "output"
          ],
          additionalProperties: false,
          description: "\u0420\u0435\u0446\u0435\u043F\u0442 \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u0438\u044F: \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u044B (+ \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B) \u2192 \u043F\u0440\u0435\u0434\u043C\u0435\u0442. \u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430\n\u043D\u0430\u0432\u044B\u043A\u0430 \u2014 \u0440\u043E\u0434\u043D\u0430\u044F BRP-\u043C\u0435\u0445\u0430\u043D\u0438\u043A\u0430 (\u0443\u0441\u043F\u0435\u0445 \u0441\u0442\u0430\u0432\u0438\u0442 \xAB\u0433\u0430\u043B\u043E\u0447\u043A\u0443\xBB \u043E\u043F\u044B\u0442\u0430)."
        },
        CodexEntryDef: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string",
              description: "\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0437\u0430\u043F\u0438\u0441\u0438"
            },
            category: {
              type: "string",
              description: "id \u0438\u0437 meta.codex_categories (\u043D\u0435\u0442 \u2014 \u0432\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0435 \xAB\u0425\u0440\u043E\u043D\u0438\u043A\u0438\xBB)"
            },
            text: {
              type: "string",
              description: "\u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0442\u0435\u043A\u0441\u0442"
            },
            creature_entity: {
              type: "string",
              description: "\u0411\u0435\u0441\u0442\u0438\u0430\u0440\u0438\u0439 (\u0430\u0443\u0434\u0438\u0442 \xA75.6): id \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0430-NPC, \u043E \u043A\u043E\u0442\u043E\u0440\u043E\u043C \u0437\u0430\u043F\u0438\u0441\u044C.\n\u0417\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043E \u2014 \u0443 \u0437\u0430\u043F\u0438\u0441\u0438 \u0432 \u043A\u043E\u0434\u0435\u043A\u0441\u0435 \u043F\u043E\u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0431\u043E\u0435\u0432\u0430\u044F \u0441\u0432\u043E\u0434\u043A\u0430\n(\u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438, \u0431\u0440\u043E\u043D\u044F, \u043F\u0440\u0438\u0440\u043E\u0434\u043D\u043E\u0435 \u043E\u0440\u0443\u0436\u0438\u0435, \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u0438, \u043C\u043E\u0440\u0430\u043B\u044C)."
            },
            image: {
              type: "string",
              description: "\u0444\u0430\u0439\u043B/\u0441\u0441\u044B\u043B\u043A\u0430 (\u043D\u0435\u0442 \u2014 \u0431\u0435\u0437 \u043A\u0430\u0440\u0442\u0438\u043D\u043A\u0438)"
            }
          },
          required: [
            "id",
            "label",
            "text"
          ],
          additionalProperties: false,
          description: "\u0437\u0430\u043F\u0438\u0441\u044C \u043A\u043E\u0434\u0435\u043A\u0441\u0430/\u0431\u0435\u0441\u0442\u0438\u0430\u0440\u0438\u044F \u2014 \u0440\u0430\u0437\u0431\u043B\u043E\u043A\u0438\u0440\u0443\u0435\u043C\u044B\u0439 \u043B\u043E\u0440 (\u0431\u043B\u043E\u043A 10 \u0422\u0417)"
        },
        DlgCond: {
          anyOf: [
            {
              type: "object",
              properties: {
                type: {
                  const: "flag"
                },
                flag: {
                  type: "string"
                },
                not: {
                  type: "boolean"
                }
              },
              required: [
                "type",
                "flag"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "item_ge"
                },
                item: {
                  type: "string"
                },
                count: {
                  type: "number"
                },
                not: {
                  type: "boolean"
                }
              },
              required: [
                "type",
                "item",
                "count"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "has_item"
                },
                item: {
                  type: "string"
                },
                not: {
                  type: "boolean"
                }
              },
              required: [
                "type",
                "item"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "disp_ge"
                },
                target: {
                  type: "string"
                },
                value: {
                  type: "number"
                },
                not: {
                  type: "boolean"
                }
              },
              required: [
                "type",
                "target",
                "value"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "quest"
                },
                quest: {
                  type: "string"
                },
                stage: {
                  type: "string"
                },
                not: {
                  type: "boolean"
                }
              },
              required: [
                "type",
                "quest",
                "stage"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "in_party"
                },
                npc: {
                  type: "string"
                },
                not: {
                  type: "boolean"
                }
              },
              required: [
                "type",
                "npc"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "hp_ge"
                },
                value: {
                  type: "number"
                },
                not: {
                  type: "boolean"
                }
              },
              required: [
                "type",
                "value"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "has_status"
                },
                status: {
                  type: "string"
                },
                not: {
                  type: "boolean"
                }
              },
              required: [
                "type",
                "status"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "weather_is"
                },
                weather: {
                  type: "string"
                },
                not: {
                  type: "boolean"
                }
              },
              required: [
                "type",
                "weather"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "skill_ge"
                },
                skill: {
                  type: "string"
                },
                threshold: {
                  type: "number"
                },
                not: {
                  type: "boolean"
                }
              },
              required: [
                "type",
                "skill",
                "threshold"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "meta_counter"
                },
                key: {
                  type: "string"
                },
                ge: {
                  type: "number"
                },
                not: {
                  type: "boolean"
                }
              },
              required: [
                "type",
                "key",
                "ge"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "npc_known"
                },
                entity: {
                  type: "string"
                },
                known: {
                  type: "boolean"
                },
                not: {
                  type: "boolean"
                }
              },
              required: [
                "type",
                "entity"
              ],
              additionalProperties: false
            }
          ],
          description: "\u0443\u0441\u043B\u043E\u0432\u0438\u0435 \u043F\u043E\u043A\u0430\u0437\u0430/\u0432\u0435\u0442\u0432\u043B\u0435\u043D\u0438\u044F (\u0432\u0441\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u0441\u043F\u0438\u0441\u043A\u0430 \u0434\u043E\u043B\u0436\u043D\u044B \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C\u0441\u044F)"
        },
        DlgEmotion: {
          type: "string",
          description: "\u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u0438\u0435 (\u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043F\u043E\u0440\u0442\u0440\u0435\u0442\u0430): \u0431\u0430\u0437\u043E\u0432\u044B\u0435 + \u0441\u0432\u043E\u0438 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F \u0438\u0437 \u0444\u043E\u0440\u043C\u044B NPC"
        },
        DlgLine: {
          type: "object",
          properties: {
            text: {
              type: "string"
            },
            emotion: {
              $ref: "#/$defs/DlgEmotion"
            },
            action: {
              type: "boolean",
              description: "\u0430\u0432\u0442\u043E\u0440\u0441\u043A\u0430\u044F \u0440\u0435\u043C\u0430\u0440\u043A\u0430 (\u043A\u0443\u0440\u0441\u0438\u0432\u043E\u043C, \u043D\u0435 \u0432\u043B\u0438\u044F\u0435\u0442 \u043D\u0430 \u043F\u043E\u0440\u0442\u0440\u0435\u0442)"
            },
            voice: {
              type: "string",
              description: "\u043E\u0437\u0432\u0443\u0447\u043A\u0430 \u0440\u0435\u043F\u043B\u0438\u043A\u0438: \u0444\u0430\u0439\u043B \u043F\u0430\u043A\u0435\u0442\u0430 (assets/voice/\u2026) \u0438\u043B\u0438 \u0441\u0441\u044B\u043B\u043A\u0430 (\u0438\u0442\u0435\u0440\u0430\u0446\u0438\u044F 8,\n\u0431\u043B\u043E\u043A G). \u0415\u0441\u043B\u0438 \u043D\u0435\u0442 \u2014 \u043F\u0440\u0438 \u0432\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u043E\u043C \u0441\u0438\u043D\u0442\u0435\u0437\u0430\u0442\u043E\u0440\u0435 \u0440\u0435\u043F\u043B\u0438\u043A\u0443 \u0447\u0438\u0442\u0430\u0435\u0442 \u0431\u0440\u0430\u0443\u0437\u0435\u0440."
            },
            sfx: {
              type: "string",
              description: "\u0437\u0432\u0443\u043A\u043E\u0432\u043E\u0439 \u044D\u0444\u0444\u0435\u043A\u0442 \u0440\u0435\u043F\u043B\u0438\u043A\u0438: id \u0437\u0432\u0443\u043A\u0430 \u0438\u0437 meta.sounds \u0438\u043B\u0438 \u043F\u0443\u0442\u044C \u043A \u0444\u0430\u0439\u043B\u0443 (# sfx: ...)"
            },
            timer: {
              type: "number",
              description: "\u0441\u0435\u043A\u0443\u043D\u0434\u043D\u044B\u0439 \u0442\u0430\u0439\u043C\u0435\u0440 \u043F\u043E\u043A\u0430\u0437\u0430 \u0440\u0435\u043F\u043B\u0438\u043A\u0438 (# timer: 3 \u0438\u043B\u0438 # timeout: 3) \u2014 design-doc \xA79.\n\u041F\u043E \u0438\u0441\u0442\u0435\u0447\u0435\u043D\u0438\u0438 \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u0434\u0438\u0430\u043B\u043E\u0433 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0438\u0442 \u0434\u0430\u043B\u044C\u0448\u0435."
            }
          },
          required: [
            "text"
          ],
          additionalProperties: false
        },
        DlgEffect: {
          anyOf: [
            {
              type: "object",
              properties: {
                type: {
                  const: "set_flag"
                },
                flag: {
                  type: "string"
                },
                value: {
                  anyOf: [
                    {
                      type: "boolean"
                    },
                    {
                      type: "number"
                    },
                    {
                      type: "string"
                    }
                  ]
                }
              },
              required: [
                "type",
                "flag"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "clear_flag"
                },
                flag: {
                  type: "string"
                }
              },
              required: [
                "type",
                "flag"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "add_item"
                },
                item: {
                  type: "string"
                },
                qty: {
                  type: "number"
                }
              },
              required: [
                "type",
                "item",
                "qty"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "remove_item"
                },
                item: {
                  type: "string"
                },
                qty: {
                  type: "number"
                }
              },
              required: [
                "type",
                "item",
                "qty"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "fire_rule"
                },
                rule: {
                  type: "string"
                }
              },
              required: [
                "type",
                "rule"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "join_party"
                },
                npc: {
                  type: "string"
                }
              },
              required: [
                "type",
                "npc"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "open_trade"
                },
                npc: {
                  type: "string"
                }
              },
              required: [
                "type",
                "npc"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "open_craft"
                },
                recipe: {
                  type: "string"
                }
              },
              required: [
                "type"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "start_quest"
                },
                quest: {
                  type: "string"
                }
              },
              required: [
                "type",
                "quest"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "advance_time"
                },
                ticks: {
                  type: "number"
                }
              },
              required: [
                "type",
                "ticks"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "change_need"
                },
                need: {
                  type: "string"
                },
                delta: {
                  type: "number"
                }
              },
              required: [
                "type",
                "need",
                "delta"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "change_hp"
                },
                delta: {
                  type: "number"
                }
              },
              required: [
                "type",
                "delta"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "change_companion_need"
                },
                npc: {
                  type: "string"
                },
                need: {
                  type: "string"
                },
                delta: {
                  type: "number"
                }
              },
              required: [
                "type",
                "npc",
                "need",
                "delta"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "transfer_to_companion"
                },
                npc: {
                  type: "string"
                },
                item: {
                  type: "string"
                },
                qty: {
                  type: "number"
                }
              },
              required: [
                "type",
                "npc",
                "item",
                "qty"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "leave_party"
                },
                npc: {
                  type: "string"
                }
              },
              required: [
                "type",
                "npc"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "sleep"
                },
                ticks: {
                  type: "number"
                }
              },
              required: [
                "type",
                "ticks"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "change_disposition"
                },
                target: {
                  type: "string"
                },
                delta: {
                  type: "number"
                }
              },
              required: [
                "type",
                "target",
                "delta"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "play_cutscene"
                },
                cutscene: {
                  type: "string"
                }
              },
              required: [
                "type",
                "cutscene"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "set_description"
                },
                entity: {
                  type: "string"
                },
                text: {
                  type: "string"
                }
              },
              required: [
                "type",
                "entity",
                "text"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "apply_status"
                },
                status: {
                  type: "string"
                },
                duration: {
                  type: "number"
                }
              },
              required: [
                "type",
                "status"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "remove_status"
                },
                status: {
                  type: "string"
                }
              },
              required: [
                "type",
                "status"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "set_weather"
                },
                weather: {
                  type: "string"
                }
              },
              required: [
                "type",
                "weather"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "unlock_codex"
                },
                entry: {
                  type: "string"
                }
              },
              required: [
                "type",
                "entry"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "unlock_recipe"
                },
                recipe: {
                  type: "string"
                }
              },
              required: [
                "type",
                "recipe"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "set_entity_state"
                },
                entity: {
                  type: "string"
                },
                state: {
                  type: "string"
                }
              },
              required: [
                "type",
                "entity",
                "state"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "present_item"
                },
                ok: {
                  type: "string"
                },
                fail: {
                  type: "string"
                },
                required: {
                  type: "string"
                }
              },
              required: [
                "type",
                "ok",
                "fail"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "learn_name"
                },
                entity: {
                  type: "string"
                },
                silent: {
                  type: "boolean"
                }
              },
              required: [
                "type",
                "entity"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "go_to_scene"
                },
                scene: {
                  type: "string"
                },
                close_dialogue: {
                  type: "boolean"
                }
              },
              required: [
                "type",
                "scene"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "start_combat"
                },
                arena: {
                  type: "string"
                }
              },
              required: [
                "type",
                "arena"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "change_scene_state"
                },
                state: {
                  type: "string"
                },
                scene: {
                  type: "string"
                }
              },
              required: [
                "type",
                "state"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "game_over_death"
                },
                message: {
                  type: "string"
                }
              },
              required: [
                "type"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                type: {
                  const: "game_over_victory"
                },
                message: {
                  type: "string"
                }
              },
              required: [
                "type"
              ],
              additionalProperties: false
            }
          ]
        },
        DlgStep: {
          anyOf: [
            {
              type: "object",
              properties: {
                kind: {
                  const: "line"
                },
                line: {
                  $ref: "#/$defs/DlgLine"
                }
              },
              required: [
                "kind",
                "line"
              ],
              additionalProperties: false
            },
            {
              type: "object",
              properties: {
                kind: {
                  const: "effect"
                },
                effect: {
                  $ref: "#/$defs/DlgEffect"
                }
              },
              required: [
                "kind",
                "effect"
              ],
              additionalProperties: false
            }
          ],
          description: "\u0448\u0430\u0433: \u0440\u0435\u043F\u043B\u0438\u043A\u0430 \u0438\u043B\u0438 \u0438\u0433\u0440\u043E\u0432\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 (\u043F\u043E\u0440\u044F\u0434\u043E\u043A \u0432\u0430\u0436\u0435\u043D)"
        },
        DlgSection: {
          type: "object",
          properties: {
            conds: {
              type: "array",
              items: {
                $ref: "#/$defs/DlgCond"
              }
            },
            steps: {
              type: "array",
              items: {
                $ref: "#/$defs/DlgStep"
              }
            },
            goto: {
              type: "string"
            },
            else_steps: {
              type: "array",
              items: {
                $ref: "#/$defs/DlgStep"
              }
            },
            else_goto: {
              type: "string"
            }
          },
          required: [
            "steps"
          ],
          additionalProperties: false,
          description: "\u0411\u043B\u043E\u043A \u0448\u0430\u0433\u043E\u0432 \u0441 \u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u043C \u0443\u0441\u043B\u043E\u0432\u0438\u0435\u043C. \u0415\u0441\u043B\u0438 \u0443\u0441\u043B\u043E\u0432\u0438\u0435 \u0435\u0441\u0442\u044C \u2014 \u043C\u043E\u0436\u043D\u043E \u0437\u0430\u0434\u0430\u0442\u044C\n\u0432\u0435\u0442\u043A\u0443 \xAB\u0438\u043D\u0430\u0447\u0435\xBB. goto ('' \u2014 \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C, 'end', 'stay', id \u0443\u0437\u043B\u0430) \u0443\u0432\u043E\u0434\u0438\u0442\n\u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440 \u0438\u0437 \u0441\u0435\u0440\u0435\u0434\u0438\u043D\u044B \u0431\u043B\u043E\u043A\u0430."
        },
        DlgCheck: {
          type: "object",
          properties: {
            skill: {
              type: "string"
            },
            difficulty: {
              $ref: "#/$defs/SkillDifficulty",
              description: "\u0441\u043C. SkillDifficulty: \u0447\u0438\u0441\u043B\u043E-\u043F\u043E\u0440\u043E\u0433 (50 \u043D\u0435\u0439\u0442\u0440\u0430\u043B\u044C\u043D\u043E) \u0438\u043B\u0438 \u0443\u0440\u043E\u0432\u0435\u043D\u044C"
            },
            mods: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  conds: {
                    type: "array",
                    items: {
                      $ref: "#/$defs/DlgCond"
                    }
                  },
                  value: {
                    type: "number"
                  }
                },
                required: [
                  "conds",
                  "value"
                ],
                additionalProperties: false
              },
              description: "\u0438\u0437\u043C\u0435\u043D\u0451\u043D\u043D\u0430\u044F \u0441\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u044C \u043F\u0440\u0438 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u0445 (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 \xAB\u043B\u0435\u0433\u0447\u0435, \u0435\u0441\u043B\u0438 \u043F\u0440\u0438\u0448\u043B\u0438 \u0441 \u0442\u044B\u043B\u0430\xBB)"
            },
            success: {
              type: "object",
              properties: {
                sections: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/DlgSection"
                  }
                },
                goto: {
                  type: "string"
                }
              },
              required: [
                "sections",
                "goto"
              ],
              additionalProperties: false
            },
            fail: {
              type: "object",
              properties: {
                sections: {
                  type: "array",
                  items: {
                    $ref: "#/$defs/DlgSection"
                  }
                },
                goto: {
                  type: "string"
                }
              },
              required: [
                "sections",
                "goto"
              ],
              additionalProperties: false
            }
          },
          required: [
            "skill",
            "difficulty",
            "success",
            "fail"
          ],
          additionalProperties: false,
          description: "\u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0430\u0432\u044B\u043A\u0430 \u0441 \u0432\u0435\u0442\u043A\u0430\u043C\u0438 \u0443\u0441\u043F\u0435\u0445\u0430 \u0438 \u043F\u0440\u043E\u0432\u0430\u043B\u0430"
        },
        DlgChoice: {
          type: "object",
          properties: {
            text: {
              type: "string"
            },
            conds: {
              type: "array",
              items: {
                $ref: "#/$defs/DlgCond"
              },
              description: "\u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0432\u0430\u0440\u0438\u0430\u043D\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u0438 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u0445"
            },
            once: {
              type: "boolean",
              description: "\u043E\u0434\u043D\u043E\u0440\u0430\u0437\u043E\u0432\u044B\u0439 \u0432 \u0440\u0430\u043C\u043A\u0430\u0445 \u043E\u0434\u043D\u043E\u0433\u043E \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440\u0430 (\u0432 \u043D\u043E\u0432\u043E\u043C \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440\u0435 \u0432\u0435\u0440\u043D\u0451\u0442\u0441\u044F)"
            },
            sections: {
              type: "array",
              items: {
                $ref: "#/$defs/DlgSection"
              },
              description: "\u043E\u0442\u0432\u0435\u0442 \u041D\u041F\u0421 (\u0431\u043B\u043E\u043A\u0438 \u0441 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u043C\u0438)"
            },
            check: {
              $ref: "#/$defs/DlgCheck",
              description: "\u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0430\u0432\u044B\u043A\u0430 \u043F\u043E\u0441\u043B\u0435 \u043E\u0442\u0432\u0435\u0442\u0430 (\u0432\u0435\u0442\u043A\u0438 \u0443\u0441\u043F\u0435\u0445/\u043F\u0440\u043E\u0432\u0430\u043B)"
            },
            goto: {
              type: "string",
              description: "\u043A\u0443\u0434\u0430 \u0434\u0430\u043B\u044C\u0448\u0435: id \u0443\u0437\u043B\u0430, 'stay' (\u0442\u0435 \u0436\u0435 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u044B) \u0438\u043B\u0438 'end' (\u043A\u043E\u043D\u0435\u0446 \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440\u0430)"
            }
          },
          required: [
            "text",
            "sections",
            "goto"
          ],
          additionalProperties: false
        },
        DlgNode: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            label: {
              type: "string"
            },
            sections: {
              type: "array",
              items: {
                $ref: "#/$defs/DlgSection"
              }
            },
            choices: {
              type: "array",
              items: {
                $ref: "#/$defs/DlgChoice"
              }
            },
            goto: {
              type: "string",
              description: "\u0443\u0437\u0435\u043B \u0431\u0435\u0437 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432: \u043A\u0443\u0434\u0430 \u043F\u0435\u0440\u0435\u0439\u0442\u0438 \u043F\u043E\u0441\u043B\u0435 \u0440\u0435\u043F\u043B\u0438\u043A ('end' \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E)"
            },
            timer: {
              type: "object",
              properties: {
                seconds: {
                  type: "number"
                },
                node: {
                  type: "string",
                  description: "id \u0443\u0437\u043B\u0430, \u043A\u0443\u0434\u0430 \u0443\u0439\u0442\u0438 \u043F\u043E \u0438\u0441\u0442\u0435\u0447\u0435\u043D\u0438\u0438; \u043F\u0443\u0441\u0442\u043E \u2014 \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440 \u0437\u0430\u043A\u0430\u043D\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F"
                }
              },
              required: [
                "seconds"
              ],
              additionalProperties: false,
              description: "\u0414\u0435\u0434\u043B\u0430\u0439\u043D \u043D\u0430 \u0440\u0430\u0437\u0434\u0443\u043C\u044C\u0435 (\u0444\u0438\u0434\u0431\u0435\u043A 27, \xA79 \u0434\u0438\u0437\u0430\u0439\u043D-\u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430): \u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0441\u0435\u043A\u0443\u043D\u0434\n\u0438\u0433\u0440\u043E\u043A \u043C\u043E\u0436\u0435\u0442 \u0432\u044B\u0431\u0438\u0440\u0430\u0442\u044C \u043E\u0442\u0432\u0435\u0442 \u0432 \u044D\u0442\u043E\u043C \u0443\u0437\u043B\u0435. \u0418\u0441\u0442\u0435\u043A\u043B\u043E \u2014 \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440 \u0443\u0445\u043E\u0434\u0438\u0442 \u0432\n\u0443\u0437\u0435\u043B `node` (\u0438\u043B\u0438 \u0437\u0430\u043A\u0430\u043D\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F, \u0435\u0441\u043B\u0438 \u043E\u043D \u043D\u0435 \u0437\u0430\u0434\u0430\u043D). \u0420\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0443\n\u0443\u0437\u043B\u043E\u0432 \u0441 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u0430\u043C\u0438 \u043E\u0442\u0432\u0435\u0442\u0430; \u0432 ink \u043F\u0440\u0435\u0432\u0440\u0430\u0449\u0430\u0435\u0442\u0441\u044F \u0432 `set_dialogue_timer`."
            }
          },
          required: [
            "id",
            "label",
            "sections",
            "choices"
          ],
          additionalProperties: false
        },
        DlgDoc: {
          type: "object",
          properties: {
            version: {
              const: 2
            },
            label: {
              type: "string",
              description: "\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0434\u0438\u0430\u043B\u043E\u0433\u0430 \u0434\u043B\u044F \u043C\u0430\u0441\u0442\u0435\u0440\u0430 (\u0432 \u0441\u043F\u0438\u0441\u043A\u0430\u0445 \u0432\u043C\u0435\u0441\u0442\u043E \u0438\u043C\u0435\u043D\u0438 \u0444\u0430\u0439\u043B\u0430)"
            },
            nodes: {
              type: "array",
              items: {
                $ref: "#/$defs/DlgNode"
              }
            },
            script: {
              type: "string",
              description: "\u041C\u0430\u0441\u0442\u0435\u0440\u0441\u043A\u0438\u0439 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439 (\u0444\u0438\u0434\u0431\u0435\u043A 29): \u0442\u0435\u043A\u0441\u0442, \u043A\u043E\u0442\u043E\u0440\u044B\u0439 \u043C\u0430\u0441\u0442\u0435\u0440 \u043F\u0438\u0448\u0435\u0442 \u0441\u043B\u043E\u0432\u0430\u043C\u0438.\n\u041A\u0430\u043D\u043E\u043D \u0434\u043B\u044F \u0447\u0442\u0435\u043D\u0438\u044F \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u043E\u043C; nodes \u2014 \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430, \u0441\u043E\u0431\u0440\u0430\u043D\u043D\u0430\u044F \u0438\u0437 \u043D\u0435\u0433\u043E (\u0435\u0451\n\u0447\u0438\u0442\u0430\u044E\u0442 \u0444\u043E\u0440\u043C\u044B, ink-\u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440 \u0438 \u0434\u0432\u0438\u0436\u043E\u043A). \u041F\u0440\u0430\u0432\u043A\u0430 \u0444\u043E\u0440\u043C \u043F\u0435\u0440\u0435\u0441\u043E\u0431\u0438\u0440\u0430\u0435\u0442 script."
            }
          },
          required: [
            "version",
            "nodes"
          ],
          additionalProperties: false
        },
        MonolithRawInk: {
          type: "object",
          properties: {
            label: {
              type: "string"
            },
            ink: {
              type: "string"
            }
          },
          required: [
            "ink"
          ],
          additionalProperties: false,
          description: "\u0414\u0438\u0430\u043B\u043E\u0433 \u0432 \u043C\u043E\u043D\u043E\u043B\u0438\u0442\u043D\u043E\u043C JSON: \u043E\u0431\u044B\u0447\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0430 (.dlg.json) \u0418\u041B\u0418\n\xAB\u0441\u044B\u0440\u043E\u0439\xBB ink-\u0438\u0441\u0445\u043E\u0434\u043D\u0438\u043A (\u0437\u0430\u043F\u0430\u0441\u043D\u043E\u0439 \u0432\u0430\u0440\u0438\u0430\u043D\u0442 \u0434\u043B\u044F \u043F\u0440\u043E\u0434\u0432\u0438\u043D\u0443\u0442\u044B\u0445 \u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440\u043E\u0432;\n.ink \u0438\u0437 DlgDoc \u0433\u0435\u043D\u0435\u0440\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u043F\u0440\u0438 \u0438\u043C\u043F\u043E\u0440\u0442\u0435)."
        },
        MonolithDialogue: {
          anyOf: [
            {
              $ref: "#/$defs/DlgDoc"
            },
            {
              $ref: "#/$defs/MonolithRawInk"
            }
          ]
        },
        MonolithDoc: {
          type: "object",
          properties: {
            campaign: {
              $ref: "#/$defs/CampaignMeta"
            },
            world: {
              $ref: "#/$defs/WorldDef"
            },
            scenes: {
              type: "object",
              additionalProperties: {
                $ref: "#/$defs/SceneDef"
              }
            },
            entities: {
              type: "object",
              additionalProperties: {
                $ref: "#/$defs/EntityDef"
              }
            },
            rules: {
              type: "object",
              additionalProperties: {
                $ref: "#/$defs/RuleDef"
              }
            },
            quests: {
              type: "object",
              additionalProperties: {
                $ref: "#/$defs/QuestDef"
              }
            },
            arenas: {
              type: "object",
              additionalProperties: {
                $ref: "#/$defs/ArenaDef"
              }
            },
            cutscenes: {
              type: "object",
              additionalProperties: {
                $ref: "#/$defs/CutsceneDef"
              }
            },
            encounters: {
              type: "object",
              additionalProperties: {
                $ref: "#/$defs/EncounterTableDef"
              },
              description: "\u0442\u0430\u0431\u043B\u0438\u0446\u044B \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u044B\u0445 \u0432\u0441\u0442\u0440\u0435\u0447 (\u0432 Campaign Package \u043B\u0435\u0436\u0430\u0442 \u0432 rules/encounters.json)"
            },
            recipes: {
              type: "object",
              additionalProperties: {
                $ref: "#/$defs/RecipeDef"
              },
              description: "\u0440\u0435\u0446\u0435\u043F\u0442\u044B \u043A\u0440\u0430\u0444\u0442\u0430 \u043F\u043E id (\u0431\u043B\u043E\u043A 4 \u0422\u0417; \u0444\u0430\u0439\u043B\u044B \u0432 recipes/)"
            },
            codex: {
              type: "object",
              additionalProperties: {
                $ref: "#/$defs/CodexEntryDef"
              },
              description: "\u0437\u0430\u043F\u0438\u0441\u0438 \u043A\u043E\u0434\u0435\u043A\u0441\u0430/\u0431\u0435\u0441\u0442\u0438\u0430\u0440\u0438\u044F \u043F\u043E id (\u0431\u043B\u043E\u043A 10 \u0422\u0417; \u0444\u0430\u0439\u043B\u044B \u0432 codex/)"
            },
            dialogues: {
              type: "object",
              additionalProperties: {
                $ref: "#/$defs/MonolithDialogue"
              },
              description: "\u0434\u0438\u0430\u043B\u043E\u0433\u0438 \u043F\u043E id (\u0438\u043C\u044F \u0444\u0430\u0439\u043B\u0430 \u0431\u0435\u0437 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044F)"
            }
          },
          required: [
            "campaign",
            "world",
            "scenes",
            "entities",
            "rules",
            "quests",
            "arenas",
            "cutscenes",
            "dialogues"
          ],
          additionalProperties: false,
          description: "\xAB\u041A\u0430\u043C\u043F\u0430\u043D\u0438\u044F \u043E\u0434\u043D\u0438\u043C JSON\xBB \u2014 \u0444\u043E\u0440\u043C\u0430\u0442 \u043E\u0431\u043C\u0435\u043D\u0430 \u0438 \u0418\u0418-\u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u0438 (\u0431\u043B\u043E\u043A F).\n\u041A\u043B\u044E\u0447\u0438 \u0441\u043B\u043E\u0432\u0430\u0440\u0435\u0439 \u2014 id \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u0432 (\u043A\u0430\u043A \u0432 \u0441\u0430\u043C\u0438\u0445 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044F\u0445). \u041F\u0440\u0438 \u0438\u043C\u043F\u043E\u0440\u0442\u0435\n\u0432\u0430\u043B\u0438\u0434\u0430\u0442\u043E\u0440 \u0447\u0438\u043D\u0438\u0442 \u0441\u0441\u044B\u043B\u043A\u0438 (\u0441\u043E\u0437\u0434\u0430\u0451\u0442 \u0437\u0430\u0433\u043B\u0443\u0448\u043A\u0438, \u043E\u0442\u043A\u043B\u044E\u0447\u0430\u0435\u0442 \u0431\u0438\u0442\u043E\u0435) \u0438 \u0440\u0430\u0441\u043A\u043B\u0430\u0434\u044B\u0432\u0430\u0435\u0442\n\u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u043E\u0431\u0440\u0430\u0442\u043D\u043E \u0432 Campaign Package; .ink \u0434\u043B\u044F \u0434\u0438\u0430\u043B\u043E\u0433\u043E\u0432 \u0433\u0435\u043D\u0435\u0440\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u0438\u0437\nDlgDoc. \u041F\u043E\u043B\u043D\u044B\u0439 \u043E\u043F\u0438\u0441\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u0441\u0445\u0435\u043C\u044B \u2014 docs/campaign.schema.json,\n\u0433\u0430\u0439\u0434 \u0434\u043B\u044F \u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440\u043E\u0432 \u2014 docs/ai-campaign-guide.md."
        },
        CampaignManifest: {
          type: "object",
          properties: {
            scenes: {
              type: "array",
              items: {
                type: "string"
              }
            },
            entities: {
              type: "array",
              items: {
                type: "string"
              }
            },
            rules: {
              type: "array",
              items: {
                type: "string"
              },
              description: "\u0444\u0430\u0439\u043B\u044B \u041F\u0420\u0410\u0412\u0418\u041B (RuleDef: id/label/once/conditions/effects). \u0424\u0430\u0439\u043B\u044B \u0442\u0430\u0431\u043B\u0438\u0446 \u0432\u0441\u0442\u0440\u0435\u0447\n(`encounter_tables`) \u0441\u044E\u0434\u0430 \u041D\u0415 \u043F\u0435\u0440\u0435\u0447\u0438\u0441\u043B\u044F\u044E\u0442 \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u0432 `encounters`."
            },
            arenas: {
              type: "array",
              items: {
                type: "string"
              }
            },
            quests: {
              type: "array",
              items: {
                type: "string"
              }
            },
            encounters: {
              type: "array",
              items: {
                type: "string"
              },
              description: "\u0444\u0430\u0439\u043B\u044B-\u043E\u0431\u0451\u0440\u0442\u043A\u0438 \u0442\u0430\u0431\u043B\u0438\u0446 \u0432\u0441\u0442\u0440\u0435\u0447 `{ encounter_tables: [...] }`: \u0441\u0430\u043C\u0438 \u043B\u0435\u0436\u0430\u0442 \u0432\n\u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0435 rules/, \u043D\u043E \u043F\u0435\u0440\u0435\u0447\u0438\u0441\u043B\u044F\u044E\u0442\u0441\u044F \u0422\u041E\u041B\u042C\u041A\u041E \u0437\u0434\u0435\u0441\u044C (\u0434\u044B\u0440\u0430: \u0434\u0443\u0431\u043B\u044C \u0432 `rules`\n\u0434\u0430\u0432\u0430\u043B \xAB\u043F\u0440\u0430\u0432\u0438\u043B\u043E\xBB \u0431\u0435\u0437 id/conditions \u0438 \u0440\u043E\u043D\u044F\u043B \u0434\u0432\u0438\u0436\u043E\u043A \u0438 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440)."
            },
            cutscenes: {
              type: "array",
              items: {
                type: "string"
              }
            },
            recipes: {
              type: "array",
              items: {
                type: "string"
              }
            },
            codex: {
              type: "array",
              items: {
                type: "string"
              }
            },
            dialogues: {
              type: "array",
              items: {
                type: "string"
              }
            }
          },
          required: [
            "scenes",
            "entities",
            "rules",
            "dialogues"
          ],
          additionalProperties: false,
          description: "manifest.json \u2014 \u0441\u043F\u0438\u0441\u043E\u043A \u043C\u043E\u0434\u0443\u043B\u0435\u0439 Campaign Package, \u043F\u043E \u043E\u0434\u043D\u043E\u043C\u0443 JSON/Ink-\u0444\u0430\u0439\u043B\u0443 \u043D\u0430 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C."
        },
        CampaignIndexEntry: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            title: {
              type: "string"
            },
            description: {
              type: "string"
            },
            author: {
              type: "string"
            }
          },
          required: [
            "id",
            "title"
          ],
          additionalProperties: false,
          description: "\u041E\u0434\u043D\u0430 \u0437\u0430\u043F\u0438\u0441\u044C \u043E\u0431\u0449\u0435\u0433\u043E public/campaigns/index.json."
        },
        EncounterFileDef: {
          type: "object",
          properties: {
            encounter_tables: {
              type: "array",
              items: {
                $ref: "#/$defs/EncounterTableDef"
              }
            }
          },
          required: [
            "encounter_tables"
          ],
          additionalProperties: false,
          description: "JSON-\u0444\u0430\u0439\u043B-\u043E\u0431\u0451\u0440\u0442\u043A\u0430 \u0434\u043B\u044F \u0442\u0430\u0431\u043B\u0438\u0446 \u0432\u0441\u0442\u0440\u0435\u0447 \u0432 rules/ (\u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 Campaign Package)."
        }
      }
    };
  }
});

// src/core/dice.ts
var init_dice = __esm({
  "src/core/dice.ts"() {
  }
});

// src/core/brp.ts
var init_brp = __esm({
  "src/core/brp.ts"() {
    init_types();
    init_dice();
  }
});

// node_modules/seedrandom/lib/alea.js
var require_alea = __commonJS({
  "node_modules/seedrandom/lib/alea.js"(exports, module) {
    (function(global, module2, define2) {
      function Alea(seed) {
        var me = this, mash = Mash();
        me.next = function() {
          var t = 2091639 * me.s0 + me.c * 23283064365386963e-26;
          me.s0 = me.s1;
          me.s1 = me.s2;
          return me.s2 = t - (me.c = t | 0);
        };
        me.c = 1;
        me.s0 = mash(" ");
        me.s1 = mash(" ");
        me.s2 = mash(" ");
        me.s0 -= mash(seed);
        if (me.s0 < 0) {
          me.s0 += 1;
        }
        me.s1 -= mash(seed);
        if (me.s1 < 0) {
          me.s1 += 1;
        }
        me.s2 -= mash(seed);
        if (me.s2 < 0) {
          me.s2 += 1;
        }
        mash = null;
      }
      function copy(f, t) {
        t.c = f.c;
        t.s0 = f.s0;
        t.s1 = f.s1;
        t.s2 = f.s2;
        return t;
      }
      function impl(seed, opts) {
        var xg = new Alea(seed), state = opts && opts.state, prng = xg.next;
        prng.int32 = function() {
          return xg.next() * 4294967296 | 0;
        };
        prng.double = function() {
          return prng() + (prng() * 2097152 | 0) * 11102230246251565e-32;
        };
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      function Mash() {
        var n = 4022871197;
        var mash = function(data) {
          data = String(data);
          for (var i = 0; i < data.length; i++) {
            n += data.charCodeAt(i);
            var h = 0.02519603282416938 * n;
            n = h >>> 0;
            h -= n;
            h *= n;
            n = h >>> 0;
            h -= n;
            n += h * 4294967296;
          }
          return (n >>> 0) * 23283064365386963e-26;
        };
        return mash;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.alea = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// node_modules/seedrandom/lib/xor128.js
var require_xor128 = __commonJS({
  "node_modules/seedrandom/lib/xor128.js"(exports, module) {
    (function(global, module2, define2) {
      function XorGen(seed) {
        var me = this, strseed = "";
        me.x = 0;
        me.y = 0;
        me.z = 0;
        me.w = 0;
        me.next = function() {
          var t = me.x ^ me.x << 11;
          me.x = me.y;
          me.y = me.z;
          me.z = me.w;
          return me.w ^= me.w >>> 19 ^ t ^ t >>> 8;
        };
        if (seed === (seed | 0)) {
          me.x = seed;
        } else {
          strseed += seed;
        }
        for (var k = 0; k < strseed.length + 64; k++) {
          me.x ^= strseed.charCodeAt(k) | 0;
          me.next();
        }
      }
      function copy(f, t) {
        t.x = f.x;
        t.y = f.y;
        t.z = f.z;
        t.w = f.w;
        return t;
      }
      function impl(seed, opts) {
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xor128 = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// node_modules/seedrandom/lib/xorwow.js
var require_xorwow = __commonJS({
  "node_modules/seedrandom/lib/xorwow.js"(exports, module) {
    (function(global, module2, define2) {
      function XorGen(seed) {
        var me = this, strseed = "";
        me.next = function() {
          var t = me.x ^ me.x >>> 2;
          me.x = me.y;
          me.y = me.z;
          me.z = me.w;
          me.w = me.v;
          return (me.d = me.d + 362437 | 0) + (me.v = me.v ^ me.v << 4 ^ (t ^ t << 1)) | 0;
        };
        me.x = 0;
        me.y = 0;
        me.z = 0;
        me.w = 0;
        me.v = 0;
        if (seed === (seed | 0)) {
          me.x = seed;
        } else {
          strseed += seed;
        }
        for (var k = 0; k < strseed.length + 64; k++) {
          me.x ^= strseed.charCodeAt(k) | 0;
          if (k == strseed.length) {
            me.d = me.x << 10 ^ me.x >>> 4;
          }
          me.next();
        }
      }
      function copy(f, t) {
        t.x = f.x;
        t.y = f.y;
        t.z = f.z;
        t.w = f.w;
        t.v = f.v;
        t.d = f.d;
        return t;
      }
      function impl(seed, opts) {
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xorwow = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// node_modules/seedrandom/lib/xorshift7.js
var require_xorshift7 = __commonJS({
  "node_modules/seedrandom/lib/xorshift7.js"(exports, module) {
    (function(global, module2, define2) {
      function XorGen(seed) {
        var me = this;
        me.next = function() {
          var X = me.x, i = me.i, t, v, w;
          t = X[i];
          t ^= t >>> 7;
          v = t ^ t << 24;
          t = X[i + 1 & 7];
          v ^= t ^ t >>> 10;
          t = X[i + 3 & 7];
          v ^= t ^ t >>> 3;
          t = X[i + 4 & 7];
          v ^= t ^ t << 7;
          t = X[i + 7 & 7];
          t = t ^ t << 13;
          v ^= t ^ t << 9;
          X[i] = v;
          me.i = i + 1 & 7;
          return v;
        };
        function init(me2, seed2) {
          var j, w, X = [];
          if (seed2 === (seed2 | 0)) {
            w = X[0] = seed2;
          } else {
            seed2 = "" + seed2;
            for (j = 0; j < seed2.length; ++j) {
              X[j & 7] = X[j & 7] << 15 ^ seed2.charCodeAt(j) + X[j + 1 & 7] << 13;
            }
          }
          while (X.length < 8) X.push(0);
          for (j = 0; j < 8 && X[j] === 0; ++j) ;
          if (j == 8) w = X[7] = -1;
          else w = X[j];
          me2.x = X;
          me2.i = 0;
          for (j = 256; j > 0; --j) {
            me2.next();
          }
        }
        init(me, seed);
      }
      function copy(f, t) {
        t.x = f.x.slice();
        t.i = f.i;
        return t;
      }
      function impl(seed, opts) {
        if (seed == null) seed = +/* @__PURE__ */ new Date();
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (state.x) copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xorshift7 = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// node_modules/seedrandom/lib/xor4096.js
var require_xor4096 = __commonJS({
  "node_modules/seedrandom/lib/xor4096.js"(exports, module) {
    (function(global, module2, define2) {
      function XorGen(seed) {
        var me = this;
        me.next = function() {
          var w = me.w, X = me.X, i = me.i, t, v;
          me.w = w = w + 1640531527 | 0;
          v = X[i + 34 & 127];
          t = X[i = i + 1 & 127];
          v ^= v << 13;
          t ^= t << 17;
          v ^= v >>> 15;
          t ^= t >>> 12;
          v = X[i] = v ^ t;
          me.i = i;
          return v + (w ^ w >>> 16) | 0;
        };
        function init(me2, seed2) {
          var t, v, i, j, w, X = [], limit = 128;
          if (seed2 === (seed2 | 0)) {
            v = seed2;
            seed2 = null;
          } else {
            seed2 = seed2 + "\0";
            v = 0;
            limit = Math.max(limit, seed2.length);
          }
          for (i = 0, j = -32; j < limit; ++j) {
            if (seed2) v ^= seed2.charCodeAt((j + 32) % seed2.length);
            if (j === 0) w = v;
            v ^= v << 10;
            v ^= v >>> 15;
            v ^= v << 4;
            v ^= v >>> 13;
            if (j >= 0) {
              w = w + 1640531527 | 0;
              t = X[j & 127] ^= v + w;
              i = 0 == t ? i + 1 : 0;
            }
          }
          if (i >= 128) {
            X[(seed2 && seed2.length || 0) & 127] = -1;
          }
          i = 127;
          for (j = 4 * 128; j > 0; --j) {
            v = X[i + 34 & 127];
            t = X[i = i + 1 & 127];
            v ^= v << 13;
            t ^= t << 17;
            v ^= v >>> 15;
            t ^= t >>> 12;
            X[i] = v ^ t;
          }
          me2.w = w;
          me2.X = X;
          me2.i = i;
        }
        init(me, seed);
      }
      function copy(f, t) {
        t.i = f.i;
        t.w = f.w;
        t.X = f.X.slice();
        return t;
      }
      ;
      function impl(seed, opts) {
        if (seed == null) seed = +/* @__PURE__ */ new Date();
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (state.X) copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xor4096 = impl;
      }
    })(
      exports,
      // window object or global
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// node_modules/seedrandom/lib/tychei.js
var require_tychei = __commonJS({
  "node_modules/seedrandom/lib/tychei.js"(exports, module) {
    (function(global, module2, define2) {
      function XorGen(seed) {
        var me = this, strseed = "";
        me.next = function() {
          var b = me.b, c = me.c, d = me.d, a = me.a;
          b = b << 25 ^ b >>> 7 ^ c;
          c = c - d | 0;
          d = d << 24 ^ d >>> 8 ^ a;
          a = a - b | 0;
          me.b = b = b << 20 ^ b >>> 12 ^ c;
          me.c = c = c - d | 0;
          me.d = d << 16 ^ c >>> 16 ^ a;
          return me.a = a - b | 0;
        };
        me.a = 0;
        me.b = 0;
        me.c = 2654435769 | 0;
        me.d = 1367130551;
        if (seed === Math.floor(seed)) {
          me.a = seed / 4294967296 | 0;
          me.b = seed | 0;
        } else {
          strseed += seed;
        }
        for (var k = 0; k < strseed.length + 20; k++) {
          me.b ^= strseed.charCodeAt(k) | 0;
          me.next();
        }
      }
      function copy(f, t) {
        t.a = f.a;
        t.b = f.b;
        t.c = f.c;
        t.d = f.d;
        return t;
      }
      ;
      function impl(seed, opts) {
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.tychei = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// node_modules/seedrandom/seedrandom.js
var require_seedrandom = __commonJS({
  "node_modules/seedrandom/seedrandom.js"(exports, module) {
    (function(global, pool, math) {
      var width = 256, chunks = 6, digits = 52, rngname = "random", startdenom = math.pow(width, chunks), significance = math.pow(2, digits), overflow = significance * 2, mask = width - 1, nodecrypto;
      function seedrandom2(seed, options, callback) {
        var key = [];
        options = options == true ? { entropy: true } : options || {};
        var shortseed = mixkey(flatten(
          options.entropy ? [seed, tostring(pool)] : seed == null ? autoseed() : seed,
          3
        ), key);
        var arc4 = new ARC4(key);
        var prng = function() {
          var n = arc4.g(chunks), d = startdenom, x = 0;
          while (n < significance) {
            n = (n + x) * width;
            d *= width;
            x = arc4.g(1);
          }
          while (n >= overflow) {
            n /= 2;
            d /= 2;
            x >>>= 1;
          }
          return (n + x) / d;
        };
        prng.int32 = function() {
          return arc4.g(4) | 0;
        };
        prng.quick = function() {
          return arc4.g(4) / 4294967296;
        };
        prng.double = prng;
        mixkey(tostring(arc4.S), pool);
        return (options.pass || callback || function(prng2, seed2, is_math_call, state) {
          if (state) {
            if (state.S) {
              copy(state, arc4);
            }
            prng2.state = function() {
              return copy(arc4, {});
            };
          }
          if (is_math_call) {
            math[rngname] = prng2;
            return seed2;
          } else return prng2;
        })(
          prng,
          shortseed,
          "global" in options ? options.global : this == math,
          options.state
        );
      }
      function ARC4(key) {
        var t, keylen = key.length, me = this, i = 0, j = me.i = me.j = 0, s = me.S = [];
        if (!keylen) {
          key = [keylen++];
        }
        while (i < width) {
          s[i] = i++;
        }
        for (i = 0; i < width; i++) {
          s[i] = s[j = mask & j + key[i % keylen] + (t = s[i])];
          s[j] = t;
        }
        (me.g = function(count) {
          var t2, r = 0, i2 = me.i, j2 = me.j, s2 = me.S;
          while (count--) {
            t2 = s2[i2 = mask & i2 + 1];
            r = r * width + s2[mask & (s2[i2] = s2[j2 = mask & j2 + t2]) + (s2[j2] = t2)];
          }
          me.i = i2;
          me.j = j2;
          return r;
        })(width);
      }
      function copy(f, t) {
        t.i = f.i;
        t.j = f.j;
        t.S = f.S.slice();
        return t;
      }
      ;
      function flatten(obj, depth) {
        var result = [], typ = typeof obj, prop;
        if (depth && typ == "object") {
          for (prop in obj) {
            try {
              result.push(flatten(obj[prop], depth - 1));
            } catch (e) {
            }
          }
        }
        return result.length ? result : typ == "string" ? obj : obj + "\0";
      }
      function mixkey(seed, key) {
        var stringseed = seed + "", smear, j = 0;
        while (j < stringseed.length) {
          key[mask & j] = mask & (smear ^= key[mask & j] * 19) + stringseed.charCodeAt(j++);
        }
        return tostring(key);
      }
      function autoseed() {
        try {
          var out;
          if (nodecrypto && (out = nodecrypto.randomBytes)) {
            out = out(width);
          } else {
            out = new Uint8Array(width);
            (global.crypto || global.msCrypto).getRandomValues(out);
          }
          return tostring(out);
        } catch (e) {
          var browser = global.navigator, plugins = browser && browser.plugins;
          return [+/* @__PURE__ */ new Date(), global, plugins, global.screen, tostring(pool)];
        }
      }
      function tostring(a) {
        return String.fromCharCode.apply(0, a);
      }
      mixkey(math.random(), pool);
      if (typeof module == "object" && module.exports) {
        module.exports = seedrandom2;
        try {
          nodecrypto = __require("crypto");
        } catch (ex) {
        }
      } else if (typeof define == "function" && define.amd) {
        define(function() {
          return seedrandom2;
        });
      } else {
        math["seed" + rngname] = seedrandom2;
      }
    })(
      // global: `self` in browsers (including strict mode and web workers),
      // otherwise `this` in Node and other environments
      typeof self !== "undefined" ? self : exports,
      [],
      // pool: entropy pool starts empty
      Math
      // math: package containing random, pow, and seedrandom
    );
  }
});

// node_modules/seedrandom/index.js
var require_seedrandom2 = __commonJS({
  "node_modules/seedrandom/index.js"(exports, module) {
    var alea = require_alea();
    var xor128 = require_xor128();
    var xorwow = require_xorwow();
    var xorshift7 = require_xorshift7();
    var xor4096 = require_xor4096();
    var tychei = require_tychei();
    var sr = require_seedrandom();
    sr.alea = alea;
    sr.xor128 = xor128;
    sr.xorwow = xorwow;
    sr.xorshift7 = xorshift7;
    sr.xor4096 = xor4096;
    sr.tychei = tychei;
    module.exports = sr;
  }
});

// src/core/prng.ts
var import_seedrandom, PRNG;
var init_prng = __esm({
  "src/core/prng.ts"() {
    import_seedrandom = __toESM(require_seedrandom2(), 1);
    PRNG = class {
      rng;
      seed;
      constructor(seed) {
        this.seed = seed ?? Math.random().toString(36).slice(2, 10);
        this.rng = (0, import_seedrandom.default)(this.seed);
      }
      /** [0, 1) */
      next() {
        return this.rng();
      }
      /** целое [min, max] включительно */
      int(min, max) {
        return min + Math.floor(this.next() * (max - min + 1));
      }
      chance(probability) {
        return this.next() < probability;
      }
      pick(arr) {
        return arr[this.int(0, arr.length - 1)];
      }
    };
  }
});

// src/core/charcreate.ts
function statMin(creation) {
  return creation.stat_limits.min;
}
function statPointsUsed(creation, choice) {
  let sum = 0;
  for (const k of STAT_KEYS) sum += Math.max(0, (choice.stats[k] ?? statMin(creation)) - statMin(creation));
  return sum;
}
function skillBaseFloor(creation, id) {
  const floor = creation.skill_floor ?? 0;
  return (creation.mandatory_skills ?? []).includes(id) ? Math.max(floor, 25) : floor;
}
function charCreationTemplateFindings(creation) {
  const findings = [];
  if (!creation.roll) {
    for (const profession of creation.professions ?? []) {
      const stats = profession.stats ?? {};
      const choice = { stats, skills: {}, profession: profession.id, calling: "", name: "" };
      const used = statPointsUsed(creation, choice);
      if (used !== creation.total_points) {
        const delta = creation.total_points - used;
        findings.push(`\u041F\u0440\u043E\u0438\u0441\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u0435 \xAB${profession.label}\xBB: \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043E ${used} \u0438\u0437 ${creation.total_points} \u043E\u0447\u043A\u043E\u0432 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A (${delta > 0 ? `\u043D\u0435 \u0445\u0432\u0430\u0442\u0430\u0435\u0442 ${delta}` : `\u043F\u0435\u0440\u0435\u0440\u0430\u0441\u0445\u043E\u0434 ${-delta}`}).`);
      }
    }
  }
  if (creation.skill_points === void 0 || !creation.callings?.length) return findings;
  const professions = creation.professions?.length ? creation.professions : [{ id: "", label: "\u0431\u0435\u0437 \u043F\u0440\u043E\u0438\u0441\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u044F", skill_bonus: {} }];
  for (const profession of professions) {
    for (const call of creation.callings) {
      let used = 0;
      const ids = /* @__PURE__ */ new Set([...Object.keys(call.skills ?? {}), ...creation.mandatory_skills ?? [], ...Object.keys(profession.skill_bonus ?? {})]);
      for (const id of ids) {
        const floor = skillBaseFloor(creation, id) + (profession.skill_bonus?.[id] ?? 0);
        const target = call.skills?.[id] ?? floor;
        const value = Math.max(floor, Math.round(Number.isFinite(target) ? target : floor));
        const capped = creation.skill_cap === void 0 ? value : Math.min(creation.skill_cap, value);
        used += Math.max(0, capped - floor);
      }
      if (used !== creation.skill_points) {
        const delta = creation.skill_points - used;
        findings.push(`\u0421\u043E\u0447\u0435\u0442\u0430\u043D\u0438\u0435 \xAB${profession.label}\xBB + \xAB${call.label}\xBB: \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043E ${used} \u0438\u0437 ${creation.skill_points} \u043E\u0447\u043A\u043E\u0432 \u043D\u0430\u0432\u044B\u043A\u043E\u0432 (${delta > 0 ? `\u043D\u0435 \u0445\u0432\u0430\u0442\u0430\u0435\u0442 ${delta}` : `\u043F\u0435\u0440\u0435\u0440\u0430\u0441\u0445\u043E\u0434 ${-delta}`}); \u0431\u043E\u043D\u0443\u0441\u044B \u043F\u0440\u043E\u0438\u0441\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u044F \u043D\u0435 \u0432\u0445\u043E\u0434\u044F\u0442 \u0432 \u0431\u044E\u0434\u0436\u0435\u0442.`);
      }
    }
  }
  return findings;
}
var STAT_KEYS, screenRng;
var init_charcreate = __esm({
  "src/core/charcreate.ts"() {
    init_brp();
    init_dice();
    init_prng();
    init_skills();
    STAT_KEYS = ["STR", "CON", "SIZ", "DEX", "INT", "POW", "CHA"];
    screenRng = new PRNG();
  }
});

// src/editor/campaignAudit.ts
var campaignAudit_exports = {};
__export(campaignAudit_exports, {
  auditCounts: () => auditCounts,
  campaignContentHash: () => campaignContentHash,
  collectCampaignMedia: () => collectCampaignMedia,
  formatCampaignAuditReport: () => formatCampaignAuditReport,
  validateCampaign: () => validateCampaign
});
function validateSchema(typeName, value, label) {
  let validator = schemaValidators.get(typeName);
  if (!validator) {
    validator = ajv.compile({ $ref: `${schema.$id}#/$defs/${typeName}` });
    schemaValidators.set(typeName, validator);
  }
  if (validator(value)) return [];
  return (validator.errors ?? []).map((error) => {
    const at = error.instancePath || "/";
    return `\u0421\u0445\u0435\u043C\u0430 ${label}${at}: ${error.message ?? "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u043D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u043E"}`;
  });
}
function validatePackageSchema(store) {
  const issues = [
    ...validateSchema("CampaignMeta", store.meta, "campaign.json"),
    ...validateSchema("WorldDef", store.world, "world.json"),
    ...validateSchema("CampaignManifest", store.manifest, "manifest.json")
  ];
  const buckets = [
    [store.manifest.scenes, "scenes", "SceneDef"],
    [store.manifest.entities, "entities", "EntityDef"],
    [store.manifest.rules, "rules", "RuleDef"],
    [store.manifest.arenas ?? [], "arenas", "ArenaDef"],
    [store.manifest.quests ?? [], "quests", "QuestDef"],
    [store.manifest.cutscenes ?? [], "cutscenes", "CutsceneDef"],
    [store.manifest.recipes ?? [], "recipes", "RecipeDef"],
    [store.manifest.codex ?? [], "codex", "CodexEntryDef"]
  ];
  for (const [files, folder, typeName] of buckets) {
    for (const filename of files) {
      const path = `${folder}/${filename}`;
      issues.push(...validateSchema(typeName, store.jsonFiles.get(path), path));
    }
  }
  for (const filename of store.manifest.encounters ?? []) {
    const raw = store.jsonFiles.get(`encounters/${filename}`) ?? store.jsonFiles.get(`rules/${filename}`);
    const path = store.jsonFiles.has(`encounters/${filename}`) ? `encounters/${filename}` : `rules/${filename}`;
    issues.push(...validateSchema("EncounterFileDef", raw, path));
  }
  for (const filename of store.manifest.dialogues ?? []) {
    const path = `dialogues/${filename.replace(/\\.ink$/, ".dlg.json")}`;
    const doc = store.jsonFiles.get(path);
    if (doc) issues.push(...validateSchema("DlgDoc", doc, path));
  }
  return issues;
}
function isExternal(path) {
  return /^(?:https?:)?\/\//i.test(path);
}
function mediaType(path) {
  const clean = path.split(/[?#]/, 1)[0].toLowerCase();
  if (/\.(?:png|jpe?g|gif|svg|webp|avif)$/.test(clean)) return "\u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435";
  if (/\.(?:aac|flac|m4a|mp3|ogg|opus|wav)$/.test(clean)) return "\u0430\u0443\u0434\u0438\u043E";
  if (/\.(?:mp4|mov|webm)$/.test(clean)) return "\u0432\u0438\u0434\u0435\u043E";
  return "\u0448\u0440\u0438\u0444\u0442";
}
function expectedMime(path) {
  const clean = path.split(/[?#]/, 1)[0].toLowerCase();
  if (/\.jpe?g$/.test(clean)) return "image/jpeg";
  if (/\.png$/.test(clean)) return "image/png";
  if (/\.webp$/.test(clean)) return "image/webp";
  if (/\.svg$/.test(clean)) return "image/svg+xml";
  if (/\.avif$/.test(clean)) return "image/avif";
  if (/\.(?:aac)$/.test(clean)) return "audio/aac";
  if (/\.(?:mp3)$/.test(clean)) return "audio/mpeg";
  if (/\.(?:m4a)$/.test(clean)) return "audio/mp4";
  if (/\.(?:ogg|opus)$/.test(clean)) return "audio/ogg";
  if (/\.(?:wav)$/.test(clean)) return "audio/wav";
  if (/\.(?:mp4)$/.test(clean)) return "video/mp4";
  if (/\.(?:webm)$/.test(clean)) return "video/webm";
  if (/\.(?:woff2?)$/.test(clean)) return `font/woff${clean.endsWith(".woff2") ? "2" : ""}`;
  if (/\.ttf$/.test(clean)) return "font/ttf";
  if (/\.otf$/.test(clean)) return "font/otf";
  return void 0;
}
function collectCampaignMedia(store) {
  const local = /* @__PURE__ */ new Set();
  const external = /* @__PURE__ */ new Set();
  const visit = (value) => {
    if (typeof value === "string") {
      const path = value.trim();
      if (!MEDIA_EXTENSION.test(path)) return;
      if (isExternal(path)) external.add(path);
      else if (!/^(?:data|blob):/i.test(path)) local.add(path.split(/[?#]/, 1)[0].replace(/^\.\//, ""));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach(visit);
    }
  };
  visit(store.meta);
  visit(store.world);
  for (const value of store.jsonFiles.values()) visit(value);
  for (const text of store.textFiles.values()) {
    for (const match of text.matchAll(/["']([^"'\r\n]+\.(?:avif|gif|jpe?g|png|svg|webp|aac|flac|m4a|mp3|ogg|opus|wav|mp4|mov|webm|otf|ttf|woff2?)(?:[?#][^"'\r\n]*)?)["']/gi)) {
      const path = match[1].trim();
      if (isExternal(path)) external.add(path);
      else local.add(path.split(/[?#]/, 1)[0].replace(/^\.\//, ""));
    }
    for (const match of text.matchAll(/#\s*(?:voice|sfx|music|ambient|sound|audio)\s*:\s*([^\s\r\n]+\.(?:avif|gif|jpe?g|png|svg|webp|aac|flac|m4a|mp3|ogg|opus|wav|mp4|mov|webm|otf|ttf|woff2?))/gi)) {
      const path = match[1].trim();
      if (isExternal(path)) external.add(path);
      else local.add(path.split(/[?#]/, 1)[0].replace(/^\.\//, ""));
    }
    for (const match of text.matchAll(/\b(assets\/[^\s"'\r\n,;)]+\.(?:avif|gif|jpe?g|png|svg|webp|aac|flac|m4a|mp3|ogg|opus|wav|mp4|mov|webm|otf|ttf|woff2?))/gi)) {
      const path = match[1].trim();
      if (isExternal(path)) external.add(path);
      else local.add(path.split(/[?#]/, 1)[0].replace(/^\.\//, ""));
    }
  }
  return { local: [...local].sort(), external: [...external].sort() };
}
function campaignContentHash(store) {
  const content = store.allPaths().sort().map((path) => `${path}
${store.fileText(path)}`).join("\n\0\n");
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
async function inspectLocalMedia(store, paths) {
  return Promise.all(paths.map(async (path) => {
    if (!path || path.startsWith("/") || path.includes("\\") || path.split("/").includes("..")) {
      return { severity: "error", message: `\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u043F\u0443\u0442\u044C \u043C\u0435\u0434\u0438\u0430: \xAB${path}\xBB. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u043F\u0443\u0442\u044C \u0432\u043D\u0443\u0442\u0440\u0438 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438.` };
    }
    try {
      const url = `${store.basePath}/${path.split("/").map(encodeURIComponent).join("/")}`;
      let response = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (response.status === 405 || response.status === 501) response = await fetch(url, { method: "GET", cache: "no-store" });
      if (!response.ok || (response.headers.get("content-type") ?? "").toLowerCase().includes("text/html")) {
        return { severity: "error", message: `\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D ${mediaType(path)} \xAB${path}\xBB.` };
      }
      const actualMime = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      const expected = expectedMime(path);
      if (expected && actualMime && actualMime !== expected && actualMime !== "application/octet-stream") {
        return { severity: "warning", message: `\u0424\u0430\u0439\u043B \xAB${path}\xBB \u043E\u0442\u0434\u0430\u0451\u0442\u0441\u044F \u043A\u0430\u043A ${actualMime}, \u043E\u0436\u0438\u0434\u0430\u043B\u0441\u044F ${expected}; \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0432\u043E\u0441\u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u0435.` };
      }
      if (actualMime === "application/octet-stream") {
        return { severity: "warning", message: `\u0424\u0430\u0439\u043B \xAB${path}\xBB \u043E\u0442\u0434\u0430\u0451\u0442\u0441\u044F \u043A\u0430\u043A \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0431\u0438\u043D\u0430\u0440\u043D\u044B\u0439 \u0442\u0438\u043F; \u043F\u043B\u0435\u0435\u0440 \u043C\u043E\u0436\u0435\u0442 \u043D\u0435 \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u0442\u044C \u0444\u043E\u0440\u043C\u0430\u0442.` };
      }
      return { severity: "info", message: `\u0424\u0430\u0439\u043B \u043D\u0430\u0439\u0434\u0435\u043D: ${path}` };
    } catch {
      return { severity: "error", message: `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C ${mediaType(path)} \xAB${path}\xBB.` };
    }
  }));
}
function alphaRolePaths(store) {
  const out = [];
  const art = store.meta.theme?.menu?.title_art;
  if (art) out.push({ path: art, role: "\u044D\u043C\u0431\u043B\u0435\u043C\u0430 \u043C\u0435\u043D\u044E (theme.menu.title_art) \u043B\u0435\u0436\u0438\u0442 \u043F\u043E\u0432\u0435\u0440\u0445 \u0444\u043E\u043D\u0430 \u043C\u0435\u043D\u044E" });
  const frameImg = store.meta.theme?.frame?.image;
  if (frameImg) out.push({ path: frameImg, role: "\u0440\u0430\u043C\u043A\u0430 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 (theme.frame.image) \u043E\u0431\u0440\u0430\u043C\u043B\u044F\u0435\u0442 \u043E\u043A\u043D\u0430" });
  for (const atm of store.meta.atmospherics ?? []) {
    if (atm.sprite) out.push({ path: atm.sprite, role: `\u0441\u043F\u0440\u0430\u0439\u0442 \u0430\u0442\u043C\u043E\u0441\u0444\u0435\u0440\u043D\u043E\u0439 \u0447\u0430\u0441\u0442\u0438\u0446\u044B \xAB${atm.label || atm.id}\xBB` });
  }
  for (const p of store.entityPaths()) {
    const e = store.entity(p);
    const spr = typeof e.scene_sprite === "string" ? e.scene_sprite : void 0;
    if (spr) out.push({ path: spr, role: `\u0441\u043F\u0440\u0430\u0439\u0442 \u0432 \u0441\u0446\u0435\u043D\u0435 \xAB${e.label}\xBB \u0441\u0442\u043E\u0438\u0442 \u0432 \u0441\u043B\u043E\u0442\u0435 \u043F\u043E\u0432\u0435\u0440\u0445 \u0444\u043E\u043D\u0430 \u0441\u0446\u0435\u043D\u044B` });
    if ("scene_sprite_states" in e && e.scene_sprite_states) {
      for (const [st, img] of Object.entries(e.scene_sprite_states)) {
        if (typeof img === "string") out.push({ path: img, role: `\u0441\u043F\u0440\u0430\u0439\u0442 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F \xAB${st}\xBB \u0432 \u0441\u0446\u0435\u043D\u0435 \xAB${e.label}\xBB` });
      }
    }
    const fig = "combat_figure" in e && typeof e.combat_figure === "string" ? e.combat_figure : void 0;
    if (fig) out.push({ path: fig, role: `\u0444\u0438\u0433\u0443\u0440\u043A\u0430 \u0431\u043E\u044F \xAB${e.label}\xBB \u0441\u0442\u043E\u0438\u0442 \u043F\u043E\u0432\u0435\u0440\u0445 \u0430\u0440\u0435\u043D\u044B` });
  }
  return out;
}
async function inspectAlphaRoles(store) {
  const findings = [];
  for (const { path, role } of alphaRolePaths(store)) {
    if (isExternal(path) || path.startsWith("data:") || path.startsWith("blob:")) continue;
    try {
      const url = `${store.basePath}/${path.split("/").map(encodeURIComponent).join("/")}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const bmp = await createImageBitmap(await res.blob());
      const w = bmp.width;
      const h = bmp.height;
      if (!w || !h) continue;
      const ctx = new OffscreenCanvas(w, h).getContext("2d", { willReadFrequently: true });
      if (!ctx) continue;
      ctx.drawImage(bmp, 0, 0);
      const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
      const opaque = corners.every(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3] === 255);
      bmp.close?.();
      if (opaque) {
        findings.push({
          severity: "warning",
          message: `\xAB${path}\xBB: ${role}, \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u044B\u0439 \u0444\u043E\u043D (PNG \u0441 \u0430\u043B\u044C\u0444\u043E\u0439); \u0443 \u0444\u0430\u0439\u043B\u0430 \u043D\u0435\u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u044B\u0435 \u0443\u0433\u043B\u044B \u2014 \u043F\u043E\u0445\u043E\u0436\u0435 \u043D\u0430 \u0444\u043E\u043D-\u043F\u043E\u0434\u043B\u043E\u0436\u043A\u0443 \u0438\u043B\u0438 \u043D\u0430\u0440\u0438\u0441\u043E\u0432\u0430\u043D\u043D\u0443\u044E \u0448\u0430\u0445\u043C\u0430\u0442\u043A\u0443. \u0421\u0433\u0435\u043D\u0435\u0440\u0438\u0440\u0443\u0439\u0442\u0435 \u043D\u0430 \u0445\u0440\u043E\u043C\u0430\u043A\u0435\u0435 \u0438 \u0432\u044B\u0440\u0435\u0436\u044C\u0442\u0435: python3 scripts/cutout-chromakey.py "${path}"`
        });
      }
    } catch {
      findings.push({
        severity: "warning",
        message: `\xAB${path}\xBB: ${role}, \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u044B\u0439 \u0444\u043E\u043D, \u043D\u043E \u0443\u0433\u043B\u044B \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u2014 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u043D\u0435 \u0434\u0435\u043A\u043E\u0434\u0438\u0440\u0443\u0435\u0442\u0441\u044F (\u0431\u0438\u0442\u044B\u0439 \u0444\u0430\u0439\u043B \u0438\u043B\u0438 \u0444\u043E\u0440\u043C\u0430\u0442 \u0432\u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438). \u041A\u043E\u043D\u0432\u0435\u0440\u0442\u0438\u0440\u0443\u0439\u0442\u0435 \u0432 PNG 8-\u0431\u0438\u0442 \u0431\u0435\u0437 \u0438\u043D\u0442\u0435\u0440\u043B\u0435\u0439\u0441\u0430 \u0438 \u043F\u0435\u0440\u0435\u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435.`
      });
    }
  }
  return findings;
}
async function validateCampaign(store, lastPlaytest) {
  let structure = [];
  try {
    structure.push(...store.validateContent().map((message) => ({ severity: "error", message })));
  } catch (error) {
    structure.push({ severity: "error", message: `\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0441\u0441\u044B\u043B\u043E\u043A \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B\u0430\u0441\u044C \u043E\u0448\u0438\u0431\u043A\u043E\u0439: ${String(error)}` });
  }
  try {
    structure.push(...validatePackageSchema(store).map((message) => ({ severity: "error", message })));
  } catch (error) {
    structure.push({ severity: "error", message: `\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 JSON Schema \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B\u0430\u0441\u044C \u043E\u0448\u0438\u0431\u043A\u043E\u0439: ${String(error)}` });
  }
  if (store.meta.char_creation) {
    structure.push(...charCreationTemplateFindings(store.meta.char_creation).map((message) => ({
      severity: "warning",
      message: `\u0428\u0430\u0431\u043B\u043E\u043D \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430: ${message}`
    })));
  }
  for (const f of store.meta.flags ?? []) {
    if (!f.description?.trim()) {
      structure.push({
        severity: "warning",
        message: `\u0424\u043B\u0430\u0433 \xAB${f.label}\xBB: \u043D\u0435 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043E \u043F\u043E\u043B\u0435 \xAB\u0414\u043B\u044F \u0447\u0435\u0433\u043E \u043D\u0443\u0436\u0435\u043D\xBB \u2014 \u0431\u0435\u0437 \u043D\u0435\u0433\u043E \u043D\u0435\u043F\u043E\u043D\u044F\u0442\u043D\u043E, \u043A\u0430\u043A\u043E\u0435 \u0441\u043E\u0431\u044B\u0442\u0438\u0435 \u0437\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u0435\u0442 \u0444\u043B\u0430\u0433 \u0438 \u0433\u0434\u0435 \u043E\u043D \u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F.`
      });
    }
  }
  if (store.meta.camping && featureOn(store.meta, "needs") && (store.meta.needs?.length ?? 0) > 0 && !store.meta.camping.restore && !store.meta.camping.per_tick?.length) {
    structure.push({
      severity: "warning",
      message: '\u041B\u0430\u0433\u0435\u0440\u044C \u0432\u043A\u043B\u044E\u0447\u0451\u043D (meta.camping), \u043D\u0443\u0436\u0434\u044B \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u044B, \u043D\u043E \u043D\u0438 meta.camping.restore, \u043D\u0438 meta.camping.per_tick \u043D\u0435 \u0437\u0430\u0434\u0430\u043D\u044B: \u043D\u043E\u0447\u043B\u0435\u0433 \u0445\u043E\u0434\u0438\u0442 \u0432\u0440\u0435\u043C\u044F, \u043B\u0435\u0447\u0438\u0442 \u0440\u0430\u043D\u044B \u0438 \u0440\u0430\u0441\u0442\u0438\u0442 \u043D\u0430\u0432\u044B\u043A\u0438, \u043D\u043E \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0438 (\u0432 \u0442.\u0447. \u043E\u0442\u0434\u044B\u0445) \u043D\u0435 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u0442. \u0415\u0441\u043B\u0438 \u0441\u043E\u043D \u0434\u043E\u043B\u0436\u0435\u043D \u0432\u043E\u0441\u043F\u043E\u043B\u043D\u044F\u0442\u044C \u2014 \u0437\u0430\u0434\u0430\u0439\u0442\u0435 \u0432 \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u0435 restore, \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 { "need_rest": 100 }, \u043B\u0438\u0431\u043E \u043F\u043E\u0447\u0430\u0441\u043E\u0432\u043E\u0435 per_tick (\u0437\u0430 \u043A\u0430\u0436\u0434\u044B\u0439 \u0447\u0430\u0441 \u0441\u043D\u0430), \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 change_need "+12"; \u0435\u0441\u043B\u0438 \u0437\u0430\u0434\u0443\u043C\u0430\u043D\u043E, \u0447\u0442\u043E \u043B\u0430\u0433\u0435\u0440\u044C \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0435\u0440\u0435\u0434\u044B\u0448\u043A\u0430, \u0438\u0433\u043D\u043E\u0440\u0438\u0440\u0443\u0439\u0442\u0435 \u044D\u0442\u043E \u043F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0435.'
    });
  }
  {
    const TICK_WHITELIST = /* @__PURE__ */ new Set(["change_need", "change_hp", "change_fatigue", "change_sanity"]);
    const acts = store.meta.duration_actions ?? [];
    const ruleIds = new Set(store.options("rule").map((o) => o.id));
    const seen = /* @__PURE__ */ new Set();
    for (const a of acts) {
      if (!a.id || seen.has(a.id)) {
        structure.push({ severity: "error", message: `\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435: \u043F\u0443\u0441\u0442\u043E\u0439 \u0438\u043B\u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u044E\u0449\u0438\u0439\u0441\u044F id \xAB${a.id}\xBB \u2014 \u0441\u0441\u044B\u043B\u043A\u0438 \u0438\u0437 \u044D\u0444\u0444\u0435\u043A\u0442\u0430 \xAB\u041D\u0430\u0447\u0430\u0442\u044C \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435\xBB \u043D\u0435\u043E\u0442\u043B\u0438\u0447\u0438\u043C\u044B.` });
      }
      seen.add(a.id);
      const minT = a.min_ticks ?? 1;
      const maxT = a.max_ticks ?? minT;
      if (maxT < minT) {
        structure.push({ severity: "error", message: `\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \xAB${a.label || a.id}\xBB: max_ticks (${maxT}) \u043C\u0435\u043D\u044C\u0448\u0435 min_ticks (${minT}) \u2014 \u0438\u0433\u0440\u043E\u043A \u043D\u0435 \u0441\u043C\u043E\u0436\u0435\u0442 \u0435\u0433\u043E \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C.` });
      }
      if (a.interrupt_rule && !ruleIds.has(a.interrupt_rule)) {
        structure.push({ severity: "warning", message: `\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \xAB${a.label || a.id}\xBB: \u043F\u0440\u0430\u0432\u0438\u043B\u043E \u043F\u0440\u0435\u0440\u044B\u0432\u0430\u043D\u0438\u044F \xAB${a.interrupt_rule}\xBB \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E \u0432 \u0440\u0435\u0435\u0441\u0442\u0440\u0435 \u043F\u0440\u0430\u0432\u0438\u043B.` });
      }
      if ((a.interrupt_chance_per_tick ?? 0) > 0 && !a.interrupt_rule) {
        structure.push({ severity: "warning", message: `\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \xAB${a.label || a.id}\xBB: \u0437\u0430\u0434\u0430\u043D \u0448\u0430\u043D\u0441 \u043F\u0440\u0435\u0440\u044B\u0432\u0430\u043D\u0438\u044F, \u043D\u043E \u043D\u0435 \u0437\u0430\u0434\u0430\u043D\u043E \u043F\u0440\u0430\u0432\u0438\u043B\u043E \u043F\u0440\u0435\u0440\u044B\u0432\u0430\u043D\u0438\u044F \u2014 \u0441\u043E\u043D \u043F\u0440\u043E\u0441\u0442\u043E \u043E\u0431\u043E\u0440\u0432\u0451\u0442\u0441\u044F \u0431\u0435\u0437 \u0441\u043E\u0431\u044B\u0442\u0438\u044F. \u0415\u0441\u043B\u0438 \u0442\u0430\u043A \u0437\u0430\u0434\u0443\u043C\u0430\u043D\u043E, \u0438\u0433\u043D\u043E\u0440\u0438\u0440\u0443\u0439\u0442\u0435.` });
      }
      for (const fx of a.per_tick ?? []) {
        if (!TICK_WHITELIST.has(fx.type)) {
          structure.push({ severity: "error", message: `\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \xAB${a.label || a.id}\xBB: \u043F\u043E\u0447\u0430\u0441\u043E\u0432\u043E\u0439 \u044D\u0444\u0444\u0435\u043A\u0442 \xAB${fx.type}\xBB \u0432\u043D\u0435 \u0431\u0435\u043B\u043E\u0433\u043E \u0441\u043F\u0438\u0441\u043A\u0430 (\u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u044B change_need, change_hp, change_fatigue, change_sanity) \u2014 \u0434\u0432\u0438\u0436\u043E\u043A \u0435\u0433\u043E \u043F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u0442. \u0412\u044B\u043D\u0435\u0441\u0438\u0442\u0435 \u0435\u0433\u043E \u0432 on_finish, \u0435\u0441\u043B\u0438 \u043E\u043D \u043D\u0443\u0436\u0435\u043D \u043F\u043E \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0438.` });
        }
      }
      if (a.per_tick?.some((fx) => fx.type === "change_need" && !store.meta.needs?.some((n) => n.id === fx.need))) {
        structure.push({ severity: "warning", message: `\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \xAB${a.label || a.id}\xBB: \u043F\u043E\u0447\u0430\u0441\u043E\u0432\u043E\u0439 \u044D\u0444\u0444\u0435\u043A\u0442 \u0441\u0441\u044B\u043B\u0430\u0435\u0442\u0441\u044F \u043D\u0430 \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u044C, \u043A\u043E\u0442\u043E\u0440\u043E\u0439 \u043D\u0435\u0442 \u0432 \u0440\u0435\u0435\u0441\u0442\u0440\u0435 \u043D\u0443\u0436\u0434 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438.` });
      }
    }
    if (store.meta.camping) {
      const campMin = store.meta.camping.min_ticks ?? store.meta.camping.ticks ?? 8;
      const campMax = store.meta.camping.max_ticks ?? store.meta.camping.ticks ?? 8;
      if (campMax < campMin) {
        structure.push({ severity: "error", message: `\u041B\u0430\u0433\u0435\u0440\u044C: max_ticks (${campMax}) \u043C\u0435\u043D\u044C\u0448\u0435 min_ticks (${campMin}) \u2014 \u043D\u043E\u0447\u043B\u0435\u0433 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D.` });
      }
      for (const fx of store.meta.camping.per_tick ?? []) {
        if (!TICK_WHITELIST.has(fx.type)) {
          structure.push({ severity: "error", message: `\u041B\u0430\u0433\u0435\u0440\u044C: \u043F\u043E\u0447\u0430\u0441\u043E\u0432\u043E\u0439 \u044D\u0444\u0444\u0435\u043A\u0442 \xAB${fx.type}\xBB \u0432\u043D\u0435 \u0431\u0435\u043B\u043E\u0433\u043E \u0441\u043F\u0438\u0441\u043A\u0430 (\u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u044B change_need, change_hp, change_fatigue, change_sanity) \u2014 \u0434\u0432\u0438\u0436\u043E\u043A \u0435\u0433\u043E \u043F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u0442.` });
        }
      }
    }
  }
  const registries = [
    { what: "\u043D\u0430\u0432\u044B\u043A\u0438", items: store.meta.skills },
    { what: "\u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \u043D\u0430\u0432\u044B\u043A\u043E\u0432", items: store.meta.skill_categories },
    { what: "\u043F\u0440\u0435\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u044F", items: store.meta.crimes },
    { what: "\u0446\u0435\u043D\u043E\u0432\u044B\u0435 \u0441\u043E\u0431\u044B\u0442\u0438\u044F", items: store.meta.price_events },
    { what: "\u0444\u043B\u0430\u0433\u0438", items: store.meta.flags },
    { what: "\u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F", items: store.meta.statuses },
    { what: "\u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0438", items: store.meta.needs },
    { what: "\u0444\u0440\u0430\u043A\u0446\u0438\u0438", items: store.meta.factions },
    { what: "\u0441\u0442\u0440\u0430\u0441\u0442\u0438", items: store.meta.passions_list },
    { what: "\u043F\u0440\u0438\u0432\u0435\u0440\u0436\u0435\u043D\u043D\u043E\u0441\u0442\u0438", items: store.meta.allegiances },
    { what: "\u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432", items: store.meta.item_categories }
  ];
  for (const reg of registries) {
    for (const item of reg.items ?? []) {
      const label = (item.label ?? "").trim();
      if (!label) continue;
      const codeLike = label.includes("=") || label.includes("*") || label === item.id || /^[a-z0-9_]+$/.test(label) && label.includes("_");
      if (codeLike) {
        structure.push({
          severity: "warning",
          message: `\u041F\u043E\u0434\u043F\u0438\u0441\u044C \u0432 \u0440\u0435\u0435\u0441\u0442\u0440\u0435 (${reg.what}) \xAB${label}\xBB \u043F\u043E\u0445\u043E\u0436\u0430 \u043D\u0430 \u0441\u043B\u0443\u0436\u0435\u0431\u043D\u044B\u0439 \u043A\u043E\u0434: \u0435\u0451 \u0447\u0438\u0442\u0430\u0435\u0442 \u0447\u0435\u043B\u043E\u0432\u0435\u043A \u2014 \u0438 \u043C\u0430\u0441\u0442\u0435\u0440 \u0432 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0435, \u0438 \u0438\u0433\u0440\u043E\u043A \u0432 \u0438\u0433\u0440\u0435. \u041D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043E\u0431\u044B\u0447\u043D\u044B\u043C\u0438 \u0441\u043B\u043E\u0432\u0430\u043C\u0438, \u0441\u043B\u0443\u0436\u0435\u0431\u043D\u043E\u0435 \u0438\u043C\u044F \u043F\u043E\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u0441\u044F \u0441\u0430\u043C\u043E.`
        });
      }
    }
  }
  const flagInternal = (f) => f.startsWith("known_") || f.startsWith("npc_known_") || f.startsWith("scene_state:");
  const flagUses = /* @__PURE__ */ new Map();
  const noteFlag = (f, where) => {
    if (!flagUses.has(f)) flagUses.set(f, where);
  };
  for (const [path, text] of store.textFiles) {
    if (!/^dialogues\/.+\.ink$/.test(path)) continue;
    for (const m of text.matchAll(/~\s*(?:set_flag|clear_flag)\(\s*"([^"]+)"/g)) noteFlag(m[1], path);
  }
  const walkFlags = (value, where) => {
    if (Array.isArray(value)) {
      for (const item of value) walkFlags(item, where);
      return;
    }
    if (value && typeof value === "object") {
      const rec = value;
      if ((rec.type === "set_flag" || rec.type === "clear_flag") && typeof rec.flag === "string") noteFlag(rec.flag, where);
      for (const item of Object.values(rec)) walkFlags(item, where);
    }
  };
  walkFlags(store.meta, "campaign.json");
  walkFlags(store.world, "world.json");
  for (const [path, doc] of store.jsonFiles) walkFlags(doc, path);
  const flagRegistry = new Set((store.meta.flags ?? []).map((f) => f.id));
  const flagOrphans = [...flagUses].filter(([f]) => !flagRegistry.has(f) && !flagInternal(f));
  if (flagOrphans.length) {
    const shown = flagOrphans.slice(0, 6).map(([f, where]) => `\xAB${f}\xBB (${where})`).join(", ");
    structure.push({
      severity: "error",
      message: `\u0424\u043B\u0430\u0433\u0438 \u0441\u0442\u0430\u0432\u044F\u0442\u0441\u044F \u0432 ink/\u044D\u0444\u0444\u0435\u043A\u0442\u0430\u0445, \u043D\u043E \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u0432 \u0440\u0435\u0435\u0441\u0442\u0440\u0435 meta.flags: ${shown}${flagOrphans.length > 6 ? ` \u0438 \u0435\u0449\u0451 ${flagOrphans.length - 6}` : ""}. \u0424\u043B\u0430\u0433 \u0432\u043D\u0435 \u0440\u0435\u0435\u0441\u0442\u0440\u0430 \u043D\u0435 \u0438\u043C\u0435\u0435\u0442 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u044F \xAB\u0434\u043B\u044F \u0447\u0435\u0433\u043E \u043D\u0443\u0436\u0435\u043D\xBB \u0438 \u043D\u0435 \u0432\u0438\u0434\u0435\u043D \u043C\u0430\u0441\u0442\u0435\u0440\u0443 \u0432 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0435. \u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0435\u0433\u043E \u0432 \u0440\u0435\u0435\u0441\u0442\u0440 \u0444\u043B\u0430\u0433\u043E\u0432 (\u041F\u0430\u0441\u043F\u043E\u0440\u0442 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438) \u0441 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u0438\u0435\u043C \u2014 \u0442\u0430\u043A \u0436\u0435 \u043A\u0430\u043A \u0434\u0435\u043B\u0430\u0435\u0442 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 \u0434\u0438\u0430\u043B\u043E\u0433\u043E\u0432 \u043F\u0440\u0438 \u043F\u0435\u0440\u0432\u043E\u043C \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0438.`
    });
  }
  for (const [path, text] of store.textFiles) {
    if (!/^dialogues\/.+\.ink$/.test(path)) continue;
    const declared = new Set([...text.matchAll(/^\s*EXTERNAL\s+([A-Za-z_][A-Za-z0-9_]*)/gm)].map((m) => m[1]));
    const missing = /* @__PURE__ */ new Set();
    for (const m of text.matchAll(/^\s*~\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm)) {
      const fn = m[1];
      if (ENGINE_INK_FNS.has(fn) && !declared.has(fn)) missing.add(fn);
    }
    for (const m of text.matchAll(/\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
      const fn = m[1];
      if (ENGINE_INK_FNS.has(fn) && !declared.has(fn)) missing.add(fn);
    }
    if (missing.size) {
      structure.push({
        severity: "error",
        message: `${path}: \u0432\u044B\u0437\u043E\u0432\u044B \u0431\u0435\u0437 \u043E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u0438\u044F EXTERNAL \u2014 ${[...missing].join(", ")}. inkjs \u043D\u0435 \u0441\u043A\u043E\u043C\u043F\u0438\u043B\u0438\u0440\u0443\u0435\u0442 \u0444\u0430\u0439\u043B, \u0438 \u0434\u0438\u0430\u043B\u043E\u0433 \u043D\u0435 \u043E\u0442\u043A\u0440\u043E\u0435\u0442\u0441\u044F. \u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0432 \u043D\u0430\u0447\u0430\u043B\u043E \u0444\u0430\u0439\u043B\u0430 \u0441\u0442\u0440\u043E\u043A\u0438 \u0432\u0438\u0434\u0430 \xABEXTERNAL ${[...missing][0]}(a0)\xBB (\u0447\u0438\u0441\u043B\u043E \u0430\u0440\u0433\u0443\u043C\u0435\u043D\u0442\u043E\u0432 \u2014 \u043A\u0430\u043A \u0432 \u0432\u044B\u0437\u043E\u0432\u0435).`
      });
    }
  }
  for (const [path, text] of store.textFiles) {
    if (!/^dialogues\/.+\.ink$/.test(path)) continue;
    const knots = new Set([...text.matchAll(/^===\s*([^\s=]+)\s*===/gm)].map((m) => m[1]));
    for (const m of text.matchAll(/set_dialogue_timer\(\s*(\d+)\s*(?:,\s*"([^"]*)")?\s*\)/g)) {
      const secs = Number(m[1]);
      const knot = m[2] ?? "";
      if (secs > 0 && secs < 5) {
        structure.push({
          severity: "warning",
          message: `${path}: \u0442\u0430\u0439\u043C\u0435\u0440 \u043D\u0430 \u0440\u0430\u0437\u0434\u0443\u043C\u044C\u0435 \u2014 ${secs} \u0441. \u042D\u0442\u043E \u043C\u0435\u043D\u044C\u0448\u0435 5 \u0441\u0435\u043A\u0443\u043D\u0434: \u0438\u0433\u0440\u043E\u043A \u043D\u0435 \u0443\u0441\u043F\u0435\u0432\u0430\u0435\u0442 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u044B \u043E\u0442\u0432\u0435\u0442\u0430. \u0412\u043E\u0437\u044C\u043C\u0438\u0442\u0435 8\u201315 \u0441\u0435\u043A\u0443\u043D\u0434 \u0438\u043B\u0438 \u0443\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0430\u0439\u043C\u0435\u0440.`
        });
      }
      if (knot && !knots.has(knot)) {
        structure.push({
          severity: "warning",
          message: `${path}: \u0442\u0430\u0439\u043C\u0435\u0440 \u0432\u0435\u0434\u0451\u0442 \u0432 \u0443\u0437\u0435\u043B \xAB${knot}\xBB, \u043A\u043E\u0442\u043E\u0440\u043E\u0433\u043E \u0432 \u0444\u0430\u0439\u043B\u0435 \u043D\u0435\u0442. \u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \xAB=== ${knot} ===\xBB \u0438\u043B\u0438 \u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u0432\u0442\u043E\u0440\u043E\u0439 \u0430\u0440\u0433\u0443\u043C\u0435\u043D\u0442 \u043F\u0443\u0441\u0442\u044B\u043C ("" \u2014 \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440 \u0437\u0430\u043A\u0430\u043D\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F).`
        });
      }
    }
  }
  for (const [path, text] of store.textFiles) {
    if (!/^dialogues\/.+\.ink$/.test(path)) continue;
    const bad = text.split("\n").filter((l) => /^\s*\+\s*\[[^\]]*\]\s*\{/.test(l)).length;
    if (bad) {
      structure.push({
        severity: "warning",
        message: `${path}: \u0443\u0441\u043B\u043E\u0432\u0438\u0439 \u043F\u043E\u0441\u043B\u0435 \u043A\u0432\u0430\u0434\u0440\u0430\u0442\u043D\u044B\u0445 \u0441\u043A\u043E\u0431\u043E\u043A \u0432\u044B\u0431\u043E\u0440\u0430 \u2014 ${bad}. inkjs \u043C\u043E\u0436\u0435\u0442 \u043D\u0430\u043F\u0435\u0447\u0430\u0442\u0430\u0442\u044C \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u0441\u0442\u0440\u043E\u043A\u043E\u0439 \u0432 \u0434\u0438\u0430\u043B\u043E\u0433\u0435; \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0438\u0442\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u0435 \u043F\u0435\u0440\u0435\u0434 \u0441\u043A\u043E\u0431\u043A\u0430\u043C\u0438: \xAB+ { \u0443\u0441\u043B\u043E\u0432\u0438\u0435 } [\u0442\u0435\u043A\u0441\u0442]\xBB.`
      });
    }
  }
  for (const p of store.rulePaths()) {
    const r = store.rule(p);
    if (!Array.isArray(r.conditions) || !Array.isArray(r.effects)) {
      structure.push({
        severity: "error",
        message: `\u041F\u0440\u0430\u0432\u0438\u043B\u043E \xAB${r.label ?? r.id}\xBB (${p}): \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u043C\u0430\u0441\u0441\u0438\u0432\u044B conditions/effects \u2014 \u043F\u0440\u0430\u0432\u0438\u043B\u043E \u0441\u043B\u043E\u043C\u0430\u0435\u0442 \u0434\u0432\u0438\u0436\u043E\u043A \u043F\u0440\u0438 \u0441\u0442\u0430\u0440\u0442\u0435.`
      });
    }
    const hasIntroCutscene = (r.effects ?? []).some((e) => e.type === "play_cutscene");
    const hasZeroTick = (r.conditions ?? []).some((c) => c.type === "tick_elapsed" && c.min_tick === 0);
    if ((hasZeroTick || hasIntroCutscene) && r.trigger === "time_tick") {
      structure.push({
        severity: "warning",
        message: `\u041F\u0440\u0430\u0432\u0438\u043B\u043E \xAB${r.label ?? r.id}\xBB (${p}): \u0432\u0441\u0442\u0443\u043F\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u043F\u0440\u0430\u0432\u0438\u043B\u043E \u0438\u043C\u0435\u0435\u0442 \u0441\u043E\u0431\u044B\u0442\u0438\u0439\u043D\u044B\u0439 \u0442\u0440\u0438\u0433\u0433\u0435\u0440 \xABtime_tick\xBB. \u0427\u0442\u043E\u0431\u044B \u043A\u0430\u0442\u0441\u0446\u0435\u043D\u0430 \u0438 \u043F\u0440\u043E\u043B\u043E\u0433 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u043B\u0438\u0441\u044C \u0441\u0440\u0430\u0437\u0443 \u043F\u0440\u0438 \u0441\u0442\u0430\u0440\u0442\u0435 \u043D\u043E\u0432\u043E\u0439 \u0438\u0433\u0440\u044B, \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0440\u0438\u0433\u0433\u0435\u0440 \xABalways\xBB (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E) \u0438\u043B\u0438 \u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u043F\u043E\u043B\u0435 \u043F\u0443\u0441\u0442\u044B\u043C.`
      });
    }
  }
  const declaredSounds = new Set((store.meta.sounds ?? []).map((s) => s.id));
  const BUILTIN_SOUNDS = /* @__PURE__ */ new Set([
    "click",
    "travel",
    "craft",
    "message",
    "open",
    "use",
    "drop",
    "equip",
    "unequip",
    "dialogue_present",
    "travel_depart",
    "travel_arrive",
    "panel_open",
    "panel_close",
    "panel:open",
    "panel:close"
  ]);
  const checkSoundRef = (soundId, context) => {
    if (!soundId) return;
    const id = soundId.trim();
    if (!id || /^(?:https?:|\/|\.\/|assets\/)/i.test(id)) return;
    if (!declaredSounds.has(id) && !BUILTIN_SOUNDS.has(id)) {
      structure.push({
        severity: "warning",
        message: `${context}: \u0437\u0432\u0443\u043A \xAB${id}\xBB \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0432 \u0440\u0435\u0435\u0441\u0442\u0440\u0435 meta.sounds \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 (\u043E\u043F\u0435\u0447\u0430\u0442\u043A\u0430 \u0431\u0443\u0434\u0435\u0442 \u0437\u0432\u0443\u0447\u0430\u0442\u044C \u043A\u0430\u043A \u0442\u0438\u0448\u0438\u043D\u0430).`
      });
    }
  };
  for (const r of store.world.regions ?? []) {
    for (const l of r.locations ?? []) {
      for (const tc of l.travel_connections ?? []) {
        checkSoundRef(tc.sound, `\u0421\u0432\u044F\u0437\u044C ${l.id} -> ${tc.to}`);
        checkSoundRef(tc.depart_sound, `\u041E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 ${l.id} -> ${tc.to}`);
        checkSoundRef(tc.arrive_sound, `\u041F\u0440\u0438\u0431\u044B\u0442\u0438\u0435 ${l.id} -> ${tc.to}`);
      }
    }
  }
  for (const p of store.recipePaths()) {
    const rc = store.recipe(p);
    checkSoundRef(rc.sound, `\u0420\u0435\u0446\u0435\u043F\u0442 \xAB${rc.label || rc.id}\xBB`);
  }
  for (const p of store.scenePaths()) {
    const sc = store.scene(p);
    for (const st of sc.states ?? []) {
      checkSoundRef(st.sound, `\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \xAB${st.label || st.id}\xBB \u0441\u0446\u0435\u043D\u044B ${sc.id}`);
    }
    for (const sl of sc.slots ?? []) {
      checkSoundRef(sl.sound, `\u0421\u043B\u043E\u0442 \xAB${sl.label || sl.id}\xBB \u0441\u0446\u0435\u043D\u044B ${sc.id}`);
    }
  }
  for (const st of store.meta.statuses ?? []) {
    checkSoundRef(st.apply_sound, `\u0421\u0442\u0430\u0442\u0443\u0441 \xAB${st.label || st.id}\xBB (apply_sound)`);
    checkSoundRef(st.remove_sound, `\u0421\u0442\u0430\u0442\u0443\u0441 \xAB${st.label || st.id}\xBB (remove_sound)`);
  }
  structure.push(...await inspectAlphaRoles(store));
  const mediaRefs = collectCampaignMedia(store);
  const localFindings = await inspectLocalMedia(store, mediaRefs.local);
  const media = localFindings.filter((finding) => finding.severity !== "info");
  if (mediaRefs.local.length && media.length === 0) {
    media.push({ severity: "info", message: `\u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E \u0441\u0441\u044B\u043B\u043E\u043A \u043D\u0430 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0435 \u043C\u0435\u0434\u0438\u0430 \u0432 \u043A\u043E\u043D\u0442\u0435\u043D\u0442\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438: ${mediaRefs.local.length}; \u0432\u0441\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B. \u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u043E\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0443\u043F\u043E\u043C\u044F\u043D\u0443\u0442\u044B\u0435 \u0432 \u0434\u0430\u043D\u043D\u044B\u0445 \u043F\u0443\u0442\u0438 \u2014 \u0444\u0430\u0439\u043B\u044B \u043D\u0430 \u0434\u0438\u0441\u043A\u0435 \u0431\u0435\u0437 \u0441\u0441\u044B\u043B\u043E\u043A \u043D\u0435 \u0441\u0447\u0438\u0442\u0430\u044E\u0442\u0441\u044F \u0438 \u043D\u0435 \u0443\u0434\u0430\u043B\u044F\u044E\u0442\u0441\u044F.` });
  }
  for (const url of mediaRefs.external) {
    media.push({
      severity: "warning",
      message: `\u0412\u043D\u0435\u0448\u043D\u0435\u0435 \u043C\u0435\u0434\u0438\u0430 \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u0441\u0435\u0442\u0438 \u0438 \u043D\u0435 \u0432\u043A\u043B\u044E\u0447\u0430\u0435\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u0432 \u043F\u0430\u043A\u0435\u0442: ${url}`
    });
  }
  if (media.length === 0) media.push({ severity: "info", message: "\u0421\u0441\u044B\u043B\u043E\u043A \u043D\u0430 \u043C\u0435\u0434\u0438\u0430\u0444\u0430\u0439\u043B\u044B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E." });
  const playtest = [];
  if (!lastPlaytest) {
    playtest.push({ severity: "info", message: "\u041F\u043E\u0441\u043B\u0435 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u0432\u0435\u0440\u0441\u0438\u0438 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u043F\u043B\u0435\u0439\u0442\u0435\u0441\u0442 \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u043B\u0441\u044F." });
  } else if (lastPlaytest.contentHash !== campaignContentHash(store)) {
    playtest.push({ severity: "warning", message: `\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u043F\u043B\u0435\u0439\u0442\u0435\u0441\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D ${new Date(lastPlaytest.finishedAt).toLocaleString()}; \u043F\u043E\u0441\u043B\u0435 \u043D\u0435\u0433\u043E \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u0435 \u043C\u0435\u043D\u044F\u043B\u043E\u0441\u044C \u2014 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u043F\u043B\u0435\u0439\u0442\u0435\u0441\u0442 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E.` });
    if (lastPlaytest.notes?.trim()) playtest.push({ severity: "info", message: `\u0417\u0430\u043F\u0438\u0441\u0430\u043D\u043D\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0439 \u0432\u0435\u0440\u0441\u0438\u0438: ${lastPlaytest.notes.trim()}` });
  } else {
    playtest.push({ severity: "info", message: `\u041F\u043B\u0435\u0439\u0442\u0435\u0441\u0442 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u043B\u0441\u044F ${new Date(lastPlaytest.startedAt).toLocaleString()} \u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u043E\u043C \u0432 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440. \u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043E\u0446\u0435\u043D\u043A\u0430 \u043F\u0440\u043E\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u044F \u043D\u0435\u0432\u043E\u0437\u043C\u043E\u0436\u043D\u0430.` });
    if (lastPlaytest.notes?.trim()) playtest.push({ severity: "info", message: `\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043C\u0430\u0441\u0442\u0435\u0440\u0430: ${lastPlaytest.notes.trim()}` });
    else playtest.push({ severity: "warning", message: "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u0440\u043E\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u044F \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u0430\u043D. \u0412\u043E \u0432\u0440\u0435\u043C\u044F \u043F\u043B\u0435\u0439\u0442\u0435\u0441\u0442\u0430 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u044C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\xBB." });
  }
  playtest.push({ severity: "info", message: "\u042D\u0442\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0435 \u0441\u0438\u043C\u0443\u043B\u0438\u0440\u0443\u0435\u0442 \u0438\u0433\u0440\u043E\u0432\u043E\u0439 \u043C\u0430\u0440\u0448\u0440\u0443\u0442. \u0414\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0439 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u043A\u043D\u043E\u043F\u043A\u0443 \xAB\u041F\u043B\u0435\u0439\u0442\u0435\u0441\u0442\xBB." });
  return { checkedAt: Date.now(), structure, media, playtest };
}
function formatCampaignAuditReport(report) {
  const lines = [
    `\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 Chronicle Forge \u2014 ${new Date(report.checkedAt).toLocaleString()}`,
    "",
    "\u0421\u0422\u0420\u0423\u041A\u0422\u0423\u0420\u0410 \u0418 \u0421\u0421\u042B\u041B\u041A\u0418",
    ...report.structure.length ? report.structure.map((finding) => `${finding.severity.toUpperCase()}: ${finding.message}`) : ["\u041F\u0420\u041E\u0411\u041B\u0415\u041C \u041D\u0415\u0422"],
    "\u041C\u0415\u0414\u0418\u0410 \u0418 \u0424\u0410\u0419\u041B\u042B",
    ...report.media.length ? report.media.map((finding) => `${finding.severity.toUpperCase()}: ${finding.message}`) : ["\u041F\u0420\u041E\u0411\u041B\u0415\u041C \u041D\u0415\u0422"],
    "\u041F\u041B\u0415\u0419\u0422\u0415\u0421\u0422",
    ...report.playtest.length ? report.playtest.map((finding) => `${finding.severity.toUpperCase()}: ${finding.message}`) : ["\u0418\u041D\u0424\u041E\u0420\u041C\u0410\u0426\u0418\u042F \u041D\u0415 \u0417\u0410\u041F\u0418\u0421\u0410\u041D\u0410"]
  ];
  return lines.join("\n");
}
function auditCounts(report) {
  const findings = [...report.structure, ...report.media, ...report.playtest];
  return {
    errors: findings.filter((finding) => finding.severity === "error").length,
    warnings: findings.filter((finding) => finding.severity === "warning").length,
    info: findings.filter((finding) => finding.severity === "info").length
  };
}
var import__, schema, ajv, schemaValidators, MEDIA_EXTENSION, ENGINE_INK_FNS;
var init_campaignAudit = __esm({
  "src/editor/campaignAudit.ts"() {
    import__ = __toESM(require__(), 1);
    init_campaign_schema();
    init_charcreate();
    init_types();
    schema = campaign_schema_default;
    ajv = new import__.default({ allErrors: true, strict: false });
    ajv.addSchema(schema);
    schemaValidators = /* @__PURE__ */ new Map();
    MEDIA_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp|aac|flac|m4a|mp3|ogg|opus|wav|mp4|mov|webm|otf|ttf|woff2?)(?:[?#].*)?$/i;
    ENGINE_INK_FNS = /* @__PURE__ */ new Set([
      "get_flag",
      "set_flag",
      "add_item",
      "remove_item",
      "item_count",
      "has_item",
      "skill_check",
      "stat_roll",
      "opposed_roll",
      "get_disposition",
      "change_disposition",
      "in_party",
      "join_party",
      "open_trade",
      "open_craft",
      "fire_rule",
      "start_quest",
      "quest_stage",
      "advance_time",
      "change_need",
      "change_hp",
      "get_hp",
      "get_hp_max",
      "get_mp",
      "get_mp_max",
      "get_luck",
      "get_level",
      "get_xp",
      "get_run_day",
      "get_currency",
      "get_need",
      "get_stat",
      "get_skill",
      "get_player_name",
      "sleep",
      "play_cutscene",
      "set_description",
      "apply_status",
      "remove_status",
      "has_status",
      "set_weather",
      "weather_is",
      "unlock_codex",
      "unlock_recipe",
      "roll_table",
      "gen",
      "set_dialogue_timer",
      "has_meta_achievement",
      "get_meta_counter"
    ]);
  }
});

// scripts/campaign-audit.mts
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, resolve, extname } from "path";
import { inflateSync } from "zlib";
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}
function decodePngCorners(buf) {
  if (buf.length < 33 || buf.readUInt32BE(0) !== 2303741511) return { width: 0, height: 0, corners: null, kind: "other" };
  let off = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let plte = null;
  let trns = null;
  const idat = [];
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "PLTE") plte = Buffer.from(data);
    else if (type === "tRNS") trns = Buffer.from(data);
    else if (type === "IDAT") idat.push(Buffer.from(data));
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (!width || !height) return { width, height, corners: null, kind: "png", note: "\u0431\u0438\u0442\u044B\u0439 IHDR" };
  if (bitDepth !== 8) return { width, height, corners: null, kind: "png", note: "16-\u0431\u0438\u0442 PNG \u2014 headless \u043D\u0435 \u0434\u0435\u043A\u043E\u0434\u0438\u0440\u0443\u0435\u0442" };
  if (interlace !== 0) return { width, height, corners: null, kind: "png", note: "\u0438\u043D\u0442\u0435\u0440\u043B\u0435\u0439\u0441 \u2014 headless \u043D\u0435 \u0434\u0435\u043A\u043E\u0434\u0438\u0440\u0443\u0435\u0442" };
  const channelsByType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const ch = channelsByType[colorType];
  if (!ch) return { width, height, corners: null, kind: "png", note: `\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 colorType ${colorType}` };
  let raw;
  try {
    raw = inflateSync(Buffer.concat(idat));
  } catch {
    return { width, height, corners: null, kind: "png", note: "IDAT \u043D\u0435 \u0440\u0430\u0437\u0436\u0430\u043B\u0441\u044F" };
  }
  const stride = width * ch;
  const corners = [];
  const targets = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
  const targetSet = new Map(targets.map(([x, y], i) => [`${x},${y}`, i]));
  let prev = Buffer.alloc(stride);
  let cur = Buffer.alloc(stride);
  let p = 0;
  main: for (let y = 0; y < height; y++) {
    const f = raw[p];
    const row = raw.subarray(p + 1, p + 1 + stride);
    if (row.length < stride) return { width, height, corners: null, kind: "png", note: "\u043E\u0431\u0440\u0435\u0437\u0430\u043D\u043D\u044B\u0435 IDAT" };
    for (let x = 0; x < stride; x++) {
      const left = x >= ch ? cur[x - ch] : 0;
      const up = prev[x];
      const upLeft = x >= ch ? prev[x - ch] : 0;
      const v = row[x];
      switch (f) {
        case 0:
          cur[x] = v;
          break;
        case 1:
          cur[x] = v + left & 255;
          break;
        case 2:
          cur[x] = v + up & 255;
          break;
        case 3:
          cur[x] = v + (left + up >> 1) & 255;
          break;
        case 4:
          cur[x] = v + paeth(left, up, upLeft) & 255;
          break;
        default:
          return { width, height, corners: null, kind: "png", note: `\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0444\u0438\u043B\u044C\u0442\u0440 ${f}` };
      }
    }
    for (const x of [0, width - 1]) {
      const idx = targetSet.get(`${x},${y}`);
      if (idx === void 0) continue;
      const o = x * ch;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 255;
      if (colorType === 6) {
        r = cur[o];
        g = cur[o + 1];
        b = cur[o + 2];
        a = cur[o + 3];
      } else if (colorType === 2) {
        r = cur[o];
        g = cur[o + 1];
        b = cur[o + 2];
        if (trns && trns.length >= 6 && (trns.readUInt16BE(0) === r * 257 || trns.readUInt16BE(0) === r) && trns.readUInt16BE(2) === g && trns.readUInt16BE(4) === b) a = 0;
      } else if (colorType === 3) {
        const pi = cur[o];
        if (plte && pi * 3 + 2 < plte.length) {
          r = plte[pi * 3];
          g = plte[pi * 3 + 1];
          b = plte[pi * 3 + 2];
        }
        a = trns && pi < trns.length ? trns[pi] : 255;
      } else if (colorType === 4) {
        const g4 = cur[o];
        r = g4;
        g = g4;
        b = g4;
        a = cur[o + 1];
      } else {
        const g0 = cur[o];
        r = g0;
        g = g0;
        b = g0;
      }
      corners[idx] = [r, g, b, a];
    }
    const tmp = prev;
    prev = cur;
    cur = tmp;
    p += 1 + stride;
    if (y > 10 && corners.filter(Boolean).length === targets.length) break main;
  }
  if (corners.filter(Boolean).length !== 4) return { width, height, corners: null, kind: "png", note: "\u043D\u0435 \u0432\u0441\u0435 \u0443\u0433\u043B\u044B \u0434\u0435\u043A\u043E\u0434\u0438\u0440\u043E\u0432\u0430\u043D\u044B" };
  return { width, height, corners, kind: "png" };
}
function jpegDims(buf) {
  if (buf.length < 4 || buf[0] !== 255 || buf[1] !== 216) return null;
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 255) {
      off++;
      continue;
    }
    const marker = buf[off + 1];
    const len = buf.readUInt16BE(off + 2);
    if (marker >= 192 && marker <= 207 && marker !== 196 && marker !== 200 && marker !== 204) {
      return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
    }
    off += 2 + len;
  }
  return null;
}
function webpInfo(buf) {
  if (buf.length < 30 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const kind = buf.toString("ascii", 12, 16);
  if (kind === "VP8X") {
    const flags = buf[20];
    return {
      width: 1 + buf.readUIntLE(24, 3),
      height: 1 + buf.readUIntLE(27, 3),
      hasAlpha: (flags & 16) !== 0
    };
  }
  if (kind === "VP8 ") {
    return { width: buf.readUInt16LE(26) & 16383, height: buf.readUInt16LE(28) & 16383, hasAlpha: false };
  }
  if (kind === "VP8L") {
    if (buf[20] !== 47) return null;
    const b1 = buf[21], b2 = buf[22], b3 = buf[23], b4 = buf[24];
    const w = ((b2 & 63) << 8 | b1) + 1;
    const h = (((b4 & 15) << 6 | b3 << 8 | b2) >> 6 & 16383) + 1;
    return { width: w, height: h, hasAlpha: true };
  }
  return null;
}
function inspectImage(buf, ext) {
  if (ext === ".png") return decodePngCorners(buf);
  if (ext === ".jpg" || ext === ".jpeg") {
    const d = jpegDims(buf);
    if (!d) return { width: 0, height: 0, corners: null, kind: "jpeg", note: "\u0431\u0438\u0442\u044B\u0439 JPEG" };
    return { width: d.width, height: d.height, corners: [[0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255]], kind: "jpeg", note: "\u0444\u043E\u0440\u043C\u0430\u0442 \u0431\u0435\u0437 \u0430\u043B\u044C\u0444\u044B" };
  }
  if (ext === ".webp") {
    const w = webpInfo(buf);
    if (!w) return { width: 0, height: 0, corners: null, kind: "webp", note: "\u0431\u0438\u0442\u044B\u0439 WebP" };
    if (w.hasAlpha) return { width: w.width, height: w.height, corners: null, kind: "webp", note: "WebP \u0441 \u0430\u043B\u044C\u0444\u043E\u0439 \u043D\u0435 \u0440\u0430\u0441\u043A\u043E\u0434\u0438\u0440\u0443\u0435\u0442\u0441\u044F headless \u2014 \u043F\u0440\u043E\u043F\u0443\u0441\u043A \u0443\u0433\u043B\u043E\u0432" };
    return { width: w.width, height: w.height, corners: [[0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255]], kind: "webp", note: "\u0444\u043E\u0440\u043C\u0430\u0442 \u0431\u0435\u0437 \u0430\u043B\u044C\u0444\u044B" };
  }
  return { width: 0, height: 0, corners: null, kind: "other", note: `\u0444\u043E\u0440\u043C\u0430\u0442 ${ext} headless \u043D\u0435 \u0434\u0435\u043A\u043E\u0434\u0438\u0440\u0443\u0435\u0442` };
}
var CAMPAIGN_ROOT = "";
var mimeByExt = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".aac": "audio/flac",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/mp4",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".json": "application/json",
  ".md": "text/markdown",
  ".ink": "text/plain"
};
var STORE_BASE = "/campaigns/__audit__";
var blobPaths = /* @__PURE__ */ new WeakMap();
var imageNotes = /* @__PURE__ */ new Map();
function installFetchShim() {
  const decodePath = (url) => {
    return url.split(/[?#]/, 1)[0].split("/").map((seg) => {
      try {
        return decodeURIComponent(seg);
      } catch {
        return seg;
      }
    }).join("/");
  };
  globalThis.fetch = async (input, init) => {
    let rel = decodePath(String(input));
    if (rel.startsWith(STORE_BASE)) rel = rel.slice(STORE_BASE.length);
    rel = rel.replace(/^\/+/, "");
    const abs = resolve(CAMPAIGN_ROOT, rel);
    void init;
    if (!abs.startsWith(CAMPAIGN_ROOT) || !existsSync(abs) || !statSync(abs).isFile()) {
      return { ok: false, status: 404, headers: { get: () => null }, blob: async () => new Blob([]) };
    }
    const buf = readFileSync(abs);
    const blob = new Blob([buf]);
    blobPaths.set(blob, rel);
    return {
      ok: true,
      status: 200,
      headers: { get: (name) => name.toLowerCase() === "content-type" ? mimeByExt[extname(abs).toLowerCase()] ?? "application/octet-stream" : null },
      blob: async () => blob
    };
  };
}
function installImageShims() {
  ;
  globalThis.createImageBitmap = async (blob) => {
    const buf = Buffer.from(await blob.arrayBuffer());
    const dec = inspectImage(buf, detectExtMagic(buf));
    const pix = /* @__PURE__ */ new Map();
    if (dec.corners && dec.width && dec.height) {
      const w = dec.width, h = dec.height;
      const [lt, rt, lb, rb] = dec.corners;
      pix.set(`0,0`, lt);
      pix.set(`${w - 1},0`, rt);
      pix.set(`0,${h - 1}`, lb);
      pix.set(`${w - 1},${h - 1}`, rb);
    } else {
      const rel = blobPaths.get(blob);
      if (rel && dec.note) imageNotes.set(rel, dec.note);
      const w = Math.max(1, dec.width || 1), h = Math.max(1, dec.height || 1);
      pix.set(`0,0`, [0, 0, 0, 0]);
      pix.set(`${w - 1},0`, [0, 0, 0, 0]);
      pix.set(`0,${h - 1}`, [0, 0, 0, 0]);
      pix.set(`${w - 1},${h - 1}`, [0, 0, 0, 0]);
    }
    const bmp = { width: Math.max(1, dec.width || 1), height: Math.max(1, dec.height || 1), __pix: pix, close() {
    } };
    return bmp;
  };
  globalThis.OffscreenCanvas = class {
    width;
    height;
    constructor(w, h) {
      this.width = w;
      this.height = h;
    }
    getContext(_kind, _opts) {
      void _kind;
      void _opts;
      let drawn = null;
      return {
        drawImage(bmp, _x, _y) {
          void _x;
          void _y;
          if ((bmp?.width ?? 0) > 0) drawn = bmp;
        },
        getImageData(x, y, _w, _h) {
          void _w;
          void _h;
          const p = drawn?.__pix.get(`${x},${y}`) ?? [0, 0, 0, 0];
          return { data: new Uint8ClampedArray([p[0], p[1], p[2], p[3]]) };
        }
      };
    }
  };
}
function detectExtMagic(buf) {
  if (buf.length >= 4 && buf.readUInt32BE(0) === 2303741511) return ".png";
  if (buf.length >= 2 && buf[0] === 255 && buf[1] === 216) return ".jpg";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return ".webp";
  if (buf.length >= 6 && buf.toString("ascii", 0, 6).startsWith("GIF")) return ".gif";
  return ".png";
}
function parseArgs(argv) {
  const args = argv.slice(2).filter((a) => a !== "--");
  const json = args.includes("--json");
  const root = args.find((a) => !a.startsWith("--"));
  if (!root) {
    console.error("\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435: npm run audit:campaign -- <\u043F\u0430\u043F\u043A\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438> [--json]");
    process.exit(2);
  }
  const abs = resolve(process.cwd(), root);
  if (!existsSync(join(abs, "campaign.json"))) {
    console.error(`\u041D\u0435 \u043F\u043E\u0445\u043E\u0436\u0435 \u043D\u0430 \u043F\u0430\u043F\u043A\u0443 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 (\u043D\u0435\u0442 campaign.json): ${abs}`);
    process.exit(2);
  }
  return { root: abs, json };
}
async function main() {
  const { root, json } = parseArgs(process.argv);
  CAMPAIGN_ROOT = resolve(root);
  installFetchShim();
  installImageShims();
  const { EditorStore: EditorStore2 } = await Promise.resolve().then(() => (init_store(), store_exports));
  const { validateCampaign: validateCampaign2, formatCampaignAuditReport: formatCampaignAuditReport2, auditCounts: auditCounts2 } = await Promise.resolve().then(() => (init_campaignAudit(), campaignAudit_exports));
  const store = new EditorStore2(STORE_BASE);
  const readJson = (p) => JSON.parse(readFileSync(join(CAMPAIGN_ROOT, p), "utf-8"));
  store.meta = readJson("campaign.json");
  store.world = readJson("world.json");
  store.manifest = existsSync(join(CAMPAIGN_ROOT, "manifest.json")) ? readJson("manifest.json") : {};
  const JSON_DIRS = ["scenes", "entities", "rules", "quests", "arenas", "cutscenes", "recipes", "codex", "encounters"];
  for (const dir of [...JSON_DIRS, "dialogues"]) {
    const full = join(CAMPAIGN_ROOT, dir);
    if (!existsSync(full)) continue;
    for (const name of readdirSync(full)) {
      const sub = join(full, name);
      if (!statSync(sub).isFile()) continue;
      const rel = `${dir}/${name}`;
      if (name.endsWith(".json")) {
        try {
          store.jsonFiles.set(rel, readJson(rel));
        } catch (e) {
          console.error(`\u041F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0435: ${rel} \u043D\u0435 \u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F \u043A\u0430\u043A JSON (${String(e)}) \u2014 \u0443\u0447\u0442\u0435\u043D\u043E \u043A\u0430\u043A \u0431\u0438\u0442\u044B\u0439.`);
        }
      } else if (name.endsWith(".ink") || name.endsWith(".md")) {
        store.textFiles.set(rel, readFileSync(sub, "utf-8"));
      }
    }
  }
  const report = await validateCampaign2(store, null);
  for (const [path, note] of imageNotes) {
    report.media.push({
      severity: "warning",
      message: `\xAB${path}\xBB: \u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u043E\u0441\u0442\u044C \u0443\u0433\u043B\u043E\u0432 headless \u041D\u0415 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u0430 (${note}). \u0420\u043E\u043B\u044C \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u043E\u0433\u043E \u0444\u043E\u043D\u0430; \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0443\u0433\u043B\u044B \u043A\u043D\u043E\u043F\u043A\u043E\u0439 \xAB\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u044E\xBB \u0432 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0435 \u0438\u043B\u0438 \u043A\u043E\u043D\u0432\u0435\u0440\u0442\u0438\u0440\u0443\u0439\u0442\u0435 \u0432 PNG 8-\u0431\u0438\u0442 \u0431\u0435\u0437 \u0438\u043D\u0442\u0435\u0440\u043B\u0435\u0439\u0441\u0430.`
    });
  }
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Headless-\u0430\u0443\u0434\u0438\u0442 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438: ${CAMPAIGN_ROOT}`);
    console.log(`\u0424\u0430\u0439\u043B\u043E\u0432 \u0432 \u043F\u043E\u043A\u0440\u044B\u0442\u0438\u0438: json ${store.jsonFiles.size}, ink/md ${store.textFiles.size}`);
    console.log(formatCampaignAuditReport2(report));
  }
  const counts = auditCounts2(report);
  console.error(`\u0418\u0442\u043E\u0433\u043E: ${counts.errors} \u043E\u0448\u0438\u0431\u043E\u043A, ${counts.warnings} \u043F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0439, ${counts.info} \u0437\u0430\u043C\u0435\u0442\u043E\u043A`);
  process.exit(counts.errors > 0 ? 1 : 0);
}
main().catch((e) => {
  console.error("\u0410\u0443\u0434\u0438\u0442 \u0443\u043F\u0430\u043B \u0446\u0435\u043B\u0438\u043A\u043E\u043C:", e);
  process.exit(1);
});
