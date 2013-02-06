/*
 * Copyright (c) 2013 Bryan Conrad
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

var InDescription = require('./in_description');
var OutDescription = require('./out_description');
var Base128 = require('base128');

function dumpBits (n) {
	var res = "";
	n >>>= 0;
	var mask = Math.pow(2, 31);
	for (var i = 0; i < 32; i++) {
		res += (n & mask) ? '1' : '0';
		mask >>>= 1;
		if ((i + 1) % 8 == 0)
			res += ' ';
	}
	return res;
}

/**
 * @brief A class for packing/unpacking values as a set number of bits
 */
function Bitstream (buffer) {
  this.arr = [];
  this.length = 0;
  this._index = 0;
  if (buffer) {
	  this.fromArrayBuffer(buffer);
  }
}

Bitstream.prototype = {
    constructor: Bitstream
  , getBits: function (offset, n) {
	  var cell, cellOffset, lowMask, lowBits, highMask, highBits, finalMask, result;
	  var cell = Math.floor(offset / 32);
	  var cellOffset = offset % 32;

	  highMask = 4294967295 << cellOffset;
	  highBits = highMask & this.arr[cell];
	  highBits >>>= cellOffset;

	  if (cellOffset > 0) {
		  lowMask = 4294967295 >>> (32 - cellOffset);
		  lowBits = lowMask & this.arr[cell + 1];
		  lowBits <<= (32 - cellOffset);
	  }

	  finalMask = (1 << n + 1 >>> 1) - 1;
	  result = (highBits | lowBits) & finalMask; 

	  console.log();
	  console.log('mask: ' + dumpBits(highMask) + ' - ' + dumpBits(lowMask));
	  console.log('cell: ' + dumpBits(this.arr[cell]) + ' - ' + dumpBits(this.arr[cell + 1]));
	  console.log('bits: ' + dumpBits(highBits) + ' - ' + dumpBits(lowBits));
	  console.log('fmsk: ' + dumpBits(finalMask));
	  console.log('res:  ' + dumpBits(result));
	  return result;
  }
  , toArrayBuffer: function () {
	  var buf = new ArrayBuffer(this.length / 8);
	  var arr = new Uint8Array(buf);

	  var offset = 0;
	  for (var i = 0; i < arr.length; i++) {
		  arr[i] = this.getBits(offset, 7);
		  offset += 7;
	  }
	return arr;
  }

  , fromArrayBuffer: function (buffer) {
	  this.arr = [];
	  this.length = Math.ceil(buffer.byteLength / 4);
	  var myIndex = 0;
	  for (var i = 0; i < buffer.byteLength; i++) {
		  myIndex = Math.floor(i / 4);
		  this.arr[myIndex] =
			  this.arr[myIndex] |
			  (buffer[i] << 8 * (i % 4));
	  }
  }

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
      return (this.arr [Math.floor (i / 32)] & 1 << i % 32) > 0;
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

    /**
     * @brief read an unsigned integer consuming the specified number of bits
     */
  , readUInt: function (bits) {
	  var result = 0;
	  var i;
	  for (i = 0; i < bits; i++) {
		  result |= this.get(this._index) << i;
		  this._index += 1;
	  }

	  return result;
    }

    /**
     * @brief write an unsigned integer using the specified number of bits
     */
  , writeUInt: function (value, bits) {
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

    /**
     * @brief pack an object with a .serialize() method into this bitstream
     */
    , pack: function (obj) {
	    var description = new InDescription;
	    description._bitStream = this;
	    description._target = obj;
	    obj.serialize(description);
    }

    /**
     * @brief unpack an object with a .serialize() method from this bitstream
     */
    , unpack: function (obj) {
	    var description = new OutDescription;
	    description._bitStream = this;
	    description._target = {};
	    obj.serialize(description);
	    return description._target;
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
