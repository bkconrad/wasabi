var Types = require('./types.js');
/**
 * A class which unpacks an object when passed to its .serialize function
 * @class OutDescription
 * @constructor
 * @param {Bitstream} bs The Bitstream to send data trough
 * @param {Object} target The object to write values to
 * @param {Function} serialize Optional serialize function to use. If undefined,
 *     `obj.serialize` will be used.
 * @private
 */
var OutDescription = function (bs, target, serialize) {
    this._bitStream = bs;
    this._target = target;
    this._serialize = serialize;
};

// ASCII character End Of Text (ETX)
// non-printable character which really shouldn't be used in the name of a key
var WSB_END_OF_OBJECT = 3;

OutDescription.prototype = {
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
        if (typeof serialize !== 'function') {

            // if no serialize method is passed, automatically encode the whole
            // object with InDescription#any
            serialize = function (desc) {
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
        }

        // unpack the subobject through the bitstream and assign the result to
        // the target
        this._bitStream.unpack(obj, serialize);
        this._target[name] = obj;
    },

    any: function (name, bits) {
        var type = this._bitStream.readUInt(Types.bitsNeeded);
        this[Types.fromValue[type]](name, bits);
    }
};

module.exports = OutDescription;