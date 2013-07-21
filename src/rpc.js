/**
 * A POD class representing an RPC definition
 * @class Rpc
 * @constructor
 */
function Rpc(fn, klass, serialize) {
    this._fn = fn;
    this._klass = klass;
    this._serialize = serialize;
}

module.exports = Rpc;
