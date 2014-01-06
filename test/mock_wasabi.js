var Wasabi = require('../src/wasabi');
var assert = require('chai').assert;

module.exports = (function () {
    function Foo() {
        this.uintfoo = 1;
        this.sintfoo = -1;
        this.floatfoo = 0.618;
        this.stringfoo = 'test';
        this.boolfoo = true;
    }

    Foo.prototype = {
        constructor: Foo,
        serialize: function (desc) {
            desc.uint('uintfoo', 16);
            desc.sint('sintfoo', 16);
            desc.float('floatfoo', 8);
            desc.string('stringfoo');
        },
        check: function (that) {
            assert.equal(this.uintfoo, that.uintfoo);
            assert.equal(this.sintfoo, that.sintfoo);
            assert.equal(this.floatfoo, that.floatfoo);
            assert.equal(this.stringfoo, that.stringfoo);
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