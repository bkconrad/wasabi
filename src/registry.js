/**
 * Manages the registration of classes for consistent
 * serialization/unserialization
 * @class Registry
 */
function Registry() {
    this.klassToHash = {};
    this.hashToKlass = {};
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
     * @method register
     */
    , register: function(klass) {
        var hash = this.hash(klass);
        this.klassToHash[klass] = hash;
        this.hashToKlass[hash] = klass;
    }
    /**
     * get the function/constructor/klass represented by the given hash
     * @method lookup
     */
    , lookup: function(hash) {
        return this.hashToKlass[hash];
    }
}

module.exports = Registry;
