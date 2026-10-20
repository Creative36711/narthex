#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x2) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x2, {
  get: (a2, b2) => (typeof require !== "undefined" ? require : a2)[b2]
}) : x2)(function(x2) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x2 + '" is not supported');
});
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e2) {
    throw err = [e2], e2;
  }
};
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e2) {
    throw mod = 0, e2;
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

// node_modules/seedrandom/lib/alea.js
var require_alea = __commonJS({
  "node_modules/seedrandom/lib/alea.js"(exports, module) {
    (function(global, module2, define2) {
      function Alea(seed) {
        var me = this, mash = Mash();
        me.next = function() {
          var t5 = 2091639 * me.s0 + me.c * 23283064365386963e-26;
          me.s0 = me.s1;
          me.s1 = me.s2;
          return me.s2 = t5 - (me.c = t5 | 0);
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
      function copy(f2, t5) {
        t5.c = f2.c;
        t5.s0 = f2.s0;
        t5.s1 = f2.s1;
        t5.s2 = f2.s2;
        return t5;
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
        var n2 = 4022871197;
        var mash = function(data) {
          data = String(data);
          for (var i2 = 0; i2 < data.length; i2++) {
            n2 += data.charCodeAt(i2);
            var h2 = 0.02519603282416938 * n2;
            n2 = h2 >>> 0;
            h2 -= n2;
            h2 *= n2;
            n2 = h2 >>> 0;
            h2 -= n2;
            n2 += h2 * 4294967296;
          }
          return (n2 >>> 0) * 23283064365386963e-26;
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
          var t5 = me.x ^ me.x << 11;
          me.x = me.y;
          me.y = me.z;
          me.z = me.w;
          return me.w ^= me.w >>> 19 ^ t5 ^ t5 >>> 8;
        };
        if (seed === (seed | 0)) {
          me.x = seed;
        } else {
          strseed += seed;
        }
        for (var k2 = 0; k2 < strseed.length + 64; k2++) {
          me.x ^= strseed.charCodeAt(k2) | 0;
          me.next();
        }
      }
      function copy(f2, t5) {
        t5.x = f2.x;
        t5.y = f2.y;
        t5.z = f2.z;
        t5.w = f2.w;
        return t5;
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
          var t5 = me.x ^ me.x >>> 2;
          me.x = me.y;
          me.y = me.z;
          me.z = me.w;
          me.w = me.v;
          return (me.d = me.d + 362437 | 0) + (me.v = me.v ^ me.v << 4 ^ (t5 ^ t5 << 1)) | 0;
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
        for (var k2 = 0; k2 < strseed.length + 64; k2++) {
          me.x ^= strseed.charCodeAt(k2) | 0;
          if (k2 == strseed.length) {
            me.d = me.x << 10 ^ me.x >>> 4;
          }
          me.next();
        }
      }
      function copy(f2, t5) {
        t5.x = f2.x;
        t5.y = f2.y;
        t5.z = f2.z;
        t5.w = f2.w;
        t5.v = f2.v;
        t5.d = f2.d;
        return t5;
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
          var X2 = me.x, i2 = me.i, t5, v2, w2;
          t5 = X2[i2];
          t5 ^= t5 >>> 7;
          v2 = t5 ^ t5 << 24;
          t5 = X2[i2 + 1 & 7];
          v2 ^= t5 ^ t5 >>> 10;
          t5 = X2[i2 + 3 & 7];
          v2 ^= t5 ^ t5 >>> 3;
          t5 = X2[i2 + 4 & 7];
          v2 ^= t5 ^ t5 << 7;
          t5 = X2[i2 + 7 & 7];
          t5 = t5 ^ t5 << 13;
          v2 ^= t5 ^ t5 << 9;
          X2[i2] = v2;
          me.i = i2 + 1 & 7;
          return v2;
        };
        function init(me2, seed2) {
          var j2, w2, X2 = [];
          if (seed2 === (seed2 | 0)) {
            w2 = X2[0] = seed2;
          } else {
            seed2 = "" + seed2;
            for (j2 = 0; j2 < seed2.length; ++j2) {
              X2[j2 & 7] = X2[j2 & 7] << 15 ^ seed2.charCodeAt(j2) + X2[j2 + 1 & 7] << 13;
            }
          }
          while (X2.length < 8) X2.push(0);
          for (j2 = 0; j2 < 8 && X2[j2] === 0; ++j2) ;
          if (j2 == 8) w2 = X2[7] = -1;
          else w2 = X2[j2];
          me2.x = X2;
          me2.i = 0;
          for (j2 = 256; j2 > 0; --j2) {
            me2.next();
          }
        }
        init(me, seed);
      }
      function copy(f2, t5) {
        t5.x = f2.x.slice();
        t5.i = f2.i;
        return t5;
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
          var w2 = me.w, X2 = me.X, i2 = me.i, t5, v2;
          me.w = w2 = w2 + 1640531527 | 0;
          v2 = X2[i2 + 34 & 127];
          t5 = X2[i2 = i2 + 1 & 127];
          v2 ^= v2 << 13;
          t5 ^= t5 << 17;
          v2 ^= v2 >>> 15;
          t5 ^= t5 >>> 12;
          v2 = X2[i2] = v2 ^ t5;
          me.i = i2;
          return v2 + (w2 ^ w2 >>> 16) | 0;
        };
        function init(me2, seed2) {
          var t5, v2, i2, j2, w2, X2 = [], limit = 128;
          if (seed2 === (seed2 | 0)) {
            v2 = seed2;
            seed2 = null;
          } else {
            seed2 = seed2 + "\0";
            v2 = 0;
            limit = Math.max(limit, seed2.length);
          }
          for (i2 = 0, j2 = -32; j2 < limit; ++j2) {
            if (seed2) v2 ^= seed2.charCodeAt((j2 + 32) % seed2.length);
            if (j2 === 0) w2 = v2;
            v2 ^= v2 << 10;
            v2 ^= v2 >>> 15;
            v2 ^= v2 << 4;
            v2 ^= v2 >>> 13;
            if (j2 >= 0) {
              w2 = w2 + 1640531527 | 0;
              t5 = X2[j2 & 127] ^= v2 + w2;
              i2 = 0 == t5 ? i2 + 1 : 0;
            }
          }
          if (i2 >= 128) {
            X2[(seed2 && seed2.length || 0) & 127] = -1;
          }
          i2 = 127;
          for (j2 = 4 * 128; j2 > 0; --j2) {
            v2 = X2[i2 + 34 & 127];
            t5 = X2[i2 = i2 + 1 & 127];
            v2 ^= v2 << 13;
            t5 ^= t5 << 17;
            v2 ^= v2 >>> 15;
            t5 ^= t5 >>> 12;
            X2[i2] = v2 ^ t5;
          }
          me2.w = w2;
          me2.X = X2;
          me2.i = i2;
        }
        init(me, seed);
      }
      function copy(f2, t5) {
        t5.i = f2.i;
        t5.w = f2.w;
        t5.X = f2.X.slice();
        return t5;
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
          var b2 = me.b, c2 = me.c, d2 = me.d, a2 = me.a;
          b2 = b2 << 25 ^ b2 >>> 7 ^ c2;
          c2 = c2 - d2 | 0;
          d2 = d2 << 24 ^ d2 >>> 8 ^ a2;
          a2 = a2 - b2 | 0;
          me.b = b2 = b2 << 20 ^ b2 >>> 12 ^ c2;
          me.c = c2 = c2 - d2 | 0;
          me.d = d2 << 16 ^ c2 >>> 16 ^ a2;
          return me.a = a2 - b2 | 0;
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
        for (var k2 = 0; k2 < strseed.length + 20; k2++) {
          me.b ^= strseed.charCodeAt(k2) | 0;
          me.next();
        }
      }
      function copy(f2, t5) {
        t5.a = f2.a;
        t5.b = f2.b;
        t5.c = f2.c;
        t5.d = f2.d;
        return t5;
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
      function seedrandom4(seed, options, callback) {
        var key = [];
        options = options == true ? { entropy: true } : options || {};
        var shortseed = mixkey(flatten(
          options.entropy ? [seed, tostring(pool)] : seed == null ? autoseed() : seed,
          3
        ), key);
        var arc4 = new ARC4(key);
        var prng = function() {
          var n2 = arc4.g(chunks), d2 = startdenom, x2 = 0;
          while (n2 < significance) {
            n2 = (n2 + x2) * width;
            d2 *= width;
            x2 = arc4.g(1);
          }
          while (n2 >= overflow) {
            n2 /= 2;
            d2 /= 2;
            x2 >>>= 1;
          }
          return (n2 + x2) / d2;
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
        var t5, keylen = key.length, me = this, i2 = 0, j2 = me.i = me.j = 0, s2 = me.S = [];
        if (!keylen) {
          key = [keylen++];
        }
        while (i2 < width) {
          s2[i2] = i2++;
        }
        for (i2 = 0; i2 < width; i2++) {
          s2[i2] = s2[j2 = mask & j2 + key[i2 % keylen] + (t5 = s2[i2])];
          s2[j2] = t5;
        }
        (me.g = function(count) {
          var t6, r2 = 0, i3 = me.i, j3 = me.j, s3 = me.S;
          while (count--) {
            t6 = s3[i3 = mask & i3 + 1];
            r2 = r2 * width + s3[mask & (s3[i3] = s3[j3 = mask & j3 + t6]) + (s3[j3] = t6)];
          }
          me.i = i3;
          me.j = j3;
          return r2;
        })(width);
      }
      function copy(f2, t5) {
        t5.i = f2.i;
        t5.j = f2.j;
        t5.S = f2.S.slice();
        return t5;
      }
      ;
      function flatten(obj, depth) {
        var result = [], typ = typeof obj, prop;
        if (depth && typ == "object") {
          for (prop in obj) {
            try {
              result.push(flatten(obj[prop], depth - 1));
            } catch (e2) {
            }
          }
        }
        return result.length ? result : typ == "string" ? obj : obj + "\0";
      }
      function mixkey(seed, key) {
        var stringseed = seed + "", smear, j2 = 0;
        while (j2 < stringseed.length) {
          key[mask & j2] = mask & (smear ^= key[mask & j2] * 19) + stringseed.charCodeAt(j2++);
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
        } catch (e2) {
          var browser = global.navigator, plugins = browser && browser.plugins;
          return [+/* @__PURE__ */ new Date(), global, plugins, global.screen, tostring(pool)];
        }
      }
      function tostring(a2) {
        return String.fromCharCode.apply(0, a2);
      }
      mixkey(math.random(), pool);
      if (typeof module == "object" && module.exports) {
        module.exports = seedrandom4;
        try {
          nodecrypto = __require("crypto");
        } catch (ex) {
        }
      } else if (typeof define == "function" && define.amd) {
        define(function() {
          return seedrandom4;
        });
      } else {
        math["seed" + rngname] = seedrandom4;
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

// src/shared/migrate.ts
function migrateNeedCondition(c2) {
  const any = c2;
  switch (any.type) {
    case "in_location": {
      if (Array.isArray(any.locations)) return c2;
      const one = any.location ?? any.locations ?? "";
      return { type: "in_location", locations: one ? [one] : [], not: any.not };
    }
    case "has_item":
    case "equipped": {
      if (Array.isArray(any.items)) return c2;
      const one = any.item ?? any.items ?? "";
      return { type: any.type, items: one ? [one] : [], not: any.not };
    }
    default:
      return c2;
  }
}
function migrateNeedConditions(list) {
  if (!list) return list;
  return list.map(migrateNeedCondition);
}
function migrateEntity(e2) {
  if (e2 && e2.type === "npc" && typeof e2.description !== "string") {
    return { ...e2, description: "" };
  }
  if (e2 && e2.type === "item") {
    const it2 = e2;
    if (!it2.equip_slot && (it2.weapon_data || it2.armor_data)) {
      return { ...e2, equip_slot: it2.weapon_data ? "weapon" : "armor" };
    }
  }
  return e2;
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
    (e2) => !legacyBuiltins.some((b2) => b2.id === e2.id && b2.label === e2.label)
  );
  return meta;
}
function migrateMusicRules(music) {
  if (music === void 0) return void 0;
  if (typeof music === "string") return music ? [{ tracks: [music] }] : void 0;
  return music;
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
  const walk2 = (regions) => {
    for (const r2 of regions) {
      const l2 = r2.locations.find((x2) => x2.id === id);
      if (l2) return l2;
      const sub = r2.sub_regions ? walk2(r2.sub_regions) : void 0;
      if (sub) return sub;
    }
    return void 0;
  };
  return walk2(world.regions);
}
function allLocations(world) {
  const out = [];
  const walk2 = (regions) => {
    for (const r2 of regions) {
      out.push(...r2.locations);
      if (r2.sub_regions) walk2(r2.sub_regions);
    }
  };
  walk2(world.regions);
  return out;
}
function migrateCampaign(meta, world, scenes) {
  migrateMeta(meta);
  for (const scene of Object.values(scenes)) migrateNavigation(scene, world);
  for (const loc of allLocations(world)) {
    const rules = migrateMusicRules(loc.music);
    if (rules === void 0) delete loc.music;
    else loc.music = rules;
  }
}
var init_migrate = __esm({
  "src/shared/migrate.ts"() {
  }
});

// src/shared/versions.ts
function readEngineVersion() {
  if ("0.8.0") return "0.8.0";
  const fromEnv = globalThis.process?.env?.npm_package_version;
  return fromEnv || "0.0.0-dev";
}
function parseVersion(text) {
  const m2 = /^v?\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?/.exec(String(text ?? "").trim());
  if (!m2) return { major: 0, minor: 0, patch: 0 };
  return {
    major: Number(m2[1]),
    minor: m2[2] === void 0 ? 0 : Number(m2[2]),
    patch: m2[3] === void 0 ? 0 : Number(m2[3]),
    pre: m2[4]
  };
}
function compareVersions(a2, b2) {
  const x2 = parseVersion(a2);
  const y2 = parseVersion(b2);
  if (x2.major !== y2.major) return x2.major < y2.major ? -1 : 1;
  if (x2.minor !== y2.minor) return x2.minor < y2.minor ? -1 : 1;
  if (x2.patch !== y2.patch) return x2.patch < y2.patch ? -1 : 1;
  if (x2.pre === y2.pre) return 0;
  if (x2.pre === void 0) return 1;
  if (y2.pre === void 0) return -1;
  return x2.pre < y2.pre ? -1 : x2.pre > y2.pre ? 1 : 0;
}
function versionGreaterOrEqual(a2, b2) {
  return compareVersions(a2, b2) >= 0;
}
function checkEngine(required) {
  const req = String(required ?? "").trim();
  const actual = ENGINE_VERSION;
  if (!req || req === "0" || req === "0.0.0") return { ok: true, required: req || "\u2014", actual, message: "" };
  if (versionGreaterOrEqual(actual, req)) return { ok: true, required: req, actual, message: "" };
  return {
    ok: false,
    required: req,
    actual,
    message: `\u041A\u0430\u043C\u043F\u0430\u043D\u0438\u044F \u0440\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u043D\u0430 \u043D\u0430 \u0434\u0432\u0438\u0436\u043E\u043A ${req} \u0438 \u043D\u043E\u0432\u0435\u0435, \u0430 \u0437\u0430\u043F\u0443\u0449\u0435\u043D ${actual}. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 Chronicle Forge \u2014 \u0438\u043D\u0430\u0447\u0435 \u043F\u0440\u0430\u0432\u0438\u043B\u0430 \u0438 \u043C\u0435\u0445\u0430\u043D\u0438\u043A\u0438 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u043C\u043E\u0433\u0443\u0442 \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C \u043D\u0435\u0432\u0435\u0440\u043D\u043E.`
  };
}
function checkPackage(declared, oldest = OLDEST_PACKAGE_FORMAT) {
  const format = typeof declared === "number" && declared > 0 ? declared : OLDEST_PACKAGE_FORMAT;
  if (format > PACKAGE_FORMAT) {
    return {
      ok: false,
      declared: format,
      supported: PACKAGE_FORMAT,
      message: `\u041A\u0430\u043C\u043F\u0430\u043D\u0438\u044F \u0441\u043E\u0431\u0440\u0430\u043D\u0430 \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 \u043F\u0430\u043A\u0435\u0442\u0430 v${format}, \u0430 \u044D\u0442\u043E\u0442 \u0434\u0432\u0438\u0436\u043E\u043A \u043F\u043E\u043D\u0438\u043C\u0430\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043E v${PACKAGE_FORMAT}. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 Chronicle Forge, \u0447\u0442\u043E\u0431\u044B \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u044E.`
    };
  }
  if (format < oldest) {
    return {
      ok: false,
      declared: format,
      supported: PACKAGE_FORMAT,
      message: `\u041A\u0430\u043C\u043F\u0430\u043D\u0438\u044F \u0441\u043E\u0431\u0440\u0430\u043D\u0430 \u0432 \u0443\u0441\u0442\u0430\u0440\u0435\u0432\u0448\u0435\u043C \u0444\u043E\u0440\u043C\u0430\u0442\u0435 \u043F\u0430\u043A\u0435\u0442\u0430 v${format} (\u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0441 v${oldest}). \u041F\u043E\u043F\u0440\u043E\u0441\u0438\u0442\u0435 \u0430\u0432\u0442\u043E\u0440\u0430 \u0432\u044B\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u044E \u0437\u0430\u043D\u043E\u0432\u043E.`
    };
  }
  return { ok: true, declared: format, supported: PACKAGE_FORMAT, message: "" };
}
var PACKAGE_FORMAT, OLDEST_PACKAGE_FORMAT, ENGINE_VERSION;
var init_versions = __esm({
  "src/shared/versions.ts"() {
    PACKAGE_FORMAT = 1;
    OLDEST_PACKAGE_FORMAT = 1;
    ENGINE_VERSION = readEngineVersion();
  }
});

// src/shared/types.ts
function featureOn(meta, key) {
  return meta.features?.[key] !== false;
}
function startTick(meta) {
  return meta.starting_tick ?? 8;
}
function equipmentSlots(meta) {
  return (meta.equipment_slots ?? []).map((s2) => ({ ...s2 }));
}
var DEFAULT_DICE_RULES, BUILTIN_CODEX_CATEGORIES, SAVE_VERSION, SAVE_ENVELOPE_VERSION;
var init_types = __esm({
  "src/shared/types.ts"() {
    DEFAULT_DICE_RULES = {
      critical_divisor: 5,
      special_divisor: 2,
      fumble_from: 96
    };
    BUILTIN_CODEX_CATEGORIES = [
      { id: "creatures", label: "\u0421\u0443\u0449\u0435\u0441\u0442\u0432\u0430" },
      { id: "places", label: "\u041C\u0435\u0441\u0442\u0430" },
      { id: "chronicles", label: "\u0425\u0440\u043E\u043D\u0438\u043A\u0438" }
    ];
    SAVE_VERSION = 4;
    SAVE_ENVELOPE_VERSION = 1;
  }
});

// src/shared/skills.ts
function skillLabel(id, campaignSkills) {
  const fromCampaign = campaignSkills?.find((s2) => s2.id === id)?.label;
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

// src/core/dice.ts
function rollDice(notation, rng) {
  const m2 = notation.trim().match(/^(\d*)[dD](\d+)([+-]\d+)?$/);
  if (!m2) {
    const flat = Number(notation);
    if (Number.isFinite(flat)) return flat;
    throw new Error(`\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u043D\u043E\u0442\u0430\u0446\u0438\u044F \u043A\u043E\u0441\u0442\u0435\u0439: ${notation}`);
  }
  const count = m2[1] ? parseInt(m2[1], 10) : 1;
  const sides = parseInt(m2[2], 10);
  const mod = m2[3] ? parseInt(m2[3], 10) : 0;
  let total = mod;
  for (let i2 = 0; i2 < count; i2++) total += rng.int(1, sides);
  return total;
}
var d100;
var init_dice = __esm({
  "src/core/dice.ts"() {
    d100 = (rng) => rng.int(1, 100);
  }
});

// src/core/brp.ts
function difficultyModifier(skillValue, difficulty) {
  if (typeof difficulty === "number") return 50 - difficulty;
  const mult = difficulty === "easy" ? 2 : difficulty === "difficult" ? 0.5 : difficulty === "impossible" ? 0.25 : 1;
  return Math.round(skillValue * (mult - 1));
}
function difficultyLabel(d2) {
  if (typeof d2 === "number") return `\u0441\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u044C ${d2}`;
  return { easy: "\u043B\u0451\u0433\u043A\u0430\u044F", normal: "\u043E\u0431\u044B\u0447\u043D\u0430\u044F", difficult: "\u0442\u0440\u0443\u0434\u043D\u0430\u044F", impossible: "\u043D\u0435\u0432\u043E\u0437\u043C\u043E\u0436\u043D\u0430\u044F" }[d2];
}
function skillCheck(skillValue, rng, modifier = 0, rules = null) {
  const r2 = rules ?? DEFAULT_DICE_RULES;
  const critDiv = Math.max(1, r2.critical_divisor || DEFAULT_DICE_RULES.critical_divisor);
  const specDiv = Math.max(1, r2.special_divisor || DEFAULT_DICE_RULES.special_divisor);
  const fumbleFrom = Math.min(100, Math.max(1, r2.fumble_from ?? DEFAULT_DICE_RULES.fumble_from));
  const target = Math.max(0, skillValue + modifier);
  const roll = d100(rng);
  let result;
  if (roll === 100) result = "fumble";
  else if (roll >= fumbleFrom) {
    const wideFumble = r2.fumble_low_skill != null && skillValue < r2.fumble_low_skill;
    result = wideFumble || target < roll ? "fumble" : "fail";
  } else if (roll <= Math.max(1, Math.floor(target / critDiv))) result = "critical";
  else if (roll <= Math.floor(target / specDiv)) result = "hard";
  else if (roll <= target) result = "success";
  else result = "fail";
  return { roll, target, result, success: result === "critical" || result === "hard" || result === "success" };
}
function derivedHP(stats) {
  return Math.ceil((stats.CON + stats.SIZ) / 2);
}
function derivedMP(stats) {
  return stats.POW;
}
function damageBonus(stats) {
  const sum = stats.STR + stats.SIZ;
  if (sum <= 12) return "-1d4";
  if (sum <= 16) return "-1d2";
  if (sum <= 24) return "0";
  if (sum <= 32) return "+1d4";
  if (sum <= 40) return "+1d6";
  return "+2d6";
}
function movement(stats) {
  const base = 8;
  const bulk = stats.SIZ - (stats.STR + stats.DEX) / 2;
  if (bulk > 5) return base - 2;
  if (bulk > 2) return base - 1;
  return base;
}
var CHECK_RESULT_LABEL;
var init_brp = __esm({
  "src/core/brp.ts"() {
    init_types();
    init_dice();
    CHECK_RESULT_LABEL = {
      critical: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0443\u0441\u043F\u0435\u0445",
      hard: "\u0443\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0439 \u0443\u0441\u043F\u0435\u0445",
      success: "\u0443\u0441\u043F\u0435\u0445",
      fail: "\u043F\u0440\u043E\u0432\u0430\u043B",
      fumble: "\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043F\u0440\u043E\u0432\u0430\u043B"
    };
  }
});

// src/core/savemigrate.ts
function saveKey(campaignId) {
  return `chronicle-forge:save:${campaignId}`;
}
function backupKey(campaignId) {
  return `chronicle-forge:save-backup:${campaignId}`;
}
function slotKey(campaignId, slot = "auto") {
  return slot === "auto" ? saveKey(campaignId) : `chronicle-forge:save:${campaignId}@${slot}`;
}
function slotBackupKey(campaignId, slot = "auto") {
  return slot === "auto" ? backupKey(campaignId) : `${slotKey(campaignId, slot)}-backup`;
}
function listSaveSlots(campaignId, campaign2) {
  const out = [];
  const collect = (slot) => {
    const raw = readRaw(slotKey(campaignId, slot));
    if (!raw) return;
    try {
      const env = parseStored(raw);
      if (!env) return;
      const v2 = env.save_version ?? env.state.save_version ?? OLDEST_SAVE_VERSION;
      if (v2 < OLDEST_SAVE_VERSION || v2 > SAVE_VERSION) return;
      const st2 = env.state;
      out.push({
        slot,
        envelope: env,
        scene: (campaign2?.scenes?.[st2.scene]?.label ?? st2.scene) || "",
        location: (campaign2 ? allLocations(campaign2.world).find((l2) => l2.id === st2.location)?.label ?? st2.location : st2.location) || "",
        tick: st2.tick ?? 0
      });
    } catch {
    }
  };
  collect("auto");
  for (let n2 = 1; n2 <= MAX_SAVE_SLOTS; n2++) collect(n2);
  return out;
}
function readRaw(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeRaw(key, text) {
  try {
    localStorage.setItem(key, text);
    return true;
  } catch {
    return false;
  }
}
function makeCtx() {
  const notes = [];
  return {
    notes,
    note(kind, text) {
      if (!notes.some((n2) => n2.kind === kind && n2.text === text)) notes.push({ kind, text });
    }
  };
}
function listShort(labels, max = 3) {
  if (labels.length === 0) return "";
  const quoted = labels.map((l2) => `\xAB${l2}\xBB`);
  if (quoted.length <= max) return quoted.join(", ");
  return `${quoted.slice(0, max).join(", ")} \u0438 \u0435\u0449\u0451 ${quoted.length - max}`;
}
function migrateState(state, ctx2) {
  const from = state.save_version ?? OLDEST_SAVE_VERSION;
  if (from > SAVE_VERSION) return false;
  let v2 = from;
  let guard = 0;
  while (v2 < SAVE_VERSION) {
    const step = SAVE_MIGRATIONS.find((m2) => m2.from === v2);
    if (!step) return false;
    step.apply(state, ctx2);
    v2 = step.to;
    state.save_version = v2;
    if (++guard > 64) return false;
  }
  state.save_version = SAVE_VERSION;
  if (from !== SAVE_VERSION) {
    ctx2.note("migrated", `\u0424\u043E\u0440\u043C\u0430\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0451\u043D: \u0432${from} \u2192 \u0432${SAVE_VERSION}.`);
  }
  return true;
}
function entityLabel(campaign2, id) {
  const e2 = campaign2.entities[id];
  return e2?.label || id;
}
function slotLabel(meta, slotId) {
  const slot = equipmentSlots(meta).find((s2) => s2.id === slotId);
  return slot?.label ?? slotId;
}
function repairState(state, campaign2, ctx2) {
  const meta = campaign2.meta;
  const ents = campaign2.entities;
  if (!state.player || typeof state.player !== "object") {
    ctx2.note("warning", "\u0412 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0438 \u043D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445 \u0433\u0435\u0440\u043E\u044F \u2014 \u0437\u0430\u0431\u0435\u0433 \u043D\u0430\u0447\u043D\u0451\u0442\u0441\u044F \u0437\u0430\u043D\u043E\u0432\u043E.");
    return;
  }
  const p2 = state.player;
  if (!ents[p2.entity]) {
    const fallback = meta.default_player;
    if (fallback && ents[fallback]) {
      ctx2.note("repaired", `\u0428\u0430\u0431\u043B\u043E\u043D \u0433\u0435\u0440\u043E\u044F \xAB${p2.entity}\xBB \u0443\u0434\u0430\u043B\u0451\u043D \u0438\u0437 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u2014 \u0432\u0437\u044F\u0442 \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u044B\u0439 \u0433\u0435\u0440\u043E\u0439.`);
      p2.entity = fallback;
    }
  }
  if (Array.isArray(p2.inventory)) {
    const gone = [];
    p2.inventory = p2.inventory.filter((entry) => {
      if (entry && ents[entry.item]) return true;
      gone.push(entry?.item ?? "?");
      return false;
    });
    if (gone.length) {
      ctx2.note("repaired", `\u0418\u0437 \u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u044F \u0443\u0431\u0440\u0430\u043D\u043E: ${listShort(gone.map((i2) => entityLabel(campaign2, i2)))} \u2014 \u044D\u0442\u0438\u0445 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435\u0442 \u0432 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438.`);
    }
  } else {
    p2.inventory = [];
  }
  const declaredSlots = new Set(equipmentSlots(meta).map((s2) => s2.id));
  for (const ent of Object.values(ents)) {
    if (ent.type === "item") {
      const s2 = ent.equip_slot || ent.slot;
      if (s2) declaredSlots.add(s2);
    }
  }
  if (p2.equipment && typeof p2.equipment === "object") {
    const removed = [];
    for (const [slot, item] of Object.entries(p2.equipment)) {
      if (!declaredSlots.has(slot)) {
        if (item && ents[item]) {
          p2.inventory.push({ item, quantity: 1 });
          removed.push(`\u0441\u043B\u043E\u0442 \xAB${slotLabel(meta, slot)}\xBB (\u043F\u0440\u0435\u0434\u043C\u0435\u0442 \xAB${entityLabel(campaign2, item)}\xBB \u043F\u0435\u0440\u0435\u043C\u0435\u0449\u0451\u043D \u0432 \u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u044C)`);
        } else {
          removed.push(`\u0441\u043B\u043E\u0442 \xAB${slotLabel(meta, slot)}\xBB`);
        }
        delete p2.equipment[slot];
      } else if (!item || !ents[item]) {
        removed.push(`${slotLabel(meta, slot)}: ${item ? entityLabel(campaign2, item) : "\u043F\u0443\u0441\u0442\u043E"}`);
        delete p2.equipment[slot];
      }
    }
    if (removed.length) {
      ctx2.note("repaired", `\u0421\u043D\u044F\u0442\u043E \u0441 \u0433\u0435\u0440\u043E\u044F: ${listShort(removed)} \u2014 \u0432 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u044D\u0442\u043E\u0433\u043E \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435\u0442.`);
    }
  } else {
    p2.equipment = {};
  }
  const known = /* @__PURE__ */ new Set([...(meta.skills ?? []).map((s2) => s2.id), ...Object.keys(BUILTIN_SKILL_LABELS)]);
  const dropSkills = (bag, out) => {
    if (!bag) return;
    for (const id of Object.keys(bag)) {
      if (!known.has(id)) {
        out.push(id);
        delete bag[id];
      }
    }
  };
  const goneSkills = [];
  dropSkills(p2.skills, goneSkills);
  dropSkills(p2.skill_marks, goneSkills);
  if (state.char_choice?.skills) dropSkills(state.char_choice.skills, goneSkills);
  if (goneSkills.length) {
    ctx2.note("repaired", `\u0423\u0431\u0440\u0430\u043D\u044B \u043D\u0430\u0432\u044B\u043A\u0438, \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u043D\u0435\u0442 \u0432 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438: ${listShort([...new Set(goneSkills)])}.`);
  }
  const needsNow = p2.needs && typeof p2.needs === "object" ? p2.needs : p2.needs = {};
  const added = [];
  const clamped = [];
  for (const need of meta.needs ?? []) {
    const cur = needsNow[need.id];
    if (typeof cur !== "number") {
      needsNow[need.id] = need.max;
      added.push(need.label);
      continue;
    }
    const next = Math.max(0, Math.min(need.max, cur));
    if (next !== cur) {
      needsNow[need.id] = next;
      clamped.push(need.label);
    }
  }
  if (added.length) ctx2.note("repaired", `\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u044B \u043D\u043E\u0432\u044B\u0435 \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0438 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438: ${listShort(added)} (\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F \u2014 \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C).`);
  if (clamped.length) ctx2.note("repaired", `\u0417\u043D\u0430\u0447\u0435\u043D\u0438\u044F \u043F\u0440\u0438\u0432\u0435\u0434\u0435\u043D\u044B \u043A \u043D\u043E\u0432\u043E\u043C\u0443 \u043F\u0440\u0435\u0434\u0435\u043B\u0443: ${listShort(clamped)}.`);
  const needIds = new Set((meta.needs ?? []).map((n2) => n2.id));
  const goneNeeds = Object.keys(needsNow).filter((id) => !needIds.has(id));
  for (const id of goneNeeds) delete needsNow[id];
  if (goneNeeds.length) ctx2.note("repaired", `\u0423\u0431\u0440\u0430\u043D\u044B \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0438, \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435\u0442 \u0432 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438: ${listShort(goneNeeds)}.`);
  if (Array.isArray(p2.statuses)) {
    const statusIds = new Set((meta.statuses ?? []).map((s2) => s2.id));
    const before = p2.statuses.length;
    p2.statuses = p2.statuses.filter((s2) => s2 && statusIds.has(s2.id));
    if (p2.statuses.length !== before) ctx2.note("repaired", "\u0421\u043D\u044F\u0442\u044B \u0441\u0442\u0430\u0442\u0443\u0441\u044B, \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435\u0442 \u0432 \u0440\u0435\u0435\u0441\u0442\u0440\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438.");
  }
  if (p2.stats && typeof p2.stats === "object") {
    const maxHp = typeof p2.max_hp === "number" && p2.max_hp > 0 ? p2.max_hp : derivedHP(p2.stats);
    const maxMp = typeof p2.max_mp === "number" && p2.max_mp >= 0 ? p2.max_mp : derivedMP(p2.stats);
    p2.max_hp = maxHp;
    p2.max_mp = maxMp;
    if (typeof p2.hp !== "number" || p2.hp > maxHp) p2.hp = maxHp;
    if (p2.hp < 0) p2.hp = 0;
    if (typeof p2.mp !== "number" || p2.mp > maxMp) p2.mp = maxMp;
    if (p2.mp < 0) p2.mp = 0;
  }
  if (Array.isArray(state.party)) {
    const gone = state.party.filter((c2) => !c2 || !ents[c2.entity]).map((c2) => entityLabel(campaign2, c2?.entity ?? "?"));
    state.party = state.party.filter((c2) => c2 && ents[c2.entity]);
    for (const c2 of state.party) {
      if (typeof c2.hp !== "number" || c2.hp > c2.max_hp) c2.hp = c2.max_hp;
    }
    if (gone.length) ctx2.note("repaired", `\u041E\u0442\u0440\u044F\u0434 \u043F\u043E\u043A\u0438\u043D\u0443\u043B\u0438: ${listShort(gone)} \u2014 \u0438\u0445 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435\u0442 \u0432 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438.`);
  } else {
    state.party = [];
  }
  if (state.quests && typeof state.quests === "object") {
    const dropped = [];
    const reset = [];
    for (const [qid, qs] of Object.entries(state.quests)) {
      const def = campaign2.quests[qid];
      if (!def || !qs) {
        dropped.push(campaign2.quests[qid]?.label ?? qid);
        delete state.quests[qid];
        continue;
      }
      if (!def.stages.some((s2) => s2.id === qs.stage)) {
        const first = def.stages[0];
        if (first) {
          qs.stage = first.id;
          reset.push(def.label);
        } else {
          delete state.quests[qid];
          dropped.push(def.label);
        }
      }
    }
    if (dropped.length) ctx2.note("repaired", `\u0418\u0437 \u0436\u0443\u0440\u043D\u0430\u043B\u0430 \u0443\u0431\u0440\u0430\u043D\u044B \u043A\u0432\u0435\u0441\u0442\u044B, \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435\u0442 \u0432 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438: ${listShort(dropped)}.`);
    if (reset.length) ctx2.note("repaired", `\u041A\u0432\u0435\u0441\u0442\u044B \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0435\u043D\u044B \u043D\u0430 \u043F\u0435\u0440\u0432\u0443\u044E \u0441\u0442\u0430\u0434\u0438\u044E (\u0441\u0442\u0430\u0434\u0438\u0438 \u043F\u0435\u0440\u0435\u0441\u0442\u0440\u043E\u0435\u043D\u044B): ${listShort(reset)}.`);
  } else {
    state.quests = {};
  }
  if (Array.isArray(state.fired_rules)) {
    const before = state.fired_rules.length;
    const gone = state.fired_rules.filter((id) => !campaign2.rules[id]);
    state.fired_rules = state.fired_rules.filter((id) => !!campaign2.rules[id]);
    if (state.fired_rules.length !== before) {
      ctx2.note("repaired", `\u0423\u0431\u0440\u0430\u043D\u044B \u043E\u0442\u043C\u0435\u0442\u043A\u0438 \u043E ${before - state.fired_rules.length} \u043F\u0440\u0430\u0432\u0438\u043B\u0435(\u0430\u0445), \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435\u0442 \u0432 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438.`);
    }
    void gone;
  }
  const locations = allLocations(campaign2.world);
  const locIds = new Set(locations.map((l2) => l2.id));
  const regionIds = /* @__PURE__ */ new Set();
  const walkRegions = (regions) => {
    for (const r2 of regions) {
      regionIds.add(r2.id);
      if (r2.sub_regions) walkRegions(r2.sub_regions);
    }
  };
  walkRegions(campaign2.world.regions);
  if (!locIds.has(state.location)) {
    ctx2.note("repaired", `\u041B\u043E\u043A\u0430\u0446\u0438\u044F \xAB${state.location}\xBB \u0443\u0434\u0430\u043B\u0435\u043D\u0430 \u0438\u0437 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u2014 \u0433\u0435\u0440\u043E\u0439 \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0451\u043D \u043D\u0430 \u0441\u0442\u0430\u0440\u0442 (${meta.starting_location}).`);
    state.location = meta.starting_location;
    state.scene = meta.starting_scene;
  } else {
    const loc = locations.find((l2) => l2.id === state.location);
    if (!campaign2.scenes[state.scene] || !loc.scenes.includes(state.scene)) {
      const next = loc.arrival_scene && campaign2.scenes[loc.arrival_scene] ? loc.arrival_scene : loc.scenes[0];
      if (next) {
        ctx2.note("repaired", `\u0421\u0446\u0435\u043D\u0430 \xAB${state.scene}\xBB \u0443\u0434\u0430\u043B\u0435\u043D\u0430 \u2014 \u0433\u0435\u0440\u043E\u0439 \u0432 \u0441\u0446\u0435\u043D\u0435 \xAB${next}\xBB.`);
        state.scene = next;
      }
    }
  }
  if (!regionIds.has(state.region)) {
    state.region = meta.starting_region;
    ctx2.note("repaired", "\u0420\u0435\u0433\u0438\u043E\u043D \u0443\u0434\u0430\u043B\u0451\u043D \u0438\u0437 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u2014 \u043E\u0442\u043A\u0440\u044B\u0442 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0439 \u0440\u0435\u0433\u0438\u043E\u043D.");
  }
  if (Array.isArray(state.revealed_locations)) {
    const before = state.revealed_locations.length;
    state.revealed_locations = state.revealed_locations.filter((id) => locIds.has(id));
    if (state.revealed_locations.length !== before) ctx2.note("repaired", "\u0421 \u043A\u0430\u0440\u0442\u044B \u0443\u0431\u0440\u0430\u043D\u044B \u043E\u0442\u043C\u0435\u0442\u043A\u0438 \u0443\u0434\u0430\u043B\u0451\u043D\u043D\u044B\u0445 \u043B\u043E\u043A\u0430\u0446\u0438\u0439.");
  }
  if (Array.isArray(state.blocked_paths)) {
    const before = state.blocked_paths.length;
    state.blocked_paths = state.blocked_paths.filter((pair) => {
      const [a2, b2] = String(pair).split("->");
      return locIds.has(a2) && locIds.has(b2);
    });
    if (state.blocked_paths.length !== before) ctx2.note("repaired", "\u0423\u0431\u0440\u0430\u043D\u044B \u043F\u0435\u0440\u0435\u043A\u0440\u044B\u0442\u044B\u0435 \u0434\u043E\u0440\u043E\u0433\u0438 \u043A \u0443\u0434\u0430\u043B\u0451\u043D\u043D\u044B\u043C \u043B\u043E\u043A\u0430\u0446\u0438\u044F\u043C.");
  }
  for (const field of ["dead_entities", "removed_entities"]) {
    const list = state[field];
    if (Array.isArray(list)) state[field] = list.filter((id) => !!ents[id]);
  }
  if (Array.isArray(state.spawned)) {
    const before = state.spawned.length;
    state.spawned = state.spawned.filter(
      (s2) => s2 && ents[s2.entity] && campaign2.scenes[s2.scene] && !!campaign2.scenes[s2.scene].slots.some((sl) => sl.id === s2.slot)
    );
    if (state.spawned.length !== before) ctx2.note("repaired", "\u0423\u0431\u0440\u0430\u043D\u044B \u0432\u044B\u0437\u0432\u0430\u043D\u043D\u044B\u0435 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0438, \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u0438\u043B\u0438 \u0447\u044C\u0438\u0445 \u043C\u0435\u0441\u0442 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435\u0442 \u0432 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438.");
  }
  if (state.desc_overrides) {
    const keys = Object.keys(state.desc_overrides).filter((id) => !ents[id]);
    for (const k2 of keys) delete state.desc_overrides[k2];
    if (keys.length) ctx2.note("repaired", "\u0423\u0431\u0440\u0430\u043D\u044B \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u044F \u0443\u0434\u0430\u043B\u0451\u043D\u043D\u044B\u0445 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0435\u0439 \u0438 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432.");
  }
  if (state.weather && !(meta.weathers ?? []).some((w2) => w2.id === state.weather)) {
    delete state.weather;
    ctx2.note("repaired", "\u041F\u043E\u0433\u043E\u0434\u0430 \u0443\u0431\u0440\u0430\u043D\u0430: \u0442\u0430\u043A\u043E\u0439 \u043F\u043E\u0433\u043E\u0434\u044B \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435\u0442 \u0432 \u0440\u0435\u0435\u0441\u0442\u0440\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438.");
  }
  if (Array.isArray(state.codex_unlocked)) {
    const before = state.codex_unlocked.length;
    state.codex_unlocked = state.codex_unlocked.filter((id) => !!campaign2.codex[id]);
    if (state.codex_unlocked.length !== before) ctx2.note("repaired", "\u0418\u0437 \u043A\u043E\u0434\u0435\u043A\u0441\u0430 \u0443\u0431\u0440\u0430\u043D\u044B \u0437\u0430\u043F\u0438\u0441\u0438, \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435\u0442 \u0432 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438.");
  }
  if (state.dispositions) {
    const factionIds = new Set((meta.factions ?? []).map((f2) => f2.id));
    const keys = Object.keys(state.dispositions).filter((id) => !factionIds.has(id) && !ents[id]);
    for (const k2 of keys) delete state.dispositions[k2];
    if (keys.length) ctx2.note("repaired", "\u0423\u0431\u0440\u0430\u043D\u044B \u043E\u0442\u043D\u043E\u0448\u0435\u043D\u0438\u044F \u0441 \u0444\u0440\u0430\u043A\u0446\u0438\u044F\u043C\u0438 \u0438 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430\u043C\u0438, \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435\u0442 \u0432 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438.");
  }
}
function parseStored(raw) {
  const data = JSON.parse(raw);
  if (!data || typeof data !== "object") return null;
  if (typeof data.envelope_version === "number" && data.state && typeof data.state === "object") {
    return data;
  }
  const state = data;
  if (!state.player || typeof state.player !== "object") return null;
  return {
    envelope_version: SAVE_ENVELOPE_VERSION,
    save_version: state.save_version ?? OLDEST_SAVE_VERSION,
    campaign_id: state.campaign_id ?? "",
    campaign_version: void 0,
    engine_version: void 0,
    state
  };
}
function makeEnvelope(state, campaignId, campaignVersion, prev) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    envelope_version: SAVE_ENVELOPE_VERSION,
    save_version: SAVE_VERSION,
    campaign_id: campaignId,
    campaign_version: campaignVersion,
    engine_version: ENGINE_VERSION,
    created_at: prev?.created_at ?? now,
    updated_at: now,
    tick: state.tick,
    location: state.location,
    state
  };
}
function checkSaveVersion(saveCampaignVersion, meta) {
  const base = meta.save_base_version;
  if (!base) return { kind: "ok", repaired: false };
  if (!saveCampaignVersion) return { kind: "ok", repaired: false };
  if (compareVersions(saveCampaignVersion, base) >= 0) return { kind: "ok", repaired: false };
  return {
    kind: "unsupported",
    save_version: saveCampaignVersion,
    base_version: base,
    reason: `\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u0441\u0434\u0435\u043B\u0430\u043D\u043E \u0432 \u0432\u0435\u0440\u0441\u0438\u0438 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 ${saveCampaignVersion}, \u0430 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043D\u0430\u0447\u0438\u043D\u0430\u044F \u0441 ${base}.`
  };
}
function inspectSave(campaignId, campaign2, slot = "auto") {
  const raw = readRaw(slotKey(campaignId, slot));
  if (!raw) return null;
  const ctx2 = makeCtx();
  const report = { from_version: 0, to_version: SAVE_VERSION, notes: ctx2.notes, repaired: false };
  let envelope = null;
  try {
    envelope = parseStored(raw);
  } catch {
    envelope = null;
  }
  if (!envelope) {
    return {
      state: null,
      envelope: null,
      report: { ...report, notes: [{ kind: "warning", text: "\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u043E \u0438 \u043D\u0435 \u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F." }] },
      verdict: { kind: "too_old", reason: "\u0424\u0430\u0439\u043B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D." }
    };
  }
  const state = envelope.state;
  if (typeof envelope.save_version === "number") state.save_version = envelope.save_version;
  report.from_version = state.save_version ?? OLDEST_SAVE_VERSION;
  report.campaign_version = envelope.campaign_version;
  const verdictVersion = checkSaveVersion(envelope.campaign_version, campaign2.meta);
  if (verdictVersion.kind === "unsupported") {
    return {
      state,
      envelope,
      report: { ...report, notes: [{ kind: "warning", text: verdictVersion.reason }] },
      verdict: verdictVersion
    };
  }
  if (!migrateState(state, ctx2)) {
    const reason = (state.save_version ?? 0) > SAVE_VERSION ? `\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u0441\u0434\u0435\u043B\u0430\u043D\u043E \u0431\u043E\u043B\u0435\u0435 \u043D\u043E\u0432\u044B\u043C \u0434\u0432\u0438\u0436\u043A\u043E\u043C (\u0444\u043E\u0440\u043C\u0430\u0442 \u0432${state.save_version}, \u044D\u0442\u043E\u0442 \u0434\u0432\u0438\u0436\u043E\u043A \u043F\u043E\u043D\u0438\u043C\u0430\u0435\u0442 \u0434\u043E \u0432${SAVE_VERSION}).` : `\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0441\u0442\u0430\u0440\u043E\u0435 (\u0444\u043E\u0440\u043C\u0430\u0442 \u0432${report.from_version}, \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0441 \u0432${OLDEST_SAVE_VERSION}).`;
    return { state, envelope, report: { ...report, notes: [...ctx2.notes, { kind: "warning", text: reason }] }, verdict: { kind: "too_old", reason } };
  }
  repairState(state, campaign2, ctx2);
  report.repaired = ctx2.notes.some((n2) => n2.kind === "repaired");
  return { state, envelope, report, verdict: { kind: "ok", repaired: report.repaired } };
}
function openSave(campaignId, campaign2, slot = "auto") {
  const opened = inspectSave(campaignId, campaign2, slot);
  if (!opened || opened.verdict.kind !== "ok") return opened;
  const raw = readRaw(slotKey(campaignId, slot));
  const changed = opened.report.notes.length > 0 || opened.report.from_version !== SAVE_VERSION || !opened.envelope.campaign_version;
  if (!changed || !raw) return opened;
  if (!readRaw(slotBackupKey(campaignId, slot))) writeRaw(slotBackupKey(campaignId, slot), raw);
  const next = makeEnvelope(opened.state, campaignId, campaign2.meta.version, opened.envelope);
  if (writeRaw(slotKey(campaignId, slot), JSON.stringify(next))) opened.envelope = next;
  return opened;
}
function writeSave(campaignId, state, campaignVersion, prev, slot = "auto") {
  const envelope = makeEnvelope(state, campaignId, campaignVersion, prev);
  return writeRaw(slotKey(campaignId, slot), JSON.stringify(envelope)) ? envelope : null;
}
function peekSave(campaignId, slot = "auto") {
  const raw = readRaw(slotKey(campaignId, slot));
  if (!raw) return null;
  try {
    const env = parseStored(raw);
    if (!env) return null;
    const v2 = env.save_version ?? env.state.save_version ?? OLDEST_SAVE_VERSION;
    if (v2 < OLDEST_SAVE_VERSION || v2 > SAVE_VERSION) return null;
    return env;
  } catch {
    return null;
  }
}
function preserveSave(campaignId, slot = "auto") {
  const raw = readRaw(slotKey(campaignId, slot));
  if (!raw) return false;
  const kept = readRaw(slotBackupKey(campaignId, slot)) ? true : writeRaw(slotBackupKey(campaignId, slot), raw);
  if (!kept) return false;
  try {
    localStorage.removeItem(slotKey(campaignId, slot));
  } catch {
    return false;
  }
  return true;
}
function removeSave(campaignId, slot = "auto") {
  try {
    localStorage.removeItem(slotKey(campaignId, slot));
    localStorage.removeItem(slotBackupKey(campaignId, slot));
  } catch {
  }
}
function loadState(campaignId, slot = "auto") {
  const raw = readRaw(slotKey(campaignId, slot));
  if (!raw) return null;
  try {
    const env = parseStored(raw);
    if (!env) return null;
    const ctx2 = makeCtx();
    if (!migrateState(env.state, ctx2)) return null;
    return env.state;
  } catch {
    return null;
  }
}
function exportSaveText(campaignId, slot = "auto") {
  return readRaw(slotKey(campaignId, slot));
}
function importSaveText(campaignId, text, slot = "auto") {
  try {
    const env = parseStored(text);
    if (!env) return false;
    return writeRaw(slotKey(campaignId, slot), JSON.stringify(env));
  } catch {
    return false;
  }
}
var OLDEST_SAVE_VERSION, MAX_SAVE_SLOTS, SAVE_MIGRATIONS;
var init_savemigrate = __esm({
  "src/core/savemigrate.ts"() {
    init_types();
    init_versions();
    init_skills();
    init_migrate();
    init_brp();
    init_versions();
    OLDEST_SAVE_VERSION = 1;
    MAX_SAVE_SLOTS = 5;
    SAVE_MIGRATIONS = [
      {
        from: 1,
        to: 2,
        title: "\u0431\u0430\u0437\u043E\u0432\u044B\u0435 \u043F\u043E\u043B\u044F \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F",
        apply(state, ctx2) {
          const p2 = state.player;
          if (!p2) return;
          let touched = false;
          if (!p2.skills || typeof p2.skills !== "object") {
            p2.skills = {};
            touched = true;
          }
          if (!p2.skill_marks || typeof p2.skill_marks !== "object") {
            p2.skill_marks = {};
            touched = true;
          }
          if (!p2.needs || typeof p2.needs !== "object") {
            p2.needs = {};
            touched = true;
          }
          if (!Array.isArray(state.fired_rules)) {
            state.fired_rules = [];
            touched = true;
          }
          if (!Array.isArray(state.log)) {
            state.log = [];
            touched = true;
          }
          if (touched) ctx2.note("migrated", "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u044B \u0431\u0430\u0437\u043E\u0432\u044B\u0435 \u043F\u043E\u043B\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F (\u043D\u0430\u0432\u044B\u043A\u0438, \u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u0438, \u0436\u0443\u0440\u043D\u0430\u043B).");
        }
      },
      {
        from: 2,
        to: 3,
        title: "\u044D\u043A\u0438\u043F\u0438\u0440\u043E\u0432\u043A\u0430 \u0438 \u0432\u0430\u043B\u044E\u0442\u044B",
        apply(state, ctx2) {
          const p2 = state.player;
          if (!p2) return;
          if (p2.currencies) {
            delete p2.currencies;
            ctx2.note("migrated", "\u0411\u0430\u043B\u0430\u043D\u0441 \u0432\u0430\u043B\u044E\u0442 \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0451\u043D \u0432 \u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u044C (\u043C\u043E\u043D\u0435\u0442\u044B \u2014 \u043E\u0431\u044B\u0447\u043D\u044B\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B).");
          }
          if (!Array.isArray(p2.inventory)) {
            p2.inventory = [];
            ctx2.note("migrated", "\u0418\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u044C \u043F\u0435\u0440\u0435\u0441\u043E\u0437\u0434\u0430\u043D: \u0432 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0438 \u043D\u0435 \u0431\u044B\u043B\u043E \u0441\u043F\u0438\u0441\u043A\u0430 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432.");
          }
        }
      },
      {
        from: 3,
        to: 4,
        title: "\u0441\u043B\u043E\u0442\u044B \u044D\u043A\u0438\u043F\u0438\u0440\u043E\u0432\u043A\u0438",
        apply(state, ctx2) {
          const p2 = state.player;
          if (!p2) return;
          if (!p2.equipment || typeof p2.equipment !== "object") {
            p2.equipment = {};
            ctx2.note("migrated", "\u0421\u043F\u0438\u0441\u043E\u043A \u043D\u0430\u0434\u0435\u0442\u044B\u0445 \u0432\u0435\u0449\u0435\u0439 \u043F\u0435\u0440\u0435\u0441\u043E\u0437\u0434\u0430\u043D (\u0432 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0438 \u043D\u0435 \u0431\u044B\u043B\u043E \u044D\u043A\u0438\u043F\u0438\u0440\u043E\u0432\u043A\u0438).");
          }
        }
      }
    ];
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

// src/core/time.ts
function hourOfDay(tick, meta) {
  return (tick % meta.ticks_per_day + meta.ticks_per_day) % meta.ticks_per_day;
}
function timeOfDay(tick, meta) {
  const t5 = meta.time_of_day ?? DEFAULT_THRESHOLDS;
  const h2 = hourOfDay(tick, meta);
  if (h2 >= t5.night || h2 < t5.morning) return "night";
  if (h2 >= t5.evening) return "evening";
  if (h2 >= t5.day) return "day";
  return "morning";
}
function inTimeRange(hour, range) {
  const [from, to] = range;
  if (from <= to) return hour >= from && hour < to;
  return hour >= from || hour < to;
}
var DEFAULT_THRESHOLDS;
var init_time = __esm({
  "src/core/time.ts"() {
    DEFAULT_THRESHOLDS = { morning: 6, day: 11, evening: 18, night: 22 };
  }
});

// src/core/conditions.ts
function evalCondition(c2, engine) {
  const s2 = engine.state;
  switch (c2.type) {
    case "player_enters_location":
      return s2.location === c2.location;
    case "player_enters_scene":
      return s2.scene === c2.scene;
    case "flag_set":
      return !!s2.flags[c2.flag];
    case "flag_not_set":
      return !s2.flags[c2.flag];
    case "variable_compare": {
      const v2 = s2.variables[c2.var] ?? 0;
      switch (c2.operator) {
        case "==":
          return v2 === c2.value;
        case "!=":
          return v2 !== c2.value;
        case "<":
          return Number(v2) < Number(c2.value);
        case ">":
          return Number(v2) > Number(c2.value);
        case "<=":
          return Number(v2) <= Number(c2.value);
        case ">=":
          return Number(v2) >= Number(c2.value);
      }
      return false;
    }
    case "time_of_day": {
      const tod = timeOfDay(s2.tick, engine.campaign.meta);
      const vals = Array.isArray(c2.value) ? c2.value : [c2.value];
      return vals.includes(tod);
    }
    case "tick_elapsed":
      return s2.tick >= c2.min_tick;
    case "elapsed_ge":
      return s2.tick - startTick(engine.campaign.meta) >= c2.min;
    case "quest_at_stage":
      return s2.quests[c2.quest]?.stage === c2.stage;
    case "has_item": {
      const entry = s2.player.inventory.find((i2) => i2.item === c2.item);
      return !!entry && entry.quantity >= (c2.min_quantity ?? 1);
    }
    case "equipped":
      return engine.isEquipped(c2.item);
    case "skill_ge":
      return (s2.player.skills[c2.skill] ?? 0) >= c2.threshold;
    case "stat_ge":
      return (s2.player.stats[c2.stat] ?? 0) >= c2.threshold;
    case "hp_le":
      return s2.player.hp <= c2.threshold;
    case "hp_ge":
      return s2.player.hp >= c2.threshold;
    case "luck_ge":
      return engine.luck() >= c2.threshold;
    case "fatigue_ge":
      return engine.fatigue() >= c2.threshold;
    case "fatigue_le":
      return engine.fatigue() <= c2.threshold;
    case "sanity_ge":
      return engine.sanity() >= c2.threshold;
    case "sanity_le":
      return engine.sanity() <= c2.threshold;
    case "reputation_ge":
      return engine.reputation() >= c2.threshold;
    case "wealth_ge":
      return engine.wealthLevel() >= c2.level;
    case "passion_ge":
      return (s2.player.passions?.[c2.id] ?? 0) >= c2.value;
    case "allegiance_ge":
      return (s2.player.allegiance?.[c2.id] ?? 0) >= c2.points;
    case "power_level_ge": {
      const order = ["normal", "heroic", "epic", "superhuman"];
      return order.indexOf(engine.campaign.meta.power_level ?? "normal") >= order.indexOf(c2.level);
    }
    case "need_le":
      return (s2.player.needs[c2.need] ?? 0) <= c2.threshold;
    case "need_ge":
      return (s2.player.needs[c2.need] ?? 0) >= c2.threshold;
    case "entity_alive":
      return !s2.dead_entities.includes(c2.entity);
    case "entity_dead":
      return s2.dead_entities.includes(c2.entity);
    case "disposition_ge":
      return engine.getDisposition(c2.target) >= c2.threshold;
    case "disposition_le":
      return engine.getDisposition(c2.target) <= c2.threshold;
    case "in_party":
      return engine.isInParty(c2.entity);
    case "companion_need_le": {
      const v2 = engine.companionNeed(c2.entity, c2.need);
      return v2 != null && v2 <= c2.threshold;
    }
    case "companion_need_ge": {
      const v2 = engine.companionNeed(c2.entity, c2.need);
      return v2 == null || v2 >= c2.threshold;
    }
    case "has_status":
      return engine.hasStatus(c2.status);
    case "weather_is":
      return (s2.weather ?? "") === c2.weather;
    case "npc_known": {
      const known = engine.isNpcNameKnown(c2.entity);
      return c2.known === false ? !known : known;
    }
    case "random_chance":
      return engine.rng.chance(c2.probability);
    case "crime_committed":
      return engine.hasCrime(c2.id, c2.min_bounty ?? 0);
    case "bounty_total_ge":
      return engine.bountyTotal() >= c2.threshold;
    case "level_ge":
      return engine.level() >= c2.level;
    case "meta_currency_ge":
      return engine.metaCurrency(c2.currency) >= c2.threshold;
    case "meta_achievement":
      return engine.metaAchievementDone(c2.id);
    case "meta_counter":
      return engine.metaCounter(c2.key) >= c2.ge;
    case "has_feat":
      return (engine.state.player.feats ?? []).includes(c2.id);
    case "and":
      return (c2.conditions ?? []).every((x2) => evalCondition(x2, engine));
    case "or":
      return (c2.conditions ?? []).some((x2) => evalCondition(x2, engine));
    case "not":
      return !evalCondition(c2.condition, engine);
    default:
      return false;
  }
}
function evalSceneCondition(c2, engine) {
  if (!c2) return true;
  if (c2.time_of_day) {
    const tod = timeOfDay(engine.state.tick, engine.campaign.meta);
    const vals = Array.isArray(c2.time_of_day) ? c2.time_of_day : [c2.time_of_day];
    if (!vals.includes(tod)) return false;
  }
  if (c2.flag && !engine.state.flags[c2.flag]) return false;
  if (c2.not_flag && engine.state.flags[c2.not_flag]) return false;
  if (c2.weather !== void 0 && (engine.state.weather ?? "") !== c2.weather) return false;
  return true;
}
var init_conditions = __esm({
  "src/core/conditions.ts"() {
    init_types();
    init_time();
  }
});

// node_modules/inkjs/dist/ink-full.mjs
function r(t5, e2) {
  return t5 instanceof e2 ? h(t5) : null;
}
function s(t5, e2) {
  if (t5 instanceof e2) return h(t5);
  throw new Error(`${t5} is not of type ${e2}`);
}
function a(t5) {
  return t5.hasValidName && t5.name ? t5 : null;
}
function o(t5) {
  return void 0 === t5 ? null : t5;
}
function l(t5) {
  return "object" == typeof t5 && "function" == typeof t5.Equals;
}
function h(t5, e2) {
  return t5;
}
function u(t5) {
  return null != t5;
}
function C(t5) {
  throw new v(`${t5} is null or undefined`);
}
function _(t5, e2, n2) {
  if (null === t5) return { result: n2, exists: false };
  let i2 = t5.get(e2);
  return void 0 === i2 ? { result: n2, exists: false } : { result: i2, exists: true };
}
function ht(t5) {
  let e2 = t5.parent;
  for (; e2; ) {
    if (e2.hasOwnProperty("iamFlowbase") && e2.iamFlowbase()) return e2;
    e2 = e2.parent;
  }
  return null;
}
var t, e, n, i, c, d, p, m, f, g, v, S, y, b, w, E, T, x, A, P, N, I, O, F, W, R, k, D, L, V, j, B, M, G, $, q, U, K, H, J, z, X, Y, Z, Q, tt, et, nt, it, rt, st, at, ot, lt, ut, ct, dt, pt, mt, ft, gt, vt, Ct, St, yt, bt, wt, Et, _t, Tt, xt, At, Pt, Nt, It, Ot, Ft, Wt, Rt, kt, Dt, Lt, Vt, jt, Bt, Mt, Gt, $t, qt, Ut, Kt, Ht, Jt, zt, Xt, Yt, Zt, Qt, te, ee, ne, ie, re, se, ae, oe, le, ue;
var init_ink_full = __esm({
  "node_modules/inkjs/dist/ink-full.mjs"() {
    t = class {
      constructor() {
        let t5 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : null, e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : [], n2 = arguments.length > 2 && void 0 !== arguments[2] && arguments[2], i2 = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : null, r2 = arguments.length > 4 && void 0 !== arguments[4] ? arguments[4] : null;
        this.sourceFilename = t5, this.pluginNames = e2, this.countAllVisits = n2, this.errorHandler = i2, this.fileHandler = r2;
      }
    };
    e = class {
      constructor(t5, e2, n2) {
        this.length = t5, this.debugMetadata = e2, this.text = n2;
      }
    };
    !(function(t5) {
      t5[t5.Author = 0] = "Author", t5[t5.Warning = 1] = "Warning", t5[t5.Error = 2] = "Error";
    })(n || (n = {}));
    i = class {
      constructor() {
        let t5 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : null, e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null, n2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : null;
        this.identifier = t5, this.isByReference = e2, this.isDivertTarget = n2;
      }
      get typeName() {
        return "Argument";
      }
    };
    c = class {
      constructor() {
        var t5 = this;
        this._alreadyHadError = false, this._alreadyHadWarning = false, this._debugMetadata = null, this._runtimeObject = null, this.content = [], this.parent = null, this.GetType = () => this.typeName, this.AddContent = (t6) => {
          null === this.content && (this.content = []);
          const e2 = Array.isArray(t6) ? t6 : [t6];
          for (const t7 of e2) t7.hasOwnProperty("parent") && (t7.parent = this), this.content.push(t7);
          return Array.isArray(t6) ? void 0 : t6;
        }, this.InsertContent = (t6, e2) => (null === this.content && (this.content = []), e2.parent = this, this.content.splice(t6, 0, e2), e2), this.Find = (e2) => function() {
          let n2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : null, i2 = r(t5, e2);
          if (null !== i2 && (null === n2 || true === n2(i2))) return i2;
          if (null === t5.content) return null;
          for (const i3 of t5.content) {
            let t6 = i3.Find && i3.Find(e2)(n2);
            if (t6) return t6;
          }
          return null;
        }, this.FindAll = (t6) => (e2, n2) => {
          const i2 = Array.isArray(n2) ? n2 : [], s2 = r(this, t6);
          if (null === s2 || e2 && true !== e2(s2) || i2.push(s2), null === this.content) return [];
          for (const n3 of this.content) n3.FindAll && n3.FindAll(t6)(e2, i2);
          return i2;
        }, this.Warning = function(e2) {
          let n2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null;
          t5.Error(e2, n2, true);
        };
      }
      get debugMetadata() {
        return null === this._debugMetadata && this.parent ? this.parent.debugMetadata : this._debugMetadata;
      }
      set debugMetadata(t5) {
        this._debugMetadata = t5;
      }
      get hasOwnDebugMetadata() {
        return Boolean(this.debugMetadata);
      }
      get typeName() {
        return "ParsedObject";
      }
      get story() {
        let t5 = this;
        for (; t5.parent; ) t5 = t5.parent;
        return t5;
      }
      get runtimeObject() {
        return this._runtimeObject || (this._runtimeObject = this.GenerateRuntimeObject(), this._runtimeObject && (this._runtimeObject.debugMetadata = this.debugMetadata)), this._runtimeObject;
      }
      set runtimeObject(t5) {
        this._runtimeObject = t5;
      }
      get runtimePath() {
        if (!this.runtimeObject.path) throw new Error();
        return this.runtimeObject.path;
      }
      get containerForCounting() {
        return this.runtimeObject;
      }
      get ancestry() {
        let t5 = [], e2 = this.parent;
        for (; e2; ) t5.push(e2), e2 = e2.parent;
        return t5 = t5.reverse(), t5;
      }
      ResolveReferences(t5) {
        if (null !== this.content) for (const e2 of this.content) e2.ResolveReferences(t5);
      }
      Error(t5) {
        let e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null, n2 = arguments.length > 2 && void 0 !== arguments[2] && arguments[2];
        if (null === e2 && (e2 = this), !(e2._alreadyHadError && !n2 || e2._alreadyHadWarning && n2)) {
          if (!this.parent) throw new Error(`No parent object to send error to: ${t5}`);
          this.parent.Error(t5, e2, n2), n2 ? e2._alreadyHadWarning = true : e2._alreadyHadError = true;
        }
      }
    };
    d = class extends c {
      constructor(t5) {
        super(), this.warningMessage = t5, this.GenerateRuntimeObject = () => (this.Warning(this.warningMessage), null);
      }
      get typeName() {
        return "AuthorWarning";
      }
    };
    p = class t2 {
      constructor() {
        if (this._components = [], this._componentsString = null, this._isRelative = false, "string" == typeof arguments[0]) {
          let t5 = arguments[0];
          this.componentsString = t5;
        } else if (arguments[0] instanceof t2.Component && arguments[1] instanceof t2) {
          let t5 = arguments[0], e2 = arguments[1];
          this._components.push(t5), this._components = this._components.concat(e2._components);
        } else if (arguments[0] instanceof Array) {
          let t5 = arguments[0], e2 = !!arguments[1];
          this._components = this._components.concat(t5), this._isRelative = e2;
        }
      }
      get isRelative() {
        return this._isRelative;
      }
      get componentCount() {
        return this._components.length;
      }
      get head() {
        return this._components.length > 0 ? this._components[0] : null;
      }
      get tail() {
        if (this._components.length >= 2) {
          let e2 = this._components.slice(1, this._components.length);
          return new t2(e2);
        }
        return t2.self;
      }
      get length() {
        return this._components.length;
      }
      get lastComponent() {
        let t5 = this._components.length - 1;
        return t5 >= 0 ? this._components[t5] : null;
      }
      get containsNamedComponent() {
        for (let t5 = 0, e2 = this._components.length; t5 < e2; t5++) if (!this._components[t5].isIndex) return true;
        return false;
      }
      static get self() {
        let e2 = new t2();
        return e2._isRelative = true, e2;
      }
      GetComponent(t5) {
        return this._components[t5];
      }
      PathByAppendingPath(e2) {
        let n2 = new t2(), i2 = 0;
        for (let t5 = 0; t5 < e2._components.length && e2._components[t5].isParent; ++t5) i2++;
        for (let t5 = 0; t5 < this._components.length - i2; ++t5) n2._components.push(this._components[t5]);
        for (let t5 = i2; t5 < e2._components.length; ++t5) n2._components.push(e2._components[t5]);
        return n2;
      }
      get componentsString() {
        return null == this._componentsString && (this._componentsString = this._components.join("."), this.isRelative && (this._componentsString = "." + this._componentsString)), this._componentsString;
      }
      set componentsString(e2) {
        if (this._components.length = 0, this._componentsString = e2, null == this._componentsString || "" == this._componentsString) return;
        "." == this._componentsString[0] && (this._isRelative = true, this._componentsString = this._componentsString.substring(1));
        let n2 = this._componentsString.split(".");
        for (let e3 of n2) /^(\-|\+)?([0-9]+|Infinity)$/.test(e3) ? this._components.push(new t2.Component(parseInt(e3))) : this._components.push(new t2.Component(e3));
      }
      toString() {
        return this.componentsString;
      }
      Equals(t5) {
        if (null == t5) return false;
        if (t5._components.length != this._components.length) return false;
        if (t5.isRelative != this.isRelative) return false;
        for (let e2 = 0, n2 = t5._components.length; e2 < n2; e2++) if (!t5._components[e2].Equals(this._components[e2])) return false;
        return true;
      }
      PathByAppendingComponent(e2) {
        let n2 = new t2();
        return n2._components.push(...this._components), n2._components.push(e2), n2;
      }
    };
    p.parentId = "^", (function(t5) {
      class e2 {
        constructor(t6) {
          this.index = -1, this.name = null, "string" == typeof t6 ? this.name = t6 : this.index = t6;
        }
        get isIndex() {
          return this.index >= 0;
        }
        get isParent() {
          return this.name == t5.parentId;
        }
        static ToParent() {
          return new e2(t5.parentId);
        }
        toString() {
          return this.isIndex ? this.index.toString() : this.name;
        }
        Equals(t6) {
          return null != t6 && t6.isIndex == this.isIndex && (this.isIndex ? this.index == t6.index : this.name == t6.name);
        }
      }
      t5.Component = e2;
    })(p || (p = {})), (function(t5) {
      function e2(t6, e3) {
        if (!t6) throw void 0 !== e3 && console.warn(e3), console.trace && console.trace(), new Error("");
      }
      t5.AssertType = function(t6, n2, i2) {
        e2(t6 instanceof n2, i2);
      }, t5.Assert = e2;
    })(m || (m = {}));
    v = class extends Error {
    };
    S = class {
      constructor() {
        this.parent = null, this._debugMetadata = null, this._path = null;
      }
      get debugMetadata() {
        return null === this._debugMetadata && this.parent ? this.parent.debugMetadata : this._debugMetadata;
      }
      set debugMetadata(t5) {
        this._debugMetadata = t5;
      }
      get ownDebugMetadata() {
        return this._debugMetadata;
      }
      DebugLineNumberOfPath(t5) {
        if (null === t5) return null;
        let e2 = this.rootContentContainer;
        if (e2) {
          let n2 = e2.ContentAtPath(t5).obj;
          if (n2) {
            let t6 = n2.debugMetadata;
            if (null !== t6) return t6.startLineNumber;
          }
        }
        return null;
      }
      get path() {
        if (null == this._path) if (null == this.parent) this._path = new p();
        else {
          let t5 = [], e2 = this, n2 = r(e2.parent, k);
          for (; null !== n2; ) {
            let i2 = a(e2);
            if (null != i2 && i2.hasValidName) {
              if (null === i2.name) return C("namedChild.name");
              t5.unshift(new p.Component(i2.name));
            } else t5.unshift(new p.Component(n2.content.indexOf(e2)));
            e2 = n2, n2 = r(n2.parent, k);
          }
          this._path = new p(t5);
        }
        return this._path;
      }
      ResolvePath(t5) {
        if (null === t5) return C("path");
        if (t5.isRelative) {
          let e2 = r(this, k);
          return null === e2 && (m.Assert(null !== this.parent, "Can't resolve relative path because we don't have a parent"), e2 = r(this.parent, k), m.Assert(null !== e2, "Expected parent to be a container"), m.Assert(t5.GetComponent(0).isParent), t5 = t5.tail), null === e2 ? C("nearestContainer") : e2.ContentAtPath(t5);
        }
        {
          let e2 = this.rootContentContainer;
          return null === e2 ? C("contentContainer") : e2.ContentAtPath(t5);
        }
      }
      ConvertPathToRelative(t5) {
        let e2 = this.path, n2 = Math.min(t5.length, e2.length), i2 = -1;
        for (let r3 = 0; r3 < n2; ++r3) {
          let n3 = e2.GetComponent(r3), s3 = t5.GetComponent(r3);
          if (!n3.Equals(s3)) break;
          i2 = r3;
        }
        if (-1 == i2) return t5;
        let r2 = e2.componentCount - 1 - i2, s2 = [];
        for (let t6 = 0; t6 < r2; ++t6) s2.push(p.Component.ToParent());
        for (let e3 = i2 + 1; e3 < t5.componentCount; ++e3) s2.push(t5.GetComponent(e3));
        return new p(s2, true);
      }
      CompactPathString(t5) {
        let e2 = null, n2 = null;
        if (t5.isRelative) n2 = t5.componentsString, e2 = this.path.PathByAppendingPath(t5).componentsString;
        else {
          n2 = this.ConvertPathToRelative(t5).componentsString, e2 = t5.componentsString;
        }
        return n2.length < e2.length ? n2 : e2;
      }
      get rootContentContainer() {
        let t5 = this;
        for (; t5.parent; ) t5 = t5.parent;
        return r(t5, k);
      }
      Copy() {
        throw Error("Not Implemented: Doesn't support copying");
      }
      SetChild(t5, e2, n2) {
        t5[e2] && (t5[e2] = null), t5[e2] = n2, t5[e2] && (t5[e2].parent = this);
      }
      Equals(t5) {
        return t5 === this;
      }
    };
    y = class {
      constructor(t5) {
        t5 = void 0 !== t5 ? t5.toString() : "", this.string = t5;
      }
      get Length() {
        return this.string.length;
      }
      Append(t5) {
        null !== t5 && (this.string += t5);
      }
      AppendLine(t5) {
        void 0 !== t5 && this.Append(t5), this.string += "\n";
      }
      AppendFormat(t5) {
        for (var e2 = arguments.length, n2 = new Array(e2 > 1 ? e2 - 1 : 0), i2 = 1; i2 < e2; i2++) n2[i2 - 1] = arguments[i2];
        this.string += t5.replace(/{(\d+)}/g, ((t6, e3) => void 0 !== n2[e3] ? n2[e3] : t6));
      }
      toString() {
        return this.string;
      }
      Clear() {
        this.string = "";
      }
    };
    b = class _b {
      constructor() {
        if (this.originName = null, this.itemName = null, void 0 !== arguments[1]) {
          let t5 = arguments[0], e2 = arguments[1];
          this.originName = t5, this.itemName = e2;
        } else if (arguments[0]) {
          let t5 = arguments[0].toString().split(".");
          this.originName = t5[0], this.itemName = t5[1];
        }
      }
      static get Null() {
        return new _b(null, null);
      }
      get isNull() {
        return null == this.originName && null == this.itemName;
      }
      get fullName() {
        return (null !== this.originName ? this.originName : "?") + "." + this.itemName;
      }
      toString() {
        return this.fullName;
      }
      Equals(t5) {
        if (t5 instanceof _b) {
          let e2 = t5;
          return e2.itemName == this.itemName && e2.originName == this.originName;
        }
        return false;
      }
      copy() {
        return new _b(this.originName, this.itemName);
      }
      serialized() {
        return JSON.stringify({ originName: this.originName, itemName: this.itemName });
      }
      static fromSerializedKey(t5) {
        let e2 = JSON.parse(t5);
        if (!_b.isLikeInkListItem(e2)) return _b.Null;
        let n2 = e2;
        return new _b(n2.originName, n2.itemName);
      }
      static isLikeInkListItem(t5) {
        return "object" == typeof t5 && (!(!t5.hasOwnProperty("originName") || !t5.hasOwnProperty("itemName")) && (("string" == typeof t5.originName || null === typeof t5.originName) && ("string" == typeof t5.itemName || null === typeof t5.itemName)));
      }
    };
    w = class _w extends Map {
      constructor() {
        if (super(arguments[0] instanceof _w ? arguments[0] : []), this.origins = null, this._originNames = [], arguments[0] instanceof _w) {
          let t5 = arguments[0], e2 = t5.originNames;
          null !== e2 && (this._originNames = e2.slice()), null !== t5.origins && (this.origins = t5.origins.slice());
        } else if ("string" == typeof arguments[0]) {
          let t5 = arguments[0], e2 = arguments[1];
          if (this.SetInitialOriginName(t5), null === e2.listDefinitions) return C("originStory.listDefinitions");
          let n2 = e2.listDefinitions.TryListGetDefinition(t5, null);
          if (!n2.exists) throw new Error("InkList origin could not be found in story when constructing new list: " + t5);
          if (null === n2.result) return C("def.result");
          this.origins = [n2.result];
        } else if ("object" == typeof arguments[0] && arguments[0].hasOwnProperty("Key") && arguments[0].hasOwnProperty("Value")) {
          let t5 = arguments[0];
          this.Add(t5.Key, t5.Value);
        }
      }
      static FromString(t5, e2) {
        var n2;
        if (null == t5 || "" == t5) return new _w();
        let i2 = null === (n2 = e2.listDefinitions) || void 0 === n2 ? void 0 : n2.FindSingleItemListWithName(t5);
        if (i2) return null === i2.value ? C("listValue.value") : new _w(i2.value);
        throw new Error("Could not find the InkListItem from the string '" + t5 + "' to create an InkList because it doesn't exist in the original list definition in ink.");
      }
      AddItem(t5) {
        let e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null;
        if (t5 instanceof b) {
          let e3 = t5;
          if (null == e3.originName) return void this.AddItem(e3.itemName);
          if (null === this.origins) return C("this.origins");
          for (let t6 of this.origins) if (t6.name == e3.originName) {
            let n2 = t6.TryGetValueForItem(e3, 0);
            if (n2.exists) return void this.Add(e3, n2.result);
            throw new Error("Could not add the item " + e3 + " to this list because it doesn't exist in the original list definition in ink.");
          }
          throw new Error("Failed to add item to list because the item was from a new list definition that wasn't previously known to this list. Only items from previously known lists can be used, so that the int value can be found.");
        }
        if (null !== t5) {
          let n2 = t5, i2 = null;
          if (null === this.origins) return C("this.origins");
          for (let t6 of this.origins) {
            if (null === n2) return C("itemName");
            if (t6.ContainsItemWithName(n2)) {
              if (null != i2) throw new Error("Could not add the item " + n2 + " to this list because it could come from either " + t6.name + " or " + i2.name);
              i2 = t6;
            }
          }
          if (null == i2) {
            if (null == e2) throw new Error("Could not add the item " + n2 + " to this list because it isn't known to any list definitions previously associated with this list.");
            {
              let t6 = _w.FromString(n2, e2).orderedItems[0];
              this.Add(t6.Key, t6.Value);
            }
          } else {
            let t6 = new b(i2.name, n2), e3 = i2.ValueForItem(t6);
            this.Add(t6, e3);
          }
        }
      }
      ContainsItemNamed(t5) {
        for (let [e2] of this) {
          if (b.fromSerializedKey(e2).itemName == t5) return true;
        }
        return false;
      }
      ContainsKey(t5) {
        return this.has(t5.serialized());
      }
      Add(t5, e2) {
        let n2 = t5.serialized();
        if (this.has(n2)) throw new Error(`The Map already contains an entry for ${t5}`);
        this.set(n2, e2);
      }
      Remove(t5) {
        return this.delete(t5.serialized());
      }
      get Count() {
        return this.size;
      }
      get originOfMaxItem() {
        if (null == this.origins) return null;
        let t5 = this.maxItem.Key.originName, e2 = null;
        return this.origins.every(((n2) => n2.name != t5 || (e2 = n2, false))), e2;
      }
      get originNames() {
        if (this.Count > 0) {
          null == this._originNames && this.Count > 0 ? this._originNames = [] : (this._originNames || (this._originNames = []), this._originNames.length = 0);
          for (let [t5] of this) {
            let e2 = b.fromSerializedKey(t5);
            if (null === e2.originName) return C("item.originName");
            this._originNames.push(e2.originName);
          }
        }
        return this._originNames;
      }
      SetInitialOriginName(t5) {
        this._originNames = [t5];
      }
      SetInitialOriginNames(t5) {
        this._originNames = null == t5 ? null : t5.slice();
      }
      get maxItem() {
        let t5 = { Key: b.Null, Value: 0 };
        for (let [e2, n2] of this) {
          let i2 = b.fromSerializedKey(e2);
          (t5.Key.isNull || n2 > t5.Value) && (t5 = { Key: i2, Value: n2 });
        }
        return t5;
      }
      get minItem() {
        let t5 = { Key: b.Null, Value: 0 };
        for (let [e2, n2] of this) {
          let i2 = b.fromSerializedKey(e2);
          (t5.Key.isNull || n2 < t5.Value) && (t5 = { Key: i2, Value: n2 });
        }
        return t5;
      }
      get inverse() {
        let t5 = new _w();
        if (null != this.origins) for (let e2 of this.origins) for (let [n2, i2] of e2.items) {
          let e3 = b.fromSerializedKey(n2);
          this.ContainsKey(e3) || t5.Add(e3, i2);
        }
        return t5;
      }
      get all() {
        let t5 = new _w();
        if (null != this.origins) for (let e2 of this.origins) for (let [n2, i2] of e2.items) {
          let e3 = b.fromSerializedKey(n2);
          t5.set(e3.serialized(), i2);
        }
        return t5;
      }
      Union(t5) {
        let e2 = new _w(this);
        for (let [n2, i2] of t5) e2.set(n2, i2);
        return e2;
      }
      Intersect(t5) {
        let e2 = new _w();
        for (let [n2, i2] of this) t5.has(n2) && e2.set(n2, i2);
        return e2;
      }
      HasIntersection(t5) {
        for (let [e2] of this) if (t5.has(e2)) return true;
        return false;
      }
      Without(t5) {
        let e2 = new _w(this);
        for (let [n2] of t5) e2.delete(n2);
        return e2;
      }
      Contains(t5) {
        if ("string" == typeof t5) return this.ContainsItemNamed(t5);
        const e2 = t5;
        if (0 == e2.size || 0 == this.size) return false;
        for (let [t6] of e2) if (!this.has(t6)) return false;
        return true;
      }
      GreaterThan(t5) {
        return 0 != this.Count && (0 == t5.Count || this.minItem.Value > t5.maxItem.Value);
      }
      GreaterThanOrEquals(t5) {
        return 0 != this.Count && (0 == t5.Count || this.minItem.Value >= t5.minItem.Value && this.maxItem.Value >= t5.maxItem.Value);
      }
      LessThan(t5) {
        return 0 != t5.Count && (0 == this.Count || this.maxItem.Value < t5.minItem.Value);
      }
      LessThanOrEquals(t5) {
        return 0 != t5.Count && (0 == this.Count || this.maxItem.Value <= t5.maxItem.Value && this.minItem.Value <= t5.minItem.Value);
      }
      MaxAsList() {
        return this.Count > 0 ? new _w(this.maxItem) : new _w();
      }
      MinAsList() {
        return this.Count > 0 ? new _w(this.minItem) : new _w();
      }
      ListWithSubRange(t5, e2) {
        if (0 == this.Count) return new _w();
        let n2 = this.orderedItems, i2 = 0, r2 = Number.MAX_SAFE_INTEGER;
        Number.isInteger(t5) ? i2 = t5 : t5 instanceof _w && t5.Count > 0 && (i2 = t5.minItem.Value), Number.isInteger(e2) ? r2 = e2 : e2 instanceof _w && e2.Count > 0 && (r2 = e2.maxItem.Value);
        let s2 = new _w();
        s2.SetInitialOriginNames(this.originNames);
        for (let t6 of n2) t6.Value >= i2 && t6.Value <= r2 && s2.Add(t6.Key, t6.Value);
        return s2;
      }
      Equals(t5) {
        if (t5 instanceof _w == false) return false;
        if (t5.Count != this.Count) return false;
        for (let [e2] of this) if (!t5.has(e2)) return false;
        return true;
      }
      get orderedItems() {
        let t5 = new Array();
        for (let [e2, n2] of this) {
          let i2 = b.fromSerializedKey(e2);
          t5.push({ Key: i2, Value: n2 });
        }
        return t5.sort(((t6, e2) => null === t6.Key.originName ? C("x.Key.originName") : null === e2.Key.originName ? C("y.Key.originName") : t6.Value == e2.Value ? t6.Key.originName.localeCompare(e2.Key.originName) : t6.Value < e2.Value ? -1 : t6.Value > e2.Value ? 1 : 0)), t5;
      }
      get singleItem() {
        for (let t5 of this.orderedItems) return t5.Key;
        return null;
      }
      toString() {
        let t5 = this.orderedItems, e2 = new y();
        for (let n2 = 0; n2 < t5.length; n2++) {
          n2 > 0 && e2.Append(", ");
          let i2 = t5[n2].Key;
          if (null === i2.itemName) return C("item.itemName");
          e2.Append(i2.itemName);
        }
        return e2.toString();
      }
      valueOf() {
        return NaN;
      }
    };
    E = class extends Error {
      constructor(t5) {
        super(t5), this.useEndLineNumber = false, this.message = t5, this.name = "StoryException";
      }
    };
    T = class _T extends S {
      static Create(t5, e2) {
        if (e2) {
          if (e2 === f.Int && Number.isInteger(Number(t5))) return new P(Number(t5));
          if (e2 === f.Float && !isNaN(t5)) return new N(Number(t5));
        }
        return "boolean" == typeof t5 ? new A(Boolean(t5)) : "string" == typeof t5 ? new I(String(t5)) : Number.isInteger(Number(t5)) ? new P(Number(t5)) : isNaN(t5) ? t5 instanceof p ? new O(s(t5, p)) : t5 instanceof w ? new W(s(t5, w)) : null : new N(Number(t5));
      }
      Copy() {
        return s(_T.Create(this.valueObject), S);
      }
      BadCastException(t5) {
        return new E("Can't cast " + this.valueObject + " from " + this.valueType + " to " + t5);
      }
    };
    x = class extends T {
      constructor(t5) {
        super(), this.value = t5;
      }
      get valueObject() {
        return this.value;
      }
      toString() {
        return null === this.value ? C("Value.value") : this.value.toString();
      }
    };
    A = class extends x {
      constructor(t5) {
        super(t5 || false);
      }
      get isTruthy() {
        return Boolean(this.value);
      }
      get valueType() {
        return f.Bool;
      }
      Cast(t5) {
        if (null === this.value) return C("Value.value");
        if (t5 == this.valueType) return this;
        if (t5 == f.Int) return new P(this.value ? 1 : 0);
        if (t5 == f.Float) return new N(this.value ? 1 : 0);
        if (t5 == f.String) return new I(this.value ? "true" : "false");
        throw this.BadCastException(t5);
      }
      toString() {
        return this.value ? "true" : "false";
      }
    };
    P = class extends x {
      constructor(t5) {
        super(t5 || 0);
      }
      get isTruthy() {
        return 0 != this.value;
      }
      get valueType() {
        return f.Int;
      }
      Cast(t5) {
        if (null === this.value) return C("Value.value");
        if (t5 == this.valueType) return this;
        if (t5 == f.Bool) return new A(0 !== this.value);
        if (t5 == f.Float) return new N(this.value);
        if (t5 == f.String) return new I("" + this.value);
        throw this.BadCastException(t5);
      }
    };
    N = class extends x {
      constructor(t5) {
        super(t5 || 0);
      }
      get isTruthy() {
        return 0 != this.value;
      }
      get valueType() {
        return f.Float;
      }
      Cast(t5) {
        if (null === this.value) return C("Value.value");
        if (t5 == this.valueType) return this;
        if (t5 == f.Bool) return new A(0 !== this.value);
        if (t5 == f.Int) return new P(this.value);
        if (t5 == f.String) return new I("" + this.value);
        throw this.BadCastException(t5);
      }
    };
    I = class extends x {
      constructor(t5) {
        if (super(t5 || ""), this._isNewline = "\n" == this.value, this._isInlineWhitespace = true, null === this.value) return C("Value.value");
        this.value.length > 0 && this.value.split("").every(((t6) => " " == t6 || "	" == t6 || (this._isInlineWhitespace = false, false)));
      }
      get valueType() {
        return f.String;
      }
      get isTruthy() {
        return null === this.value ? C("Value.value") : this.value.length > 0;
      }
      get isNewline() {
        return this._isNewline;
      }
      get isInlineWhitespace() {
        return this._isInlineWhitespace;
      }
      get isNonWhitespace() {
        return !this.isNewline && !this.isInlineWhitespace;
      }
      Cast(t5) {
        if (t5 == this.valueType) return this;
        if (t5 == f.Int) {
          let e2 = (function(t6) {
            let e3 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 0, n2 = parseInt(t6);
            return Number.isNaN(n2) ? { result: e3, exists: false } : { result: n2, exists: true };
          })(this.value);
          if (e2.exists) return new P(e2.result);
          throw this.BadCastException(t5);
        }
        if (t5 == f.Float) {
          let e2 = (function(t6) {
            let e3 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 0, n2 = parseFloat(t6);
            return Number.isNaN(n2) ? { result: e3, exists: false } : { result: n2, exists: true };
          })(this.value);
          if (e2.exists) return new N(e2.result);
          throw this.BadCastException(t5);
        }
        throw this.BadCastException(t5);
      }
    };
    O = class extends x {
      constructor() {
        super(arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : null);
      }
      get valueType() {
        return f.DivertTarget;
      }
      get targetPath() {
        return null === this.value ? C("Value.value") : this.value;
      }
      set targetPath(t5) {
        this.value = t5;
      }
      get isTruthy() {
        throw new Error("Shouldn't be checking the truthiness of a divert target");
      }
      Cast(t5) {
        if (t5 == this.valueType) return this;
        throw this.BadCastException(t5);
      }
      toString() {
        return "DivertTargetValue(" + this.targetPath + ")";
      }
    };
    F = class _F extends x {
      constructor(t5) {
        let e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : -1;
        super(t5), this._contextIndex = e2;
      }
      get contextIndex() {
        return this._contextIndex;
      }
      set contextIndex(t5) {
        this._contextIndex = t5;
      }
      get variableName() {
        return null === this.value ? C("Value.value") : this.value;
      }
      set variableName(t5) {
        this.value = t5;
      }
      get valueType() {
        return f.VariablePointer;
      }
      get isTruthy() {
        throw new Error("Shouldn't be checking the truthiness of a variable pointer");
      }
      Cast(t5) {
        if (t5 == this.valueType) return this;
        throw this.BadCastException(t5);
      }
      toString() {
        return "VariablePointerValue(" + this.variableName + ")";
      }
      Copy() {
        return new _F(this.variableName, this.contextIndex);
      }
    };
    W = class _W extends x {
      get isTruthy() {
        return null === this.value ? C("this.value") : this.value.Count > 0;
      }
      get valueType() {
        return f.List;
      }
      Cast(t5) {
        if (null === this.value) return C("Value.value");
        if (t5 == f.Int) {
          let t6 = this.value.maxItem;
          return t6.Key.isNull ? new P(0) : new P(t6.Value);
        }
        if (t5 == f.Float) {
          let t6 = this.value.maxItem;
          return t6.Key.isNull ? new N(0) : new N(t6.Value);
        }
        if (t5 == f.String) {
          let t6 = this.value.maxItem;
          return t6.Key.isNull ? new I("") : new I(t6.Key.toString());
        }
        if (t5 == this.valueType) return this;
        throw this.BadCastException(t5);
      }
      constructor(t5, e2) {
        super(null), t5 || e2 ? t5 instanceof w ? this.value = new w(t5) : t5 instanceof b && "number" == typeof e2 && (this.value = new w({ Key: t5, Value: e2 })) : this.value = new w();
      }
      static RetainListOriginsForAssignment(t5, e2) {
        let n2 = r(t5, _W), i2 = r(e2, _W);
        return i2 && null === i2.value ? C("newList.value") : n2 && null === n2.value ? C("oldList.value") : void (n2 && i2 && 0 == i2.value.Count && i2.value.SetInitialOriginNames(n2.value.originNames));
      }
    };
    !(function(t5) {
      t5[t5.Bool = -1] = "Bool", t5[t5.Int = 0] = "Int", t5[t5.Float = 1] = "Float", t5[t5.List = 2] = "List", t5[t5.String = 3] = "String", t5[t5.DivertTarget = 4] = "DivertTarget", t5[t5.VariablePointer = 5] = "VariablePointer";
    })(f || (f = {}));
    R = class _R {
      constructor() {
        this.obj = null, this.approximate = false;
      }
      get correctObj() {
        return this.approximate ? null : this.obj;
      }
      get container() {
        return this.obj instanceof k ? this.obj : null;
      }
      copy() {
        let t5 = new _R();
        return t5.obj = this.obj, t5.approximate = this.approximate, t5;
      }
    };
    k = class _k extends S {
      constructor() {
        super(...arguments), this.name = null, this._content = [], this.namedContent = /* @__PURE__ */ new Map(), this.visitsShouldBeCounted = false, this.turnIndexShouldBeCounted = false, this.countingAtStartOnly = false, this._pathToFirstLeafContent = null;
      }
      get hasValidName() {
        return null != this.name && this.name.length > 0;
      }
      get content() {
        return this._content;
      }
      set content(t5) {
        this.AddContent(t5);
      }
      get namedOnlyContent() {
        let t5 = /* @__PURE__ */ new Map();
        for (let [e2, n2] of this.namedContent) {
          let i2 = s(n2, S);
          t5.set(e2, i2);
        }
        for (let e2 of this.content) {
          let n2 = a(e2);
          null != n2 && n2.hasValidName && t5.delete(n2.name);
        }
        return 0 == t5.size && (t5 = null), t5;
      }
      set namedOnlyContent(t5) {
        let e2 = this.namedOnlyContent;
        if (null != e2) for (let [t6] of e2) this.namedContent.delete(t6);
        if (null != t5) for (let [, e3] of t5) {
          let t6 = a(e3);
          null != t6 && this.AddToNamedContentOnly(t6);
        }
      }
      get countFlags() {
        let t5 = 0;
        return this.visitsShouldBeCounted && (t5 |= _k.CountFlags.Visits), this.turnIndexShouldBeCounted && (t5 |= _k.CountFlags.Turns), this.countingAtStartOnly && (t5 |= _k.CountFlags.CountStartOnly), t5 == _k.CountFlags.CountStartOnly && (t5 = 0), t5;
      }
      set countFlags(t5) {
        let e2 = t5;
        (e2 & _k.CountFlags.Visits) > 0 && (this.visitsShouldBeCounted = true), (e2 & _k.CountFlags.Turns) > 0 && (this.turnIndexShouldBeCounted = true), (e2 & _k.CountFlags.CountStartOnly) > 0 && (this.countingAtStartOnly = true);
      }
      get pathToFirstLeafContent() {
        return null == this._pathToFirstLeafContent && (this._pathToFirstLeafContent = this.path.PathByAppendingPath(this.internalPathToFirstLeafContent)), this._pathToFirstLeafContent;
      }
      get internalPathToFirstLeafContent() {
        let t5 = [], e2 = this;
        for (; e2 instanceof _k; ) e2.content.length > 0 && (t5.push(new p.Component(0)), e2 = e2.content[0]);
        return new p(t5);
      }
      AddContent(t5) {
        if (t5 instanceof Array) {
          let e2 = t5;
          for (let t6 of e2) this.AddContent(t6);
        } else {
          let e2 = t5;
          if (this._content.push(e2), e2.parent) throw new Error("content is already in " + e2.parent);
          e2.parent = this, this.TryAddNamedContent(e2);
        }
      }
      TryAddNamedContent(t5) {
        let e2 = a(t5);
        null != e2 && e2.hasValidName && this.AddToNamedContentOnly(e2);
      }
      AddToNamedContentOnly(t5) {
        if (m.AssertType(t5, S, "Can only add Runtime.Objects to a Runtime.Container"), s(t5, S).parent = this, null === t5.name) return C("namedContentObj.name");
        this.namedContent.set(t5.name, t5);
      }
      ContentAtPath(t5) {
        let e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 0, n2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : -1;
        -1 == n2 && (n2 = t5.length);
        let i2 = new R();
        i2.approximate = false;
        let s2 = this, a2 = this;
        for (let o2 = e2; o2 < n2; ++o2) {
          let e3 = t5.GetComponent(o2);
          if (null == s2) {
            i2.approximate = true;
            break;
          }
          let l2 = s2.ContentWithPathComponent(e3);
          if (null == l2) {
            i2.approximate = true;
            break;
          }
          const h2 = r(l2, _k);
          if (o2 < n2 - 1 && null == h2) {
            i2.approximate = true;
            break;
          }
          a2 = l2, s2 = h2;
        }
        return i2.obj = a2, i2;
      }
      InsertContent(t5, e2) {
        if (this.content.splice(e2, 0, t5), t5.parent) throw new Error("content is already in " + t5.parent);
        t5.parent = this, this.TryAddNamedContent(t5);
      }
      AddContentsOfContainer(t5) {
        this.content.push(...t5.content);
        for (let e2 of t5.content) e2.parent = this, this.TryAddNamedContent(e2);
      }
      ContentWithPathComponent(t5) {
        if (t5.isIndex) return t5.index >= 0 && t5.index < this.content.length ? this.content[t5.index] : null;
        if (t5.isParent) return this.parent;
        {
          if (null === t5.name) return C("component.name");
          let e2 = _(this.namedContent, t5.name, null);
          return e2.exists ? s(e2.result, S) : null;
        }
      }
      BuildStringOfHierarchy() {
        let t5;
        if (0 == arguments.length) return t5 = new y(), this.BuildStringOfHierarchy(t5, 0, null), t5.toString();
        t5 = arguments[0];
        let e2 = arguments[1], n2 = arguments[2];
        function i2() {
          for (let n3 = 0; n3 < 4 * e2; ++n3) t5.Append(" ");
        }
        i2(), t5.Append("["), this.hasValidName && t5.AppendFormat(" ({0})", this.name), this == n2 && t5.Append("  <---"), t5.AppendLine(), e2++;
        for (let r3 = 0; r3 < this.content.length; ++r3) {
          let s2 = this.content[r3];
          if (s2 instanceof _k) {
            s2.BuildStringOfHierarchy(t5, e2, n2);
          } else i2(), s2 instanceof I ? (t5.Append('"'), t5.Append(s2.toString().replace("\n", "\\n")), t5.Append('"')) : t5.Append(s2.toString());
          r3 != this.content.length - 1 && t5.Append(","), s2 instanceof _k || s2 != n2 || t5.Append("  <---"), t5.AppendLine();
        }
        let r2 = /* @__PURE__ */ new Map();
        for (let [t6, e3] of this.namedContent) this.content.indexOf(s(e3, S)) >= 0 || r2.set(t6, e3);
        if (r2.size > 0) {
          i2(), t5.AppendLine("-- named: --");
          for (let [, i3] of r2) {
            m.AssertType(i3, _k, "Can only print out named Containers"), i3.BuildStringOfHierarchy(t5, e2, n2), t5.AppendLine();
          }
        }
        e2--, i2(), t5.Append("]");
      }
    };
    !(function(t5) {
      var e2;
      (e2 = t5.CountFlags || (t5.CountFlags = {}))[e2.Start = 0] = "Start", e2[e2.Visits = 1] = "Visits", e2[e2.Turns = 2] = "Turns", e2[e2.CountStartOnly = 4] = "CountStartOnly";
    })(k || (k = {}));
    D = class _D extends S {
      get commandType() {
        return this._commandType;
      }
      constructor() {
        let t5 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : _D.CommandType.NotSet;
        super(), this._commandType = t5;
      }
      Copy() {
        return new _D(this.commandType);
      }
      static EvalStart() {
        return new _D(_D.CommandType.EvalStart);
      }
      static EvalOutput() {
        return new _D(_D.CommandType.EvalOutput);
      }
      static EvalEnd() {
        return new _D(_D.CommandType.EvalEnd);
      }
      static Duplicate() {
        return new _D(_D.CommandType.Duplicate);
      }
      static PopEvaluatedValue() {
        return new _D(_D.CommandType.PopEvaluatedValue);
      }
      static PopFunction() {
        return new _D(_D.CommandType.PopFunction);
      }
      static PopTunnel() {
        return new _D(_D.CommandType.PopTunnel);
      }
      static BeginString() {
        return new _D(_D.CommandType.BeginString);
      }
      static EndString() {
        return new _D(_D.CommandType.EndString);
      }
      static NoOp() {
        return new _D(_D.CommandType.NoOp);
      }
      static ChoiceCount() {
        return new _D(_D.CommandType.ChoiceCount);
      }
      static Turns() {
        return new _D(_D.CommandType.Turns);
      }
      static TurnsSince() {
        return new _D(_D.CommandType.TurnsSince);
      }
      static ReadCount() {
        return new _D(_D.CommandType.ReadCount);
      }
      static Random() {
        return new _D(_D.CommandType.Random);
      }
      static SeedRandom() {
        return new _D(_D.CommandType.SeedRandom);
      }
      static VisitIndex() {
        return new _D(_D.CommandType.VisitIndex);
      }
      static SequenceShuffleIndex() {
        return new _D(_D.CommandType.SequenceShuffleIndex);
      }
      static StartThread() {
        return new _D(_D.CommandType.StartThread);
      }
      static Done() {
        return new _D(_D.CommandType.Done);
      }
      static End() {
        return new _D(_D.CommandType.End);
      }
      static ListFromInt() {
        return new _D(_D.CommandType.ListFromInt);
      }
      static ListRange() {
        return new _D(_D.CommandType.ListRange);
      }
      static ListRandom() {
        return new _D(_D.CommandType.ListRandom);
      }
      static BeginTag() {
        return new _D(_D.CommandType.BeginTag);
      }
      static EndTag() {
        return new _D(_D.CommandType.EndTag);
      }
      toString() {
        return "ControlCommand " + this.commandType.toString();
      }
    };
    !(function(t5) {
      var e2;
      (e2 = t5.CommandType || (t5.CommandType = {}))[e2.NotSet = -1] = "NotSet", e2[e2.EvalStart = 0] = "EvalStart", e2[e2.EvalOutput = 1] = "EvalOutput", e2[e2.EvalEnd = 2] = "EvalEnd", e2[e2.Duplicate = 3] = "Duplicate", e2[e2.PopEvaluatedValue = 4] = "PopEvaluatedValue", e2[e2.PopFunction = 5] = "PopFunction", e2[e2.PopTunnel = 6] = "PopTunnel", e2[e2.BeginString = 7] = "BeginString", e2[e2.EndString = 8] = "EndString", e2[e2.NoOp = 9] = "NoOp", e2[e2.ChoiceCount = 10] = "ChoiceCount", e2[e2.Turns = 11] = "Turns", e2[e2.TurnsSince = 12] = "TurnsSince", e2[e2.ReadCount = 13] = "ReadCount", e2[e2.Random = 14] = "Random", e2[e2.SeedRandom = 15] = "SeedRandom", e2[e2.VisitIndex = 16] = "VisitIndex", e2[e2.SequenceShuffleIndex = 17] = "SequenceShuffleIndex", e2[e2.StartThread = 18] = "StartThread", e2[e2.Done = 19] = "Done", e2[e2.End = 20] = "End", e2[e2.ListFromInt = 21] = "ListFromInt", e2[e2.ListRange = 22] = "ListRange", e2[e2.ListRandom = 23] = "ListRandom", e2[e2.BeginTag = 24] = "BeginTag", e2[e2.EndTag = 25] = "EndTag", e2[e2.TOTAL_VALUES = 26] = "TOTAL_VALUES";
    })(D || (D = {}));
    L = class extends c {
      constructor() {
        super(...arguments), this._prototypeRuntimeConstantExpression = null, this.outputWhenComplete = false, this.GenerateRuntimeObject = () => {
          const t5 = new k();
          return t5.AddContent(D.EvalStart()), this.GenerateIntoContainer(t5), this.outputWhenComplete && t5.AddContent(D.EvalOutput()), t5.AddContent(D.EvalEnd()), t5;
        }, this.GenerateConstantIntoContainer = (t5) => {
          null === this._prototypeRuntimeConstantExpression && (this._prototypeRuntimeConstantExpression = new k(), this.GenerateIntoContainer(this._prototypeRuntimeConstantExpression));
          for (const e2 of this._prototypeRuntimeConstantExpression.content) {
            const n2 = e2.Copy();
            n2 && t5.AddContent(n2);
          }
        }, this.toString = () => "No string value in JavaScript.";
      }
      get typeName() {
        return "Expression";
      }
      Equals(t5) {
        return false;
      }
    };
    V = class extends S {
      toString() {
        return "Void";
      }
    };
    j = class _j extends S {
      static CallWithName(t5) {
        return new _j(t5);
      }
      static CallExistsWithName(t5) {
        return this.GenerateNativeFunctionsIfNecessary(), this._nativeFunctions.get(t5);
      }
      get name() {
        return null === this._name ? C("NativeFunctionCall._name") : this._name;
      }
      set name(t5) {
        this._name = t5, this._isPrototype || (null === _j._nativeFunctions ? C("NativeFunctionCall._nativeFunctions") : this._prototype = _j._nativeFunctions.get(this._name) || null);
      }
      get numberOfParameters() {
        return this._prototype ? this._prototype.numberOfParameters : this._numberOfParameters;
      }
      set numberOfParameters(t5) {
        this._numberOfParameters = t5;
      }
      Call(t5) {
        if (this._prototype) return this._prototype.Call(t5);
        if (this.numberOfParameters != t5.length) throw new Error("Unexpected number of parameters");
        let e2 = false;
        for (let n3 of t5) {
          if (n3 instanceof V) throw new E("Attempting to perform " + this.name + ' on a void value. Did you forget to "return" a value from a function you called here?');
          n3 instanceof W && (e2 = true);
        }
        if (2 == t5.length && e2) return this.CallBinaryListOperation(t5);
        let n2 = this.CoerceValuesToSingleType(t5), i2 = n2[0].valueType;
        return i2 == f.Int || i2 == f.Float || i2 == f.String || i2 == f.DivertTarget || i2 == f.List ? this.CallType(n2) : null;
      }
      CallType(t5) {
        let e2 = s(t5[0], x), n2 = e2.valueType, i2 = e2, r2 = t5.length;
        if (2 == r2 || 1 == r2) {
          if (null === this._operationFuncs) return C("NativeFunctionCall._operationFuncs");
          let a2 = this._operationFuncs.get(n2);
          if (!a2) {
            const t6 = f[n2];
            throw new E("Cannot perform operation " + this.name + " on " + t6);
          }
          if (2 == r2) {
            let e3 = s(t5[1], x), n3 = a2;
            if (null === i2.value || null === e3.value) return C("NativeFunctionCall.Call BinaryOp values");
            let r3 = n3(i2.value, e3.value);
            return x.Create(r3);
          }
          {
            let t6 = a2;
            if (null === i2.value) return C("NativeFunctionCall.Call UnaryOp value");
            let n3 = t6(i2.value);
            return this.name === _j.Int ? x.Create(n3, f.Int) : this.name === _j.Float ? x.Create(n3, f.Float) : x.Create(n3, e2.valueType);
          }
        }
        throw new Error("Unexpected number of parameters to NativeFunctionCall: " + t5.length);
      }
      CallBinaryListOperation(t5) {
        if (("+" == this.name || "-" == this.name) && t5[0] instanceof W && t5[1] instanceof P) return this.CallListIncrementOperation(t5);
        let e2 = s(t5[0], x), n2 = s(t5[1], x);
        if (!("&&" != this.name && "||" != this.name || e2.valueType == f.List && n2.valueType == f.List)) {
          if (null === this._operationFuncs) return C("NativeFunctionCall._operationFuncs");
          let t6 = this._operationFuncs.get(f.Int);
          if (null === t6) return C("NativeFunctionCall.CallBinaryListOperation op");
          let i2 = (function(t7) {
            if ("boolean" == typeof t7) return t7;
            throw new Error(`${t7} is not a boolean`);
          })(t6(e2.isTruthy ? 1 : 0, n2.isTruthy ? 1 : 0));
          return new A(i2);
        }
        if (e2.valueType == f.List && n2.valueType == f.List) return this.CallType([e2, n2]);
        throw new E("Can not call use " + this.name + " operation on " + f[e2.valueType] + " and " + f[n2.valueType]);
      }
      CallListIncrementOperation(t5) {
        let e2 = s(t5[0], W), n2 = s(t5[1], P), i2 = new w();
        if (null === e2.value) return C("NativeFunctionCall.CallListIncrementOperation listVal.value");
        for (let [t6, r2] of e2.value) {
          let s2 = b.fromSerializedKey(t6);
          if (null === this._operationFuncs) return C("NativeFunctionCall._operationFuncs");
          let a2 = this._operationFuncs.get(f.Int);
          if (null === n2.value) return C("NativeFunctionCall.CallListIncrementOperation intVal.value");
          let o2 = a2(r2, n2.value), l2 = null;
          if (null === e2.value.origins) return C("NativeFunctionCall.CallListIncrementOperation listVal.value.origins");
          for (let t7 of e2.value.origins) if (t7.name == s2.originName) {
            l2 = t7;
            break;
          }
          if (null != l2) {
            let t7 = l2.TryGetItemWithValue(o2, b.Null);
            t7.exists && i2.Add(t7.result, o2);
          }
        }
        return new W(i2);
      }
      CoerceValuesToSingleType(t5) {
        let e2 = f.Int, n2 = null;
        for (let i3 of t5) {
          let t6 = s(i3, x);
          t6.valueType > e2 && (e2 = t6.valueType), t6.valueType == f.List && (n2 = r(t6, W));
        }
        let i2 = [];
        if (f[e2] == f[f.List]) for (let e3 of t5) {
          let t6 = s(e3, x);
          if (t6.valueType == f.List) i2.push(t6);
          else {
            if (t6.valueType != f.Int) {
              const e4 = f[t6.valueType];
              throw new E("Cannot mix Lists and " + e4 + " values in this operation");
            }
            {
              let e4 = parseInt(t6.valueObject);
              if (n2 = s(n2, W), null === n2.value) return C("NativeFunctionCall.CoerceValuesToSingleType specialCaseList.value");
              let r2 = n2.value.originOfMaxItem;
              if (null === r2) return C("NativeFunctionCall.CoerceValuesToSingleType list");
              let a2 = r2.TryGetItemWithValue(e4, b.Null);
              if (!a2.exists) throw new E("Could not find List item with the value " + e4 + " in " + r2.name);
              {
                let t7 = new W(a2.result, e4);
                i2.push(t7);
              }
            }
          }
        }
        else for (let n3 of t5) {
          let t6 = s(n3, x).Cast(e2);
          i2.push(t6);
        }
        return i2;
      }
      constructor() {
        if (super(), this._name = null, this._numberOfParameters = 0, this._prototype = null, this._isPrototype = false, this._operationFuncs = null, 0 === arguments.length) _j.GenerateNativeFunctionsIfNecessary();
        else if (1 === arguments.length) {
          let t5 = arguments[0];
          _j.GenerateNativeFunctionsIfNecessary(), this.name = t5;
        } else if (2 === arguments.length) {
          let t5 = arguments[0], e2 = arguments[1];
          this._isPrototype = true, this.name = t5, this.numberOfParameters = e2;
        }
      }
      static Identity(t5) {
        return t5;
      }
      static GenerateNativeFunctionsIfNecessary() {
        if (null == this._nativeFunctions) {
          this._nativeFunctions = /* @__PURE__ */ new Map(), this.AddIntBinaryOp(this.Add, ((t6, e3) => t6 + e3)), this.AddIntBinaryOp(this.Subtract, ((t6, e3) => t6 - e3)), this.AddIntBinaryOp(this.Multiply, ((t6, e3) => t6 * e3)), this.AddIntBinaryOp(this.Divide, ((t6, e3) => Math.floor(t6 / e3))), this.AddIntBinaryOp(this.Mod, ((t6, e3) => t6 % e3)), this.AddIntUnaryOp(this.Negate, ((t6) => -t6)), this.AddIntBinaryOp(this.Equal, ((t6, e3) => t6 == e3)), this.AddIntBinaryOp(this.Greater, ((t6, e3) => t6 > e3)), this.AddIntBinaryOp(this.Less, ((t6, e3) => t6 < e3)), this.AddIntBinaryOp(this.GreaterThanOrEquals, ((t6, e3) => t6 >= e3)), this.AddIntBinaryOp(this.LessThanOrEquals, ((t6, e3) => t6 <= e3)), this.AddIntBinaryOp(this.NotEquals, ((t6, e3) => t6 != e3)), this.AddIntUnaryOp(this.Not, ((t6) => 0 == t6)), this.AddIntBinaryOp(this.And, ((t6, e3) => 0 != t6 && 0 != e3)), this.AddIntBinaryOp(this.Or, ((t6, e3) => 0 != t6 || 0 != e3)), this.AddIntBinaryOp(this.Max, ((t6, e3) => Math.max(t6, e3))), this.AddIntBinaryOp(this.Min, ((t6, e3) => Math.min(t6, e3))), this.AddIntBinaryOp(this.Pow, ((t6, e3) => Math.pow(t6, e3))), this.AddIntUnaryOp(this.Floor, _j.Identity), this.AddIntUnaryOp(this.Ceiling, _j.Identity), this.AddIntUnaryOp(this.Int, _j.Identity), this.AddIntUnaryOp(this.Float, ((t6) => t6)), this.AddFloatBinaryOp(this.Add, ((t6, e3) => t6 + e3)), this.AddFloatBinaryOp(this.Subtract, ((t6, e3) => t6 - e3)), this.AddFloatBinaryOp(this.Multiply, ((t6, e3) => t6 * e3)), this.AddFloatBinaryOp(this.Divide, ((t6, e3) => t6 / e3)), this.AddFloatBinaryOp(this.Mod, ((t6, e3) => t6 % e3)), this.AddFloatUnaryOp(this.Negate, ((t6) => -t6)), this.AddFloatBinaryOp(this.Equal, ((t6, e3) => t6 == e3)), this.AddFloatBinaryOp(this.Greater, ((t6, e3) => t6 > e3)), this.AddFloatBinaryOp(this.Less, ((t6, e3) => t6 < e3)), this.AddFloatBinaryOp(this.GreaterThanOrEquals, ((t6, e3) => t6 >= e3)), this.AddFloatBinaryOp(this.LessThanOrEquals, ((t6, e3) => t6 <= e3)), this.AddFloatBinaryOp(this.NotEquals, ((t6, e3) => t6 != e3)), this.AddFloatUnaryOp(this.Not, ((t6) => 0 == t6)), this.AddFloatBinaryOp(this.And, ((t6, e3) => 0 != t6 && 0 != e3)), this.AddFloatBinaryOp(this.Or, ((t6, e3) => 0 != t6 || 0 != e3)), this.AddFloatBinaryOp(this.Max, ((t6, e3) => Math.max(t6, e3))), this.AddFloatBinaryOp(this.Min, ((t6, e3) => Math.min(t6, e3))), this.AddFloatBinaryOp(this.Pow, ((t6, e3) => Math.pow(t6, e3))), this.AddFloatUnaryOp(this.Floor, ((t6) => Math.floor(t6))), this.AddFloatUnaryOp(this.Ceiling, ((t6) => Math.ceil(t6))), this.AddFloatUnaryOp(this.Int, ((t6) => Math.floor(t6))), this.AddFloatUnaryOp(this.Float, _j.Identity), this.AddStringBinaryOp(this.Add, ((t6, e3) => t6 + e3)), this.AddStringBinaryOp(this.Equal, ((t6, e3) => t6 === e3)), this.AddStringBinaryOp(this.NotEquals, ((t6, e3) => !(t6 === e3))), this.AddStringBinaryOp(this.Has, ((t6, e3) => t6.includes(e3))), this.AddStringBinaryOp(this.Hasnt, ((t6, e3) => !t6.includes(e3))), this.AddListBinaryOp(this.Add, ((t6, e3) => t6.Union(e3))), this.AddListBinaryOp(this.Subtract, ((t6, e3) => t6.Without(e3))), this.AddListBinaryOp(this.Has, ((t6, e3) => t6.Contains(e3))), this.AddListBinaryOp(this.Hasnt, ((t6, e3) => !t6.Contains(e3))), this.AddListBinaryOp(this.Intersect, ((t6, e3) => t6.Intersect(e3))), this.AddListBinaryOp(this.Equal, ((t6, e3) => t6.Equals(e3))), this.AddListBinaryOp(this.Greater, ((t6, e3) => t6.GreaterThan(e3))), this.AddListBinaryOp(this.Less, ((t6, e3) => t6.LessThan(e3))), this.AddListBinaryOp(this.GreaterThanOrEquals, ((t6, e3) => t6.GreaterThanOrEquals(e3))), this.AddListBinaryOp(this.LessThanOrEquals, ((t6, e3) => t6.LessThanOrEquals(e3))), this.AddListBinaryOp(this.NotEquals, ((t6, e3) => !t6.Equals(e3))), this.AddListBinaryOp(this.And, ((t6, e3) => t6.Count > 0 && e3.Count > 0)), this.AddListBinaryOp(this.Or, ((t6, e3) => t6.Count > 0 || e3.Count > 0)), this.AddListUnaryOp(this.Not, ((t6) => 0 == t6.Count ? 1 : 0)), this.AddListUnaryOp(this.Invert, ((t6) => t6.inverse)), this.AddListUnaryOp(this.All, ((t6) => t6.all)), this.AddListUnaryOp(this.ListMin, ((t6) => t6.MinAsList())), this.AddListUnaryOp(this.ListMax, ((t6) => t6.MaxAsList())), this.AddListUnaryOp(this.Count, ((t6) => t6.Count)), this.AddListUnaryOp(this.ValueOfList, ((t6) => t6.maxItem.Value));
          let t5 = (t6, e3) => t6.Equals(e3), e2 = (t6, e3) => !t6.Equals(e3);
          this.AddOpToNativeFunc(this.Equal, 2, f.DivertTarget, t5), this.AddOpToNativeFunc(this.NotEquals, 2, f.DivertTarget, e2);
        }
      }
      AddOpFuncForType(t5, e2) {
        null == this._operationFuncs && (this._operationFuncs = /* @__PURE__ */ new Map()), this._operationFuncs.set(t5, e2);
      }
      static AddOpToNativeFunc(t5, e2, n2, i2) {
        if (null === this._nativeFunctions) return C("NativeFunctionCall._nativeFunctions");
        let r2 = this._nativeFunctions.get(t5);
        r2 || (r2 = new _j(t5, e2), this._nativeFunctions.set(t5, r2)), r2.AddOpFuncForType(n2, i2);
      }
      static AddIntBinaryOp(t5, e2) {
        this.AddOpToNativeFunc(t5, 2, f.Int, e2);
      }
      static AddIntUnaryOp(t5, e2) {
        this.AddOpToNativeFunc(t5, 1, f.Int, e2);
      }
      static AddFloatBinaryOp(t5, e2) {
        this.AddOpToNativeFunc(t5, 2, f.Float, e2);
      }
      static AddFloatUnaryOp(t5, e2) {
        this.AddOpToNativeFunc(t5, 1, f.Float, e2);
      }
      static AddStringBinaryOp(t5, e2) {
        this.AddOpToNativeFunc(t5, 2, f.String, e2);
      }
      static AddListBinaryOp(t5, e2) {
        this.AddOpToNativeFunc(t5, 2, f.List, e2);
      }
      static AddListUnaryOp(t5, e2) {
        this.AddOpToNativeFunc(t5, 1, f.List, e2);
      }
      toString() {
        return 'Native "' + this.name + '"';
      }
    };
    j.Add = "+", j.Subtract = "-", j.Divide = "/", j.Multiply = "*", j.Mod = "%", j.Negate = "_", j.Equal = "==", j.Greater = ">", j.Less = "<", j.GreaterThanOrEquals = ">=", j.LessThanOrEquals = "<=", j.NotEquals = "!=", j.Not = "!", j.And = "&&", j.Or = "||", j.Min = "MIN", j.Max = "MAX", j.Pow = "POW", j.Floor = "FLOOR", j.Ceiling = "CEILING", j.Int = "INT", j.Float = "FLOAT", j.Has = "?", j.Hasnt = "!?", j.Intersect = "^", j.ListMin = "LIST_MIN", j.ListMax = "LIST_MAX", j.All = "LIST_ALL", j.Count = "LIST_COUNT", j.ValueOfList = "LIST_VALUE", j.Invert = "LIST_INVERT", j._nativeFunctions = null;
    B = class _B extends L {
      constructor(t5, e2) {
        if (super(), this.isInt = () => "int" == this.subtype, this.isFloat = () => "float" == this.subtype, this.isBool = () => "bool" == this.subtype, this.GenerateIntoContainer = (t6) => {
          this.isInt() ? t6.AddContent(new P(this.value)) : this.isFloat() ? t6.AddContent(new N(this.value)) : this.isBool() && t6.AddContent(new A(this.value));
        }, this.toString = () => String(this.value), ("number" != typeof t5 || Number.isNaN(t5)) && "boolean" != typeof t5) throw new Error("Unexpected object type in NumberExpression.");
        this.value = t5, this.subtype = e2;
      }
      get typeName() {
        return "Number";
      }
      Equals(t5) {
        const e2 = r(t5, _B);
        return !!e2 && (e2.subtype == this.subtype && e2.value == this.value);
      }
    };
    M = class extends L {
      get nativeNameForOp() {
        return "-" === this.op ? "_" : "not" === this.op ? "!" : this.op;
      }
      constructor(t5, e2) {
        super(), this.op = e2, this.GenerateIntoContainer = (t6) => {
          this.innerExpression.GenerateIntoContainer(t6), t6.AddContent(j.CallWithName(this.nativeNameForOp));
        }, this.toString = () => this.nativeNameForOp + this.innerExpression, this.innerExpression = this.AddContent(t5);
      }
      get typeName() {
        return "UnaryExpression";
      }
    };
    M.WithInner = (t5, e2) => {
      const n2 = r(t5, B);
      if (n2) {
        if ("-" === e2) {
          if (n2.isInt()) return new B(-n2.value, "int");
          if (n2.isFloat()) return new B(-n2.value, "float");
        } else if ("!" == e2 || "not" == e2) {
          if (n2.isInt()) return new B(0 == n2.value, "bool");
          if (n2.isFloat()) return new B(0 == n2.value, "bool");
          if (n2.isBool()) return new B(!n2.value, "bool");
        }
        throw new Error("Unexpected operation or number type");
      }
      return new M(t5, e2);
    };
    G = class extends L {
      constructor(t5, e2, n2) {
        super(), this.opName = n2, this.GenerateIntoContainer = (t6) => {
          this.leftExpression.GenerateIntoContainer(t6), this.rightExpression.GenerateIntoContainer(t6), this.opName = this.NativeNameForOp(this.opName), t6.AddContent(j.CallWithName(this.opName));
        }, this.NativeNameForOp = (t6) => "and" === t6 ? "&&" : "or" === t6 ? "||" : "mod" === t6 ? "%" : "has" === t6 ? "?" : "hasnt" === t6 ? "!?" : t6, this.toString = () => `(${this.leftExpression} ${this.opName} ${this.rightExpression})`, this.leftExpression = this.AddContent(t5), this.rightExpression = this.AddContent(e2), this.opName = n2;
      }
      get typeName() {
        return "BinaryExpression";
      }
      ResolveReferences(t5) {
        if (super.ResolveReferences(t5), "?" === this.NativeNameForOp(this.opName)) {
          const t6 = r(this.leftExpression, M);
          null === t6 || "not" !== t6.op && "!" !== t6.op || this.Error(`Using 'not' or '!' here negates '${t6.innerExpression}' rather than the result of the '?' or 'has' operator. You need to add parentheses around the (A ? B) expression.`);
        }
      }
    };
    $ = class {
      constructor(t5) {
        this.set = /* @__PURE__ */ new Set(), this.Add = (t6) => this.set.add(t6), this.AddRange = (t6, e2) => {
          for (let n2 = t6.charCodeAt(0); n2 <= e2.charCodeAt(0); ++n2) this.Add(String.fromCharCode(n2));
          return this;
        }, this.AddCharacters = (t6) => {
          if ("string" == typeof t6 || Array.isArray(t6)) for (const e2 of t6) this.Add(e2);
          else for (const e2 of t6.set) this.Add(e2);
          return this;
        }, t5 && this.AddCharacters(t5);
      }
    };
    $.FromRange = (t5, e2) => new $().AddRange(t5, e2);
    q = class {
      constructor(t5, e2) {
        let n2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : [];
        if (this._start = t5, this._end = e2, this._correspondingCharSet = new $(), this._excludes = /* @__PURE__ */ new Set(), this.ToCharacterSet = () => {
          if (0 === this._correspondingCharSet.set.size) for (let t6, e3 = this.start.charCodeAt(0); e3 <= this.end.charCodeAt(0); e3 += 1) t6 = String.fromCharCode(e3), this._excludes.has(t6) || this._correspondingCharSet.AddCharacters(t6);
          return this._correspondingCharSet;
        }, n2 instanceof $) this._excludes = n2.set;
        else for (const t6 of n2) this._excludes.add(t6);
      }
      get start() {
        return this._start;
      }
      get end() {
        return this._end;
      }
    };
    q.Define = function(t5, e2) {
      return new q(t5, e2, arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : []);
    };
    U = class extends S {
      constructor() {
        let t5 = !(arguments.length > 0 && void 0 !== arguments[0]) || arguments[0];
        super(), this._pathOnChoice = null, this.hasCondition = false, this.hasStartContent = false, this.hasChoiceOnlyContent = false, this.isInvisibleDefault = false, this.onceOnly = true, this.onceOnly = t5;
      }
      get pathOnChoice() {
        if (null != this._pathOnChoice && this._pathOnChoice.isRelative) {
          let t5 = this.choiceTarget;
          t5 && (this._pathOnChoice = t5.path);
        }
        return this._pathOnChoice;
      }
      set pathOnChoice(t5) {
        this._pathOnChoice = t5;
      }
      get choiceTarget() {
        return null === this._pathOnChoice ? C("ChoicePoint._pathOnChoice") : this.ResolvePath(this._pathOnChoice).container;
      }
      get pathStringOnChoice() {
        return null === this.pathOnChoice ? C("ChoicePoint.pathOnChoice") : this.CompactPathString(this.pathOnChoice);
      }
      set pathStringOnChoice(t5) {
        this.pathOnChoice = new p(t5);
      }
      get flags() {
        let t5 = 0;
        return this.hasCondition && (t5 |= 1), this.hasStartContent && (t5 |= 2), this.hasChoiceOnlyContent && (t5 |= 4), this.isInvisibleDefault && (t5 |= 8), this.onceOnly && (t5 |= 16), t5;
      }
      set flags(t5) {
        this.hasCondition = (1 & t5) > 0, this.hasStartContent = (2 & t5) > 0, this.hasChoiceOnlyContent = (4 & t5) > 0, this.isInvisibleDefault = (8 & t5) > 0, this.onceOnly = (16 & t5) > 0;
      }
      toString() {
        if (null === this.pathOnChoice) return C("ChoicePoint.pathOnChoice");
        return "Choice: -> " + this.pathOnChoice.toString();
      }
    };
    !(function(t5) {
      t5[t5.Tunnel = 0] = "Tunnel", t5[t5.Function = 1] = "Function", t5[t5.FunctionEvaluationFromGame = 2] = "FunctionEvaluationFromGame";
    })(g || (g = {}));
    K = class _K {
      constructor() {
        this.container = null, this.index = -1, 2 === arguments.length && (this.container = arguments[0], this.index = arguments[1]);
      }
      Resolve() {
        return this.index < 0 ? this.container : null == this.container ? null : 0 == this.container.content.length ? this.container : this.index >= this.container.content.length ? null : this.container.content[this.index];
      }
      get isNull() {
        return null == this.container;
      }
      get path() {
        return this.isNull ? null : this.index >= 0 ? this.container.path.PathByAppendingComponent(new p.Component(this.index)) : this.container.path;
      }
      toString() {
        return this.container ? "Ink Pointer -> " + this.container.path.toString() + " -- index " + this.index : "Ink Pointer (null)";
      }
      copy() {
        return new _K(this.container, this.index);
      }
      static StartOf(t5) {
        return new _K(t5, 0);
      }
      static get Null() {
        return new _K(null, -1);
      }
    };
    H = class t3 extends S {
      get targetPath() {
        if (null != this._targetPath && this._targetPath.isRelative) {
          let t5 = this.targetPointer.Resolve();
          t5 && (this._targetPath = t5.path);
        }
        return this._targetPath;
      }
      set targetPath(t5) {
        this._targetPath = t5, this._targetPointer = K.Null;
      }
      get targetPointer() {
        if (this._targetPointer.isNull) {
          let t5 = this.ResolvePath(this._targetPath).obj;
          if (null === this._targetPath) return C("this._targetPath");
          if (null === this._targetPath.lastComponent) return C("this._targetPath.lastComponent");
          if (this._targetPath.lastComponent.isIndex) {
            if (null === t5) return C("targetObj");
            this._targetPointer.container = t5.parent instanceof k ? t5.parent : null, this._targetPointer.index = this._targetPath.lastComponent.index;
          } else this._targetPointer = K.StartOf(t5 instanceof k ? t5 : null);
        }
        return this._targetPointer.copy();
      }
      get targetPathString() {
        return null == this.targetPath ? null : this.CompactPathString(this.targetPath);
      }
      set targetPathString(t5) {
        this.targetPath = null == t5 ? null : new p(t5);
      }
      get hasVariableTarget() {
        return null != this.variableDivertName;
      }
      constructor(t5) {
        super(), this._targetPath = null, this._targetPointer = K.Null, this.variableDivertName = null, this.pushesToStack = false, this.stackPushType = 0, this.isExternal = false, this.externalArgs = 0, this.isConditional = false, this.pushesToStack = false, void 0 !== t5 && (this.pushesToStack = true, this.stackPushType = t5);
      }
      Equals(e2) {
        let n2 = e2;
        return n2 instanceof t3 && this.hasVariableTarget == n2.hasVariableTarget && (this.hasVariableTarget ? this.variableDivertName == n2.variableDivertName : null === this.targetPath ? C("this.targetPath") : this.targetPath.Equals(n2.targetPath));
      }
      toString() {
        if (this.hasVariableTarget) return "Divert(variable: " + this.variableDivertName + ")";
        if (null == this.targetPath) return "Divert(null)";
        {
          let t5 = new y(), e2 = this.targetPath.toString();
          return t5.Append("Divert"), this.isConditional && t5.Append("?"), this.pushesToStack && (this.stackPushType == g.Function ? t5.Append(" function") : t5.Append(" tunnel")), t5.Append(" -> "), t5.Append(this.targetPathString), t5.Append(" ("), t5.Append(e2), t5.Append(")"), t5.toString();
        }
      }
    };
    !(function(t5) {
      t5[t5.Knot = 0] = "Knot", t5[t5.List = 1] = "List", t5[t5.ListItem = 2] = "ListItem", t5[t5.Var = 3] = "Var", t5[t5.SubFlowAndWeave = 4] = "SubFlowAndWeave", t5[t5.Arg = 5] = "Arg", t5[t5.Temp = 6] = "Temp";
    })(J || (J = {}));
    z = class extends S {
      constructor(t5, e2) {
        super(), this.variableName = t5 || null, this.isNewDeclaration = !!e2, this.isGlobal = false;
      }
      toString() {
        return "VarAssign to " + this.variableName;
      }
    };
    X = class extends c {
      get runtimeChoice() {
        if (!this._runtimeChoice) throw new Error();
        return this._runtimeChoice;
      }
      get name() {
        var t5;
        return (null === (t5 = this.identifier) || void 0 === t5 ? void 0 : t5.name) || null;
      }
      get condition() {
        return this._condition;
      }
      set condition(t5) {
        this._condition = t5, t5 && this.AddContent(t5);
      }
      get runtimeContainer() {
        return this._innerContentContainer;
      }
      get innerContentContainer() {
        return this._innerContentContainer;
      }
      get containerForCounting() {
        return this._innerContentContainer;
      }
      get runtimePath() {
        if (!this.innerContentContainer || !this.innerContentContainer.path) throw new Error();
        return this.innerContentContainer.path;
      }
      constructor(t5, e2, n2) {
        super(), this._condition = null, this._innerContentContainer = null, this._outerContainer = null, this._runtimeChoice = null, this._returnToR1 = null, this._returnToR2 = null, this._r1Label = null, this._r2Label = null, this._divertToStartContentOuter = null, this._divertToStartContentInner = null, this._startContentRuntimeContainer = null, this.isInvisibleDefault = false, this.hasWeaveStyleInlineBrackets = false, this.GenerateRuntimeObject = () => {
          if (this._outerContainer = new k(), this._runtimeChoice = new U(this.onceOnly), this._runtimeChoice.isInvisibleDefault = this.isInvisibleDefault, (this.startContent || this.choiceOnlyContent || this.condition) && this._outerContainer.AddContent(D.EvalStart()), this.startContent) {
            this._returnToR1 = new O(), this._outerContainer.AddContent(this._returnToR1);
            const t6 = new z("$r", true);
            this._outerContainer.AddContent(t6), this._outerContainer.AddContent(D.BeginString()), this._divertToStartContentOuter = new H(), this._outerContainer.AddContent(this._divertToStartContentOuter), this._startContentRuntimeContainer = this.startContent.GenerateRuntimeObject(), this._startContentRuntimeContainer.name = "s";
            const e3 = new H();
            e3.variableDivertName = "$r", this._startContentRuntimeContainer.AddContent(e3), this._outerContainer.AddToNamedContentOnly(this._startContentRuntimeContainer), this._r1Label = new k(), this._r1Label.name = "$r1", this._outerContainer.AddContent(this._r1Label), this._outerContainer.AddContent(D.EndString()), this._runtimeChoice.hasStartContent = true;
          }
          if (this.choiceOnlyContent) {
            this._outerContainer.AddContent(D.BeginString());
            const t6 = this.choiceOnlyContent.GenerateRuntimeObject();
            this._outerContainer.AddContentsOfContainer(t6), this._outerContainer.AddContent(D.EndString()), this._runtimeChoice.hasChoiceOnlyContent = true;
          }
          if (this.condition && (this.condition.GenerateIntoContainer(this._outerContainer), this._runtimeChoice.hasCondition = true), (this.startContent || this.choiceOnlyContent || this.condition) && this._outerContainer.AddContent(D.EvalEnd()), this._outerContainer.AddContent(this._runtimeChoice), this._innerContentContainer = new k(), this.startContent) {
            this._returnToR2 = new O(), this._innerContentContainer.AddContent(D.EvalStart()), this._innerContentContainer.AddContent(this._returnToR2), this._innerContentContainer.AddContent(D.EvalEnd());
            const t6 = new z("$r", true);
            this._innerContentContainer.AddContent(t6), this._divertToStartContentInner = new H(), this._innerContentContainer.AddContent(this._divertToStartContentInner), this._r2Label = new k(), this._r2Label.name = "$r2", this._innerContentContainer.AddContent(this._r2Label);
          }
          if (this.innerContent) {
            const t6 = this.innerContent.GenerateRuntimeObject();
            this._innerContentContainer.AddContentsOfContainer(t6);
          }
          return this.story.countAllVisits && (this._innerContentContainer.visitsShouldBeCounted = true), this._innerContentContainer.countingAtStartOnly = true, this._outerContainer;
        }, this.toString = () => null !== this.choiceOnlyContent ? `* ${this.startContent}[${this.choiceOnlyContent}]...` : `* ${this.startContent}...`, this.startContent = t5, this.choiceOnlyContent = e2, this.innerContent = n2, this.indentationDepth = 1, t5 && this.AddContent(this.startContent), e2 && this.AddContent(this.choiceOnlyContent), n2 && this.AddContent(this.innerContent), this.onceOnly = true;
      }
      get typeName() {
        return "Choice";
      }
      ResolveReferences(t5) {
        var e2;
        if (this._innerContentContainer && (this.runtimeChoice.pathOnChoice = this._innerContentContainer.path, this.onceOnly && (this._innerContentContainer.visitsShouldBeCounted = true)), this._returnToR1) {
          if (!this._r1Label) throw new Error();
          this._returnToR1.targetPath = this._r1Label.path;
        }
        if (this._returnToR2) {
          if (!this._r2Label) throw new Error();
          this._returnToR2.targetPath = this._r2Label.path;
        }
        if (this._divertToStartContentOuter) {
          if (!this._startContentRuntimeContainer) throw new Error();
          this._divertToStartContentOuter.targetPath = this._startContentRuntimeContainer.path;
        }
        if (this._divertToStartContentInner) {
          if (!this._startContentRuntimeContainer) throw new Error();
          this._divertToStartContentInner.targetPath = this._startContentRuntimeContainer.path;
        }
        super.ResolveReferences(t5), this.identifier && ((null === (e2 = this.identifier) || void 0 === e2 ? void 0 : e2.name) || "").length > 0 && t5.CheckForNamingCollisions(this, this.identifier, J.SubFlowAndWeave);
      }
    };
    Y = class _Y {
      constructor() {
        this.characterIndex = 0, this.characterInLineIndex = 0, this.lineIndex = 0, this.reportedErrorInScope = false, this.uniqueId = 0, this.customFlags = 0, this.CopyFrom = (t5) => {
          _Y._uniqueIdCounter++, this.uniqueId = _Y._uniqueIdCounter, this.characterIndex = t5.characterIndex, this.characterInLineIndex = t5.characterInLineIndex, this.lineIndex = t5.lineIndex, this.customFlags = t5.customFlags, this.reportedErrorInScope = false;
        }, this.SquashFrom = (t5) => {
          this.characterIndex = t5.characterIndex, this.characterInLineIndex = t5.characterInLineIndex, this.lineIndex = t5.lineIndex, this.reportedErrorInScope = t5.reportedErrorInScope, this.customFlags = t5.customFlags;
        };
      }
    };
    Y._uniqueIdCounter = 1e3;
    Z = class {
      get currentElement() {
        return this._stack[this._numElements - 1];
      }
      get lineIndex() {
        return this.currentElement.lineIndex;
      }
      set lineIndex(t5) {
        this.currentElement.lineIndex = t5;
      }
      get characterIndex() {
        return this.currentElement.characterIndex;
      }
      set characterIndex(t5) {
        this.currentElement.characterIndex = t5;
      }
      get characterInLineIndex() {
        return this.currentElement.characterInLineIndex;
      }
      set characterInLineIndex(t5) {
        this.currentElement.characterInLineIndex = t5;
      }
      get customFlags() {
        return this.currentElement.customFlags;
      }
      set customFlags(t5) {
        this.currentElement.customFlags = t5;
      }
      get errorReportedAlreadyInScope() {
        return this.currentElement.reportedErrorInScope;
      }
      get stackHeight() {
        return this._numElements;
      }
      constructor() {
        this._stack = [], this._numElements = 0, this.StringParserState = () => {
          this._stack = new Array(200);
          for (let t5 = 0; t5 < 200; ++t5) this._stack[t5] = new Y();
          this._numElements = 1;
        }, this.Push = () => {
          if (this._numElements >= this._stack.length && this._numElements > 0) throw new Error("Stack overflow in parser state.");
          const t5 = this._stack[this._numElements - 1], e2 = this._stack[this._numElements];
          return this._numElements++, e2.CopyFrom(t5), e2.uniqueId;
        }, this.Pop = (t5) => {
          if (1 == this._numElements) throw new Error("Attempting to remove final stack element is illegal! Mismatched Begin/Succceed/Fail?");
          if (this.currentElement.uniqueId != t5) throw new Error("Mismatched rule IDs while Poping - do you have mismatched Begin/Succeed/Fail?");
          this._numElements -= 1;
        }, this.Peek = (t5) => {
          if (this.currentElement.uniqueId != t5) throw new Error("Mismatched rule IDs while Peeking - do you have mismatched Begin/Succeed/Fail?");
          return this._stack[this._numElements - 1];
        }, this.PeekPenultimate = () => this._numElements >= 2 ? this._stack[this._numElements - 2] : null, this.Squash = () => {
          if (this._numElements < 2) throw new Error("Attempting to remove final stack element is illegal! Mismatched Begin/Succceed/Fail?");
          const t5 = this._stack[this._numElements - 2], e2 = this._stack[this._numElements - 1];
          t5.SquashFrom(e2), this._numElements -= 1;
        }, this.NoteErrorReported = () => {
          for (const t5 of this._stack) t5.reportedErrorInScope = true;
        };
        for (let t5 = 0; t5 < 200; t5++) this._stack[t5] = new Y();
        this._numElements = 1;
      }
    };
    Q = /* @__PURE__ */ Symbol("ParseSuccessStruct");
    tt = class _tt {
      constructor(t5) {
        var e2 = this;
        this.ParseRule = null, this.errorHandler = null, this.hadError = false, this.BeginRule = () => this.state.Push(), this.FailRule = (t6) => (this.state.Pop(t6), null), this.CancelRule = (t6) => {
          this.state.Pop(t6);
        }, this.SucceedRule = function(t6) {
          let n3 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null;
          const i2 = e2.state.Peek(t6), r2 = e2.state.PeekPenultimate();
          e2.RuleDidSucceed && e2.RuleDidSucceed(n3, r2, i2), e2.state.Squash();
          let s2 = n3;
          return null === s2 && (s2 = _tt.ParseSuccess), s2;
        }, this.Expect = function(t6) {
          let n3 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null, i2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : null, r2 = e2.ParseObject(t6);
          if (null === r2) {
            let s2;
            null === n3 && (n3 = t6.name);
            const a2 = e2.LineRemainder();
            s2 = null === a2 || 0 === a2.length ? "end of line" : `'${a2}'`, e2.Error(`Expected ${n3} but saw ${s2}`), null !== i2 && (r2 = i2());
          }
          return r2;
        }, this.Error = function(t6) {
          let n3 = arguments.length > 1 && void 0 !== arguments[1] && arguments[1];
          e2.ErrorOnLine(t6, e2.lineIndex + 1, n3);
        }, this.ErrorWithParsedObject = function(t6, n3) {
          let i2 = arguments.length > 2 && void 0 !== arguments[2] && arguments[2];
          e2.ErrorOnLine(t6, n3.debugMetadata ? n3.debugMetadata.startLineNumber : -1, i2);
        }, this.ErrorOnLine = (t6, e3, n3) => {
          if (!this.state.errorReportedAlreadyInScope) {
            const i2 = n3 ? "Warning" : "Error";
            if (!this.errorHandler) throw new Error(`${i2} on line ${e3}: ${t6}`);
            this.errorHandler(t6, this.index, e3 - 1, n3), this.state.NoteErrorReported();
          }
          n3 || (this.hadError = true);
        }, this.Warning = (t6) => this.Error(t6, true), this.LineRemainder = () => this.Peek((() => this.ParseUntilCharactersFromString("\n\r"))), this.SetFlag = (t6, e3) => {
          e3 ? this.state.customFlags |= t6 : this.state.customFlags &= ~t6;
        }, this.GetFlag = (t6) => Boolean(this.state.customFlags & t6), this.ParseObject = (t6) => {
          const e3 = this.BeginRule(), n3 = this.state.stackHeight, i2 = t6();
          if (n3 !== this.state.stackHeight) throw new Error("Mismatched Begin/Fail/Succeed rules");
          return null === i2 ? this.FailRule(e3) : (this.SucceedRule(e3, i2), i2);
        }, this.Parse = (t6) => {
          const e3 = this.BeginRule(), n3 = t6();
          return null === n3 ? (this.FailRule(e3), null) : (this.SucceedRule(e3, n3), n3);
        }, this.OneOf = (t6) => {
          for (const e3 of t6) {
            const t7 = this.ParseObject(e3);
            if (null !== t7) return t7;
          }
          return null;
        }, this.OneOrMore = (t6) => {
          const e3 = [];
          let n3 = null;
          do {
            n3 = this.ParseObject(t6), null !== n3 && e3.push(n3);
          } while (null !== n3);
          return e3.length > 0 ? e3 : null;
        }, this.Optional = (t6) => () => {
          const e3 = this.ParseObject(t6);
          return null === e3 ? _tt.ParseSuccess : e3;
        }, this.Exclude = (t6) => () => this.ParseObject(t6) && _tt.ParseSuccess, this.OptionalExclude = (t6) => () => (this.ParseObject(t6), _tt.ParseSuccess), this.String = (t6) => () => this.ParseString(t6), this.TryAddResultToList = function(t6, e3) {
          let n3 = !(arguments.length > 2 && void 0 !== arguments[2]) || arguments[2];
          if (t6 !== _tt.ParseSuccess) {
            if (n3 && Array.isArray(t6)) {
              const n4 = t6;
              if (null !== n4) {
                for (const t7 of n4) e3.push(t7);
                return;
              }
            }
            e3.push(t6);
          }
        }, this.Interleave = function(t6, n3) {
          let i2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : null, r2 = !(arguments.length > 3 && void 0 !== arguments[3]) || arguments[3];
          const s2 = e2.BeginRule(), a2 = [], o2 = e2.ParseObject(t6);
          if (null === o2) return e2.FailRule(s2);
          e2.TryAddResultToList(o2, a2, r2);
          let l2 = null, h2 = null;
          do {
            if (null !== i2 && null !== e2.Peek(i2)) break;
            if (l2 = e2.ParseObject(n3), null === l2) break;
            if (e2.TryAddResultToList(l2, a2, r2), h2 = null, null !== l2) {
              if (h2 = e2.ParseObject(t6), null === h2) break;
              e2.TryAddResultToList(h2, a2, r2);
            }
          } while ((null !== l2 || null !== h2) && (l2 !== _tt.ParseSuccess || h2 != _tt.ParseSuccess) && e2.remainingLength > 0);
          return 0 === a2.length ? e2.FailRule(s2) : e2.SucceedRule(s2, a2);
        }, this.ParseString = (t6) => {
          if (t6.length > this.remainingLength) return null;
          const e3 = this.BeginRule();
          let n3 = this.index, i2 = this.characterInLineIndex, r2 = this.lineIndex, s2 = true;
          for (let e4 = 0; e4 < t6.length; e4 += 1) {
            const a2 = t6[e4];
            if (this._chars[n3] !== a2) {
              s2 = false;
              break;
            }
            "\n" === a2 && (r2++, i2 = -1), n3++, i2++;
          }
          return this.index = n3, this.characterInLineIndex = i2, this.lineIndex = r2, s2 ? this.SucceedRule(e3, t6) : this.FailRule(e3);
        }, this.ParseSingleCharacter = () => {
          if (this.remainingLength > 0) {
            const t6 = this._chars[this.index];
            return "\n" === t6 && (this.lineIndex += 1, this.characterInLineIndex = -1), this.index += 1, this.characterInLineIndex += 1, t6;
          }
          return "0";
        }, this.ParseUntilCharactersFromString = function(t6) {
          let n3 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : -1;
          return e2.ParseCharactersFromString(t6, false, n3);
        }, this.ParseUntilCharactersFromCharSet = function(t6) {
          let n3 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : -1;
          return e2.ParseCharactersFromCharSet(t6, false, n3);
        }, this.ParseCharactersFromString = function(t6) {
          let n3 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : -1, i2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : -1;
          const r2 = new $(t6);
          return "number" == typeof n3 ? e2.ParseCharactersFromCharSet(r2, true, n3) : e2.ParseCharactersFromCharSet(r2, n3, i2);
        }, this.ParseCharactersFromCharSet = function(t6) {
          let n3 = !(arguments.length > 1 && void 0 !== arguments[1]) || arguments[1], i2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : -1;
          -1 === i2 && (i2 = Number.MAX_SAFE_INTEGER);
          const r2 = e2.index;
          let s2 = e2.index, a2 = e2.characterInLineIndex, o2 = e2.lineIndex, l2 = 0;
          for (; s2 < e2._chars.length && t6.set.has(e2._chars[s2]) === n3 && l2 < i2; ) "\n" === e2._chars[s2] && (o2 += 1, a2 = -1), s2 += 1, a2 += 1, l2 += 1;
          e2.index = s2, e2.characterInLineIndex = a2, e2.lineIndex = o2;
          return e2.index > r2 ? e2._chars.slice(r2, e2.index).join("") : null;
        }, this.Peek = (t6) => {
          const e3 = this.BeginRule(), n3 = t6();
          return this.CancelRule(e3), n3;
        }, this.ParseInt = () => {
          const t6 = this.index, e3 = this.characterInLineIndex, n3 = null !== this.ParseString("-");
          this.ParseCharactersFromString(" 	");
          const i2 = this.ParseCharactersFromCharSet(_tt.numbersCharacterSet);
          if (null === i2) return this.index = t6, this.characterInLineIndex = e3, null;
          let r2;
          return Number.isNaN(Number(i2)) ? (this.Error("Failed to read integer value: " + i2 + ". Perhaps it's out of the range of acceptable numbers ink supports? (" + Number.MIN_SAFE_INTEGER + " to " + Number.MAX_SAFE_INTEGER + ")"), null) : (r2 = Number(i2), n3 ? -r2 : r2);
        }, this.ParseFloat = () => {
          const t6 = this.index, e3 = this.characterInLineIndex, n3 = this.ParseInt();
          if (null !== n3 && null !== this.ParseString(".")) {
            const t7 = this.ParseCharactersFromCharSet(_tt.numbersCharacterSet);
            return Number(`${n3}.${t7}`);
          }
          return this.index = t6, this.characterInLineIndex = e3, null;
        }, this.ParseNewline = () => {
          const t6 = this.BeginRule();
          return this.ParseString("\r"), null === this.ParseString("\n") ? this.FailRule(t6) : this.SucceedRule(t6, "\n");
        };
        const n2 = this.PreProcessInputString(t5);
        this.state = new Z(), this._chars = t5 ? n2.split("") : [], this.inputString = n2;
      }
      get currentCharacter() {
        return this.index >= 0 && this.remainingLength > 0 ? this._chars[this.index] : "0";
      }
      PreProcessInputString(t5) {
        return t5;
      }
      get endOfInput() {
        return this.index >= this._chars.length;
      }
      get remainingString() {
        return this._chars.slice(this.index, this.index + this.remainingLength).join("");
      }
      get remainingLength() {
        return this._chars.length - this.index;
      }
      get lineIndex() {
        return this.state.lineIndex;
      }
      set lineIndex(t5) {
        this.state.lineIndex = t5;
      }
      set characterInLineIndex(t5) {
        this.state.characterInLineIndex = t5;
      }
      get characterInLineIndex() {
        return this.state.characterInLineIndex;
      }
      get index() {
        return this.state.characterIndex;
      }
      set index(t5) {
        this.state.characterIndex = t5;
      }
      ParseUntil(t5) {
        let e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null, n2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : null;
        const i2 = this.BeginRule(), r2 = new $();
        null !== e2 && (r2.set = /* @__PURE__ */ new Set([...r2.set.values(), ...e2.set.values()])), null !== n2 && (r2.set = /* @__PURE__ */ new Set([...r2.set.values(), ...n2.set.values()]));
        let s2 = "", a2 = null;
        for (; ; ) {
          const n3 = this.ParseUntilCharactersFromCharSet(r2);
          if (n3 && (s2 += n3), a2 = this.Peek(t5), null !== a2) break;
          {
            if (this.endOfInput) break;
            const t6 = this.currentCharacter;
            if (null !== e2 && e2.set.has(t6)) {
              s2 += t6, "\n" === t6 && (this.lineIndex += 1, this.characterInLineIndex = -1), this.index += 1, this.characterInLineIndex += 1;
              continue;
            }
            break;
          }
        }
        return s2.length > 0 ? this.SucceedRule(i2, String(s2)) : this.FailRule(i2);
      }
    };
    tt.ParseSuccess = Q, tt.numbersCharacterSet = new $("0123456789");
    et = class extends tt {
      constructor() {
        super(...arguments), this._commentOrNewlineStartCharacter = new $("/\r\n"), this._commentBlockEndCharacter = new $("*"), this._newlineCharacters = new $("\n\r"), this.Process = () => {
          const t5 = this.Interleave(this.Optional(this.CommentsAndNewlines), this.Optional(this.MainInk));
          return null !== t5 ? t5.join("") : "";
        }, this.MainInk = () => this.ParseUntil(this.CommentsAndNewlines, this._commentOrNewlineStartCharacter, null), this.CommentsAndNewlines = () => {
          let t5 = this.Interleave(this.Optional(this.ParseNewline), this.Optional(this.ParseSingleComment));
          return null !== t5 ? t5.join("") : null;
        }, this.ParseSingleComment = () => this.OneOf([this.EndOfLineComment, this.BlockComment]), this.EndOfLineComment = () => null === this.ParseString("//") ? null : (this.ParseUntilCharactersFromCharSet(this._newlineCharacters), ""), this.BlockComment = () => {
          if (null === this.ParseString("/*")) return null;
          const t5 = this.lineIndex, e2 = this.ParseUntil(this.String("*/"), this._commentBlockEndCharacter, null);
          return this.endOfInput || this.ParseString("*/"), null != e2 ? "\n".repeat(this.lineIndex - t5) : null;
        };
      }
      PreProcessInputString(t5) {
        return t5;
      }
    };
    nt = class extends c {
      constructor(t5, e2) {
        super(), this.initialCondition = t5, this.branches = e2, this._reJoinTarget = null, this.GenerateRuntimeObject = () => {
          const t6 = new k();
          this.initialCondition && t6.AddContent(this.initialCondition.runtimeObject);
          for (const e3 of this.branches) {
            const n2 = e3.runtimeObject;
            t6.AddContent(n2);
          }
          return null === this.initialCondition || null === this.branches[0].ownExpression || this.branches[this.branches.length - 1].isElse || t6.AddContent(D.PopEvaluatedValue()), this._reJoinTarget = D.NoOp(), t6.AddContent(this._reJoinTarget), t6;
        }, this.initialCondition && this.AddContent(this.initialCondition), null !== this.branches && this.AddContent(this.branches);
      }
      get typeName() {
        return "Conditional";
      }
      ResolveReferences(t5) {
        const e2 = this._reJoinTarget.path;
        for (const t6 of this.branches) {
          if (!t6.returnDivert) throw new Error();
          t6.returnDivert.targetPath = e2;
        }
        super.ResolveReferences(t5);
      }
    };
    it = class extends c {
      constructor(t5) {
        super(), this.text = t5, this.GenerateRuntimeObject = () => new I(this.text), this.toString = () => this.text;
      }
      get typeName() {
        return "Text";
      }
    };
    rt = class extends c {
      get constantName() {
        var t5;
        return null === (t5 = this.constantIdentifier) || void 0 === t5 ? void 0 : t5.name;
      }
      get expression() {
        if (!this._expression) throw new Error();
        return this._expression;
      }
      constructor(t5, e2) {
        super(), this._expression = null, this.GenerateRuntimeObject = () => null, this.constantIdentifier = t5, e2 && (this._expression = this.AddContent(e2));
      }
      get typeName() {
        return "CONST";
      }
      ResolveReferences(t5) {
        super.ResolveReferences(t5), t5.CheckForNamingCollisions(this, this.constantIdentifier, J.Var);
      }
    };
    !(function(t5) {
      t5[t5.Story = 0] = "Story", t5[t5.Knot = 1] = "Knot", t5[t5.Stitch = 2] = "Stitch", t5[t5.WeavePoint = 3] = "WeavePoint";
    })(st || (st = {}));
    at = class extends c {
      get name() {
        var t5;
        return (null === (t5 = this.identifier) || void 0 === t5 ? void 0 : t5.name) || null;
      }
      get runtimeContainer() {
        return this.runtimeObject;
      }
      constructor(t5, e2) {
        super(), this.indentationDepth = e2, this.GenerateRuntimeObject = () => {
          const t6 = new k();
          if (t6.name = this.name, this.story.countAllVisits && (t6.visitsShouldBeCounted = true), t6.countingAtStartOnly = true, this.content) for (const e3 of this.content) t6.AddContent(e3.runtimeObject);
          return t6;
        }, this.toString = () => {
          var t6, e3;
          return "- " + ((null === (t6 = this.identifier) || void 0 === t6 ? void 0 : t6.name) ? "(" + (null === (e3 = this.identifier) || void 0 === e3 ? void 0 : e3.name) + ")" : "gather");
        }, t5 && (this.identifier = t5);
      }
      get typeName() {
        return "Gather";
      }
      ResolveReferences(t5) {
        super.ResolveReferences(t5), this.identifier && (this.identifier.name || "").length > 0 && t5.CheckForNamingCollisions(this, this.identifier, J.SubFlowAndWeave);
      }
    };
    ot = class {
      get baseTargetLevel() {
        return this.baseLevelIsAmbiguous ? st.Story : this._baseTargetLevel;
      }
      get baseLevelIsAmbiguous() {
        return !this._baseTargetLevel;
      }
      get firstComponent() {
        return null != this.components && this.components.length ? this.components[0].name : null;
      }
      get numberOfComponents() {
        return this.components ? this.components.length : 0;
      }
      get dotSeparatedComponents() {
        return null == this._dotSeparatedComponents && (this._dotSeparatedComponents = (this.components ? this.components : []).map(((t5) => t5.name)).filter(u).join(".")), this._dotSeparatedComponents;
      }
      constructor(t5, e2) {
        this._dotSeparatedComponents = null, this.toString = () => null === this.components || 0 === this.components.length ? this.baseTargetLevel === st.WeavePoint ? "-> <next gather point>" : "<invalid Path>" : `-> ${this.dotSeparatedComponents}`, this.ResolveFromContext = (t6) => {
          if (null == this.components || 0 == this.components.length) return null;
          let e3 = this.ResolveBaseTarget(t6);
          return null === e3 ? null : this.components.length > 1 ? this.ResolveTailComponents(e3) : e3;
        }, this.ResolveBaseTarget = (t6) => {
          const e3 = this.firstComponent;
          let n2 = t6;
          for (; n2; ) {
            const i2 = n2 === t6, r2 = this.GetChildFromContext(n2, e3, null, i2);
            if (r2) return r2;
            n2 = n2.parent;
          }
          return null;
        }, this.ResolveTailComponents = (t6) => {
          let e3 = t6;
          if (!this.components) return null;
          for (let t7 = 1; t7 < this.components.length; ++t7) {
            const n2 = this.components[t7].name;
            let i2, s2 = r(e3, ct);
            if (i2 = null !== s2 ? s2.flowLevel + 1 : st.WeavePoint, e3 = this.GetChildFromContext(e3, n2, i2), null === e3) break;
          }
          return e3;
        }, this.GetChildFromContext = function(t6, e3, n2) {
          let i2 = arguments.length > 3 && void 0 !== arguments[3] && arguments[3];
          const s2 = null === n2, a2 = r(t6, At);
          if (e3 && null !== a2 && (s2 || n2 === st.WeavePoint)) return a2.WeavePointNamed(e3);
          let o2 = r(t6, ct);
          if (e3 && null !== o2) {
            const t7 = i2 || o2.flowLevel === st.Knot;
            return o2.ContentWithNameAtLevel(e3, n2, t7);
          }
          return null;
        }, Object.values(st).includes(t5) ? (this._baseTargetLevel = t5, this.components = e2 || []) : Array.isArray(t5) ? (this._baseTargetLevel = null, this.components = t5 || []) : (this._baseTargetLevel = null, this.components = [t5]);
      }
      get typeName() {
        return "Path";
      }
    };
    lt = class extends c {
      constructor() {
        let t5 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : null;
        super(), this.returnedExpression = null, this.GenerateRuntimeObject = () => {
          const t6 = new k();
          return this.returnedExpression ? t6.AddContent(this.returnedExpression.runtimeObject) : (t6.AddContent(D.EvalStart()), t6.AddContent(new V()), t6.AddContent(D.EvalEnd())), t6.AddContent(D.PopFunction()), t6;
        }, t5 && (this.returnedExpression = this.AddContent(t5));
      }
      get typeName() {
        return "ReturnType";
      }
    };
    ut = class _ut {
      constructor(t5) {
        this.debugMetadata = null, this.toString = () => this.name || "undefined identifer", this.name = t5;
      }
      get typeName() {
        return "Identifier";
      }
      static Done() {
        return new _ut("DONE");
      }
    };
    ct = class _ct extends c {
      get hasParameters() {
        return null !== this.args && this.args.length > 0;
      }
      get subFlowsByName() {
        return this._subFlowsByName;
      }
      get typeName() {
        return this.isFunction ? "Function" : String(this.flowLevel);
      }
      get name() {
        var t5;
        return (null === (t5 = this.identifier) || void 0 === t5 ? void 0 : t5.name) || null;
      }
      constructor(t5) {
        var e2;
        let n2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null, i2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : null, s2 = arguments.length > 3 && void 0 !== arguments[3] && arguments[3], a2 = arguments.length > 4 && void 0 !== arguments[4] && arguments[4];
        super(), e2 = this, this.isFunction = s2, this._rootWeave = null, this._subFlowsByName = /* @__PURE__ */ new Map(), this._startingSubFlowDivert = null, this._startingSubFlowRuntime = null, this._firstChildFlow = null, this.variableDeclarations = /* @__PURE__ */ new Map(), this.identifier = null, this.args = null, this.iamFlowbase = () => true, this.SplitWeaveAndSubFlowContent = (t6, e3) => {
          var n3, i3;
          const s3 = [], a3 = [];
          this._subFlowsByName = /* @__PURE__ */ new Map();
          for (const e4 of t6) {
            const t7 = r(e4, _ct);
            t7 ? (null === this._firstChildFlow && (this._firstChildFlow = t7), a3.push(e4), (null === (n3 = t7.identifier) || void 0 === n3 ? void 0 : n3.name) && this._subFlowsByName.set(null === (i3 = t7.identifier) || void 0 === i3 ? void 0 : i3.name, t7)) : s3.push(e4);
          }
          e3 && s3.push(new at(null, 1), new Ct(new ot(ut.Done())));
          const o2 = [];
          return s3.length > 0 && (this._rootWeave = new At(s3, 0), o2.push(this._rootWeave)), a3.length > 0 && o2.push(...a3), o2;
        }, this.ResolveVariableWithName = (t6, e3) => {
          var n3;
          const i3 = {}, r2 = null === e3 ? this : ht(e3);
          if (r2) {
            if (null !== r2.args) {
              for (const e4 of r2.args) if ((null === (n3 = e4.identifier) || void 0 === n3 ? void 0 : n3.name) === t6) return i3.found = true, i3.isArgument = true, i3.ownerFlow = r2, i3;
            }
            if (r2 !== this.story && r2.variableDeclarations.has(t6)) return i3.found = true, i3.ownerFlow = r2, i3.isTemporary = true, i3;
          }
          return this.story.variableDeclarations.has(t6) ? (i3.found = true, i3.ownerFlow = this.story, i3.isGlobal = true, i3) : (i3.found = false, i3);
        }, this.AddNewVariableDeclaration = (t6) => {
          const e3 = t6.variableName;
          if (this.variableDeclarations.has(e3)) {
            const n3 = this.variableDeclarations.get(e3);
            let i3 = "";
            return n3.debugMetadata && (i3 = ` (${n3.debugMetadata})`), void this.Error(`found declaration variable '${e3}' that was already declared${i3}`, t6, false);
          }
          this.variableDeclarations.set(t6.variableName, t6);
        }, this.ResolveWeavePointNaming = () => {
          this._rootWeave && this._rootWeave.ResolveWeavePointNaming();
          for (const [, t6] of this._subFlowsByName) t6.hasOwnProperty("ResolveWeavePointNaming") && t6.ResolveWeavePointNaming();
        }, this.GenerateRuntimeObject = () => {
          var t6;
          let e3 = null;
          this.isFunction ? this.CheckForDisallowedFunctionFlowControl() : this.flowLevel !== st.Knot && this.flowLevel !== st.Stitch || (e3 = this.Find(lt)(), null !== e3 && this.Error(`Return statements can only be used in knots that are declared as functions: == function ${this.identifier} ==`, e3));
          const n3 = new k();
          n3.name = null === (t6 = this.identifier) || void 0 === t6 ? void 0 : t6.name, this.story.countAllVisits && (n3.visitsShouldBeCounted = true), this.GenerateArgumentVariableAssignments(n3);
          let i3 = 0;
          for (; null !== this.content && i3 < this.content.length; ) {
            const t7 = this.content[i3];
            if (t7 instanceof _ct) {
              const e4 = t7, r2 = e4.runtimeObject;
              0 !== i3 || e4.hasParameters || this.flowLevel !== st.Knot || (this._startingSubFlowDivert = new H(), n3.AddContent(this._startingSubFlowDivert), this._startingSubFlowRuntime = r2);
              const s3 = r2, a3 = n3.namedContent.get(s3.name) || null;
              if (a3) {
                const t8 = `${this.GetType()} already contains flow named '${s3.name}' (at ${a3.debugMetadata})`;
                this.Error(t8, e4);
              }
              n3.AddToNamedContentOnly(s3);
            } else t7 && n3.AddContent(t7.runtimeObject);
            i3 += 1;
          }
          return this.flowLevel === st.Story || this.isFunction || null === this._rootWeave || null !== e3 || this._rootWeave.ValidateTermination(this.WarningInTermination), n3;
        }, this.GenerateArgumentVariableAssignments = (t6) => {
          var e3;
          if (null !== this.args && 0 !== this.args.length) for (let n3 = this.args.length - 1; n3 >= 0; --n3) {
            const i3 = (null === (e3 = this.args[n3].identifier) || void 0 === e3 ? void 0 : e3.name) || null, r2 = new z(i3, true);
            t6.AddContent(r2);
          }
        }, this.ContentWithNameAtLevel = function(t6) {
          let n3 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null, i3 = arguments.length > 2 && void 0 !== arguments[2] && arguments[2];
          var r2;
          if ((n3 === e2.flowLevel || null === n3) && t6 === (null === (r2 = e2.identifier) || void 0 === r2 ? void 0 : r2.name)) return e2;
          if (n3 === st.WeavePoint || null === n3) {
            let r3 = null;
            if (e2._rootWeave && (r3 = e2._rootWeave.WeavePointNamed(t6), r3)) return r3;
            if (n3 === st.WeavePoint) return i3 ? e2.DeepSearchForAnyLevelContent(t6) : null;
          }
          if (null !== n3 && n3 < e2.flowLevel) return null;
          let s3 = e2._subFlowsByName.get(t6) || null;
          return !s3 || null !== n3 && n3 !== s3.flowLevel ? i3 ? e2.DeepSearchForAnyLevelContent(t6) : null : s3;
        }, this.DeepSearchForAnyLevelContent = (t6) => {
          const e3 = this.ContentWithNameAtLevel(t6, st.WeavePoint, false);
          if (e3) return e3;
          for (const [, e4] of this._subFlowsByName) {
            const n3 = e4.ContentWithNameAtLevel(t6, null, true);
            if (n3) return n3;
          }
          return null;
        }, this.CheckForDisallowedFunctionFlowControl = () => {
          this.flowLevel !== st.Knot && this.Error("Functions cannot be stitches - i.e. they should be defined as '== function myFunc ==' rather than internal to another knot.");
          for (const [t7, e4] of this._subFlowsByName) this.Error(`Functions may not contain stitches, but saw '${t7}' within the function '${this.identifier}'`, e4);
          if (!this._rootWeave) throw new Error();
          const t6 = this._rootWeave.FindAll(Ct)();
          for (const e4 of t6) e4.isFunctionCall || e4.parent instanceof vt || this.Error(`Functions may not contain diverts, but saw '${e4}'`, e4);
          const e3 = this._rootWeave.FindAll(X)();
          for (const t7 of e3) this.Error(`Functions may not contain choices, but saw '${t7}'`, t7);
        }, this.WarningInTermination = (t6) => {
          let e3 = "Apparent loose end exists where the flow runs out. Do you need a '-> DONE' statement, choice or divert?";
          t6.parent === this._rootWeave && this._firstChildFlow && (e3 = `${e3} Note that if you intend to enter '${this._firstChildFlow.identifier}' next, you need to divert to it explicitly.`);
          const n3 = r(t6, Ct);
          n3 && n3.isTunnel && (e3 += ` When final tunnel to '${n3.target} ->' returns it won't have anywhere to go.`), this.Warning(e3, t6);
        }, this.toString = () => `${this.typeName} '${this.identifier}'`, this.identifier = t5, this.args = i2, null === n2 && (n2 = []), this.PreProcessTopLevelObjects(n2), n2 = this.SplitWeaveAndSubFlowContent(n2, "Story" == this.GetType() && !a2), this.AddContent(n2);
      }
      PreProcessTopLevelObjects(t5) {
      }
      ResolveReferences(t5) {
        var e2, n2;
        if (this._startingSubFlowDivert) {
          if (!this._startingSubFlowRuntime) throw new Error();
          this._startingSubFlowDivert.targetPath = this._startingSubFlowRuntime.path;
        }
        if (super.ResolveReferences(t5), null !== this.args) {
          for (const e3 of this.args) t5.CheckForNamingCollisions(this, e3.identifier, J.Arg, "argument");
          for (let t6 = 0; t6 < this.args.length; t6 += 1) for (let i2 = t6 + 1; i2 < this.args.length; i2 += 1) (null === (e2 = this.args[t6].identifier) || void 0 === e2 ? void 0 : e2.name) == (null === (n2 = this.args[i2].identifier) || void 0 === n2 ? void 0 : n2.name) && this.Error(`Multiple arguments with the same name: '${this.args[t6].identifier}'`);
        }
        if (this.flowLevel !== st.Story) {
          const e3 = this.flowLevel === st.Knot ? J.Knot : J.SubFlowAndWeave;
          t5.CheckForNamingCollisions(this, this.identifier, e3);
        }
      }
    };
    dt = class extends c {
      get runtimeContainer() {
        return this.runtimeObject;
      }
      constructor(t5) {
        super(), this.dontFlatten = false, this.TrimTrailingWhitespace = () => {
          for (let t6 = this.content.length - 1; t6 >= 0; --t6) {
            const e3 = r(this.content[t6], it);
            if (null === e3) break;
            if (e3.text = e3.text.replace(new RegExp(/[ \t]/g), ""), 0 !== e3.text.length) break;
            this.content.splice(t6, 1);
          }
        }, this.GenerateRuntimeObject = () => {
          const t6 = new k();
          if (null !== this.content) for (const e3 of this.content) {
            const n3 = e3.runtimeObject;
            n3 && t6.AddContent(n3);
          }
          return this.dontFlatten && this.story.DontFlattenContainer(t6), t6;
        }, this.toString = () => `ContentList(${this.content.join(", ")})`, t5 && this.AddContent(t5);
        for (var e2 = arguments.length, n2 = new Array(e2 > 1 ? e2 - 1 : 0), i2 = 1; i2 < e2; i2++) n2[i2 - 1] = arguments[i2];
        n2 && this.AddContent(n2);
      }
      get typeName() {
        return "ContentList";
      }
    };
    pt = class extends S {
      get containerForCount() {
        return null === this.pathForCount ? null : this.ResolvePath(this.pathForCount).container;
      }
      get pathStringForCount() {
        return null === this.pathForCount ? null : this.CompactPathString(this.pathForCount);
      }
      set pathStringForCount(t5) {
        this.pathForCount = null === t5 ? null : new p(t5);
      }
      constructor() {
        let t5 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : null;
        super(), this.pathForCount = null, this.name = t5;
      }
      toString() {
        if (null != this.name) return "var(" + this.name + ")";
        return "read_count(" + this.pathStringForCount + ")";
      }
    };
    mt = class extends L {
      get name() {
        return this.path.join(".");
      }
      get path() {
        return this.pathIdentifiers.map(((t5) => t5.name)).filter(u);
      }
      get identifier() {
        if (!this.pathIdentifiers || 0 == this.pathIdentifiers.length) return null;
        const t5 = this.path.join(".");
        return new ut(t5);
      }
      get runtimeVarRef() {
        return this._runtimeVarRef;
      }
      constructor(t5) {
        super(), this.pathIdentifiers = t5, this._runtimeVarRef = null, this.isConstantReference = false, this.isListItemReference = false, this.GenerateIntoContainer = (t6) => {
          let e2 = this.story.constants.get(this.name);
          if (e2) return e2.GenerateConstantIntoContainer(t6), void (this.isConstantReference = true);
          if (this._runtimeVarRef = new pt(this.name), 1 === this.path.length || 2 === this.path.length) {
            let t7 = "", e3 = "";
            1 === this.path.length ? t7 = this.path[0] : (e3 = this.path[0], t7 = this.path[1]);
            this.story.ResolveListItem(e3, t7, this) && (this.isListItemReference = true);
          }
          t6.AddContent(this._runtimeVarRef);
        }, this.toString = () => `{${this.path.join(".")}}`;
      }
      get typeName() {
        return "ref";
      }
      ResolveReferences(t5) {
        if (super.ResolveReferences(t5), this.isConstantReference || this.isListItemReference) return;
        const e2 = new ot(this.pathIdentifiers), n2 = e2.ResolveFromContext(this);
        if (n2) {
          if (!n2.containerForCounting) throw new Error();
          if (n2.containerForCounting.visitsShouldBeCounted = true, null === this._runtimeVarRef) return;
          this._runtimeVarRef.pathForCount = n2.runtimePath, this._runtimeVarRef.name = null;
          let t6 = r(n2, ct);
          t6 && t6.isFunction && (this.parent instanceof At || this.parent instanceof dt || this.parent instanceof ct) && this.Warning(`'${t6.identifier}' being used as read count rather than being called as function. Perhaps you intended to write ${t6.identifier}()`);
        } else {
          if (this.path.length > 1) {
            let t6 = `Could not find target for read count: ${e2}`;
            return this.path.length <= 2 && (t6 += `, or couldn't find list item with the name ${this.path.join(",")}`), void this.Error(t6);
          }
          t5.ResolveVariableWithName(this.name, this).found || this.Error(`Unresolved variable: ${this.name}`, this);
        }
      }
    };
    ft = class _ft extends L {
      get proxyDivert() {
        return this._proxyDivert;
      }
      get name() {
        return this._proxyDivert.target.firstComponent || "";
      }
      get args() {
        return this._proxyDivert.args;
      }
      get runtimeDivert() {
        return this._proxyDivert.runtimeDivert;
      }
      get isChoiceCount() {
        return "CHOICE_COUNT" === this.name;
      }
      get isTurns() {
        return "TURNS" === this.name;
      }
      get isTurnsSince() {
        return "TURNS_SINCE" === this.name;
      }
      get isRandom() {
        return "RANDOM" === this.name;
      }
      get isSeedRandom() {
        return "SEED_RANDOM" === this.name;
      }
      get isListRange() {
        return "LIST_RANGE" === this.name;
      }
      get isListRandom() {
        return "LIST_RANDOM" === this.name;
      }
      get isReadCount() {
        return "READ_COUNT" === this.name;
      }
      constructor(t5, e2) {
        super(), this._divertTargetToCount = null, this._variableReferenceToCount = null, this.shouldPopReturnedValue = false, this.GenerateIntoContainer = (t6) => {
          const e3 = this.story.ResolveList(this.name);
          let n2 = false;
          if (this.isChoiceCount) this.args.length > 0 && this.Error("The CHOICE_COUNT() function shouldn't take any arguments"), t6.AddContent(D.ChoiceCount());
          else if (this.isTurns) this.args.length > 0 && this.Error("The TURNS() function shouldn't take any arguments"), t6.AddContent(D.Turns());
          else if (this.isTurnsSince || this.isReadCount) {
            const e4 = r(this.args[0], vt), n3 = r(this.args[0], mt);
            if (1 !== this.args.length || null === e4 && null === n3) return void this.Error(`The ${this.name}() function should take one argument: a divert target to the target knot, stitch, gather or choice you want to check. e.g. TURNS_SINCE(-> myKnot)`);
            e4 ? (this._divertTargetToCount = e4, this.AddContent(this._divertTargetToCount), this._divertTargetToCount.GenerateIntoContainer(t6)) : n3 && (this._variableReferenceToCount = n3, this.AddContent(this._variableReferenceToCount), this._variableReferenceToCount.GenerateIntoContainer(t6)), this.isTurnsSince ? t6.AddContent(D.TurnsSince()) : t6.AddContent(D.ReadCount());
          } else if (this.isRandom) {
            2 !== this.args.length && this.Error("RANDOM should take 2 parameters: a minimum and a maximum integer");
            for (let e4 = 0; e4 < this.args.length; e4 += 1) {
              const n3 = r(this.args[e4], B);
              if (n3 && !n3.isInt()) {
                const t7 = 0 === e4 ? "minimum" : "maximum";
                this.Error(`RANDOM's ${t7} parameter should be an integer`);
              }
              this.args[e4].GenerateIntoContainer(t6);
            }
            t6.AddContent(D.Random());
          } else if (this.isSeedRandom) {
            1 !== this.args.length && this.Error("SEED_RANDOM should take 1 parameter - an integer seed");
            const e4 = r(this.args[0], B);
            e4 && !e4.isInt() && this.Error("SEED_RANDOM's parameter should be an integer seed"), this.args[0].GenerateIntoContainer(t6), t6.AddContent(D.SeedRandom());
          } else if (this.isListRange) {
            3 !== this.args.length && this.Error("LIST_RANGE should take 3 parameters - a list, a min and a max");
            for (let e4 = 0; e4 < this.args.length; e4 += 1) this.args[e4].GenerateIntoContainer(t6);
            t6.AddContent(D.ListRange());
          } else if (this.isListRandom) 1 !== this.args.length && this.Error("LIST_RANDOM should take 1 parameter - a list"), this.args[0].GenerateIntoContainer(t6), t6.AddContent(D.ListRandom());
          else if (j.CallExistsWithName(this.name)) {
            const e4 = j.CallWithName(this.name);
            if (e4.numberOfParameters !== this.args.length) {
              let t7 = `${_ft.name} should take ${e4.numberOfParameters} parameter`;
              e4.numberOfParameters > 1 && (t7 += "s"), this.Error(t7);
            }
            for (let e5 = 0; e5 < this.args.length; e5 += 1) this.args[e5].GenerateIntoContainer(t6);
            t6.AddContent(j.CallWithName(this.name));
          } else if (null !== e3) if (this.args.length > 1 && this.Error("Can currently only construct a list from one integer (or an empty list from a given list definition)"), 1 === this.args.length) t6.AddContent(new I(this.name)), this.args[0].GenerateIntoContainer(t6), t6.AddContent(D.ListFromInt());
          else {
            const e4 = new w();
            e4.SetInitialOriginName(this.name), t6.AddContent(new W(e4));
          }
          else t6.AddContent(this._proxyDivert.runtimeObject), n2 = true;
          n2 || this.content.splice(this.content.indexOf(this._proxyDivert), 1), this.shouldPopReturnedValue && t6.AddContent(D.PopEvaluatedValue());
        }, this.toString = () => {
          const t6 = this.args.join(", ");
          return `${this.name}(${t6})`;
        }, this._proxyDivert = new Ct(new ot(t5), e2), this._proxyDivert.isFunctionCall = true, this.AddContent(this._proxyDivert);
      }
      get typeName() {
        return "FunctionCall";
      }
      ResolveReferences(t5) {
        if (super.ResolveReferences(t5), !this.content.includes(this._proxyDivert) && null !== this.args) for (const e2 of this.args) e2.ResolveReferences(t5);
        if (this._divertTargetToCount) {
          const t6 = this._divertTargetToCount.divert, e2 = null != t6.runtimeDivert.variableDivertName;
          if (e2) return void this.Error(`When getting the TURNS_SINCE() of a variable target, remove the '->' - i.e. it should just be TURNS_SINCE(${t6.runtimeDivert.variableDivertName})`);
          const n2 = t6.targetContent;
          if (null === n2) e2 || this.Error(`Failed to find target for TURNS_SINCE: '${t6.target}'`);
          else {
            if (!n2.containerForCounting) throw new Error();
            n2.containerForCounting.turnIndexShouldBeCounted = true;
          }
        } else if (this._variableReferenceToCount) {
          const t6 = this._variableReferenceToCount.runtimeVarRef;
          if (!t6) throw new Error();
          null !== t6.pathForCount && this.Error(`Should be '${_ft.name}'(-> '${this._variableReferenceToCount.name}). Usage without the '->' only makes sense for variable targets.`);
        }
      }
    };
    ft.IsBuiltIn = (t5) => !!j.CallExistsWithName(t5) || ("CHOICE_COUNT" === t5 || "TURNS_SINCE" === t5 || "TURNS" === t5 || "RANDOM" === t5 || "SEED_RANDOM" === t5 || "LIST_VALUE" === t5 || "LIST_RANDOM" === t5 || "READ_COUNT" === t5);
    gt = class extends L {
      get subExpressions() {
        return this.content;
      }
      constructor(t5) {
        super(), this.GenerateIntoContainer = (t6) => {
          let e2 = true;
          for (const n2 of this.subExpressions) n2.GenerateIntoContainer(t6), e2 || t6.AddContent(j.CallWithName("&&")), e2 = false;
        }, this.AddContent(t5);
      }
      get typeName() {
        return "MultipleConditionExpression";
      }
    };
    vt = class _vt extends L {
      get runtimeDivert() {
        if (!this._runtimeDivert) throw new Error();
        return this._runtimeDivert;
      }
      get runtimeDivertTargetValue() {
        if (!this._runtimeDivertTargetValue) throw new Error();
        return this._runtimeDivertTargetValue;
      }
      constructor(t5) {
        super(), this._runtimeDivert = null, this._runtimeDivertTargetValue = null, this.GenerateIntoContainer = (t6) => {
          this.divert.GenerateRuntimeObject(), this._runtimeDivert = this.divert.runtimeDivert, this._runtimeDivertTargetValue = new O(), t6.AddContent(this.runtimeDivertTargetValue);
        }, this.Equals = (t6) => {
          const e2 = r(t6, _vt);
          if (!e2 || !this.divert.target || !e2.divert.target) return false;
          return this.divert.target.dotSeparatedComponents === e2.divert.target.dotSeparatedComponents;
        }, this.divert = this.AddContent(t5);
      }
      get typeName() {
        return "DivertTarget";
      }
      ResolveReferences(t5) {
        if (super.ResolveReferences(t5), this.divert.isDone || this.divert.isEnd) return void this.Error("Can't use -> DONE or -> END as variable divert targets", this);
        let e2 = this;
        for (; e2 && e2 instanceof L; ) {
          let t6 = false, n3 = false;
          const i2 = e2.parent;
          if (i2 instanceof G) {
            const e3 = i2;
            "==" !== e3.opName && "!=" !== e3.opName ? t6 = true : (e3.leftExpression instanceof _vt || e3.leftExpression instanceof mt) && (e3.rightExpression instanceof _vt || e3.rightExpression instanceof mt) || (t6 = true), n3 = true;
          } else if (i2 instanceof ft) {
            const e3 = i2;
            e3.isTurnsSince || e3.isReadCount || (t6 = true), n3 = true;
          } else (i2 instanceof L || i2 instanceof gt || i2 instanceof X && i2.condition === e2 || i2 instanceof nt || i2 instanceof Pt) && (t6 = true, n3 = true);
          if (t6 && this.Error(`Can't use a divert target like that. Did you intend to call '${this.divert.target}' as a function: likeThis(), or check the read count: likeThis, with no arrows?`, this), n3) break;
          e2 = i2;
        }
        if (this.runtimeDivert.hasVariableTarget) {
          if (!this.divert.target) throw new Error();
          this.Error(`Since '${this.divert.target.dotSeparatedComponents}' is a variable, it shouldn't be preceded by '->' here.`);
        }
        this.runtimeDivert.targetPath && (this.runtimeDivertTargetValue.targetPath = this.runtimeDivert.targetPath);
        let n2 = this.divert.targetContent;
        if (null !== n2) {
          let t6 = n2.containerForCounting;
          if (null !== t6) {
            const e4 = r(this.parent, ft);
            e4 && e4.isTurnsSince || (t6.visitsShouldBeCounted = true), t6.turnIndexShouldBeCounted = true;
          }
          let e3 = r(n2, ct);
          if (null != e3 && null !== e3.args) for (const t7 of e3.args) t7.isByReference && this.Error(`Can't store a divert target to a knot or function that has by-reference arguments ('${e3.identifier}' has 'ref ${t7.identifier}').`);
        }
      }
    };
    Ct = class extends c {
      get runtimeDivert() {
        if (!this._runtimeDivert) throw new Error();
        return this._runtimeDivert;
      }
      set runtimeDivert(t5) {
        this._runtimeDivert = t5;
      }
      get isEnd() {
        return Boolean(this.target && "END" === this.target.dotSeparatedComponents);
      }
      get isDone() {
        return Boolean(this.target && "DONE" === this.target.dotSeparatedComponents);
      }
      constructor(t5, e2) {
        super(), this.args = [], this.target = null, this.targetContent = null, this._runtimeDivert = null, this.isFunctionCall = false, this.isEmpty = false, this.isTunnel = false, this.isThread = false, this.GenerateRuntimeObject = () => {
          if (this.isEnd) return D.End();
          if (this.isDone) return D.Done();
          this.runtimeDivert = new H(), this.ResolveTargetContent(), this.CheckArgumentValidity();
          const t6 = null !== this.args && this.args.length > 0;
          if (t6 || this.isFunctionCall || this.isTunnel || this.isThread) {
            const e3 = new k();
            if (t6) {
              this.isFunctionCall || e3.AddContent(D.EvalStart());
              let t7 = null;
              this.targetContent && (t7 = this.targetContent.args);
              for (let n2 = 0; n2 < this.args.length; ++n2) {
                const i2 = this.args[n2];
                let s2 = null;
                if (t7 && n2 < t7.length && (s2 = t7[n2]), s2 && s2.isByReference) {
                  const t8 = r(i2, mt);
                  if (!t8) {
                    this.Error(`Expected variable name to pass by reference to 'ref ${s2.identifier}' but saw ${i2}`);
                    break;
                  }
                  const n3 = new ot(t8.pathIdentifiers);
                  if (n3.ResolveFromContext(this)) {
                    this.Error(`can't pass a read count by reference. '${n3.dotSeparatedComponents}' is a knot/stitch/label, but '${this.target.dotSeparatedComponents}' requires the name of a VAR to be passed.`);
                    break;
                  }
                  const a2 = new F(t8.name);
                  e3.AddContent(a2);
                } else i2.GenerateIntoContainer(e3);
              }
              this.isFunctionCall || e3.AddContent(D.EvalEnd());
            }
            return this.isThread ? e3.AddContent(D.StartThread()) : (this.isFunctionCall || this.isTunnel) && (this.runtimeDivert.pushesToStack = true, this.runtimeDivert.stackPushType = this.isFunctionCall ? g.Function : g.Tunnel), e3.AddContent(this.runtimeDivert), e3;
          }
          return this.runtimeDivert;
        }, this.PathAsVariableName = () => this.target ? this.target.firstComponent : null, this.ResolveTargetContent = () => {
          if (!this.isEmpty && !this.isEnd && null === this.targetContent) {
            let t6 = this.PathAsVariableName();
            if (null !== t6) {
              const e3 = r(ht(this), ct);
              if (e3) {
                const n2 = e3.ResolveVariableWithName(t6, this);
                if (n2.found) {
                  if (n2.isArgument && n2.ownerFlow && n2.ownerFlow.args) {
                    let e4 = n2.ownerFlow.args.find(((e5) => {
                      var n3;
                      return (null === (n3 = e5.identifier) || void 0 === n3 ? void 0 : n3.name) == t6;
                    }));
                    e4 && !e4.isDivertTarget && this.Error(`Since '${e4.identifier}' is used as a variable divert target (on ${this.debugMetadata}), it should be marked as: -> ${e4.identifier}`, n2.ownerFlow);
                  }
                  return void (this.runtimeDivert.variableDivertName = t6);
                }
              }
            }
            if (!this.target) throw new Error();
            this.targetContent = this.target.ResolveFromContext(this);
          }
        }, this.CheckArgumentValidity = () => {
          if (this.isEmpty) return;
          let t6 = 0;
          if (null !== this.args && this.args.length > 0 && (t6 = this.args.length), null === this.targetContent) return;
          const e3 = r(this.targetContent, ct);
          if (!(0 !== t6 || null !== e3 && e3.hasParameters)) return;
          if (null === e3 && t6 > 0) return void this.Error("target needs to be a knot or stitch in order to pass arguments");
          if (null !== e3 && (null === e3.args || !e3.args && t6 > 0)) return void this.Error(`target (${e3.name}) doesn't take parameters`);
          if (this.parent instanceof vt) return void (t6 > 0 && this.Error("can't store arguments in a divert target variable"));
          const n2 = e3.args.length;
          if (n2 !== t6) {
            let i2;
            return i2 = 0 === t6 ? "but there weren't any passed to it" : t6 < n2 ? `but only got ${t6}` : `but got ${t6}`, void this.Error(`to '${e3.identifier}' requires ${n2} arguments, ${i2}`);
          }
          for (let t7 = 0; t7 < n2; ++t7) {
            const n3 = e3.args[t7], i2 = this.args[t7];
            if (n3.isDivertTarget) {
              let t8 = r(i2, mt);
              if (i2 instanceof vt || null !== t8) {
                if (t8) {
                  const e4 = new ot(t8.pathIdentifiers);
                  e4.ResolveFromContext(t8) && this.Error(`Passing read count of '${e4.dotSeparatedComponents}' instead of a divert target. You probably meant '${e4}'`);
                }
              } else this.Error(`Target '${e3.identifier}' expects a divert target for the parameter named -> ${n3.identifier} but saw ${i2}`, i2);
            }
          }
          null !== e3 || this.Error("Can't call as a function or with arguments unless it's a knot or stitch");
        }, this.CheckExternalArgumentValidity = (t6) => {
          const e3 = this.target ? this.target.firstComponent : null, n2 = t6.externals.get(e3);
          if (!n2) throw new Error("external not found");
          const i2 = n2.argumentNames.length;
          let r2 = 0;
          this.args && (r2 = this.args.length), r2 !== i2 && this.Error(`incorrect number of arguments sent to external function '${e3}'. Expected ${i2} but got ${r2}`);
        }, this.toString = () => {
          let t6 = "";
          return null === this.target ? "-> <empty divert>" : (t6 += this.target.toString(), this.isTunnel && (t6 += " ->"), this.isFunctionCall && (t6 += " ()"), t6);
        }, t5 && (this.target = t5), e2 && (this.args = e2, this.AddContent(e2));
      }
      get typeName() {
        return "Divert";
      }
      ResolveReferences(t5) {
        if (this.isEmpty || this.isEnd || this.isDone) return;
        if (!this.runtimeDivert) throw new Error();
        this.targetContent && (this.runtimeDivert.targetPath = this.targetContent.runtimePath), super.ResolveReferences(t5);
        let e2 = r(this.targetContent, ct);
        e2 && (!e2.isFunction && this.isFunctionCall ? super.Error(`${e2.identifier} hasn't been marked as a function, but it's being called as one. Do you need to declare the knot as '== function ${e2.identifier} =='?`) : !e2.isFunction || this.isFunctionCall || this.parent instanceof vt || super.Error(e2.identifier + " can't be diverted to. It can only be called as a function since it's been marked as such: '" + e2.identifier + "(...)'"));
        const n2 = null !== this.targetContent;
        let i2 = false, s2 = false;
        if (!this.target) throw new Error();
        if (1 === this.target.numberOfComponents) {
          if (!this.target.firstComponent) throw new Error();
          if (i2 = ft.IsBuiltIn(this.target.firstComponent), s2 = t5.IsExternal(this.target.firstComponent), i2 || s2) return this.isFunctionCall || super.Error(`${this.target.firstComponent} must be called as a function: ~ ${this.target.firstComponent}()`), void (s2 && (this.runtimeDivert.isExternal = true, null !== this.args && (this.runtimeDivert.externalArgs = this.args.length), this.runtimeDivert.pushesToStack = false, this.runtimeDivert.targetPath = new p(this.target.firstComponent), this.CheckExternalArgumentValidity(t5)));
        }
        null == this.runtimeDivert.variableDivertName && (n2 || i2 || s2 || this.Error(`target not found: '${this.target}'`));
      }
      Error(t5) {
        let e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null, n2 = arguments.length > 2 && void 0 !== arguments[2] && arguments[2];
        e2 !== this && e2 ? super.Error(t5, e2) : this.isFunctionCall ? super.Error(`Function call ${t5}`, e2, n2) : super.Error(`Divert ${t5}`, e2, n2);
      }
    };
    St = class {
      constructor(t5, e2) {
        this.divert = t5, this.targetRuntimeObj = e2;
      }
    };
    yt = class {
      constructor(t5, e2) {
        this.divert = t5, this.targetContent = e2;
      }
    };
    !(function(t5) {
      t5[t5.Stopping = 1] = "Stopping", t5[t5.Cycle = 2] = "Cycle", t5[t5.Shuffle = 4] = "Shuffle", t5[t5.Once = 8] = "Once";
    })(bt || (bt = {}));
    wt = class extends c {
      constructor(t5, e2) {
        super(), this.sequenceType = e2, this._sequenceDivertsToResolve = [], this.GenerateRuntimeObject = () => {
          const t6 = new k();
          t6.visitsShouldBeCounted = true, t6.countingAtStartOnly = true, this._sequenceDivertsToResolve = [], t6.AddContent(D.EvalStart()), t6.AddContent(D.VisitIndex());
          const e3 = (this.sequenceType & bt.Once) > 0, n2 = (this.sequenceType & bt.Cycle) > 0, i2 = (this.sequenceType & bt.Stopping) > 0, r2 = (this.sequenceType & bt.Shuffle) > 0;
          let s2 = this.sequenceElements.length;
          if (e3 && (s2 += 1), i2 || e3 ? (t6.AddContent(new P(s2 - 1)), t6.AddContent(j.CallWithName("MIN"))) : n2 && (t6.AddContent(new P(this.sequenceElements.length)), t6.AddContent(j.CallWithName("%"))), r2) {
            const n3 = D.NoOp();
            if (e3 || i2) {
              const e4 = i2 ? this.sequenceElements.length - 1 : this.sequenceElements.length;
              t6.AddContent(D.Duplicate()), t6.AddContent(new P(e4)), t6.AddContent(j.CallWithName("=="));
              const r4 = new H();
              r4.isConditional = true, t6.AddContent(r4), this.AddDivertToResolve(r4, n3);
            }
            let r3 = this.sequenceElements.length;
            i2 && (r3 -= 1), t6.AddContent(new P(r3)), t6.AddContent(D.SequenceShuffleIndex()), (e3 || i2) && t6.AddContent(n3);
          }
          t6.AddContent(D.EvalEnd());
          const a2 = D.NoOp();
          for (let e4 = 0; e4 < s2; e4 += 1) {
            t6.AddContent(D.EvalStart()), t6.AddContent(D.Duplicate()), t6.AddContent(new P(e4)), t6.AddContent(j.CallWithName("==")), t6.AddContent(D.EvalEnd());
            const n3 = new H();
            let i3;
            if (n3.isConditional = true, t6.AddContent(n3), e4 < this.sequenceElements.length) {
              i3 = this.sequenceElements[e4].runtimeObject;
            } else i3 = new k();
            i3.name = `s${e4}`, i3.InsertContent(D.PopEvaluatedValue(), 0);
            const r3 = new H();
            i3.AddContent(r3), t6.AddToNamedContentOnly(i3), this.AddDivertToResolve(n3, i3), this.AddDivertToResolve(r3, a2);
          }
          return t6.AddContent(a2), t6;
        }, this.AddDivertToResolve = (t6, e3) => {
          this._sequenceDivertsToResolve.push(new yt(t6, e3));
        }, this.sequenceType = e2, this.sequenceElements = [];
        for (const e3 of t5) {
          const t6 = e3.content;
          let n2 = null;
          n2 = null === t6 || 0 === t6.length ? e3 : new At(t6), this.sequenceElements.push(n2), this.AddContent(n2);
        }
      }
      get typeName() {
        return "Sequence";
      }
      ResolveReferences(t5) {
        super.ResolveReferences(t5);
        for (const t6 of this._sequenceDivertsToResolve) t6.divert.targetPath = t6.targetContent.path;
      }
    };
    Et = class extends c {
      constructor() {
        super(...arguments), this._overrideDivertTarget = null, this._divertAfter = null, this.GenerateRuntimeObject = () => {
          const t5 = new k();
          if (t5.AddContent(D.EvalStart()), this.divertAfter) {
            const e2 = this.divertAfter.GenerateRuntimeObject(), n2 = e2;
            if (n2) {
              const e3 = this.divertAfter.args;
              if (null !== e3 && e3.length > 0) {
                let e4 = -1, i3 = -1;
                for (let t6 = 0; t6 < n2.content.length; t6 += 1) {
                  const r2 = n2.content[t6];
                  r2 && (-1 == e4 && r2.commandType === D.CommandType.EvalStart ? e4 = t6 : r2.commandType === D.CommandType.EvalEnd && (i3 = t6));
                }
                for (let r2 = e4 + 1; r2 < i3; r2 += 1) {
                  n2.content[r2].parent = null, t5.AddContent(n2.content[r2]);
                }
              }
            }
            let i2 = r(e2, H);
            if (null != i2 && i2.hasVariableTarget) {
              let e3 = new pt(i2.variableDivertName);
              t5.AddContent(e3);
            } else this._overrideDivertTarget = new O(), t5.AddContent(this._overrideDivertTarget);
          } else t5.AddContent(new V());
          return t5.AddContent(D.EvalEnd()), t5.AddContent(D.PopTunnel()), t5;
        }, this.toString = () => ` -> ${this._divertAfter}`;
      }
      get divertAfter() {
        return this._divertAfter;
      }
      set divertAfter(t5) {
        this._divertAfter = t5, this._divertAfter && this.AddContent(this._divertAfter);
      }
      get typeName() {
        return "TunnelOnwards";
      }
      ResolveReferences(t5) {
        super.ResolveReferences(t5), this.divertAfter && this.divertAfter.targetContent && (this._overrideDivertTarget.targetPath = this.divertAfter.targetContent.runtimePath);
      }
    };
    _t = class {
      constructor(t5, e2) {
        this._name = t5 || "", this._items = null, this._itemNameToValues = e2 || /* @__PURE__ */ new Map();
      }
      get name() {
        return this._name;
      }
      get items() {
        if (null == this._items) {
          this._items = /* @__PURE__ */ new Map();
          for (let [t5, e2] of this._itemNameToValues) {
            let n2 = new b(this.name, t5);
            this._items.set(n2.serialized(), e2);
          }
        }
        return this._items;
      }
      ValueForItem(t5) {
        if (!t5.itemName) return 0;
        let e2 = this._itemNameToValues.get(t5.itemName);
        return void 0 !== e2 ? e2 : 0;
      }
      ContainsItem(t5) {
        return !!t5.itemName && (t5.originName == this.name && this._itemNameToValues.has(t5.itemName));
      }
      ContainsItemWithName(t5) {
        return this._itemNameToValues.has(t5);
      }
      TryGetItemWithValue(t5, e2) {
        for (let [e3, n2] of this._itemNameToValues) if (n2 == t5) return { result: new b(this.name, e3), exists: true };
        return { result: b.Null, exists: false };
      }
      TryGetValueForItem(t5, e2) {
        if (!t5.itemName) return { result: 0, exists: false };
        let n2 = this._itemNameToValues.get(t5.itemName);
        return n2 ? { result: n2, exists: true } : { result: 0, exists: false };
      }
    };
    Tt = class extends c {
      get typeName() {
        return "ListDefinition";
      }
      get runtimeListDefinition() {
        var t5;
        const e2 = /* @__PURE__ */ new Map();
        for (const t6 of this.itemDefinitions) e2.has(t6.name) ? this.Error(`List '${this.identifier}' contains duplicate items called '${t6.name}'`) : e2.set(t6.name, t6.seriesValue);
        return new _t((null === (t5 = this.identifier) || void 0 === t5 ? void 0 : t5.name) || "", e2);
      }
      constructor(t5) {
        super(), this.itemDefinitions = t5, this.identifier = null, this.variableAssignment = null, this._elementsByName = null, this.ItemNamed = (t6) => {
          if (null === this._elementsByName) {
            this._elementsByName = /* @__PURE__ */ new Map();
            for (const t7 of this.itemDefinitions) this._elementsByName.set(t7.name, t7);
          }
          return this._elementsByName.get(t6) || null;
        }, this.GenerateRuntimeObject = () => {
          var t6, e3;
          const n2 = new w();
          for (const e4 of this.itemDefinitions) if (e4.inInitialList) {
            const i2 = new b((null === (t6 = this.identifier) || void 0 === t6 ? void 0 : t6.name) || null, e4.name || null);
            n2.Add(i2, e4.seriesValue);
          }
          return n2.SetInitialOriginName((null === (e3 = this.identifier) || void 0 === e3 ? void 0 : e3.name) || ""), new W(n2);
        };
        let e2 = 1;
        for (const t6 of this.itemDefinitions) null !== t6.explicitValue && (e2 = t6.explicitValue), t6.seriesValue = e2, e2 += 1;
        this.AddContent(t5);
      }
      ResolveReferences(t5) {
        super.ResolveReferences(t5), t5.CheckForNamingCollisions(this, this.identifier, J.List);
      }
    };
    xt = class extends c {
      get variableName() {
        return this.variableIdentifier.name;
      }
      get typeName() {
        return this.isNewTemporaryDeclaration ? "temp" : this.isGlobalDeclaration ? null !== this.listDefinition ? "LIST" : "VAR" : "variable assignment";
      }
      get isDeclaration() {
        return this.isGlobalDeclaration || this.isNewTemporaryDeclaration;
      }
      constructor(t5) {
        let { assignedExpression: e2, isGlobalDeclaration: n2, isTemporaryNewDeclaration: i2, listDef: r2, variableIdentifier: s2 } = t5;
        super(), this._runtimeAssignment = null, this.expression = null, this.listDefinition = null, this.GenerateRuntimeObject = () => {
          let t6 = null;
          if (this.isGlobalDeclaration ? t6 = this.story : this.isNewTemporaryDeclaration && (t6 = ht(this)), t6 && t6.AddNewVariableDeclaration(this), this.isGlobalDeclaration) return null;
          const e3 = new k();
          return this.expression ? e3.AddContent(this.expression.runtimeObject) : this.listDefinition && e3.AddContent(this.listDefinition.runtimeObject), this._runtimeAssignment = new z(this.variableName, this.isNewTemporaryDeclaration), e3.AddContent(this._runtimeAssignment), e3;
        }, this.toString = () => `${this.isGlobalDeclaration ? "VAR" : this.isNewTemporaryDeclaration ? "~ temp" : ""} ${this.variableName}`, this.variableIdentifier = s2, this.isGlobalDeclaration = Boolean(n2), this.isNewTemporaryDeclaration = Boolean(i2), r2 instanceof Tt ? (this.listDefinition = this.AddContent(r2), this.listDefinition.variableAssignment = this, this.isGlobalDeclaration = true) : e2 && (this.expression = this.AddContent(e2));
      }
      ResolveReferences(t5) {
        if (super.ResolveReferences(t5), this.isDeclaration && null === this.listDefinition && t5.CheckForNamingCollisions(this, this.variableIdentifier, this.isGlobalDeclaration ? J.Var : J.Temp), this.isGlobalDeclaration) {
          const t6 = r(this.expression, mt);
          !t6 || t6.isConstantReference || t6.isListItemReference || this.Error("global variable assignments cannot refer to other variables, only literal values, constants and list items");
        }
        if (!this.isNewTemporaryDeclaration) {
          const e2 = t5.ResolveVariableWithName(this.variableName, this);
          e2.found || (this.variableName in this.story.constants ? this.Error(`Can't re-assign to a constant (do you need to use VAR when declaring '${this.variableName}'?)`, this) : this.Error(`Variable could not be found to assign to: '${this.variableName}'`, this)), this._runtimeAssignment && (this._runtimeAssignment.isGlobal = e2.isGlobal);
        }
      }
    };
    At = class _At extends c {
      get rootContainer() {
        return this._rootContainer || (this._rootContainer = this.GenerateRuntimeObject()), this._rootContainer;
      }
      get namedWeavePoints() {
        return this._namedWeavePoints;
      }
      get lastParsedSignificantObject() {
        if (0 === this.content.length) return null;
        let t5 = null;
        for (let e3 = this.content.length - 1; e3 >= 0; --e3) {
          t5 = this.content[e3];
          let n2 = r(t5, it);
          if ((!n2 || "\n" !== n2.text) && !this.IsGlobalDeclaration(t5)) break;
        }
        const e2 = r(t5, _At);
        return e2 && (t5 = e2.lastParsedSignificantObject), t5;
      }
      constructor(t5) {
        let e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : -1;
        super(), this.previousWeavePoint = null, this.addContentToPreviousWeavePoint = false, this.hasSeenChoiceInSection = false, this.currentContainer = null, this._unnamedGatherCount = 0, this._choiceCount = 0, this._rootContainer = null, this._namedWeavePoints = /* @__PURE__ */ new Map(), this.looseEnds = [], this.gatherPointsToResolve = [], this.ResolveWeavePointNaming = () => {
          var t6, e3, n2;
          const i2 = [...this.FindAll(at)(((t7) => !(null === t7.name || void 0 === t7.name))), ...this.FindAll(X)(((t7) => !(null === t7.name || void 0 === t7.name)))];
          this._namedWeavePoints = /* @__PURE__ */ new Map();
          for (const r2 of i2) {
            const i3 = this.namedWeavePoints.get((null === (t6 = r2.identifier) || void 0 === t6 ? void 0 : t6.name) || "");
            if (i3) {
              const t7 = i3 instanceof at ? "gather" : "choice", e4 = i3;
              this.Error(`A ${t7} with the same label name '${r2.name}' already exists in this context on line ${e4.debugMetadata ? e4.debugMetadata.startLineNumber : "NO DEBUG METADATA AVAILABLE"}`, r2);
            }
            (null === (e3 = r2.identifier) || void 0 === e3 ? void 0 : e3.name) && this.namedWeavePoints.set(null === (n2 = r2.identifier) || void 0 === n2 ? void 0 : n2.name, r2);
          }
        }, this.ConstructWeaveHierarchyFromIndentation = () => {
          let t6 = 0;
          for (; t6 < this.content.length; ) {
            const e3 = this.content[t6];
            if (e3 instanceof X || e3 instanceof at) {
              const n2 = e3.indentationDepth - 1;
              if (n2 > this.baseIndentIndex) {
                let e4 = t6;
                for (; t6 < this.content.length; ) {
                  const e5 = r(this.content[t6], X) || r(this.content[t6], at);
                  if (null !== e5) {
                    if (e5.indentationDepth - 1 <= this.baseIndentIndex) break;
                  }
                  t6 += 1;
                }
                const i2 = t6 - e4, s2 = this.content.slice(e4, e4 + i2);
                this.content.splice(e4, i2);
                const a2 = new _At(s2, n2);
                this.InsertContent(e4, a2), t6 = e4;
              }
            }
            t6 += 1;
          }
        }, this.DetermineBaseIndentationFromContent = (t6) => {
          for (const e3 of t6) if (e3 instanceof X || e3 instanceof at) return e3.indentationDepth - 1;
          return 0;
        }, this.GenerateRuntimeObject = () => {
          this._rootContainer = new k(), this.currentContainer = this._rootContainer, this.looseEnds = [], this.gatherPointsToResolve = [];
          for (const t6 of this.content) if (t6 instanceof X || t6 instanceof at) this.AddRuntimeForWeavePoint(t6);
          else if (t6 instanceof _At) {
            const e3 = t6;
            this.AddRuntimeForNestedWeave(e3), this.gatherPointsToResolve.splice(0, 0, ...e3.gatherPointsToResolve);
          } else this.AddGeneralRuntimeContent(t6.runtimeObject);
          return this.PassLooseEndsToAncestors(), this._rootContainer;
        }, this.AddRuntimeForGather = (t6) => {
          const e3 = !this.hasSeenChoiceInSection;
          this.hasSeenChoiceInSection = false;
          const n2 = t6.runtimeContainer;
          if (t6.name || (n2.name = `g-${this._unnamedGatherCount}`, this._unnamedGatherCount += 1), e3) {
            if (!this.currentContainer) throw new Error();
            this.currentContainer.AddContent(n2);
          } else this.rootContainer.AddToNamedContentOnly(n2);
          for (const e4 of this.looseEnds) {
            const i2 = e4;
            if (i2 instanceof at) {
              if (i2.indentationDepth == t6.indentationDepth) continue;
            }
            let r2 = null;
            if (i2 instanceof Ct) r2 = i2.runtimeObject;
            else {
              r2 = new H();
              const t7 = i2;
              if (!t7.runtimeContainer) throw new Error();
              t7.runtimeContainer.AddContent(r2);
            }
            this.gatherPointsToResolve.push(new St(r2, n2));
          }
          this.looseEnds = [], this.currentContainer = n2;
        }, this.AddRuntimeForWeavePoint = (t6) => {
          if (t6 instanceof at) this.AddRuntimeForGather(t6);
          else if (t6 instanceof X) {
            if (!this.currentContainer) throw new Error();
            this.previousWeavePoint instanceof at && this.looseEnds.splice(this.looseEnds.indexOf(this.previousWeavePoint), 1);
            const e3 = t6;
            if (this.currentContainer.AddContent(e3.runtimeObject), !e3.innerContentContainer) throw new Error();
            e3.innerContentContainer.name = `c-${this._choiceCount}`, this.currentContainer.AddToNamedContentOnly(e3.innerContentContainer), this._choiceCount += 1, this.hasSeenChoiceInSection = true;
          }
          if (this.addContentToPreviousWeavePoint = false, this.WeavePointHasLooseEnd(t6)) {
            this.looseEnds.push(t6);
            r(t6, X) && (this.addContentToPreviousWeavePoint = true);
          }
          this.previousWeavePoint = t6;
        }, this.AddRuntimeForNestedWeave = (t6) => {
          this.AddGeneralRuntimeContent(t6.rootContainer), null !== this.previousWeavePoint && (this.looseEnds.splice(this.looseEnds.indexOf(this.previousWeavePoint), 1), this.addContentToPreviousWeavePoint = false);
        }, this.AddGeneralRuntimeContent = (t6) => {
          if (null !== t6) if (this.addContentToPreviousWeavePoint) {
            if (!this.previousWeavePoint || !this.previousWeavePoint.runtimeContainer) throw new Error();
            this.previousWeavePoint.runtimeContainer.AddContent(t6);
          } else {
            if (!this.currentContainer) throw new Error();
            this.currentContainer.AddContent(t6);
          }
        }, this.PassLooseEndsToAncestors = () => {
          if (0 === this.looseEnds.length) return;
          let t6 = null, e3 = null, n2 = false;
          for (let i2 = this.parent; null !== i2; i2 = i2.parent) {
            const s2 = r(i2, _At);
            s2 && (n2 || null !== t6 || (t6 = s2), n2 && null === e3 && (e3 = s2)), (i2 instanceof wt || i2 instanceof nt) && (n2 = true);
          }
          if (null !== t6 || null !== e3) for (let i2 = this.looseEnds.length - 1; i2 >= 0; i2 -= 1) {
            const r2 = this.looseEnds[i2];
            let s2 = false;
            if (n2) {
              if (r2 instanceof X && null !== t6) t6.ReceiveLooseEnd(r2), s2 = true;
              else if (!(r2 instanceof X)) {
                const n3 = t6 || e3;
                null !== n3 && (n3.ReceiveLooseEnd(r2), s2 = true);
              }
            } else (null == t6 ? void 0 : t6.hasOwnProperty("ReceiveLooseEnd")) && t6.ReceiveLooseEnd(r2), s2 = true;
            s2 && this.looseEnds.splice(i2, 1);
          }
        }, this.ReceiveLooseEnd = (t6) => {
          this.looseEnds.push(t6);
        }, this.WeavePointNamed = (t6) => {
          if (!this.namedWeavePoints) return null;
          let e3 = this.namedWeavePoints.get(t6);
          return e3 || null;
        }, this.IsGlobalDeclaration = (t6) => {
          const e3 = r(t6, xt);
          if (e3 && e3.isGlobalDeclaration && e3.isDeclaration) return true;
          return !!r(t6, rt);
        }, this.ContentThatFollowsWeavePoint = (t6) => {
          const e3 = [], n2 = t6;
          if (null !== n2.content) for (const t7 of n2.content) this.IsGlobalDeclaration(t7) || e3.push(t7);
          const i2 = r(n2.parent, _At);
          if (null === i2) throw new Error("Expected weave point parent to be weave?");
          for (let t7 = i2.content.indexOf(n2) + 1; t7 < i2.content.length; t7 += 1) {
            const n3 = i2.content[t7];
            if (!this.IsGlobalDeclaration(n3)) {
              if (n3 instanceof X || n3 instanceof at) break;
              if (n3 instanceof _At) break;
              e3.push(n3);
            }
          }
          return e3;
        }, this.ValidateTermination = (t6) => {
          if (this.lastParsedSignificantObject instanceof d) return;
          if (null !== this.looseEnds && this.looseEnds.length > 0) for (const e3 of this.looseEnds) {
            const n2 = this.ContentThatFollowsWeavePoint(e3);
            this.ValidateFlowOfObjectsTerminates(n2, e3, t6);
          }
          else {
            for (const t7 of this.content) if (t7 instanceof X || t7 instanceof Ct) return;
            this.ValidateFlowOfObjectsTerminates(this.content, this, t6);
          }
        }, this.BadNestedTerminationHandler = (t6) => {
          let e3 = null;
          for (let n3 = t6.parent; null !== n3; n3 = n3.parent) if (n3 instanceof wt || n3 instanceof nt) {
            e3 = r(n3, nt);
            break;
          }
          let n2 = "Choices nested in conditionals or sequences need to explicitly divert afterwards.";
          if (null !== e3) {
            1 === e3.FindAll(X)().length && (n2 = `Choices with conditions should be written: '* {condition} choice'. Otherwise, ${n2.toLowerCase()}`);
          }
          this.Error(n2, t6);
        }, this.ValidateFlowOfObjectsTerminates = (t6, e3, n2) => {
          let i2 = false, r2 = e3;
          for (const e4 of t6) {
            if (null !== e4.Find(Ct)(((t7) => !(t7.isThread || t7.isTunnel || t7.isFunctionCall || t7.parent instanceof vt))) && (i2 = true), null != e4.Find(Et)()) {
              i2 = true;
              break;
            }
            r2 = e4;
          }
          if (!i2) {
            if (r2 instanceof d) return;
            n2(r2);
          }
        }, this.WeavePointHasLooseEnd = (t6) => {
          if (null === t6.content) return true;
          for (let e3 = t6.content.length - 1; e3 >= 0; --e3) {
            let n2 = r(t6.content[e3], Ct);
            if (n2) {
              if (!(n2.isThread || n2.isTunnel || n2.isFunctionCall)) return false;
            }
          }
          return true;
        }, this.CheckForWeavePointNamingCollisions = () => {
          if (!this.namedWeavePoints) return;
          const t6 = [];
          for (const e3 of this.ancestry) {
            const n2 = r(e3, ct);
            if (!n2) break;
            t6.push(n2);
          }
          for (const [e3, n2] of this.namedWeavePoints) for (const i2 of t6) {
            const t7 = i2.ContentWithNameAtLevel(e3);
            if (t7 && t7 !== n2) {
              const i3 = `${n2.GetType()} '${e3}' has the same label name as a ${t7.GetType()} (on ${t7.debugMetadata})`;
              this.Error(i3, n2);
            }
          }
        }, this.baseIndentIndex = -1 == e2 ? this.DetermineBaseIndentationFromContent(t5) : e2, this.AddContent(t5), this.ConstructWeaveHierarchyFromIndentation();
      }
      get typeName() {
        return "Weave";
      }
      ResolveReferences(t5) {
        if (super.ResolveReferences(t5), null !== this.looseEnds && this.looseEnds.length > 0) {
          let t6 = false;
          for (let e2 = this.parent; null !== e2; e2 = e2.parent) if (e2 instanceof wt || e2 instanceof nt) {
            t6 = true;
            break;
          }
          t6 && this.ValidateTermination(this.BadNestedTerminationHandler);
        }
        for (const t6 of this.gatherPointsToResolve) t6.divert.targetPath = t6.targetRuntimeObj.path;
        this.CheckForWeavePointNamingCollisions();
      }
    };
    Pt = class extends c {
      get ownExpression() {
        return this._ownExpression;
      }
      set ownExpression(t5) {
        this._ownExpression = t5, this._ownExpression && this.AddContent(this._ownExpression);
      }
      constructor(t5) {
        super(), this._contentContainer = null, this._conditionalDivert = null, this._ownExpression = null, this._innerWeave = null, this.isTrueBranch = false, this.matchingEquality = false, this.isElse = false, this.isInline = false, this.returnDivert = null, this.GenerateRuntimeObject = () => {
          if (this._innerWeave) for (const t7 of this._innerWeave.content) {
            const e3 = r(t7, it);
            e3 && e3.text.startsWith("else:") && this.Warning("Saw the text 'else:' which is being treated as content. Did you mean '- else:'?", e3);
          }
          const t6 = new k(), e2 = this.matchingEquality && !this.isElse;
          if (e2 && t6.AddContent(D.Duplicate()), this._conditionalDivert = new H(), this._conditionalDivert.isConditional = !this.isElse, !this.isTrueBranch && !this.isElse) {
            const e3 = null !== this.ownExpression;
            e3 && t6.AddContent(D.EvalStart()), this.ownExpression && this.ownExpression.GenerateIntoContainer(t6), this.matchingEquality && t6.AddContent(j.CallWithName("==")), e3 && t6.AddContent(D.EvalEnd());
          }
          return t6.AddContent(this._conditionalDivert), this._contentContainer = this.GenerateRuntimeForContent(), this._contentContainer.name = "b", this.isInline || this._contentContainer.InsertContent(new I("\n"), 0), (e2 || this.isElse && this.matchingEquality) && this._contentContainer.InsertContent(D.PopEvaluatedValue(), 0), t6.AddToNamedContentOnly(this._contentContainer), this.returnDivert = new H(), this._contentContainer.AddContent(this.returnDivert), t6;
        }, this.GenerateRuntimeForContent = () => null === this._innerWeave ? new k() : this._innerWeave.rootContainer, t5 && (this._innerWeave = new At(t5), this.AddContent(this._innerWeave));
      }
      get typeName() {
        return "ConditionalSingleBranch";
      }
      ResolveReferences(t5) {
        if (!this._conditionalDivert || !this._contentContainer) throw new Error();
        this._conditionalDivert.targetPath = this._contentContainer.path, super.ResolveReferences(t5);
      }
    };
    !(function(t5) {
      t5[t5.ParsingString = 1] = "ParsingString", t5[t5.TagActive = 2] = "TagActive";
    })(Nt || (Nt = {}));
    It = class _It {
      constructor() {
        this.startLineNumber = 0, this.endLineNumber = 0, this.startCharacterNumber = 0, this.endCharacterNumber = 0, this.fileName = null, this.sourceName = null;
      }
      Merge(t5) {
        let e2 = new _It();
        return e2.fileName = this.fileName, e2.sourceName = this.sourceName, this.startLineNumber < t5.startLineNumber ? (e2.startLineNumber = this.startLineNumber, e2.startCharacterNumber = this.startCharacterNumber) : this.startLineNumber > t5.startLineNumber ? (e2.startLineNumber = t5.startLineNumber, e2.startCharacterNumber = t5.startCharacterNumber) : (e2.startLineNumber = this.startLineNumber, e2.startCharacterNumber = Math.min(this.startCharacterNumber, t5.startCharacterNumber)), this.endLineNumber > t5.endLineNumber ? (e2.endLineNumber = this.endLineNumber, e2.endCharacterNumber = this.endCharacterNumber) : this.endLineNumber < t5.endLineNumber ? (e2.endLineNumber = t5.endLineNumber, e2.endCharacterNumber = t5.endCharacterNumber) : (e2.endLineNumber = this.endLineNumber, e2.endCharacterNumber = Math.max(this.endCharacterNumber, t5.endCharacterNumber)), e2;
      }
      toString() {
        return null !== this.fileName ? `line ${this.startLineNumber} of ${this.fileName}"` : "line " + this.startLineNumber;
      }
    };
    Ot = class extends c {
      get name() {
        var t5;
        return (null === (t5 = this.identifier) || void 0 === t5 ? void 0 : t5.name) || null;
      }
      constructor(t5, e2) {
        super(), this.identifier = t5, this.argumentNames = e2, this.GenerateRuntimeObject = () => (this.story.AddExternal(this), null);
      }
      get typeName() {
        return "EXTERNAL";
      }
      toString() {
        var t5;
        return `EXTERNAL ${null === (t5 = this.identifier) || void 0 === t5 ? void 0 : t5.name}`;
      }
    };
    Ft = class {
      constructor(t5, e2, n2) {
        this.name = t5, this.args = e2, this.isFunction = n2;
      }
    };
    Wt = class extends c {
      constructor(t5) {
        super(), this._objToWrap = t5, this.GenerateRuntimeObject = () => this._objToWrap;
      }
    };
    Rt = class extends Wt {
      constructor(t5) {
        super(t5);
      }
      get typeName() {
        return "Glue";
      }
    };
    kt = class extends S {
      toString() {
        return "Glue";
      }
    };
    Dt = class extends L {
      constructor(t5, e2, n2) {
        super(), this.varIdentifier = t5, this._runtimeAssignment = null, this.expression = null, this.GenerateIntoContainer = (t6) => {
          var e3, n3;
          t6.AddContent(new pt((null === (e3 = this.varIdentifier) || void 0 === e3 ? void 0 : e3.name) || null)), this.expression ? this.expression.GenerateIntoContainer(t6) : t6.AddContent(new P(1)), t6.AddContent(j.CallWithName(this.isInc ? "+" : "-")), this._runtimeAssignment = new z((null === (n3 = this.varIdentifier) || void 0 === n3 ? void 0 : n3.name) || null, false), t6.AddContent(this._runtimeAssignment);
        }, this.toString = () => {
          var t6, e3;
          return this.expression ? `${null === (t6 = this.varIdentifier) || void 0 === t6 ? void 0 : t6.name}${this.isInc ? " += " : " -= "}${this.expression}` : `${null === (e3 = this.varIdentifier) || void 0 === e3 ? void 0 : e3.name}` + (this.isInc ? "++" : "--");
        }, e2 instanceof L ? (this.expression = e2, this.AddContent(this.expression), this.isInc = Boolean(n2)) : this.isInc = e2;
      }
      get typeName() {
        return "IncDecExpression";
      }
      ResolveReferences(t5) {
        var e2;
        super.ResolveReferences(t5);
        const n2 = t5.ResolveVariableWithName((null === (e2 = this.varIdentifier) || void 0 === e2 ? void 0 : e2.name) || "", this);
        if (n2.found || this.Error(`variable for ${this.incrementDecrementWord} could not be found: '${this.varIdentifier}' after searching: {this.descriptionOfScope}`), !this._runtimeAssignment) throw new Error();
        this._runtimeAssignment.isGlobal = n2.isGlobal, this.parent instanceof At || this.parent instanceof ct || this.parent instanceof dt || this.Error(`Can't use ${this.incrementDecrementWord} as sub-expression`);
      }
      get incrementDecrementWord() {
        return this.isInc ? "increment" : "decrement";
      }
    };
    Lt = class extends c {
      constructor(t5) {
        super(), this.includedStory = t5, this.GenerateRuntimeObject = () => null;
      }
      get typeName() {
        return "IncludedFile";
      }
    };
    Vt = class {
      constructor(t5, e2, n2) {
        this.type = t5, this.precedence = e2, this.requireWhitespace = n2, this.toString = () => this.type;
      }
    };
    jt = class extends ct {
      get flowLevel() {
        return st.Knot;
      }
      constructor(t5, e2, n2, i2) {
        super(t5, e2, n2, i2);
      }
      get typeName() {
        return this.isFunction ? "Function" : "Knot";
      }
      ResolveReferences(t5) {
        super.ResolveReferences(t5);
        let e2 = this.story;
        for (const t6 in this.subFlowsByName) {
          const n2 = e2.ContentWithNameAtLevel(t6, st.Knot, false);
          if (n2) {
            const e3 = this.subFlowsByName.get(t6), i2 = `Stitch '${e3 ? e3.name : "NO STITCH FOUND"}' has the same name as a knot (on ${n2.debugMetadata})`;
            this.Error(i2, e3);
          }
        }
      }
    };
    Bt = class extends L {
      constructor(t5) {
        super(), this.itemIdentifierList = t5, this.GenerateIntoContainer = (t6) => {
          var e2, n2;
          const i2 = new w();
          if (null != this.itemIdentifierList) for (const t7 of this.itemIdentifierList) {
            const r2 = (null === (e2 = null == t7 ? void 0 : t7.name) || void 0 === e2 ? void 0 : e2.split(".")) || [];
            let s2 = null, a2 = "";
            r2.length > 1 ? (s2 = r2[0], a2 = r2[1]) : a2 = r2[0];
            const o2 = this.story.ResolveListItem(s2, a2, this);
            if (null === o2) null === s2 ? this.Error(`Could not find list definition that contains item '${t7}'`) : this.Error(`Could not find list item ${t7}`);
            else {
              if (null == o2.parent) return void this.Error(`Could not find list definition for item ${t7}`);
              s2 || (s2 = (null === (n2 = o2.parent.identifier) || void 0 === n2 ? void 0 : n2.name) || null);
              const e3 = new b(s2, o2.name || null);
              i2.has(e3.serialized()) ? this.Warning(`Duplicate of item '${t7}' in list.`) : i2.Add(e3, o2.seriesValue);
            }
          }
          t6.AddContent(new W(i2));
        };
      }
      get typeName() {
        return "List";
      }
    };
    Mt = class extends c {
      get fullName() {
        var t5;
        const e2 = this.parent;
        if (null === e2) throw new Error("Can't get full name without a parent list.");
        return `${null === (t5 = e2.identifier) || void 0 === t5 ? void 0 : t5.name}.${this.name}`;
      }
      get typeName() {
        return "ListElement";
      }
      get name() {
        var t5;
        return (null === (t5 = this.indentifier) || void 0 === t5 ? void 0 : t5.name) || null;
      }
      constructor(t5, e2) {
        let n2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : null;
        super(), this.indentifier = t5, this.inInitialList = e2, this.explicitValue = n2, this.seriesValue = 0, this.parent = null, this.GenerateRuntimeObject = () => {
          throw new Error("Not implemented.");
        }, this.toString = () => this.fullName, this.parent = this.parent;
      }
      ResolveReferences(t5) {
        super.ResolveReferences(t5), t5.CheckForNamingCollisions(this, this.indentifier, J.ListItem);
      }
    };
    !(function(t5) {
      t5[t5.InnerBlock = 0] = "InnerBlock", t5[t5.Stitch = 1] = "Stitch", t5[t5.Knot = 2] = "Knot", t5[t5.Top = 3] = "Top";
    })(Gt || (Gt = {}));
    $t = class extends ct {
      get flowLevel() {
        return st.Stitch;
      }
      constructor(t5, e2, n2, i2) {
        super(t5, e2, n2, i2), this.baseToString = this.toString, this.toString = () => `${null !== this.parent ? this.parent + " > " : ""}${this.baseToString()}`;
      }
      get typeName() {
        return "Stitch";
      }
    };
    qt = class extends S {
      constructor(t5) {
        super(), this.text = t5.toString() || "";
      }
      toString() {
        return "# " + this.text;
      }
    };
    Ut = class _Ut extends S {
      constructor() {
        super(...arguments), this.text = "", this.index = 0, this.threadAtGeneration = null, this.sourcePath = "", this.targetPath = null, this.isInvisibleDefault = false, this.tags = null, this.originalThreadIndex = 0;
      }
      get pathStringOnChoice() {
        return null === this.targetPath ? C("Choice.targetPath") : this.targetPath.toString();
      }
      set pathStringOnChoice(t5) {
        this.targetPath = new p(t5);
      }
      Clone() {
        let t5 = new _Ut();
        return t5.text = this.text, t5.sourcePath = this.sourcePath, t5.index = this.index, t5.targetPath = this.targetPath, t5.originalThreadIndex = this.originalThreadIndex, t5.isInvisibleDefault = this.isInvisibleDefault, null !== this.threadAtGeneration && (t5.threadAtGeneration = this.threadAtGeneration.Copy()), t5;
      }
    };
    Kt = class {
      constructor(t5) {
        this._lists = /* @__PURE__ */ new Map(), this._allUnambiguousListValueCache = /* @__PURE__ */ new Map();
        for (let e2 of t5) {
          this._lists.set(e2.name, e2);
          for (let [t6, n2] of e2.items) {
            let e3 = b.fromSerializedKey(t6), i2 = new W(e3, n2);
            if (!e3.itemName) throw new Error("item.itemName is null or undefined.");
            this._allUnambiguousListValueCache.set(e3.itemName, i2), this._allUnambiguousListValueCache.set(e3.fullName, i2);
          }
        }
      }
      get lists() {
        let t5 = [];
        for (let [, e2] of this._lists) t5.push(e2);
        return t5;
      }
      TryListGetDefinition(t5, e2) {
        if (null === t5) return { result: e2, exists: false };
        let n2 = this._lists.get(t5);
        return n2 ? { result: n2, exists: true } : { result: e2, exists: false };
      }
      FindSingleItemListWithName(t5) {
        if (null === t5) return C("name");
        let e2 = this._allUnambiguousListValueCache.get(t5);
        return void 0 !== e2 ? e2 : null;
      }
    };
    Ht = class _Ht {
      static JArrayToRuntimeObjList(t5) {
        let e2 = arguments.length > 1 && void 0 !== arguments[1] && arguments[1], n2 = t5.length;
        e2 && n2--;
        let i2 = [];
        for (let e3 = 0; e3 < n2; e3++) {
          let n3 = t5[e3], r2 = this.JTokenToRuntimeObject(n3);
          if (null === r2) return C("runtimeObj");
          i2.push(r2);
        }
        return i2;
      }
      static WriteDictionaryRuntimeObjs(t5, e2) {
        t5.WriteObjectStart();
        for (let [n2, i2] of e2) t5.WritePropertyStart(n2), this.WriteRuntimeObject(t5, i2), t5.WritePropertyEnd();
        t5.WriteObjectEnd();
      }
      static WriteListRuntimeObjs(t5, e2) {
        t5.WriteArrayStart();
        for (let n2 of e2) this.WriteRuntimeObject(t5, n2);
        t5.WriteArrayEnd();
      }
      static WriteIntDictionary(t5, e2) {
        t5.WriteObjectStart();
        for (let [n2, i2] of e2) t5.WriteIntProperty(n2, i2);
        t5.WriteObjectEnd();
      }
      static WriteRuntimeObject(t5, e2) {
        let n2 = r(e2, k);
        if (n2) return void this.WriteRuntimeContainer(t5, n2);
        let i2 = r(e2, H);
        if (i2) {
          let e3, n3 = "->";
          return i2.isExternal ? n3 = "x()" : i2.pushesToStack && (i2.stackPushType == g.Function ? n3 = "f()" : i2.stackPushType == g.Tunnel && (n3 = "->t->")), e3 = i2.hasVariableTarget ? i2.variableDivertName : i2.targetPathString, t5.WriteObjectStart(), t5.WriteProperty(n3, e3), i2.hasVariableTarget && t5.WriteProperty("var", true), i2.isConditional && t5.WriteProperty("c", true), i2.externalArgs > 0 && t5.WriteIntProperty("exArgs", i2.externalArgs), void t5.WriteObjectEnd();
        }
        let s2 = r(e2, U);
        if (s2) return t5.WriteObjectStart(), t5.WriteProperty("*", s2.pathStringOnChoice), t5.WriteIntProperty("flg", s2.flags), void t5.WriteObjectEnd();
        let a2 = r(e2, A);
        if (a2) return void t5.WriteBool(a2.value);
        let o2 = r(e2, P);
        if (o2) return void t5.WriteInt(o2.value);
        let l2 = r(e2, N);
        if (l2) return void t5.WriteFloat(l2.value);
        let h2 = r(e2, I);
        if (h2) return void (h2.isNewline ? t5.Write("\n", false) : (t5.WriteStringStart(), t5.WriteStringInner("^"), t5.WriteStringInner(h2.value), t5.WriteStringEnd()));
        let u2 = r(e2, W);
        if (u2) return void this.WriteInkList(t5, u2);
        let c2 = r(e2, O);
        if (c2) return t5.WriteObjectStart(), null === c2.value ? C("divTargetVal.value") : (t5.WriteProperty("^->", c2.value.componentsString), void t5.WriteObjectEnd());
        let d2 = r(e2, F);
        if (d2) return t5.WriteObjectStart(), t5.WriteProperty("^var", d2.value), t5.WriteIntProperty("ci", d2.contextIndex), void t5.WriteObjectEnd();
        if (r(e2, kt)) return void t5.Write("<>");
        let p2 = r(e2, D);
        if (p2) return void t5.Write(_Ht._controlCommandNames[p2.commandType]);
        let m2 = r(e2, j);
        if (m2) {
          let e3 = m2.name;
          return "^" == e3 && (e3 = "L^"), void t5.Write(e3);
        }
        let f2 = r(e2, pt);
        if (f2) {
          t5.WriteObjectStart();
          let e3 = f2.pathStringForCount;
          return null != e3 ? t5.WriteProperty("CNT?", e3) : t5.WriteProperty("VAR?", f2.name), void t5.WriteObjectEnd();
        }
        let v2 = r(e2, z);
        if (v2) {
          t5.WriteObjectStart();
          let e3 = v2.isGlobal ? "VAR=" : "temp=";
          return t5.WriteProperty(e3, v2.variableName), v2.isNewDeclaration || t5.WriteProperty("re", true), void t5.WriteObjectEnd();
        }
        if (r(e2, V)) return void t5.Write("void");
        let S2 = r(e2, qt);
        if (S2) return t5.WriteObjectStart(), t5.WriteProperty("#", S2.text), void t5.WriteObjectEnd();
        let y2 = r(e2, Ut);
        if (!y2) throw new Error("Failed to convert runtime object to Json token: " + e2);
        this.WriteChoice(t5, y2);
      }
      static JObjectToDictionaryRuntimeObjs(t5) {
        let e2 = /* @__PURE__ */ new Map();
        for (let n2 in t5) if (t5.hasOwnProperty(n2)) {
          let i2 = this.JTokenToRuntimeObject(t5[n2]);
          if (null === i2) return C("inkObject");
          e2.set(n2, i2);
        }
        return e2;
      }
      static JObjectToIntDictionary(t5) {
        let e2 = /* @__PURE__ */ new Map();
        for (let n2 in t5) t5.hasOwnProperty(n2) && e2.set(n2, parseInt(t5[n2]));
        return e2;
      }
      static JTokenToRuntimeObject(t5) {
        if ("number" == typeof t5 && !isNaN(t5) || "boolean" == typeof t5) return x.Create(t5);
        if ("string" == typeof t5) {
          let e2 = t5.toString();
          const n2 = /^([0-9]+.[0-9]+f)$/.exec(e2);
          if (n2) return new N(parseFloat(n2[0]));
          let i2 = e2[0];
          if ("^" == i2) return new I(e2.substring(1));
          if ("\n" == i2 && 1 == e2.length) return new I("\n");
          if ("<>" == e2) return new kt();
          for (let t6 = 0; t6 < _Ht._controlCommandNames.length; ++t6) {
            if (e2 == _Ht._controlCommandNames[t6]) return new D(t6);
          }
          if ("L^" == e2 && (e2 = "^"), j.CallExistsWithName(e2)) return j.CallWithName(e2);
          if ("->->" == e2) return D.PopTunnel();
          if ("~ret" == e2) return D.PopFunction();
          if ("void" == e2) return new V();
        }
        if ("object" == typeof t5 && !Array.isArray(t5)) {
          let e2, n2 = t5;
          if (n2["^->"]) return e2 = n2["^->"], new O(new p(e2.toString()));
          if (n2["^var"]) {
            e2 = n2["^var"];
            let t6 = new F(e2.toString());
            return "ci" in n2 && (e2 = n2.ci, t6.contextIndex = parseInt(e2)), t6;
          }
          let i2 = false, r2 = false, s2 = g.Function, a2 = false;
          if ((e2 = n2["->"]) ? i2 = true : (e2 = n2["f()"]) ? (i2 = true, r2 = true, s2 = g.Function) : (e2 = n2["->t->"]) ? (i2 = true, r2 = true, s2 = g.Tunnel) : (e2 = n2["x()"]) && (i2 = true, a2 = true, r2 = false, s2 = g.Function), i2) {
            let t6 = new H();
            t6.pushesToStack = r2, t6.stackPushType = s2, t6.isExternal = a2;
            let i3 = e2.toString();
            return (e2 = n2.var) ? t6.variableDivertName = i3 : t6.targetPathString = i3, t6.isConditional = !!n2.c, a2 && (e2 = n2.exArgs) && (t6.externalArgs = parseInt(e2)), t6;
          }
          if (e2 = n2["*"]) {
            let t6 = new U();
            return t6.pathStringOnChoice = e2.toString(), (e2 = n2.flg) && (t6.flags = parseInt(e2)), t6;
          }
          if (e2 = n2["VAR?"]) return new pt(e2.toString());
          if (e2 = n2["CNT?"]) {
            let t6 = new pt();
            return t6.pathStringForCount = e2.toString(), t6;
          }
          let o2 = false, l2 = false;
          if ((e2 = n2["VAR="]) ? (o2 = true, l2 = true) : (e2 = n2["temp="]) && (o2 = true, l2 = false), o2) {
            let t6 = e2.toString(), i3 = !n2.re, r3 = new z(t6, i3);
            return r3.isGlobal = l2, r3;
          }
          if (void 0 !== n2["#"]) return e2 = n2["#"], new qt(e2.toString());
          if (e2 = n2.list) {
            let t6 = e2, i3 = new w();
            if (e2 = n2.origins) {
              let t7 = e2;
              i3.SetInitialOriginNames(t7);
            }
            for (let e3 in t6) if (t6.hasOwnProperty(e3)) {
              let n3 = t6[e3], r3 = new b(e3), s3 = parseInt(n3);
              i3.Add(r3, s3);
            }
            return new W(i3);
          }
          if (null != n2.originalChoicePath) return this.JObjectToChoice(n2);
        }
        if (Array.isArray(t5)) return this.JArrayToContainer(t5);
        if (null == t5) return null;
        throw new Error("Failed to convert token to runtime object: " + this.toJson(t5, ["parent"]));
      }
      static toJson(t5, e2, n2) {
        return JSON.stringify(t5, ((t6, n3) => (null == e2 ? void 0 : e2.some(((e3) => e3 === t6))) ? void 0 : n3), n2);
      }
      static WriteRuntimeContainer(t5, e2) {
        let n2 = arguments.length > 2 && void 0 !== arguments[2] && arguments[2];
        if (t5.WriteArrayStart(), null === e2) return C("container");
        for (let n3 of e2.content) this.WriteRuntimeObject(t5, n3);
        let i2 = e2.namedOnlyContent, s2 = e2.countFlags, a2 = null != e2.name && !n2, o2 = null != i2 || s2 > 0 || a2;
        if (o2 && t5.WriteObjectStart(), null != i2) for (let [e3, n3] of i2) {
          let i3 = e3, s3 = r(n3, k);
          t5.WritePropertyStart(i3), this.WriteRuntimeContainer(t5, s3, true), t5.WritePropertyEnd();
        }
        s2 > 0 && t5.WriteIntProperty("#f", s2), a2 && t5.WriteProperty("#n", e2.name), o2 ? t5.WriteObjectEnd() : t5.WriteNull(), t5.WriteArrayEnd();
      }
      static JArrayToContainer(t5) {
        let e2 = new k();
        e2.content = this.JArrayToRuntimeObjList(t5, true);
        let n2 = t5[t5.length - 1];
        if (null != n2) {
          let t6 = /* @__PURE__ */ new Map();
          for (let i2 in n2) if ("#f" == i2) e2.countFlags = parseInt(n2[i2]);
          else if ("#n" == i2) e2.name = n2[i2].toString();
          else {
            let e3 = this.JTokenToRuntimeObject(n2[i2]), s2 = r(e3, k);
            s2 && (s2.name = i2), t6.set(i2, e3);
          }
          e2.namedOnlyContent = t6;
        }
        return e2;
      }
      static JObjectToChoice(t5) {
        let e2 = new Ut();
        return e2.text = t5.text.toString(), e2.index = parseInt(t5.index), e2.sourcePath = t5.originalChoicePath.toString(), e2.originalThreadIndex = parseInt(t5.originalThreadIndex), e2.pathStringOnChoice = t5.targetPath.toString(), e2.tags = this.JArrayToTags(t5), e2.isInvisibleDefault = !!t5.isInvisibleDefault, e2;
      }
      static JArrayToTags(t5) {
        return t5.tags ? t5.tags : null;
      }
      static WriteChoice(t5, e2) {
        t5.WriteObjectStart(), t5.WriteProperty("text", e2.text), t5.WriteIntProperty("index", e2.index), t5.WriteProperty("originalChoicePath", e2.sourcePath), t5.WriteIntProperty("originalThreadIndex", e2.originalThreadIndex), t5.WriteProperty("targetPath", e2.pathStringOnChoice), t5.WriteProperty("isInvisibleDefault", e2.isInvisibleDefault), this.WriteChoiceTags(t5, e2), t5.WriteObjectEnd();
      }
      static WriteChoiceTags(t5, e2) {
        if (e2.tags && e2.tags.length > 0) {
          t5.WritePropertyStart("tags"), t5.WriteArrayStart();
          for (const n2 of e2.tags) t5.Write(n2);
          t5.WriteArrayEnd(), t5.WritePropertyEnd();
        }
      }
      static WriteInkList(t5, e2) {
        let n2 = e2.value;
        if (null === n2) return C("rawList");
        t5.WriteObjectStart(), t5.WritePropertyStart("list"), t5.WriteObjectStart();
        for (let [e3, i2] of n2) {
          let n3 = b.fromSerializedKey(e3), r2 = i2;
          if (null === n3.itemName) return C("item.itemName");
          t5.WritePropertyNameStart(), t5.WritePropertyNameInner(n3.originName ? n3.originName : "?"), t5.WritePropertyNameInner("."), t5.WritePropertyNameInner(n3.itemName), t5.WritePropertyNameEnd(), t5.Write(r2), t5.WritePropertyEnd();
        }
        if (t5.WriteObjectEnd(), t5.WritePropertyEnd(), 0 == n2.Count && null != n2.originNames && n2.originNames.length > 0) {
          t5.WritePropertyStart("origins"), t5.WriteArrayStart();
          for (let e3 of n2.originNames) t5.Write(e3);
          t5.WriteArrayEnd(), t5.WritePropertyEnd();
        }
        t5.WriteObjectEnd();
      }
      static ListDefinitionsToJToken(t5) {
        let e2 = {};
        for (let n2 of t5.lists) {
          let t6 = {};
          for (let [e3, i2] of n2.items) {
            let n3 = b.fromSerializedKey(e3);
            if (null === n3.itemName) return C("item.itemName");
            t6[n3.itemName] = i2;
          }
          e2[n2.name] = t6;
        }
        return e2;
      }
      static JTokenToListDefinitions(t5) {
        let e2 = t5, n2 = [];
        for (let t6 in e2) if (e2.hasOwnProperty(t6)) {
          let i2 = t6.toString(), r2 = e2[t6], s2 = /* @__PURE__ */ new Map();
          for (let n3 in r2) if (e2.hasOwnProperty(t6)) {
            let t7 = r2[n3];
            s2.set(n3, parseInt(t7));
          }
          let a2 = new _t(i2, s2);
          n2.push(a2);
        }
        return new Kt(n2);
      }
    };
    Ht._controlCommandNames = (() => {
      let t5 = [];
      t5[D.CommandType.EvalStart] = "ev", t5[D.CommandType.EvalOutput] = "out", t5[D.CommandType.EvalEnd] = "/ev", t5[D.CommandType.Duplicate] = "du", t5[D.CommandType.PopEvaluatedValue] = "pop", t5[D.CommandType.PopFunction] = "~ret", t5[D.CommandType.PopTunnel] = "->->", t5[D.CommandType.BeginString] = "str", t5[D.CommandType.EndString] = "/str", t5[D.CommandType.NoOp] = "nop", t5[D.CommandType.ChoiceCount] = "choiceCnt", t5[D.CommandType.Turns] = "turn", t5[D.CommandType.TurnsSince] = "turns", t5[D.CommandType.ReadCount] = "readc", t5[D.CommandType.Random] = "rnd", t5[D.CommandType.SeedRandom] = "srnd", t5[D.CommandType.VisitIndex] = "visit", t5[D.CommandType.SequenceShuffleIndex] = "seq", t5[D.CommandType.StartThread] = "thread", t5[D.CommandType.Done] = "done", t5[D.CommandType.End] = "end", t5[D.CommandType.ListFromInt] = "listInt", t5[D.CommandType.ListRange] = "range", t5[D.CommandType.ListRandom] = "lrnd", t5[D.CommandType.BeginTag] = "#", t5[D.CommandType.EndTag] = "/#";
      for (let e2 = 0; e2 < D.CommandType.TOTAL_VALUES; ++e2) if (null == t5[e2]) throw new Error("Control command not accounted for in serialisation");
      return t5;
    })();
    Jt = class _Jt {
      get elements() {
        return this.callStack;
      }
      get depth() {
        return this.elements.length;
      }
      get currentElement() {
        let t5 = this._threads[this._threads.length - 1].callstack;
        return t5[t5.length - 1];
      }
      get currentElementIndex() {
        return this.callStack.length - 1;
      }
      get currentThread() {
        return this._threads[this._threads.length - 1];
      }
      set currentThread(t5) {
        m.Assert(1 == this._threads.length, "Shouldn't be directly setting the current thread when we have a stack of them"), this._threads.length = 0, this._threads.push(t5);
      }
      get canPop() {
        return this.callStack.length > 1;
      }
      constructor() {
        if (this._threadCounter = 0, this._startOfRoot = K.Null, arguments[0] instanceof ie) {
          let t5 = arguments[0];
          this._startOfRoot = K.StartOf(t5.rootContentContainer), this.Reset();
        } else {
          let t5 = arguments[0];
          this._threads = [];
          for (let e2 of t5._threads) this._threads.push(e2.Copy());
          this._threadCounter = t5._threadCounter, this._startOfRoot = t5._startOfRoot.copy();
        }
      }
      Reset() {
        this._threads = [], this._threads.push(new _Jt.Thread()), this._threads[0].callstack.push(new _Jt.Element(g.Tunnel, this._startOfRoot));
      }
      SetJsonToken(t5, e2) {
        this._threads.length = 0;
        let n2 = t5.threads;
        for (let t6 of n2) {
          let n3 = t6, i2 = new _Jt.Thread(n3, e2);
          this._threads.push(i2);
        }
        this._threadCounter = parseInt(t5.threadCounter), this._startOfRoot = K.StartOf(e2.rootContentContainer);
      }
      WriteJson(t5) {
        t5.WriteObject(((t6) => {
          t6.WritePropertyStart("threads"), t6.WriteArrayStart();
          for (let e2 of this._threads) e2.WriteJson(t6);
          t6.WriteArrayEnd(), t6.WritePropertyEnd(), t6.WritePropertyStart("threadCounter"), t6.WriteInt(this._threadCounter), t6.WritePropertyEnd();
        }));
      }
      PushThread() {
        let t5 = this.currentThread.Copy();
        this._threadCounter++, t5.threadIndex = this._threadCounter, this._threads.push(t5);
      }
      ForkThread() {
        let t5 = this.currentThread.Copy();
        return this._threadCounter++, t5.threadIndex = this._threadCounter, t5;
      }
      PopThread() {
        if (!this.canPopThread) throw new Error("Can't pop thread");
        this._threads.splice(this._threads.indexOf(this.currentThread), 1);
      }
      get canPopThread() {
        return this._threads.length > 1 && !this.elementIsEvaluateFromGame;
      }
      get elementIsEvaluateFromGame() {
        return this.currentElement.type == g.FunctionEvaluationFromGame;
      }
      Push(t5) {
        let e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 0, n2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : 0, i2 = new _Jt.Element(t5, this.currentElement.currentPointer, false);
        i2.evaluationStackHeightWhenPushed = e2, i2.functionStartInOutputStream = n2, this.callStack.push(i2);
      }
      CanPop() {
        let t5 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : null;
        return !!this.canPop && (null == t5 || this.currentElement.type == t5);
      }
      Pop() {
        let t5 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : null;
        if (!this.CanPop(t5)) throw new Error("Mismatched push/pop in Callstack");
        this.callStack.pop();
      }
      GetTemporaryVariableWithName(t5) {
        let e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : -1;
        -1 == e2 && (e2 = this.currentElementIndex + 1);
        let n2 = _(this.callStack[e2 - 1].temporaryVariables, t5, null);
        return n2.exists ? n2.result : null;
      }
      SetTemporaryVariable(t5, e2, n2) {
        let i2 = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : -1;
        -1 == i2 && (i2 = this.currentElementIndex + 1);
        let r2 = this.callStack[i2 - 1];
        if (!n2 && !r2.temporaryVariables.get(t5)) throw new Error("Could not find temporary variable to set: " + t5);
        let s2 = _(r2.temporaryVariables, t5, null);
        s2.exists && W.RetainListOriginsForAssignment(s2.result, e2), r2.temporaryVariables.set(t5, e2);
      }
      ContextForVariableNamed(t5) {
        return this.currentElement.temporaryVariables.get(t5) ? this.currentElementIndex + 1 : 0;
      }
      ThreadWithIndex(t5) {
        let e2 = this._threads.filter(((e3) => {
          if (e3.threadIndex == t5) return e3;
        }));
        return e2.length > 0 ? e2[0] : null;
      }
      get callStack() {
        return this.currentThread.callstack;
      }
      get callStackTrace() {
        let t5 = new y();
        for (let e2 = 0; e2 < this._threads.length; e2++) {
          let n2 = this._threads[e2], i2 = e2 == this._threads.length - 1;
          t5.AppendFormat("=== THREAD {0}/{1} {2}===\n", e2 + 1, this._threads.length, i2 ? "(current) " : "");
          for (let e3 = 0; e3 < n2.callstack.length; e3++) {
            n2.callstack[e3].type == g.Function ? t5.Append("  [FUNCTION] ") : t5.Append("  [TUNNEL] ");
            let i3 = n2.callstack[e3].currentPointer;
            if (!i3.isNull) {
              if (t5.Append("<SOMEWHERE IN "), null === i3.container) return C("pointer.container");
              t5.Append(i3.container.path.toString()), t5.AppendLine(">");
            }
          }
        }
        return t5.toString();
      }
    };
    !(function(t5) {
      class e2 {
        constructor(t6, e3) {
          let n3 = arguments.length > 2 && void 0 !== arguments[2] && arguments[2];
          this.evaluationStackHeightWhenPushed = 0, this.functionStartInOutputStream = 0, this.currentPointer = e3.copy(), this.inExpressionEvaluation = n3, this.temporaryVariables = /* @__PURE__ */ new Map(), this.type = t6;
        }
        Copy() {
          let t6 = new e2(this.type, this.currentPointer, this.inExpressionEvaluation);
          return t6.temporaryVariables = new Map(this.temporaryVariables), t6.evaluationStackHeightWhenPushed = this.evaluationStackHeightWhenPushed, t6.functionStartInOutputStream = this.functionStartInOutputStream, t6;
        }
      }
      t5.Element = e2;
      class n2 {
        constructor() {
          if (this.threadIndex = 0, this.previousPointer = K.Null, this.callstack = [], arguments[0] && arguments[1]) {
            let t6 = arguments[0], n3 = arguments[1];
            this.threadIndex = parseInt(t6.threadIndex);
            let i2 = t6.callstack;
            for (let t7 of i2) {
              let i3, r3 = t7, s2 = parseInt(r3.type), a2 = K.Null, o2 = r3.cPath;
              if (void 0 !== o2) {
                i3 = o2.toString();
                let t8 = n3.ContentAtPath(new p(i3));
                if (a2.container = t8.container, a2.index = parseInt(r3.idx), null == t8.obj) throw new Error("When loading state, internal story location couldn't be found: " + i3 + ". Has the story changed since this save data was created?");
                t8.approximate && (null !== a2.container ? n3.Warning("When loading state, exact internal story location couldn't be found: '" + i3 + "', so it was approximated to '" + a2.container.path.toString() + "' to recover. Has the story changed since this save data was created?") : n3.Warning("When loading state, exact internal story location couldn't be found: '" + i3 + "' and it may not be recoverable. Has the story changed since this save data was created?"));
              }
              let l2 = !!r3.exp, h2 = new e2(s2, a2, l2), u2 = r3.temp;
              void 0 !== u2 ? h2.temporaryVariables = Ht.JObjectToDictionaryRuntimeObjs(u2) : h2.temporaryVariables.clear(), this.callstack.push(h2);
            }
            let r2 = t6.previousContentObject;
            if (void 0 !== r2) {
              let t7 = new p(r2.toString());
              this.previousPointer = n3.PointerAtPath(t7);
            }
          }
        }
        Copy() {
          let t6 = new n2();
          t6.threadIndex = this.threadIndex;
          for (let e3 of this.callstack) t6.callstack.push(e3.Copy());
          return t6.previousPointer = this.previousPointer.copy(), t6;
        }
        WriteJson(t6) {
          t6.WriteObjectStart(), t6.WritePropertyStart("callstack"), t6.WriteArrayStart();
          for (let e3 of this.callstack) {
            if (t6.WriteObjectStart(), !e3.currentPointer.isNull) {
              if (null === e3.currentPointer.container) return C("el.currentPointer.container");
              t6.WriteProperty("cPath", e3.currentPointer.container.path.componentsString), t6.WriteIntProperty("idx", e3.currentPointer.index);
            }
            t6.WriteProperty("exp", e3.inExpressionEvaluation), t6.WriteIntProperty("type", e3.type), e3.temporaryVariables.size > 0 && (t6.WritePropertyStart("temp"), Ht.WriteDictionaryRuntimeObjs(t6, e3.temporaryVariables), t6.WritePropertyEnd()), t6.WriteObjectEnd();
          }
          if (t6.WriteArrayEnd(), t6.WritePropertyEnd(), t6.WriteIntProperty("threadIndex", this.threadIndex), !this.previousPointer.isNull) {
            let e3 = this.previousPointer.Resolve();
            if (null === e3) return C("this.previousPointer.Resolve()");
            t6.WriteProperty("previousContentObject", e3.path.toString());
          }
          t6.WriteObjectEnd();
        }
      }
      t5.Thread = n2;
    })(Jt || (Jt = {}));
    zt = class _zt extends class {
    } {
      variableChangedEvent(t5, e2) {
        for (let n2 of this.variableChangedEventCallbacks) n2(t5, e2);
      }
      StartVariableObservation() {
        this._batchObservingVariableChanges = true, this._changedVariablesForBatchObs = /* @__PURE__ */ new Set();
      }
      CompleteVariableObservation() {
        this._batchObservingVariableChanges = false;
        let t5 = /* @__PURE__ */ new Map();
        if (null != this._changedVariablesForBatchObs) for (let t6 of this._changedVariablesForBatchObs) {
          let e2 = this._globalVariables.get(t6);
          this.variableChangedEvent(t6, e2);
        }
        if (null != this.patch) for (let e2 of this.patch.changedVariables) {
          let n2 = this.patch.TryGetGlobal(e2, null);
          n2.exists && t5.set(e2, n2);
        }
        return this._changedVariablesForBatchObs = null, t5;
      }
      NotifyObservers(t5) {
        for (const [e2, n2] of t5) this.variableChangedEvent(e2, n2);
      }
      get callStack() {
        return this._callStack;
      }
      set callStack(t5) {
        this._callStack = t5;
      }
      $(t5, e2) {
        if (void 0 === e2) {
          let e3 = null;
          return null !== this.patch && (e3 = this.patch.TryGetGlobal(t5, null), e3.exists) ? e3.result.valueObject : (e3 = this._globalVariables.get(t5), void 0 === e3 && (e3 = this._defaultGlobalVariables.get(t5)), void 0 !== e3 ? e3.valueObject : null);
        }
        {
          if (void 0 === this._defaultGlobalVariables.get(t5)) throw new E("Cannot assign to a variable (" + t5 + ") that hasn't been declared in the story");
          let n2 = x.Create(e2);
          if (null == n2) throw null == e2 ? new Error("Cannot pass null to VariableState") : new Error("Invalid value passed to VariableState: " + e2.toString());
          this.SetGlobal(t5, n2);
        }
      }
      constructor(t5, e2) {
        super(), this.variableChangedEventCallbacks = [], this.patch = null, this._defaultGlobalVariables = /* @__PURE__ */ new Map(), this._changedVariablesForBatchObs = /* @__PURE__ */ new Set(), this._batchObservingVariableChanges = false, this._globalVariables = /* @__PURE__ */ new Map(), this._callStack = t5, this._listDefsOrigin = e2;
        try {
          return new Proxy(this, { get: (t6, e3) => e3 in t6 ? t6[e3] : t6.$(e3), set: (t6, e3, n2) => (e3 in t6 ? t6[e3] = n2 : t6.$(e3, n2), true), ownKeys: (t6) => [.../* @__PURE__ */ new Set([...t6._defaultGlobalVariables.keys(), ...t6._globalVariables.keys()])], getOwnPropertyDescriptor: (t6, e3) => ({ enumerable: true, configurable: true, value: t6.$(e3) }) });
        } catch (t6) {
        }
      }
      ApplyPatch() {
        if (null === this.patch) return C("this.patch");
        for (let [t5, e2] of this.patch.globals) this._globalVariables.set(t5, e2);
        if (null !== this._changedVariablesForBatchObs) for (let t5 of this.patch.changedVariables) this._changedVariablesForBatchObs.add(t5);
        this.patch = null;
      }
      SetJsonToken(t5) {
        this._globalVariables.clear();
        for (let [e2, n2] of this._defaultGlobalVariables) {
          let i2 = t5[e2];
          if (void 0 !== i2) {
            let t6 = Ht.JTokenToRuntimeObject(i2);
            if (null === t6) return C("tokenInkObject");
            this._globalVariables.set(e2, t6);
          } else this._globalVariables.set(e2, n2);
        }
      }
      WriteJson(t5) {
        t5.WriteObjectStart();
        for (let [e2, n2] of this._globalVariables) {
          let i2 = e2, r2 = n2;
          if (_zt.dontSaveDefaultValues && this._defaultGlobalVariables.has(i2)) {
            let t6 = this._defaultGlobalVariables.get(i2);
            if (this.RuntimeObjectsEqual(r2, t6)) continue;
          }
          t5.WritePropertyStart(i2), Ht.WriteRuntimeObject(t5, r2), t5.WritePropertyEnd();
        }
        t5.WriteObjectEnd();
      }
      RuntimeObjectsEqual(t5, e2) {
        if (null === t5) return C("obj1");
        if (null === e2) return C("obj2");
        if (t5.constructor !== e2.constructor) return false;
        let n2 = r(t5, A);
        if (null !== n2) return n2.value === s(e2, A).value;
        let i2 = r(t5, P);
        if (null !== i2) return i2.value === s(e2, P).value;
        let a2 = r(t5, N);
        if (null !== a2) return a2.value === s(e2, N).value;
        let o2 = r(t5, x), h2 = r(e2, x);
        if (null !== o2 && null !== h2) return l(o2.valueObject) && l(h2.valueObject) ? o2.valueObject.Equals(h2.valueObject) : o2.valueObject === h2.valueObject;
        throw new Error("FastRoughDefinitelyEquals: Unsupported runtime object type: " + t5.constructor.name);
      }
      GetVariableWithName(t5) {
        let e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : -1, n2 = this.GetRawVariableWithName(t5, e2), i2 = r(n2, F);
        return null !== i2 && (n2 = this.ValueAtVariablePointer(i2)), n2;
      }
      TryGetDefaultVariableValue(t5) {
        let e2 = _(this._defaultGlobalVariables, t5, null);
        return e2.exists ? e2.result : null;
      }
      GlobalVariableExistsWithName(t5) {
        return this._globalVariables.has(t5) || null !== this._defaultGlobalVariables && this._defaultGlobalVariables.has(t5);
      }
      GetRawVariableWithName(t5, e2) {
        let n2 = null;
        if (0 == e2 || -1 == e2) {
          let e3 = null;
          if (null !== this.patch && (e3 = this.patch.TryGetGlobal(t5, null), e3.exists)) return e3.result;
          if (e3 = _(this._globalVariables, t5, null), e3.exists) return e3.result;
          if (null !== this._defaultGlobalVariables && (e3 = _(this._defaultGlobalVariables, t5, null), e3.exists)) return e3.result;
          if (null === this._listDefsOrigin) return C("VariablesState._listDefsOrigin");
          let n3 = this._listDefsOrigin.FindSingleItemListWithName(t5);
          if (n3) return n3;
        }
        return n2 = this._callStack.GetTemporaryVariableWithName(t5, e2), n2;
      }
      ValueAtVariablePointer(t5) {
        return this.GetVariableWithName(t5.variableName, t5.contextIndex);
      }
      Assign(t5, e2) {
        let n2 = t5.variableName;
        if (null === n2) return C("name");
        let i2 = -1, s2 = false;
        if (s2 = t5.isNewDeclaration ? t5.isGlobal : this.GlobalVariableExistsWithName(n2), t5.isNewDeclaration) {
          let t6 = r(e2, F);
          if (null !== t6) {
            e2 = this.ResolveVariablePointer(t6);
          }
        } else {
          let t6 = null;
          do {
            t6 = r(this.GetRawVariableWithName(n2, i2), F), null != t6 && (n2 = t6.variableName, i2 = t6.contextIndex, s2 = 0 == i2);
          } while (null != t6);
        }
        s2 ? this.SetGlobal(n2, e2) : this._callStack.SetTemporaryVariable(n2, e2, t5.isNewDeclaration, i2);
      }
      SnapshotDefaultGlobals() {
        this._defaultGlobalVariables = new Map(this._globalVariables);
      }
      RetainListOriginsForAssignment(t5, e2) {
        let n2 = s(t5, W), i2 = s(e2, W);
        n2.value && i2.value && 0 == i2.value.Count && i2.value.SetInitialOriginNames(n2.value.originNames);
      }
      SetGlobal(t5, e2) {
        let n2 = null;
        if (null === this.patch && (n2 = _(this._globalVariables, t5, null)), null !== this.patch && (n2 = this.patch.TryGetGlobal(t5, null), n2.exists || (n2 = _(this._globalVariables, t5, null))), W.RetainListOriginsForAssignment(n2.result, e2), null === t5) return C("variableName");
        if (null !== this.patch ? this.patch.SetGlobal(t5, e2) : this._globalVariables.set(t5, e2), null !== this.variableChangedEvent && null !== n2 && e2 !== n2.result) if (this._batchObservingVariableChanges) {
          if (null === this._changedVariablesForBatchObs) return C("this._changedVariablesForBatchObs");
          null !== this.patch ? this.patch.AddChangedVariable(t5) : null !== this._changedVariablesForBatchObs && this._changedVariablesForBatchObs.add(t5);
        } else this.variableChangedEvent(t5, e2);
      }
      ResolveVariablePointer(t5) {
        let e2 = t5.contextIndex;
        -1 == e2 && (e2 = this.GetContextIndexOfVariableNamed(t5.variableName));
        let n2 = r(this.GetRawVariableWithName(t5.variableName, e2), F);
        return null != n2 ? n2 : new F(t5.variableName, e2);
      }
      GetContextIndexOfVariableNamed(t5) {
        return this.GlobalVariableExistsWithName(t5) ? 0 : this._callStack.currentElementIndex;
      }
      ObserveVariableChange(t5) {
        this.variableChangedEventCallbacks.push(t5);
      }
    };
    zt.dontSaveDefaultValues = true;
    Xt = class {
      constructor(t5) {
        this.seed = t5 % 2147483647, this.seed <= 0 && (this.seed += 2147483646);
      }
      next() {
        return this.seed = 48271 * this.seed % 2147483647;
      }
      nextFloat() {
        return (this.next() - 1) / 2147483646;
      }
    };
    Yt = class {
      get globals() {
        return this._globals;
      }
      get changedVariables() {
        return this._changedVariables;
      }
      get visitCounts() {
        return this._visitCounts;
      }
      get turnIndices() {
        return this._turnIndices;
      }
      constructor() {
        if (this._changedVariables = /* @__PURE__ */ new Set(), this._visitCounts = /* @__PURE__ */ new Map(), this._turnIndices = /* @__PURE__ */ new Map(), 1 === arguments.length && null !== arguments[0]) {
          let t5 = arguments[0];
          this._globals = new Map(t5._globals), this._changedVariables = new Set(t5._changedVariables), this._visitCounts = new Map(t5._visitCounts), this._turnIndices = new Map(t5._turnIndices);
        } else this._globals = /* @__PURE__ */ new Map(), this._changedVariables = /* @__PURE__ */ new Set(), this._visitCounts = /* @__PURE__ */ new Map(), this._turnIndices = /* @__PURE__ */ new Map();
      }
      TryGetGlobal(t5, e2) {
        return null !== t5 && this._globals.has(t5) ? { result: this._globals.get(t5), exists: true } : { result: e2, exists: false };
      }
      SetGlobal(t5, e2) {
        this._globals.set(t5, e2);
      }
      AddChangedVariable(t5) {
        return this._changedVariables.add(t5);
      }
      TryGetVisitCount(t5, e2) {
        return this._visitCounts.has(t5) ? { result: this._visitCounts.get(t5), exists: true } : { result: e2, exists: false };
      }
      SetVisitCount(t5, e2) {
        this._visitCounts.set(t5, e2);
      }
      SetTurnIndex(t5, e2) {
        this._turnIndices.set(t5, e2);
      }
      TryGetTurnIndex(t5, e2) {
        return this._turnIndices.has(t5) ? { result: this._turnIndices.get(t5), exists: true } : { result: e2, exists: false };
      }
    };
    Zt = class _Zt {
      static TextToDictionary(t5) {
        return new _Zt.Reader(t5).ToDictionary();
      }
      static TextToArray(t5) {
        return new _Zt.Reader(t5).ToArray();
      }
    };
    !(function(t5) {
      t5.Reader = class {
        constructor(t6) {
          if (JSON.parse("0", ((t7, e3, n2) => null != n2))) {
            const e3 = (t7, e4, n2) => Number.isInteger(e4) && n2.source.endsWith(".0") ? n2.source + "f" : e4;
            this._rootObject = JSON.parse(t6, e3);
          } else {
            const e3 = t6.replace(/(,\s*)([0-9]+\.[0]+)([,]*)/g, '$1"$2f"$3');
            this._rootObject = JSON.parse(e3);
          }
        }
        ToDictionary() {
          return this._rootObject;
        }
        ToArray() {
          return this._rootObject;
        }
      };
      class e2 {
        constructor() {
          this._currentPropertyName = null, this._currentString = null, this._stateStack = [], this._collectionStack = [], this._propertyNameStack = [], this._jsonObject = null;
        }
        WriteObject(t6) {
          this.WriteObjectStart(), t6(this), this.WriteObjectEnd();
        }
        WriteObjectStart() {
          this.StartNewObject(true);
          let e3 = {};
          if (this.state === t5.Writer.State.Property) {
            this.Assert(null !== this.currentCollection), this.Assert(null !== this.currentPropertyName);
            let t6 = this._propertyNameStack.pop();
            this.currentCollection[t6] = e3, this._collectionStack.push(e3);
          } else this.state === t5.Writer.State.Array ? (this.Assert(null !== this.currentCollection), this.currentCollection.push(e3), this._collectionStack.push(e3)) : (this.Assert(this.state === t5.Writer.State.None), this._jsonObject = e3, this._collectionStack.push(e3));
          this._stateStack.push(new t5.Writer.StateElement(t5.Writer.State.Object));
        }
        WriteObjectEnd() {
          this.Assert(this.state === t5.Writer.State.Object), this._collectionStack.pop(), this._stateStack.pop();
        }
        WriteProperty(t6, e3) {
          if (this.WritePropertyStart(t6), arguments[1] instanceof Function) {
            (0, arguments[1])(this);
          } else {
            let t7 = arguments[1];
            this.Write(t7);
          }
          this.WritePropertyEnd();
        }
        WriteIntProperty(t6, e3) {
          this.WritePropertyStart(t6), this.WriteInt(e3), this.WritePropertyEnd();
        }
        WriteFloatProperty(t6, e3) {
          this.WritePropertyStart(t6), this.WriteFloat(e3), this.WritePropertyEnd();
        }
        WritePropertyStart(e3) {
          this.Assert(this.state === t5.Writer.State.Object), this._propertyNameStack.push(e3), this.IncrementChildCount(), this._stateStack.push(new t5.Writer.StateElement(t5.Writer.State.Property));
        }
        WritePropertyEnd() {
          this.Assert(this.state === t5.Writer.State.Property), this.Assert(1 === this.childCount), this._stateStack.pop();
        }
        WritePropertyNameStart() {
          this.Assert(this.state === t5.Writer.State.Object), this.IncrementChildCount(), this._currentPropertyName = "", this._stateStack.push(new t5.Writer.StateElement(t5.Writer.State.Property)), this._stateStack.push(new t5.Writer.StateElement(t5.Writer.State.PropertyName));
        }
        WritePropertyNameEnd() {
          this.Assert(this.state === t5.Writer.State.PropertyName), this.Assert(null !== this._currentPropertyName), this._propertyNameStack.push(this._currentPropertyName), this._currentPropertyName = null, this._stateStack.pop();
        }
        WritePropertyNameInner(e3) {
          this.Assert(this.state === t5.Writer.State.PropertyName), this.Assert(null !== this._currentPropertyName), this._currentPropertyName += e3;
        }
        WriteArrayStart() {
          this.StartNewObject(true);
          let e3 = [];
          if (this.state === t5.Writer.State.Property) {
            this.Assert(null !== this.currentCollection), this.Assert(null !== this.currentPropertyName);
            let t6 = this._propertyNameStack.pop();
            this.currentCollection[t6] = e3, this._collectionStack.push(e3);
          } else this.state === t5.Writer.State.Array ? (this.Assert(null !== this.currentCollection), this.currentCollection.push(e3), this._collectionStack.push(e3)) : (this.Assert(this.state === t5.Writer.State.None), this._jsonObject = e3, this._collectionStack.push(e3));
          this._stateStack.push(new t5.Writer.StateElement(t5.Writer.State.Array));
        }
        WriteArrayEnd() {
          this.Assert(this.state === t5.Writer.State.Array), this._collectionStack.pop(), this._stateStack.pop();
        }
        Write(t6) {
          null !== t6 ? (this.StartNewObject(false), this._addToCurrentObject(t6)) : console.error("Warning: trying to write a null value");
        }
        WriteBool(t6) {
          null !== t6 && (this.StartNewObject(false), this._addToCurrentObject(t6));
        }
        WriteInt(t6) {
          null !== t6 && (this.StartNewObject(false), this._addToCurrentObject(Math.floor(t6)));
        }
        WriteFloat(t6) {
          null !== t6 && (this.StartNewObject(false), t6 == Number.POSITIVE_INFINITY ? this._addToCurrentObject(34e37) : t6 == Number.NEGATIVE_INFINITY ? this._addToCurrentObject(-34e37) : isNaN(t6) ? this._addToCurrentObject(0) : this._addToCurrentObject(t6));
        }
        WriteNull() {
          this.StartNewObject(false), this._addToCurrentObject(null);
        }
        WriteStringStart() {
          this.StartNewObject(false), this._currentString = "", this._stateStack.push(new t5.Writer.StateElement(t5.Writer.State.String));
        }
        WriteStringEnd() {
          this.Assert(this.state == t5.Writer.State.String), this._stateStack.pop(), this._addToCurrentObject(this._currentString), this._currentString = null;
        }
        WriteStringInner(e3) {
          this.Assert(this.state === t5.Writer.State.String), null !== e3 ? this._currentString += e3 : console.error("Warning: trying to write a null string");
        }
        toString() {
          return null === this._jsonObject ? "" : JSON.stringify(this._jsonObject);
        }
        StartNewObject(e3) {
          e3 ? this.Assert(this.state === t5.Writer.State.None || this.state === t5.Writer.State.Property || this.state === t5.Writer.State.Array) : this.Assert(this.state === t5.Writer.State.Property || this.state === t5.Writer.State.Array), this.state === t5.Writer.State.Property && this.Assert(0 === this.childCount), this.state !== t5.Writer.State.Array && this.state !== t5.Writer.State.Property || this.IncrementChildCount();
        }
        get state() {
          return this._stateStack.length > 0 ? this._stateStack[this._stateStack.length - 1].type : t5.Writer.State.None;
        }
        get childCount() {
          return this._stateStack.length > 0 ? this._stateStack[this._stateStack.length - 1].childCount : 0;
        }
        get currentCollection() {
          return this._collectionStack.length > 0 ? this._collectionStack[this._collectionStack.length - 1] : null;
        }
        get currentPropertyName() {
          return this._propertyNameStack.length > 0 ? this._propertyNameStack[this._propertyNameStack.length - 1] : null;
        }
        IncrementChildCount() {
          this.Assert(this._stateStack.length > 0);
          let t6 = this._stateStack.pop();
          t6.childCount++, this._stateStack.push(t6);
        }
        Assert(t6) {
          if (!t6) throw Error("Assert failed while writing JSON");
        }
        _addToCurrentObject(e3) {
          this.Assert(null !== this.currentCollection), this.state === t5.Writer.State.Array ? (this.Assert(Array.isArray(this.currentCollection)), this.currentCollection.push(e3)) : this.state === t5.Writer.State.Property && (this.Assert(!Array.isArray(this.currentCollection)), this.Assert(null !== this.currentPropertyName), this.currentCollection[this.currentPropertyName] = e3, this._propertyNameStack.pop());
        }
      }
      t5.Writer = e2, (function(e3) {
        var n2;
        (n2 = e3.State || (e3.State = {}))[n2.None = 0] = "None", n2[n2.Object = 1] = "Object", n2[n2.Array = 2] = "Array", n2[n2.Property = 3] = "Property", n2[n2.PropertyName = 4] = "PropertyName", n2[n2.String = 5] = "String";
        e3.StateElement = class {
          constructor(e4) {
            this.type = t5.Writer.State.None, this.childCount = 0, this.type = e4;
          }
        };
      })(e2 = t5.Writer || (t5.Writer = {}));
    })(Zt || (Zt = {}));
    Qt = class {
      constructor() {
        let t5 = arguments[0], e2 = arguments[1];
        if (this.name = t5, this.callStack = new Jt(e2), arguments[2]) {
          let t6 = arguments[2];
          this.callStack.SetJsonToken(t6.callstack, e2), this.outputStream = Ht.JArrayToRuntimeObjList(t6.outputStream), this.currentChoices = Ht.JArrayToRuntimeObjList(t6.currentChoices);
          let n2 = t6.choiceThreads;
          void 0 !== n2 && this.LoadFlowChoiceThreads(n2, e2);
        } else this.outputStream = [], this.currentChoices = [];
      }
      WriteJson(t5) {
        t5.WriteObjectStart(), t5.WriteProperty("callstack", ((t6) => this.callStack.WriteJson(t6))), t5.WriteProperty("outputStream", ((t6) => Ht.WriteListRuntimeObjs(t6, this.outputStream)));
        let e2 = false;
        for (let n2 of this.currentChoices) {
          if (null === n2.threadAtGeneration) return C("c.threadAtGeneration");
          n2.originalThreadIndex = n2.threadAtGeneration.threadIndex, null === this.callStack.ThreadWithIndex(n2.originalThreadIndex) && (e2 || (e2 = true, t5.WritePropertyStart("choiceThreads"), t5.WriteObjectStart()), t5.WritePropertyStart(n2.originalThreadIndex), n2.threadAtGeneration.WriteJson(t5), t5.WritePropertyEnd());
        }
        e2 && (t5.WriteObjectEnd(), t5.WritePropertyEnd()), t5.WriteProperty("currentChoices", ((t6) => {
          t6.WriteArrayStart();
          for (let e3 of this.currentChoices) Ht.WriteChoice(t6, e3);
          t6.WriteArrayEnd();
        })), t5.WriteObjectEnd();
      }
      LoadFlowChoiceThreads(t5, e2) {
        for (let n2 of this.currentChoices) {
          let i2 = this.callStack.ThreadWithIndex(n2.originalThreadIndex);
          if (null !== i2) n2.threadAtGeneration = i2.Copy();
          else {
            let i3 = t5[`${n2.originalThreadIndex}`];
            n2.threadAtGeneration = new Jt.Thread(i3, e2);
          }
        }
      }
    };
    te = class _te {
      ToJson() {
        let t5 = new Zt.Writer();
        return this.WriteJson(t5), t5.toString();
      }
      toJson() {
        let t5 = arguments.length > 0 && void 0 !== arguments[0] && arguments[0];
        return this.ToJson(t5);
      }
      LoadJson(t5) {
        let e2 = Zt.TextToDictionary(t5);
        this.LoadJsonObj(e2), null !== this.onDidLoadState && this.onDidLoadState();
      }
      VisitCountAtPathString(t5) {
        let e2;
        if (null !== this._patch) {
          let n2 = this.story.ContentAtPath(new p(t5)).container;
          if (null === n2) throw new Error("Content at path not found: " + t5);
          if (e2 = this._patch.TryGetVisitCount(n2, 0), e2.exists) return e2.result;
        }
        return e2 = _(this._visitCounts, t5, null), e2.exists ? e2.result : 0;
      }
      VisitCountForContainer(t5) {
        if (null === t5) return C("container");
        if (!t5.visitsShouldBeCounted) return this.story.Error("Read count for target (" + t5.name + " - on " + t5.debugMetadata + ") unknown. The story may need to be compiled with countAllVisits flag (-c)."), 0;
        if (null !== this._patch) {
          let e3 = this._patch.TryGetVisitCount(t5, 0);
          if (e3.exists) return e3.result;
        }
        let e2 = t5.path.toString(), n2 = _(this._visitCounts, e2, null);
        return n2.exists ? n2.result : 0;
      }
      IncrementVisitCountForContainer(t5) {
        if (null !== this._patch) {
          let e3 = this.VisitCountForContainer(t5);
          return e3++, void this._patch.SetVisitCount(t5, e3);
        }
        let e2 = t5.path.toString(), n2 = _(this._visitCounts, e2, null);
        n2.exists ? this._visitCounts.set(e2, n2.result + 1) : this._visitCounts.set(e2, 1);
      }
      RecordTurnIndexVisitToContainer(t5) {
        if (null !== this._patch) return void this._patch.SetTurnIndex(t5, this.currentTurnIndex);
        let e2 = t5.path.toString();
        this._turnIndices.set(e2, this.currentTurnIndex);
      }
      TurnsSinceForContainer(t5) {
        if (t5.turnIndexShouldBeCounted || this.story.Error("TURNS_SINCE() for target (" + t5.name + " - on " + t5.debugMetadata + ") unknown. The story may need to be compiled with countAllVisits flag (-c)."), null !== this._patch) {
          let e3 = this._patch.TryGetTurnIndex(t5, 0);
          if (e3.exists) return this.currentTurnIndex - e3.result;
        }
        let e2 = t5.path.toString(), n2 = _(this._turnIndices, e2, 0);
        return n2.exists ? this.currentTurnIndex - n2.result : -1;
      }
      get callstackDepth() {
        return this.callStack.depth;
      }
      get outputStream() {
        return this._currentFlow.outputStream;
      }
      get currentChoices() {
        return this.canContinue ? [] : this._currentFlow.currentChoices;
      }
      get generatedChoices() {
        return this._currentFlow.currentChoices;
      }
      get currentErrors() {
        return this._currentErrors;
      }
      get currentWarnings() {
        return this._currentWarnings;
      }
      get variablesState() {
        return this._variablesState;
      }
      set variablesState(t5) {
        this._variablesState = t5;
      }
      get callStack() {
        return this._currentFlow.callStack;
      }
      get evaluationStack() {
        return this._evaluationStack;
      }
      get currentTurnIndex() {
        return this._currentTurnIndex;
      }
      set currentTurnIndex(t5) {
        this._currentTurnIndex = t5;
      }
      get currentPathString() {
        let t5 = this.currentPointer;
        return t5.isNull ? null : null === t5.path ? C("pointer.path") : t5.path.toString();
      }
      get previousPathString() {
        let t5 = this.previousPointer;
        return t5.isNull ? null : null === t5.path ? C("previousPointer.path") : t5.path.toString();
      }
      get currentPointer() {
        return this.callStack.currentElement.currentPointer.copy();
      }
      set currentPointer(t5) {
        this.callStack.currentElement.currentPointer = t5.copy();
      }
      get previousPointer() {
        return this.callStack.currentThread.previousPointer.copy();
      }
      set previousPointer(t5) {
        this.callStack.currentThread.previousPointer = t5.copy();
      }
      get canContinue() {
        return !this.currentPointer.isNull && !this.hasError;
      }
      get hasError() {
        return null != this.currentErrors && this.currentErrors.length > 0;
      }
      get hasWarning() {
        return null != this.currentWarnings && this.currentWarnings.length > 0;
      }
      get currentText() {
        if (this._outputStreamTextDirty) {
          let t5 = new y(), e2 = false;
          for (let n2 of this.outputStream) {
            let i2 = r(n2, I);
            if (e2 || null === i2) {
              let t6 = r(n2, D);
              null !== t6 && (t6.commandType == D.CommandType.BeginTag ? e2 = true : t6.commandType == D.CommandType.EndTag && (e2 = false));
            } else t5.Append(i2.value);
          }
          this._currentText = this.CleanOutputWhitespace(t5.toString()), this._outputStreamTextDirty = false;
        }
        return this._currentText;
      }
      CleanOutputWhitespace(t5) {
        let e2 = new y(), n2 = -1, i2 = 0;
        for (let r2 = 0; r2 < t5.length; r2++) {
          let s2 = t5.charAt(r2), a2 = " " == s2 || "	" == s2;
          a2 && -1 == n2 && (n2 = r2), a2 || ("\n" != s2 && n2 > 0 && n2 != i2 && e2.Append(" "), n2 = -1), "\n" == s2 && (i2 = r2 + 1), a2 || e2.Append(s2);
        }
        return e2.toString();
      }
      get currentTags() {
        if (this._outputStreamTagsDirty) {
          this._currentTags = [];
          let t5 = false, e2 = new y();
          for (let n2 of this.outputStream) {
            let i2 = r(n2, D);
            if (null != i2) {
              if (i2.commandType == D.CommandType.BeginTag) {
                if (t5 && e2.Length > 0) {
                  let t6 = this.CleanOutputWhitespace(e2.toString());
                  this._currentTags.push(t6), e2.Clear();
                }
                t5 = true;
              } else if (i2.commandType == D.CommandType.EndTag) {
                if (e2.Length > 0) {
                  let t6 = this.CleanOutputWhitespace(e2.toString());
                  this._currentTags.push(t6), e2.Clear();
                }
                t5 = false;
              }
            } else if (t5) {
              let t6 = r(n2, I);
              null !== t6 && e2.Append(t6.value);
            } else {
              let t6 = r(n2, qt);
              null != t6 && null != t6.text && t6.text.length > 0 && this._currentTags.push(t6.text);
            }
          }
          if (e2.Length > 0) {
            let t6 = this.CleanOutputWhitespace(e2.toString());
            this._currentTags.push(t6), e2.Clear();
          }
          this._outputStreamTagsDirty = false;
        }
        return this._currentTags;
      }
      get currentFlowName() {
        return this._currentFlow.name;
      }
      get currentFlowIsDefaultFlow() {
        return this._currentFlow.name == this.kDefaultFlowName;
      }
      get aliveFlowNames() {
        if (this._aliveFlowNamesDirty) {
          if (this._aliveFlowNames = [], null != this._namedFlows) for (let t5 of this._namedFlows.keys()) t5 != this.kDefaultFlowName && this._aliveFlowNames.push(t5);
          this._aliveFlowNamesDirty = false;
        }
        return this._aliveFlowNames;
      }
      get inExpressionEvaluation() {
        return this.callStack.currentElement.inExpressionEvaluation;
      }
      set inExpressionEvaluation(t5) {
        this.callStack.currentElement.inExpressionEvaluation = t5;
      }
      constructor(t5) {
        this.kInkSaveStateVersion = 10, this.kMinCompatibleLoadVersion = 8, this.onDidLoadState = null, this._currentErrors = null, this._currentWarnings = null, this.divertedPointer = K.Null, this._currentTurnIndex = 0, this.storySeed = 0, this.previousRandom = 0, this.didSafeExit = false, this._currentText = null, this._currentTags = null, this._outputStreamTextDirty = true, this._outputStreamTagsDirty = true, this._patch = null, this._aliveFlowNames = null, this._namedFlows = null, this.kDefaultFlowName = "DEFAULT_FLOW", this._aliveFlowNamesDirty = true, this.story = t5, this._currentFlow = new Qt(this.kDefaultFlowName, t5), this.OutputStreamDirty(), this._aliveFlowNamesDirty = true, this._evaluationStack = [], this._variablesState = new zt(this.callStack, t5.listDefinitions), this._visitCounts = /* @__PURE__ */ new Map(), this._turnIndices = /* @__PURE__ */ new Map(), this.currentTurnIndex = -1;
        let e2 = (/* @__PURE__ */ new Date()).getTime();
        this.storySeed = new Xt(e2).next() % 100, this.previousRandom = 0, this.GoToStart();
      }
      GoToStart() {
        this.callStack.currentElement.currentPointer = K.StartOf(this.story.mainContentContainer);
      }
      SwitchFlow_Internal(t5) {
        if (null === t5) throw new Error("Must pass a non-null string to Story.SwitchFlow");
        if (null === this._namedFlows && (this._namedFlows = /* @__PURE__ */ new Map(), this._namedFlows.set(this.kDefaultFlowName, this._currentFlow)), t5 === this._currentFlow.name) return;
        let e2, n2 = _(this._namedFlows, t5, null);
        n2.exists ? e2 = n2.result : (e2 = new Qt(t5, this.story), this._namedFlows.set(t5, e2), this._aliveFlowNamesDirty = true), this._currentFlow = e2, this.variablesState.callStack = this._currentFlow.callStack, this.OutputStreamDirty();
      }
      SwitchToDefaultFlow_Internal() {
        null !== this._namedFlows && this.SwitchFlow_Internal(this.kDefaultFlowName);
      }
      RemoveFlow_Internal(t5) {
        if (null === t5) throw new Error("Must pass a non-null string to Story.DestroyFlow");
        if (t5 === this.kDefaultFlowName) throw new Error("Cannot destroy default flow");
        if (this._currentFlow.name === t5 && this.SwitchToDefaultFlow_Internal(), null === this._namedFlows) return C("this._namedFlows");
        this._namedFlows.delete(t5), this._aliveFlowNamesDirty = true;
      }
      CopyAndStartPatching(t5) {
        let e2 = new _te(this.story);
        if (e2._patch = new Yt(this._patch), e2._currentFlow.name = this._currentFlow.name, e2._currentFlow.callStack = new Jt(this._currentFlow.callStack), e2._currentFlow.outputStream.push(...this._currentFlow.outputStream), e2.OutputStreamDirty(), t5) for (let t6 of this._currentFlow.currentChoices) e2._currentFlow.currentChoices.push(t6.Clone());
        else e2._currentFlow.currentChoices.push(...this._currentFlow.currentChoices);
        if (null !== this._namedFlows) {
          e2._namedFlows = /* @__PURE__ */ new Map();
          for (let [t6, n2] of this._namedFlows) e2._namedFlows.set(t6, n2), e2._aliveFlowNamesDirty = true;
          e2._namedFlows.set(this._currentFlow.name, e2._currentFlow);
        }
        return this.hasError && (e2._currentErrors = [], e2._currentErrors.push(...this.currentErrors || [])), this.hasWarning && (e2._currentWarnings = [], e2._currentWarnings.push(...this.currentWarnings || [])), e2.variablesState = this.variablesState, e2.variablesState.callStack = e2.callStack, e2.variablesState.patch = e2._patch, e2.evaluationStack.push(...this.evaluationStack), this.divertedPointer.isNull || (e2.divertedPointer = this.divertedPointer.copy()), e2.previousPointer = this.previousPointer.copy(), e2._visitCounts = this._visitCounts, e2._turnIndices = this._turnIndices, e2.currentTurnIndex = this.currentTurnIndex, e2.storySeed = this.storySeed, e2.previousRandom = this.previousRandom, e2.didSafeExit = this.didSafeExit, e2;
      }
      RestoreAfterPatch() {
        this.variablesState.callStack = this.callStack, this.variablesState.patch = this._patch;
      }
      ApplyAnyPatch() {
        if (null !== this._patch) {
          this.variablesState.ApplyPatch();
          for (let [t5, e2] of this._patch.visitCounts) this.ApplyCountChanges(t5, e2, true);
          for (let [t5, e2] of this._patch.turnIndices) this.ApplyCountChanges(t5, e2, false);
          this._patch = null;
        }
      }
      ApplyCountChanges(t5, e2, n2) {
        (n2 ? this._visitCounts : this._turnIndices).set(t5.path.toString(), e2);
      }
      WriteJson(t5) {
        if (t5.WriteObjectStart(), t5.WritePropertyStart("flows"), t5.WriteObjectStart(), null !== this._namedFlows) for (let [e2, n2] of this._namedFlows) t5.WriteProperty(e2, ((t6) => n2.WriteJson(t6)));
        else t5.WriteProperty(this._currentFlow.name, ((t6) => this._currentFlow.WriteJson(t6)));
        if (t5.WriteObjectEnd(), t5.WritePropertyEnd(), t5.WriteProperty("currentFlowName", this._currentFlow.name), t5.WriteProperty("variablesState", ((t6) => this.variablesState.WriteJson(t6))), t5.WriteProperty("evalStack", ((t6) => Ht.WriteListRuntimeObjs(t6, this.evaluationStack))), !this.divertedPointer.isNull) {
          if (null === this.divertedPointer.path) return C("divertedPointer");
          t5.WriteProperty("currentDivertTarget", this.divertedPointer.path.componentsString);
        }
        t5.WriteProperty("visitCounts", ((t6) => Ht.WriteIntDictionary(t6, this._visitCounts))), t5.WriteProperty("turnIndices", ((t6) => Ht.WriteIntDictionary(t6, this._turnIndices))), t5.WriteIntProperty("turnIdx", this.currentTurnIndex), t5.WriteIntProperty("storySeed", this.storySeed), t5.WriteIntProperty("previousRandom", this.previousRandom), t5.WriteIntProperty("inkSaveVersion", this.kInkSaveStateVersion), t5.WriteIntProperty("inkFormatVersion", ie.inkVersionCurrent), t5.WriteObjectEnd();
      }
      LoadJsonObj(t5) {
        let e2 = t5, n2 = e2.inkSaveVersion;
        if (null == n2) throw new Error("ink save format incorrect, can't load.");
        if (parseInt(n2) < this.kMinCompatibleLoadVersion) throw new Error("Ink save format isn't compatible with the current version (saw '" + n2 + "', but minimum is " + this.kMinCompatibleLoadVersion + "), so can't load.");
        let i2 = e2.flows;
        if (null != i2) {
          let t6 = i2;
          1 === Object.keys(t6).length ? this._namedFlows = null : null === this._namedFlows ? this._namedFlows = /* @__PURE__ */ new Map() : this._namedFlows.clear();
          let n3 = Object.entries(t6);
          for (let [e3, i3] of n3) {
            let n4 = e3, r3 = i3, s2 = new Qt(n4, this.story, r3);
            if (1 === Object.keys(t6).length) this._currentFlow = new Qt(n4, this.story, r3);
            else {
              if (null === this._namedFlows) return C("this._namedFlows");
              this._namedFlows.set(n4, s2);
            }
          }
          if (null != this._namedFlows && this._namedFlows.size > 1) {
            let t7 = e2.currentFlowName;
            this._currentFlow = this._namedFlows.get(t7);
          }
        } else {
          this._namedFlows = null, this._currentFlow.name = this.kDefaultFlowName, this._currentFlow.callStack.SetJsonToken(e2.callstackThreads, this.story), this._currentFlow.outputStream = Ht.JArrayToRuntimeObjList(e2.outputStream), this._currentFlow.currentChoices = Ht.JArrayToRuntimeObjList(e2.currentChoices);
          let t6 = e2.choiceThreads;
          this._currentFlow.LoadFlowChoiceThreads(t6, this.story);
        }
        this.OutputStreamDirty(), this._aliveFlowNamesDirty = true, this.variablesState.SetJsonToken(e2.variablesState), this.variablesState.callStack = this._currentFlow.callStack, this._evaluationStack = Ht.JArrayToRuntimeObjList(e2.evalStack);
        let r2 = e2.currentDivertTarget;
        if (null != r2) {
          let t6 = new p(r2.toString());
          this.divertedPointer = this.story.PointerAtPath(t6);
        }
        this._visitCounts = Ht.JObjectToIntDictionary(e2.visitCounts), this._turnIndices = Ht.JObjectToIntDictionary(e2.turnIndices), this.currentTurnIndex = parseInt(e2.turnIdx), this.storySeed = parseInt(e2.storySeed), this.previousRandom = parseInt(e2.previousRandom);
      }
      ResetErrors() {
        this._currentErrors = null, this._currentWarnings = null;
      }
      ResetOutput() {
        let t5 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : null;
        this.outputStream.length = 0, null !== t5 && this.outputStream.push(...t5), this.OutputStreamDirty();
      }
      PushToOutputStream(t5) {
        let e2 = r(t5, I);
        if (null !== e2) {
          let t6 = this.TrySplittingHeadTailWhitespace(e2);
          if (null !== t6) {
            for (let e3 of t6) this.PushToOutputStreamIndividual(e3);
            return void this.OutputStreamDirty();
          }
        }
        this.PushToOutputStreamIndividual(t5), this.OutputStreamDirty();
      }
      PopFromOutputStream(t5) {
        this.outputStream.splice(this.outputStream.length - t5, t5), this.OutputStreamDirty();
      }
      TrySplittingHeadTailWhitespace(t5) {
        let e2 = t5.value;
        if (null === e2) return C("single.value");
        let n2 = -1, i2 = -1;
        for (let t6 = 0; t6 < e2.length; t6++) {
          let r3 = e2[t6];
          if ("\n" != r3) {
            if (" " == r3 || "	" == r3) continue;
            break;
          }
          -1 == n2 && (n2 = t6), i2 = t6;
        }
        let r2 = -1, s2 = -1;
        for (let t6 = e2.length - 1; t6 >= 0; t6--) {
          let n3 = e2[t6];
          if ("\n" != n3) {
            if (" " == n3 || "	" == n3) continue;
            break;
          }
          -1 == r2 && (r2 = t6), s2 = t6;
        }
        if (-1 == n2 && -1 == r2) return null;
        let a2 = [], o2 = 0, l2 = e2.length;
        if (-1 != n2) {
          if (n2 > 0) {
            let t6 = new I(e2.substring(0, n2));
            a2.push(t6);
          }
          a2.push(new I("\n")), o2 = i2 + 1;
        }
        if (-1 != r2 && (l2 = s2), l2 > o2) {
          let t6 = e2.substring(o2, l2);
          a2.push(new I(t6));
        }
        if (-1 != r2 && s2 > i2 && (a2.push(new I("\n")), r2 < e2.length - 1)) {
          let t6 = e2.length - r2 - 1, n3 = new I(e2.substring(r2 + 1, r2 + 1 + t6));
          a2.push(n3);
        }
        return a2;
      }
      PushToOutputStreamIndividual(t5) {
        let e2 = r(t5, kt), n2 = r(t5, I), i2 = true;
        if (e2) this.TrimNewlinesFromOutputStream(), i2 = true;
        else if (n2) {
          let t6 = -1, e3 = this.callStack.currentElement;
          e3.type == g.Function && (t6 = e3.functionStartInOutputStream);
          let r2 = -1;
          for (let e4 = this.outputStream.length - 1; e4 >= 0; e4--) {
            let n3 = this.outputStream[e4], i3 = n3 instanceof D ? n3 : null;
            if (null != (n3 instanceof kt ? n3 : null)) {
              r2 = e4;
              break;
            }
            if (null != i3 && i3.commandType == D.CommandType.BeginString) {
              e4 >= t6 && (t6 = -1);
              break;
            }
          }
          let s2 = -1;
          if (s2 = -1 != r2 && -1 != t6 ? Math.min(t6, r2) : -1 != r2 ? r2 : t6, -1 != s2) {
            if (n2.isNewline) i2 = false;
            else if (n2.isNonWhitespace && (r2 > -1 && this.RemoveExistingGlue(), t6 > -1)) {
              let t7 = this.callStack.elements;
              for (let e4 = t7.length - 1; e4 >= 0; e4--) {
                let n3 = t7[e4];
                if (n3.type != g.Function) break;
                n3.functionStartInOutputStream = -1;
              }
            }
          } else n2.isNewline && (!this.outputStreamEndsInNewline && this.outputStreamContainsContent || (i2 = false));
        }
        if (i2) {
          if (null === t5) return C("obj");
          this.outputStream.push(t5), this.OutputStreamDirty();
        }
      }
      TrimNewlinesFromOutputStream() {
        let t5 = -1, e2 = this.outputStream.length - 1;
        for (; e2 >= 0; ) {
          let n2 = this.outputStream[e2], i2 = r(n2, D), s2 = r(n2, I);
          if (null != i2 || null != s2 && s2.isNonWhitespace) break;
          null != s2 && s2.isNewline && (t5 = e2), e2--;
        }
        if (t5 >= 0) for (e2 = t5; e2 < this.outputStream.length; ) {
          r(this.outputStream[e2], I) ? this.outputStream.splice(e2, 1) : e2++;
        }
        this.OutputStreamDirty();
      }
      RemoveExistingGlue() {
        for (let t5 = this.outputStream.length - 1; t5 >= 0; t5--) {
          let e2 = this.outputStream[t5];
          if (e2 instanceof kt) this.outputStream.splice(t5, 1);
          else if (e2 instanceof D) break;
        }
        this.OutputStreamDirty();
      }
      get outputStreamEndsInNewline() {
        if (this.outputStream.length > 0) for (let t5 = this.outputStream.length - 1; t5 >= 0; t5--) {
          if (this.outputStream[t5] instanceof D) break;
          let e2 = this.outputStream[t5];
          if (e2 instanceof I) {
            if (e2.isNewline) return true;
            if (e2.isNonWhitespace) break;
          }
        }
        return false;
      }
      get outputStreamContainsContent() {
        for (let t5 of this.outputStream) if (t5 instanceof I) return true;
        return false;
      }
      get inStringEvaluation() {
        for (let t5 = this.outputStream.length - 1; t5 >= 0; t5--) {
          let e2 = r(this.outputStream[t5], D);
          if (e2 instanceof D && e2.commandType == D.CommandType.BeginString) return true;
        }
        return false;
      }
      PushEvaluationStack(t5) {
        let e2 = r(t5, W);
        if (e2) {
          let t6 = e2.value;
          if (null === t6) return C("rawList");
          if (null != t6.originNames) {
            t6.origins || (t6.origins = []), t6.origins.length = 0;
            for (let e3 of t6.originNames) {
              if (null === this.story.listDefinitions) return C("StoryState.story.listDefinitions");
              let n2 = this.story.listDefinitions.TryListGetDefinition(e3, null);
              if (null === n2.result) return C("StoryState def.result");
              t6.origins.indexOf(n2.result) < 0 && t6.origins.push(n2.result);
            }
          }
        }
        if (null === t5) return C("obj");
        this.evaluationStack.push(t5);
      }
      PopEvaluationStack(t5) {
        if (void 0 === t5) {
          return o(this.evaluationStack.pop());
        }
        if (t5 > this.evaluationStack.length) throw new Error("trying to pop too many objects");
        return o(this.evaluationStack.splice(this.evaluationStack.length - t5, t5));
      }
      PeekEvaluationStack() {
        return this.evaluationStack[this.evaluationStack.length - 1];
      }
      ForceEnd() {
        this.callStack.Reset(), this._currentFlow.currentChoices.length = 0, this.currentPointer = K.Null, this.previousPointer = K.Null, this.didSafeExit = true;
      }
      TrimWhitespaceFromFunctionEnd() {
        m.Assert(this.callStack.currentElement.type == g.Function);
        let t5 = this.callStack.currentElement.functionStartInOutputStream;
        -1 == t5 && (t5 = 0);
        for (let e2 = this.outputStream.length - 1; e2 >= t5; e2--) {
          let t6 = this.outputStream[e2], n2 = r(t6, I), i2 = r(t6, D);
          if (null != n2) {
            if (i2) break;
            if (!n2.isNewline && !n2.isInlineWhitespace) break;
            this.outputStream.splice(e2, 1), this.OutputStreamDirty();
          }
        }
      }
      PopCallStack() {
        let t5 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : null;
        this.callStack.currentElement.type == g.Function && this.TrimWhitespaceFromFunctionEnd(), this.callStack.Pop(t5);
      }
      SetChosenPath(t5, e2) {
        this._currentFlow.currentChoices.length = 0;
        let n2 = this.story.PointerAtPath(t5);
        n2.isNull || -1 != n2.index || (n2.index = 0), this.currentPointer = n2, e2 && this.currentTurnIndex++;
      }
      StartFunctionEvaluationFromGame(t5, e2) {
        this.callStack.Push(g.FunctionEvaluationFromGame, this.evaluationStack.length), this.callStack.currentElement.currentPointer = K.StartOf(t5), this.PassArgumentsToEvaluationStack(e2);
      }
      PassArgumentsToEvaluationStack(t5) {
        if (null !== t5) for (let e2 = 0; e2 < t5.length; e2++) {
          if (!("number" == typeof t5[e2] || "string" == typeof t5[e2] || "boolean" == typeof t5[e2] || t5[e2] instanceof w)) throw new Error("ink arguments when calling EvaluateFunction / ChoosePathStringWithParameters must benumber, string, bool or InkList. Argument was " + (null === o(t5[e2]) ? "null" : t5[e2].constructor.name));
          this.PushEvaluationStack(x.Create(t5[e2]));
        }
      }
      TryExitFunctionEvaluationFromGame() {
        return this.callStack.currentElement.type == g.FunctionEvaluationFromGame && (this.currentPointer = K.Null, this.didSafeExit = true, true);
      }
      CompleteFunctionEvaluationFromGame() {
        if (this.callStack.currentElement.type != g.FunctionEvaluationFromGame) throw new Error("Expected external function evaluation to be complete. Stack trace: " + this.callStack.callStackTrace);
        let t5 = this.callStack.currentElement.evaluationStackHeightWhenPushed, e2 = null;
        for (; this.evaluationStack.length > t5; ) {
          let t6 = this.PopEvaluationStack();
          null === e2 && (e2 = t6);
        }
        if (this.PopCallStack(g.FunctionEvaluationFromGame), e2) {
          if (e2 instanceof V) return null;
          let t6 = s(e2, x);
          return t6.valueType == f.DivertTarget ? "-> " + t6.valueObject.toString() : t6.valueObject;
        }
        return null;
      }
      AddError(t5, e2) {
        e2 ? (null == this._currentWarnings && (this._currentWarnings = []), this._currentWarnings.push(t5)) : (null == this._currentErrors && (this._currentErrors = []), this._currentErrors.push(t5));
      }
      OutputStreamDirty() {
        this._outputStreamTextDirty = true, this._outputStreamTagsDirty = true;
      }
    };
    ee = class {
      constructor() {
        this.startTime = void 0;
      }
      get ElapsedMilliseconds() {
        return void 0 === this.startTime ? 0 : (/* @__PURE__ */ new Date()).getTime() - this.startTime;
      }
      Start() {
        this.startTime = (/* @__PURE__ */ new Date()).getTime();
      }
      Stop() {
        this.startTime = void 0;
      }
    };
    !(function(t5) {
      t5[t5.Author = 0] = "Author", t5[t5.Warning = 1] = "Warning", t5[t5.Error = 2] = "Error";
    })(ne || (ne = {})), Number.isInteger || (Number.isInteger = function(t5) {
      return "number" == typeof t5 && isFinite(t5) && t5 > -9007199254740992 && t5 < 9007199254740992 && Math.floor(t5) === t5;
    });
    ie = class t4 extends S {
      get currentChoices() {
        let t5 = [];
        if (null === this._state) return C("this._state");
        for (let e2 of this._state.currentChoices) e2.isInvisibleDefault || (e2.index = t5.length, t5.push(e2));
        return t5;
      }
      get currentText() {
        return this.IfAsyncWeCant("call currentText since it's a work in progress"), this.state.currentText;
      }
      get currentTags() {
        return this.IfAsyncWeCant("call currentTags since it's a work in progress"), this.state.currentTags;
      }
      get currentErrors() {
        return this.state.currentErrors;
      }
      get currentWarnings() {
        return this.state.currentWarnings;
      }
      get currentFlowName() {
        return this.state.currentFlowName;
      }
      get currentFlowIsDefaultFlow() {
        return this.state.currentFlowIsDefaultFlow;
      }
      get aliveFlowNames() {
        return this.state.aliveFlowNames;
      }
      get hasError() {
        return this.state.hasError;
      }
      get hasWarning() {
        return this.state.hasWarning;
      }
      get variablesState() {
        return this.state.variablesState;
      }
      get listDefinitions() {
        return this._listDefinitions;
      }
      get state() {
        return this._state;
      }
      StartProfiling() {
      }
      EndProfiling() {
      }
      constructor() {
        let e2;
        super(), this.inkVersionMinimumCompatible = 18, this.onError = null, this.onDidContinue = null, this.onMakeChoice = null, this.onEvaluateFunction = null, this.onCompleteEvaluateFunction = null, this.onChoosePathString = null, this._prevContainers = [], this.allowExternalFunctionFallbacks = false, this._listDefinitions = null, this._variableObservers = null, this._hasValidatedExternals = false, this._temporaryEvaluationContainer = null, this._asyncContinueActive = false, this._stateSnapshotAtLastNewline = null, this._sawLookaheadUnsafeFunctionAfterNewline = false, this._recursiveContinueCount = 0, this._asyncSaving = false, this._profiler = null;
        let n2 = null, i2 = null;
        if (arguments[0] instanceof k) e2 = arguments[0], void 0 !== arguments[1] && (n2 = arguments[1]), this._mainContentContainer = e2;
        else if ("string" == typeof arguments[0]) {
          let t5 = arguments[0];
          i2 = Zt.TextToDictionary(t5);
        } else i2 = arguments[0];
        if (null != n2 && (this._listDefinitions = new Kt(n2)), this._externals = /* @__PURE__ */ new Map(), null !== i2) {
          let e3 = i2, n3 = e3.inkVersion;
          if (null == n3) throw new Error("ink version number not found. Are you sure it's a valid .ink.json file?");
          let r2 = parseInt(n3);
          if (r2 > t4.inkVersionCurrent) throw new Error("Version of ink used to build story was newer than the current version of the engine");
          if (r2 < this.inkVersionMinimumCompatible) throw new Error("Version of ink used to build story is too old to be loaded by this version of the engine");
          r2 != t4.inkVersionCurrent && console.warn(`WARNING: Version of ink ${t4.inkVersionCurrent} used to build story doesn't match current version of engine (${r2}). Non-critical, but recommend synchronising.`);
          let a2, o2 = e3.root;
          if (null == o2) throw new Error("Root node for ink not found. Are you sure it's a valid .ink.json file?");
          (a2 = e3.listDefs) && (this._listDefinitions = Ht.JTokenToListDefinitions(a2)), this._mainContentContainer = s(Ht.JTokenToRuntimeObject(o2), k), this.ResetState();
        }
      }
      ToJson(e2) {
        let n2 = false;
        if (e2 || (n2 = true, e2 = new Zt.Writer()), e2.WriteObjectStart(), e2.WriteIntProperty("inkVersion", t4.inkVersionCurrent), e2.WriteProperty("root", ((t5) => Ht.WriteRuntimeContainer(t5, this._mainContentContainer))), null != this._listDefinitions) {
          e2.WritePropertyStart("listDefs"), e2.WriteObjectStart();
          for (let t5 of this._listDefinitions.lists) {
            e2.WritePropertyStart(t5.name), e2.WriteObjectStart();
            for (let [n3, i2] of t5.items) {
              let t6 = b.fromSerializedKey(n3), r2 = i2;
              e2.WriteIntProperty(t6.itemName, r2);
            }
            e2.WriteObjectEnd(), e2.WritePropertyEnd();
          }
          e2.WriteObjectEnd(), e2.WritePropertyEnd();
        }
        if (e2.WriteObjectEnd(), n2) return e2.toString();
      }
      ResetState() {
        this.IfAsyncWeCant("ResetState"), this._state = new te(this), this._state.variablesState.ObserveVariableChange(this.VariableStateDidChangeEvent.bind(this)), this.ResetGlobals();
      }
      ResetErrors() {
        if (null === this._state) return C("this._state");
        this._state.ResetErrors();
      }
      ResetCallstack() {
        if (this.IfAsyncWeCant("ResetCallstack"), null === this._state) return C("this._state");
        this._state.ForceEnd();
      }
      ResetGlobals() {
        if (this._mainContentContainer.namedContent.get("global decl")) {
          let t5 = this.state.currentPointer.copy();
          this.ChoosePath(new p("global decl"), false), this.ContinueInternal(), this.state.currentPointer = t5;
        }
        this.state.variablesState.SnapshotDefaultGlobals();
      }
      SwitchFlow(t5) {
        if (this.IfAsyncWeCant("switch flow"), this._asyncSaving) throw new Error("Story is already in background saving mode, can't switch flow to " + t5);
        this.state.SwitchFlow_Internal(t5);
      }
      RemoveFlow(t5) {
        this.state.RemoveFlow_Internal(t5);
      }
      SwitchToDefaultFlow() {
        this.state.SwitchToDefaultFlow_Internal();
      }
      Continue() {
        return this.ContinueAsync(0), this.currentText;
      }
      get canContinue() {
        return this.state.canContinue;
      }
      get asyncContinueComplete() {
        return !this._asyncContinueActive;
      }
      ContinueAsync(t5) {
        this._hasValidatedExternals || this.ValidateExternalBindings(), this.ContinueInternal(t5);
      }
      ContinueInternal() {
        let t5 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : 0;
        null != this._profiler && this._profiler.PreContinue();
        let e2 = t5 > 0;
        if (this._recursiveContinueCount++, this._asyncContinueActive) this._asyncContinueActive && !e2 && (this._asyncContinueActive = false);
        else {
          if (this._asyncContinueActive = e2, !this.canContinue) throw new Error("Can't continue - should check canContinue before calling Continue");
          this._state.didSafeExit = false, this._state.ResetOutput(), 1 == this._recursiveContinueCount && this._state.variablesState.StartVariableObservation();
        }
        let n2 = new ee();
        n2.Start();
        let i2 = false;
        this._sawLookaheadUnsafeFunctionAfterNewline = false;
        do {
          try {
            i2 = this.ContinueSingleStep();
          } catch (t6) {
            if (!(t6 instanceof E)) throw t6;
            this.AddError(t6.message, void 0, t6.useEndLineNumber);
            break;
          }
          if (i2) break;
          if (this._asyncContinueActive && n2.ElapsedMilliseconds > t5) break;
        } while (this.canContinue);
        n2.Stop();
        let r2 = null;
        if (!i2 && this.canContinue || (null !== this._stateSnapshotAtLastNewline && this.RestoreStateSnapshot(), this.canContinue || (this.state.callStack.canPopThread && this.AddError("Thread available to pop, threads should always be flat by the end of evaluation?"), 0 != this.state.generatedChoices.length || this.state.didSafeExit || null != this._temporaryEvaluationContainer || (this.state.callStack.CanPop(g.Tunnel) ? this.AddError("unexpectedly reached end of content. Do you need a '->->' to return from a tunnel?") : this.state.callStack.CanPop(g.Function) ? this.AddError("unexpectedly reached end of content. Do you need a '~ return'?") : this.state.callStack.canPop ? this.AddError("unexpectedly reached end of content for unknown reason. Please debug compiler!") : this.AddError("ran out of content. Do you need a '-> DONE' or '-> END'?"))), this.state.didSafeExit = false, this._sawLookaheadUnsafeFunctionAfterNewline = false, 1 == this._recursiveContinueCount && (r2 = this._state.variablesState.CompleteVariableObservation()), this._asyncContinueActive = false, null !== this.onDidContinue && this.onDidContinue()), this._recursiveContinueCount--, null != this._profiler && this._profiler.PostContinue(), this.state.hasError || this.state.hasWarning) {
          if (null === this.onError) {
            let t6 = new y();
            throw t6.Append("Ink had "), this.state.hasError && (t6.Append(`${this.state.currentErrors.length}`), t6.Append(1 == this.state.currentErrors.length ? " error" : " errors"), this.state.hasWarning && t6.Append(" and ")), this.state.hasWarning && (t6.Append(`${this.state.currentWarnings.length}`), t6.Append(1 == this.state.currentWarnings.length ? " warning" : " warnings"), this.state.hasWarning && t6.Append(" and ")), t6.Append(". It is strongly suggested that you assign an error handler to story.onError. The first issue was: "), t6.Append(this.state.hasError ? this.state.currentErrors[0] : this.state.currentWarnings[0]), new E(t6.toString());
          }
          if (this.state.hasError) for (let t6 of this.state.currentErrors) this.onError(t6, ne.Error);
          if (this.state.hasWarning) for (let t6 of this.state.currentWarnings) this.onError(t6, ne.Warning);
          this.ResetErrors();
        }
        null != r2 && Object.keys(r2).length > 0 && this._state.variablesState.NotifyObservers(r2);
      }
      ContinueSingleStep() {
        if (null != this._profiler && this._profiler.PreStep(), this.Step(), null != this._profiler && this._profiler.PostStep(), this.canContinue || this.state.callStack.elementIsEvaluateFromGame || this.TryFollowDefaultInvisibleChoice(), null != this._profiler && this._profiler.PreSnapshot(), !this.state.inStringEvaluation) {
          if (null !== this._stateSnapshotAtLastNewline) {
            if (null === this._stateSnapshotAtLastNewline.currentTags) return C("this._stateAtLastNewline.currentTags");
            if (null === this.state.currentTags) return C("this.state.currentTags");
            let e2 = this.CalculateNewlineOutputStateChange(this._stateSnapshotAtLastNewline.currentText, this.state.currentText, this._stateSnapshotAtLastNewline.currentTags.length, this.state.currentTags.length);
            if (e2 == t4.OutputStateChange.ExtendedBeyondNewline || this._sawLookaheadUnsafeFunctionAfterNewline) return this.RestoreStateSnapshot(), true;
            e2 == t4.OutputStateChange.NewlineRemoved && this.DiscardSnapshot();
          }
          this.state.outputStreamEndsInNewline && (this.canContinue ? null == this._stateSnapshotAtLastNewline && this.StateSnapshot() : this.DiscardSnapshot());
        }
        return null != this._profiler && this._profiler.PostSnapshot(), false;
      }
      CalculateNewlineOutputStateChange(e2, n2, i2, r2) {
        if (null === e2) return C("prevText");
        if (null === n2) return C("currText");
        let s2 = n2.length >= e2.length && e2.length > 0 && "\n" == n2.charAt(e2.length - 1);
        if (i2 == r2 && e2.length == n2.length && s2) return t4.OutputStateChange.NoChange;
        if (!s2) return t4.OutputStateChange.NewlineRemoved;
        if (r2 > i2) return t4.OutputStateChange.ExtendedBeyondNewline;
        for (let i3 = e2.length; i3 < n2.length; i3++) {
          let e3 = n2.charAt(i3);
          if (" " != e3 && "	" != e3) return t4.OutputStateChange.ExtendedBeyondNewline;
        }
        return t4.OutputStateChange.NoChange;
      }
      ContinueMaximally() {
        this.IfAsyncWeCant("ContinueMaximally");
        let t5 = new y();
        for (; this.canContinue; ) t5.Append(this.Continue());
        return t5.toString();
      }
      ContentAtPath(t5) {
        return this.mainContentContainer.ContentAtPath(t5);
      }
      KnotContainerWithName(t5) {
        let e2 = this.mainContentContainer.namedContent.get(t5);
        return e2 instanceof k ? e2 : null;
      }
      PointerAtPath(t5) {
        if (0 == t5.length) return K.Null;
        let e2 = new K(), n2 = t5.length, i2 = null;
        return null === t5.lastComponent ? C("path.lastComponent") : (t5.lastComponent.isIndex ? (n2 = t5.length - 1, i2 = this.mainContentContainer.ContentAtPath(t5, void 0, n2), e2.container = i2.container, e2.index = t5.lastComponent.index) : (i2 = this.mainContentContainer.ContentAtPath(t5), e2.container = i2.container, e2.index = -1), null == i2.obj || i2.obj == this.mainContentContainer && n2 > 0 ? this.Error("Failed to find content at path '" + t5 + "', and no approximation of it was possible.") : i2.approximate && this.Warning("Failed to find content at path '" + t5 + "', so it was approximated to: '" + i2.obj.path + "'."), e2);
      }
      StateSnapshot() {
        this._stateSnapshotAtLastNewline = this._state, this._state = this._state.CopyAndStartPatching(false);
      }
      RestoreStateSnapshot() {
        null === this._stateSnapshotAtLastNewline && C("_stateSnapshotAtLastNewline"), this._stateSnapshotAtLastNewline.RestoreAfterPatch(), this._state = this._stateSnapshotAtLastNewline, this._stateSnapshotAtLastNewline = null, this._asyncSaving || this._state.ApplyAnyPatch();
      }
      DiscardSnapshot() {
        this._asyncSaving || this._state.ApplyAnyPatch(), this._stateSnapshotAtLastNewline = null;
      }
      CopyStateForBackgroundThreadSave() {
        if (this.IfAsyncWeCant("start saving on a background thread"), this._asyncSaving) throw new Error("Story is already in background saving mode, can't call CopyStateForBackgroundThreadSave again!");
        let t5 = this._state;
        return this._state = this._state.CopyAndStartPatching(true), this._asyncSaving = true, t5;
      }
      BackgroundSaveComplete() {
        null === this._stateSnapshotAtLastNewline && this._state.ApplyAnyPatch(), this._asyncSaving = false;
      }
      Step() {
        let t5 = true, e2 = this.state.currentPointer.copy();
        if (e2.isNull) return;
        let n2 = r(e2.Resolve(), k);
        for (; n2 && (this.VisitContainer(n2, true), 0 != n2.content.length); ) e2 = K.StartOf(n2), n2 = r(e2.Resolve(), k);
        this.state.currentPointer = e2.copy(), null != this._profiler && this._profiler.Step(this.state.callStack);
        let i2 = e2.Resolve(), s2 = this.PerformLogicAndFlowControl(i2);
        if (this.state.currentPointer.isNull) return;
        s2 && (t5 = false);
        let a2 = r(i2, U);
        if (a2) {
          let e3 = this.ProcessChoice(a2);
          e3 && this.state.generatedChoices.push(e3), i2 = null, t5 = false;
        }
        if (i2 instanceof k && (t5 = false), t5) {
          let t6 = r(i2, F);
          if (t6 && -1 == t6.contextIndex) {
            let e3 = this.state.callStack.ContextForVariableNamed(t6.variableName);
            i2 = new F(t6.variableName, e3);
          }
          this.state.inExpressionEvaluation ? this.state.PushEvaluationStack(i2) : this.state.PushToOutputStream(i2);
        }
        this.NextContent();
        let o2 = r(i2, D);
        o2 && o2.commandType == D.CommandType.StartThread && this.state.callStack.PushThread();
      }
      VisitContainer(t5, e2) {
        t5.countingAtStartOnly && !e2 || (t5.visitsShouldBeCounted && this.state.IncrementVisitCountForContainer(t5), t5.turnIndexShouldBeCounted && this.state.RecordTurnIndexVisitToContainer(t5));
      }
      VisitChangedContainersDueToDivert() {
        let t5 = this.state.previousPointer.copy(), e2 = this.state.currentPointer.copy();
        if (e2.isNull || -1 == e2.index) return;
        if (this._prevContainers.length = 0, !t5.isNull) {
          let e3 = r(t5.Resolve(), k) || r(t5.container, k);
          for (; e3; ) this._prevContainers.push(e3), e3 = r(e3.parent, k);
        }
        let n2 = e2.Resolve();
        if (null == n2) return;
        let i2 = r(n2.parent, k), s2 = true;
        for (; i2 && (this._prevContainers.indexOf(i2) < 0 || i2.countingAtStartOnly); ) {
          let t6 = i2.content.length > 0 && n2 == i2.content[0] && s2;
          t6 || (s2 = false), this.VisitContainer(i2, t6), n2 = i2, i2 = r(i2.parent, k);
        }
      }
      PopChoiceStringAndTags(t5) {
        let e2 = s(this.state.PopEvaluationStack(), I);
        for (; this.state.evaluationStack.length > 0 && null != r(this.state.PeekEvaluationStack(), qt); ) {
          let e3 = r(this.state.PopEvaluationStack(), qt);
          e3 && t5.push(e3.text);
        }
        return e2.value;
      }
      ProcessChoice(t5) {
        let e2 = true;
        if (t5.hasCondition) {
          let t6 = this.state.PopEvaluationStack();
          this.IsTruthy(t6) || (e2 = false);
        }
        let n2 = "", i2 = "", r2 = [];
        if (t5.hasChoiceOnlyContent && (i2 = this.PopChoiceStringAndTags(r2) || ""), t5.hasStartContent && (n2 = this.PopChoiceStringAndTags(r2) || ""), t5.onceOnly) {
          this.state.VisitCountForContainer(t5.choiceTarget) > 0 && (e2 = false);
        }
        if (!e2) return null;
        let s2 = new Ut();
        return s2.targetPath = t5.pathOnChoice, s2.sourcePath = t5.path.toString(), s2.isInvisibleDefault = t5.isInvisibleDefault, s2.threadAtGeneration = this.state.callStack.ForkThread(), s2.tags = r2.reverse(), s2.text = (n2 + i2).replace(/^[ \t]+|[ \t]+$/g, ""), s2;
      }
      IsTruthy(t5) {
        if (t5 instanceof x) {
          let e2 = t5;
          if (e2 instanceof O) {
            let t6 = e2;
            return this.Error("Shouldn't use a divert target (to " + t6.targetPath + ") as a conditional value. Did you intend a function call 'likeThis()' or a read count check 'likeThis'? (no arrows)"), false;
          }
          return e2.isTruthy;
        }
        return false;
      }
      PerformLogicAndFlowControl(t5) {
        if (null == t5) return false;
        if (t5 instanceof H) {
          let e2 = t5;
          if (e2.isConditional) {
            let t6 = this.state.PopEvaluationStack();
            if (!this.IsTruthy(t6)) return true;
          }
          if (e2.hasVariableTarget) {
            let t6 = e2.variableDivertName, n2 = this.state.variablesState.GetVariableWithName(t6);
            if (null == n2) this.Error("Tried to divert using a target from a variable that could not be found (" + t6 + ")");
            else if (!(n2 instanceof O)) {
              let e3 = r(n2, P), i3 = "Tried to divert to a target from a variable, but the variable (" + t6 + ") didn't contain a divert target, it ";
              e3 instanceof P && 0 == e3.value ? i3 += "was empty/null (the value 0)." : i3 += "contained '" + n2 + "'.", this.Error(i3);
            }
            let i2 = s(n2, O);
            this.state.divertedPointer = this.PointerAtPath(i2.targetPath);
          } else {
            if (e2.isExternal) return this.CallExternalFunction(e2.targetPathString, e2.externalArgs), true;
            this.state.divertedPointer = e2.targetPointer.copy();
          }
          return e2.pushesToStack && this.state.callStack.Push(e2.stackPushType, void 0, this.state.outputStream.length), this.state.divertedPointer.isNull && !e2.isExternal && (e2 && e2.debugMetadata && null != e2.debugMetadata.sourceName ? this.Error("Divert target doesn't exist: " + e2.debugMetadata.sourceName) : this.Error("Divert resolution failed: " + e2)), true;
        }
        if (t5 instanceof D) {
          let e2 = t5;
          switch (e2.commandType) {
            case D.CommandType.EvalStart:
              this.Assert(false === this.state.inExpressionEvaluation, "Already in expression evaluation?"), this.state.inExpressionEvaluation = true;
              break;
            case D.CommandType.EvalEnd:
              this.Assert(true === this.state.inExpressionEvaluation, "Not in expression evaluation mode"), this.state.inExpressionEvaluation = false;
              break;
            case D.CommandType.EvalOutput:
              if (this.state.evaluationStack.length > 0) {
                let t7 = this.state.PopEvaluationStack();
                if (!(t7 instanceof V)) {
                  let e3 = new I(t7.toString());
                  this.state.PushToOutputStream(e3);
                }
              }
              break;
            case D.CommandType.NoOp:
              break;
            case D.CommandType.Duplicate:
              this.state.PushEvaluationStack(this.state.PeekEvaluationStack());
              break;
            case D.CommandType.PopEvaluatedValue:
              this.state.PopEvaluationStack();
              break;
            case D.CommandType.PopFunction:
            case D.CommandType.PopTunnel:
              let t6 = e2.commandType == D.CommandType.PopFunction ? g.Function : g.Tunnel, n2 = null;
              if (t6 == g.Tunnel) {
                let t7 = this.state.PopEvaluationStack();
                n2 = r(t7, O), null === n2 && this.Assert(t7 instanceof V, "Expected void if ->-> doesn't override target");
              }
              if (this.state.TryExitFunctionEvaluationFromGame()) break;
              if (this.state.callStack.currentElement.type == t6 && this.state.callStack.canPop) this.state.PopCallStack(), n2 && (this.state.divertedPointer = this.PointerAtPath(n2.targetPath));
              else {
                let e3 = /* @__PURE__ */ new Map();
                e3.set(g.Function, "function return statement (~ return)"), e3.set(g.Tunnel, "tunnel onwards statement (->->)");
                let n3 = e3.get(this.state.callStack.currentElement.type);
                this.state.callStack.canPop || (n3 = "end of flow (-> END or choice)");
                let i3 = "Found " + e3.get(t6) + ", when expected " + n3;
                this.Error(i3);
              }
              break;
            case D.CommandType.BeginString:
              this.state.PushToOutputStream(e2), this.Assert(true === this.state.inExpressionEvaluation, "Expected to be in an expression when evaluating a string"), this.state.inExpressionEvaluation = false;
              break;
            case D.CommandType.BeginTag:
              this.state.PushToOutputStream(e2);
              break;
            case D.CommandType.EndTag:
              if (this.state.inStringEvaluation) {
                let t7 = [], e3 = 0;
                for (let n4 = this.state.outputStream.length - 1; n4 >= 0; --n4) {
                  let i4 = this.state.outputStream[n4];
                  e3++;
                  let s2 = r(i4, D);
                  if (null != s2) {
                    if (s2.commandType == D.CommandType.BeginTag) break;
                    this.Error("Unexpected ControlCommand while extracting tag from choice");
                    break;
                  }
                  i4 instanceof I && t7.push(i4);
                }
                this.state.PopFromOutputStream(e3);
                let n3 = new y();
                for (let e4 of t7.reverse()) n3.Append(e4.toString());
                let i3 = new qt(this.state.CleanOutputWhitespace(n3.toString()));
                this.state.PushEvaluationStack(i3);
              } else this.state.PushToOutputStream(e2);
              break;
            case D.CommandType.EndString: {
              let t7 = [], e3 = [], n3 = 0;
              for (let i4 = this.state.outputStream.length - 1; i4 >= 0; --i4) {
                let s2 = this.state.outputStream[i4];
                n3++;
                let a3 = r(s2, D);
                if (a3 && a3.commandType == D.CommandType.BeginString) break;
                s2 instanceof qt && e3.push(s2), s2 instanceof I && t7.push(s2);
              }
              this.state.PopFromOutputStream(n3);
              for (let t8 of e3) this.state.PushToOutputStream(t8);
              t7 = t7.reverse();
              let i3 = new y();
              for (let e4 of t7) i3.Append(e4.toString());
              this.state.inExpressionEvaluation = true, this.state.PushEvaluationStack(new I(i3.toString()));
              break;
            }
            case D.CommandType.ChoiceCount:
              let i2 = this.state.generatedChoices.length;
              this.state.PushEvaluationStack(new P(i2));
              break;
            case D.CommandType.Turns:
              this.state.PushEvaluationStack(new P(this.state.currentTurnIndex + 1));
              break;
            case D.CommandType.TurnsSince:
            case D.CommandType.ReadCount:
              let a2 = this.state.PopEvaluationStack();
              if (!(a2 instanceof O)) {
                let t7 = "";
                a2 instanceof P && (t7 = ". Did you accidentally pass a read count ('knot_name') instead of a target ('-> knot_name')?"), this.Error("TURNS_SINCE / READ_COUNT expected a divert target (knot, stitch, label name), but saw " + a2 + t7);
                break;
              }
              let o2, l2 = s(a2, O), h2 = r(this.ContentAtPath(l2.targetPath).correctObj, k);
              null != h2 ? o2 = e2.commandType == D.CommandType.TurnsSince ? this.state.TurnsSinceForContainer(h2) : this.state.VisitCountForContainer(h2) : (o2 = e2.commandType == D.CommandType.TurnsSince ? -1 : 0, this.Warning("Failed to find container for " + e2.toString() + " lookup at " + l2.targetPath.toString())), this.state.PushEvaluationStack(new P(o2));
              break;
            case D.CommandType.Random: {
              let t7 = r(this.state.PopEvaluationStack(), P), e3 = r(this.state.PopEvaluationStack(), P);
              if (null == e3 || e3 instanceof P == false) return this.Error("Invalid value for minimum parameter of RANDOM(min, max)");
              if (null == t7 || t7 instanceof P == false) return this.Error("Invalid value for maximum parameter of RANDOM(min, max)");
              if (null === t7.value) return C("maxInt.value");
              if (null === e3.value) return C("minInt.value");
              let n3 = t7.value - e3.value + 1;
              (!isFinite(n3) || n3 > Number.MAX_SAFE_INTEGER) && (n3 = Number.MAX_SAFE_INTEGER, this.Error("RANDOM was called with a range that exceeds the size that ink numbers can use.")), n3 <= 0 && this.Error("RANDOM was called with minimum as " + e3.value + " and maximum as " + t7.value + ". The maximum must be larger");
              let i3 = this.state.storySeed + this.state.previousRandom, s2 = new Xt(i3).next(), a3 = s2 % n3 + e3.value;
              this.state.PushEvaluationStack(new P(a3)), this.state.previousRandom = s2;
              break;
            }
            case D.CommandType.SeedRandom:
              let u2 = r(this.state.PopEvaluationStack(), P);
              if (null == u2 || u2 instanceof P == false) return this.Error("Invalid value passed to SEED_RANDOM");
              if (null === u2.value) return C("minInt.value");
              this.state.storySeed = u2.value, this.state.previousRandom = 0, this.state.PushEvaluationStack(new V());
              break;
            case D.CommandType.VisitIndex:
              let c2 = this.state.VisitCountForContainer(this.state.currentPointer.container) - 1;
              this.state.PushEvaluationStack(new P(c2));
              break;
            case D.CommandType.SequenceShuffleIndex:
              let d2 = this.NextSequenceShuffleIndex();
              this.state.PushEvaluationStack(new P(d2));
              break;
            case D.CommandType.StartThread:
              break;
            case D.CommandType.Done:
              this.state.callStack.canPopThread ? this.state.callStack.PopThread() : (this.state.didSafeExit = true, this.state.currentPointer = K.Null);
              break;
            case D.CommandType.End:
              this.state.ForceEnd();
              break;
            case D.CommandType.ListFromInt:
              let p2 = r(this.state.PopEvaluationStack(), P), m2 = s(this.state.PopEvaluationStack(), I);
              if (null === p2) throw new E("Passed non-integer when creating a list element from a numerical value.");
              let f2 = null;
              if (null === this.listDefinitions) return C("this.listDefinitions");
              let v2 = this.listDefinitions.TryListGetDefinition(m2.value, null);
              if (!v2.exists) throw new E("Failed to find LIST called " + m2.value);
              {
                if (null === p2.value) return C("minInt.value");
                let t7 = v2.result.TryGetItemWithValue(p2.value, b.Null);
                t7.exists && (f2 = new W(t7.result, p2.value));
              }
              null == f2 && (f2 = new W()), this.state.PushEvaluationStack(f2);
              break;
            case D.CommandType.ListRange:
              let S2 = r(this.state.PopEvaluationStack(), x), _2 = r(this.state.PopEvaluationStack(), x), T2 = r(this.state.PopEvaluationStack(), W);
              if (null === T2 || null === _2 || null === S2) throw new E("Expected list, minimum and maximum for LIST_RANGE");
              if (null === T2.value) return C("targetList.value");
              let A2 = T2.value.ListWithSubRange(_2.valueObject, S2.valueObject);
              this.state.PushEvaluationStack(new W(A2));
              break;
            case D.CommandType.ListRandom: {
              let t7 = this.state.PopEvaluationStack();
              if (null === t7) throw new E("Expected list for LIST_RANDOM");
              let e3 = t7.value, n3 = null;
              if (null === e3) throw C("list");
              if (0 == e3.Count) n3 = new w();
              else {
                let t8 = this.state.storySeed + this.state.previousRandom, i3 = new Xt(t8).next(), r2 = i3 % e3.Count, s2 = e3.entries();
                for (let t9 = 0; t9 <= r2 - 1; t9++) s2.next();
                let a3 = s2.next().value, o3 = { Key: b.fromSerializedKey(a3[0]), Value: a3[1] };
                if (null === o3.Key.originName) return C("randomItem.Key.originName");
                n3 = new w(o3.Key.originName, this), n3.Add(o3.Key, o3.Value), this.state.previousRandom = i3;
              }
              this.state.PushEvaluationStack(new W(n3));
              break;
            }
            default:
              this.Error("unhandled ControlCommand: " + e2);
          }
          return true;
        }
        if (t5 instanceof z) {
          let e2 = t5, n2 = this.state.PopEvaluationStack();
          return this.state.variablesState.Assign(e2, n2), true;
        }
        if (t5 instanceof pt) {
          let e2 = t5, n2 = null;
          if (null != e2.pathForCount) {
            let t6 = e2.containerForCount, i2 = this.state.VisitCountForContainer(t6);
            n2 = new P(i2);
          } else n2 = this.state.variablesState.GetVariableWithName(e2.name), null == n2 && (this.Warning("Variable not found: '" + e2.name + "'. Using default value of 0 (false). This can happen with temporary variables if the declaration hasn't yet been hit. Globals are always given a default value on load if a value doesn't exist in the save state."), n2 = new P(0));
          return this.state.PushEvaluationStack(n2), true;
        }
        if (t5 instanceof j) {
          let e2 = t5, n2 = this.state.PopEvaluationStack(e2.numberOfParameters), i2 = e2.Call(n2);
          return this.state.PushEvaluationStack(i2), true;
        }
        return false;
      }
      ChoosePathString(t5) {
        let e2 = !(arguments.length > 1 && void 0 !== arguments[1]) || arguments[1], n2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : [];
        if (this.IfAsyncWeCant("call ChoosePathString right now"), null !== this.onChoosePathString && this.onChoosePathString(t5, n2), e2) this.ResetCallstack();
        else if (this.state.callStack.currentElement.type == g.Function) {
          let e3 = "", n3 = this.state.callStack.currentElement.currentPointer.container;
          throw null != n3 && (e3 = "(" + n3.path.toString() + ") "), new Error("Story was running a function " + e3 + "when you called ChoosePathString(" + t5 + ") - this is almost certainly not not what you want! Full stack trace: \n" + this.state.callStack.callStackTrace);
        }
        this.state.PassArgumentsToEvaluationStack(n2), this.ChoosePath(new p(t5));
      }
      IfAsyncWeCant(t5) {
        if (this._asyncContinueActive) throw new Error("Can't " + t5 + ". Story is in the middle of a ContinueAsync(). Make more ContinueAsync() calls or a single Continue() call beforehand.");
      }
      ChoosePath(t5) {
        let e2 = !(arguments.length > 1 && void 0 !== arguments[1]) || arguments[1];
        this.state.SetChosenPath(t5, e2), this.VisitChangedContainersDueToDivert();
      }
      ChooseChoiceIndex(t5) {
        let e2 = this.currentChoices;
        this.Assert(t5 >= 0 && t5 < e2.length, "choice out of range");
        let n2 = e2[t5];
        return null !== this.onMakeChoice && this.onMakeChoice(n2), null === n2.threadAtGeneration ? C("choiceToChoose.threadAtGeneration") : null === n2.targetPath ? C("choiceToChoose.targetPath") : (this.state.callStack.currentThread = n2.threadAtGeneration, void this.ChoosePath(n2.targetPath));
      }
      HasFunction(t5) {
        try {
          return null != this.KnotContainerWithName(t5);
        } catch (t6) {
          return false;
        }
      }
      EvaluateFunction(t5) {
        let e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : [], n2 = arguments.length > 2 && void 0 !== arguments[2] && arguments[2];
        if (null !== this.onEvaluateFunction && this.onEvaluateFunction(t5, e2), this.IfAsyncWeCant("evaluate a function"), null == t5) throw new Error("Function is null");
        if ("" == t5 || "" == t5.trim()) throw new Error("Function is empty or white space.");
        let i2 = this.KnotContainerWithName(t5);
        if (null == i2) throw new Error("Function doesn't exist: '" + t5 + "'");
        let r2 = [];
        r2.push(...this.state.outputStream), this._state.ResetOutput(), this.state.StartFunctionEvaluationFromGame(i2, e2);
        let s2 = new y();
        for (; this.canContinue; ) s2.Append(this.Continue());
        let a2 = s2.toString();
        this._state.ResetOutput(r2);
        let o2 = this.state.CompleteFunctionEvaluationFromGame();
        return null != this.onCompleteEvaluateFunction && this.onCompleteEvaluateFunction(t5, e2, a2, o2), n2 ? { returned: o2, output: a2 } : o2;
      }
      EvaluateExpression(t5) {
        let e2 = this.state.callStack.elements.length;
        this.state.callStack.Push(g.Tunnel), this._temporaryEvaluationContainer = t5, this.state.GoToStart();
        let n2 = this.state.evaluationStack.length;
        return this.Continue(), this._temporaryEvaluationContainer = null, this.state.callStack.elements.length > e2 && this.state.PopCallStack(), this.state.evaluationStack.length > n2 ? this.state.PopEvaluationStack() : null;
      }
      CallExternalFunction(t5, e2) {
        if (null === t5) return C("funcName");
        let n2 = this._externals.get(t5), i2 = null, r2 = void 0 !== n2;
        if (r2 && !n2.lookAheadSafe && this._state.inStringEvaluation && this.Error("External function " + t5 + ` could not be called because 1) it wasn't marked as lookaheadSafe when BindExternalFunction was called and 2) the story is in the middle of string generation, either because choice text is being generated, or because you have ink like "hello {func()}". You can work around this by generating the result of your function into a temporary variable before the string or choice gets generated: ~ temp x = ` + t5 + "()"), r2 && !n2.lookAheadSafe && null !== this._stateSnapshotAtLastNewline) return void (this._sawLookaheadUnsafeFunctionAfterNewline = true);
        if (!r2) {
          if (this.allowExternalFunctionFallbacks) return i2 = this.KnotContainerWithName(t5), this.Assert(null !== i2, "Trying to call EXTERNAL function '" + t5 + "' which has not been bound, and fallback ink function could not be found."), this.state.callStack.Push(g.Function, void 0, this.state.outputStream.length), void (this.state.divertedPointer = K.StartOf(i2));
          this.Assert(false, "Trying to call EXTERNAL function '" + t5 + "' which has not been bound (and ink fallbacks disabled).");
        }
        let a2 = [];
        for (let t6 = 0; t6 < e2; ++t6) {
          let t7 = s(this.state.PopEvaluationStack(), x).valueObject;
          a2.push(t7);
        }
        a2.reverse();
        let o2 = n2.function(a2), l2 = null;
        null != o2 ? (l2 = x.Create(o2), this.Assert(null !== l2, "Could not create ink value from returned object of type " + typeof o2)) : l2 = new V(), this.state.PushEvaluationStack(l2);
      }
      BindExternalFunctionGeneral(t5, e2) {
        let n2 = !(arguments.length > 2 && void 0 !== arguments[2]) || arguments[2];
        this.IfAsyncWeCant("bind an external function"), this.Assert(!this._externals.has(t5), "Function '" + t5 + "' has already been bound."), this._externals.set(t5, { function: e2, lookAheadSafe: n2 });
      }
      TryCoerce(t5) {
        return t5;
      }
      BindExternalFunction(t5, e2) {
        let n2 = arguments.length > 2 && void 0 !== arguments[2] && arguments[2];
        this.Assert(null != e2, "Can't bind a null function"), this.BindExternalFunctionGeneral(t5, ((t6) => {
          this.Assert(t6.length >= e2.length, "External function expected " + e2.length + " arguments");
          let n3 = [];
          for (let e3 = 0, i2 = t6.length; e3 < i2; e3++) n3[e3] = this.TryCoerce(t6[e3]);
          return e2.apply(null, n3);
        }), n2);
      }
      UnbindExternalFunction(t5) {
        this.IfAsyncWeCant("unbind an external a function"), this.Assert(this._externals.has(t5), "Function '" + t5 + "' has not been bound."), this._externals.delete(t5);
      }
      ValidateExternalBindings() {
        let t5 = null, e2 = null, n2 = arguments[1] || /* @__PURE__ */ new Set();
        if (arguments[0] instanceof k && (t5 = arguments[0]), arguments[0] instanceof S && (e2 = arguments[0]), null === t5 && null === e2) if (this.ValidateExternalBindings(this._mainContentContainer, n2), this._hasValidatedExternals = true, 0 == n2.size) this._hasValidatedExternals = true;
        else {
          let t6 = "Error: Missing function binding for external";
          t6 += n2.size > 1 ? "s" : "", t6 += ": '", t6 += Array.from(n2).join("', '"), t6 += "' ", t6 += this.allowExternalFunctionFallbacks ? ", and no fallback ink function found." : " (ink fallbacks disabled)", this.Error(t6);
        }
        else if (null != t5) {
          for (let e3 of t5.content) {
            null != e3 && e3.hasValidName || this.ValidateExternalBindings(e3, n2);
          }
          for (let [, e3] of t5.namedContent) this.ValidateExternalBindings(r(e3, S), n2);
        } else if (null != e2) {
          let t6 = r(e2, H);
          if (t6 && t6.isExternal) {
            let e3 = t6.targetPathString;
            if (null === e3) return C("name");
            if (!this._externals.has(e3)) if (this.allowExternalFunctionFallbacks) {
              this.mainContentContainer.namedContent.has(e3) || n2.add(e3);
            } else n2.add(e3);
          }
        }
      }
      ObserveVariable(t5, e2) {
        if (this.IfAsyncWeCant("observe a new variable"), null === this._variableObservers && (this._variableObservers = /* @__PURE__ */ new Map()), !this.state.variablesState.GlobalVariableExistsWithName(t5)) throw new Error("Cannot observe variable '" + t5 + "' because it wasn't declared in the ink story.");
        this._variableObservers.has(t5) ? this._variableObservers.get(t5).push(e2) : this._variableObservers.set(t5, [e2]);
      }
      ObserveVariables(t5, e2) {
        for (let n2 = 0, i2 = t5.length; n2 < i2; n2++) this.ObserveVariable(t5[n2], e2[n2]);
      }
      RemoveVariableObserver(t5, e2) {
        if (this.IfAsyncWeCant("remove a variable observer"), null !== this._variableObservers) {
          if (null != e2) {
            if (this._variableObservers.has(e2)) if (null != t5) {
              let n2 = this._variableObservers.get(e2);
              null != n2 && (n2.splice(n2.indexOf(t5), 1), 0 === n2.length && this._variableObservers.delete(e2));
            } else this._variableObservers.delete(e2);
          } else if (null != t5) {
            let e3 = this._variableObservers.keys();
            for (let n2 of e3) {
              let e4 = this._variableObservers.get(n2);
              null != e4 && (e4.splice(e4.indexOf(t5), 1), 0 === e4.length && this._variableObservers.delete(n2));
            }
          }
        }
      }
      VariableStateDidChangeEvent(t5, e2) {
        if (null === this._variableObservers) return;
        let n2 = this._variableObservers.get(t5);
        if (void 0 !== n2) {
          if (!(e2 instanceof x)) throw new Error("Tried to get the value of a variable that isn't a standard type");
          let i2 = s(e2, x);
          for (let e3 of n2) e3(t5, i2.valueObject);
        }
      }
      get globalTags() {
        return this.TagsAtStartOfFlowContainerWithPathString("");
      }
      TagsForContentAtPath(t5) {
        return this.TagsAtStartOfFlowContainerWithPathString(t5);
      }
      TagsAtStartOfFlowContainerWithPathString(t5) {
        let e2 = new p(t5), n2 = this.ContentAtPath(e2).container;
        if (null === n2) return C("flowContainer");
        for (; ; ) {
          let t6 = n2.content[0];
          if (!(t6 instanceof k)) break;
          n2 = t6;
        }
        let i2 = false, s2 = null;
        for (let t6 of n2.content) {
          let e3 = r(t6, D);
          if (null != e3) e3.commandType == D.CommandType.BeginTag ? i2 = true : e3.commandType == D.CommandType.EndTag && (i2 = false);
          else {
            if (!i2) break;
            {
              let e4 = r(t6, I);
              null !== e4 ? (null === s2 && (s2 = []), null !== e4.value && s2.push(e4.value)) : this.Error("Tag contained non-text content. Only plain text is allowed when using globalTags or TagsAtContentPath. If you want to evaluate dynamic content, you need to use story.Continue().");
            }
          }
        }
        return s2;
      }
      BuildStringOfHierarchy() {
        let t5 = new y();
        return this.mainContentContainer.BuildStringOfHierarchy(t5, 0, this.state.currentPointer.Resolve()), t5.toString();
      }
      BuildStringOfContainer(t5) {
        let e2 = new y();
        return t5.BuildStringOfHierarchy(e2, 0, this.state.currentPointer.Resolve()), e2.toString();
      }
      NextContent() {
        if (this.state.previousPointer = this.state.currentPointer.copy(), !this.state.divertedPointer.isNull && (this.state.currentPointer = this.state.divertedPointer.copy(), this.state.divertedPointer = K.Null, this.VisitChangedContainersDueToDivert(), !this.state.currentPointer.isNull)) return;
        if (!this.IncrementContentPointer()) {
          let t5 = false;
          this.state.callStack.CanPop(g.Function) ? (this.state.PopCallStack(g.Function), this.state.inExpressionEvaluation && this.state.PushEvaluationStack(new V()), t5 = true) : this.state.callStack.canPopThread ? (this.state.callStack.PopThread(), t5 = true) : this.state.TryExitFunctionEvaluationFromGame(), t5 && !this.state.currentPointer.isNull && this.NextContent();
        }
      }
      IncrementContentPointer() {
        let t5 = true, e2 = this.state.callStack.currentElement.currentPointer.copy();
        if (e2.index++, null === e2.container) return C("pointer.container");
        for (; e2.index >= e2.container.content.length; ) {
          t5 = false;
          let n2 = r(e2.container.parent, k);
          if (n2 instanceof k == false) break;
          let i2 = n2.content.indexOf(e2.container);
          if (-1 == i2) break;
          if (e2 = new K(n2, i2), e2.index++, t5 = true, null === e2.container) return C("pointer.container");
        }
        return t5 || (e2 = K.Null), this.state.callStack.currentElement.currentPointer = e2.copy(), t5;
      }
      TryFollowDefaultInvisibleChoice() {
        let t5 = this._state.currentChoices, e2 = t5.filter(((t6) => t6.isInvisibleDefault));
        if (0 == e2.length || t5.length > e2.length) return false;
        let n2 = e2[0];
        return null === n2.targetPath ? C("choice.targetPath") : null === n2.threadAtGeneration ? C("choice.threadAtGeneration") : (this.state.callStack.currentThread = n2.threadAtGeneration, null !== this._stateSnapshotAtLastNewline && (this.state.callStack.currentThread = this.state.callStack.ForkThread()), this.ChoosePath(n2.targetPath, false), true);
      }
      NextSequenceShuffleIndex() {
        let t5 = r(this.state.PopEvaluationStack(), P);
        if (!(t5 instanceof P)) return this.Error("expected number of elements in sequence for shuffle index"), 0;
        let e2 = this.state.currentPointer.container;
        if (null === e2) return C("seqContainer");
        if (null === t5.value) return C("numElementsIntVal.value");
        let n2 = t5.value, i2 = s(this.state.PopEvaluationStack(), P).value;
        if (null === i2) return C("seqCount");
        let a2 = i2 / n2, o2 = i2 % n2, l2 = e2.path.toString(), h2 = 0;
        for (let t6 = 0, e3 = l2.length; t6 < e3; t6++) h2 += l2.charCodeAt(t6) || 0;
        let u2 = h2 + a2 + this.state.storySeed, c2 = new Xt(Math.floor(u2)), d2 = [];
        for (let t6 = 0; t6 < n2; ++t6) d2.push(t6);
        for (let t6 = 0; t6 <= o2; ++t6) {
          let e3 = c2.next() % d2.length, n3 = d2[e3];
          if (d2.splice(e3, 1), t6 == o2) return n3;
        }
        throw new Error("Should never reach here");
      }
      Error(t5) {
        let e2 = arguments.length > 1 && void 0 !== arguments[1] && arguments[1], n2 = new E(t5);
        throw n2.useEndLineNumber = e2, n2;
      }
      Warning(t5) {
        this.AddError(t5, true);
      }
      AddError(t5) {
        let e2 = arguments.length > 1 && void 0 !== arguments[1] && arguments[1], n2 = arguments.length > 2 && void 0 !== arguments[2] && arguments[2], i2 = this.currentDebugMetadata, r2 = e2 ? "WARNING" : "ERROR";
        if (null != i2) {
          let e3 = n2 ? i2.endLineNumber : i2.startLineNumber;
          t5 = "RUNTIME " + r2 + ": '" + i2.fileName + "' line " + e3 + ": " + t5;
        } else t5 = this.state.currentPointer.isNull ? "RUNTIME " + r2 + ": " + t5 : "RUNTIME " + r2 + ": (" + this.state.currentPointer + "): " + t5;
        this.state.AddError(t5, e2), e2 || this.state.ForceEnd();
      }
      Assert(t5) {
        let e2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null;
        if (0 == t5) throw null == e2 && (e2 = "Story assert"), new Error(e2 + " " + this.currentDebugMetadata);
      }
      get currentDebugMetadata() {
        let t5, e2 = this.state.currentPointer;
        if (!e2.isNull && null !== e2.Resolve() && (t5 = e2.Resolve().debugMetadata, null !== t5)) return t5;
        for (let n2 = this.state.callStack.elements.length - 1; n2 >= 0; --n2) if (e2 = this.state.callStack.elements[n2].currentPointer, !e2.isNull && null !== e2.Resolve() && (t5 = e2.Resolve().debugMetadata, null !== t5)) return t5;
        for (let e3 = this.state.outputStream.length - 1; e3 >= 0; --e3) {
          if (t5 = this.state.outputStream[e3].debugMetadata, null !== t5) return t5;
        }
        return null;
      }
      get mainContentContainer() {
        return this._temporaryEvaluationContainer ? this._temporaryEvaluationContainer : this._mainContentContainer;
      }
    };
    ie.inkVersionCurrent = 21, (function(t5) {
      var e2;
      (e2 = t5.OutputStateChange || (t5.OutputStateChange = {}))[e2.NoChange = 0] = "NoChange", e2[e2.ExtendedBeyondNewline = 1] = "ExtendedBeyondNewline", e2[e2.NewlineRemoved = 2] = "NewlineRemoved";
    })(ie || (ie = {}));
    re = class _re extends ct {
      get flowLevel() {
        return st.Story;
      }
      get hadError() {
        return this._hadError;
      }
      get hadWarning() {
        return this._hadWarning;
      }
      constructor(t5) {
        var e2;
        super(null, t5, null, false, arguments.length > 1 && void 0 !== arguments[1] && arguments[1]), e2 = this, this._errorHandler = null, this._hadError = false, this._hadWarning = false, this._dontFlattenContainers = /* @__PURE__ */ new Set(), this._listDefs = /* @__PURE__ */ new Map(), this.constants = /* @__PURE__ */ new Map(), this.externals = /* @__PURE__ */ new Map(), this.countAllVisits = false, this.ExportRuntime = function() {
          let t6 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : null;
          var n2, i2;
          e2._errorHandler = t6, e2.constants = /* @__PURE__ */ new Map();
          for (const t7 of e2.FindAll(rt)()) {
            const n3 = e2.constants.get(t7.constantName);
            if (n3 && !n3.Equals(t7.expression)) {
              const i3 = `CONST '${t7.constantName}' has been redefined with a different value. Multiple definitions of the same CONST are valid so long as they contain the same value. Initial definition was on ${n3.debugMetadata}.`;
              e2.Error(i3, t7, false);
            }
            e2.constants.set(t7.constantName, t7.expression);
          }
          e2._listDefs = /* @__PURE__ */ new Map();
          for (const t7 of e2.FindAll(Tt)()) (null === (n2 = t7.identifier) || void 0 === n2 ? void 0 : n2.name) && e2._listDefs.set(null === (i2 = t7.identifier) || void 0 === i2 ? void 0 : i2.name, t7);
          e2.externals = /* @__PURE__ */ new Map(), e2.ResolveWeavePointNaming();
          const r2 = e2.runtimeObject, s2 = new k();
          s2.AddContent(D.EvalStart());
          const a2 = [];
          for (const [t7, n3] of e2.variableDeclarations) if (n3.isGlobalDeclaration) {
            if (n3.listDefinition) e2._listDefs.set(t7, n3.listDefinition), s2.AddContent(n3.listDefinition.runtimeObject), a2.push(n3.listDefinition.runtimeListDefinition);
            else {
              if (!n3.expression) throw new Error();
              n3.expression.GenerateIntoContainer(s2);
            }
            const i3 = new z(t7, true);
            i3.isGlobal = true, s2.AddContent(i3);
          }
          s2.AddContent(D.EvalEnd()), s2.AddContent(D.End()), e2.variableDeclarations.size > 0 && (s2.name = "global decl", r2.AddToNamedContentOnly(s2)), r2.AddContent(D.Done());
          const o2 = new ie(r2, a2);
          return e2.runtimeObject = o2, e2.hadError ? null : (e2.FlattenContainersIn(r2), e2.ResolveReferences(e2), e2.hadError ? null : (o2.ResetState(), o2));
        }, this.ResolveList = (t6) => {
          let e3 = this._listDefs.get(t6);
          return e3 || null;
        }, this.ResolveListItem = function(t6, n2) {
          let i2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : null, r2 = null;
          if (t6) return (r2 = e2._listDefs.get(t6)) ? r2.ItemNamed(n2) : null;
          {
            let t7 = null, r3 = null;
            for (const [, s2] of e2._listDefs.entries()) {
              const a2 = s2.ItemNamed(n2);
              a2 && (t7 ? e2.Error(`Ambiguous item name '${n2}' found in multiple sets, including ${r3.identifier} and ${s2.identifier}`, i2, false) : (t7 = a2, r3 = s2));
            }
            return t7;
          }
        }, this.FlattenContainersIn = (t6) => {
          const e3 = /* @__PURE__ */ new Set();
          if (t6.content) for (const n2 of t6.content) {
            const t7 = r(n2, k);
            t7 && e3.add(t7);
          }
          if (t6.namedContent) for (const [, n2] of t6.namedContent) {
            const t7 = r(n2, k);
            t7 && e3.add(t7);
          }
          for (const t7 of e3) this.TryFlattenContainer(t7), this.FlattenContainersIn(t7);
        }, this.TryFlattenContainer = (t6) => {
          if (t6.namedContent && t6.namedContent.size > 0 || t6.hasValidName || this._dontFlattenContainers.has(t6)) return;
          const e3 = r(t6.parent, k);
          if (e3) {
            let n2 = e3.content.indexOf(t6);
            e3.content.splice(n2, 1);
            const i2 = t6.ownDebugMetadata;
            if (t6.content) for (const r2 of t6.content) r2.parent = null, null !== i2 && null === r2.ownDebugMetadata && (r2.debugMetadata = i2), e3.InsertContent(r2, n2), n2 += 1;
          }
        }, this.Error = (t6, e3, i2) => {
          let r2 = i2 ? n.Warning : n.Error, s2 = "";
          if (e3 instanceof d ? (s2 += "TODO: ", r2 = n.Author) : s2 += i2 ? "WARNING: " : "ERROR: ", e3 && null !== e3.debugMetadata && e3.debugMetadata.startLineNumber >= 1 && (null != e3.debugMetadata.fileName && (s2 += `'${e3.debugMetadata.fileName}' `), s2 += `line ${e3.debugMetadata.startLineNumber}: `), s2 += t6, t6 = s2, null === this._errorHandler) throw new Error(t6);
          this._errorHandler(t6, r2), this._hadError = r2 === n.Error, this._hadWarning = r2 === n.Warning;
        }, this.ResetError = () => {
          this._hadError = false, this._hadWarning = false;
        }, this.IsExternal = (t6) => this.externals.has(t6), this.AddExternal = (t6) => {
          this.externals.has(t6.name) ? this.Error(`Duplicate EXTERNAL definition of '${t6.name}'`, t6, false) : t6.name && this.externals.set(t6.name, t6);
        }, this.DontFlattenContainer = (t6) => {
          this._dontFlattenContainers.add(t6);
        }, this.NameConflictError = (t6, e3, n2, i2) => {
          t6.Error(`${i2} '${e3}': name has already been used for a ${n2.typeName.toLowerCase()} on ${n2.debugMetadata}`);
        }, this.CheckForNamingCollisions = function(t6, n2, i2) {
          var s2;
          const a2 = (arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : "") || t6.typeName;
          if (_re.IsReservedKeyword(null == n2 ? void 0 : n2.name)) return void t6.Error(`'${n2}' cannot be used for the name of a ${a2.toLowerCase()} because it's a reserved keyword`);
          if (ft.IsBuiltIn((null == n2 ? void 0 : n2.name) || "")) return void t6.Error(`'${n2}' cannot be used for the name of a ${a2.toLowerCase()} because it's a built in function`);
          const o2 = r(e2.ContentWithNameAtLevel((null == n2 ? void 0 : n2.name) || "", st.Knot), ct);
          if (o2 && (o2 !== t6 || i2 === J.Arg)) return void e2.NameConflictError(t6, (null == n2 ? void 0 : n2.name) || "", o2, a2);
          if (i2 < J.List) return;
          for (const [i3, r2] of e2._listDefs) if ((null == n2 ? void 0 : n2.name) === i3 && t6 !== r2 && r2.variableAssignment !== t6 && e2.NameConflictError(t6, null == n2 ? void 0 : n2.name, r2, a2), !(t6 instanceof Mt)) for (const i4 of r2.itemDefinitions) (null == n2 ? void 0 : n2.name) === i4.name && e2.NameConflictError(t6, (null == n2 ? void 0 : n2.name) || "", i4, a2);
          if (i2 <= J.Var) return;
          const l2 = (null == n2 ? void 0 : n2.name) && e2.variableDeclarations.get(null == n2 ? void 0 : n2.name) || null;
          if (l2 && l2 !== t6 && l2.isGlobalDeclaration && null == l2.listDefinition && e2.NameConflictError(t6, (null == n2 ? void 0 : n2.name) || "", l2, a2), i2 < J.SubFlowAndWeave) return;
          const h2 = new ot(n2).ResolveFromContext(t6);
          if (h2 && h2 !== t6) e2.NameConflictError(t6, (null == n2 ? void 0 : n2.name) || "", h2, a2);
          else if (!(i2 < J.Arg) && i2 !== J.Arg) {
            let e3 = r(t6, ct);
            if (e3 || (e3 = ht(t6)), e3 && e3.hasParameters && e3.args) {
              for (const i3 of e3.args) if ((null === (s2 = i3.identifier) || void 0 === s2 ? void 0 : s2.name) === (null == n2 ? void 0 : n2.name)) return void t6.Error(`${a2} '${n2}': name has already been used for a argument to ${e3.identifier} on ${e3.debugMetadata}`);
            }
          }
        };
      }
      get typeName() {
        return "Story";
      }
      PreProcessTopLevelObjects(t5) {
        super.PreProcessTopLevelObjects(t5);
        const e2 = [];
        for (let n2 of t5) if (n2 instanceof Lt) {
          const i2 = n2, r2 = t5.indexOf(n2);
          if (t5.splice(r2, 1), i2.includedStory) {
            const n3 = [], s2 = i2.includedStory;
            if (null != s2.content) {
              for (const t6 of s2.content) t6 instanceof ct ? e2.push(t6) : n3.push(t6);
              n3.push(new it("\n")), t5.splice(r2, 0, ...n3);
            }
          }
        } else ;
        t5.splice(0, 0, ...e2);
      }
    };
    re.IsReservedKeyword = (t5) => {
      switch (t5) {
        case "true":
        case "false":
        case "not":
        case "return":
        case "else":
        case "VAR":
        case "CONST":
        case "temp":
        case "LIST":
        case "function":
          return true;
      }
      return false;
    };
    se = class _se extends L {
      get isSingleString() {
        if (1 !== this.content.length) return false;
        return this.content[0] instanceof it;
      }
      constructor(t5) {
        super(), this.GenerateIntoContainer = (t6) => {
          t6.AddContent(D.BeginString());
          for (const e2 of this.content) t6.AddContent(e2.runtimeObject);
          t6.AddContent(D.EndString());
        }, this.toString = () => {
          let t6 = "";
          for (const e2 of this.content) t6 += e2;
          return t6;
        }, this.AddContent(t5);
      }
      get typeName() {
        return "String";
      }
      Equals(t5) {
        const e2 = r(t5, _se);
        if (null === e2) return false;
        if (!this.isSingleString || !e2.isSingleString) return false;
        return this.toString() === e2.toString();
      }
    };
    ae = class extends c {
      constructor(t5) {
        let e2 = arguments.length > 1 && void 0 !== arguments[1] && arguments[1];
        super(), this.GenerateRuntimeObject = () => this.isStart ? D.BeginTag() : D.EndTag(), this.toString = () => this.isStart ? "#StartTag" : "#EndTag", this.isStart = t5, this.inChoice = e2;
      }
      get typeName() {
        return "Tag";
      }
    };
    oe = class {
      constructor(t5) {
        this.rootPath = t5, this.ResolveInkFilename = () => {
          throw Error("Can't resolve filename because no FileHandler was provided when instantiating the parser / compiler.");
        }, this.LoadInkFileContents = () => {
          throw Error("Can't load ink content because no FileHandler was provided when instantiating the parser / compiler.");
        };
      }
    };
    le = class _le extends tt {
      get fileHandler() {
        if (!this._fileHandler) throw new Error("No FileHandler defined");
        return this._fileHandler;
      }
      set fileHandler(t5) {
        this._fileHandler = t5;
      }
      constructor(t5) {
        var e2;
        let s2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null, a2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : null, o2 = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : null, l2 = arguments.length > 4 && void 0 !== arguments[4] ? arguments[4] : null;
        if (super(t5), e2 = this, this.ParseStory = () => {
          const t6 = this.StatementsAtLevel(Gt.Top);
          return new re(t6, this._rootParser !== this);
        }, this.SeparatedList = (t6, e3) => {
          const n2 = this.Parse(t6);
          if (null === n2) return null;
          const i2 = [];
          for (i2.push(n2); ; ) {
            const n3 = this.BeginRule();
            if (null === e3()) {
              this.FailRule(n3);
              break;
            }
            const r2 = this.Parse(t6);
            if (null === r2) {
              this.FailRule(n3);
              break;
            }
            this.SucceedRule(n3), i2.push(r2);
          }
          return i2;
        }, this.CreateDebugMetadata = (t6, e3) => {
          const n2 = new It();
          return n2.startLineNumber = ((null == t6 ? void 0 : t6.lineIndex) || 0) + 1, n2.endLineNumber = e3.lineIndex + 1, n2.startCharacterNumber = ((null == t6 ? void 0 : t6.characterInLineIndex) || 0) + 1, n2.endCharacterNumber = e3.characterInLineIndex + 1, n2.fileName = this._filename, n2;
        }, this.RuleDidSucceed = (t6, e3, n2) => {
          const i2 = r(t6, c);
          i2 && (i2.debugMetadata = this.CreateDebugMetadata(e3, n2));
          const s3 = Array.isArray(t6) ? t6 : null;
          if (null !== s3) for (const t7 of s3) {
            r(t7, c) && (t7.hasOwnDebugMetadata || (t7.debugMetadata = this.CreateDebugMetadata(e3, n2)));
          }
          const a3 = r(t6, ut);
          null != a3 && (a3.debugMetadata = this.CreateDebugMetadata(e3, n2));
        }, this.OnStringParserError = function(t6, i2) {
          let r2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : 0, s3 = arguments.length > 3 && void 0 !== arguments[3] && arguments[3];
          let a3 = s3 ? "WARNING:" : "ERROR:";
          if (null !== e2._filename && (a3 += ` '${e2._filename}'`), a3 += ` line ${r2 + 1}: ${t6}`, null === e2._externalErrorHandler) throw new Error(a3);
          e2._externalErrorHandler(a3, s3 ? n.Warning : n.Error);
        }, this.AuthorWarning = () => {
          this.Whitespace();
          const t6 = this.Parse(this.IdentifierWithMetadata);
          if (null === t6 || "TODO" !== t6.name) return null;
          this.Whitespace(), this.ParseString(":"), this.Whitespace();
          const e3 = this.ParseUntilCharactersFromString("\n\r");
          return e3 ? new d(e3) : null;
        }, this.ExtendIdentifierCharacterRanges = (t6) => {
          const e3 = _le.ListAllCharacterRanges();
          for (const n2 of e3) t6.AddCharacters(n2.ToCharacterSet());
        }, this._parsingChoice = false, this.Choice = () => {
          let t6 = true, e3 = this.Interleave(this.OptionalExclude(this.Whitespace), this.String("*"));
          if (!e3) {
            if (e3 = this.Interleave(this.OptionalExclude(this.Whitespace), this.String("+")), null === e3) return null;
            t6 = false;
          }
          const n2 = this.Parse(this.BracketedName);
          this.Whitespace(), null != n2 && this.Newline();
          const i2 = this.Parse(this.ChoiceCondition);
          if (this.Whitespace(), this._parsingChoice) throw new Error("Already parsing a choice - shouldn't have nested choices");
          this._parsingChoice = true;
          let s3 = null;
          const a3 = this.Parse(this.MixedTextAndLogic);
          a3 && (s3 = new dt(a3));
          let o3 = null, l3 = null;
          const h2 = null !== this.ParseString("[");
          if (h2) {
            this.EndTagIfNecessary(s3);
            const t7 = this.Parse(this.MixedTextAndLogic);
            null !== t7 && (o3 = new dt(t7)), this.Expect(this.String("]"), "closing ']' for weave-style option"), this.EndTagIfNecessary(o3);
            let e4 = this.Parse(this.MixedTextAndLogic);
            null !== e4 && (l3 = new dt(e4));
          }
          this.Whitespace(), this.EndTagIfNecessary(null != l3 ? l3 : s3);
          const u2 = this.Parse(this.MultiDivert);
          this._parsingChoice = false, this.Whitespace();
          const c2 = !s3 && !l3 && !o3;
          if (c2 && null === u2 && this.Warning("Choice is completely empty. Interpretting as a default fallback choice. Add a divert arrow to remove this warning: * ->"), s3 || !h2 || o3 || this.Warning("Blank choice - if you intended a default fallback choice, use the `* ->` syntax"), l3 || (l3 = new dt()), this.EndTagIfNecessary(l3), null !== u2) for (const t7 of u2) {
            const e4 = r(t7, Ct);
            e4 && e4.isEmpty || l3.AddContent(t7);
          }
          l3.AddContent(new it("\n"));
          const d2 = new X(s3, o3, l3);
          return n2 && (d2.identifier = n2), d2.indentationDepth = e3.length, d2.hasWeaveStyleInlineBrackets = h2, d2.condition = i2, d2.onceOnly = t6, d2.isInvisibleDefault = c2, d2;
        }, this.ChoiceCondition = () => {
          const t6 = this.Interleave(this.ChoiceSingleCondition, this.ChoiceConditionsSpace);
          return null === t6 ? null : 1 === t6.length ? t6[0] : new gt(t6);
        }, this.ChoiceConditionsSpace = () => (this.Newline(), this.Whitespace(), Q), this.ChoiceSingleCondition = () => {
          if (null === this.ParseString("{")) return null;
          const t6 = this.Expect(this.Expression, "choice condition inside { }");
          return this.DisallowIncrement(t6), this.Expect(this.String("}"), "closing '}' for choice condition"), t6;
        }, this.Gather = () => {
          const t6 = this.Parse(this.GatherDashes);
          if (null === t6) return null;
          const e3 = Number(t6), n2 = this.Parse(this.BracketedName), i2 = new at(n2, e3);
          return this.Newline(), i2;
        }, this.GatherDashes = () => {
          this.Whitespace();
          let t6 = 0;
          for (; null !== this.ParseDashNotArrow(); ) t6 += 1, this.Whitespace();
          return 0 === t6 ? null : t6;
        }, this.ParseDashNotArrow = () => {
          const t6 = this.BeginRule();
          return null === this.ParseString("->") && "-" === this.ParseSingleCharacter() ? this.SucceedRule(t6) : this.FailRule(t6);
        }, this.BracketedName = () => {
          if (null === this.ParseString("(")) return null;
          this.Whitespace();
          const t6 = this.Parse(this.IdentifierWithMetadata);
          return null === t6 ? null : (this.Whitespace(), this.Expect(this.String(")"), "closing ')' for bracketed name"), t6);
        }, this.InnerConditionalContent = (t6) => {
          if (void 0 === t6) {
            const t7 = this.Parse(this.ConditionExpression), e4 = this.Parse((() => this.InnerConditionalContent(t7)));
            return null === e4 ? null : e4;
          }
          let e3;
          const n2 = null !== t6, i2 = null === this.Parse(this.Newline);
          if (i2 && !n2) return null;
          if (i2) e3 = this.InlineConditionalBranches();
          else {
            if (e3 = this.MultilineConditionalBranches(), null === e3) {
              if (t6) {
                let t7 = this.StatementsAtLevel(Gt.InnerBlock);
                if (null !== t7) {
                  e3 = [new Pt(t7)];
                  const n3 = this.Parse(this.SingleMultilineCondition);
                  n3 && (n3.isElse || (this.ErrorWithParsedObject("Expected an '- else:' clause here rather than an extra condition", n3), n3.isElse = true), e3.push(n3));
                }
              }
              if (null === e3) return null;
            } else if (1 === e3.length && e3[0].isElse && t6) {
              const t7 = new Pt(null);
              t7.isTrueBranch = true, e3.unshift(t7);
            }
            if (t6) {
              let t7 = false;
              for (let n3 = 0; n3 < e3.length; ++n3) {
                const i3 = e3[n3], r2 = n3 === e3.length - 1;
                i3.ownExpression ? (i3.matchingEquality = true, t7 = true) : t7 && r2 ? (i3.matchingEquality = true, i3.isElse = true) : !r2 && e3.length > 2 ? this.ErrorWithParsedObject("Only final branch can be an 'else'. Did you miss a ':'?", i3) : 0 === n3 ? i3.isTrueBranch = true : i3.isElse = true;
              }
            } else {
              for (let t7 = 0; t7 < e3.length; ++t7) {
                const n3 = e3[t7], i3 = t7 === e3.length - 1;
                if (null === n3.ownExpression) if (i3) n3.isElse = true;
                else if (n3.isElse) {
                  const t8 = e3[e3.length - 1];
                  t8.isElse ? this.ErrorWithParsedObject("Multiple 'else' cases. Can have a maximum of one, at the end.", t8) : this.ErrorWithParsedObject("'else' case in conditional should always be the final one", n3);
                } else this.ErrorWithParsedObject("Branch doesn't have condition. Are you missing a ':'? ", n3);
              }
              1 === e3.length && null === e3[0].ownExpression && this.ErrorWithParsedObject("Condition block with no conditions", e3[0]);
            }
          }
          if (null === e3) return null;
          for (const t7 of e3) t7.isInline = i2;
          return new nt(t6, e3);
        }, this.InlineConditionalBranches = () => {
          const t6 = this.Interleave(this.MixedTextAndLogic, this.Exclude(this.String("|")), null, false);
          if (null === t6 || 0 === t6.length) return null;
          const e3 = [];
          if (t6.length > 2) this.Error("Expected one or two alternatives separated by '|' in inline conditional");
          else {
            const n2 = new Pt(t6[0]);
            if (n2.isTrueBranch = true, e3.push(n2), t6.length > 1) {
              const n3 = new Pt(t6[1]);
              n3.isElse = true, e3.push(n3);
            }
          }
          return e3;
        }, this.MultilineConditionalBranches = () => {
          this.MultilineWhitespace();
          const t6 = this.OneOrMore(this.SingleMultilineCondition);
          return null === t6 ? null : (this.MultilineWhitespace(), t6);
        }, this.SingleMultilineCondition = () => {
          if (this.Whitespace(), null !== this.ParseString("->") || null === this.ParseString("-")) return null;
          this.Whitespace();
          let t6 = null;
          const e3 = null !== this.Parse(this.ElseExpression);
          e3 || (t6 = this.Parse(this.ConditionExpression));
          let n2 = this.StatementsAtLevel(Gt.InnerBlock);
          null === t6 && null === n2 && (this.Error("expected content for the conditional branch following '-'"), n2 = [new it("")]), this.MultilineWhitespace();
          const i2 = new Pt(n2);
          return i2.ownExpression = t6, i2.isElse = e3, i2;
        }, this.ConditionExpression = () => {
          const t6 = this.Parse(this.Expression);
          return null === t6 ? null : (this.DisallowIncrement(t6), this.Whitespace(), null === this.ParseString(":") ? null : t6);
        }, this.ElseExpression = () => null === this.ParseString("else") ? null : (this.Whitespace(), null === this.ParseString(":") ? null : Q), this._nonTextPauseCharacters = null, this._nonTextEndCharacters = null, this._notTextEndCharactersChoice = null, this._notTextEndCharactersString = null, this.TrimEndWhitespace = (t6, e3) => {
          if (t6.length > 0) {
            const n2 = t6.length - 1, i2 = t6[n2];
            if (i2 instanceof it) {
              const r2 = i2;
              r2.text = r2.text.replace(new RegExp(/[ \t]+$/g), ""), e3 ? r2.text += " " : 0 === r2.text.length && (t6.splice(n2, 1), this.TrimEndWhitespace(t6, false));
            }
          }
        }, this.LineOfMixedTextAndLogic = () => {
          this.Parse(this.Whitespace);
          let t6 = this.Parse(this.MixedTextAndLogic);
          if (!t6 || !t6.length) return null;
          const e3 = t6[0];
          if (e3 && e3.text && e3.text.startsWith("return") && this.Warning("Do you need a '~' before 'return'? If not, perhaps use a glue: <> (since it's lowercase) or rewrite somehow?"), 0 === t6.length) return null;
          return t6[t6.length - 1] instanceof Ct || this.TrimEndWhitespace(t6, false), this.EndTagIfNecessary(t6), t6.length > 0 && t6[0] instanceof ae && t6[0].isStart || t6.push(new it("\n")), this.Expect(this.EndOfLine, "end of line", this.SkipToNextLine), t6;
        }, this.MixedTextAndLogic = () => {
          null !== this.ParseObject(this.Spaced(this.String("~"))) && this.Error("You shouldn't use a '~' here - tildas are for logic that's on its own line. To do inline logic, use { curly braces } instead");
          let t6 = this.Interleave(this.Optional(this.ContentText), this.Optional(this.InlineLogicOrGlueOrStartTag));
          if (!this._parsingChoice) {
            const e3 = this.Parse(this.MultiDivert);
            null !== e3 && (null === t6 && (t6 = []), this.EndTagIfNecessary(t6), this.TrimEndWhitespace(t6, true), t6.push(...e3));
          }
          return t6 || null;
        }, this.ContentText = () => this.ContentTextAllowingEscapeChar(), this.ContentTextAllowingEscapeChar = () => {
          let t6 = null;
          for (; ; ) {
            let e3 = this.Parse(this.ContentTextNoEscape);
            const n2 = null !== this.ParseString("\\");
            if (!n2 && null === e3) break;
            if (null === t6 && (t6 = ""), null !== e3 && (t6 += String(e3)), n2) {
              t6 += this.ParseSingleCharacter();
            }
          }
          return null !== t6 ? new it(t6) : null;
        }, this.ContentTextNoEscape = () => {
          null === this._nonTextPauseCharacters && (this._nonTextPauseCharacters = new $("-<")), null === this._nonTextEndCharacters && (this._nonTextEndCharacters = new $("{}|\n\r\\#"), this._notTextEndCharactersChoice = new $(this._nonTextEndCharacters), this._notTextEndCharactersChoice.AddCharacters("[]"), this._notTextEndCharactersString = new $(this._nonTextEndCharacters), this._notTextEndCharactersString.AddCharacters('"'));
          let t6 = null;
          t6 = this.parsingStringExpression ? this._notTextEndCharactersString : this._parsingChoice ? this._notTextEndCharactersChoice : this._nonTextEndCharacters;
          const e3 = this.ParseUntil((() => this.OneOf([this.ParseDivertArrow, this.ParseThreadArrow, this.EndOfLine, this.Glue])), this._nonTextPauseCharacters, t6);
          return null !== e3 ? e3 : null;
        }, this.MultiDivert = () => {
          this.Whitespace();
          let t6 = [];
          const e3 = this.Parse(this.StartThread);
          if (e3) return t6 = [e3], t6;
          const n2 = this.Interleave(this.ParseDivertArrowOrTunnelOnwards, this.DivertIdentifierWithArguments);
          if (!n2) return null;
          t6 = [], this.EndTagIfNecessary(t6);
          for (let e4 = 0; e4 < n2.length; ++e4) {
            if (e4 % 2 == 0) {
              if ("->->" === n2[e4]) {
                0 === e4 || e4 === n2.length - 1 || e4 === n2.length - 2 || this.Error("Tunnel onwards '->->' must only come at the begining or the start of a divert");
                const i2 = new Et();
                if (e4 < n2.length - 1) {
                  const t7 = r(n2[e4 + 1], Ct);
                  i2.divertAfter = t7;
                }
                t6.push(i2);
                break;
              }
            } else {
              const i2 = n2[e4];
              e4 < n2.length - 1 && (i2.isTunnel = true), t6.push(i2);
            }
          }
          if (0 === t6.length && 1 === n2.length) {
            const e4 = new Ct(null);
            e4.isEmpty = true, t6.push(e4), this._parsingChoice || this.Error("Empty diverts (->) are only valid on choices");
          }
          return t6;
        }, this.StartThread = () => {
          if (this.Whitespace(), null === this.ParseThreadArrow()) return null;
          this.Whitespace();
          const t6 = this.Expect(this.DivertIdentifierWithArguments, "target for new thread", (() => new Ct(null)));
          return t6.isThread = true, t6;
        }, this.DivertIdentifierWithArguments = () => {
          this.Whitespace();
          const t6 = this.Parse(this.DotSeparatedDivertPathComponents);
          if (!t6) return null;
          this.Whitespace();
          const e3 = this.Parse(this.ExpressionFunctionCallArguments);
          this.Whitespace();
          const n2 = new ot(t6);
          return new Ct(n2, e3);
        }, this.SingleDivert = () => {
          const t6 = this.Parse(this.MultiDivert);
          if (!t6) return null;
          if (1 !== t6.length) return null;
          if (t6[0] instanceof Et) return null;
          const e3 = t6[0];
          return e3.isTunnel ? null : e3;
        }, this.DotSeparatedDivertPathComponents = () => this.Interleave(this.Spaced(this.IdentifierWithMetadata), this.Exclude(this.String("."))), this.ParseDivertArrowOrTunnelOnwards = () => {
          let t6 = 0;
          for (; null !== this.ParseString("->"); ) t6 += 1;
          return 0 === t6 ? null : 1 === t6 ? "->" : (2 === t6 || this.Error("Unexpected number of arrows in divert. Should only have '->' or '->->'"), "->->");
        }, this.ParseDivertArrow = () => this.ParseString("->"), this.ParseThreadArrow = () => this.ParseString("<-"), this._binaryOperators = [], this._maxBinaryOpLength = 0, this.TempDeclarationOrAssignment = () => {
          this.Whitespace();
          const t6 = this.ParseTempKeyword();
          this.Whitespace();
          let e3 = null;
          if (e3 = t6 ? this.Expect(this.IdentifierWithMetadata, "variable name") : this.Parse(this.IdentifierWithMetadata), null === e3) return null;
          this.Whitespace();
          const n2 = null !== this.ParseString("+"), i2 = null !== this.ParseString("-");
          if (n2 && i2 && this.Error("Unexpected sequence '+-'"), null === this.ParseString("=")) return t6 && this.Error("Expected '='"), null;
          const r2 = this.Expect(this.Expression, "value expression to be assigned");
          if (n2 || i2) {
            return new Dt(e3, r2, n2);
          }
          return new xt({ variableIdentifier: e3, assignedExpression: r2, isTemporaryNewDeclaration: t6 });
        }, this.DisallowIncrement = (t6) => {
          t6 instanceof Dt && this.Error("Can't use increment/decrement here. It can only be used on a ~ line");
        }, this.ParseTempKeyword = () => {
          const t6 = this.BeginRule();
          return "temp" === this.Parse(this.Identifier) ? (this.SucceedRule(t6), true) : (this.FailRule(t6), false);
        }, this.ReturnStatement = () => {
          this.Whitespace();
          if ("return" !== this.Parse(this.Identifier)) return null;
          this.Whitespace();
          const t6 = this.Parse(this.Expression);
          return new lt(t6);
        }, this.Expression = function() {
          let t6 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : 0;
          e2.Whitespace();
          let n2 = e2.ExpressionUnary();
          if (null === n2) return null;
          for (e2.Whitespace(); ; ) {
            const i2 = e2.BeginRule(), r2 = e2.ParseInfixOperator();
            if (!(null !== r2 && r2.precedence > t6)) {
              e2.FailRule(i2);
              break;
            }
            {
              const t7 = `right side of '${r2.type}' expression`, s3 = e2.Expect((() => e2.ExpressionInfixRight(n2, r2)), t7);
              if (null === s3) return e2.FailRule(i2), null;
              n2 = e2.SucceedRule(i2, s3);
            }
          }
          return e2.Whitespace(), n2;
        }, this.ExpressionUnary = () => {
          const t6 = this.Parse(this.ExpressionDivertTarget);
          if (null !== t6) return t6;
          let e3 = this.OneOf([this.String("-"), this.String("!")]);
          null === e3 && (e3 = this.Parse(this.ExpressionNot)), this.Whitespace();
          let n2 = this.OneOf([this.ExpressionList, this.ExpressionParen, this.ExpressionFunctionCall, this.ExpressionVariableName, this.ExpressionLiteral]);
          if (null === n2 && null !== e3 && (n2 = this.ExpressionUnary()), null === n2) return null;
          null !== e3 && (n2 = M.WithInner(n2, e3)), this.Whitespace();
          const i2 = this.OneOf([this.String("++"), this.String("--")]);
          if (null !== i2) {
            const t7 = "++" === i2;
            if (n2 instanceof mt) {
              n2 = new Dt(n2.identifier, t7);
            } else this.Error(`can only increment and decrement variables, but saw '${n2}'.`);
          }
          return n2;
        }, this.ExpressionNot = () => {
          const t6 = this.Identifier();
          return "not" === t6 ? t6 : null;
        }, this.ExpressionLiteral = () => this.OneOf([this.ExpressionFloat, this.ExpressionInt, this.ExpressionBool, this.ExpressionString]), this.ExpressionDivertTarget = () => {
          this.Whitespace();
          const t6 = this.Parse(this.SingleDivert);
          return !t6 || t6 && t6.isThread ? null : (this.Whitespace(), new vt(t6));
        }, this.ExpressionInt = () => {
          const t6 = this.ParseInt();
          return null === t6 ? null : new B(t6, "int");
        }, this.ExpressionFloat = () => {
          const t6 = this.ParseFloat();
          return null === t6 ? null : new B(t6, "float");
        }, this.ExpressionString = () => {
          if (null === this.ParseString('"')) return null;
          this.parsingStringExpression = true;
          let t6 = this.Parse(this.MixedTextAndLogic);
          return this.Expect(this.String('"'), "close quote for string expression"), this.parsingStringExpression = false, null === t6 ? t6 = [new it("")] : t6.find(((t7) => t7 instanceof Ct)) && this.Error("String expressions cannot contain diverts (->)"), new se(t6);
        }, this.ExpressionBool = () => {
          const t6 = this.Parse(this.Identifier);
          return "true" === t6 ? new B(true, "bool") : "false" === t6 ? new B(false, "bool") : null;
        }, this.ExpressionFunctionCall = () => {
          const t6 = this.Parse(this.IdentifierWithMetadata);
          if (null === t6) return null;
          this.Whitespace();
          const e3 = this.Parse(this.ExpressionFunctionCallArguments);
          return null === e3 ? null : new ft(t6, e3);
        }, this.ExpressionFunctionCallArguments = () => {
          if (null === this.ParseString("(")) return null;
          const t6 = this.Exclude(this.String(","));
          let e3 = this.Interleave(this.Expression, t6);
          return null === e3 && (e3 = []), this.Whitespace(), this.Expect(this.String(")"), "closing ')' for function call"), e3;
        }, this.ExpressionVariableName = () => {
          const t6 = this.Interleave(this.IdentifierWithMetadata, this.Exclude(this.Spaced(this.String("."))));
          return null === t6 || re.IsReservedKeyword(t6[0].name) ? null : new mt(t6);
        }, this.ExpressionParen = () => {
          if (null === this.ParseString("(")) return null;
          const t6 = this.Parse(this.Expression);
          return null === t6 ? null : (this.Whitespace(), this.Expect(this.String(")"), "closing parenthesis ')' for expression"), t6);
        }, this.ExpressionInfixRight = (t6, e3) => {
          if (!t6) return null;
          this.Whitespace();
          const n2 = this.Parse((() => this.Expression(e3.precedence)));
          if (n2) {
            return new G(t6, n2, e3.type);
          }
          return null;
        }, this.ParseInfixOperator = () => {
          for (const t6 of this._binaryOperators) {
            const e3 = this.BeginRule();
            if (null !== this.ParseString(t6.type)) {
              if (t6.requireWhitespace && null === this.Whitespace()) {
                this.FailRule(e3);
                continue;
              }
              return this.SucceedRule(e3, t6);
            }
            this.FailRule(e3);
          }
          return null;
        }, this.ExpressionList = () => {
          if (this.Whitespace(), null === this.ParseString("(")) return null;
          this.Whitespace();
          const t6 = this.SeparatedList(this.ListMember, this.Spaced(this.String(",")));
          return this.Whitespace(), null === this.ParseString(")") ? null : new Bt(t6);
        }, this.ListMember = () => {
          this.Whitespace();
          let t6 = this.Parse(this.IdentifierWithMetadata);
          if (null === t6) return null;
          if (null !== this.ParseString(".")) {
            const e3 = this.Expect(this.IdentifierWithMetadata, `element name within the set ${t6}`);
            t6.name += `.${null == e3 ? void 0 : e3.name}`;
          }
          return this.Whitespace(), t6;
        }, this.RegisterExpressionOperators = () => {
          this.RegisterBinaryOperator("&&", 1), this.RegisterBinaryOperator("||", 1), this.RegisterBinaryOperator("and", 1, true), this.RegisterBinaryOperator("or", 1, true), this.RegisterBinaryOperator("==", 2), this.RegisterBinaryOperator(">=", 2), this.RegisterBinaryOperator("<=", 2), this.RegisterBinaryOperator("<", 2), this.RegisterBinaryOperator(">", 2), this.RegisterBinaryOperator("!=", 2), this.RegisterBinaryOperator("?", 3), this.RegisterBinaryOperator("has", 3, true), this.RegisterBinaryOperator("!?", 3), this.RegisterBinaryOperator("hasnt", 3, true), this.RegisterBinaryOperator("^", 3), this.RegisterBinaryOperator("+", 4), this.RegisterBinaryOperator("-", 5), this.RegisterBinaryOperator("*", 6), this.RegisterBinaryOperator("/", 7), this.RegisterBinaryOperator("%", 8), this.RegisterBinaryOperator("mod", 8, true);
        }, this.RegisterBinaryOperator = function(t6, n2) {
          const i2 = new Vt(t6, n2, arguments.length > 2 && void 0 !== arguments[2] && arguments[2]);
          e2._binaryOperators.push(i2), e2._maxBinaryOpLength = Math.max(e2._maxBinaryOpLength, t6.length);
        }, this._openFilenames = [], this.IncludeStatement = () => {
          if (this.Whitespace(), null === this.ParseString("INCLUDE")) return null;
          this.Whitespace();
          let t6 = this.Expect((() => this.ParseUntilCharactersFromString("\n\r")), "filename for include statement");
          t6 = t6.replace(new RegExp(/[ \t]+$/g), "");
          const e3 = this.fileHandler.ResolveInkFilename(t6, this._filename);
          if (this.FilenameIsAlreadyOpen(e3)) return this.Error(`Recursive INCLUDE detected: '${e3}' is already open.`), this.ParseUntilCharactersFromString("\r\n"), new Lt(null);
          this.AddOpenFilename(e3);
          let n2 = null, i2 = "";
          try {
            i2 = this._rootParser.fileHandler.LoadInkFileContents(e3, this._filename);
          } catch (e4) {
            this.Error(`Failed to load: '${t6}'.
Error:${e4}`);
          }
          if (null != i2) {
            n2 = new _le(i2, t6, this._externalErrorHandler, this._rootParser, this.fileHandler).ParseStory();
          }
          return this.RemoveOpenFilename(e3), new Lt(n2);
        }, this.FilenameIsAlreadyOpen = (t6) => this._rootParser._openFilenames.includes(t6), this.AddOpenFilename = (t6) => {
          this._rootParser._openFilenames.push(t6);
        }, this.RemoveOpenFilename = (t6) => {
          this._rootParser._openFilenames.splice(this._rootParser._openFilenames.indexOf(t6), 1);
        }, this.KnotDefinition = () => {
          const t6 = this.Parse(this.KnotDeclaration);
          if (null === t6) return null;
          this.Expect(this.EndOfLine, "end of line after knot name definition", this.SkipToNextLine);
          const e3 = this.Expect((() => this.StatementsAtLevel(Gt.Knot)), "at least one line within the knot", this.KnotStitchNoContentRecoveryRule);
          return new jt(t6.name, e3, t6.args, t6.isFunction);
        }, this.KnotDeclaration = () => {
          if (this.Whitespace(), null === this.KnotTitleEquals()) return null;
          this.Whitespace();
          const t6 = this.Parse(this.IdentifierWithMetadata);
          let e3;
          const n2 = "function" === (null == t6 ? void 0 : t6.name);
          n2 ? (this.Expect(this.Whitespace, "whitespace after the 'function' keyword"), e3 = this.Parse(this.IdentifierWithMetadata)) : e3 = t6, null === e3 && (this.Error("Expected the name of the " + (n2 ? "function" : "knot")), e3 = new ut("")), this.Whitespace();
          const i2 = this.Parse(this.BracketedKnotDeclArguments);
          return this.Whitespace(), this.Parse(this.KnotTitleEquals), new Ft(e3, i2, n2);
        }, this.KnotTitleEquals = () => {
          const t6 = this.ParseCharactersFromString("=");
          return null === t6 || t6.length <= 1 ? null : t6;
        }, this.StitchDefinition = () => {
          const t6 = this.Parse(this.StitchDeclaration);
          if (null === t6) return null;
          this.Expect(this.EndOfLine, "end of line after stitch name", this.SkipToNextLine);
          const e3 = this.Expect((() => this.StatementsAtLevel(Gt.Stitch)), "at least one line within the stitch", this.KnotStitchNoContentRecoveryRule);
          return new $t(t6.name, e3, t6.args, t6.isFunction);
        }, this.StitchDeclaration = () => {
          if (this.Whitespace(), null === this.ParseString("=")) return null;
          if (null !== this.ParseString("=")) return null;
          this.Whitespace();
          const t6 = null !== this.ParseString("function");
          t6 && this.Whitespace();
          const e3 = this.Parse(this.IdentifierWithMetadata);
          if (null === e3) return null;
          this.Whitespace();
          const n2 = this.Parse(this.BracketedKnotDeclArguments);
          return this.Whitespace(), new Ft(e3, n2, t6);
        }, this.KnotStitchNoContentRecoveryRule = () => {
          this.ParseUntil(this.KnotDeclaration, new $("="), null);
          return [new it("<ERROR IN FLOW>")];
        }, this.BracketedKnotDeclArguments = () => {
          if (null === this.ParseString("(")) return null;
          let t6 = this.Interleave(this.Spaced(this.FlowDeclArgument), this.Exclude(this.String(",")));
          return this.Expect(this.String(")"), "closing ')' for parameter list"), null === t6 && (t6 = []), t6;
        }, this.FlowDeclArgument = () => {
          const t6 = this.Parse(this.IdentifierWithMetadata);
          this.Whitespace();
          const e3 = this.ParseDivertArrow();
          this.Whitespace();
          const n2 = this.Parse(this.IdentifierWithMetadata);
          if (null == t6 && null === n2) return null;
          const r2 = new i();
          return null !== e3 && (r2.isDivertTarget = true), null !== t6 && "ref" === t6.name ? (null === n2 && this.Error("Expected an parameter name after 'ref'"), r2.identifier = n2, r2.isByReference = true) : (r2.isDivertTarget ? r2.identifier = n2 : r2.identifier = t6, null === r2.identifier && this.Error("Expected an parameter name"), r2.isByReference = false), r2;
        }, this.ExternalDeclaration = () => {
          this.Whitespace();
          const t6 = this.Parse(this.IdentifierWithMetadata);
          if (null === t6 || "EXTERNAL" != t6.name) return null;
          this.Whitespace();
          const e3 = this.Expect(this.IdentifierWithMetadata, "name of external function") || new ut("");
          this.Whitespace();
          let n2 = this.Expect(this.BracketedKnotDeclArguments, `declaration of arguments for EXTERNAL, even if empty, i.e. 'EXTERNAL ${e3}()'`);
          null === n2 && (n2 = []);
          const i2 = n2.map(((t7) => {
            var e4;
            return null === (e4 = t7.identifier) || void 0 === e4 ? void 0 : e4.name;
          })).filter(u);
          return new Ot(e3, i2);
        }, this._identifierCharSet = null, this.LogicLine = () => {
          if (this.Whitespace(), null === this.ParseString("~")) return null;
          this.Whitespace();
          let t6 = this.Expect((() => this.OneOf([this.ReturnStatement, this.TempDeclarationOrAssignment, this.Expression])), "expression after '~'", this.SkipToNextLine);
          if (null === t6) return new dt();
          t6 instanceof L && !(t6 instanceof ft || t6 instanceof Dt) && this.Error("Logic following a '~' can't be that type of expression. It can only be something like:\n	~ return\n	~ var x = blah\n	~ x++\n	~ myFunction()");
          const e3 = r(t6, ft);
          return e3 && (e3.shouldPopReturnedValue = true), null !== t6.Find(ft)() && (t6 = new dt(t6, new it("\n"))), this.Expect(this.EndOfLine, "end of line", this.SkipToNextLine), t6;
        }, this.VariableDeclaration = () => {
          this.Whitespace();
          if ("VAR" !== this.Parse(this.Identifier)) return null;
          this.Whitespace();
          const t6 = this.Expect(this.IdentifierWithMetadata, "variable name");
          this.Whitespace(), this.Expect(this.String("="), "the '=' for an assignment of a value, e.g. '= 5' (initial values are mandatory)"), this.Whitespace();
          const e3 = this.Expect(this.Expression, "initial value for ");
          if (e3) {
            if (e3 instanceof B || e3 instanceof se || e3 instanceof vt || e3 instanceof mt || e3 instanceof Bt || this.Error("initial value for a variable must be a number, constant, list or divert target"), null !== this.Parse(this.ListElementDefinitionSeparator)) this.Error("Unexpected ','. If you're trying to declare a new list, use the LIST keyword, not VAR");
            else if (e3 instanceof se) {
              e3.isSingleString || this.Error("Constant strings cannot contain any logic.");
            }
            return new xt({ assignedExpression: e3, isGlobalDeclaration: true, variableIdentifier: t6 });
          }
          return null;
        }, this.ListDeclaration = () => {
          this.Whitespace();
          if ("LIST" != this.Parse(this.Identifier)) return null;
          this.Whitespace();
          const t6 = this.Expect(this.IdentifierWithMetadata, "list name");
          this.Whitespace(), this.Expect(this.String("="), "the '=' for an assignment of the list definition"), this.Whitespace();
          const e3 = this.Expect(this.ListDefinition, "list item names");
          return e3 ? (e3.identifier = new ut(t6.name), new xt({ variableIdentifier: t6, listDef: e3 })) : null;
        }, this.ListDefinition = () => {
          this.AnyWhitespace();
          const t6 = this.SeparatedList(this.ListElementDefinition, this.ListElementDefinitionSeparator);
          return null === t6 ? null : new Tt(t6);
        }, this.ListElementDefinitionSeparator = () => (this.AnyWhitespace(), null === this.ParseString(",") ? null : (this.AnyWhitespace(), ",")), this.ListElementDefinition = () => {
          const t6 = null !== this.ParseString("(");
          let e3 = t6;
          this.Whitespace();
          const n2 = this.Parse(this.IdentifierWithMetadata);
          if (null === n2) return null;
          this.Whitespace(), t6 && null != this.ParseString(")") && (e3 = false, this.Whitespace());
          let i2 = null;
          if (null !== this.ParseString("=")) {
            this.Whitespace();
            const t7 = this.Expect(this.ExpressionInt, "value to be assigned to list item");
            null !== t7 && (i2 = t7.value), e3 && (this.Whitespace(), null !== this.ParseString(")") && (e3 = false));
          }
          return e3 && this.Error("Expected closing ')'"), new Mt(n2, t6, i2);
        }, this.ConstDeclaration = () => {
          this.Whitespace();
          if ("CONST" !== this.Parse(this.Identifier)) return null;
          this.Whitespace();
          const t6 = this.Expect(this.IdentifierWithMetadata, "constant name");
          this.Whitespace(), this.Expect(this.String("="), "the '=' for an assignment of a value, e.g. '= 5' (initial values are mandatory)"), this.Whitespace();
          const e3 = this.Expect(this.Expression, "initial value for ");
          if (e3 instanceof B || e3 instanceof vt || e3 instanceof se) {
            if (e3 instanceof se) {
              e3.isSingleString || this.Error("Constant strings cannot contain any logic.");
            }
          } else this.Error("initial value for a constant must be a number or divert target");
          return new rt(t6, e3);
        }, this.InlineLogicOrGlueOrStartTag = () => this.OneOf([this.InlineLogic, this.Glue, this.StartTag]), this.Glue = () => null !== this.ParseString("<>") ? new Rt(new kt()) : null, this.InlineLogic = () => {
          if (null === this.ParseString("{")) return null;
          let t6 = this.parsingStringExpression, e3 = this.tagActive;
          this.Whitespace();
          const n2 = this.Expect(this.InnerLogic, "some kind of logic, conditional or sequence within braces: { ... }");
          if (null === n2) return this.parsingStringExpression = t6, null;
          this.DisallowIncrement(n2);
          let i2 = r(n2, dt);
          return i2 || (i2 = new dt(n2)), this.Whitespace(), this.Expect(this.String("}"), "closing brace '}' for inline logic"), this.parsingStringExpression = t6, e3 || this.EndTagIfNecessary(i2), i2;
        }, this.InnerLogic = () => {
          this.Whitespace();
          const t6 = this.ParseObject(this.SequenceTypeAnnotation);
          if (null !== t6) {
            const e4 = this.Expect(this.InnerSequenceObjects, "sequence elements (for cycle/stoping etc)");
            return null === e4 ? null : new wt(e4, t6);
          }
          const e3 = this.Parse(this.ConditionExpression);
          if (e3) {
            return this.Expect((() => this.InnerConditionalContent(e3)), "conditional content following query");
          }
          const n2 = [this.InnerConditionalContent, this.InnerSequence, this.InnerExpression];
          for (const t7 of n2) {
            const e4 = this.BeginRule(), n3 = this.ParseObject(t7);
            if (n3) {
              if (null !== this.Peek(this.Spaced(this.String("}")))) return this.SucceedRule(e4, n3);
              this.FailRule(e4);
            } else this.FailRule(e4);
          }
          return null;
        }, this.InnerExpression = () => {
          const t6 = this.Parse(this.Expression);
          return t6 && (t6.outputWhenComplete = true), t6;
        }, this.IdentifierWithMetadata = () => {
          const t6 = this.Identifier();
          return null === t6 ? null : new ut(t6);
        }, this.Identifier = () => {
          const t6 = this.ParseCharactersFromCharSet(this.identifierCharSet);
          if (null === t6) return null;
          let e3 = true;
          for (let n2 of t6) if (!(n2 >= "0" && n2 <= "9")) {
            e3 = false;
            break;
          }
          return e3 ? null : t6;
        }, this._sequenceTypeSymbols = new $("!&~$"), this.InnerSequence = () => {
          this.Whitespace();
          let t6 = bt.Stopping;
          const e3 = this.Parse(this.SequenceTypeAnnotation);
          null !== e3 && (t6 = e3);
          const n2 = this.Parse(this.InnerSequenceObjects);
          return null === n2 || n2.length <= 1 ? null : new wt(n2, t6);
        }, this.SequenceTypeAnnotation = () => {
          let t6 = this.Parse(this.SequenceTypeSymbolAnnotation);
          if (null === t6 && (t6 = this.Parse(this.SequenceTypeWordAnnotation)), null === t6) return null;
          switch (t6) {
            case bt.Once:
            case bt.Cycle:
            case bt.Stopping:
            case bt.Shuffle:
            case bt.Shuffle | bt.Stopping:
            case bt.Shuffle | bt.Once:
              break;
            default:
              return this.Error(`Sequence type combination not supported: ${t6}`), bt.Stopping;
          }
          return t6;
        }, this.SequenceTypeSymbolAnnotation = () => {
          null === this._sequenceTypeSymbols && (this._sequenceTypeSymbols = new $("!&~$ "));
          let t6 = 0;
          const e3 = this.ParseCharactersFromCharSet(this._sequenceTypeSymbols);
          if (null === e3) return null;
          for (const n2 of e3) switch (n2) {
            case "!":
              t6 |= bt.Once;
              break;
            case "&":
              t6 |= bt.Cycle;
              break;
            case "~":
              t6 |= bt.Shuffle;
              break;
            case "$":
              t6 |= bt.Stopping;
          }
          return 0 === t6 ? null : t6;
        }, this.SequenceTypeWordAnnotation = () => {
          const t6 = this.Interleave(this.SequenceTypeSingleWord, this.Exclude(this.Whitespace));
          if (null === t6 || 0 === t6.length) return null;
          if (null === this.ParseString(":")) return null;
          let e3 = 0;
          for (const n2 of t6) e3 |= n2;
          return e3;
        }, this.SequenceTypeSingleWord = () => {
          let t6 = null;
          const e3 = this.Parse(this.IdentifierWithMetadata);
          if (null !== e3) switch (e3.name) {
            case "once":
              t6 = bt.Once;
              break;
            case "cycle":
              t6 = bt.Cycle;
              break;
            case "shuffle":
              t6 = bt.Shuffle;
              break;
            case "stopping":
              t6 = bt.Stopping;
          }
          return null === t6 ? null : t6;
        }, this.InnerSequenceObjects = () => {
          let t6 = null;
          return t6 = null !== this.Parse(this.Newline) ? this.Parse(this.InnerMultilineSequenceObjects) : this.Parse(this.InnerInlineSequenceObjects), t6;
        }, this.InnerInlineSequenceObjects = () => {
          const t6 = this.Interleave(this.Optional(this.MixedTextAndLogic), this.String("|"), null, false);
          if (null === t6) return null;
          const e3 = [];
          let n2 = false;
          for (const i2 of t6) if ("|" === i2) n2 || e3.push(new dt()), n2 = false;
          else {
            const t7 = i2;
            null === t7 ? this.Error(`Expected content, but got ${i2} (this is an ink compiler bug!)`) : e3.push(new dt(t7)), n2 = true;
          }
          return n2 || e3.push(new dt()), e3;
        }, this.InnerMultilineSequenceObjects = () => {
          this.MultilineWhitespace();
          const t6 = this.OneOrMore(this.SingleMultilineSequenceElement);
          return null === t6 ? null : t6;
        }, this.SingleMultilineSequenceElement = () => {
          if (this.Whitespace(), null !== this.ParseString("->")) return null;
          if (null === this.ParseString("-")) return null;
          this.Whitespace();
          const t6 = this.StatementsAtLevel(Gt.InnerBlock);
          return null === t6 ? this.MultilineWhitespace() : t6.unshift(new it("\n")), new dt(t6);
        }, this._statementRulesAtLevel = [], this._statementBreakRulesAtLevel = [], this.StatementsAtLevel = (t6) => {
          if (t6 === Gt.InnerBlock) {
            null !== this.Parse(this.GatherDashes) && this.Error("You can't use a gather (the dashes) within the { curly braces } context. For multi-line sequences and conditions, you should only use one dash.");
          }
          return this.Interleave(this.Optional(this.MultilineWhitespace), (() => this.StatementAtLevel(t6)), (() => this.StatementsBreakForLevel(t6)));
        }, this.StatementAtLevel = (t6) => {
          const e3 = this._statementRulesAtLevel[t6], n2 = this.OneOf(e3);
          return t6 === Gt.Top && n2 instanceof lt && this.Error("should not have return statement outside of a knot"), n2;
        }, this.StatementsBreakForLevel = (t6) => {
          this.Whitespace();
          const e3 = this._statementBreakRulesAtLevel[t6], n2 = this.OneOf(e3);
          return null === n2 ? null : n2;
        }, this.GenerateStatementLevelRules = () => {
          const t6 = Object.values(Gt);
          this._statementRulesAtLevel = "f".repeat(t6.length).split("f").map((() => [])), this._statementBreakRulesAtLevel = "f".repeat(t6.length).split("f").map((() => []));
          for (const e3 of t6) {
            const t7 = [], n2 = [];
            t7.push(this.Line(this.MultiDivert)), e3 >= Gt.Top && t7.push(this.KnotDefinition), t7.push(this.Line(this.Choice)), t7.push(this.Line(this.AuthorWarning)), e3 > Gt.InnerBlock && t7.push(this.Gather), e3 >= Gt.Knot && t7.push(this.StitchDefinition), t7.push(this.Line(this.ListDeclaration)), t7.push(this.Line(this.VariableDeclaration)), t7.push(this.Line(this.ConstDeclaration)), t7.push(this.Line(this.ExternalDeclaration)), t7.push(this.Line(this.IncludeStatement)), t7.push(this.LogicLine), t7.push(this.LineOfMixedTextAndLogic), e3 <= Gt.Knot && n2.push(this.KnotDeclaration), e3 <= Gt.Stitch && n2.push(this.StitchDeclaration), e3 <= Gt.InnerBlock && (n2.push(this.ParseDashNotArrow), n2.push(this.String("}"))), this._statementRulesAtLevel[e3] = t7, this._statementBreakRulesAtLevel[e3] = n2;
          }
        }, this.SkipToNextLine = () => (this.ParseUntilCharactersFromString("\n\r"), this.ParseNewline(), Q), this.Line = (t6) => () => {
          const e3 = this.ParseObject(t6);
          return null === e3 ? null : (this.Expect(this.EndOfLine, "end of line", this.SkipToNextLine), e3);
        }, this.StartTag = () => {
          if (this.Whitespace(), null === this.ParseString("#")) return null;
          this.parsingStringExpression && this.Error("Tags aren't allowed inside of strings. Please use \\# if you want a hash symbol.");
          let t6 = null;
          if (this.tagActive) {
            let e3 = new dt();
            e3.AddContent(new ae(false)), e3.AddContent(new ae(true)), t6 = e3;
          } else t6 = new ae(true);
          return this.tagActive = true, this.Whitespace(), t6;
        }, this._inlineWhitespaceChars = new $(" 	"), this.EndOfLine = () => this.OneOf([this.Newline, this.EndOfFile]), this.Newline = () => {
          this.Whitespace();
          return null !== this.ParseNewline() ? Q : null;
        }, this.EndOfFile = () => (this.Whitespace(), this.endOfInput ? Q : null), this.MultilineWhitespace = () => {
          let t6 = this.OneOrMore(this.Newline);
          if (null === t6) return null;
          return t6.length >= 1 ? Q : null;
        }, this.Whitespace = () => null !== this.ParseCharactersFromCharSet(this._inlineWhitespaceChars) ? Q : null, this.Spaced = (t6) => () => {
          this.Whitespace();
          const e3 = this.ParseObject(t6);
          return null === e3 ? null : (this.Whitespace(), e3);
        }, this.AnyWhitespace = () => {
          let t6 = false;
          for (; null !== this.OneOf([this.Whitespace, this.MultilineWhitespace]); ) t6 = true;
          return t6 ? Q : null;
        }, this.MultiSpaced = (t6) => () => {
          this.AnyWhitespace();
          const e3 = this.ParseObject(t6);
          return null === e3 ? null : (this.AnyWhitespace(), e3);
        }, this._filename = null, this._externalErrorHandler = null, this._fileHandler = null, this._filename = s2, this.RegisterExpressionOperators(), this.GenerateStatementLevelRules(), this.errorHandler = this.OnStringParserError, this._externalErrorHandler = a2, this._fileHandler = null === l2 ? new oe() : l2, null === o2) {
          if (this._rootParser = this, this._openFilenames = [], null !== this._filename) {
            const t6 = this.fileHandler.ResolveInkFilename(this._filename);
            this._openFilenames.push(t6);
          }
        } else this._rootParser = o2;
      }
      PreProcessInputString(t5) {
        return new et(t5).Process();
      }
      get parsingStringExpression() {
        return this.GetFlag(Number(Nt.ParsingString));
      }
      set parsingStringExpression(t5) {
        this.SetFlag(Number(Nt.ParsingString), t5);
      }
      get tagActive() {
        return this.GetFlag(Number(Nt.TagActive));
      }
      set tagActive(t5) {
        this.SetFlag(Number(Nt.TagActive), t5);
      }
      get identifierCharSet() {
        return null === this._identifierCharSet && ((this._identifierCharSet = new $()).AddRange("A", "Z").AddRange("a", "z").AddRange("0", "9").Add("_"), this.ExtendIdentifierCharacterRanges(this._identifierCharSet)), this._identifierCharSet;
      }
      EndTagIfNecessary(t5) {
        this.tagActive && (null != t5 && (t5 instanceof dt ? t5.AddContent(new ae(false)) : t5.push(new ae(false))), this.tagActive = false);
      }
    };
    le.LatinBasic = q.Define("A", "z", new $().AddRange("[", "`")), le.LatinExtendedA = q.Define("\u0100", "\u017F"), le.LatinExtendedB = q.Define("\u0180", "\u024F"), le.Greek = q.Define("\u0370", "\u03FF", new $().AddRange("\u0378", "\u0385").AddCharacters("\u0374\u0375\u0378\u0387\u038B\u038D\u03A2")), le.Cyrillic = q.Define("\u0400", "\u04FF", new $().AddRange("\u0482", "\u0489")), le.Armenian = q.Define("\u0530", "\u058F", new $().AddCharacters("\u0530").AddRange("\u0557", "\u0560").AddRange("\u0588", "\u058E")), le.Hebrew = q.Define("\u0590", "\u05FF", new $()), le.Arabic = q.Define("\u0600", "\u06FF", new $()), le.Korean = q.Define("\uAC00", "\uD7AF", new $()), le.Latin1Supplement = q.Define("\x80", "\xFF", new $()), le.Chinese = q.Define("\u4E00", "\u9FFF", new $()), le.ListAllCharacterRanges = () => [le.LatinBasic, le.LatinExtendedA, le.LatinExtendedB, le.Arabic, le.Armenian, le.Cyrillic, le.Greek, le.Hebrew, le.Korean, le.Latin1Supplement, le.Chinese];
    ue = class {
      get errors() {
        return this._errors;
      }
      get warnings() {
        return this._warnings;
      }
      get authorMessages() {
        return this._authorMessages;
      }
      get inputString() {
        return this._inputString;
      }
      get options() {
        return this._options;
      }
      get parsedStory() {
        if (!this._parsedStory) throw new Error();
        return this._parsedStory;
      }
      get runtimeStory() {
        if (!this._runtimeStory) throw new Error("Compilation failed.");
        return this._runtimeStory;
      }
      get parser() {
        if (!this._parser) throw new Error();
        return this._parser;
      }
      get debugSourceRanges() {
        return this._debugSourceRanges;
      }
      constructor(i2) {
        let s2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null;
        this._errors = [], this._warnings = [], this._authorMessages = [], this._parsedStory = null, this._runtimeStory = null, this._parser = null, this._debugSourceRanges = [], this.Compile = () => (this._parser = new le(this.inputString, this.options.sourceFilename || null, this.OnError, null, this.options.fileHandler), this._parsedStory = this.parser.ParseStory(), 0 === this.errors.length ? (this.parsedStory.countAllVisits = this.options.countAllVisits, this._runtimeStory = this.parsedStory.ExportRuntime(this.OnError)) : this._runtimeStory = null, this.runtimeStory), this.RetrieveDebugSourceForLatestContent = () => {
          var t5;
          for (const n2 of this.runtimeStory.state.outputStream) {
            const i3 = r(n2, I);
            if (null !== i3) {
              const n3 = new e((null === (t5 = i3.value) || void 0 === t5 ? void 0 : t5.length) || 0, i3.debugMetadata, i3.value || "unknown");
              this.debugSourceRanges.push(n3);
            }
          }
        }, this.GenerateStats = () => null === this._parsedStory ? null : (function(t5) {
          let e2 = t5.FindAll(it)(), n2 = 0;
          for (const t6 of e2) {
            let e3 = 0, i4 = true;
            for (const n3 of t6.text) " " == n3 || "	" == n3 || "\n" == n3 || "\r" == n3 ? i4 = true : i4 && (e3++, i4 = false);
            n2 += e3;
          }
          const i3 = t5.FindAll(jt)(), r2 = t5.FindAll($t)(), s3 = t5.FindAll(X)(), a2 = t5.FindAll(at)(((t6) => null != t6.debugMetadata)), o2 = t5.FindAll(Ct)();
          return { words: n2, knots: i3.length, functions: i3.filter(((t6) => t6.isFunction)).length, stitches: r2.length, gathers: a2.length, diverts: o2.length - 1, choices: s3.length };
        })(this._parsedStory), this.DebugMetadataForContentAtOffset = (t5) => {
          let e2 = 0, n2 = null;
          for (const i3 of this.debugSourceRanges) {
            if (null !== i3.debugMetadata && (n2 = i3.debugMetadata), t5 >= e2 && t5 < e2 + i3.length) return n2;
            e2 += i3.length;
          }
          return null;
        }, this.OnError = (t5, e2) => {
          switch (e2) {
            case n.Author:
              this._authorMessages.push(t5);
              break;
            case n.Warning:
              this._warnings.push(t5);
              break;
            case n.Error:
              this._errors.push(t5);
          }
          null !== this.options.errorHandler && this.options.errorHandler(t5, e2);
        }, this._inputString = i2, this._options = s2 || new t();
      }
    };
  }
});

// src/shared/synth.ts
function audioCtx() {
  if (broken) return null;
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) {
        broken = true;
        return null;
      }
      ctx = new AC();
    }
    return ctx;
  } catch {
    broken = true;
    return null;
  }
}
function unlockAudio() {
  const c2 = audioCtx();
  if (c2 && c2.state === "suspended") void c2.resume();
}
function renderSoundDoc(c2, doc) {
  const key = JSON.stringify(doc.zzfx);
  const hit = sfxCache.get(key);
  if (hit) return hit;
  const p2 = doc.zzfx ?? [];
  const n2 = (i2, d2) => typeof p2[i2] === "number" && Number.isFinite(p2[i2]) ? p2[i2] : d2;
  const vol = clamp(n2(0, 1), 0, 1);
  const random = n2(1, 0.05);
  const freq0 = Math.max(20, n2(2, 220));
  const attack = Math.max(0, n2(3, 0));
  const sustain = Math.max(0, n2(4, 0));
  const decay = Math.max(0.01, n2(5, 0.1));
  const shape = Math.max(0, Math.min(4, Math.round(n2(6, 0))));
  const curve = n2(7, 1);
  const slide = n2(8, 0);
  const deltaSlide = n2(9, 0);
  const pitchJump = n2(10, 0);
  const pitchJumpTime = n2(11, 0);
  const repeatTime = n2(12, 0);
  const noiseAmt = clamp(n2(13, 0), 0, 1);
  const fm = n2(14, 0);
  const bitCrush = Math.round(n2(15, 0));
  const delaySec = n2(16, 0);
  const sustainVol = clamp(n2(17, 0.7), 0, 1);
  const decayCurve = n2(18, 1);
  const clip = clamp(n2(19, 0), 0, 1);
  const sr = c2.sampleRate;
  const envLen = attack + sustain + decay;
  const repeats = repeatTime > 0 ? Math.max(1, Math.min(12, Math.round(envLen / repeatTime))) : 1;
  const total = envLen * repeats + (delaySec > 0 ? delaySec * 3 : 0) + 0.02;
  const len = Math.max(1, Math.ceil(total * sr));
  const buf = c2.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const rnd = (0, import_seedrandom2.default)(`zzfx:${key}`);
  const freqJitter = 1 + (rnd() * 2 - 1) * random;
  let phase = 0;
  let echo = delaySec > 0 ? new Array(Math.ceil(delaySec * sr)).fill(0) : [];
  const echoAt = echo.length;
  for (let i2 = 0; i2 < len; i2++) {
    const tGlobal = i2 / sr;
    const t5 = repeatTime > 0 ? tGlobal % repeatTime : tGlobal;
    const tIn = repeatTime > 0 ? tGlobal / repeatTime : 0;
    let env;
    if (t5 < attack) env = attack > 0 ? t5 / attack : 1;
    else if (t5 < attack + sustain) env = sustainVol + (1 - sustainVol) * 0.15;
    else {
      const dt2 = (t5 - attack - sustain) / decay;
      env = dt2 >= 1 ? 0 : sustainVol * Math.pow(1 - dt2, 0.5 + decayCurve * 2);
    }
    if (env <= 0 && repeatTime <= 0 && t5 > attack + sustain + decay) {
      out[i2] = 0;
      continue;
    }
    let f2 = freq0 * freqJitter * Math.pow(2, (slide * t5 + 0.5 * deltaSlide * t5 * t5) / 12);
    if (t5 >= pitchJumpTime && pitchJumpTime > 0) f2 *= Math.pow(2, pitchJump / 12);
    if (t5 >= pitchJumpTime + 0.08 && pitchJumpTime > 0) f2 /= Math.pow(2, pitchJump / 12);
    if (fm) f2 *= 1 + fm * Math.sin(2 * Math.PI * f2 * 2 * t5);
    phase += 2 * Math.PI * f2 / sr;
    if (repeatTime > 0 && tGlobal > 0 && t5 < tIn * 0) ;
    const ph = phase % (2 * Math.PI);
    const norm = ph / (2 * Math.PI);
    let s2;
    switch (shape) {
      case 1:
        s2 = norm < clamp(0.1 + curve * 0.4, 0.02, 0.98) ? 1 : -1;
        break;
      case 2:
        s2 = 2 * norm - 1;
        break;
      case 3:
        s2 = norm < 0.5 ? 4 * norm - 1 : 3 - 4 * norm;
        break;
      case 4:
        s2 = rnd() * 2 - 1;
        break;
      default:
        s2 = Math.sin(ph);
    }
    if (noiseAmt > 0) s2 = s2 * (1 - noiseAmt) + (rnd() * 2 - 1) * noiseAmt;
    let v2 = s2 * env * vol;
    if (bitCrush > 0) {
      const q2 = Math.pow(2, Math.max(1, 16 - bitCrush)) / 32768;
      v2 = Math.round(v2 / q2) * q2;
    }
    if (clip > 0) v2 = Math.max(-clip, Math.min(clip, v2)) * (clip > 0 ? 1 / Math.max(clip, 0.2) : 1) * clip;
    if (echoAt > 0) {
      const d2 = i2 - echoAt;
      v2 += (echo[d2 % echoAt] ?? 0) * 0.35;
      echo[i2 % echoAt] = v2;
    }
    out[i2] = Math.max(-1, Math.min(1, v2));
  }
  sfxCache.set(key, buf);
  return buf;
}
function clamp(v2, a2, b2) {
  return Math.max(a2, Math.min(b2, v2));
}
var import_seedrandom2, ctx, broken, sfxCache;
var init_synth = __esm({
  "src/shared/synth.ts"() {
    import_seedrandom2 = __toESM(require_seedrandom2(), 1);
    ctx = null;
    broken = false;
    sfxCache = /* @__PURE__ */ new Map();
  }
});

// node_modules/react/cjs/react.production.js
var require_react_production = __commonJS({
  "node_modules/react/cjs/react.production.js"(exports) {
    "use strict";
    var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.transitional.element");
    var REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal");
    var REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment");
    var REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode");
    var REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler");
    var REACT_CONSUMER_TYPE = /* @__PURE__ */ Symbol.for("react.consumer");
    var REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context");
    var REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref");
    var REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense");
    var REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo");
    var REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy");
    var REACT_ACTIVITY_TYPE = /* @__PURE__ */ Symbol.for("react.activity");
    var REACT_VIEW_TRANSITION_TYPE = /* @__PURE__ */ Symbol.for("react.view_transition");
    var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
    function getIteratorFn(maybeIterable) {
      if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
      maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
      return "function" === typeof maybeIterable ? maybeIterable : null;
    }
    var ReactNoopUpdateQueue = {
      isMounted: function() {
        return false;
      },
      enqueueForceUpdate: function() {
      },
      enqueueReplaceState: function() {
      },
      enqueueSetState: function() {
      }
    };
    var assign = Object.assign;
    var emptyObject = {};
    function Component(props, context, updater) {
      this.props = props;
      this.context = context;
      this.refs = emptyObject;
      this.updater = updater || ReactNoopUpdateQueue;
    }
    Component.prototype.isReactComponent = {};
    Component.prototype.setState = function(partialState, callback) {
      if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState)
        throw Error(
          "takes an object of state variables to update or a function which returns an object of state variables."
        );
      this.updater.enqueueSetState(this, partialState, callback, "setState");
    };
    Component.prototype.forceUpdate = function(callback) {
      this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
    };
    function ComponentDummy() {
    }
    ComponentDummy.prototype = Component.prototype;
    function PureComponent(props, context, updater) {
      this.props = props;
      this.context = context;
      this.refs = emptyObject;
      this.updater = updater || ReactNoopUpdateQueue;
    }
    var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
    pureComponentPrototype.constructor = PureComponent;
    assign(pureComponentPrototype, Component.prototype);
    pureComponentPrototype.isPureReactComponent = true;
    var isArrayImpl = Array.isArray;
    function noop() {
    }
    var ReactSharedInternals = { H: null, A: null, T: null, S: null };
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    function ReactElement(type, key, props) {
      var refProp = props.ref;
      return {
        $$typeof: REACT_ELEMENT_TYPE,
        type,
        key,
        ref: void 0 !== refProp ? refProp : null,
        props
      };
    }
    function cloneAndReplaceKey(oldElement, newKey) {
      return ReactElement(oldElement.type, newKey, oldElement.props);
    }
    function isValidElement(object) {
      return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
    }
    function escape(key) {
      var escaperLookup = { "=": "=0", ":": "=2" };
      return "$" + key.replace(/[=:]/g, function(match) {
        return escaperLookup[match];
      });
    }
    var userProvidedKeyEscapeRegex = /\/+/g;
    function getElementKey(element, index) {
      return "object" === typeof element && null !== element && null != element.key ? escape("" + element.key) : index.toString(36);
    }
    function resolveThenable(thenable) {
      switch (thenable.status) {
        case "fulfilled":
          return thenable.value;
        case "rejected":
          throw thenable.reason;
        default:
          switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(
            function(fulfilledValue) {
              "pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
            },
            function(error) {
              "pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
            }
          )), thenable.status) {
            case "fulfilled":
              return thenable.value;
            case "rejected":
              throw thenable.reason;
          }
      }
      throw thenable;
    }
    function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
      var type = typeof children;
      if ("undefined" === type || "boolean" === type) children = null;
      var invokeCallback = false;
      if (null === children) invokeCallback = true;
      else
        switch (type) {
          case "bigint":
          case "string":
          case "number":
            invokeCallback = true;
            break;
          case "object":
            switch (children.$$typeof) {
              case REACT_ELEMENT_TYPE:
              case REACT_PORTAL_TYPE:
                invokeCallback = true;
                break;
              case REACT_LAZY_TYPE:
                return invokeCallback = children._init, mapIntoArray(
                  invokeCallback(children._payload),
                  array,
                  escapedPrefix,
                  nameSoFar,
                  callback
                );
            }
        }
      if (invokeCallback)
        return callback = callback(children), invokeCallback = "" === nameSoFar ? "." + getElementKey(children, 0) : nameSoFar, isArrayImpl(callback) ? (escapedPrefix = "", null != invokeCallback && (escapedPrefix = invokeCallback.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c2) {
          return c2;
        })) : null != callback && (isValidElement(callback) && (callback = cloneAndReplaceKey(
          callback,
          escapedPrefix + (null == callback.key || children && children.key === callback.key ? "" : ("" + callback.key).replace(
            userProvidedKeyEscapeRegex,
            "$&/"
          ) + "/") + invokeCallback
        )), array.push(callback)), 1;
      invokeCallback = 0;
      var nextNamePrefix = "" === nameSoFar ? "." : nameSoFar + ":";
      if (isArrayImpl(children))
        for (var i2 = 0; i2 < children.length; i2++)
          nameSoFar = children[i2], type = nextNamePrefix + getElementKey(nameSoFar, i2), invokeCallback += mapIntoArray(
            nameSoFar,
            array,
            escapedPrefix,
            type,
            callback
          );
      else if (i2 = getIteratorFn(children), "function" === typeof i2)
        for (children = i2.call(children), i2 = 0; !(nameSoFar = children.next()).done; )
          nameSoFar = nameSoFar.value, type = nextNamePrefix + getElementKey(nameSoFar, i2++), invokeCallback += mapIntoArray(
            nameSoFar,
            array,
            escapedPrefix,
            type,
            callback
          );
      else if ("object" === type) {
        if ("function" === typeof children.then)
          return mapIntoArray(
            resolveThenable(children),
            array,
            escapedPrefix,
            nameSoFar,
            callback
          );
        array = String(children);
        throw Error(
          "Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead."
        );
      }
      return invokeCallback;
    }
    function mapChildren(children, func, context) {
      if (null == children) return children;
      var result = [], count = 0;
      mapIntoArray(children, result, "", "", function(child) {
        return func.call(context, child, count++);
      });
      return result;
    }
    function lazyInitializer(payload) {
      if (-1 === payload._status) {
        var ctor = payload._result, thenable = ctor();
        thenable.then(
          function(moduleObject) {
            if (0 === payload._status || -1 === payload._status)
              payload._status = 1, payload._result = moduleObject, void 0 === thenable.status && (thenable.status = "fulfilled", thenable.value = moduleObject);
          },
          function(error) {
            if (0 === payload._status || -1 === payload._status)
              payload._status = 2, payload._result = error, void 0 === thenable.status && (thenable.status = "rejected", thenable.reason = error);
          }
        );
        -1 === payload._status && (payload._status = 0, payload._result = thenable);
      }
      if (1 === payload._status) return payload._result.default;
      throw payload._result;
    }
    var reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
      if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
        var event = new window.ErrorEvent("error", {
          bubbles: true,
          cancelable: true,
          message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
          error
        });
        if (!window.dispatchEvent(event)) return;
      } else if ("object" === typeof process && "function" === typeof process.emit) {
        process.emit("uncaughtException", error);
        return;
      }
      console.error(error);
    };
    function startTransition(scope) {
      var prevTransition = ReactSharedInternals.T, currentTransition = {};
      currentTransition.types = null !== prevTransition ? prevTransition.types : null;
      ReactSharedInternals.T = currentTransition;
      try {
        var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
        null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
        "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && returnValue.then(noop, reportGlobalError);
      } catch (error) {
        reportGlobalError(error);
      } finally {
        null !== prevTransition && null !== currentTransition.types && (prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
      }
    }
    function addTransitionType(type) {
      var transition = ReactSharedInternals.T;
      if (null !== transition) {
        var transitionTypes = transition.types;
        null === transitionTypes ? transition.types = [type] : -1 === transitionTypes.indexOf(type) && transitionTypes.push(type);
      } else startTransition(addTransitionType.bind(null, type));
    }
    var Children = {
      map: mapChildren,
      forEach: function(children, forEachFunc, forEachContext) {
        mapChildren(
          children,
          function() {
            forEachFunc.apply(this, arguments);
          },
          forEachContext
        );
      },
      count: function(children) {
        var n2 = 0;
        mapChildren(children, function() {
          n2++;
        });
        return n2;
      },
      toArray: function(children) {
        return mapChildren(children, function(child) {
          return child;
        }) || [];
      },
      only: function(children) {
        if (!isValidElement(children))
          throw Error(
            "React.Children.only expected to receive a single React element child."
          );
        return children;
      }
    };
    exports.Activity = REACT_ACTIVITY_TYPE;
    exports.Children = Children;
    exports.Component = Component;
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.Profiler = REACT_PROFILER_TYPE;
    exports.PureComponent = PureComponent;
    exports.StrictMode = REACT_STRICT_MODE_TYPE;
    exports.Suspense = REACT_SUSPENSE_TYPE;
    exports.ViewTransition = REACT_VIEW_TRANSITION_TYPE;
    exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
    exports.__COMPILER_RUNTIME = {
      __proto__: null,
      c: function(size) {
        return ReactSharedInternals.H.useMemoCache(size);
      }
    };
    exports.addTransitionType = addTransitionType;
    exports.cache = function(fn) {
      return function() {
        return fn.apply(null, arguments);
      };
    };
    exports.cacheSignal = function() {
      return null;
    };
    exports.cloneElement = function(element, config, children) {
      if (null === element || void 0 === element)
        throw Error(
          "The argument must be a React element, but you passed " + element + "."
        );
      var props = assign({}, element.props), key = element.key;
      if (null != config)
        for (propName in void 0 !== config.key && (key = "" + config.key), config)
          !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
      var propName = arguments.length - 2;
      if (1 === propName) props.children = children;
      else if (1 < propName) {
        for (var childArray = Array(propName), i2 = 0; i2 < propName; i2++)
          childArray[i2] = arguments[i2 + 2];
        props.children = childArray;
      }
      return ReactElement(element.type, key, props);
    };
    exports.createContext = function(defaultValue) {
      defaultValue = {
        $$typeof: REACT_CONTEXT_TYPE,
        _currentValue: defaultValue,
        _currentValue2: defaultValue,
        _threadCount: 0,
        Provider: null,
        Consumer: null
      };
      defaultValue.Provider = defaultValue;
      defaultValue.Consumer = {
        $$typeof: REACT_CONSUMER_TYPE,
        _context: defaultValue
      };
      return defaultValue;
    };
    exports.createElement = function(type, config, children) {
      var propName, props = {}, key = null;
      if (null != config)
        for (propName in void 0 !== config.key && (key = "" + config.key), config)
          hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (props[propName] = config[propName]);
      var childrenLength = arguments.length - 2;
      if (1 === childrenLength) props.children = children;
      else if (1 < childrenLength) {
        for (var childArray = Array(childrenLength), i2 = 0; i2 < childrenLength; i2++)
          childArray[i2] = arguments[i2 + 2];
        props.children = childArray;
      }
      if (type && type.defaultProps)
        for (propName in childrenLength = type.defaultProps, childrenLength)
          void 0 === props[propName] && (props[propName] = childrenLength[propName]);
      return ReactElement(type, key, props);
    };
    exports.createRef = function() {
      return { current: null };
    };
    exports.forwardRef = function(render) {
      return { $$typeof: REACT_FORWARD_REF_TYPE, render };
    };
    exports.isValidElement = isValidElement;
    exports.lazy = function(ctor) {
      return {
        $$typeof: REACT_LAZY_TYPE,
        _payload: { _status: -1, _result: ctor },
        _init: lazyInitializer
      };
    };
    exports.memo = function(type, compare) {
      return {
        $$typeof: REACT_MEMO_TYPE,
        type,
        compare: void 0 === compare ? null : compare
      };
    };
    exports.startTransition = startTransition;
    exports.unstable_useCacheRefresh = function() {
      return ReactSharedInternals.H.useCacheRefresh();
    };
    exports.use = function(usable) {
      return ReactSharedInternals.H.use(usable);
    };
    exports.useActionState = function(action, initialState, permalink) {
      return ReactSharedInternals.H.useActionState(action, initialState, permalink);
    };
    exports.useCallback = function(callback, deps) {
      return ReactSharedInternals.H.useCallback(callback, deps);
    };
    exports.useContext = function(Context) {
      return ReactSharedInternals.H.useContext(Context);
    };
    exports.useDebugValue = function() {
    };
    exports.useDeferredValue = function(value, initialValue) {
      return ReactSharedInternals.H.useDeferredValue(value, initialValue);
    };
    exports.useEffect = function(create, deps) {
      return ReactSharedInternals.H.useEffect(create, deps);
    };
    exports.useEffectEvent = function(callback) {
      return ReactSharedInternals.H.useEffectEvent(callback);
    };
    exports.useId = function() {
      return ReactSharedInternals.H.useId();
    };
    exports.useImperativeHandle = function(ref, create, deps) {
      return ReactSharedInternals.H.useImperativeHandle(ref, create, deps);
    };
    exports.useInsertionEffect = function(create, deps) {
      return ReactSharedInternals.H.useInsertionEffect(create, deps);
    };
    exports.useLayoutEffect = function(create, deps) {
      return ReactSharedInternals.H.useLayoutEffect(create, deps);
    };
    exports.useMemo = function(create, deps) {
      return ReactSharedInternals.H.useMemo(create, deps);
    };
    exports.useOptimistic = function(passthrough, reducer) {
      return ReactSharedInternals.H.useOptimistic(passthrough, reducer);
    };
    exports.useReducer = function(reducer, initialArg, init) {
      return ReactSharedInternals.H.useReducer(reducer, initialArg, init);
    };
    exports.useRef = function(initialValue) {
      return ReactSharedInternals.H.useRef(initialValue);
    };
    exports.useState = function(initialState) {
      return ReactSharedInternals.H.useState(initialState);
    };
    exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
      return ReactSharedInternals.H.useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot
      );
    };
    exports.useTransition = function() {
      return ReactSharedInternals.H.useTransition();
    };
    exports.version = "19.3.0";
  }
});

// node_modules/react/cjs/react.development.js
var require_react_development = __commonJS({
  "node_modules/react/cjs/react.development.js"(exports, module) {
    "use strict";
    "production" !== process.env.NODE_ENV && (function() {
      function defineDeprecationWarning(methodName, info) {
        Object.defineProperty(Component.prototype, methodName, {
          get: function() {
            console.warn(
              "%s(...) is deprecated in plain JavaScript React classes. %s",
              info[0],
              info[1]
            );
          }
        });
      }
      function getIteratorFn(maybeIterable) {
        if (null === maybeIterable || "object" !== typeof maybeIterable)
          return null;
        maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
        return "function" === typeof maybeIterable ? maybeIterable : null;
      }
      function warnNoop(publicInstance, callerName) {
        publicInstance = (publicInstance = publicInstance.constructor) && (publicInstance.displayName || publicInstance.name) || "ReactClass";
        var warningKey = publicInstance + "." + callerName;
        didWarnStateUpdateForUnmountedComponent[warningKey] || (console.error(
          "Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.",
          callerName,
          publicInstance
        ), didWarnStateUpdateForUnmountedComponent[warningKey] = true);
      }
      function Component(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject;
        this.updater = updater || ReactNoopUpdateQueue;
      }
      function ComponentDummy() {
      }
      function PureComponent(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject;
        this.updater = updater || ReactNoopUpdateQueue;
      }
      function noop() {
      }
      function testStringCoercion(value) {
        return "" + value;
      }
      function checkKeyStringCoercion(value) {
        try {
          testStringCoercion(value);
          var JSCompiler_inline_result = false;
        } catch (e2) {
          JSCompiler_inline_result = true;
        }
        if (JSCompiler_inline_result) {
          JSCompiler_inline_result = console;
          var JSCompiler_temp_const = JSCompiler_inline_result.error;
          var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
          JSCompiler_temp_const.call(
            JSCompiler_inline_result,
            "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
            JSCompiler_inline_result$jscomp$0
          );
          return testStringCoercion(value);
        }
      }
      function getComponentNameFromType(type) {
        if (null == type) return null;
        if ("function" === typeof type)
          return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
        if ("string" === typeof type) return type;
        switch (type) {
          case REACT_FRAGMENT_TYPE:
            return "Fragment";
          case REACT_PROFILER_TYPE:
            return "Profiler";
          case REACT_STRICT_MODE_TYPE:
            return "StrictMode";
          case REACT_SUSPENSE_TYPE:
            return "Suspense";
          case REACT_SUSPENSE_LIST_TYPE:
            return "SuspenseList";
          case REACT_ACTIVITY_TYPE:
            return "Activity";
          case REACT_VIEW_TRANSITION_TYPE:
            return "ViewTransition";
        }
        if ("object" === typeof type)
          switch ("number" === typeof type.tag && console.error(
            "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
          ), type.$$typeof) {
            case REACT_PORTAL_TYPE:
              return "Portal";
            case REACT_CONTEXT_TYPE:
              return type.displayName || "Context";
            case REACT_CONSUMER_TYPE:
              return (type._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
              var innerType = type.render;
              type = type.displayName;
              type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
              return type;
            case REACT_MEMO_TYPE:
              return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE:
              innerType = type._payload;
              type = type._init;
              try {
                return getComponentNameFromType(type(innerType));
              } catch (x2) {
              }
          }
        return null;
      }
      function getTaskName(type) {
        if (type === REACT_FRAGMENT_TYPE) return "<>";
        if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE)
          return "<...>";
        try {
          var name = getComponentNameFromType(type);
          return name ? "<" + name + ">" : "<...>";
        } catch (x2) {
          return "<...>";
        }
      }
      function getOwner() {
        var dispatcher = ReactSharedInternals.A;
        return null === dispatcher ? null : dispatcher.getOwner();
      }
      function UnknownOwner() {
        return Error("react-stack-top-frame");
      }
      function hasValidKey(config) {
        if (hasOwnProperty.call(config, "key")) {
          var getter = Object.getOwnPropertyDescriptor(config, "key").get;
          if (getter && getter.isReactWarning) return false;
        }
        return void 0 !== config.key;
      }
      function defineKeyPropWarningGetter(props, displayName) {
        function warnAboutAccessingKey() {
          specialPropKeyWarningShown || (specialPropKeyWarningShown = true, console.error(
            "%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
            displayName
          ));
        }
        warnAboutAccessingKey.isReactWarning = true;
        Object.defineProperty(props, "key", {
          get: warnAboutAccessingKey,
          configurable: true
        });
      }
      function elementRefGetterWithDeprecationWarning() {
        var componentName = getComponentNameFromType(this.type);
        didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = true, console.error(
          "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
        ));
        componentName = this.props.ref;
        return void 0 !== componentName ? componentName : null;
      }
      function ReactElement(type, key, props, owner, debugStack, debugTask) {
        var refProp = props.ref;
        type = {
          $$typeof: REACT_ELEMENT_TYPE,
          type,
          key,
          props,
          _owner: owner
        };
        null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
          enumerable: false,
          get: elementRefGetterWithDeprecationWarning
        }) : Object.defineProperty(type, "ref", { enumerable: false, value: null });
        type._store = {};
        Object.defineProperty(type._store, "validated", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: 0
        });
        Object.defineProperty(type, "_debugInfo", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: null
        });
        Object.defineProperty(type, "_debugStack", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: debugStack
        });
        Object.defineProperty(type, "_debugTask", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: debugTask
        });
        Object.freeze && (Object.freeze(type.props), Object.freeze(type));
        return type;
      }
      function cloneAndReplaceKey(oldElement, newKey) {
        newKey = ReactElement(
          oldElement.type,
          newKey,
          oldElement.props,
          oldElement._owner,
          oldElement._debugStack,
          oldElement._debugTask
        );
        oldElement._store && (newKey._store.validated = oldElement._store.validated);
        return newKey;
      }
      function validateChildKeys(node) {
        isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
      }
      function isValidElement(object) {
        return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
      }
      function escape(key) {
        var escaperLookup = { "=": "=0", ":": "=2" };
        return "$" + key.replace(/[=:]/g, function(match) {
          return escaperLookup[match];
        });
      }
      function getElementKey(element, index) {
        return "object" === typeof element && null !== element && null != element.key ? (checkKeyStringCoercion(element.key), escape("" + element.key)) : index.toString(36);
      }
      function resolveThenable(thenable) {
        switch (thenable.status) {
          case "fulfilled":
            return thenable.value;
          case "rejected":
            throw thenable.reason;
          default:
            switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(
              function(fulfilledValue) {
                "pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
              },
              function(error) {
                "pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
              }
            )), thenable.status) {
              case "fulfilled":
                return thenable.value;
              case "rejected":
                throw thenable.reason;
            }
        }
        throw thenable;
      }
      function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
        var type = typeof children;
        if ("undefined" === type || "boolean" === type) children = null;
        var invokeCallback = false;
        if (null === children) invokeCallback = true;
        else
          switch (type) {
            case "bigint":
            case "string":
            case "number":
              invokeCallback = true;
              break;
            case "object":
              switch (children.$$typeof) {
                case REACT_ELEMENT_TYPE:
                case REACT_PORTAL_TYPE:
                  invokeCallback = true;
                  break;
                case REACT_LAZY_TYPE:
                  return invokeCallback = children._init, mapIntoArray(
                    invokeCallback(children._payload),
                    array,
                    escapedPrefix,
                    nameSoFar,
                    callback
                  );
              }
          }
        if (invokeCallback) {
          invokeCallback = children;
          callback = callback(invokeCallback);
          var childKey = "" === nameSoFar ? "." + getElementKey(invokeCallback, 0) : nameSoFar;
          isArrayImpl(callback) ? (escapedPrefix = "", null != childKey && (escapedPrefix = childKey.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c2) {
            return c2;
          })) : null != callback && (isValidElement(callback) && (null != callback.key && (invokeCallback && invokeCallback.key === callback.key || checkKeyStringCoercion(callback.key)), escapedPrefix = cloneAndReplaceKey(
            callback,
            escapedPrefix + (null == callback.key || invokeCallback && invokeCallback.key === callback.key ? "" : ("" + callback.key).replace(
              userProvidedKeyEscapeRegex,
              "$&/"
            ) + "/") + childKey
          ), "" !== nameSoFar && null != invokeCallback && isValidElement(invokeCallback) && null == invokeCallback.key && invokeCallback._store && !invokeCallback._store.validated && (escapedPrefix._store.validated = 2), callback = escapedPrefix), array.push(callback));
          return 1;
        }
        invokeCallback = 0;
        childKey = "" === nameSoFar ? "." : nameSoFar + ":";
        if (isArrayImpl(children))
          for (var i2 = 0; i2 < children.length; i2++)
            nameSoFar = children[i2], type = childKey + getElementKey(nameSoFar, i2), invokeCallback += mapIntoArray(
              nameSoFar,
              array,
              escapedPrefix,
              type,
              callback
            );
        else if (i2 = getIteratorFn(children), "function" === typeof i2)
          for (i2 === children.entries && (didWarnAboutMaps || console.warn(
            "Using Maps as children is not supported. Use an array of keyed ReactElements instead."
          ), didWarnAboutMaps = true), children = i2.call(children), i2 = 0; !(nameSoFar = children.next()).done; )
            nameSoFar = nameSoFar.value, type = childKey + getElementKey(nameSoFar, i2++), invokeCallback += mapIntoArray(
              nameSoFar,
              array,
              escapedPrefix,
              type,
              callback
            );
        else if ("object" === type) {
          if ("function" === typeof children.then)
            return mapIntoArray(
              resolveThenable(children),
              array,
              escapedPrefix,
              nameSoFar,
              callback
            );
          array = String(children);
          throw Error(
            "Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead."
          );
        }
        return invokeCallback;
      }
      function mapChildren(children, func, context) {
        if (null == children) return children;
        var result = [], count = 0;
        mapIntoArray(children, result, "", "", function(child) {
          return func.call(context, child, count++);
        });
        return result;
      }
      function lazyInitializer(payload) {
        if (-1 === payload._status) {
          var resolveDebugValue = null, rejectDebugValue = null, ioInfo = payload._ioInfo;
          null != ioInfo && (ioInfo.start = ioInfo.end = performance.now(), ioInfo.value = new Promise(function(resolve2, reject) {
            resolveDebugValue = resolve2;
            rejectDebugValue = reject;
          }));
          ioInfo = payload._result;
          var thenable = ioInfo();
          thenable.then(
            function(moduleObject) {
              if (0 === payload._status || -1 === payload._status) {
                payload._status = 1;
                payload._result = moduleObject;
                var _ioInfo = payload._ioInfo;
                if (null != _ioInfo) {
                  _ioInfo.end = performance.now();
                  var debugValue = null == moduleObject ? void 0 : moduleObject.default;
                  resolveDebugValue(debugValue);
                  _ioInfo.value.status = "fulfilled";
                  _ioInfo.value.value = debugValue;
                }
                void 0 === thenable.status && (thenable.status = "fulfilled", thenable.value = moduleObject);
              }
            },
            function(error) {
              if (0 === payload._status || -1 === payload._status) {
                payload._status = 2;
                payload._result = error;
                var _ioInfo2 = payload._ioInfo;
                null != _ioInfo2 && (_ioInfo2.end = performance.now(), _ioInfo2.value.then(noop, noop), rejectDebugValue(error), _ioInfo2.value.status = "rejected", _ioInfo2.value.reason = error);
                void 0 === thenable.status && (thenable.status = "rejected", thenable.reason = error);
              }
            }
          );
          ioInfo = payload._ioInfo;
          if (null != ioInfo) {
            var displayName = thenable.displayName;
            "string" === typeof displayName && (ioInfo.name = displayName);
          }
          -1 === payload._status && (payload._status = 0, payload._result = thenable);
        }
        if (1 === payload._status)
          return ioInfo = payload._result, void 0 === ioInfo && console.error(
            "lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?",
            ioInfo
          ), "default" in ioInfo || console.error(
            "lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))",
            ioInfo
          ), ioInfo.default;
        throw payload._result;
      }
      function resolveDispatcher() {
        var dispatcher = ReactSharedInternals.H;
        null === dispatcher && console.error(
          "Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem."
        );
        return dispatcher;
      }
      function releaseAsyncTransition() {
        ReactSharedInternals.asyncTransitions--;
      }
      function startTransition(scope) {
        var prevTransition = ReactSharedInternals.T, currentTransition = {};
        currentTransition.types = null !== prevTransition ? prevTransition.types : null;
        currentTransition._updatedFibers = /* @__PURE__ */ new Set();
        ReactSharedInternals.T = currentTransition;
        try {
          var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
          null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
          "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && (ReactSharedInternals.asyncTransitions++, returnValue.then(releaseAsyncTransition, releaseAsyncTransition), returnValue.then(noop, reportGlobalError));
        } catch (error) {
          reportGlobalError(error);
        } finally {
          null === prevTransition && currentTransition._updatedFibers && (scope = currentTransition._updatedFibers.size, currentTransition._updatedFibers.clear(), 10 < scope && console.warn(
            "Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table."
          )), null !== prevTransition && null !== currentTransition.types && (null !== prevTransition.types && prevTransition.types !== currentTransition.types && console.error(
            "We expected inner Transitions to have transferred the outer types set and that you cannot add to the outer Transition while inside the inner.This is a bug in React."
          ), prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
        }
      }
      function addTransitionType(type) {
        var transition = ReactSharedInternals.T;
        if (null !== transition) {
          var transitionTypes = transition.types;
          null === transitionTypes ? transition.types = [type] : -1 === transitionTypes.indexOf(type) && transitionTypes.push(type);
        } else
          0 === ReactSharedInternals.asyncTransitions && console.error(
            "addTransitionType can only be called inside a `startTransition()` callback. It must be associated with a specific Transition."
          ), startTransition(addTransitionType.bind(null, type));
      }
      function enqueueTask(task) {
        if (null === enqueueTaskImpl)
          try {
            var requireString = ("require" + Math.random()).slice(0, 7);
            enqueueTaskImpl = (module && module[requireString]).call(
              module,
              "timers"
            ).setImmediate;
          } catch (_err) {
            enqueueTaskImpl = function(callback) {
              false === didWarnAboutMessageChannel && (didWarnAboutMessageChannel = true, "undefined" === typeof MessageChannel && console.error(
                "This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning."
              ));
              var channel = new MessageChannel();
              channel.port1.onmessage = callback;
              channel.port2.postMessage(void 0);
            };
          }
        return enqueueTaskImpl(task);
      }
      function aggregateErrors(errors) {
        return 1 < errors.length && "function" === typeof AggregateError ? new AggregateError(errors) : errors[0];
      }
      function popActScope(prevActQueue, prevActScopeDepth) {
        prevActScopeDepth !== actScopeDepth - 1 && console.error(
          "You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. "
        );
        actScopeDepth = prevActScopeDepth;
      }
      function recursivelyFlushAsyncActWork(returnValue, resolve2, reject) {
        var queue2 = ReactSharedInternals.actQueue;
        if (null !== queue2)
          if (0 !== queue2.length)
            try {
              flushActQueue(queue2);
              enqueueTask(function() {
                return recursivelyFlushAsyncActWork(returnValue, resolve2, reject);
              });
              return;
            } catch (error) {
              ReactSharedInternals.thrownErrors.push(error);
            }
          else ReactSharedInternals.actQueue = null;
        0 < ReactSharedInternals.thrownErrors.length ? (queue2 = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(queue2)) : resolve2(returnValue);
      }
      function flushActQueue(queue2) {
        if (!isFlushing) {
          isFlushing = true;
          var i2 = 0;
          try {
            for (; i2 < queue2.length; i2++) {
              var callback = queue2[i2];
              do {
                ReactSharedInternals.didUsePromise = false;
                var continuation = callback(false);
                if (null !== continuation) {
                  if (ReactSharedInternals.didUsePromise) {
                    queue2[i2] = callback;
                    queue2.splice(0, i2);
                    return;
                  }
                  callback = continuation;
                } else break;
              } while (1);
            }
            queue2.length = 0;
          } catch (error) {
            queue2.splice(0, i2 + 1), ReactSharedInternals.thrownErrors.push(error);
          } finally {
            isFlushing = false;
          }
        }
      }
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
      var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = /* @__PURE__ */ Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = /* @__PURE__ */ Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo"), REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = /* @__PURE__ */ Symbol.for("react.activity"), REACT_VIEW_TRANSITION_TYPE = /* @__PURE__ */ Symbol.for("react.view_transition"), MAYBE_ITERATOR_SYMBOL = Symbol.iterator, didWarnStateUpdateForUnmountedComponent = {}, ReactNoopUpdateQueue = {
        isMounted: function() {
          return false;
        },
        enqueueForceUpdate: function(publicInstance) {
          warnNoop(publicInstance, "forceUpdate");
        },
        enqueueReplaceState: function(publicInstance) {
          warnNoop(publicInstance, "replaceState");
        },
        enqueueSetState: function(publicInstance) {
          warnNoop(publicInstance, "setState");
        }
      }, assign = Object.assign, emptyObject = {};
      Object.freeze(emptyObject);
      Component.prototype.isReactComponent = {};
      Component.prototype.setState = function(partialState, callback) {
        if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState)
          throw Error(
            "takes an object of state variables to update or a function which returns an object of state variables."
          );
        this.updater.enqueueSetState(this, partialState, callback, "setState");
      };
      Component.prototype.forceUpdate = function(callback) {
        this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
      };
      var deprecatedAPIs = {
        isMounted: [
          "isMounted",
          "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."
        ],
        replaceState: [
          "replaceState",
          "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."
        ]
      };
      for (fnName in deprecatedAPIs)
        deprecatedAPIs.hasOwnProperty(fnName) && defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
      ComponentDummy.prototype = Component.prototype;
      deprecatedAPIs = PureComponent.prototype = new ComponentDummy();
      deprecatedAPIs.constructor = PureComponent;
      assign(deprecatedAPIs, Component.prototype);
      deprecatedAPIs.isPureReactComponent = true;
      var isArrayImpl = Array.isArray, REACT_CLIENT_REFERENCE = /* @__PURE__ */ Symbol.for("react.client.reference"), ReactSharedInternals = {
        H: null,
        A: null,
        T: null,
        S: null,
        actQueue: null,
        asyncTransitions: 0,
        isBatchingLegacy: false,
        didScheduleLegacyUpdate: false,
        didUsePromise: false,
        thrownErrors: [],
        getCurrentStack: null,
        recentlyCreatedOwnerStacks: 0
      }, hasOwnProperty = Object.prototype.hasOwnProperty, createTask = console.createTask ? console.createTask : function() {
        return null;
      };
      deprecatedAPIs = {
        react_stack_bottom_frame: function(callStackForError) {
          return callStackForError();
        }
      };
      var specialPropKeyWarningShown, didWarnAboutOldJSXRuntime;
      var didWarnAboutElementRef = {};
      var unknownOwnerDebugStack = deprecatedAPIs.react_stack_bottom_frame.bind(
        deprecatedAPIs,
        UnknownOwner
      )();
      var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
      var didWarnAboutMaps = false, userProvidedKeyEscapeRegex = /\/+/g, reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
        if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
          var event = new window.ErrorEvent("error", {
            bubbles: true,
            cancelable: true,
            message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
            error
          });
          if (!window.dispatchEvent(event)) return;
        } else if ("object" === typeof process && "function" === typeof process.emit) {
          process.emit("uncaughtException", error);
          return;
        }
        console.error(error);
      }, didWarnAboutMessageChannel = false, enqueueTaskImpl = null, actScopeDepth = 0, didWarnNoAwaitAct = false, isFlushing = false, queueSeveralMicrotasks = "function" === typeof queueMicrotask ? function(callback) {
        queueMicrotask(function() {
          return queueMicrotask(callback);
        });
      } : enqueueTask;
      deprecatedAPIs = Object.freeze({
        __proto__: null,
        c: function(size) {
          return resolveDispatcher().useMemoCache(size);
        }
      });
      var fnName = {
        map: mapChildren,
        forEach: function(children, forEachFunc, forEachContext) {
          mapChildren(
            children,
            function() {
              forEachFunc.apply(this, arguments);
            },
            forEachContext
          );
        },
        count: function(children) {
          var n2 = 0;
          mapChildren(children, function() {
            n2++;
          });
          return n2;
        },
        toArray: function(children) {
          return mapChildren(children, function(child) {
            return child;
          }) || [];
        },
        only: function(children) {
          if (!isValidElement(children))
            throw Error(
              "React.Children.only expected to receive a single React element child."
            );
          return children;
        }
      };
      exports.Activity = REACT_ACTIVITY_TYPE;
      exports.Children = fnName;
      exports.Component = Component;
      exports.Fragment = REACT_FRAGMENT_TYPE;
      exports.Profiler = REACT_PROFILER_TYPE;
      exports.PureComponent = PureComponent;
      exports.StrictMode = REACT_STRICT_MODE_TYPE;
      exports.Suspense = REACT_SUSPENSE_TYPE;
      exports.ViewTransition = REACT_VIEW_TRANSITION_TYPE;
      exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
      exports.__COMPILER_RUNTIME = deprecatedAPIs;
      exports.act = function(callback) {
        var prevActQueue = ReactSharedInternals.actQueue, prevActScopeDepth = actScopeDepth;
        actScopeDepth++;
        var queue2 = ReactSharedInternals.actQueue = null !== prevActQueue ? prevActQueue : [], didAwaitActCall = false;
        try {
          var result = callback();
        } catch (error) {
          ReactSharedInternals.thrownErrors.push(error);
        }
        if (0 < ReactSharedInternals.thrownErrors.length)
          throw popActScope(prevActQueue, prevActScopeDepth), callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
        if (null !== result && "object" === typeof result && "function" === typeof result.then) {
          var thenable = result;
          queueSeveralMicrotasks(function() {
            didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = true, console.error(
              "You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);"
            ));
          });
          return {
            then: function(resolve2, reject) {
              didAwaitActCall = true;
              thenable.then(
                function(returnValue) {
                  popActScope(prevActQueue, prevActScopeDepth);
                  if (0 === prevActScopeDepth) {
                    try {
                      flushActQueue(queue2), enqueueTask(function() {
                        return recursivelyFlushAsyncActWork(
                          returnValue,
                          resolve2,
                          reject
                        );
                      });
                    } catch (error$0) {
                      ReactSharedInternals.thrownErrors.push(error$0);
                    }
                    if (0 < ReactSharedInternals.thrownErrors.length) {
                      var _thrownError = aggregateErrors(
                        ReactSharedInternals.thrownErrors
                      );
                      ReactSharedInternals.thrownErrors.length = 0;
                      reject(_thrownError);
                    }
                  } else resolve2(returnValue);
                },
                function(error) {
                  popActScope(prevActQueue, prevActScopeDepth);
                  0 < ReactSharedInternals.thrownErrors.length ? (error = aggregateErrors(
                    ReactSharedInternals.thrownErrors
                  ), ReactSharedInternals.thrownErrors.length = 0, reject(error)) : reject(error);
                }
              );
            }
          };
        }
        var returnValue$jscomp$0 = result;
        popActScope(prevActQueue, prevActScopeDepth);
        0 === prevActScopeDepth && (flushActQueue(queue2), 0 !== queue2.length && queueSeveralMicrotasks(function() {
          didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = true, console.error(
            "A component suspended inside an `act` scope, but the `act` call was not awaited. When testing React components that depend on asynchronous data, you must await the result:\n\nawait act(() => ...)"
          ));
        }), ReactSharedInternals.actQueue = null);
        if (0 < ReactSharedInternals.thrownErrors.length)
          throw callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
        return {
          then: function(resolve2, reject) {
            didAwaitActCall = true;
            0 === prevActScopeDepth ? (ReactSharedInternals.actQueue = queue2, enqueueTask(function() {
              return recursivelyFlushAsyncActWork(
                returnValue$jscomp$0,
                resolve2,
                reject
              );
            })) : resolve2(returnValue$jscomp$0);
          }
        };
      };
      exports.addTransitionType = addTransitionType;
      exports.cache = function(fn) {
        return function() {
          return fn.apply(null, arguments);
        };
      };
      exports.cacheSignal = function() {
        return null;
      };
      exports.captureOwnerStack = function() {
        var getCurrentStack = ReactSharedInternals.getCurrentStack;
        return null === getCurrentStack ? null : getCurrentStack();
      };
      exports.cloneElement = function(element, config, children) {
        if (null === element || void 0 === element)
          throw Error(
            "The argument must be a React element, but you passed " + element + "."
          );
        var props = assign({}, element.props), key = element.key, owner = element._owner;
        if (null != config) {
          var JSCompiler_inline_result;
          a: {
            if (hasOwnProperty.call(config, "ref") && (JSCompiler_inline_result = Object.getOwnPropertyDescriptor(
              config,
              "ref"
            ).get) && JSCompiler_inline_result.isReactWarning) {
              JSCompiler_inline_result = false;
              break a;
            }
            JSCompiler_inline_result = void 0 !== config.ref;
          }
          JSCompiler_inline_result && (owner = getOwner());
          hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key);
          for (propName in config)
            !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
        }
        var propName = arguments.length - 2;
        if (1 === propName) props.children = children;
        else if (1 < propName) {
          JSCompiler_inline_result = Array(propName);
          for (var i2 = 0; i2 < propName; i2++)
            JSCompiler_inline_result[i2] = arguments[i2 + 2];
          props.children = JSCompiler_inline_result;
        }
        props = ReactElement(
          element.type,
          key,
          props,
          owner,
          element._debugStack,
          element._debugTask
        );
        for (key = 2; key < arguments.length; key++)
          validateChildKeys(arguments[key]);
        return props;
      };
      exports.createContext = function(defaultValue) {
        defaultValue = {
          $$typeof: REACT_CONTEXT_TYPE,
          _currentValue: defaultValue,
          _currentValue2: defaultValue,
          _threadCount: 0,
          Provider: null,
          Consumer: null
        };
        defaultValue.Provider = defaultValue;
        defaultValue.Consumer = {
          $$typeof: REACT_CONSUMER_TYPE,
          _context: defaultValue
        };
        defaultValue._currentRenderer = null;
        defaultValue._currentRenderer2 = null;
        return defaultValue;
      };
      exports.createElement = function(type, config, children) {
        for (var i2 = 2; i2 < arguments.length; i2++)
          validateChildKeys(arguments[i2]);
        var propName;
        i2 = {};
        var key = null;
        if (null != config)
          for (propName in didWarnAboutOldJSXRuntime || !("__self" in config) || "key" in config || (didWarnAboutOldJSXRuntime = true, console.warn(
            "Your app (or one of its dependencies) is using an outdated JSX transform. Update to the modern JSX transform for faster performance: https://react.dev/link/new-jsx-transform"
          )), hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key), config)
            hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (i2[propName] = config[propName]);
        var childrenLength = arguments.length - 2;
        if (1 === childrenLength) i2.children = children;
        else if (1 < childrenLength) {
          for (var childArray = Array(childrenLength), _i = 0; _i < childrenLength; _i++)
            childArray[_i] = arguments[_i + 2];
          Object.freeze && Object.freeze(childArray);
          i2.children = childArray;
        }
        if (type && type.defaultProps)
          for (propName in childrenLength = type.defaultProps, childrenLength)
            void 0 === i2[propName] && (i2[propName] = childrenLength[propName]);
        key && defineKeyPropWarningGetter(
          i2,
          "function" === typeof type ? type.displayName || type.name || "Unknown" : type
        );
        (propName = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++) ? (childArray = Error.stackTraceLimit, Error.stackTraceLimit = 10, childrenLength = Error("react-stack-top-frame"), Error.stackTraceLimit = childArray) : childrenLength = unknownOwnerDebugStack;
        return ReactElement(
          type,
          key,
          i2,
          getOwner(),
          childrenLength,
          propName ? createTask(getTaskName(type)) : unknownOwnerDebugTask
        );
      };
      exports.createRef = function() {
        var refObject = { current: null };
        Object.seal(refObject);
        return refObject;
      };
      exports.forwardRef = function(render) {
        null != render && render.$$typeof === REACT_MEMO_TYPE ? console.error(
          "forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...))."
        ) : "function" !== typeof render ? console.error(
          "forwardRef requires a render function but was given %s.",
          null === render ? "null" : typeof render
        ) : 0 !== render.length && 2 !== render.length && console.error(
          "forwardRef render functions accept exactly two parameters: props and ref. %s",
          1 === render.length ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined."
        );
        null != render && null != render.defaultProps && console.error(
          "forwardRef render functions do not support defaultProps. Did you accidentally pass a React component?"
        );
        var elementType = { $$typeof: REACT_FORWARD_REF_TYPE, render }, ownName;
        Object.defineProperty(elementType, "displayName", {
          enumerable: false,
          configurable: true,
          get: function() {
            return ownName;
          },
          set: function(name) {
            ownName = name;
            render.name || render.displayName || (Object.defineProperty(render, "name", { value: name }), render.displayName = name);
          }
        });
        return elementType;
      };
      exports.isValidElement = isValidElement;
      exports.lazy = function(ctor) {
        ctor = { _status: -1, _result: ctor };
        var lazyType = {
          $$typeof: REACT_LAZY_TYPE,
          _payload: ctor,
          _init: lazyInitializer
        }, ioInfo = {
          name: "lazy",
          start: -1,
          end: -1,
          value: null,
          owner: null,
          debugStack: Error("react-stack-top-frame"),
          debugTask: console.createTask ? console.createTask("lazy()") : null
        };
        ctor._ioInfo = ioInfo;
        lazyType._debugInfo = [{ awaited: ioInfo }];
        return lazyType;
      };
      exports.memo = function(type, compare) {
        null == type && console.error(
          "memo: The first argument must be a component. Instead received: %s",
          null === type ? "null" : typeof type
        );
        compare = {
          $$typeof: REACT_MEMO_TYPE,
          type,
          compare: void 0 === compare ? null : compare
        };
        var ownName;
        Object.defineProperty(compare, "displayName", {
          enumerable: false,
          configurable: true,
          get: function() {
            return ownName;
          },
          set: function(name) {
            ownName = name;
            type.name || type.displayName || (Object.defineProperty(type, "name", { value: name }), type.displayName = name);
          }
        });
        return compare;
      };
      exports.startTransition = startTransition;
      exports.unstable_useCacheRefresh = function() {
        return resolveDispatcher().useCacheRefresh();
      };
      exports.use = function(usable) {
        return resolveDispatcher().use(usable);
      };
      exports.useActionState = function(action, initialState, permalink) {
        return resolveDispatcher().useActionState(
          action,
          initialState,
          permalink
        );
      };
      exports.useCallback = function(callback, deps) {
        return resolveDispatcher().useCallback(callback, deps);
      };
      exports.useContext = function(Context) {
        var dispatcher = resolveDispatcher();
        Context.$$typeof === REACT_CONSUMER_TYPE && console.error(
          "Calling useContext(Context.Consumer) is not supported and will cause bugs. Did you mean to call useContext(Context) instead?"
        );
        return dispatcher.useContext(Context);
      };
      exports.useDebugValue = function(value, formatterFn) {
        return resolveDispatcher().useDebugValue(value, formatterFn);
      };
      exports.useDeferredValue = function(value, initialValue) {
        return resolveDispatcher().useDeferredValue(value, initialValue);
      };
      exports.useEffect = function(create, deps) {
        null == create && console.warn(
          "React Hook useEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        );
        return resolveDispatcher().useEffect(create, deps);
      };
      exports.useEffectEvent = function(callback) {
        return resolveDispatcher().useEffectEvent(callback);
      };
      exports.useId = function() {
        return resolveDispatcher().useId();
      };
      exports.useImperativeHandle = function(ref, create, deps) {
        return resolveDispatcher().useImperativeHandle(ref, create, deps);
      };
      exports.useInsertionEffect = function(create, deps) {
        null == create && console.warn(
          "React Hook useInsertionEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        );
        return resolveDispatcher().useInsertionEffect(create, deps);
      };
      exports.useLayoutEffect = function(create, deps) {
        null == create && console.warn(
          "React Hook useLayoutEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        );
        return resolveDispatcher().useLayoutEffect(create, deps);
      };
      exports.useMemo = function(create, deps) {
        return resolveDispatcher().useMemo(create, deps);
      };
      exports.useOptimistic = function(passthrough, reducer) {
        return resolveDispatcher().useOptimistic(passthrough, reducer);
      };
      exports.useReducer = function(reducer, initialArg, init) {
        return resolveDispatcher().useReducer(reducer, initialArg, init);
      };
      exports.useRef = function(initialValue) {
        return resolveDispatcher().useRef(initialValue);
      };
      exports.useState = function(initialState) {
        return resolveDispatcher().useState(initialState);
      };
      exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
        return resolveDispatcher().useSyncExternalStore(
          subscribe,
          getSnapshot,
          getServerSnapshot
        );
      };
      exports.useTransition = function() {
        return resolveDispatcher().useTransition();
      };
      exports.version = "19.3.0";
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
    })();
  }
});

// node_modules/react/index.js
var require_react = __commonJS({
  "node_modules/react/index.js"(exports, module) {
    "use strict";
    if (process.env.NODE_ENV === "production") {
      module.exports = require_react_production();
    } else {
      module.exports = require_react_development();
    }
  }
});

// src/shared/settings.ts
function getSettings() {
  if (cache) return cache;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    cache = { ...DEFAULT_SETTINGS, ...raw ? JSON.parse(raw) : {} };
  } catch {
    cache = { ...DEFAULT_SETTINGS };
  }
  return cache;
}
function sfxVolume(s2) {
  return clamp01(s2.volume * s2.sfx_volume);
}
function clamp01(v2) {
  return Math.max(0, Math.min(1, Number.isFinite(v2) ? v2 : 1));
}
var import_react, DEFAULT_SETTINGS, KEY, cache;
var init_settings = __esm({
  "src/shared/settings.ts"() {
    import_react = __toESM(require_react(), 1);
    DEFAULT_SETTINGS = {
      volume: 0.9,
      music_volume: 0.6,
      sfx_volume: 0.8,
      voice_volume: 1,
      voice_muted: false,
      tts_enabled: false,
      tts_voice: "",
      tts_rate: 1,
      text_scale: 1,
      animations: true,
      camera_parallax: true
    };
    KEY = "chronicle-forge:settings";
    cache = null;
  }
});

// src/shared/audio.ts
function isSoundDoc(v2) {
  return !!v2 && typeof v2 === "object" && Array.isArray(v2.zzfx);
}
function soundDef(id) {
  return campaign?.meta.sounds?.find((s2) => s2.id === id);
}
function pickSource(src) {
  if (Array.isArray(src)) {
    if (!src.length) return "";
    return src[Math.floor(Math.random() * src.length)];
  }
  return src;
}
function trackInstance(id, inst) {
  if (!id) return;
  const list = activeSoundInstances.get(id) ?? [];
  list.push(inst);
  activeSoundInstances.set(id, list);
}
function untrackInstance(id, inst) {
  const list = activeSoundInstances.get(id);
  if (!list) return;
  const filtered = list.filter((i2) => i2 !== inst);
  if (filtered.length) activeSoundInstances.set(id, filtered);
  else activeSoundInstances.delete(id);
}
function stopSound(id) {
  if (id) {
    stopLoop(id);
    const list = activeSoundInstances.get(id);
    if (list) {
      for (const inst of list) {
        try {
          inst.stop();
        } catch {
        }
      }
      activeSoundInstances.delete(id);
    }
  } else {
    stopAllLoops();
    for (const list of activeSoundInstances.values()) {
      for (const inst of list) {
        try {
          inst.stop();
        } catch {
        }
      }
    }
    activeSoundInstances.clear();
  }
}
function playSoundId(id, volume = 1) {
  if (!id || !campaign || !ambientEnabled) return;
  const def = soundDef(id);
  if (!def) return;
  playSource(pickSource(def.src), volume, id);
}
function playSource(src, volume = 1, soundId) {
  if (!src) return;
  const vol = sfxVolume(getSettings()) * volume;
  if (vol <= 0) return;
  unlockAudio();
  if (isSoundDoc(src)) {
    const c2 = audioCtx();
    if (!c2) return;
    if (c2.state === "suspended") void c2.resume();
    const buf = renderSoundDoc(c2, src);
    const node = c2.createBufferSource();
    node.buffer = buf;
    const g2 = c2.createGain();
    g2.gain.value = vol;
    node.connect(g2);
    g2.connect(c2.destination);
    node.start();
    if (soundId) {
      const inst = {
        stop: () => {
          try {
            node.stop();
          } catch {
          }
          try {
            g2.disconnect();
          } catch {
          }
        }
      };
      trackInstance(soundId, inst);
      node.onended = () => untrackInstance(soundId, inst);
    }
    return;
  }
  if (typeof Audio === "undefined") return;
  const url = campaign && !/^https?:|^data:|^blob:/i.test(src) ? `${campaign.basePath}/${src}` : src;
  const a2 = new Audio(url);
  a2.volume = vol;
  if (soundId) {
    const inst = {
      stop: () => {
        try {
          a2.pause();
          a2.currentTime = 0;
        } catch {
        }
      }
    };
    trackInstance(soundId, inst);
    a2.onended = () => untrackInstance(soundId, inst);
  }
  void a2.play().catch(() => void 0);
}
function playUi(hook, volume = 1) {
  if (!hook || !campaign || !ambientEnabled) return;
  const ui = campaign.meta.ui_sounds ?? {};
  if (ui[hook]) return playSoundId(ui[hook], volume);
  if (hook === "panel:log" && ui["panel:journal"]) return playSoundId(ui["panel:journal"], volume);
  if (hook === "panel:journal" && ui["panel:log"]) return playSoundId(ui["panel:log"], volume);
  if (hook === "panel:meta" && ui["panel:chronicle"]) return playSoundId(ui["panel:chronicle"], volume);
  if (hook === "panel:chronicle" && ui["panel:meta"]) return playSoundId(ui["panel:meta"], volume);
  if (hook === "panel:log:close" && ui["panel:journal:close"]) return playSoundId(ui["panel:journal:close"], volume);
  if (hook === "panel:journal:close" && ui["panel:log:close"]) return playSoundId(ui["panel:log:close"], volume);
  const underscored = hook.includes(":") ? hook.replace(/:/g, "_") : null;
  if (underscored && ui[underscored]) return playSoundId(ui[underscored], volume);
  if (hook.includes("close")) {
    if (ui["panel:close"]) return playSoundId(ui["panel:close"], volume);
    if (ui["panel_close"]) return playSoundId(ui["panel_close"], volume);
    if (ui["click"]) return playSoundId(ui["click"], volume * 0.7);
  } else if (hook.startsWith("panel:") || hook.startsWith("panel_")) {
    if (ui["panel:open"]) return playSoundId(ui["panel:open"], volume);
    if (ui["panel_open"]) return playSoundId(ui["panel_open"], volume);
  }
  if (soundDef(hook)) return playSoundId(hook, volume);
}
function playInteraction(hook, info = {}, volume = 1) {
  if (!campaign || !ambientEnabled) return;
  if (info.sound) {
    if (soundDef(info.sound)) return playSoundId(info.sound, volume);
    return playSource(info.sound, volume, info.sound);
  }
  const meta = campaign.meta;
  const fromEntity = info.entity?.sounds?.[hook];
  if (fromEntity) return playSoundId(fromEntity, volume);
  const ent = info.entity;
  if (ent && ent.type === "item") {
    const cat = meta.item_categories?.find((c2) => c2.id === ent.category);
    const fromCat = cat?.sounds?.[hook];
    if (fromCat) return playSoundId(fromCat, volume);
  }
  if (info.slotType) {
    const st2 = meta.slot_types?.find((t5) => t5.id === info.slotType);
    const fromSlot = st2?.sounds?.[hook];
    if (fromSlot) return playSoundId(fromSlot, volume);
  }
  for (const name of HOOK_FALLBACK[hook] ?? [hook]) {
    const id = meta.ui_sounds?.[name];
    if (id) return playSoundId(id, volume);
  }
  playUi(hook, volume);
}
function stopLoop(id) {
  loops.get(id)?.stop();
  loops.delete(id);
}
function stopAllLoops() {
  for (const id of [...loops.keys()]) stopLoop(id);
}
var campaign, ambientEnabled, activeSoundInstances, HOOK_FALLBACK, loops;
var init_audio = __esm({
  "src/shared/audio.ts"() {
    init_synth();
    init_settings();
    init_conditions();
    init_synth();
    campaign = null;
    ambientEnabled = true;
    activeSoundInstances = /* @__PURE__ */ new Map();
    HOOK_FALLBACK = {
      travel: ["travel", "scene_transition"],
      "item:equip": ["equip", "item_equip"],
      "item:unequip": ["unequip", "item_unequip"],
      "item:use": ["use", "item_use"],
      "item:drop": ["drop", "item_drop"]
    };
    loops = /* @__PURE__ */ new Map();
  }
});

// src/core/dialogue.ts
function parseLineTags(tags) {
  let emotion = "neutral";
  let action = false;
  let voice;
  let sfx;
  let timer;
  let speaker;
  for (const t5 of tags) {
    const em = t5.match(/^emotion:\s*(\w+)/);
    if (em) emotion = em[1];
    if (t5.trim() === "action") action = true;
    const vo = t5.match(/^voice:\s*(.+)$/);
    if (vo) voice = vo[1].trim();
    const sf = t5.match(/^(?:sfx|sound):\s*(.+)$/);
    if (sf) sfx = sf[1].trim();
    const sp = t5.match(/^speaker:\s*(.+)$/);
    if (sp) speaker = sp[1].trim();
    const tm = t5.match(/^(?:timer|timeout):\s*(\d+)/);
    if (tm) timer = Number(tm[1]);
  }
  return { emotion, action: action || void 0, voice, sfx, timer, speaker };
}
function sanitizeInkSource(source) {
  let lines = source.split("\n");
  lines = lines.filter((l2) => !/^\s*(\*\s*){3,}\s*$/.test(l2) && !/^\s*[-_]{3,}\s*$/.test(l2));
  lines = lines.map((l2) => {
    if (l2.includes("[") && l2.includes("]")) return l2;
    return l2.replace(/^(\s*)[*+-]\s*(\{.*?:)/, "$1$2");
  });
  lines = lines.map((l2) => l2.replace(/\bopen_craft\(\)/g, 'open_craft("")'));
  const knotDeclaredTemps = /* @__PURE__ */ new Set();
  lines = lines.map((l2) => {
    if (/^===\s*([^\s=]+)/.test(l2.trim())) {
      knotDeclaredTemps.clear();
      return l2;
    }
    const tm = /^\s*~\s*temp\s+(\w+)\s*=/.exec(l2);
    if (tm) {
      const v2 = tm[1];
      if (knotDeclaredTemps.has(v2)) {
        return l2.replace(/^\s*~\s*temp\s+/, "    ~ ");
      }
      knotDeclaredTemps.add(v2);
    }
    return l2;
  });
  const knotNames = /* @__PURE__ */ new Set();
  for (const l2 of lines) {
    const km = /^===\s*([^\s=]+)/.exec(l2.trim());
    if (km) knotNames.add(km[1]);
  }
  const defaultHub = knotNames.has("main_hub") ? "main_hub" : knotNames.has("main") ? "main" : knotNames.values().next().value ?? "DONE";
  lines = lines.map((l2) => {
    return l2.replace(/->\s*([a-zA-Z0-9_]+)/g, (full, target) => {
      if (target === "DONE" || target === "END" || knotNames.has(target)) return full;
      return `-> ${defaultHub}`;
    });
  });
  let text = lines.join("\n");
  const externals = [
    "get_flag(f)",
    "has_item(id)",
    "item_count(id)",
    "get_disposition(t)",
    "quest_stage(q)",
    "in_party(e)",
    "get_hp()",
    "has_status(s)",
    "weather_is(w)",
    "get_skill(s)",
    "get_currency(c)",
    "get_meta_counter(k)",
    "skill_check(s, d)",
    "set_flag(f)",
    "clear_flag(f)",
    "apply_status(p, s, d)",
    "remove_status(p, s)",
    "set_weather(w)",
    "unlock_codex(e)",
    "unlock_recipe(r)",
    "open_trade(n)",
    "open_craft(r)",
    "add_item(id, n)",
    "remove_item(id, q)",
    "change_disposition(t, d)",
    "join_party(e)",
    "leave_party(e)",
    "change_companion_need(e, n, d)",
    "get_companion_need(e, n)",
    "give_to(e, id, q)",
    "start_combat(a)",
    "start_quest(q)",
    "advance_quest(q, s)",
    "fail_quest(q)",
    "journal_update(q, k)",
    "fire_rule(r)",
    "change_hp(d)",
    "change_need(n, d)",
    "advance_time(t)",
    "sleep(h)",
    "set_dialogue_timer(s, k)",
    "present_item(o, f, r)",
    "play_sound(s, v)",
    "set_entity_state(e, s)",
    "learn_name(id)",
    "is_name_known(id)",
    "npc_known(id)",
    "go_to_scene(s)",
    "change_scene_state(s)",
    "game_over_death(m)",
    "game_over_victory(m)"
  ];
  const declared = /* @__PURE__ */ new Set();
  for (const m2 of text.matchAll(/EXTERNAL\s+(\w+)/g)) {
    declared.add(m2[1]);
  }
  const missing = [];
  for (const ext of externals) {
    const name = ext.split("(")[0];
    if (!declared.has(name) && new RegExp(`\\b${name}\\s*\\(`).test(text)) {
      missing.push(`EXTERNAL ${ext}`);
    }
  }
  const vars = [];
  for (const m2 of text.matchAll(/\{([a-zA-Zа-яА-ЯёЁ_][a-zA-Z0-9а-яА-ЯёЁ_]*)\}/g)) {
    const v2 = m2[1];
    if (v2 !== "else" && v2 !== "true" && v2 !== "false" && !declared.has(v2) && !text.includes(`VAR ${v2}`)) {
      vars.push(`VAR ${v2} = "\u0413\u0435\u0440\u043E\u0439"`);
    }
  }
  const preamble = [...missing, ...new Set(vars)].join("\n");
  return preamble ? `${preamble}
${text}` : text;
}
function createStory(source, cacheKey) {
  let json = jsonCache.get(cacheKey);
  if (!json) {
    const cleanSource = sanitizeInkSource(source);
    const errors = [];
    try {
      const compiler = new ue(cleanSource, {
        errorHandler: (msg, type) => {
          if (type === 2 || String(type).toLowerCase().includes("error")) errors.push(msg);
        }
      });
      const compiled = compiler.Compile();
      json = compiled.ToJson() ?? "";
    } catch (err) {
      const hint = errors.length ? errors.join("; ") : err instanceof Error ? err.message : String(err);
      const preview = cleanSource.split("\n").slice(0, 40).join("\n");
      throw new Error(`Ink \xAB${cacheKey}\xBB: ${hint}
--- ink preview ---
${preview}
---`);
    }
    jsonCache.set(cacheKey, json);
  }
  return new ie(json);
}
function firstInkKnot(source) {
  const m2 = source.match(/===\s*([^\s=]+)(?:\s*===)?/);
  return m2?.[1] ?? null;
}
function bindExternals(story, engine) {
  const bind = (name, fn) => {
    try {
      story.BindExternalFunction(name, fn, false);
    } catch {
    }
  };
  bind("has_item", (id) => engine.hasItem(id));
  bind("item_count", (id) => engine.itemCount(id));
  bind("add_item", (id, n2) => {
    engine.addItem(id, n2);
    return 0;
  });
  bind("remove_item", (id, n2) => {
    engine.removeItem(id, n2);
    return 0;
  });
  bind("skill_check", (skill, difficulty) => {
    return engine.playerSkillCheck(skill, difficulty ?? 50).success ? 1 : 0;
  });
  bind("get_need", (id) => engine.state.player.needs[id] ?? 0);
  bind("change_need", (id, delta) => {
    engine.changeNeed(id, delta);
    return 0;
  });
  bind("set_flag", (f2, ...rest) => {
    const val = rest[0];
    if (val === false || val === 0 || val === "false") {
      delete engine.state.flags[f2];
    } else {
      engine.state.flags[f2] = val ?? true;
    }
    if (!engine.combat && !engine.trade) engine.checkRules();
    return 0;
  });
  bind("clear_flag", (f2) => {
    delete engine.state.flags[f2];
    if (!engine.combat && !engine.trade) engine.checkRules();
    return 0;
  });
  bind("get_flag", (f2) => !!engine.state.flags[f2]);
  bind("get_stat", (s2) => engine.state.player.stats[s2] ?? 0);
  bind("get_skill", (s2) => engine.state.player.skills[s2] ?? 0);
  bind("get_hp", () => engine.state.player.hp);
  bind("get_hp_max", () => engine.state.player.max_hp);
  bind("get_mp", () => engine.state.player.mp);
  bind("get_mp_max", () => engine.state.player.max_mp);
  bind("get_player_name", () => engine.state.player.name ?? "\u0433\u0435\u0440\u043E\u0439");
  bind("get_run_day", () => Math.floor((engine.state.tick ?? 0) / Math.max(1, engine.campaign.meta.ticks_per_day || 24)) + 1);
  bind("get_level", () => engine.state.player.level ?? 1);
  bind("get_xp", () => engine.state.player.xp ?? 0);
  bind("get_currency", (id) => engine.state.player.currencies?.[id] ?? 0);
  bind("get_luck", () => engine.luck());
  bind("change_luck", (d2) => {
    engine.changeLuck(d2);
    return 0;
  });
  bind("get_fatigue", () => engine.fatigue());
  bind("change_fatigue", (d2) => {
    engine.changeFatigue(d2);
    return 0;
  });
  bind("get_sanity", () => engine.sanity());
  bind("change_sanity", (d2) => {
    engine.changeSanity(d2);
    return 0;
  });
  bind("get_reputation", () => engine.reputation());
  bind("change_reputation", (d2) => {
    engine.changeReputation(d2);
    return 0;
  });
  bind("change_wealth", (levels) => {
    engine.changeWealth(levels);
    return 0;
  });
  bind("get_passion", (id) => engine.passion(id));
  bind("change_passion", (id, delta) => {
    engine.changePassion(id, delta);
    return 0;
  });
  bind("get_allegiance", (id) => engine.allegiance(id));
  bind("change_allegiance", (id, points) => {
    engine.changeAllegiance(id, points);
    return 0;
  });
  bind("train_stat", (stat, delta) => {
    engine.trainStat(stat, delta);
    return 0;
  });
  bind("hazard_fall", (meters, skill) => {
    engine.applyFall(meters > 0 ? meters : 10, skill || void 0);
    return 0;
  });
  bind("commit_crime", (id, bounty) => {
    engine.commitCrime(id, bounty > 0 ? bounty : 0);
    return 0;
  });
  bind("get_bounty", () => engine.bountyTotal());
  bind("set_price_event", (id) => {
    engine.setPriceEvent(id, true);
    return 0;
  });
  bind("clear_price_event", (id) => {
    engine.setPriceEvent(id || "", false);
    return 0;
  });
  bind("grant_xp", (n2) => {
    engine.grantXp(n2 > 0 ? n2 : 0);
    return 0;
  });
  bind("grant_feat", (id) => {
    engine.grantFeat(id);
    return 0;
  });
  bind("get_level", () => engine.level());
  bind("meta_currency", (id, amount) => {
    engine.grantMetaCurrency(id, amount);
    return 0;
  });
  bind("get_meta_currency", (id) => engine.metaCurrency(id));
  bind("has_meta_achievement", (id) => engine.metaAchievementDone(id) ? 1 : 0);
  bind("get_meta_counter", (key) => engine.metaCounter(key));
  bind("roll_table", (table) => {
    engine.rollEventTable(table, { forced: true });
    return 0;
  });
  bind("gen", (generator, key) => engine.genValue(generator, key));
  bind("gen_seeded", (generator, key, seed) => engine.genValue(generator, key, seed));
  bind("stat_roll", (stat, mult) => engine.statCheck(stat, mult > 0 ? mult : 5).success ? 1 : 0);
  bind("opposed_roll", (skill, entity) => engine.opposedCheck({ type: "opposed_check", skill, entity, success_effects: [], fail_effects: [] }).success ? 1 : 0);
  bind("change_hp", (d2) => {
    engine.changeHp(d2);
    return 0;
  });
  bind("advance_time", (ticks) => {
    engine.advanceTicks(ticks);
    return 0;
  });
  bind("fire_rule", (ruleId) => {
    engine.fireRule(ruleId);
    return 0;
  });
  bind("get_disposition", (target) => engine.getDisposition(target));
  bind("change_disposition", (target, delta) => {
    engine.changeDisposition(target, delta);
    return 0;
  });
  bind("open_trade", (entityId) => {
    engine.openTrade(entityId);
    return 0;
  });
  bind("open_craft", (recipeId) => {
    engine.openCraft(recipeId || void 0);
    return 0;
  });
  bind("set_dialogue_timer", (seconds, knot) => {
    engine.setDialogueTimer(Number(seconds) || 0, knot);
    return 0;
  });
  bind("present_item", (okKnot, failKnot, required) => {
    engine.promptPresentItem(okKnot, failKnot, required);
    return 0;
  });
  bind("play_sound", (sound, volume) => {
    playInteraction(sound, { sound }, volume != null ? Number(volume) : 1);
    return 0;
  });
  bind("set_entity_state", (entityId, state) => {
    engine.applyEffects([{ type: "set_entity_state", entity: entityId, state: state ?? "" }]);
    return 0;
  });
  bind("set_description", (entityId, text) => {
    engine.setEntityDescription(entityId, text);
    return 0;
  });
  bind("join_party", (entityId) => {
    engine.joinParty(entityId);
    return 0;
  });
  bind("leave_party", (entityId) => {
    engine.leaveParty(entityId);
    return 0;
  });
  bind("change_companion_need", (entity, need, delta) => {
    engine.changeCompanionNeed(String(entity), String(need), Number(delta) || 0);
    return 0;
  });
  bind("get_companion_need", (entity, need) => engine.companionNeed(String(entity), String(need)) ?? -1);
  bind("give_to", (entity, item, qty) => engine.giveItemToCompanion(String(entity), String(item), Number(qty) || 1) ? 1 : 0);
  bind("in_party", (entityId) => engine.isInParty(entityId) ? 1 : 0);
  bind("start_quest", (questId) => {
    engine.startQuest(questId);
    return 0;
  });
  bind("quest_stage", (questId) => engine.state.quests[questId]?.stage ?? "");
  bind("play_cutscene", (id) => {
    engine.playCutscene(id);
    return 0;
  });
  bind("sleep", (ticks) => {
    engine.advanceTicks(ticks);
    engine.restAndGrow();
    engine.restHeal();
    return 0;
  });
  bind("has_status", (id) => engine.hasStatus(id));
  bind("apply_status", (id, duration) => {
    engine.applyStatus("player", id, duration > 0 ? duration : void 0);
    return 0;
  });
  bind("remove_status", (id) => {
    engine.removeStatus("player", id);
    return 0;
  });
  bind("weather_is", (id) => (engine.state.weather ?? "") === id);
  bind("set_weather", (id) => {
    engine.applyEffects([{ type: "set_weather", weather: id }]);
    return 0;
  });
  bind("unlock_codex", (id) => {
    engine.applyEffects([{ type: "unlock_codex", entry: id }]);
    return 0;
  });
  bind("unlock_recipe", (id) => {
    engine.applyEffects([{ type: "unlock_recipe", recipe: id }]);
    return 0;
  });
  bind("learn_name", (id) => {
    engine.learnNpcName(id);
    return 0;
  });
  bind("is_name_known", (id) => engine.isNpcNameKnown(id) ? 1 : 0);
  bind("npc_known", (id) => engine.isNpcNameKnown(id) ? 1 : 0);
  bind("go_to_scene", (sceneId) => {
    engine.goToSceneFromDialogue(sceneId, true);
    return 0;
  });
  bind("start_combat", (arenaId) => {
    engine.startCombatFromDialogue(arenaId);
    return 0;
  });
  bind("change_scene_state", (state) => {
    engine.changeSceneState(state);
    return 0;
  });
  bind("game_over_death", (reason) => {
    engine.gameOver("death", reason || "\u0413\u0438\u0431\u0435\u043B\u044C \u0433\u0435\u0440\u043E\u044F");
    return 0;
  });
  bind("game_over_victory", (reason) => {
    engine.gameOver("victory", reason || "\u0422\u0440\u0438\u0443\u043C\u0444 \u0433\u0435\u0440\u043E\u044F");
    return 0;
  });
}
function cleanDialogueLine(raw) {
  let text = raw.trim();
  const quotedSpeaker = text.match(/^([\p{Lu}\p{Lt}][\p{L}\p{M}\s.-]{0,35}):\s*[«"“]([\s\S]+?)[»"”]$/u);
  if (quotedSpeaker && quotedSpeaker[2].trim()) {
    return quotedSpeaker[2].trim();
  }
  const fullQuotes = text.match(/^[«"“]([\s\S]+)[»"”]$/u);
  if (fullQuotes && fullQuotes[1].trim()) {
    const inner = fullQuotes[1].trim();
    if (!inner.includes("\xBB") && !inner.includes('"')) {
      return inner;
    }
  }
  return text;
}
function drainStory(story) {
  const lines = [];
  while (story.canContinue) {
    const rawText = (story.Continue() ?? "").trim();
    const text = cleanDialogueLine(rawText);
    const tags = story.currentTags ?? [];
    const { emotion, action, voice, sfx, timer, speaker } = parseLineTags(tags);
    if (text && !SYSTEM_LITERAL_LINE.test(text)) lines.push({ text, emotion, action, voice, sfx, timer, speaker });
  }
  const choices = story.currentChoices.map((c2, i2) => ({ index: i2, text: c2.text }));
  return { lines, choices, finished: choices.length === 0 && !story.canContinue };
}
var jsonCache, SYSTEM_LITERAL_LINE;
var init_dialogue = __esm({
  "src/core/dialogue.ts"() {
    init_ink_full();
    init_audio();
    jsonCache = /* @__PURE__ */ new Map();
    SYSTEM_LITERAL_LINE = /^(?:true|false|null|undefined|nan)$/i;
  }
});

// src/shared/speechTiming.ts
function speechCompletionTimeoutMs(text, rate = 1) {
  const safeRate = Math.max(0.5, Math.min(2, rate));
  const estimate = text.length * (130 / safeRate) + 12e3;
  return Math.min(10 * 6e4, Math.max(2e4, Math.ceil(estimate)));
}
var init_speechTiming = __esm({
  "src/shared/speechTiming.ts"() {
  }
});

// src/shared/speech.ts
function ttsSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}
function ttsVoices() {
  if (!ttsSupported()) return [];
  const list = window.speechSynthesis.getVoices();
  const ru = (v2) => v2.lang.toLowerCase().startsWith("ru") ? 0 : 1;
  return [...list].sort((a2, b2) => ru(a2) - ru(b2) || a2.name.localeCompare(b2.name));
}
function pickVoice(name) {
  const voices = ttsVoices();
  return voices.find((v2) => v2.name === name) ?? voices.find((v2) => v2.lang.toLowerCase().startsWith("ru"));
}
function initVoices() {
  if (!ttsSupported() || voicesReady) return;
  const synth = window.speechSynthesis;
  const check = () => {
    if (synth.getVoices().length > 0) voicesReady = true;
  };
  check();
  synth.addEventListener?.("voiceschanged", check);
}
function clearStallTimer() {
  if (stallTimer !== null) {
    clearTimeout(stallTimer);
    stallTimer = null;
  }
}
function onFirstGesture() {
  gestureSeen = true;
  prime();
  pump();
}
function prime() {
  if (primed || !ttsSupported()) return;
  primed = true;
  try {
    const u2 = new SpeechSynthesisUtterance(" ");
    u2.volume = 0.01;
    const v2 = pickVoice(void 0);
    if (v2) {
      u2.voice = v2;
      u2.lang = v2.lang;
    }
    window.speechSynthesis.speak(u2);
  } catch {
  }
}
function startKeepalive() {
  if (keepalive !== null || !ttsSupported()) return;
  keepalive = setInterval(() => {
    const synth = window.speechSynthesis;
    if (synth.speaking && !synth.paused) {
      synth.pause();
      synth.resume();
    }
  }, 1e4);
}
function stopKeepalive() {
  if (keepalive !== null) {
    clearInterval(keepalive);
    keepalive = null;
  }
}
function pump() {
  if (pumpTimer !== null) return;
  if (active) return;
  const item = queue[0];
  if (!item) {
    stopKeepalive();
    return;
  }
  if (!gestureSeen) return;
  if (item.cancelled) {
    queue.shift();
    pump();
    return;
  }
  if (!voicesReady && Date.now() - bootTs < 4e3) {
    pumpTimer = setTimeout(() => {
      pumpTimer = null;
      pump();
    }, 120);
    return;
  }
  const wait = Math.max(0, cooldownUntil - Date.now());
  if (wait > 0) {
    pumpTimer = setTimeout(() => {
      pumpTimer = null;
      pump();
    }, wait);
    return;
  }
  queue.shift();
  active = item;
  item.started = false;
  item.settled = false;
  startKeepalive();
  speakItem(item);
}
function finishItem(item) {
  if (item.settled) return;
  item.settled = true;
  clearStallTimer();
  if (active === item) active = null;
  if (!item.cancelled) item.opts.onEnd?.();
  pump();
}
function armCompletionWatchdog(item, synth) {
  clearStallTimer();
  stallTimer = setTimeout(() => {
    stallTimer = null;
    if (active !== item || item.settled) return;
    try {
      synth.cancel();
    } catch {
    }
    cooldownUntil = Math.max(cooldownUntil, Date.now() + 100);
    finishItem(item);
  }, speechCompletionTimeoutMs(item.clean, item.opts.rate));
}
function speakItem(item) {
  const synth = window.speechSynthesis;
  const u2 = new SpeechSynthesisUtterance(item.clean);
  const chosen = pickVoice(item.opts.voice);
  if (chosen) {
    u2.voice = chosen;
    u2.lang = chosen.lang;
  } else {
    u2.lang = "ru-RU";
  }
  u2.rate = Math.max(0.5, Math.min(2, item.opts.rate ?? 1));
  u2.volume = Math.max(0, Math.min(1, item.opts.volume ?? 1));
  u2.onstart = () => {
    if (active !== item || item.settled) return;
    item.started = true;
    armCompletionWatchdog(item, synth);
  };
  u2.onend = () => finishItem(item);
  u2.onerror = () => finishItem(item);
  try {
    synth.speak(u2);
    synth.resume();
  } catch {
    finishItem(item);
    return;
  }
  clearStallTimer();
  stallTimer = setTimeout(() => {
    stallTimer = null;
    if (active === item && !item.started) {
      if (synth.speaking || synth.pending) {
        item.started = true;
        armCompletionWatchdog(item, synth);
        return;
      }
      try {
        synth.cancel();
      } catch {
      }
      cooldownUntil = Math.max(cooldownUntil, Date.now() + 100);
      finishItem(item);
    }
  }, 8e3);
}
function stopSpeaking() {
  for (const item of queue) item.cancelled = true;
  queue.length = 0;
  if (active) active.cancelled = true;
  active = null;
  if (ttsSupported()) window.speechSynthesis.cancel();
  clearStallTimer();
  cooldownUntil = Date.now() + 100;
}
var import_react2, voicesReady, bootTs, queue, active, pumpTimer, cooldownUntil, keepalive, stallTimer, primed, gestureSeen;
var init_speech = __esm({
  "src/shared/speech.ts"() {
    import_react2 = __toESM(require_react(), 1);
    init_speechTiming();
    voicesReady = false;
    bootTs = Date.now();
    initVoices();
    queue = [];
    active = null;
    pumpTimer = null;
    cooldownUntil = 0;
    keepalive = null;
    stallTimer = null;
    primed = false;
    gestureSeen = false;
    if (typeof window !== "undefined") {
      window.addEventListener("pointerdown", onFirstGesture, { once: true });
      window.addEventListener("keydown", onFirstGesture, { once: true });
    }
    if (typeof window !== "undefined") {
      ;
      window.__cf_tts = () => ({
        \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F: ttsSupported(),
        \u0431\u044B\u043B_\u0436\u0435\u0441\u0442_\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: gestureSeen,
        \u0433\u043E\u043B\u043E\u0441\u043E\u0432_\u0432_\u0441\u0438\u0441\u0442\u0435\u043C\u0435: ttsVoices().length,
        \u0433\u043E\u0432\u043E\u0440\u0438\u0442_\u0441\u0435\u0439\u0447\u0430\u0441: window.speechSynthesis?.speaking ?? false,
        \u043D\u0430_\u043F\u0430\u0443\u0437\u0435: window.speechSynthesis?.paused ?? false,
        \u0444\u0440\u0430\u0437_\u0432_\u043E\u0447\u0435\u0440\u0435\u0434\u0438: queue.length,
        \u0430\u043A\u0442\u0438\u0432\u043D\u0430\u044F_\u0444\u0440\u0430\u0437\u0430: active ? active.clean.slice(0, 60) : null
      });
    }
  }
});

// src/shared/voiceAudio.ts
function stopVoiceFileOnly() {
  if (currentVoiceAudio) {
    const a2 = currentVoiceAudio;
    currentVoiceAudio = null;
    a2.onended = null;
    a2.onerror = null;
    a2.onloadedmetadata = null;
    try {
      a2.pause();
      a2.currentTime = 0;
    } catch {
    }
  }
}
function stopVoiceAudio() {
  stopVoiceFileOnly();
  stopSpeaking();
}
var currentVoiceAudio;
var init_voiceAudio = __esm({
  "src/shared/voiceAudio.ts"() {
    init_speech();
    currentVoiceAudio = null;
  }
});

// src/core/hex.ts
function offsetToCube(h2) {
  const q2 = h2.col - (h2.row - (h2.row & 1)) / 2;
  const r2 = h2.row;
  return { q: q2, r: r2, s: -q2 - r2 };
}
function cubeToOffset(c2) {
  return { col: c2.q + (c2.r - (c2.r & 1)) / 2, row: c2.r };
}
function neighbors(h2) {
  const c2 = offsetToCube(h2);
  return CUBE_DIRS.map((d2) => cubeToOffset({ q: c2.q + d2.q, r: c2.r + d2.r, s: c2.s + d2.s }));
}
function hexDistance(a2, b2) {
  const ca = offsetToCube(a2);
  const cb = offsetToCube(b2);
  return Math.max(Math.abs(ca.q - cb.q), Math.abs(ca.r - cb.r), Math.abs(ca.s - cb.s));
}
function hexToPixel(h2, size, origin) {
  return {
    x: origin.x + size * SQRT3 * (h2.col + 0.5 * (h2.row & 1)),
    y: origin.y + size * 1.5 * h2.row
  };
}
function reachable(start, movePoints, passable, cost) {
  const dist = /* @__PURE__ */ new Map([[hexKey(start), 0]]);
  const frontier = [start];
  while (frontier.length) {
    frontier.sort((a2, b2) => (dist.get(hexKey(a2)) ?? 0) - (dist.get(hexKey(b2)) ?? 0));
    const cur = frontier.shift();
    const curCost = dist.get(hexKey(cur));
    for (const n2 of neighbors(cur)) {
      if (!passable(n2)) continue;
      const nc = curCost + cost(n2);
      if (nc > movePoints) continue;
      const k2 = hexKey(n2);
      if (nc < (dist.get(k2) ?? Infinity)) {
        dist.set(k2, nc);
        frontier.push(n2);
      }
    }
  }
  dist.delete(hexKey(start));
  return dist;
}
function astar(start, goal, passable, cost) {
  const startK = hexKey(start);
  const goalK = hexKey(goal);
  const open = [start];
  const came = /* @__PURE__ */ new Map();
  const g2 = /* @__PURE__ */ new Map([[startK, 0]]);
  const nodes = /* @__PURE__ */ new Map([[startK, start]]);
  while (open.length) {
    open.sort(
      (a2, b2) => g2.get(hexKey(a2)) + hexDistance(a2, goal) - (g2.get(hexKey(b2)) + hexDistance(b2, goal))
    );
    const cur = open.shift();
    const curK = hexKey(cur);
    if (curK === goalK) {
      const path = [];
      let k2 = goalK;
      while (k2 !== startK) {
        path.unshift(nodes.get(k2));
        k2 = came.get(k2);
      }
      return path;
    }
    for (const n2 of neighbors(cur)) {
      const nk = hexKey(n2);
      if (nk !== goalK && !passable(n2)) continue;
      const ng = g2.get(curK) + cost(n2);
      if (ng < (g2.get(nk) ?? Infinity)) {
        g2.set(nk, ng);
        came.set(nk, curK);
        nodes.set(nk, n2);
        if (!open.some((o2) => hexKey(o2) === nk)) open.push(n2);
      }
    }
  }
  return null;
}
var hexKey, CUBE_DIRS, SQRT3;
var init_hex = __esm({
  "src/core/hex.ts"() {
    hexKey = (h2) => `${h2.col},${h2.row}`;
    CUBE_DIRS = [
      { q: 1, r: 0, s: -1 },
      { q: 1, r: -1, s: 0 },
      { q: 0, r: -1, s: 1 },
      { q: -1, r: 0, s: 1 },
      { q: -1, r: 1, s: 0 },
      { q: 0, r: 1, s: -1 }
    ];
    SQRT3 = Math.sqrt(3);
  }
});

// src/core/combat.ts
function rollSigned(notation, rng) {
  const n2 = notation.trim();
  if (n2 === "0" || n2 === "") return 0;
  if (n2.startsWith("-")) return -rollDice(n2.slice(1), rng);
  if (n2.startsWith("+")) return rollDice(n2.slice(1), rng);
  return rollDice(n2, rng);
}
function maxOf(notation) {
  const n2 = notation.trim().replace(/^[+]/, "");
  const neg = n2.startsWith("-");
  const body = neg ? n2.slice(1) : n2;
  const m2 = body.match(/^(\d*)[dD](\d+)([+-]\d+)?$/);
  if (!m2) return Number(body) || 0;
  const v2 = (m2[1] ? parseInt(m2[1], 10) : 1) * parseInt(m2[2], 10) + (m2[3] ? parseInt(m2[3], 10) : 0);
  return neg ? -v2 : v2;
}
function labelResult(r2) {
  switch (r2) {
    case "critical":
      return "\u041A\u0420\u0418\u0422";
    case "hard":
      return "\u0443\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0439 \u0443\u0441\u043F\u0435\u0445";
    case "success":
      return "\u0443\u0441\u043F\u0435\u0445";
    case "fail":
      return "\u043F\u0440\u043E\u043C\u0430\u0445";
    case "fumble":
      return "\u041F\u0420\u041E\u0412\u0410\u041B";
  }
}
var RANK, FISTS, CombatController;
var init_combat = __esm({
  "src/core/combat.ts"() {
    init_hex();
    init_brp();
    init_dice();
    init_audio();
    RANK = { fumble: 0, fail: 1, success: 2, hard: 3, critical: 4 };
    FISTS = {
      skill: "brawl",
      damage: "1d3",
      damage_bonus: true,
      range: 1,
      attacks_per_round: 1,
      parry_capable: false,
      label: "\u041A\u0443\u043B\u0430\u043A\u0438"
    };
    CombatController = class {
      engine;
      arena;
      def;
      combatants = [];
      round = 1;
      activeIndex = 0;
      log = [];
      result = null;
      /** внезапное начало боя (аудит §5.6 п.12): сторона, начавшая внезапно */
      surprise;
      loot = [];
      blocked;
      difficult;
      /** гексы-укрытия арены (мастерская разметка cover_hexes), «c,r» */
      coverHexes;
      constructor(engine, def) {
        this.engine = engine;
        this.def = def;
        const arena = engine.campaign.arenas[def.arena];
        if (!arena) throw new Error(`\u0410\u0440\u0435\u043D\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430: ${def.arena}`);
        this.arena = arena;
        this.blocked = new Set((arena.hex_grid.blocked_hexes ?? []).map(([c2, r2]) => `${c2},${r2}`));
        this.difficult = new Set((arena.hex_grid.difficult_terrain ?? []).map(([c2, r2]) => `${c2},${r2}`));
        this.coverHexes = new Set((arena.hex_grid.cover_hexes ?? []).map(([c2, r2]) => `${c2},${r2}`));
        this.surprise = def.surprise;
        this.setup();
        const wStatus = this.weatherCombat?.status;
        if (wStatus) {
          for (const c2 of this.combatants) this.applyStatusTo(c2.id, wStatus);
          this.log.push(`\u041F\u043E\u0433\u043E\u0434\u0430: \xAB${this.statusLabel(wStatus)}\xBB \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u043D\u0430 \u0432\u0441\u0435\u0445.`);
        }
        if (def.intro) this.log.push(def.intro);
        if (this.surprise) {
          const side = this.surprise === "player" ? "\u0433\u0435\u0440\u043E\u044F" : "\u0432\u0440\u0430\u0433\u043E\u0432";
          this.log.push(`\u0412\u043D\u0435\u0437\u0430\u043F\u043D\u043E\u0441\u0442\u044C! \u0412\u0440\u0430\u0433\u0438${this.surprise === "player" ? " \u0437\u0430\u0441\u0442\u0438\u0433\u043D\u0443\u0442\u044B \u0432\u0440\u0430\u0441\u043F\u043B\u043E\u0445" : " \u0437\u0430\u0441\u0442\u0430\u044E\u0442 \u0432\u0430\u0441 \u0432\u0440\u0430\u0441\u043F\u043B\u043E\u0445"} \u2014 \u0441\u0442\u043E\u0440\u043E\u043D\u0430 ${side} \u043D\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u0432 \u043F\u0435\u0440\u0432\u043E\u043C \u0440\u0430\u0443\u043D\u0434\u0435 \u0438 \u043D\u0435 \u0437\u0430\u0449\u0438\u0449\u0430\u0435\u0442\u0441\u044F.`);
        }
        this.log.push(`\u2014 \u0420\u0430\u0443\u043D\u0434 1 \u2014`);
        this.startRound();
        this.processUntilPlayer();
      }
      // ─────────────── подготовка ───────────────
      setup() {
        const e2 = this.engine;
        const p2 = e2.state.player;
        const playerDef = e2.campaign.entities[p2.entity];
        const playerSpawns = [...this.arena.spawn_zones.player.hexes];
        const enemySpawns = [...this.arena.spawn_zones.enemy.hexes];
        const center = {
          col: Math.floor(this.arena.hex_grid.cols / 2),
          row: Math.floor(this.arena.hex_grid.rows / 2)
        };
        const playerAnchor = playerSpawns.length ? { col: playerSpawns[0][0], row: playerSpawns[0][1] } : center;
        const enemyAnchor = enemySpawns.length ? { col: enemySpawns[0][0], row: enemySpawns[0][1] } : center;
        const pw = e2.playerWeapon();
        const pa = e2.playerArmor();
        const appearanceFigure = e2.heroCombatFigure();
        const weapon = pw.weapon;
        const weaponLabel = pw.label;
        const encDebuffs = e2.encumbranceDebuffs();
        const overloaded = encDebuffs.status !== "normal";
        let playerSkills = p2.skills;
        if (overloaded) {
          playerSkills = { ...p2.skills };
          if (encDebuffs.dodgePenalty > 0) {
            playerSkills.dodge = Math.max(0, (playerSkills.dodge ?? 0) - encDebuffs.dodgePenalty);
          }
          if (encDebuffs.skillPenalty > 0) {
            if (playerSkills.stealth !== void 0) {
              playerSkills.stealth = Math.max(0, playerSkills.stealth - encDebuffs.skillPenalty);
            }
            if (playerSkills.athletics !== void 0) {
              playerSkills.athletics = Math.max(0, playerSkills.athletics - encDebuffs.skillPenalty);
            }
          }
        }
        this.combatants.push({
          id: "c_player",
          entityId: p2.entity,
          label: playerDef.label,
          side: "player",
          portrait: [playerDef.token, playerDef.portrait?.neutral].map((s2) => (s2 ?? "").trim()).find(Boolean) || void 0,
          figure: appearanceFigure.figure ?? playerDef.combat_figure,
          figure_mode: appearanceFigure.mode ?? playerDef.figure_mode ?? "topdown",
          figure_shadow: playerDef.shadow,
          facing: 90,
          flip: false,
          facing_offset: appearanceFigure.offset ?? playerDef.facing_offset,
          stats: p2.stats,
          skills: playerSkills,
          weapon,
          weaponLabel,
          weaponItemId: pw.itemId,
          armor: pa.points,
          hp: p2.hp,
          maxHp: p2.max_hp,
          pos: this.takeSpawn(playerSpawns, playerAnchor),
          mov: Math.max(1, movement(p2.stats) - encDebuffs.movPenalty),
          movLeft: 0,
          statuses: [],
          mp: p2.mp,
          maxMp: p2.max_mp,
          abilities: playerDef.abilities ?? [],
          cooldowns: {},
          attacksLeft: 0,
          attacked: false,
          defensesUsed: 0,
          dead: false
        });
        if (overloaded) {
          const parts = [];
          if (encDebuffs.movPenalty > 0) parts.push(`\u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435 \u2212${encDebuffs.movPenalty}`);
          if (encDebuffs.dodgePenalty > 0) parts.push(`\u0443\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0435 \u2212${encDebuffs.dodgePenalty}%`);
          if (encDebuffs.skillPenalty > 0) parts.push(`\u043B\u043E\u0432\u043A\u043E\u0441\u0442\u044C \u2212${encDebuffs.skillPenalty}%`);
          this.log.push(`\u0412\u044B \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0436\u0435\u043D\u044B (${encDebuffs.label}): ${parts.join(", ")}.`);
        }
        for (const comp of e2.state.party) {
          const def = e2.campaign.entities[comp.entity];
          if (!def || def.type !== "npc") continue;
          if (comp.hp <= 0) continue;
          const battleDef = comp.equipment && Object.keys(comp.equipment).length ? { ...def, equipment: { ...def.equipment ?? {}, ...comp.equipment } } : def;
          const w2 = this.resolveWeapon(battleDef, def.skills ?? {});
          let allySkills = def.skills ?? {};
          const exhausted = Object.entries(comp.needs ?? {}).some(([id, v2]) => {
            const nd = e2.campaign.meta.needs.find((n3) => n3.id === id);
            return nd != null && v2 <= nd.critical_threshold;
          });
          if (exhausted) {
            allySkills = Object.fromEntries(Object.entries(allySkills).map(([k2, v2]) => [k2, Math.max(0, Math.round(v2 * 0.9))]));
            this.log.push(`${def.label} \u0438\u0441\u0442\u043E\u0449\u0451\u043D(\u0430): \u043D\u0430\u0432\u044B\u043A\u0438 \u221210%.`);
          }
          this.combatants.push({
            id: `c_ally_${comp.entity}`,
            entityId: comp.entity,
            label: def.label,
            side: "player",
            portrait: [def.token, def.portrait?.neutral].map((s2) => (s2 ?? "").trim()).find(Boolean) || void 0,
            figure: def.combat_figure,
            figure_mode: def.figure_mode ?? "topdown",
            figure_shadow: def.shadow,
            facing: 90,
            flip: false,
            facing_offset: def.facing_offset,
            stats: def.stats,
            skills: allySkills,
            weapon: w2.weapon,
            weaponLabel: w2.weaponLabel,
            weaponItemId: w2.weaponItemId,
            armor: this.resolveArmor(battleDef),
            hp: comp.hp,
            maxHp: comp.max_hp,
            pos: this.takeSpawn(playerSpawns, this.combatants[0]?.pos ?? playerAnchor),
            mov: movement(def.stats),
            movLeft: 0,
            statuses: [],
            mp: derivedMP(def.stats),
            maxMp: derivedMP(def.stats),
            abilities: def.abilities ?? [],
            cooldowns: {},
            attacksLeft: 0,
            attacked: false,
            defensesUsed: 0,
            dead: false
          });
        }
        let a2 = 0;
        for (const grp of this.def.allies ?? []) {
          const def = e2.campaign.entities[grp.entity];
          if (!def || def.type !== "npc") continue;
          for (let i2 = 0; i2 < grp.count; i2++) {
            a2++;
            const hp = def.stats.HP ?? derivedHP(def.stats);
            const w2 = this.resolveWeapon(def, def.skills ?? {});
            this.combatants.push({
              id: `c_tally_${grp.entity}_${a2}`,
              entityId: grp.entity,
              label: grp.count > 1 ? `${def.label} ${a2}` : def.label,
              side: "player",
              portrait: [def.token, def.portrait?.neutral].map((s2) => (s2 ?? "").trim()).find(Boolean) || void 0,
              figure: def.combat_figure,
              figure_mode: def.figure_mode ?? "topdown",
              figure_shadow: def.shadow,
              facing: 90,
              flip: false,
              facing_offset: def.facing_offset,
              stats: def.stats,
              skills: def.skills ?? {},
              weapon: w2.weapon,
              weaponLabel: w2.weaponLabel,
              weaponItemId: w2.weaponItemId,
              armor: this.resolveArmor(def),
              hp,
              maxHp: hp,
              pos: this.takeSpawn(playerSpawns, this.combatants[0]?.pos ?? playerAnchor),
              mov: movement(def.stats),
              movLeft: 0,
              statuses: [],
              mp: derivedMP(def.stats),
              maxMp: derivedMP(def.stats),
              abilities: def.abilities ?? [],
              cooldowns: {},
              attacksLeft: 0,
              attacked: false,
              defensesUsed: 0,
              dead: false
            });
          }
        }
        let n2 = 0;
        for (const grp of this.def.enemies) {
          const def = e2.campaign.entities[grp.entity];
          if (!def) continue;
          for (let i2 = 0; i2 < grp.count; i2++) {
            n2++;
            const hp = def.stats.HP ?? derivedHP(def.stats);
            const w2 = this.resolveWeapon(def, def.skills ?? {});
            this.combatants.push({
              id: `c_enemy_${n2}`,
              entityId: def.id,
              label: grp.count > 1 ? `${def.label} ${i2 + 1}` : def.label,
              side: "enemy",
              portrait: [def.token, def.portrait?.neutral].map((s2) => (s2 ?? "").trim()).find(Boolean) || void 0,
              figure: def.combat_figure,
              figure_mode: def.figure_mode ?? "topdown",
              figure_shadow: def.shadow,
              facing: -90,
              flip: true,
              facing_offset: def.facing_offset,
              stats: def.stats,
              skills: def.skills ?? {},
              weapon: w2.weapon,
              weaponLabel: w2.weaponLabel,
              weaponItemId: w2.weaponItemId,
              armor: this.resolveArmor(def),
              hp,
              maxHp: hp,
              pos: this.takeSpawn(enemySpawns, enemyAnchor),
              mov: movement(def.stats),
              movLeft: 0,
              statuses: [],
              mp: derivedMP(def.stats),
              maxMp: derivedMP(def.stats),
              abilities: def.abilities ?? [],
              cooldowns: {},
              attacksLeft: 0,
              attacked: false,
              defensesUsed: 0,
              dead: false
            });
          }
        }
        this.combatants.sort((a3, b2) => b2.stats.DEX - a3.stats.DEX || (this.engine.rng.chance(0.5) ? -1 : 1));
      }
      takeSpawn(spawns, anchor) {
        while (spawns.length) {
          const [col, row] = spawns.shift();
          const h2 = { col, row };
          if (this.inBounds(h2) && !this.isBlocked(h2) && !this.occupantAt(h2)) return h2;
        }
        return this.nearestFreeHex(anchor);
      }
      /** ближайший к anchor свободный и проходимый гекс сетки (кольцевой обход) */
      nearestFreeHex(anchor) {
        let best = null;
        let bestD = Infinity;
        for (let row = 0; row < this.arena.hex_grid.rows; row++) {
          for (let col = 0; col < this.arena.hex_grid.cols; col++) {
            const h2 = { col, row };
            if (this.isBlocked(h2) || this.occupantAt(h2)) continue;
            const d2 = hexDistance(anchor, h2);
            if (d2 < bestD) {
              bestD = d2;
              best = h2;
            }
          }
        }
        return best ?? anchor;
      }
      resolveWeapon(def, skills) {
        const weaponItemId = def.equipment?.weapon;
        if (weaponItemId) {
          const item = this.engine.campaign.entities[weaponItemId];
          if (item?.weapon_data) return { weapon: item.weapon_data, weaponLabel: item.label, weaponItemId };
        }
        if (def.natural_weapon) return { weapon: def.natural_weapon, weaponLabel: def.natural_weapon.label ?? "\u0410\u0442\u0430\u043A\u0430", weaponItemId: null };
        void skills;
        return { weapon: FISTS, weaponLabel: FISTS.label, weaponItemId: null };
      }
      resolveArmor(def) {
        if (def.armor != null) return def.armor;
        let points = 0;
        for (const itemId of Object.values(def.equipment ?? {})) {
          const item = this.engine.campaign.entities[itemId];
          if (item?.armor_data) points += item.armor_data.points;
        }
        return points;
      }
      // ─────────────── доступ ───────────────
      get active() {
        return this.combatants[this.activeIndex];
      }
      isPlayerTurn() {
        return !this.result && this.active.id === "c_player";
      }
      occupantAt(h2) {
        return this.combatants.find((c2) => !c2.dead && !c2.down && c2.pos.col === h2.col && c2.pos.row === h2.row);
      }
      inBounds(h2) {
        return h2.col >= 0 && h2.row >= 0 && h2.col < this.arena.hex_grid.cols && h2.row < this.arena.hex_grid.rows;
      }
      isBlocked(h2) {
        return this.blocked.has(hexKey(h2));
      }
      isDifficult(h2) {
        return this.difficult.has(hexKey(h2));
      }
      /** гекс-укрытие? (мастерская разметка cover_hexes на арене) */
      isCover(h2) {
        return this.coverHexes.has(hexKey(h2));
      }
      passable = (h2) => this.inBounds(h2) && !this.isBlocked(h2) && !this.occupantAt(h2);
      moveCost = (h2) => this.isDifficult(h2) ? 2 : 1;
      /** Гексы, куда может дойти активный боец. */
      reachableHexes() {
        const a2 = this.active;
        return reachable(a2.pos, a2.movLeft, this.passable, this.moveCost);
      }
      /**
       * Разворот фигурки к точке (блок 3 ТЗ): 'topdown' — поворот по направлению,
       * 'side' — зеркало по горизонтали, 'static' и жетоны не трогаем.
       * Вращается только картинка — гекс-логика не меняется.
       */
      faceTowards(c2, to) {
        if (!c2.figure || (c2.figure_mode ?? "topdown") === "static") return;
        const size = this.arena.hex_grid.hex_size;
        const a2 = hexToPixel(c2.pos, size, { x: 0, y: 0 });
        const b2 = hexToPixel(to, size, { x: 0, y: 0 });
        const dx = b2.x - a2.x;
        const dy = b2.y - a2.y;
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;
        if ((c2.figure_mode ?? "topdown") === "side") c2.flip = dx < 0;
        else c2.facing = Math.atan2(dx, -dy) * 180 / Math.PI;
      }
      canAttack(attacker, target) {
        return !attacker.attacked && attacker.attacksLeft > 0 && !attacker.dead && !attacker.down && !target.dead && !target.down && !target.fled && !(target.hidden && attacker.side === "enemy") && attacker.side !== target.side && !this.outOfAmmo(attacker) && hexDistance(attacker.pos, target.pos) <= this.weaponRange(attacker);
      }
      /** нет боеприпасов к оружию (аудит B5: weapon.ammo_item) — только для игрока */
      outOfAmmo(attacker) {
        const ammo = attacker.weapon.ammo_item;
        if (!ammo || attacker.id !== "c_player") return false;
        return this.engine.itemCount(ammo) <= 0;
      }
      /**
       * Может ли герой прятаться в этом бою (аудит §5.6 п.12):
       * мастер включил скрытность кампании, бой не запретил ukрытие.
       */
      canHide() {
        if (this.def.no_hide) return false;
        return !!this.engine.campaign.meta.stealth;
      }
      /**
       * Действие «скрыться» (тратит действие за ход): проверка скрытности героя
       * против лучшей внимательности живых врагов. Успех — `hidden`, враги
       * теряют вас из виду до следующей вашей атаки.
       */
      playerHide() {
        if (!this.isPlayerTurn() || this.active.attacked || !this.canHide()) return;
        const pc = this.active;
        const st2 = this.engine.campaign.meta.stealth;
        const foes = this.combatants.filter((c2) => c2.side === "enemy" && !c2.dead && !c2.fled && !c2.down);
        const best = foes.map((c2) => {
          const def = this.engine.campaign.entities[c2.entityId];
          const v2 = def?.perception ?? Math.max(1, (c2.skills[st2.perception_skill ?? "perception"] ?? 0) || c2.stats.INT * 2);
          return { label: def?.label ?? c2.entityId, value: v2 };
        }).sort((a2, b2) => b2.value - a2.value)[0];
        this.spendAction(pc);
        if (!best) return;
        const mine = skillCheck(
          Math.max(1, (pc.skills[st2.skill ?? "stealth"] ?? 0) + this.statusSkillMod(pc, st2.skill ?? "stealth")),
          this.engine.rng,
          0,
          this.engine.diceRules
        );
        const theirs = skillCheck(best.value, this.engine.rng, 0, this.engine.diceRules);
        const RANK2 = { fumble: 0, fail: 1, success: 2, hard: 3, critical: 4 };
        const wins = (RANK2[mine.result] ?? 1) >= (RANK2[theirs.result] ?? 1);
        this.log.push(
          `${pc.label}: \u0441\u043A\u0440\u044B\u0442\u043D\u043E\u0441\u0442\u044C \u2014 ${mine.roll}/${mine.target} \u043F\u0440\u043E\u0442\u0438\u0432 \xAB${best.label}\xBB ${theirs.roll}/${theirs.target} \u2192 ${wins ? "\u0432\u044B \u0441\u043A\u0440\u044B\u043B\u0438\u0441\u044C" : "\u0432\u0430\u0441 \u0434\u0435\u0440\u0436\u0430\u0442 \u0432 \u043F\u043E\u043B\u0435 \u0437\u0440\u0435\u043D\u0438\u044F"}`
        );
        if (wins) {
          pc.hidden = true;
          this.log.push(`${pc.label} \u0438\u0441\u0447\u0435\u0437\u0430\u0435\u0442 \u0438\u0437 \u0432\u0438\u0434\u0443.`);
        }
        if (!this.result && pc.attacksLeft <= 0) {
          this.nextTurn();
          this.processUntilPlayer();
        }
        this.engine.notify();
      }
      // ─────────────── боевые правила кампании (мастер; аудит §5.6) ───────────────
      /** настройки боя из campaign.json (meta.combat) — всё с умолчаниями */
      combatRules() {
        return this.engine.campaign.meta.combat;
      }
      /** погодные боевые модификаторы (аудит B7): настройки в meta.weathers[].combat */
      get weatherCombat() {
        return this.engine.campaign.meta.weathers?.find((w2) => w2.id === this.engine.state.weather)?.combat;
      }
      /** сдвиг навыка от погоды */
      weatherSkillMod(skill) {
        let mod = 0;
        for (const m2 of this.weatherCombat?.skill_mods ?? []) if (m2.skill === skill) mod += m2.delta;
        return mod;
      }
      /** дальность оружия с погодным ограничением (минимум 1) */
      weaponRange(c2) {
        const pen = Math.max(0, this.weatherCombat?.range_penalty ?? 0);
        return Math.max(1, c2.weapon.range - pen);
      }
      /** штраф следующей атаки в раунде (умолчание −20, BRP-разделение) */
      get multiAttackPenalty() {
        return this.combatRules()?.multi_attack_penalty ?? -20;
      }
      /** правила гибели героя: instant (умолчание) | brp */
      get deathMode() {
        return this.combatRules()?.death?.mode ?? "instant";
      }
      /** действие израсходовано не-атакой (предмет/способность) */
      spendAction(c2) {
        c2.attacked = true;
        c2.attacksLeft = 0;
      }
      /** бонус прицельной атаки (meta.combat.aim; умолчание вкл., +20) */
      aimEnabled() {
        return this.combatRules()?.aim !== false;
      }
      /** прицеливание: тратит одну атаку, следующая — с бонусом */
      playerAim() {
        if (!this.isPlayerTurn() || !this.aimEnabled()) return;
        const pc = this.active;
        if (pc.attacked || pc.attacksLeft <= 0 || (pc.aimBonus ?? 0) > 0) return;
        pc.attacksLeft -= 1;
        if (pc.attacksLeft <= 0) pc.attacked = true;
        const cfg = this.combatRules()?.aim;
        pc.aimBonus = typeof cfg === "object" && cfg?.bonus != null ? cfg.bonus : 20;
        this.log.push(`${pc.label} \u043F\u0440\u0438\u0446\u0435\u043B\u0438\u0432\u0430\u0435\u0442\u0441\u044F\u2026 (\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0430\u044F \u0430\u0442\u0430\u043A\u0430 +${pc.aimBonus}%)`);
        if (!this.result && pc.attacksLeft <= 0) {
          this.nextTurn();
          this.processUntilPlayer();
        }
        this.engine.notify();
      }
      // ─────────────── действия игрока ───────────────
      playerMoveTo(h2) {
        if (!this.isPlayerTurn()) return;
        const r2 = this.reachableHexes();
        const cost = r2.get(hexKey(h2));
        if (cost == null) return;
        const from = { ...this.active.pos };
        this.faceTowards(this.active, h2);
        this.active.pos = { ...h2 };
        this.active.movLeft -= cost;
        this.triggerOpportunity(this.active, from);
        this.checkEnd();
        this.engine.notify();
      }
      /**
       * Атаки возможности (аудит B5): уход из зоны контроля врага — враг бьёт
       * напоследок бесплатно. Умолчание вкл.; meta.combat.opportunity_attacks.
       */
      triggerOpportunity(mover, from) {
        if (this.combatRules()?.opportunity_attacks === false) return;
        if (hexDistance(from, mover.pos) === 0) return;
        for (const foe of this.combatants) {
          if (this.result || mover.dead || mover.down) return;
          if (foe.side === mover.side || foe.dead || foe.down || foe.fled) continue;
          if (foe.hidden && mover.side === "enemy") continue;
          if (hexDistance(foe.pos, from) > this.weaponRange(foe)) continue;
          if (hexDistance(foe.pos, mover.pos) <= this.weaponRange(foe)) continue;
          if (this.outOfAmmo(foe)) continue;
          this.log.push(`${foe.label} \u0440\u0443\u0431\u0438\u0442 \u0432\u0441\u043B\u0435\u0434 \u0443\u0445\u043E\u0434\u044F\u0449\u0435\u043C\u0443 ${mover.label}!`);
          this.faceTowards(foe, mover.pos);
          this.resolveAttack(foe, mover, { free: true });
        }
      }
      playerAttack(targetId) {
        if (!this.isPlayerTurn()) return;
        const target = this.combatants.find((c2) => c2.id === targetId);
        if (!target || !this.canAttack(this.active, target)) return;
        this.faceTowards(this.active, target.pos);
        this.resolveAttack(this.active, target);
        this.checkEnd();
        if (!this.result && this.active.attacksLeft <= 0) {
          this.nextTurn();
          this.processUntilPlayer();
        }
        this.engine.notify();
      }
      /**
       * Предпросмотр шансов атаки (Combat Forecast) для подсказок и плашек игрока.
       */
      estimateAttack(attacker, defender) {
        const apr = Math.max(1, attacker.weapon.attacks_per_round ?? 1);
        const penalty = (apr - attacker.attacksLeft) * this.multiAttackPenalty;
        const aim = attacker.aimBonus ?? 0;
        const fromShadow = !!attacker.hidden;
        const flank = this.flankRules();
        const fromBehind = !!flank && this.isRearArc(defender, attacker.pos, flank.arc);
        const skillVal = Math.max(
          1,
          (attacker.skills[attacker.weapon.skill] ?? 25) + this.statusSkillMod(attacker, attacker.weapon.skill) + this.weatherSkillMod(attacker.weapon.skill) + aim
        );
        const coverP = attacker.weapon.range > 1 && this.coverHexes.has(hexKey(defender.pos)) ? this.coverPenalty() : null;
        const target = Math.max(1, Math.min(95, skillVal + penalty + (coverP ?? 0)));
        const dbNotation = attacker.weapon.damage_bonus ? damageBonus(attacker.stats) : "";
        const dbStr = dbNotation && dbNotation !== "0" ? dbNotation.startsWith("+") || dbNotation.startsWith("-") ? dbNotation : `+${dbNotation}` : "";
        const damage = `${attacker.weapon.damage}${dbStr}`;
        const armor = defender.armor;
        return {
          hitChance: target,
          target,
          damage,
          armor,
          penalty,
          aim,
          cover: coverP,
          fromBehind,
          fromShadow
        };
      }
      /**
       * Предпросмотр применения способности по цели.
       */
      estimateAbility(caster, ab, _target) {
        if (ab.kind === "heal") {
          return { hitChance: 100, targetVal: 100, effectLabel: `\u041B\u0435\u0447\u0435\u043D\u0438\u0435: ${ab.heal ?? "1d6"}` };
        }
        const skill = ab.skill ?? "magic";
        const base = caster.skills[skill] ?? 25;
        const mod = this.statusSkillMod(caster, skill) + this.weatherSkillMod(skill);
        const targetVal = Math.max(1, Math.min(95, base + mod));
        const parts = [];
        if (ab.damage) parts.push(`\u0423\u0440\u043E\u043D: ${ab.damage}`);
        if (ab.status) parts.push(`\u0421\u0442\u0430\u0442\u0443\u0441: \xAB${this.statusLabel(ab.status)}\xBB (${ab.status_duration ?? 2} \u0440.)`);
        return {
          hitChance: targetVal,
          targetVal,
          effectLabel: parts.join(" \xB7 ") || "\u0412\u043E\u0437\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435"
        };
      }
      /** Может ли игрок бежать из этого боя (аудит §5.6 п.2). */
      canFlee() {
        if (this.def.no_flee) return false;
        return this.combatRules()?.flee !== false;
      }
      /**
       * Отступление: враги в досягаемости бьют напоследок (бесплатные атаки),
       * затем проверка навыка отступления (умолчание dodge, иначе DEX×5).
       * Успех — бой окончен бегством (`on_fled` эффекта start_combat);
       * провал — ход потерян.
       */
      playerFlee() {
        if (!this.isPlayerTurn() || !this.canFlee()) return;
        const pc = this.active;
        const foes = this.combatants.filter(
          (c2) => c2.side === "enemy" && !c2.dead && !c2.fled && !c2.down && hexDistance(c2.pos, pc.pos) <= this.weaponRange(c2)
        );
        if (foes.length) this.log.push("\u0412\u044B \u0431\u0440\u043E\u0441\u0430\u0435\u0442\u0435\u0441\u044C \u043F\u0440\u043E\u0447\u044C \u2014 \u0432\u0440\u0430\u0433\u0438 \u0440\u0443\u0431\u044F\u0442 \u0432\u0441\u043B\u0435\u0434!");
        for (const foe of foes) {
          this.resolveAttack(foe, pc, { free: true });
          if (pc.dead || pc.down) break;
        }
        this.checkEnd();
        if (this.result) {
          this.engine.notify();
          return;
        }
        const cfg = this.combatRules()?.flee;
        const skill = typeof cfg === "object" && cfg?.skill || "dodge";
        const known = pc.skills[skill];
        const base = known != null ? known + this.statusSkillMod(pc, skill) : pc.stats.DEX * 5;
        const out = skillCheck(Math.max(1, base), this.engine.rng, foes.length ? -20 : 0, this.engine.diceRules);
        this.log.push(
          `${pc.label}: \u043E\u0442\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0435 \u2014 ${known != null ? `\u043D\u0430\u0432\u044B\u043A \xAB${this.engine.skillLabel(skill)}\xBB` : "DEX\xD75"}, d100=${out.roll} \u043F\u0440\u043E\u0442\u0438\u0432 ${out.target} \u2192 ${labelResult(out.result)}`
        );
        if (out.success) {
          pc.fled = true;
          this.result = "fled";
          this.log.push("\u0412\u044B \u0432\u044B\u0440\u044B\u0432\u0430\u0435\u0442\u0435\u0441\u044C \u0438\u0437 \u0431\u043E\u044F!");
          playUi("flee");
          this.engine.onCombatResolve(this.def.on_fled ?? []);
          if (out.result === "critical") this.engine.markSkill(skill);
        } else {
          this.log.push("\u041E\u0442\u0441\u0442\u0443\u043F\u0438\u0442\u044C \u043D\u0435 \u0432\u044B\u0448\u043B\u043E \u2014 \u0445\u043E\u0434 \u043F\u043E\u0442\u0435\u0440\u044F\u043D.");
          this.spendAction(pc);
          this.nextTurn();
          this.processUntilPlayer();
        }
        this.engine.notify();
      }
      /** Использование предмета в бою — тратит действие атаки (ТЗ 6.1). */
      playerUseItem(itemId) {
        if (!this.isPlayerTurn() || this.active.attacked) return;
        const item = this.engine.campaign.entities[itemId];
        if (!item || item.type !== "item" || !item.on_use) return;
        this.spendAction(this.active);
        this.engine.applyEffects(item.on_use.effects);
        if (item.on_use.consume !== false) this.engine.removeItem(itemId, 1);
        const pc = this.combatants.find((x2) => x2.id === "c_player");
        pc.hp = Math.min(pc.maxHp, this.engine.state.player.hp);
        this.log.push(`${this.active.label} \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442 \xAB${item.label}\xBB.`);
        playInteraction("use", { entity: item });
        this.engine.notify();
      }
      /** Предметы игрока, применимые в бою. */
      usableItems() {
        return this.engine.state.player.inventory.map((e2) => ({ e: e2, def: this.engine.campaign.entities[e2.item] })).filter((x2) => x2.def?.type === "item" && x2.def.on_use).map((x2) => ({ id: x2.e.item, label: x2.def.label, quantity: x2.e.quantity }));
      }
      playerEndTurn() {
        if (!this.isPlayerTurn()) return;
        this.nextTurn();
        this.processUntilPlayer();
        this.engine.notify();
      }
      // ─────────────── цикл раундов ───────────────
      startRound() {
        this.tickStatuses();
        for (const c2 of this.combatants) {
          if (c2.down || c2.fled || c2.dead) {
            c2.movLeft = 0;
            c2.attacksLeft = 0;
            c2.attacked = true;
            continue;
          }
          c2.movLeft = Math.max(1, c2.mov + this.statusMovMod(c2) - Math.max(0, this.weatherCombat?.mov_penalty ?? 0));
          c2.attacksLeft = Math.max(1, c2.weapon.attacks_per_round ?? 1);
          c2.defensesUsed = 0;
          c2.attacked = false;
          if (c2.skipNext) {
            c2.skipNext = false;
            c2.movLeft = 0;
            c2.attacksLeft = 0;
            c2.attacked = true;
          }
          if (this.round === 1 && this.surprise) {
            const ambusher = this.surprise === "player" ? "player" : "enemy";
            if (c2.side !== ambusher) {
              c2.movLeft = 0;
              c2.attacksLeft = 0;
              c2.attacked = true;
            }
          }
          for (const k2 of Object.keys(c2.cooldowns)) {
            c2.cooldowns[k2] -= 1;
            if (c2.cooldowns[k2] <= 0) delete c2.cooldowns[k2];
          }
        }
      }
      /** определение способности из реестра кампании */
      abilityDef(id) {
        return this.engine.campaign.meta.abilities?.find((a2) => a2.id === id);
      }
      // ─────────────── статусы бойцов (блок 5 ТЗ) ───────────────
      statusDef(id) {
        return this.engine.campaign.meta.statuses?.find((s2) => s2.id === id);
      }
      /** название статуса для UI */
      statusLabel(id) {
        return this.statusDef(id)?.label ?? id;
      }
      /** наложить боевой статус на бойца (блок 6 будет звать из способностей) */
      applyStatusTo(combatantId, statusId, duration) {
        const def = this.statusDef(statusId);
        if (!def || def.scope === "world") return;
        const c2 = this.combatants.find((x2) => x2.id === combatantId);
        if (!c2 || c2.dead) return;
        const left = duration ?? def.duration;
        if (left <= 0) return;
        const existing = c2.statuses.find((s2) => s2.id === statusId);
        if (existing) {
          existing.left = Math.max(existing.left, left);
        } else {
          c2.statuses.push({ id: statusId, left });
          this.log.push(def.apply_message ?? `${c2.label}: ${def.label.toLowerCase()}.`);
        }
        this.engine.notify();
      }
      removeStatusFrom(combatantId, statusId) {
        const c2 = this.combatants.find((x2) => x2.id === combatantId);
        if (!c2) return;
        c2.statuses = c2.statuses.filter((s2) => s2.id !== statusId);
        this.engine.notify();
      }
      /** суммарный модификатор навыка бойца от его статусов */
      statusSkillMod(c2, skill) {
        let mod = 0;
        for (const s2 of c2.statuses) {
          const def = this.statusDef(s2.id);
          for (const m2 of def?.skill_mods ?? []) if (m2.skill === skill) mod += m2.delta;
        }
        return mod;
      }
      statusMovMod(c2) {
        let mod = 0;
        for (const s2 of c2.statuses) mod += this.statusDef(s2.id)?.mov_mod ?? 0;
        return mod;
      }
      /** тик статусов в начале раунда: DoT, декремент, истечение */
      tickStatuses() {
        for (const c2 of this.combatants) {
          if (c2.dead || !c2.statuses.length) continue;
          const expired = [];
          for (const s2 of c2.statuses) {
            const def = this.statusDef(s2.id);
            if (!def) continue;
            if (def.dot?.hp) {
              c2.hp = Math.max(0, c2.hp - def.dot.hp);
              this.log.push(`${c2.label}: ${def.label.toLowerCase()} \u2014 \u2212${def.dot.hp} HP.`);
              if (c2.hp <= 0 && !c2.down) {
                if (c2.id === "c_player" && this.deathMode === "brp" && this.conSave(c2, `\u0441\u0442\u0430\u0442\u0443\u0441 \xAB${def.label}\xBB`)) {
                  c2.hp = 1;
                  c2.down = true;
                  this.log.push(`${c2.label} \u043F\u0430\u0434\u0430\u0435\u0442 \u0431\u0435\u0437 \u0441\u043E\u0437\u043D\u0430\u043D\u0438\u044F \u043E\u0442 \u0441\u0442\u0430\u0442\u0443\u0441\u0430 \u2014 \u043D\u043E \u0434\u044B\u0448\u0438\u0442. (1 HP)`);
                } else {
                  c2.dead = true;
                  this.log.push(`${c2.label} \u043F\u043E\u0433\u0438\u0431\u0430\u0435\u0442 \u043E\u0442 \u0441\u0442\u0430\u0442\u0443\u0441\u0430 \xAB${def.label}\xBB.`);
                  playUi("kill");
                }
              }
            }
            if (!c2.dead) s2.left -= 1;
            if (s2.left <= 0) expired.push(def);
          }
          if (expired.length) {
            c2.statuses = c2.statuses.filter((s2) => s2.left > 0);
            for (const def of expired) this.log.push(`${c2.label}: \xAB${def.label}\xBB \u0437\u0430\u043A\u0430\u043D\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F.`);
          }
        }
      }
      nextTurn() {
        let guard = 0;
        do {
          this.activeIndex++;
          if (this.activeIndex >= this.combatants.length) {
            this.activeIndex = 0;
            this.round++;
            this.log.push(`\u2014 \u0420\u0430\u0443\u043D\u0434 ${this.round} \u2014`);
            this.startRound();
            this.checkEnd();
          }
          guard++;
        } while (!this.result && (this.active.dead || this.active.down || this.active.fled) && guard < 100);
      }
      processUntilPlayer() {
        let guard = 0;
        while (!this.result && this.active.id !== "c_player" && guard < 200) {
          this.aiTurn(this.active);
          this.checkEnd();
          if (this.result) break;
          this.nextTurn();
          guard++;
        }
        if (!this.result && (this.active.dead || this.active.down || this.active.fled) && this.active.id !== "c_player")
          this.nextTurn();
      }
      // ─────────────── AI (базовый: к ближайшему, атаковать) ───────────────
      /** шаг отступления: уйти на максимально дальний гекс в радиусе хода (приказ 'retreat') */
      stepAway(c2, foe) {
        const reach = reachable(c2.pos, c2.movLeft, this.passable, this.moveCost);
        let bestKey = null;
        let bestScore = hexDistance(c2.pos, foe.pos);
        for (const [k2, cost] of reach) {
          const [col, row] = k2.split(",").map(Number);
          const d2 = hexDistance({ col, row }, foe.pos);
          if (d2 > bestScore) {
            bestScore = d2;
            bestKey = k2;
            void cost;
          }
        }
        if (bestKey) {
          const [col, row] = bestKey.split(",").map(Number);
          c2.movLeft -= reach.get(bestKey) ?? 0;
          c2.pos = { col, row };
        }
      }
      /** приказы отряду для UI (аудит §5.6 п.11) */
      companionOrders() {
        const out = [];
        for (const comp of this.engine.state.party) {
          const c2 = this.combatants.find((x2) => x2.id === `c_ally_${comp.entity}`);
          if (!c2 || c2.dead) continue;
          const def = this.engine.campaign.entities[comp.entity];
          out.push({ entityId: comp.entity, label: def?.label ?? comp.entity, order: comp.order ?? "free" });
        }
        return out;
      }
      /** смена приказа напарнику */
      setCompanionOrder(entityId, order) {
        const comp = this.engine.state.party.find((x2) => x2.entity === entityId);
        if (!comp) return;
        comp.order = order === "free" ? void 0 : order;
        this.engine.notify();
      }
      aiTurn(c2) {
        if (c2.fled || c2.down || c2.dead) return;
        if (c2.side === "player" && c2.id !== "c_player") {
          const comp = this.engine.state.party.find((x2) => x2.entity === c2.entityId);
          const order = comp?.order ?? "free";
          const hero = this.combatants.find((x2) => x2.id === "c_player");
          if (order === "hold") {
            const near = this.combatants.find((x2) => x2.side === "enemy" && !x2.dead && !x2.fled && !x2.down && hexDistance(c2.pos, x2.pos) <= this.weaponRange(c2));
            if (near) this.resolveAttack(c2, near);
            return;
          }
          if (order === "retreat") {
            const foes = this.combatants.filter((x2) => x2.side === "enemy" && !x2.dead && !x2.fled && !x2.down);
            if (foes.length && c2.movLeft > 0) {
              const nearest = foes.sort((a2, b2) => hexDistance(c2.pos, a2.pos) - hexDistance(c2.pos, b2.pos))[0];
              if (hexDistance(c2.pos, nearest.pos) <= 2) {
                const from = { ...c2.pos };
                this.stepAway(c2, nearest);
                this.triggerOpportunity(c2, from);
              }
            }
            return;
          }
          if (order === "follow") {
            if (hexDistance(c2.pos, hero.pos) > 2 && c2.movLeft > 0) {
              const path = astar(c2.pos, hero.pos, this.passable, this.moveCost);
              if (path) {
                for (const step of path) {
                  if (this.occupantAt(step)) break;
                  const cost = this.moveCost(step);
                  if (c2.movLeft < cost) break;
                  if (hexDistance(step, hero.pos) <= 2) break;
                  c2.pos = { ...step };
                  c2.movLeft -= cost;
                }
              }
            }
            return;
          }
        }
        if (c2.side === "enemy") {
          const npcDef = this.engine.campaign.entities[c2.entityId];
          const morale = npcDef?.morale;
          if (morale && c2.hp / c2.maxHp * 100 < morale.below_hp_pct) {
            if (this.engine.rng.next() * 100 < morale.flee_chance) {
              c2.fled = true;
              this.log.push(`${c2.label} \u043F\u0430\u0434\u0430\u0435\u0442 \u0434\u0443\u0445\u043E\u043C \u0438 \u043E\u0431\u0440\u0430\u0449\u0430\u0435\u0442\u0441\u044F \u0432 \u0431\u0435\u0433\u0441\u0442\u0432\u043E!`);
              playUi("flee");
              return;
            }
          }
        }
        const targets = this.combatants.filter((x2) => !x2.dead && !x2.fled && !x2.down && !x2.hidden && x2.side !== c2.side);
        if (!targets.length) {
          if (c2.side === "enemy" && this.combatants.some((x2) => x2.hidden && !x2.dead && x2.side !== c2.side)) {
            this.log.push(`${c2.label} \u043E\u0437\u0438\u0440\u0430\u0435\u0442\u0441\u044F \u2014 \u0446\u0435\u043B\u044C \u043F\u043E\u0442\u0435\u0440\u044F\u043D\u0430 \u0438\u0437 \u0432\u0438\u0434\u0443.`);
          }
          return;
        }
        targets.sort((a2, b2) => hexDistance(c2.pos, a2.pos) - hexDistance(c2.pos, b2.pos));
        let target = targets[0];
        if (this.tryUseAiAbility(c2, target)) return;
        if (hexDistance(c2.pos, target.pos) > this.weaponRange(c2)) {
          const from = { ...c2.pos };
          const path = astar(c2.pos, target.pos, this.passable, this.moveCost);
          if (path) {
            for (const step of path) {
              if (this.occupantAt(step)) break;
              const cost = this.moveCost(step);
              if (c2.movLeft < cost) break;
              if (hexDistance(c2.pos, target.pos) <= this.weaponRange(c2)) break;
              c2.pos = { ...step };
              c2.movLeft -= cost;
            }
          }
          this.triggerOpportunity(c2, from);
        }
        let guard = 0;
        while (!this.result && guard++ < 8) {
          if (target.dead || target.down || target.fled || hexDistance(c2.pos, target.pos) > this.weaponRange(c2)) {
            const rest = this.combatants.filter((x2) => !x2.dead && !x2.fled && !x2.down && x2.side !== c2.side).sort((a2, b2) => hexDistance(c2.pos, a2.pos) - hexDistance(c2.pos, b2.pos));
            if (!rest.length || hexDistance(c2.pos, rest[0].pos) > this.weaponRange(c2)) break;
            target = rest[0];
          }
          if (!this.canAttack(c2, target)) break;
          this.faceTowards(c2, target.pos);
          this.resolveAttack(c2, target);
          this.checkEnd();
        }
      }
      // ─────────────── способности (блок 6 ТЗ «Гибкий движок») ───────────────
      /** ИИ: шанс 50% применить готовую способность вместо атаки. */
      tryUseAiAbility(c2, target) {
        if (!c2.abilities.length) return false;
        const usable = c2.abilities.map((id) => this.abilityDef(id)).filter((a2) => !!a2 && a2.kind !== "heal" && a2.mp_cost <= c2.mp && (c2.cooldowns[a2.id] ?? 0) <= 0).filter((a2) => hexDistance(c2.pos, target.pos) <= a2.range);
        if (!usable.length) return false;
        if (this.engine.rng.next() >= 0.5) return false;
        const ab = usable[this.engine.rng.int(0, usable.length - 1)];
        this.resolveAbility(c2, ab, target);
        return true;
      }
      /** Применение способности: расход MP, кулдаун, проверка навыка, эффект. */
      resolveAbility(caster, ab, target) {
        this.spendAction(caster);
        caster.mp = Math.max(0, caster.mp - ab.mp_cost);
        if (ab.cooldown_rounds) caster.cooldowns[ab.id] = ab.cooldown_rounds;
        this.faceTowards(caster, target.pos);
        const rng = this.engine.rng;
        if (ab.kind === "heal") {
          const amount = rollDice(ab.heal ?? "1d6", rng);
          target.hp = Math.min(target.maxHp, target.hp + amount);
          this.log.push(`${caster.label}: \xAB${ab.label}\xBB \u2014 ${target.label} \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u0442 ${amount} HP.`);
          playUi("heal");
          this.syncParty();
          return;
        }
        if (ab.skill) {
          const skillVal = Math.max(1, (caster.skills[ab.skill] ?? 25) + this.statusSkillMod(caster, ab.skill));
          const atk = skillCheck(skillVal, rng, 0, this.engine.diceRules);
          this.log.push(
            `${caster.label}: \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C \xAB${ab.label}\xBB \u2014 d100=${atk.roll} \u043F\u0440\u043E\u0442\u0438\u0432 ${atk.target} \u2192 ${labelResult(atk.result)}`
          );
          if (caster.id === "c_player" && atk.success) this.engine.markSkill(ab.skill);
          if (RANK[atk.result] < 2) {
            this.log.push(`${target.label} \u0438\u0437\u0431\u0435\u0433\u0430\u0435\u0442 \u044D\u0444\u0444\u0435\u043A\u0442\u0430.`);
            playUi("miss");
            if (atk.result === "fumble" && ab.backlash_table?.length) this.applyBacklash(caster, ab);
            return;
          }
          if (this.defenderSaves(target, RANK[atk.result])) return;
        }
        if (ab.kind === "damage") {
          let dmg = Math.max(0, rollDice(ab.damage ?? "1d6", rng) - target.armor);
          if (caster.side === "enemy" && target.id === "c_player") dmg = Math.round(dmg * this.enemyDamageMult(caster));
          this.log.push(`${caster.label}: \xAB${ab.label}\xBB \u043F\u043E\u043F\u0430\u0434\u0430\u0435\u0442.`);
          playUi("hit");
          this.finishDamage(target, dmg);
        } else if (ab.kind === "status" && ab.status) {
          this.log.push(`${caster.label}: \xAB${ab.label}\xBB \u2014 \u043D\u0430 \xAB${target.label}\xBB \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \xAB${this.statusLabel(ab.status)}\xBB.`);
          this.applyStatusTo(target.id, ab.status, ab.status_duration);
        }
      }
      /** множитель урона врагов по герою (мастерской пресет сложности, выбранный игроком) */
      enemyDamageMult(from) {
        return from.side === "enemy" ? this.engine.difficultyDef()?.enemy_damage ?? 1 : 1;
      }
      /** магический откат (backlash_table способности): бросок по весам, действует на заклинателя */
      applyBacklash(caster, ab) {
        const table = ab.backlash_table;
        const total = table.reduce((s2, e2) => s2 + Math.max(0, e2.weight), 0);
        if (total <= 0) return;
        let roll = this.engine.rng.int(1, total);
        const entry = table.find((e2) => (roll -= Math.max(0, e2.weight)) <= 0) ?? table[table.length - 1];
        this.log.push(`${caster.label}: \u041D\u0410\u0420\u0423\u0428\u0415\u041D\u0418\u0415 \u0421\u0418\u041B\u042B!${entry.text ? ` ${entry.text}` : ""}`);
        if (entry.hp_delta) {
          if (entry.hp_delta < 0) this.finishDamage(caster, -entry.hp_delta);
          else caster.hp = Math.min(caster.maxHp, caster.hp + entry.hp_delta);
        }
        if (entry.mp_delta) caster.mp = Math.max(0, Math.min(caster.maxMp, caster.mp + entry.mp_delta));
        if (entry.status) this.applyStatusTo(caster.id, entry.status, entry.status_duration);
      }
      /** Способности игрока и готовность каждой на этом ходу. */
      playerAbilities() {
        const c2 = this.combatants.find((x2) => x2.id === "c_player");
        if (!c2) return [];
        const out = [];
        const magicSlots = this.engine.campaign.meta.magic?.slots;
        const prepared = this.engine.state.player.prepared_abilities ?? [];
        for (const id of c2.abilities) {
          const def = this.abilityDef(id);
          if (!def) continue;
          let reason = "";
          if (!this.isPlayerTurn() || c2.attacked) reason = "\u0441\u0435\u0439\u0447\u0430\u0441 \u043D\u0435 \u0432\u0430\u0448 \u0445\u043E\u0434";
          else if (magicSlots && def.prepare && !prepared.includes(id)) reason = "\u043D\u0435 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u0430 \u2014 \u0437\u0430\u043D\u0435\u0441\u0438\u0442\u0435 \u0432 \u0441\u043B\u043E\u0442\u044B \u0432 \u043B\u0438\u0441\u0442\u0435 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430 (\u0432\u043D\u0435 \u0431\u043E\u044F)";
          else if (c2.mp < def.mp_cost) reason = `\u043D\u0435 \u0445\u0432\u0430\u0442\u0430\u0435\u0442 MP (${def.mp_cost})`;
          else if ((c2.cooldowns[id] ?? 0) > 0) reason = `\u043A\u0443\u043B\u0434\u0430\u0443\u043D \u0435\u0449\u0451 ${c2.cooldowns[id]} \u0440\u0430\u0443\u043D\u0434(\u0430)`;
          out.push({ def, usable: reason === "", reason });
        }
        return out;
      }
      /** Допустимые цели способности из текущей позиции игрока. */
      abilityTargets(abilityId) {
        const ab = this.abilityDef(abilityId);
        const c2 = this.combatants.find((x2) => x2.id === "c_player");
        if (!ab || !c2 || c2.dead) return [];
        const pool = ab.kind === "heal" ? this.combatants.filter((x2) => x2.side === c2.side && !x2.dead) : this.combatants.filter((x2) => x2.side !== c2.side && !x2.dead && !x2.fled);
        return pool.filter((t5) => hexDistance(c2.pos, t5.pos) <= ab.range);
      }
      /** Игрок применяет способность — ход завершается, как после атаки. */
      useAbility(abilityId, targetId) {
        if (!this.isPlayerTurn() || this.active.attacked) return;
        const c2 = this.active;
        const ab = this.abilityDef(abilityId);
        if (!ab || !c2.abilities.includes(abilityId)) return;
        if (c2.mp < ab.mp_cost || (c2.cooldowns[abilityId] ?? 0) > 0) return;
        const target = this.combatants.find((x2) => x2.id === targetId);
        if (!target || target.dead || target.fled) return;
        if (ab.kind === "heal" ? target.side !== c2.side : target.side === c2.side) return;
        if (hexDistance(c2.pos, target.pos) > ab.range) return;
        this.resolveAbility(c2, ab, target);
        this.checkEnd();
        if (!this.result) {
          this.nextTurn();
          this.processUntilPlayer();
        }
        this.engine.notify();
      }
      // ─────────────── разрешение атаки (BRP) ───────────────
      /**
       * Удар по цели. `opts.free` — бесплатная атака (рубеж вслед убегающему):
       * не тратит атаку хода и не получает штрафа мультиатаки.
       */
      resolveAttack(attacker, defender, opts) {
        let penalty = 0;
        if (!opts?.free) {
          const apr = Math.max(1, attacker.weapon.attacks_per_round ?? 1);
          penalty = (apr - attacker.attacksLeft) * this.multiAttackPenalty;
          attacker.attacksLeft -= 1;
          if (attacker.attacksLeft <= 0) this.spendAction(attacker);
          if (attacker.id === "c_player" && attacker.weapon.ammo_item) {
            this.engine.removeItem(attacker.weapon.ammo_item, 1);
            const left = this.engine.itemCount(attacker.weapon.ammo_item);
            if (left === 0) this.log.push(`\u0411\u043E\u0435\u043F\u0440\u0438\u043F\u0430\u0441\u044B \u043A \xAB${attacker.weaponLabel}\xBB \u043A\u043E\u043D\u0447\u0438\u043B\u0438\u0441\u044C!`);
          }
        }
        const rng = this.engine.rng;
        const fromShadow = !!attacker.hidden;
        const flank = this.flankRules();
        const fromBehind = !!flank && this.isRearArc(defender, attacker.pos, flank.arc);
        const aim = attacker.aimBonus ?? 0;
        attacker.aimBonus = 0;
        const skillVal = Math.max(
          1,
          (attacker.skills[attacker.weapon.skill] ?? 25) + this.statusSkillMod(attacker, attacker.weapon.skill) + this.weatherSkillMod(attacker.weapon.skill) + aim
        );
        const coverP = attacker.weapon.range > 1 && this.coverHexes.has(hexKey(defender.pos)) ? this.coverPenalty() : null;
        const atk = skillCheck(skillVal, rng, penalty + (coverP ?? 0), this.engine.diceRules);
        this.log.push(
          `${attacker.label}: ${fromShadow ? "\u0412\u041D\u0415\u0417\u0410\u041F\u041D\u0410\u042F \u0430\u0442\u0430\u043A\u0430" : "\u0430\u0442\u0430\u043A\u0430"} \xAB${attacker.weaponLabel}\xBB${penalty ? ` (\u043F\u043E\u0432\u0442\u043E\u0440\u043D\u0430\u044F, ${penalty}%)` : ""}${aim ? ` (\u043F\u0440\u0438\u0446\u0435\u043B\u044C\u043D\u0430\u044F, +${aim}%)` : ""}${coverP ? ` (\u0443\u043A\u0440\u044B\u0442\u0438\u0435, ${coverP}%)` : ""} \u2014 d100=${atk.roll} \u043F\u0440\u043E\u0442\u0438\u0432 ${atk.target} \u2192 ${labelResult(atk.result)}`
        );
        attacker.hidden = false;
        if (attacker.id === "c_player" && atk.success) this.engine.markSkill(attacker.weapon.skill);
        if (RANK[atk.result] < 2) {
          playUi("miss");
          if (atk.result === "fumble" && !opts?.free) {
            this.wearWeapon(attacker);
            this.applyFumble(attacker);
          }
          return;
        }
        if (fromShadow) {
          this.log.push(`${defender.label} \u043D\u0435 \u0432\u0438\u0434\u0438\u0442 \u043D\u0430\u043F\u0430\u0434\u0430\u044E\u0449\u0435\u0433\u043E \u2014 \u0437\u0430\u0449\u0438\u0442\u0430 \u043D\u0435\u0432\u043E\u0437\u043C\u043E\u0436\u043D\u0430!`);
        } else if (fromBehind) {
          this.log.push(`${attacker.label} \u0431\u044C\u0451\u0442 ${defender.label} \u0432 \u0441\u043F\u0438\u043D\u0443 \u2014 \u0437\u0430\u0449\u0438\u0442\u0430 \u043D\u0435\u0432\u043E\u0437\u043C\u043E\u0436\u043D\u0430!`);
        } else if (this.defenderSaves(defender, RANK[atk.result])) {
          return;
        }
        const w2 = attacker.weapon;
        const dbNotation = w2.damage_bonus ? damageBonus(attacker.stats) : "0";
        const harmless = w2.traits?.includes("push_harmless");
        const critEntry = atk.result === "critical" ? this.rollCritEntry() : null;
        const loc = this.rollHitLocation(rng);
        if (loc) this.log.push(`${loc.text ?? `\u041F\u043E\u043F\u0430\u0434\u0430\u043D\u0438\u0435: ${loc.label}.`}`);
        const locMult = loc?.damage_mult ?? 1;
        const locArmor = loc?.armor ?? defender.armor;
        let dmg;
        if (atk.result === "critical" && critEntry?.kind === "double_damage") {
          dmg = harmless ? 0 : Math.max(0, Math.round(2 * (rollDice(w2.damage, rng) + Math.max(0, rollSigned(dbNotation, rng))) * locMult) - locArmor);
          this.log.push(`\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0443\u0434\u0430\u0440 \u2014 \u0443\u0440\u043E\u043D \u0443\u0434\u0432\u043E\u0435\u043D!${critEntry.text ? ` ${critEntry.text}` : ""}`);
          playUi("crit");
        } else if (atk.result === "critical") {
          dmg = harmless ? 0 : Math.max(0, Math.round((maxOf(w2.damage) + Math.max(0, maxOf(dbNotation))) * locMult) - (loc ? locArmor : 0));
          this.log.push(`\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0443\u0434\u0430\u0440! ${loc ? "\u0411\u0440\u043E\u043D\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0443 \u043B\u043E\u043A\u0430\u0446\u0438\u0438." : "\u0411\u0440\u043E\u043D\u044F \u043D\u0435 \u0441\u043F\u0430\u0441\u0430\u0435\u0442."}${critEntry?.text ? ` ${critEntry.text}` : ""}`);
          playUi("crit");
        } else if (harmless) {
          dmg = 0;
          playUi("hit");
        } else {
          const raw = rollDice(w2.damage, rng) + rollSigned(dbNotation, rng);
          dmg = Math.max(0, Math.round(raw * locMult) - locArmor);
          playUi("hit");
        }
        if (fromBehind && flank?.bonus && !harmless) {
          const extra = rollDice(flank.bonus, rng);
          if (extra > 0) {
            dmg += extra;
            this.log.push(`\u0423\u0434\u0430\u0440 \u0432 \u0441\u043F\u0438\u043D\u0443: +${extra} \u0443\u0440\u043E\u043D\u0430.`);
          }
        }
        if (attacker.side === "enemy" && defender.id === "c_player") dmg = Math.round(dmg * this.enemyDamageMult(attacker));
        this.finishDamage(defender, dmg);
        if (critEntry && !defender.dead && !defender.down) {
          if (critEntry.kind === "disarm") this.disarm(defender, attacker);
          if (critEntry.kind === "status" && critEntry.status) this.applyStatusTo(defender.id, critEntry.status, critEntry.duration);
        }
        if (loc && !defender.dead && !defender.down) {
          if (atk.result === "critical" && loc.status_on_crit) this.applyStatusTo(defender.id, loc.status_on_crit);
          else if (dmg > 0 && loc.status_on_hit) this.applyStatusTo(defender.id, loc.status_on_hit);
        }
        if (dmg > 0) this.wearArmor(defender);
        if (!defender.dead && !defender.down && RANK[atk.result] >= RANK.hard) {
          this.applyWeaponTraits(attacker, defender);
        }
      }
      /** таблица критических успехов мастера (meta.combat.crit_table) — бросок по весам */
      rollCritEntry() {
        const table = this.combatRules()?.crit_table;
        if (!table?.length) return null;
        const total = table.reduce((s2, e2) => s2 + Math.max(0, e2.weight), 0);
        if (total <= 0) return null;
        let roll = this.engine.rng.int(1, total);
        return table.find((e2) => (roll -= Math.max(0, e2.weight)) <= 0) ?? table[table.length - 1];
      }
      /** хит-локации мастера (combat.hit_locations): бросок d100 по диапазонам; механика выкл. — null */
      rollHitLocation(rng) {
        const rule = this.combatRules()?.hit_locations;
        if (!rule?.table?.length) return null;
        const roll = rng.int(1, 100);
        return rule.table.find((t5) => roll >= t5.from && roll <= t5.to) ?? null;
      }
      /** штраф укрытия (combat.cover); null — механика выключена */
      coverPenalty() {
        const c2 = this.combatRules()?.cover;
        if (!c2) return null;
        return typeof c2 === "object" ? c2.penalty ?? -20 : -20;
      }
      /** настройка удара в спину (combat.flank); null — механика выключена */
      flankRules() {
        const f2 = this.combatRules()?.flank;
        if (!f2) return null;
        return {
          arc: typeof f2 === "object" ? f2.arc ?? 120 : 120,
          bonus: typeof f2 === "object" ? f2.damage_bonus ?? null : null
        };
      }
      /** стоит ли `from` в задней дуге цели (за её взглядом); дуга arcDeg с центром строго сзади */
      isRearArc(defender, from, arcDeg) {
        const size = this.arena.hex_grid.hex_size;
        const a2 = hexToPixel(defender.pos, size, { x: 0, y: 0 });
        const b2 = hexToPixel(from, size, { x: 0, y: 0 });
        const dx = b2.x - a2.x;
        const dy = b2.y - a2.y;
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return false;
        const dir = Math.atan2(dx, -dy) * 180 / Math.PI;
        const diff = Math.abs(((dir - defender.facing) % 360 + 540) % 360 - 180);
        return diff >= 180 - arcDeg / 2;
      }
      /** особые удары оружия: пронзание, отброс, разоружение, захват */
      applyWeaponTraits(attacker, defender) {
        const traits = attacker.weapon.traits;
        if (!traits?.length) return;
        const rng = this.engine.rng;
        if (traits.includes("impale")) {
          const extra = rollDice(attacker.weapon.damage, rng);
          this.log.push(`\u041F\u0440\u043E\u043D\u0437\u0430\u043D\u0438\u0435! \xAB${attacker.weaponLabel}\xBB \u0432\u043F\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0433\u043B\u0443\u0431\u043E\u043A\u043E: +${extra} \u0443\u0440\u043E\u043D\u0430 \u0431\u0435\u0437 \u0431\u0440\u043E\u043D\u0438.`);
          this.finishDamage(defender, extra);
          if (defender.dead || defender.down) return;
        }
        if (traits.includes("knockback") || traits.includes("push_harmless")) {
          const dc = defender.pos.col - attacker.pos.col;
          const dr = defender.pos.row - attacker.pos.row;
          const step = { col: defender.pos.col + Math.sign(dc), row: defender.pos.row + Math.sign(dr) };
          if (this.passable(step)) {
            defender.pos = step;
            this.log.push(`${defender.label} \u043E\u0442\u0431\u0440\u043E\u0448\u0435\u043D \u043D\u0430\u0437\u0430\u0434.`);
          }
        }
        if (traits.includes("disarm")) {
          this.disarm(defender, attacker);
          if (defender.dead || defender.down) return;
        }
        if (traits.includes("grapple")) {
          defender.skipNext = true;
          this.log.push(`${attacker.label} \u0437\u0430\u0445\u0432\u0430\u0442\u044B\u0432\u0430\u0435\u0442 ${defender.label} \u2014 \u0442\u043E\u0442 \u043F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u0442 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0445\u043E\u0434!`);
        }
      }
      /** разоружение: игрок теряет оружие в инвентарь, NPC — навсегда */
      disarm(defender, attacker) {
        if (!defender.weaponItemId) return;
        const label = defender.weaponLabel;
        if (defender.id === "c_player") {
          const eq = this.engine.state.player.equipment;
          if (eq.weapon === defender.weaponItemId) delete eq.weapon;
          this.log.push(`${attacker.label} \u0432\u044B\u0431\u0438\u0432\u0430\u0435\u0442 \xAB${label}\xBB \u0438\u0437 \u0440\u0443\u043A ${defender.label}! \u041E\u0440\u0443\u0436\u0438\u0435 \u043E\u0442\u043B\u0435\u0442\u0435\u043B\u043E \u0432 \u0440\u044E\u043A\u0437\u0430\u043A.`);
        } else {
          this.log.push(`${attacker.label} \u0432\u044B\u0431\u0438\u0432\u0430\u0435\u0442 \xAB${label}\xBB \u0438\u0437 \u0440\u0443\u043A ${defender.label}!`);
        }
        defender.weapon = { ...FISTS };
        defender.weaponLabel = FISTS.label;
        defender.weaponItemId = null;
        defender.attacksLeft = Math.min(defender.attacksLeft, 1);
      }
      /** таблица критических провалов мастера (meta.combat.fumble_table) */
      applyFumble(attacker) {
        const table = this.combatRules()?.fumble_table;
        if (!table?.length) return;
        const total = table.reduce((s2, e2) => s2 + Math.max(0, e2.weight), 0);
        if (total <= 0) return;
        let roll = this.engine.rng.int(1, total);
        const entry = table.find((e2) => (roll -= Math.max(0, e2.weight)) <= 0) ?? table[table.length - 1];
        const note = entry.text ? ` ${entry.text}` : "";
        switch (entry.kind) {
          case "drop_weapon":
            this.log.push(`${attacker.label} \u0440\u043E\u043D\u044F\u0435\u0442 \u043E\u0440\u0443\u0436\u0438\u0435!${note}`);
            this.disarm(attacker, attacker);
            break;
          case "stuck":
            attacker.skipNext = true;
            this.log.push(`${attacker.label}: \u043E\u0440\u0443\u0436\u0438\u0435 \u0437\u0430\u0441\u0442\u0440\u044F\u043B\u043E \u2014 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0445\u043E\u0434 \u0443\u0439\u0434\u0451\u0442 \u043D\u0430 \u0438\u0437\u0432\u043B\u0435\u0447\u0435\u043D\u0438\u0435.${note}`);
            break;
          case "self_hit": {
            const dmg = Math.max(0, rollDice(attacker.weapon.damage, this.engine.rng) - attacker.armor);
            this.log.push(`${attacker.label} \u0440\u0430\u043D\u0438\u0442 \u0441\u0435\u0431\u044F!${note}`);
            this.finishDamage(attacker, dmg);
            break;
          }
          case "skip_next":
            attacker.skipNext = true;
            this.log.push(`${attacker.label} \u0441\u043F\u043E\u0442\u044B\u043A\u0430\u0435\u0442\u0441\u044F \u2014 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0445\u043E\u0434 \u043F\u043E\u0442\u0435\u0440\u044F\u043D.${note}`);
            break;
        }
      }
      /** износ оружия атакующего при критическом провале; слом — переход на кулаки */
      wearWeapon(attacker) {
        if (!attacker.weaponItemId) return;
        if (attacker.id === "c_player") {
          const broke = this.engine.damageItemDurability(attacker.weaponItemId, 1);
          if (broke) {
            attacker.weapon = { ...FISTS };
            attacker.weaponLabel = FISTS.label;
            attacker.weaponItemId = null;
            this.log.push(`${attacker.label}: \u043E\u0440\u0443\u0436\u0438\u0435 \u0441\u043B\u043E\u043C\u0430\u043B\u043E\u0441\u044C \u2014 \u0434\u0430\u043B\u044C\u0448\u0435 \u043A\u0443\u043B\u0430\u043A\u0430\u043C\u0438.`);
          }
          return;
        }
        const item = this.engine.campaign.entities[attacker.weaponItemId];
        const max = item?.weapon_data?.durability;
        if (max === void 0) return;
        attacker.wear ??= {};
        const left = (attacker.wear[attacker.weaponItemId] ?? max) - 1;
        attacker.wear[attacker.weaponItemId] = left;
        if (left <= 0) {
          attacker.weapon = { ...FISTS };
          attacker.weaponLabel = FISTS.label;
          attacker.weaponItemId = null;
          this.log.push(`${attacker.label}: \xAB${item?.label ?? "\u043E\u0440\u0443\u0436\u0438\u0435"}\xBB \u0441\u043B\u043E\u043C\u0430\u043D\u043E \u2014 \u0434\u0430\u043B\u044C\u0448\u0435 \u0433\u043E\u043B\u044B\u043C\u0438.`);
        }
      }
      /** износ брони защитника после пробившего удара */
      wearArmor(defender) {
        if (defender.id === "c_player") {
          for (const id of Object.values(this.engine.state.player.equipment)) {
            if (!id) continue;
            const item = this.engine.campaign.entities[id];
            if (item?.armor_data?.durability === void 0 || !this.engine.isItemUsable(id)) continue;
            const broke = this.engine.damageItemDurability(id, 1);
            if (broke) {
              defender.armor = this.engine.playerArmor().points;
              this.log.push(`${defender.label}: \xAB${item.label}\xBB \u0440\u0430\u0437\u0431\u0438\u0442\u0430 \u043D\u0430\u0441\u043C\u0435\u0440\u0442\u044C \u2014 \u0431\u0440\u043E\u043D\u044F ${defender.armor}.`);
            }
            return;
          }
          return;
        }
        const def = this.engine.campaign.entities[defender.entityId];
        if (!def) return;
        for (const itemId of Object.values(def.equipment ?? {})) {
          const item = this.engine.campaign.entities[itemId];
          const max = item?.armor_data?.durability;
          if (max === void 0 || !item) continue;
          defender.wear ??= {};
          const left = (defender.wear[itemId] ?? max) - 1;
          defender.wear[itemId] = left;
          if (left <= 0) {
            defender.armor = Math.max(0, defender.armor - item.armor_data.points);
            this.log.push(`${defender.label}: \u0434\u043E\u0441\u043F\u0435\u0445 \xAB${item.label}\xBB \u0440\u0430\u0437\u0431\u0438\u0442 \u2014 \u0431\u0440\u043E\u043D\u044F ${defender.armor}.`);
          }
          return;
        }
      }
      /** Защита от удара: уклонение/парирование. Истина — атака отражена. */
      defenderSaves(defender, atkRank) {
        if (this.round === 1 && this.surprise) {
          const ambusher = this.surprise === "player" ? "player" : "enemy";
          if (defender.side !== ambusher) return false;
        }
        const rng = this.engine.rng;
        const dodgeVal = Math.max(0, (defender.skills["dodge"] ?? 0) + this.statusSkillMod(defender, "dodge") + this.weatherSkillMod("dodge"));
        const parryVal = defender.weapon.parry_capable ? Math.max(0, (defender.skills[defender.weapon.skill] ?? 0) + this.statusSkillMod(defender, defender.weapon.skill) + this.weatherSkillMod(defender.weapon.skill)) : 0;
        const useParry = parryVal > dodgeVal;
        const defBase = useParry ? parryVal : dodgeVal;
        if (defBase > 0) {
          const penalty = -30 * defender.defensesUsed;
          defender.defensesUsed++;
          const def = skillCheck(defBase, rng, penalty, this.engine.diceRules);
          this.log.push(
            `${defender.label}: ${useParry ? "\u043F\u0430\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435" : "\u0443\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0435"} \u2014 d100=${def.roll} \u043F\u0440\u043E\u0442\u0438\u0432 ${def.target} \u2192 ${labelResult(def.result)}`
          );
          if (RANK[def.result] >= 2 && RANK[def.result] >= atkRank) {
            this.log.push(`${defender.label} ${useParry ? "\u043E\u0442\u0431\u0438\u0432\u0430\u0435\u0442 \u0443\u0434\u0430\u0440" : "\u0443\u0445\u043E\u0434\u0438\u0442 \u043E\u0442 \u0443\u0434\u0430\u0440\u0430"}.`);
            playUi("parry");
            if (defender.id === "c_player") this.engine.markSkill(useParry ? defender.weapon.skill : "dodge");
            return true;
          }
        }
        return false;
      }
      /** Урон бойцу: лог, смерть, синхронизация с состоянием партии. */
      finishDamage(defender, dmg) {
        if (defender.id === "c_player" && this.engine.debugInvincible) {
          this.log.push(`${defender.label}: \u0443\u0440\u043E\u043D \u043E\u0442\u043C\u0435\u043D\u0451\u043D \u0440\u0435\u0436\u0438\u043C\u043E\u043C \u043E\u0442\u043B\u0430\u0434\u043A\u0438.`);
          return;
        }
        defender.hp -= dmg;
        this.log.push(`${defender.label} \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442 ${dmg} \u0443\u0440\u043E\u043D\u0430 (HP ${Math.max(0, defender.hp)}/${defender.maxHp}).`);
        if (defender.id === "c_player" && this.deathMode === "brp" && !defender.dead && !defender.down) {
          if (defender.hp > 0 && dmg >= Math.ceil(defender.maxHp / 2) && !this.conSave(defender, "\u0442\u044F\u0436\u0451\u043B\u0430\u044F \u0440\u0430\u043D\u0430")) {
            defender.down = true;
            this.log.push(`${defender.label} \u0442\u0435\u0440\u044F\u0435\u0442 \u0441\u043E\u0437\u043D\u0430\u043D\u0438\u0435 \u043E\u0442 \u0442\u044F\u0436\u0451\u043B\u043E\u0439 \u0440\u0430\u043D\u044B.`);
          }
          if (!defender.down && defender.hp <= 0 && this.conSave(defender, "\u0441\u043C\u0435\u0440\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u0443\u0434\u0430\u0440")) {
            defender.hp = 1;
            defender.down = true;
            this.log.push(`${defender.label} \u043F\u0430\u0434\u0430\u0435\u0442 \u0431\u0435\u0437 \u0441\u043E\u0437\u043D\u0430\u043D\u0438\u044F \u2014 \u043D\u043E \u0434\u044B\u0448\u0438\u0442. (1 HP)`);
          }
        }
        if (defender.hp <= 0 && !defender.down) {
          defender.dead = true;
          this.log.push(`\u2020 ${defender.label} \u043F\u043E\u0433\u0438\u0431\u0430\u0435\u0442.`);
          playUi("death");
          if (defender.side === "enemy") {
            this.engine.state.dead_entities.push(defender.entityId);
          } else if (defender.id.startsWith("c_ally_")) {
            this.engine.leaveParty(defender.entityId);
            this.engine.state.dead_entities.push(defender.entityId);
            this.engine.pushLog(`${defender.label} \u043F\u043E\u0433\u0438\u0431\u0430\u0435\u0442 \u0432 \u0431\u043E\u044E. \u041D\u0430\u0432\u0441\u0435\u0433\u0434\u0430.`);
          }
        }
        this.syncParty();
        if (defender.down || defender.dead) this.checkEnd();
      }
      /**
       * Спасбросок CON×con_multiplier при критическом состоянии героя (режим
       * 'brp'): тяжёлая рана — успех удерживает в сознании; смертельный удар —
       * успех оставляет жить (без сознания). Истина — спасбросок пройден.
       */
      conSave(c2, cause) {
        const mult = this.combatRules()?.death?.con_multiplier ?? 5;
        const out = skillCheck(c2.stats.CON * mult, this.engine.rng, 0, this.engine.diceRules);
        this.log.push(
          `${c2.label}: \u0433\u0440\u0430\u043D\u044C \u0441\u043E\u0437\u043D\u0430\u043D\u0438\u044F (${cause}) \u2014 CON\xD7${mult}, d100=${out.roll} \u043F\u0440\u043E\u0442\u0438\u0432 ${out.target} \u2192 ${labelResult(out.result)}`
        );
        return out.success;
      }
      /** синхронизация HP/MP игрока и напарников с состоянием боя */
      syncParty() {
        const pc = this.combatants.find((x2) => x2.id === "c_player");
        if (pc) {
          this.engine.state.player.hp = Math.max(0, pc.hp);
          this.engine.state.player.mp = Math.max(0, Math.min(pc.mp, this.engine.state.player.max_mp));
        }
        for (const ally of this.combatants.filter((x2) => x2.id.startsWith("c_ally_"))) {
          const comp = this.engine.state.party.find((c2) => c2.entity === ally.entityId);
          if (comp) comp.hp = Math.max(0, ally.hp);
        }
      }
      // ─────────────── завершение ───────────────
      checkEnd() {
        if (this.result) return;
        const enemiesAlive = this.combatants.some((c2) => c2.side === "enemy" && !c2.dead && !c2.fled && !c2.down);
        const pc = this.combatants.find((c2) => c2.id === "c_player");
        const playerActive = !!pc && !pc.dead && !pc.down && !pc.fled;
        if (!playerActive) {
          this.result = "defeat";
          playUi("defeat");
          if (this.deathMode === "brp" && pc?.down && !pc.dead && (this.def.on_defeat?.length ?? 0) > 0) {
            this.log.push("\u0411\u043E\u0439 \u043F\u0440\u043E\u0438\u0433\u0440\u0430\u043D, \u043D\u043E \u0432\u044B \u0436\u0438\u0432\u044B. \u0421\u043E\u0437\u043D\u0430\u043D\u0438\u0435 \u0433\u0430\u0441\u043D\u0435\u0442\u2026");
            this.engine.onCombatResolve(this.def.on_defeat ?? []);
          } else {
            this.engine.gameOver("death", "\u0412\u044B \u043F\u0430\u043B\u0438 \u0432 \u0431\u043E\u044E.");
          }
          return;
        }
        if (!enemiesAlive) {
          this.result = "victory";
          playUi("victory");
          this.rollLoot();
          this.log.push("\u041F\u043E\u0431\u0435\u0434\u0430! \u041F\u0440\u043E\u0442\u0438\u0432\u043D\u0438\u043A\u0438 \u043F\u043E\u0432\u0435\u0440\u0436\u0435\u043D\u044B.");
          this.engine.onCombatResolve(this.def.on_victory ?? []);
        }
      }
      rollLoot() {
        const rng = this.engine.rng;
        const counts = /* @__PURE__ */ new Map();
        for (const c2 of this.combatants) {
          if (c2.side !== "enemy" || !c2.dead) continue;
          const def = this.engine.campaign.entities[c2.entityId];
          for (const entry of def.loot_table ?? []) {
            if (!rng.chance(entry.chance)) continue;
            const qty = entry.min != null && entry.max != null ? rng.int(entry.min, entry.max) : 1;
            counts.set(entry.item, (counts.get(entry.item) ?? 0) + qty);
          }
        }
        for (const [item, qty] of counts) {
          this.engine.addItem(item, qty);
          const def = this.engine.campaign.entities[item];
          playInteraction("pickup", { entity: def });
          const label = this.engine.campaign.entities[item]?.label ?? item;
          this.loot.push({ label, quantity: qty });
        }
      }
    };
  }
});

// src/core/engine.ts
var engine_exports = {};
__export(engine_exports, {
  GameEngine: () => GameEngine,
  MAX_SAVE_SLOTS: () => MAX_SAVE_SLOTS,
  OLDEST_SAVE_VERSION: () => OLDEST_SAVE_VERSION,
  SAVE_MIGRATIONS: () => SAVE_MIGRATIONS,
  backupKey: () => backupKey,
  checkSaveVersion: () => checkSaveVersion,
  deleteSave: () => deleteSave,
  exportSaveText: () => exportSaveText,
  hasSave: () => hasSave,
  importSaveText: () => importSaveText,
  inspectSave: () => inspectSave,
  listSaveSlots: () => listSaveSlots,
  loadSave: () => loadSave,
  loadState: () => loadState,
  openSave: () => openSave,
  peekSave: () => peekSave,
  preserveSave: () => preserveSave,
  removeSaveSlot: () => removeSave,
  saveKey: () => saveKey,
  slotKey: () => slotKey,
  writeSave: () => writeSave
});
function loadSave(campaignId) {
  return loadState(campaignId);
}
function deleteSave(campaignId) {
  removeSave(campaignId);
}
function hasSave(campaignId, campaign2) {
  if (!campaign2) return loadState(campaignId) !== null;
  const opened = inspectSave(campaignId, campaign2);
  return !!opened && opened.verdict.kind === "ok";
}
var GameEngine;
var init_engine = __esm({
  "src/core/engine.ts"() {
    init_types();
    init_savemigrate();
    init_prng();
    init_brp();
    init_dice();
    init_conditions();
    init_time();
    init_dialogue();
    init_skills();
    init_audio();
    init_voiceAudio();
    init_migrate();
    init_combat();
    init_savemigrate();
    GameEngine = class _GameEngine {
      campaign;
      state;
      rng;
      /** Временный флаг отладки, не сохраняется в состоянии забега. */
      debugInvincible = false;
      listeners = /* @__PURE__ */ new Set();
      activeStory = null;
      activeNpc = null;
      /** Ink-истории этого забега (состояние once-выборов живёт в пределах забега) */
      dialogue = null;
      /** накопленная история реплик и выборов текущего разговора (backlog) */
      dialogueHistory = [];
      /**
       * Таймер на выбор в диалоге (фидбек 27, §9): ink-вызов
       * `~ set_dialogue_timer(15, "node_x")` задаёт дедлайн на текущем наборе
       * реплик. Пока он жив, плеер показывает полоску обратного отсчёта, а по
       * истечении вызывает `dialogueTimeout()`. Истёк без цели — разговор
       * заканчивается сам: игрок промолчал.
       */
      dialogueTimer = null;
      /** таймер, объявленный ink-ом в текущем проходе до показа выбора */
      pendingDialogueTimer = null;
      /** ожидающий запрос предъявления предмета, объявленный ink-ом в текущем проходе */
      pendingDialoguePresenting = null;
      combat = null;
      /** последняя ошибка запуска диалога (компиляция / отсутствующий узел) — для отладки и плейтеста */
      lastDialogueError = null;
      /** открытая торговля: id NPC-торговца */
      trade = null;
      /**
       * Запрос на открытие окна изготовления (эффект/реплика `open_craft`).
       * Плеер показывает панель крафта, пока поле не сброшено closeCraft().
       * `recipe` — рецепт, который надо подсветить (ремонт клапана и т.п.).
       */
      craftRequest = null;
      /** Конкретная сущность (верстак, плита, наковальня), у которой открыто окно крафта */
      craftSourceEntity = null;
      /** транзитные всплывающие подсказки (не в сейве): «Получено: …» и т.п. — UI отображает и сам гасит */
      toasts = [];
      toastSeq = 0;
      /** Последняя осмотренная сущность (для панели отладки и режима инспектора) */
      inspectedEntityId = null;
      inspectEntity(id) {
        this.inspectedEntityId = id;
        this.notify();
      }
      /** Сюжетное переопределение музыки (поверх текущей сцены/локации) */
      musicOverride = null;
      setMusicOverride(tracks, fade) {
        this.musicOverride = { tracks, fade };
        this.notify();
      }
      clearMusicOverride() {
        if (!this.musicOverride) return;
        this.musicOverride = null;
        this.notify();
      }
      /** добавить короткое всплывающее уведомление (записывается и в журнал).
       *  Гаснет само — обращать внимание важно, а закрывать каждое рукой — перебор (баг-фитч №6). */
      pushToast(text, kind = "info") {
        const toast = { id: ++this.toastSeq, text, kind };
        this.toasts = [...this.toasts, toast];
        this.pushLog(text);
        playUi(kind === "lose" ? "item_lose" : kind === "get" ? "item_get" : "message");
        this.notify();
        setTimeout(() => this.dismissToast(toast.id), 5200);
      }
      /** UI погасил подсказку по таймеру */
      dismissToast(id) {
        if (this.toasts.some((t5) => t5.id === id)) {
          this.toasts = this.toasts.filter((t5) => t5.id !== id);
          this.notify();
        }
      }
      /** всплывающие сообщения (show_message) */
      messages = [];
      /**
       * Очередь катсцен (итерация 8, блок E). Эффект play_cutscene ставит
       * катсцену в очередь; остальные эффекты применяются сразу, но их экраны
       * (диалог, бой, торговля, сообщения) UI показывает только после ролика —
       * для игрока поток эффектов «продолжается по окончании катсцены».
       */
      cutsceneQueue = [];
      cutsceneSerial = 0;
      /** забег создан с нуля (а не загружен из сейва) — для правил «на старте» */
      freshRun;
      /** обёртка последнего сохранения: версии кампании/движка и даты (`SaveEnvelope`) */
      envelope = null;
      constructor(campaign2, state) {
        this.campaign = campaign2;
        this.freshRun = !state;
        if (state) {
          this.state = state;
          this.rng = new PRNG(state.seed);
          delete this.state.player.currencies;
          if (!this.state.player.equipment) {
            const def = this.campaign.entities[this.state.player.entity];
            this.state.player.equipment = { ...def?.equipment ?? {} };
          }
        } else {
          this.rng = new PRNG();
          this.state = this.newState();
        }
      }
      // ─────────────── подписка UI ───────────────
      subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
      }
      notify() {
        for (const fn of this.listeners) fn();
      }
      pushLog(text) {
        this.state.log.push(text);
        if (this.state.log.length > 200) this.state.log.shift();
      }
      /** подпись спикера реплики в истории диалога: явный # speaker — его имя, иначе собеседник */
      dlgSpeakerLabel(line, npc) {
        if (!line.speaker) return npc.label;
        const ent = this.campaign.entities[line.speaker];
        return ent?.label ?? npc.label;
      }
      // ─────────────── создание нового забега ───────────────
      newState() {
        const meta = this.campaign.meta;
        const playerDef = this.campaign.entities[meta.default_player];
        const stats = { ...playerDef.stats };
        const hp = stats.HP ?? derivedHP(stats);
        const mp = stats.MP ?? derivedMP(stats);
        const needs = {};
        for (const n2 of meta.needs) needs[n2.id] = n2.max;
        const player = {
          entity: playerDef.id,
          stats,
          skills: { ...playerDef.skills },
          skill_marks: {},
          hp,
          max_hp: hp,
          mp,
          max_mp: mp,
          needs,
          inventory: (playerDef.inventory ?? []).map((i2) => ({ ...i2 })),
          equipment: { ...playerDef.equipment ?? {} }
        };
        const dispositions = {};
        for (const f2 of meta.factions ?? []) dispositions[f2.id] = f2.base_disposition;
        return {
          save_version: SAVE_VERSION,
          campaign_id: meta.id,
          seed: this.rng.seed,
          tick: startTick(meta),
          region: meta.starting_region,
          location: meta.starting_location,
          scene: meta.starting_scene,
          flags: {},
          variables: {},
          fired_rules: [],
          revealed_locations: [],
          dead_entities: [],
          removed_entities: [],
          spawned: [],
          player,
          quests: {},
          dispositions,
          party: [],
          blocked_paths: [],
          seen_narrative_intros: [],
          known_npcs: [],
          log: [],
          game_over: null,
          stats_run: { travels: 0, dialogues: 0, ticks_survived: 0, kills: 0, quests_completed: 0 }
        };
      }
      /** Нужно ли показывать вводное повествование сцены (narrative_intro) */
      shouldShowNarrativeIntro(scene) {
        if (!scene.narrative_intro || scene.narrative_intro.length === 0) return false;
        const once = scene.narrative_intro_once ?? true;
        if (!once) return true;
        return !(this.state.seen_narrative_intros ?? []).includes(scene.id);
      }
      /** Активно ли сейчас нарративное вводное повествование сцены */
      isSceneIntroActive() {
        const sc = this.campaign.scenes[this.state.scene];
        if (!sc) return false;
        return this.shouldShowNarrativeIntro(sc) && !this.cutscene && !this.dialogue && !this.combat;
      }
      /** Пометить вводное повествование сцены как просмотренное */
      markNarrativeIntroSeen(sceneId) {
        if (!this.state.seen_narrative_intros) this.state.seen_narrative_intros = [];
        if (!this.state.seen_narrative_intros.includes(sceneId)) {
          this.state.seen_narrative_intros.push(sceneId);
          this.autosave();
        }
        if (this.postcard && this.postcardPendingSeconds > 0 && !this.cutsceneQueue.length) {
          const at2 = this.postcardPendingSeconds;
          this.postcardPendingSeconds = 0;
          this.postcardTimer = globalThis.setTimeout(() => this.hidePostcard(), at2 * 1e3);
        } else {
          this.flushPendingBannersIfClear();
        }
        this.notify();
      }
      /** Установить флаг (с поддержкой сброса при false) */
      setFlag(f2, value = true) {
        if (value === false || value === 0 || value === "false") {
          delete this.state.flags[f2];
        } else {
          this.state.flags[f2] = value ?? true;
        }
        if (!this.combat && !this.trade) this.checkRules();
        this.notify();
      }
      /** Сбросить флаг */
      clearFlag(f2) {
        delete this.state.flags[f2];
        if (!this.combat && !this.trade) this.checkRules();
        this.notify();
      }
      /** Проверка присутствия спутника в отряде */
      inParty(entityId) {
        return this.isInParty(entityId);
      }
      /** Вызывается один раз после создания/загрузки. */
      start() {
        if (this.freshRun) {
          this.freshRun = false;
          this.metaRunStart();
          this.checkRules();
          this.fireTrigger("time_tick");
          this.fireTrigger("enter_scene", { sceneId: this.state.scene });
        }
        this.runLocationRules(this.state.location);
        this.autosave();
        this.notify();
      }
      /**
       * Применить выбор с экрана создания персонажа (блок 11 ТЗ) к шаблону
       * `default_player`: имя, характеристики (с пересчётом производных),
       * навыки, снаряжение профессии. Вызывается ДО `start()` на новом забеге.
       */
      applyCharCreation(choice) {
        const creation = this.campaign.meta.char_creation;
        if (!creation) return;
        const s2 = this.state;
        const profession = creation.professions?.find((p2) => p2.id === choice.profession);
        const name = choice.name.trim();
        if (name) s2.player.name = name;
        if (creation.choose_age && choice.age !== void 0) s2.player.age = choice.age;
        if (choice.difficulty && this.campaign.meta.difficulties?.some((d2) => d2.id === choice.difficulty)) {
          s2.player.difficulty = choice.difficulty;
        }
        const pc = {};
        if (choice.portrait && creation.portraits?.some((p2) => p2.id === choice.portrait)) pc.gallery = choice.portrait;
        if (choice.portrait_layers && creation.portrait_layers?.length) {
          const layers = {};
          for (const layer of creation.portrait_layers) {
            const sel = choice.portrait_layers[layer.id];
            if (sel && layer.options.some((o2) => o2.id === sel)) layers[layer.id] = sel;
          }
          if (Object.keys(layers).length) pc.layers = layers;
        }
        if (Object.keys(pc).length) s2.player.portrait_choice = pc;
        else delete s2.player.age;
        if (creation.choose_bio && choice.bio?.trim()) s2.player.bio = choice.bio.trim();
        else delete s2.player.bio;
        const stats = { ...choice.stats };
        delete stats.HP;
        delete stats.MP;
        s2.player.stats = stats;
        s2.player.max_hp = derivedHP(stats);
        s2.player.hp = s2.player.max_hp;
        s2.player.max_mp = derivedMP(stats);
        s2.player.mp = s2.player.max_mp;
        s2.player.skills = { ...choice.skills };
        for (const it2 of profession?.items ?? []) this.addItem(it2.item, it2.quantity, { silent: true });
        s2.char_choice = JSON.parse(JSON.stringify(choice));
        this.pushLog(`${name || "\u0413\u0435\u0440\u043E\u0439"}: \u0437\u0430\u0431\u0435\u0433 \u043D\u0430\u0447\u0438\u043D\u0430\u0435\u0442\u0441\u044F.`);
      }
      // ─────────────── катсцены (итерация 8, блок E) ───────────────
      /** текущая катсцена (первая в очереди) */
      get cutscene() {
        return this.cutsceneQueue[0]?.def ?? null;
      }
      /** уникальный номер показа текущей катсцены (ключ для UI) */
      get cutsceneKey() {
        return this.cutsceneQueue[0]?.serial ?? 0;
      }
      // ─────────────── баннеры и «открытки» (кинематографические эффекты правил) ───────────────
      /** активные баннеры этого забега (визуальный слой, в сохранения не входит) */
      banners = [];
      /** активная «открытка» (одна за раз, новая вытесняет) */
      postcard = null;
      postcardTimer = null;
      postcardPendingSeconds = 0;
      bannerSerial = 1;
      bannerPendingTimers = [];
      showBanner(e2) {
        const serial = this.bannerSerial++;
        this.banners = [...this.banners, { serial, ...e2 }];
        const seconds = e2.seconds ?? Math.min(8, Math.max(3, e2.text.length * 0.06));
        if (this.cutsceneQueue.length > 0) {
          this.bannerPendingTimers.push({ serial, seconds });
        } else {
          globalThis.setTimeout(() => {
            if (this.banners.some((b2) => b2.serial === serial)) {
              this.banners = this.banners.filter((b2) => b2.serial !== serial);
              this.notify();
            }
          }, seconds * 1e3);
        }
        this.notify();
      }
      showPostcard(e2) {
        if (this.postcardTimer) {
          clearTimeout(this.postcardTimer);
          this.postcardTimer = null;
        }
        this.postcard = { image: e2.image, art: e2.art, text: e2.text, preset: e2.preset, seconds: e2.seconds, camera: e2.camera };
        const at2 = Math.max(1, e2.seconds ?? 6);
        if (this.cutsceneQueue.length > 0 || this.isSceneIntroActive()) {
          this.postcardPendingSeconds = at2;
        } else if ((e2.seconds ?? 6) > 0) {
          this.postcardPendingSeconds = 0;
          this.postcardTimer = globalThis.setTimeout(() => this.hidePostcard(), at2 * 1e3);
        }
        this.notify();
      }
      /** закрыть «открытку» (тап или таймер) */
      hidePostcard() {
        if (this.postcardTimer) {
          clearTimeout(this.postcardTimer);
          this.postcardTimer = null;
        }
        this.postcardPendingSeconds = 0;
        if (!this.postcard) return;
        this.postcard = null;
        this.flushPendingBannersIfClear();
        this.notify();
      }
      flushPendingBannersIfClear() {
        if (!this.cutsceneQueue.length && !this.isSceneIntroActive() && !this.postcard && !this.messages.length) {
          if (this.bannerPendingTimers.length) {
            for (const item of this.bannerPendingTimers) {
              globalThis.setTimeout(() => {
                if (this.banners.some((b2) => b2.serial === item.serial)) {
                  this.banners = this.banners.filter((b2) => b2.serial !== item.serial);
                  this.notify();
                }
              }, item.seconds * 1e3);
            }
            this.bannerPendingTimers = [];
          }
        }
      }
      playCutscene(id) {
        const def = this.campaign.cutscenes?.[id];
        if (!def || !def.slides?.length) return;
        if (this.cutsceneQueue.some((c2) => c2.def.id === id)) return;
        stopVoiceAudio();
        this.cutsceneQueue.push({ def, serial: ++this.cutsceneSerial });
        this.pushLog(`\u041A\u0430\u0442\u0441\u0446\u0435\u043D\u0430: \xAB${def.label}\xBB`);
        this.notify();
      }
      /** катсцена досмотрена или пропущена */
      endCutscene() {
        if (!this.cutsceneQueue.length) return;
        stopVoiceAudio();
        this.cutsceneQueue.shift();
        if (!this.cutsceneQueue.length) {
          if (!this.isSceneIntroActive()) {
            if (this.postcard && this.postcardPendingSeconds > 0) {
              const at2 = this.postcardPendingSeconds;
              this.postcardPendingSeconds = 0;
              this.postcardTimer = globalThis.setTimeout(() => this.hidePostcard(), at2 * 1e3);
            }
            this.flushPendingBannersIfClear();
          }
          this.checkRules();
          this.autosave();
        }
        this.notify();
      }
      // ─────────────── время и потребности ───────────────
      /**
       * Условие потребности (когда убывает / когда восстанавливается).
       * Итерация 8, А3: «в локации» и «есть/надет предмет» — СПИСКИ id,
       * условие истинно, если выполнено хотя бы одно значение («любой из»).
       */
      needCondOk(raw) {
        const c2 = migrateNeedCondition(raw);
        switch (c2.type) {
          case "time_of_day":
            return c2.values.includes(timeOfDay(this.state.tick, this.campaign.meta));
          case "flag":
            return !!this.state.flags[c2.flag] !== !!c2.not;
          case "in_location":
            return (c2.locations ?? []).includes(this.state.location) !== !!c2.not;
          case "has_item":
            return (c2.items ?? []).some((id) => this.hasItem(id)) !== !!c2.not;
          case "equipped":
            return (c2.items ?? []).some((id) => this.isEquipped(id)) !== !!c2.not;
          case "weather":
            return (this.state.weather ?? "") === c2.weather !== !!c2.not;
        }
      }
      advanceTicks(ticks) {
        const meta = this.campaign.meta;
        const needsOn = featureOn(meta, "needs");
        for (let i2 = 0; i2 < ticks; i2++) {
          if (this.state.game_over) return;
          this.state.tick += 1;
          this.state.stats_run.ticks_survived += 1;
          if (needsOn) {
            for (const need of meta.needs) {
              const cur = this.state.player.needs[need.id] ?? need.max;
              let next = cur;
              const decays = !need.decay_when?.length || need.decay_when.every((c2) => this.needCondOk(c2));
              if (decays) next = Math.max(0, next - need.decay_per_tick * (this.difficultyDef()?.need_decay ?? 1));
              if (need.restore_per_tick && (!need.restore_when?.length || need.restore_when.every((c2) => this.needCondOk(c2)))) {
                next = Math.min(need.max, next + need.restore_per_tick);
              }
              this.state.player.needs[need.id] = next;
              if (next <= 0 && cur > 0) this.onNeedZero(need.id);
            }
          }
          if (needsOn && this.state.party.length) {
            for (const comp of this.state.party) {
              if (!comp.needs) continue;
              for (const need of meta.needs) {
                const cur = comp.needs[need.id];
                if (cur === void 0) continue;
                let next = cur;
                const decays = !need.decay_when?.length || need.decay_when.every((c2) => this.needCondOk(c2));
                if (decays) next = Math.max(0, next - need.decay_per_tick * (this.difficultyDef()?.need_decay ?? 1));
                if (need.restore_per_tick && (!need.restore_when?.length || need.restore_when.every((c2) => this.needCondOk(c2)))) {
                  next = Math.min(need.max, next + need.restore_per_tick);
                }
                comp.needs[need.id] = next;
                if (next <= 0 && cur > 0) {
                  const cdef = this.campaign.entities[comp.entity];
                  this.pushLog(`${cdef?.label ?? comp.entity} \u043D\u0430 \u043F\u0440\u0435\u0434\u0435\u043B\u0435: ${need.label.toLowerCase()} \u043D\u0430 \u043D\u0443\u043B\u0435.`);
                }
              }
            }
          }
          this.tickStatuses();
          if (this.state.pursuit) {
            this.state.pursuit.left -= 1;
            if (this.state.pursuit.left <= 0) this.tickPursuit();
          }
          const tpd = meta.ticks_per_day ?? 24;
          if (tpd > 0 && this.state.tick > 0 && this.state.tick % tpd === 0) this.tickNpcMood();
          this.tickPerishableItems(1);
        }
        this.checkAchievements();
        this.tickEventTables();
        this.checkRules();
      }
      /** Обработка порчи скоропортящихся предметов со временем (decay_ticks / freshness) */
      tickPerishableItems(ticks) {
        const inv = this.state.player.inventory;
        for (let i2 = inv.length - 1; i2 >= 0; i2--) {
          const slot = inv[i2];
          if (slot.freshness === void 0) continue;
          slot.freshness = Math.max(0, slot.freshness - ticks);
          if (slot.freshness === 0) {
            const def = this.campaign.entities[slot.item];
            const title = def?.label ?? slot.item;
            const msg = def?.spoil_msg || `\xAB${title}\xBB \u0438\u0441\u043F\u043E\u0440\u0442\u0438\u043B\u0441\u044F \u043E\u0442 \u0432\u0440\u0435\u043C\u0435\u043D\u0438.`;
            this.pushLog(msg);
            this.pushToast(msg, "info");
            if (def?.spoil_action === "rule" && def.spoil_rule) {
              this.fireRule(def.spoil_rule);
            }
            if (def?.spoil_into) {
              const replacement = def.spoil_into;
              const repDef = this.campaign.entities[replacement];
              slot.item = replacement;
              slot.freshness = repDef?.decay_ticks !== void 0 ? repDef.decay_ticks : void 0;
              if (repDef?.label) {
                this.pushLog(`\u041F\u0440\u0435\u0432\u0440\u0430\u0442\u0438\u043B\u043E\u0441\u044C \u0432: ${repDef.label}.`);
              }
            } else {
              inv.splice(i2, 1);
              for (const eqSlot of Object.keys(this.state.player.equipment)) {
                if (this.state.player.equipment[eqSlot] === slot.item) {
                  delete this.state.player.equipment[eqSlot];
                }
              }
            }
          }
        }
      }
      /** один тик мировых статусов игрока; статус сам по себе не убивает (мин. 1 HP) */
      tickStatuses() {
        const list = this.state.player.statuses;
        if (!list?.length) return;
        const expired = [];
        const cured = [];
        for (const s2 of list) {
          const def = this.statusDef(s2.id);
          if (!def) continue;
          const severity = Math.max(1, s2.severity ?? 1);
          if (def.dot?.hp) this.state.player.hp = Math.max(1, this.state.player.hp - def.dot.hp * severity);
          if (def.dot?.mp) this.state.player.mp = Math.max(0, this.state.player.mp - def.dot.mp * severity);
          if (def.dot?.hp) this.pushLog(`${def.label}: \u2212${def.dot.hp * severity} HP${severity > 1 ? ` (\u0442\u044F\u0436\u0435\u0441\u0442\u044C ${severity})` : ""}.`);
          if (def.disease && (s2.next_check ?? Infinity) <= this.state.tick) {
            const mult = def.disease.con_multiplier ?? 5;
            const out = skillCheck(this.state.player.stats.CON * mult, this.rng, 0, this.diceRules);
            this.pushLog(`${def.label}: \u0441\u0442\u0430\u0434\u0438\u044F \u0442\u0435\u0447\u0435\u043D\u0438\u044F \u2014 CON\xD7${mult}, d100=${out.roll} \u043F\u0440\u043E\u0442\u0438\u0432 ${out.target} \u2192 ${CHECK_RESULT_LABEL[out.result]}`);
            s2.next_check = this.state.tick + def.disease.interval_ticks;
            if (out.success) {
              s2.severity = Math.max(0, severity - 1);
              if (s2.severity === 0) {
                cured.push(s2.id);
                continue;
              }
              this.pushLog(`${def.label}: \u0442\u044F\u0436\u0435\u0441\u0442\u044C \u0441\u043D\u0438\u0436\u0430\u0435\u0442\u0441\u044F \u0434\u043E ${s2.severity}.`);
            } else {
              const cap = def.disease.severity_max ?? 5;
              s2.severity = Math.min(cap, severity + 1);
              this.pushLog(`${def.label}: \u0431\u043E\u043B\u0435\u0437\u043D\u044C \u0443\u0445\u0443\u0434\u0448\u0430\u0435\u0442\u0441\u044F \u2014 \u0442\u044F\u0436\u0435\u0441\u0442\u044C ${s2.severity}/${cap}.`);
            }
          }
          s2.left -= 1;
          if (s2.left <= 0) expired.push(def);
        }
        if (cured.length) {
          this.state.player.statuses = (this.state.player.statuses ?? []).filter((s2) => !cured.includes(s2.id));
          for (const id of cured) {
            const def = this.statusDef(id);
            this.pushLog(`${def?.label ?? id}: \u0432\u044B\u0437\u0434\u043E\u0440\u043E\u0432\u043B\u0435\u043D\u0438\u0435.`);
          }
        }
        if (expired.length) {
          this.state.player.statuses = list.filter((s2) => s2.left > 0);
          for (const def of expired) {
            this.pushLog(def.expire_message ?? `${def.label}: \u044D\u0444\u0444\u0435\u043A\u0442 \u0437\u0430\u043A\u043E\u043D\u0447\u0438\u043B\u0441\u044F.`);
            if (def.on_expire?.length) this.applyEffects(def.on_expire);
          }
          this.notify();
        }
      }
      onNeedZero(needId) {
        const need = this.campaign.meta.needs.find((n2) => n2.id === needId);
        if (!need) return;
        if (need.on_zero_effect === "death" || !need.on_zero_effect) {
          this.gameOver("death", `\u0421\u043C\u0435\u0440\u0442\u044C \u043E\u0442 \u0438\u0441\u0442\u043E\u0449\u0435\u043D\u0438\u044F: ${need.label.toLowerCase()} \u043D\u0430 \u043D\u0443\u043B\u0435.`);
          return;
        }
        const rule = this.campaign.rules[need.on_zero_effect];
        if (rule) this.applyEffects(rule.effects ?? []);
      }
      changeNeed(needId, delta) {
        if (!featureOn(this.campaign.meta, "needs")) return;
        const need = this.campaign.meta.needs.find((n2) => n2.id === needId);
        if (!need) return;
        const cur = this.state.player.needs[needId] ?? 0;
        const next = Math.min(need.max, Math.max(0, cur + delta));
        this.state.player.needs[needId] = next;
        if (delta > 0) {
          for (const comp of this.state.party) {
            if (comp.needs?.[needId] !== void 0) this.changeCompanionNeed(comp.entity, needId, delta);
          }
        }
        if (next <= 0 && cur > 0) this.onNeedZero(needId);
      }
      changeHp(delta) {
        if (this.debugInvincible && delta < 0) return;
        const p2 = this.state.player;
        p2.hp = Math.min(p2.max_hp, p2.hp + delta);
        if (p2.hp <= 0 && !this.tryBrpSurvival()) this.gameOver("death", "\u0412\u0430\u0448\u0438 \u0440\u0430\u043D\u044B \u043E\u043A\u0430\u0437\u0430\u043B\u0438\u0441\u044C \u0441\u043C\u0435\u0440\u0442\u0435\u043B\u044C\u043D\u044B\u043C\u0438.");
      }
      /**
       * Мировой спасбросок от смерти (режим combat.death.mode='brp'): при HP ≤ 0
       * бросок CON×con_multiplier; успех — герой выживает на грани (1 HP).
       * Истина — смерть отменена.
       */
      tryBrpSurvival() {
        const death = this.campaign.meta.combat?.death;
        if (death?.mode !== "brp") return false;
        const mult = death.con_multiplier ?? 5;
        const out = skillCheck(this.state.player.stats.CON * mult, this.rng, 0, this.diceRules);
        this.pushLog(`\u0413\u0440\u0430\u043D\u044C \u0441\u043C\u0435\u0440\u0442\u0438: CON\xD7${mult} \u2014 d100=${out.roll} \u043F\u0440\u043E\u0442\u0438\u0432 ${out.target}: ${CHECK_RESULT_LABEL[out.result]}`);
        if (!out.success) return false;
        this.state.player.hp = 1;
        this.pushLog("\u0413\u0435\u0440\u043E\u0439 \u0432\u044B\u0436\u0438\u0432\u0430\u0435\u0442 \u043D\u0430 \u0433\u0440\u0430\u043D\u0438 \u0441\u043C\u0435\u0440\u0442\u0438 (1 HP).");
        return true;
      }
      /**
       * Естественное лечение при отдыхе (аудит §5.6 п.3): сон (ink-вызов `sleep`)
       * лечит HP костями из `meta.rest.hp` (умолчание '1d3') и, если не отключено
       * (`rest.mp_full: false`), полностью восстанавливает MP.
       */
      restHeal() {
        const rest = this.campaign.meta.rest;
        const p2 = this.state.player;
        let healed = 0;
        if (p2.hp > 0 && p2.hp < p2.max_hp) {
          healed = Math.min(p2.max_hp - p2.hp, rollDice(rest?.hp ?? "1d3", this.rng));
          if (healed > 0) {
            p2.hp += healed;
            this.pushLog(`\u041E\u0442\u0434\u044B\u0445 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u0442 ${healed} HP.`);
          }
        }
        for (const comp of this.state.party) {
          if (comp.hp > 0 && comp.hp < comp.max_hp) {
            const cHealed = Math.min(comp.max_hp - comp.hp, rollDice(rest?.hp ?? "1d3", this.rng));
            if (cHealed > 0) {
              comp.hp += cHealed;
              const cdef = this.campaign.entities[comp.entity];
              this.pushLog(`${cdef?.label ?? comp.entity} \u043F\u043E\u0434\u043B\u0430\u0442\u0430\u043B\u0441\u044F: +${cHealed} HP.`);
            }
          }
        }
        const mpFull = rest?.mp_full ?? true;
        if (mpFull && p2.mp < p2.max_mp) {
          p2.mp = p2.max_mp;
          this.pushLog("\u0421\u0438\u043B\u044B \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u044B (MP \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E).");
        }
        if (this.luckMax() > 0 && (this.campaign.meta.luck?.rest_luck ?? true) && this.luck() < this.luckMax()) {
          this.state.player.luck = this.luckMax();
          this.pushLog("\u0413\u0435\u0440\u043E\u0439 \u0447\u0443\u0432\u0441\u0442\u0432\u0443\u0435\u0442: \u0443\u0434\u0430\u0447\u0430 \u0432\u0435\u0440\u043D\u0443\u043B\u0430\u0441\u044C.");
        }
        if (this.fatigueMax() > 0) {
          const cfg = this.campaign.meta.vitals?.fatigue;
          const restore = cfg === true ? true : typeof cfg === "object" ? cfg.rest_restore !== false : true;
          if (restore && this.fatigue() < this.fatigueMax()) {
            this.state.player.fatigue = this.fatigueMax();
            this.pushLog("\u0423\u0441\u0442\u0430\u043B\u043E\u0441\u0442\u044C \u043F\u0440\u043E\u0448\u043B\u0430 (\u043E\u0442\u0434\u044B\u0445).");
          }
        }
        return { hp: healed, mpFull };
      }
      // ─────────────── статусы (блок 5 ТЗ «Гибкий движок») ───────────────
      /** определение статуса из реестра кампании */
      statusDef(id) {
        return this.campaign.meta.statuses?.find((s2) => s2.id === id);
      }
      /** активен ли статус у игрока */
      hasStatus(id) {
        return !!this.state.player.statuses?.some((s2) => s2.id === id);
      }
      /**
       * Наложить статус на игрока (в мире — только игрок, v1). Повторное
       * наложение обновляет длительность по максимуму.
       */
      applyStatus(_target, id, duration) {
        const def = this.statusDef(id);
        if (!def || def.scope === "combat") return;
        const left = duration ?? def.duration;
        if (left <= 0) return;
        const list = this.state.player.statuses ??= [];
        const existing = list.find((s2) => s2.id === id);
        if (existing) {
          existing.left = Math.max(existing.left, left);
          return;
        }
        const entry = { id, left };
        if (def.disease) {
          entry.severity = 1;
          entry.next_check = this.state.tick + def.disease.interval_ticks;
        }
        list.push(entry);
        this.pushLog(def.apply_message ?? `${def.label}: \u044D\u0444\u0444\u0435\u043A\u0442 \u043D\u0430\u043B\u043E\u0436\u0435\u043D.`);
        if (def.apply_sound) playInteraction(def.apply_sound, { sound: def.apply_sound });
        if (def.on_apply?.length) this.applyEffects(def.on_apply);
        this.notify();
      }
      /** снять статус (без срабатывания on_expire) */
      removeStatus(_target, id) {
        const list = this.state.player.statuses;
        if (!list?.some((s2) => s2.id === id)) return;
        this.state.player.statuses = list.filter((s2) => s2.id !== id);
        const def = this.statusDef(id);
        if (def) {
          this.pushLog(`${def.label}: \u044D\u0444\u0444\u0435\u043A\u0442 \u0441\u043D\u044F\u0442.`);
          if (def.remove_sound) playInteraction(def.remove_sound, { sound: def.remove_sound });
        }
        this.notify();
      }
      /** суммарный модификатор навыка от активных статусов (болезни масштабированы тяжестью) */
      statusSkillMod(skill) {
        let mod = 0;
        for (const s2 of this.state.player.statuses ?? []) {
          const def = this.statusDef(s2.id);
          const sev = def?.disease ? Math.max(1, s2.severity ?? 1) : 1;
          for (const m2 of def?.skill_mods ?? []) if (m2.skill === skill) mod += m2.delta * sev;
        }
        return mod;
      }
      // ─────────────── инвентарь ───────────────
      hasItem(id) {
        return this.itemCount(id) > 0;
      }
      itemCount(id) {
        return this.state.player.inventory.filter((i2) => i2.item === id).reduce((s2, i2) => s2 + i2.quantity, 0);
      }
      addItem(id, quantity = 1, opts = {}) {
        const inv = this.state.player.inventory;
        const itemDef = this.campaign.entities[id];
        const isPerishable = itemDef?.decay_ticks !== void 0 && itemDef.decay_ticks > 0;
        const initialFreshness = opts.freshness ?? itemDef?.decay_ticks;
        if (this.itemMaxDurability(id) !== void 0 || isPerishable) {
          for (let i2 = 0; i2 < quantity; i2++) {
            inv.push({
              item: id,
              quantity: 1,
              durability: this.itemMaxDurability(id),
              freshness: initialFreshness
            });
          }
        } else {
          const entry = inv.find((i2) => i2.item === id && i2.durability === void 0 && i2.freshness === void 0);
          if (entry) entry.quantity += quantity;
          else inv.push({ item: id, quantity });
        }
        if (!opts.silent) this.pushToast(`\u041F\u043E\u043B\u0443\u0447\u0435\u043D\u043E: ${this.itemTitle(id)}${quantity > 1 ? ` \xD7${quantity}` : ""}.`, "get");
      }
      removeItem(id, quantity = 1, opts = {}) {
        const inv = this.state.player.inventory;
        let left = quantity;
        while (left > 0) {
          const entries = inv.filter((i2) => i2.item === id);
          if (!entries.length) break;
          const max = this.itemMaxDurability(id);
          let pick = entries[0];
          if (max !== void 0) {
            pick = entries.reduce((a2, b2) => (a2.durability ?? max) <= (b2.durability ?? max) ? a2 : b2);
          } else if (entries.some((e2) => e2.freshness !== void 0)) {
            pick = entries.reduce((a2, b2) => (a2.freshness ?? Infinity) <= (b2.freshness ?? Infinity) ? a2 : b2);
          }
          if (pick.quantity > left) {
            pick.quantity -= left;
            left = 0;
          } else {
            left -= pick.quantity;
            inv.splice(inv.indexOf(pick), 1);
          }
        }
        if (!this.hasItem(id)) {
          const eq = this.state.player.equipment;
          for (const slot of Object.keys(eq)) {
            if (eq[slot] === id) delete eq[slot];
          }
        }
        const lost = quantity - left;
        if (!opts.silent && lost > 0) {
          const verb = opts.verb ?? (lost >= quantity ? "\u041F\u043E\u0442\u0435\u0440\u044F\u043D\u043E" : "\u0427\u0430\u0441\u0442\u0438\u0447\u043D\u043E \u043F\u043E\u0442\u0435\u0440\u044F\u043D\u043E");
          this.pushToast(`${verb}: ${this.itemTitle(id)}${lost > 1 ? ` \xD7${lost}` : ""}.`, "lose");
        }
      }
      // ─────────────── износ снаряжения (аудит §5.6 п.10) ───────────────
      /** максимальная прочность предмета (оружие — weapon_data, броня — armor_data); нет — вечный */
      itemMaxDurability(itemId) {
        const def = this.campaign.entities[itemId];
        if (!def || def.type !== "item") return void 0;
        return def.weapon_data?.durability ?? def.armor_data?.durability;
      }
      /** осталось прочности у первого пригодного экземпляра (нет — null) */
      itemDurabilityOf(id) {
        const max = this.itemMaxDurability(id);
        if (max === void 0) return null;
        const entry = this.state.player.inventory.find((i2) => i2.item === id);
        if (!entry) return null;
        return { left: entry.durability ?? max, max };
      }
      /** пригоден ли предмет к использованию (есть экземпляр с прочностью > 0) */
      isItemUsable(id) {
        const max = this.itemMaxDurability(id);
        if (max === void 0) return this.hasItem(id);
        return this.state.player.inventory.some((i2) => i2.item === id && (i2.durability ?? max) > 0);
      }
      /** экземпляры с износом от меньшей прочности (для UI) */
      durabilityEntries(id) {
        const max = this.itemMaxDurability(id);
        if (max === void 0) return [];
        return this.state.player.inventory.filter((i2) => i2.item === id).map((entry) => ({ entry, left: entry.durability ?? max })).sort((a2, b2) => a2.left - b2.left);
      }
      /**
       * Износ предмета игрока (урон в бою): −amount самому надетому экземпляру.
       * Сломанный экземпляр с прочностью 0 сохраняется (для починки рецептом).
       * Истина — предмет сломался этим износом.
       */
      damageItemDurability(itemId, amount = 1) {
        const max = this.itemMaxDurability(itemId);
        if (max === void 0) return false;
        const entry = this.state.player.inventory.filter((i2) => i2.item === itemId && (i2.durability ?? max) > 0).sort((a2, b2) => (a2.durability ?? max) - (b2.durability ?? max))[0];
        if (!entry) return false;
        const before = entry.durability ?? max;
        entry.durability = Math.max(0, before - amount);
        if (entry.durability === 0 && before > 0) {
          const def = this.campaign.entities[itemId];
          this.pushLog(`\xAB${def?.label ?? itemId}\xBB \u0441\u043B\u043E\u043C\u0430\u043B\u0441\u044F!`);
          playUi("defeat");
          return true;
        }
        return false;
      }
      /**
       * Починка (мастер помечает рецепт `repair: true`): восстанавливает самый
       * изношенный экземпляр до максимума. Истина — нашелся изношенный.
       */
      repairItem(itemId) {
        const max = this.itemMaxDurability(itemId);
        if (max === void 0) return false;
        const entry = this.state.player.inventory.filter((i2) => i2.item === itemId).sort((a2, b2) => (a2.durability ?? max) - (b2.durability ?? max))[0];
        if (!entry || (entry.durability ?? max) >= max) return false;
        entry.durability = max;
        const def = this.campaign.entities[itemId];
        this.pushLog(`\xAB${def?.label ?? itemId}\xBB \u043E\u0442\u0440\u0435\u043C\u043E\u043D\u0442\u0438\u0440\u043E\u0432\u0430\u043D.`);
        this.notify();
        this.autosave();
        return true;
      }
      /** свободные «еда предмета» нет изношенных экземпляров — для рецепта починки */
      hasDamaged(itemId) {
        const max = this.itemMaxDurability(itemId);
        if (max === void 0) return false;
        return this.state.player.inventory.some((i2) => i2.item === itemId && (i2.durability ?? max) < max);
      }
      // ─────────────── экипировка (блок 7 ТЗ: слоты задаёт кампания) ───────────────
      /** список слотов экипировки кампании (встроенные + свои) */
      equipmentSlots() {
        return equipmentSlots(this.campaign.meta);
      }
      slotLabel(slotId) {
        return this.equipmentSlots().find((s2) => s2.id === slotId)?.label ?? slotId;
      }
      /** слот, в который экипируется предмет (нет — не экипируется) */
      itemSlot(id) {
        const def = this.campaign.entities[id];
        if (!def || def.type !== "item") return void 0;
        if (def.equip_slot) return def.equip_slot;
        if (def.weapon_data) return "weapon";
        if (def.armor_data) return "armor";
        return void 0;
      }
      /** предмет надет? */
      isEquipped(id) {
        return Object.values(this.state.player.equipment).includes(id);
      }
      /** в каком слоте надет предмет (нет — '') */
      equippedSlotOf(id) {
        const eq = this.state.player.equipment;
        for (const slot of Object.keys(eq)) if (eq[slot] === id) return slot;
        return "";
      }
      /** надеть предмет из инвентаря в его слот */
      equipItem(id) {
        if (!this.hasItem(id)) return;
        const def = this.campaign.entities[id];
        if (!def || def.type !== "item") return;
        const slot = this.itemSlot(id);
        if (!slot) return;
        playInteraction("equip", { entity: def });
        this.state.player.equipment[slot] = id;
        this.pushLog(slot === "weapon" ? `\u0412\u0437\u044F\u0442\u043E \u0432 \u0440\u0443\u043A\u0438: ${def.label}.` : `\u041D\u0430\u0434\u0435\u0442\u043E: ${def.label}.`);
        this.pushToast(slot === "weapon" ? `\u0412\u0437\u044F\u0442\u043E \u0432 \u0440\u0443\u043A\u0438: ${def.label}.` : `\u041D\u0430\u0434\u0435\u0442\u043E: ${def.label}.`, "info");
        this.autosave();
        this.notify();
      }
      /** снять предмет из слота */
      unequipItem(slot) {
        const eq = this.state.player.equipment;
        const id = eq[slot];
        if (!id) return;
        const def = this.campaign.entities[id];
        if (def) playInteraction("unequip", { entity: def });
        delete eq[slot];
        this.pushLog(`\u0421\u043D\u044F\u0442\u043E: ${def?.label ?? id}.`);
        this.pushToast(`\u0421\u043D\u044F\u0442\u043E: ${def?.label ?? id}.`, "info");
        this.autosave();
        this.notify();
      }
      /** текущее оружие игрока (для UI и боя): экипированное или кулаки; сломанное — кулаки */
      playerWeapon() {
        const id = this.state.player.equipment["weapon"];
        if (id && this.isItemUsable(id)) {
          const def = this.campaign.entities[id];
          if (def?.weapon_data) return { itemId: id, weapon: def.weapon_data, label: def.label };
        }
        return {
          itemId: null,
          weapon: { skill: "brawl", damage: "1d3", damage_bonus: true, range: 1, attacks_per_round: 1, parry_capable: false, label: "\u041A\u0443\u043B\u0430\u043A\u0438" },
          label: "\u041A\u0443\u043B\u0430\u043A\u0438"
        };
      }
      /** броня игрока: сумма очков ВСЕХ надетых предметов с бронёй (шлем+кираса) */
      playerArmor() {
        let points = 0;
        let first = null;
        const labels = [];
        for (const slot of Object.keys(this.state.player.equipment)) {
          const id = this.state.player.equipment[slot];
          if (!id || !this.isItemUsable(id)) continue;
          const def = this.campaign.entities[id];
          if (def?.armor_data) {
            points += def.armor_data.points;
            labels.push(def.label);
            if (!first) first = id;
          }
        }
        if (!points) return { itemId: null, points: 0, label: "\u0411\u0435\u0437 \u0431\u0440\u043E\u043D\u0438" };
        return { itemId: first, points, label: labels.join(" + ") };
      }
      useItem(id) {
        const def = this.campaign.entities[id];
        if (!def || def.type !== "item" || !def.on_use) return;
        playInteraction("use", { entity: def });
        this.applyEffects(def.on_use.effects);
        if (def.on_use.consume !== false) this.removeItem(id, 1, { verb: "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u043E" });
        if (def.on_use.message) this.messages.push({ text: this.fmt(def.on_use.message) });
        this.checkRules();
        this.notify();
      }
      // ─────────────── груз и перегруз (ТЗ 4.6, универсальная BRP-система) ───────────────
      currentLoad() {
        let sum = 0;
        for (const e2 of this.state.player.inventory) {
          const def = this.campaign.entities[e2.item];
          if (def?.type === "item") sum += (def.weight ?? 0) * e2.quantity;
        }
        return sum;
      }
      /**
       * Подробный расчёт грузоподъёмности героя с учётом формулы кампании,
       * расовых/видовых множителей существа и надетой экипировки (рюкзаки, экзоскелеты).
       */
      maxLoadDetails() {
        const s2 = this.state.player.stats;
        const encRules = this.campaign.meta.encumbrance;
        const formula = encRules?.formula ?? "str_siz";
        let base = s2.STR + s2.SIZ;
        if (formula === "str_con") base = s2.STR + s2.CON;
        else if (formula === "str_only") base = s2.STR * 2;
        else if (formula === "fixed") base = Math.max(1, encRules?.capacity_multiplier ?? 20);
        const worldMult = encRules?.capacity_multiplier && formula !== "fixed" ? encRules.capacity_multiplier : 1;
        const playerDef = this.campaign.entities[this.state.player.entity];
        const charBonus = playerDef?.carry_capacity_bonus ?? 0;
        const charMult = playerDef?.carry_capacity_mult ?? 1;
        let equipBonus = 0;
        let equipMult = 1;
        for (const slotId of Object.keys(this.state.player.equipment)) {
          const itemId = this.state.player.equipment[slotId];
          if (!itemId) continue;
          const itemDef = this.campaign.entities[itemId];
          if (!itemDef) continue;
          if (typeof itemDef.carry_bonus === "number") equipBonus += itemDef.carry_bonus;
          if (typeof itemDef.carry_mult === "number" && itemDef.carry_mult > 0) equipMult *= itemDef.carry_mult;
        }
        const calculated = (base * worldMult * charMult + charBonus + equipBonus) * equipMult;
        const total = Math.max(1, Math.round(calculated * 10) / 10);
        return {
          base,
          formula,
          worldMult,
          charBonus,
          charMult,
          equipBonus,
          equipMult,
          total
        };
      }
      maxLoad() {
        return this.maxLoadDetails().total;
      }
      /**
       * Ступенчатый статус перегруза:
       * 'normal' — в пределах лимита
       * 'light' — лёгкий перегруз (1.0x .. 1.5x)
       * 'heavy' — тяжёлый перегруз (1.5x .. 2.0x)
       * 'critical' — критический перегруз (> 2.0x, передвижение заблокировано)
       */
      encumbranceStatus() {
        const encRules = this.campaign.meta.encumbrance;
        if (encRules?.enabled === false) return "normal";
        const load = this.currentLoad();
        const max = this.maxLoad();
        if (load <= max) return "normal";
        const critThresh = encRules?.critical_threshold ?? 2;
        if (critThresh > 0 && load > max * critThresh) return "critical";
        const heavyThresh = 1.5;
        if (load > max * heavyThresh) return "heavy";
        return "light";
      }
      encumbranceDebuffs() {
        const status = this.encumbranceStatus();
        const encRules = this.campaign.meta.encumbrance;
        if (status === "normal" || encRules?.enabled === false) {
          return {
            status: "normal",
            label: "\u0412 \u043D\u043E\u0440\u043C\u0435",
            dodgePenalty: 0,
            movPenalty: 0,
            skillPenalty: 0,
            travelMultiplier: 1,
            isBlocked: false
          };
        }
        if (status === "light") {
          return {
            status: "light",
            label: "\u041B\u0451\u0433\u043A\u0438\u0439 \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0437",
            dodgePenalty: encRules?.light_dodge_penalty ?? 10,
            movPenalty: encRules?.light_mov_penalty ?? 1,
            skillPenalty: encRules?.light_agility_skills_penalty ?? 10,
            travelMultiplier: encRules?.travel_penalty === false ? 1 : encRules?.light_travel_multiplier ?? 1.5,
            isBlocked: false
          };
        }
        if (status === "heavy") {
          return {
            status: "heavy",
            label: "\u0422\u044F\u0436\u0451\u043B\u044B\u0439 \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0437",
            dodgePenalty: encRules?.heavy_dodge_penalty ?? 25,
            movPenalty: encRules?.heavy_mov_penalty ?? 2,
            skillPenalty: encRules?.heavy_agility_skills_penalty ?? 25,
            travelMultiplier: encRules?.travel_penalty === false ? 1 : encRules?.heavy_travel_multiplier ?? 2,
            isBlocked: false
          };
        }
        return {
          status: "critical",
          label: "\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0437",
          dodgePenalty: encRules?.critical_dodge_penalty ?? 50,
          movPenalty: encRules?.critical_mov_penalty ?? 3,
          skillPenalty: encRules?.critical_agility_skills_penalty ?? 50,
          travelMultiplier: 999,
          isBlocked: encRules?.travel_penalty !== false
        };
      }
      isOverloaded() {
        return this.encumbranceStatus() !== "normal";
      }
      /**
       * Заблокировано ли перемещение между локациями из-за критического перегруза
       */
      isTravelBlockedByOverload() {
        const encRules = this.campaign.meta.encumbrance;
        if (encRules?.enabled === false || encRules?.travel_penalty === false) return false;
        return this.encumbranceStatus() === "critical";
      }
      // ─────────────── репутация и фракции (ТЗ 4.8) ───────────────
      /**
       * target: id фракции или id NPC.
       * У NPC: base_disposition + личный сдвиг (dispositions[npc.id]) + фракция
       * (если задана) + самочувствие. Личный сдвиг нужен накигэ/драмам, где
       * отношение к человеку важнее «города» — раньше без faction delta глотался.
       */
      getDisposition(target) {
        const npc = this.campaign.entities[target];
        if (npc && npc.type === "npc") {
          const personal = this.state.dispositions[target] ?? 0;
          const factionValue = npc.faction ? this.state.dispositions[npc.faction] ?? 0 : 0;
          const moodShift = Math.round((this.npcMood(target) - 50) / 2);
          return personal + factionValue + (npc.base_disposition ?? 0) + moodShift;
        }
        return this.state.dispositions[target] ?? 0;
      }
      /** самочувствие NPC (0..100, умолчание 50): усталость от пропуска ночёвки по расписанию */
      /**
       * Ключ состояния облика героя: первый активный статус с совпадающим
       * ключом в meta.emotions… но практичнее — известные ключи по порядку:
       * статус из списка активных, иначе 'wounded' (HP < 50%), 'tired' (любая
       * потребность ≤ 25), иначе 'neutral'. Ключи — из реестра состояний мастера.
       */
      heroPortraitStateKey() {
        const p2 = this.state.player;
        if (p2.statuses?.length) return p2.statuses[0].id;
        if (p2.hp * 2 < p2.max_hp) return "wounded";
        for (const v2 of Object.values(this.state.player.needs ?? {})) if (v2 <= 25) return "tired";
        return "neutral";
      }
      /**
       * Стек изображений портрета героя (низ → верх) с учётом состояния:
       * галерея — один кадр; слои — кадры выбранных вариантов по порядку
       * сегментов мастера; вариант облика под ключ состояния меняет кадр,
       * если мастер задал такую запись. Пусто — портрета нет.
       */
      heroPortraitImages() {
        const meta = this.campaign.meta;
        const choice = this.state.player.portrait_choice;
        const key = this.heroPortraitStateKey();
        const withState = (img, states) => states?.[key] || img;
        const out = [];
        if (choice?.layers && meta.char_creation?.portrait_layers?.length) {
          for (const layer of meta.char_creation.portrait_layers) {
            const opt = layer.options.find((o2) => o2.id === choice.layers[layer.id]) ?? layer.options[0];
            if (opt) out.push(withState(opt.image, opt.states));
          }
        } else if (choice?.gallery) {
          const def = meta.char_creation?.portraits?.find((p2) => p2.id === choice.gallery);
          if (def) out.push(withState(def.image, def.states));
        }
        const overlays = Object.entries(this.state.player.equipment ?? {}).flatMap(([slot, id], index) => {
          const item = this.campaign.entities[id];
          return item?.type === "item" && item.hero_appearance?.overlay ? [{ slot, index, order: item.hero_appearance.order ?? index, image: item.hero_appearance.overlay }] : [];
        }).sort((a2, b2) => a2.order - b2.order || a2.index - b2.index);
        out.push(...overlays.map((x2) => x2.image));
        return out;
      }
      /** Статичная боевая фигурка выбирается только из постоянного облика при создании. */
      heroCombatFigure() {
        const meta = this.campaign.meta.char_creation;
        const choice = this.state.player.portrait_choice;
        if (!meta || !choice) return {};
        if (choice.layers && meta.portrait_layers?.length) {
          for (const layer of meta.portrait_layers) {
            const option = layer.options.find((o2) => o2.id === choice.layers[layer.id]);
            if (option?.combat_figure)
              return {
                figure: option.combat_figure,
                mode: option.combat_figure_mode,
                offset: option.combat_facing_offset
              };
          }
        }
        const portrait = meta.portraits?.find((p2) => p2.id === choice.gallery);
        return portrait?.combat_figure ? {
          figure: portrait.combat_figure,
          mode: portrait.combat_figure_mode,
          offset: portrait.combat_facing_offset
        } : {};
      }
      npcMood(entityId) {
        return this.state.npc_mood?.[entityId] ?? 50;
      }
      /** сдвинуть самочувствие NPC (правила/эффекты; K.D. clamp 0..100) */
      changeNpcMood(entityId, delta) {
        const m2 = this.state.npc_mood ??= {};
        m2[entityId] = Math.max(0, Math.min(100, (m2[entityId] ?? 50) + delta));
      }
      changeDisposition(target, delta) {
        const npc = this.campaign.entities[target];
        const key = target;
        if (npc && npc.type !== "npc" && npc.type !== void 0) {
          return;
        }
        const cur = this.state.dispositions[key] ?? 0;
        this.state.dispositions[key] = Math.max(-100, Math.min(100, cur + delta));
        const label = (npc && npc.type === "npc" ? npc.label : void 0) ?? this.campaign.meta.factions?.find((f2) => f2.id === key)?.label ?? key;
        this.pushLog(`\u041E\u0442\u043D\u043E\u0448\u0435\u043D\u0438\u0435 \xAB${label}\xBB: ${delta > 0 ? "+" : ""}${delta} (\u0442\u0435\u043F\u0435\u0440\u044C ${this.getDisposition(key)}).`);
      }
      // ─────────────── квесты (ТЗ 3.7) ───────────────
      startQuest(questId) {
        const quest = this.campaign.quests[questId];
        if (!quest || this.state.quests[questId]) return;
        const first = quest.stages[0];
        this.state.quests[questId] = { stage: first.id, status: "active", journal: [] };
        this.pushLog(`\u041D\u043E\u0432\u044B\u0439 \u043A\u0432\u0435\u0441\u0442: \xAB${quest.label}\xBB`);
        this.messages.push({ text: `\u041D\u043E\u0432\u044B\u0439 \u043A\u0432\u0435\u0441\u0442: \xAB${quest.label}\xBB` });
        playUi("quest_started");
        if (first.on_enter_effects) this.applyEffects(first.on_enter_effects);
      }
      advanceQuestTo(questId, stageId) {
        const quest = this.campaign.quests[questId];
        const qs = this.state.quests[questId];
        if (!quest || !qs || qs.status !== "active" || qs.stage === stageId) return;
        const stage = quest.stages.find((s2) => s2.id === stageId);
        if (!stage) return;
        qs.stage = stageId;
        if (stage.final) {
          qs.status = stage.outcome === "failure" ? "failed" : "completed";
          if (qs.status === "completed") {
            this.state.stats_run.quests_completed += 1;
            this.messages.push({ text: `\u041A\u0432\u0435\u0441\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D: \xAB${quest.label}\xBB` });
            playUi("quest_completed");
          } else {
            this.messages.push({ text: `\u041A\u0432\u0435\u0441\u0442 \u043F\u0440\u043E\u0432\u0430\u043B\u0435\u043D: \xAB${quest.label}\xBB` });
          }
          this.pushLog(`\u041A\u0432\u0435\u0441\u0442 \xAB${quest.label}\xBB: ${qs.status === "completed" ? "\u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D" : "\u043F\u0440\u043E\u0432\u0430\u043B\u0435\u043D"}.`);
        }
        if (stage.on_enter_effects) this.applyEffects(stage.on_enter_effects);
      }
      journalUpdate(questId, textKey) {
        const quest = this.campaign.quests[questId];
        const qs = this.state.quests[questId];
        if (!quest || !qs) return;
        const text = quest.journal_entries[textKey];
        if (text && !qs.journal.includes(text)) {
          qs.journal.push(text);
          this.pushLog(`\u0416\u0443\u0440\u043D\u0430\u043B: ${text}`);
        }
      }
      /** Переходы стадий активных квестов (вызывается из checkRules). */
      checkQuestTransitions() {
        for (const [questId, qs] of Object.entries(this.state.quests)) {
          if (qs.status !== "active") continue;
          const quest = this.campaign.quests[questId];
          const stage = quest?.stages.find((s2) => s2.id === qs.stage);
          if (!stage?.transitions) continue;
          for (const t5 of stage.transitions) {
            if ((t5.conditions ?? []).every((c2) => evalCondition(c2, this))) {
              this.advanceQuestTo(questId, t5.to);
              break;
            }
          }
        }
      }
      // ─────────────── напарники (ТЗ 4.11) ───────────────
      joinParty(entityId) {
        const max = this.campaign.meta.max_companions ?? 1;
        if (this.state.party.length >= max) return;
        if (this.state.party.some((c2) => c2.entity === entityId)) return;
        const def = this.campaign.entities[entityId];
        if (!def || def.type !== "npc") return;
        const hp = def.stats.HP ?? derivedHP(def.stats);
        const comp = { entity: entityId, hp, max_hp: hp };
        if (def.companion_needs?.length && featureOn(this.campaign.meta, "needs")) {
          comp.needs = {};
          for (const id of def.companion_needs) {
            const need = this.campaign.meta.needs.find((n2) => n2.id === id);
            if (need) comp.needs[id] = need.max;
          }
          if (!Object.keys(comp.needs).length) delete comp.needs;
        }
        if (def.companion_carry) comp.inventory = [];
        this.state.party.push(comp);
        this.pushLog(`${def.label} \u043F\u0440\u0438\u0441\u043E\u0435\u0434\u0438\u043D\u044F\u0435\u0442\u0441\u044F \u043A \u0432\u0430\u043C.`);
        this.messages.push({ text: `${def.label} \u043F\u0440\u0438\u0441\u043E\u0435\u0434\u0438\u043D\u044F\u0435\u0442\u0441\u044F \u043A \u043E\u0442\u0440\u044F\u0434\u0443.` });
      }
      /** Текущее значение потребности напарника; null — не в отряде или у существа
       *  потребность не отслеживается… но по контракту «робот не голодает»
       *  неотслеживаемая потребность возвращается максимальной, а не null. */
      companionNeed(entity, needId) {
        const comp = this.state.party.find((c2) => c2.entity === entity);
        if (!comp) return null;
        const need = this.campaign.meta.needs.find((n2) => n2.id === needId);
        if (!need) return null;
        return comp.needs?.[needId] ?? need.max;
      }
      /** Сдвиг потребности напарника; переход через ноль — заметка в лог (без game over). */
      changeCompanionNeed(entity, needId, delta) {
        const comp = this.state.party.find((c2) => c2.entity === entity);
        const need = this.campaign.meta.needs.find((n2) => n2.id === needId);
        if (!comp || !need || comp.needs?.[needId] === void 0) return;
        const cur = comp.needs[needId];
        const next = Math.min(need.max, Math.max(0, cur + delta));
        comp.needs[needId] = next;
        if (next <= 0 && cur > 0) {
          const def = this.campaign.entities[entity];
          this.pushLog(`${def?.label ?? entity} \u043D\u0430 \u043F\u0440\u0435\u0434\u0435\u043B\u0435: ${need.label.toLowerCase()} \u043D\u0430 \u043D\u0443\u043B\u0435.`);
        }
      }
      /** Набор отслеживаемых напарником потребностей (для UI): определения из meta.needs. */
      companionNeedDefs(entity) {
        const comp = this.state.party.find((c2) => c2.entity === entity);
        if (!comp?.needs) return [];
        return this.campaign.meta.needs.filter((n2) => comp.needs[n2.id] !== void 0);
      }
      // ── «вторая сумка» напарника (NpcDef.companion_carry) ──
      /** Груз в сумке напарника, кг. */
      companionLoad(entity) {
        const comp = this.state.party.find((c2) => c2.entity === entity);
        let sum = 0;
        for (const e2 of comp?.inventory ?? []) {
          const def = this.campaign.entities[e2.item];
          if (def?.type === "item") sum += (def.weight ?? 0) * e2.quantity;
        }
        return Math.round(sum * 10) / 10;
      }
      /** Грузоподъёмность напарника: та же формула энкадменса, что у героя,
       *  но по характеристикам существа (его carry_capacity_bonus/mult учтены). */
      companionCapacity(entity) {
        const def = this.campaign.entities[entity];
        if (!def?.stats) return 0;
        const encRules = this.campaign.meta.encumbrance;
        const formula = encRules?.formula ?? "str_siz";
        let base = (def.stats.STR ?? 10) + (def.stats.SIZ ?? 10);
        if (formula === "str_con") base = (def.stats.STR ?? 10) + (def.stats.CON ?? 10);
        else if (formula === "str_only") base = (def.stats.STR ?? 10) * 2;
        else if (formula === "fixed") base = Math.max(1, encRules?.capacity_multiplier ?? 20);
        const worldMult = encRules?.capacity_multiplier && formula !== "fixed" ? encRules.capacity_multiplier : 1;
        const total = base * worldMult * (def.carry_capacity_mult ?? 1) + (def.carry_capacity_bonus ?? 0);
        return Math.max(1, Math.round(total * 10) / 10);
      }
      /** Передать предмет из сумки героя напарнику (нужны оба: в отряде, companion_carry).
       *  Сюжетные предметы (quest_item) — как выбросить и продать — отдать нельзя:
       *  уход или гибель напарника не должна стирать критические вещи навсегда.
       *  `opts.forceQuest` — только для сюжетных эффектов (transfer_to_companion):
       *  мастер сам решает отдать квестовый предмет скриптом. */
      giveItemToCompanion(entity, itemId, quantity = 1, opts = {}) {
        const comp = this.state.party.find((c2) => c2.entity === entity);
        const def = this.campaign.entities[entity];
        if (!comp || !def?.companion_carry || quantity <= 0) return false;
        const itemDef = this.campaign.entities[itemId];
        if (itemDef?.quest_item && !opts.forceQuest) {
          this.pushToast(`${itemDef?.label ?? itemId} \u2014 \u0441\u044E\u0436\u0435\u0442\u043D\u0430\u044F \u0432\u0435\u0449\u044C: \u0435\u0451 \u043D\u0435\u043B\u044C\u0437\u044F \u043F\u0435\u0440\u0435\u0434\u0430\u0442\u044C \u043D\u0430\u043F\u0430\u0440\u043D\u0438\u043A\u0443.`, "info");
          return false;
        }
        const have = this.state.player.inventory.find((i2) => i2.item === itemId)?.quantity ?? 0;
        if (have < quantity) return false;
        if (!comp.inventory) comp.inventory = [];
        this.removeItem(itemId, quantity, { silent: true });
        const slot = comp.inventory.find((i2) => i2.item === itemId);
        if (slot) slot.quantity += quantity;
        else comp.inventory.push({ item: itemId, quantity });
        this.pushLog(`${def.label} \u0431\u0435\u0440\u0451\u0442: ${itemDef?.label ?? itemId} \xD7${quantity}.`);
        this.notify();
        return true;
      }
      /** Забрать предмет из сумки напарника себе. */
      takeItemFromCompanion(entity, itemId, quantity = 1) {
        const comp = this.state.party.find((c2) => c2.entity === entity);
        const slot = comp?.inventory?.find((i2) => i2.item === itemId);
        if (!comp || !slot || slot.quantity < quantity || quantity <= 0) return false;
        slot.quantity -= quantity;
        if (slot.quantity <= 0) {
          comp.inventory = comp.inventory.filter((i2) => i2.quantity > 0);
          for (const [k2, v2] of Object.entries(comp.equipment ?? {})) if (v2 === itemId && !comp.inventory.some((i2) => i2.item === itemId)) delete comp.equipment[k2];
        }
        this.addItem(itemId, quantity, { silent: true });
        const def = this.campaign.entities[entity];
        const itemDef = this.campaign.entities[itemId];
        this.pushLog(`${def?.label ?? entity} \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0442: ${itemDef?.label ?? itemId} \xD7${quantity}.`);
        this.notify();
        return true;
      }
      /** Надеть/снять предмет из сумки напарника на слот экипировки (null — снять). */
      equipCompanionItem(entity, slotId, itemId) {
        const comp = this.state.party.find((c2) => c2.entity === entity);
        if (!comp) return;
        if (itemId && !comp.inventory?.some((i2) => i2.item === itemId)) return;
        comp.equipment = { ...comp.equipment ?? {} };
        if (itemId) comp.equipment[slotId] = itemId;
        else delete comp.equipment[slotId];
        this.notify();
      }
      /** Применить предмет из сумки героя к напарнику: перенаправляет on_use-эффекты
       *  «здоровье» (change_hp) и «потребности» (change_need) на напарника, остальные
       *  эффекты игнорируются; расход предмета — как у героя (on_use.consume). */
      useItemOnCompanion(entity, itemId) {
        const comp = this.state.party.find((c2) => c2.entity === entity);
        const def = this.campaign.entities[entity];
        const item = this.campaign.entities[itemId];
        if (!comp || !def || !item || item.type !== "item" || !item.on_use) return false;
        if (!(this.state.player.inventory.find((i2) => i2.item === itemId)?.quantity ?? 0)) return false;
        let touched = false;
        for (const eff of item.on_use.effects) {
          if (eff.type === "change_hp" && comp.hp > 0) {
            const before = comp.hp;
            comp.hp = Math.max(1, Math.min(comp.max_hp, comp.hp + eff.delta));
            if (comp.hp !== before) touched = true;
          } else if (eff.type === "change_need") {
            if (comp.needs?.[eff.need] !== void 0) {
              this.changeCompanionNeed(entity, eff.need, eff.delta);
              touched = true;
            }
          }
        }
        if (!touched) return false;
        playInteraction("use", { entity: item });
        if (item.on_use.consume !== false) this.removeItem(itemId, 1, { verb: "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u043E" });
        this.pushLog(`${item.label} \u2014 \u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u043E \u043A ${def.label}.`);
        this.checkRules();
        this.notify();
        return true;
      }
      /** Напарник покидает отряд (отпустить, скрипт, гибель в бою).
       *  Его сумка возвращается герою — иначе переданные вещи стирались бы навсегда
       *  (до этого так и было: мягкая блокировка при гибели носильщика). */
      leaveParty(entityId) {
        const i2 = this.state.party.findIndex((c2) => c2.entity === entityId);
        if (i2 < 0) return;
        const comp = this.state.party[i2];
        const def = this.campaign.entities[entityId];
        const returned = (comp.inventory ?? []).filter((e2) => e2.quantity > 0);
        if (returned.length) {
          for (const e2 of returned) this.addItem(e2.item, e2.quantity, { silent: true });
          const list = returned.map((e2) => `${this.campaign.entities[e2.item]?.label ?? e2.item}${e2.quantity > 1 ? ` \xD7${e2.quantity}` : ""}`).join(", ");
          this.pushLog(`${def?.label ?? entityId} \u043E\u0442\u0434\u0430\u0451\u0442 \u0432\u0430\u043C: ${list}.`);
          this.pushToast(`${def?.label ?? entityId} \u043E\u0442\u0434\u0430\u0451\u0442 \u0432\u0430\u043C \u0432\u0435\u0449\u0438 \u0438\u0437 \u0441\u0443\u043C\u043A\u0438: ${list}.`, "get");
        }
        this.state.party.splice(i2, 1);
        this.notify();
      }
      isInParty(entityId) {
        return this.state.party.some((c2) => c2.entity === entityId);
      }
      // ─────────────── удача (аудит §5.6 п.8) ───────────────
      /** максимум удачи: POW × meta.luck.multiplier (умолчание 5). Система opt-in: нет meta.luck — удачи нет. */
      luckMax() {
        const cfg = this.campaign.meta.luck;
        if (!cfg) return 0;
        const mult = cfg.multiplier ?? 5;
        return Math.max(0, this.state.player.stats.POW * mult);
      }
      /** текущие очки удачи (старые сейвы без поля считаются полными) */
      luck() {
        const max = this.luckMax();
        return Math.min(max, this.state.player.luck ?? max);
      }
      /** потратить/вернуть очки удачи; ложь — не хватает */
      changeLuck(delta) {
        const cur = this.luck();
        const next = Math.max(0, Math.min(this.luckMax(), cur + delta));
        if (delta < 0 && cur + delta < 0) return false;
        this.state.player.luck = next;
        return true;
      }
      // ─────────────── производные опции B6: усталость, рассудок, репутация, достаток, страсти, причастность ───────────────
      /** максимум усталости: (STR+CON)×множитель; opt-in meta.vitals.fatigue */
      fatigueMax() {
        const cfg = this.campaign.meta.vitals?.fatigue;
        if (!cfg) return 0;
        const mult = cfg === true ? 1 : cfg.multiplier ?? 1;
        return Math.max(0, Math.round((this.state.player.stats.STR + this.state.player.stats.CON) * mult));
      }
      /** текущая усталость (полная по умолчанию, как удача) */
      fatigue() {
        const max = this.fatigueMax();
        return Math.min(max, this.state.player.fatigue ?? max);
      }
      /** израсходовать/восстановить усталость; ложь — запаса не хватит */
      changeFatigue(delta) {
        const max = this.fatigueMax();
        if (max === 0 && delta !== 0) return true;
        const cur = this.fatigue();
        if (delta < 0 && cur + delta < 0) {
          this.state.player.fatigue = 0;
          this.pushLog("\u0412\u044B \u043D\u0430 \u043F\u0440\u0435\u0434\u0435\u043B\u0435: \u043E\u0447\u043A\u0438 \u0443\u0441\u0442\u0430\u043B\u043E\u0441\u0442\u0438 \u043D\u0430 \u043D\u0443\u043B\u0435!");
          this.checkRules();
          this.notify();
          return false;
        }
        this.state.player.fatigue = Math.max(0, Math.min(max, cur + delta));
        this.checkRules();
        this.notify();
        return true;
      }
      /** максимум рассудка: POW×множитель; opt-in meta.vitals.sanity */
      sanityMax() {
        const cfg = this.campaign.meta.vitals?.sanity;
        if (!cfg) return 0;
        const mult = cfg === true ? 5 : cfg.multiplier ?? 5;
        return Math.max(0, this.state.player.stats.POW * mult);
      }
      /** текущий рассудок */
      sanity() {
        const max = this.sanityMax();
        return Math.min(max, this.state.player.sanity ?? max);
      }
      /** потеря/исцеление рассудка; пороги/психозы — правилами на sanity_le */
      changeSanity(delta) {
        const max = this.sanityMax();
        if (max === 0 && delta !== 0) return;
        const next = Math.max(0, Math.min(max, this.sanity() + delta));
        const lost = next - this.sanity();
        this.state.player.sanity = next;
        if (lost < 0) this.pushLog(`\u0420\u0430\u0441\u0441\u0443\u0434\u043E\u043A \u0442\u0440\u0435\u0449\u0438\u0442: ${lost}. (\u0441\u0435\u0439\u0447\u0430\u0441 ${next}/${max})`);
        else if (lost > 0) this.pushLog(`\u041C\u044B\u0441\u043B\u0438 \u043F\u0440\u043E\u044F\u0441\u043D\u044F\u044E\u0442\u0441\u044F: \u0440\u0430\u0441\u0441\u0443\u0434\u043E\u043A +${lost}. (\u0441\u0435\u0439\u0447\u0430\u0441 ${next}/${max})`);
        this.checkRules();
        this.notify();
      }
      /** репутация (opt-in meta.reputation) */
      reputation() {
        return Math.max(0, this.state.player.reputation ?? 0);
      }
      /** репутация включена мастером */
      /** Настраиваемая системная надпись интерфейса (design-doc §9, meta.ui_labels) */
      uiLabel(key, fallback) {
        return this.campaign.meta.ui_labels?.[key]?.trim() || fallback;
      }
      reputationEnabled() {
        return !!this.campaign.meta.reputation;
      }
      reputationLabel() {
        const cfg = this.campaign.meta.reputation;
        return typeof cfg === "object" && cfg?.label || "\u0420\u0435\u043F\u0443\u0442\u0430\u0446\u0438\u044F";
      }
      changeReputation(delta) {
        const next = Math.max(0, this.reputation() + delta);
        this.state.player.reputation = next;
        if (delta > 0) this.pushLog(`\u0421\u043B\u0430\u0432\u0430 \u043E \u0432\u0430\u0441 \u0440\u0430\u0441\u0442\u0451\u0442: \u0440\u0435\u043F\u0443\u0442\u0430\u0446\u0438\u044F ${next}.`);
        else if (delta < 0) this.pushLog(`\u041E \u0432\u0430\u0441 \u043E\u0442\u0437\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u0445\u0443\u0436\u0435: \u0440\u0435\u043F\u0443\u0442\u0430\u0446\u0438\u044F ${next}.`);
        this.checkRules();
        this.notify();
      }
      /** шкала достатка (opt-in meta.wealth_levels) */
      wealthLevels() {
        return this.campaign.meta.wealth_levels ?? [];
      }
      /** текущий уровень достатка (индекс в шкале) */
      wealthLevel() {
        const lv = this.wealthLevels();
        return Math.max(0, Math.min(lv.length - 1, this.state.player.wealth_level ?? 0));
      }
      wealthLevelLabel() {
        return this.wealthLevels()[this.wealthLevel()] ?? "";
      }
      /** сдвиг достатка на ±levels ступеней */
      changeWealth(levels) {
        const lv = this.wealthLevels();
        if (!lv.length) return;
        const next = Math.max(0, Math.min(lv.length - 1, this.wealthLevel() + levels));
        if (next === this.wealthLevel()) return;
        this.state.player.wealth_level = next;
        this.pushLog(`\u0412\u0430\u0448 \u0434\u043E\u0441\u0442\u0430\u0442\u043E\u043A \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F: \u0442\u0435\u043F\u0435\u0440\u044C \xAB${lv[next]}\xBB.`);
        this.checkRules();
        this.notify();
      }
      /** страсть: значение 0..100+ */
      passion(id) {
        return this.state.player.passions?.[id] ?? 0;
      }
      passionLabel(id) {
        return this.campaign.meta.passions_list?.find((p2) => p2.id === id)?.label ?? id;
      }
      /** создать/сдвинуть страсть (clamped ≥ 0); лог первого появления */
      changePassion(id, delta) {
        const p2 = this.state.player;
        p2.passions ??= {};
        const next = Math.max(0, (p2.passions[id] ?? 0) + delta);
        const fresh = p2.passions[id] == null;
        p2.passions[id] = next;
        if (fresh) this.pushLog(`\u0412 \u0432\u0430\u0441 \u0437\u0430\u0436\u0438\u0433\u0430\u0435\u0442\u0441\u044F \u0441\u0442\u0440\u0430\u0441\u0442\u044C: \xAB${this.passionLabel(id)}\xBB (${next}).`);
        else this.pushLog(`\u0421\u0442\u0440\u0430\u0441\u0442\u044C \xAB${this.passionLabel(id)}\xBB: ${delta > 0 ? "+" : ""}${delta} \u2192 ${next}.`);
        this.checkRules();
        this.notify();
      }
      /** очки причастности силе */
      allegiance(id) {
        return this.state.player.allegiance?.[id] ?? 0;
      }
      allegianceLabel(id) {
        return this.campaign.meta.allegiances?.find((a2) => a2.id === id)?.label ?? id;
      }
      /** +очки причастности (по книге без снижения, дельта 0..100+) */
      changeAllegiance(id, points) {
        const p2 = this.state.player;
        p2.allegiance ??= {};
        const next = Math.max(0, (p2.allegiance[id] ?? 0) + points);
        const fresh = p2.allegiance[id] == null;
        p2.allegiance[id] = next;
        if (fresh) this.pushLog(`\u0412\u044B \u043E\u0431\u0440\u0435\u0442\u0430\u0435\u0442\u0435 \u043F\u0440\u0438\u0447\u0430\u0441\u0442\u043D\u043E\u0441\u0442\u044C \u043A \xAB${this.allegianceLabel(id)}\xBB (${next}).`);
        else if (points > 0) this.pushLog(`\u041F\u0440\u0438\u0447\u0430\u0441\u0442\u043D\u043E\u0441\u0442\u044C \xAB${this.allegianceLabel(id)}\xBB: +${points} \u2192 ${next}.`);
        else this.pushLog(`\u041F\u0440\u0438\u0447\u0430\u0441\u0442\u043D\u043E\u0441\u0442\u044C \xAB${this.allegianceLabel(id)}\xBB: ${points} \u2192 ${next}.`);
        this.checkRules();
        this.notify();
      }
      /**
       * Базовый шанс навыка (без обучения). Формула 'DEX×2' ('×' или '*'),
       * несколько слагаемых через '+': 'DEX×2+INT'.
       * Возвращает 0, если у навыка нет base (необученный даёт 0% — как раньше).
       */
      skillBaseChance(skillId) {
        const def = this.campaign.meta.skills?.find((s2) => s2.id === skillId);
        const base = def?.base;
        if (base == null) return 0;
        if (typeof base === "number") return base;
        const stats = this.state.player.stats;
        let total = 0;
        for (const part of base.split("+")) {
          const m2 = part.trim().match(/^([A-Z]+)(?:\s*[×x*]\s*(\d+))?$/);
          if (!m2) continue;
          const stat = stats[m2[1]] ?? 0;
          total += stat * (m2[2] ? parseInt(m2[2], 10) : 1);
        }
        return total;
      }
      /**
       * Эффективное значение навыка для проверок вне боя: изученный навык,
       * иначе базовый шанс (если у навыка задан `base` в реестре кампании).
       */
      skillEffective(skillId) {
        const learned = this.state.player.skills[skillId];
        return learned != null ? learned : this.skillBaseChance(skillId);
      }
      /**
       * Тренировка характеристики (аудит B6): прибавка с клампом по stat_limits
       * кампании; пересчитывает производные пулы (HP/MP/усталость/рассудок).
       */
      trainStat(stat, delta) {
        const p2 = this.state.player;
        const stats = p2.stats;
        if (!(stat in stats)) return;
        const lim = this.campaign.meta.char_creation?.stat_limits;
        const min = lim?.min ?? 1;
        const max = lim?.max ?? 99;
        const next = Math.max(min, Math.min(max, stats[stat] + delta));
        if (next === stats[stat]) return;
        stats[stat] = next;
        this.pushLog(`\u0422\u0440\u0435\u043D\u0438\u0440\u043E\u0432\u043A\u0430 \u0434\u0430\u043B\u0430 \u043F\u043B\u043E\u0434\u044B: ${this.statLabel(stat)} ${delta > 0 ? "+" : ""}${delta} \u2192 ${next}.`);
        const newMaxHp = derivedHP(p2.stats);
        if (newMaxHp !== p2.max_hp) {
          const diff = newMaxHp - p2.max_hp;
          p2.max_hp = newMaxHp;
          p2.hp = Math.max(1, Math.min(p2.max_hp, p2.hp + Math.max(0, diff)));
        }
        const newMaxMp = derivedMP(p2.stats);
        if (newMaxMp !== p2.max_mp) {
          const diff = newMaxMp - p2.max_mp;
          p2.max_mp = newMaxMp;
          p2.mp = Math.max(0, Math.min(p2.max_mp, p2.mp + Math.max(0, diff)));
        }
        this.checkRules();
        this.notify();
      }
      /** каноническое имя характеристики (всегда на латинице: STR, CON, SIZ, DEX, INT, POW, CHA, EDU) */
      statLabel(stat) {
        return stat.toUpperCase();
      }
      // ─────────────── уровни и черты (аудит B8, opt-in meta.progression) ───────────────
      /** система уровней включена мастером */
      progressionEnabled() {
        return !!this.campaign.meta.progression;
      }
      /** текущий уровень (старт 1) */
      level() {
        return Math.max(1, this.state.player.level ?? 1);
      }
      /** текущий запас опыта */
      xp() {
        return Math.max(0, this.state.player.xp ?? 0);
      }
      /** сколько опыта нужно, чтобы взять следующий уровень (кумулятивно) */
      xpForLevel(level) {
        const base = this.campaign.meta.progression?.xp_per_level ?? 100;
        return base * level;
      }
      /** опыт до следующего уровня или до потолка */
      xpToNext() {
        if (!this.progressionEnabled()) return null;
        const max = this.campaign.meta.progression?.max_level;
        if (max != null && this.level() >= max) return null;
        return this.xpForLevel(this.level()) - this.xp();
      }
      /** нераспределённых черт (по умолчанию по одной за уровень) */
      pendingFeats() {
        if (!this.progressionEnabled()) return 0;
        const per = this.campaign.meta.progression?.feats_per_level ?? 1;
        return Math.max(0, (this.level() - 1) * per - (this.state.player.feats ?? []).length);
      }
      /** начислить опыт; при достижении порога — уровень ↑ (одна итерация) */
      grantXp(points) {
        if (!this.progressionEnabled() || points <= 0) return;
        const p2 = this.state.player;
        const cap = this.campaign.meta.progression?.max_level;
        if (cap != null && this.level() >= cap) return;
        p2.xp = this.xp() + points;
        this.pushLog(`\u041E\u043F\u044B\u0442: +${points} (\u0432\u0441\u0435\u0433\u043E ${p2.xp}, \u0434\u043E \u0441\u043B\u0435\u0434. \u0443\u0440\u043E\u0432\u043D\u044F ${this.xpToNext() ?? "\u043F\u043E\u0442\u043E\u043B\u043E\u043A"}).`);
        while (this.xp() >= this.xpForLevel(this.level())) {
          const max = this.campaign.meta.progression?.max_level;
          if (max != null && this.level() >= max) break;
          p2.xp = this.xp() - this.xpForLevel(this.level());
          p2.level = this.level() + 1;
          const slots = this.campaign.meta.progression?.feats_per_level ?? 1;
          this.pushLog(`\u0423\u0440\u043E\u0432\u0435\u043D\u044C ${p2.level}!${slots > 0 ? ` \u0414\u043E\u0441\u0442\u0443\u043F\u043D\u043E ${slots} \u0447\u0451\u0440\u0442(\u0430) \u043A \u0432\u044B\u0431\u043E\u0440\u0443 \u0432 \u043B\u0438\u0441\u0442\u0435 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430.` : ""}`);
          this.checkRules();
        }
        this.notify();
      }
      /** дефолтного набора черт */
      availableFeats() {
        if (!this.progressionEnabled()) return [];
        const taken = new Set(this.state.player.feats ?? []);
        return (this.campaign.meta.progression?.feats ?? []).filter((f2) => !taken.has(f2.id));
      }
      /** доступна ли черта (условия requires) */
      featEligible(feat) {
        if (!feat.requires?.length) return true;
        return feat.requires.every((c2) => evalCondition(c2, this));
      }
      /** взять черту точкой прокачки (слоты расходуются) */
      takeFeat(id) {
        if (!this.progressionEnabled() || this.pendingFeats() <= 0) return false;
        const feat = this.availableFeats().find((f2) => f2.id === id);
        if (!feat || !this.featEligible(feat)) return false;
        this.applyFeat(feat);
        this.pushLog(`\u0412\u0437\u044F\u0442\u0430 \u0447\u0435\u0440\u0442\u0430 \xAB${feat.label}\xBB.`);
        this.notify();
        return true;
      }
      /** выдать черту напрямую (эффект grant_feat, без счёта слотов) */
      grantFeat(id) {
        if (!this.progressionEnabled()) return;
        const feat = this.campaign.meta.progression?.feats?.find((f2) => f2.id === id);
        if (!feat || (this.state.player.feats ?? []).includes(id)) return;
        this.applyFeat(feat);
        this.pushLog(`\u041E\u0441\u0432\u043E\u0435\u043D\u0430 \u0447\u0435\u0440\u0442\u0430 \xAB${feat.label}\xBB.`);
        this.checkRules();
        this.notify();
      }
      /** применение бонусов черты (уже взята) */
      applyFeat(feat) {
        const p2 = this.state.player;
        p2.feats ??= [];
        p2.feats.push(feat.id);
        const mods = feat.mods ?? {};
        for (const [skill, delta] of Object.entries(mods.skills ?? {})) {
          p2.skills[skill] = Math.max(0, (p2.skills[skill] ?? 0) + delta);
        }
        for (const [stat, delta] of Object.entries(mods.stats ?? {})) {
          if (delta) this.trainStat(stat, delta);
        }
        if (mods.hp) {
          p2.max_hp = Math.max(1, p2.max_hp + mods.hp);
          p2.hp = Math.min(p2.max_hp, p2.hp + mods.hp);
        }
        if (mods.mp) {
          p2.max_mp = Math.max(0, p2.max_mp + mods.mp);
          p2.mp = Math.min(p2.max_mp, p2.mp + mods.mp);
        }
        this.checkRules();
      }
      /** движение героя: базовое + перманентные бонусы черт */
      playerMovement() {
        let mov = movement(this.state.player.stats);
        for (const fid of this.state.player.feats ?? []) {
          const f2 = this.campaign.meta.progression?.feats?.find((x2) => x2.id === fid);
          mov += f2?.mods?.mov ?? 0;
        }
        return Math.max(1, mov);
      }
      // ─────────────── опасности, преступления, цены, лагерь (аудит B7) ───────────────
      /**
       * Падение (аудит B7): урон = floor(meters / porog) кубиков, смягчающая
       * проверка навыком (умолчание dodge) уполовинивает. Порог и кубик
       * настраиваются в meta.hazards (книжные: 3 м на 1d6).
       */
      applyFall(meters, skill) {
        const hz = this.campaign.meta.hazards;
        const perDie = Math.max(1, hz?.fall_meters_per_die ?? 3);
        const dice = Math.floor(Math.max(0, meters) / perDie);
        const sane = dice <= 0 ? "0" : `${dice}d6`;
        let dmg = 0;
        let modLog = "";
        const p2 = this.state.player;
        if (dice > 0) {
          const skillId = skill ?? "dodge";
          const known = p2.skills[skillId];
          if (known != null && known > 0) {
            const out = skillCheck(Math.max(1, known), this.rng, 0, this.diceRules);
            if (out.success) {
              modLog = ` (${this.skillLabel(skillId)} \u0441\u043C\u044F\u0433\u0447\u0430\u0435\u0442: \u043F\u043E\u043B\u043E\u0432\u0438\u043D\u0430)`;
            }
            dmg = rollDice(sane, this.rng);
            if (out.success) dmg = Math.max(0, Math.ceil(dmg / 2));
            this.pushLog(`\u041F\u0430\u0434\u0435\u043D\u0438\u0435 \u0441 ${meters} \u043C \u2014 d100=${out.roll} \u043F\u0440\u043E\u0442\u0438\u0432 ${out.target}: ${CHECK_RESULT_LABEL[out.result]}${modLog}`);
          } else {
            dmg = rollDice(sane, this.rng);
            this.pushLog(`\u041F\u0430\u0434\u0435\u043D\u0438\u0435 \u0441 ${meters} \u043C: ${dmg} \u0443\u0440\u043E\u043D\u0430 (${sane}).`);
          }
        }
        if (dmg > 0) this.changeHp(-dmg);
        else this.pushLog("\u041F\u0430\u0434\u0435\u043D\u0438\u0435 \u043E\u0431\u043E\u0448\u043B\u043E\u0441\u044C \u0431\u0435\u0437 \u0441\u0435\u0440\u044C\u0451\u0437\u043D\u044B\u0445 \u0442\u0440\u0430\u0432\u043C.");
        this.notify();
      }
      /** реестр преступления из кампании */
      crimeLabel(id) {
        return this.campaign.meta.crimes?.find((c2) => c2.id === id)?.label ?? id;
      }
      /** зафиксировать преступление героя (аудит B7) */
      commitCrime(id, bounty = 0) {
        const s2 = this.state;
        s2.crimes ??= {};
        if (s2.crimes[id]) {
          s2.crimes[id].bounty += Math.max(0, bounty);
        } else {
          s2.crimes[id] = { bounty: Math.max(0, bounty), tick: s2.tick };
        }
        this.pushLog(`\u0421\u043E\u0432\u0435\u0440\u0448\u0435\u043D\u043E \u043F\u0440\u0435\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0435: \xAB${this.crimeLabel(id)}\xBB${bounty > 0 ? ` (\u043D\u0430\u0433\u0440\u0430\u0434\u0430 \u0437\u0430 \u0433\u043E\u043B\u043E\u0432\u0443 ${bounty})` : ""}.`);
        this.checkRules();
        this.notify();
      }
      /** преступление совершено? (любое — без id; minBounty — порог награды) */
      hasCrime(id, minBounty = 0) {
        const list = this.state.crimes ?? {};
        if (!id) return Object.values(list).some((c3) => minBounty <= 0 ? true : c3.bounty >= minBounty);
        const c2 = list[id];
        if (!c2) return false;
        return minBounty <= 0 ? true : c2.bounty >= minBounty;
      }
      /** суммарная награда за голову героя */
      bountyTotal() {
        return Object.values(this.state.crimes ?? {}).reduce((sum, c2) => sum + c2.bounty, 0);
      }
      /** активные ценовые события */
      priceEventsActive() {
        const reg = this.campaign.meta.price_events ?? [];
        return (this.state.price_events ?? []).map((id) => ({ id, label: reg.find((e2) => e2.id === id)?.label ?? id }));
      }
      /** включить/выключить ценовое событие (аудит B7) */
      setPriceEvent(id, on) {
        const list = this.state.price_events ??= [];
        if (on) {
          if (!this.campaign.meta.price_events?.some((e2) => e2.id === id)) return;
          if (!list.includes(id)) {
            list.push(id);
            this.pushLog(`\u0426\u0435\u043D\u043D\u0438\u043A \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F: \xAB${this.campaign.meta.price_events.find((e2) => e2.id === id).label}\xBB.`);
          }
        } else if (id) {
          const i2 = list.indexOf(id);
          if (i2 >= 0) list.splice(i2, 1);
        } else if (list.length) {
          list.length = 0;
          this.pushLog("\u0426\u0435\u043D\u043D\u0438\u043A\u0438 \u0441\u043D\u043E\u0432\u0430 \u043F\u0440\u0435\u0436\u043D\u0438\u0435.");
        }
        this.checkRules();
        this.notify();
      }
      /** множитель цен по активным ценовым событиям для данного предмета */
      priceEventMultiplier(item) {
        if (!this.state.price_events?.length) return 1;
        let mult = 1;
        for (const id of this.state.price_events) {
          const ev = this.campaign.meta.price_events?.find((e2) => e2.id === id);
          if (!ev) continue;
          if (ev.items?.length && !ev.items.includes(item.id)) continue;
          if (ev.categories?.length && !ev.categories.includes(item.category)) continue;
          mult *= ev.multiplier;
        }
        return mult;
      }
      /** разрешён ли здесь лагерь (аудит B7): meta.camping + локация с camp: true */
      campAvailable() {
        const cfg = this.campaign.meta.camping;
        if (!cfg) return { ok: false, reason: "\u043C\u0430\u0441\u0442\u0435\u0440 \u043D\u0435 \u0432\u043A\u043B\u044E\u0447\u0438\u043B \u043D\u043E\u0447\u043B\u0435\u0433 (meta.camping)" };
        if (this.combat || this.trade || this.craftRequest) return { ok: false, reason: "\u0441\u0435\u0439\u0447\u0430\u0441 \u043D\u0435 \u0434\u043E \u043E\u0442\u0434\u044B\u0445\u0430" };
        const loc = this.findLocation(this.state.location)?.location;
        if (!loc?.camp) return { ok: false, reason: "\u0437\u0434\u0435\u0441\u044C \u043B\u0430\u0433\u0435\u0440\u044C \u043D\u0435 \u0440\u0430\u0437\u0431\u0438\u0442\u044C (location.camp)" };
        return { ok: true, reason: "" };
      }
      /**
       * Ночлег в лагере (аудит B7): advanceTicks(cfg.ticks), рост навыков,
       * естественное лечение, возможная засада — правило мастера
       * (meta.camping.ambush_rule, шанс ambush_chance). Восстановление
       * потребностей — опционально, meta.camping.restore (аудит кампании 2026):
       * применяется ПОСЛЕ хода времени через changeNeed (общий стол для плюса).
       */
      // ─────────────── длительные действия (dz.20) ───────────────
      /**
       * Запрос окна выбора длительности (сон и т.п.). Не сохраняется в сейв:
       * если игрок закрыл игру с открытым окном — действие просто не началось.
       */
      durationRequest = null;
      /** Типы эффектов, разрешённых в почасовом per_tick (белый список dz.20). */
      static DURATION_TICK_EFFECTS = /* @__PURE__ */ new Set([
        "change_need",
        "change_hp",
        "change_fatigue",
        "change_sanity"
      ]);
      applyTickEffects(effects, skipped) {
        if (!effects) return;
        for (const fx of effects) {
          if (!_GameEngine.DURATION_TICK_EFFECTS.has(fx.type)) {
            if (!skipped.done) {
              this.pushLog(`\u0414\u0432\u0438\u0433\u0430\u0442\u0435\u043B\u044C: \u044D\u0444\u0444\u0435\u043A\u0442 '${fx.type}' \u043D\u0435 \u0432\u0445\u043E\u0434\u0438\u0442 \u0432 \u0431\u0435\u043B\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0438 \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D.`);
              skipped.done = true;
            }
            continue;
          }
          this.applyEffect(fx);
        }
      }
      /**
       * Общий цикл «провести N тиков»: почасовое применение per_tick ДО
       * тикания потребностей, честные почасовые прерывания, стан-условия
       * break_when, эффекты on_finish — только при полном завершении.
       * Смерть/конец игры посреди цикла обрывают действие (on_zero_effect
       * потребностей и смертельный урон честны: «умереть во сне» возможно).
       */
      runTicksFlow(opts) {
        const skipped = { done: false };
        for (let i2 = 0; i2 < opts.ticks; i2++) {
          if (this.state.game_over) return;
          this.applyTickEffects(opts.perTick, skipped);
          this.advanceTicks(1);
          if (this.state.game_over) return;
          if (opts.breakWhen && opts.breakWhen.some((c2) => evalCondition(c2, this))) {
            this.interruptTicksFlow(opts.label, opts.interruptRule, i2 + 1);
            return;
          }
          if ((opts.interruptChance ?? 0) > 0 && this.rng.chance(opts.interruptChance)) {
            this.interruptTicksFlow(opts.label, opts.interruptRule, i2 + 1);
            return;
          }
        }
        opts.after?.();
        if (opts.onFinish) {
          for (const fx of opts.onFinish) this.applyEffect(fx);
        }
        this.pushLog(`${opts.label} \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E: \u043F\u0440\u043E\u0448\u043B\u043E ${opts.ticks} \u0447.`);
        this.autosave();
        this.notify();
      }
      interruptTicksFlow(label, rule, afterTicks) {
        this.pushLog(`${label} \u043F\u0440\u0435\u0440\u0432\u0430\u043D\u043E \u043D\u0430 ${afterTicks}-\u043C \u0447\u0430\u0441\u0443: \u0447\u0442\u043E-\u0442\u043E \u043F\u043E\u0448\u043B\u043E \u043D\u0435 \u043F\u043E \u043F\u043B\u0430\u043D\u0443.`);
        if (rule) this.fireRule(rule);
        this.autosave();
        this.notify();
      }
      /** Границы/параметры текущего запроса — читает UI-окно выбора. */
      durationRequestInfo() {
        const req = this.durationRequest;
        if (!req) return null;
        if (req.kind === "camp") {
          const cfg = this.campaign.meta.camping;
          if (!cfg) return null;
          const min2 = Math.max(1, Math.floor(cfg.min_ticks ?? cfg.ticks ?? 8));
          return {
            label: "\u041D\u043E\u0447\u043B\u0435\u0433",
            min: min2,
            max: Math.max(min2, Math.floor(cfg.max_ticks ?? cfg.ticks ?? 8)),
            step: 1,
            perTick: cfg.per_tick,
            interruptChance: 0,
            startTick: this.state.tick
          };
        }
        const def = req.action;
        const min = Math.max(1, Math.floor(def.min_ticks ?? 1));
        return {
          label: def.label,
          min,
          max: Math.max(min, Math.floor(def.max_ticks ?? min)),
          step: Math.max(1, Math.floor(def.step ?? 1)),
          perTick: def.per_tick,
          interruptChance: Math.max(0, Math.min(1, def.interrupt_chance_per_tick ?? 0)),
          startTick: this.state.tick
        };
      }
      cancelDurationRequest() {
        if (!this.durationRequest) return;
        this.durationRequest = null;
        this.notify();
      }
      /** Игрок подтвердил длину в окне выбора. */
      confirmDurationRequest(ticks) {
        const req = this.durationRequest;
        if (!req) return;
        this.durationRequest = null;
        if (req.kind === "camp") {
          this.campRest(ticks);
          return;
        }
        this.runDurationAction(req.action, ticks);
      }
      /** Игрок нажал «Разбить лагерь»: всегда через окно выбора (при фиксированной длине — как окно подтверждения с прогнозом). */
      requestCampRest() {
        const cfg = this.campaign.meta.camping;
        if (!cfg || !this.campAvailable().ok) return;
        this.durationRequest = { kind: "camp" };
        this.notify();
      }
      /**
       * Запуск длительного действия из реестра (эффект start_duration_action).
       * ticks задан — запуск немедленно; не задан — окно выбора (или мгновенный
       * запуск при фиксированной длине min == max). Недоступное (available_when
       * ложно) действие молча отказывает: контент должен был скрыть вариант.
       */
      requestDurationAction(id, ticks) {
        const def = (this.campaign.meta.duration_actions ?? []).find((d2) => d2.id === id);
        if (!def) {
          this.pushLog(`\u0414\u0432\u0438\u0433\u0430\u0442\u0435\u043B\u044C: \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 '${id}' \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E \u0432 \u0440\u0435\u0435\u0441\u0442\u0440\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438.`);
          this.notify();
          return;
        }
        if (def.available_when && !def.available_when.every((c2) => evalCondition(c2, this))) return;
        const min = Math.max(1, Math.floor(def.min_ticks ?? 1));
        const max = Math.max(min, Math.floor(def.max_ticks ?? min));
        if (ticks != null && ticks > 0) {
          this.runDurationAction(def, ticks);
          return;
        }
        if (max === min) {
          this.runDurationAction(def, min);
          return;
        }
        this.durationRequest = { kind: "action", action: def };
        this.notify();
      }
      /** Выполнить длительное действие (с клампом длины в min..max и выравниванием по step). */
      runDurationAction(def, ticks) {
        const min = Math.max(1, Math.floor(def.min_ticks ?? 1));
        const max = Math.max(min, Math.floor(def.max_ticks ?? min));
        const step = Math.max(1, Math.floor(def.step ?? 1));
        let chosen = Math.min(max, Math.max(min, Number.isFinite(ticks) ? Math.floor(ticks) : min));
        chosen = Math.min(max, min + step * Math.round((chosen - min) / step));
        if (def.available_when && !def.available_when.every((c2) => evalCondition(c2, this))) return;
        this.pushLog(`${def.label}: \u043D\u0430\u0447\u0430\u043B\u043E \u2014 ${chosen} \u0447.`);
        this.runTicksFlow({
          label: def.label,
          ticks: chosen,
          perTick: def.per_tick,
          interruptChance: Math.max(0, Math.min(1, def.interrupt_chance_per_tick ?? 0)),
          interruptRule: def.interrupt_rule,
          breakWhen: def.break_when,
          onFinish: def.on_finish
        });
      }
      campRest(ticks) {
        const cfg = this.campaign.meta.camping;
        if (!cfg || !this.campAvailable().ok) return;
        const min = Math.max(1, Math.floor(cfg.min_ticks ?? cfg.ticks ?? 8));
        const max = Math.max(min, Math.floor(cfg.max_ticks ?? cfg.ticks ?? 8));
        const chosen = Math.min(max, Math.max(min, Math.floor(ticks ?? cfg.ticks ?? 8)));
        this.pushLog("\u0412\u044B \u0440\u0430\u0437\u0431\u0438\u0432\u0430\u0435\u0442\u0435 \u043B\u0430\u0433\u0435\u0440\u044C \u0438 \u0443\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u0435\u0442\u0435\u0441\u044C \u043D\u0430 \u043D\u043E\u0447\u043B\u0435\u0433\u2026");
        this.runTicksFlow({
          label: "\u041D\u043E\u0447\u043B\u0435\u0433",
          ticks: chosen,
          perTick: cfg.per_tick,
          after: () => {
            this.restAndGrow();
            this.restHeal();
            if (cfg.restore) {
              for (const [needId, v2] of Object.entries(cfg.restore)) {
                if (v2 !== 0) this.changeNeed(needId, v2);
              }
            }
            const chance = Math.max(0, Math.min(1, cfg.ambush_chance ?? 0));
            if (chance > 0 && this.rng.chance(chance)) {
              this.pushLog("\u041D\u043E\u0447\u044C\u044E \u2014 \u0442\u0440\u0435\u0432\u043E\u0433\u0430! \u0412 \u043B\u0430\u0433\u0435\u0440\u044C \u043A\u0442\u043E-\u0442\u043E \u043F\u0440\u043E\u043A\u0440\u0430\u043B\u0441\u044F!");
              if (cfg.ambush_rule) this.fireRule(cfg.ambush_rule);
            } else {
              this.pushLog("\u041D\u043E\u0447\u044C \u043F\u0440\u043E\u0448\u043B\u0430 \u0441\u043F\u043E\u043A\u043E\u0439\u043D\u043E.");
            }
          }
        });
      }
      /**
       * Предложение переброска за удачу (аудит §5.6 п.8). Не сохраняется в сейв:
       * если игрок закрыл игру с открытым предложением — применится ветка провала.
       */
      luckOffer = null;
      /** игрок ответил на предложение удачи (UI) */
      resolveLuckOffer(reroll) {
        const offer = this.luckOffer;
        this.luckOffer = null;
        offer?.decide(reroll);
        this.notify();
      }
      /** Бросок проверки характеристики героя (POW×5 — удача, INT×5 — идея). */
      statCheck(stat, multiplier = 5, modifier = 0) {
        return this.playerCheckOutcome(
          (this.state.player.stats[stat] ?? 0) * multiplier,
          modifier,
          `\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 ${stat}\xD7${multiplier}`
        );
      }
      /**
       * Синхронно бросить проверку и применить успех/провал-эффекты.
       * Если включена удача и броска не вышло — игроку предлагают переброс,
       * но эффекты ждут ответа (ложь возвращает «эффекты уже применились»).
       */
      applyByCheck(outcome, describe, retry, onOk, onFail) {
        if (outcome.success) {
          onOk();
          return false;
        }
        const cfg = this.campaign.meta.luck;
        const cost = Math.max(1, cfg?.reroll_cost ?? 1);
        if (!cfg || this.luckMax() <= 0 || this.luck() < cost) {
          onFail();
          return false;
        }
        this.changeLuck(-cost);
        this.pushLog(`\u041F\u0440\u043E\u0432\u0430\u043B \u043C\u043E\u0436\u043D\u043E \u0438\u0441\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0437\u0430 \u0443\u0434\u0430\u0447\u0443: \u2212${cost} (\u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C ${this.luck()}).`);
        this.luckOffer = {
          text: `${describe} \u2014 \u043F\u0440\u043E\u0432\u0430\u043B (d100=${outcome.roll} \u043F\u0440\u043E\u0442\u0438\u0432 ${outcome.target}).`,
          cost,
          decide: (reroll) => {
            if (reroll) {
              const second = retry();
              this.pushLog(`\u041F\u0435\u0440\u0435\u0431\u0440\u043E\u0441 \u0437\u0430 \u0443\u0434\u0430\u0447\u0443: d100=${second.roll} \u043F\u0440\u043E\u0442\u0438\u0432 ${second.target} \u2192 ${CHECK_RESULT_LABEL[second.result]}.`);
              if (second.success) onOk();
              else onFail();
            } else {
              this.pushLog("\u0423\u0434\u0430\u0447\u0430 \u043F\u0440\u0438\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u0430 \u2014 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u043F\u0440\u043E\u0432\u0430\u043B.");
              onFail();
            }
            this.checkRules();
            this.autosave();
          }
        };
        return true;
      }
      /** единый путь мировых бросков героя: бросок + журнал (+ метки навыка в playerSkillCheck) */
      playerCheckOutcome(target, modifier, describe) {
        const out = skillCheck(Math.max(1, target), this.rng, modifier, this.diceRules);
        this.pushLog(`${describe} \u2014 d100=${out.roll} \u043F\u0440\u043E\u0442\u0438\u0432 ${out.target}: ${CHECK_RESULT_LABEL[out.result]}`);
        return out;
      }
      /**
       * Аугмент страсти и подмога союзника (аудит B6, книжные аугменты):
       * порог значения — meta.augments.threshold (умолчание 50),
       * прибавка к броску — meta.augments.bonus (умолчание +20, книжно).
       */
      augmentBonus(e2, fallbackSkill) {
        let mod = 0;
        const cfg = this.campaign.meta.augments;
        const threshold = Math.max(1, cfg?.threshold ?? 50);
        const bonus = Math.max(0, cfg?.bonus ?? 20);
        if (e2.augment_passion && this.passion(e2.augment_passion) >= threshold) {
          mod += bonus;
          this.pushLog(`\u0421\u0442\u0440\u0430\u0441\u0442\u044C \xAB${this.passionLabel(e2.augment_passion)}\xBB \u043F\u043E\u0434\u0445\u0432\u0430\u0442\u044B\u0432\u0430\u0435\u0442 \u0432\u0430\u0441 (+${bonus}%).`);
        }
        if (e2.assist_entity) {
          const npc = this.campaign.entities[e2.assist_entity];
          const sk = e2.assist_skill ?? fallbackSkill;
          if (sk && (npc?.skills?.[sk] ?? 0) >= threshold) {
            mod += bonus;
            this.pushLog(`${npc?.label ?? e2.assist_entity} \u043F\u043E\u043C\u043E\u0433\u0430\u0435\u0442 (+${bonus}%).`);
          }
        }
        return mod;
      }
      /**
       * Противоборство навыком героя (аудит §5.6 п.6): бросок героя против
       * броска оппонента (NPC или числовой порог), ранги из diceRules-таблицы.
       */
      opposedCheck(e2) {
        const skill = e2.skill;
        const playerValue = Math.max(1, this.skillEffective(skill) + this.statusSkillMod(skill) + this.augmentBonus(e2, skill));
        const player = this.playerCheckOutcome(playerValue, 0, `\u041F\u0440\u043E\u0442\u0438\u0432\u043E\u0431\u043E\u0440\u0441\u0442\u0432\u043E \xAB${this.skillLabel(skill)}\xBB (\u0433\u0435\u0440\u043E\u0439)`);
        let rivalValue;
        let rivalLabel = "";
        if (e2.entity) {
          const npc = this.campaign.entities[e2.entity];
          const rSkill = e2.against_skill ?? skill;
          rivalValue = Math.max(1, npc?.skills?.[rSkill] ?? 25);
          rivalLabel = npc?.label ?? e2.entity;
          if (npc && e2.against_skill) rivalLabel += ` (${this.skillLabel(rSkill)})`;
        } else {
          rivalValue = Math.max(1, e2.against_value ?? 50);
          rivalLabel = `\u043F\u043E\u0440\u043E\u0433 ${rivalValue}`;
        }
        const rival = this.playerCheckOutcome(rivalValue, 0, `\u041F\u0440\u043E\u0442\u0438\u0432\u043E\u0431\u043E\u0440\u0441\u0442\u0432\u043E (${rivalLabel})`);
        const RANK2 = { fumble: 0, fail: 1, success: 2, hard: 3, critical: 4 };
        const cmp = (RANK2[player.result] ?? 1) - (RANK2[rival.result] ?? 1);
        const wins = cmp > 0 || cmp === 0 && (e2.tie ?? "player") === "player";
        if (cmp === 0) this.pushLog(`\u0420\u0430\u0432\u043D\u044B\u0439 \u0438\u0441\u0445\u043E\u0434 \u2014 \u043F\u043E\u0431\u0435\u0434\u0430 ${wins ? "\u0433\u0435\u0440\u043E\u044F" : "\u043E\u043F\u043F\u043E\u043D\u0435\u043D\u0442\u0430"} \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E.`);
        this.pushLog(wins ? "\u0413\u0435\u0440\u043E\u0439 \u043F\u043E\u0431\u0435\u0436\u0434\u0430\u0435\u0442 \u0432 \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u0431\u043E\u0440\u0441\u0442\u0432\u0435." : "\u0413\u0435\u0440\u043E\u0439 \u043F\u0440\u043E\u0438\u0433\u0440\u044B\u0432\u0430\u0435\u0442 \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u0431\u043E\u0440\u0441\u0442\u0432\u043E.");
        if (player.success) this.markSkill(skill);
        return { success: wins, player, rival };
      }
      // ─────────────── скрытность и обнаружение (аудит §5.6 п.12) ───────────────
      /** включена ли скрытность мастером (meta.stealth); боевой режим — отдельно */
      stealthEnabled() {
        return !!this.campaign.meta.stealth;
      }
      /** герой сейчас крадётся */
      isSneaking() {
        return this.state.stealth?.sneaking === true;
      }
      /** героя заметили в текущей сцене */
      isDetected() {
        return this.state.stealth?.detected === true;
      }
      /** Получает значение навыка игрока (с модификаторами статусов) */
      playerSkill(skill) {
        return Math.max(0, (this.state.player.skills[skill] ?? 0) + this.statusSkillMod(skill));
      }
      /**
       * Переключить красться/идти открыто. Вход в красться — моментальная
       * проверка против всех наблюдателей в сцене; заметили — режим включён,
       * но скрытым вас не считают.
       */
      toggleSneak() {
        if (!this.stealthEnabled()) return;
        const st2 = this.state.stealth ??= { sneaking: false, detected: false };
        const wasSneaking = st2.sneaking;
        st2.sneaking = !wasSneaking;
        st2.detected = false;
        if (st2.sneaking) {
          this.pushLog("\u0412\u044B \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0438\u0442\u0435 \u043D\u0430 \u0441\u043A\u0440\u044B\u0442\u043D\u043E\u0435 \u043F\u0435\u0440\u0435\u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435. \u0411\u0440\u043E\u0441\u043E\u043A \u0441\u043A\u0440\u044B\u0442\u043D\u043E\u0441\u0442\u0438 \u043F\u0440\u0438 \u0441\u043C\u0435\u043D\u0435 \u0441\u0446\u0435\u043D\u044B...");
          this.detectCheck("\u0432\u044B \u043F\u043E\u044F\u0432\u043B\u044F\u0435\u0442\u0435\u0441\u044C \u0432 \u043F\u043E\u043B\u0435 \u0437\u0440\u0435\u043D\u0438\u044F");
        } else {
          this.pushLog("\u0412\u044B \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435 \u0441\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0435\u0441\u044C.");
        }
        this.autosave();
        this.notify();
      }
      /**
       * Проверка обнаружения: бросок скрытности героя против лучшей
       * внимательности живых NPC в текущей сцене. Поражение — `detected`.
       * Истина — остался незамеченным.
       */
      detectCheck(context) {
        if (!this.stealthEnabled() || !this.isSneaking() || this.isDetected()) return true;
        const scene = this.currentScene();
        if (!scene) return true;
        const st2 = this.campaign.meta.stealth;
        let bestNpc = null;
        for (const occ of this.slotOccupants(scene)) {
          const def = occ.entity;
          if (!def || def.type !== "npc") continue;
          const value = def.perception ?? Math.max(1, (def.skills[st2.perception_skill ?? "perception"] ?? 0) || def.stats.INT * 2);
          if (!bestNpc || value > bestNpc.value) bestNpc = { label: def.label, value };
        }
        if (!bestNpc) return true;
        const skill = st2.skill ?? "stealth";
        const hero = Math.max(1, (this.state.player.skills[skill] ?? 0) + this.statusSkillMod(skill));
        const mine = skillCheck(hero, this.rng, 0, this.diceRules);
        const theirs = skillCheck(bestNpc.value, this.rng, 0, this.diceRules);
        const RANK2 = { fumble: 0, fail: 1, success: 2, hard: 3, critical: 4 };
        const wins = (RANK2[mine.result] ?? 1) >= (RANK2[theirs.result] ?? 1);
        this.pushLog(
          `\u0421\u043A\u0440\u044B\u0442\u043D\u043E\u0441\u0442\u044C (${context}): \u0432\u0430\u0448 ${mine.result} (d100=${mine.roll}/${hero}) \u043F\u0440\u043E\u0442\u0438\u0432 \xAB${bestNpc.label}\xBB ${theirs.result} (d100=${theirs.roll}/${bestNpc.value}) \u2192 ${wins ? "\u0432\u0430\u0441 \u043D\u0435 \u0437\u0430\u043C\u0435\u0442\u0438\u043B\u0438" : "\u0412\u0410\u0421 \u0417\u0410\u041C\u0415\u0422\u0418\u041B\u0418!"}`
        );
        if (!wins) {
          this.state.stealth.detected = true;
        }
        return wins;
      }
      /** Внезапность при начале боя из скрытности: враги застигнуты врасплох. */
      consumeSurpriseFromSneak() {
        const st2 = this.state.stealth;
        if (st2?.sneaking && !st2.detected) return true;
        return false;
      }
      // ─────────────── рост навыков (ТЗ 4.3) ───────────────
      markSkill(skill) {
        if (!featureOn(this.campaign.meta, "skills")) return;
        if (this.state.player.skills[skill] != null) this.state.player.skill_marks[skill] = true;
      }
      /** Проверка навыка игрока с «галочкой» опыта при успехе. */
      playerSkillCheck(skill, difficulty = 50) {
        if (!featureOn(this.campaign.meta, "skills")) {
          return { roll: 0, target: 100, result: "success", success: true };
        }
        const value = Math.max(0, this.skillEffective(skill) + this.statusSkillMod(skill));
        const out = skillCheck(value, this.rng, difficultyModifier(value, difficulty), this.diceRules);
        this.pushLog(
          `\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \xAB${this.skillLabel(skill)}\xBB (${difficultyLabel(difficulty)}) \u2014 d100=${out.roll} \u043F\u0440\u043E\u0442\u0438\u0432 ${out.target}: ${CHECK_RESULT_LABEL[out.result]}`
        );
        if (out.success) this.markSkill(skill);
        return out;
      }
      /** Отдых: броски роста отмеченных навыков (d100 > навык → +1d6). */
      /** русское название навыка (реестр кампании → встроенный словарь → id) */
      skillLabel(id) {
        return skillLabel(id, this.campaign.meta.skills);
      }
      restAndGrow() {
        if (!featureOn(this.campaign.meta, "skills")) return [];
        const grown = [];
        for (const skill of Object.keys(this.state.player.skill_marks)) {
          const cur = this.state.player.skills[skill] ?? 0;
          const roll = this.rng.int(1, 100);
          if (roll > cur) {
            const gain = rollDice("1d6", this.rng);
            this.state.player.skills[skill] = cur + gain;
            grown.push(`${this.skillLabel(skill)} +${gain} (${cur} \u2192 ${cur + gain})`);
            this.pushLog(`\u041D\u0430\u0432\u044B\u043A \xAB${this.skillLabel(skill)}\xBB \u0432\u044B\u0440\u043E\u0441 \u043D\u0430 ${gain} (${cur} \u2192 ${cur + gain}).`);
          }
        }
        this.state.player.skill_marks = {};
        if (grown.length) {
          this.messages.push({ text: `\u0412\u043E \u0441\u043D\u0435 \u043F\u0440\u0438\u0445\u043E\u0434\u0438\u0442 \u043E\u043F\u044B\u0442. \u0420\u043E\u0441\u0442 \u043D\u0430\u0432\u044B\u043A\u043E\u0432: ${grown.join(", ")}.` });
          playUi("skill_up");
        }
        return grown;
      }
      // ─────────────── торговля (ТЗ 4.7) ───────────────
      openTrade(entityId) {
        if (!featureOn(this.campaign.meta, "trade")) return;
        const npc = this.campaign.entities[entityId];
        if (!npc || npc.type !== "npc" || !npc.trader) return;
        this.dialogue = null;
        this.dialogueTimer = null;
        this.trade = npc;
        this.notify();
      }
      closeTrade() {
        this.trade = null;
        this.autosave();
        this.notify();
      }
      /**
       * Открыть окно изготовления по ходу игры (эффект `open_craft`, реплика
       * `~ open_craft("recipe_id")`). Неизвестный или незаданный рецепт — просто
       * открывается список: рецепт может открыться позже эффектом unlock_recipe.
       * Разговор и торговля при этом закрываются, как у `open_trade`.
       */
      openCraft(recipeId, sourceEntity) {
        if (!featureOn(this.campaign.meta, "inventory")) return;
        const known = recipeId && this.knownRecipes().some((r2) => r2.id === recipeId);
        this.dialogue = null;
        this.dialogueTimer = null;
        this.activeStory = null;
        this.activeNpc = null;
        this.trade = null;
        if (sourceEntity) this.craftSourceEntity = sourceEntity;
        this.craftRequest = { recipe: known ? recipeId : void 0 };
        this.notify();
      }
      closeCraft() {
        this.craftRequest = null;
        this.craftSourceEntity = null;
        this.autosave();
        this.notify();
      }
      // ─────────────── таймер выбора в диалоге ───────────────
      /**
       * Ink-вызов `~ set_dialogue_timer(секунды, "узел")`: сколько секунд игрок
       * может думать над ответами и куда уйти, если он промолчал. Пустой узел —
       * по истечении разговор заканчивается. `0` снимает таймер.
       * Действует, только если на узле есть варианты ответа.
       */
      setDialogueTimer(seconds, knot) {
        const s2 = Math.floor(Number(seconds) || 0);
        this.pendingDialogueTimer = s2 > 0 ? { seconds: s2, knot: knot ? String(knot) : void 0 } : null;
      }
      /**
       * Зафиксировать таймер, объявленный ink-ом в этом проходе: он живёт, пока
       * игроку показаны варианты ответа. Без вариантов таймер снимается, а
       * забытый ink-ом таймер не «переезжает» на следующую реплику.
       */
      commitDialogueTimer(_choices) {
        const next = this.pendingDialogueTimer;
        this.pendingDialogueTimer = null;
        this.dialogueTimer = next ? next : null;
      }
      /** Истёк таймер: уходим в назначенный узел или заканчиваем разговор. */
      dialogueTimeout() {
        const t5 = this.dialogueTimer;
        const story = this.activeStory;
        this.dialogueTimer = null;
        if (!t5 || !story || !this.dialogue) return;
        if (!t5.knot) {
          this.pushLog("\u0420\u0430\u0437\u0433\u043E\u0432\u043E\u0440 \u043E\u0431\u043E\u0440\u0432\u0430\u043B\u0441\u044F: \u0432\u044B \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0434\u043E\u043B\u0433\u043E \u043C\u043E\u043B\u0447\u0430\u043B\u0438.");
          this.endDialogue();
          return;
        }
        try {
          story.ChoosePathString(t5.knot);
        } catch {
          this.pushLog(`\u0423\u0437\u0435\u043B \xAB${t5.knot}\xBB \u0434\u043B\u044F \u0442\u0430\u0439\u043C\u0435\u0440\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u2014 \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440 \u0437\u0430\u043A\u0430\u043D\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F.`);
          this.endDialogue();
          return;
        }
        this.pushLog("\u0412\u044B \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0434\u043E\u043B\u0433\u043E \u043C\u043E\u043B\u0447\u0430\u043B\u0438 \u2014 \u0441\u043E\u0431\u0435\u0441\u0435\u0434\u043D\u0438\u043A \u043F\u0435\u0440\u0435\u0432\u0451\u043B \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440 \u043D\u0430 \u0441\u0432\u043E\u0451.");
        const drained = drainStory(story);
        for (const l2 of drained.lines) {
          this.dialogueHistory.push({
            speaker: l2.action ? "" : this.dlgSpeakerLabel(l2, this.dialogue.npc),
            text: l2.text,
            emotion: l2.emotion,
            action: l2.action
          });
        }
        if (this.combat || this.trade || this.craftRequest || this.state.game_over || !this.activeStory) {
          this.dialogue = null;
          this.dialogueHistory = [];
          this.activeStory = null;
          this.activeNpc = null;
          this.notify();
          return;
        }
        this.dialogue = {
          npc: this.dialogue.npc,
          lines: drained.lines,
          choices: drained.choices,
          finished: drained.finished,
          history: [...this.dialogueHistory]
        };
        this.commitDialogueTimer(drained.choices.length);
        this.commitDialoguePresenting();
        this.dialogue.timer = this.dialogueTimer ?? void 0;
        this.notify();
      }
      // ─────────────── предъявление предмета в диалоге ───────────────
      /**
       * Ink-вызов `~ present_item("ok_knot", "fail_knot", "required_item")`:
       * предлагает игроку выбрать предмет из инвентаря для предъявления собеседнику.
       */
      promptPresentItem(okKnot, failKnot, required) {
        this.pendingDialoguePresenting = { ok: okKnot, fail: failKnot, required: required || void 0 };
      }
      commitDialoguePresenting() {
        const next = this.pendingDialoguePresenting;
        this.pendingDialoguePresenting = null;
        if (this.dialogue) {
          this.dialogue.presenting = next ? next : void 0;
        }
      }
      /**
       * Игрок выбрал предмет для предъявления (или отменил выбор: itemId === null).
       */
      submitPresentedItem(itemId) {
        const pres = this.dialogue?.presenting;
        const story = this.activeStory;
        if (!pres || !story || !this.dialogue) return;
        this.dialogue.presenting = void 0;
        if (itemId) {
          playUi("dialogue_present");
          const itDef = this.campaign.entities[itemId];
          this.dialogueHistory.push({
            speaker: this.state.player.name || "\u0412\u044B",
            text: `[\u041F\u0440\u0435\u0434\u044A\u044F\u0432\u043B\u0435\u043D\u043E: ${itDef?.label || itemId}]`,
            isChoice: true
          });
        } else {
          playUi("click");
          this.dialogueHistory.push({
            speaker: this.state.player.name || "\u0412\u044B",
            text: "[\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043F\u0440\u0435\u0434\u044A\u044F\u0432\u043B\u0435\u043D\u043E]",
            isChoice: true
          });
        }
        const success = itemId ? !pres.required || pres.required === itemId : false;
        const targetKnot = success ? pres.ok : pres.fail;
        try {
          story.ChoosePathString(targetKnot);
        } catch {
          this.pushLog(`\u0423\u0437\u0435\u043B \xAB${targetKnot}\xBB \u0434\u043B\u044F \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430 \u043F\u0440\u0435\u0434\u044A\u044F\u0432\u043B\u0435\u043D\u0438\u044F \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D.`);
          this.endDialogue();
          return;
        }
        const drained = drainStory(story);
        for (const l2 of drained.lines) {
          this.dialogueHistory.push({
            speaker: l2.action ? "" : this.dlgSpeakerLabel(l2, this.dialogue.npc),
            text: l2.text,
            emotion: l2.emotion,
            action: l2.action
          });
        }
        if (this.combat || this.trade || this.craftRequest || this.state.game_over || !this.activeStory) {
          this.dialogue = null;
          this.dialogueHistory = [];
          this.activeStory = null;
          this.activeNpc = null;
          this.notify();
          return;
        }
        this.dialogue = {
          npc: this.dialogue.npc,
          lines: drained.lines,
          choices: drained.choices,
          finished: drained.finished,
          history: [...this.dialogueHistory]
        };
        this.commitDialogueTimer(drained.choices.length);
        this.commitDialoguePresenting();
        this.dialogue.timer = this.dialogueTimer ?? void 0;
        this.notify();
      }
      /** Модификатор цены: репутация и навык торговли (ТЗ 4.7). */
      priceModifier(npc) {
        const disp = this.getDisposition(npc.id);
        const bargain = this.state.player.skills["bargain"] ?? 0;
        const mod = 1.25 - disp * 3e-3 - bargain * 4e-3;
        return Math.min(1.6, Math.max(0.7, mod));
      }
      /** id основной валюты кампании (первая в реестре) */
      get mainCurrency() {
        return this.campaign.meta.currencies[0]?.id ?? "silver";
      }
      /** id предмета-монеты, который является единственным источником баланса */
      currencyItemId(currencyId = this.mainCurrency) {
        const currency = this.campaign.meta.currencies.find((c2) => c2.id === currencyId);
        return currency?.item_id || `item_${currencyId}`;
      }
      /** Баланс валюты читается из инвентаря, а не из устаревшего поля сохранения. */
      currencyAmount(currencyId = this.mainCurrency) {
        return this.itemCount(this.currencyItemId(currencyId));
      }
      buyPrice(npc, itemId, basePrice) {
        const item = this.campaign.entities[itemId];
        const base = basePrice ?? item?.value?.[this.mainCurrency] ?? 1;
        const dynamic = item ? this.priceEventMultiplier(item) : 1;
        const diff = this.difficultyDef()?.prices ?? 1;
        return Math.max(1, Math.round(base * this.priceModifier(npc) * dynamic * diff));
      }
      sellPrice(npc, itemId) {
        const item = this.campaign.entities[itemId];
        if (item?.quest_item) return 0;
        const base = item?.value?.[this.mainCurrency] ?? 0;
        const rate = npc.trader?.buy_rate ?? 0.4;
        const dynamic = item ? this.priceEventMultiplier(item) : 1;
        return Math.max(0, Math.floor(base * rate * dynamic / this.priceModifier(npc)));
      }
      /** полный список продаваемых торговцем товаров, включая выкупленные у игрока */
      traderSells(npc) {
        if (!npc.trader) return [];
        const base = [...npc.trader.sells];
        const bought = this.state.trader_bought_items?.[npc.id] ?? [];
        for (const b2 of bought) {
          if (!base.some((s2) => s2.item === b2.item)) {
            base.push(b2);
          }
        }
        return base;
      }
      /** текущий остаток товара на складе торговца (undefined — бесконечный запас) */
      traderItemStock(npcId, itemId) {
        const npc = this.campaign.entities[npcId];
        if (!npc?.trader) return void 0;
        const traderSaved = this.state.trader_stocks?.[npcId];
        if (traderSaved && itemId in traderSaved) {
          return traderSaved[itemId];
        }
        const sellDef = npc.trader.sells.find((s2) => s2.item === itemId);
        if (sellDef && sellDef.stock !== void 0) return sellDef.stock;
        const boughtDef = (this.state.trader_bought_items?.[npcId] ?? []).find((s2) => s2.item === itemId);
        if (boughtDef && boughtDef.stock !== void 0) return boughtDef.stock;
        return void 0;
      }
      buyItem(itemId, price) {
        const currencyItem = this.currencyItemId();
        if (this.itemCount(currencyItem) < price) return false;
        if (this.trade) {
          const stock = this.traderItemStock(this.trade.id, itemId);
          if (stock !== void 0 && stock <= 0) return false;
        }
        this.removeItem(currencyItem, price, { silent: true });
        this.addItem(itemId, 1, { silent: true });
        if (this.trade) {
          const stock = this.traderItemStock(this.trade.id, itemId);
          if (stock !== void 0) {
            if (!this.state.trader_stocks) this.state.trader_stocks = {};
            if (!this.state.trader_stocks[this.trade.id]) this.state.trader_stocks[this.trade.id] = {};
            this.state.trader_stocks[this.trade.id][itemId] = Math.max(0, stock - 1);
          }
        }
        this.markSkill("bargain");
        playUi("coin");
        this.notify();
        return true;
      }
      sellItem(itemId, price) {
        const item = this.campaign.entities[itemId];
        if (item?.quest_item) return false;
        if (this.itemCount(itemId) < 1) return false;
        this.removeItem(itemId, 1, { silent: true });
        this.addItem(this.currencyItemId(), price, { silent: true });
        if (this.trade) {
          const traderId = this.trade.id;
          const npc = this.campaign.entities[traderId];
          if (npc?.trader) {
            const inBase = npc.trader.sells.some((s2) => s2.item === itemId);
            if (inBase) {
              const curStock = this.traderItemStock(traderId, itemId);
              if (curStock !== void 0) {
                if (!this.state.trader_stocks) this.state.trader_stocks = {};
                if (!this.state.trader_stocks[traderId]) this.state.trader_stocks[traderId] = {};
                this.state.trader_stocks[traderId][itemId] = curStock + 1;
              }
            } else {
              if (!this.state.trader_bought_items) this.state.trader_bought_items = {};
              if (!this.state.trader_bought_items[traderId]) this.state.trader_bought_items[traderId] = [];
              const existing = this.state.trader_bought_items[traderId].find((s2) => s2.item === itemId);
              const curStock = this.traderItemStock(traderId, itemId) ?? 0;
              const nextStock = curStock + 1;
              if (!existing) {
                this.state.trader_bought_items[traderId].push({ item: itemId, stock: nextStock });
              } else {
                existing.stock = nextStock;
              }
              if (!this.state.trader_stocks) this.state.trader_stocks = {};
              if (!this.state.trader_stocks[traderId]) this.state.trader_stocks[traderId] = {};
              this.state.trader_stocks[traderId][itemId] = nextStock;
            }
          }
        }
        this.markSkill("bargain");
        playUi("coin");
        this.notify();
        return true;
      }
      // ─────────────── крафт (блок 4 ТЗ «Гибкий движок») ───────────────
      /** название предмета по id (фолбэк — сам id) */
      itemTitle(id) {
        return this.campaign.entities[id]?.label ?? id;
      }
      /** все рецепты кампании, по алфавиту (русский) */
      allRecipes() {
        return Object.values(this.campaign.recipes).sort((a2, b2) => a2.label.localeCompare(b2.label, "ru"));
      }
      /** доступен ли конкретный верстак / рабочее место в текущем контексте */
      isWorkbenchAvailable(workbenchReq) {
        if (!workbenchReq) return true;
        if (typeof workbenchReq === "string") {
          if (this.craftSourceEntity) {
            if (this.craftSourceEntity.id === workbenchReq || this.craftSourceEntity.category === workbenchReq) {
              return true;
            }
          }
          const sc2 = this.campaign.scenes[this.state.scene];
          if (sc2) {
            const occupants = this.slotOccupants(sc2);
            for (const occ of occupants) {
              if (!occ.entity) continue;
              const it2 = occ.entity;
              if (it2.id === workbenchReq || it2.category === workbenchReq) return true;
              if (occ.slot.type.includes(workbenchReq)) return true;
            }
          }
          const loc2 = this.findLocation(this.state.location)?.location;
          if (loc2 && loc2[workbenchReq]) return true;
          return false;
        }
        if (this.craftRequest || this.craftSourceEntity) return true;
        const sc = this.campaign.scenes[this.state.scene];
        if (sc) {
          if (sc.workbench) return true;
          const occupants = this.slotOccupants(sc);
          for (const occ of occupants) {
            if (!occ.entity) continue;
            const it2 = occ.entity;
            if (it2.id === "item_bench" || it2.category === "workbench") return true;
            if (occ.slot.type.includes("workbench")) return true;
            if (it2.interact_options?.some((o2) => o2.effects?.some((ef) => ef.type === "open_craft"))) return true;
          }
        }
        const loc = this.findLocation(this.state.location)?.location;
        if (loc && loc.workbench) return true;
        return false;
      }
      /** Название рабочего места для подсказки в интерфейсе */
      workbenchLabel(req) {
        if (!req) return "";
        if (req === true) return "\u0412\u0435\u0440\u0441\u0442\u0430\u043A \u0438\u043B\u0438 \u043C\u0430\u0441\u0442\u0435\u0440\u0441\u043A\u0430\u044F";
        if (typeof req === "string") {
          const ent = this.campaign.entities[req];
          if (ent) return ent.label;
          const cat = this.campaign.meta.item_categories?.find((c2) => c2.id === req);
          if (cat) return cat.label;
          return req;
        }
        return "";
      }
      /** чего не хватает для рецепта: компоненты, инструменты, условия, верстак */
      recipeMissing(r2) {
        const missing = [];
        if (r2.workbench && !this.isWorkbenchAvailable(r2.workbench)) {
          missing.push(`\u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F: ${this.workbenchLabel(r2.workbench)}`);
        }
        for (const need of r2.inputs ?? []) {
          const have = this.itemCount(need.item);
          if (have < need.quantity) missing.push(`${this.itemTitle(need.item)} \xD7${need.quantity} (\u0435\u0441\u0442\u044C ${have})`);
        }
        for (const tool of r2.tools ?? []) {
          if (!this.hasItem(tool)) missing.push(`\u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442: ${this.itemTitle(tool)}`);
        }
        let blocked = false;
        for (const c2 of r2.requires ?? []) {
          if (!evalCondition(c2, this)) blocked = true;
        }
        if (blocked) missing.push("\u043D\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u044B \u0443\u0441\u043B\u043E\u0432\u0438\u044F");
        return missing;
      }
      /**
       * Изготовление по рецепту. Если у рецепта есть проверка навыка — бросок
       * идёт первым: провал сохраняет компоненты. Успех расходует компоненты,
       * выдаёт результат и проматывает время.
       */
      craft(recipeId) {
        const r2 = this.campaign.recipes[recipeId];
        if (!r2 || this.recipeMissing(r2).length > 0) return false;
        if (r2.repair && !this.hasDamaged(r2.output.item)) {
          this.messages.push({ text: `\u041D\u0435 \u0438\u0437\u043D\u0430\u0448\u0438\u0432\u0448\u0438\u0439\u0441\u044F \xAB${this.itemTitle(r2.output.item)}\xBB \u2014 \u0447\u0438\u043D\u0438\u0442\u044C \u043D\u0435\u0447\u0435\u0433\u043E.` });
          return false;
        }
        if (r2.skill) {
          const out = this.playerSkillCheck(r2.skill.id, r2.skill.difficulty);
          if (!out.success) {
            const spent = Math.max(0, Math.floor(r2.fail_time_ticks ?? 0));
            if (spent > 0 && !this.state.game_over) this.advanceTicks(spent);
            this.messages.push({ text: `\u041D\u0435 \u043F\u043E\u043B\u0443\u0447\u0438\u043B\u043E\u0441\u044C \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C \xAB${r2.label}\xBB. \u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B \u043E\u0441\u0442\u0430\u043B\u0438\u0441\u044C \u0446\u0435\u043B\u044B.${spent > 0 ? ` \u041F\u043E\u0442\u0440\u0430\u0447\u0435\u043D\u043E ${spent} \u0442\u0438\u043A(\u043E\u0432) \u0432\u0440\u0435\u043C\u0435\u043D\u0438.` : ""}` });
            this.autosave();
            this.notify();
            return false;
          }
        }
        for (const need of r2.inputs ?? []) this.removeItem(need.item, need.quantity, { silent: true });
        if (r2.repair) {
          this.repairItem(r2.output.item);
        } else {
          this.addItem(r2.output.item, r2.output.quantity ?? 1);
        }
        if (r2.time_ticks) this.advanceTicks(r2.time_ticks);
        const outLabel = this.itemTitle(r2.output.item);
        this.pushLog(`\u0418\u0437\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u043E: ${outLabel} (\u0440\u0435\u0446\u0435\u043F\u0442 \xAB${r2.label}\xBB).`);
        this.messages.push({ text: r2.message ?? `\u0418\u0437\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u043E: ${outLabel}.` });
        if (r2.sound) playInteraction(r2.sound, { sound: r2.sound }, r2.sound_volume ?? 1);
        else playUi("craft");
        this.autosave();
        this.notify();
        return true;
      }
      // ─────────────── случайные встречи (ТЗ 4.9) ───────────────
      rollEncounter(conn) {
        if (!conn.random_encounter_table) return;
        const table = this.campaign.encounters[conn.random_encounter_table];
        if (!table) return;
        for (let roll = 0; roll < (table.rolls ?? 1); roll++) {
          const total = table.entries.reduce((s2, e2) => s2 + e2.weight, 0);
          let pick = this.rng.next() * total;
          let entry = null;
          for (const e2 of table.entries) {
            pick -= e2.weight;
            if (pick <= 0) {
              entry = e2;
              break;
            }
          }
          if (!entry) continue;
          this.resolveEncounter(entry);
          if (this.combat || this.state.game_over) return;
        }
      }
      resolveEncounter(entry) {
        switch (entry.type) {
          case "nothing":
            return;
          case "combat": {
            if (!featureOn(this.campaign.meta, "combat")) return;
            const enemies = entry.enemies.map((e2) => ({
              entity: e2.entity,
              count: this.rng.int(e2.count_min, e2.count_max)
            }));
            this.startCombat({
              type: "start_combat",
              enemies,
              arena: entry.arena,
              intro: entry.intro ?? "\u0412 \u0434\u043E\u0440\u043E\u0433\u0435 \u043D\u0430 \u0432\u0430\u0441 \u043D\u0430\u043F\u0430\u0434\u0430\u044E\u0442!"
            });
            return;
          }
          case "dialogue":
            this.startDialogue(entry.entity, entry.knot);
            return;
          case "skill_check": {
            const out = this.playerSkillCheck(entry.skill, entry.difficulty);
            if (entry.message) this.messages.push({ text: entry.message });
            this.applyEffects(out.success ? entry.success_effects : entry.fail_effects);
            return;
          }
          case "event":
            this.applyEffects(entry.effects);
            if (entry.message) this.messages.push({ text: entry.message });
            return;
        }
      }
      // ─────────────── мир: регионы, локации, сцены ───────────────
      allRegions() {
        const out = [];
        const walk2 = (rs) => {
          for (const r2 of rs) {
            out.push(r2);
            if (r2.sub_regions) walk2(r2.sub_regions);
          }
        };
        walk2(this.campaign.world.regions);
        return out;
      }
      findRegion(id) {
        return this.allRegions().find((r2) => r2.id === id);
      }
      findLocation(id) {
        for (const region of this.allRegions()) {
          const location = region.locations.find((l2) => l2.id === id);
          if (location) return { region, location };
        }
        return void 0;
      }
      currentScene() {
        return this.campaign.scenes[this.state.scene];
      }
      /**
       * Сцена, в которую игрок попадает при входе в локацию (итерация 8, А5):
       * arrival_scene локации, если она есть среди её сцен, иначе первая.
       */
      arrivalSceneOf(location) {
        const arrival = location.arrival_scene;
        if (arrival && location.scenes.includes(arrival)) return arrival;
        return location.scenes[0];
      }
      /** Правила бросков d100 этой кампании (итерация 8, А7). */
      get diceRules() {
        return this.campaign.meta.dice_rules ?? DEFAULT_DICE_RULES;
      }
      /** Активное состояние сцены: первое, чьё условие истинно; иначе первое. */
      activeSceneState(scene) {
        for (const st2 of scene.states) {
          if (this.state.flags[`scene_state:${scene.id}:${st2.id}`]) return st2;
        }
        for (const st2 of scene.states) {
          if (st2.condition && evalSceneCondition(st2.condition, this)) return st2;
        }
        const base = scene.states.find((st2) => !st2.condition);
        return base ?? scene.states[0];
      }
      changeSceneState(sceneIdOrState, maybeState) {
        const sceneId = maybeState ? sceneIdOrState : this.state.scene;
        const stateId = maybeState ?? sceneIdOrState;
        const sc = this.campaign.scenes[sceneId];
        if (sc) {
          for (const st2 of sc.states) {
            delete this.state.flags[`scene_state:${sceneId}:${st2.id}`];
          }
          this.state.flags[`scene_state:${sceneId}:${stateId}`] = true;
          this.notify();
        }
      }
      goToSceneFromDialogue(sceneId, closeDialogue = true) {
        if (closeDialogue) {
          this.endDialogue();
        }
        this.goToScene(sceneId, 0);
      }
      startCombatFromDialogue(arenaId) {
        const enemyId = this.activeNpc?.id || Object.keys(this.campaign.entities).find((k2) => this.campaign.entities[k2]?.type === "npc") || "";
        this.endDialogue();
        this.startCombat({
          type: "start_combat",
          arena: arenaId,
          enemies: [{ entity: enemyId, count: 1 }],
          intro: `\u0411\u043E\u0439 \u0441 ${this.activeNpc?.label ?? "\u043F\u0440\u043E\u0442\u0438\u0432\u043D\u0438\u043A\u043E\u043C"}!`
        });
      }
      /** Активное «особое место» НПС: первый оверрайд, чей флаг-условие выполнено. */
      activePresenceOverride(def) {
        if (def.type !== "npc" || !def.presence_overrides) return void 0;
        return def.presence_overrides.find(
          (o2) => (!o2.flag || !!this.state.flags[o2.flag]) && (!o2.not_flag || !this.state.flags[o2.not_flag])
        );
      }
      /**
       * Есть ли у NPC реальное расписание (непустой массив). Пустой `schedule: []`
       * — частый артефакт редактора/ИИ: это «расписания нет», а не «занят всегда
       * где-то ещё». Иначе default_entity в слоте никогда не появляется.
       */
      npcHasSchedule(def) {
        return def.type === "npc" && Array.isArray(def.schedule) && def.schedule.length > 0;
      }
      npcHasPresenceOverrides(def) {
        return def.type === "npc" && Array.isArray(def.presence_overrides) && def.presence_overrides.length > 0;
      }
      /** Занятость слотов с учётом расписаний NPC (ТЗ 4.1: обновление расписания). */
      slotOccupants(scene) {
        const hour = hourOfDay(this.state.tick, this.campaign.meta);
        const out = [];
        for (const slot of scene.slots) {
          if (!evalSceneCondition(slot.condition, this)) continue;
          let entity = null;
          const spawned = this.state.spawned.find((s2) => s2.scene === scene.id && s2.slot === slot.id);
          if (spawned) entity = this.campaign.entities[spawned.entity] ?? null;
          if (!entity) {
            for (const def of Object.values(this.campaign.entities)) {
              if (def.type !== "npc" || !this.npcHasSchedule(def) && !this.npcHasPresenceOverrides(def)) continue;
              if (this.state.dead_entities.includes(def.id)) continue;
              if (this.state.removed_entities.includes(def.id)) continue;
              if (this.isInParty(def.id)) continue;
              const ov = this.activePresenceOverride(def);
              if (ov) {
                if (ov.scene === scene.id && ov.slot === slot.id) {
                  entity = def;
                  break;
                }
                continue;
              }
              const entry = def.schedule?.find(
                (e2) => e2.scene === scene.id && e2.slot === slot.id && inTimeRange(hour, e2.time_range)
              );
              if (entry) {
                entity = def;
                break;
              }
            }
          }
          if (!entity && slot.default_entity) {
            const def = this.campaign.entities[slot.default_entity];
            const busyElsewhere = def?.type === "npc" && (this.npcHasSchedule(def) || !!this.activePresenceOverride(def));
            const gone = this.state.dead_entities.includes(slot.default_entity) || this.state.removed_entities.includes(slot.default_entity) || this.isInParty(slot.default_entity);
            if (def && !busyElsewhere && !gone) entity = def;
          }
          out.push({ slot, entity });
        }
        return out;
      }
      /** Переход между сценами внутри локации (или в сцену другой локации). */
      goToScene(sceneId, costTicks = 0) {
        const scene = this.campaign.scenes[sceneId];
        if (!scene) return;
        stopVoiceAudio();
        if (costTicks > 0) this.advanceTicks(costTicks);
        if (this.state.game_over) return this.notify();
        playInteraction("travel");
        const prevLocation = this.state.location;
        this.state.scene = sceneId;
        this.state.location = scene.location;
        if (this.state.stealth) this.state.stealth.detected = false;
        if (this.isSneaking()) this.detectCheck("\u0441\u043C\u0435\u043D\u0430 \u0441\u0446\u0435\u043D\u044B");
        if (scene.location !== prevLocation) {
          this.onEnterLocation(scene.location);
        } else {
          this.checkRules();
          this.autosave();
        }
        this.fireTrigger("enter_scene", { sceneId });
        this.notify();
      }
      /**
       * Проверка и выполнение перехода по зоне навигации (с поддержкой условий блокировки,
       * сообщений, окликов персонажей и правил-перехватчиков).
       */
      navigate(nav) {
        if (nav.open_map) return false;
        if (nav.conditions && nav.conditions.length > 0) {
          const ok = nav.conditions.every((c2) => evalCondition(c2, this));
          if (!ok) {
            if (nav.blocked_message) {
              this.pushLog(nav.blocked_message);
              this.messages.push({ text: nav.blocked_message });
              this.notify();
            }
            return false;
          }
        }
        if (nav.intercept_dialogue) {
          this.startDialogue(nav.intercept_dialogue);
          return false;
        }
        if (nav.intercept_rule) {
          const fired = this.tryFireRule(nav.intercept_rule);
          if (fired) return false;
        }
        const blocked = this.fireTrigger("leave_scene", { sceneId: this.state.scene });
        if (blocked) return false;
        if (nav.go_to_scene) {
          this.goToScene(nav.go_to_scene, nav.cost_ticks ?? 0);
          return true;
        }
        return false;
      }
      /** Путешествие между локациями по travel_connections (ТЗ 4.9). */
      travelTo(locationId) {
        if (this.isTravelBlockedByOverload()) {
          const load = this.currentLoad();
          const max = this.maxLoad();
          this.messages.push({
            text: `\u0413\u0440\u0443\u0437 \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0432\u0435\u043B\u0438\u043A (${load.toFixed(1)} \u043A\u0433 \u043F\u0440\u0438 \u043B\u0438\u043C\u0438\u0442\u0435 ${max.toFixed(1)} \u043A\u0433). \u0412\u044B \u043D\u0435 \u043C\u043E\u0436\u0435\u0442\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C\u0441\u044F \u0432 \u043F\u0443\u0442\u044C \u0441 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u043C \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0437\u043E\u043C \u2014 \u0441\u0431\u0440\u043E\u0441\u044C\u0442\u0435 \u043B\u0438\u0448\u043D\u0438\u0435 \u0432\u0435\u0449\u0438.`
          });
          this.notify();
          return;
        }
        const from = this.findLocation(this.state.location);
        const conn = from?.location.travel_connections.find((c2) => c2.to === locationId);
        const cost = this.travelCost(locationId) ?? conn?.cost_ticks ?? 1;
        if (this.state.blocked_paths.includes(`${this.state.location}->${locationId}`)) {
          this.messages.push({ text: "\u041F\u0443\u0442\u044C \u0437\u0430\u043A\u0440\u044B\u0442." });
          this.notify();
          return;
        }
        if (conn?.requirements && !conn.requirements.every((c2) => evalCondition(c2, this))) {
          this.messages.push({ text: "\u041F\u0443\u0442\u044C \u0437\u0430\u043A\u0440\u044B\u0442." });
          this.notify();
          return;
        }
        if (conn?.depart_sound) playInteraction(conn.depart_sound, { sound: conn.depart_sound }, conn.depart_sound_volume ?? 1);
        else if (conn?.sound) playInteraction(conn.sound, { sound: conn.sound }, conn.sound_volume ?? 1);
        else playUi("travel_depart");
        this.advanceTicks(cost);
        this.state.stats_run.travels += 1;
        if (this.state.game_over) return this.notify();
        const target = this.findLocation(locationId);
        if (!target) return;
        this.state.region = target.region.id;
        this.state.location = locationId;
        const firstScene = this.arrivalSceneOf(target.location);
        if (firstScene) this.state.scene = firstScene;
        if (conn?.arrive_sound) playInteraction(conn.arrive_sound, { sound: conn.arrive_sound }, conn.arrive_sound_volume ?? 1);
        else playUi("travel_arrive");
        this.onEnterLocation(locationId);
        if (conn && !this.state.game_over && !this.combat) this.rollEncounter(conn);
        this.notify();
      }
      onEnterLocation(locationId) {
        this.state.location = locationId;
        this.runLocationRules(locationId);
        this.checkRules();
        this.autosave();
      }
      /** Локации региона, доступные/видимые на карте. */
      visibleLocations(region) {
        return region.locations.filter(
          (l2) => !l2.hidden || this.state.revealed_locations.includes(l2.id)
        );
      }
      /**
       * Время пути до локации в тиках с учётом штрафов перегруза
       */
      travelCost(toLocation) {
        const from = this.findLocation(this.state.location);
        const conn = from?.location.travel_connections.find((c2) => c2.to === toLocation);
        if (!conn) return null;
        const baseCost = conn.cost_ticks ?? 1;
        const encRules = this.campaign.meta.encumbrance;
        if (encRules?.enabled === false || encRules?.travel_penalty === false) {
          return baseCost;
        }
        const status = this.encumbranceStatus();
        if (status === "critical") {
          return null;
        }
        if (status === "heavy") {
          const mult = encRules?.heavy_travel_multiplier ?? 2;
          return Math.max(baseCost + 1, Math.round(baseCost * mult));
        }
        if (status === "light") {
          const mult = encRules?.light_travel_multiplier ?? 1.5;
          return Math.max(baseCost + 1, Math.round(baseCost * mult));
        }
        return baseCost;
      }
      /**
       * Базовая стоимость пути без учёта штрафа перегруза (для отображения в UI)
       */
      travelBaseCost(toLocation) {
        const from = this.findLocation(this.state.location);
        const conn = from?.location.travel_connections.find((c2) => c2.to === toLocation);
        return conn ? conn.cost_ticks ?? 1 : null;
      }
      // ─────────────── правила ───────────────
      runLocationRules(locationId) {
        const loc = this.findLocation(locationId)?.location;
        if (!loc?.on_enter_rules) return;
        for (const ruleId of loc.on_enter_rules) {
          this.tryFireRule(ruleId);
        }
      }
      /** Проверка всех правил (после каждого значимого действия — ТЗ 4.1). */
      checkRules() {
        for (const rule of Object.values(this.campaign.rules)) {
          if (rule.manual) continue;
          if (rule.trigger && rule.trigger !== "always") continue;
          this.tryFireRule(rule.id);
        }
        this.checkQuestTransitions();
      }
      /** вызов правил, привязанных к конкретному событийному триггеру */
      fireTrigger(trigger, _context) {
        let anyFired = false;
        for (const rule of Object.values(this.campaign.rules)) {
          if (rule.manual) continue;
          if (rule.trigger !== trigger) continue;
          if (this.tryFireRule(rule.id)) {
            anyFired = true;
          }
        }
        return anyFired;
      }
      /** условия правила: все `conditions` И (если заданы) хотя бы одна ИЛИ-группа */
      ruleConditionsOk(rule) {
        if (!(rule.conditions ?? []).every((c2) => evalCondition(c2, this))) return false;
        const groups = rule.conditions_any;
        if (!groups || groups.length === 0) return true;
        return groups.some((g2) => !g2.length || g2.every((c2) => evalCondition(c2, this)));
      }
      tryFireRule(ruleId, depth = 0) {
        const rule = this.campaign.rules[ruleId];
        if (!rule) return false;
        if (rule.once && this.state.fired_rules.includes(rule.id)) return false;
        if (!this.ruleConditionsOk(rule)) return false;
        this.state.fired_rules.push(rule.id);
        this.applyEffects(rule.effects ?? [], depth);
        return true;
      }
      // ─────────────── механика «Незнакомец» (Unknown / Anonymous NPC) ───────────────
      /** раскрыто ли настоящее имя персонажа игроку */
      isNpcNameKnown(entityId) {
        if (this.state.flags[`known_${entityId}`] || this.state.flags[`npc_known_${entityId}`]) return true;
        const def = this.campaign.entities[entityId];
        if (!def || !def.unknown_label) return true;
        return (this.state.known_npcs ?? []).includes(entityId);
      }
      /** актуальное имя персонажа с учётом статуса знакомства */
      npcLabel(entity) {
        const def = typeof entity === "string" ? this.campaign.entities[entity] : entity;
        if (!def) return typeof entity === "string" ? entity : "";
        if (!def.unknown_label) return def.label;
        if (this.isNpcNameKnown(def.id)) return def.label;
        return def.unknown_label;
      }
      /** раскрыть настоящее имя персонажа игроку */
      learnNpcName(npcId, silent = false) {
        const def = this.campaign.entities[npcId];
        const list = this.state.known_npcs ??= [];
        if (list.includes(npcId)) return;
        list.push(npcId);
        if (!silent && def?.unknown_label) {
          const msg = `\u0412\u044B \u0443\u0437\u043D\u0430\u043B\u0438: \xAB${def.unknown_label}\xBB \u2014 \u044D\u0442\u043E ${def.label}.`;
          this.pushLog(msg);
          this.pushToast(msg, "info");
        }
        this.notify();
        this.checkRules();
      }
      // ─────────────── эффекты ───────────────
      /** актуальное описание сущности (с учётом динамических изменений set_description) */
      descOf(entityId) {
        const def = this.campaign.entities[entityId];
        return this.state.desc_overrides?.[entityId] ?? def?.description ?? "";
      }
      /**
       * Раз в сутки: самочувствие NPC с расписанием. Чьё расписание покрывает
       * ночь (от начала ночи до утра) — тот отсыпается (+10); кто без ночёвки
       * по расписанию — устаёт (−10). Диапазоны времени поддерживают полночь.
       */
      tickNpcMood() {
        const meta = this.campaign.meta;
        const tpd = meta.ticks_per_day ?? 24;
        const nightStart = meta.time_of_day?.night ?? 22;
        const morning = meta.time_of_day?.morning ?? 6;
        const spanNight = ((morning - nightStart) % tpd + tpd) % tpd || tpd;
        const nightPts = [0, 0.25, 0.5, 0.75].map((f2) => (nightStart + Math.floor(spanNight * f2)) % tpd);
        for (const [id, ent] of Object.entries(this.campaign.entities)) {
          if (!ent || ent.type !== "npc") continue;
          const sch = ent.schedule;
          if (!sch?.length) continue;
          const slept = sch.some((e2) => {
            let [a2, b2] = e2.time_range;
            a2 = (a2 % tpd + tpd) % tpd;
            b2 = (b2 % tpd + tpd) % tpd;
            const covers = (t5) => a2 <= b2 ? t5 >= a2 && t5 < b2 : t5 >= a2 || t5 < b2;
            return nightPts.every(covers);
          });
          this.changeNpcMood(id, slept ? 10 : -10);
        }
      }
      /** периодическая проверка погони: герой + до двух союзников цепочкой; провал наращивает счётчик до облавы */
      tickPursuit() {
        const p2 = this.state.pursuit;
        if (!p2) return;
        const companions = this.state.party.slice(0, 2);
        let wins = 0;
        const outP = this.playerSkillCheck(p2.skill, 50);
        if (outP.success) wins++;
        for (const c2 of companions) {
          const def = this.campaign.entities[c2.entity];
          if (!def || def.type !== "npc") continue;
          const out = skillCheck(Math.max(1, def.skills?.[p2.skill] ?? 0), this.rng, difficultyModifier(def.skills?.[p2.skill] ?? 0, 50), this.diceRules);
          this.pushLog(`${def.label}: d100=${out.roll} \u043F\u0440\u043E\u0442\u0438\u0432 ${out.target} \u2192 ${CHECK_RESULT_LABEL[out.result]}`);
          if (out.success) wins++;
        }
        p2.left = p2.every;
        if (wins > 0) {
          if (p2.fails > 0) this.pushLog(`\u0421\u043B\u0435\u0434 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u043F\u0443\u0442\u0430\u0442\u044C \u2014 ${p2.label ?? "\u043F\u043E\u0433\u043E\u043D\u044F"} \u043F\u043E\u043A\u0430 \u043D\u0435 \u043D\u0430\u0441\u0442\u0438\u0433\u0430\u0435\u0442.`);
          p2.fails = 0;
          return;
        }
        p2.fails += 1;
        if (p2.fails < p2.fails_needed) {
          this.pushLog(`${p2.label ?? "\u041F\u043E\u0433\u043E\u043D\u044F"} \u043D\u0435 \u043E\u0442\u0441\u0442\u0430\u0451\u0442 \u2014 \u0435\u0449\u0451 ${p2.fails_needed - p2.fails} \u0441\u043E\u0440\u0432\u0430\u043D\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430, \u0438 \u043E\u0442\u0440\u044F\u0434 \u043D\u0430\u0441\u0442\u0438\u0433\u043D\u0443\u0442!`);
          return;
        }
        this.pushLog(`${p2.label ?? "\u041F\u043E\u0433\u043E\u043D\u044F"} \u043D\u0430\u0441\u0442\u0438\u0433\u043B\u0430 \u043E\u0442\u0440\u044F\u0434!`);
        const effects = p2.on_fail;
        delete this.state.pursuit;
        this.applyEffects(effects);
      }
      /** подготовка способности в слот магии (meta.magic.slots): true — получилось */
      togglePreparedAbility(id) {
        const s2 = this.state;
        const slots = this.campaign.meta.magic?.slots;
        if (!slots) return false;
        const cur = new Set(s2.player.prepared_abilities ?? []);
        if (cur.has(id)) cur.delete(id);
        else {
          if (cur.size >= slots) return false;
          cur.add(id);
        }
        const arr = [...cur];
        s2.player.prepared_abilities = arr;
        if (!arr.length) delete s2.player.prepared_abilities;
        return true;
      }
      /** динамически изменить описание сущности (правила/диалоги, действие set_description) */
      setEntityDescription(entityId, text) {
        const s2 = this.state;
        s2.desc_overrides = { ...s2.desc_overrides ?? {}, [entityId]: text };
      }
      applyEffects(effects, depth = 0) {
        for (const e2 of effects) this.applyEffect(e2, depth);
      }
      /**
       * Глубина вложенных вызовов правил (эффект fire_rule). Больше двух — стоп:
       * иначе «правило вызывает правило вызывает правило» зациклит забег. Прямые и
       * транзитивные петли ловит «Проверить кампанию» (см. store.validateContent).
       */
      static FIRE_RULE_MAX_DEPTH = 2;
      applyEffect(e2, depth = 0) {
        const s2 = this.state;
        switch (e2.type) {
          case "fire_rule":
            if (depth >= _GameEngine.FIRE_RULE_MAX_DEPTH) {
              this.pushLog("\u041F\u0440\u0430\u0432\u0438\u043B\u043E \u043D\u0435 \u0432\u044B\u0437\u0432\u0430\u043D\u043E: \u043F\u0440\u0435\u0432\u044B\u0448\u0435\u043D\u0430 \u0433\u043B\u0443\u0431\u0438\u043D\u0430 \u0446\u0435\u043F\u043E\u0447\u043A\u0438 \u0432\u044B\u0437\u043E\u0432\u043E\u0432.");
              break;
            }
            this.tryFireRule(e2.rule, depth + 1);
            break;
          case "unlock_recipe":
            this.unlockRecipe(e2.recipe);
            break;
          case "open_craft":
            this.openCraft(e2.recipe || void 0);
            break;
          case "set_entity_state": {
            const m2 = s2.entity_states ??= {};
            if (e2.state) m2[e2.entity] = e2.state;
            else delete m2[e2.entity];
            this.notify();
            break;
          }
          case "learn_name":
            this.learnNpcName(e2.entity, e2.silent);
            break;
          case "set_flag":
            if (e2.value === false || e2.value === 0 || e2.value === "false") {
              delete s2.flags[e2.flag];
            } else {
              s2.flags[e2.flag] = e2.value ?? true;
            }
            break;
          case "set_description":
            this.setEntityDescription(e2.entity, e2.text);
            break;
          case "clear_flag":
            delete s2.flags[e2.flag];
            break;
          case "apply_status":
            this.applyStatus(e2.target, e2.status, e2.duration);
            break;
          case "remove_status":
            this.removeStatus(e2.target, e2.status);
            break;
          case "set_weather": {
            const next = e2.weather || void 0;
            if (s2.weather !== next) {
              s2.weather = next;
              const w2 = this.campaign.meta.weathers?.find((x2) => x2.id === next);
              this.pushLog(next ? `\u041F\u043E\u0433\u043E\u0434\u0430 \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F: ${w2?.label ?? next}.` : "\u041D\u0435\u0431\u043E \u043F\u0440\u043E\u044F\u0441\u043D\u044F\u0435\u0442\u0441\u044F.");
            }
            break;
          }
          case "unlock_codex":
            this.unlockCodex(e2.entry);
            break;
          case "set_variable":
            s2.variables[e2.var] = e2.value;
            break;
          case "change_variable":
            s2.variables[e2.var] = Number(s2.variables[e2.var] ?? 0) + e2.delta;
            break;
          case "start_duration_action": {
            this.requestDurationAction(e2.action, e2.ticks ?? null);
            break;
          }
          case "start_dialogue":
            this.startDialogue(e2.entity, e2.dialogue_knot);
            break;
          case "start_combat":
            this.startCombat(e2);
            break;
          case "teleport_player": {
            const target = this.findLocation(e2.location);
            if (target) {
              s2.region = target.region.id;
              s2.location = e2.location;
              s2.scene = e2.scene ?? this.arrivalSceneOf(target.location) ?? s2.scene;
            }
            break;
          }
          case "change_scene_state":
            s2.flags[`scene_state:${e2.scene}:${e2.state}`] = true;
            break;
          case "add_item":
            this.addItem(e2.item, e2.quantity ?? 1);
            break;
          case "remove_item":
            this.removeItem(e2.item, e2.quantity ?? 1);
            break;
          case "change_need":
            this.changeNeed(e2.need, e2.delta);
            break;
          case "change_hp":
            this.changeHp(e2.delta);
            break;
          case "change_companion_need":
            this.changeCompanionNeed(e2.entity, e2.need, e2.delta);
            break;
          // сюжетный эффект мастера: quest_item-ограничение не применяется — мастер решает сам
          case "transfer_to_companion":
            this.giveItemToCompanion(e2.entity, e2.item, e2.quantity ?? 1, { forceQuest: true });
            break;
          case "change_skill": {
            if (!featureOn(this.campaign.meta, "skills")) break;
            const cur = s2.player.skills[e2.skill] ?? 0;
            s2.player.skills[e2.skill] = Math.max(0, cur + e2.delta);
            this.pushLog(`\u041D\u0430\u0432\u044B\u043A \xAB${e2.skill}\xBB: ${e2.delta > 0 ? "+" : ""}${e2.delta} (\u0442\u0435\u043F\u0435\u0440\u044C ${s2.player.skills[e2.skill]}).`);
            break;
          }
          case "skill_check_gate": {
            const out = this.playerSkillCheck(e2.skill, e2.difficulty);
            const retry = () => this.playerSkillCheck(e2.skill, e2.difficulty);
            const deferred = this.applyByCheck(
              out,
              `\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \xAB${this.skillLabel(e2.skill)}\xBB`,
              retry,
              () => {
                this.markSkill(e2.skill);
                this.applyEffects(e2.success_effects);
              },
              () => this.applyEffects(e2.fail_effects)
            );
            void deferred;
            break;
          }
          case "stat_check": {
            const mult = e2.multiplier ?? 5;
            const aug = this.augmentBonus(e2);
            const modifier = (e2.modifier ?? 0) + aug;
            const out = this.statCheck(e2.stat, mult, modifier);
            this.applyByCheck(
              out,
              `\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 ${e2.stat}\xD7${mult}`,
              () => this.statCheck(e2.stat, mult, modifier),
              () => this.applyEffects(e2.success_effects),
              () => this.applyEffects(e2.fail_effects)
            );
            break;
          }
          case "group_stat_check": {
            const bySkill = (e2.mode ?? (e2.stat ? "stat" : "skill")) === "skill";
            const helpersN = Math.max(0, e2.helpers ?? 2);
            const companions = this.state.party.slice(0, helpersN);
            const total = 1 + companions.length;
            const need = Math.max(1, e2.need ?? Math.ceil(total / 2));
            let wins = 0;
            const whatLabel = bySkill ? `\u0413\u0440\u0443\u043F\u043F\u043E\u0432\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \xAB${this.skillLabel(e2.skill)}\xBB` : `\u0413\u0440\u0443\u043F\u043F\u043E\u0432\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 ${e2.stat}\xD7${e2.multiplier ?? 5}`;
            this.pushLog(`${whatLabel} \u2014 \u0446\u0435\u043F\u043E\u0447\u043A\u0430 \u0438\u0437 ${total} \u0447\u0435\u043B., \u043D\u0443\u0436\u043D\u043E \u0443\u0441\u043F\u0435\u0448\u043D\u044B\u0445: ${need}.`);
            if (bySkill) {
              const out = this.playerSkillCheck(e2.skill, e2.difficulty ?? 50);
              if (out.success) wins++;
            } else {
              const out = this.statCheck(e2.stat, e2.multiplier ?? 5, e2.modifier ?? 0);
              if (out.success) wins++;
            }
            const mult = e2.multiplier ?? 5;
            for (const c2 of companions) {
              const def = this.campaign.entities[c2.entity];
              if (!def || def.type !== "npc") continue;
              const value = bySkill ? def.skills?.[e2.skill] ?? 0 : (def.stats[e2.stat] ?? 0) * mult;
              const out = skillCheck(
                Math.max(1, value),
                this.rng,
                bySkill ? difficultyModifier(value, e2.difficulty ?? 50) : e2.modifier ?? 0,
                this.diceRules
              );
              this.pushLog(`${def.label}: d100=${out.roll} \u043F\u0440\u043E\u0442\u0438\u0432 ${out.target} \u2192 ${CHECK_RESULT_LABEL[out.result]}`);
              if (out.success) wins++;
            }
            if (wins >= need) {
              this.pushLog(`\u0426\u0435\u043F\u043E\u0447\u043A\u0430 \u0432\u044B\u0434\u0435\u0440\u0436\u0430\u043B\u0430: ${wins} \u0438\u0437 ${total} \u0443\u0441\u043F\u0435\u0448\u043D\u043E.`);
              this.applyEffects(e2.success_effects);
            } else {
              this.pushLog(`\u0426\u0435\u043F\u043E\u0447\u043A\u0430 \u043F\u043E\u0440\u0432\u0430\u043B\u0430\u0441\u044C: ${wins} \u0438\u0437 ${total} \u0443\u0441\u043F\u0435\u0448\u043D\u043E (\u043D\u0443\u0436\u043D\u043E ${need}).`);
              this.applyEffects(e2.fail_effects);
            }
            break;
          }
          case "opposed_check": {
            const res = this.opposedCheck(e2);
            const finalize = (r2) => {
              if (r2.success) this.markSkill(e2.skill);
              this.applyEffects(r2.success ? e2.success_effects : e2.fail_effects);
            };
            if (res.success) {
              finalize(res);
              break;
            }
            const cfg = this.campaign.meta.luck;
            const cost = Math.max(1, cfg?.reroll_cost ?? 1);
            if (!cfg || this.luckMax() <= 0 || this.luck() < cost) {
              finalize(res);
              break;
            }
            this.changeLuck(-cost);
            this.pushLog(`\u041F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u043C\u043E\u0436\u043D\u043E \u043E\u0441\u043F\u043E\u0440\u0438\u0442\u044C \u0437\u0430 \u0443\u0434\u0430\u0447\u0443: \u2212${cost} (\u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C ${this.luck()}).`);
            this.luckOffer = {
              text: `\u041F\u0440\u043E\u0442\u0438\u0432\u043E\u0431\u043E\u0440\u0441\u0442\u0432\u043E \xAB${this.skillLabel(e2.skill)}\xBB \u2014 \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0433\u0435\u0440\u043E\u044F.`,
              cost,
              decide: (reroll) => {
                if (reroll) finalize(this.opposedCheck(e2));
                else {
                  this.pushLog("\u0423\u0434\u0430\u0447\u0430 \u043F\u0440\u0438\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u0430 \u2014 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u0435.");
                  finalize(res);
                }
                this.checkRules();
                this.autosave();
              }
            };
            break;
          }
          case "change_luck":
            this.changeLuck(e2.delta);
            break;
          case "change_fatigue":
            this.changeFatigue(e2.delta);
            break;
          case "change_sanity":
            this.changeSanity(e2.delta);
            break;
          case "change_reputation":
            this.changeReputation(e2.delta);
            break;
          case "change_wealth":
            this.changeWealth(e2.levels);
            break;
          case "change_passion":
            this.changePassion(e2.id, e2.delta ?? (e2.set != null ? e2.set - (this.state.player.passions?.[e2.id] ?? 0) : 0));
            break;
          case "change_allegiance":
            this.changeAllegiance(e2.id, e2.points);
            break;
          case "train_stat":
            this.trainStat(e2.stat, e2.delta);
            break;
          case "hazard_fall":
            this.applyFall(e2.meters, e2.skill);
            break;
          case "commit_crime":
            this.commitCrime(e2.id, e2.bounty);
            break;
          case "set_price_event":
            this.setPriceEvent(e2.id, true);
            break;
          case "clear_price_event":
            this.setPriceEvent(e2.id ?? "", false);
            break;
          case "banner":
            this.showBanner(e2);
            break;
          case "postcard":
            this.showPostcard(e2);
            break;
          case "grant_xp":
            this.grantXp(e2.points);
            break;
          case "grant_feat":
            this.grantFeat(e2.id);
            break;
          case "meta_currency":
            this.grantMetaCurrency(e2.id, e2.amount);
            break;
          case "roll_event_table":
            this.rollEventTable(e2.table, { forced: true, ignoreFilters: e2.ignore_filters });
            break;
          case "play_sound":
            playInteraction(e2.sound, { sound: e2.sound }, e2.volume ?? 1);
            break;
          case "stop_sound":
            stopSound(e2.sound);
            break;
          case "override_music":
            this.setMusicOverride(e2.tracks, e2.fade);
            break;
          case "clear_music_override":
            this.clearMusicOverride();
            break;
          case "generate_variables": {
            for (const p2 of e2.pack) {
              const val = this.genValue(e2.generator, p2.key, e2.seed);
              s2.variables[p2.as ?? p2.key] = val;
            }
            this.pushLog("\u041C\u0438\u0440 \u0447\u0442\u043E-\u0442\u043E \u0437\u0430\u043C\u044B\u0448\u043B\u044F\u0435\u0442\u2026");
            break;
          }
          case "change_disposition":
            this.changeDisposition(e2.target, e2.delta);
            break;
          case "start_quest":
            this.startQuest(e2.quest);
            break;
          case "advance_quest":
            this.advanceQuestTo(e2.quest, e2.stage);
            break;
          case "fail_quest": {
            const qs = s2.quests[e2.quest];
            if (qs && qs.status === "active") {
              qs.status = "failed";
              this.messages.push({ text: `\u041A\u0432\u0435\u0441\u0442 \u043F\u0440\u043E\u0432\u0430\u043B\u0435\u043D: \xAB${this.campaign.quests[e2.quest]?.label ?? e2.quest}\xBB` });
            }
            break;
          }
          case "journal_update":
            this.journalUpdate(e2.quest, e2.text_key);
            break;
          case "give_reward":
            for (const it2 of e2.items ?? []) this.addItem(it2.item, it2.quantity);
            break;
          case "join_party":
            this.joinParty(e2.entity);
            break;
          case "leave_party":
            this.leaveParty(e2.entity);
            break;
          case "block_path":
            if (!s2.blocked_paths.includes(`${e2.from}->${e2.to}`)) s2.blocked_paths.push(`${e2.from}->${e2.to}`);
            break;
          case "unblock_path": {
            const i2 = s2.blocked_paths.indexOf(`${e2.from}->${e2.to}`);
            if (i2 >= 0) s2.blocked_paths.splice(i2, 1);
            break;
          }
          case "show_message": {
            const msgText = this.fmt(e2.text);
            if (!this.messages.some((m2) => m2.text === msgText) && this.messages.length < 5) {
              this.messages.push({ text: msgText, portrait: e2.portrait });
            }
            break;
          }
          case "reveal_location":
            if (!s2.revealed_locations.includes(e2.location)) s2.revealed_locations.push(e2.location);
            break;
          case "advance_time":
            this.advanceTicks(e2.ticks);
            break;
          case "start_pursuit": {
            s2.pursuit = {
              label: e2.label,
              skill: e2.skill ?? "stealth",
              every: Math.max(1, e2.every_ticks ?? 4),
              fails_needed: Math.max(1, e2.fails_to_catch ?? 1),
              fails: 0,
              left: Math.max(1, e2.every_ticks ?? 4),
              on_fail: e2.on_fail
            };
            this.pushLog(`\u0417\u0430 \u0432\u0430\u043C\u0438 \u0441\u043B\u0435\u0434\u043E\u043C \u0438\u0434\u0443\u0442${e2.label ? ` \u2014 ${e2.label}` : ""}! \u0423\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0439\u0442\u0435 \u043C\u0430\u0441\u043A\u0438\u0440\u043E\u0432\u043A\u0443, \u043F\u043E\u043A\u0430 \u043D\u0435 \u043E\u0442\u043E\u0440\u0432\u0451\u0442\u0435\u0441\u044C.`);
            break;
          }
          case "stop_pursuit": {
            if (s2.pursuit) {
              delete s2.pursuit;
              this.pushLog("\u041F\u043E\u0433\u043E\u043D\u044F \u043E\u0441\u0442\u0430\u043B\u0430\u0441\u044C \u043F\u043E\u0437\u0430\u0434\u0438.");
            }
            break;
          }
          case "remove_entity":
            if (!s2.removed_entities.includes(e2.entity)) s2.removed_entities.push(e2.entity);
            break;
          case "spawn_entity":
            s2.spawned.push({ entity: e2.entity, scene: e2.scene, slot: e2.slot });
            break;
          case "game_over_victory":
            this.gameOver("victory", "\u041A\u0430\u043C\u043F\u0430\u043D\u0438\u044F \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u0430!");
            break;
          case "game_over_death":
            this.gameOver("death", e2.reason ?? "\u0412\u044B \u043F\u043E\u0433\u0438\u0431\u043B\u0438.");
            break;
          case "play_cutscene":
            this.playCutscene(e2.cutscene);
            break;
        }
        this.checkAchievements();
      }
      // ─────────────── взаимодействие со слотами ───────────────
      // ─────────────── предмет → слот сцены (блок 8 ТЗ «Гибкий движок») ───────────────
      /** предметы игрока, применимые к слоту (для модалки выбора) */
      slotUseOptions(slot) {
        return (slot.use_with ?? []).filter((u2) => u2.item && this.hasItem(u2.item)).map((u2) => ({
          itemId: u2.item,
          label: this.campaign.entities[u2.item]?.label ?? u2.item,
          use: u2
        }));
      }
      /** применить предмет к слоту сцены; ложь — предмет/слот не подходят */
      useItemOnSlot(slotId, itemId) {
        const scene = this.currentScene();
        const slot = scene?.slots.find((s2) => s2.id === slotId);
        const use = slot?.use_with?.find((u2) => u2.item === itemId);
        if (!slot || !use || !this.hasItem(itemId)) return false;
        const def = this.campaign.entities[itemId];
        if (use.consume) this.removeItem(itemId, 1, { verb: "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u043E" });
        this.applyEffects(use.effects);
        if (use.message) this.messages.push({ text: use.message });
        this.pushLog(`${def?.label ?? itemId}: \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u043E \u043D\u0430 \xAB${slot.label ?? slotId}\xBB.`);
        playInteraction("use", { entity: def });
        this.checkRules();
        this.autosave();
        this.notify();
        return true;
      }
      /**
       * Открыть рецепт крафта «по ходу игры». Рецепты без `known: false` открыты
       * всегда; этот эффект лишь снимает «закрытость» и один раз радует игрока.
       */
      unlockRecipe(recipeId) {
        const r2 = this.campaign.recipes[recipeId];
        if (!r2) return;
        const s2 = this.state;
        if (!s2.recipes_unlocked) s2.recipes_unlocked = [];
        if (s2.recipes_unlocked.includes(recipeId)) return;
        s2.recipes_unlocked.push(recipeId);
        this.messages.push({ text: `\u041D\u043E\u0432\u044B\u0439 \u0440\u0435\u0446\u0435\u043F\u0442: ${r2.label}.` });
        this.pushLog(`\u041E\u0442\u043A\u0440\u044B\u0442 \u0440\u0435\u0446\u0435\u043F\u0442: ${r2.label}.`);
        playInteraction("pickup", {});
        this.notify();
        this.autosave();
      }
      /** рецепт виден игроку? (неизвестные закрыты до unlock_recipe или выполнения условий) */
      recipeKnown(id) {
        const r2 = this.campaign.recipes[id];
        if (!r2) return false;
        if (r2.known === false && !this.state.recipes_unlocked?.includes(id)) return false;
        if (r2.conditions && r2.conditions.length > 0) {
          if (!r2.conditions.every((c2) => evalCondition(c2, this))) return false;
        }
        return true;
      }
      /** список рецептов, доступных игроку (вкладка «Крафт») */
      knownRecipes() {
        return Object.values(this.campaign.recipes).filter((r2) => this.recipeKnown(r2.id)).sort((a2, b2) => a2.label.localeCompare(b2.label, "ru"));
      }
      /** состояние облика сущности, заданное правилом (set_entity_state) */
      entityState(id) {
        return this.state.entity_states?.[id] || void 0;
      }
      /**
       * Разблокировать запись кодекса (блок 10 ТЗ): повтор — no-op.
       * При первой разблокировке — сообщение «Новая запись в кодексе: …».
       */
      unlockCodex(entryId) {
        const entry = this.campaign.codex[entryId];
        if (!entry) return;
        const s2 = this.state;
        if (!s2.codex_unlocked) s2.codex_unlocked = [];
        if (s2.codex_unlocked.includes(entryId)) return;
        s2.codex_unlocked.push(entryId);
        this.messages.push({ text: `\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u0432 \u043A\u043E\u0434\u0435\u043A\u0441\u0435: ${entry.label}.` });
        this.pushLog(`\u041A\u043E\u0434\u0435\u043A\u0441 \u043F\u043E\u043F\u043E\u043B\u043D\u0435\u043D: ${entry.label}.`);
        playInteraction("pickup", {});
        this.notify();
        this.autosave();
      }
      /** разблокированные записи кодекса (блок 10 ТЗ) */
      unlockedCodexEntries() {
        return (this.state.codex_unlocked ?? []).map((id) => this.campaign.codex[id]).filter((e2) => !!e2);
      }
      /** категории кодекса: свои из меты, иначе встроенные три (блок 10 ТЗ) */
      codexCategories() {
        return this.campaign.meta.codex_categories ?? BUILTIN_CODEX_CATEGORIES;
      }
      /**
       * Можно ли взаимодействовать с предметом прямо сейчас (фидбек №8: условия
       * блокируют клик — предмет остаётся «декорацией» в слоте).
       */
      /**
       * Текст с упоминаниями героя (фидбек №11, «больше плейсхолдеров в диалогах»):
       * `{имя}`/`{герой}` — имя персонажа, `{здоровье}`/`{здоровье_макс}` — HP,
       * `{день}` — номер дня забега, `{время}` — время суток по-русски,
       * `{переменная:<имя>}` — обычная переменная читалки ({имя} считает её латиницей).
       */
      fmt(text) {
        if (!text.includes("{")) return text;
        const st2 = this.state;
        const p2 = st2.player;
        const day = Math.floor((st2.tick ?? 0) / Math.max(1, this.campaign.meta.ticks_per_day || 24)) + 1;
        const out = {
          "\u0438\u043C\u044F": p2.name ?? "\u0433\u0435\u0440\u043E\u0439",
          "\u0433\u0435\u0440\u043E\u0439": p2.name ?? "\u0433\u0435\u0440\u043E\u0439",
          "\u0438\u043C\u044F_\u0433\u0435\u0440\u043E\u044F": p2.name ?? "\u0433\u0435\u0440\u043E\u0439",
          "\u0437\u0434\u043E\u0440\u043E\u0432\u044C\u0435": String(Math.max(0, p2.hp)),
          "\u0437\u0434\u043E\u0440\u043E\u0432\u044C\u0435_\u043C\u0430\u043A\u0441": String(p2.max_hp),
          "\u043C\u0430\u043D\u0430": String(Math.max(0, p2.mp)),
          "\u043C\u0430\u043D\u0430_\u043C\u0430\u043A\u0441": String(p2.max_mp),
          "\u0443\u0434\u0430\u0447\u0430": String(this.luck()),
          "\u0443\u0440\u043E\u0432\u0435\u043D\u044C": String(p2.level ?? 1),
          "\u043E\u043F\u044B\u0442": String(p2.xp ?? 0),
          "\u0434\u0435\u043D\u044C": String(day)
        };
        return text.replace(/\{([^{}]+)\}/g, (_m, raw) => {
          if (raw in out) return out[raw];
          const cut = raw.indexOf(":");
          if (cut > 0) {
            const kind = raw.slice(0, cut);
            const id = raw.slice(cut + 1).trim();
            switch (kind) {
              case "\u0441\u0447\u0451\u0442":
              case "\u0441\u0447\u0435\u0442":
                return String(this.itemCount(id));
              case "\u043D\u0430\u0432\u044B\u043A":
                return String(p2.skills[id] ?? 0);
              case "\u043F\u043E\u0442\u0440\u0435\u0431\u043D\u043E\u0441\u0442\u044C":
                return String(p2.needs[id] ?? 0);
              case "\u0441\u0442\u0430\u0442":
                return String(p2.stats[id] ?? 0);
              case "\u0432\u0430\u043B\u044E\u0442\u0430":
                return String(p2.currencies?.[id] ?? 0);
            }
          }
          return `{${raw}}`;
        });
      }
      itemInteractable(item) {
        return (item.interactable_when ?? []).every((c2) => evalCondition(c2, this));
      }
      /** доступные сейчас варианты действий с предметом (условия показа) */
      itemInteractOptions(item) {
        const itemOptions = item.interact_options ?? [];
        return itemOptions.filter((o2, index) => {
          if (o2.conditions && o2.conditions.length > 0 && !o2.conditions.every((c2) => evalCondition(c2, this))) return false;
          if (o2.once) {
            const key = `item:${item.id}:${index}`;
            if (this.state.used_item_interacts?.includes(key)) return false;
          }
          return true;
        });
      }
      /** применить выбранный вариант взаимодействия с предметом */
      runItemInteract(item, option) {
        const soundOpt = option.sound ?? "use";
        playInteraction(soundOpt, { entity: item, sound: option.sound }, option.sound_volume ?? 1);
        if (option.effects?.some((ef) => ef.type === "open_craft")) {
          this.craftSourceEntity = item;
        }
        this.applyEffects(option.effects);
        if (option.message) {
          if (this.craftRequest || this.combat || this.dialogue) {
            this.pushToast(this.fmt(option.message), "info");
          } else {
            this.messages.push({ text: this.fmt(option.message), portrait: item.portrait?.[option.emotion ?? "neutral"] ?? item.portrait?.["neutral"] });
          }
        }
        if (option.consume) this.state.removed_entities.push(item.id);
        if (option.once) {
          const itemOptions = item.interact_options ?? [];
          const optionIndex = itemOptions.findIndex((o2) => o2 === option);
          if (optionIndex >= 0) {
            const key = `item:${item.id}:${optionIndex}`;
            if (!this.state.used_item_interacts) this.state.used_item_interacts = [];
            if (!this.state.used_item_interacts.includes(key)) {
              this.state.used_item_interacts.push(key);
            }
          }
        }
        this.checkRules();
        this.notify();
      }
      interactWithSlot(occ) {
        if (!occ.entity) return false;
        this.inspectedEntityId = occ.entity.id;
        if (occ.slot.sound) {
          playInteraction(occ.slot.sound, { sound: occ.slot.sound }, occ.slot.sound_volume ?? 1);
        }
        if (occ.entity.type === "npc") {
          const npc = occ.entity;
          if (npc.dialogue) {
            this.startDialogue(occ.entity.id);
          } else {
            const desc = this.descOf(npc.id);
            if (desc) {
              this.messages.push({
                text: desc,
                portrait: npc.portrait?.neutral || void 0
              });
              this.notify();
            }
          }
          return true;
        }
        const item = occ.entity;
        if (!this.itemInteractable(item)) return false;
        const slotType = occ.slot.type[0];
        const opts = this.itemInteractOptions(item);
        if (opts.length) {
          return false;
        }
        if (item.on_interact) {
          const isOpen = occ.slot.type.includes("container") || item.category === "container";
          playInteraction(isOpen ? "open" : "use", { entity: item, slotType });
          this.applyEffects(item.on_interact.effects);
          const desc = this.descOf(item.id) || item.description;
          if (item.on_interact.message) {
            this.messages.push({ text: this.fmt(item.on_interact.message) });
          } else if (desc) {
            this.messages.push({
              text: desc,
              portrait: item.portrait?.neutral || void 0
            });
          }
          if (item.on_interact.consume) {
            this.state.removed_entities.push(item.id);
          }
          this.checkRules();
          this.notify();
        } else {
          const desc = this.descOf(item.id);
          const textToShow = desc || item.description;
          if (textToShow) {
            this.messages.push({
              text: textToShow,
              portrait: item.portrait?.neutral || void 0
            });
          } else {
            this.pushToast(`\xAB${item.label}\xBB (\u043D\u0435\u0442 \u043F\u043E\u0434\u0440\u043E\u0431\u043D\u043E\u0433\u043E \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u044F)`);
          }
          this.notify();
        }
        return true;
      }
      // ─────────────── бой (Фаза 1) ───────────────
      /** эффекты on_victory, требующие закрытия экрана боя (диалог, телепорт и т.п.) */
      postCombatEffects = [];
      /**
       * Вызывается боем в момент его разрешения — победы, бегства игрока или
       * «бессознательного» проигрыша (BRP-режим). Безопасные эффекты применяются
       * сразу, пока игрок видит экран исхода; смена экрана (диалог, телепорт,
       * новый бой, финал) — после закрытия боя.
       */
      onCombatResolve(effects) {
        const defer = /* @__PURE__ */ new Set(["start_dialogue", "start_combat", "teleport_player", "game_over_victory", "game_over_death", "play_cutscene"]);
        this.postCombatEffects = effects.filter((e2) => defer.has(e2.type));
        this.applyEffects(effects.filter((e2) => !defer.has(e2.type)));
        this.notify();
      }
      startCombat(def) {
        if (!featureOn(this.campaign.meta, "combat")) {
          this.pushLog("\u041A\u043E\u043D\u0444\u043B\u0438\u043A\u0442 \u0440\u0430\u0437\u0440\u0435\u0448\u0438\u043B\u0441\u044F \u0431\u0435\u0437 \u0431\u043E\u044F.");
          this.applyEffects(def.on_victory ?? []);
          this.checkRules();
          this.notify();
          return;
        }
        let effective = def;
        if (!def.surprise && this.isSneaking() && !this.isDetected()) {
          effective = { ...def, surprise: "player" };
          this.pushLog("\u0412\u044B \u043D\u0430\u043F\u0430\u0434\u0430\u0435\u0442\u0435 \u0438\u0437 \u0441\u043A\u0440\u044B\u0442\u043D\u043E\u0441\u0442\u0438 \u2014 \u0432\u0440\u0430\u0433\u0438 \u0437\u0430\u0441\u0442\u0438\u0433\u043D\u0443\u0442\u044B \u0432\u0440\u0430\u0441\u043F\u043B\u043E\u0445!");
        }
        if (this.state.stealth) this.state.stealth.sneaking = false;
        this.dialogue = null;
        this.activeStory = null;
        this.activeNpc = null;
        this.combat = new CombatController(this, effective);
        playUi("combat_start");
        this.notify();
      }
      /** Вызывается UI после экрана исхода боя (победа / бегство / выживание). */
      endCombat() {
        const combat = this.combat;
        if (!combat) return;
        this.combat = null;
        for (const ally of combat.combatants.filter((c2) => c2.id.startsWith("c_ally_") && c2.dead)) {
          const comp = this.state.party.find((p2) => p2.entity === ally.entityId);
          if (comp) {
            comp.hp = 0;
            this.leaveParty(ally.entityId);
            this.messages.push({ text: `${ally.label} \u043F\u043E\u0433\u0438\u0431(\u043B\u0430). \u0422\u0435\u043B\u043E \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C \u043D\u0430 \xAB${combat.arena.label}\xBB.`, portrait: ally.portrait });
          }
        }
        if (combat.result === "victory" || combat.result === "fled") {
          const deferred = this.postCombatEffects;
          this.postCombatEffects = [];
          this.applyEffects(deferred);
          this.advanceTicks(1);
          this.state.stats_run.kills += combat.combatants.filter((c2) => c2.side === "enemy" && c2.dead).length;
          this.pushLog(
            combat.result === "victory" ? `\u0411\u043E\u0439 \xAB${combat.arena.label}\xBB \u0432\u044B\u0438\u0433\u0440\u0430\u043D \u0437\u0430 ${combat.round} \u0440\u0430\u0443\u043D\u0434(\u043E\u0432).` : `\u0412\u044B \u043E\u0442\u0441\u0442\u0443\u043F\u0438\u043B\u0438 \u0438\u0437 \u0431\u043E\u044F \xAB${combat.arena.label}\xBB.`
          );
          this.checkRules();
          this.autosave();
        } else if (combat.result === "defeat" && !this.state.game_over) {
          const deferred = this.postCombatEffects;
          this.postCombatEffects = [];
          this.applyEffects(deferred);
          this.advanceTicks(1);
          this.pushLog("\u0412\u044B \u043F\u0440\u0438\u0445\u043E\u0434\u0438\u0442\u0435 \u0432 \u0441\u0435\u0431\u044F \u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F.");
          this.checkRules();
          this.autosave();
        }
        this.notify();
      }
      /** Публичный запуск manual-правила (для Ink external fire_rule). */
      fireRule(ruleId) {
        this.tryFireRule(ruleId);
      }
      // ─────────────── диалоги ───────────────
      /**
       * Найти ink-исходник диалога по ссылке NPC. Канон пакета —
       * `dialogues/<id>.ink`; монолит до repair и ручные правки часто держат
       * голый id (`dlg_orion`). Без фолбэков диалог «молча не открывался».
       */
      resolveDialogueSource(ref) {
        const map = this.campaign.dialogues;
        if (!ref) return null;
        if (map[ref]) return { key: ref, source: map[ref] };
        const bare = ref.replace(/^dialogues\//, "").replace(/\.(dlg\.json|ink|json)$/i, "");
        const candidates = [
          `dialogues/${bare}.ink`,
          bare,
          `${bare}.ink`,
          `dialogues/${bare}`
        ];
        for (const k2 of candidates) {
          if (map[k2]) return { key: k2, source: map[k2] };
        }
        for (const [k2, src] of Object.entries(map)) {
          if (k2 === bare || k2.endsWith(`/${bare}.ink`) || k2.endsWith(`/${bare}`)) {
            return { key: k2, source: src };
          }
        }
        return null;
      }
      startDialogue(entityId, knot) {
        stopVoiceAudio();
        let npc = this.campaign.entities[entityId];
        if (!npc || npc.type !== "npc") {
          npc = Object.values(this.campaign.entities).find((e2) => e2.type === "npc" && (e2.dialogue === entityId || e2.dialogue === `${entityId}.ink`));
        }
        if (!npc || npc.type !== "npc" || !npc.dialogue) return;
        const resolved = this.resolveDialogueSource(npc.dialogue);
        if (!resolved) return;
        const { key: dialogueKey, source } = resolved;
        playInteraction("talk", { entity: npc });
        let story;
        this.lastDialogueError = null;
        try {
          story = createStory(source, dialogueKey);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.lastDialogueError = msg;
          this.pushLog(`\u0414\u0438\u0430\u043B\u043E\u0433 \xAB${dialogueKey}\xBB \u043D\u0435 \u0441\u043A\u043E\u043C\u043F\u0438\u043B\u0438\u0440\u043E\u0432\u0430\u043B\u0441\u044F.`);
          this.messages.push({ text: `\u0414\u0438\u0430\u043B\u043E\u0433 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D (${npc.label}).` });
          console.error(msg);
          this.notify();
          return;
        }
        bindExternals(story, this);
        const entryKnot = knot ?? "main";
        try {
          story.ChoosePathString(entryKnot);
        } catch {
          const fallback = firstInkKnot(source);
          if (fallback && fallback !== entryKnot) {
            try {
              story.ChoosePathString(fallback);
            } catch {
              this.lastDialogueError = `\u0421\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0439 \u0443\u0437\u0435\u043B \xAB${fallback}\xBB \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0432 \u0434\u0438\u0430\u043B\u043E\u0433\u0435 \xAB${dialogueKey}\xBB.`;
              return;
            }
          } else if (!story.canContinue) {
            this.lastDialogueError = `\u0423\u0437\u0435\u043B \xAB${entryKnot}\xBB \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0432 \u0434\u0438\u0430\u043B\u043E\u0433\u0435 \xAB${dialogueKey}\xBB.`;
            return;
          }
        }
        this.activeStory = story;
        this.activeNpc = npc;
        this.state.stats_run.dialogues += 1;
        this.dialogueHistory = [];
        const drained = drainStory(story);
        for (const l2 of drained.lines) {
          this.dialogueHistory.push({
            speaker: l2.action ? "" : this.dlgSpeakerLabel(l2, npc),
            text: l2.text,
            emotion: l2.emotion,
            action: l2.action
          });
        }
        if (this.combat || this.trade || this.state.game_over || !this.activeStory) {
          this.dialogue = null;
          this.dialogueHistory = [];
          this.activeStory = null;
          this.activeNpc = null;
        } else {
          this.dialogue = {
            npc,
            lines: drained.lines,
            choices: drained.choices,
            finished: drained.finished,
            history: [...this.dialogueHistory]
          };
          this.commitDialogueTimer(drained.choices.length);
          this.commitDialoguePresenting();
          this.dialogue.timer = this.dialogueTimer ?? void 0;
        }
        this.notify();
      }
      chooseDialogueOption(index) {
        const story = this.activeStory;
        const npc = this.activeNpc;
        if (!story || !npc) return;
        const chosenChoice = story.currentChoices[index]?.text;
        if (chosenChoice) {
          this.dialogueHistory.push({
            speaker: this.state.player.name || "\u0412\u044B",
            text: chosenChoice,
            isChoice: true
          });
        }
        story.ChooseChoiceIndex(index);
        const drained = drainStory(story);
        for (const l2 of drained.lines) {
          this.dialogueHistory.push({
            speaker: l2.action ? "" : this.dlgSpeakerLabel(l2, npc),
            text: l2.text,
            emotion: l2.emotion,
            action: l2.action
          });
        }
        if (this.combat || this.trade || this.state.game_over || !this.activeStory) {
          this.dialogue = null;
          this.dialogueHistory = [];
          this.activeStory = null;
          this.activeNpc = null;
          this.notify();
          return;
        }
        this.dialogue = {
          npc,
          lines: drained.lines,
          choices: drained.choices,
          finished: drained.finished,
          history: [...this.dialogueHistory]
        };
        this.commitDialogueTimer(drained.choices.length);
        this.commitDialoguePresenting();
        this.dialogue.timer = this.dialogueTimer ?? void 0;
        this.checkRules();
        if (this.state.game_over) {
          this.dialogue = null;
          this.dialogueHistory = [];
          this.activeStory = null;
          this.activeNpc = null;
        }
        this.notify();
      }
      endDialogue() {
        stopVoiceAudio();
        this.dialogueTimer = null;
        this.pendingDialoguePresenting = null;
        this.dialogue = null;
        this.dialogueHistory = [];
        this.activeStory = null;
        this.activeNpc = null;
        this.checkRules();
        this.autosave();
        this.notify();
      }
      dismissMessage() {
        this.messages.shift();
        this.flushPendingBannersIfClear();
        this.notify();
      }
      // ─────────────── рогалик-луп ───────────────
      gameOver(type, reason, force = false) {
        if (this.debugInvincible && type === "death" && !force) return;
        if (this.state.game_over) return;
        const ending = (this.campaign.meta.endings ?? []).find(
          (en) => (!en.on || en.on === type) && (en.conditions ?? []).every((c2) => evalCondition(c2, this))
        );
        this.state.game_over = { type, reason, ending: ending?.id };
        if (ending?.id) this.rememberEnding(ending.id);
        this.finalizeRunMeta(type === "victory");
        this.dialogue = null;
        this.dialogueTimer = null;
        this.activeStory = null;
        this.activeNpc = null;
        this.trade = null;
        deleteSave(this.campaign.meta.id);
        this.notify();
      }
      /** Полный рестарт: новый seed (ТЗ 4.10). */
      restart() {
        deleteSave(this.campaign.meta.id);
        const fresh = new _GameEngine(this.campaign);
        if (this.state.char_choice) {
          fresh.applyCharCreation({ ...this.state.char_choice, calling: this.state.char_choice.calling ?? "" });
        }
        fresh.start();
        return fresh;
      }
      /** New Game+ доступен? (мастер разрешил, забег завершён победой) */
      newGamePlusAvailable() {
        return !!this.campaign.meta.new_game_plus && this.state.game_over?.type === "victory";
      }
      /**
       * New Game+: победивший герой возвращается в новый забег с наследием
       * (keep мастера), круг +1 — множители сложности растут на boost-шаги.
       * Пермадет-семантика сохранена: NG+ только за победу.
       */
      newGamePlus() {
        const cfg = this.campaign.meta.new_game_plus;
        if (!this.newGamePlusAvailable() || !cfg) return null;
        const prev = this.state;
        deleteSave(this.campaign.meta.id);
        const fresh = new _GameEngine(this.campaign);
        if (prev.char_choice) {
          fresh.applyCharCreation({ ...prev.char_choice, calling: prev.char_choice.calling ?? "" });
        }
        fresh.start();
        const keep = new Set(cfg.keep ?? ["skills", "skill_marks", "stats", "inventory", "feats", "prepared"]);
        const pp = prev.player;
        const np = fresh.state.player;
        if (keep.has("skills")) np.skills = JSON.parse(JSON.stringify(pp.skills));
        if (keep.has("skill_marks")) np.skill_marks = { ...pp.skill_marks };
        if (keep.has("stats")) {
          np.stats = { ...pp.stats };
          np.max_hp = pp.max_hp;
          np.max_mp = pp.max_mp;
        }
        if (keep.has("inventory")) {
          np.inventory = JSON.parse(JSON.stringify(pp.inventory));
          np.equipment = { ...pp.equipment };
        }
        if (keep.has("feats")) {
          np.xp = pp.xp;
          np.level = pp.level;
          np.feats = pp.feats?.slice();
        }
        if (keep.has("prepared")) np.prepared_abilities = pp.prepared_abilities?.slice();
        np.portrait_choice = pp.portrait_choice && JSON.parse(JSON.stringify(pp.portrait_choice));
        np.difficulty = pp.difficulty;
        np.hp = np.max_hp;
        np.mp = np.max_mp;
        fresh.state.ng_cycle = (prev.ng_cycle ?? 0) + 1;
        return fresh;
      }
      // ─────────────── мета-прогресс между забегами (аудит B8b) ───────────────
      /** мета-прогресс включён мастером (блок meta.metaprogress) */
      metaProgressEnabled() {
        return !!this.campaign.meta.metaprogress;
      }
      static metaKey(campaignId) {
        return `chronicle-forge:meta:${campaignId}`;
      }
      metaState = null;
      static blankMetaState() {
        return { runs: 0, deaths: 0, victories: 0, currencies: {}, achievements: {}, unlocks: [], counters: {} };
      }
      /** снимок мета-хранилища (ленивая загрузка из localStorage) */
      metaStore() {
        if (this.metaState) return this.metaState;
        let loaded;
        try {
          const raw = localStorage.getItem(_GameEngine.metaKey(this.campaign.meta.id));
          loaded = raw ? { ..._GameEngine.blankMetaState(), ...JSON.parse(raw) } : _GameEngine.blankMetaState();
        } catch {
          loaded = _GameEngine.blankMetaState();
        }
        this.metaState = loaded;
        return loaded;
      }
      saveMetaStore() {
        if (!this.metaProgressEnabled() || !this.metaState) return;
        try {
          localStorage.setItem(_GameEngine.metaKey(this.campaign.meta.id), JSON.stringify(this.metaState));
        } catch {
        }
      }
      /** баланс метавалюты */
      metaCurrency(id) {
        return this.metaStore().currencies[id] ?? 0;
      }
      /** начислить метавалюту (эффект/награда достижения) */
      grantMetaCurrency(id, amount) {
        if (!this.metaProgressEnabled() || amount === 0) return;
        const def = this.campaign.meta.metaprogress?.currencies?.find((c2) => c2.id === id);
        if (!def) return;
        const st2 = this.metaStore();
        st2.currencies[id] = Math.max(0, (st2.currencies[id] ?? 0) + amount);
        this.pushLog(`${def.label}: ${amount > 0 ? "+" : ""}${amount} (\u0432\u0441\u0435\u0433\u043E ${st2.currencies[id]}).`);
        this.saveMetaStore();
        this.notify();
      }
      /** открыто ли достижение */
      metaAchievementDone(id) {
        return !!this.metaStore().achievements[id];
      }
      /**
       * Счётчик хроники для условия meta_counter: «сколько раз это уже было»
       * между забегами. Служебные ключи (runs/deaths/victories/endings_seen)
       * читаются из хранилища как есть; любой другой ключ — накопленный счётчик
       * stats_run плюс вклад текущего забега (как у достижений).
       */
      metaCounter(key) {
        const st2 = this.metaStore();
        switch (key) {
          case "runs":
            return st2.runs;
          case "deaths":
            return st2.deaths;
          case "victories":
            return st2.victories;
          case "endings_seen":
            return (st2.endings ?? []).length;
          default:
            return (st2.counters[key] ?? 0) + (this.state.stats_run[key] ?? 0);
        }
      }
      /** записать концовку в хронику (истина — впервые увидена) */
      rememberEnding(endingId) {
        const st2 = this.metaStore();
        st2.endings ??= [];
        if (st2.endings.includes(endingId)) return;
        st2.endings.push(endingId);
      }
      /** достижения с состоянием (для экрана) */
      achievementStates() {
        const cfg = this.campaign.meta.metaprogress;
        if (!cfg) return [];
        const st2 = this.metaStore();
        return (cfg.achievements ?? []).filter((a2) => !a2.hidden || st2.achievements[a2.id]).map((a2) => ({
          def: a2,
          done: !!st2.achievements[a2.id],
          ...a2.counter ? { progress: this.achievementCounter(a2), target: a2.counter.target } : {}
        }));
      }
      achievementCounter(a2) {
        if (!a2.counter) return 0;
        const st2 = this.metaStore();
        const total = st2.counters[a2.counter.stat] ?? 0;
        return total + (this.state.stats_run[a2.counter.stat] ?? 0);
      }
      /**
       * Проверка всех закрытых достижений (тики, эффекты, конец забега вызывают).
       * Защёлкивает открывшиеся: лог, награда, сохранение.
       */
      checkAchievements() {
        const cfg = this.campaign.meta.metaprogress;
        if (!cfg?.achievements?.length) return;
        const st2 = this.metaStore();
        let dirty = false;
        for (const a2 of cfg.achievements) {
          if (st2.achievements[a2.id]) continue;
          const ok = a2.counter ? this.achievementCounter(a2) >= a2.counter.target : (a2.conditions ?? []).length > 0 && (a2.conditions ?? []).every((c2) => evalCondition(c2, this));
          if (!ok) continue;
          st2.achievements[a2.id] = (/* @__PURE__ */ new Date()).toISOString();
          dirty = true;
          this.unlockedThisRun.push(a2.id);
          this.pushLog(`\u0414\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u0435: \xAB${a2.label}\xBB!`);
          if (a2.reward?.currency && a2.reward.amount) {
            st2.currencies[a2.reward.currency] = Math.max(0, (st2.currencies[a2.reward.currency] ?? 0) + a2.reward.amount);
            const curLabel = cfg.currencies?.find((c2) => c2.id === a2.reward.currency)?.label ?? a2.reward.currency;
            this.pushLog(`${curLabel}: +${a2.reward.amount}.`);
          }
          if (a2.reward?.xp) this.grantXp(a2.reward.xp);
        }
        if (dirty) this.saveMetaStore();
      }
      /** открытые в этом забеге достижения (для экрана исхода) */
      unlockedThisRun = [];
      achievementsUnlockedThisRun() {
        const cfg = this.campaign.meta.metaprogress;
        if (!cfg) return [];
        return this.unlockedThisRun.map((id) => cfg.achievements?.find((a2) => a2.id === id)).filter((x2) => !!x2);
      }
      /** вклад статистики текущего забега в суммарные счётчики + исход */
      finalizeRunMeta(won) {
        if (!this.metaProgressEnabled()) return;
        const st2 = this.metaStore();
        if (won) st2.victories += 1;
        else st2.deaths += 1;
        for (const [k2, v2] of Object.entries(this.state.stats_run)) {
          st2.counters[k2] = (st2.counters[k2] ?? 0) + (v2 ?? 0);
        }
        this.checkAchievements();
        this.saveMetaStore();
      }
      /** старт нового забега: счётчик и гранты купленных усилений */
      metaRunStart() {
        const cfg = this.campaign.meta.metaprogress;
        if (!cfg) return;
        const st2 = this.metaStore();
        st2.runs += 1;
        this.saveMetaStore();
        if (st2.runs > 1) this.pushLog(`\u0425\u0440\u043E\u043D\u0438\u043A\u0430 \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u0435\u0442 \u043F\u0438\u0441\u0430\u0442\u044C\u0441\u044F \u2014 \u0437\u0430\u0431\u0435\u0433 \u2116${st2.runs}.`);
        for (const uid of st2.unlocks) {
          const u2 = cfg.unlocks?.find((x2) => x2.id === uid);
          if (!u2) continue;
          this.pushLog(`\u0423\u0441\u0438\u043B\u0435\u043D\u0438\u0435 \u0438\u0437 \u0445\u0440\u043E\u043D\u0438\u043A\u0438: \xAB${u2.label}\xBB.`);
          this.applyEffects(u2.grants);
        }
        this.checkAchievements();
      }
      /** куплено ли усиление */
      metaUnlockOwned(id) {
        return this.metaStore().unlocks.includes(id);
      }
      /** можно ли купить усиление (валюты хватает, требования истинны) */
      metaUnlockAffordable(u2) {
        if (this.metaUnlockOwned(u2.id)) return false;
        if (u2.requires?.length && !u2.requires.every((c2) => evalCondition(c2, this))) return false;
        return u2.cost.every((c2) => this.metaCurrency(c2.currency) >= c2.amount);
      }
      /** купить постоянное усиление (экран хроники/финала) */
      buyMetaUnlock(id) {
        const u2 = this.campaign.meta.metaprogress?.unlocks?.find((x2) => x2.id === id);
        if (!u2 || !this.metaUnlockAffordable(u2)) return false;
        const st2 = this.metaStore();
        for (const c2 of u2.cost) st2.currencies[c2.currency] = (st2.currencies[c2.currency] ?? 0) - c2.amount;
        st2.unlocks.push(id);
        this.saveMetaStore();
        this.pushLog(`\u0412 \u0445\u0440\u043E\u043D\u0438\u043A\u0443 \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u043E \u0443\u0441\u0438\u043B\u0435\u043D\u0438\u0435 \xAB${u2.label}\xBB \u2014 \u0431\u0443\u0434\u0435\u0442 \u0434\u0435\u0439\u0441\u0442\u0432\u043E\u0432\u0430\u0442\u044C \u043A\u0430\u0436\u0434\u043E\u043C \u043D\u043E\u0432\u043E\u043C \u0437\u0430\u0431\u0435\u0433\u0435.`);
        this.notify();
        return true;
      }
      // ─────────────── случайные события и генераторы (аудит B9) ───────────────
      /** есть ли генераторы/таблицы вообще */
      generatorsEnabled() {
        const g2 = this.campaign.meta.generators;
        return !!(g2 && (g2.event_tables?.length || g2.npc?.length || g2.scenes?.length || g2.adventures?.length));
      }
      /** таблица событий по id */
      eventTableDef(id) {
        return this.campaign.meta.generators?.event_tables?.find((t5) => t5.id === id);
      }
      /** таблица событий активна сейчас (не выключена, время/локация подходят) */
      eventTableActive(t5) {
        if (t5.disabled) return false;
        if (t5.time_of_day?.length && !t5.time_of_day.includes(timeOfDay(this.state.tick, this.campaign.meta))) return false;
        if (t5.locations?.length && !t5.locations.includes(this.state.location)) return false;
        return true;
      }
      /**
       * Один бросок таблицы: выбор случайного подходящего правила и его
       * исполнение. Возвращает id исполненного правила или null.
       * `forced` — вызыватель эффекта roll_event_table: без шанса-интервала,
       * `ignoreFilters` — даже без проверок времени/локации.
       */
      rollEventTable(tableId, opts = {}) {
        const t5 = this.eventTableDef(tableId);
        if (!t5 || t5.disabled) return null;
        if (!opts.ignoreFilters && !this.eventTableActive(t5)) return null;
        if (!opts.forced && (t5.chance ?? 1) < 1 && !this.rng.chance(t5.chance ?? 1)) return null;
        const candidates = [];
        for (const ruleId of t5.rules) {
          const rule = this.campaign.rules[ruleId];
          if (!rule) continue;
          if (rule.once && this.state.fired_rules.includes(rule.id)) continue;
          if (!this.ruleConditionsOk(rule)) continue;
          candidates.push(ruleId);
        }
        if (!candidates.length) return null;
        const picked = candidates[this.rng.int(0, candidates.length - 1)];
        this.pushLog(`\u0421\u043E\u0431\u044B\u0442\u0438\u0435 (${t5.label})\u2026`);
        this.fireRule(picked);
        return picked;
      }
      /** тики: у каждой таблицы свой шаг (tick % interval === 0) */
      tickEventTables() {
        const tables = this.campaign.meta.generators?.event_tables;
        if (!tables?.length) return;
        for (const t5 of tables) {
          if (t5.interval_ticks <= 0) continue;
          if (this.state.tick % t5.interval_ticks !== 0) continue;
          this.rollEventTable(t5.id);
        }
      }
      /** взвешенный выбор из списка генератора (`genPick` используется и из ink) */
      genPickWeighted(items, rand) {
        if (!items.length) return null;
        let total = 0;
        for (const it2 of items) total += Math.max(0, it2.weight ?? 1);
        if (total <= 0) return items[0].value;
        let roll = rand() * total;
        for (const it2 of items) {
          roll -= Math.max(0, it2.weight ?? 1);
          if (roll <= 0) return it2.value;
        }
        return items[items.length - 1].value;
      }
      /** найти определение генератора (любого вида) по id или id списка */
      genDef(generatorId) {
        const g2 = this.campaign.meta.generators;
        if (!g2) return void 0;
        return g2.npc?.find((x2) => x2.id === generatorId) ?? g2.scenes?.find((x2) => x2.id === generatorId) ?? g2.adventures?.find((x2) => x2.id === generatorId);
      }
      /**
       * Значение из списка генератора. `key` — ключ списка; компоновка имени —
       * ключ `name` (через gen.name части). seed — стабильная строка: тот же
       * seed+key даёт то же значение. Без seed — игровой PRNG.
       */
      genValue(generatorId, key, seed) {
        const def = this.genDef(generatorId);
        if (!def) return "";
        const rand = seed ? this.seedRand(`${seed}:${generatorId}:${key}`) : () => this.rng.next();
        if (key === "name") {
          const nameGen = this.campaign.meta.generators?.npc?.find((x2) => x2.id === generatorId);
          if (nameGen?.name?.length) return this.composeGenName(nameGen, rand);
        }
        if (key.startsWith("goal:")) {
          const adv = this.campaign.meta.generators?.adventures?.find((x2) => x2.id === generatorId);
          const idx = parseInt(key.slice(5), 10);
          const template = adv?.goals[idx];
          if (template) return this.expandGenTemplate(template, def.lists, rand);
          return "";
        }
        const list = def.lists[key];
        return list ? this.genPickWeighted(list, rand) ?? "" : "";
      }
      /** детерминированный PRNG из строки (стабильность по seed) */
      seedRand(seed) {
        let h2 = 2166136261 >>> 0;
        for (let i2 = 0; i2 < seed.length; i2++) {
          h2 ^= seed.charCodeAt(i2);
          h2 = Math.imul(h2, 16777619) >>> 0;
        }
        let x2 = h2 || 1;
        return () => {
          x2 ^= x2 << 13;
          x2 >>>= 0;
          x2 ^= x2 >> 17;
          x2 ^= x2 << 5;
          x2 >>>= 0;
          return x2 / 4294967296;
        };
      }
      /** компоновка имени из частей (список/литерал) */
      composeGenName(gen, rand) {
        if (!gen.name?.length) return "";
        return gen.name.map((p2) => {
          if (p2.literal != null) return p2.literal;
          const list = gen.lists[p2.list ?? ""];
          return list ? this.genPickWeighted(list, rand) ?? "" : "";
        }).filter(Boolean).join("").trim();
      }
      /** подстановка {list:key} в шаблон (цели приключений и слоты сцен) */
      expandGenTemplate(template, lists, rand) {
        return template.replace(/\{(?:list|список):([^\s{}]+)\}/g, (_m, key) => {
          const list = lists[key];
          return list ? this.genPickWeighted(list, rand) ?? "" : "";
        });
      }
      // ─────────────── сохранение ───────────────
      /**
       * Автосейв: состояние пишется в обёртке (`SaveEnvelope`) вместе с версией
       * кампании и версией движка — без этого нельзя ни перенести сейв, ни
       * объяснить игроку, почему он не подошёл после обновления.
       */
      /** выбранный игроком уровень сложности (мастерские пресеты meta.difficulties) с накруткой круга New Game+ */
      difficultyDef() {
        const list = this.campaign.meta.difficulties;
        if (!list?.length) return null;
        const base = list.find((d2) => d2.id === this.state.player.difficulty) ?? list[0];
        const cycle = this.state.ng_cycle ?? 0;
        const boost = this.campaign.meta.new_game_plus?.boost;
        if (!cycle || !boost) return base;
        const withStep = (v2, step) => v2 === void 0 || !step ? v2 : Math.round(v2 * (1 + step * cycle) * 100) / 100;
        return {
          ...base,
          enemy_damage: withStep(base.enemy_damage, boost.enemy_damage_step),
          need_decay: withStep(base.need_decay, boost.need_decay_step),
          prices: withStep(base.prices, boost.prices_step)
        };
      }
      autosave() {
        if (this.state.game_over) return;
        if (this.difficultyDef()?.no_autosave) return;
        this.envelope = writeSave(this.campaign.meta.id, this.state, this.campaign.meta.version, this.envelope ?? void 0) ?? this.envelope;
      }
      /**
       * Ручной сейв в слот игрока (аудит §5.6 п.9): перезаписывает слот.
       * Пермадет стирает автосейв, ручные слоты переживают забег — честный
       * «снимок на всякий случай», если мастер их не запретил (meta.save_slots).
       */
      manualSave(slot) {
        if (this.state.game_over) return false;
        const env = writeSave(this.campaign.meta.id, this.state, this.campaign.meta.version, void 0, slot);
        if (env) {
          this.pushLog(`\u0421\u043B\u043E\u0442 ${slot}: \u0437\u0430\u0431\u0435\u0433 \u0437\u0430\u043F\u0438\u0441\u0430\u043D.`);
          this.notify();
        }
        return env !== null;
      }
      /** сколько ручных слотов показывать игроку (мастер; умолчание 3) */
      saveSlotsCount() {
        return Math.max(0, Math.min(MAX_SAVE_SLOTS, this.campaign.meta.save_slots ?? 3));
      }
    };
  }
});

// scripts/playkit/cli.mts
var import_seedrandom3 = __toESM(require_seedrandom2(), 1);
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";

// src/core/loader.ts
init_migrate();

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
    const clean = tables.filter((t5) => !!t5 && typeof t5 === "object" && typeof t5.id === "string");
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

// src/core/loader.ts
init_versions();
async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C ${url}: ${res.status}`);
  return res.json();
}
async function getText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C ${url}: ${res.status}`);
  return res.text();
}
async function loadCampaign(basePath) {
  const [meta, world, manifest] = await Promise.all([
    getJSON(`${basePath}/campaign.json`),
    getJSON(`${basePath}/world.json`),
    getJSON(`${basePath}/manifest.json`)
  ]);
  const pkg = checkPackage(meta.package_format);
  if (!pkg.ok) throw new Error(pkg.message);
  const engine = checkEngine(meta.min_engine ?? meta.engine_version);
  if (!engine.ok) console.warn(`[chronicle] ${engine.message}`);
  const scenes = {};
  const entities = {};
  const rules = {};
  const arenas = {};
  const quests = {};
  const encounters = {};
  const cutscenes = {};
  const recipes = {};
  const codex = {};
  const dialogues = {};
  await Promise.all([
    ...(manifest.arenas ?? []).map(async (f2) => {
      const a2 = await getJSON(`${basePath}/arenas/${f2}`);
      arenas[a2.id] = a2;
    }),
    ...(manifest.quests ?? []).map(async (f2) => {
      const q2 = await getJSON(`${basePath}/quests/${f2}`);
      quests[q2.id] = q2;
    }),
    ...(manifest.encounters ?? []).map(async (f2) => {
      let tables;
      try {
        tables = await getJSON(`${basePath}/encounters/${f2}`);
      } catch {
        tables = await getJSON(`${basePath}/rules/${f2}`);
      }
      for (const t5 of tables.encounter_tables) encounters[t5.id] = t5;
    }),
    ...(manifest.cutscenes ?? []).map(async (f2) => {
      const c2 = await getJSON(`${basePath}/cutscenes/${f2}`);
      cutscenes[c2.id] = c2;
    }),
    ...(manifest.recipes ?? []).map(async (f2) => {
      const r2 = await getJSON(`${basePath}/recipes/${f2}`);
      recipes[r2.id] = r2;
    }),
    ...(manifest.codex ?? []).map(async (f2) => {
      const c2 = await getJSON(`${basePath}/codex/${f2}`);
      codex[c2.id] = c2;
    }),
    ...manifest.scenes.map(async (f2) => {
      const s2 = await getJSON(`${basePath}/scenes/${f2}`);
      scenes[s2.id] = s2;
    }),
    ...manifest.entities.map(async (f2) => {
      const e2 = await getJSON(`${basePath}/entities/${f2}`);
      entities[e2.id] = migrateEntity(e2);
    }),
    ...manifest.rules.map(async (f2) => {
      const raw = await getJSON(`${basePath}/rules/${f2}`);
      const verdict = parseRuleFile(f2, raw);
      for (const w2 of verdict.warnings) console.warn(`[chronicle] ${w2}`);
      if (verdict.kind === "rule") {
        if (rules[verdict.rule.id]) {
          console.warn(`[chronicle] rules/${f2}: \u0434\u0443\u0431\u043B\u044C id \xAB${verdict.rule.id}\xBB \u2014 \u0444\u0430\u0439\u043B \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D.`);
          return;
        }
        rules[verdict.rule.id] = verdict.rule;
      } else if (verdict.kind === "encounters") {
        for (const t5 of verdict.tables) encounters[t5.id] = t5;
      }
    }),
    ...manifest.dialogues.map(async (f2) => {
      dialogues[`dialogues/${f2}`] = await getText(`${basePath}/dialogues/${f2}`);
    })
  ]);
  migrateCampaign(meta, world, scenes);
  return { meta, world, scenes, entities, rules, arenas, quests, encounters, cutscenes, recipes, codex, dialogues, basePath };
}

// scripts/playkit/cli.mts
init_engine();
init_prng();

// src/core/charcreate.ts
init_brp();
init_dice();
init_prng();
init_skills();
var STAT_KEYS = ["STR", "CON", "SIZ", "DEX", "INT", "POW", "CHA"];
var screenRng = new PRNG();
function rollStat(creation, stat) {
  const roll = creation.roll;
  const notation = roll?.per_stat?.[stat] ?? roll?.notation ?? "3d6";
  const v2 = rollDice(notation, screenRng);
  const { min, max } = creation.stat_limits;
  return Math.min(max, Math.max(min, v2));
}
function allSkillIds(meta) {
  const reg = (meta.skills ?? []).map((s2) => ({ id: s2.id, label: s2.label || s2.id }));
  return reg.sort((a2, b2) => a2.label.localeCompare(b2.label, "ru"));
}
function prof(creation, choice) {
  return creation.professions?.find((p2) => p2.id === choice.profession);
}
function calling(creation, choice) {
  return creation.callings?.find((c2) => c2.id === choice.calling);
}
function statMin(creation) {
  return creation.stat_limits.min;
}
function skillBaseFloor(creation, id) {
  const floor = creation.skill_floor ?? 0;
  return (creation.mandatory_skills ?? []).includes(id) ? Math.max(floor, 25) : floor;
}
function skillProfBonus(creation, choice, id) {
  return prof(creation, choice)?.skill_bonus[id] ?? 0;
}
function skillMinVal(creation, choice, id) {
  return skillBaseFloor(creation, id) + skillProfBonus(creation, choice, id);
}
function allocateExactBudget(ids, budgetValue, bases, desired, caps, excluded = /* @__PURE__ */ new Set()) {
  const budget = Math.max(0, Math.floor(Number.isFinite(budgetValue) ? budgetValue : 0));
  const values = {};
  const weights = {};
  for (const id of ids) {
    const base = Number.isFinite(bases[id]) ? bases[id] : 0;
    values[id] = base;
    weights[id] = excluded.has(id) ? 0 : Math.max(0, Math.round(Number.isFinite(desired[id]) ? desired[id] : base) - base);
  }
  let remaining = budget;
  while (remaining > 0) {
    const active2 = ids.filter((id) => values[id] < caps[id]);
    if (!active2.length) break;
    const focused = active2.filter((id) => weights[id] > 0);
    const pool = focused.length ? focused : active2;
    const weightOf = (id) => focused.length ? weights[id] : 1;
    const totalWeight = pool.reduce((sum, id) => sum + weightOf(id), 0);
    if (!totalWeight) break;
    let placed = 0;
    const fractions = [];
    for (const id of pool) {
      const share = remaining * weightOf(id) / totalWeight;
      const whole = Math.min(Math.floor(share), Math.max(0, caps[id] - values[id]));
      values[id] += whole;
      placed += whole;
      if (values[id] < caps[id]) fractions.push({ id, fraction: share - Math.floor(share) });
    }
    remaining -= placed;
    if (!remaining) break;
    fractions.sort((a2, b2) => b2.fraction - a2.fraction || ids.indexOf(a2.id) - ids.indexOf(b2.id));
    let remainderPlaced = 0;
    for (const { id } of fractions) {
      if (!remaining) break;
      if (values[id] >= caps[id]) continue;
      values[id]++;
      remaining--;
      remainderPlaced++;
    }
    if (!placed && !remainderPlaced) break;
  }
  return values;
}
function fitStatTemplate(creation, target) {
  const ids = STAT_KEYS.map(String);
  const base = statMin(creation);
  const bases = Object.fromEntries(ids.map((id) => [id, base]));
  const caps = Object.fromEntries(ids.map((id) => [id, Math.max(base, creation.stat_limits.max)]));
  return allocateExactBudget(ids, creation.total_points, bases, target ?? {}, caps);
}
function fitCallingTemplate(creation, choice, ids, target) {
  if (creation.skill_points === void 0) return { ...choice.skills };
  const bases = Object.fromEntries(ids.map((id) => [id, skillMinVal(creation, choice, id)]));
  const defaultCap = Math.max(...Object.values(bases), 0) + Math.max(0, creation.skill_points);
  const caps = Object.fromEntries(ids.map((id) => {
    const base = bases[id];
    const cap = creation.skill_cap ?? defaultCap;
    return [id, (creation.forbidden_skills ?? []).includes(id) ? base : Math.max(base, cap)];
  }));
  return allocateExactBudget(ids, creation.skill_points, bases, target, caps, new Set(creation.forbidden_skills ?? []));
}
function newCharChoice(creation, template, meta) {
  const first = creation.professions?.[0];
  const firstCall = creation.callings?.[0];
  const stats = {};
  if (creation.roll) {
    for (const k2 of STAT_KEYS) stats[k2] = rollStat(creation, k2);
  } else {
    Object.assign(stats, fitStatTemplate(creation, first?.stats));
  }
  const ids = /* @__PURE__ */ new Set([...allSkillIds(meta).map((s2) => s2.id), ...Object.keys(template.skills)]);
  const choice = {
    name: template.label,
    stats,
    profession: first?.id ?? "",
    calling: firstCall?.id ?? "",
    skills: {},
    ...creation.portraits?.[0] ? { portrait: creation.portraits[0].id } : {},
    ...creation.portrait_layers?.length ? { portrait_layers: Object.fromEntries(creation.portrait_layers.filter((l2) => l2.options[0]).map((l2) => [l2.id, l2.options[0].id])) } : {}
  };
  for (const id of ids) choice.skills[id] = skillMinVal(creation, choice, id);
  return withCalling(creation, choice, choice.calling);
}
function withCalling(creation, choice, callingId) {
  const next = { ...choice, calling: callingId, skills: { ...choice.skills } };
  const c2 = calling(creation, next);
  const ids = /* @__PURE__ */ new Set([...Object.keys(next.skills), ...Object.keys(c2?.skills ?? {})]);
  for (const id of ids) {
    const fromCall = c2?.skills?.[id];
    const v2 = fromCall !== void 0 ? fromCall : skillBaseFloor(creation, id);
    next.skills[id] = Math.max(skillMinVal(creation, next, id), Math.round(Number.isFinite(v2) ? v2 : skillMinVal(creation, next, id)));
    const cap = creation.skill_cap;
    if (cap !== void 0 && next.skills[id] > cap) next.skills[id] = cap;
  }
  if (c2 && creation.skill_points !== void 0) {
    next.skills = fitCallingTemplate(creation, next, [...ids], c2.skills);
  }
  return next;
}

// scripts/playkit/cli.mts
init_versions();

// scripts/playkit/analyze.ts
var INK_KNOT = /^[ \t]*={2,}[ \t]*([^\s=][^\n=]*?)[ \t]*=*[ \t]*$/gm;
var INK_FUNCTION_KNOT = /^[ \t]*={2,}[ \t]*function[ \t]+([^\s(]+)/gm;
var INK_DIVERT = /(?:^|[^\w>-])->[ \t]*([^\s<>{}[\](),;]+)/g;
var INK_FLAG_READ = /get_flag\(\s*["']([^"']+)["']\s*\)/g;
var INK_FLAG_WRITE = /(?:set_flag|clear_flag|toggle_flag)\(\s*["']([^"']+)["']/g;
var INK_SCENE_JUMP = /go_to_scene\(\s*["']([^"']+)["']\s*\)/g;
var INK_TELEPORT = /teleport_player\(\s*["']([^"']+)["']/g;
var INK_QUEST_START = /start_quest\(\s*["']([^"']+)["']\s*\)/g;
var INK_QUEST_ADVANCE = /advance_quest\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/g;
var INK_COMBAT = /start_combat\(\s*["']([^"']+)["']\s*\)/g;
var WRITE_FLAG = /* @__PURE__ */ new Set(["set_flag", "clear_flag", "toggle_flag"]);
var READ_FLAG = /* @__PURE__ */ new Set(["flag_set", "flag_not_set"]);
var QUEST_EFFECT = /* @__PURE__ */ new Set(["start_quest", "advance_quest", "fail_quest"]);
var QUEST_CONDITION = /* @__PURE__ */ new Set(["quest_at_stage"]);
var TELEPORT = /* @__PURE__ */ new Set(["teleport_player"]);
var ENTER_CONDITION = /* @__PURE__ */ new Set(["player_enters_scene", "player_enters_location"]);
var START_COMBAT = /* @__PURE__ */ new Set(["start_combat"]);
var START_DIALOGUE = /* @__PURE__ */ new Set(["start_dialogue"]);
function walkCampaign(campaign2) {
  const effects = [];
  const conditions = [];
  const seen = /* @__PURE__ */ new Set();
  const visit = (value, depth) => {
    if (depth > 40 || value === null || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    const type = typeof value.type === "string" ? String(value.type) : "";
    if (WRITE_FLAG.has(type) || QUEST_EFFECT.has(type) || TELEPORT.has(type) || START_COMBAT.has(type) || START_DIALOGUE.has(type)) {
      effects.push(value);
    }
    if (READ_FLAG.has(type) || QUEST_CONDITION.has(type) || ENTER_CONDITION.has(type)) conditions.push(value);
    for (const entry of Object.values(value)) visit(entry, depth + 1);
  };
  visit(campaign2, 0);
  return { effects, conditions };
}
function parseInk(source) {
  const knots = [];
  const functions = [];
  for (const m2 of source.matchAll(INK_KNOT)) {
    const name = m2[1];
    if (/^function\b/.test(name)) continue;
    knots.push(name);
  }
  for (const m2 of source.matchAll(INK_FUNCTION_KNOT)) functions.push(m2[1]);
  const targets = [];
  for (const m2 of source.matchAll(INK_DIVERT)) {
    const name = m2[1];
    if (name === "DONE" || name === "END") continue;
    targets.push(name);
  }
  const defined = /* @__PURE__ */ new Set([...knots, ...functions, "DONE", "END"]);
  const missingTargets = [...new Set(targets.filter((t5) => !defined.has(t5)))];
  const collect = (re2, pick) => [...new Set([...source.matchAll(re2)].map(pick))];
  return {
    knots,
    functions,
    targets: [...new Set(targets)],
    missingTargets,
    flagReads: collect(INK_FLAG_READ, (m2) => m2[1]),
    flagWrites: collect(INK_FLAG_WRITE, (m2) => m2[1]),
    sceneJumps: collect(INK_SCENE_JUMP, (m2) => m2[1]),
    teleports: collect(INK_TELEPORT, (m2) => m2[1]),
    questStarts: collect(INK_QUEST_START, (m2) => m2[1]),
    questAdvances: [...source.matchAll(INK_QUEST_ADVANCE)].map((m2) => [m2[1], m2[2]]),
    combats: collect(INK_COMBAT, (m2) => m2[1])
  };
}
function buildGraph(campaign2, ink) {
  const sceneEdges = /* @__PURE__ */ new Map();
  const locationEdges = /* @__PURE__ */ new Map();
  const sceneHasExit = /* @__PURE__ */ new Map();
  const effectScenes = /* @__PURE__ */ new Set();
  const effectLocations = /* @__PURE__ */ new Set();
  const locationScenes = /* @__PURE__ */ new Map();
  for (const scene of Object.values(campaign2.scenes ?? {})) {
    const out = /* @__PURE__ */ new Set();
    for (const zone of scene.navigation ?? []) {
      if (zone.go_to_scene) out.add(String(zone.go_to_scene));
    }
    sceneEdges.set(String(scene.id), out);
    sceneHasExit.set(
      String(scene.id),
      (scene.navigation ?? []).some((z2) => z2.go_to_scene || z2.open_map)
    );
  }
  for (const region of Object.values(campaign2.world?.regions ?? {})) {
    for (const location of region.locations ?? []) {
      const out = /* @__PURE__ */ new Set();
      for (const conn of location.travel_connections ?? []) out.add(String(conn.to));
      locationEdges.set(String(location.id), out);
      const here = [...location.scenes ?? [], location.arrival_scene].filter(Boolean).map(String);
      locationScenes.set(String(location.id), [...new Set(here)]);
    }
  }
  const { effects } = walkCampaign(campaign2);
  for (const effect of effects) {
    if (effect.type === "teleport_player") {
      if (effect.scene) effectScenes.add(String(effect.scene));
      if (effect.location) effectLocations.add(String(effect.location));
    }
  }
  for (const parsed of ink) {
    for (const sceneId of parsed.sceneJumps) effectScenes.add(sceneId);
    for (const locationId of parsed.teleports) effectLocations.add(locationId);
  }
  return { sceneEdges, locationEdges, sceneHasExit, effectScenes, effectLocations, locationScenes };
}
function collectGraph(campaign2, graph, startScene, startLocation, startRegion) {
  const scenes = new Set(Object.keys(campaign2.scenes ?? {}));
  const locations = /* @__PURE__ */ new Set([...graph.locationEdges.keys()]);
  const reachableScenes = /* @__PURE__ */ new Set();
  const reachableLocations = /* @__PURE__ */ new Set();
  let changed = true;
  const addScene = (id) => {
    if (scenes.has(id) && !reachableScenes.has(id)) {
      reachableScenes.add(id);
      changed = true;
    }
  };
  const addLocation = (id) => {
    if (locations.has(id) && !reachableLocations.has(id)) {
      reachableLocations.add(id);
      changed = true;
    }
  };
  addScene(startScene);
  addLocation(startLocation);
  for (const id of graph.effectScenes) addScene(id);
  for (const id of graph.effectLocations) addLocation(id);
  while (changed) {
    changed = false;
    for (const sceneId of [...reachableScenes]) {
      for (const next of graph.sceneEdges.get(sceneId) ?? []) addScene(next);
      const locationId = campaign2.scenes?.[sceneId]?.location;
      if (locationId) addLocation(String(locationId));
    }
    for (const locationId of [...reachableLocations]) {
      for (const sceneId of graph.locationScenes.get(locationId) ?? []) addScene(sceneId);
      for (const next of graph.locationEdges.get(locationId) ?? []) addLocation(next);
    }
  }
  void startRegion;
  return {
    scenes: { total: scenes.size, reachable: [...reachableScenes].sort(), unreachable: [...scenes].filter((s2) => !reachableScenes.has(s2)).sort() },
    locations: {
      total: locations.size,
      reachable: [...reachableLocations].sort(),
      unreachable: [...locations].filter((l2) => !reachableLocations.has(l2)).sort()
    }
  };
}
function analyzeCampaign(campaign2) {
  const findings = [];
  const meta = campaign2.meta ?? {};
  const dialogues = [];
  const parsedInk = Object.entries(campaign2.dialogues ?? {}).map(([path, source]) => ({
    path,
    parsed: parseInk(String(source))
  }));
  const graph = buildGraph(campaign2, parsedInk.map((d2) => d2.parsed));
  const startScene = String(meta.starting_scene ?? "");
  const startLocation = String(meta.starting_location ?? "");
  const startRegion = String(meta.starting_region ?? "");
  const reachability = collectGraph(campaign2, graph, startScene, startLocation, startRegion);
  for (const { path, parsed } of parsedInk) {
    const problems = [];
    for (const target of parsed.missingTargets) {
      problems.push({
        code: "ink_missing_knot",
        severity: "error",
        message: `\u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u043D\u0430 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0439 \u0443\u0437\u0435\u043B \xAB${target}\xBB`,
        where: path,
        hint: "\u041E\u043F\u0435\u0447\u0430\u0442\u043A\u0430 \u0432 -> \u0438\u043B\u0438 \u0443\u0437\u0435\u043B \u043D\u0435 \u043E\u0431\u044A\u044F\u0432\u043B\u0435\u043D === knot ==="
      });
    }
    if (!parsed.knots.length) {
      problems.push({ code: "ink_no_knots", severity: "error", message: "\u0432 \u0434\u0438\u0430\u043B\u043E\u0433\u0435 \u043D\u0435\u0442 \u043D\u0438 \u043E\u0434\u043D\u043E\u0433\u043E \u0443\u0437\u043B\u0430", where: path });
    }
    for (const sceneId of parsed.sceneJumps) {
      if (sceneId && !campaign2.scenes?.[sceneId]) {
        problems.push({ code: "ink_scene_missing", severity: "error", message: `go_to_scene \u2192 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0430\u044F \u0441\u0446\u0435\u043D\u0430 \xAB${sceneId}\xBB`, where: path });
      }
    }
    for (const arenaId of parsed.combats) {
      if (arenaId && !campaign2.arenas?.[arenaId]) {
        problems.push({ code: "ink_arena_missing", severity: "error", message: `start_combat \u2192 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0430\u044F \u0430\u0440\u0435\u043D\u0430 \xAB${arenaId}\xBB`, where: path });
      }
    }
    for (const [questId, stageId] of parsed.questAdvances) {
      const quest = campaign2.quests?.[questId];
      if (!quest) problems.push({ code: "ink_quest_missing", severity: "error", message: `advance_quest \u2192 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0439 \u043A\u0432\u0435\u0441\u0442 \xAB${questId}\xBB`, where: path });
      else if (!(quest.stages ?? []).some((s2) => s2.id === stageId))
        problems.push({ code: "ink_quest_stage_missing", severity: "error", message: `advance_quest \xAB${questId}\xBB \u2192 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0430\u044F \u0441\u0442\u0430\u0434\u0438\u044F \xAB${stageId}\xBB`, where: path });
    }
    findings.push(...problems);
    dialogues.push({ path, knots: parsed.knots, problems });
  }
  for (const region of Object.values(campaign2.world?.regions ?? {})) {
    for (const location of region.locations ?? []) {
      for (const conn of location.travel_connections ?? []) {
        if (conn.to && !(campaign2.world?.regions ?? []).some((r2) => (r2.locations ?? []).some((l2) => l2.id === conn.to))) {
          findings.push({
            code: "travel_target_missing",
            severity: "error",
            message: `\u0434\u043E\u0440\u043E\u0433\u0430 \u0438\u0437 \xAB${location.id}\xBB \u0432\u0435\u0434\u0451\u0442 \u0432 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0443\u044E \u043B\u043E\u043A\u0430\u0446\u0438\u044E \xAB${conn.to}\xBB`,
            where: "world.json"
          });
        }
      }
      const listed = [...location.scenes ?? [], location.arrival_scene].filter(Boolean);
      for (const sceneId of listed) {
        if (!campaign2.scenes?.[sceneId]) {
          findings.push({
            code: "location_scene_missing",
            severity: "error",
            message: `\u043B\u043E\u043A\u0430\u0446\u0438\u044F \xAB${location.id}\xBB \u0441\u0441\u044B\u043B\u0430\u0435\u0442\u0441\u044F \u043D\u0430 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0443\u044E \u0441\u0446\u0435\u043D\u0443 \xAB${sceneId}\xBB`,
            where: "world.json",
            hint: "\u0421\u0446\u0435\u043D\u0430 \u0443\u0434\u0430\u043B\u0435\u043D\u0430 \u0438\u043B\u0438 \u043F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0430 \u2014 \u0438\u0433\u0440\u043E\u043A \u0443\u0432\u0438\u0434\u0438\u0442 \u043F\u0443\u0441\u0442\u0443\u044E \u043B\u043E\u043A\u0430\u0446\u0438\u044E"
          });
        }
      }
    }
  }
  for (const scene of Object.values(campaign2.scenes ?? {})) {
    if (!graph.sceneHasExit.get(String(scene.id))) {
      const locationId = String(scene.location ?? "");
      const locationHasRoads = (graph.locationEdges.get(locationId)?.size ?? 0) > 0;
      if (!locationHasRoads) {
        findings.push({
          code: "scene_dead_end",
          severity: "warning",
          message: `\u0441\u0446\u0435\u043D\u0430 \xAB${scene.label ?? scene.id}\xBB \u0431\u0435\u0437 \u043D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u0438, \u0438 \u0438\u0437 \u043B\u043E\u043A\u0430\u0446\u0438\u0438 \xAB${locationId}\xBB \u043D\u0435\u0442 \u0434\u043E\u0440\u043E\u0433`,
          where: `scenes/${scene.id}`,
          hint: "\u0418\u0433\u0440\u043E\u043A \u043F\u043E\u043F\u0430\u0434\u0451\u0442 \u0441\u044E\u0434\u0430 \u0438 \u043D\u0435 \u0441\u043C\u043E\u0436\u0435\u0442 \u0432\u044B\u0439\u0442\u0438"
        });
      }
    }
    if (scene.location && !(campaign2.world?.regions ?? []).some((r2) => (r2.locations ?? []).some((l2) => l2.id === scene.location))) {
      findings.push({
        code: "scene_location_missing",
        severity: "error",
        message: `\u0441\u0446\u0435\u043D\u0430 \xAB${scene.label ?? scene.id}\xBB \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D\u0430 \u043A \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0435\u0439 \u043B\u043E\u043A\u0430\u0446\u0438\u0438 \xAB${scene.location}\xBB`,
        where: `scenes/${scene.id}`
      });
    }
    for (const zone of scene.navigation ?? []) {
      if (zone.go_to_scene && !campaign2.scenes?.[zone.go_to_scene]) {
        findings.push({
          code: "nav_scene_missing",
          severity: "error",
          message: `\u043F\u0435\u0440\u0435\u0445\u043E\u0434 \xAB${zone.label ?? zone.id ?? "?"}\xBB \u0432\u0435\u0434\u0451\u0442 \u0432 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0443\u044E \u0441\u0446\u0435\u043D\u0443 \xAB${zone.go_to_scene}\xBB`,
          where: `scenes/${scene.id}`
        });
      }
      if (zone.intercept_dialogue && !campaign2.entities?.[zone.intercept_dialogue]) {
        findings.push({
          code: "nav_intercept_missing",
          severity: "error",
          message: `\u043F\u0435\u0440\u0435\u0445\u0432\u0430\u0442 \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0430 \u0441\u0441\u044B\u043B\u0430\u0435\u0442\u0441\u044F \u043D\u0430 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0443\u044E \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C \xAB${zone.intercept_dialogue}\xBB`,
          where: `scenes/${scene.id}`
        });
      }
      if (zone.intercept_rule && !campaign2.rules?.[zone.intercept_rule]) {
        findings.push({
          code: "nav_rule_missing",
          severity: "error",
          message: `\u043F\u0435\u0440\u0435\u0445\u0432\u0430\u0442 \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0430 \u0441\u0441\u044B\u043B\u0430\u0435\u0442\u0441\u044F \u043D\u0430 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0435\u0435 \u043F\u0440\u0430\u0432\u0438\u043B\u043E \xAB${zone.intercept_rule}\xBB`,
          where: `scenes/${scene.id}`
        });
      }
    }
    for (const slot of scene.slots ?? []) {
      if (slot.default_entity && !campaign2.entities?.[slot.default_entity]) {
        findings.push({
          code: "slot_entity_missing",
          severity: "error",
          message: `\u0441\u043B\u043E\u0442 \xAB${slot.label ?? slot.id}\xBB \u043D\u0430\u0437\u043D\u0430\u0447\u0430\u0435\u0442 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0443\u044E \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C \xAB${slot.default_entity}\xBB`,
          where: `scenes/${scene.id}`
        });
      }
      const slotType = Array.isArray(slot.type) ? slot.type : [slot.type];
      if (slotType.includes("person") && !slot.default_entity && !slot.condition) {
        const usedBySchedule = Object.values(campaign2.entities ?? {}).some(
          (entity) => (entity.schedule ?? []).some((entry) => entry.scene === scene.id && entry.slot === slot.id)
        );
        if (!usedBySchedule) {
          findings.push({
            code: "slot_person_empty",
            severity: "info",
            message: `\u0441\u043B\u043E\u0442 \xAB${slot.label ?? slot.id}\xBB \u0434\u043B\u044F \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430 \u0432\u0441\u0435\u0433\u0434\u0430 \u043F\u0443\u0441\u0442: \u043D\u0435\u0442 default_entity \u0438 \u043D\u0438\u043A\u0442\u043E \u043D\u0435 \u043F\u0440\u0438\u0445\u043E\u0434\u0438\u0442 \u043F\u043E \u0440\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u044E`,
            where: `scenes/${scene.id}`
          });
        }
      }
    }
  }
  for (const sceneId of reachability.scenes.unreachable) {
    findings.push({
      code: "scene_unreachable",
      severity: "warning",
      message: `\u0441\u0446\u0435\u043D\u0430 \xAB${campaign2.scenes?.[sceneId]?.label ?? sceneId}\xBB \u043D\u0435\u0434\u043E\u0441\u0442\u0438\u0436\u0438\u043C\u0430 \u043D\u0438 \u043D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u0435\u0439, \u043D\u0438 \u044D\u0444\u0444\u0435\u043A\u0442\u043E\u043C`,
      where: `scenes/${sceneId}`,
      hint: "\u041A\u043E\u043D\u0442\u0435\u043D\u0442 \u0435\u0441\u0442\u044C, \u043D\u043E \u0438\u0433\u0440\u043E\u043A \u0434\u043E \u043D\u0435\u0433\u043E \u043D\u0435 \u0434\u043E\u0439\u0434\u0451\u0442"
    });
  }
  for (const locationId of reachability.locations.unreachable) {
    findings.push({
      code: "location_unreachable",
      severity: "warning",
      message: `\u043B\u043E\u043A\u0430\u0446\u0438\u044F \xAB${locationId}\xBB \u043D\u0435\u0434\u043E\u0441\u0442\u0438\u0436\u0438\u043C\u0430 \u043F\u043E \u0434\u043E\u0440\u043E\u0433\u0430\u043C \u0438 \u0442\u0435\u043B\u0435\u043F\u043E\u0440\u0442\u0430\u043C`,
      where: `world.json`
    });
  }
  const { effects, conditions } = walkCampaign(campaign2);
  for (const effect of effects) {
    if (effect.type === "teleport_player") {
      if (effect.location && !campaign2.world?.regions?.some?.((r2) => (r2.locations ?? []).some((l2) => l2.id === effect.location)) && !reachability.locations.total) {
        findings.push({ code: "teleport_location_missing", severity: "error", message: `teleport_player \u2192 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0430\u044F \u043B\u043E\u043A\u0430\u0446\u0438\u044F \xAB${effect.location}\xBB` });
      }
      if (effect.scene && !campaign2.scenes?.[effect.scene]) {
        findings.push({ code: "teleport_scene_missing", severity: "error", message: `teleport_player \u2192 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0430\u044F \u0441\u0446\u0435\u043D\u0430 \xAB${effect.scene}\xBB` });
      }
    }
    if (effect.type === "start_combat" && effect.arena && !campaign2.arenas?.[effect.arena]) {
      findings.push({ code: "combat_arena_missing", severity: "error", message: `start_combat \u2192 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0430\u044F \u0430\u0440\u0435\u043D\u0430 \xAB${effect.arena}\xBB` });
    }
    if (effect.type === "start_dialogue" && effect.entity && !campaign2.entities?.[effect.entity]) {
      findings.push({ code: "dialogue_entity_missing", severity: "error", message: `start_dialogue \u2192 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0430\u044F \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044C \xAB${effect.entity}\xBB` });
    }
  }
  const flagWrites = /* @__PURE__ */ new Set();
  const flagReads = /* @__PURE__ */ new Set();
  for (const effect of effects) if (WRITE_FLAG.has(effect.type) && effect.flag) flagWrites.add(String(effect.flag));
  for (const condition of conditions) if (READ_FLAG.has(condition.type) && condition.flag) flagReads.add(String(condition.flag));
  for (const { parsed } of parsedInk) {
    for (const flag of parsed.flagWrites) flagWrites.add(flag);
    for (const flag of parsed.flagReads) flagReads.add(flag);
  }
  for (const flag of meta.flags ?? []) flagWrites.add(String(flag.id));
  for (const flag of flagReads) {
    if (!flagWrites.has(flag)) {
      findings.push({
        code: "flag_read_never_written",
        severity: "error",
        message: `\u0444\u043B\u0430\u0433 \xAB${flag}\xBB \u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F, \u043D\u043E \u043D\u0438\u0433\u0434\u0435 \u043D\u0435 \u0432\u044B\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u2014 \u0432\u0435\u0442\u043A\u0430 \u043C\u0435\u0440\u0442\u0432\u0430`,
        hint: "\u041E\u043F\u0435\u0447\u0430\u0442\u043A\u0430 \u0432 \u0438\u043C\u0435\u043D\u0438 \u0444\u043B\u0430\u0433\u0430 \u0438\u043B\u0438 \u0437\u0430\u0431\u044B\u0442 set_flag"
      });
    }
  }
  for (const flag of flagWrites) {
    if (!flagReads.has(flag)) {
      findings.push({
        code: "flag_written_never_read",
        severity: "warning",
        message: `\u0444\u043B\u0430\u0433 \xAB${flag}\xBB \u0432\u044B\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F, \u043D\u043E \u043D\u0438\u0433\u0434\u0435 \u043D\u0435 \u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F`,
        hint: "\u041C\u0451\u0440\u0442\u0432\u044B\u0439 \u0444\u043B\u0430\u0433: \u043B\u0438\u0431\u043E \u0437\u0430\u0431\u044B\u0442 \u043F\u043E\u0442\u0440\u0435\u0431\u0438\u0442\u0435\u043B\u044C, \u043B\u0438\u0431\u043E \u043B\u0438\u0448\u043D\u0438\u0439 \u044D\u0444\u0444\u0435\u043A\u0442"
      });
    }
  }
  for (const quest of Object.values(campaign2.quests ?? {})) {
    const stageIds = new Set((quest.stages ?? []).map((s2) => String(s2.id)));
    const referenced = /* @__PURE__ */ new Set();
    for (const effect of effects) {
      if (effect.type !== "advance_quest" || effect.quest !== quest.id) continue;
      if (effect.stage && !stageIds.has(String(effect.stage))) {
        findings.push({
          code: "quest_stage_missing",
          severity: "error",
          message: `\u043A\u0432\u0435\u0441\u0442 \xAB${quest.label ?? quest.id}\xBB: \u044D\u0444\u0444\u0435\u043A\u0442 \u0432\u0435\u0434\u0451\u0442 \u0432 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0443\u044E \u0441\u0442\u0430\u0434\u0438\u044E \xAB${effect.stage}\xBB`,
          where: `quests/${quest.id}`
        });
      }
      if (effect.stage) referenced.add(String(effect.stage));
    }
    for (const { parsed } of parsedInk) {
      for (const [questId, stageId] of parsed.questAdvances) {
        if (questId !== quest.id) continue;
        referenced.add(stageId);
        if (!stageIds.has(stageId)) {
          findings.push({
            code: "quest_stage_missing",
            severity: "error",
            message: `\u043A\u0432\u0435\u0441\u0442 \xAB${quest.label ?? quest.id}\xBB: ink \u0432\u0435\u0434\u0451\u0442 \u0432 \u043D\u0435\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0443\u044E \u0441\u0442\u0430\u0434\u0438\u044E \xAB${stageId}\xBB`
          });
        }
      }
    }
    for (const stage of quest.stages ?? []) {
      for (const transition of stage.transitions ?? []) {
        if (transition.to) referenced.add(String(transition.to));
      }
    }
    const first = (quest.stages ?? [])[0]?.id;
    for (const stage of quest.stages ?? []) {
      if (String(stage.id) === String(first)) continue;
      if (!referenced.has(String(stage.id)) && !(stage.auto !== void 0)) {
        findings.push({
          code: "quest_stage_unreferenced",
          severity: "info",
          message: `\u043A\u0432\u0435\u0441\u0442 \xAB${quest.label ?? quest.id}\xBB: \u0441\u0442\u0430\u0434\u0438\u044F \xAB${stage.label ?? stage.id}\xBB \u043D\u0438\u0433\u0434\u0435 \u043D\u0435 \u0432\u043A\u043B\u044E\u0447\u0430\u0435\u0442\u0441\u044F \u044D\u0444\u0444\u0435\u043A\u0442\u043E\u043C`,
          where: `quests/${quest.id}`
        });
      }
    }
  }
  const referencedDialogues = /* @__PURE__ */ new Set();
  for (const entity of Object.values(campaign2.entities ?? {})) {
    if (entity.type === "npc" && entity.dialogue) referencedDialogues.add(String(entity.dialogue));
  }
  for (const encounter of Object.values(campaign2.encounters ?? {})) {
    for (const entry of encounter.entries ?? []) {
      if (entry.type === "dialogue" && entry.entity) {
        const npc = campaign2.entities?.[entry.entity];
        if (npc?.dialogue) referencedDialogues.add(String(npc.dialogue));
      }
    }
  }
  const inkPaths = new Set(parsedInk.map((d2) => d2.path));
  for (const ref of referencedDialogues) {
    const normalized = ref.startsWith("dialogues/") ? ref : `dialogues/${ref.replace(/\.ink$/, "")}.ink`;
    if (!inkPaths.has(normalized) && !inkPaths.has(ref)) {
      findings.push({
        code: "dialogue_file_missing",
        severity: "error",
        message: `NPC \u0441\u0441\u044B\u043B\u0430\u0435\u0442\u0441\u044F \u043D\u0430 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0439 \u0434\u0438\u0430\u043B\u043E\u0433 \xAB${ref}\xBB`
      });
    }
  }
  for (const path of inkPaths) {
    if (![...referencedDialogues].some((ref) => ref === path || path.endsWith(ref) || ref.endsWith(path.replace(/^dialogues\//, "")))) {
      findings.push({
        code: "dialogue_orphan",
        severity: "info",
        message: `\u0434\u0438\u0430\u043B\u043E\u0433 \xAB${path}\xBB \u043D\u0438\u043A\u0435\u043C \u043D\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F`,
        hint: "\u041B\u0438\u0431\u043E \u0437\u0430\u0431\u044B\u0442 NPC, \u043B\u0438\u0431\u043E \u0444\u0430\u0439\u043B \u043E\u0441\u0442\u0430\u043B\u0441\u044F \u043E\u0442 \u0443\u0434\u0430\u043B\u0451\u043D\u043D\u043E\u0433\u043E \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430"
      });
    }
  }
  const endings = meta.endings ?? [];
  for (const ending of endings) {
    for (const condition of ending.conditions ?? []) {
      const flag = condition.flag;
      if ((condition.type === "flag_set" || condition.type === "flag_not_set") && flag && !flagWrites.has(flag)) {
        findings.push({
          code: "ending_condition_dead",
          severity: "warning",
          message: `\u043A\u043E\u043D\u0446\u043E\u0432\u043A\u0430 \xAB${ending.label ?? ending.id}\xBB \u0437\u0430\u0432\u0438\u0441\u0438\u0442 \u043E\u0442 \u0444\u043B\u0430\u0433\u0430 \xAB${flag}\xBB, \u043A\u043E\u0442\u043E\u0440\u044B\u0439 \u043D\u0438\u0433\u0434\u0435 \u043D\u0435 \u0432\u044B\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F`,
          where: `campaign.json \u2192 endings`
        });
      }
    }
  }
  const counts = {
    scenes: Object.keys(campaign2.scenes ?? {}).length,
    locations: reachability.locations.total,
    entities: Object.keys(campaign2.entities ?? {}).length,
    dialogues: parsedInk.length,
    inkKnots: parsedInk.reduce((sum, d2) => sum + d2.parsed.knots.length, 0),
    rules: Object.keys(campaign2.rules ?? {}).length,
    quests: Object.keys(campaign2.quests ?? {}).length,
    endings: endings.length,
    arenas: Object.keys(campaign2.arenas ?? {}).length,
    flagsWritten: flagWrites.size,
    flagsRead: flagReads.size
  };
  findings.sort((a2, b2) => severityRank(a2.severity) - severityRank(b2.severity) || a2.code.localeCompare(b2.code));
  return {
    campaign: { id: String(meta.id ?? ""), title: String(meta.title ?? ""), version: String(meta.version ?? "") },
    counts,
    reachability,
    dialogues,
    findings
  };
}
function severityRank(severity) {
  return severity === "error" ? 0 : severity === "warning" ? 1 : 2;
}
function formatGraphReport(report) {
  const counts = report.findings.reduce(
    (acc, finding) => {
      acc[finding.severity] += 1;
      return acc;
    },
    { error: 0, warning: 0, info: 0 }
  );
  const lines = [];
  lines.push(`# \u0413\u0440\u0430\u0444 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \xB7 ${report.campaign.title}`);
  lines.push("");
  lines.push(
    `\u0441\u0446\u0435\u043D ${report.counts.scenes} \xB7 \u043B\u043E\u043A\u0430\u0446\u0438\u0439 ${report.counts.locations} \xB7 \u0434\u0438\u0430\u043B\u043E\u0433\u043E\u0432 ${report.counts.dialogues} (${report.counts.inkKnots} \u0443\u0437\u043B\u043E\u0432) \xB7 \u043A\u0432\u0435\u0441\u0442\u043E\u0432 ${report.counts.quests} \xB7 \u043A\u043E\u043D\u0446\u043E\u0432\u043E\u043A ${report.counts.endings} \xB7 \u0444\u043B\u0430\u0433\u043E\u0432 ${report.counts.flagsWritten}/${report.counts.flagsRead} (\u043F\u0438\u0448\u0443\u0442\u0441\u044F/\u0447\u0438\u0442\u0430\u044E\u0442\u0441\u044F)`
  );
  lines.push("");
  lines.push(`\u041E\u0448\u0438\u0431\u043E\u043A: ${counts.error} \xB7 \u043F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0439: ${counts.warning} \xB7 \u0437\u0430\u043C\u0435\u0442\u043E\u043A: ${counts.info}`);
  lines.push("");
  if (report.findings.length) {
    lines.push("## \u041D\u0430\u0445\u043E\u0434\u043A\u0438");
    lines.push("");
    for (const finding of report.findings) {
      const mark = finding.severity === "error" ? "\u2717" : finding.severity === "warning" ? "!" : "\xB7";
      lines.push(`- ${mark} \`${finding.code}\` ${finding.message}${finding.where ? ` \u2014 \`${finding.where}\`` : ""}`);
      if (finding.hint) lines.push(`  - ${finding.hint}`);
    }
    lines.push("");
  } else {
    lines.push("\u041D\u0430\u0445\u043E\u0434\u043E\u043A \u043D\u0435\u0442.");
    lines.push("");
  }
  const unreachableScenes = report.reachability.scenes.unreachable;
  lines.push("## \u0414\u043E\u0441\u0442\u0438\u0436\u0438\u043C\u043E\u0441\u0442\u044C");
  lines.push("");
  lines.push(
    `\u0421\u0446\u0435\u043D\u044B: ${report.reachability.scenes.reachable.length} \u0438\u0437 ${report.reachability.scenes.total} \u0434\u043E\u0441\u0442\u0438\u0436\u0438\u043C\u044B` + (unreachableScenes.length ? `, \u043D\u0435\u0434\u043E\u0441\u0442\u0438\u0436\u0438\u043C\u044B: ${unreachableScenes.join(", ")}` : "")
  );
  lines.push(
    `\u041B\u043E\u043A\u0430\u0446\u0438\u0438: ${report.reachability.locations.reachable.length} \u0438\u0437 ${report.reachability.locations.total} \u0434\u043E\u0441\u0442\u0438\u0436\u0438\u043C\u044B` + (report.reachability.locations.unreachable.length ? `, \u043D\u0435\u0434\u043E\u0441\u0442\u0438\u0436\u0438\u043C\u044B: ${report.reachability.locations.unreachable.join(", ")}` : "")
  );
  lines.push("");
  return lines.join("\n");
}

// scripts/playkit/cli.mts
var PLAYKIT_VERSION = "0.1.0";
var DEFAULT_ORIGIN = "http://cf-play.local/";
var MAX_FIGHT_STEPS = 200;
function die(message, code = 2) {
  console.error(`cf-play: ${message}`);
  process.exit(code);
}
function sha256(data) {
  return "sha256:" + createHash("sha256").update(data).digest("hex");
}
function stableJson(value) {
  return JSON.stringify(value, (_k, v2) => {
    if (v2 && typeof v2 === "object" && !Array.isArray(v2)) {
      return Object.fromEntries(Object.entries(v2).sort(([a2], [b2]) => a2 < b2 ? -1 : a2 > b2 ? 1 : 0));
    }
    return v2;
  });
}
function parseArgs(argv) {
  const [command, ...rest] = argv;
  const positional = [];
  const flags = {};
  const put = (key, value) => {
    const current = flags[key];
    if (current === void 0) flags[key] = value;
    else if (Array.isArray(current)) current.push(value);
    else flags[key] = [current, value];
  };
  for (let i2 = 0; i2 < rest.length; i2++) {
    const token = rest[i2];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = rest[i2 + 1];
      if (next !== void 0 && !next.startsWith("--")) {
        put(key, next);
        i2++;
      } else {
        put(key, true);
      }
    } else {
      positional.push(token);
    }
  }
  return { command: command ?? "", positional, flags };
}
function flagList(flags, key) {
  const value = flags[key];
  if (value === void 0) return [];
  return (Array.isArray(value) ? value : [value]).map(String);
}
function flagText(flags, key) {
  const value = flags[key];
  if (value === void 0 || value === true) return null;
  return String(Array.isArray(value) ? value[value.length - 1] : value);
}
async function walk(dir, acc = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      await walk(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}
async function logicDigest(dir) {
  const files = (await walk(dir)).filter((f2) => [".json", ".ink", ".dlg"].includes(extname(f2).toLowerCase()));
  files.sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(relative(dir, file).split(sep).join("/"));
    hash.update("\0");
    hash.update(await readFile(file));
    hash.update("\0");
  }
  return "sha256:" + hash.digest("hex");
}
function installShims(campaignDir) {
  const mem = /* @__PURE__ */ new Map();
  globalThis.localStorage = {
    getItem: (k2) => mem.get(k2) ?? null,
    setItem: (k2, v2) => void mem.set(k2, String(v2)),
    removeItem: (k2) => void mem.delete(k2),
    clear: () => mem.clear(),
    key: (i2) => [...mem.keys()][i2] ?? null,
    get length() {
      return mem.size;
    }
  };
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (!url.startsWith(DEFAULT_ORIGIN)) throw new Error(`cf-play: \u0432\u043D\u0435\u0448\u043D\u044F\u044F \u0441\u0435\u0442\u044C \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 (${url})`);
    const rel = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, "");
    const target = resolve(campaignDir, rel);
    if (!target.startsWith(resolve(campaignDir))) throw new Error(`cf-play: \u043F\u0443\u0442\u044C \u0432\u043D\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 (${rel})`);
    return new Response(await readFile(target), { status: 200 });
  };
}
function entityLabel2(entity) {
  if (!entity) return "\u2014";
  return String(entity.label ?? entity.name ?? entity.id ?? "\u2014");
}
function makeObserver(engine, campaign2) {
  let logSeen = 0;
  let combatLogSeen = 0;
  const errorsSeen = /* @__PURE__ */ new Set();
  function combatView() {
    const combat = engine.combat;
    if (!combat) {
      combatLogSeen = 0;
      return null;
    }
    const player = combat.combatants.find((c2) => c2.side === "player" && !c2.dead);
    const reachable2 = player ? [...combat.reachableHexes().keys()] : [];
    const log = combat.log ?? [];
    const fresh = log.slice(combatLogSeen);
    combatLogSeen = log.length;
    return {
      arena: String(combat.arena?.id ?? ""),
      arenaLabel: String(combat.arena?.label ?? combat.arena?.id ?? ""),
      round: Number(combat.round ?? 0),
      playerTurn: !!combat.isPlayerTurn(),
      result: combat.result ? String(combat.result) : null,
      units: combat.combatants.map((c2) => ({
        id: String(c2.id),
        label: String(c2.label ?? c2.id),
        side: String(c2.side),
        hp: Number(c2.hp ?? 0),
        max_hp: Number(c2.maxHp ?? c2.hp ?? 0),
        dead: !!c2.dead,
        c: Number(c2.hex?.c ?? 0),
        r: Number(c2.hex?.r ?? 0),
        distance: player ? Number(combat.hexDistance?.(player.hex, c2.hex) ?? 0) : 0
      })),
      reachable: reachable2.slice(0, 40),
      canFlee: !!combat.canFlee?.(),
      log: fresh
    };
  }
  return function observe(step) {
    const state = engine.state;
    const scene = engine.currentScene();
    const region = engine.findRegion(state.region);
    const location = engine.findLocation(state.location)?.location;
    const occupants = engine.slotOccupants(scene).filter((o2) => o2.entity).map((o2) => {
      const entity = o2.entity;
      const isNpc = entity.type === "npc";
      const talkable = isNpc && !!entity.dialogue;
      return {
        slot: String(o2.slot?.id ?? ""),
        entity: String(entity.id ?? ""),
        label: entityLabel2(entity),
        kind: String(entity.type ?? ""),
        action: talkable ? "talk" : isNpc ? "inspect" : "use"
      };
    });
    const exits = region ? engine.visibleLocations(region).filter((l2) => l2.id !== state.location).map((l2) => ({ location: String(l2.id), label: String(l2.label ?? l2.id), cost: engine.travelCost(l2.id) })).filter((l2) => l2.cost !== null) : [];
    const dialogueUI = engine.dialogue;
    const dialogue = dialogueUI ? {
      npc: String(dialogueUI.npc?.id ?? ""),
      npcLabel: entityLabel2(dialogueUI.npc),
      lines: dialogueUI.lines.map((l2) => ({
        speaker: String(l2.action ? "" : l2.speaker || dialogueUI.npc?.label || ""),
        text: String(l2.text ?? ""),
        action: !!l2.action
      })),
      choices: dialogueUI.choices.map((c2) => ({ index: Number(c2.index), text: String(c2.text) })),
      finished: !!dialogueUI.finished
    } : null;
    const log = state.log ?? [];
    const fresh = log.slice(logSeen);
    logSeen = log.length;
    const errors = [];
    const dlgError = engine.lastDialogueError;
    if (dlgError && !errorsSeen.has(String(dlgError))) {
      errorsSeen.add(String(dlgError));
      errors.push(String(dlgError));
    }
    return {
      step,
      tick: Number(state.tick),
      scene: String(scene?.id ?? state.scene),
      sceneLabel: String(scene?.label ?? ""),
      location: String(state.location),
      locationLabel: String(location?.label ?? ""),
      visible: occupants,
      exits,
      dialogue,
      combat: combatView(),
      hud: {
        hp: Number(state.player?.hp ?? 0),
        max_hp: Number(state.player?.max_hp ?? 0),
        mp: Number(state.player?.mp ?? 0),
        max_mp: Number(state.player?.max_mp ?? 0),
        needs: { ...state.player?.needs ?? {} },
        quests: Object.entries(state.quests ?? {}).map(([id, q2]) => ({
          id,
          label: String(campaign2.quests?.[id]?.label ?? id),
          stage: String(q2?.stage ?? "")
        })),
        inventory: (state.player?.inventory ?? []).map((i2) => ({
          item: String(i2.item ?? ""),
          label: String(campaign2.entities?.[i2.item]?.label ?? i2.item ?? ""),
          quantity: Number(i2.quantity ?? 1)
        }))
      },
      over: state.game_over ? { type: String(state.game_over.type), reason: String(state.game_over.reason ?? ""), ending: state.game_over.ending } : null,
      log: fresh,
      errors
    };
  };
}
function combatAct(engine, action) {
  const combat = engine.combat;
  if (!combat) return { ok: false, detail: "\u0431\u043E\u044F \u043D\u0435\u0442" };
  const kind = String(action.do ?? "").replace(/^combat_/, "");
  if (kind === "attack") {
    const target = combat.combatants.find((c2) => !c2.dead && c2.side === "enemy" && (!action.target || c2.id === action.target));
    if (!target) return { ok: false, detail: "\u043D\u0435\u0442 \u0446\u0435\u043B\u0438" };
    combat.playerAttack(String(target.id));
    return { ok: true, detail: `\u0430\u0442\u0430\u043A\u0430 \u2192 ${target.label}` };
  }
  if (kind === "move") {
    combat.playerMoveTo({ c: Number(action.c), r: Number(action.r) });
    return { ok: true, detail: `\u043F\u0435\u0440\u0435\u043C\u0435\u0449\u0435\u043D\u0438\u0435 \u2192 ${action.c},${action.r}` };
  }
  if (kind === "end_turn") {
    combat.playerEndTurn();
    return { ok: true, detail: "\u043A\u043E\u043D\u0435\u0446 \u0445\u043E\u0434\u0430" };
  }
  if (kind === "flee") {
    combat.playerFlee();
    return { ok: true, detail: "\u043F\u043E\u043F\u044B\u0442\u043A\u0430 \u043E\u0442\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u044F" };
  }
  if (kind === "close") {
    engine.endCombat();
    return { ok: true, detail: "\u044D\u043A\u0440\u0430\u043D \u0431\u043E\u044F \u0437\u0430\u043A\u0440\u044B\u0442 (\xAB\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C\xBB)" };
  }
  if (kind === "item") {
    combat.playerUseItem(String(action.item ?? ""));
    return { ok: true, detail: `\u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u0432 \u0431\u043E\u044E: ${action.item}` };
  }
  if (kind === "ability") {
    combat.useAbility(String(action.ability ?? ""), String(action.target ?? ""));
    return { ok: true, detail: `\u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C ${action.ability}` };
  }
  return { ok: false, detail: `\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E\u0435 \u0431\u043E\u0435\u0432\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \xAB${kind}\xBB` };
}
function fight(engine) {
  const combat = engine.combat;
  if (!combat) return { ok: true, detail: "\u0431\u043E\u044F \u043D\u0435\u0442" };
  let strikes = 0;
  for (let i2 = 0; i2 < MAX_FIGHT_STEPS; i2++) {
    const current = engine.combat;
    if (!current) return { ok: true, detail: `\u0431\u043E\u0439 \u043E\u043A\u043E\u043D\u0447\u0435\u043D (${strikes} \u0430\u0442\u0430\u043A)` };
    if (current.result) {
      engine.endCombat();
      return { ok: true, detail: `\u0431\u043E\u0439 \u043E\u043A\u043E\u043D\u0447\u0435\u043D: ${current.result} (${strikes} \u0430\u0442\u0430\u043A)` };
    }
    if (!current.isPlayerTurn()) {
      current.playerEndTurn();
      continue;
    }
    const target = current.combatants.find((c2) => !c2.dead && c2.side === "enemy");
    if (!target) {
      current.playerEndTurn();
      continue;
    }
    try {
      current.playerAttack(String(target.id));
      strikes++;
    } catch {
      current.playerEndTurn();
    }
  }
  return { ok: false, detail: `\u0431\u043E\u0439 \u043D\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B\u0441\u044F \u0437\u0430 ${MAX_FIGHT_STEPS} \u0448\u0430\u0433\u043E\u0432` };
}
function act(engine, campaign2, action) {
  const kind = String(action.do ?? "");
  if (kind === "fight") return fight(engine);
  if (kind.startsWith("combat_")) return combatAct(engine, action);
  if (kind === "interact") {
    const scene = engine.currentScene();
    const occupants = engine.slotOccupants(scene).filter((o2) => o2.entity);
    const target = occupants.find(
      (o2) => action.entity && String(o2.entity.id) === String(action.entity) || action.slot && String(o2.slot?.id) === String(action.slot)
    );
    if (!target) return { ok: false, detail: `\u0432 \u0441\u0446\u0435\u043D\u0435 \u043D\u0435\u0442 \xAB${action.entity ?? action.slot}\xBB` };
    const done = engine.interactWithSlot(target);
    if (!done && target.entity.type !== "npc") {
      const options = engine.itemInteractOptions(target.entity);
      if (options.length)
        return {
          ok: false,
          menu: true,
          detail: `\u0443 \xAB${entityLabel2(target.entity)}\xBB \u0435\u0441\u0442\u044C \u0432\u044B\u0431\u043E\u0440 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F: ${options.map((o2, i2) => `[${i2}] ${o2.label}`).join(" \xB7 ")} \u2192 interact_option`
        };
    }
    return { ok: !!done, detail: done ? `\u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0441 ${entityLabel2(target.entity)}` : `\u043D\u0435\u0442 \u0440\u0435\u0430\u043A\u0446\u0438\u0438 (${action.entity})` };
  }
  if (kind === "choose") {
    const ui = engine.dialogue;
    if (!ui) return { ok: false, detail: "\u0434\u0438\u0430\u043B\u043E\u0433 \u043D\u0435 \u043E\u0442\u043A\u0440\u044B\u0442" };
    let index = typeof action.index === "number" ? action.index : -1;
    if (index < 0 && action.text) {
      index = ui.choices.findIndex((c2) => String(c2.text) === String(action.text));
    }
    if (index < 0 || index >= ui.choices.length)
      return { ok: false, detail: `\u043D\u0435\u0442 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u0430 ${JSON.stringify(action.index ?? action.text)}` };
    const text = String(ui.choices[index]?.text ?? "");
    engine.chooseDialogueOption(index);
    return { ok: true, detail: `\u0432\u044B\u0431\u043E\u0440: ${text}` };
  }
  if (kind === "interact_option") {
    const scene = engine.currentScene();
    const occupants = engine.slotOccupants(scene).filter((o2) => o2.entity);
    const target = occupants.find((o2) => String(o2.entity.id) === String(action.entity));
    if (!target) return { ok: false, detail: `\u0432 \u0441\u0446\u0435\u043D\u0435 \u043D\u0435\u0442 \xAB${action.entity}\xBB` };
    const options = engine.itemInteractOptions(target.entity);
    const option = options[Number(action.index ?? 0)];
    if (!option) return { ok: false, detail: `\u043D\u0435\u0442 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u0430 ${action.index}` };
    engine.runItemInteract(target.entity, option);
    return { ok: true, detail: `${entityLabel2(target.entity)}: ${option.label}` };
  }
  if (kind === "travel") {
    const to = String(action.to ?? "");
    const cost = engine.travelCost(to);
    if (cost === null) return { ok: false, detail: `\u043D\u0435\u0442 \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0430 \u0432 ${to}` };
    engine.travelTo(to);
    return { ok: true, detail: `\u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u2192 ${to} (${cost} \u0442\u0438\u043A.)` };
  }
  if (kind === "wait") {
    const ticks = Math.max(1, Number(action.ticks ?? 1));
    engine.advanceTicks(ticks);
    return { ok: true, detail: `\u043E\u0436\u0438\u0434\u0430\u043D\u0438\u0435 ${ticks} \u0442\u0438\u043A.` };
  }
  if (kind === "use") {
    const item = String(action.item ?? "");
    if (!engine.hasItem(item)) return { ok: false, detail: `\u043D\u0435\u0442 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 ${item}` };
    engine.useItem(item);
    return { ok: true, detail: `\u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D ${item}` };
  }
  if (kind === "equip") {
    engine.equipItem(String(action.item ?? ""));
    return { ok: true, detail: `\u043D\u0430\u0434\u0435\u0442\u043E ${action.item}` };
  }
  return { ok: false, detail: `\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \xAB${kind}\xBB` };
}
function checkExpectation(engine, expectation) {
  const state = engine.state;
  if (expectation.scene !== void 0) {
    const ok = state.scene === expectation.scene;
    return { name: `scene=${expectation.scene}`, ok, detail: ok ? "" : `\u0441\u0435\u0439\u0447\u0430\u0441 ${state.scene}` };
  }
  if (expectation.flag !== void 0) {
    const ok = !!state.flags[String(expectation.flag)];
    return { name: `flag=${expectation.flag}`, ok, detail: ok ? "" : "\u0444\u043B\u0430\u0433 \u043D\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D" };
  }
  if (expectation.no_flag !== void 0) {
    const ok = !state.flags[String(expectation.no_flag)];
    return { name: `no_flag=${expectation.no_flag}`, ok, detail: ok ? "" : "\u0444\u043B\u0430\u0433 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D" };
  }
  if (expectation.has_item !== void 0) {
    const ok = !!engine.hasItem(String(expectation.has_item));
    return { name: `has_item=${expectation.has_item}`, ok, detail: ok ? "" : "\u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u043D\u0435\u0442" };
  }
  if (expectation.game_over !== void 0) {
    const want = expectation.game_over;
    const ok = want === null ? !state.game_over : state.game_over?.type === want;
    return { name: `game_over=${String(want)}`, ok, detail: ok ? "" : `\u0441\u0435\u0439\u0447\u0430\u0441 ${stableJson(state.game_over)}` };
  }
  if (expectation.tick_at_least !== void 0) {
    const ok = state.tick >= Number(expectation.tick_at_least);
    return { name: `tick>=${expectation.tick_at_least}`, ok, detail: ok ? "" : `\u0442\u0438\u043A ${state.tick}` };
  }
  if (expectation.quest_at_stage !== void 0) {
    const { quest, stage } = expectation.quest_at_stage;
    const ok = state.quests?.[quest]?.stage === stage;
    return { name: `quest ${quest}=${stage}`, ok, detail: ok ? "" : `\u0441\u0435\u0439\u0447\u0430\u0441 ${state.quests?.[quest]?.stage}` };
  }
  return { name: `unknown expectation ${stableJson(expectation)}`, ok: false, detail: "\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430" };
}
function parseInjection(flags) {
  const injection = {
    flags: [],
    variables: [],
    items: [],
    tick: null,
    scene: null,
    hp: null,
    god: false,
    entities: [],
    quests: [],
    weather: null,
    currencies: [],
    skills: []
  };
  for (const entry of flagList(flags, "set")) {
    const [name, raw] = entry.split("=");
    if (!name) continue;
    const value = raw === void 0 ? true : !["0", "false", "no", ""].includes(raw.toLowerCase());
    injection.flags.push([name, value]);
  }
  for (const entry of flagList(flags, "var")) {
    const [name, raw = "0"] = entry.split("=");
    if (!name) continue;
    const num = Number(raw);
    injection.variables.push([name, raw.trim() !== "" && Number.isFinite(num) ? num : raw]);
  }
  for (const entry of flagList(flags, "item")) {
    const [id, raw = "1"] = entry.split(":");
    if (!id) continue;
    injection.items.push([id, Math.max(1, Number(raw) || 1)]);
  }
  const tick = flagText(flags, "tick");
  if (tick !== null && Number.isFinite(Number(tick))) injection.tick = Number(tick);
  injection.scene = flagText(flags, "scene");
  const hp = flagText(flags, "hp");
  if (hp !== null && Number.isFinite(Number(hp))) injection.hp = Number(hp);
  injection.god = !!flags.god;
  for (const entry of flagList(flags, "entity")) {
    const [id, state = ""] = entry.split("=");
    if (id) injection.entities.push([id, state]);
  }
  for (const entry of flagList(flags, "quest")) {
    const [id, stage = ""] = entry.split("=");
    if (id && stage) injection.quests.push([id, stage]);
  }
  injection.weather = flagText(flags, "weather");
  for (const entry of flagList(flags, "currency")) {
    const [id, raw = "0"] = entry.split(":");
    if (id) injection.currencies.push([id, Number(raw) || 0]);
  }
  for (const entry of flagList(flags, "skill")) {
    const [id, raw = "0"] = entry.split("=");
    if (id) injection.skills.push([id, Number(raw) || 0]);
  }
  return injection;
}
function injectionNotes(injection) {
  const notes = [];
  for (const [name, value] of injection.flags) notes.push(`\u0444\u043B\u0430\u0433 ${name}=${value}`);
  for (const [name, value] of injection.variables) notes.push(`\u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u0430\u044F ${name}=${String(value)}`);
  for (const [id, qty] of injection.items) notes.push(`\u043F\u0440\u0435\u0434\u043C\u0435\u0442 ${id}\xD7${qty}`);
  if (injection.tick !== null) notes.push(`\u0442\u0438\u043A \u2192 ${injection.tick}`);
  if (injection.scene) notes.push(`\u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u0432 \u0441\u0446\u0435\u043D\u0443 ${injection.scene}`);
  if (injection.hp !== null) notes.push(`HP \u2192 ${injection.hp}`);
  if (injection.god) notes.push("\u0440\u0435\u0436\u0438\u043C \u0431\u0435\u0441\u0441\u043C\u0435\u0440\u0442\u0438\u044F");
  for (const [id, state] of injection.entities) notes.push(`\u043E\u0431\u043B\u0438\u043A ${id} \u2192 ${state || "\u0441\u0431\u0440\u043E\u0441"}`);
  for (const [id, stage] of injection.quests) notes.push(`\u043A\u0432\u0435\u0441\u0442 ${id} \u2192 ${stage}`);
  if (injection.weather) notes.push(`\u043F\u043E\u0433\u043E\u0434\u0430 \u2192 ${injection.weather}`);
  for (const [id, qty] of injection.currencies) notes.push(`\u0432\u0430\u043B\u044E\u0442\u0430 ${id}+${qty}`);
  for (const [id, value] of injection.skills) notes.push(`\u043D\u0430\u0432\u044B\u043A ${id}=${value}`);
  return notes;
}
function emptyInjection() {
  return {
    flags: [],
    variables: [],
    items: [],
    tick: null,
    scene: null,
    hp: null,
    god: false,
    entities: [],
    quests: [],
    weather: null,
    currencies: [],
    skills: []
  };
}
function isInjected(injection) {
  return injection.flags.length > 0 || injection.variables.length > 0 || injection.items.length > 0 || injection.tick !== null || injection.scene !== null || injection.hp !== null || injection.god;
}
function applyInjection(engine, injection) {
  const state = engine.state;
  for (const [name, value] of injection.flags) {
    if (value) state.flags[name] = true;
    else delete state.flags[name];
  }
  for (const [name, value] of injection.variables) state.variables[name] = value;
  for (const [id, qty] of injection.items) engine.addItem(id, qty, { silent: true });
  if (injection.hp !== null) state.player.hp = Math.max(0, Math.min(state.player.max_hp, injection.hp));
  if (injection.tick !== null) state.tick = Math.max(state.tick, injection.tick);
  if (injection.god) engine.debugInvincible = true;
  for (const [id, state2] of injection.entities) engine.applyEffect({ type: "set_entity_state", entity: id, state: state2 });
  for (const [id, stage] of injection.quests) engine.advanceQuestTo(id, stage);
  if (injection.weather) engine.applyEffect({ type: "set_weather", weather: injection.weather });
  for (const [id, qty] of injection.currencies) {
    state.currencies ??= {};
    state.currencies[id] = Number(state.currencies[id] ?? 0) + qty;
  }
  for (const [id, value] of injection.skills) {
    state.player.skills ??= {};
    state.player.skills[id] = value;
  }
  engine.checkRules();
  if (injection.scene) {
    const target = engine.campaign?.scenes?.[injection.scene];
    if (target?.location && state.current_location !== target.location) {
      state.current_location = target.location;
    }
    engine.goToScene(injection.scene);
  }
}
async function loadEngine(campaignDir, seed, _debug, injection) {
  installShims(campaignDir);
  const campaign2 = await loadCampaign(DEFAULT_ORIGIN);
  const engine = new GameEngine(campaign2);
  engine.rng = new PRNG(seed);
  engine.state.seed = engine.rng.seed;
  const creation = campaign2.meta?.char_creation;
  if (creation) {
    const template = campaign2.entities[campaign2.meta.default_player];
    engine.applyCharCreation(newCharChoice(creation, template, campaign2.meta));
  }
  engine.start();
  applyInjection(engine, injection);
  return { campaign: campaign2, engine, engineVersion: String(ENGINE_VERSION) };
}
function renderTranscript(config, campaign2, engineVersion, digest, steps) {
  const lines = [];
  lines.push(`# \u041F\u0440\u043E\u0433\u043E\u043D cf-play \xB7 ${campaign2.meta.title}`);
  lines.push("");
  lines.push(`- \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u044F: \`${campaign2.meta.id}\` v${campaign2.meta.version}`);
  lines.push(`- \u0434\u0432\u0438\u0436\u043E\u043A: ${engineVersion} \xB7 playkit ${PLAYKIT_VERSION}`);
  lines.push(`- seed: \`${config.seed}\` \xB7 \u043B\u043E\u0433\u0438\u043A\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438: \`${digest.slice(0, 23)}\u2026\``);
  const notes = injectionNotes(config.injection);
  if (notes.length) lines.push(`- **\u043E\u0442\u043B\u0430\u0434\u043E\u0447\u043D\u044B\u0435 \u043F\u0440\u0430\u0432\u043A\u0438:** ${notes.join("; ")}`);
  lines.push("");
  for (const step of steps) {
    const obs = step.observation;
    lines.push(`## ${obs.step}. \u0442\u0438\u043A ${obs.tick} \xB7 ${obs.sceneLabel || obs.scene}`);
    lines.push("");
    if (step.action) lines.push(`**\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435:** ${step.action.detail}`);
    if (obs.dialogue) {
      lines.push("");
      lines.push(`**\u0414\u0438\u0430\u043B\u043E\u0433 \u0441 ${obs.dialogue.npcLabel}:**`);
      for (const line of obs.dialogue.lines) {
        lines.push(line.action ? `- *${line.text}*` : `- **${line.speaker}:** ${line.text}`);
      }
      if (obs.dialogue.choices.length) {
        lines.push("");
        lines.push("**\u0412\u0430\u0440\u0438\u0430\u043D\u0442\u044B:**");
        for (const choice of obs.dialogue.choices) lines.push(`- [${choice.index}] ${choice.text}`);
      }
    }
    if (obs.combat) {
      lines.push("");
      lines.push(`**\u0411\u043E\u0439** (${obs.combat.arenaLabel}, \u0440\u0430\u0443\u043D\u0434 ${obs.combat.round})${obs.combat.result ? ` \u2014 ${obs.combat.result}` : ""}`);
      for (const unit of obs.combat.units) {
        lines.push(`- ${unit.dead ? "\u{1F480} " : ""}${unit.label} [${unit.side}] HP ${unit.hp}/${unit.max_hp} @ ${unit.c}/${unit.r}`);
      }
      if (obs.combat.playerTurn) lines.push(`- \u0432\u0430\u0448 \u0445\u043E\u0434 \xB7 \u0434\u043E\u0441\u0442\u0438\u0436\u0438\u043C\u043E \u043A\u043B\u0435\u0442\u043E\u043A: ${obs.combat.reachable.length}`);
      for (const entry of obs.combat.log) lines.push(`- \u0431\u043E\u0439: ${entry}`);
    }
    for (const entry of obs.log) lines.push(`- \u0436\u0443\u0440\u043D\u0430\u043B: ${entry}`);
    for (const error of obs.errors) lines.push(`- \u26A0\uFE0F \u043E\u0448\u0438\u0431\u043A\u0430: ${error}`);
    lines.push(
      "",
      `\`HP ${obs.hud.hp}/${obs.hud.max_hp} \xB7 MP ${obs.hud.mp}/${obs.hud.max_mp} \xB7 \u0432\u044B\u0445\u043E\u0434\u044B: ${obs.exits.map((e2) => `${e2.label}${e2.cost === null ? "" : ` (${e2.cost})`}`).join(", ") || "\u043D\u0435\u0442"}\``,
      ""
    );
    if (obs.over) lines.push(`**\u0424\u0438\u043D\u0430\u043B:** ${obs.over.type} \u2014 ${obs.over.reason}${obs.over.ending ? ` (${obs.over.ending})` : ""}`, "");
  }
  return lines.join("\n") + "\n";
}
async function writeRun(config, result, steps, engine, campaign2, debug) {
  const transcript = renderTranscript(config, campaign2, result.engine, result.campaign.logicDigest, steps);
  result.hashes.transcript = sha256(transcript);
  const runJson = stableJson({ config: { seed: config.seed, route: result.route, mode: result.mode }, steps });
  result.hashes.run = sha256(runJson);
  if (config.record && result.mode !== "run") {
    const actions = steps.slice(1).map((step) => step.action).filter((action) => !!action).map((action) => {
      const { detail: _detail, ...rest } = action;
      return rest;
    });
    const route = { name: `${result.campaign.id} / \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u043E ${result.mode} seed ${result.seed}`, steps: actions };
    await mkdir(dirname(resolve(config.record)), { recursive: true });
    await writeFile(resolve(config.record), JSON.stringify(route, null, 2) + "\n", "utf8");
  }
  if (config.outDir) {
    await mkdir(config.outDir, { recursive: true });
    await writeFile(join(config.outDir, "transcript.md"), transcript, "utf8");
    await writeFile(join(config.outDir, "run.json"), runJson, "utf8");
    await writeFile(join(config.outDir, "result.json"), JSON.stringify(result, null, 2), "utf8");
    if (debug) await writeFile(join(config.outDir, "state.final.json"), JSON.stringify(engine.state, null, 2), "utf8");
  }
  return transcript;
}
function collectCoverage(engine, campaign2, seen) {
  const allScenes = Object.keys(campaign2.scenes ?? {});
  const allLocations2 = Object.values(campaign2.world?.regions ?? {}).flatMap((r2) => (r2.locations ?? []).map((l2) => l2.id));
  const allDialogues = Object.values(campaign2.entities ?? {}).filter((e2) => e2.type === "npc" && e2.dialogue).map((e2) => e2.id);
  const allEndings = Object.keys(campaign2.meta?.endings ?? {});
  const state = engine.state;
  return {
    scenes: { seen: [...seen.scenes].sort(), missing: allScenes.filter((s2) => !seen.scenes.has(s2)).sort() },
    locations: { seen: [...seen.locations].sort(), missing: allLocations2.filter((l2) => !seen.locations.has(l2)).sort() },
    dialogues: { seen: [...seen.dialogues].sort(), missing: allDialogues.filter((d2) => !seen.dialogues.has(d2)).sort() },
    choices: { seen: [...seen.choices].sort(), total: seen.choices.size },
    endings: { seen: [...seen.endings].sort(), missing: allEndings.filter((e2) => !seen.endings.has(e2)).sort() },
    final: { game_over: state.game_over, tick: state.tick }
  };
}
async function cmdRun(config, script) {
  const { campaign: campaign2, engine, engineVersion } = await loadEngine(config.campaignDir, config.seed, config.debug, config.injection);
  const observe = makeObserver(engine, campaign2);
  const steps = [];
  const assertions = [];
  const seen = { scenes: /* @__PURE__ */ new Set(), locations: /* @__PURE__ */ new Set(), dialogues: /* @__PURE__ */ new Set(), choices: /* @__PURE__ */ new Set(), endings: /* @__PURE__ */ new Set() };
  let status = "ok";
  const record = (step, action, detail) => {
    const observation = observe(step);
    seen.scenes.add(observation.scene);
    seen.locations.add(observation.location);
    if (observation.dialogue) seen.dialogues.add(observation.dialogue.npc);
    if (observation.over?.ending) seen.endings.add(String(observation.over.ending));
    for (const choice of observation.dialogue?.choices ?? []) seen.choices.add(choice.text);
    steps.push({ step, action: action ? { ...action, detail } : null, observation });
    return observation;
  };
  record(0, null, "\u0441\u0442\u0430\u0440\u0442");
  const actions = Array.isArray(script.steps) ? script.steps : Array.isArray(script) ? script : [];
  for (const action of actions) {
    if (action.do === "expect") {
      const check = checkExpectation(engine, action);
      assertions.push(check);
      if (!check.ok) status = "failed";
      continue;
    }
    if (action.do === "snapshot") {
      record(steps.length, action, `\u0441\u043D\u0438\u043C\u043E\u043A: ${action.label ?? ""}`);
      continue;
    }
    const outcome = act(engine, campaign2, action);
    if (!outcome.ok && !outcome.menu) {
      assertions.push({ name: `action:${action.do}`, ok: false, detail: outcome.detail });
      status = "failed";
    }
    const observation = record(steps.length, action, outcome.detail);
    if (observation.errors.length) status = "failed";
    if (observation.over) break;
  }
  if (engine.lastDialogueError) status = "failed";
  const result = {
    playkit: PLAYKIT_VERSION,
    engine: engineVersion,
    campaign: {
      id: String(campaign2.meta.id),
      title: String(campaign2.meta.title),
      version: String(campaign2.meta.version),
      logicDigest: await logicDigest(config.campaignDir)
    },
    seed: config.seed,
    route: config.routeName ?? null,
    mode: "run",
    evidence: isInjected(config.injection) ? "injected" : "honest",
    injected: injectionNotes(config.injection),
    status,
    steps: steps.length,
    assertions,
    stats: engine.state.stats_run ?? {},
    coverage: collectCoverage(engine, campaign2, seen),
    hashes: { transcript: "", run: "" }
  };
  await writeRun(config, result, steps, engine, campaign2, config.debug);
  return result;
}
function chooseAction(rng, observation, mode, visited) {
  const options = [];
  if (observation.combat) {
    if (observation.combat.result) return { do: "combat_close" };
    const enemies = observation.combat.units.filter((u2) => u2.side === "enemy" && !u2.dead);
    for (const enemy of enemies) options.push({ do: "combat_attack", target: enemy.id });
    options.push({ do: "combat_end_turn" });
    if (observation.combat.canFlee) options.push({ do: "combat_flee" });
    return options[Math.floor(rng() * options.length)];
  }
  if (observation.dialogue?.choices?.length) {
    for (const choice of observation.dialogue.choices) options.push({ do: "choose", index: choice.index });
  } else {
    for (const item of observation.visible) {
      if (item.entity && item.action !== "none") options.push({ do: "interact", entity: item.entity });
    }
    for (const exit of observation.exits) options.push({ do: "travel", to: exit.location });
    options.push({ do: "wait", ticks: 1 });
  }
  if (!options.length) return null;
  if (mode === "explore") {
    const fresh = options.find((o2) => o2.do === "travel" && !visited.has(o2.to));
    if (fresh) return fresh;
  }
  return options[Math.floor(rng() * options.length)];
}
async function cmdSearch(config, mode, stepsLimit) {
  const { campaign: campaign2, engine, engineVersion } = await loadEngine(config.campaignDir, config.seed, config.debug, config.injection);
  const rng = (0, import_seedrandom3.default)(`${config.seed}:${mode}`);
  const observe = makeObserver(engine, campaign2);
  const steps = [];
  const seen = { scenes: /* @__PURE__ */ new Set(), locations: /* @__PURE__ */ new Set(), dialogues: /* @__PURE__ */ new Set(), choices: /* @__PURE__ */ new Set(), endings: /* @__PURE__ */ new Set() };
  let status = "ok";
  let stale = 0;
  let lastSignature = "";
  const record = (action, detail) => {
    const observation = observe(steps.length);
    seen.scenes.add(observation.scene);
    seen.locations.add(observation.location);
    if (observation.dialogue) seen.dialogues.add(observation.dialogue.npc);
    if (observation.over?.ending) seen.endings.add(String(observation.over.ending));
    for (const choice of observation.dialogue?.choices ?? []) seen.choices.add(choice.text);
    steps.push({ step: steps.length, action: action ? { ...action, detail } : null, observation });
    const combatSignature = observation.combat ? `${observation.combat.round}/${observation.combat.units.map((u2) => `${u2.id}:${u2.hp}`).join(",")}` : "";
    return `${observation.scene}/${observation.tick}/${observation.hud.hp}/${combatSignature}/${observation.dialogue?.choices?.map((c2) => c2.text).join("|") ?? ""}/${observation.over?.type ?? ""}`;
  };
  lastSignature = record(null, "\u0441\u0442\u0430\u0440\u0442");
  for (let i2 = 0; i2 < stepsLimit; i2++) {
    const observation = steps[steps.length - 1].observation;
    if (observation.over) break;
    const action = chooseAction(rng, observation, mode, seen.locations);
    if (!action) {
      status = "softlock";
      break;
    }
    const outcome = act(engine, campaign2, action);
    if (!outcome.ok) stale++;
    const signature = record(action, outcome.detail);
    const after = steps[steps.length - 1].observation;
    if (after.errors.length) {
      status = "failed";
      break;
    }
    if (signature === lastSignature) stale++;
    else stale = 0;
    lastSignature = signature;
    if (stale > 60) {
      status = "softlock";
      break;
    }
  }
  const result = {
    playkit: PLAYKIT_VERSION,
    engine: engineVersion,
    campaign: {
      id: String(campaign2.meta.id),
      title: String(campaign2.meta.title),
      version: String(campaign2.meta.version),
      logicDigest: await logicDigest(config.campaignDir)
    },
    seed: config.seed,
    route: null,
    mode,
    evidence: isInjected(config.injection) ? "injected" : "honest",
    injected: injectionNotes(config.injection),
    status,
    steps: steps.length,
    assertions: [],
    stats: engine.state.stats_run ?? {},
    coverage: collectCoverage(engine, campaign2, seen),
    hashes: { transcript: "", run: "" }
  };
  await writeRun(config, result, steps, engine, campaign2, config.debug);
  return result;
}
async function cmdCheck(config, seeds, stepsLimit, routesDir) {
  const { campaign: campaign2 } = await loadEngine(config.campaignDir, config.seed, false, emptyInjection());
  const graph = analyzeCampaign(campaign2);
  const errors = graph.findings.filter((finding) => finding.severity === "error");
  const warnings = graph.findings.filter((finding) => finding.severity === "warning");
  const routeFiles = [];
  const dir = routesDir ?? join(config.campaignDir, "routes");
  if (existsSync(dir)) {
    for (const name of await readdir(dir)) if (name.endsWith(".json")) routeFiles.push(join(dir, name));
  }
  const routeRuns = [];
  for (const file of routeFiles.sort()) {
    const script = JSON.parse(await readFile(file, "utf8"));
    const out = config.outDir ? join(config.outDir, "routes", basename(file, ".json")) : null;
    const routeSeed = script.seed === void 0 ? config.seed : String(script.seed);
    const run = await cmdRun({ ...config, seed: routeSeed, outDir: out, routeName: file }, script);
    routeRuns.push({ file, status: run.status, steps: run.steps, assertions: run.assertions, transcript: run.hashes.transcript });
  }
  const sweep = await cmdSweep(
    { ...config, quiet: true, outDir: config.outDir ? join(config.outDir, "sweep") : null },
    seeds,
    stepsLimit
  );
  const sweepResult = sweep.result;
  const visited = /* @__PURE__ */ new Set();
  const seenScenes = sweepResult.coverage?.scenes ?? {};
  for (const scene of seenScenes.seen ?? []) visited.add(String(scene));
  const uncovered = graph.reachability.scenes.reachable.filter((scene) => !visited.has(scene));
  const problems = [];
  if (errors.length) problems.push(`\u0441\u0442\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u043E\u0448\u0438\u0431\u043E\u043A: ${errors.length}`);
  for (const run of routeRuns) if (run.status !== "ok") problems.push(`\u043C\u0430\u0440\u0448\u0440\u0443\u0442 ${run.file}: ${run.status}`);
  if (sweepResult.status !== "ok") problems.push(`sweep: ${sweepResult.status}`);
  const verdict = problems.length ? "failed" : "ok";
  const result = {
    campaign: { id: graph.campaign.id, title: graph.campaign.title },
    verdict,
    problems,
    graph: {
      counts: graph.counts,
      errors: errors.map((finding) => `${finding.code}: ${finding.message}`),
      warnings: warnings.map((finding) => `${finding.code}: ${finding.message}`),
      reachability: graph.reachability
    },
    routes: routeRuns,
    sweep: {
      status: sweepResult.status,
      seeds: sweepResult.stats?.seeds,
      finals: sweepResult.stats?.finals,
      deaths: sweepResult.stats?.deaths
    },
    coverage: { visited: visited.size, total: graph.reachability.scenes.reachable.length, uncovered }
  };
  const text = [];
  text.push(`# \u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \xB7 ${graph.campaign.title}`);
  text.push("");
  text.push(verdict === "ok" ? "\u2713 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u0430" : "\u2717 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0435 \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u0430");
  if (problems.length) {
    text.push("");
    for (const problem of problems) text.push(`- \u2717 ${problem}`);
  }
  text.push("");
  text.push("## \u0421\u0442\u0430\u0442\u0438\u043A\u0430");
  text.push(`${graph.counts.scenes} \u0441\u0446\u0435\u043D \xB7 ${graph.counts.locations} \u043B\u043E\u043A\u0430\u0446\u0438\u0439 \xB7 ${graph.counts.dialogues} \u0434\u0438\u0430\u043B\u043E\u0433\u043E\u0432 \xB7 ${graph.counts.inkKnots} \u0443\u0437\u043B\u043E\u0432 ink`);
  text.push(`\u043E\u0448\u0438\u0431\u043E\u043A ${errors.length} \xB7 \u043F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0439 ${warnings.length}`);
  for (const finding of [...errors, ...warnings].slice(0, 12)) text.push(`- ${finding.code}: ${finding.message}`);
  text.push("");
  text.push("## \u041C\u0430\u0440\u0448\u0440\u0443\u0442\u044B");
  if (!routeFiles.length) text.push(`\u043C\u0430\u0440\u0448\u0440\u0443\u0442\u043E\u0432 \u043D\u0435\u0442 (${dir}) \u2014 \u043F\u0440\u043E\u0433\u043E\u043D \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u043E seed'\u0430\u043C`);
  for (const run of routeRuns) text.push(`- ${basename(run.file)}: ${run.status}, \u0448\u0430\u0433\u043E\u0432 ${run.steps}`);
  text.push("");
  text.push("## \u041C\u0430\u0442\u0440\u0438\u0446\u0430 seed'\u043E\u0432");
  text.push(`seed'\u043E\u0432 ${sweepResult.stats?.seeds ?? 0} \xB7 \u0438\u0441\u0445\u043E\u0434\u044B ${JSON.stringify(sweepResult.stats?.finals ?? {})}`);
  if (Object.keys(sweepResult.stats?.deaths ?? {}).length) {
    text.push(`\u0441\u043C\u0435\u0440\u0442\u0438: ${JSON.stringify(sweepResult.stats?.deaths)}`);
  }
  text.push("");
  text.push("## \u041F\u043E\u043A\u0440\u044B\u0442\u0438\u0435");
  text.push(`\u043F\u043E\u0441\u0435\u0449\u0435\u043D\u043E ${visited.size} \u0438\u0437 ${graph.reachability.scenes.reachable.length} \u0434\u043E\u0441\u0442\u0438\u0436\u0438\u043C\u044B\u0445 \u0441\u0446\u0435\u043D`);
  if (uncovered.length) text.push(`\u043D\u0435 \u043F\u043E\u043A\u0440\u044B\u0442\u043E: ${uncovered.slice(0, 15).join(", ")}${uncovered.length > 15 ? ` \u2026 \u0435\u0449\u0451 ${uncovered.length - 15}` : ""}`);
  if (config.outDir) {
    await mkdir(config.outDir, { recursive: true });
    await writeFile(join(config.outDir, "report.json"), JSON.stringify(result, null, 2), "utf8");
    await writeFile(join(config.outDir, "report.md"), text.join("\n") + "\n", "utf8");
    await writeFile(join(config.outDir, "graph.json"), JSON.stringify(graph, null, 2), "utf8");
    await writeFile(join(config.outDir, "graph.md"), formatGraphReport(graph), "utf8");
  }
  return { result, text: text.join("\n") + "\n" };
}
async function cmdDialogue(config, target, maxDepth, maxNodes) {
  const { campaign: campaign2, engine } = await loadEngine(config.campaignDir, config.seed, true, config.injection);
  const { GameEngine: GameEngine2 } = await Promise.resolve().then(() => (init_engine(), engine_exports));
  let npcId = target;
  if (!campaign2.entities?.[npcId] || campaign2.entities[npcId].type !== "npc") {
    const found = Object.values(campaign2.entities ?? {}).find(
      (entity) => entity.type === "npc" && String(entity.dialogue ?? "") === target
    );
    if (!found) throw new Error(`\u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D NPC \u0438\u043B\u0438 \u0434\u0438\u0430\u043B\u043E\u0433 \xAB${target}\xBB`);
    npcId = String(found.id);
  }
  const npc = campaign2.entities[npcId];
  const baseState = JSON.parse(JSON.stringify(engine.state));
  const baseFlags = { ...baseState.flags ?? {} };
  const baseQuests = Object.fromEntries(Object.entries(baseState.quests ?? {}).map(([id, q2]) => [id, String(q2?.stage ?? "")]));
  const branches = [];
  const seenFlags = /* @__PURE__ */ new Set();
  const queue2 = [{ path: [], chosen: [] }];
  let truncated = false;
  while (queue2.length) {
    if (branches.length >= maxNodes) {
      truncated = true;
      break;
    }
    const item = queue2.shift();
    const state = JSON.parse(JSON.stringify(baseState));
    const probe = new GameEngine2(campaign2, state);
    const lines2 = [];
    const errors = [];
    const pushLine = (speaker, text) => {
      const last = lines2[lines2.length - 1];
      if (last && last.text === text && last.speaker === speaker) return;
      lines2.push({ speaker, text });
    };
    try {
      probe.startDialogue(npcId);
    } catch (error) {
      errors.push(String(error?.message ?? error));
    }
    if (probe.lastDialogueError) errors.push(String(probe.lastDialogueError));
    for (const index of item.path) {
      if (!probe.dialogue) break;
      probe.chooseDialogueOption(index);
      if (probe.lastDialogueError && !errors.includes(String(probe.lastDialogueError))) {
        errors.push(String(probe.lastDialogueError));
      }
    }
    for (const line of probe.dialogueHistory ?? []) {
      pushLine(String(line.speaker ?? npc.label ?? ""), String(line.text ?? ""));
    }
    const ui = probe.dialogue;
    for (const line of ui?.lines ?? []) {
      if (line.action) continue;
      pushLine(String(line.speaker ?? npc.label ?? ""), String(line.text ?? ""));
    }
    const flags = Object.fromEntries(
      Object.entries(probe.state.flags ?? {}).filter(([name, value]) => !baseFlags[name] && value)
    );
    for (const name of Object.keys(flags)) seenFlags.add(name);
    const quests = Object.fromEntries(
      Object.entries(probe.state.quests ?? {}).map(([id, q2]) => [id, String(q2?.stage ?? "")]).filter(([id, stage]) => baseQuests[id] !== stage)
    );
    const choices = ui ? (ui.choices ?? []).map((choice) => String(choice.text)) : [];
    branches.push({
      path: item.path,
      lines: lines2,
      choices,
      chosen: item.chosen,
      flags,
      quests,
      combat: probe.combat ? String(probe.combat.arena?.id ?? "combat") : null,
      over: probe.state.game_over ? `${probe.state.game_over.type}: ${probe.state.game_over.reason ?? ""}` : null,
      closed: !ui && !probe.combat && !probe.state.game_over,
      errors
    });
    if (ui && choices.length && item.path.length < maxDepth) {
      for (let index = 0; index < choices.length; index++) {
        queue2.push({ path: [...item.path, index], chosen: [...item.chosen, choices[index]] });
      }
    }
  }
  const uniqueLines = new Set(branches.flatMap((branch) => branch.lines.map((line) => line.text))).size;
  const uniqueChoices = new Set(branches.flatMap((branch) => branch.choices)).size;
  const report = {
    npc: npcId,
    npcLabel: String(npc.label ?? npcId),
    dialogue: String(npc.dialogue ?? ""),
    branches: branches.length,
    maxDepth,
    truncated,
    uniqueLines,
    uniqueChoices,
    flags: [...seenFlags].sort(),
    closedWithoutEffect: branches.filter((branch) => branch.closed).length,
    errors: [...new Set(branches.flatMap((branch) => branch.errors))],
    paths: branches.map((branch) => ({
      chosen: branch.chosen,
      choicesLeft: branch.choices.length,
      flags: branch.flags,
      quests: branch.quests,
      combat: branch.combat,
      over: branch.over
    }))
  };
  const lines = [];
  lines.push(`# \u0420\u0430\u0437\u0431\u043E\u0440 \u0434\u0438\u0430\u043B\u043E\u0433\u0430 \xB7 ${report.npcLabel}`);
  lines.push("");
  lines.push(`\u0444\u0430\u0439\u043B \`${report.dialogue}\` \xB7 \u0432\u0435\u0442\u0432\u0435\u0439 ${report.branches} \xB7 \u0440\u0435\u043F\u043B\u0438\u043A ${report.uniqueLines} \xB7 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432 ${report.uniqueChoices}`);
  if (truncated) lines.push("");
  if (truncated) lines.push("> \u043E\u0431\u0445\u043E\u0434 \u043E\u0431\u0440\u0435\u0437\u0430\u043D \u043F\u043E \u043B\u0438\u043C\u0438\u0442\u0443 \u0432\u0435\u0442\u0432\u0435\u0439; \u0443\u0432\u0435\u043B\u0438\u0447\u044C\u0442\u0435 --max-nodes");
  if (report.errors.length) {
    lines.push("", "## \u041E\u0448\u0438\u0431\u043A\u0438");
    for (const error of report.errors) lines.push(`- \u2717 ${error}`);
  }
  const flagLine = report.flags.length ? report.flags.join(", ") : "\u043D\u0435\u0442";
  lines.push("", `**\u0424\u043B\u0430\u0433\u0438, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0432\u044B\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442 \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440:** ${flagLine}`);
  lines.push("", "## \u0412\u0435\u0442\u0432\u0438");
  for (const branch of branches) {
    const path = branch.chosen.length ? branch.chosen.join(" \u2192 ") : "(\u043D\u0430\u0447\u0430\u043B\u043E)";
    lines.push("");
    lines.push(`### ${path}`);
    for (const line of branch.lines.slice(0, 12)) lines.push(`- ${line.speaker ? `**${line.speaker}:** ` : ""}${line.text}`);
    if (branch.lines.length > 12) lines.push(`- \u2026 \u0435\u0449\u0451 ${branch.lines.length - 12} \u0440\u0435\u043F\u043B\u0438\u043A`);
    if (branch.choices.length) lines.push(`- \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u044B: ${branch.choices.map((choice) => `\xAB${choice}\xBB`).join(" \xB7 ")}`);
    if (Object.keys(branch.flags).length) lines.push(`- \u0444\u043B\u0430\u0433\u0438: ${Object.keys(branch.flags).join(", ")}`);
    if (Object.keys(branch.quests).length) lines.push(`- \u043A\u0432\u0435\u0441\u0442\u044B: ${Object.entries(branch.quests).map(([id, stage]) => `${id}\u2192${stage}`).join(", ")}`);
    if (branch.combat) lines.push(`- \u0431\u043E\u0439: ${branch.combat}`);
    if (branch.over) lines.push(`- \u0444\u0438\u043D\u0430\u043B: ${branch.over}`);
    if (branch.closed) lines.push("- \u0434\u0438\u0430\u043B\u043E\u0433 \u0437\u0430\u043A\u0440\u044B\u043B\u0441\u044F \u0431\u0435\u0437 \u043F\u043E\u0441\u043B\u0435\u0434\u0441\u0442\u0432\u0438\u0439 (\u043D\u0435\u0442 \u0431\u043E\u044F, \u0444\u0438\u043D\u0430\u043B\u0430 \u0438 \u043D\u043E\u0432\u044B\u0445 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432)");
  }
  return { branches, report, text: lines.join("\n") + "\n" };
}
async function cmdSweep(config, seeds, stepsLimit) {
  const runs = [];
  const scenes = /* @__PURE__ */ new Set();
  const locations = /* @__PURE__ */ new Set();
  const dialogues = /* @__PURE__ */ new Set();
  const endings = /* @__PURE__ */ new Set();
  const deaths = {};
  const finals = {};
  for (let seed = seeds[0]; seed <= seeds[1]; seed++) {
    const one = await cmdSearch(
      { ...config, seed: String(seed), outDir: config.outDir ? join(config.outDir, `seed-${seed}`) : null },
      "explore",
      stepsLimit
    );
    runs.push(one);
    for (const scene of one.coverage.scenes.seen) scenes.add(String(scene));
    for (const location of one.coverage.locations.seen) locations.add(String(location));
    for (const dialogue of one.coverage.dialogues.seen) dialogues.add(String(dialogue));
    for (const ending of one.coverage.endings.seen) endings.add(String(ending));
    const over = one.coverage.final?.game_over;
    const key = over ? `${over.type}: ${over.reason ?? ""}` : "\u043D\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D";
    finals[over?.type ?? "open"] = (finals[over?.type ?? "open"] ?? 0) + 1;
    if (over?.type === "death") deaths[key] = (deaths[key] ?? 0) + 1;
    if (!config.quiet) console.log(`seed ${seed}: ${one.status}, \u0448\u0430\u0433\u043E\u0432 ${one.steps}, \u0444\u0438\u043D\u0430\u043B ${over?.type ?? "\u2014"}`);
  }
  const bad = runs.filter((run) => run.status !== "ok");
  const first = runs[0];
  const result = {
    ...first,
    mode: "sweep",
    status: bad.length ? "failed" : "ok",
    steps: runs.reduce((sum, run) => sum + run.steps, 0),
    assertions: bad.map((run) => ({ name: `seed ${run.seed}`, ok: false, detail: run.status })),
    stats: {
      seeds: runs.length,
      ok: runs.length - bad.length,
      failed: bad.length,
      finals,
      deaths
    },
    hashes: { transcript: "", run: "" }
  };
  const lines = [];
  lines.push(`# \u041E\u0431\u0437\u043E\u0440 \u043F\u0440\u043E\u0433\u043E\u043D\u043E\u0432 \xB7 ${first.campaign.title}`);
  lines.push("");
  lines.push(`seed'\u043E\u0432 ${runs.length} \xB7 \u0443\u0441\u043F\u0435\u0448\u043D\u044B\u0445 ${runs.length - bad.length} \xB7 \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u043D\u044B\u0445 ${bad.length} \xB7 \u0434\u0432\u0438\u0436\u043E\u043A ${first.engine}`);
  lines.push("");
  lines.push(`\u041F\u043E\u0441\u0435\u0449\u0435\u043D\u043E \u0441\u0446\u0435\u043D: ${scenes.size} \xB7 \u043B\u043E\u043A\u0430\u0446\u0438\u0439: ${locations.size} \xB7 \u0434\u0438\u0430\u043B\u043E\u0433\u043E\u0432: ${dialogues.size} \xB7 \u043A\u043E\u043D\u0446\u043E\u0432\u043E\u043A: ${endings.size}`);
  lines.push("");
  lines.push("## \u0418\u0441\u0445\u043E\u0434\u044B");
  for (const [type, count] of Object.entries(finals).sort((a2, b2) => b2[1] - a2[1])) lines.push(`- ${type}: ${count}`);
  if (Object.keys(deaths).length) {
    lines.push("", "## \u041F\u0440\u0438\u0447\u0438\u043D\u044B \u0441\u043C\u0435\u0440\u0442\u0438");
    for (const [reason, count] of Object.entries(deaths).sort((a2, b2) => b2[1] - a2[1])) lines.push(`- ${reason}: ${count}`);
  }
  if (endings.size) lines.push("", `\u041A\u043E\u043D\u0446\u043E\u0432\u043A\u0438: ${[...endings].join(", ")}`);
  if (bad.length) {
    lines.push("", "## \u041F\u0440\u043E\u0431\u043B\u0435\u043C\u043D\u044B\u0435 \u043F\u0440\u043E\u0433\u043E\u043D\u044B");
    for (const run of bad) lines.push(`- seed ${run.seed}: ${run.status}`);
  }
  if (config.outDir) {
    await mkdir(config.outDir, { recursive: true });
    await writeFile(join(config.outDir, "sweep.json"), JSON.stringify(result, null, 2), "utf8");
    await writeFile(join(config.outDir, "sweep.md"), lines.join("\n") + "\n", "utf8");
  }
  return { result, text: lines.join("\n") + "\n" };
}
async function cmdVerify(dir, expectEngine, honestOnly) {
  const resultRaw = await readFile(join(dir, "result.json"), "utf8");
  const transcript = await readFile(join(dir, "transcript.md"), "utf8");
  const runRaw = await readFile(join(dir, "run.json"), "utf8");
  const result = JSON.parse(resultRaw);
  const failures = [];
  if (sha256(transcript) !== result.hashes.transcript) failures.push("transcript.md \u043D\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u0435\u0442 \u0441 \u0445\u0435\u0448\u0435\u043C \u0432 result.json");
  if (sha256(runRaw) !== result.hashes.run) failures.push("run.json \u043D\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u0435\u0442 \u0441 \u0445\u0435\u0448\u0435\u043C \u0432 result.json");
  if (expectEngine && result.engine !== expectEngine) failures.push(`\u0434\u0432\u0438\u0436\u043E\u043A ${result.engine} \u2260 \u043E\u0436\u0438\u0434\u0430\u0435\u043C\u043E\u0433\u043E ${expectEngine}`);
  if (result.status !== "ok") failures.push(`\u0441\u0442\u0430\u0442\u0443\u0441 \u043F\u0440\u043E\u0433\u043E\u043D\u0430: ${result.status}`);
  if (honestOnly && result.evidence === "injected") failures.push("\u043F\u0440\u043E\u0433\u043E\u043D \u0441 \u043E\u0442\u043B\u0430\u0434\u043E\u0447\u043D\u044B\u043C\u0438 \u043F\u0440\u0430\u0432\u043A\u0430\u043C\u0438 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F \u043D\u0435 \u0433\u043E\u0434\u0438\u0442\u0441\u044F \u043A\u0430\u043A \u043F\u0440\u0438\u0451\u043C\u043A\u0430 (--honest)");
  if (failures.length) {
    for (const f2 of failures) console.error(`\u2717 ${f2}`);
    return 1;
  }
  console.log(`\u2713 \u043F\u0440\u043E\u0433\u043E\u043D \u0446\u0435\u043B: ${result.campaign.id} seed ${result.seed}, \u0434\u0432\u0438\u0436\u043E\u043A ${result.engine}, \u0448\u0430\u0433\u043E\u0432 ${result.steps}`);
  return 0;
}
var USAGE = [
  "\u043A\u043E\u043C\u0430\u043D\u0434\u044B: check | graph | dialogue | run | explore | sweep | verify",
  "",
  "  node cf-play.mjs check    <\u043F\u0430\u043F\u043A\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438> [--seeds 1-5] [--steps 300] [--routes dir] [--out runs/check]",
  "",
  "  node cf-play.mjs graph    <\u043F\u0430\u043F\u043A\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438> [--out dir] [--json]",
  "  node cf-play.mjs dialogue <\u043F\u0430\u043F\u043A\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438> <npcId|dialogues/x.ink> [--depth 3] [--max-nodes 40]",
  "  node cf-play.mjs run      <\u043F\u0430\u043F\u043A\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438> --seed 42 --script route.json --out runs/a",
  "  node cf-play.mjs explore  <\u043F\u0430\u043F\u043A\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438> --seed 7 --steps 300 [--record route.json]",
  "  node cf-play.mjs fuzz     <\u043F\u0430\u043F\u043A\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438> --seeds 1-20 --steps 400 [--record route.json]",
  "  node cf-play.mjs sweep    <\u043F\u0430\u043F\u043A\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438> --seeds 1-20 [--steps 300] [--out runs/sweep]",
  "  node cf-play.mjs verify   <\u043F\u0430\u043F\u043A\u0430 \u043F\u0440\u043E\u0433\u043E\u043D\u0430> [--expect-engine 0.8.0] [--honest]",
  "",
  "\u043E\u0442\u043B\u0430\u0434\u043E\u0447\u043D\u044B\u0435 \u043F\u0440\u0430\u0432\u043A\u0438 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F (\u043A\u0430\u043A \u043F\u0430\u043D\u0435\u043B\u044C \u043E\u0442\u043B\u0430\u0434\u043A\u0438 \u0432 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0435):",
  "  --set flag=1  --var name=3  --item id:2  --tick 40  --scene scene_id  --hp 5  --god",
  "  --entity npc_id=state  --quest quest_id=stage  --weather weather_id",
  "  --currency coin:5  --skill melee=60"
].join("\n");
async function main() {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));
  const campaignDir = positional[0] ? resolve(positional[0]) : "";
  const seed = String(flags.seed ?? "1");
  const outDir = flagText(flags, "out") ? resolve(String(flagText(flags, "out"))) : null;
  const debug = !!flags.debug;
  const asJson = !!flags.json;
  if (command === "verify") {
    if (!campaignDir) die("verify: \u0443\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u0430\u043F\u043A\u0443 \u043F\u0440\u043E\u0433\u043E\u043D\u0430 (\u0441 result.json)");
    process.exit(
      await cmdVerify(campaignDir, flagText(flags, "expect-engine"), !!flags.honest)
    );
  }
  const CAMPAIGN_COMMANDS = ["check", "graph", "dialogue", "run", "fuzz", "explore", "sweep"];
  if (CAMPAIGN_COMMANDS.includes(command) && campaignDir && !existsSync(join(campaignDir, "campaign.json"))) {
    die(`${command}: \u0432 \xAB${campaignDir}\xBB \u043D\u0435\u0442 campaign.json \u2014 \u044D\u0442\u043E \u043D\u0435 \u043F\u0430\u043F\u043A\u0430 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438`);
  }
  if (command === "check") {
    if (!campaignDir) die("check: \u0443\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u0430\u043F\u043A\u0443 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438");
    const range = flagText(flags, "seeds") ?? "1-5";
    const [from, to] = range.includes("-") ? range.split("-").map(Number) : [Number(range), Number(range)];
    const config2 = {
      campaignDir,
      seed,
      outDir: outDir ?? resolve(join(campaignDir, ".cf-play", "check")),
      debug,
      quiet: asJson,
      injection: emptyInjection(),
      record: null
    };
    const { result: result2, text } = await cmdCheck(
      config2,
      [from, to],
      Number(flagText(flags, "steps") ?? 300),
      flagText(flags, "routes") ? resolve(String(flagText(flags, "routes"))) : null
    );
    if (asJson) console.log(JSON.stringify(result2, null, 2));
    else console.log(text);
    process.exit(result2.verdict === "ok" ? 0 : 1);
  }
  if (command === "graph") {
    if (!campaignDir) die("graph: \u0443\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u0430\u043F\u043A\u0443 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438");
    const { campaign: campaign2 } = await loadEngine(campaignDir, seed, debug, parseInjection(flags));
    const report = analyzeCampaign(campaign2);
    const text = formatGraphReport(report);
    if (outDir) {
      await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, "graph.json"), JSON.stringify(report, null, 2), "utf8");
      await writeFile(join(outDir, "graph.md"), text, "utf8");
    }
    if (asJson) console.log(JSON.stringify(report, null, 2));
    else console.log(text);
    const errors = report.findings.filter((finding) => finding.severity === "error").length;
    process.exit(errors ? 1 : 0);
  }
  if (!["dialogue", "run", "fuzz", "explore", "sweep"].includes(command)) die(USAGE);
  if (!campaignDir) die(`${command}: \u0443\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u0430\u043F\u043A\u0443 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438`);
  const config = {
    campaignDir,
    seed,
    outDir,
    debug,
    quiet: asJson,
    routeName: flagText(flags, "route") ?? void 0,
    injection: parseInjection(flags),
    record: flagText(flags, "record") ? resolve(String(flagText(flags, "record"))) : null
  };
  if (command === "dialogue") {
    const target = positional[1];
    if (!target) die("dialogue: \u0443\u043A\u0430\u0436\u0438\u0442\u0435 npcId \u0438\u043B\u0438 \u043F\u0443\u0442\u044C \u0434\u0438\u0430\u043B\u043E\u0433\u0430 (dialogues/x.ink)");
    const { report, text } = await cmdDialogue(
      config,
      target,
      Number(flagText(flags, "depth") ?? 3),
      Number(flagText(flags, "max-nodes") ?? 40)
    );
    if (outDir) {
      await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, "dialogue.json"), JSON.stringify(report, null, 2), "utf8");
      await writeFile(join(outDir, "dialogue.md"), text, "utf8");
    }
    if (asJson) console.log(JSON.stringify(report, null, 2));
    else console.log(text);
    process.exit(report.errors.length ? 1 : 0);
  }
  if (command === "sweep") {
    const range = flagText(flags, "seeds") ?? "1-10";
    const [from, to] = range.includes("-") ? range.split("-").map(Number) : [Number(range), Number(range)];
    const { result: result2, text } = await cmdSweep(config, [from, to], Number(flagText(flags, "steps") ?? 300));
    if (asJson) console.log(JSON.stringify(result2, null, 2));
    else console.log(text);
    process.exit(result2.status === "ok" ? 0 : 1);
  }
  if (command === "run" && config.record) {
    die("run: --record \u043D\u0435 \u043D\u0443\u0436\u0435\u043D \u2014 \u043C\u0430\u0440\u0448\u0440\u0443\u0442 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u0438\u0437 explore/fuzz, \u0430 run \u0435\u0433\u043E \u043F\u0440\u043E\u0438\u0433\u0440\u044B\u0432\u0430\u0435\u0442");
  }
  let result;
  if (command === "run") {
    const scriptPath = flagText(flags, "script");
    if (!scriptPath) die("run: \u043D\u0443\u0436\u0435\u043D --script route.json");
    const script = JSON.parse(await readFile(resolve(scriptPath), "utf8"));
    result = await cmdRun(config, script);
  } else if (command === "explore") {
    result = await cmdSearch(config, "explore", Number(flagText(flags, "steps") ?? 300));
  } else {
    const range = flagText(flags, "seeds") ?? "1-10";
    const [from, to] = range.includes("-") ? range.split("-").map(Number) : [Number(range), Number(range)];
    const runs = [];
    for (let current = from; current <= to; current++) {
      const one = await cmdSearch(
        { ...config, seed: String(current), outDir: outDir ? join(outDir, `seed-${current}`) : null },
        "fuzz",
        Number(flagText(flags, "steps") ?? 400)
      );
      runs.push(one);
      if (!asJson) console.log(`seed ${current}: ${one.status}, \u0448\u0430\u0433\u043E\u0432 ${one.steps}, \u0444\u0438\u043D\u0430\u043B ${one.coverage.final?.game_over?.type ?? "\u2014"}`);
    }
    const bad = runs.filter((run) => run.status !== "ok");
    result = {
      ...runs[0],
      mode: "fuzz",
      status: bad.length ? "failed" : "ok",
      steps: runs.reduce((sum, run) => sum + run.steps, 0),
      assertions: bad.map((run) => ({ name: `seed ${run.seed}`, ok: false, detail: run.status })),
      coverage: runs[0].coverage,
      hashes: { transcript: "", run: "" }
    };
    if (outDir) {
      await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, "result.json"), JSON.stringify(result, null, 2), "utf8");
    }
  }
  if (asJson) {
    console.log(
      JSON.stringify(
        {
          status: result.status,
          evidence: result.evidence,
          injected: result.injected,
          campaign: result.campaign,
          seed: result.seed,
          steps: result.steps,
          assertions: result.assertions,
          coverage: result.coverage,
          hashes: result.hashes
        },
        null,
        2
      )
    );
  } else {
    console.log(`
${result.status === "ok" ? "\u2713" : "\u2717"} ${result.campaign.title}: ${result.status}, \u0448\u0430\u0433\u043E\u0432 ${result.steps}, seed ${result.seed}`);
    if (result.evidence === "injected") console.log(`  ! \u043F\u0440\u043E\u0433\u043E\u043D \u0441 \u043E\u0442\u043B\u0430\u0434\u043E\u0447\u043D\u044B\u043C\u0438 \u043F\u0440\u0430\u0432\u043A\u0430\u043C\u0438: ${result.injected.join("; ")}`);
    if (config.outDir) console.log(`  transcript: ${join(config.outDir, "transcript.md")}`);
    const scenes = result.coverage.scenes;
    if (scenes?.missing?.length) console.log(`  \u043D\u0435 \u043F\u043E\u0441\u0435\u0449\u0435\u043D\u043E \u0441\u0446\u0435\u043D: ${scenes.missing.length} \u0438\u0437 ${scenes.missing.length + scenes.seen.length}`);
  }
  process.exit(result.status === "ok" ? 0 : 1);
}
main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`cf-play: ${message}`);
  if (process.argv.includes("--debug") && error instanceof Error && error.stack) console.error(error.stack);
  process.exit(2);
});
