var Rpc = require('./rpc');

/**
 * Manages the registration of classes for consistent
 * serialization/unserialization
 * @class Registry
 * @constructor
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
     * Return a unique hash from a klass suitable for entering into the
     * registry arrays
     * @method hash
     * @return {Number} The XOR hash of the characters of
     * klass.prototype.constructor.name
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
     * Register a class with Wasabi, allowing it to transmit instances of
     * this class through a Connection
     * @method addClass
     * @param {Function} klass The constructor of the class to add
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
                // instance, we'll use the real method instead of the
                // replacement we create later in this function
                if(('wabiReal' + k) in klass.prototype) {
                    prop = klass.prototype['wabiReal' + k];
                } else {
                    klass.prototype['wabiReal' + k] = prop;
                }

                rpc = new Rpc(prop, klass, args);

                // TODO: use curry?
                (function(rpc) {
                    klass.prototype[k] = function(args, conns) {
                        this.wabiInstance._invokeRpc(rpc, args, this, conns);
                    };
                })(rpc)
                    
                klass.wabiRpcs[this.hash(prop)] = rpc;
            }
        }

        this.klassToHash[klass] = hash;
        this.hashToKlass[hash] = klass;
    }

    /**
     * Create an RPC from the supplied procedure function and serialize
     * function. `instance` must be a {{#crossLink "Wasabi"}}{{/crossLink}} instance
     * @method mkRpc
     * @param {Function} fn The local function to call when the RPC is invoked
     * on a remote host
     * @param {Function} serialize A serialize function describing the
     * arguments used by this RPC
     * @param {Wasabi} instance The Wasabi instance to register this RPC with
     * @return {Function} The function you should call remotely to invoke the
     * RPC on a connection
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

        return function(args, conns) { instance._invokeRpc(rpc, args || { }, false, conns); };
    }

    /**
     * Register an instance of a klass
     * @method addObject
     * @param {NetObject} obj The object to add to the registry
     * @param {Nunmber} serial The serial number to assign to this object. If
     * falsy, the nextSerialNumber will be used
     */
    , addObject: function(obj, serial) {
        obj.wabiSerialNumber = serial || this.nextSerialNumber;
        this.nextSerialNumber += 1;
        this.objects[obj.wabiSerialNumber] = obj;
    }

    /**
     * Get an instance of a klass by serial number
     * @method getObject
     */
    , getObject: function(serial) {
        return this.objects[serial];
    }

    /**
     * Get the function/constructor/klass represented by the given hash
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
