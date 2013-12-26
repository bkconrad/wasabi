var Types = require('./types.js');
var WasabiError = require('./wasabi_error.js');

/**
 * A class which packs an object when passed to its .serialize function
 * @class InDescription
 * @constructor
 */
var InDescription = function () {
    this._target = null;
    this._bitStream = null;
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

    any: function (name, bits) {
        var type;
        var val = this._target[name];
        if (typeof val === 'string') {
            type = 'string';
        } else if (val | 0 === val) {
            type = 'sint';
        } else if (+val === val) {
            type = 'float';
        } else {
            throw new WasabiError('Can not serialize unsupported value ' + val.toString());
        }

        // Write the type specifier to the bitstream
        this._bitStream.writeUInt(Types.fromString[type], 16);
        // Invoke the appropriate function for the detected type
        this[type](name, bits);
    }
};

module.exports = InDescription;