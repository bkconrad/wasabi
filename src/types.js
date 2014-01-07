/**
 * An enum of types that are serializable by Wasabi
 * @class Types
 */
var iota = 0;
var fromString = {
    array: iota++,
    bool: iota++,
    float: iota++,
    object: iota++,
    reference: iota++,
    sint: iota++,
    string: iota++,
    uint: iota++
};

var fromValue = {};
var k;
for (k in fromString) {
    if (fromString.hasOwnProperty(k)) {
        fromValue[fromString[k]] = k;
    }
}

var Types = {
    fromString: fromString,
    fromValue: fromValue,
    // bits needed to encode the type data
    // ceiling of log base 2 of the number of types
    bitsNeeded: Math.ceil(Math.log(iota) / Math.log(2))
};

module.exports = Types;