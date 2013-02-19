/**
 * @brief A class which unpacks an object when passed to its .serialize function
 */
var OutDescription = function () {
    this._target = undefined;
    this._bitStream = undefined;
};

OutDescription.prototype = {
    uint: function(name, bits) {
        this._target[name] = this._bitStream.readUInt(16);
    }
    , sint: function(name, bits) {
        this._target[name] = this._bitStream.readSInt(16);
    }
}

module.exports = OutDescription;
