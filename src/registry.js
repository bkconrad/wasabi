/**
 * Manages the registration of classes for consistent
 * serialization/unserialization
 * @class Registry
 */
function Registry() {
    this.klasses = {};
}

Registry.prototype = {
    constructor: Registry
    /**
     * return a unique hash from a klass suitable for entering into the
     * registry arrays
     * @method hash
     */
    , hash: function(klass) {
        return klass.prototype.constructor.toString();
    }
    /**
     * register a klass
     * @method register
     */
    , register: function(klass) {
        this.klasses[klass] = this.hash(klass);
    }
    /**
     * get the function/constructor/klass represented by the given hash
     * @method lookup
     */
    , lookup: function(hash) {
        for (var k in this.klasses) {
            if (this.klasses.hasOwnProperty(k)) {
                if (this.klasses[k] == hash) {
                    return this.klasses[k];
                }
            }
        }
    }
}

module.exports = Registry;
