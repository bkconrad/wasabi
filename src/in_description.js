/**
 * A class which packs an object when passed to its .serialize function
 * @class InDescription
 * @constructor
 */
var InDescription = function () {
	this._target = undefined;
	this._bitStream = undefined;
};

InDescription.prototype = {
    uint: function(name, bits) {
        this._bitStream.writeUInt(this._target[name], 16);
    }

    , sint: function(name, bits) {
        this._bitStream.writeSInt(this._target[name], 16);
    }
}

module.exports = InDescription;
