var Group = require('../src/group'),
    assert = require('chai').assert;

describe('Group', function () {
    var obj;
    var group;
    beforeEach(function () {
        group = new Group();
        obj = {};
        group.addObject(obj);
    });

    it('removes objects by index', function () {
        assert.strictEqual(group._objects.length, 1);
        group.removeObject(0);
        assert.strictEqual(group._objects.length, 0);
    });

    it('removes objects by object', function () {
        assert.strictEqual(group._objects.length, 1);
        group.removeObject(obj);
        assert.strictEqual(group._objects.length, 0);
    });

    it('tolerates removing an object it does not have', function () {
        group.removeObject(undefined);
    });
});