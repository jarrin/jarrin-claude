#!/usr/bin/env node
import { createRequire as __createRequire } from 'node:module';
const require = __createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x2) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x2, {
  get: (a2, b3) => (typeof require !== "undefined" ? require : a2)[b3]
}) : x2)(function(x2) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x2 + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
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

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/identity.js"(exports) {
    "use strict";
    var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
    var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
    var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
    var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
    var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
    var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
    var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias;
    exports.isCollection = isCollection;
    exports.isDocument = isDocument;
    exports.isMap = isMap;
    exports.isNode = isNode;
    exports.isPair = isPair;
    exports.isScalar = isScalar;
    exports.isSeq = isSeq;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/visit.js"(exports) {
    "use strict";
    var identity = require_identity();
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path2) {
      const ctrl = callVisitor(key, node, visitor, path2);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path2, ctrl);
        return visit_(key, ctrl, visitor, path2);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path2 = Object.freeze(path2.concat(node));
          for (let i2 = 0; i2 < node.items.length; ++i2) {
            const ci = visit_(i2, node.items[i2], visitor, path2);
            if (typeof ci === "number")
              i2 = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i2, 1);
              i2 -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path2 = Object.freeze(path2.concat(node));
          const ck = visit_("key", node.key, visitor, path2);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path2);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path2) {
      const ctrl = await callVisitor(key, node, visitor, path2);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path2, ctrl);
        return visitAsync_(key, ctrl, visitor, path2);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path2 = Object.freeze(path2.concat(node));
          for (let i2 = 0; i2 < node.items.length; ++i2) {
            const ci = await visitAsync_(i2, node.items[i2], visitor, path2);
            if (typeof ci === "number")
              i2 = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i2, 1);
              i2 -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path2 = Object.freeze(path2.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path2);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path2);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path2) {
      if (typeof visitor === "function")
        return visitor(key, node, path2);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path2);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path2);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path2);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path2);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path2);
      return void 0;
    }
    function replaceNode(key, path2, node) {
      const parent = path2[path2.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports.visit = visit;
    exports.visitAsync = visitAsync;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/directives.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version2] = parts;
            if (version2 === "1.1" || version2 === "1.2") {
              this.yaml.version = version2;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version2);
              onError(6, `Unsupported YAML version ${version2}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports.Directives = Directives;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/anchors.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i2 = 1; true; ++i2) {
        const name = `${prefix}${i2}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/applyReviver.js"(exports) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i2 = 0, len = val.length; i2 < len; ++i2) {
            const v0 = val[i2];
            const v1 = applyReviver(reviver, val, String(i2), v0);
            if (v1 === void 0)
              delete val[i2];
            else if (v1 !== v0)
              val[i2] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports.applyReviver = applyReviver;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/toJS.js"(exports) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i2) => toJS(v, String(i2), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports.toJS = toJS;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Node.js"(exports) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports.NodeBase = NodeBase;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Alias.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const { anchors: anchors2, doc, maxAliasCount } = ctx;
        const source = this.resolve(doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        let data = anchors2.get(source);
        if (!data) {
          toJS.toJS(source, null, ctx);
          data = anchors2.get(source);
        }
        if (data?.res === void 0) {
          const msg = "This should not happen: Alias anchor was not resolved?";
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0)
            data.aliasCount = getAliasCount(doc, source, anchors2);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = "Excessive alias count indicates a resource exhaustion attack";
            throw new ReferenceError(msg);
          }
        }
        return data.res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c3 = getAliasCount(doc, item, anchors2);
          if (c3 > count)
            count = c3;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports.Scalar = Scalar;
    exports.isScalarValue = isScalarValue;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/createNode.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t2) => t2.tag === tagName);
        const tagObj = match.find((t2) => !t2.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t2) => t2.identify?.(value) && !t2.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Collection.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path2, value) {
      let v = value;
      for (let i2 = path2.length - 1; i2 >= 0; --i2) {
        const k = path2[i2];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a2 = [];
          a2[k] = v;
          v = a2;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path2) => path2 == null || typeof path2 === "object" && !!path2[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path2, value) {
        if (isEmptyPath(path2))
          this.add(value);
        else {
          const [key, ...rest] = path2;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path2) {
        const [key, ...rest] = path2;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path2, keepScalar) {
        const [key, ...rest] = path2;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n3 = node.value;
          return n3 == null || allowScalar && identity.isScalar(n3) && n3.value == null && !n3.commentBefore && !n3.comment && !n3.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path2) {
        const [key, ...rest] = path2;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path2, value) {
        const [key, ...rest] = path2;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyComment.js"(exports) {
    "use strict";
    var stringifyComment = (str2) => str2.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str2, indent, comment) => str2.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str2.endsWith(" ") ? "" : " ") + comment;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/foldFlowLines.js"(exports) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text2, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text2;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text2.length <= endStep)
        return text2;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i2 = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i2 = consumeMoreIndentedLines(text2, i2, indent.length);
        if (i2 !== -1)
          end = i2 + endStep;
      }
      for (let ch; ch = text2[i2 += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i2;
          switch (text2[i2 + 1]) {
            case "x":
              i2 += 3;
              break;
            case "u":
              i2 += 5;
              break;
            case "U":
              i2 += 9;
              break;
            default:
              i2 += 1;
          }
          escEnd = i2;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i2 = consumeMoreIndentedLines(text2, i2, indent.length);
          end = i2 + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text2[i2 + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i2;
          }
          if (i2 >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text2[i2 += 1];
                overflow = true;
              }
              const j = i2 > escEnd + 1 ? i2 - 2 : escStart - 1;
              if (escapedFolds[j])
                return text2;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text2;
      if (onFold)
        onFold();
      let res = text2.slice(0, folds[0]);
      for (let i3 = 0; i3 < folds.length; ++i3) {
        const fold = folds[i3];
        const end2 = folds[i3 + 1] || text2.length;
        if (fold === 0)
          res = `
${indent}${text2.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text2[fold]}\\`;
          res += `
${indent}${text2.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text2, i2, indent) {
      let end = i2;
      let start = i2 + 1;
      let ch = text2[start];
      while (ch === " " || ch === "	") {
        if (i2 < start + indent) {
          ch = text2[++i2];
        } else {
          do {
            ch = text2[++i2];
          } while (ch && ch !== "\n");
          end = i2;
          start = i2 + 1;
          ch = text2[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyString.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str2) => /^(%|---|\.\.\.)/m.test(str2);
    function lineLengthOverLimit(str2, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str2.length;
      if (strLen <= limit)
        return false;
      for (let i2 = 0, start = 0; i2 < strLen; ++i2) {
        if (str2[i2] === "\n") {
          if (i2 - start > limit)
            return true;
          start = i2 + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str2 = "";
      let start = 0;
      for (let i2 = 0, ch = json[i2]; ch; ch = json[++i2]) {
        if (ch === " " && json[i2 + 1] === "\\" && json[i2 + 2] === "n") {
          str2 += json.slice(start, i2) + "\\ ";
          i2 += 1;
          start = i2;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i2 + 1]) {
            case "u":
              {
                str2 += json.slice(start, i2);
                const code = json.substr(i2 + 2, 4);
                switch (code) {
                  case "0000":
                    str2 += "\\0";
                    break;
                  case "0007":
                    str2 += "\\a";
                    break;
                  case "000b":
                    str2 += "\\v";
                    break;
                  case "001b":
                    str2 += "\\e";
                    break;
                  case "0085":
                    str2 += "\\N";
                    break;
                  case "00a0":
                    str2 += "\\_";
                    break;
                  case "2028":
                    str2 += "\\L";
                    break;
                  case "2029":
                    str2 += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str2 += "\\x" + code.substr(2);
                    else
                      str2 += json.substr(i2, 6);
                }
                i2 += 5;
                start = i2 + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i2 + 2] === '"' || json.length < minMultiLineLength) {
                i2 += 1;
              } else {
                str2 += json.slice(start, i2) + "\n\n";
                while (json[i2 + 2] === "\\" && json[i2 + 3] === "n" && json[i2 + 4] !== '"') {
                  str2 += "\n";
                  i2 += 2;
                }
                str2 += indent;
                if (json[i2 + 2] === " ")
                  str2 += "\\";
                i2 += 1;
                start = i2 + 1;
              }
              break;
            default:
              i2 += 1;
          }
      }
      str2 = start ? str2 + json.slice(start) : json;
      return implicitKey ? str2 : foldFlowLines.foldFlowLines(str2, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str2 = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str2);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str2 : foldFlowLines.foldFlowLines(str2, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t2 = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t2);
        if (res === null)
          throw new Error(`Unsupported default string type ${t2}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringify.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t2) => t2.tag === item.tag);
        if (match.length > 0)
          return match.find((t2) => t2.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t2) => t2.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t2) => t2.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t2) => t2.format === item.format) ?? match.find((t2) => !t2.format);
      } else {
        obj = item;
        tagObj = tags.find((t2) => t2.nodeClass && obj instanceof t2.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o2) => tagObj = o2 });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str2 = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str2;
      return identity.isScalar(node) || str2[0] === "{" || str2[0] === "[" ? `${props} ${str2}` : `${props}
${ctx.indent}${str2}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyPair.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str2 = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str2.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str2 === "" ? "?" : explicitKey ? `? ${str2}` : str2;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str2 = `? ${str2}`;
        if (keyComment && !keyCommentDone) {
          str2 += stringifyComment.lineComment(str2, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str2;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str2 += stringifyComment.lineComment(str2, ctx.indent, commentString(keyComment));
        str2 = `? ${str2}
${indent}:`;
      } else {
        str2 = `${str2}:`;
        if (keyComment)
          str2 += stringifyComment.lineComment(str2, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str2.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str2 += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str2 += stringifyComment.lineComment(str2, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str2;
    }
    exports.stringifyPair = stringifyPair;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/log.js"(exports) {
    "use strict";
    var node_process = __require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    var log2 = require_log();
    var merge = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log2.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Pair.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_2, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyCollection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i2 = 0; i2 < items.length; ++i2) {
        const item = items[i2];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str3 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str3 += stringifyComment.lineComment(str3, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str3);
      }
      let str2;
      if (lines.length === 0) {
        str2 = flowChars.start + flowChars.end;
      } else {
        str2 = lines[0];
        for (let i2 = 1; i2 < lines.length; ++i2) {
          const line = lines[i2];
          str2 += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str2 += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str2;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i2 = 0; i2 < items.length; ++i2) {
        const item = items[i2];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str2 = stringify.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str2.includes("\n"));
        if (i2 < items.length - 1) {
          str2 += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str2.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str2 += ",";
          }
        }
        if (comment)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment));
        lines.push(str2);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str2 = start;
          for (const line of lines)
            str2 += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str2}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLMap.js"(exports) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap2 = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i2 = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i2 === -1)
            this.items.push(_pair);
          else
            this.items.splice(i2, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_2, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports.YAMLMap = YAMLMap2;
    exports.findPair = findPair;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/map.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLMap2 = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap2.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap2.YAMLMap.from(schema, obj, ctx)
    };
    exports.map = map;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLSeq.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq2 = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_2, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i2 = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i2++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i2 = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i2++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq2;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/seq.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq2 = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq2.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq2.YAMLSeq.from(schema, obj, ctx)
    };
    exports.seq = seq;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/string.js"(exports) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str2) => str2,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/null.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports.nullTag = nullTag;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str2) => new Scalar.Scalar(str2[0] === "t" || str2[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports.boolTag = boolTag;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyNumber.js"(exports) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n3 = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n3) && !n3.includes("e")) {
        let i2 = n3.indexOf(".");
        if (i2 < 0) {
          i2 = n3.length;
          n3 += ".";
        }
        let d = minFractionDigits - (n3.length - i2 - 1);
        while (d-- > 0)
          n3 += "0";
      }
      return n3;
    }
    exports.stringifyNumber = stringifyNumber;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str2) => str2.slice(-3).toLowerCase() === "nan" ? NaN : str2[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str2) => parseFloat(str2),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str2) {
        const node = new Scalar.Scalar(parseFloat(str2));
        const dot = str2.indexOf(".");
        if (dot !== -1 && str2[str2.length - 1] === "0")
          node.minFractionDigits = str2.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str2, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str2) : parseInt(str2.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports.schema = schema;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/json/schema.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str2) => str2,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str2) => str2 === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str2, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str2) : parseInt(str2, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str2) => parseFloat(str2),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str2, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str2)}`);
        return str2;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports) {
    "use strict";
    var node_buffer = __require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str2 = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str2.length);
          for (let i2 = 0; i2 < str2.length; ++i2)
            buffer[i2] = str2.charCodeAt(i2);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str2;
        if (typeof node_buffer.Buffer === "function") {
          str2 = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i2 = 0; i2 < buf.length; ++i2)
            s += String.fromCharCode(buf[i2]);
          str2 = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n3 = Math.ceil(str2.length / lineWidth);
          const lines = new Array(n3);
          for (let i2 = 0, o2 = 0; i2 < n3; ++i2, o2 += lineWidth) {
            lines[i2] = str2.substr(o2, lineWidth);
          }
          str2 = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str2 }, ctx, onComment, onChompKeep);
      }
    };
    exports.binary = binary;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq2 = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i2 = 0; i2 < seq.items.length; ++i2) {
          let item = seq.items[i2];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i2] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq2.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i2 = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i2++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap2 = require_YAMLMap();
    var YAMLSeq2 = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq2.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap2.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap2.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap2.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap2.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap2.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_2, ctx) {
        if (!ctx)
          return super.toJSON(_2);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str2) => str2.slice(-3).toLowerCase() === "nan" ? NaN : str2[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str2) => parseFloat(str2.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str2) {
        const node = new Scalar.Scalar(parseFloat(str2.replace(/_/g, "")));
        const dot = str2.indexOf(".");
        if (dot !== -1) {
          const f2 = str2.substring(dot + 1).replace(/_/g, "");
          if (f2[f2.length - 1] === "0")
            node.minFractionDigits = f2.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str2, offset, radix, { intAsBigInt }) {
      const sign = str2[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str2 = str2.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str2 = `0b${str2}`;
            break;
          case 8:
            str2 = `0o${str2}`;
            break;
          case 16:
            str2 = `0x${str2}`;
            break;
        }
        const n4 = BigInt(str2);
        return sign === "-" ? BigInt(-1) * n4 : n4;
      }
      const n3 = parseInt(str2, radix);
      return sign === "-" ? -1 * n3 : n3;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str2 = value.toString(radix);
        return value < 0 ? "-" + prefix + str2.substr(1) : prefix + str2;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap2 = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap2.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap2.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap2.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap2.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_2, ctx) {
        return super.toJSON(_2, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str2, asBigInt) {
      const sign = str2[0];
      const parts = sign === "-" || sign === "+" ? str2.substring(1) : str2;
      const num = (n3) => asBigInt ? BigInt(n3) : Number(n3);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p3) => res2 * num(60) + num(p3), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n3) => n3;
      if (typeof value === "bigint")
        num = (n3) => BigInt(n3);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n3) => String(n3).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str2, _onError, { intAsBigInt }) => parseSexagesimal(str2, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str2) => parseSexagesimal(str2, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str2) {
        const match = str2.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date2 = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date2 -= 6e4 * d;
        }
        return new Date(date2);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports.schema = schema;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/tags.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/Schema.js"(exports) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a2, b3) => a2.key < b3.key ? -1 : a2.key > b3.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports.Schema = Schema;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyDocument.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports.stringifyDocument = stringifyDocument;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/Document.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document2 = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version: version2 } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version2 = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version: version2 });
        this.setSchema(version2, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path2, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path2, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path2) {
        if (Collection.isEmptyPath(path2)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path2) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path2, keepScalar) {
        if (Collection.isEmptyPath(path2))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path2, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path2) {
        if (Collection.isEmptyPath(path2))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path2) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path2, value) {
        if (Collection.isEmptyPath(path2)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path2), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path2, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version2, options = {}) {
        if (typeof version2 === "number")
          version2 = String(version2);
        let opt;
        switch (version2) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version2;
            else
              this.directives = new directives.Directives({ version: version2 });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version2);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports.Document = Document2;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/errors.js"(exports) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-props.js"(exports) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports.resolveProps = resolveProps;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-contains-newline.js"(exports) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-map-includes.js"(exports) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a2, b3) => a2 === b3 || identity.isScalar(a2) && identity.isScalar(b3) && a2.value === b3.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-map.js"(exports) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap2 = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap2.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-seq.js"(exports) {
    "use strict";
    var YAMLSeq2 = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq2.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-end.js"(exports) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep + cb;
              sep = "";
              break;
            }
            case "newline":
              if (comment)
                sep += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports.resolveEnd = resolveEnd;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap2 = require_YAMLMap();
    var YAMLSeq2 = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap2.YAMLMap : YAMLSeq2.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i2 = 0; i2 < fc.items.length; ++i2) {
        const collItem = fc.items[i2];
        const { start, key, sep, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep && !value) {
            if (i2 === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i2 < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i2 === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep)
                for (const st of sep) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap2.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap2 = require_YAMLMap();
    var YAMLSeq2 = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap2.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq2.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t2) => t2.tag === tagName && t2.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i2 = lines.length - 1; i2 >= 0; --i2) {
        const content = lines[i2][1];
        if (content === "" || content === "\r")
          chompStart = i2;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i2 = 0; i2 < chompStart; ++i2) {
        const [indent, content] = lines[i2];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i2;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i2 = lines.length - 1; i2 >= chompStart; --i2) {
        if (lines[i2][0].length > trimIndent)
          chompStart = i2 + 1;
      }
      let value = "";
      let sep = "";
      let prevMoreIndented = false;
      for (let i2 = 0; i2 < contentStart; ++i2)
        value += lines[i2][0].slice(trimIndent) + "\n";
      for (let i2 = contentStart; i2 < chompStart; ++i2) {
        let [indent, content] = lines[i2];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep === " ")
            sep = "\n";
          else if (!prevMoreIndented && sep === "\n")
            sep = "\n\n";
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep === "\n")
            value += "\n";
          else
            sep = "\n";
        } else {
          value += sep + content;
          sep = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i2 = chompStart; i2 < lines.length; ++i2)
            value += "\n" + lines[i2][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i2 = 1; i2 < source.length; ++i2) {
        const ch = source[i2];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n3 = Number(ch);
          if (!indent && n3)
            indent = n3;
          else if (error === -1)
            error = offset + i2;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i2 = 1; i2 < props.length; ++i2) {
        const token = props[i2];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m3 = first.match(/^( *)/);
      const line0 = m3?.[1] ? [m3[1], first.slice(m3[1].length)] : ["", first];
      const lines = [line0];
      for (let i2 = 1; i2 < split.length; i2 += 2)
        lines.push([split[i2], split[i2 + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return foldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return foldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function foldLines(source) {
      let first, line;
      try {
        first = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
        line = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
      } catch {
        first = /(.*?)[ \t]*\r?\n/sy;
        line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
      }
      let match = first.exec(source);
      if (!match)
        return source;
      let res = match[1];
      let sep = " ";
      let pos = first.lastIndex;
      line.lastIndex = pos;
      while (match = line.exec(source)) {
        if (match[1] === "") {
          if (sep === "\n")
            res += sep;
          else
            sep = "\n";
        } else {
          res += sep + match[1];
          sep = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i2 = 1; i2 < source.length - 1; ++i2) {
        const ch = source[i2];
        if (ch === "\r" && source[i2 + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i2);
          res += fold;
          i2 = offset;
        } else if (ch === "\\") {
          let next = source[++i2];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i2 + 1];
            while (next === " " || next === "	")
              next = source[++i2 + 1];
          } else if (next === "\r" && source[i2 + 1] === "\n") {
            next = source[++i2 + 1];
            while (next === " " || next === "	")
              next = source[++i2 + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i2 + 1, length, onError);
            i2 += length;
          } else {
            const raw = source.substr(i2 - 1, 2);
            onError(i2 - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i2;
          let next = source[i2 + 1];
          while (next === " " || next === "	")
            next = source[++i2 + 1];
          if (next !== "\n" && !(next === "\r" && source[i2 + 2] === "\n"))
            res += i2 > wsStart ? source.slice(wsStart, i2 + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i2 = pos - 1; i2 >= 0; --i2) {
          let st = before[i2];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i2];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i2];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-node.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-doc.js"(exports) {
    "use strict";
    var Document2 = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document2.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports.composeDoc = composeDoc;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/composer.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var directives = require_directives();
    var Document2 = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i2 = 0; i2 < prelude.length; ++i2) {
        const source = prelude[i2];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i2 + 1]?.[0] !== "#")
              i2 += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i2 = 0; i2 < this.errors.length; ++i2)
            doc.errors.push(this.errors[i2]);
          for (let i2 = 0; i2 < this.warnings.length; ++i2)
            doc.warnings.push(this.warnings[i2]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document2.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports.Composer = Composer;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-scalar.js"(exports) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-stringify.js"(exports) {
    "use strict";
    var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep)
        for (const st of sep)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports.stringify = stringify;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-visit.js"(exports) {
    "use strict";
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path2) => {
      let item = cst;
      for (const [field, index] of path2) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path2) => {
      const parent = visit.itemAtPath(cst, path2.slice(0, -1));
      const field = path2[path2.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path2, item, visitor) {
      let ctrl = visitor(item, path2);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i2 = 0; i2 < token.items.length; ++i2) {
            const ci = _visit(Object.freeze(path2.concat([[field, i2]])), token.items[i2], visitor);
            if (typeof ci === "number")
              i2 = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i2, 1);
              i2 -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path2);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path2) : ctrl;
    }
    exports.visit = visit;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst.js"(exports) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR;
    exports.isCollection = isCollection;
    exports.isScalar = isScalar;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/lexer.js"(exports) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i2 = this.pos;
        let ch = this.buffer[i2];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i2];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i2 + 1] === "\n";
        return false;
      }
      charAt(n3) {
        return this.buffer[this.pos + n3];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n3) {
        return this.pos + n3 <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n3) {
        return this.buffer.substr(this.pos, n3);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n3 = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n3);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n3 = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n3;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n3 = yield* this.pushIndicators();
        switch (line[n3]) {
          case "#":
            yield* this.pushCount(line.length - n3);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n3 += yield* this.parseBlockScalarHeader();
            n3 += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n3);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n3 = 0;
        while (line[n3] === ",") {
          n3 += yield* this.pushCount(1);
          n3 += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n3 += yield* this.pushIndicators();
        switch (line[n3]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n3);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n3 = 0;
            while (this.buffer[end - 1 - n3] === "\\")
              n3 += 1;
            if (n3 % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i2 = this.pos;
        while (true) {
          const ch = this.buffer[++i2];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i3 = this.pos; ch = this.buffer[i3]; ++i3) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i3;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i3 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i2 = nl + 1;
        ch = this.buffer[i2];
        while (ch === " ")
          ch = this.buffer[++i2];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i2];
          nl = i2 - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i3 = nl - 1;
            let ch2 = this.buffer[i3];
            if (ch2 === "\r")
              ch2 = this.buffer[--i3];
            const lastChar = i3;
            while (ch2 === " ")
              ch2 = this.buffer[--i3];
            if (ch2 === "\n" && i3 >= this.pos && i3 + 1 + indent > lastChar)
              nl = i3;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i2 = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i2]) {
          if (ch === ":") {
            const next = this.buffer[i2 + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i2;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i2 + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i2 += 1;
                ch = "\n";
                next = this.buffer[i2 + 1];
              } else
                end = i2;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i2 + 1);
              if (cs === -1)
                break;
              i2 = Math.max(i2, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i2;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n3) {
        if (n3 > 0) {
          yield this.buffer.substr(this.pos, n3);
          this.pos += n3;
          return n3;
        }
        return 0;
      }
      *pushToIndex(i2, allowEmpty) {
        const s = this.buffer.slice(this.pos, i2);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n3 = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n3 += yield* this.pushTag();
              n3 += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n3 += yield* this.pushUntil(isNotAnchorChar);
              n3 += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n3 += yield* this.pushCount(1);
                n3 += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n3;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i2 = this.pos + 2;
          let ch = this.buffer[i2];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i2];
          return yield* this.pushToIndex(ch === ">" ? i2 + 1 : i2, false);
        } else {
          let i2 = this.pos + 1;
          let ch = this.buffer[i2];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i2];
            else if (ch === "%" && hexDigits.has(this.buffer[i2 + 1]) && hexDigits.has(this.buffer[i2 + 2])) {
              ch = this.buffer[i2 += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i2, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i2 = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i2];
        } while (ch === " " || allowTabs && ch === "	");
        const n3 = i2 - this.pos;
        if (n3 > 0) {
          yield this.buffer.substr(this.pos, n3);
          this.pos = i2;
        }
        return n3;
      }
      *pushUntil(test) {
        let i2 = this.pos;
        let ch = this.buffer[i2];
        while (!test(ch))
          ch = this.buffer[++i2];
        return yield* this.pushToIndex(i2, false);
      }
    };
    exports.Lexer = Lexer;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/line-counter.js"(exports) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/parser.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i2 = 0; i2 < list.length; ++i2)
        if (list[i2].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i2 = 0; i2 < list.length; ++i2) {
        switch (list[i2].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i2;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i2 = prev.length;
      loop: while (--i2 >= 0) {
        switch (prev[i2].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i2]?.type === "space") {
      }
      return prev.splice(i2, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i2 = 0; i2 < source.length; ++i2)
          target.push(source[i2]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n3) {
        return this.stack[this.stack.length - n3];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep;
          if (scalar.end) {
            sep = scalar.end;
            sep.push(this.sourceToken);
            delete scalar.end;
          } else
            sep = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i2 = 0; i2 < it.sep.length; ++i2) {
              const st = it.sep[i2];
              switch (st.type) {
                case "newline":
                  nl.push(i2);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep = it.sep;
                  sep.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep = fc.end.splice(1, fc.end.length);
            sep.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports.Parser = Parser;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/public-api.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document2 = require_Document();
    var errors = require_errors();
    var log2 = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument3(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse3(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument3(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log2.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document2.Document(value, _replacer, options).toString(options);
    }
    exports.parse = parse3;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument3;
    exports.stringify = stringify;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/index.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document2 = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap2 = require_YAMLMap();
    var YAMLSeq2 = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document2.Document;
    exports.Schema = Schema.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity.isAlias;
    exports.isCollection = identity.isCollection;
    exports.isDocument = identity.isDocument;
    exports.isMap = identity.isMap;
    exports.isNode = identity.isNode;
    exports.isPair = identity.isPair;
    exports.isScalar = identity.isScalar;
    exports.isSeq = identity.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar.Scalar;
    exports.YAMLMap = YAMLMap2.YAMLMap;
    exports.YAMLSeq = YAMLSeq2.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit.visit;
    exports.visitAsync = visit.visitAsync;
  }
});

// node_modules/.pnpm/fast-string-truncated-width@3.0.3/node_modules/fast-string-truncated-width/dist/utils.js
var getCodePointsLength, isFullWidth, isWideNotCJKTNotEmoji;
var init_utils = __esm({
  "node_modules/.pnpm/fast-string-truncated-width@3.0.3/node_modules/fast-string-truncated-width/dist/utils.js"() {
    "use strict";
    getCodePointsLength = /* @__PURE__ */ (() => {
      const SURROGATE_PAIR_RE = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
      return (input) => {
        let surrogatePairsNr = 0;
        SURROGATE_PAIR_RE.lastIndex = 0;
        while (SURROGATE_PAIR_RE.test(input)) {
          surrogatePairsNr += 1;
        }
        return input.length - surrogatePairsNr;
      };
    })();
    isFullWidth = (x2) => {
      return x2 === 12288 || x2 >= 65281 && x2 <= 65376 || x2 >= 65504 && x2 <= 65510;
    };
    isWideNotCJKTNotEmoji = (x2) => {
      return x2 === 8987 || x2 === 9001 || x2 >= 12272 && x2 <= 12287 || x2 >= 12289 && x2 <= 12350 || x2 >= 12441 && x2 <= 12543 || x2 >= 12549 && x2 <= 12591 || x2 >= 12593 && x2 <= 12686 || x2 >= 12688 && x2 <= 12771 || x2 >= 12783 && x2 <= 12830 || x2 >= 12832 && x2 <= 12871 || x2 >= 12880 && x2 <= 19903 || x2 >= 65040 && x2 <= 65049 || x2 >= 65072 && x2 <= 65106 || x2 >= 65108 && x2 <= 65126 || x2 >= 65128 && x2 <= 65131 || x2 >= 127488 && x2 <= 127490 || x2 >= 127504 && x2 <= 127547 || x2 >= 127552 && x2 <= 127560 || x2 >= 131072 && x2 <= 196605 || x2 >= 196608 && x2 <= 262141;
    };
  }
});

// node_modules/.pnpm/fast-string-truncated-width@3.0.3/node_modules/fast-string-truncated-width/dist/index.js
var ANSI_RE, CONTROL_RE, CJKT_WIDE_RE, TAB_RE, EMOJI_RE, LATIN_RE, MODIFIER_RE, NO_TRUNCATION, getStringTruncatedWidth, dist_default;
var init_dist = __esm({
  "node_modules/.pnpm/fast-string-truncated-width@3.0.3/node_modules/fast-string-truncated-width/dist/index.js"() {
    "use strict";
    init_utils();
    ANSI_RE = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]|\u001b\]8;[^;]*;.*?(?:\u0007|\u001b\u005c)/y;
    CONTROL_RE = /[\x00-\x08\x0A-\x1F\x7F-\x9F]{1,1000}/y;
    CJKT_WIDE_RE = /(?:(?![\uFF61-\uFF9F\uFF00-\uFFEF])[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Tangut}]){1,1000}/yu;
    TAB_RE = /\t{1,1000}/y;
    EMOJI_RE = new RegExp("[\\u{1F1E6}-\\u{1F1FF}]{2}|\\u{1F3F4}[\\u{E0061}-\\u{E007A}]{2}[\\u{E0030}-\\u{E0039}\\u{E0061}-\\u{E007A}]{1,3}\\u{E007F}|(?:\\p{Emoji}\\uFE0F\\u20E3?|\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|\\p{Emoji_Presentation})(?:\\u200D(?:\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}?|\\p{Emoji_Presentation}|\\p{Emoji}\\uFE0F\\u20E3?))*", "yu");
    LATIN_RE = /(?:[\x20-\x7E\xA0-\xFF](?!\uFE0F)){1,1000}/y;
    MODIFIER_RE = new RegExp("\\p{M}+", "gu");
    NO_TRUNCATION = { limit: Infinity, ellipsis: "" };
    getStringTruncatedWidth = (input, truncationOptions = {}, widthOptions = {}) => {
      const LIMIT = truncationOptions.limit ?? Infinity;
      const ELLIPSIS = truncationOptions.ellipsis ?? "";
      const ELLIPSIS_WIDTH = truncationOptions?.ellipsisWidth ?? (ELLIPSIS ? getStringTruncatedWidth(ELLIPSIS, NO_TRUNCATION, widthOptions).width : 0);
      const ANSI_WIDTH = 0;
      const CONTROL_WIDTH = widthOptions.controlWidth ?? 0;
      const TAB_WIDTH = widthOptions.tabWidth ?? 8;
      const EMOJI_WIDTH = widthOptions.emojiWidth ?? 2;
      const FULL_WIDTH_WIDTH = 2;
      const REGULAR_WIDTH = widthOptions.regularWidth ?? 1;
      const WIDE_WIDTH = widthOptions.wideWidth ?? FULL_WIDTH_WIDTH;
      const PARSE_BLOCKS = [
        [LATIN_RE, REGULAR_WIDTH],
        [ANSI_RE, ANSI_WIDTH],
        [CONTROL_RE, CONTROL_WIDTH],
        [TAB_RE, TAB_WIDTH],
        [EMOJI_RE, EMOJI_WIDTH],
        [CJKT_WIDE_RE, WIDE_WIDTH]
      ];
      let indexPrev = 0;
      let index = 0;
      let length = input.length;
      let lengthExtra = 0;
      let truncationEnabled = false;
      let truncationIndex = length;
      let truncationLimit = Math.max(0, LIMIT - ELLIPSIS_WIDTH);
      let unmatchedStart = 0;
      let unmatchedEnd = 0;
      let width = 0;
      let widthExtra = 0;
      outer: while (true) {
        if (unmatchedEnd > unmatchedStart || index >= length && index > indexPrev) {
          const unmatched = input.slice(unmatchedStart, unmatchedEnd) || input.slice(indexPrev, index);
          lengthExtra = 0;
          for (const char of unmatched.replaceAll(MODIFIER_RE, "")) {
            const codePoint = char.codePointAt(0) || 0;
            if (isFullWidth(codePoint)) {
              widthExtra = FULL_WIDTH_WIDTH;
            } else if (isWideNotCJKTNotEmoji(codePoint)) {
              widthExtra = WIDE_WIDTH;
            } else {
              widthExtra = REGULAR_WIDTH;
            }
            if (width + widthExtra > truncationLimit) {
              truncationIndex = Math.min(truncationIndex, Math.max(unmatchedStart, indexPrev) + lengthExtra);
            }
            if (width + widthExtra > LIMIT) {
              truncationEnabled = true;
              break outer;
            }
            lengthExtra += char.length;
            width += widthExtra;
          }
          unmatchedStart = unmatchedEnd = 0;
        }
        if (index >= length) {
          break outer;
        }
        for (let i2 = 0, l2 = PARSE_BLOCKS.length; i2 < l2; i2++) {
          const [BLOCK_RE, BLOCK_WIDTH] = PARSE_BLOCKS[i2];
          BLOCK_RE.lastIndex = index;
          if (BLOCK_RE.test(input)) {
            lengthExtra = BLOCK_RE === CJKT_WIDE_RE ? getCodePointsLength(input.slice(index, BLOCK_RE.lastIndex)) : BLOCK_RE === EMOJI_RE ? 1 : BLOCK_RE.lastIndex - index;
            widthExtra = lengthExtra * BLOCK_WIDTH;
            if (width + widthExtra > truncationLimit) {
              truncationIndex = Math.min(truncationIndex, index + Math.floor((truncationLimit - width) / BLOCK_WIDTH));
            }
            if (width + widthExtra > LIMIT) {
              truncationEnabled = true;
              break outer;
            }
            width += widthExtra;
            unmatchedStart = indexPrev;
            unmatchedEnd = index;
            index = indexPrev = BLOCK_RE.lastIndex;
            continue outer;
          }
        }
        index += 1;
      }
      return {
        width: truncationEnabled ? truncationLimit : width,
        index: truncationEnabled ? truncationIndex : length,
        truncated: truncationEnabled,
        ellipsed: truncationEnabled && LIMIT >= ELLIPSIS_WIDTH
      };
    };
    dist_default = getStringTruncatedWidth;
  }
});

// node_modules/.pnpm/fast-string-width@3.0.2/node_modules/fast-string-width/dist/index.js
var NO_TRUNCATION2, fastStringWidth, dist_default2;
var init_dist2 = __esm({
  "node_modules/.pnpm/fast-string-width@3.0.2/node_modules/fast-string-width/dist/index.js"() {
    "use strict";
    init_dist();
    NO_TRUNCATION2 = {
      limit: Infinity,
      ellipsis: "",
      ellipsisWidth: 0
    };
    fastStringWidth = (input, options = {}) => {
      return dist_default(input, NO_TRUNCATION2, options).width;
    };
    dist_default2 = fastStringWidth;
  }
});

