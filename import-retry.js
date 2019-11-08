
var cdns = ["//ke.qq.com/user/"];

var originalCDNPrefix = __webpack_public_path__;
var originalLoadChunk = __webpack_chunk_load__;

__webpack_chunk_load__ = function(id) {
  var n = cdns.length;
  var exec = function() {
    var args = [].slice.call(arguments);
    var fn = args[0];

    if (typeof fn === 'function') {
      fn.call(this, args.slice(1));
    }
  };
  return (function tryCdn() {
    if (n === 0) {
      return originalLoadChunk(id).catch(function(e) {
        if (cdns.length !== 0) {
          exec(__chunkRetryLoadFail__, id);
        }
        return Promise.reject(e);
      });
    }

    return originalLoadChunk(id).catch(function() {
      __webpack_public_path__ = cdns[--n];

      exec(__chunkRetryLoad__, id);
      if (cdns.length === n + 1) {
        return tryCdn().then(function(m) {
          exec(__chunkRetryLoadSucc__, id);
          return m;
        });
      }

      return tryCdn();
    });
  }()).finally(function() {
    __webpack_public_path__ = originalCDNPrefix;
  });
};
  