var iota = 0xFFFF;

/**
 * An enum of types that are serializable by Wasabi
 * @module Types
 */
var fromString = {
	sint: --iota,
	uint: --iota, 
	float: --iota
};

var fromValue = { };
for(var k in fromString) {
	if(fromString.hasOwnProperty(k)) {
		fromValue[fromString[k]] = k;
	}
}

var Types = {
	fromString: fromString,
	fromValue: fromValue
}

module.exports = Types;