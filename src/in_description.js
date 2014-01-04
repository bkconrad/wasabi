var Types = require('./types.js');
var WasabiError = require('./wasabi_error.js');

// ASCII character End Of Text (ETX)
// non-printable character which really shouldn't be used in the name of a key
var WSB_END_OF_OBJECT = 3;

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
};

InDescription.prototype = {
    uint: function (name, bits) {
        this._bitStream.writeUInt(this._target[name], bits);
    },

    sint: function (name, bits) {
        this._bitStream.writeSInt(this._target[name], bits);
    },

    float: function (name, bits) {
        this._bitStream.writeFloat(this._target[name], bits);
    },

    string: function (name) {
        this._bitStream.writeString(this._target[name]);
    },

    object: function (name, serialize) {
        var obj = this._target[name] || {};

        // if no serialize method is passed, automatically encode the whole
        // object with InDescription#any
        if (typeof serialize !== 'function') {
            serialize = function (desc) {
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
        }

        // pack the subobject through the bitstream
        this._bitStream.pack(obj, serialize);
    },

    any: function (name, bits) {
        var type;
        var val = this._target[name];
        if (typeof val === 'string') {
            type = 'string';
        } else if (val | 0 === val) {
            type = 'sint';
        } else if (+val === val) {
            type = 'float';
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

module.exports = InDescription;