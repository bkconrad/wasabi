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
	delete b;
}

exports.int = function (beforeExit, assert) {
	var b = new Bitstream;
	var VALUE = 1337;
	b.writeInt(VALUE, 16);
	assert.equal(b._index, 16);
	console.log(b.arr);

	b._index = 0;
	assert.equal(b.readInt(16), VALUE);
	delete b;
}
