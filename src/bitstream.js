/**
 * @brief A class for packing/unpacking values as a set number of bits
 */
function Bitstream (vals) {
  this.arr = [];
  this.length = 0;
  this._index = 0;
  if (vals) {
    for (var i = vals.length - 1; i >= 0; --i) {
      if (vals [i]) {
        this.set (i);
      }
      else {
        this.clear (i);
      }
    }
  }
}

Bitstream.prototype = {
    constructor: Bitstream

  , toString: function () {
      vals = [];
      for (var i = this.length - 1; i >= 0; --i) {
        vals [i] = this.get (i) ? "1" : "0";
      }
      return vals.join ("");
    }

  , clear: function (i) {
      if (i >= this.length) {
        this.length = i + 1;
      }
      var pos = i / 32 | 0;
      this.arr [pos] = this.arr [pos] & ~(1 << i % 32);
    }

  , get: function (i) {
      return (this.arr [Math.floor (i / 32 | 0)] & 1 << i % 32) > 0;
    }

  , serialize: function () {
      var str = "";
      for (var i = 0; i < this.arr.length; ++i) {
        var num = this.arr [i];
        str += num < 0
          ? (-num).toString (36) + Bitstream.NEGATIVE_DELIM
          : num.toString (36) + Bitstream.POSITIVE_DELIM
          ;
      }
      var trailingLength = this.length % 32;
      if (trailingLength == 0) {
        trailingLength = 32;
      }
      if (this.length == 0) {
        trailingLength = 0;
      }
      return str + trailingLength.toString (36);
    }

  , set: function (i) {
      if (i >= this.length) {
        this.length = i + 1;
      }
      var pos = i / 32 | 0;
      this.arr [pos] = this.arr [pos] | 1 << i % 32;
    }

  , size: function () {
      return this.length;
    }

  , readInt: function (bits) {
	  var result = 0;
	  var i;
	  for (i = 0; i < bits; i++) {
		  result |= this.get(this._index) << i;
		  this._index += 1;
	  }

	  return result;
    }

  , writeInt: function (value, bits) {
	  var mask = 1;
	  var i;
	  for (i = 0; i < bits; i++) {
		  if (value & mask) {
			  this.set(this._index);
		  } else {
			  this.clear(this._index);
		  }
		  this._index += 1;
		  mask <<= 1;
	  }
    }
};

Bitstream.POSITIVE_DELIM = ".";
Bitstream.NEGATIVE_DELIM = "!"

Bitstream.deserialize = (function () {
  var MATCH_REGEX = new RegExp (
      "[A-Za-z0-9]+(?:"
      + Bitstream.POSITIVE_DELIM
      + "|"
      + Bitstream.NEGATIVE_DELIM
      + ")?"
    , "g");
  return function (str) {
    var bm = new Bitstream ();
    var arr = str.match (MATCH_REGEX);
    var trailingLength = parseInt (arr.pop (), 36);
    for (var i = 0; i < arr.length; ++i) {
      var str = arr [i];
      var sign = str.charAt (str.length - 1) == Bitstream.POSITIVE_DELIM ? 1 : -1;
      bm.arr [i] = parseInt (str, 36) * sign;
    }
    bm.length = Math.max ((arr.length - 1) * 32 + trailingLength, 0);
    return bm;
  };
}) ();

module.exports = Bitstream;
