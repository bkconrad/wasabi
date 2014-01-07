var Bitstream = require('../src/bitstream'),
    assert = require('chai').assert,
    WebSocket = require('ws');


describe('Bitstream', function () {
    it('can tell if there is more data to read', function () {
        var b = new Bitstream();
        b.writeUInt(0, 16);
        b._index = 0;
        assert.equal(16, b.bitsLeft());

        b.readUInt(8);
        assert.equal(8, b.bitsLeft());

        b.readUInt(8);
        assert.equal(0, b.bitsLeft());
    });

    it('sets n bits at a time', function () {
        var b = new Bitstream();
        b._setBits(0, 7, 127);
        assert.equal(b.arr[0], 127);
    });

    it('correctly overflows large values', function () {
        var b = new Bitstream();
        b._setBits(0, 8, 129);
        assert.equal(b.arr[0], 1);
        assert.equal(b.arr[1], 1);
    });

    it('gets n bits at a time', function () {
        var b = new Bitstream();
        b._setBits(0, 16, 1337);
        assert.equal(b._getBits(0, 16), 1337);
    });

    it('calculates hashes of bits', function () {
        var bs = new Bitstream();
        bs.writeUInt(1234, 16);
        bs.writeUInt(1234, 16);
        bs.writeUInt(4321, 16);

        // the first two hashes should be equal
        assert.equal(bs.hashBits(0, 16), bs.hashBits(16, 16));

        // the last two hashes should not
        assert.notEqual(bs.hashBits(16, 16), bs.hashBits(32, 16));
    });

    it('reads/writes unsigned integers', function () {
        var b = new Bitstream();
        var VALUE = 1337;
        b.writeUInt(VALUE, 16);
        assert.equal(b._index, 16);

        b._index = 0;

        assert.equal(b.peekUInt(16), VALUE);
        assert.equal(b._index, 0);

        assert.equal(b.readUInt(16), VALUE);
    });

    it('reads/writes signed integers', function () {
        var b = new Bitstream();
        var negValue = -1337;
        var posValue = 123;
        b.writeSInt(negValue, 16);
        b.writeSInt(posValue, 8);

        assert.equal(b._index, 24);
        b._index = 0;

        assert.equal(b.readSInt(16), negValue);
        assert.equal(b.readSInt(8), posValue);
    });

    it('reads/writes float values', function () {
        var b = new Bitstream();
        var vals = [0.25, 0.0, -1.0, 1.0, 0.5, 0.3333, -0.618];
        var i;

        for (i = 0; i < vals.length; i++) {
            b.writeFloat(vals[i], 8);
        }
        assert.equal(b._index, 8 * vals.length);

        b._index = 0;

        for (i = 0; b.bitsLeft(); i++) {
            assert.closeTo(b.readFloat(8), vals[i], 0.01);
        }
    });

    it('complains on overread', function () {
        var b = new Bitstream();
        b.writeUInt(1337, 16);
        b._index = 0;
        b.readUInt(16);
        assert.throws(function () {
            b.readUInt(1);
        });
    });

    it('encodes its value as an ArrayBuffer', function () {
        var b = new Bitstream();
        b.writeUInt(1337, 16);
        b.writeUInt(1, 2);
        b.writeUInt(127, 7);

        var b2 = new Bitstream(b.toArrayBuffer());
        b2._index = 0;

        assert.equal(1337, b2.readUInt(16));
        assert.equal(1, b2.readUInt(2));
        assert.equal(127, b2.readUInt(7));
    });

    it('should pack/unpack objects with .serialize methods', function () {
        var k;
        var bs = new Bitstream();
        var resultObj;
        var testObj = {
            foo: 1337,
            bar: 7331,
            baz: -123,
            serialize: function (desc) {
                desc.uint('foo', 16);
                desc.uint('bar', 16);
                desc.sint('baz', 7);
            }
        };
        bs.pack(testObj);

        bs._index = 0;
        resultObj = bs.unpack(testObj);
        for (k in testObj) {
            if (testObj.hasOwnProperty(k)) {
                assert.equal(testObj[k], resultObj[k]);
            }
        }
    });

    it('appends bits from character data', function () {
        var b1 = new Bitstream();
        var b2 = new Bitstream();
        b1.writeUInt(1337, 16);
        b1.writeUInt(4321, 16);
        b2.appendChars(b1.toChars());

        b2._index = 0;

        assert.equal(1337, b2.readUInt(16));
        assert.equal(4321, b2.readUInt(16));
    });

    it('appends bits directly from another bitstream', function () {
        var b1 = new Bitstream();
        var b2 = new Bitstream();
        b1.writeUInt(1337, 16);
        b1.writeUInt(4321, 16);

        b2.writeUInt(1234, 16);
        b2.append(b1);

        b2._index = 0;

        assert.equal(1234, b2.readUInt(16));

        // append will pad the existing data to a cell boundary, so we must align
        // in order to keep reading
        b2.align();
        assert.equal(1337, b2.readUInt(16));
        assert.equal(4321, b2.readUInt(16));

        // append will also pad the appended data to a cell boundary, so align
        // should bring us to the very end of the stream
        b2.align();
        assert.equal(0, b2.bitsLeft());
    });

    it('can be aligned to the next buffer byte', function () {
        var b1 = new Bitstream();
        var start;
        // this should actually be UTF-8 encoded binary, but whatever
        // 4 characters == 28 bits of binary data
        b1.appendChars("test");
        b1._index = 0;

        // read seven bits, this should land us squarely on the next
        // cell. A call to .align() should not move the head
        b1.readUInt(7);
        start = b1._index;
        b1.align();
        assert.equal(start, b1._index);

        // reading one bit further should make the next call advance the index to the next cell
        b1.readUInt(1);
        b1.align();
        assert.equal(start + 7, b1._index);

        // having consumed 14 bits, consuming the remaining 14 should not through an error
        b1.readUInt(14);

        assert.equal(b1._index, b1._nbits);
    });

    it('checks for equivalence with another', function () {
        var b1 = new Bitstream();
        var b2 = new Bitstream();
        b1.writeUInt(1337, 16);
        b1.writeUInt(4321, 16);
        b2.writeUInt(1337, 16);
        b2.writeUInt(4321, 16);

        assert.ok(b1.equals(b2));

        b1.writeUInt(1234, 16);
        assert.ok(!b1.equals(b2));

        b2.writeUInt(4321, 16);
        assert.ok(!b1.equals(b2));
    });

    it('gets and sets the index position', function () {
        var bs = new Bitstream();
        assert.equal(bs.getPos(), 0);

        bs.writeUInt(1, 16);
        assert.equal(bs.getPos(), 16);

        // will be overwritten
        bs.writeUInt(0xFFFF, 16);
        assert.equal(bs.getPos(), 32);

        bs.setPos(16);
        bs.writeUInt(0, 16);

        // now read back the contents
        bs.setPos(0);
        assert.equal(bs.readUInt(16), 1);
        assert.equal(bs.readUInt(16), 0);

        // set the position back to the start, then to the end
        bs.setPos(0);
        bs.setPos();
        assert.equal(bs.bitsLeft(), 0);
    });

    it('writes and reads objects to websockets', function (done) {
        function TestObject() {
            this.dummy = 1;
        }
        TestObject.prototype = {
            foo: 0,
            bar: 0,
            serialize: function (desc) {
                desc.uint('foo', 16);
                desc.uint('bar', 16);
            }
        };

        var sourceObj = new TestObject();
        var destObj = new TestObject();
        var sourceStream = new Bitstream();
        var destStream;

        sourceObj.foo = 1337;
        sourceObj.bar = 7331;

        sourceStream.pack(sourceObj);

        var server = new WebSocket.Server({
            port: 31337
        }, function () {
            var client = new WebSocket('ws://localhost:31337');
            client.on('message', function (data) {
                destStream = Bitstream.fromChars(data);
                destStream._index = 0;
                destObj = destStream.unpack(destObj);
                assert.equal(sourceObj.foo, destObj.foo);
                assert.equal(sourceObj.bar, destObj.bar);
                done();
            });
        });

        server.on('connection', function (ssock) {
            ssock.send(sourceStream.toChars());
        });
    });
});