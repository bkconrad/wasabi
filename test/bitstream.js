var Bitstream = require('../src/bitstream');

exports.sanity = function (beforeExit, assert) {
	assert.isDefined(Bitstream);
}

exports.get_set_clear = function (beforeExit, assert) {
	var b = new Bitstream;
	b.set(0);
	b.clear(1);
	b.set(2);
	assert.ok(b.get(0));
	assert.ok(!b.get(1));
	assert.ok(b.get(2));
}

exports.uint = function (beforeExit, assert) {
	var b = new Bitstream;
	var VALUE = 1337;
	b.writeUInt(VALUE, 16);
	assert.equal(b._index, 16);

	b._index = 0;
	assert.equal(b.readUInt(16), VALUE);
	delete b;
}

exports.packing = function (beforeExit, assert) {
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
	console.log(bs);

	bs._index = 0;
	var resultObj = bs.unpack(testObj);
	assert.equal(testObj.foo, resultObj.foo);
	assert.equal(testObj.bar, resultObj.bar);
}
