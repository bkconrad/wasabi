var InDescription = require('./in_description');
var OutDescription = require('./out_description');

/**
 * Manages the packing/unpacking of values as a set number of bits
 * @class Bitstream
 * @constructor
 * @param {Array} buffer an array of 7-bit integers representing the intial
 * data for this Bitstream
 */
function Bitstream(buffer) {
    this.arr = [];
    this._nbits = 0;
    this._index = 0;
    if (buffer) {
        this.fromArrayBuffer(buffer);
    }
}

Bitstream.prototype = {
    constructor: Bitstream
    /**
     * @method bitsLeft
     * @return {Number} the number of bits which can be read without causing an overread
     */
    , bitsLeft: function() {
        return this._nbits - this._index;
    }

    /**
     * Empty the buffer and reset the index
     * @method empty
     */
    , empty: function() {
        this.arr = [];
        this._index = 0;
        this._nbits = 0;
    }

    /**
     * Move the index to the first index >= the current index which is
     * the beginning of a cell. Useful for burning off any padding when
     * processing data from "appendData" since it pads to the nearest
     * multiple of 7
     * @method align
     */
    , align: function() {
        var delta = this._index % 7;
        if (delta == 0) {
            return;
        }
        this._advance(7 - delta);
    }

    /**
     * Set the `n` bits starting at `offset` to contain the unsigned integer `value`.
     * @method _setBits
     * @param {Number} offset The zero-based bit offset to start at
     * @param {Number} n The number of bits to pack the value in to
     * @param {Number} value The value to pack. Will be cast to an
     * unsigned integer and truncated or padded to n bits
     */
    , _setBits: function(offset, n, value) {
        var bits
        , cell
        , cellOffset
        , mask
        , nbits;
        cell = Math.floor(offset / 7);
        cellOffset = offset % 7;

        while (n > 0) {
            // determine how many bits will fit into the current cell
            nbits = Math.min(n, 7 - cellOffset);

            // make an all-set bitmask with length of nbits
            mask = (1 << nbits) - 1;

            // get the next nbits bits from the value
            bits = value & mask;

            // move the bits and mask to the correct cell offset
            bits <<= cellOffset;
            mask <<= cellOffset;

            // set the cells bits
            this.arr[cell] = (this.arr[cell] & (~mask)) | bits;

            // prepare for next iteration
            value >>= nbits;
            n -= nbits;
            cellOffset = 0;
            cell++;
        }
    }

    /**
     * Return the value of the first n bits starting at offset
     * @method _getBits
     * @param {Number} offset The zero-based bit offset to start at
     * @param {Number} n The number of bits to unpack the value from
     * @return {Number} The unsigned value after unpacking
     */
    , _getBits: function(offset, n) {
        var bits
        , cell
        , cellOffset
        , mask
        , nbits
        , value
        , valueOffset;
        cell = Math.floor(offset / 7);
        cellOffset = offset % 7;
        value = 0;
        valueOffset = 0;

        while (n > 0) {
            // determine how many bits can be retrieved from this cell
            nbits = Math.min(n, 7 - cellOffset);

            // make an all-set bitmask with length of nbits
            mask = (1 << nbits) - 1;

            mask <<= cellOffset;
            bits = this.arr[cell] & mask;
            bits >>= cellOffset;

            value |= bits << valueOffset;

            // prepare for next iteration
            n -= nbits;
            cellOffset = 0;
            cell++;
            valueOffset += nbits;
        }
        return value;
    }

    
    , toArrayBuffer: function() {
        // TODO: handle CELLSIZE > 8
        var buf = new ArrayBuffer(this.arr.length);
        var arr = new Uint8Array(buf);
        var i;

        for (i = 0; i < this.arr.length; i++) {
            arr[i] = this.arr[i];
        }
        return arr;
    }

    , fromArrayBuffer: function(buffer) {
        this.empty();
        this.appendData(buffer);
    }

    , appendData: function(buffer) {
        var i;
        for (i = 0; i < buffer.length; i++) {
            this.arr.push(buffer[i]);
        }
        // TODO: figure out why this is seven
        this._extend(i * 7);
    }

    , appendChars: function(chars) {
        var data = [];
        var i;
        for (i = 0; i < chars.length; i++) {
            data.push(chars.charCodeAt(i));
        }

        this.appendData(data);
    }

    /**
     * Convert the data to a valid UTF-8 string
     * @method toChars
     */
    , toChars: function() {
        var i
        , result = "";
        for (i = 0; i < this.arr.length; i++) {
            result += String.fromCharCode(this.arr[i]);
        }
        return result;
    }

    /**
     * Read an unsigned integer *without* consuming any bits
     * @method peekUInt
     * @param {Number} bits The number of bits to unpack
     */
    , peekUInt: function(bits) {
        var result = this._getBits(this._index, bits);
        return result;
    }

    /**
     * Read an unsigned integer consuming the specified number of bits
     * @method readUInt
     * @param {Number} bits The number of bits to unpack
     */
    , readUInt: function(bits) {
        var result = this.peekUInt(bits);
        this._advance(bits);
        return result;
    }

    /**
     * Write an unsigned integer using the specified number of bits
     * @method writeUInt
     * @param {Number} value Value to write.
     * @param {Number} bits The number of bits to unpack
     */
    , writeUInt: function(value, bits) {
        this._setBits(this._index, bits, value);
        this._extend(bits);
    }

    /**
     * read a signed integer without consuming any bits
     * @method peekSInt
     * @param {Number} bits The number of bits to unpack
     */
    , peekSInt: function(bits) {
        var result = this._getBits(this._index, bits - 1);
        result *= this._getBits(this._index + bits - 1, 1) ? -1 : 1;
        return result;
    }

    /**
     * read a signed integer consuming the specified number of bits
     * @method readSInt
     * @param {Number} bits The number of bits to unpack
     */
    , readSInt: function(bits) {
        var result = this.peekSInt(bits);
        this._advance(bits);
        return result;
    }

    /**
     * write a signed integer using the specified number of bits
     * @method writeSInt
     * @param {Number} value Value to write. Will be truncated or padded
     * to the specified number of bits
     * @param {Number} bits The number of bits to unpack
     */
    , writeSInt: function(value, bits) {
        this._setBits(this._index, bits - 1, Math.abs(value));
        this._extend(bits - 1);
        this._setBits(this._index, 1, value < 0);
        this._extend(1);
    }

    , peekFloat: function(bits) {
        // We unpack the signed integer representation divided by the
        // maximum value a number with this number of bits can hold. By
        // definition the result is in the range [0.0, 1.0]
        var result = this._getBits(this._index, bits - 1) / (Math.pow(2, bits - 1) - 1);
        // Then the sign bit
        result *= this._getBits(this._index + bits - 1, 1) ? -1 : 1;
        return result;
    }

    /**
     * Read a float value, consuming the specified number of bits
     * @method readFloat
     * @param {Number} bits The number of bits to unpack
     */
    , readFloat: function(bits) {
        var result = this.peekFloat(bits);
        this._advance(bits);
        return result;
    }

    /**
     * Write a normalized float in the range `[0.0, 1.0]` using the specified number of bits
     * @method writeFloat
     * @param {Number} value Value to write.
     * @param {Number} bits The number of bits to unpack
     */
    , writeFloat: function(value, bits) {
        var absValue = Math.abs(value);
        // The absolute normalized value * the maximum value of this bitlength
        this._setBits(this._index, bits - 1, absValue * (Math.pow(2, bits - 1) - 1));
        this._extend(bits - 1);
        // Then the sign bit
        this._setBits(this._index, 1, (value < 0));
        this._extend(1);
    }

    /**
     * Pack an object with a .serialize() method into this bitstream
     * @method pack
     * @param {NetObject} obj The object to serialize
     */
    , pack: function(obj) {
        var description = new InDescription;
        description._bitStream = this;
        description._target = obj;

        this._serializeObject(obj, description);
    }

    /**
     * Unpack an object with a .serialize() method from this bitstream
     * @method unpack
     * @param {NetObject} obj The object to deserialize to
     */
    , unpack: function(obj) {
        var description = new OutDescription;
        description._bitStream = this;
        description._target = obj;

        this._serializeObject(obj, description);

        return description._target;
    }

    , _serializeObject: function(obj, description) {
        // We'll walk the prototype chain looking for .serialize methods,
        // and call them in order from child-most to parent-most
        // (arguably backwards, but it's easier to code)
        var proto = obj.constructor ? obj.constructor.prototype : false;
        var serialize = obj.serialize;
        while(serialize && (typeof serialize === 'function')) {
            serialize.call(obj, description);
            proto = proto ? proto.prototype : false;
            serialize = proto ? proto.serialize : false;
        }
    }

    /**
     * See if the contents and byte length of the buffer of this Bitstream
     * and `other` are exactly  equal
     * @method equals
     * @param {Bitstream} other The bitstream to compare with
     * @return {Boolean} `true` if the bistreams are effectively equal
     */
    , equals: function(other) {
        var i;
        if (other.arr.length !== this.arr.length) {
            return false;
        }

        for (i = 0; i < this.arr.length; i++) {
            if (this.arr[i] !== other.arr[i]) {
                return false;
            }
        }
        return true;
    }

    /**
     * Advance the head by the specified number of bits and check for
     * overread
     * @method _advance
     * @param {Number} bits The number of bits to advance the index by
     */
    , _advance: function(bits) {
        this._index += bits;
        if(this._index > this._nbits) {
            throw new Error("Bitstream overread");
        }
    }

    /**
     * Extend the buffer size by the specified number of bits. Also
     * advances the index
     * @method _extend
     * @param {Number} bits The number of bits to expand the buffer by
     */
    , _extend: function(bits) {
        this._nbits += bits;
        this._index += bits;
    }
};

/**
 * Create a bitstream from a valid UTF-8 string
 * @static
 * @method fromChars
 */
Bitstream.fromChars = function(str) {
    var chars = [];
    var i;
    for (i = 0; i < str.length; i++) {
        chars.push(str.charCodeAt(i));
    }
    var bm = new Bitstream(chars);
    return bm;
};

module.exports = Bitstream;
