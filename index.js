const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WEBPACK_CONFIG_PATH = process.cwd();

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

function getJSContent(cdns, hooks) {
  return `
var cdns = ${JSON.stringify(cdns)};

var originalCDNPrefix = __webpack_public_path__;
var originalLoadChunk = __webpack_chunk_load__;

__webpack_chunk_load__ = function(id) {
  var n = cdns.length;
  var exec = function() {
    var args = [].slice.call(arguments);
    var fn = args[0];

    if (typeof fn === 'function') {
      try {
        fn.call(this, args.slice(1));
      } catch(e) {}
    }
  };
  return (function tryCdn() {
    if (n === 0) {
      return originalLoadChunk(id).then(function(m) {
        __webpack_public_path__ = originalCDNPrefix;
        return m;
      }).catch(function(e) {
        if (cdns.length !== 0) {
          exec(${hooks.chunkRetryLoadFail}, id);
        }
        __webpack_public_path__ = originalCDNPrefix;
        return Promise.reject(e);
      });
    }

    return originalLoadChunk(id).catch(function() {
      __webpack_public_path__ = cdns[--n];

      exec(${hooks.chunkRetryLoad}, id);
      if (cdns.length === n + 1) {
        return tryCdn().then(function(m) {
          exec(${hooks.chunkRetryLoadSucc}, id);
          return m;
        });
      }

      return tryCdn();
    });
  }());
};
  `;
}

const defaultHooks = {
  chunkRetryLoad: 'window.__chunkRetryLoad__',
  chunkRetryLoadSucc: 'window.__chunkRetryLoadSucc__',
  chunkRetryLoadFail: 'window.__chunkRetryLoadFail__',
};

module.exports = class DynamicImportRetryPlugin {
  constructor(options) {
    const { cdns, includes, excludes, hooks } = options;
    if (!cdns || !cdns.length) {
      throw new Error('Invalid retry hosts');
    }
    const hash = crypto.createHash('md5');

    hash.update(JSON.stringify(cdns));

    this.cdns = cdns;
    this.md5 = hash.digest('hex');
    this.pattern = { includes, excludes };
    this.hooks = Object.assign({}, defaultHooks, hooks);

    this.jsPath = path.resolve(__dirname, `./import-retry.${this.md5}.js`);
    this.webpackJsPath = `./${path.relative(WEBPACK_CONFIG_PATH, this.jsPath)}`;
    fs.writeFileSync(this.jsPath, getJSContent(this.cdns, this.hooks));
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

        entry[k] = [this.webpackJsPath].concat(v);
      });
    }
  }
};
