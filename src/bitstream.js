var InDescription = require('./in_description');
var OutDescription = require('./out_description');

/**
 * Manages the packing/unpacking of values as a set number of bits
 * @class Bitstream
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
     * set n bits starting at offset to value
     * @method setBits
     */
    , empty: function() {
        this.arr = [];
        this._index = 0;
        this._nbits = 0;
    }
    /**
     * move the index to the first index >= the current index which is
     * the beginning of a cell.  useful for burning off any padding when
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
    , setBits: function(offset, n, value) {
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
     * return the value of the first n bits starting at offset
     * @method getBits
     */
    , getBits: function(offset, n) {
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

    ,
    toArrayBuffer: function() {
        // TODO: handle CELLSIZE > 8
        var buf = new ArrayBuffer(this.arr.length);
        var arr = new Uint8Array(buf);
        var i;

        for (i = 0; i < this.arr.length; i++) {
            arr[i] = this.arr[i];
        }
        return arr;
    }

    ,
    fromArrayBuffer: function(buffer) {
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
     * read an unsigned integer consuming the specified number of bits
     * @method readUInt
     */
    , readUInt: function(bits) {
        var result = this.getBits(this._index, bits);
        this._advance(bits);
        return result;
    }

    /**
     * read an unsigned integer *without* consuming any bits
     * @method peekUInt
     */
    , peekUInt: function(bits) {
        var result = this.getBits(this._index, bits);
        return result;
    }

    /**
     * write an unsigned integer using the specified number of bits
     * @method writeUInt
     */
    , writeUInt: function(value, bits) {
        this.setBits(this._index, bits, value);
        this._extend(bits);
    }

    /**
     * read a signed integer consuming the specified number of bits
     * @method readSInt
     */
    , readSInt: function(bits) {
        var result = this.getBits(this._index, bits);
        this._advance(bits);
        result *= this.getBits(this._index, 1) ? -1 : 1;
        this._advance(1);
        return result;
    }

    /**
     * write a signed integer using the specified number of bits
     * @method writeSInt
     */
    , writeSInt: function(value, bits) {
        this.setBits(this._index, bits, Math.abs(value));
        this._extend(bits);
        this.setBits(this._index, 1, value < 0);
        this._extend(1);
    }

    /**
     * pack an object with a .serialize() method into this bitstream
     * @method pack
     */
    , pack: function(obj) {
        var description = new InDescription;
        description._bitStream = this;
        description._target = obj;
        obj.serialize(description);
    }

    /**
     * unpack an object with a .serialize() method from this bitstream
     * @method unpack
     */
    , unpack: function(obj) {
        var description = new OutDescription;
        description._bitStream = this;
        description._target = obj;
        obj.serialize(description);
        return description._target;
    }

    /**
     * advance the head by the specified number of bits and check for overread
     * @method _advance
     */
    , _advance: function(bits) {
        this._index += bits;
        if(this._index > this._nbits) {
            throw new Error("Bitstream overread");
        }
    }

    /**
     * extend the buffer size by the specified number of bits
     * @method _extend
     */
    , _extend: function(bits) {
        this._nbits += bits;
        this._index += bits;
    }

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
