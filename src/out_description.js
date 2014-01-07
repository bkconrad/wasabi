var Types = require('./types.js');
/**
 * A class which unpacks an object when passed to its .serialize function
 * @class OutDescription
 * @constructor
 * @param {Bitstream} bs The Bitstream to send data trough
 * @param {Object} target The object to write values to
 * @param {Function} serialize Optional serialize function to use. If undefined,
 *     `obj.serialize` will be used.
 * @param {Wasabi} instance The Wasabi instance used for looking up objects when
 *     unpacking a reference to a managed object
 * @private
 */
var OutDescription = function (bs, target, serialize, instance) {
    this._bitStream = bs;
    this._target = target;
    this._serialize = serialize;
    this._instance = instance;
};

OutDescription.prototype = {
    array: function (name, type, arg1, arg2) {
        var typeFn;
        var arr = this._target[name] || [];
        var serialize;
        arg1 = arg1 || 16;

        type = typeof type === 'string' ? type : 'any';
        typeFn = this[type];

        serialize = function (desc) {
            var i;
            var len = desc._bitStream.readUInt(16);
            for (i = 0; i < len; i++) {
                // call the specified type method on each element, passing i
                // as the name, followed by optional arg1 and arg2
                typeFn.call(desc, i, arg1, arg2);
            }
        };

        this._bitStream.unpack(arr, serialize, this._instance);
        this._target[name] = arr;
    },

    bool: function (name) {
        this._target[name] = this._bitStream.readUInt(1) ? true : false;
    },

    uint: function (name, bits) {
        this._target[name] = this._bitStream.readUInt(bits);
    },

    sint: function (name, bits) {
        this._target[name] = this._bitStream.readSInt(bits);
    },

    float: function (name, bits) {
        this._target[name] = this._bitStream.readFloat(bits);
    },

    string: function (name) {
        this._target[name] = this._bitStream.readString();
    },

    object: function (name, serialize) {
        var obj = this._target[name] || {};

        // if no serialize method is passed, automatically decode the whole
        // object with _automagicSerialize
        if (typeof serialize !== 'function') {
            serialize = OutDescription._automagicSerialize;
        }

        // unpack the subobject through the bitstream and assign the result to
        // the target
        this._bitStream.unpack(obj, serialize, this._instance);
        this._target[name] = obj;
    },

    reference: function (name) {
        this._target[name] = this._instance.registry.getObject(this._bitStream.readUInt(16));
    },

    any: function (name, bits) {
        var type = this._bitStream.readUInt(Types.bitsNeeded);
        this[Types.fromValue[type]](name, bits);
    }
};


// ASCII character End Of Text (ETX)
// non-printable character which really shouldn't be used in the name of a key
var WSB_END_OF_OBJECT = 3;

// Decoding counterpart to InDescription._automagicSerialize
OutDescription._automagicSerialize = function (desc) {
    var k;
    // This will break if it encounters a key name starting with the ASCII
    // non-printable character ETX (value 3)
    while (desc._bitStream.peekUInt(8) !== WSB_END_OF_OBJECT) {
        k = desc._bitStream.readString();
        desc.any(k, 16);
    }

    // burn off the ETX character
    desc._bitStream.readUInt(8);
};

module.exports = OutDescription;