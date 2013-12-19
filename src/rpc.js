/**
 * @class Rpc
 * @constructor
 */

function Rpc(fn, klass, serialize) {
    this._fn = fn;
    this._klass = klass;
    this._serialize = serialize || Rpc._makeDefaultSerialize(fn.length);

    // Many thanks to http://mattsnider.com/parsing-javascript-function-argument-names/
	var funStr = fn.toString();
    this._args = funStr.slice(funStr.indexOf('(') + 1, funStr.indexOf(')')).match(/([^\s,]+)/g) || [];
}

/**
 * Populate `obj` with keys corresponding to the names of the argument in the
 * nth position of the original function and values from the indexed values in
 * `obj`
 * @method _populateKeys
 * @private
 * @param {Object} obj The target object containing indexed values
 */
Rpc.prototype._populateKeys = function(obj) {
	for(var i = 0; i < obj.length; i++) {
		obj[this._args[i]] = obj[i];
	}
}

/**
 * Populate `obj` with keys corresponding to the names of the argument in the
 * nth position of the original function and values from the indexed values in
 * `obj`
 * @method _populateIndexes
 * @private
 * @param {Object} obj The target object containing indexed values
 */
Rpc.prototype._populateIndexes = function(obj) {
	for(var i = 0; i < this._args.length; i++) {
		if(obj[i] === undefined) {
			obj[i] = obj[this._args[i]];
		}
	}
}

/**
 * Creates a default serialization function for an RPC definition when no args
 * function is supplied. The resultant function simply calls `desc.any(i, 16)`
 * the appropriate number of times. This means that by default, RPC arguments
 * have 16 bit precision.
 * @method _makeDefaultSerialize
 * @static
 * @param {Number} nargs The number of arguments to serialize
 * @return The serialize function
 */
Rpc._makeDefaultSerialize = function(nargs) {
	return function _defaultSerialize(desc) {
		for(var i = 0; i < nargs; i++) {
			desc.any(i, 16);
		}
	};
}

module.exports = Rpc;
