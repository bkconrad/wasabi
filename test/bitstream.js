var SRC_PATH;
if (process.env.COVERAGE) {
	SRC_PATH = '/src-cov';
} else {
	SRC_PATH = '/src';
}
var Bitstream = require(__dirname + '/..' + SRC_PATH + '/bitstream')
  , assert = require('chai').assert
  , WebSocket = require('ws')
  ;


describe('Bitstream', function () {
	describe('bit buffer', function () {
		it('should get/set by index', function () {
			var b = new Bitstream;
			b.set(0);
			b.clear(1);
			b.set(2);
			assert.ok(b.get(0));
			assert.ok(!b.get(1));
			assert.ok(b.get(2));
		});
		it('should get n bits at a time', function () {
			var b = new Bitstream;
			var i;
			for (i = 0; i < 256; i++) {
				b.writeUInt(i, 8);
			}

			var offset = 0;
			for (i = 0; i < 256; i++) {
				assert.equal(i, b.getBits(offset, 8));
				offset += 8;
			}
		});
		it('should read/write unsigned integers', function () {
			var b = new Bitstream;
			var VALUE = 1337;
			b.writeUInt(VALUE, 16);
			assert.equal(b._index, 16);

			b._index = 0;
			assert.equal(b.readUInt(16), VALUE);
		});
		it('encodes its value as an ArrayBuffer', function () {
			var b = new Bitstream;
			b.writeUInt(0, 8);
			b.writeUInt(32, 8);
			b.writeUInt(128, 8);
			//b.writeUInt(255, 8);
			b.writeUInt(256, 8);

			var b2 = new Bitstream(b.toArrayBuffer());
			assert.equal(0, b2.readUInt(8));
			assert.equal(32, b2.readUInt(8));
			assert.equal(128, b2.readUInt(8));
			//assert.equal(255, b2.readUInt(8));
			assert.equal(0, b2.readUInt(8));
		});
		it('should pack/unpack objects with .serialize methods', function () {
			var bs = new Bitstream;
			var testObj = {
				foo: 1337,
				bar: 7331,
				serialize: function (desc) {
					desc.uint('foo', 16);
					desc.uint('bar', 16);
				}
			}
			bs.pack(testObj);
			// console.log(bs);

			bs._index = 0;
			var resultObj = bs.unpack(testObj);
			assert.equal(testObj.foo, resultObj.foo);
			assert.equal(testObj.bar, resultObj.bar);
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
					destStream = Bitstream.deserialize(data);
					destObj = destStream.unpack(destObj);
					assert.equal(sourceObj.foo, destObj.foo);
					assert.equal(sourceObj.bar, destObj.bar);
					done();
				});
			});

			server.on('connection', function (ssock) {
				ssock.send(sourceStream.serialize());
			});
		});
	});
});
