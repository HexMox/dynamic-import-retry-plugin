const fs = require('fs');
const path = require('path');

const JS_PATH = path.resolve(__dirname, './import-retry.js');
const WEBPACK_CONFIG_PATH = process.cwd();
const WEBPACK_JS_PATH = `./${path.relative(WEBPACK_CONFIG_PATH, JS_PATH)}`;

function isProduction(compilerOptions) {
  return compilerOptions.mode === 'production' || process.env.NODE_ENV === 'production';
}

function objectifyEntry(entry) {
  if (typeof entry === 'string') {
    entry = { entry };
  } else if (Array.isArray(entry)) {
    entry = entry.map(objectifyEntry);
  }

  return entry;
}

function getJSContent(cdns) {
  return `
var cdns = ${JSON.stringify(cdns)};

var originalCDNPrefix = __webpack_public_path__;
var originalLoadChunk = __webpack_chunk_load__;

__webpack_chunk_load__ = function(id) {
  var n = cdns.length;
  return (function tryCdn() {
    if (n === 0) {
      return originalLoadChunk(id);
    }

    return originalLoadChunk(id).catch(function() {
      __webpack_public_path__ = cdns[--n];
      return tryCdn();
    });
  }()).finally(function() {
    __webpack_public_path__ = originalCDNPrefix;
  });
};
  `;
}

module.exports = class DynamicImportRetryPlugin {
  constructor(options) {
    const { cdns, includes, excludes } = options;

    this.cdns = cdns;
    this.pattern = { includes, excludes };
    fs.writeFileSync(JS_PATH, getJSContent(this.cdns));
  }

  apply(compiler) {
    const { options: compilerOptions } = compiler;

    // 注意要在 web-webpack-plugin 之后apply
    if (isProduction(compilerOptions)) {
      const entry = objectifyEntry(compilerOptions.entry);

      Object.entries(entry).forEach(([k, v]) => {
        if (!Array.isArray(v)) {
          v = [v];
        }

        entry[k] = [WEBPACK_JS_PATH].concat(v);
      });
    }
  }
};