// node_modules/.pnpm/fast-wrap-ansi@0.2.2/node_modules/fast-wrap-ansi/lib/main.js
function wrapAnsi(string, columns, options) {
  return String(string).normalize().split(CRLF_OR_LF).map((line) => exec(line, columns, options)).join("\n");
}
var ESC, CSI, END_CODE, ANSI_ESCAPE_BELL, ANSI_CSI, ANSI_OSC, ANSI_SGR_TERMINATOR, ANSI_ESCAPE_LINK, GROUP_REGEX, getClosingCode, wrapAnsiCode, wrapAnsiHyperlink, wrapWord, stringVisibleTrimSpacesRight, exec, CRLF_OR_LF;
var init_main = __esm({
  "node_modules/.pnpm/fast-wrap-ansi@0.2.2/node_modules/fast-wrap-ansi/lib/main.js"() {
    "use strict";
    init_dist2();
    ESC = "\x1B";
    CSI = "\x9B";
    END_CODE = 39;
    ANSI_ESCAPE_BELL = "\x07";
    ANSI_CSI = "[";
    ANSI_OSC = "]";
    ANSI_SGR_TERMINATOR = "m";
    ANSI_ESCAPE_LINK = `${ANSI_OSC}8;;`;
    GROUP_REGEX = new RegExp(`(?:\\${ANSI_CSI}(?<code>\\d+)m|\\${ANSI_ESCAPE_LINK}(?<uri>.*)${ANSI_ESCAPE_BELL})`, "y");
    getClosingCode = (openingCode) => {
      if (openingCode >= 30 && openingCode <= 37)
        return 39;
      if (openingCode >= 90 && openingCode <= 97)
        return 39;
      if (openingCode >= 40 && openingCode <= 47)
        return 49;
      if (openingCode >= 100 && openingCode <= 107)
        return 49;
      if (openingCode === 1 || openingCode === 2)
        return 22;
      if (openingCode === 3)
        return 23;
      if (openingCode === 4)
        return 24;
      if (openingCode === 7)
        return 27;
      if (openingCode === 8)
        return 28;
      if (openingCode === 9)
        return 29;
      if (openingCode === 0)
        return 0;
      return void 0;
    };
    wrapAnsiCode = (code) => `${ESC}${ANSI_CSI}${code}${ANSI_SGR_TERMINATOR}`;
    wrapAnsiHyperlink = (url) => `${ESC}${ANSI_ESCAPE_LINK}${url}${ANSI_ESCAPE_BELL}`;
    wrapWord = (rows, word, columns) => {
      const characters = word[Symbol.iterator]();
      let isInsideEscape = false;
      let isInsideLinkEscape = false;
      let lastRow = rows.at(-1);
      let visible = lastRow === void 0 ? 0 : dist_default2(lastRow);
      let currentCharacter = characters.next();
      let nextCharacter = characters.next();
      let rawCharacterIndex = 0;
      while (!currentCharacter.done) {
        const character = currentCharacter.value;
        const characterLength = dist_default2(character);
        if (visible + characterLength <= columns) {
          rows[rows.length - 1] += character;
        } else {
          rows.push(character);
          visible = 0;
        }
        if (character === ESC || character === CSI) {
          isInsideEscape = true;
          isInsideLinkEscape = word.startsWith(ANSI_ESCAPE_LINK, rawCharacterIndex + 1);
        }
        if (isInsideEscape) {
          if (isInsideLinkEscape) {
            if (character === ANSI_ESCAPE_BELL) {
              isInsideEscape = false;
              isInsideLinkEscape = false;
            }
          } else if (character === ANSI_SGR_TERMINATOR) {
            isInsideEscape = false;
          }
        } else {
          visible += characterLength;
          if (visible === columns && !nextCharacter.done) {
            rows.push("");
            visible = 0;
          }
        }
        currentCharacter = nextCharacter;
        nextCharacter = characters.next();
        rawCharacterIndex += character.length;
      }
      lastRow = rows.at(-1);
      if (!visible && lastRow !== void 0 && lastRow.length && rows.length > 1) {
        rows[rows.length - 2] += rows.pop();
      }
    };
    stringVisibleTrimSpacesRight = (string) => {
      const words = string.split(" ");
      let last = words.length;
      while (last) {
        if (dist_default2(words[last - 1])) {
          break;
        }
        last--;
      }
      if (last === words.length) {
        return string;
      }
      return words.slice(0, last).join(" ") + words.slice(last).join("");
    };
    exec = (string, columns, options = {}) => {
      if (options.trim !== false && string.trim() === "") {
        return "";
      }
      let returnValue = "";
      let escapeCode;
      let escapeUrl;
      const words = string.split(" ");
      let rows = [""];
      let rowLength = 0;
      for (let index = 0; index < words.length; index++) {
        const word = words[index];
        if (options.trim !== false) {
          const row = rows.at(-1) ?? "";
          const trimmed = row.trimStart();
          if (row.length !== trimmed.length) {
            rows[rows.length - 1] = trimmed;
            rowLength = dist_default2(trimmed);
          }
        }
        if (index !== 0) {
          if (rowLength >= columns && (options.wordWrap === false || options.trim === false)) {
            rows.push("");
            rowLength = 0;
          }
          if (rowLength || options.trim === false) {
            rows[rows.length - 1] += " ";
            rowLength++;
          }
        }
        const wordLength = dist_default2(word);
        if (options.hard && wordLength > columns) {
          const remainingColumns = columns - rowLength;
          const breaksStartingThisLine = 1 + Math.floor((wordLength - remainingColumns - 1) / columns);
          const breaksStartingNextLine = Math.floor((wordLength - 1) / columns);
          if (breaksStartingNextLine < breaksStartingThisLine) {
            rows.push("");
          }
          wrapWord(rows, word, columns);
          rowLength = dist_default2(rows.at(-1) ?? "");
          continue;
        }
        if (rowLength + wordLength > columns && rowLength && wordLength) {
          if (options.wordWrap === false && rowLength < columns) {
            wrapWord(rows, word, columns);
            rowLength = dist_default2(rows.at(-1) ?? "");
            continue;
          }
          rows.push("");
          rowLength = 0;
        }
        if (rowLength + wordLength > columns && options.wordWrap === false) {
          wrapWord(rows, word, columns);
          rowLength = dist_default2(rows.at(-1) ?? "");
          continue;
        }
        rows[rows.length - 1] += word;
        rowLength += wordLength;
      }
      if (options.trim !== false) {
        rows = rows.map((row) => stringVisibleTrimSpacesRight(row));
      }
      const preString = rows.join("\n");
      let inSurrogate = false;
      for (let i2 = 0; i2 < preString.length; i2++) {
        const character = preString[i2];
        returnValue += character;
        if (!inSurrogate) {
          inSurrogate = character >= "\uD800" && character <= "\uDBFF";
          if (inSurrogate) {
            continue;
          }
        } else {
          inSurrogate = false;
        }
        if (character === ESC || character === CSI) {
          GROUP_REGEX.lastIndex = i2 + 1;
          const groupsResult = GROUP_REGEX.exec(preString);
          const groups = groupsResult?.groups;
          if (groups?.code !== void 0) {
            const code = Number.parseFloat(groups.code);
            escapeCode = code === END_CODE ? void 0 : code;
          } else if (groups?.uri !== void 0) {
            escapeUrl = groups.uri.length === 0 ? void 0 : groups.uri;
          }
        }
        if (preString[i2 + 1] === "\n") {
          if (escapeUrl) {
            returnValue += wrapAnsiHyperlink("");
          }
          const closingCode = escapeCode ? getClosingCode(escapeCode) : void 0;
          if (escapeCode && closingCode) {
            returnValue += wrapAnsiCode(closingCode);
          }
        } else if (character === "\n") {
          if (escapeCode && getClosingCode(escapeCode)) {
            returnValue += wrapAnsiCode(escapeCode);
          }
          if (escapeUrl) {
            returnValue += wrapAnsiHyperlink(escapeUrl);
          }
        }
      }
      return returnValue;
    };
    CRLF_OR_LF = /\r?\n/;
  }
});

// node_modules/.pnpm/sisteransi@1.0.5/node_modules/sisteransi/src/index.js
var require_src = __commonJS({
  "node_modules/.pnpm/sisteransi@1.0.5/node_modules/sisteransi/src/index.js"(exports, module) {
    "use strict";
    var ESC2 = "\x1B";
    var CSI2 = `${ESC2}[`;
    var beep = "\x07";
    var cursor3 = {
      to(x2, y) {
        if (!y) return `${CSI2}${x2 + 1}G`;
        return `${CSI2}${y + 1};${x2 + 1}H`;
      },
      move(x2, y) {
        let ret = "";
        if (x2 < 0) ret += `${CSI2}${-x2}D`;
        else if (x2 > 0) ret += `${CSI2}${x2}C`;
        if (y < 0) ret += `${CSI2}${-y}A`;
        else if (y > 0) ret += `${CSI2}${y}B`;
        return ret;
      },
      up: (count = 1) => `${CSI2}${count}A`,
      down: (count = 1) => `${CSI2}${count}B`,
      forward: (count = 1) => `${CSI2}${count}C`,
      backward: (count = 1) => `${CSI2}${count}D`,
      nextLine: (count = 1) => `${CSI2}E`.repeat(count),
      prevLine: (count = 1) => `${CSI2}F`.repeat(count),
      left: `${CSI2}G`,
      hide: `${CSI2}?25l`,
      show: `${CSI2}?25h`,
      save: `${ESC2}7`,
      restore: `${ESC2}8`
    };
    var scroll = {
      up: (count = 1) => `${CSI2}S`.repeat(count),
      down: (count = 1) => `${CSI2}T`.repeat(count)
    };
    var erase3 = {
      screen: `${CSI2}2J`,
      up: (count = 1) => `${CSI2}1J`.repeat(count),
      down: (count = 1) => `${CSI2}J`.repeat(count),
      line: `${CSI2}2K`,
      lineEnd: `${CSI2}K`,
      lineStart: `${CSI2}1K`,
      lines(count) {
        let clear = "";
        for (let i2 = 0; i2 < count; i2++)
          clear += this.line + (i2 < count - 1 ? cursor3.up() : "");
        if (count)
          clear += cursor3.left;
        return clear;
      }
    };
    module.exports = { cursor: cursor3, scroll, erase: erase3, beep };
  }
});

