var Rpc = require('./rpc');
var WasabiError = require('./wasabi_error');

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
    constructor: Registry,

    /**
     * Return a unique hash from a klass suitable for entering into the
     * registry's klass table
     * @method hash
     * @return {Number} The XOR hash of the characters of
     * klass.prototype.constructor.name
     */
    hash: function (klass) {
        var result = 0;
        var name = klass.prototype.constructor.name;
        var i;

        for (i = 0; i < name.length; i++) {
            // TODO: just how unique is this hash?
            result ^= name.charCodeAt(i);
        }

        return result;
    },

    /**
     * Register a class with Wasabi, allowing it to transmit instances of
     * this class through a Connection
     * @method addClass
     * @param {Function} klass The constructor of the class to add
     */
    addClass: function (klass) {
        var k;
        var prop;
        var propNameReal;
        var hash = this.hash(klass);
        var rpc;
        var args;
        if (this.hashToKlass[hash] !== undefined) {
            throw 'Invalid attempt to redefine class ' + klass.name + ' with hash ' + hash;
        }

        // build the rpc registry for this klass
        klass.wabiRpcs = {};
        for (k in klass.prototype) {
            // search for a function property starting with "rpc" and not
            // ending with "Args"
            if (typeof klass.prototype[k] === 'function' && k.indexOf('rpc') === 0 && k.indexOf('Args') !== k.length - 4) {
                prop = klass.prototype[k];
                // find the Args function (for rpcFoo this would be
                // rpcFooArgs)
                args = klass.prototype[k + 'Args'];

                // if this class was already added to a different Wasabi
                // instance, we'll use the real method instead of the
                // replacement we create later in this function
                propNameReal = 'wabiReal' + k;
                if (klass.prototype[propNameReal] !== undefined) {
                    prop = klass.prototype[propNameReal];
                } else {
                    klass.prototype[propNameReal] = prop;
                }

                rpc = new Rpc(prop, klass, args);

                klass.prototype[k] = this._mkRpcInvocationStub(rpc);
                klass.wabiRpcs[this.hash(prop)] = rpc;
            }
        }

        this.klassToHash[klass] = hash;
        this.hashToKlass[hash] = klass;
    },

    _mkRpcInvocationStub: function (rpc) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            this.wabiInstance._invokeRpc(rpc, this, args);
        };
    },

    /**
     * Create an RPC from the supplied procedure function and serialize
     * function. `instance` must be a {{#crossLink "Wasabi"}}{{/crossLink}}
     * instance
     * @method mkRpc
     * @param {Function} fn The local function to call when the RPC is invoked
     *     on a remote host
     * @param {Function} serialize A serialize function describing the arguments
     *     used by this RPC
     * @param {Wasabi} instance The Wasabi instance to register this RPC with
     * @return {Function} The function you should call remotely to invoke the
     *     RPC on a connection
     */
    mkRpc: function (fn, serialize, instance) {
        var hash = this.hash(fn);
        var rpc;
        serialize = serialize || function () {};
        if (this.hashToRpc[hash] !== undefined) {
            throw new WasabiError('Invalid attempt to redefine RPC ' + fn.name + ' with hash ' + hash);
        }

        rpc = new Rpc(fn, undefined, serialize);

        // normal hash <-> rpc mapping
        this.rpcToHash[rpc] = hash;
        this.hashToRpc[hash] = rpc;

        return function () {
            var args = Array.prototype.slice.call(arguments);
            instance._invokeRpc(rpc, false, args);
        };
    },

    /**
     * Register an instance of a klass
     * @method addObject
     * @param {NetObject} obj The object to add to the registry
     * @param {Nunmber} serial The serial number to assign to this object. If
     *     falsy, the nextSerialNumber will be used
     */
    addObject: function (obj, serial) {
        obj.wabiSerialNumber = serial || this.nextSerialNumber;
        this.nextSerialNumber += 1;
        this.objects[obj.wabiSerialNumber] = obj;
    },

    removeObject: function (arg) {
        var k;
        if (typeof arg === 'number') {
            delete this.objects[arg];
        } else {
            for (k in this.objects) {
                if (this.objects.hasOwnProperty(k) && this.objects[k] === arg) {
                    delete this.objects[k];
                    return;
                }
            }
        }
    },

    /**
     * Get an instance of a klass by serial number
     * @method getObject
     */
    getObject: function (serial) {
        return this.objects[serial];
    },

    /**
     * Get the function/constructor/klass represented by the given hash
     * @method getClass
     */
    getClass: function (hash) {
        return this.hashToKlass[hash];
    },

    /**
     * get the RPC function associated with the hash
     * @method getRpc
     */
    getRpc: function (hash) {
        return this.hashToRpc[hash];
    }
};

module.exports = Registry;
