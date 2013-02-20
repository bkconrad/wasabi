/**
 * Manages the registration of classes for consistent
 * serialization/unserialization
 * @class Registry
 */
function Registry() {
    this.klassToHash = {};
    this.hashToKlass = {};
    this.rpcToHash = {};
    this.hashToRpc = {};
}

Registry.prototype = {
    constructor: Registry
    /**
     * return a unique hash from a klass suitable for entering into the
     * registry arrays
     * @method hash
     */
    , hash: function(klass) {
        var result = 0, name = klass.prototype.constructor.name;
        for (var i = 0; i < name.length; i++) {
            // TODO: just how unique is this hash?
            result ^= name.charCodeAt(i);
        }
        return result;
    }
    /**
     * register a klass
     * @method addClass
     */
    , addClass: function(klass) {
        var hash = this.hash(klass);
        this.klassToHash[klass] = hash;
        this.hashToKlass[hash] = klass;
    }
    /**
     * register a global RPC
     * @method addRpc
     */
    , addRpc: function(rpc) {
        var hash = this.hash(rpc);
        this.rpcToHash[rpc] = hash;
        this.hashToRpc[hash] = rpc;
    }
    /**
     * get the function/constructor/klass represented by the given hash
     * @method getClass
     */
    , getClass: function(hash) {
        return this.hashToKlass[hash];
    }
    /**
     * get the RPC function associated with the hash
     * @method getRpc
     */
    , getRpc: function(hash) {
        return this.hashToRpc[hash];
    }
}

module.exports = Registry;
