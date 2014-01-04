var Group = require('../src/group'),
    Wasabi = require('../src/wasabi'),
    assert = require('chai').assert;

function sizeof(obj) {
    var size = 0;
    var k;
    for (k in obj) {
        if (obj.hasOwnProperty(k)) {
            size++;
        }
    }
    return size;
}

describe('Group', function () {
    var obj;
    var group;
    var ws = Wasabi.makeWasabi();

    beforeEach(function () {
        group = ws.createGroup();
        obj = {
            wsbSerialNumber: 1
        };
        group.addObject(obj);
    });

    it('removes objects by serial number', function () {
        assert.strictEqual(sizeof(group._objects), 1);
        group.removeObject(obj.wsbSerialNumber);
        assert.strictEqual(sizeof(group._objects), 0);
    });

    it('removes objects by object', function () {
        assert.strictEqual(sizeof(group._objects), 1);
        group.removeObject(obj);
        assert.strictEqual(sizeof(group._objects), 0);
    });

    it('tolerates removing an object it does not have', function () {
        group.removeObject(undefined);
    });
});