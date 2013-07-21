var Bitstream = require(__dirname + '/..' + (process.env.COVERAGE ? '/src-cov' : '/src') + '/bitstream')
  , assert = require('chai').assert
  , WebSocket = require('ws')
  ;


describe('Bitstream', function () {
	describe('bit buffer', function () {
        it('can tell if there is more data to read', function() {
			var b = new Bitstream;
            b.writeUInt(0, 16);
            b._index = 0;
            assert.equal(16, b.bitsLeft());

            b.readUInt(8);
            assert.equal(8, b.bitsLeft());

            b.readUInt(8);
            assert.equal(0, b.bitsLeft());
        });
		it('should set n bits at a time', function () {
			var b = new Bitstream;
            b._setBits(0, 7, 127);
            assert.equal(b.arr[0], 127);
		});

		it('should correctly overflow large values', function () {
			var b = new Bitstream;
            b._setBits(0, 8, 129);
            assert.equal(b.arr[0], 1);
            assert.equal(b.arr[1], 1);
		});

		it('should get n bits at a time', function () {
			var b = new Bitstream;
            b._setBits(0, 16, 1337);
            assert.equal(b._getBits(0, 16), 1337);
		});
		it('should read/write unsigned integers', function () {
			var b = new Bitstream;
			var VALUE = 1337;
			b.writeUInt(VALUE, 16);
			assert.equal(b._index, 16);

			b._index = 0;

            assert.equal(b.peekUInt(16), VALUE);
            assert.equal(b._index, 0);

			assert.equal(b.readUInt(16), VALUE);
		});
		it('should read/write signed integers', function () {
			var b = new Bitstream;
			var negValue = -1337;
			var posValue = 123;
			b.writeSInt(negValue, 16);
			b.writeSInt(posValue, 8);

			assert.equal(b._index, 24);
			b._index = 0;

			assert.equal(b.readSInt(16), negValue);
			assert.equal(b.readSInt(8), posValue);
		});
		it('complains on overread', function () {
			var b = new Bitstream;
			b.writeUInt(1337, 16);
            b._index = 0;
            b.readUInt(16);
            assert.throws(function() { b.readUInt(1) });
		});
		it('encodes its value as an ArrayBuffer', function () {
			var b = new Bitstream;
			b.writeUInt(1337, 16);
			b.writeUInt(1, 2);
			b.writeUInt(127, 7);

			var b2 = new Bitstream(b.toArrayBuffer());
            b2._index = 0;

            console.log(b);
            console.log(b2);
			assert.equal(1337, b2.readUInt(16));
			assert.equal(1, b2.readUInt(2));
			assert.equal(127, b2.readUInt(7));
		});
		it('should pack/unpack objects with .serialize methods', function () {
			var bs = new Bitstream;
			var testObj = {
				foo: 1337,
				bar: 7331,
                baz: -123,
				serialize: function (desc) {
					desc.uint('foo', 16);
					desc.uint('bar', 16);
					desc.sint('baz', 7);
				}
			}
			bs.pack(testObj);
			// console.log(bs);

			bs._index = 0;
			var resultObj = bs.unpack(testObj);
            for (var k in testObj) {
                if(testObj.hasOwnProperty(k)) {
                    assert.equal(testObj[k], resultObj[k]);
                }
            }
		});
        it('appends bits from character data', function() {
			var b1 = new Bitstream();
			var b2 = new Bitstream();
            b1.writeUInt(1337, 16);
            b1.writeUInt(4321, 16);
            b2.appendChars(b1.toChars());

            b2._index = 0;

            assert.equal(1337, b2.readUInt(16));
            assert.equal(4321, b2.readUInt(16));
        });
        it('can be aligned to the next buffer byte', function() {
			var b1 = new Bitstream();
            var start, stop;
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
        it('can check for equivalence with another', function() {
			var b1 = new Bitstream();
			var b2 = new Bitstream();
            b1.writeUInt(1337, 16);
            b1.writeUInt(4321, 16);
            b2.appendChars(b1.toChars());

            assert.ok(b1.equals(b2));

            b1.writeUInt(1234, 16);
            assert.ok(!b1.equals(b2));
        });
		it('writes and reads objects to websockets', function (done) {
			function TestObject () {}
		        TestObject.prototype = {
				foo: 0,
				bar: 0,
				serialize: function (desc) {
					desc.uint('foo', 16);
					desc.uint('bar', 16);
				}
			};

			var sourceObj = new TestObject;
			var destObj = new TestObject;

			sourceObj.foo = 1337;
			sourceObj.bar = 7331;

			var sourceStream = new Bitstream;
			var destStream = undefined;

			sourceStream.pack(sourceObj);

			var server = new WebSocket.Server({port:31337}, function () {
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
});
