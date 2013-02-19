var Registry = require(__dirname + '/..' + (process.env.COVERAGE ? '/src-cov' : '/src') + '/registry')
  , assert = require('chai').assert
  , WebSocket = require('ws')
  ;

describe('Class registry', function () {
    it('hashes classes by name', function () {
        var r = new Registry();
        function Foo () {
        };
        function Bar () {
        };
        assert.notEqual(r.hash(Bar), r.hash(Foo));
    });
    describe('hash', function () {
        it('is unique to each class', function () {
            var r = new Registry();
            function Foo () {
            };
            function Bar () {
            };
            r.register(Foo);
            r.register(Bar);
            assert.notEqual(r.lookup(r.hash(Foo)), r.lookup(r.hash(Bar)));
        });
        it('is a valid 32 bit integer', function () {
            var r = new Registry();
            function Foo () {
            };
            function Bar () {
            };
            r.register(Foo);
            assert.equal(r.hash(Foo), r.hash(Foo) | 0);
        });
    });
});
