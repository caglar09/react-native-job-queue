"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var _exportNames = {};
exports.default = void 0;
var _Queue = require("./Queue");
Object.keys(_Queue).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _Queue[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _Queue[key];
    }
  });
});
var _Job = require("./models/Job");
Object.keys(_Job).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _Job[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _Job[key];
    }
  });
});
var _JobStore = require("./models/JobStore");
Object.keys(_JobStore).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _JobStore[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _JobStore[key];
    }
  });
});
var _Worker = require("./Worker");
Object.keys(_Worker).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _Worker[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _Worker[key];
    }
  });
});
var _useQueue = require("./hooks/useQueue");
Object.keys(_useQueue).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _useQueue[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _useQueue[key];
    }
  });
});
var _default = exports.default = _Queue.Queue.instance;
//# sourceMappingURL=index.js.map