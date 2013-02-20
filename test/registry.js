var Registry = require(__dirname + '/..' + (process.env.COVERAGE ? '/src-cov' : '/src') + '/registry')
  , assert = require('chai').assert
  , WebSocket = require('ws')
  ;

describe('Class registry', function () {
    it('registers classes', function () {
        var r = new Registry();
        function Foo () {
        };
        function Bar () {
        };
        r.addClass(Foo);
        r.addClass(Bar);
        assert.notEqual(r.lookup(r.hash(Foo)), r.lookup(r.hash(Bar)));
    });

    it('registers RPCs');
    it('throws an error if redefining RPCs');
    it('registers netobjects');
    describe('hash', function () {
        it('is unique to each class', function () {
            var r = new Registry();
            function Foo () {
            };
            function Bar () {
            };
            assert.notEqual(r.hash(Bar), r.hash(Foo));
        });
        it('is a valid 32 bit integer', function () {
            var r = new Registry();
            function Foo () {
            };
            function Bar () {
            };
            assert.equal(r.hash(Foo), r.hash(Foo) | 0);
        });
    });
});