// node_modules/.pnpm/@clack+core@1.4.3/node_modules/@clack/core/dist/index.mjs
import { styleText } from "util";
import { stdout, stdin } from "process";
import * as l from "readline";
import l__default from "readline";
import { ReadStream } from "tty";
function findCursor(s, o2, l2) {
  if (!l2.some((r2) => !r2.disabled))
    return s;
  const t2 = s + o2, n3 = Math.max(l2.length - 1, 0), e = t2 < 0 ? n3 : t2 > n3 ? 0 : t2;
  return l2[e]?.disabled ? findCursor(e, o2 < 0 ? -1 : 1, l2) : e;
}
function findTextCursor(s, o2, l2, i2) {
  const t2 = i2.split(`
`);
  let n3 = 0, e = s;
  for (const r2 of t2) {
    if (e <= r2.length)
      break;
    e -= r2.length + 1, n3++;
  }
  for (n3 = Math.max(0, Math.min(t2.length - 1, n3 + l2)), e = Math.min(e, t2[n3].length) + o2; e < 0 && n3 > 0; )
    n3--, e += t2[n3].length + 1;
  for (; e > t2[n3].length && n3 < t2.length - 1; )
    e -= t2[n3].length + 1, n3++;
  e = Math.max(0, Math.min(t2[n3].length, e));
  let h2 = 0;
  for (let r2 = 0; r2 < n3; r2++)
    h2 += t2[r2].length + 1;
  return h2 + e;
}
function updateSettings(n3) {
  if (n3.aliases !== void 0) {
    const e = n3.aliases;
    for (const s in e) {
      if (!Object.hasOwn(e, s)) continue;
      const i2 = e[s];
      i2 === void 0 || !settings.actions.has(i2) || settings.aliases.has(s) || settings.aliases.set(s, i2);
    }
  }
  if (n3.messages !== void 0) {
    const e = n3.messages;
    e.cancel !== void 0 && (settings.messages.cancel = e.cancel), e.error !== void 0 && (settings.messages.error = e.error);
  }
  if (n3.withGuide !== void 0 && (settings.withGuide = n3.withGuide !== false), n3.date !== void 0) {
    const e = n3.date;
    e.monthNames !== void 0 && (settings.date.monthNames = [...e.monthNames]), e.messages !== void 0 && (e.messages.required !== void 0 && (settings.date.messages.required = e.messages.required), e.messages.invalidMonth !== void 0 && (settings.date.messages.invalidMonth = e.messages.invalidMonth), e.messages.invalidDay !== void 0 && (settings.date.messages.invalidDay = e.messages.invalidDay), e.messages.afterMin !== void 0 && (settings.date.messages.afterMin = e.messages.afterMin), e.messages.beforeMax !== void 0 && (settings.date.messages.beforeMax = e.messages.beforeMax));
  }
}
function isActionKey(n3, e) {
  if (typeof n3 == "string")
    return settings.aliases.get(n3) === e;
  for (const s of n3)
    if (s !== void 0 && isActionKey(s, e))
      return true;
  return false;
}
function diffLines(i2, s) {
  if (i2 === s) return;
  const e = i2.split(`
`), t2 = s.split(`
`), r2 = Math.max(e.length, t2.length), f2 = [];
  for (let n3 = 0; n3 < r2; n3++)
    e[n3] !== t2[n3] && f2.push(n3);
  return {
    lines: f2,
    numLinesBefore: e.length,
    numLinesAfter: t2.length,
    numLines: r2
  };
}
function isCancel(e) {
  return e === CANCEL_SYMBOL;
}
function setRawMode(e, r2) {
  const o2 = e;
  o2.isTTY && o2.setRawMode(r2);
}
function block({
  input: e = stdin,
  output: r2 = stdout,
  overwrite: o2 = true,
  hideCursor: t2 = true
} = {}) {
  const s = l.createInterface({
    input: e,
    output: r2,
    prompt: "",
    tabSize: 1
  });
  l.emitKeypressEvents(e, s), e instanceof ReadStream && e.isTTY && e.setRawMode(true);
  const n3 = (f2, { name: a2, sequence: p3 }) => {
    const c3 = String(f2);
    if (isActionKey([c3, a2, p3], "cancel")) {
      t2 && r2.write(import_sisteransi.cursor.show), process.exit(0);
      return;
    }
    if (!o2) return;
    const i2 = a2 === "return" ? 0 : -1, m3 = a2 === "return" ? -1 : 0;
    l.moveCursor(r2, i2, m3, () => {
      l.clearLine(r2, 1, () => {
        e.once("keypress", n3);
      });
    });
  };
  return t2 && r2.write(import_sisteransi.cursor.hide), e.once("keypress", n3), () => {
    e.off("keypress", n3), t2 && r2.write(import_sisteransi.cursor.show), e instanceof ReadStream && e.isTTY && !R && e.setRawMode(false), s.terminal = false, s.close();
  };
}
function wrapTextWithPrefix(e, r2, o2, t2 = o2, s = o2, n3) {
  const f2 = getColumns(e ?? stdout);
  return wrapAnsi(r2, f2 - o2.length, {
    hard: true,
    trim: false
  }).split(`
`).map((c3, i2, m3) => {
    const d = n3 ? n3(c3, i2) : c3;
    return i2 === 0 ? `${t2}${d}` : i2 === m3.length - 1 ? `${s}${d}` : `${o2}${d}`;
  }).join(`
`);
}
function runValidation(e, n3) {
  if ("~standard" in e) {
    const a2 = e["~standard"].validate(n3);
    if (a2 instanceof Promise)
      throw new TypeError(
        "Schema validation must be synchronous. Update `validate()` and remove any asynchronous logic."
      );
    return a2.issues?.at(0)?.message;
  }
  return e(n3);
}
function p$1(l2, e) {
  if (l2 === void 0 || e.length === 0)
    return 0;
  const i2 = e.findIndex((s) => s.value === l2);
  return i2 !== -1 ? i2 : 0;
}
function g(l2, e) {
  return (e.label ?? String(e.value)).toLowerCase().includes(l2.toLowerCase());
}
function m(l2, e) {
  if (e)
    return l2 ? e : e[0];
}
function M(r2) {
  return [...r2].map((t2) => _[t2]);
}
function P(r2) {
  const i2 = new Intl.DateTimeFormat(r2, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(2e3, 0, 15)), s = [];
  let n3 = "/";
  for (const e of i2)
    e.type === "literal" ? n3 = e.value.trim() || e.value : (e.type === "year" || e.type === "month" || e.type === "day") && s.push({ type: e.type, len: e.type === "year" ? 4 : 2 });
  return { segments: s, separator: n3 };
}
function p(r2) {
  return Number.parseInt((r2 || "0").replace(/_/g, "0"), 10) || 0;
}
function f(r2) {
  return {
    year: p(r2.year),
    month: p(r2.month),
    day: p(r2.day)
  };
}
function c(r2, t2) {
  return new Date(r2 || 2001, t2 || 1, 0).getDate();
}
function b(r2) {
  const { year: t2, month: i2, day: s } = f(r2);
  if (!t2 || t2 < 0 || t2 > 9999 || !i2 || i2 < 1 || i2 > 12 || !s || s < 1) return;
  const n3 = new Date(Date.UTC(t2, i2 - 1, s));
  if (!(n3.getUTCFullYear() !== t2 || n3.getUTCMonth() !== i2 - 1 || n3.getUTCDate() !== s))
    return { year: t2, month: i2, day: s };
}
function C(r2) {
  const t2 = b(r2);
  return t2 ? new Date(Date.UTC(t2.year, t2.month - 1, t2.day)) : void 0;
}
function T2(r2, t2, i2, s) {
  const n3 = i2 ? {
    year: i2.getUTCFullYear(),
    month: i2.getUTCMonth() + 1,
    day: i2.getUTCDate()
  } : null, e = s ? {
    year: s.getUTCFullYear(),
    month: s.getUTCMonth() + 1,
    day: s.getUTCDate()
  } : null;
  return r2 === "year" ? { min: n3?.year ?? 1, max: e?.year ?? 9999 } : r2 === "month" ? {
    min: n3 && t2.year === n3.year ? n3.month : 1,
    max: e && t2.year === e.year ? e.month : 12
  } : {
    min: n3 && t2.year === n3.year && t2.month === n3.month ? n3.day : 1,
    max: e && t2.year === e.year && t2.month === e.month ? e.day : c(t2.year, t2.month)
  };
}
var import_sisteransi, a$1, t, settings, R, CANCEL_SYMBOL, getColumns, getRows, V, T$1, r, _, U, u$2, o, h, a, u$1, n$1, u3, n2;
var init_dist3 = __esm({
  "node_modules/.pnpm/@clack+core@1.4.3/node_modules/@clack/core/dist/index.mjs"() {
    "use strict";
    init_main();
    import_sisteransi = __toESM(require_src(), 1);
    a$1 = ["up", "down", "left", "right", "space", "enter", "cancel"];
    t = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ];
    settings = {
      actions: new Set(a$1),
      aliases: /* @__PURE__ */ new Map([
        // vim support
        ["k", "up"],
        ["j", "down"],
        ["h", "left"],
        ["l", "right"],
        ["", "cancel"],
        // opinionated defaults!
        ["escape", "cancel"]
      ]),
      messages: {
        cancel: "Canceled",
        error: "Something went wrong"
      },
      withGuide: true,
      date: {
        monthNames: [...t],
        messages: {
          required: "Please enter a valid date",
          invalidMonth: "There are only 12 months in a year",
          invalidDay: (n3, e) => `There are only ${n3} days in ${e}`,
          afterMin: (n3) => `Date must be on or after ${n3.toISOString().slice(0, 10)}`,
          beforeMax: (n3) => `Date must be on or before ${n3.toISOString().slice(0, 10)}`
        }
      }
    };
    R = globalThis.process.platform.startsWith("win");
    CANCEL_SYMBOL = /* @__PURE__ */ Symbol("clack:cancel");
    getColumns = (e) => "columns" in e && typeof e.columns == "number" ? e.columns : 80;
    getRows = (e) => "rows" in e && typeof e.rows == "number" ? e.rows : 20;
    V = class {
      input;
      output;
      _abortSignal;
      rl;
      opts;
      _render;
      _track = false;
      _prevFrame = "";
      _subscribers = /* @__PURE__ */ new Map();
      _cursor = 0;
      state = "initial";
      error = "";
      value;
      userInput = "";
      constructor(t2, e = true) {
        const { input: i2 = stdin, output: n3 = stdout, render: s, signal: r2, ...o2 } = t2;
        this.opts = o2, this.onKeypress = this.onKeypress.bind(this), this.close = this.close.bind(this), this.render = this.render.bind(this), this._render = s.bind(this), this._track = e, this._abortSignal = r2, this.input = i2, this.output = n3;
      }
      /**
       * Unsubscribe all listeners
       */
      unsubscribe() {
        this._subscribers.clear();
      }
      /**
       * Set a subscriber with opts
       * @param event - The event name
       */
      setSubscriber(t2, e) {
        const i2 = this._subscribers.get(t2) ?? [];
        i2.push(e), this._subscribers.set(t2, i2);
      }
      /**
       * Subscribe to an event
       * @param event - The event name
       * @param cb - The callback
       */
      on(t2, e) {
        this.setSubscriber(t2, { cb: e });
      }
      /**
       * Subscribe to an event once
       * @param event - The event name
       * @param cb - The callback
       */
      once(t2, e) {
        this.setSubscriber(t2, { cb: e, once: true });
      }
      /**
       * Emit an event with data
       * @param event - The event name
       * @param data - The data to pass to the callback
       */
      emit(t2, ...e) {
        const i2 = this._subscribers.get(t2) ?? [], n3 = [];
        for (const s of i2)
          s.cb(...e), s.once && n3.push(() => i2.splice(i2.indexOf(s), 1));
        for (const s of n3)
          s();
      }
      prompt() {
        return new Promise((t2) => {
          if (this._abortSignal) {
            if (this._abortSignal.aborted)
              return this.state = "cancel", this.close(), t2(CANCEL_SYMBOL);
            this._abortSignal.addEventListener(
              "abort",
              () => {
                this.state = "cancel", this.close();
              },
              { once: true }
            );
          }
          this.rl = l__default.createInterface({
            input: this.input,
            tabSize: 2,
            prompt: "",
            escapeCodeTimeout: 50,
            terminal: true
          }), this.rl.prompt(), this.opts.initialUserInput !== void 0 && this._setUserInput(this.opts.initialUserInput, true), this.input.on("keypress", this.onKeypress), setRawMode(this.input, true), this.output.on("resize", this.render), this.render(), this.once("submit", () => {
            this.output.write(import_sisteransi.cursor.show), this.output.off("resize", this.render), setRawMode(this.input, false), t2(this.value);
          }), this.once("cancel", () => {
            this.output.write(import_sisteransi.cursor.show), this.output.off("resize", this.render), setRawMode(this.input, false), t2(CANCEL_SYMBOL);
          });
        });
      }
      _isActionKey(t2, e) {
        return t2 === "	";
      }
      _shouldSubmit(t2, e) {
        return true;
      }
      _setValue(t2) {
        this.value = t2, this.emit("value", this.value);
      }
      _setUserInput(t2, e) {
        this.userInput = t2 ?? "", this.emit("userInput", this.userInput), e && this._track && this.rl && (this.rl.write(this.userInput), this._cursor = this.rl.cursor);
      }
      _clearUserInput() {
        this.rl?.write(null, { ctrl: true, name: "u" }), this._setUserInput("");
      }
      onKeypress(t2, e) {
        if (this._track && e.name !== "return" && (e.name && this._isActionKey(t2, e) && this.rl?.write(null, { ctrl: true, name: "h" }), this._cursor = this.rl?.cursor ?? 0, this._setUserInput(this.rl?.line)), this.state === "error" && (this.state = "active"), e?.name && (!this._track && settings.aliases.has(e.name) && this.emit("cursor", settings.aliases.get(e.name)), settings.actions.has(e.name) && this.emit("cursor", e.name)), t2 && (t2.toLowerCase() === "y" || t2.toLowerCase() === "n") && this.emit("confirm", t2.toLowerCase() === "y"), this.emit("key", t2, e), e?.name === "return" && this._shouldSubmit(t2, e)) {
          if (this.opts.validate) {
            const i2 = runValidation(this.opts.validate, this.value);
            i2 && (this.error = i2 instanceof Error ? i2.message : i2, this.state = "error", this.rl?.write(this.userInput));
          }
          this.state !== "error" && (this.state = "submit");
        }
        isActionKey([t2, e?.name, e?.sequence], "cancel") && (this.state = "cancel"), (this.state === "submit" || this.state === "cancel") && this.emit("finalize"), this.render(), (this.state === "submit" || this.state === "cancel") && this.close();
      }
      close() {
        this.input.unpipe(), this.input.removeListener("keypress", this.onKeypress), this.output.write(`
`), setRawMode(this.input, false), this.rl?.close(), this.rl = void 0, this.emit(`${this.state}`, this.value), this.unsubscribe();
      }
      restoreCursor() {
        const t2 = wrapAnsi(this._prevFrame, process.stdout.columns, { hard: true, trim: false }).split(`
`).length - 1;
        this.output.write(import_sisteransi.cursor.move(-999, t2 * -1));
      }
      render() {
        const t2 = wrapAnsi(this._render(this) ?? "", process.stdout.columns, {
          hard: true,
          trim: false
        });
        if (t2 !== this._prevFrame) {
          if (this.state === "initial")
            this.output.write(import_sisteransi.cursor.hide);
          else {
            const e = diffLines(this._prevFrame, t2), i2 = getRows(this.output);
            if (this.restoreCursor(), e) {
              const n3 = Math.max(0, e.numLinesAfter - i2), s = Math.max(0, e.numLinesBefore - i2);
              let r2 = e.lines.find((o2) => o2 >= n3);
              if (r2 === void 0) {
                this._prevFrame = t2;
                return;
              }
              if (e.lines.length === 1) {
                this.output.write(import_sisteransi.cursor.move(0, r2 - s)), this.output.write(import_sisteransi.erase.lines(1));
                const o2 = t2.split(`
`);
                this.output.write(o2[r2]), this._prevFrame = t2, this.output.write(import_sisteransi.cursor.move(0, o2.length - r2 - 1));
                return;
              } else if (e.lines.length > 1) {
                if (n3 < s)
                  r2 = n3;
                else {
                  const h2 = r2 - s;
                  h2 > 0 && this.output.write(import_sisteransi.cursor.move(0, h2));
                }
                this.output.write(import_sisteransi.erase.down());
                const f2 = t2.split(`
`).slice(r2);
                this.output.write(f2.join(`
`)), this._prevFrame = t2;
                return;
              }
            }
            this.output.write(import_sisteransi.erase.down());
          }
          this.output.write(t2), this.state === "initial" && (this.state = "active"), this._prevFrame = t2;
        }
      }
    };
    T$1 = class T extends V {
      filteredOptions;
      multiple;
      isNavigating = false;
      selectedValues = [];
      focusedValue;
      #e = 0;
      #s = "";
      #t;
      #i;
      #n;
      get cursor() {
        return this.#e;
      }
      get userInputWithCursor() {
        if (!this.userInput)
          return styleText(["inverse", "hidden"], "_");
        if (this._cursor >= this.userInput.length)
          return `${this.userInput}\u2588`;
        const e = this.userInput.slice(0, this.cursor), t2 = this.userInput.slice(this.cursor, this.cursor + 1), i2 = this.userInput.slice(this.cursor + 1);
        return `${e}${styleText("inverse", t2)}${i2}`;
      }
      get options() {
        return typeof this.#i == "function" ? this.#i() : this.#i;
      }
      constructor(e) {
        super(e), this.#i = e.options, this.#n = e.placeholder;
        const t2 = this.options;
        this.filteredOptions = [...t2], this.multiple = e.multiple === true, this.#t = typeof e.options == "function" ? e.filter : e.filter ?? g;
        let i2;
        if (e.initialValue && Array.isArray(e.initialValue) ? this.multiple ? i2 = e.initialValue : i2 = e.initialValue.slice(0, 1) : !this.multiple && this.options.length > 0 && (i2 = [this.options[0]?.value]), i2)
          for (const s of i2) {
            const n3 = t2.findIndex((o2) => o2.value === s);
            n3 !== -1 && (this.toggleSelected(s), this.#e = n3);
          }
        this.focusedValue = this.options[this.#e]?.value, this.on("key", (s, n3) => this.#l(s, n3)), this.on("userInput", (s) => this.#u(s));
      }
      _isActionKey(e, t2) {
        return e === "	" || this.multiple && this.isNavigating && t2.name === "space" && e !== void 0 && e !== "";
      }
      #l(e, t2) {
        const i2 = t2.name === "up", s = t2.name === "down", n3 = t2.name === "return", o2 = this.userInput === "" || this.userInput === "	", u5 = this.#n, a2 = this.options, f2 = u5 !== void 0 && u5 !== "" && a2.some(
          (r2) => !r2.disabled && (this.#t ? this.#t(u5, r2) : true)
        );
        if (t2.name === "tab" && o2 && f2) {
          this.userInput === "	" && this._clearUserInput(), this._setUserInput(u5, true), this.isNavigating = false;
          return;
        }
        i2 || s ? (this.#e = findCursor(this.#e, i2 ? -1 : 1, this.filteredOptions), this.focusedValue = this.filteredOptions[this.#e]?.value, this.multiple || (this.selectedValues = [this.focusedValue]), this.isNavigating = true) : n3 ? this.value = m(this.multiple, this.selectedValues) : this.multiple ? this.focusedValue !== void 0 && (t2.name === "tab" || this.isNavigating && t2.name === "space") ? this.toggleSelected(this.focusedValue) : this.isNavigating = false : (this.focusedValue && (this.selectedValues = [this.focusedValue]), this.isNavigating = false);
      }
      deselectAll() {
        this.selectedValues = [];
      }
      toggleSelected(e) {
        this.filteredOptions.length !== 0 && (this.multiple ? this.selectedValues.includes(e) ? this.selectedValues = this.selectedValues.filter((t2) => t2 !== e) : this.selectedValues = [...this.selectedValues, e] : this.selectedValues = [e]);
      }
      #u(e) {
        if (e !== this.#s) {
          this.#s = e;
          const t2 = this.options;
          e && this.#t ? this.filteredOptions = t2.filter((n3) => this.#t?.(e, n3)) : this.filteredOptions = [...t2];
          const i2 = p$1(this.focusedValue, this.filteredOptions);
          this.#e = findCursor(i2, 0, this.filteredOptions);
          const s = this.filteredOptions[this.#e];
          s && !s.disabled ? this.focusedValue = s.value : this.focusedValue = void 0, this.multiple || (this.focusedValue !== void 0 ? this.toggleSelected(this.focusedValue) : this.deselectAll());
        }
      }
    };
    r = class extends V {
      get cursor() {
        return this.value ? 0 : 1;
      }
      get _value() {
        return this.cursor === 0;
      }
      constructor(t2) {
        super(t2, false), this.value = !!t2.initialValue, this.on("userInput", () => {
          this.value = this._value;
        }), this.on("confirm", (i2) => {
          this.output.write(import_sisteransi.cursor.move(0, -1)), this.value = i2, this.state = "submit", this.close();
        }), this.on("cursor", () => {
          this.value = !this.value;
        });
      }
    };
    _ = {
      Y: { type: "year", len: 4 },
      M: { type: "month", len: 2 },
      D: { type: "day", len: 2 }
    };
    U = class extends V {
      #i;
      #o;
      #t;
      #h;
      #u;
      #e = { segmentIndex: 0, positionInSegment: 0 };
      #n = true;
      #s = null;
      inlineError = "";
      get segmentCursor() {
        return { ...this.#e };
      }
      get segmentValues() {
        return { ...this.#t };
      }
      get segments() {
        return this.#i;
      }
      get separator() {
        return this.#o;
      }
      get formattedValue() {
        return this.#l(this.#t);
      }
      #l(t2) {
        return this.#i.map((i2) => t2[i2.type]).join(this.#o);
      }
      #r() {
        this._setUserInput(this.#l(this.#t)), this._setValue(C(this.#t) ?? void 0);
      }
      constructor(t2) {
        const i2 = t2.format ? { segments: M(t2.format), separator: t2.separator ?? "/" } : P(t2.locale), s = t2.separator ?? i2.separator, n3 = t2.format ? M(t2.format) : i2.segments, e = t2.initialValue ?? t2.defaultValue, m3 = e ? {
          year: String(e.getUTCFullYear()).padStart(4, "0"),
          month: String(e.getUTCMonth() + 1).padStart(2, "0"),
          day: String(e.getUTCDate()).padStart(2, "0")
        } : { year: "____", month: "__", day: "__" }, o2 = n3.map((a2) => m3[a2.type]).join(s);
        super({ ...t2, initialUserInput: o2 }, false), this.#i = n3, this.#o = s, this.#t = m3, this.#h = t2.minDate, this.#u = t2.maxDate, this.#r(), this.on("cursor", (a2) => this.#f(a2)), this.on("key", (a2, u5) => this.#y(a2, u5)), this.on("finalize", () => this.#p(t2));
      }
      #a() {
        const t2 = Math.max(0, Math.min(this.#e.segmentIndex, this.#i.length - 1)), i2 = this.#i[t2];
        if (i2)
          return this.#e.positionInSegment = Math.max(
            0,
            Math.min(this.#e.positionInSegment, i2.len - 1)
          ), { segment: i2, index: t2 };
      }
      #m(t2) {
        this.inlineError = "", this.#s = null;
        const i2 = this.#a();
        i2 && (this.#e.segmentIndex = Math.max(
          0,
          Math.min(this.#i.length - 1, i2.index + t2)
        ), this.#e.positionInSegment = 0, this.#n = true);
      }
      #d(t2) {
        const i2 = this.#a();
        if (!i2) return;
        const { segment: s } = i2, n3 = this.#t[s.type], e = !n3 || n3.replace(/_/g, "") === "", m3 = Number.parseInt((n3 || "0").replace(/_/g, "0"), 10) || 0, o2 = T2(
          s.type,
          f(this.#t),
          this.#h,
          this.#u
        );
        let a2;
        e ? a2 = t2 === 1 ? o2.min : o2.max : a2 = Math.max(Math.min(o2.max, m3 + t2), o2.min), this.#t = {
          ...this.#t,
          [s.type]: a2.toString().padStart(s.len, "0")
        }, this.#n = true, this.#s = null, this.#r();
      }
      #f(t2) {
        if (t2)
          switch (t2) {
            case "right":
              return this.#m(1);
            case "left":
              return this.#m(-1);
            case "up":
              return this.#d(1);
            case "down":
              return this.#d(-1);
          }
      }
      #y(t2, i2) {
        if (i2?.name === "backspace" || i2?.sequence === "\x7F" || i2?.sequence === "\b" || t2 === "\x7F" || t2 === "\b") {
          this.inlineError = "";
          const n3 = this.#a();
          if (!n3) return;
          if (!this.#t[n3.segment.type].replace(/_/g, "")) {
            this.#m(-1);
            return;
          }
          this.#t[n3.segment.type] = "_".repeat(n3.segment.len), this.#n = true, this.#e.positionInSegment = 0, this.#r();
          return;
        }
        if (i2?.name === "tab") {
          this.inlineError = "";
          const n3 = this.#a();
          if (!n3) return;
          const e = i2.shift ? -1 : 1, m3 = n3.index + e;
          m3 >= 0 && m3 < this.#i.length && (this.#e.segmentIndex = m3, this.#e.positionInSegment = 0, this.#n = true);
          return;
        }
        if (t2 && /^[0-9]$/.test(t2)) {
          const n3 = this.#a();
          if (!n3) return;
          const { segment: e } = n3, m3 = !this.#t[e.type].replace(/_/g, "");
          if (this.#n && this.#s !== null && !m3) {
            const h2 = this.#s + t2, d = { ...this.#t, [e.type]: h2 }, g2 = this.#g(d, e);
            if (g2) {
              this.inlineError = g2, this.#s = null, this.#n = false;
              return;
            }
            this.inlineError = "", this.#t[e.type] = h2, this.#s = null, this.#n = false, this.#r(), n3.index < this.#i.length - 1 && (this.#e.segmentIndex = n3.index + 1, this.#e.positionInSegment = 0, this.#n = true);
            return;
          }
          this.#n && !m3 && (this.#t[e.type] = "_".repeat(e.len), this.#e.positionInSegment = 0), this.#n = false, this.#s = null;
          const o2 = this.#t[e.type], a2 = o2.indexOf("_"), u5 = a2 >= 0 ? a2 : Math.min(this.#e.positionInSegment, e.len - 1);
          if (u5 < 0 || u5 >= e.len) return;
          let l2 = o2.slice(0, u5) + t2 + o2.slice(u5 + 1), D = false;
          if (u5 === 0 && o2 === "__" && (e.type === "month" || e.type === "day")) {
            const h2 = Number.parseInt(t2, 10);
            l2 = `0${t2}`, D = h2 <= (e.type === "month" ? 1 : 2);
          }
          if (e.type === "year" && (l2 = (o2.replace(/_/g, "") + t2).padStart(e.len, "_")), !l2.includes("_")) {
            const h2 = { ...this.#t, [e.type]: l2 }, d = this.#g(h2, e);
            if (d) {
              this.inlineError = d;
              return;
            }
          }
          this.inlineError = "", this.#t[e.type] = l2;
          const y = l2.includes("_") ? void 0 : b(this.#t);
          if (y) {
            const { year: h2, month: d } = y, g2 = c(h2, d);
            this.#t = {
              year: String(Math.max(0, Math.min(9999, h2))).padStart(4, "0"),
              month: String(Math.max(1, Math.min(12, d))).padStart(2, "0"),
              day: String(Math.max(1, Math.min(g2, y.day))).padStart(2, "0")
            };
          }
          this.#r();
          const S = l2.indexOf("_");
          D ? (this.#n = true, this.#s = t2) : S >= 0 ? this.#e.positionInSegment = S : a2 >= 0 && n3.index < this.#i.length - 1 ? (this.#e.segmentIndex = n3.index + 1, this.#e.positionInSegment = 0, this.#n = true) : this.#e.positionInSegment = Math.min(u5 + 1, e.len - 1);
        }
      }
      #g(t2, i2) {
        const { month: s, day: n3 } = f(t2);
        if (i2.type === "month" && (s < 0 || s > 12))
          return settings.date.messages.invalidMonth;
        if (i2.type === "day" && (n3 < 0 || n3 > 31))
          return settings.date.messages.invalidDay(31, "any month");
      }
      #p(t2) {
        const { year: i2, month: s, day: n3 } = f(this.#t);
        if (i2 && s && n3) {
          const e = c(i2, s);
          this.#t = {
            ...this.#t,
            day: String(Math.min(n3, e)).padStart(2, "0")
          };
        }
        this.value = C(this.#t) ?? t2.defaultValue ?? void 0;
      }
    };
    u$2 = class u extends V {
      options;
      cursor = 0;
      #t;
      getGroupItems(t2) {
        return this.options.filter((r2) => r2.group === t2);
      }
      isGroupSelected(t2) {
        const r2 = this.getGroupItems(t2), e = this.value;
        return e === void 0 ? false : r2.every((s) => e.includes(s.value));
      }
      toggleValue() {
        const t2 = this.options[this.cursor];
        if (t2 !== void 0)
          if (this.value === void 0 && (this.value = []), t2.group === true) {
            const r2 = t2.value, e = this.getGroupItems(r2);
            this.isGroupSelected(r2) ? this.value = this.value.filter(
              (s) => e.findIndex((i2) => i2.value === s) === -1
            ) : this.value = [...this.value, ...e.map((s) => s.value)], this.value = Array.from(new Set(this.value));
          } else {
            const r2 = this.value.includes(t2.value);
            this.value = r2 ? this.value.filter((e) => e !== t2.value) : [...this.value, t2.value];
          }
      }
      constructor(t2) {
        super(t2, false);
        const { options: r2 } = t2;
        this.#t = t2.selectableGroups !== false, this.options = Object.entries(r2).flatMap(([e, s]) => [
          { value: e, group: true, label: e },
          ...s.map((i2) => ({ ...i2, group: e }))
        ]), this.value = [...t2.initialValues ?? []], this.cursor = Math.max(
          this.options.findIndex(({ value: e }) => e === t2.cursorAt),
          this.#t ? 0 : 1
        ), this.on("cursor", (e) => {
          switch (e) {
            case "left":
            case "up": {
              this.cursor = this.cursor === 0 ? this.options.length - 1 : this.cursor - 1;
              const s = this.options[this.cursor]?.group === true;
              !this.#t && s && (this.cursor = this.cursor === 0 ? this.options.length - 1 : this.cursor - 1);
              break;
            }
            case "down":
            case "right": {
              this.cursor = this.cursor === this.options.length - 1 ? 0 : this.cursor + 1;
              const s = this.options[this.cursor]?.group === true;
              !this.#t && s && (this.cursor = this.cursor === this.options.length - 1 ? 0 : this.cursor + 1);
              break;
            }
            case "space":
              this.toggleValue();
              break;
          }
        });
      }
    };
    o = /* @__PURE__ */ new Set(["up", "down", "left", "right"]);
    h = class extends V {
      #t = false;
      #s;
      focused = "editor";
      get userInputWithCursor() {
        if (this.state === "submit")
          return this.userInput;
        const t2 = this.userInput;
        if (this.cursor >= t2.length)
          return `${t2}\u2588`;
        const s = t2.slice(0, this.cursor), r2 = t2.slice(this.cursor, this.cursor + 1), i2 = t2.slice(this.cursor + 1);
        return r2 === `
` ? `${s}\u2588
${i2}` : `${s}${styleText("inverse", r2)}${i2}`;
      }
      get cursor() {
        return this._cursor;
      }
      #r(t2) {
        if (this.userInput.length === 0) {
          this._setUserInput(t2);
          return;
        }
        this._setUserInput(
          this.userInput.slice(0, this.cursor) + t2 + this.userInput.slice(this.cursor)
        );
      }
      #i(t2) {
        const s = this.value ?? "";
        switch (t2) {
          case "up":
            this._cursor = findTextCursor(this._cursor, 0, -1, s);
            return;
          case "down":
            this._cursor = findTextCursor(this._cursor, 0, 1, s);
            return;
          case "left":
            this._cursor = findTextCursor(this._cursor, -1, 0, s);
            return;
          case "right":
            this._cursor = findTextCursor(this._cursor, 1, 0, s);
            return;
        }
      }
      _shouldSubmit(t2, s) {
        if (this.#s)
          return this.focused === "submit" ? true : (this.#r(`
`), this._cursor++, false);
        const r2 = this.#t;
        return this.#t = true, r2 && this.cursor === this.userInput.length ? (this.userInput[this.cursor - 1] === `
` && (this._setUserInput(
          this.userInput.slice(0, this.cursor - 1) + this.userInput.slice(this.cursor)
        ), this._cursor--), true) : (this.#r(`
`), this._cursor++, false);
      }
      constructor(t2) {
        const s = t2.initialUserInput ?? t2.initialValue;
        super(
          {
            ...t2,
            initialUserInput: s
          },
          false
        ), s !== void 0 && (this._cursor = s.length), this.#s = t2.showSubmit ?? false, this.on("key", (r2, i2) => {
          if (i2?.name && o.has(i2.name)) {
            this.#t = false, this.#i(i2.name);
            return;
          }
          if (r2 === "	" && this.#s) {
            this.focused = this.focused === "editor" ? "submit" : "editor";
            return;
          }
          if (i2?.name !== "return") {
            if (this.#t = false, i2?.name === "backspace" && this.cursor > 0) {
              this._setUserInput(
                this.userInput.slice(0, this.cursor - 1) + this.userInput.slice(this.cursor)
              ), this._cursor--;
              return;
            }
            if (i2?.name === "delete" && this.cursor < this.userInput.length) {
              this._setUserInput(
                this.userInput.slice(0, this.cursor) + this.userInput.slice(this.cursor + 1)
              );
              return;
            }
            r2 && (this.#s && this.focused === "submit" && (this.focused = "editor"), this.#r(r2 ?? ""), this._cursor++);
          }
        }), this.on("userInput", (r2) => {
          this._setValue(r2);
        }), this.on("finalize", () => {
          this.value || (this.value = t2.defaultValue), this.value === void 0 && (this.value = "");
        });
      }
    };
    a = class extends V {
      options;
      cursor = 0;
      get _value() {
        return this.options[this.cursor]?.value;
      }
      get _enabledOptions() {
        return this.options.filter((e) => e.disabled !== true);
      }
      toggleAll() {
        const e = this._enabledOptions, i2 = this.value !== void 0 && this.value.length === e.length;
        this.value = i2 ? [] : e.map((t2) => t2.value);
      }
      toggleInvert() {
        const e = this.value;
        if (!e)
          return;
        const i2 = this._enabledOptions.filter((t2) => !e.includes(t2.value));
        this.value = i2.map((t2) => t2.value);
      }
      toggleValue() {
        this.value === void 0 && (this.value = []);
        const e = this.value.includes(this._value);
        this.value = e ? this.value.filter((i2) => i2 !== this._value) : [...this.value, this._value];
      }
      constructor(e) {
        super(e, false), this.options = e.options, this.value = [...e.initialValues ?? []];
        const i2 = Math.max(
          this.options.findIndex(({ value: t2 }) => t2 === e.cursorAt),
          0
        );
        this.cursor = this.options[i2]?.disabled ? findCursor(i2, 1, this.options) : i2, this.on("key", (t2, l2) => {
          l2.name === "a" && this.toggleAll(), l2.name === "i" && this.toggleInvert();
        }), this.on("cursor", (t2) => {
          switch (t2) {
            case "left":
            case "up":
              this.cursor = findCursor(this.cursor, -1, this.options);
              break;
            case "down":
            case "right":
              this.cursor = findCursor(this.cursor, 1, this.options);
              break;
            case "space":
              this.toggleValue();
              break;
          }
        });
      }
    };
    u$1 = class u2 extends V {
      _mask = "\u2022";
      get cursor() {
        return this._cursor;
      }
      get masked() {
        return this.userInput.replaceAll(/./g, this._mask);
      }
      get userInputWithCursor() {
        if (this.state === "submit" || this.state === "cancel")
          return this.masked;
        const t2 = this.userInput;
        if (this.cursor >= t2.length)
          return `${this.masked}${styleText(["inverse", "hidden"], "_")}`;
        const s = this.masked, r2 = s.slice(0, this.cursor), i2 = s.slice(this.cursor, this.cursor + 1), o2 = s.slice(this.cursor + 1);
        return `${r2}${styleText("inverse", i2)}${o2}`;
      }
      clear() {
        this._clearUserInput();
      }
      constructor({ mask: t2, ...s }) {
        super(s), this._mask = t2 ?? "\u2022", this.on("userInput", (r2) => {
          this._setValue(r2);
        }), this.on("finalize", () => {
          this.value === void 0 && (this.value = "");
        });
      }
    };
    n$1 = class n extends V {
      options;
      cursor = 0;
      get _selectedValue() {
        return this.options[this.cursor];
      }
      changeValue() {
        const e = this._selectedValue;
        this.value = e === void 0 ? void 0 : e.value;
      }
      constructor(e) {
        super(e, false), this.options = e.options;
        const o2 = this.options.findIndex(({ value: s }) => s === e.initialValue), t2 = o2 === -1 ? 0 : o2;
        this.cursor = this.options[t2]?.disabled ? findCursor(t2, 1, this.options) : t2, this.changeValue(), this.on("cursor", (s) => {
          switch (s) {
            case "left":
            case "up":
              this.cursor = findCursor(this.cursor, -1, this.options);
              break;
            case "down":
            case "right":
              this.cursor = findCursor(this.cursor, 1, this.options);
              break;
          }
          this.changeValue();
        });
      }
    };
    u3 = class extends V {
      options;
      cursor = 0;
      constructor(t2) {
        super(t2, false), this.options = t2.options;
        const s = t2.caseSensitive === true, i2 = this.options.map(({ value: [e] }) => s ? e : e?.toLowerCase());
        this.cursor = Math.max(i2.indexOf(t2.initialValue), 0), this.on("key", (e) => {
          if (!e)
            return;
          const o2 = s ? e : e.toLowerCase();
          if (!i2.includes(o2))
            return;
          const n3 = this.options.find(({ value: [r2] }) => s ? r2 === o2 : r2?.toLowerCase() === o2);
          n3 && (this.value = n3.value, this.state = "submit", this.emit("submit"));
        });
      }
    };
    n2 = class extends V {
      get userInputWithCursor() {
        if (this.state === "submit")
          return this.userInput;
        const t2 = this.userInput;
        if (this.cursor >= t2.length)
          return `${this.userInput}\u2588`;
        const r2 = t2.slice(0, this.cursor), s = t2.slice(this.cursor, this.cursor + 1), e = t2.slice(this.cursor + 1);
        return `${r2}${styleText("inverse", s)}${e}`;
      }
      get cursor() {
        return this._cursor;
      }
      constructor(t2) {
        super({
          ...t2,
          initialUserInput: t2.initialUserInput ?? t2.initialValue
        }), this.on("userInput", (r2) => {
          this._setValue(r2);
        }), this.on("finalize", () => {
          this.value || (this.value = t2.defaultValue), this.value === void 0 && (this.value = "");
        });
      }
    };
  }
});

// node_modules/.pnpm/@clack+prompts@1.7.0/node_modules/@clack/prompts/dist/index.mjs
var dist_exports = {};
__export(dist_exports, {
  MULTISELECT_INSTRUCTIONS: () => MULTISELECT_INSTRUCTIONS,
  SELECT_INSTRUCTIONS: () => SELECT_INSTRUCTIONS,
  S_BAR: () => S_BAR,
  S_BAR_END: () => S_BAR_END,
  S_BAR_END_RIGHT: () => S_BAR_END_RIGHT,
  S_BAR_H: () => S_BAR_H,
  S_BAR_START: () => S_BAR_START,
  S_BAR_START_RIGHT: () => S_BAR_START_RIGHT,
  S_CHECKBOX_ACTIVE: () => S_CHECKBOX_ACTIVE,
  S_CHECKBOX_INACTIVE: () => S_CHECKBOX_INACTIVE,
  S_CHECKBOX_SELECTED: () => S_CHECKBOX_SELECTED,
  S_CONNECT_LEFT: () => S_CONNECT_LEFT,
  S_CORNER_BOTTOM_LEFT: () => S_CORNER_BOTTOM_LEFT,
  S_CORNER_BOTTOM_RIGHT: () => S_CORNER_BOTTOM_RIGHT,
  S_CORNER_TOP_LEFT: () => S_CORNER_TOP_LEFT,
  S_CORNER_TOP_RIGHT: () => S_CORNER_TOP_RIGHT,
  S_ERROR: () => S_ERROR,
  S_INFO: () => S_INFO,
  S_PASSWORD_MASK: () => S_PASSWORD_MASK,
  S_RADIO_ACTIVE: () => S_RADIO_ACTIVE,
  S_RADIO_INACTIVE: () => S_RADIO_INACTIVE,
  S_STEP_ACTIVE: () => S_STEP_ACTIVE,
  S_STEP_CANCEL: () => S_STEP_CANCEL,
  S_STEP_ERROR: () => S_STEP_ERROR,
  S_STEP_SUBMIT: () => S_STEP_SUBMIT,
  S_SUCCESS: () => S_SUCCESS,
  S_WARN: () => S_WARN,
  autocomplete: () => autocomplete,
  autocompleteMultiselect: () => autocompleteMultiselect,
  box: () => box,
  cancel: () => cancel,
  confirm: () => confirm,
  date: () => date,
  formatInstructionFooter: () => formatInstructionFooter,
  group: () => group2,
  groupMultiselect: () => groupMultiselect,
  intro: () => intro,
  isCI: () => isCI,
  isCancel: () => isCancel,
  isTTY: () => isTTY,
  limitOptions: () => limitOptions,
  log: () => log,
  multiline: () => multiline,
  multiselect: () => multiselect,
  note: () => note,
  outro: () => outro,
  password: () => password,
  path: () => path,
  progress: () => progress,
  select: () => select,
  selectKey: () => selectKey,
  settings: () => settings,
  spinner: () => spinner,
  stream: () => stream,
  symbol: () => symbol,
  symbolBar: () => symbolBar,
  taskLog: () => taskLog,
  tasks: () => tasks,
  text: () => text,
  unicode: () => unicode,
  unicodeOr: () => unicodeOr,
  updateSettings: () => updateSettings
});
import { styleText as styleText2, stripVTControlCharacters } from "util";
import process$1 from "process";
import { existsSync, lstatSync, readdirSync as readdirSync2 } from "fs";
import { dirname as dirname3, join as join5 } from "path";
function isUnicodeSupported() {
  if (process$1.platform !== "win32") {
    return process$1.env.TERM !== "linux";
  }
  return Boolean(process$1.env.CI) || Boolean(process$1.env.WT_SESSION) || Boolean(process$1.env.TERMINUS_SUBLIME) || process$1.env.ConEmuTask === "{cmd::Cmder}" || process$1.env.TERM_PROGRAM === "Terminus-Sublime" || process$1.env.TERM_PROGRAM === "vscode" || process$1.env.TERM === "xterm-256color" || process$1.env.TERM === "alacritty" || process$1.env.TERMINAL_EMULATOR === "JetBrains-JediTerm";
}
function formatInstructionFooter(o2, e) {
  const r2 = [`${e ? `${styleText2("cyan", S_BAR)}  ` : ""}${o2.join(" \u2022 ")}`];
  return e && r2.push(styleText2("cyan", S_BAR_END)), r2;
}
function P2(t2) {
  return t2.label ?? String(t2.value ?? "");
}
function E(t2, c3) {
  if (!t2)
    return true;
  const n3 = (c3.label ?? String(c3.value ?? "")).toLowerCase(), i2 = (c3.hint ?? "").toLowerCase(), l2 = String(c3.value).toLowerCase(), o2 = t2.toLowerCase();
  return n3.includes(o2) || i2.includes(o2) || l2.includes(o2);
}
function N(t2, c3) {
  const n3 = [];
  for (const i2 of c3)
    t2.includes(i2.value) && n3.push(i2);
  return n3;
}
function A$1(n3, e, t2, o2) {
  let i2 = t2, f2 = t2;
  return o2 === "center" ? i2 = Math.floor((e - n3) / 2) : o2 === "right" && (i2 = e - n3 - t2), f2 = e - i2 - n3, [i2, f2];
}
function b2(e, r2) {
  const t2 = e.segmentValues, o2 = e.segmentCursor;
  if (r2 === "submit" || r2 === "cancel")
    return e.formattedValue;
  const i2 = styleText2("gray", e.separator);
  return e.segments.map((l2, d) => {
    const c3 = d === o2.segmentIndex && !["submit", "cancel"].includes(r2), a2 = p2[l2.type];
    return x(t2[l2.type], { isActive: c3, label: a2 });
  }).join(i2);
}
function x(e, r2) {
  const t2 = !e || e.replace(/_/g, "") === "";
  return r2.isActive ? styleText2("inverse", t2 ? r2.label : e.replace(/_/g, " ")) : t2 ? styleText2("dim", r2.label) : e.replace(/_/g, styleText2("dim", " "));
}
function progress({
  style: o2 = "heavy",
  max: d = 100,
  size: v = 40,
  ...x2
} = {}) {
  const r2 = spinner(x2);
  let a2 = 0, n3 = "";
  const c3 = Math.max(1, d), l2 = Math.max(1, v), S = (t2) => {
    switch (t2) {
      case "initial":
      case "active":
        return (e) => styleText2("magenta", e);
      case "error":
      case "cancel":
        return (e) => styleText2("red", e);
      case "submit":
        return (e) => styleText2("green", e);
      default:
        return (e) => styleText2("magenta", e);
    }
  }, p3 = (t2, e) => {
    const m3 = Math.floor(a2 / c3 * l2);
    return `${S(t2)(u4[o2].repeat(m3))}${styleText2("dim", u4[o2].repeat(l2 - m3))} ${e}`;
  }, h2 = (t2 = "") => {
    n3 = t2, r2.start(p3("initial", t2));
  }, g2 = (t2 = 1, e) => {
    a2 = Math.min(c3, t2 + a2), r2.message(p3("active", e ?? n3)), n3 = e ?? n3;
  };
  return {
    start: h2,
    stop: r2.stop,
    cancel: r2.cancel,
    error: r2.error,
    clear: r2.clear,
    advance: g2,
    isCancelled: r2.isCancelled,
    message: (t2) => g2(0, t2)
  };
}
var import_sisteransi2, unicode, isCI, isTTY, unicodeOr, S_STEP_ACTIVE, S_STEP_CANCEL, S_STEP_ERROR, S_STEP_SUBMIT, S_BAR_START, S_BAR, S_BAR_END, S_BAR_START_RIGHT, S_BAR_END_RIGHT, S_RADIO_ACTIVE, S_RADIO_INACTIVE, S_CHECKBOX_ACTIVE, S_CHECKBOX_SELECTED, S_CHECKBOX_INACTIVE, S_PASSWORD_MASK, S_BAR_H, S_CORNER_TOP_RIGHT, S_CONNECT_LEFT, S_CORNER_BOTTOM_RIGHT, S_CORNER_BOTTOM_LEFT, S_CORNER_TOP_LEFT, S_INFO, S_SUCCESS, S_WARN, S_ERROR, symbol, symbolBar, I, limitOptions, autocomplete, autocompleteMultiselect, J, K, Q, box, confirm, date, p2, group2, MULTISELECT_INSTRUCTIONS, m2, multiselect, groupMultiselect, log, cancel, intro, outro, multiline, W$1, C2, note, password, path, W, spinner, u4, SELECT_INSTRUCTIONS, c2, select, selectKey, i, stream, tasks, A, taskLog, text;
var init_dist4 = __esm({
  "node_modules/.pnpm/@clack+prompts@1.7.0/node_modules/@clack/prompts/dist/index.mjs"() {
    "use strict";
    init_dist3();
    init_dist3();
    init_main();
    init_dist2();
    import_sisteransi2 = __toESM(require_src(), 1);
    unicode = isUnicodeSupported();
    isCI = () => process.env.CI === "true";
    isTTY = (o2) => o2.isTTY === true;
    unicodeOr = (o2, e) => unicode ? o2 : e;
    S_STEP_ACTIVE = unicodeOr("\u25C6", "*");
    S_STEP_CANCEL = unicodeOr("\u25A0", "x");
    S_STEP_ERROR = unicodeOr("\u25B2", "x");
    S_STEP_SUBMIT = unicodeOr("\u25C7", "o");
    S_BAR_START = unicodeOr("\u250C", "T");
    S_BAR = unicodeOr("\u2502", "|");
    S_BAR_END = unicodeOr("\u2514", "\u2014");
    S_BAR_START_RIGHT = unicodeOr("\u2510", "T");
    S_BAR_END_RIGHT = unicodeOr("\u2518", "\u2014");
    S_RADIO_ACTIVE = unicodeOr("\u25CF", ">");
    S_RADIO_INACTIVE = unicodeOr("\u25CB", " ");
    S_CHECKBOX_ACTIVE = unicodeOr("\u25FB", "[\u2022]");
    S_CHECKBOX_SELECTED = unicodeOr("\u25FC", "[+]");
    S_CHECKBOX_INACTIVE = unicodeOr("\u25FB", "[ ]");
    S_PASSWORD_MASK = unicodeOr("\u25AA", "\u2022");
    S_BAR_H = unicodeOr("\u2500", "-");
    S_CORNER_TOP_RIGHT = unicodeOr("\u256E", "+");
    S_CONNECT_LEFT = unicodeOr("\u251C", "+");
    S_CORNER_BOTTOM_RIGHT = unicodeOr("\u256F", "+");
    S_CORNER_BOTTOM_LEFT = unicodeOr("\u2570", "+");
    S_CORNER_TOP_LEFT = unicodeOr("\u256D", "+");
    S_INFO = unicodeOr("\u25CF", "\u2022");
    S_SUCCESS = unicodeOr("\u25C6", "*");
    S_WARN = unicodeOr("\u25B2", "!");
    S_ERROR = unicodeOr("\u25A0", "x");
    symbol = (o2) => {
      switch (o2) {
        case "initial":
        case "active":
          return styleText2("cyan", S_STEP_ACTIVE);
        case "cancel":
          return styleText2("red", S_STEP_CANCEL);
        case "error":
          return styleText2("yellow", S_STEP_ERROR);
        case "submit":
          return styleText2("green", S_STEP_SUBMIT);
      }
    };
    symbolBar = (o2) => {
      switch (o2) {
        case "initial":
        case "active":
          return styleText2("cyan", S_BAR);
        case "cancel":
          return styleText2("red", S_BAR);
        case "error":
          return styleText2("yellow", S_BAR);
        case "submit":
          return styleText2("green", S_BAR);
      }
    };
    I = (l2, e, w, p3, b3, C3 = false) => {
      let r2 = e, O = 0;
      if (C3)
        for (let i2 = p3 - 1; i2 >= w; i2--) {
          const m3 = l2[i2];
          if (m3 && (r2 -= m3.length), O++, r2 <= b3) break;
        }
      else
        for (let i2 = w; i2 < p3; i2++) {
          const m3 = l2[i2];
          if (m3 && (r2 -= m3.length), O++, r2 <= b3) break;
        }
      return { lineCount: r2, removals: O };
    };
    limitOptions = ({
      cursor: l2,
      options: e,
      style: w,
      output: p3 = process.stdout,
      maxItems: b3 = Number.POSITIVE_INFINITY,
      columnPadding: C3 = 0,
      rowPadding: r2 = 4
    }) => {
      const i2 = getColumns(p3) - C3, m3 = getRows(p3), M2 = styleText2("dim", "..."), v = Math.max(m3 - r2, 0), a2 = Math.max(Math.min(b3, v), 5);
      let f2 = 0;
      l2 >= a2 - 3 && (f2 = Math.max(
        Math.min(l2 - a2 + 3, e.length - a2),
        0
      ));
      let d = a2 < e.length && f2 > 0, c3 = a2 < e.length && f2 + a2 < e.length;
      const W2 = Math.min(
        f2 + a2,
        e.length
      ), s = [];
      let g2 = 0;
      d && g2++, c3 && g2++;
      const T3 = f2 + (d ? 1 : 0), y = W2 - (c3 ? 1 : 0);
      for (let t2 = T3; t2 < y; t2++) {
        const n3 = e[t2], o2 = n3 ? w(n3, t2 === l2) : "", h2 = wrapAnsi(o2, i2, {
          hard: true,
          trim: false
        }).split(`
`);
        s.push(h2), g2 += h2.length;
      }
      if (g2 > v) {
        let t2 = 0, n3 = 0, o2 = g2;
        const h2 = l2 - T3;
        let u5 = v;
        const L = () => I(s, o2, 0, h2, u5), E2 = () => I(
          s,
          o2,
          h2 + 1,
          s.length,
          u5,
          true
        );
        d ? ({ lineCount: o2, removals: t2 } = L(), o2 > u5 && (c3 || (u5 -= 1), { lineCount: o2, removals: n3 } = E2())) : (c3 || (u5 -= 1), { lineCount: o2, removals: n3 } = E2(), o2 > u5 && (u5 -= 1, { lineCount: o2, removals: t2 } = L())), t2 > 0 && (d = true, s.splice(0, t2)), n3 > 0 && (c3 = true, s.splice(s.length - n3, n3));
      }
      const x2 = [];
      d && x2.push(M2);
      for (const t2 of s)
        for (const n3 of t2)
          x2.push(n3);
      return c3 && x2.push(M2), x2;
    };
    autocomplete = (t2) => new T$1({
      options: t2.options,
      initialValue: t2.initialValue ? [t2.initialValue] : void 0,
      initialUserInput: t2.initialUserInput,
      placeholder: t2.placeholder,
      filter: t2.filter ?? ((n3, i2) => E(n3, i2)),
      signal: t2.signal,
      input: t2.input,
      output: t2.output,
      validate: t2.validate,
      render() {
        const n3 = t2.withGuide ?? settings.withGuide, i2 = n3 ? [`${styleText2("gray", S_BAR)}`, `${symbol(this.state)}  ${t2.message}`] : [`${symbol(this.state)}  ${t2.message}`], l2 = this.userInput, o2 = this.options, m3 = t2.placeholder, p3 = l2 === "" && m3 !== void 0, $ = (r2, s) => {
          const a2 = P2(r2), u5 = r2.hint && r2.value === this.focusedValue ? styleText2("dim", ` (${r2.hint})`) : "";
          switch (s) {
            case "active":
              return `${styleText2("green", S_RADIO_ACTIVE)} ${a2}${u5}`;
            case "inactive":
              return `${styleText2("dim", S_RADIO_INACTIVE)} ${styleText2("dim", a2)}`;
            case "disabled":
              return `${styleText2("gray", S_RADIO_INACTIVE)} ${styleText2(["strikethrough", "gray"], a2)}`;
          }
        };
        switch (this.state) {
          case "submit": {
            const r2 = N(this.selectedValues, o2), s = r2.length > 0 ? `  ${styleText2("dim", r2.map(P2).join(", "))}` : "", a2 = n3 ? styleText2("gray", S_BAR) : "";
            return `${i2.join(`
`)}
${a2}${s}`;
          }
          case "cancel": {
            const r2 = l2 ? `  ${styleText2(["strikethrough", "dim"], l2)}` : "", s = n3 ? styleText2("gray", S_BAR) : "";
            return `${i2.join(`
`)}
${s}${r2}`;
          }
          default: {
            const r2 = this.state === "error" ? "yellow" : "cyan", s = n3 ? `${styleText2(r2, S_BAR)}  ` : "", a2 = n3 ? styleText2(r2, S_BAR_END) : "";
            let u5 = "";
            if (this.isNavigating || p3) {
              const d = p3 ? m3 : l2;
              u5 = d !== "" ? ` ${styleText2("dim", d)}` : "";
            } else
              u5 = ` ${this.userInputWithCursor}`;
            const V2 = this.filteredOptions.length !== o2.length ? styleText2(
              "dim",
              ` (${this.filteredOptions.length} match${this.filteredOptions.length === 1 ? "" : "es"})`
            ) : "", y = this.filteredOptions.length === 0 && l2 ? [`${s}${styleText2("yellow", "No matches found")}`] : [], b3 = this.state === "error" ? [`${s}${styleText2("yellow", this.error)}`] : [];
            n3 && i2.push(`${s.trimEnd()}`), i2.push(
              `${s}${styleText2("dim", "Search:")}${u5}${V2}`,
              ...y,
              ...b3
            );
            const v = [
              `${styleText2("dim", "\u2191/\u2193")} to select`,
              `${styleText2("dim", "Enter:")} confirm`,
              `${styleText2("dim", "Type:")} to search`
            ], g2 = [`${s}${v.join(" \u2022 ")}`, a2], O = this.filteredOptions.length === 0 ? [] : limitOptions({
              cursor: this.cursor,
              options: this.filteredOptions,
              columnPadding: n3 ? 3 : 0,
              // for `|  ` when guide is shown
              rowPadding: i2.length + g2.length,
              style: (d, f2) => $(
                d,
                d.disabled ? "disabled" : f2 ? "active" : "inactive"
              ),
              maxItems: t2.maxItems,
              output: t2.output
            });
            return [
              ...i2,
              ...O.map((d) => `${s}${d}`),
              ...g2
            ].join(`
`);
          }
        }
      }
    }).prompt();
    autocompleteMultiselect = (t2) => {
      const c3 = (i2, l2, o2, m3) => {
        const p3 = o2.includes(i2.value), $ = i2.label ?? String(i2.value ?? ""), r2 = i2.hint && m3 !== void 0 && i2.value === m3 ? styleText2("dim", ` (${i2.hint})`) : "", s = p3 ? styleText2("green", S_CHECKBOX_SELECTED) : styleText2("dim", S_CHECKBOX_INACTIVE);
        return i2.disabled ? `${styleText2("gray", S_CHECKBOX_INACTIVE)} ${styleText2(["strikethrough", "gray"], $)}` : l2 ? `${s} ${$}${r2}` : `${s} ${styleText2("dim", $)}`;
      }, n3 = new T$1({
        options: t2.options,
        multiple: true,
        placeholder: t2.placeholder,
        filter: t2.filter ?? ((i2, l2) => E(i2, l2)),
        validate: () => {
          if (t2.required && n3.selectedValues.length === 0)
            return "Please select at least one item";
        },
        initialValue: t2.initialValues,
        signal: t2.signal,
        input: t2.input,
        output: t2.output,
        render() {
          const i2 = t2.withGuide ?? settings.withGuide, l2 = `${i2 ? `${styleText2("gray", S_BAR)}
` : ""}${symbol(this.state)}  ${t2.message}
`, o2 = this.userInput, m3 = t2.placeholder, p3 = o2 === "" && m3 !== void 0, $ = this.isNavigating || p3 ? styleText2("dim", p3 ? m3 : o2) : this.userInputWithCursor, r2 = this.options, s = this.filteredOptions.length !== r2.length ? styleText2(
            "dim",
            ` (${this.filteredOptions.length} match${this.filteredOptions.length === 1 ? "" : "es"})`
          ) : "";
          switch (this.state) {
            case "submit":
              return `${l2}${i2 ? `${styleText2("gray", S_BAR)}  ` : ""}${styleText2(
                "dim",
                `${this.selectedValues.length} items selected`
              )}`;
            case "cancel":
              return `${l2}${i2 ? `${styleText2("gray", S_BAR)}  ` : ""}${styleText2(
                ["strikethrough", "dim"],
                o2
              )}`;
            default: {
              const a2 = this.state === "error" ? "yellow" : "cyan", u5 = i2 ? `${styleText2(a2, S_BAR)}  ` : "", V2 = i2 ? styleText2(a2, S_BAR_END) : "", y = [
                `${styleText2("dim", "\u2191/\u2193")} to navigate`,
                `${styleText2("dim", this.isNavigating ? "Space/Tab:" : "Tab:")} select`,
                `${styleText2("dim", "Enter:")} confirm`,
                `${styleText2("dim", "Type:")} to search`
              ], b3 = this.filteredOptions.length === 0 && o2 ? [`${u5}${styleText2("yellow", "No matches found")}`] : [], v = this.state === "error" ? [`${u5}${styleText2("yellow", this.error)}`] : [], g2 = [
                ...`${l2}${i2 ? styleText2(a2, S_BAR) : ""}`.split(`
`),
                `${u5}${styleText2("dim", "Search:")} ${$}${s}`,
                ...b3,
                ...v
              ], O = [`${u5}${y.join(" \u2022 ")}`, V2], d = limitOptions({
                cursor: this.cursor,
                options: this.filteredOptions,
                style: (f2, _2) => c3(f2, _2, this.selectedValues, this.focusedValue),
                maxItems: t2.maxItems,
                output: t2.output,
                rowPadding: g2.length + O.length
              });
              return [
                ...g2,
                ...d.map((f2) => `${u5}${f2}`),
                ...O
              ].join(`
`);
            }
          }
        }
      });
      return n3.prompt();
    };
    J = [
      S_CORNER_TOP_LEFT,
      S_CORNER_TOP_RIGHT,
      S_CORNER_BOTTOM_LEFT,
      S_CORNER_BOTTOM_RIGHT
    ];
    K = [S_BAR_START, S_BAR_START_RIGHT, S_BAR_END, S_BAR_END_RIGHT];
    Q = (n3) => n3;
    box = (n3 = "", e = "", t2) => {
      const o2 = t2?.output ?? process.stdout, i2 = getColumns(o2), R2 = 1 * 2, u5 = t2?.titlePadding ?? 1, h2 = t2?.contentPadding ?? 2, w = t2?.width === void 0 || t2.width === "auto" ? 1 : Math.min(1, t2.width), m3 = t2?.withGuide ?? settings.withGuide ? `${S_BAR} ` : "", b3 = t2?.formatBorder ?? Q, a2 = (t2?.rounded ? J : K).map(b3), _2 = b3(S_BAR_H), B = b3(S_BAR), p3 = dist_default2(m3), x2 = dist_default2(e), O = i2 - p3;
      let r2 = Math.floor(i2 * w) - p3;
      if (t2?.width === "auto") {
        const c3 = n3.split(`
`);
        let s = x2 + u5 * 2;
        for (const G of c3) {
          const P3 = dist_default2(G) + h2 * 2;
          P3 > s && (s = P3);
        }
        const g2 = s + R2;
        g2 < r2 && (r2 = g2);
      }
      r2 % 2 !== 0 && (r2 < O ? r2++ : r2--);
      const d = r2 - R2, S = d - u5 * 2, T3 = x2 > S ? `${e.slice(0, S - 3)}...` : e, [y, W2] = A$1(
        dist_default2(T3),
        d,
        u5,
        t2?.titleAlign
      ), L = wrapAnsi(n3, d - h2 * 2, {
        hard: true,
        trim: false
      });
      o2.write(
        `${m3}${a2[0]}${_2.repeat(y)}${T3}${_2.repeat(W2)}${a2[1]}
`
      );
      const E2 = L.split(`
`);
      for (const c3 of E2) {
        const [s, g2] = A$1(
          dist_default2(c3),
          d,
          h2,
          t2?.contentAlign
        );
        o2.write(
          `${m3}${B}${" ".repeat(s)}${c3}${" ".repeat(g2)}${B}
`
        );
      }
      o2.write(`${m3}${a2[2]}${_2.repeat(d)}${a2[3]}
`);
    };
    confirm = (i2) => {
      const a2 = i2.active ?? "Yes", s = i2.inactive ?? "No";
      return new r({
        active: a2,
        inactive: s,
        signal: i2.signal,
        input: i2.input,
        output: i2.output,
        initialValue: i2.initialValue ?? true,
        render() {
          const e = i2.withGuide ?? settings.withGuide, u5 = `${symbol(this.state)}  `, l2 = e ? `${styleText2("gray", S_BAR)}  ` : "", f2 = wrapTextWithPrefix(
            i2.output,
            i2.message,
            l2,
            u5
          ), o2 = `${e ? `${styleText2("gray", S_BAR)}
` : ""}${f2}
`, c3 = this.value ? a2 : s;
          switch (this.state) {
            case "submit": {
              const r2 = e ? `${styleText2("gray", S_BAR)}  ` : "";
              return `${o2}${r2}${styleText2("dim", c3)}`;
            }
            case "cancel": {
              const r2 = e ? `${styleText2("gray", S_BAR)}  ` : "";
              return `${o2}${r2}${styleText2(["strikethrough", "dim"], c3)}${e ? `
${styleText2("gray", S_BAR)}` : ""}`;
            }
            default: {
              const r2 = e ? `${styleText2("cyan", S_BAR)}  ` : "", g2 = e ? styleText2("cyan", S_BAR_END) : "";
              return `${o2}${r2}${this.value ? `${styleText2("green", S_RADIO_ACTIVE)} ${a2}` : `${styleText2("dim", S_RADIO_INACTIVE)} ${styleText2("dim", a2)}`}${i2.vertical ? e ? `
${styleText2("cyan", S_BAR)}  ` : `
` : ` ${styleText2("dim", "/")} `}${this.value ? `${styleText2("dim", S_RADIO_INACTIVE)} ${styleText2("dim", s)}` : `${styleText2("green", S_RADIO_ACTIVE)} ${s}`}
${g2}
`;
            }
          }
        }
      }).prompt();
    };
    date = (e) => {
      const r2 = e.validate;
      return new U({
        ...e,
        validate(t2) {
          if (t2 === void 0)
            return e.defaultValue !== void 0 ? void 0 : r2 ? runValidation(r2, t2) : settings.date.messages.required;
          const o2 = (i2) => i2.toISOString().slice(0, 10);
          if (e.minDate && o2(t2) < o2(e.minDate))
            return settings.date.messages.afterMin(e.minDate);
          if (e.maxDate && o2(t2) > o2(e.maxDate))
            return settings.date.messages.beforeMax(e.maxDate);
          if (r2) return runValidation(r2, t2);
        },
        render() {
          const t2 = (e?.withGuide ?? settings.withGuide) !== false, i2 = `${`${t2 ? `${styleText2("gray", S_BAR)}
` : ""}${symbol(this.state)}  `}${e.message}
`, l2 = this.state !== "initial" ? this.state : "active", d = b2(this, l2), c3 = this.value instanceof Date ? this.formattedValue : "";
          switch (this.state) {
            case "error": {
              const a2 = this.error ? `  ${styleText2("yellow", this.error)}` : "", s = t2 ? `${styleText2("yellow", S_BAR)}  ` : "", f2 = t2 ? styleText2("yellow", S_BAR_END) : "";
              return `${i2.trim()}
${s}${d}
${f2}${a2}
`;
            }
            case "submit": {
              const a2 = c3 ? `  ${styleText2("dim", c3)}` : "", s = t2 ? styleText2("gray", S_BAR) : "";
              return `${i2}${s}${a2}`;
            }
            case "cancel": {
              const a2 = c3 ? `  ${styleText2(["strikethrough", "dim"], c3)}` : "", s = t2 ? styleText2("gray", S_BAR) : "";
              return `${i2}${s}${a2}${c3.trim() ? `
${s}` : ""}`;
            }
            default: {
              const a2 = t2 ? `${styleText2("cyan", S_BAR)}  ` : "", s = t2 ? styleText2("cyan", S_BAR_END) : "", f2 = t2 ? `${styleText2("cyan", S_BAR)}  ` : "", g2 = this.inlineError ? `
${f2}${styleText2("yellow", this.inlineError)}` : "";
              return `${i2}${a2}${d}${g2}
${s}
`;
            }
          }
        }
      }).prompt();
    };
    p2 = {
      year: "yyyy",
      month: "mm",
      day: "dd"
    };
    group2 = async (o2, r2) => {
      const t2 = {}, p3 = Object.keys(o2);
      for (const e of p3) {
        const i2 = o2[e], n3 = await i2({ results: t2 })?.catch((a2) => {
          throw a2;
        });
        if (typeof r2?.onCancel == "function" && isCancel(n3)) {
          t2[e] = "canceled", r2.onCancel({ results: t2 });
          continue;
        }
        t2[e] = n3;
      }
      return t2;
    };
    MULTISELECT_INSTRUCTIONS = [
      `${styleText2("dim", "\u2191/\u2193")} to navigate`,
      `${styleText2("dim", "Space:")} select`,
      `${styleText2("dim", "Enter:")} confirm`
    ];
    m2 = (i2, u5) => i2.split(`
`).map((d) => u5(d)).join(`
`);
    multiselect = (i2) => {
      const u5 = (t2, a2) => {
        const r2 = t2.label ?? String(t2.value);
        return a2 === "disabled" ? `${styleText2("gray", S_CHECKBOX_INACTIVE)} ${m2(r2, (o2) => styleText2(["strikethrough", "gray"], o2))}${t2.hint ? ` ${styleText2("dim", `(${t2.hint ?? "disabled"})`)}` : ""}` : a2 === "active" ? `${styleText2("cyan", S_CHECKBOX_ACTIVE)} ${r2}${t2.hint ? ` ${styleText2("dim", `(${t2.hint})`)}` : ""}` : a2 === "selected" ? `${styleText2("green", S_CHECKBOX_SELECTED)} ${m2(r2, (o2) => styleText2("dim", o2))}${t2.hint ? ` ${styleText2("dim", `(${t2.hint})`)}` : ""}` : a2 === "cancelled" ? `${m2(r2, (o2) => styleText2(["strikethrough", "dim"], o2))}` : a2 === "active-selected" ? `${styleText2("green", S_CHECKBOX_SELECTED)} ${r2}${t2.hint ? ` ${styleText2("dim", `(${t2.hint})`)}` : ""}` : a2 === "submitted" ? `${m2(r2, (o2) => styleText2("dim", o2))}` : `${styleText2("dim", S_CHECKBOX_INACTIVE)} ${m2(r2, (o2) => styleText2("dim", o2))}`;
      }, d = i2.required ?? true, v = i2.showInstructions ?? true;
      return new a({
        options: i2.options,
        signal: i2.signal,
        input: i2.input,
        output: i2.output,
        initialValues: i2.initialValues,
        required: d,
        cursorAt: i2.cursorAt,
        validate(t2) {
          if (d && (t2 === void 0 || t2.length === 0))
            return `Please select at least one option.
${styleText2(
              "reset",
              styleText2(
                "dim",
                `Press ${styleText2(["gray", "bgWhite", "inverse"], " space ")} to select, ${styleText2(
                  "gray",
                  styleText2("bgWhite", styleText2("inverse", " enter "))
                )} to submit`
              )
            )}`;
        },
        render() {
          const t2 = i2.withGuide ?? settings.withGuide, a2 = wrapTextWithPrefix(
            i2.output,
            i2.message,
            t2 ? `${symbolBar(this.state)}  ` : "",
            `${symbol(this.state)}  `
          ), r2 = `${t2 ? `${styleText2("gray", S_BAR)}
` : ""}${a2}
`, o2 = this.value ?? [], p3 = (n3, l2) => {
            if (n3.disabled)
              return u5(n3, "disabled");
            const s = o2.includes(n3.value);
            return l2 && s ? u5(n3, "active-selected") : s ? u5(n3, "selected") : u5(n3, l2 ? "active" : "inactive");
          };
          switch (this.state) {
            case "submit": {
              const n3 = this.options.filter(({ value: s }) => o2.includes(s)).map((s) => u5(s, "submitted")).join(styleText2("dim", ", ")) || styleText2("dim", "none"), l2 = wrapTextWithPrefix(
                i2.output,
                n3,
                t2 ? `${styleText2("gray", S_BAR)}  ` : ""
              );
              return `${r2}${l2}`;
            }
            case "cancel": {
              const n3 = this.options.filter(({ value: s }) => o2.includes(s)).map((s) => u5(s, "cancelled")).join(styleText2("dim", ", "));
              if (n3.trim() === "")
                return `${r2}${styleText2("gray", S_BAR)}`;
              const l2 = wrapTextWithPrefix(
                i2.output,
                n3,
                t2 ? `${styleText2("gray", S_BAR)}  ` : ""
              );
              return `${r2}${l2}${t2 ? `
${styleText2("gray", S_BAR)}` : ""}`;
            }
            case "error": {
              const n3 = t2 ? `${styleText2("yellow", S_BAR)}  ` : "", l2 = this.error.split(`
`).map(
                ($, C3) => C3 === 0 ? `${t2 ? `${styleText2("yellow", S_BAR_END)}  ` : ""}${styleText2("yellow", $)}` : `   ${$}`
              ).join(`
`), s = r2.split(`
`).length, h2 = l2.split(`
`).length + 1;
              return `${r2}${n3}${limitOptions({
                output: i2.output,
                options: this.options,
                cursor: this.cursor,
                maxItems: i2.maxItems,
                columnPadding: n3.length,
                rowPadding: s + h2,
                style: p3
              }).join(`
${n3}`)}
${l2}
`;
            }
            default: {
              const n3 = t2 ? `${styleText2("cyan", S_BAR)}  ` : "", l2 = r2.split(`
`).length, s = v ? formatInstructionFooter(MULTISELECT_INSTRUCTIONS, t2) : t2 ? [styleText2("cyan", S_BAR_END)] : [], h2 = s.join(`
`), $ = s.length + 1;
              return `${r2}${n3}${limitOptions({
                output: i2.output,
                options: this.options,
                cursor: this.cursor,
                maxItems: i2.maxItems,
                columnPadding: n3.length,
                rowPadding: l2 + $,
                style: p3
              }).join(`
${n3}`)}
${h2}
`;
            }
          }
        }
      }).prompt();
    };
    groupMultiselect = (o2) => {
      const { selectableGroups: h2 = true, groupSpacing: x2 = 0 } = o2, m3 = (n3, l2, g2 = []) => {
        const a2 = n3.label ?? String(n3.value), t2 = typeof n3.group == "string", s = t2 && (g2[g2.indexOf(n3) + 1] ?? { group: true }), u5 = t2 && s && s.group === true;
        let r2 = "", c3 = "";
        t2 && (h2 ? (r2 = u5 ? `${S_BAR_END} ` : `${S_BAR} `, c3 = u5 ? "  " : `${S_BAR} `) : r2 = "  ");
        let i2 = "";
        if (x2 > 0 && !t2 && (i2 = `
`.repeat(x2)), l2 === "active")
          return wrapTextWithPrefix(
            o2.output,
            `${a2}${n3.hint ? ` ${styleText2("dim", `(${n3.hint})`)}` : ""}`,
            `${i2}${styleText2("dim", r2)} `,
            `${i2}${styleText2("dim", r2)}${styleText2("cyan", S_CHECKBOX_ACTIVE)} `,
            `${i2}${styleText2("dim", c3)} `
          );
        if (l2 === "group-active")
          return wrapTextWithPrefix(
            o2.output,
            a2,
            `${i2}${r2} `,
            `${i2}${r2}${styleText2("cyan", S_CHECKBOX_ACTIVE)} `,
            `${i2}${c3} `,
            (d) => styleText2("dim", d)
          );
        if (l2 === "group-active-selected")
          return wrapTextWithPrefix(
            o2.output,
            a2,
            `${i2}${r2} `,
            `${i2}${r2}${styleText2("green", S_CHECKBOX_SELECTED)} `,
            `${i2}${c3} `,
            (d) => styleText2("dim", d)
          );
        if (l2 === "selected") {
          const d = t2 || h2 ? styleText2("green", S_CHECKBOX_SELECTED) : "";
          return wrapTextWithPrefix(
            o2.output,
            `${a2}${n3.hint ? ` (${n3.hint})` : ""}`,
            `${i2}${styleText2("dim", r2)} `,
            `${i2}${styleText2("dim", r2)}${d} `,
            `${i2}${styleText2("dim", c3)} `,
            (S) => styleText2("dim", S)
          );
        }
        if (l2 === "cancelled")
          return `${styleText2(["strikethrough", "dim"], a2)}`;
        if (l2 === "active-selected")
          return wrapTextWithPrefix(
            o2.output,
            `${a2}${n3.hint ? ` ${styleText2("dim", `(${n3.hint})`)}` : ""}`,
            `${i2}${styleText2("dim", r2)} `,
            `${i2}${styleText2("dim", r2)}${styleText2("green", S_CHECKBOX_SELECTED)} `,
            `${i2}${styleText2("dim", c3)} `
          );
        if (l2 === "submitted")
          return `${styleText2("dim", a2)}`;
        const f2 = t2 || h2 ? styleText2("dim", S_CHECKBOX_INACTIVE) : "";
        return wrapTextWithPrefix(
          o2.output,
          a2,
          `${i2}${styleText2("dim", r2)} `,
          `${i2}${styleText2("dim", r2)}${f2} `,
          `${i2}${styleText2("dim", c3)} `,
          (d) => styleText2("dim", d)
        );
      }, y = o2.required ?? true, I2 = o2.showInstructions ?? true;
      return new u$2({
        options: o2.options,
        signal: o2.signal,
        input: o2.input,
        output: o2.output,
        initialValues: o2.initialValues,
        required: y,
        cursorAt: o2.cursorAt,
        selectableGroups: h2,
        validate(n3) {
          if (y && (n3 === void 0 || n3.length === 0))
            return `Please select at least one option.
${styleText2(
              "reset",
              styleText2(
                "dim",
                `Press ${styleText2(["gray", "bgWhite", "inverse"], " space ")} to select, ${styleText2(
                  "gray",
                  styleText2(["bgWhite", "inverse"], " enter ")
                )} to submit`
              )
            )}`;
        },
        render() {
          const n3 = o2.withGuide ?? settings.withGuide, l2 = `${n3 ? `${styleText2("gray", S_BAR)}
` : ""}${symbol(this.state)}  ${o2.message}
`, g2 = this.value ?? [], a2 = (t2, s) => {
            const u5 = this.options, r2 = g2.includes(t2.value) || t2.group === true && this.isGroupSelected(`${t2.value}`);
            return !s && typeof t2.group == "string" && this.options[this.cursor]?.value === t2.group ? m3(t2, r2 ? "group-active-selected" : "group-active", u5) : s && r2 ? m3(t2, "active-selected", u5) : r2 ? m3(t2, "selected", u5) : m3(t2, s ? "active" : "inactive", u5);
          };
          switch (this.state) {
            case "submit": {
              const t2 = this.options.filter(({ value: u5 }) => g2.includes(u5)).map((u5) => m3(u5, "submitted")), s = t2.length === 0 ? "" : `  ${t2.join(styleText2("dim", ", "))}`;
              return `${l2}${n3 ? styleText2("gray", S_BAR) : ""}${s}`;
            }
            case "cancel": {
              const t2 = this.options.filter(({ value: s }) => g2.includes(s)).map((s) => m3(s, "cancelled")).join(styleText2("dim", ", "));
              return `${l2}${n3 ? `${styleText2("gray", S_BAR)}  ` : ""}${t2.trim() ? `${t2}${n3 ? `
${styleText2("gray", S_BAR)}` : ""}` : ""}`;
            }
            case "error": {
              const t2 = n3 ? `${styleText2("yellow", S_BAR)}  ` : "", s = this.error.split(`
`).map(
                (i2, f2) => f2 === 0 ? `${n3 ? `${styleText2("yellow", S_BAR_END)}  ` : ""}${styleText2("yellow", i2)}` : `   ${i2}`
              ).join(`
`), u5 = l2.split(`
`).length, r2 = s.split(`
`).length + 1, c3 = limitOptions({
                output: o2.output,
                options: this.options,
                cursor: this.cursor,
                maxItems: o2.maxItems,
                columnPadding: t2.length,
                rowPadding: u5 + r2,
                style: a2
              }).join(`
${t2}`);
              return `${l2}${t2}${c3}
${s}
`;
            }
            default: {
              const t2 = n3 ? `${styleText2("cyan", S_BAR)}  ` : "", s = l2.split(`
`).length, u5 = I2 ? formatInstructionFooter(MULTISELECT_INSTRUCTIONS, n3) : n3 ? [styleText2("cyan", S_BAR_END)] : [], r2 = u5.join(`
`), c3 = u5.length + 1, i2 = limitOptions({
                output: o2.output,
                options: this.options,
                cursor: this.cursor,
                maxItems: o2.maxItems,
                columnPadding: t2.length,
                rowPadding: s + c3,
                style: a2
              }).join(`
${t2}`);
              return `${l2}${t2}${i2}
${r2}
`;
            }
          }
        }
      }).prompt();
    };
    log = {
      message: (s = [], {
        symbol: e = styleText2("gray", S_BAR),
        secondarySymbol: r2 = styleText2("gray", S_BAR),
        output: m3 = process.stdout,
        spacing: l2 = 1,
        withGuide: c3
      } = {}) => {
        const t2 = [], o2 = c3 ?? settings.withGuide, f2 = o2 ? r2 : "", O = o2 ? `${e}  ` : "", u5 = o2 ? `${r2}  ` : "";
        for (let i2 = 0; i2 < l2; i2++)
          t2.push(f2);
        const g2 = Array.isArray(s) ? s : s.split(`
`);
        if (g2.length > 0) {
          const [i2, ...y] = g2;
          i2.length > 0 ? t2.push(`${O}${i2}`) : t2.push(o2 ? e : "");
          for (const p3 of y)
            p3.length > 0 ? t2.push(`${u5}${p3}`) : t2.push(o2 ? r2 : "");
        }
        m3.write(`${t2.join(`
`)}
`);
      },
      info: (s, e) => {
        log.message(s, { ...e, symbol: styleText2("blue", S_INFO) });
      },
      success: (s, e) => {
        log.message(s, { ...e, symbol: styleText2("green", S_SUCCESS) });
      },
      step: (s, e) => {
        log.message(s, { ...e, symbol: styleText2("green", S_STEP_SUBMIT) });
      },
      warn: (s, e) => {
        log.message(s, { ...e, symbol: styleText2("yellow", S_WARN) });
      },
      /** alias for `log.warn()`. */
      warning: (s, e) => {
        log.warn(s, e);
      },
      error: (s, e) => {
        log.message(s, { ...e, symbol: styleText2("red", S_ERROR) });
      }
    };
    cancel = (o2 = "", t2) => {
      const i2 = t2?.output ?? process.stdout, e = t2?.withGuide ?? settings.withGuide ? `${styleText2("gray", S_BAR_END)}  ` : "";
      i2.write(`${e}${styleText2("red", o2)}

`);
    };
    intro = (o2 = "", t2) => {
      const i2 = t2?.output ?? process.stdout, e = t2?.withGuide ?? settings.withGuide ? `${styleText2("gray", S_BAR_START)}  ` : "";
      i2.write(`${e}${o2}
`);
    };
    outro = (o2 = "", t2) => {
      const i2 = t2?.output ?? process.stdout, e = t2?.withGuide ?? settings.withGuide ? `${styleText2("gray", S_BAR)}
${styleText2("gray", S_BAR_END)}  ` : "";
      i2.write(`${e}${o2}

`);
    };
    multiline = (e) => new h({
      validate: e.validate,
      placeholder: e.placeholder,
      defaultValue: e.defaultValue,
      initialValue: e.initialValue,
      showSubmit: e.showSubmit,
      output: e.output,
      signal: e.signal,
      input: e.input,
      render() {
        const i2 = e?.withGuide ?? settings.withGuide, o2 = `${`${i2 ? `${styleText2("gray", S_BAR)}
` : ""}${symbol(this.state)}  `}${e.message}
`, m3 = e.placeholder && e.placeholder.length > 0 ? (
          // biome-ignore lint/style/noNonNullAssertion: guarded by placeholder.length > 0
          styleText2("inverse", e.placeholder[0]) + styleText2("dim", e.placeholder.slice(1))
        ) : styleText2(["inverse", "hidden"], "_"), a2 = this.userInput ? this.userInputWithCursor : m3, l2 = this.value ?? "", c3 = e.showSubmit ? `
  ${styleText2(this.focused === "submit" ? "cyan" : "dim", "[ submit ]")}` : "";
        switch (this.state) {
          case "error": {
            const n3 = `${styleText2("yellow", S_BAR)}  `, r2 = i2 ? wrapTextWithPrefix(e.output, a2, n3, void 0) : a2, u5 = styleText2("yellow", S_BAR_END);
            return `${o2}${r2}
${u5}  ${styleText2("yellow", this.error)}${c3}
`;
          }
          case "submit": {
            const n3 = `${styleText2("gray", S_BAR)}  `, r2 = i2 ? wrapTextWithPrefix(
              e.output,
              l2,
              n3,
              void 0,
              void 0,
              (u5) => styleText2("dim", u5)
            ) : l2 ? styleText2("dim", l2) : "";
            return `${o2}${r2}`;
          }
          case "cancel": {
            const n3 = `${styleText2("gray", S_BAR)}  `, r2 = i2 ? wrapTextWithPrefix(
              e.output,
              l2,
              n3,
              void 0,
              void 0,
              (u5) => styleText2(["strikethrough", "dim"], u5)
            ) : l2 ? styleText2(["strikethrough", "dim"], l2) : "";
            return `${o2}${r2}`;
          }
          default: {
            const n3 = i2 ? `${styleText2("cyan", S_BAR)}  ` : "", r2 = i2 ? styleText2("cyan", S_BAR_END) : "", u5 = i2 ? wrapTextWithPrefix(e.output, a2, n3) : a2;
            return `${o2}${u5}
${r2}${c3}
`;
          }
        }
      }
    }).prompt();
    W$1 = (o2) => o2;
    C2 = (o2, e, s) => {
      const a2 = {
        hard: true,
        trim: false
      }, i2 = wrapAnsi(o2, e, a2).split(`
`), c3 = i2.reduce((n3, t2) => Math.max(dist_default2(t2), n3), 0), u5 = i2.map(s).reduce((n3, t2) => Math.max(dist_default2(t2), n3), 0), g2 = e - (u5 - c3);
      return wrapAnsi(o2, g2, a2);
    };
    note = (o2 = "", e = "", s) => {
      const a2 = s?.output ?? process$1.stdout, i2 = s?.withGuide ?? settings.withGuide, c3 = s?.format ?? W$1, g2 = ["", ...C2(o2, getColumns(a2) - 6, c3).split(`
`).map(c3), ""], n3 = dist_default2(e), t2 = Math.max(
        g2.reduce((m3, F) => {
          const O = dist_default2(F);
          return O > m3 ? O : m3;
        }, 0),
        n3
      ) + 2, h2 = g2.map(
        (m3) => `${styleText2("gray", S_BAR)}  ${m3}${" ".repeat(t2 - dist_default2(m3))}${styleText2("gray", S_BAR)}`
      ).join(`
`), T3 = i2 ? `${styleText2("gray", S_BAR)}
` : "", l$1 = i2 ? S_CONNECT_LEFT : S_CORNER_BOTTOM_LEFT;
      a2.write(
        `${T3}${styleText2("green", S_STEP_SUBMIT)}  ${styleText2("reset", e)} ${styleText2(
          "gray",
          S_BAR_H.repeat(Math.max(t2 - n3 - 1, 1)) + S_CORNER_TOP_RIGHT
        )}
${h2}
${styleText2("gray", l$1 + S_BAR_H.repeat(t2 + 2) + S_CORNER_BOTTOM_RIGHT)}
`
      );
    };
    password = (r2) => new u$1({
      validate: r2.validate,
      mask: r2.mask ?? S_PASSWORD_MASK,
      signal: r2.signal,
      input: r2.input,
      output: r2.output,
      render() {
        const e = r2.withGuide ?? settings.withGuide, o2 = `${e ? `${styleText2("gray", S_BAR)}
` : ""}${symbol(this.state)}  ${r2.message}
`, c3 = this.userInputWithCursor, i2 = this.masked;
        switch (this.state) {
          case "error": {
            const s = e ? `${styleText2("yellow", S_BAR)}  ` : "", n3 = e ? `${styleText2("yellow", S_BAR_END)}  ` : "", l2 = i2 ?? "";
            return r2.clearOnError && this.clear(), `${o2.trim()}
${s}${l2}
${n3}${styleText2("yellow", this.error)}
`;
          }
          case "submit": {
            const s = e ? `${styleText2("gray", S_BAR)}  ` : "", n3 = i2 ? styleText2("dim", i2) : "";
            return `${o2}${s}${n3}`;
          }
          case "cancel": {
            const s = e ? `${styleText2("gray", S_BAR)}  ` : "", n3 = i2 ? styleText2(["strikethrough", "dim"], i2) : "";
            return `${o2}${s}${n3}${i2 && e ? `
${styleText2("gray", S_BAR)}` : ""}`;
          }
          default: {
            const s = e ? `${styleText2("cyan", S_BAR)}  ` : "", n3 = e ? styleText2("cyan", S_BAR_END) : "";
            return `${o2}${s}${c3}
${n3}
`;
          }
        }
      }
    }).prompt();
    path = (e) => {
      const a2 = e.validate;
      return autocomplete({
        ...e,
        initialUserInput: e.initialValue ?? e.root ?? process.cwd(),
        maxItems: 5,
        validate(t2) {
          if (!Array.isArray(t2)) {
            if (!t2)
              return "Please select a path";
            if (a2)
              return runValidation(a2, t2);
          }
        },
        options() {
          const t2 = this.userInput;
          if (t2 === "")
            return [];
          try {
            let i2;
            existsSync(t2) ? lstatSync(t2).isDirectory() && (!e.directory || t2.endsWith("/")) ? i2 = t2 : i2 = dirname3(t2) : i2 = dirname3(t2);
            const c3 = t2.length > 1 && t2.endsWith("/") ? t2.slice(0, -1) : t2;
            return readdirSync2(i2).map((r2) => {
              const n3 = join5(i2, r2), m3 = lstatSync(n3);
              return {
                name: r2,
                path: n3,
                isDirectory: m3.isDirectory()
              };
            }).filter(
              ({ path: r2, isDirectory: n3 }) => r2.startsWith(c3) && (n3 || !e.directory)
            ).map((r2) => ({
              value: r2.path
            }));
          } catch {
            return [];
          }
        }
      });
    };
    W = (l2) => styleText2("magenta", l2);
    spinner = ({
      indicator: l2 = "dots",
      onCancel: h2,
      output: n3 = process.stdout,
      cancelMessage: G,
      errorMessage: O,
      frames: E2 = unicode ? ["\u25D2", "\u25D0", "\u25D3", "\u25D1"] : ["\u2022", "o", "O", "0"],
      delay: F = unicode ? 80 : 120,
      signal: m3,
      ...I2
    } = {}) => {
      const u5 = isCI();
      let M2, T3, d = false, S = false, s = "", p3, w = performance.now();
      const x2 = getColumns(n3), k = I2?.styleFrame ?? W, g2 = (e) => {
        const r2 = e > 1 ? O ?? settings.messages.error : G ?? settings.messages.cancel;
        S = e === 1, d && (a2(r2, e), S && typeof h2 == "function" && h2());
      }, f2 = () => g2(2), i2 = () => g2(1), A2 = () => {
        process.on("uncaughtExceptionMonitor", f2), process.on("unhandledRejection", f2), process.on("SIGINT", i2), process.on("SIGTERM", i2), process.on("exit", g2), m3 && m3.addEventListener("abort", i2);
      }, H = () => {
        process.removeListener("uncaughtExceptionMonitor", f2), process.removeListener("unhandledRejection", f2), process.removeListener("SIGINT", i2), process.removeListener("SIGTERM", i2), process.removeListener("exit", g2), m3 && m3.removeEventListener("abort", i2);
      }, y = () => {
        if (p3 === void 0) return;
        u5 && n3.write(`
`);
        const r2 = wrapAnsi(p3, x2, {
          hard: true,
          trim: false
        }).split(`
`);
        r2.length > 1 && n3.write(import_sisteransi2.cursor.up(r2.length - 1)), n3.write(import_sisteransi2.cursor.to(0)), n3.write(import_sisteransi2.erase.down());
      }, C3 = (e) => e.replace(/\.+$/, ""), _2 = (e) => {
        const r2 = (performance.now() - e) / 1e3, t2 = Math.floor(r2 / 60), o2 = Math.floor(r2 % 60);
        return t2 > 0 ? `[${t2}m ${o2}s]` : `[${o2}s]`;
      }, N2 = I2.withGuide ?? settings.withGuide, P3 = (e = "") => {
        d = true, M2 = block({ output: n3 }), s = C3(e), w = performance.now(), N2 && n3.write(`${styleText2("gray", S_BAR)}
`);
        let r2 = 0, t2 = 0;
        A2(), T3 = setInterval(() => {
          if (u5 && s === p3)
            return;
          y(), p3 = s;
          const o2 = k(E2[r2]);
          let v;
          if (u5)
            v = `${o2}  ${s}...`;
          else if (l2 === "timer")
            v = `${o2}  ${s} ${_2(w)}`;
          else {
            const B = ".".repeat(Math.floor(t2)).slice(0, 3);
            v = `${o2}  ${s}${B}`;
          }
          const j = wrapAnsi(v, x2, {
            hard: true,
            trim: false
          });
          n3.write(j), r2 = r2 + 1 < E2.length ? r2 + 1 : 0, t2 = t2 < 4 ? t2 + 0.125 : 0;
        }, F);
      }, a2 = (e = "", r2 = 0, t2 = false) => {
        if (!d) return;
        d = false, clearInterval(T3), y();
        const o2 = r2 === 0 ? styleText2("green", S_STEP_SUBMIT) : r2 === 1 ? styleText2("red", S_STEP_CANCEL) : styleText2("red", S_STEP_ERROR);
        s = e ?? s, t2 || (l2 === "timer" ? n3.write(`${o2}  ${s} ${_2(w)}
`) : n3.write(`${o2}  ${s}
`)), H(), M2();
      };
      return {
        start: P3,
        stop: (e = "") => a2(e, 0),
        message: (e = "") => {
          s = C3(e ?? s);
        },
        cancel: (e = "") => a2(e, 1),
        error: (e = "") => a2(e, 2),
        clear: () => a2("", 0, true),
        get isCancelled() {
          return S;
        }
      };
    };
    u4 = {
      light: unicodeOr("\u2500", "-"),
      heavy: unicodeOr("\u2501", "="),
      block: unicodeOr("\u2588", "#")
    };
    SELECT_INSTRUCTIONS = [
      `${styleText2("dim", "\u2191/\u2193")} to navigate`,
      `${styleText2("dim", "Enter:")} confirm`
    ];
    c2 = (t2, o2) => t2.includes(`
`) ? t2.split(`
`).map((d) => o2(d)).join(`
`) : o2(t2);
    select = (t2) => {
      const o2 = (n3, m3) => {
        if (n3 === void 0)
          return "";
        const s = n3.label ?? String(n3.value);
        switch (m3) {
          case "disabled":
            return `${styleText2("gray", S_RADIO_INACTIVE)} ${c2(s, (i2) => styleText2("gray", i2))}${n3.hint ? ` ${styleText2("dim", `(${n3.hint ?? "disabled"})`)}` : ""}`;
          case "selected":
            return `${c2(s, (i2) => styleText2("dim", i2))}`;
          case "active":
            return `${styleText2("green", S_RADIO_ACTIVE)} ${s}${n3.hint ? ` ${styleText2("dim", `(${n3.hint})`)}` : ""}`;
          case "cancelled":
            return `${c2(s, (i2) => styleText2(["strikethrough", "dim"], i2))}`;
          default:
            return `${styleText2("dim", S_RADIO_INACTIVE)} ${c2(s, (i2) => styleText2("dim", i2))}`;
        }
      }, d = t2.showInstructions ?? true;
      return new n$1({
        options: t2.options,
        signal: t2.signal,
        input: t2.input,
        output: t2.output,
        initialValue: t2.initialValue,
        render() {
          const n3 = t2.withGuide ?? settings.withGuide, m3 = `${symbol(this.state)}  `, s = `${symbolBar(this.state)}  `, i2 = wrapTextWithPrefix(
            t2.output,
            t2.message,
            s,
            m3
          ), u5 = `${n3 ? `${styleText2("gray", S_BAR)}
` : ""}${i2}
`;
          switch (this.state) {
            case "submit": {
              const r2 = n3 ? `${styleText2("gray", S_BAR)}  ` : "", a2 = wrapTextWithPrefix(
                t2.output,
                o2(this.options[this.cursor], "selected"),
                r2
              );
              return `${u5}${a2}`;
            }
            case "cancel": {
              const r2 = n3 ? `${styleText2("gray", S_BAR)}  ` : "", a2 = wrapTextWithPrefix(
                t2.output,
                o2(this.options[this.cursor], "cancelled"),
                r2
              );
              return `${u5}${a2}${n3 ? `
${styleText2("gray", S_BAR)}` : ""}`;
            }
            default: {
              const r2 = n3 ? `${styleText2("cyan", S_BAR)}  ` : "", a2 = u5.split(`
`).length, p3 = d ? formatInstructionFooter(SELECT_INSTRUCTIONS, n3) : n3 ? [styleText2("cyan", S_BAR_END)] : [], b3 = p3.join(`
`), f2 = p3.length + 1;
              return `${u5}${r2}${limitOptions({
                output: t2.output,
                cursor: this.cursor,
                options: this.options,
                maxItems: t2.maxItems,
                columnPadding: r2.length,
                rowPadding: a2 + f2,
                style: (g2, x2) => o2(g2, g2.disabled ? "disabled" : x2 ? "active" : "inactive")
              }).join(`
${r2}`)}
${b3}
`;
            }
          }
        }
      }).prompt();
    };
    selectKey = (t2) => {
      const l2 = (e, a2 = "inactive") => {
        if (e === void 0)
          return "";
        const n3 = e.label ?? String(e.value);
        return a2 === "selected" ? `${styleText2("dim", n3)}` : a2 === "cancelled" ? `${styleText2(["strikethrough", "dim"], n3)}` : a2 === "active" ? `${styleText2(["bgCyan", "gray"], ` ${e.value} `)} ${n3}${e.hint ? ` ${styleText2("dim", `(${e.hint})`)}` : ""}` : `${styleText2(["gray", "bgWhite", "inverse"], ` ${e.value} `)} ${n3}${e.hint ? ` ${styleText2("dim", `(${e.hint})`)}` : ""}`;
      };
      return new u3({
        options: t2.options,
        signal: t2.signal,
        input: t2.input,
        output: t2.output,
        initialValue: t2.initialValue,
        caseSensitive: t2.caseSensitive,
        render() {
          const e = t2.withGuide ?? settings.withGuide, a2 = `${e ? `${styleText2("gray", S_BAR)}
` : ""}${symbol(this.state)}  ${t2.message}
`;
          switch (this.state) {
            case "submit": {
              const n3 = e ? `${styleText2("gray", S_BAR)}  ` : "", s = this.options.find((u5) => u5.value === this.value) ?? t2.options[0], c3 = wrapTextWithPrefix(
                t2.output,
                l2(s, "selected"),
                n3
              );
              return `${a2}${c3}`;
            }
            case "cancel": {
              const n3 = e ? `${styleText2("gray", S_BAR)}  ` : "", s = wrapTextWithPrefix(
                t2.output,
                l2(this.options[0], "cancelled"),
                n3
              );
              return `${a2}${s}${e ? `
${styleText2("gray", S_BAR)}` : ""}`;
            }
            default: {
              const n3 = e ? `${styleText2("cyan", S_BAR)}  ` : "", s = e ? styleText2("cyan", S_BAR_END) : "", c3 = this.options.map(
                (u5, d) => wrapTextWithPrefix(
                  t2.output,
                  l2(u5, d === this.cursor ? "active" : "inactive"),
                  n3
                )
              ).join(`
`);
              return `${a2}${c3}
${s}
`;
            }
          }
        }
      }).prompt();
    };
    i = `${styleText2("gray", S_BAR)}  `;
    stream = {
      message: async (e, { symbol: l2 = styleText2("gray", S_BAR) } = {}) => {
        process.stdout.write(`${styleText2("gray", S_BAR)}
${l2}  `);
        let s = 3;
        for await (let r2 of e) {
          r2 = r2.replace(/\n/g, `
${i}`), r2.includes(`
`) && (s = 3 + stripVTControlCharacters(r2.slice(r2.lastIndexOf(`
`))).length);
          const o2 = stripVTControlCharacters(r2).length;
          s + o2 < process.stdout.columns ? (s += o2, process.stdout.write(r2)) : (process.stdout.write(`
${i}${r2.trimStart()}`), s = 3 + stripVTControlCharacters(r2.trimStart()).length);
        }
        process.stdout.write(`
`);
      },
      info: (e) => stream.message(e, { symbol: styleText2("blue", S_INFO) }),
      success: (e) => stream.message(e, { symbol: styleText2("green", S_SUCCESS) }),
      step: (e) => stream.message(e, { symbol: styleText2("green", S_STEP_SUBMIT) }),
      warn: (e) => stream.message(e, { symbol: styleText2("yellow", S_WARN) }),
      /** alias for `log.warn()`. */
      warning: (e) => stream.warn(e),
      error: (e) => stream.message(e, { symbol: styleText2("red", S_ERROR) })
    };
    tasks = async (o2, e) => {
      for (const t2 of o2) {
        if (t2.enabled === false) continue;
        const s = spinner(e);
        s.start(t2.title);
        const n3 = await t2.task(s.message);
        s.stop(n3 || t2.title);
      }
    };
    A = (l2) => l2.replace(/\x1b\[(?:\d+;)*\d*[ABCDEFGHfJKSTsu]|\x1b\[(s|u)/g, "");
    taskLog = (l2) => {
      const r2 = l2.output ?? process.stdout, O = getColumns(r2), i2 = styleText2("gray", S_BAR), p3 = l2.spacing ?? 1, k = 3, m3 = l2.retainLog === true, d = !isCI() && isTTY(r2);
      r2.write(`${i2}
`), r2.write(`${styleText2("green", S_STEP_SUBMIT)}  ${l2.title}
`);
      for (let e = 0; e < p3; e++)
        r2.write(`${i2}
`);
      const n3 = [
        {
          value: "",
          full: ""
        }
      ];
      let v = false;
      const f2 = (e) => {
        if (n3.length === 0)
          return;
        let s = 0;
        e && (s += p3 + 2);
        for (const t2 of n3) {
          const { value: o2, result: a2 } = t2;
          let g2 = a2?.message ?? o2;
          if (g2.length === 0)
            continue;
          a2 === void 0 && t2.header !== void 0 && t2.header !== "" && (g2 += `
${t2.header}`);
          const E2 = g2.split(`
`).reduce((b3, w) => w === "" ? b3 + 1 : b3 + Math.ceil((w.length + k) / O), 0);
          s += E2;
        }
        s > 0 && (s += 1, r2.write(import_sisteransi2.erase.lines(s)));
      }, h2 = (e, s, t2) => {
        const o2 = t2 ? `${e.full}
${e.value}` : e.value;
        e.header !== void 0 && e.header !== "" && log.message(
          e.header.split(`
`).map((a2) => styleText2("bold", a2)),
          {
            output: r2,
            secondarySymbol: i2,
            symbol: i2,
            spacing: 0
          }
        ), log.message(
          o2.split(`
`).map((a2) => styleText2("dim", a2)),
          {
            output: r2,
            secondarySymbol: i2,
            symbol: i2,
            spacing: s ?? p3
          }
        );
      }, T3 = () => {
        for (const e of n3) {
          const { header: s, value: t2, full: o2 } = e;
          (s === void 0 || s.length === 0) && t2.length === 0 || h2(e, void 0, m3 === true && o2.length > 0);
        }
      }, L = (e, s, t2) => {
        if (f2(false), (t2?.raw !== true || !v) && e.value !== "" && (e.value += `
`), e.value += A(s), v = t2?.raw === true, l2.limit !== void 0) {
          const o2 = e.value.split(`
`), a2 = o2.length - l2.limit;
          if (a2 > 0) {
            const g2 = o2.splice(0, a2);
            m3 && (e.full += (e.full === "" ? "" : `
`) + g2.join(`
`));
          }
          e.value = o2.join(`
`);
        }
        d && y();
      }, y = () => {
        for (const e of n3)
          e.result ? e.result.status === "error" ? log.error(e.result.message, { output: r2, secondarySymbol: i2, spacing: 0 }) : log.success(e.result.message, { output: r2, secondarySymbol: i2, spacing: 0 }) : e.value !== "" && h2(e, 0);
      }, B = (e, s) => {
        f2(false), e.result = s, d && y();
      };
      return {
        message(e, s) {
          L(n3[0], e, s);
        },
        group(e) {
          const s = {
            header: e,
            value: "",
            full: ""
          };
          return n3.push(s), {
            message(t2, o2) {
              L(s, t2, o2);
            },
            error(t2) {
              B(s, {
                status: "error",
                message: t2
              });
            },
            success(t2) {
              B(s, {
                status: "success",
                message: t2
              });
            }
          };
        },
        error(e, s) {
          f2(true), log.error(e, { output: r2, secondarySymbol: i2, spacing: 1 }), s?.showLog !== false && T3(), n3.splice(1, n3.length - 1), n3[0].value = "", n3[0].full = "";
        },
        success(e, s) {
          f2(true), log.success(e, { output: r2, secondarySymbol: i2, spacing: 1 }), s?.showLog === true && T3(), n3.splice(1, n3.length - 1), n3[0].value = "", n3[0].full = "";
        }
      };
    };
    text = (e) => new n2({
      validate: e.validate,
      placeholder: e.placeholder,
      defaultValue: e.defaultValue,
      initialValue: e.initialValue,
      output: e.output,
      signal: e.signal,
      input: e.input,
      render() {
        const i2 = e?.withGuide ?? settings.withGuide, s = `${`${i2 ? `${styleText2("gray", S_BAR)}
` : ""}${symbol(this.state)}  `}${e.message}
`, c3 = e.placeholder && e.placeholder.length > 0 ? (
          // biome-ignore lint/style/noNonNullAssertion: guarded by placeholder.length > 0
          styleText2("inverse", e.placeholder[0]) + styleText2("dim", e.placeholder.slice(1))
        ) : styleText2(["inverse", "hidden"], "_"), o2 = this.userInput ? this.userInputWithCursor : c3, l2 = this.value ?? "";
        switch (this.state) {
          case "error": {
            const n3 = this.error ? `  ${styleText2("yellow", this.error)}` : "", r2 = i2 ? `${styleText2("yellow", S_BAR)}  ` : "", d = i2 ? styleText2("yellow", S_BAR_END) : "";
            return `${s.trim()}
${r2}${o2}
${d}${n3}
`;
          }
          case "submit": {
            const n3 = l2 ? `  ${styleText2("dim", l2)}` : "", r2 = i2 ? styleText2("gray", S_BAR) : "";
            return `${s}${r2}${n3}`;
          }
          case "cancel": {
            const n3 = l2 ? `  ${styleText2(["strikethrough", "dim"], l2)}` : "", r2 = i2 ? styleText2("gray", S_BAR) : "";
            return `${s}${r2}${n3}${l2.trim() ? `
${r2}` : ""}`;
          }
          default: {
            const n3 = i2 ? `${styleText2("cyan", S_BAR)}  ` : "", r2 = i2 ? styleText2("cyan", S_BAR_END) : "";
            return `${s}${n3}${o2}
${r2}
`;
          }
        }
      }
    }).prompt();
  }
});

// node_modules/.pnpm/@stricli+core@1.3.0/node_modules/@stricli/core/dist/index.js
var ExitCode = {
  /**
   * Error was thrown by or otherwise caused by an integration.
   */
  IntegrationError: -10,
  /**
   * Unable to find a command in the application with the given command line arguments.
   */
  UnknownCommand: -5,
  /**
   * Unable to parse the specified arguments.
   */
  InvalidArgument: -4,
  /**
   * An error was thrown while loading the context for a command run.
   */
  ContextLoadError: -3,
  /**
   * Failed to load command module.
   */
  CommandLoadError: -2,
  /**
   * An unexpected error was thrown by or not caught by this library.
   */
  InternalError: -1,
  /**
   * Command executed successfully.
   */
  Success: 0,
  /**
   * Command module unexpectedly threw an error.
   */
  CommandRunError: 1
};
function convertKebabCaseToCamelCase(str2) {
  return str2.replace(/-./g, (match) => match[1].toUpperCase());
}
function convertCamelCaseToKebabCase(name) {
  return Array.from(name).map((char, i2) => {
    const upper = char.toUpperCase();
    const lower = char.toLowerCase();
    if (i2 === 0 || upper !== char || upper === lower) {
      return char;
    }
    return `-${lower}`;
  }).join("");
}
function newSparseMatrix(defaultValue) {
  const values = /* @__PURE__ */ new Map();
  return {
    get: (...args) => {
      return values.get(args.join(",")) ?? defaultValue;
    },
    set: (value, ...args) => {
      values.set(args.join(","), value);
    }
    // toString([iMin, iMax], [jMin, jMax]) {
    //   const rows: string[] = [];
    //   for (let i = iMin; i <= iMax; ++i) {
    //     const row: string[] = [];
    //     for (let j = jMin; j <= jMax; ++j) {
    //       row.push(this.get(i, j).toString());
    //     }
    //     rows.push(row.join(", "));
    //   }
    //   return rows.join("\n");
    // },
  };
}
function damerauLevenshtein(a2, b3, options) {
  const { threshold, weights } = options;
  if (a2 === b3) {
    return 0;
  }
  const lengthDiff = Math.abs(a2.length - b3.length);
  if (typeof threshold === "number" && lengthDiff > threshold) {
    return Infinity;
  }
  const matrix = newSparseMatrix(Infinity);
  matrix.set(0, -1, -1);
  for (let j = 0; j < b3.length; ++j) {
    matrix.set((j + 1) * weights.insertion, -1, j);
  }
  for (let i2 = 0; i2 < a2.length; ++i2) {
    matrix.set((i2 + 1) * weights.deletion, i2, -1);
  }
  let prevRowMinDistance = -Infinity;
  for (let i2 = 0; i2 < a2.length; ++i2) {
    let rowMinDistance = Infinity;
    for (let j = 0; j <= b3.length - 1; ++j) {
      const cost = a2[i2] === b3[j] ? 0 : 1;
      const distances = [
        // deletion
        matrix.get(i2 - 1, j) + weights.deletion,
        // insertion
        matrix.get(i2, j - 1) + weights.insertion,
        // substitution
        matrix.get(i2 - 1, j - 1) + cost * weights.substitution
      ];
      if (a2[i2] === b3[j - 1] && a2[i2 - 1] === b3[j]) {
        distances.push(matrix.get(i2 - 2, j - 2) + cost * weights.transposition);
      }
      const minDistance = Math.min(...distances);
      matrix.set(minDistance, i2, j);
      if (minDistance < rowMinDistance) {
        rowMinDistance = minDistance;
      }
    }
    if (rowMinDistance > threshold) {
      if (prevRowMinDistance > threshold) {
        return Infinity;
      }
      prevRowMinDistance = rowMinDistance;
    } else {
      prevRowMinDistance = -Infinity;
    }
  }
  const distance = matrix.get(a2.length - 1, b3.length - 1);
  if (distance > threshold) {
    return Infinity;
  }
  return distance;
}
function compareAlternatives(a2, b3, target) {
  const cmp = a2[1] - b3[1];
  if (cmp !== 0) {
    return cmp;
  }
  const aStartsWith = a2[0].startsWith(target);
  const bStartsWith = b3[0].startsWith(target);
  if (aStartsWith && !bStartsWith) {
    return -1;
  } else if (!aStartsWith && bStartsWith) {
    return 1;
  }
  return a2[0].localeCompare(b3[0]);
}
function filterClosestAlternatives(target, alternatives, options) {
  const validAlternatives = alternatives.map((alt) => [alt, damerauLevenshtein(target, alt, options)]).filter(([, dist]) => dist <= options.threshold);
  const minDistance = Math.min(...validAlternatives.map(([, dist]) => dist));
  return validAlternatives.filter(([, dist]) => dist === minDistance).sort((a2, b3) => compareAlternatives(a2, b3, target)).map(([alt]) => alt);
}
var InternalError = class extends Error {
};
function formatException(exc) {
  if (exc instanceof Error) {
    return exc.stack ?? String(exc);
  }
  return String(exc);
}
function maximum(arr1, arr2) {
  const maxValues = [];
  const maxLength = Math.max(arr1.length, arr2.length);
  for (let i2 = 0; i2 < maxLength; ++i2) {
    maxValues[i2] = Math.max(arr1[i2], arr2[i2]);
  }
  return maxValues;
}
function formatRowsWithColumns(cells, separators) {
  if (cells.length === 0) {
    return [];
  }
  const startingLengths = Array(Math.max(...cells.map((cellRow) => cellRow.length))).fill(0, 0);
  const maxLengths = cells.reduce((acc, cellRow) => {
    const lengths = cellRow.map((cell) => cell.length);
    return maximum(acc, lengths);
  }, startingLengths);
  return cells.map((cellRow) => {
    const firstCell = (cellRow[0] ?? "").padEnd(maxLengths[0]);
    return cellRow.slice(1).reduce(
      (parts, str2, i2, arr) => {
        const paddedStr = arr.length === i2 + 1 ? str2 : str2.padEnd(maxLengths[i2 + 1]);
        return [...parts, separators?.[i2] ?? " ", paddedStr];
      },
      [firstCell]
    ).join("").trimEnd();
  });
}
function joinWithGrammar(parts, grammar) {
  if (parts.length <= 1) {
    return parts[0] ?? "";
  }
  if (parts.length === 2) {
    return parts.join(` ${grammar.conjunction} `);
  }
  let allButLast = parts.slice(0, parts.length - 1).join(", ");
  if (grammar.serialComma) {
    allButLast += ",";
  }
  return [allButLast, grammar.conjunction, parts[parts.length - 1]].join(" ");
}
function group(array, callback) {
  return array.reduce((groupings, item) => {
    const key = callback(item);
    const groupItems = groupings[key] ?? [];
    groupItems.push(item);
    groupings[key] = groupItems;
    return groupings;
  }, {});
}
function groupBy(array, selector) {
  return group(array, (item) => item[selector]);
}
async function allSettledOrElse(values) {
  const results = await Promise.allSettled(values);
  const grouped = groupBy(results, "status");
  if (grouped.rejected && grouped.rejected.length > 0) {
    return { status: "rejected", reasons: grouped.rejected.map((result) => result.reason) };
  }
  return { status: "fulfilled", value: grouped.fulfilled?.map((result) => result.value) ?? [] };
}
var TRUTHY_VALUES = /* @__PURE__ */ new Set(["true", "t", "yes", "y", "on", "1", ""]);
var FALSY_VALUES = /* @__PURE__ */ new Set(["false", "f", "no", "n", "off", "0"]);
var looseBooleanParser = (input) => {
  const value = input.toLowerCase();
  if (TRUTHY_VALUES.has(value)) {
    return true;
  }
  if (FALSY_VALUES.has(value)) {
    return false;
  }
  throw new SyntaxError(`Cannot convert ${input} to a boolean`);
};
var numberParser = (input) => {
  const value = Number(input);
  if (Number.isNaN(value)) {
    throw new SyntaxError(`Cannot convert ${input} to a number`);
  }
  return value;
};
var ArgumentScannerError = class extends InternalError {
  _brand;
};
function formatMessageForArgumentScannerError(error, formatter) {
  const errorType = error.constructor.name;
  const formatError = formatter[errorType];
  if (formatError) {
    return formatError(error);
  }
  return error.message;
}
function resolveAllowedNegationForFlags(flags) {
  return Object.fromEntries(
    Object.entries(flags).map(([internalFlagName, flag]) => {
      return [internalFlagName, flag.kind === "boolean" && flag.withNegated !== false];
    })
  );
}
function resolveAliases(flags, aliases, scannerCaseStyle) {
  return Object.fromEntries(
    Object.entries(aliases).map(([alias, internalFlagName_]) => {
      const internalFlagName = internalFlagName_;
      const flag = flags[internalFlagName];
      if (!flag) {
        const externalFlagName = asExternal(internalFlagName, scannerCaseStyle);
        throw new FlagNotFoundError(externalFlagName, [], alias);
      }
      return [alias, [internalFlagName, flag]];
    })
  );
}
var FlagNotFoundError = class extends ArgumentScannerError {
  /**
   * Command line input that triggered this error.
   */
  input;
  /**
   * Set of proposed suggestions that are similar to the input.
   */
  corrections;
  /**
   * Set if error was caused indirectly by an alias.
   * This indicates that something is wrong with the command configuration itself.
   */
  aliasName;
  constructor(input, corrections, aliasName) {
    let message = `No flag registered for --${input}`;
    if (aliasName) {
      message += ` (aliased from -${aliasName})`;
    } else if (corrections.length > 0) {
      const formattedCorrections = joinWithGrammar(
        corrections.map((correction) => `--${correction}`),
        {
          kind: "conjunctive",
          conjunction: "or",
          serialComma: true
        }
      );
      message += `, did you mean ${formattedCorrections}?`;
    }
    super(message);
    this.input = input;
    this.corrections = corrections;
    this.aliasName = aliasName;
  }
};
var AliasNotFoundError = class extends ArgumentScannerError {
  /**
   * Command line input that triggered this error.
   */
  input;
  constructor(input) {
    super(`No alias registered for -${input}`);
    this.input = input;
  }
};
function getPlaceholder(param, index) {
  if (param.placeholder) {
    return param.placeholder;
  }
  return typeof index === "number" ? `arg${index}` : "args";
}
function asExternal(internal, scannerCaseStyle) {
  return scannerCaseStyle === "allow-kebab-for-camel" ? convertCamelCaseToKebabCase(internal) : internal;
}
var ArgumentParseError = class extends ArgumentScannerError {
  /**
   * External name of flag or placeholder for positional argument that was parsing this input.
   */
  externalFlagNameOrPlaceholder;
  /**
   * Command line input that triggered this error.
   */
  input;
  /**
   * Raw exception thrown from parse function.
   */
  exception;
  constructor(externalFlagNameOrPlaceholder, input, exception) {
    super(
      `Failed to parse "${input}" for ${externalFlagNameOrPlaceholder}: ${exception instanceof Error ? exception.message : String(exception)}`
    );
    this.externalFlagNameOrPlaceholder = externalFlagNameOrPlaceholder;
    this.input = input;
    this.exception = exception;
  }
};
function parseInput(externalFlagNameOrPlaceholder, parameter, input, context) {
  try {
    return parameter.parse.call(context, input);
  } catch (exc) {
    throw new ArgumentParseError(externalFlagNameOrPlaceholder, input, exc);
  }
}
var EnumValidationError = class extends ArgumentScannerError {
  /**
   * External name of flag that was parsing this input.
   */
  externalFlagName;
  /**
   * Command line input that triggered this error.
   */
  input;
  /**
   * All possible enum values.
   */
  values;
  constructor(externalFlagName, input, values, corrections) {
    let message = `Expected "${input}" to be one of (${values.join("|")})`;
    if (corrections.length > 0) {
      const formattedCorrections = joinWithGrammar(
        corrections.map((str2) => `"${str2}"`),
        {
          kind: "conjunctive",
          conjunction: "or",
          serialComma: true
        }
      );
      message += `, did you mean ${formattedCorrections}?`;
    }
    super(message);
    this.externalFlagName = externalFlagName;
    this.input = input;
    this.values = values;
  }
};
var UnsatisfiedFlagError = class extends ArgumentScannerError {
  /**
   * External name of flag that was active when this error was thrown.
   */
  externalFlagName;
  /**
   * External name of flag that interrupted the original flag.
   */
  nextFlagName;
  constructor(externalFlagName, nextFlagName) {
    let message = `Expected input for flag --${externalFlagName}`;
    if (nextFlagName) {
      message += ` but encountered --${nextFlagName} instead`;
    }
    super(message);
    this.externalFlagName = externalFlagName;
    this.nextFlagName = nextFlagName;
  }
};
var UnexpectedPositionalError = class extends ArgumentScannerError {
  /**
   * Expected (maximum) count of positional arguments.
   */
  expectedCount;
  /**
   * Command line input that triggered this error.
   */
  input;
  constructor(expectedCount, input) {
    super(`Too many arguments, expected ${expectedCount} but encountered "${input}"`);
    this.expectedCount = expectedCount;
    this.input = input;
  }
};
var UnsatisfiedPositionalError = class extends ArgumentScannerError {
  /**
   * Placeholder for positional argument that was active when this error was thrown.
   */
  placeholder;
  /**
   * If specified, indicates the minimum number of arguments that are expected and the last argument count.
   */
  limit;
  constructor(placeholder, limit) {
    let message;
    if (limit) {
      message = `Expected at least ${limit[0]} argument(s) for ${placeholder}`;
      if (limit[1] === 0) {
        message += " but found none";
      } else {
        message += ` but only found ${limit[1]}`;
      }
    } else {
      message = `Expected argument for ${placeholder}`;
    }
    super(message);
    this.placeholder = placeholder;
    this.limit = limit;
  }
};
function undoNegation(flagName) {
  if (flagName.startsWith("no") && flagName.length > 2) {
    if (flagName[2] === "-") {
      return flagName.slice(4);
    }
    const firstChar = flagName[2];
    const firstUpper = firstChar.toUpperCase();
    if (firstChar !== firstUpper) {
      return;
    }
    const firstLower = firstChar.toLowerCase();
    return firstLower + flagName.slice(3);
  }
}
function findInternalFlagMatch(externalFlagName, flags, allowsNegation, config) {
  const internalFlagName = externalFlagName;
  let flag = flags[internalFlagName];
  let foundFlagWithNegatedFalse;
  let foundFlagWithNegatedFalseFromKebabConversion = false;
  if (!flag) {
    const internalWithoutNegation = undoNegation(internalFlagName);
    if (internalWithoutNegation) {
      flag = flags[internalWithoutNegation];
      if (flag) {
        if (allowsNegation[internalWithoutNegation]) {
          return [internalWithoutNegation, flag, true];
        } else {
          foundFlagWithNegatedFalse = internalWithoutNegation;
          flag = void 0;
        }
      }
    }
  }
  const camelCaseFlagName = convertKebabCaseToCamelCase(externalFlagName);
  if (config.caseStyle === "allow-kebab-for-camel" && !flag) {
    flag = flags[camelCaseFlagName];
    if (flag) {
      return [camelCaseFlagName, flag];
    }
    const camelCaseWithoutNegation = undoNegation(camelCaseFlagName);
    if (camelCaseWithoutNegation) {
      flag = flags[camelCaseWithoutNegation];
      if (flag) {
        if (allowsNegation[camelCaseWithoutNegation]) {
          return [camelCaseWithoutNegation, flag, true];
        } else {
          foundFlagWithNegatedFalse = camelCaseWithoutNegation;
          foundFlagWithNegatedFalseFromKebabConversion = true;
          flag = void 0;
        }
      }
    }
  }
  if (!flag) {
    if (foundFlagWithNegatedFalse) {
      let correction = foundFlagWithNegatedFalse;
      if (foundFlagWithNegatedFalseFromKebabConversion && externalFlagName.includes("-")) {
        correction = convertCamelCaseToKebabCase(foundFlagWithNegatedFalse);
      }
      throw new FlagNotFoundError(externalFlagName, [correction]);
    }
    if (camelCaseFlagName in flags) {
      throw new FlagNotFoundError(externalFlagName, [camelCaseFlagName]);
    }
    const kebabCaseFlagName = convertCamelCaseToKebabCase(externalFlagName);
    if (kebabCaseFlagName in flags) {
      throw new FlagNotFoundError(externalFlagName, [kebabCaseFlagName]);
    }
    const corrections = filterClosestAlternatives(internalFlagName, Object.keys(flags), config.distanceOptions);
    throw new FlagNotFoundError(externalFlagName, corrections);
  }
  return [internalFlagName, flag];
}
function isNiladic(namedFlagWithNegation) {
  if (namedFlagWithNegation[1].kind === "boolean" || namedFlagWithNegation[1].kind === "counter") {
    return true;
  }
  return false;
}
var FLAG_SHORTHAND_PATTERN = /^-([a-z]+)$/i;
var FLAG_NAME_PATTERN = /^--([a-z][a-z-.\d_]+)$/i;
function findFlagsByArgument(arg, flags, allowsNegation, resolvedAliases, config) {
  const shorthandMatch = FLAG_SHORTHAND_PATTERN.exec(arg);
  if (shorthandMatch) {
    const batch = shorthandMatch[1];
    return Array.from(batch).map((alias) => {
      const aliasName = alias;
      const namedFlag = resolvedAliases[aliasName];
      if (!namedFlag) {
        throw new AliasNotFoundError(aliasName);
      }
      return namedFlag;
    });
  }
  const flagNameMatch = FLAG_NAME_PATTERN.exec(arg);
  if (flagNameMatch) {
    const externalFlagName = flagNameMatch[1];
    return [findInternalFlagMatch(externalFlagName, flags, allowsNegation, config)];
  }
  return [];
}
var FLAG_NAME_VALUE_PATTERN = /^--([a-z][a-z-.\d_]+)=(.+)$/i;
var ALIAS_VALUE_PATTERN = /^-([a-z])=(.+)$/i;
var InvalidNegatedFlagSyntaxError = class extends ArgumentScannerError {
  /**
   * External name of flag that was active when this error was thrown.
   */
  externalFlagName;
  /**
   * Input text equivalent to right hand side of input
   */
  valueText;
  constructor(externalFlagName, valueText) {
    super(`Cannot negate flag --${externalFlagName} and pass "${valueText}" as value`);
    this.externalFlagName = externalFlagName;
    this.valueText = valueText;
  }
};
function findFlagByArgumentWithInput(arg, flags, allowsNegation, resolvedAliases, config) {
  const flagsNameMatch = FLAG_NAME_VALUE_PATTERN.exec(arg);
  if (flagsNameMatch) {
    const externalFlagName = flagsNameMatch[1];
    const namedFlag = findInternalFlagMatch(externalFlagName, flags, allowsNegation, config);
    const valueText = flagsNameMatch[2];
    if (namedFlag[2]) {
      throw new InvalidNegatedFlagSyntaxError(externalFlagName, valueText);
    }
    return [namedFlag, valueText];
  }
  const aliasValueMatch = ALIAS_VALUE_PATTERN.exec(arg);
  if (aliasValueMatch) {
    const aliasName = aliasValueMatch[1];
    const namedFlag = resolvedAliases[aliasName];
    if (!namedFlag) {
      throw new AliasNotFoundError(aliasName);
    }
    const valueText = aliasValueMatch[2];
    return [namedFlag, valueText];
  }
}
async function parseInputsForFlag(externalFlagName, flag, inputs, config, context) {
  if (!inputs) {
    if ("default" in flag && typeof flag.default !== "undefined") {
      if (flag.kind === "boolean") {
        return flag.default;
      }
      if (flag.kind === "enum") {
        if ("variadic" in flag && flag.variadic && Array.isArray(flag.default)) {
          const defaultArray = flag.default;
          for (const value of defaultArray) {
            if (!flag.values.includes(value)) {
              const corrections = filterClosestAlternatives(value, flag.values, config.distanceOptions);
              throw new EnumValidationError(externalFlagName, value, flag.values, corrections);
            }
          }
          return flag.default;
        }
        return flag.default;
      }
      if ("variadic" in flag && flag.variadic && Array.isArray(flag.default)) {
        const defaultArray = flag.default;
        return Promise.all(defaultArray.map((input2) => parseInput(externalFlagName, flag, input2, context)));
      }
      return parseInput(externalFlagName, flag, flag.default, context);
    }
    if (flag.optional) {
      return;
    }
    if (flag.kind === "boolean") {
      return false;
    } else if (flag.kind === "counter") {
      return 0;
    }
    throw new UnsatisfiedFlagError(externalFlagName);
  }
  if (flag.kind === "counter") {
    return inputs.reduce((total, input2) => {
      try {
        return total + numberParser.call(context, input2);
      } catch (exc) {
        throw new ArgumentParseError(externalFlagName, input2, exc);
      }
    }, 0);
  }
  if ("variadic" in flag && flag.variadic) {
    if (flag.kind === "enum") {
      for (const input2 of inputs) {
        if (!flag.values.includes(input2)) {
          const corrections = filterClosestAlternatives(input2, flag.values, config.distanceOptions);
          throw new EnumValidationError(externalFlagName, input2, flag.values, corrections);
        }
      }
      return inputs;
    }
    return Promise.all(inputs.map((input2) => parseInput(externalFlagName, flag, input2, context)));
  }
  const input = inputs[0];
  if (flag.kind === "boolean") {
    try {
      return looseBooleanParser.call(context, input);
    } catch (exc) {
      throw new ArgumentParseError(externalFlagName, input, exc);
    }
  }
  if (flag.kind === "enum") {
    if (!flag.values.includes(input)) {
      const corrections = filterClosestAlternatives(input, flag.values, config.distanceOptions);
      throw new EnumValidationError(externalFlagName, input, flag.values, corrections);
    }
    return input;
  }
  return parseInput(externalFlagName, flag, input, context);
}
var UnexpectedFlagError = class extends ArgumentScannerError {
  /**
   * External name of flag that was parsing this input.
   */
  externalFlagName;
  /**
   * Command line input that was previously encountered by this flag.
   */
  previousInput;
  /**
   * Command line input that triggered this error.
   */
  input;
  constructor(externalFlagName, previousInput, input) {
    super(`Too many arguments for --${externalFlagName}, encountered "${input}" after "${previousInput}"`);
    this.externalFlagName = externalFlagName;
    this.previousInput = previousInput;
    this.input = input;
  }
};
function isVariadicFlag(flag) {
  if (flag.kind === "counter") {
    return true;
  }
  if ("variadic" in flag) {
    return Boolean(flag.variadic);
  }
  return false;
}
function storeInput(flagInputs, scannerCaseStyle, [internalFlagName, flag], input) {
  const inputs = flagInputs.get(internalFlagName) ?? [];
  if (inputs.length > 0 && !isVariadicFlag(flag)) {
    const externalFlagName = asExternal(internalFlagName, scannerCaseStyle);
    throw new UnexpectedFlagError(externalFlagName, inputs[0], input);
  }
  if ("variadic" in flag && typeof flag.variadic === "string") {
    const multipleInputs = input.split(flag.variadic);
    flagInputs.set(internalFlagName, [...inputs, ...multipleInputs]);
  } else {
    flagInputs.set(internalFlagName, [...inputs, input]);
  }
}
function isFlagSatisfiedByInputs(flags, flagInputs, key) {
  const inputs = flagInputs.get(key);
  if (inputs) {
    const flag = flags[key];
    if (isVariadicFlag(flag)) {
      return false;
    }
    return true;
  }
  return false;
}
function buildArgumentScanner(parameters, config) {
  const { flags = {}, aliases = {}, positional = { kind: "tuple", parameters: [] } } = parameters;
  const allowsNegation = resolveAllowedNegationForFlags(flags);
  const resolvedAliases = resolveAliases(flags, aliases, config.caseStyle);
  const positionalInputs = [];
  const flagInputs = /* @__PURE__ */ new Map();
  let positionalIndex = 0;
  let activeFlag;
  let treatInputsAsArguments = false;
  return {
    next: (input) => {
      if (!treatInputsAsArguments && config.allowArgumentEscapeSequence && input === "--") {
        if (activeFlag) {
          if (activeFlag[1].kind === "parsed" && activeFlag[1].inferEmpty) {
            storeInput(flagInputs, config.caseStyle, activeFlag, "");
            activeFlag = void 0;
          } else {
            const externalFlagName = asExternal(activeFlag[0], config.caseStyle);
            throw new UnsatisfiedFlagError(externalFlagName);
          }
        }
        treatInputsAsArguments = true;
        return;
      }
      if (!treatInputsAsArguments) {
        const flagInput = findFlagByArgumentWithInput(input, flags, allowsNegation, resolvedAliases, config);
        if (flagInput) {
          if (activeFlag) {
            if (activeFlag[1].kind === "parsed" && activeFlag[1].inferEmpty) {
              storeInput(flagInputs, config.caseStyle, activeFlag, "");
              activeFlag = void 0;
            } else {
              const externalFlagName = asExternal(activeFlag[0], config.caseStyle);
              const nextExternalFlagName = asExternal(flagInput[0][0], config.caseStyle);
              throw new UnsatisfiedFlagError(externalFlagName, nextExternalFlagName);
            }
          }
          storeInput(flagInputs, config.caseStyle, ...flagInput);
          return;
        }
        const nextFlags = findFlagsByArgument(input, flags, allowsNegation, resolvedAliases, config);
        if (nextFlags.length > 0) {
          if (activeFlag) {
            if (activeFlag[1].kind === "parsed" && activeFlag[1].inferEmpty) {
              storeInput(flagInputs, config.caseStyle, activeFlag, "");
              activeFlag = void 0;
            } else {
              const externalFlagName = asExternal(activeFlag[0], config.caseStyle);
              const nextFlagName = asExternal(nextFlags[0][0], config.caseStyle);
              throw new UnsatisfiedFlagError(externalFlagName, nextFlagName);
            }
          }
          if (nextFlags.every(isNiladic)) {
            for (const nextFlag of nextFlags) {
              if (nextFlag[1].kind === "boolean") {
                storeInput(flagInputs, config.caseStyle, nextFlag, nextFlag[2] ? "false" : "true");
              } else {
                storeInput(flagInputs, config.caseStyle, nextFlag, "1");
              }
            }
          } else if (nextFlags.length > 1) {
            const nextFlagExpectingArg = nextFlags.find((nextFlag) => !isNiladic(nextFlag));
            const externalFlagName = asExternal(nextFlagExpectingArg[0], config.caseStyle);
            throw new UnsatisfiedFlagError(externalFlagName);
          } else {
            activeFlag = nextFlags[0];
          }
          return;
        }
      }
      if (activeFlag) {
        storeInput(flagInputs, config.caseStyle, activeFlag, input);
        activeFlag = void 0;
      } else {
        if (positional.kind === "tuple") {
          if (positionalIndex >= positional.parameters.length) {
            throw new UnexpectedPositionalError(positional.parameters.length, input);
          }
        } else {
          if (typeof positional.maximum === "number" && positionalIndex >= positional.maximum) {
            throw new UnexpectedPositionalError(positional.maximum, input);
          }
        }
        positionalInputs[positionalIndex] = input;
        ++positionalIndex;
      }
    },
    parseArguments: async (context) => {
      const errors = [];
      let positionalValues_p;
      if (positional.kind === "array") {
        if (typeof positional.minimum === "number" && positionalIndex < positional.minimum) {
          errors.push(
            new UnsatisfiedPositionalError(getPlaceholder(positional.parameter), [
              positional.minimum,
              positionalIndex
            ])
          );
        }
        positionalValues_p = allSettledOrElse(
          positionalInputs.map(async (input, i2) => {
            const placeholder = getPlaceholder(positional.parameter, i2 + 1);
            return parseInput(placeholder, positional.parameter, input, context);
          })
        );
      } else {
        positionalValues_p = allSettledOrElse(
          positional.parameters.map(async (param, i2) => {
            const placeholder = getPlaceholder(param, i2 + 1);
            const input = positionalInputs[i2];
            if (typeof input !== "string") {
              if (typeof param.default === "string") {
                return parseInput(placeholder, param, param.default, context);
              }
              if (param.optional) {
                return;
              }
              throw new UnsatisfiedPositionalError(placeholder);
            }
            return parseInput(placeholder, param, input, context);
          })
        );
      }
      if (activeFlag && activeFlag[1].kind === "parsed" && activeFlag[1].inferEmpty) {
        storeInput(flagInputs, config.caseStyle, activeFlag, "");
        activeFlag = void 0;
      }
      const flagEntries_p = allSettledOrElse(
        Object.entries(flags).map(async (entry) => {
          const [internalFlagName, flag] = entry;
          const externalFlagName = asExternal(internalFlagName, config.caseStyle);
          if (activeFlag && activeFlag[0] === internalFlagName) {
            throw new UnsatisfiedFlagError(externalFlagName);
          }
          const inputs = flagInputs.get(internalFlagName);
          const value = await parseInputsForFlag(externalFlagName, flag, inputs, config, context);
          return [internalFlagName, value];
        })
      );
      const [positionalValuesResult, flagEntriesResult] = await Promise.all([positionalValues_p, flagEntries_p]);
      if (positionalValuesResult.status === "rejected") {
        for (const reason of positionalValuesResult.reasons) {
          errors.push(reason);
        }
      }
      if (flagEntriesResult.status === "rejected") {
        for (const reason of flagEntriesResult.reasons) {
          errors.push(reason);
        }
      }
      if (errors.length > 0) {
        return { success: false, errors };
      }
      if (positionalValuesResult.status === "rejected") {
        throw new InternalError("Unknown failure while scanning positional arguments");
      }
      if (flagEntriesResult.status === "rejected") {
        throw new InternalError("Unknown failure while scanning flag arguments");
      }
      const parsedFlags = Object.fromEntries(flagEntriesResult.value);
      return { success: true, arguments: [parsedFlags, ...positionalValuesResult.value] };
    },
    proposeCompletions: async ({ partial, completionConfig, text: text2, context }) => {
      if (activeFlag) {
        return proposeFlagCompletionsForPartialInput(activeFlag[1], context, partial);
      }
      const completions = [];
      if (!treatInputsAsArguments) {
        const shorthandMatch = FLAG_SHORTHAND_PATTERN.exec(partial);
        if (completionConfig.includeAliases) {
          if (partial === "" || partial === "-") {
            const incompleteAliases = Object.entries(aliases).filter(
              (entry) => !isFlagSatisfiedByInputs(flags, flagInputs, entry[1])
            );
            for (const [alias] of incompleteAliases) {
              const flag = resolvedAliases[alias];
              if (flag) {
                completions.push({
                  kind: "argument:flag",
                  completion: `-${alias}`,
                  brief: flag[1].brief
                });
              }
            }
          } else if (shorthandMatch) {
            const partialAliases = Array.from(shorthandMatch[1]);
            const flagInputsIncludingPartial = new Map(flagInputs);
            for (const alias of partialAliases) {
              const namedFlag = resolvedAliases[alias];
              if (!namedFlag) {
                throw new AliasNotFoundError(alias);
              }
              storeInput(
                flagInputsIncludingPartial,
                config.caseStyle,
                namedFlag,
                namedFlag[1].kind === "boolean" ? "true" : "1"
              );
            }
            const lastAlias = partialAliases[partialAliases.length - 1];
            if (lastAlias) {
              const namedFlag = resolvedAliases[lastAlias];
              if (namedFlag) {
                completions.push({
                  kind: "argument:flag",
                  completion: partial,
                  brief: namedFlag[1].brief
                });
              }
            }
            const incompleteAliases = Object.entries(aliases).filter(
              (entry) => !isFlagSatisfiedByInputs(
                flags,
                flagInputsIncludingPartial,
                entry[1]
              )
            );
            for (const [alias] of incompleteAliases) {
              const flag = resolvedAliases[alias];
              if (flag) {
                completions.push({
                  kind: "argument:flag",
                  completion: `${partial}${alias}`,
                  brief: flag[1].brief
                });
              }
            }
          }
        }
        if (partial === "" || partial === "-" || partial.startsWith("--")) {
          if (config.allowArgumentEscapeSequence) {
            completions.push({
              kind: "argument:flag",
              completion: "--",
              brief: text2.briefs.argumentEscapeSequence
            });
          }
          let incompleteFlags = Object.entries(flags).filter(
            ([flagName]) => !isFlagSatisfiedByInputs(flags, flagInputs, flagName)
          );
          if (config.caseStyle === "allow-kebab-for-camel") {
            incompleteFlags = incompleteFlags.map(([flagName, param]) => {
              return [convertCamelCaseToKebabCase(flagName), param];
            });
          }
          const possibleFlags = incompleteFlags.map(([flagName, param]) => [`--${flagName}`, param]).filter(([flagName]) => flagName.startsWith(partial));
          completions.push(
            ...possibleFlags.map(([name, param]) => {
              return {
                kind: "argument:flag",
                completion: name,
                brief: param.brief
              };
            })
          );
        }
      }
      if (positional.kind === "array") {
        if (positional.parameter.proposeCompletions) {
          if (typeof positional.maximum !== "number" || positionalIndex < positional.maximum) {
            const positionalCompletions = await positional.parameter.proposeCompletions.call(
              context,
              partial
            );
            completions.push(
              ...positionalCompletions.map((value) => {
                return {
                  kind: "argument:value",
                  completion: value,
                  brief: positional.parameter.brief
                };
              })
            );
          }
        }
      } else {
        const nextPositional = positional.parameters[positionalIndex];
        if (nextPositional?.proposeCompletions) {
          const positionalCompletions = await nextPositional.proposeCompletions.call(context, partial);
          completions.push(
            ...positionalCompletions.map((value) => {
              return {
                kind: "argument:value",
                completion: value,
                brief: nextPositional.brief
              };
            })
          );
        }
      }
      return completions.filter(({ completion }) => completion.startsWith(partial));
    }
  };
}
async function proposeFlagCompletionsForPartialInput(flag, context, partial) {
  if (typeof flag.variadic === "string") {
    if (partial.endsWith(flag.variadic)) {
      return proposeFlagCompletionsForPartialInput(flag, context, "");
    }
  }
  let values;
  if (flag.kind === "enum") {
    values = flag.values;
  } else if (flag.proposeCompletions) {
    values = await flag.proposeCompletions.call(context, partial);
  } else {
    values = [];
  }
  return values.map((value) => {
    return {
      kind: "argument:value",
      completion: value,
      brief: flag.brief
    };
  }).filter(({ completion }) => completion.startsWith(partial));
}
function listAllRouteNamesAndAliasesForScan(routeMap, scannerCaseStyle, config) {
  const displayCaseStyle = scannerCaseStyle === "allow-kebab-for-camel" ? "convert-camel-to-kebab" : scannerCaseStyle;
  let entries = routeMap.getAllEntries();
  if (!config.includeHiddenRoutes) {
    entries = entries.filter((entry) => !entry.hidden);
  }
  return entries.flatMap((entry) => {
    const routeName = entry.name[displayCaseStyle];
    if (config.includeAliases) {
      return [routeName, ...entry.aliases];
    }
    return [routeName];
  });
}
async function runCommand({ loader, parameters }, {
  context,
  inputs,
  scannerConfig,
  errorFormatting,
  determineExitCode,
  ansiColorByStream
}) {
  let parsedArguments;
  try {
    const scanner = buildArgumentScanner(parameters, scannerConfig);
    for (const input of inputs) {
      scanner.next(input);
    }
    const result = await scanner.parseArguments(context);
    if (result.success) {
      parsedArguments = result.arguments;
    } else {
      for (const error of result.errors) {
        const errorMessage = errorFormatting.exceptionWhileParsingArguments(error, ansiColorByStream.stderr);
        context.process.stderr.write(
          ansiColorByStream.stderr ? `\x1B[1m\x1B[31m${errorMessage}\x1B[39m\x1B[22m
` : `${errorMessage}
`
        );
      }
      return ExitCode.InvalidArgument;
    }
  } catch (exc) {
    const errorMessage = errorFormatting.exceptionWhileParsingArguments(exc, ansiColorByStream.stderr);
    context.process.stderr.write(
      ansiColorByStream.stderr ? `\x1B[1m\x1B[31m${errorMessage}\x1B[39m\x1B[22m
` : `${errorMessage}
`
    );
    return ExitCode.InvalidArgument;
  }
  let commandFunction;
  try {
    const loaded = await loader();
    if (typeof loaded === "function") {
      commandFunction = loaded;
    } else {
      commandFunction = loaded.default;
    }
  } catch (exc) {
    const errorMessage = errorFormatting.exceptionWhileLoadingCommandFunction(exc, ansiColorByStream.stderr);
    context.process.stderr.write(
      ansiColorByStream.stderr ? `\x1B[1m\x1B[31m${errorMessage}\x1B[39m\x1B[22m
` : `${errorMessage}
`
    );
    return ExitCode.CommandLoadError;
  }
  try {
    const result = await commandFunction.call(context, ...parsedArguments);
    if (result instanceof Error) {
      const errorMessage = errorFormatting.commandErrorResult(result, ansiColorByStream.stderr);
      context.process.stderr.write(
        ansiColorByStream.stderr ? `\x1B[1m\x1B[31m${errorMessage}\x1B[39m\x1B[22m
` : `${errorMessage}
`
      );
      if (determineExitCode) {
        return determineExitCode(result);
      }
      return ExitCode.CommandRunError;
    }
  } catch (exc) {
    const errorMessage = errorFormatting.exceptionWhileRunningCommand(exc, ansiColorByStream.stderr);
    context.process.stderr.write(
      ansiColorByStream.stderr ? `\x1B[1m\x1B[31m${errorMessage}\x1B[39m\x1B[22m
` : `${errorMessage}
`
    );
    if (determineExitCode) {
      return determineExitCode(exc);
    }
    return ExitCode.CommandRunError;
  }
  return ExitCode.Success;
}
var RouteMapSymbol = /* @__PURE__ */ Symbol("RouteMap");
var CommandSymbol = /* @__PURE__ */ Symbol("Command");
function buildRouteScanner(root, config, startingPrefix, additionalFlags) {
  const prefix = [...startingPrefix];
  const unprocessedInputs = [];
  const flags = {};
  for (const additionalFlag of additionalFlags) {
    flags[additionalFlag.name] = additionalFlag;
  }
  const aliases = {};
  for (const additionalFlag of additionalFlags) {
    if (additionalFlag.aliases) {
      for (const alias of additionalFlag.aliases) {
        aliases[alias] = additionalFlag.name;
      }
    }
  }
  const resolvedAliases = resolveAliases(flags, aliases, config.caseStyle);
  let activeFlag;
  let parent;
  let current = root;
  let target;
  let treatInputsAsArguments = false;
  return {
    next: (input) => {
      if (!treatInputsAsArguments && config.allowArgumentEscapeSequence && input === "--") {
        treatInputsAsArguments = true;
        unprocessedInputs.push(input);
        return;
      }
      if (!treatInputsAsArguments && !activeFlag) {
        try {
          const nextFlags = findFlagsByArgument(input, flags, {}, resolvedAliases, config);
          for (const currentFlag of nextFlags) {
            if (!currentFlag[1].global && current !== root) {
              continue;
            }
            activeFlag = currentFlag[1];
            target = current;
            return;
          }
        } catch {
        }
      }
      if (target || treatInputsAsArguments) {
        unprocessedInputs.push(input);
        return;
      }
      if (current.kind === CommandSymbol) {
        target = current;
        unprocessedInputs.push(input);
        return;
      }
      const camelCaseRouteName = convertKebabCaseToCamelCase(input);
      let internalRouteName = input;
      let next = current.getRoutingTargetForInput(internalRouteName);
      if (config.caseStyle === "allow-kebab-for-camel" && !next) {
        next = current.getRoutingTargetForInput(camelCaseRouteName);
        if (next) {
          internalRouteName = camelCaseRouteName;
        }
      }
      if (!next) {
        const defaultCommand = current.getDefaultCommand();
        unprocessedInputs.push(input);
        if (defaultCommand) {
          parent = [current, ""];
          current = defaultCommand;
          return;
        }
        return { input, routeMap: current };
      }
      parent = [current, input];
      current = next;
      prefix.push(input);
    },
    finish: () => {
      target = target ?? current;
      if (target.kind === RouteMapSymbol && !activeFlag) {
        const defaultCommand = target.getDefaultCommand();
        if (defaultCommand) {
          parent = [target, ""];
          target = defaultCommand;
        }
      }
      const aliases2 = parent ? parent[0].getOtherAliasesForInput(parent[1], config.caseStyle) : { original: [], "convert-camel-to-kebab": [] };
      return {
        target,
        unprocessedInputs,
        prefix,
        aliases: aliases2,
        activeFlag
      };
    }
  };
}
function checkEnvironmentVariable(process2, varName) {
  const value = process2.env?.[varName];
  return typeof value === "string" && looseBooleanParser(value);
}
var text_en = {
  headers: {
    usage: "USAGE",
    aliases: "ALIASES",
    commands: "COMMANDS",
    flags: "FLAGS",
    arguments: "ARGUMENTS"
  },
  keywords: {
    default: "default =",
    separator: "separator ="
  },
  briefs: {
    help: "Print help information and exit",
    helpAll: "Print help information (including hidden commands/flags) and exit",
    version: "Print version information and exit",
    argumentEscapeSequence: "All subsequent inputs should be interpreted as arguments"
  },
  noCommandRegisteredForInput({ input, corrections }) {
    const errorMessage = `No command registered for \`${input}\``;
    if (corrections.length > 0) {
      const formattedCorrections = joinWithGrammar(corrections, {
        kind: "conjunctive",
        conjunction: "or",
        serialComma: true
      });
      return `${errorMessage}, did you mean ${formattedCorrections}?`;
    } else {
      return errorMessage;
    }
  },
  noTextAvailableForLocale({ requestedLocale, defaultLocale }) {
    return `Application does not support "${requestedLocale}" locale, defaulting to "${defaultLocale}"`;
  },
  exceptionWhileParsingArguments(exc) {
    if (exc instanceof ArgumentScannerError) {
      return formatMessageForArgumentScannerError(exc, {});
    }
    return `Unable to parse arguments, ${(this.formatException ?? formatException)(exc)}`;
  },
  exceptionWhileLoadingCommandFunction(exc) {
    return `Unable to load command function, ${(this.formatException ?? formatException)(exc)}`;
  },
  exceptionWhileLoadingCommandContext(exc) {
    return `Unable to load command context, ${(this.formatException ?? formatException)(exc)}`;
  },
  exceptionWhileRunningCommand(exc) {
    return `Command failed, ${(this.formatException ?? formatException)(exc)}`;
  },
  exceptionWhileRunningIntegrationHook({ exception, hook, integration }) {
    return `Unexpected exception thrown by '${integration}' integration during '${hook}' hook.
${(this.formatException ?? formatException)(exception)}`;
  },
  exceptionWhileRunningIntegrationFlag({ exception, integration }) {
    return `Unexpected exception thrown by "--${integration}" flag from the '${integration}' integration.
${(this.formatException ?? formatException)(exception)}`;
  },
  commandErrorResult(err) {
    return err.message;
  },
  currentVersionIsNotLatest({ currentVersion, latestVersion, upgradeCommand }) {
    if (upgradeCommand) {
      return `Latest available version is ${latestVersion} (currently running ${currentVersion}), upgrade with "${upgradeCommand}"`;
    }
    return `Latest available version is ${latestVersion} (currently running ${currentVersion})`;
  }
};
function defaultTextLoader(locale) {
  if (locale.startsWith("en")) {
    return text_en;
  }
}
function shouldUseAnsiColor(process2, stream2, config) {
  return !config.disableAnsiColor && !checkEnvironmentVariable(process2, "STRICLI_NO_COLOR") && (stream2.getColorDepth?.(process2.env) ?? 1) >= 4;
}
function shouldUseAnsiColorForStreams(process2, config) {
  return {
    stdout: shouldUseAnsiColor(process2, process2.stdout, config),
    stderr: shouldUseAnsiColor(process2, process2.stderr, config)
  };
}
function validateCaseStyleCompatibility(scan, display) {
  if (scan === "original" && display === "convert-camel-to-kebab") {
    throw new Error("Cannot convert route and flag names on display (convert-camel-to-kebab) but scan as original");
  }
}
function help({
  alias = "h",
  includeHidden = false,
  formatting,
  ...config
}) {
  return {
    validate(_root, config2) {
      validateCaseStyleCompatibility(config2.scanner.caseStyle, formatting.caseStyle);
    },
    flag: {
      ...config,
      global: true,
      aliases: alias === false ? [] : [alias],
      async run(app2, { text: text2, ansiColorByStream, result, additionalFlags }) {
        this.process.stdout.write(
          result.target.formatHelp({
            prefix: result.prefix,
            additionalFlags,
            includeArgumentEscapeSequenceFlag: app2.config.scanner.allowArgumentEscapeSequence,
            includeHidden,
            config: formatting,
            aliases: result.aliases[formatting.caseStyle],
            text: text2,
            ansiColor: ansiColorByStream.stdout
          })
        );
      }
    }
  };
}
function version({
  info,
  alias = "v",
  hook = "app:start",
  ...config
}) {
  let versionCheck;
  if (info.getLatestVersion) {
    const getLatestVersion = info.getLatestVersion;
    versionCheck = async function({ text: text2, ansiColorByStream }) {
      if (checkEnvironmentVariable(this.process, "STRICLI_SKIP_VERSION_CHECK")) {
        return;
      }
      let currentVersion;
      if ("currentVersion" in info) {
        currentVersion = info.currentVersion;
      } else {
        currentVersion = await info.getCurrentVersion.call(this);
      }
      const latestVersion = await getLatestVersion.call(this, currentVersion);
      if (latestVersion && currentVersion !== latestVersion) {
        const warningMessage = text2.currentVersionIsNotLatest({
          currentVersion,
          latestVersion,
          upgradeCommand: info.upgradeCommand,
          ansiColor: ansiColorByStream.stderr
        });
        this.process.stderr.write(
          ansiColorByStream.stderr ? `\x1B[1m\x1B[33m${warningMessage}\x1B[39m\x1B[22m
` : `${warningMessage}
`
        );
      }
    };
  }
  return {
    hooks: versionCheck ? { [hook]: versionCheck } : {},
    flag: {
      ...config,
      defaultForRouteMap: false,
      global: false,
      aliases: alias === false ? [] : [alias],
      async run() {
        let currentVersion;
        if ("currentVersion" in info) {
          currentVersion = info.currentVersion;
        } else {
          currentVersion = await info.getCurrentVersion.call(this);
        }
        this.process.stdout.write(currentVersion + "\n");
      }
    }
  };
}
async function runHook(integrations, hookName, context, args) {
  for (const [name, integration] of Object.entries(integrations)) {
    const hook = integration.hooks?.[hookName];
    if (hook) {
      try {
        await hook.call(context, args);
      } catch (exc) {
        const errorMessage = args.text.exceptionWhileRunningIntegrationHook({
          exception: exc,
          hook: hookName,
          integration: name,
          ansiColor: args.ansiColorByStream.stderr
        });
        context.process.stderr.write(
          args.ansiColorByStream.stderr ? `\x1B[1m\x1B[31m${errorMessage}\x1B[39m\x1B[22m
` : `${errorMessage}
`
        );
        return ExitCode.IntegrationError;
      }
    }
  }
}
function checkIntegrationsForCollisions(integrations, caseStyle) {
  let routeMapDefault;
  const flagNames = new Set(Object.keys(integrations));
  const aliases = /* @__PURE__ */ new Map();
  for (const [name, integration] of Object.entries(integrations)) {
    if (caseStyle === "allow-kebab-for-camel") {
      const camelCase = convertKebabCaseToCamelCase(name);
      if (camelCase !== name && flagNames.has(camelCase)) {
        throw new InternalError(
          `Multiple integrations are trying to use the same flag name (with 'allow-kebab-for-camel'): '${name}' and '${camelCase}'`
        );
      }
    }
    if (integration.flag) {
      if (integration.flag.defaultForRouteMap) {
        if (routeMapDefault) {
          throw new InternalError(
            `Multiple integrations provide a default flag for route maps: '${routeMapDefault}' and '${name}'`
          );
        }
        routeMapDefault = name;
      }
      for (const alias of integration.flag.aliases ?? []) {
        const flagForAlias = aliases.get(alias);
        if (flagForAlias) {
          throw new InternalError(
            `Multiple integrations are trying to use the same flag alias "-${alias}": '${flagForAlias}' and '${name}'`
          );
        }
        aliases.set(alias, name);
      }
    }
  }
}
function checkIntegrationsForFlagNameConflicts(root, additionalFlags, caseStyle) {
  function checkForConflicts(target, prefix) {
    if (target.kind === CommandSymbol) {
      const relevantFlags = root === target ? additionalFlags : additionalFlags.filter(({ global }) => global);
      for (const { name, aliases } of relevantFlags) {
        if (target.usesFlag(name, caseStyle)) {
          throw new InternalError(
            `'${name}' integration provides a flag that would override: "${[...prefix, `--${name}`].join(" ")}"`
          );
        }
        for (const alias of aliases ?? []) {
          if (target.usesFlag(alias, caseStyle)) {
            throw new InternalError(
              `'${name}' integration provides a flag with an alias that would override: "${[...prefix, `-${alias}`].join(" ")}"`
            );
          }
        }
      }
    } else {
      for (const entry of target.getAllEntries()) {
        checkForConflicts(entry.target, [...prefix, entry.name.original]);
      }
    }
  }
  checkForConflicts(root, []);
}
function gatherAdditionalFlagsFromIntegrations(integrations) {
  const flags = [];
  for (const [name, integration] of Object.entries(integrations)) {
    if (integration.flag) {
      flags.push({ ...integration.flag, name });
    }
  }
  return flags;
}
function validateIntegrations(integrations, root, config) {
  for (const [name, integration] of Object.entries(integrations)) {
    try {
      integration.validate?.(root, config);
    } catch (exc) {
      throw new InternalError(`Integration '${name}' failed validation: ${String(exc)}`, { cause: exc });
    }
  }
}
function gatherDefaultIntegrations(config, text2) {
  const integrations = {
    help: help({
      brief: text2.briefs.help,
      alias: "h",
      defaultForRouteMap: true,
      includeHidden: false,
      formatting: config.documentation
    }),
    helpAll: help({
      brief: text2.briefs.helpAll,
      alias: "H",
      hidden: !config.documentation.alwaysShowHelpAllFlag,
      includeHidden: true,
      formatting: config.documentation
    })
  };
  if (config.versionInfo) {
    integrations["version"] = version({
      brief: text2.briefs.version,
      info: config.versionInfo,
      alias: "v",
      hook: "app:start"
    });
  }
  return integrations;
}
async function runApplication(app2, rawInputs, context) {
  const ansiColorByStream = shouldUseAnsiColorForStreams(context.process, app2.config.documentation);
  let text2 = app2.defaultText;
  if (context.locale && "loadText" in app2.config.localization) {
    const localeText = app2.config.localization.loadText(context.locale);
    if (localeText) {
      text2 = localeText;
    } else {
      const warningMessage = text2.noTextAvailableForLocale({
        requestedLocale: context.locale,
        defaultLocale: app2.config.localization.defaultLocale,
        ansiColor: ansiColorByStream.stderr
      });
      context.process.stderr.write(
        ansiColorByStream.stderr ? `\x1B[1m\x1B[33m${warningMessage}\x1B[39m\x1B[22m
` : `${warningMessage}
`
      );
    }
  }
  const hookStartExitCode = await runHook(app2.integrations, "app:start", context, {
    text: text2,
    ansiColorByStream
  });
  if (typeof hookStartExitCode === "number") {
    return hookStartExitCode;
  }
  const exitCode = await scanInputsAndRunTarget(app2, rawInputs, context, text2, ansiColorByStream);
  const hookEndExitCode = await runHook(app2.integrations, "app:end", context, {
    text: text2,
    ansiColorByStream,
    exitCode
  });
  if (typeof hookEndExitCode === "number") {
    return hookEndExitCode;
  }
  return exitCode;
}
async function scanInputsAndRunTarget(app2, rawInputs, context, text2, ansiColorByStream) {
  const additionalFlags = gatherAdditionalFlagsFromIntegrations(app2.integrations);
  const inputs = rawInputs.slice();
  const scanner = buildRouteScanner(app2.root, app2.config.scanner, [app2.config.name], additionalFlags);
  let error;
  while (inputs.length > 0 && !error) {
    const arg = inputs.shift();
    error = scanner.next(arg);
  }
  if (error) {
    const routeNames = listAllRouteNamesAndAliasesForScan(
      error.routeMap,
      app2.config.scanner.caseStyle,
      app2.config.completion
    );
    const corrections = filterClosestAlternatives(error.input, routeNames, app2.config.scanner.distanceOptions).map(
      (str2) => `\`${str2}\``
    );
    const errorMessage = text2.noCommandRegisteredForInput({
      input: error.input,
      corrections,
      ansiColor: ansiColorByStream.stderr
    });
    context.process.stderr.write(
      ansiColorByStream.stderr ? `\x1B[1m\x1B[31m${errorMessage}\x1B[39m\x1B[22m
` : `${errorMessage}
`
    );
    return ExitCode.UnknownCommand;
  }
  let { activeFlag, ...result } = scanner.finish();
  if (activeFlag || result.target.kind === RouteMapSymbol) {
    if (!activeFlag) {
      activeFlag = additionalFlags.find((flag) => flag.defaultForRouteMap);
    }
    if (activeFlag) {
      let additionalFlagsForTarget = additionalFlags;
      if (result.target !== app2.root) {
        additionalFlagsForTarget = additionalFlagsForTarget.filter((flag) => flag.global);
      }
      try {
        await activeFlag.run.call(context, app2, {
          text: text2,
          ansiColorByStream,
          result,
          additionalFlags: additionalFlagsForTarget
        });
      } catch (exc) {
        const errorMessage = text2.exceptionWhileRunningIntegrationFlag({
          exception: exc,
          ansiColor: ansiColorByStream.stderr,
          integration: activeFlag.name
        });
        context.process.stderr.write(
          ansiColorByStream.stderr ? `\x1B[1m\x1B[31m${errorMessage}\x1B[39m\x1B[22m
` : `${errorMessage}
`
        );
        return ExitCode.IntegrationError;
      }
    }
    return ExitCode.Success;
  }
  let commandContext;
  if ("forCommand" in context) {
    try {
      commandContext = await context.forCommand({ prefix: result.prefix });
    } catch (exc) {
      const errorMessage = text2.exceptionWhileLoadingCommandContext(exc, ansiColorByStream.stderr);
      context.process.stderr.write(
        ansiColorByStream.stderr ? `\x1B[1m\x1B[31m${errorMessage}\x1B[39m\x1B[22m` : errorMessage
      );
      return ExitCode.ContextLoadError;
    }
  } else {
    commandContext = context;
  }
  const hookStartExitCode = await runHook(app2.integrations, "command:start", commandContext, {
    text: text2,
    ansiColorByStream,
    result
  });
  if (typeof hookStartExitCode === "number") {
    return hookStartExitCode;
  }
  const exitCode = await runCommand(result.target, {
    context: commandContext,
    inputs: result.unprocessedInputs,
    scannerConfig: app2.config.scanner,
    errorFormatting: text2,
    determineExitCode: app2.config.determineExitCode,
    ansiColorByStream
  });
  const hookEndExitCode = await runHook(app2.integrations, "command:end", commandContext, {
    text: text2,
    ansiColorByStream,
    result,
    exitCode
  });
  if (typeof hookEndExitCode === "number") {
    return hookEndExitCode;
  }
  return exitCode;
}
function hasDefault(flag) {
  return "default" in flag && typeof flag.default !== "undefined";
}
function isOptionalAtRuntime(flag) {
  return flag.optional ?? hasDefault(flag);
}
function withDefaultFormattingConfiguration(config, scannerCaseStyle) {
  let displayCaseStyle;
  if (config.caseStyle) {
    displayCaseStyle = config.caseStyle;
  } else if (scannerCaseStyle === "allow-kebab-for-camel") {
    displayCaseStyle = "convert-camel-to-kebab";
  } else {
    displayCaseStyle = scannerCaseStyle;
  }
  validateCaseStyleCompatibility(scannerCaseStyle, displayCaseStyle);
  return {
    useAliasInUsageLine: config.useAliasInUsageLine ?? false,
    onlyRequiredInUsageLine: config.onlyRequiredInUsageLine ?? false,
    caseStyle: displayCaseStyle
  };
}
function wrapRequiredFlag(text2) {
  return `(${text2})`;
}
function wrapOptionalFlag(text2) {
  return `[${text2}]`;
}
function wrapVariadicFlag(text2) {
  return `${text2}...`;
}
function wrapRequiredParameter(text2) {
  return `<${text2}>`;
}
function wrapOptionalParameter(text2) {
  return `[<${text2}>]`;
}
function wrapVariadicParameter(text2) {
  return `<${text2}>...`;
}
function formatUsageLineForParameters(parameters, args) {
  const flagsUsage = Object.entries(parameters.flags ?? {}).filter(([, flag]) => {
    if (flag.hidden) {
      return false;
    }
    if (args.config.onlyRequiredInUsageLine && isOptionalAtRuntime(flag)) {
      return false;
    }
    return true;
  }).map(([name, flag]) => {
    let displayName = args.config.caseStyle === "convert-camel-to-kebab" ? `--${convertCamelCaseToKebabCase(name)}` : `--${name}`;
    if (parameters.aliases && args.config.useAliasInUsageLine) {
      const aliases = Object.entries(parameters.aliases).filter((entry) => entry[1] === name);
      if (aliases.length === 1 && aliases[0]) {
        displayName = `-${aliases[0][0]}`;
      }
    }
    if (flag.kind === "boolean") {
      return [flag, displayName];
    }
    if (flag.kind === "enum" && typeof flag.placeholder !== "string") {
      return [flag, `${displayName} ${flag.values.join("|")}`];
    }
    const placeholder = flag.placeholder ?? "value";
    return [flag, `${displayName} ${placeholder}`];
  }).map(([flag, usage]) => {
    if (flag.kind === "parsed" && flag.variadic) {
      if (isOptionalAtRuntime(flag)) {
        return wrapVariadicFlag(wrapOptionalFlag(usage));
      }
      return wrapVariadicFlag(wrapRequiredFlag(usage));
    }
    if (isOptionalAtRuntime(flag)) {
      return wrapOptionalFlag(usage);
    }
    return wrapRequiredFlag(usage);
  });
  let positionalUsage = [];
  const positional = parameters.positional;
  if (positional) {
    if (positional.kind === "array") {
      positionalUsage = [wrapVariadicParameter(positional.parameter.placeholder ?? "args")];
    } else {
      let parameters2 = positional.parameters;
      if (args.config.onlyRequiredInUsageLine) {
        parameters2 = parameters2.filter((param) => !param.optional && typeof param.default === "undefined");
      }
      positionalUsage = parameters2.map((param, i2) => {
        const argName = param.placeholder ?? `arg${i2 + 1}`;
        return param.optional || typeof param.default !== "undefined" ? wrapOptionalParameter(argName) : wrapRequiredParameter(argName);
      });
    }
  }
  return [...args.prefix, ...flagsUsage, ...positionalUsage].join(" ");
}
function formatForDisplay(flagName, displayCaseStyle) {
  if (displayCaseStyle === "convert-camel-to-kebab") {
    return convertCamelCaseToKebabCase(flagName);
  }
  return flagName;
}
function formatAsNegated(flagName, displayCaseStyle) {
  if (displayCaseStyle === "convert-camel-to-kebab") {
    return `no-${convertCamelCaseToKebabCase(flagName)}`;
  }
  return `no${flagName[0].toUpperCase()}${flagName.slice(1)}`;
}
function withDefaults(config) {
  const scannerCaseStyle = config.scanner?.caseStyle ?? "original";
  const scannerConfig = {
    caseStyle: scannerCaseStyle,
    allowArgumentEscapeSequence: config.scanner?.allowArgumentEscapeSequence ?? false,
    distanceOptions: config.scanner?.distanceOptions ?? {
      threshold: 7,
      weights: {
        insertion: 1,
        deletion: 3,
        substitution: 2,
        transposition: 0
      }
    }
  };
  const documentationConfig = {
    alwaysShowHelpAllFlag: config.documentation?.alwaysShowHelpAllFlag ?? false,
    disableAnsiColor: config.documentation?.disableAnsiColor ?? false,
    ...withDefaultFormattingConfiguration(config.documentation ?? {}, scannerCaseStyle)
  };
  const completionConfig = {
    includeAliases: config.completion?.includeAliases ?? documentationConfig.useAliasInUsageLine,
    includeHiddenRoutes: config.completion?.includeHiddenRoutes ?? false,
    ...config.completion
  };
  return {
    ...config,
    scanner: scannerConfig,
    completion: completionConfig,
    documentation: documentationConfig,
    localization: {
      defaultLocale: "en",
      loadText: defaultTextLoader,
      ...config.localization
    }
  };
}
function buildApplication(root, appConfig, integrations) {
  const config = withDefaults(appConfig);
  let defaultText;
  if ("text" in config.localization) {
    defaultText = config.localization.text;
  } else {
    const text2 = config.localization.loadText(config.localization.defaultLocale);
    if (!text2) {
      throw new InternalError(`No text available for the default locale "${config.localization.defaultLocale}"`);
    }
    defaultText = text2;
  }
  if (integrations) {
    checkIntegrationsForCollisions(integrations, config.scanner.caseStyle);
  } else {
    integrations = gatherDefaultIntegrations(config, defaultText);
  }
  const additionalFlags = gatherAdditionalFlagsFromIntegrations(integrations);
  checkIntegrationsForFlagNameConflicts(root, additionalFlags, config.scanner.caseStyle);
  validateIntegrations(integrations, root, config);
  return {
    root,
    config,
    defaultText,
    integrations
  };
}
function formatRowForAdditionalFlag(flag, caseStyle) {
  return {
    aliases: flag.aliases ? flag.aliases.map((alias) => `-${alias}`).join(" ") : "",
    flagName: `--${formatForDisplay(flag.name, caseStyle)}`,
    brief: flag.brief,
    hidden: flag.hidden
  };
}
function formatDocumentationForFlagParameters(flags, aliases, args) {
  const { keywords } = args.text;
  const visibleFlags = Object.entries(flags).filter(([, flag]) => {
    if (flag.hidden && !args.includeHidden) {
      return false;
    }
    return true;
  });
  const atLeastOneOptional = visibleFlags.some(([, flag]) => isOptionalAtRuntime(flag));
  const rows = visibleFlags.map(([name, flag]) => {
    const aliasStrings = Object.entries(aliases).filter((entry) => entry[1] === name).map(([alias]) => `-${alias}`);
    let flagName = "--" + formatForDisplay(name, args.config.caseStyle);
    if (flag.kind === "boolean" && flag.default !== false && flag.withNegated !== false) {
      const negatedFlagName = formatAsNegated(name, args.config.caseStyle);
      flagName = `${flagName}/--${negatedFlagName}`;
    }
    if (isOptionalAtRuntime(flag)) {
      flagName = `[${flagName}]`;
    } else if (atLeastOneOptional) {
      flagName = ` ${flagName}`;
    }
    if (flag.kind === "parsed" && flag.variadic) {
      flagName = `${flagName}...`;
    }
    const suffixParts = [];
    if (flag.kind === "enum") {
      const choices = flag.values.join("|");
      suffixParts.push(choices);
    }
    if (hasDefault(flag)) {
      const defaultKeyword = args.ansiColor ? `\x1B[2m${keywords.default}\x1B[22m` : keywords.default;
      let defaultValue;
      if (Array.isArray(flag.default)) {
        if (flag.default.length === 0) {
          defaultValue = "[]";
        } else {
          const separator = "variadic" in flag && typeof flag.variadic === "string" ? flag.variadic : " ";
          defaultValue = flag.default.join(separator);
        }
      } else {
        defaultValue = flag.default === "" ? `""` : String(flag.default);
      }
      suffixParts.push(`${defaultKeyword} ${defaultValue}`);
    }
    if ("variadic" in flag && typeof flag.variadic === "string") {
      const separatorKeyword = args.ansiColor ? `\x1B[2m${keywords.separator}\x1B[22m` : keywords.separator;
      suffixParts.push(`${separatorKeyword} ${flag.variadic}`);
    }
    const suffix = suffixParts.length > 0 ? `[${suffixParts.join(", ")}]` : void 0;
    return {
      aliases: aliasStrings.join(" "),
      flagName,
      brief: flag.brief,
      suffix,
      hidden: flag.hidden
    };
  });
  for (const flag of args.additionalFlags) {
    if (flag.hidden && !args.includeHidden) {
      continue;
    }
    const row = formatRowForAdditionalFlag(flag, args.config.caseStyle);
    rows.push({
      ...row,
      flagName: atLeastOneOptional ? ` ${row.flagName}` : row.flagName
    });
  }
  if (args.includeArgumentEscapeSequenceFlag) {
    rows.push({
      aliases: "",
      flagName: atLeastOneOptional ? " --" : "--",
      brief: args.text.briefs.argumentEscapeSequence
    });
  }
  return formatRowsWithColumns(
    rows.map((row) => {
      if (!args.ansiColor) {
        return [row.aliases, row.flagName, row.brief, row.suffix ?? ""];
      }
      return [
        row.hidden ? `\x1B[2m${row.aliases}\x1B[22m` : `\x1B[1m${row.aliases}\x1B[22m`,
        row.hidden ? `\x1B[2m${row.flagName}\x1B[22m` : `\x1B[1m${row.flagName}\x1B[22m`,
        row.hidden ? `\x1B[2;3m${row.brief}\x1B[22;23m` : `\x1B[;;3m${row.brief}\x1B[;;;23m`,
        row.suffix ?? ""
      ];
    }),
    [" ", "  ", " "]
  );
}
function* generateUsageLinesForAdditionalFlags(flags, includeHidden, caseStyle, useAliasInUsageLine) {
  for (const flag of flags) {
    if (flag.hidden && !includeHidden) {
      continue;
    }
    if (useAliasInUsageLine && flag.aliases && flag.aliases.length > 0) {
      yield `-${flag.aliases[0]}`;
    } else {
      yield `--${formatForDisplay(flag.name, caseStyle)}`;
    }
  }
}
function formatDocumentationForPositionalParameters(positional, args) {
  if (positional.kind === "array") {
    const name = positional.parameter.placeholder ?? "args";
    const argName = args.ansiColor ? `\x1B[1m${name}...\x1B[22m` : `${name}...`;
    const brief = args.ansiColor ? `\x1B[3m${positional.parameter.brief}\x1B[23m` : positional.parameter.brief;
    return formatRowsWithColumns([[argName, brief]], ["  "]);
  }
  const { keywords } = args.text;
  const atLeastOneOptional = positional.parameters.some((def) => def.optional);
  return formatRowsWithColumns(
    positional.parameters.map((def, i2) => {
      let name = def.placeholder ?? `arg${i2 + 1}`;
      let suffix;
      if (def.optional) {
        name = `[${name}]`;
      } else if (atLeastOneOptional) {
        name = ` ${name}`;
      }
      if (def.default) {
        const defaultKeyword = args.ansiColor ? `\x1B[2m${keywords.default}\x1B[22m` : keywords.default;
        suffix = `[${defaultKeyword} ${def.default}]`;
      }
      return [
        args.ansiColor ? `\x1B[1m${name}\x1B[22m` : name,
        args.ansiColor ? `\x1B[3m${def.brief}\x1B[23m` : def.brief,
        suffix ?? ""
      ];
    }),
    ["  ", " "]
  );
}
function* generateCommandHelpLines(parameters, docs, args) {
  const { brief, fullDescription, customUsage } = docs;
  const { headers } = args.text;
  const prefix = args.prefix.join(" ");
  yield args.ansiColor ? `\x1B[4m${headers.usage}\x1B[24m` : headers.usage;
  if (customUsage) {
    for (const usage of customUsage) {
      if (typeof usage === "string") {
        yield `  ${prefix} ${usage}`;
      } else {
        const brief2 = args.ansiColor ? `\x1B[3m${usage.brief}\x1B[23m` : usage.brief;
        yield `  ${prefix} ${usage.input}
    ${brief2}`;
      }
    }
  } else {
    yield `  ${formatUsageLineForParameters(parameters, args)}`;
  }
  for (const line of generateUsageLinesForAdditionalFlags(
    args.additionalFlags,
    args.includeHidden,
    args.config.caseStyle,
    args.config.useAliasInUsageLine
  )) {
    yield `  ${prefix} ${line}`;
  }
  yield "";
  yield fullDescription ?? brief;
  if (args.aliases && args.aliases.length > 0) {
    const aliasPrefix = args.prefix.slice(0, -1).join(" ");
    yield "";
    yield args.ansiColor ? `\x1B[4m${headers.aliases}\x1B[24m` : headers.aliases;
    for (const alias of args.aliases) {
      yield `  ${aliasPrefix} ${alias}`;
    }
  }
  yield "";
  yield args.ansiColor ? `\x1B[4m${headers.flags}\x1B[24m` : headers.flags;
  for (const line of formatDocumentationForFlagParameters(parameters.flags ?? {}, parameters.aliases ?? {}, args)) {
    yield `  ${line}`;
  }
  const positional = parameters.positional ?? { kind: "tuple", parameters: [] };
  if (positional.kind === "array" || positional.parameters.length > 0) {
    yield "";
    yield args.ansiColor ? `\x1B[4m${headers.arguments}\x1B[24m` : headers.arguments;
    for (const line of formatDocumentationForPositionalParameters(positional, args)) {
      yield `  ${line}`;
    }
  }
}
function* asNegationFlagNames(flagName) {
  yield `no-${convertCamelCaseToKebabCase(flagName)}`;
  yield `no${flagName[0].toUpperCase()}${flagName.slice(1)}`;
}
function checkForNegationCollisions(flags) {
  const flagsAllowingNegation = Object.entries(flags).filter(([, flag]) => flag.kind === "boolean" && !flag.optional);
  for (const [internalFlagName] of flagsAllowingNegation) {
    for (const negatedFlagName of asNegationFlagNames(internalFlagName)) {
      if (negatedFlagName in flags) {
        throw new InternalError(
          `Unable to allow negation for --${internalFlagName} as it conflicts with --${negatedFlagName}`
        );
      }
    }
  }
}
function checkForInvalidVariadicSeparators(flags) {
  for (const [internalFlagName, flag] of Object.entries(flags)) {
    if ("variadic" in flag && typeof flag.variadic === "string") {
      if (flag.variadic.length < 1) {
        throw new InternalError(
          `Unable to use "" as variadic separator for --${internalFlagName} as it is empty`
        );
      }
      if (/\s/.test(flag.variadic)) {
        throw new InternalError(
          `Unable to use "${flag.variadic}" as variadic separator for --${internalFlagName} as it contains whitespace`
        );
      }
    }
  }
}
function buildCommand(builderArgs) {
  const { flags = {}, aliases = {} } = builderArgs.parameters;
  checkForNegationCollisions(flags);
  checkForInvalidVariadicSeparators(flags);
  let loader;
  if ("func" in builderArgs) {
    loader = async () => builderArgs.func;
  } else {
    loader = builderArgs.loader;
  }
  return {
    kind: CommandSymbol,
    loader,
    parameters: builderArgs.parameters,
    get brief() {
      return builderArgs.docs.brief;
    },
    /* v8 ignore next -- @preserve */
    get fullDescription() {
      return builderArgs.docs.fullDescription;
    },
    formatUsageLine: (args) => {
      return formatUsageLineForParameters(builderArgs.parameters, args);
    },
    formatHelp: (args) => {
      const lines = [
        ...generateCommandHelpLines(builderArgs.parameters, builderArgs.docs, args)
      ];
      const text2 = lines.join("\n");
      return text2 + "\n";
    },
    usesFlag: (flagName, caseStyle) => {
      if (caseStyle === "allow-kebab-for-camel") {
        const kebabCase = convertCamelCaseToKebabCase(flagName);
        if (kebabCase in flags) {
          return true;
        }
      }
      return Boolean(flagName in flags || flagName in aliases);
    }
  };
}
function* generateRouteMapHelpLines(routes2, docs, args) {
  const { brief, fullDescription, hideRoute } = docs;
  const { headers } = args.text;
  yield args.ansiColor ? `\x1B[4m${headers.usage}\x1B[24m` : headers.usage;
  for (const [name, route] of Object.entries(routes2)) {
    if (!hideRoute || !hideRoute[name] || args.includeHidden) {
      const externalRouteName = args.config.caseStyle === "convert-camel-to-kebab" ? convertCamelCaseToKebabCase(name) : name;
      yield `  ${route.formatUsageLine({
        ...args,
        prefix: [...args.prefix, externalRouteName]
      })}`;
    }
  }
  const prefix = args.prefix.join(" ");
  for (const line of generateUsageLinesForAdditionalFlags(
    args.additionalFlags,
    args.includeHidden,
    args.config.caseStyle,
    args.config.useAliasInUsageLine
  )) {
    yield `  ${prefix} ${line}`;
  }
  yield "";
  yield fullDescription ?? brief;
  if (args.aliases && args.aliases.length > 0) {
    const aliasPrefix = args.prefix.slice(0, -1).join(" ");
    yield "";
    yield args.ansiColor ? `\x1B[4m${headers.aliases}\x1B[24m` : headers.aliases;
    for (const alias of args.aliases) {
      yield `  ${aliasPrefix} ${alias}`;
    }
  }
  yield "";
  yield args.ansiColor ? `\x1B[4m${headers.flags}\x1B[24m` : headers.flags;
  for (const line of formatDocumentationForFlagParameters({}, {}, args)) {
    yield `  ${line}`;
  }
  yield "";
  yield args.ansiColor ? `\x1B[4m${headers.commands}\x1B[24m` : headers.commands;
  const visibleRoutes = Object.entries(routes2).filter(
    ([name]) => !hideRoute || !hideRoute[name] || args.includeHidden
  );
  const rows = visibleRoutes.map(([internalRouteName, route]) => {
    const externalRouteName = formatForDisplay(internalRouteName, args.config.caseStyle);
    return {
      routeName: externalRouteName,
      brief: route.brief,
      hidden: hideRoute && hideRoute[internalRouteName]
    };
  });
  const formattedRows = formatRowsWithColumns(
    rows.map((row) => {
      if (!args.ansiColor) {
        return [row.routeName, row.brief];
      }
      return [
        row.hidden ? `\x1B[2m${row.routeName}\x1B[22m` : `\x1B[1m${row.routeName}\x1B[22m`,
        row.hidden ? `\x1B[2;3m${row.brief}\x1B[22;23m` : `\x1B[;;3m${row.brief}\x1B[;;;23m`
      ];
    }),
    ["  "]
  );
  for (const line of formattedRows) {
    yield `  ${line}`;
  }
}
function buildRouteMap({
  routes: routes2,
  defaultCommand: defaultCommandRoute,
  docs,
  aliases
}) {
  if (Object.entries(routes2).length === 0) {
    throw new InternalError("Route map must contain at least one route");
  }
  const activeAliases = aliases ?? {};
  const aliasesByRoute = /* @__PURE__ */ new Map();
  for (const [alias, routeName] of Object.entries(activeAliases)) {
    if (alias in routes2) {
      throw new InternalError(`Cannot use '${alias}' as an alias when a route with that name already exists`);
    }
    const routeAliases = aliasesByRoute.get(routeName) ?? [];
    aliasesByRoute.set(routeName, [...routeAliases, alias]);
  }
  const defaultCommand = defaultCommandRoute ? routes2[defaultCommandRoute] : void 0;
  if (defaultCommand && defaultCommand.kind === RouteMapSymbol) {
    throw new InternalError(
      `Cannot use '${defaultCommandRoute}' as the default command because it is not a Command`
    );
  }
  const resolveRouteName = (input) => {
    if (input in activeAliases) {
      return activeAliases[input];
    } else if (input in routes2) {
      return input;
    }
  };
  return {
    kind: RouteMapSymbol,
    get brief() {
      return docs.brief;
    },
    /* v8 ignore next -- @preserve */
    get fullDescription() {
      return docs.fullDescription;
    },
    formatUsageLine(args) {
      const routeNames = this.getAllEntries().filter((entry) => !entry.hidden).map((entry) => entry.name[args.config.caseStyle]);
      return `${args.prefix.join(" ")} ${routeNames.join("|")} ...`;
    },
    formatHelp: (args) => {
      const lines = [...generateRouteMapHelpLines(routes2, docs, args)];
      const text2 = lines.join("\n");
      return text2 + "\n";
    },
    getDefaultCommand: () => {
      return defaultCommand;
    },
    getOtherAliasesForInput: (input, caseStyle) => {
      if (defaultCommandRoute) {
        if (input === defaultCommandRoute) {
          return {
            original: [""],
            "convert-camel-to-kebab": [""]
          };
        }
        if (input === "") {
          return {
            original: [defaultCommandRoute],
            "convert-camel-to-kebab": [defaultCommandRoute]
          };
        }
      }
      const camelInput = convertKebabCaseToCamelCase(input);
      let routeName = resolveRouteName(input);
      if (!routeName && caseStyle === "allow-kebab-for-camel") {
        routeName = resolveRouteName(camelInput);
      }
      if (!routeName) {
        return {
          original: [],
          "convert-camel-to-kebab": []
        };
      }
      const otherAliases = [routeName, ...aliasesByRoute.get(routeName) ?? []].filter(
        (alias) => alias !== input && alias !== camelInput
      );
      return {
        original: otherAliases,
        "convert-camel-to-kebab": otherAliases.map(convertCamelCaseToKebabCase)
      };
    },
    getRoutingTargetForInput: (input) => {
      const routeName = input in activeAliases ? activeAliases[input] : input;
      return routes2[routeName];
    },
    getAllEntries() {
      const hiddenRoutes = docs.hideRoute;
      return Object.entries(routes2).map(([originalRouteName, target]) => {
        return {
          name: {
            original: originalRouteName,
            "convert-camel-to-kebab": convertCamelCaseToKebabCase(originalRouteName)
          },
          target,
          aliases: aliasesByRoute.get(originalRouteName) ?? [],
          hidden: hiddenRoutes?.[originalRouteName] ?? false
        };
      });
    }
  };
}
async function run(app2, inputs, context) {
  const exitCode = await runApplication(app2, inputs, context);
  context.process.exitCode ??= exitCode;
}

// src/commands/info.ts
import { readFileSync as readFileSync2, statSync as statSync2 } from "fs";
import { dirname as dirname2, join as join4, resolve } from "path";

// src/config/catalog.ts
import { readdirSync, statSync } from "fs";
import { join } from "path";
function discoverRuleSlugs(rulesDir) {
  let entries;
  try {
    entries = readdirSync(rulesDir);
  } catch {
    return [];
  }
  return entries.filter((name) => name.endsWith(".md")).map((name) => name.slice(0, -".md".length)).sort((a2, b3) => a2.localeCompare(b3));
}
function discoverSkills(skillsDir) {
  let entries;
  try {
    entries = readdirSync(skillsDir);
  } catch {
    return [];
  }
  return entries.filter((name) => isFile(join(skillsDir, name, "SKILL.md"))).sort((a2, b3) => a2.localeCompare(b3));
}
function isFile(path2) {
  try {
    return statSync(path2).isFile();
  } catch {
    return false;
  }
}

// src/config/load.ts
import { readFileSync } from "fs";
import { join as join2 } from "path";

// src/config/schema.ts
function emptyProjectConfig() {
  return { port: 0, commands: { start: "", exit: "" } };
}
function emptyWorktreeConfig() {
  return { dir: "", copy: [], setup: [], name: "", port: 0 };
}
function emptyConfig() {
  return {
    rules: [],
    local: [],
    imports: [],
    commands: [],
    backup: "",
    project: emptyProjectConfig(),
    worktree: emptyWorktreeConfig()
  };
}

// src/config/merge.ts
function mergeConfig(base, local) {
  const merged = emptyConfig();
  merged.rules.push(...base.rules);
  merged.local.push(...base.local);
  merged.imports.push(...base.imports);
  merged.commands.push(...base.commands);
  merged.backup = base.backup;
  merged.project = {
    port: base.project.port,
    commands: { ...base.project.commands }
  };
  merged.worktree = mergeWorktree(base.worktree, local.worktree);
  return merged;
}
function mergeWorktree(base, local) {
  return {
    dir: local.dir || base.dir,
    copy: unionStrings(base.copy, local.copy),
    setup: local.setup.length > 0 ? [...local.setup] : [...base.setup],
    name: local.name || base.name,
    port: local.port || base.port
  };
}
function unionStrings(a2, b3) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const item of [...a2, ...b3]) {
    if (item && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

// src/config/read.ts
var import_yaml = __toESM(require_dist(), 1);
function parseConfig(text2) {
  const cfg = emptyConfig();
  let doc;
  try {
    doc = (0, import_yaml.parse)(text2);
  } catch {
    return cfg;
  }
  if (Array.isArray(doc)) {
    cfg.rules.push(...toStringList(doc));
    return cfg;
  }
  if (doc === null || typeof doc !== "object") {
    return cfg;
  }
  const map = doc;
  cfg.rules.push(...toStringList(map.rules));
  cfg.local.push(...toStringList(map.local));
  cfg.imports.push(...toImportList(map.imports));
  cfg.commands.push(...toCommandList(map.commands));
  cfg.backup = typeof map.backup === "string" ? map.backup.trim() : "";
  cfg.project = toProject(map.project);
  cfg.worktree = toWorktree(map.worktree);
  return cfg;
}
function toProject(value) {
  const project = emptyProjectConfig();
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return project;
  }
  const rec = value;
  project.port = toPort(rec.port);
  const commands = rec.commands;
  if (commands !== null && typeof commands === "object") {
    const cmd = commands;
    project.commands.start = typeof cmd.start === "string" ? cmd.start.trim() : "";
    project.commands.exit = typeof cmd.exit === "string" ? cmd.exit.trim() : "";
  }
  return project;
}
function toWorktree(value) {
  const wt = emptyWorktreeConfig();
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return wt;
  }
  const rec = value;
  wt.dir = typeof rec.dir === "string" ? rec.dir.trim() : "";
  wt.copy = toStringList(rec.copy);
  wt.setup = toStringList(rec.setup);
  wt.name = typeof rec.name === "string" ? rec.name.trim() : "";
  wt.port = toPort(rec.port);
  return wt;
}
function toPort(value) {
  const n3 = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n3) && n3 > 0 ? n3 : 0;
}
function toStringList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) out.push(item.trim());
  }
  return out;
}
function toImportList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (item === null || typeof item !== "object") continue;
    const rec = item;
    const owner = typeof rec.owner === "string" ? rec.owner.trim() : "";
    const rule = typeof rec.rule === "string" ? rec.rule.trim() : "";
    if (owner && rule) out.push({ owner, rule });
  }
  return out;
}
function toCommandList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (item === null || typeof item !== "object") continue;
    const rec = item;
    const cmd = typeof rec.cmd === "string" ? rec.cmd.trim() : "";
    if (!cmd) continue;
    const desc = typeof rec.desc === "string" ? rec.desc.trim() : "";
    out.push({ cmd, desc });
  }
  return out;
}

// src/config/load.ts
var BASE_FILE = ".jarrin.yml";
var LOCAL_FILE = ".jarrin.local.yml";
function loadEffectiveConfig(claudeDir) {
  const baseText = readIfPresent(join2(claudeDir, BASE_FILE));
  const localText = readIfPresent(join2(claudeDir, LOCAL_FILE));
  const base = baseText !== null ? parseConfig(baseText) : emptyConfig();
  const local = localText !== null ? parseConfig(localText) : emptyConfig();
  return {
    base,
    local,
    merged: mergeConfig(base, local),
    hasBase: baseText !== null,
    hasLocal: localText !== null
  };
}
function readIfPresent(path2) {
  try {
    return readFileSync(path2, "utf8");
  } catch {
    return null;
  }
}

// src/git.ts
import { spawnSync } from "child_process";
import { dirname } from "path";
function git(cwd, args) {
  const r2 = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  if (r2.status === 0 && typeof r2.stdout === "string" && r2.stdout.trim()) {
    return r2.stdout.trim();
  }
  return null;
}
function toplevel(cwd) {
  return git(cwd, ["rev-parse", "--show-toplevel"]);
}
function mainWorktreeRoot(cwd) {
  const common = git(cwd, [
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir"
  ]);
  if (common) return dirname(common);
  return toplevel(cwd);
}
function branchExists(cwd, name) {
  return git(cwd, ["rev-parse", "--verify", "--quiet", `refs/heads/${name}`]) !== null;
}
function currentBranch(cwd) {
  return git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
}
function worktreeListPorcelain(cwd) {
  return git(cwd, ["worktree", "list", "--porcelain"]);
}
function conflictedFiles(cwd) {
  const r2 = spawnSync(
    "git",
    ["-C", cwd, "diff", "--name-only", "--diff-filter=U"],
    { encoding: "utf8" }
  );
  if (r2.status !== 0 || typeof r2.stdout !== "string") return [];
  return r2.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
}

// src/info/report.ts
var import_yaml2 = __toESM(require_dist(), 1);
function backlogMethods(text2) {
  const fallback = { plan: "local", todo: "local", repo: "" };
  let doc;
  try {
    doc = (0, import_yaml2.parse)(text2);
  } catch {
    return fallback;
  }
  if (doc === null || typeof doc !== "object") return fallback;
  const backlog = doc.backlog;
  if (backlog === null || typeof backlog !== "object") return fallback;
  const rec = backlog;
  const repo = str(rec.repo);
  return {
    plan: sectionMethod(rec.plan),
    todo: sectionMethod(rec.todo),
    repo
  };
}
function sectionMethod(section) {
  if (section === null || typeof section !== "object") return "local";
  const method = str(section.method);
  return method || "local";
}
function str(value) {
  return typeof value === "string" ? value.trim() : "";
}
var CHECK = "\u2713";
var CROSS = "\u2717";
function formatReport(r2) {
  const lines = [];
  lines.push(`claudjar info \u2014 ${r2.repoRoot}`);
  lines.push("");
  lines.push("Config files (.claude/):");
  lines.push(`  ${mark(r2.hasBase)} .jarrin.yml         (committed base)`);
  lines.push(
    `  ${mark(r2.hasLocal)} .jarrin.local.yml   (local override, gitignored)`
  );
  lines.push(
    `  ${mark(r2.hasJarrinMd)} .jarrin-claude.md   (project instructions)`
  );
  lines.push("");
  lines.push("Rules (load order \u2014 \u2713 found, \u2717 missing):");
  if (r2.rules.length === 0) {
    lines.push("  (none selected)");
  } else {
    for (const rule of r2.rules) {
      lines.push(`  ${mark(rule.exists)} ${rule.label}`);
    }
  }
  lines.push("");
  lines.push("Commands:");
  if (r2.commands.length === 0) {
    lines.push("  (none)");
  } else {
    for (const c3 of r2.commands) {
      lines.push(`  ${c3.cmd}${c3.desc ? ` \u2014 ${c3.desc}` : ""}`);
    }
  }
  lines.push("");
  lines.push("Backlog:");
  lines.push(
    `  plan: ${r2.backlog.plan}   todo: ${r2.backlog.todo}${r2.backlog.repo ? `   repo: ${r2.backlog.repo}` : ""}`
  );
  lines.push("");
  lines.push("Project stack:");
  lines.push(
    `  port:  ${r2.project.port ? String(r2.project.port) : "(unset \u2014 feature off)"}`
  );
  lines.push(`  start: ${r2.project.commands.start || "(none)"}`);
  lines.push(`  exit:  ${r2.project.commands.exit || "(none)"}`);
  lines.push("");
  lines.push("Worktree:");
  lines.push(`  name:  ${r2.worktree.name || "(main worktree)"}`);
  lines.push(
    `  port:  ${r2.worktree.port ? String(r2.worktree.port) : "(none \u2014 main worktree)"}`
  );
  lines.push(
    `  dir:   ${r2.worktree.dir || "(default: <repo>-worktrees sibling)"}`
  );
  lines.push(
    `  copy:  ${r2.worktree.copy.length ? r2.worktree.copy.join(", ") : "(none beyond .jarrin.local.yml)"}`
  );
  lines.push(
    `  setup: ${r2.worktree.setup.length ? r2.worktree.setup.join(" && ") : "(none)"}`
  );
  lines.push("");
  lines.push(`Backup: ${r2.backup || "(none)"}`);
  lines.push("");
  lines.push("Skills available:");
  lines.push(r2.skills.length ? `  ${r2.skills.join(", ")}` : "  (none found)");
  return lines.join("\n") + "\n";
}
function mark(present) {
  return present ? CHECK : CROSS;
}

// src/session-start/resolve.ts
import { join as join3 } from "path";
var HEADER = "# Jarrin project rules (auto-loaded)\nSelected by this project's `.claude/.jarrin.yml`; follow them for this session.";
function dedup(items) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const item of items) {
    if (item && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}
function resolveRules(cfg, cwd, groupRoot, rulesDir) {
  const resolved = [];
  for (const name of dedup(cfg.rules)) {
    resolved.push({ label: name, path: join3(rulesDir, `${name}.md`) });
  }
  for (const rel of dedup(cfg.local)) {
    resolved.push({ label: rel, path: join3(cwd, rel) });
  }
  const seen = /* @__PURE__ */ new Set();
  for (const item of cfg.imports) {
    const key = `${item.owner}\0${item.rule}`;
    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push({
      label: `${item.owner}/${item.rule}`,
      path: join3(groupRoot, item.owner, ".claude", "rules", `${item.rule}.md`)
    });
  }
  return resolved;
}
function renderCommands(commands) {
  const lines = [
    "## Commands",
    "",
    "| Command | What it does |",
    "| --- | --- |"
  ];
  const seen = /* @__PURE__ */ new Set();
  for (const command of commands) {
    const cmd = command.cmd.trim();
    if (!cmd || seen.has(cmd)) continue;
    seen.add(cmd);
    lines.push(`| \`${cmd}\` | ${command.desc.trim()} |`);
  }
  return lines.join("\n");
}
function composeAdditionalContext(opts) {
  const parts = [HEADER];
  if (opts.stackStatus) parts.push(opts.stackStatus);
  if (opts.commandsTable) parts.push(opts.commandsTable);
  if (opts.ruleBlocks.length > 0)
    parts.push(opts.ruleBlocks.join("\n\n---\n\n"));
  if (opts.extraMd) parts.push(opts.extraMd);
  if (parts.length === 1) return null;
  return parts.join("\n\n") + "\n";
}

// src/commands/info.ts
function runInfo() {
  const proc = this.process;
  const cwd = proc.cwd();
  const repoRoot = toplevel(cwd) ?? cwd;
  const claudeDir = join4(repoRoot, ".claude");
  const groupRoot = proc.env.JARRIN_GROUP_ROOT ?? dirname2(resolve(repoRoot));
  const loaded = loadEffectiveConfig(claudeDir);
  const cfg = loaded.merged;
  const rules = resolveRules(
    cfg,
    repoRoot,
    groupRoot,
    this.rulesDir
  ).map(({ label, path: path2 }) => ({ label, path: path2, exists: isFile2(path2) }));
  const baseText = readIfPresent2(join4(claudeDir, ".jarrin.yml"));
  const report = {
    repoRoot,
    hasBase: loaded.hasBase,
    hasLocal: loaded.hasLocal,
    rules,
    commands: cfg.commands,
    backup: cfg.backup,
    hasJarrinMd: isFile2(join4(claudeDir, ".jarrin-claude.md")),
    project: cfg.project,
    worktree: cfg.worktree,
    // `backlog:` is skill-owned and not overridable — read it from the committed
    // base only.
    backlog: backlogMethods(baseText ?? ""),
    skills: discoverSkills(this.skillsDir)
  };
  proc.stdout.write(formatReport(report));
}
function readIfPresent2(path2) {
  try {
    return readFileSync2(path2, "utf8");
  } catch {
    return null;
  }
}
function isFile2(path2) {
  try {
    return statSync2(path2).isFile();
  } catch {
    return false;
  }
}
var infoCommand = buildCommand({
  func: runInfo,
  parameters: { flags: {} },
  docs: {
    brief: "Show this repo's resolved rules, commands, backlog, worktree, and skills"
  }
});

// src/commands/init.ts
import { mkdirSync, readFileSync as readFileSync3, statSync as statSync3, writeFileSync } from "fs";
import { basename, join as join6 } from "path";

// src/config/write.ts
var import_yaml3 = __toESM(require_dist(), 1);
function serializeConfig(cfg, existing) {
  if (existing !== void 0 && existing.trim() !== "") {
    return updateDocument(cfg, existing);
  }
  return renderTemplate(cfg);
}
function updateDocument(cfg, existing) {
  const doc = (0, import_yaml3.parseDocument)(existing);
  applyTier(doc, "rules", cfg.rules);
  applyTier(doc, "local", cfg.local);
  applyTier(
    doc,
    "imports",
    cfg.imports.map((i2) => ({ owner: i2.owner, rule: i2.rule }))
  );
  applyTier(
    doc,
    "commands",
    cfg.commands.map((c3) => ({ cmd: c3.cmd, desc: c3.desc }))
  );
  if (cfg.backup) {
    doc.set("backup", cfg.backup);
  } else {
    doc.delete("backup");
  }
  return doc.toString();
}
function applyTier(doc, key, items) {
  if (items.length === 0) {
    doc.delete(key);
    return;
  }
  const seq = new import_yaml3.YAMLSeq();
  for (const item of items) seq.add(item);
  doc.set(key, seq);
}
function renderTemplate(cfg) {
  const lines = [
    "# Jarrin project rules \u2014 selected per repo, injected by the SessionStart",
    "# hook. All keys are optional; an empty file injects nothing. See the",
    "# jarrin-claude repo CLAUDE.md for the full schema.",
    ""
  ];
  if (cfg.rules.length > 0) {
    lines.push("# Tier a \u2014 global rule slugs \u2192 ~/.claude/rules/<slug>.md");
    lines.push("rules:");
    for (const r2 of cfg.rules) lines.push(`  - ${r2}`);
  } else {
    lines.push(
      "# rules:            # global rule slugs \u2192 ~/.claude/rules/<slug>.md"
    );
    lines.push("#   - lang-ts");
  }
  lines.push("");
  if (cfg.local.length > 0) {
    lines.push("# Tier b \u2014 in-repo rule files (paths from the repo root)");
    lines.push("local:");
    for (const l2 of cfg.local) lines.push(`  - ${l2}`);
    lines.push("");
  }
  if (cfg.imports.length > 0) {
    lines.push("# Tier c \u2014 cross-repo imports (owner repo + a rule it owns)");
    lines.push("imports:");
    for (const i2 of cfg.imports) {
      lines.push(`  - owner: ${i2.owner}`);
      lines.push(`    rule: ${i2.rule}`);
    }
    lines.push("");
  }
  if (cfg.commands.length > 0) {
    lines.push("# Dev-command quick reference (rendered as a table)");
    lines.push("commands:");
    for (const c3 of cfg.commands) {
      lines.push(`  - cmd: ${quoteIfNeeded(c3.cmd)}`);
      lines.push(`    desc: ${quoteIfNeeded(c3.desc)}`);
    }
    lines.push("");
  }
  if (cfg.backup) {
    lines.push(
      "# Shell command run before a new session / clear (fatal on failure)"
    );
    lines.push(`backup: ${quoteIfNeeded(cfg.backup)}`);
    lines.push("");
  }
  lines.push(
    "# Per-worktree runtime stack. `port` is the starting port worktrees increment",
    "# from; the start/exit commands run with PROJECT_PORT set, on session start and",
    "# exit inside a worktree (the main checkout is never affected).",
    "# project:",
    "#   port: 8000",
    "#   commands:",
    "#     start: docker compose up -d",
    "#     exit: docker compose down",
    ""
  );
  return lines.join("\n").replace(/\n+$/, "\n");
}
function quoteIfNeeded(value) {
  const doc = new import_yaml3.Document(value);
  return doc.toString().trim();
}

// src/interaction.ts
function resolveInteractive(ctx, interactionFlag) {
  if (!interactionFlag) return false;
  if (ctx.process.env.JARRIN_NO_INTERACTION) return false;
  if (ctx.process.env.CI) return false;
  if (!ctx.process.stdin.isTTY || !ctx.process.stdout.isTTY) return false;
  return true;
}
var AbortError = class extends Error {
  constructor(message = "Cancelled.") {
    super(message);
    this.name = "AbortError";
  }
};
async function loadPrompts() {
  return Promise.resolve().then(() => (init_dist4(), dist_exports));
}

// src/commands/init.ts
async function runInit(flags) {
  const proc = this.process;
  const cwd = proc.cwd();
  const claudeDir = join6(cwd, ".claude");
  const jarrinYml = join6(claudeDir, ".jarrin.yml");
  const jarrinMd = join6(claudeDir, ".jarrin-claude.md");
  const exists = isFile3(jarrinYml);
  const existingText = exists ? readFileSync3(jarrinYml, "utf8") : void 0;
  const base = existingText ? parseConfig(existingText) : emptyConfig();
  const interactive = resolveInteractive(this, flags.interaction);
  let cfg;
  let scaffoldMd;
  try {
    if (interactive) {
      const result = await promptForConfig(this, base, exists, jarrinMd);
      cfg = result.cfg;
      scaffoldMd = result.scaffoldMd;
    } else {
      cfg = mergeFlags(base, flags);
      scaffoldMd = flags.jarrinMd;
    }
  } catch (e) {
    if (e instanceof AbortError) {
      proc.stderr.write(`${e.message}
`);
      proc.exitCode = 1;
      return;
    }
    throw e;
  }
  const output = serializeConfig(cfg, existingText);
  if (interactive && !flags.yes && !flags.force) {
    const prompts = await loadPrompts();
    prompts.note(output, exists ? "Updated .jarrin.yml" : "New .jarrin.yml");
    const ok = await prompts.confirm({
      message: exists ? "Write these changes?" : "Create this file?"
    });
    if (prompts.isCancel(ok) || !ok) {
      prompts.cancel("No changes written.");
      proc.exitCode = 1;
      return;
    }
  }
  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(jarrinYml, output, "utf8");
  if (scaffoldMd && !isFile3(jarrinMd)) {
    writeFileSync(jarrinMd, jarrinMdTemplate(cwd), "utf8");
  }
  const verb = exists ? "Updated" : "Created";
  const rel = jarrinYml.startsWith(cwd) ? jarrinYml.slice(cwd.length + 1) : jarrinYml;
  proc.stdout.write(`${verb} ${rel}
`);
  if (scaffoldMd && isFile3(jarrinMd)) {
    proc.stdout.write(`Scaffolded ${basename(jarrinMd)}
`);
  }
  proc.stdout.write("Restart your Claude Code session to load the rules.\n");
}
function mergeFlags(base, flags) {
  const cfg = emptyConfig();
  cfg.rules.push(...unique([...base.rules, ...flags.rule]));
  cfg.local.push(...unique([...base.local, ...flags.local]));
  const importKey = (i2) => `${i2.owner}/${i2.rule}`;
  const imports = /* @__PURE__ */ new Map();
  for (const i2 of base.imports) imports.set(importKey(i2), i2);
  for (const i2 of parseImports(flags.import)) imports.set(importKey(i2), i2);
  cfg.imports.push(...imports.values());
  const commands = /* @__PURE__ */ new Map();
  for (const c3 of base.commands) commands.set(c3.cmd, c3);
  for (const c3 of parseCommands(flags.command)) commands.set(c3.cmd, c3);
  cfg.commands.push(...commands.values());
  cfg.backup = flags.backup.trim() || base.backup;
  return cfg;
}
async function promptForConfig(ctx, base, exists, jarrinMd) {
  const p3 = await loadPrompts();
  const cancel2 = (v) => {
    if (p3.isCancel(v)) throw new AbortError();
  };
  p3.intro(exists ? "claudjar init \u2014 update" : "claudjar init \u2014 setup");
  const catalog = discoverRuleSlugs(ctx.rulesDir);
  const options = unique([...catalog, ...base.rules]).map((slug) => ({
    value: slug,
    label: slug
  }));
  const rules = options.length ? await p3.multiselect({
    message: "Global rules to load:",
    options,
    initialValues: base.rules,
    required: false
  }) : base.rules;
  cancel2(rules);
  const local = await p3.text({
    message: "Local rule files (space-separated paths, optional):",
    placeholder: ".claude/rules/my-rule.md",
    initialValue: base.local.join(" "),
    defaultValue: ""
  });
  cancel2(local);
  const imports = await p3.text({
    message: "Cross-repo imports (space-separated owner:rule, optional):",
    placeholder: "server:prdl-data-types",
    initialValue: base.imports.map((i2) => `${i2.owner}:${i2.rule}`).join(" "),
    defaultValue: ""
  });
  cancel2(imports);
  const commands = await promptCommands(ctx, base.commands);
  const backup = await p3.text({
    message: "Backup command (run before a new session, optional):",
    placeholder: "git bundle create ../backup.bundle --all",
    initialValue: base.backup,
    defaultValue: ""
  });
  cancel2(backup);
  let scaffoldMd = false;
  if (!isFile3(jarrinMd)) {
    const wantMd = await p3.confirm({
      message: "Scaffold .claude/.jarrin-claude.md (project instructions)?",
      initialValue: false
    });
    cancel2(wantMd);
    scaffoldMd = wantMd === true;
  }
  const cfg = emptyConfig();
  cfg.rules.push(...unique(rules));
  cfg.local.push(...unique(splitWords(local)));
  cfg.imports.push(...parseImports(splitWords(imports)));
  cfg.commands.push(...commands);
  cfg.backup = backup.trim();
  return { cfg, scaffoldMd };
}
async function promptCommands(ctx, base) {
  const p3 = await loadPrompts();
  const cancel2 = (v) => {
    if (p3.isCancel(v)) throw new AbortError();
  };
  const rows = [...base];
  const start = await p3.confirm({
    message: base.length ? `Keep ${String(base.length)} existing command(s) and add more?` : "Add dev-command quick-reference rows?",
    initialValue: false
  });
  cancel2(start);
  if (start !== true) return rows;
  for (; ; ) {
    const cmd = await p3.text({
      message: "Command (blank to stop):",
      placeholder: "pnpm check",
      defaultValue: ""
    });
    cancel2(cmd);
    const cmdStr = cmd.trim();
    if (!cmdStr) break;
    const desc = await p3.text({
      message: `What does \`${cmdStr}\` do?`,
      defaultValue: ""
    });
    cancel2(desc);
    rows.push({ cmd: cmdStr, desc: desc.trim() });
  }
  return rows;
}
function parseImports(items) {
  const out = [];
  for (const item of items) {
    const [owner, rule] = item.split(":", 2).map((s) => s.trim());
    if (owner && rule) out.push({ owner, rule });
  }
  return out;
}
function parseCommands(items) {
  const out = [];
  for (const item of items) {
    const idx = item.indexOf("=");
    if (idx === -1) {
      out.push({ cmd: item.trim(), desc: "" });
    } else {
      out.push({
        cmd: item.slice(0, idx).trim(),
        desc: item.slice(idx + 1).trim()
      });
    }
  }
  return out.filter((c3) => c3.cmd);
}
function splitWords(value) {
  return value.split(/\s+/).filter(Boolean);
}
function unique(items) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}
function jarrinMdTemplate(cwd) {
  const name = basename(cwd);
  return `# ${name} \u2014 project instructions

<!-- Always-apply instructions for this repo. Appended verbatim to the
     session context after the selected rules. Add hard rules and a
     "Start here" orientation here as prose. -->
`;
}
function isFile3(path2) {
  try {
    return statSync3(path2).isFile();
  } catch {
    return false;
  }
}
var initCommand = buildCommand({
  func: runInit,
  parameters: {
    flags: {
      rule: {
        kind: "parsed",
        parse: String,
        variadic: true,
        brief: "Global rule slug to select (repeatable)",
        default: []
      },
      local: {
        kind: "parsed",
        parse: String,
        variadic: true,
        brief: "In-repo rule file path (repeatable)",
        default: []
      },
      import: {
        kind: "parsed",
        parse: String,
        variadic: true,
        brief: "Cross-repo import as owner:rule (repeatable)",
        default: []
      },
      command: {
        kind: "parsed",
        parse: String,
        variadic: true,
        brief: "Quick-reference row as cmd=desc (repeatable)",
        default: []
      },
      backup: {
        kind: "parsed",
        parse: String,
        brief: "Backup command run before a new session",
        default: ""
      },
      jarrinMd: {
        kind: "boolean",
        brief: "Scaffold .claude/.jarrin-claude.md if missing",
        default: false
      },
      force: {
        kind: "boolean",
        brief: "Write without the confirmation prompt",
        default: false
      },
      yes: {
        kind: "boolean",
        brief: "Assume yes for confirmations",
        default: false
      },
      interaction: {
        kind: "boolean",
        brief: "Prompt interactively (use --no-interaction to disable)",
        default: true
      }
    }
  },
  docs: {
    brief: "Set up or update .claude/.jarrin.yml for this repo"
  }
});

// src/commands/install.ts
import { spawnSync as spawnSync2 } from "child_process";
import {
  chmodSync,
  existsSync as existsSync2,
  lstatSync as lstatSync2,
  mkdirSync as mkdirSync2,
  mkdtempSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync as statSync4,
  symlinkSync,
  writeFileSync as writeFileSync2
} from "fs";
import { homedir, tmpdir } from "os";
import { basename as basename2, dirname as dirname4, join as join7, resolve as resolve2 } from "path";
import { fileURLToPath } from "url";
async function runInstall(flags) {
  const proc = this.process;
  const out = (msg) => void proc.stdout.write(msg);
  const info = (msg) => void proc.stdout.write(`  ${msg}
`);
  const warn = (msg) => void proc.stderr.write(`  ! ${msg}
`);
  const repoDir = findRepoRoot(fileURLToPath(import.meta.url));
  const claudeHome = proc.env.CLAUDE_HOME ?? join7(homedir(), ".claude");
  const localBin = join7(homedir(), ".local", "bin");
  const gitleaksBinDir = proc.env.GITLEAKS_BIN_DIR ?? localBin;
  const claudjarBinDir = proc.env.CLAUDJAR_BIN_DIR ?? localBin;
  const interactive = resolveInteractive(this, flags.interaction);
  const confirm2 = async (question) => {
    if (flags.yes) return true;
    if (!interactive) {
      warn(`${question} \u2014 skipped (non-interactive; pass --yes to overwrite).`);
      return false;
    }
    const p3 = await loadPrompts();
    const answer = await p3.confirm({ message: question, initialValue: false });
    return answer === true;
  };
  out("claudjar install\n");
  info(`repo:        ${repoDir}`);
  info(`claude home: ${claudeHome}`);
  out("\n");
  mkdirSync2(claudeHome, { recursive: true });
  const links = [
    {
      src: join7(repoDir, "claude", "CLAUDE.md"),
      dest: join7(claudeHome, "CLAUDE.md")
    },
    {
      src: join7(repoDir, "claude", "settings.json"),
      dest: join7(claudeHome, "settings.json")
    },
    { src: join7(repoDir, "bin", "claude"), dest: join7(claudeHome, "bin") },
    { src: join7(repoDir, "claude", "rules"), dest: join7(claudeHome, "rules") },
    {
      src: join7(repoDir, "claude", "skills"),
      dest: join7(claudeHome, "skills")
    },
    {
      src: join7(repoDir, "claude", "references"),
      dest: join7(claudeHome, "references")
    }
  ];
  out(`Linking config into ${claudeHome}:
`);
  for (const spec of links) {
    await link(spec, { info, warn, confirm: confirm2 });
  }
  out("\n");
  out(`Exposing the claudjar command in ${claudjarBinDir}:
`);
  const bundle = join7(repoDir, "dist", "claudjar.js");
  if (existsSync2(bundle)) {
    mkdirSync2(claudjarBinDir, { recursive: true });
    await link(
      { src: bundle, dest: join7(claudjarBinDir, "claudjar") },
      { info, warn, confirm: confirm2 }
    );
    if (!onPath(proc, claudjarBinDir)) {
      warn(
        `note: ${claudjarBinDir} is not on PATH; add it so \`claudjar\` resolves.`
      );
    }
  } else {
    warn(`bundle not found at ${bundle} \u2014 run 'pnpm run build' first.`);
  }
  out("\n");
  out("Enabling git hooks (secret scanning):\n");
  const git2 = spawnSync2("git", [
    "-C",
    repoDir,
    "config",
    "core.hooksPath",
    ".githooks"
  ]);
  if (git2.status === 0) {
    info("core.hooksPath = .githooks");
  } else {
    warn("failed to set core.hooksPath (is this a git repo?).");
  }
  out("\n");
  out("Checking prerequisites:\n");
  info(`node: ${proc.version} - CLI + SessionStart hook OK`);
  if (hasBinary("gitleaks")) {
    info("gitleaks present - pre-commit scan active");
  } else if (flags.withGitleaks) {
    warn("gitleaks NOT found - installing (--with-gitleaks)...");
    const ok = await installGitleaks(gitleaksBinDir, { info, warn });
    if (ok) {
      info(`installed gitleaks -> ${join7(gitleaksBinDir, "gitleaks")}`);
      if (!onPath(proc, gitleaksBinDir)) {
        warn(
          `note: ${gitleaksBinDir} is not on PATH; add it so git hooks find gitleaks.`
        );
      }
    } else {
      warn("gitleaks install did not complete; pre-commit will skip scanning.");
    }
  } else {
    warn(
      "gitleaks NOT found - the pre-commit hook will skip scanning (commits still work)."
    );
    warn(
      "  re-run with --with-gitleaks to auto-download it, or 'brew install gitleaks'."
    );
  }
  out("\n");
  out("Done. Restart Claude Code sessions to pick up the new settings.\n");
}
async function link(spec, r2) {
  const { src, dest } = spec;
  if (!existsSync2(src)) {
    r2.warn(`source missing, skipped: ${src}`);
    return;
  }
  const linkTarget = lsymlink(dest);
  if (linkTarget !== null) {
    if (linkTarget === src) {
      r2.info(`ok   ${dest} -> ${src} (already linked)`);
      return;
    }
    if (!await r2.confirm(
      `replace symlink ${dest} (currently -> ${linkTarget})?`
    )) {
      r2.warn(`skipped ${dest}`);
      return;
    }
    rmSync(dest);
  } else if (existsSync2(dest)) {
    const kind = statSync4(dest).isDirectory() ? "directory" : "file";
    if (!await r2.confirm(`back up and replace existing ${kind} ${dest}?`)) {
      r2.warn(`skipped ${dest}`);
      return;
    }
    renameSync(dest, `${dest}.pre-jarrin.bak`);
    r2.info(`backed up ${dest} -> ${basename2(dest)}.pre-jarrin.bak`);
  }
  symlinkSync(src, dest);
  r2.info(`linked ${dest} -> ${src}`);
}
function lsymlink(path2) {
  try {
    if (lstatSync2(path2).isSymbolicLink()) return readlinkSync(path2);
  } catch {
  }
  return null;
}
async function installGitleaks(binDir, r2) {
  const os = platformSlug();
  const arch = archSlug();
  if (!os || !arch) {
    r2.warn(
      `unsupported platform ${process.platform}/${process.arch}; install gitleaks manually.`
    );
    return false;
  }
  let tmp;
  try {
    const release = await (await fetch(
      "https://api.github.com/repos/gitleaks/gitleaks/releases/latest",
      {
        headers: { "User-Agent": "claudjar-installer" }
      }
    )).json();
    const suffix = `_${os}_${arch}.tar.gz`;
    const asset = release.assets?.find((a2) => a2.name?.endsWith(suffix));
    if (!asset?.browser_download_url) {
      r2.warn(`no gitleaks release asset for ${os}_${arch}.`);
      return false;
    }
    tmp = mkdtempSync(join7(tmpdir(), "gitleaks-"));
    r2.info(`downloading ${asset.browser_download_url}`);
    const tarPath = join7(tmp, "gl.tar.gz");
    const res = await fetch(asset.browser_download_url);
    if (!res.ok) {
      r2.warn(`download failed (HTTP ${String(res.status)}).`);
      return false;
    }
    writeFileSync2(tarPath, Buffer.from(await res.arrayBuffer()));
    const untar = spawnSync2("tar", ["-xzf", tarPath, "-C", tmp, "gitleaks"]);
    if (untar.status !== 0) {
      r2.warn("gitleaks extract failed (is `tar` installed?).");
      return false;
    }
    mkdirSync2(binDir, { recursive: true });
    const finalPath = join7(binDir, "gitleaks");
    renameSync(join7(tmp, "gitleaks"), finalPath);
    chmodSync(finalPath, 493);
    return true;
  } catch (e) {
    r2.warn(`gitleaks download/extract failed: ${String(e)}`);
    return false;
  } finally {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
}
function findRepoRoot(fromFile) {
  let dir = dirname4(fromFile);
  for (let i2 = 0; i2 < 8; i2++) {
    if (existsSync2(join7(dir, "claude")) && existsSync2(join7(dir, "bin", "claude"))) {
      return dir;
    }
    const parent = dirname4(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve2(dirname4(fromFile), "..");
}
function hasBinary(name) {
  if (process.platform === "win32") {
    return spawnSync2("where", [name]).status === 0;
  }
  return spawnSync2("sh", ["-c", `command -v "${name}"`]).status === 0;
}
function onPath(proc, dir) {
  return (proc.env.PATH ?? "").split(":").includes(dir);
}
function platformSlug() {
  if (process.platform === "linux") return "linux";
  if (process.platform === "darwin") return "darwin";
  return null;
}
function archSlug() {
  if (process.arch === "x64") return "x64";
  if (process.arch === "arm64") return "arm64";
  return null;
}
var installCommand = buildCommand({
  func: runInstall,
  parameters: {
    flags: {
      withGitleaks: {
        kind: "boolean",
        brief: "Download the gitleaks binary if it is missing",
        default: false
      },
      yes: {
        kind: "boolean",
        brief: "Overwrite existing files without prompting",
        default: false
      },
      interaction: {
        kind: "boolean",
        brief: "Prompt before overwriting (use --no-interaction to disable)",
        default: true
      }
    }
  },
  docs: {
    brief: "Symlink the config into ~/.claude, enable hooks, check prerequisites"
  }
});

// src/commands/session-end.ts
import { join as join8 } from "path";

// src/project/stack.ts
import { spawnSync as spawnSync3 } from "child_process";
var PORT_ENV = "PROJECT_PORT";
function effectivePort(cfg) {
  return cfg.worktree.port || cfg.project.port;
}
function resolveStack(cfg) {
  const port = effectivePort(cfg);
  return {
    active: cfg.worktree.name !== "" && port > 0,
    port,
    name: cfg.worktree.name,
    start: cfg.project.commands.start,
    exit: cfg.project.commands.exit
  };
}
function runStackCommand(command, port, cwd, proc) {
  const result = spawnSync3(command, {
    cwd,
    shell: true,
    encoding: "utf8",
    env: { ...proc.env, [PORT_ENV]: String(port) }
  });
  if (result.stdout) proc.stderr.write(result.stdout);
  if (result.stderr) proc.stderr.write(result.stderr);
  if (result.error) {
    proc.stderr.write(`error launching command: ${result.error.message}
`);
    return 1;
  }
  return result.status ?? 1;
}
function isStartSource(source) {
  return source === "startup";
}
function showsPort(source) {
  return source === "startup" || source === "clear";
}
function isExitReason(reason) {
  return reason !== "clear";
}
function stackStatusText(name, port) {
  return `## Project stack

Worktree \`${name}\` runs its project stack on ${PORT_ENV}=**${String(port)}**.`;
}

// src/commands/session-end.ts
var TAG = "[jarrin session-end]";
async function runSessionEnd() {
  const proc = this.process;
  const err = (msg) => void proc.stderr.write(msg);
  const payload = await readPayload(proc);
  const cwd = payload.cwd ?? proc.cwd();
  const reason = payload.reason ?? "";
  if (!isExitReason(reason)) return;
  const cfg = loadEffectiveConfig(join8(cwd, ".claude")).merged;
  const stack = resolveStack(cfg);
  if (!stack.active || !stack.exit) return;
  err(
    `${TAG} stopping project stack (PROJECT_PORT=${String(stack.port)}): ${stack.exit}
`
  );
  const status = runStackCommand(stack.exit, stack.port, cwd, proc);
  if (status !== 0) {
    err(`${TAG} WARNING: exit command exited ${String(status)}.
`);
  }
}
async function readPayload(proc) {
  if (proc.stdin.isTTY) return {};
  try {
    const chunks = [];
    for await (const chunk of proc.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    const text2 = Buffer.concat(chunks).toString("utf8").trim();
    if (!text2) return {};
    const parsed = JSON.parse(text2);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
  }
  return {};
}
var sessionEndCommand = buildCommand({
  func: runSessionEnd,
  parameters: { flags: {} },
  docs: {
    brief: "SessionEnd hook: tear down this worktree's project stack (reads stdin JSON)"
  }
});

// src/commands/session-start.ts
import { spawnSync as spawnSync4 } from "child_process";
import { readFileSync as readFileSync4, statSync as statSync5 } from "fs";
import { dirname as dirname5, join as join9, resolve as resolve3 } from "path";
var TAG2 = "[jarrin session-start]";
var BACKUP_SOURCES = /* @__PURE__ */ new Set(["startup", "clear"]);
async function runSessionStart() {
  const proc = this.process;
  const err = (msg) => void proc.stderr.write(msg);
  const payload = await readPayload2(proc);
  const cwd = payload.cwd ?? proc.cwd();
  const source = payload.source ?? "";
  const groupRoot = proc.env.JARRIN_GROUP_ROOT ?? dirname5(resolve3(cwd));
  const claudeDir = join9(cwd, ".claude");
  const jarrinYml = join9(claudeDir, ".jarrin.yml");
  const jarrinMd = join9(claudeDir, ".jarrin-claude.md");
  if (!isFile4(jarrinYml)) {
    err(
      `${TAG2} ERROR: ${jarrinYml} not found. Create it to declare which rules to load, e.g.
    rules:
      - lang-ts
`
    );
    proc.exitCode = 1;
    return;
  }
  const cfg = loadEffectiveConfig(claudeDir).merged;
  if (cfg.backup && BACKUP_SOURCES.has(source)) {
    if (runBackup(this, cfg.backup, cwd) !== 0) {
      err(`${TAG2} ERROR: backup command failed; session blocked.
`);
      proc.exitCode = 1;
      return;
    }
  }
  const ruleBlocks = [];
  const missing = [];
  for (const { label, path: path2 } of resolveRules(
    cfg,
    cwd,
    groupRoot,
    this.rulesDir
  )) {
    if (isFile4(path2)) {
      ruleBlocks.push(readFileSync4(path2, "utf8").trim());
    } else {
      missing.push(label);
    }
  }
  if (missing.length > 0) {
    err(`${TAG2} WARNING: rule(s) not found: ${missing.join(", ")}
`);
  }
  const extraMd = isFile4(jarrinMd) ? readFileSync4(jarrinMd, "utf8").trim() : "";
  const stack = resolveStack(cfg);
  let stackStatus;
  if (stack.active) {
    if (isStartSource(source) && stack.start) {
      err(
        `${TAG2} starting project stack (PROJECT_PORT=${String(stack.port)}): ${stack.start}
`
      );
      const status = runStackCommand(stack.start, stack.port, cwd, proc);
      if (status !== 0) {
        err(
          `${TAG2} WARNING: start command exited ${String(status)}; continuing.
`
        );
      }
    }
    if (showsPort(source)) {
      stackStatus = stackStatusText(stack.name, stack.port);
    }
  }
  const additionalContext = composeAdditionalContext({
    stackStatus,
    commandsTable: cfg.commands.length > 0 ? renderCommands(cfg.commands) : void 0,
    ruleBlocks,
    extraMd: extraMd || void 0
  });
  if (additionalContext === null) return;
  proc.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext
      }
    }) + "\n"
  );
}
async function readPayload2(proc) {
  if (proc.stdin.isTTY) return {};
  try {
    const chunks = [];
    for await (const chunk of proc.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    const text2 = Buffer.concat(chunks).toString("utf8").trim();
    if (!text2) return {};
    const parsed = JSON.parse(text2);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
  }
  return {};
}
function runBackup(ctx, command, cwd) {
  ctx.process.stderr.write(`${TAG2} backup: ${command}
`);
  const result = spawnSync4(command, {
    cwd,
    shell: true,
    encoding: "utf8"
  });
  if (result.stdout) ctx.process.stderr.write(result.stdout);
  if (result.stderr) ctx.process.stderr.write(result.stderr);
  if (result.error) {
    ctx.process.stderr.write(
      `${TAG2} ERROR launching backup: ${result.error.message}
`
    );
    return 1;
  }
  return result.status ?? 1;
}
function isFile4(path2) {
  try {
    return statSync5(path2).isFile();
  } catch {
    return false;
  }
}
var sessionStartCommand = buildCommand({
  func: runSessionStart,
  parameters: { flags: {} },
  docs: {
    brief: "SessionStart hook: inject the project's selected rules (reads stdin JSON)"
  }
});

// src/commands/start.ts
import { join as join10 } from "path";
function runLifecycle(ctx, kind) {
  const proc = ctx.process;
  const out = (msg) => void proc.stdout.write(msg);
  const repoRoot = toplevel(proc.cwd());
  if (!repoRoot) {
    proc.stderr.write(`${kind}: not inside a git repository.
`);
    proc.exitCode = 1;
    return;
  }
  const cfg = loadEffectiveConfig(join10(repoRoot, ".claude")).merged;
  const stack = resolveStack(cfg);
  if (!stack.active) {
    out(
      "No project stack for this checkout (the main repo is not affected; only worktrees created by `claudjar worktree create` run a stack).\n"
    );
    return;
  }
  const command = kind === "start" ? stack.start : stack.exit;
  if (!command) {
    out(`No project.commands.${kind} configured; nothing to run.
`);
    return;
  }
  out(
    `${kind === "start" ? "Starting" : "Stopping"} project stack (PROJECT_PORT=${String(stack.port)})\u2026
`
  );
  const status = runStackCommand(command, stack.port, repoRoot, proc);
  if (status !== 0) {
    proc.stderr.write(`${kind}: command failed (exit ${String(status)}).
`);
    proc.exitCode = 1;
  }
}
var startCommand = buildCommand({
  func: function() {
    runLifecycle(this, "start");
  },
  parameters: { flags: {} },
  docs: {
    brief: "Bring up this worktree's project stack (project.commands.start, PROJECT_PORT set)"
  }
});
var stopCommand = buildCommand({
  func: function() {
    runLifecycle(this, "exit");
  },
  parameters: { flags: {} },
  docs: {
    brief: "Tear down this worktree's project stack (project.commands.exit, PROJECT_PORT set)"
  }
});

// src/commands/statusline.ts
import { basename as basename3, join as join11 } from "path";
var RESET = "\x1B[0m";
var DIM = "\x1B[2m";
var CYAN = "\x1B[36m";
var YELLOW = "\x1B[33m";
var BOLD = "\x1B[1m";
var SEP = `${DIM} \xB7 ${RESET}`;
function formatStatusline(data) {
  const parts = [`${DIM}${data.modelName}${RESET}`, data.dirName];
  if (data.branch) parts.push(`${CYAN}${data.branch}${RESET}`);
  let line = parts.join(SEP);
  if (data.worktreeName) {
    const portLabel = data.port > 0 ? ` ${DIM}:${RESET}${YELLOW}${String(data.port)}` : "";
    line += `  ${BOLD}${YELLOW}\u2442 ${data.worktreeName}${RESET}${portLabel}${RESET}`;
  }
  return line;
}
function renderStatusline(dir, modelName) {
  const root = toplevel(dir) ?? dir;
  const cfg = loadEffectiveConfig(join11(root, ".claude")).merged;
  return formatStatusline({
    modelName,
    dirName: basename3(root),
    branch: currentBranch(root),
    worktreeName: cfg.worktree.name,
    port: effectivePort(cfg)
  });
}
async function readPayload3(proc) {
  if (proc.stdin.isTTY) return {};
  try {
    const chunks = [];
    for await (const chunk of proc.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    const text2 = Buffer.concat(chunks).toString("utf8").trim();
    if (!text2) return {};
    const parsed = JSON.parse(text2);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
  }
  return {};
}
async function runStatusline() {
  const proc = this.process;
  const payload = await readPayload3(proc);
  const dir = payload.workspace?.current_dir ?? payload.cwd ?? proc.cwd();
  const modelName = payload.model?.display_name?.trim() || "claude";
  proc.stdout.write(renderStatusline(dir, modelName) + "\n");
}
var statuslineCommand = buildCommand({
  func: runStatusline,
  parameters: { flags: {} },
  docs: {
    brief: "statusLine hook: render model \xB7 dir \xB7 branch, plus worktree name+port (reads stdin JSON)"
  }
});

// src/commands/worktree.ts
import { spawnSync as spawnSync5 } from "child_process";
import {
  cpSync,
  existsSync as existsSync3,
  mkdirSync as mkdirSync3,
  readFileSync as readFileSync5,
  writeFileSync as writeFileSync3
} from "fs";
import { dirname as dirname7, join as join13, relative, resolve as resolve5 } from "path";

// src/worktree/merge.ts
function parseWorktreeList(porcelain) {
  const entries = [];
  let path2 = null;
  let branch = null;
  const flush = () => {
    if (path2) entries.push({ path: path2, branch });
    path2 = null;
    branch = null;
  };
  for (const raw of porcelain.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("worktree ")) {
      flush();
      path2 = line.slice("worktree ".length);
    } else if (line.startsWith("branch ")) {
      branch = line.slice("branch ".length).replace(/^refs\/heads\//, "");
    } else if (line === "") {
      flush();
    }
  }
  flush();
  return entries;
}
function worktreePathForBranch(porcelain, branch) {
  return parseWorktreeList(porcelain).find((e) => e.branch === branch)?.path ?? null;
}
function conflictPrompt(opts) {
  const list = opts.files.length ? opts.files.map((f2) => `  - ${f2}`).join("\n") : "  (none captured \u2014 run `git status` to see the conflicted paths)";
  return [
    `You are picking up a Git merge that is paused mid-conflict. There is no`,
    `earlier conversation \u2014 everything you need is below and in the repository`,
    `you have been started in.`,
    ``,
    `## What just happened`,
    ``,
    `This project used a separate git worktree for the branch '${opts.branch}'.`,
    `That work is now being merged back: 'git merge ${opts.branch}' was run while`,
    `'${opts.targetBranch}' was checked out, and Git stopped because the two sides`,
    `changed overlapping lines. The merge is IN PROGRESS \u2014 the working tree holds`,
    `conflict markers (<<<<<<<, =======, >>>>>>>) and MERGE_HEAD still exists.`,
    `Nothing has been committed or lost.`,
    ``,
    `## Conflicted files`,
    ``,
    list,
    ``,
    `## Your job`,
    ``,
    `1. Run 'git status' and 'git diff' to see the full picture; open each`,
    `   conflicted file and read the markers. The '${opts.targetBranch}' side is`,
    `   labelled HEAD / "ours"; the incoming '${opts.branch}' side is "theirs".`,
    `2. Resolve every conflict by UNDERSTANDING both changes and combining their`,
    `   intent \u2014 do not blindly pick one side, and never delete a marker without`,
    `   deciding what the merged code should actually be. Read the surrounding`,
    `   code so the result is coherent, not just marker-free.`,
    `3. Remove all conflict markers. Make sure the file still parses and the`,
    `   change reads like the rest of the codebase.`,
    `4. Stage each resolved file with 'git add <file>'. When 'git status' shows no`,
    `   remaining unmerged paths, finish the merge with 'git commit --no-edit'`,
    `   (keep the default merge message).`,
    `5. Verify: run this repo's checks and fix anything that breaks BEFORE you`,
    `   call it done \u2014 look for the project's gate (e.g. 'pnpm check', 'pnpm test',`,
    `   'composer check', 'poetry run pytest', a Makefile target, or the commands`,
    `   in its README / CLAUDE.md) and run it.`,
    ``,
    `## Rules`,
    ``,
    `- Do NOT run 'git merge --abort' or 'git reset' \u2014 that throws the merge away.`,
    `- Do NOT force-push or rewrite history.`,
    `- If a conflict is genuinely ambiguous and you cannot determine the right`,
    `  resolution from the code, stop and explain the specific decision you need`,
    `  rather than guessing.`,
    `- When finished, summarise what conflicted and how you resolved each one.`
  ].join("\n");
}

// src/worktree/plan.ts
import { basename as basename4, dirname as dirname6, isAbsolute, join as join12, resolve as resolve4 } from "path";
var ALWAYS_COPY = [join12(".claude", LOCAL_FILE)];
function planWorktree(opts) {
  const name = opts.name.trim();
  const baseDir = resolveBaseDir(opts.cfg.dir, opts.repoRoot);
  return {
    branch: name,
    baseDir,
    path: join12(baseDir, name),
    copy: dedup2([...ALWAYS_COPY, ...opts.cfg.copy]),
    setup: [...opts.cfg.setup]
  };
}
function resolveBaseDir(dir, repoRoot) {
  if (dir) return isAbsolute(dir) ? dir : resolve4(repoRoot, dir);
  return join12(dirname6(repoRoot), `${basename4(repoRoot)}-worktrees`);
}
function nextPort(base, existing) {
  const start = base > 0 ? base : 0;
  if (existing.length === 0) return start;
  const highest = existing.reduce((max, p3) => p3 > max ? p3 : max, 0);
  return Math.max(start, highest + 1);
}
function validateWorktreeName(raw) {
  const name = raw.trim();
  if (!name) return "name must not be empty";
  if (name.startsWith("-")) return "name must not start with '-'";
  if (isAbsolute(name)) return "name must be relative, not an absolute path";
  if (name.split("/").includes("..")) return "name must not contain '..'";
  return null;
}
function dedup2(items) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const item of items) {
    if (item && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

// src/worktree/stamp.ts
var import_yaml4 = __toESM(require_dist(), 1);
function stampWorktree(existing, identity) {
  const doc = (0, import_yaml4.parseDocument)(existing.trim() ? existing : "");
  let wt = doc.get("worktree");
  if (!(wt instanceof import_yaml4.YAMLMap)) {
    wt = new import_yaml4.YAMLMap();
    doc.set("worktree", wt);
  }
  const map = wt;
  map.set("name", identity.name);
  if (identity.port > 0) map.set("port", identity.port);
  return doc.toString();
}

// src/commands/worktree.ts
function runWorktreeCreate(flags, name) {
  const proc = this.process;
  const out = (msg) => void proc.stdout.write(msg);
  const fail = (msg) => {
    proc.stderr.write(`worktree create: ${msg}
`);
    proc.exitCode = 1;
  };
  const nameError = validateWorktreeName(name);
  if (nameError) return fail(nameError);
  const branch = name.trim();
  const repoRoot = mainWorktreeRoot(proc.cwd());
  if (!repoRoot) return fail("not inside a git repository.");
  const cfg = loadEffectiveConfig(join13(repoRoot, ".claude")).merged;
  const plan = planWorktree({ name: branch, repoRoot, cfg: cfg.worktree });
  if (existsSync3(plan.path)) {
    return fail(`target already exists: ${plan.path}`);
  }
  const exists = branchExists(repoRoot, branch);
  const gitArgs = exists ? ["-C", repoRoot, "worktree", "add", plan.path, branch] : ["-C", repoRoot, "worktree", "add", "-b", branch, plan.path];
  out(`Creating worktree ${plan.path} (branch ${branch})\u2026
`);
  const add = spawnSync5("git", gitArgs, { stdio: "inherit" });
  if (add.status !== 0) return fail("`git worktree add` failed.");
  for (const rel of plan.copy) {
    const src = join13(repoRoot, rel);
    if (!existsSync3(src)) continue;
    const dest = join13(plan.path, rel);
    mkdirSync3(dirname7(dest), { recursive: true });
    cpSync(src, dest, { recursive: true });
    out(`  copied ${rel}
`);
  }
  const port = cfg.project.port > 0 ? nextPort(cfg.project.port, assignedPorts(repoRoot)) : 0;
  const localPath = join13(plan.path, ".claude", LOCAL_FILE);
  const existing = existsSync3(localPath) ? readFileSync5(localPath, "utf8") : "";
  mkdirSync3(dirname7(localPath), { recursive: true });
  writeFileSync3(
    localPath,
    stampWorktree(existing, { name: branch, port }),
    "utf8"
  );
  out(`  stamped worktree.name: ${branch} in .claude/${LOCAL_FILE}
`);
  if (port > 0) out(`  assigned PROJECT_PORT: ${String(port)}
`);
  if (flags.setup && plan.setup.length > 0) {
    out(`Running setup (${String(plan.setup.length)} command(s))\u2026
`);
    for (const command of plan.setup) {
      out(`  $ ${command}
`);
      const res = spawnSync5(command, {
        cwd: plan.path,
        shell: true,
        stdio: "inherit"
      });
      if (res.status !== 0) {
        return fail(
          `setup command failed (exit ${String(res.status ?? "?")}): ${command}
The worktree exists at ${plan.path}; fix and re-run setup by hand.`
        );
      }
    }
  } else if (!flags.setup && plan.setup.length > 0) {
    out(
      `Skipped ${String(plan.setup.length)} setup command(s) (--no-setup).
`
    );
  }
  out(`
Done. cd ${relative(proc.cwd(), plan.path) || plan.path}
`);
}
function assignedPorts(repoRoot) {
  const porcelain = worktreeListPorcelain(repoRoot);
  if (!porcelain) return [];
  const ports = [];
  for (const line of porcelain.split("\n")) {
    if (!line.startsWith("worktree ")) continue;
    const wtPath = line.slice("worktree ".length).trim();
    const localPath = join13(wtPath, ".claude", LOCAL_FILE);
    if (!existsSync3(localPath)) continue;
    try {
      const port = parseConfig(readFileSync5(localPath, "utf8")).worktree.port;
      if (port > 0) ports.push(port);
    } catch {
    }
  }
  return ports;
}
function runWorktreeMerge(flags, name) {
  const proc = this.process;
  const out = (msg) => void proc.stdout.write(msg);
  const fail = (msg) => {
    proc.stderr.write(`worktree merge: ${msg}
`);
    proc.exitCode = 1;
  };
  const nameError = validateWorktreeName(name);
  if (nameError) return fail(nameError);
  const branch = name.trim();
  const target = toplevel(proc.cwd());
  if (!target) return fail("not inside a git repository.");
  if (!branchExists(target, branch)) return fail(`no such branch: ${branch}`);
  const onBranch = currentBranch(target);
  if (onBranch === branch) {
    return fail(
      `'${branch}' is checked out here; run merge from the branch you want to merge it into.`
    );
  }
  const porcelain = worktreeListPorcelain(target);
  const wtPath = porcelain ? worktreePathForBranch(porcelain, branch) : null;
  if (wtPath && resolve5(wtPath) === resolve5(target)) {
    return fail(
      `you are inside the worktree for '${branch}'; run merge from the target worktree instead.`
    );
  }
  out(`Merging ${branch} into ${onBranch ?? "HEAD"}\u2026
`);
  const merge = spawnSync5("git", ["-C", target, "merge", "--no-edit", branch], {
    stdio: "inherit"
  });
  if (merge.status !== 0) {
    const files = conflictedFiles(target);
    if (files.length === 0) {
      return fail("`git merge` failed (not a conflict); resolve and retry.");
    }
    proc.stderr.write(
      `worktree merge: conflict in ${String(files.length)} file(s); worktree and branch kept.
`
    );
    if (!flags.claude) {
      out(
        `
Conflicted files:
${files.map((f2) => `  - ${f2}`).join("\n")}

Resolve the conflicts and commit. (--no-claude: not launching claude.)
`
      );
      proc.exitCode = 1;
      return;
    }
    const prompt = conflictPrompt({
      branch,
      targetBranch: onBranch ?? "HEAD",
      files
    });
    out(`
Launching claude to resolve the conflict\u2026
`);
    const claude = spawnSync5("claude", [prompt], {
      cwd: target,
      stdio: "inherit"
    });
    if (claude.error) {
      proc.stderr.write(
        `worktree merge: could not launch 'claude' (${claude.error.message}).
`
      );
      out(`
Resolve manually with this prompt:

${prompt}
`);
      proc.exitCode = 1;
    }
    return;
  }
  out(`Merged ${branch} cleanly.
`);
  if (flags.keep) {
    out(`Kept the worktree and branch (--keep).
`);
    return;
  }
  if (wtPath) {
    const rm = spawnSync5("git", ["-C", target, "worktree", "remove", wtPath], {
      stdio: "inherit"
    });
    if (rm.status !== 0) {
      return fail(
        `merged, but 'git worktree remove ${wtPath}' failed (uncommitted changes there?). Clean it up by hand, or re-run with --keep.`
      );
    }
    out(`  removed worktree ${wtPath}
`);
  }
  const del = spawnSync5("git", ["-C", target, "branch", "-d", branch], {
    stdio: "inherit"
  });
  if (del.status !== 0) {
    return fail(
      `merged and removed the worktree, but 'git branch -d ${branch}' failed. Delete the branch by hand.`
    );
  }
  out(`  deleted branch ${branch}

Done.
`);
}
function runWorktreeList() {
  const proc = this.process;
  const repoRoot = mainWorktreeRoot(proc.cwd()) ?? proc.cwd();
  const res = spawnSync5("git", ["-C", repoRoot, "worktree", "list"], {
    stdio: "inherit"
  });
  if (res.status !== 0) {
    proc.stderr.write("worktree list: `git worktree list` failed.\n");
    proc.exitCode = 1;
  }
}
var worktreeCreateCommand = buildCommand({
  func: runWorktreeCreate,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Worktree / branch name (git branch syntax, e.g. feature/x)",
          parse: String,
          placeholder: "name"
        }
      ]
    },
    flags: {
      setup: {
        kind: "boolean",
        brief: "Run the configured setup commands (use --no-setup to skip)",
        default: true
      }
    }
  },
  docs: {
    brief: "Add a git worktree and bootstrap it from the worktree: config"
  }
});
var worktreeMergeCommand = buildCommand({
  func: runWorktreeMerge,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Worktree / branch name to merge in (e.g. feature/x)",
          parse: String,
          placeholder: "name"
        }
      ]
    },
    flags: {
      keep: {
        kind: "boolean",
        brief: "Keep the worktree and branch after a clean merge",
        default: false
      },
      claude: {
        kind: "boolean",
        brief: "On conflict, launch claude to resolve (use --no-claude to skip)",
        default: true
      }
    }
  },
  docs: {
    brief: "Merge a worktree branch into the current branch, then remove it (claude resolves conflicts)"
  }
});
var worktreeListCommand = buildCommand({
  func: runWorktreeList,
  parameters: { flags: {} },
  docs: { brief: "List this repo's git worktrees" }
});
var worktreeRoutes = buildRouteMap({
  routes: {
    create: worktreeCreateCommand,
    merge: worktreeMergeCommand,
    list: worktreeListCommand
  },
  docs: {
    brief: "Manage git worktrees with project-specific bootstrap"
  }
});

// src/context.ts
import { homedir as homedir2 } from "os";
import { join as join14 } from "path";
function buildContext(proc) {
  const rulesDir = proc.env.JARRIN_RULES_DIR ?? join14(homedir2(), ".claude", "rules");
  const skillsDir = proc.env.JARRIN_SKILLS_DIR ?? join14(homedir2(), ".claude", "skills");
  return { process: proc, rulesDir, skillsDir };
}

// src/cli.ts
var VERSION = "0.1.0";
var routes = buildRouteMap({
  routes: {
    init: initCommand,
    info: infoCommand,
    install: installCommand,
    worktree: worktreeRoutes,
    start: startCommand,
    stop: stopCommand,
    "session-start": sessionStartCommand,
    "session-end": sessionEndCommand,
    statusline: statuslineCommand
  },
  docs: {
    brief: "Manage Jarrin's Claude Code config",
    fullDescription: "claudjar \u2014 set up a repo's .claude/.jarrin.yml, install the config into ~/.claude, and back the SessionStart rule-loading hook."
  }
});
var app = buildApplication(routes, {
  name: "claudjar",
  versionInfo: { currentVersion: VERSION },
  scanner: { caseStyle: "allow-kebab-for-camel" }
});
await run(app, process.argv.slice(2), buildContext(process));
/*! Bundled license information:

@stricli/core/dist/index.js:
  (* v8 ignore next -- @preserve *)
  (* v8 ignore if -- @preserve *)
  (* v8 ignore else -- @preserve *)
*/
