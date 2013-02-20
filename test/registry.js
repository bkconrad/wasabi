var Registry = require(__dirname + '/..' + (process.env.COVERAGE ? '/src-cov' : '/src') + '/registry')
  , assert = require('chai').assert
  , WebSocket = require('ws')
  ;

describe('Class registry', function () {
    var r;
    beforeEach(function () {
        r = new Registry();
    });

    it('registers RPCs', function () {
        function Foo () {
        };
        function Bar () {
        };
        r.addRpc(Foo);
        r.addRpc(Bar);
        assert.notEqual(r.getRpc(r.hash(Foo)), r.getRpc(r.hash(Bar)));
    });

    it('throws an error if redefining RPCs', function() {
        function Foo() {}
        r.addRpc(Foo);
        assert.throws(function() { r.addRpc(Foo); });
    });

    it('registers netobjects');

    it('registers classes', function () {
        function Foo () {
        };
        function Bar () {
        };
        r.addClass(Foo);
        r.addClass(Bar);
        assert.notEqual(r.getClass(r.hash(Foo)), r.getClass(r.hash(Bar)));
    });

    it('throws an error if redefining classes', function() {
        function Foo() {}
        r.addClass(Foo);
        assert.throws(function() { r.addClass(Foo); });
    });

    describe('hash', function () {
        it('is unique to each class', function () {
            function Foo () {
            };
            function Bar () {
            };
            assert.notEqual(r.hash(Bar), r.hash(Foo));
        });
        it('is a valid 32 bit integer', function () {
            function Foo () {
            };
            function Bar () {
            };
            assert.equal(r.hash(Foo), r.hash(Foo) | 0);
        });
    });
});
