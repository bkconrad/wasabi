var Types = require('./types.js');
/**
 * A class which unpacks an object when passed to its .serialize function
 * @class OutDescription
 * @constructor
 */
var OutDescription = function () {
    this._target = null;
    this._bitStream = null;
};

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

    any: function (name, bits) {
        var type = this._bitStream.readUInt(Types.bitsNeeded);
        this[Types.fromValue[type]](name, bits);
    }
};

module.exports = OutDescription;