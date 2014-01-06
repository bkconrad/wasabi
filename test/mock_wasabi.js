var Wasabi = require('../src/wasabi');
var assert = require('chai').assert;

module.exports = (function () {
    function Foo() {
        this.uintfoo = 1;
        this.sintfoo = -1;
        this.floatfoo = 0.618;
        this.stringfoo = 'test';
        this.truefoo = true;
        this.falsefoo = false;
    }

    Foo.prototype = {
        constructor: Foo,
        serialize: function (desc) {
            desc.uint('uintfoo', 16);
            desc.sint('sintfoo', 16);
            desc.float('floatfoo', 8);
            desc.string('stringfoo');
            desc.bool('truefoo');
            desc.bool('falsefoo');
        },
        check: function (that) {
            assert.strictEqual(this.uintfoo, that.uintfoo);
            assert.strictEqual(this.sintfoo, that.sintfoo);
            assert.closeTo(this.floatfoo, that.floatfoo, 0.01);
            assert.strictEqual(this.stringfoo, that.stringfoo);
            assert.strictEqual(this.truefoo, that.truefoo);
            assert.strictEqual(this.falsefoo, that.falsefoo);
        },
        rpcTest: function rpcTest(val) {
            this.testval = val;
        },
        rpcTestArgs: function (desc) {
            desc.uint('val', 16);
        },
        rpcDefault: function rpcDefault(val) {
            this.defaultVal = val;
        },
        s2cTest: function s2cTest(val) {
            this.testval = val;
        },
        c2sTest: function c2sTest(val) {
            this.testval = val;
        }
    };

    function Bar() {
        this.barbar = 3;
    }

    Bar.prototype = new Foo();
    Bar.prototype.constructor = Bar;
    Bar.prototype.serialize = function (desc) {
        desc.uint('barbar', 16);
    };

    Bar.prototype.rpcBarTest = function rpcBarTest(val) {
        this.barval = val;
    };

    Bar.prototype.rpcBarTestArgs = function (desc) {
        desc.uint('val', 16);
    };

    function make() {
        var w = Wasabi.makeWasabi();
        w.addClass(Foo);
        w.addClass(Bar);
        return w;
    }

    return {
        make: make,
        Foo: Foo,
        Bar: Bar
    };
}());