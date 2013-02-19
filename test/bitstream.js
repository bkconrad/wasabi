var Bitstream = require(__dirname + '/..' + (process.env.COVERAGE ? '/src-cov' : '/src') + '/bitstream')
  , assert = require('chai').assert
  , WebSocket = require('ws')
  ;


describe('Bitstream', function () {
	describe('bit buffer', function () {
		it('should set n bits at a time', function () {
			var b = new Bitstream;
            b.setBits(0, 7, 127);
            assert.equal(b.arr[0], 127);
		});

		it('should correctly overflow large values', function () {
			var b = new Bitstream;
            b.setBits(0, 8, 129);
            assert.equal(b.arr[0], 1);
            assert.equal(b.arr[1], 1);
		});

		it('should get n bits at a time', function () {
			var b = new Bitstream;
            b.setBits(0, 16, 1337);
            assert.equal(b.getBits(0, 16), 1337);
		});
		it('should read/write unsigned integers', function () {
			var b = new Bitstream;
			var VALUE = 1337;
			b.writeUInt(VALUE, 16);
			assert.equal(b._index, 16);

			b._index = 0;
			assert.equal(b.readUInt(16), VALUE);
		});
		it('should read/write signed integers', function () {
			var b = new Bitstream;
			var negValue = -1337;
			var posValue = 123;
			b.writeSInt(negValue, 16);
			b.writeSInt(posValue, 7);

			assert.equal(b._index, 25);
			b._index = 0;

			assert.equal(b.readSInt(16), negValue);
			assert.equal(b.readSInt(7), posValue);
		});
		it('encodes its value as an ArrayBuffer', function () {
			var b = new Bitstream;
			b.writeUInt(1337, 16);
			b.writeUInt(1, 2);
			b.writeUInt(127, 7);

			var b2 = new Bitstream(b.toArrayBuffer());
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
