var InDescription = require('./in_description');
var OutDescription = require('./out_description');

/*global Uint8Array, ArrayBuffer*/

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
    constructor: Bitstream,

    /**
     * @method getPos
     * @return {Number} The zero-based index of the bit which will be read or
     *     written next.
     */
    getPos: function () {
        return this._index;
    },

    /**
     * @method setPos
     * @param {Number|undefined} pos The zero-based index of the bit to read or
     *     write next. When undefined, moves to the end of the current data
     */
    setPos: function (pos) {
        if (pos === undefined) {
            pos = this._nbits;
        }

        this._index = pos;
    },

    /**
     * @method bitsLeft
     * @return {Number} the number of bits which can be read without causing an
     *     overread
     */
    bitsLeft: function () {
        return this._nbits - this._index;
    },

    /**
     * Empty the buffer and reset the index
     * @method empty
     */
    empty: function () {
        this.arr = [];
        this._index = 0;
        this._nbits = 0;
    },

    /**
     * Move the _index to the first position >= the current index which is the
     * beginning of a cell. Used to burn off padding when processing data from
     * "appendData" since it pads to the nearest multiple of CELLSIZE
     * @method align
     */
    align: function () {
        var delta = this._index % 7;
        if (delta === 0) {
            return;
        }
        this._advance(7 - delta);
    },

    /**
     * Calculate a 32-bit hash of a set of bits
     *
     * @param {Number} start The index to begin hashing at
     * @param {Number|undefined} n The number of bits to hash. If undefined,
     *     hash until the end of the stream.
     * @method hashBits
     */
    hashBits: function (start, n) {
        var result = 0;
        var sample;
        var sampleSize;
        if (n === undefined) {
            n = this._nbits - start;
        }

        while (n > 0) {
            sampleSize = Math.min(32, n);
            sample = this._getBits(start, sampleSize);

            // save the lowest bit, and wrap it around to the front, and shift
            // all other bits down by 1, filling with zeros from the left
            result = ((result & 1) << 31) + (result >>> 1);

            // then XOR the current character into the hash
            result ^= sample;

            start += sampleSize;
            n -= sampleSize;
        }

        return result;
    },

    /**
     * Rollback the boundary of the bitstream. Note that the rolled-back cell
     * data is not cleared, rather the boundary is rolled back to the specified
     * position, ready to overwrite the old data. To discard excess data before
     * transmission, you must call `.trim`.
     *
     * If the current index is beyond the new (rolled back) boundary, it is
     * moved to boundary, ready to begin writing at the new end of the
     * bitstream.
     *
     * @param {Number} pos The index to roll back to
     * @method rollback
     */
    rollback: function (pos) {
        this._nbits = pos;
        this._index = Math.min(this._index, this._nbits);
    },

    /**
     * Discards all data after boundary of the bitstream. Used to trim leftover
     * data after `rollback`.
     *
     * @method trim
     */
    trim: function () {
        var cell = Math.ceil(this._nbits / 7);
        this.arr.splice(cell, this.arr.length - cell);
    },

    /**
     * Set the `n` bits starting at `offset` to contain the unsigned integer
     * `value`
     * @method _setBits
     * @private
     * @param {Number} offset The zero-based bit offset to start at
     * @param {Number} n The number of bits to pack the value in to
     * @param {Number} value The value to pack. Will be cast to an unsigned
     *     integer and truncated or padded to n bits
     */
    _setBits: function (offset, n, value) {
        var bits;
        var cell;
        var cellOffset;
        var mask;
        var nbits;
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
    },

    /**
     * Return the value of the first n bits starting at offset
     * @private
     * @method _getBits
     * @param {Number} offset The zero-based bit offset to start at
     * @param {Number} n The number of bits to unpack the value from
     * @return {Number} The unsigned value after unpacking
     */
    _getBits: function (offset, n) {
        var bits;
        var cell;
        var cellOffset;
        var mask;
        var nbits;
        var value;
        var valueOffset;
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
    },

    /**
     * Convert the data in this `Bitstream` to a `Uint8Array` containing an
     * `ArrayBuffer` suitable for transmitting this data over a binary websocket
     * @method toArrayBuffer
     * @return A `Uint8Array` containing the data in this Bitstream
     */
    toArrayBuffer: function () {
        var buf = new ArrayBuffer(this.arr.length);
        var arr = new Uint8Array(buf);
        var i;

        for (i = 0; i < this.arr.length; i++) {
            arr[i] = this.arr[i];
        }
        return arr;
    },

    /**
     * Populate the data in this Bitstream from an ArrayBuffer received over a
     * binary websocket
     * @method fromArrayBuffer
     */
    fromArrayBuffer: function (buffer) {
        this.empty();
        this.appendData(buffer);
    },

    /**
     * Append data from another bitstream.
     *
     * The current bitstream's contents will be padded to the nearest cell
     * boundary, then the other bitstream's contents will be appended, and the
     * final contents will again be padded to the nearest boundary.
     *
     * @method append
     * @param {Bitstream} bs The bitstream to read from
     */
    append: function (bs) {

        // pad the contents to the end of the current cell
        this.arr = this.arr.concat(bs.arr);
        this._nbits = this.arr.length * 7;
        this._index = this._nbits;
    },

    /**
     * Append data from an ArrayBuffer received over a binary websocket to this
     * Bitstream
     * @method appendData
     */
    appendData: function (buffer) {
        var i;
        for (i = 0; i < buffer.length; i++) {
            this.arr.push(buffer[i]);
        }
        this._extend(i * 7);
    },

    /**
     * Append UTF-8 encoded data from a string to this Bitstream
     * @method appendChars
     */
    appendChars: function (chars) {
        var data = [];
        var i;
        for (i = 0; i < chars.length; i++) {
            data.push(chars.charCodeAt(i));
        }

        this.appendData(data);
    },

    /**
     * Convert the data to a valid UTF-8 string
     * @method toChars
     */
    toChars: function () {
        var i;
        var result = '';
        for (i = 0; i < this.arr.length; i++) {
            result += String.fromCharCode(this.arr[i]);
        }
        return result;
    },

    /**
     * Read an unsigned integer *without* consuming any bits
     * @method peekUInt
     * @param {Number} bits The number of bits to unpack
     */
    peekUInt: function (bits) {
        var result = this._getBits(this._index, bits);
        return result;
    },

    /**
     * Read an unsigned integer consuming the specified number of bits
     * @method readUInt
     * @param {Number} bits The number of bits to unpack
     */
    readUInt: function (bits) {
        var result = this.peekUInt(bits);
        this._advance(bits);
        return result;
    },

    /**
     * Write an unsigned integer using the specified number of bits
     * @method writeUInt
     * @param {Number} value Value to write.
     * @param {Number} bits The number of bits to unpack
     */
    writeUInt: function (value, bits) {
        this._setBits(this._index, bits, value);
        this._extend(bits);
    },

    /**
     * Read a signed integer without consuming any bits
     * @method peekSInt
     * @param {Number} bits The number of bits to peek at
     */
    peekSInt: function (bits) {
        var result = this._getBits(this._index, bits - 1);
        result *= this._getBits(this._index + bits - 1, 1) ? -1 : 1;
        return result;
    },

    /**
     * Read a signed integer consuming the specified number of bits
     * @method readSInt
     * @param {Number} bits The number of bits to unpack
     */
    readSInt: function (bits) {
        var result = this.peekSInt(bits);
        this._advance(bits);
        return result;
    },

    /**
     * write a signed integer using the specified number of bits
     * @method writeSInt
     * @param {Number} value Value to write. Will be truncated or padded
     * to the specified number of bits
     * @param {Number} bits The number of bits to unpack
     */
    writeSInt: function (value, bits) {
        this._setBits(this._index, bits - 1, Math.abs(value));
        this._extend(bits - 1);
        this._setBits(this._index, 1, value < 0);
        this._extend(1);
    },

    /**
     * Read a normalized float without consuming any bits
     * @method peekFloat
     * @param {Number} bits The number of bits to peek at
     */
    peekFloat: function (bits) {
        // We unpack the signed integer representation divided by the
        // maximum value a number with this number of bits can hold. By
        // definition the result is in the range [0.0, 1.0]
        var result = this._getBits(this._index, bits - 1) / (Math.pow(2, bits - 1) - 1);
        // Then the sign bit
        result *= this._getBits(this._index + bits - 1, 1) ? -1 : 1;
        return result;
    },

    /**
     * Read a float value, consuming the specified number of bits
     * @method readFloat
     * @param {Number} bits The number of bits to unpack
     */
    readFloat: function (bits) {
        var result = this.peekFloat(bits);
        this._advance(bits);
        return result;
    },

    /**
     * Write a normalized float in the range `[-1.0, 1.0]` using the specified
     * number of bits
     * @method writeFloat
     * @param {Number} value Value to write.
     * @param {Number} bits The number of bits to unpack
     */
    writeFloat: function (value, bits) {
        var absValue = Math.abs(value);
        // The absolute normalized value * the maximum value of this bitlength
        this._setBits(this._index, bits - 1, absValue * (Math.pow(2, bits - 1) - 1));
        this._extend(bits - 1);
        // Then the sign bit
        this._setBits(this._index, 1, (value < 0));
        this._extend(1);
    },

    /**
     * Read a zero-terminated string value
     * @method readString
     * @return the String read from the bitstream
     */
    readString: function () {
        var chars = [];
        var c = this.readUInt(8);
        while (c !== 0) {
            chars.push(c);
            c = this.readUInt(8);
        }

        return String.fromCharCode.apply(false, chars);
    },

    /**
     * Write a zero-terminated string
     * number of bits
     * @method writeString
     * @param {String} value Value to write.
     */
    writeString: function (value) {
        var i;
        for (i = 0; i < value.length; i++) {
            this.writeUInt(value.charCodeAt(i), 8);
        }
        this.writeUInt(0, 8);
    },

    /**
     * Pack an object with a `.serialize()` method into this bitstream
     * @method pack
     * @param {NetObject} obj The object to serialize
     * @param {Function} fn Optional serialize function to use. If undefined,
     *     `obj.serialize` will be used.
     * @param {Object} discoveredObjects Optional hash of discovered objects to
     *     update.
     */
    pack: function (obj, serialize, discoveredObjects) {
        var description = new InDescription(this, obj, serialize);
        description._discoveredObjects = discoveredObjects || description._discoveredObjects;
        this._serialize(description);
    },

    /**
     * Unpack an object with a .serialize() method from this bitstream
     * @method unpack
     * @param {NetObject} obj The object to deserialize to
     * @param {Function} fn Optional serialize function to use. If undefined,
     *     `obj.serialize` will be used.
     * @param {Wasabi} instance The Wasabi instance used for looking up objects
     *     when unpacking a reference to a managed object
     */
    unpack: function (obj, serialize, instance) {
        var description = new OutDescription(this, obj, serialize, instance);
        this._serialize(description);

        return obj;
    },

    /**
     * Calls all serialize methods in this object's prototype chain with
     * `description` as its argument. This allows packing and unpacking classes
     * which use prototypal inheritance.
     * @method _serialize
     * @param {Description} desc The description to serialize
     * @private
     */
    _serialize: function (desc) {
        // We'll walk the prototype chain looking for .serialize methods,
        // and call them in order from child-most to parent-most
        var proto = Object.getPrototypeOf(desc._target);
        var serialize = desc._serialize || desc._target.serialize;
        while (serialize && (typeof serialize === 'function')) {

            // pass desc to the given serialize function
            serialize.call(desc._target, desc);

            // if a description has an explicit serialize function, don't climb
            // the prototype chain
            if (desc._serialize) {
                break;
            }

            // look for the next serialize method up the chain
            proto = Object.getPrototypeOf(proto);
            serialize = proto ? proto.serialize : false;
        }
    },

    /**
     * See if the contents and byte length of the buffer of this Bitstream
     * and `other` are exactly equal
     * @method equals
     * @param {Bitstream} other The bitstream to compare with
     * @return {Boolean} `true` if the bistreams are effectively equal
     */
    equals: function (other) {
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
    },

    /**
     * Advance the head by the specified number of bits and check for overread
     * @method _advance
     * @private
     * @param {Number} bits The number of bits to advance the index by
     */
    _advance: function (bits) {
        this._index += bits;
        if (this._index > this._nbits) {
            throw new Error('Bitstream overread');
        }
    },

    /**
     * Extend the buffer size by the specified number of bits. Also
     * advances the index
     * @method _extend
     * @private
     * @param {Number} bits The number of bits to expand the buffer by
     */
    _extend: function (bits) {
        this._nbits += bits;
        this._index += bits;
    }
};

/**
 * Create a bitstream from a valid UTF-8 string
 * @static
 * @method fromChars
 */
Bitstream.fromChars = function (str) {
    var chars = [];
    var i;
    var bs;
    for (i = 0; i < str.length; i++) {
        chars.push(str.charCodeAt(i));
    }
    bs = new Bitstream(chars);
    return bs;
};

module.exports = Bitstream;