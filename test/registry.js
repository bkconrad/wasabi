var Registry = require(__dirname + '/..' + (process.env.COVERAGE ? '/src-cov' : '/src') + '/registry')
  , assert = require('chai').assert
  , WebSocket = require('ws')
  ;

describe('Class registry', function () {
    var r = new Registry();
    function Foo () { };
    function Bar () { };
    function rpcFoo () { };
    function rpcBar () { };

    it('registers RPCs', function () {
        r.mkRpc(rpcFoo);
        r.mkRpc(rpcBar);
        assert.notEqual(r.getRpc(r.hash(rpcFoo)), r.getRpc(r.hash(rpcBar)));
    });

    it('throws an error if redefining RPCs', function() {
        assert.throws(function() { r.addRpc(rpcFoo); });
    });

    it('registers netobjects', function() {
        var foo = new Foo;
        r.addObject(foo)
        assert.strictEqual(foo, r.getObject(foo.wabiSerialNumber));
    });

    it('registers netobjects with a set serial number', function() {
        var foo = new Foo;
        r.addObject(foo, 1337)
        assert.strictEqual(foo, r.getObject(1337));
    });

    it('registers classes', function () {
        r.addClass(Foo);
        r.addClass(Bar);
        assert.notEqual(r.getClass(r.hash(Foo)), r.getClass(r.hash(Bar)));
    });

    it('throws an error if redefining classes', function() {
        assert.throws(function() { r.addClass(Foo); });
    });

    describe('hash', function () {
        it('is unique to each class', function () {
            assert.notEqual(r.hash(Bar), r.hash(Foo));
        });
        it('is a valid 32 bit integer', function () {
            assert.equal(r.hash(Foo), r.hash(Foo) | 0);
        });
    });
});
