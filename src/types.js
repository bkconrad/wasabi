var iota = 0xFFFF;

/**
 * An enum of types that are serializable by Wasabi
 * @module Types
 */
var fromString = {
    sint: --iota,
    uint: --iota,
    float: --iota,
    string: --iota
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
    fromValue: fromValue
};

module.exports = Types;