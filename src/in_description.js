var Types = require('./types.js');
var WasabiError = require('./wasabi_error.js');

/**
 * A class which packs an object when passed to its .serialize function
 * @class InDescription
 * @constructor
 * @param {Bitstream} bs The Bitstream to send data trough
 * @param {Object} target The object to read values from
 * @param {Function} serialize Optional serialize function to use. If undefined,
 *     `obj.serialize` will be used.
 * @private
 */
var InDescription = function (bs, target, serialize) {
    this._bitStream = bs;
    this._target = target;
    this._serialize = serialize;

    // hash of objects found while encoding the current object
    this._discoveredObjects = {};
};

InDescription.prototype = {
    /**
     * Describe a simple boolean value (`true` or `false)
     * @param {String} name The name of the attribute
     * @method bool
     */
    bool: function (name) {
        this._bitStream.writeUInt(this._target[name], 1);
    },

    /**
     * Describe an unsigned integer
     * @param {String} name The name of the attribute
     * @param {Number} bits The number of bits to use when encoding
     * @method uint
     */
    uint: function (name, bits) {
        this._bitStream.writeUInt(this._target[name], bits);
    },

    /**
     * Describe a signed integer
     * @param {String} name The name of the attribute
     * @param {Number} bits The number of bits to use when encoding, including
     *     the sign bit
     * @method sint
     */
    sint: function (name, bits) {
        this._bitStream.writeSInt(this._target[name], bits);
    },

    /**
     * Describe a normalized float on the range [-1.0, 1.0].
     *
     * **Values will be clamped to this range**.
     *
     * @param {String} name The name of the attribute
     * @param {Number} bits The number of bits to use when encoding, including
     *     the sign bit
     * @method float
     */
    float: function (name, bits) {
        this._bitStream.writeFloat(this._target[name], bits);
    },

    /**
     * Describe a string of 8-bit characters
     *
     * String length is limited only by memory and bandwidth, but MUST NOT
     * contain a null character (0x00).
     *
     * @param {String} name The name of the attribute
     * @method string
     */
    string: function (name) {
        this._bitStream.writeString(this._target[name]);
    },

    /**
     * Describes an entire subobject using an optional `serialize` function.
     *
     *     ObjectEncodingTestClass.prototype.serialize = function (desc) {
     *
     *         // a property named 'structuredObj' with explicit structure
     *         // using a supplied serialize function
     *         desc.object('structuredObj', function (desc1) {
     *             desc1.uint('uintfoo', 8);
     *             desc1.sint('sintfoo', 8);
     *
     *             // note that you can declare nested structures
     *             desc1.object('subobject', function (desc2) {
     *                 desc2.uint('uintbar', 8);
     *                 desc2.sint('sintbar', 8);
     *             });
     *         });
     *
     *         // if no serialize function is supplied, Wasabi will recursively
     *         // descend into the object and encode it using InDescription#any
     *         desc.object('unstructuredObj');
     *
     *     };
     *
     * **Note:** Encoding an object with cyclical references is not supported,
     * and will currently cause Wasabi to recurse infinitely
     *
     * @param {String} name The name of the attribute
     * @param {Function} serialize Optional serialize function to use
     * @method object
     */
    object: function (name, serialize) {
        var obj = this._target[name] || {};

        // if no serialize method is passed, automatically encode the whole
        // object with _automagicSerialize
        if (typeof serialize !== 'function') {
            serialize = InDescription._automagicSerialize;
        }

        // pack the subobject through the bitstream, and put any discovered
        // managed objects in this._discoveredObjects
        this._bitStream.pack(obj, serialize, this._discoveredObjects);
    },

    /**
     * Describes a reference to an object managed by Wasabi.
     *
     * **Note:** unlike `object`, `reference` *does* support cyclical references
     *
     * @param {String} name The name of the attribute
     * @method object
     */
    reference: function (name) {
        // Just write the serial number
        var serial = this._target[name].wsbSerialNumber;
        this._bitStream.writeUInt(serial, 16);
        this._discoveredObjects[serial] = this._target[name];
    },

    /**
     * Describe a property of unknown type
     *
     * Wasabi will deduce and encode the variable's type, if it is supported,
     * throwing an error if it is of an unsupported type (null, undefined,
     * Array, and Function, at present)
     *
     * **Note:** Data encoded with this method takes up 3 more bits than data
     * encoded with an explicit type, and requires more CPU on the server for
     * type deduction.
     *
     * @param {String} name The name of the attribute
     * @param {Number} bits The number of bits used to encode the data (if
     *     applicable)
     * @method any
     */
    any: function (name, bits) {
        var type;
        var val = this._target[name];
        if (typeof val === 'string') {
            type = 'string';
        } else if (val | 0 === val) {
            type = 'sint';
        } else if (+val === val) {
            type = 'float';
        } else if (val instanceof Object && val.wsbSerialNumber) {
            type = 'reference';
        } else if (!(val instanceof Array)) {
            type = 'object';
        } else {
            throw new WasabiError('Can not serialize unsupported value ' + val.toString());
        }

        // Write the type specifier to the bitstream
        this._bitStream.writeUInt(Types.fromString[type], Types.bitsNeeded);
        // Invoke the appropriate function for the detected type
        this[type](name, bits);
    }
};

// ASCII character End Of Text (ETX)
// non-printable character which really shouldn't be used in the name of a key
var WSB_END_OF_OBJECT = 3;

/**
 * Default serialize function used when InDescription#object receives no
 * serialize function as an argument.
 *
 * Recursively traverses and encodes the entire object, possibly resulting in
 * infinite recursion (be careful!).
 */
InDescription._automagicSerialize = function (desc) {
    var k;
    for (k in this) {
        if (this.hasOwnProperty(k)) {
            desc._bitStream.writeString(k);
            desc.any(k, 16);
        }
    }

    // Write a non-printable ETX character to signal the end of the
    // object's properties
    desc._bitStream.writeUInt(WSB_END_OF_OBJECT, 8);
};


module.exports = InDescription;