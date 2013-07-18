var Rpc = require('./rpc');

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

        // build the rpc registry for this klass
        klass.wabiRpcs = { };
        for (k in klass.prototype) {
            var prop = klass.prototype[k];
            // search for a function property starting with "rpc" and not
            // ending with "Args"
            if (typeof prop === "function" &&
                k.indexOf("rpc") === 0 &&
                k.indexOf("Args") !== k.length - 4
            ) {
                // find the Args function (for rpcFoo this would be
                // rpcFooArgs)
                var args = klass.prototype[k + "Args"];
                if (typeof args !== "function") {
                    throw "No matching args function \"" + k + "Args\" found for RPC \"" + k + "\"";
                }

                // if this class was already added to a different Wasabi
                // instance, use the real method instead of the 
                if(('wabiReal' + k) in klass.prototype) {
                    prop = klass.prototype['wabiReal' + k];
                } else {
                    klass.prototype[k] = function(args) {
                        this.wabiInstance._invokeRpc(rpc, args, this);
                    };
                    
                    klass.prototype['wabiReal' + k] = prop;
                }

                var rpc = new Rpc(prop, klass, args);
                klass.wabiRpcs[this.hash(prop)] = rpc;
            }
        }

        this.klassToHash[klass] = hash;
        this.hashToKlass[hash] = klass;
    }
    /**
     * create an RPC from the supplied procedure function and serialize
     * function. `instance` must be a Wasabi instance
     * @method mkRpc
     */
    , mkRpc: function(fn, serialize, instance) {
        var hash = this.hash(fn);
        serialize = serialize || function() { };
        if (hash in this.hashToRpc) {
            throw new Error("Invalid attempt to redefine RPC " + fn.name + " with hash " + hash);
        }

        var rpc = new Rpc(fn, undefined, serialize);

        // normal hash <-> rpc mapping
        this.rpcToHash[rpc] = hash;
        this.hashToRpc[hash] = rpc;

        return function(args) { instance._invokeRpc(rpc, args || { }); };
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
