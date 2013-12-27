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
     * Return a unique hash from one or two functions suitable for entering into
     * the registry's klass or rpc tables
     * @method hash
     * @param {Function} fn1 The first function to hash
     * @param {Function} fn2 The second function to hash
     * @return {Number} The XOR hash of the characters of
     * klass.prototype.constructor.name
     */
    hash: function (fn1, fn2) {
        var result = 0;
        var name = fn1.name;
        var i;

        if (fn2) {
            name += '.' + fn2.name;
        }

        for (i = 0; i < name.length; i++) {
            result ^= name.charCodeAt(i);
        }

        return result;
    },

    /**
     * Register a class with Wasabi, allowing it to transmit instances of
     * this class through a Connection
     * @method addClass
     * @param {Function} klass The constructor of the class to add
     * @param {Wasabi} instance The Wasabi instance to invoke the RPC through
     */
    addClass: function (klass, instance) {
        var k;
        var fn;
        var keyOfRealFunction;
        var hash = this.hash(klass);
        var args;

        if (!klass.name.length) {
            throw new WasabiError('Attempt to add anonymous class. Give it a name with "function NAME () { ... }"');
        }

        if (this.hashToKlass[hash] !== undefined) {
            throw new WasabiError('Invalid attempt to redefine class ' + klass.name + ' with hash ' + hash);
        }

        // register this class's RPCs
        for (k in klass.prototype) {
            // search for a function property starting with "rpc" and not
            // ending with "Args"
            if (typeof klass.prototype[k] === 'function' && k.indexOf('rpc') === 0 && k.indexOf('Args') !== k.length - 4) {
                fn = klass.prototype[k];

                // find the Args function (for rpcFoo this would be
                // rpcFooArgs)
                args = klass.prototype[k + 'Args'];

                // if this class was already added to a different Wasabi
                // instance, we'll use the real method instead of the
                // replacement we create later in this function
                keyOfRealFunction = 'wabiReal' + k;
                if (klass.prototype[keyOfRealFunction] !== undefined) {
                    fn = klass.prototype[keyOfRealFunction];
                } else {
                    klass.prototype[keyOfRealFunction] = fn;
                }

                klass.prototype[k] = this.mkRpc(klass, fn, args, instance);
            }
        }

        this.klassToHash[klass] = hash;
        this.hashToKlass[hash] = klass;
    },

    /**
     * Create an RPC from the supplied procedure function and serialize
     * function. `instance` must be a {{#crossLink "Wasabi"}}{{/crossLink}}
     * instance
     * @method mkRpc
     * @param {Function} klass The klass this rpc is associated with, or `false`
     *     for static RPCs
     * @param {Function} fn The local function to call when the RPC is invoked
     *     on a remote host
     * @param {Function} serialize A serialize function describing the arguments
     *     used by this RPC
     * @param {Wasabi} instance The Wasabi instance to invoke this RPC through
     * @return {Function} The function you should call remotely to invoke the
     *     RPC on a connection
     */
    mkRpc: function (klass, fn, serialize, instance) {
        var hash = this.hash(klass, fn);
        var rpc;

        if (!fn.name.length) {
            throw new WasabiError('Attempt to add anonymous RPC. Give it a name with "function NAME () { ... }"');
        }

        if (this.hashToRpc[hash] !== undefined) {
            throw new WasabiError('Invalid attempt to redefine RPC ' + (klass ? klass.name + '#' : '') + fn.name + ' with hash ' + hash);
        }

        rpc = new Rpc(fn, klass, serialize);

        // normal hash <-> rpc mapping
        this.rpcToHash[rpc] = hash;
        this.hashToRpc[hash] = rpc;

        // if klass is truthy, then this is a non-static RPC, and `this`
        // will refer to the object which the RPC is invoked on locally.
        // if klass is false, then the second _invokeRpc parameter will be false
        return function () {
            var args = Array.prototype.slice.call(arguments);
            if (klass) {
                this.wabiInstance._invokeRpc(rpc, this, args);
            } else {
                instance._invokeRpc(rpc, false, args);
            }
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