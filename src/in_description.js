var Types = require('./types.js');

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

    any: function(name, bits) {
        var type;
        var val = this._target[name];
        if(val | 0 === val) {
            type = 'sint';
        } else if (val + 0 === val) {
            type = 'float';
        }

        // Write the type specifier to the bitstream
        this._bitStream.writeUInt(Types.fromString[type], 16);
        // Invoke the appropriate function for the detected type
        this[type](name, bits);
    }
};

module.exports = InDescription;
