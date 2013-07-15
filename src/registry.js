/**
 * Manages the registration of classes for consistent
 * serialization/unserialization
 * @class Registry
 */
function Registry() {
    // hash <-> klass
    this.klassToHash = {};
    this.hashToKlass = {};

    // hash <-> RPC
    this.rpcToHash = {};
    this.hashToRpc = {};

    // objects by serial number
    this.objects = {};
    this.nextSerialNumber = 1;
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
        if (this.hashToKlass[hash] !== undefined) {
            throw "Invalid attempt to redefine class " + klass.name + " with hash " + hash;
        }
        this.klassToHash[klass] = hash;
        this.hashToKlass[hash] = klass;
    }
    /**
     * register a global RPC
     * @method addRpc
     */
    , addRpc: function(rpc, serialize) {
        var hash = this.hash(rpc);
        if (this.hashToRpc[hash] !== undefined) {
            throw "Invalid attempt to redefine RPC " + rpc.name + " with hash " + hash;
        }
        // the function used to serialize the arguments object
        rpc.argSerialize = serialize;
        // normal hash <-> rpc mapping
        this.rpcToHash[rpc] = hash;
        this.hashToRpc[hash] = rpc;
    }
    /**
     * register an instance of a klass
     * @method addObject
     */
    , addObject: function(obj, serial) {
        obj.wabiSerialNumber = serial || this.nextSerialNumber;
        this.nextSerialNumber += 1;
        this.objects[obj.wabiSerialNumber] = obj;
    }
    /**
     * get an instance of a klass by serial number
     * @method getObject
     */
    , getObject: function(serial) {
        return this.objects[serial];
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
