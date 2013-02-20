var Bitstream = require('./bitstream');
var Registry = require('./registry');
var Rpc = require('./rpc');
var Wasabi = (function() {
    function Wasabi() {
        this.registry = new Registry;
    }
    Wasabi.Bitstream = Bitstream;
    Wasabi.Registry = Registry;
    Wasabi.Rpc = Rpc;

    Wasabi.prototype = {
        constructor: Wasabi
        /**
         * pack the given list of objects (with update data) into bs
         * @method packObjects
         */
        , packObjects: function(list, bs) {
            var i;
            for (i = 0; i < list.length; i++) {
                bs.writeUInt(this.registry.hash(list[i].constructor), 16);
                bs.pack(list[i]);
            }
            bs.writeUInt(0, 16);
        }

        /**
         * unpack the given list of objects (with update data) from bs
         * @method packObjects
         */
        , unpackObjects: function(bs) {
            var hash = 0;
            var list = [];
            var type = undefined;
            while (true) {
                type = this.registry.getClass(bs.readUInt(16));
                if (!type) {
                    break;
                }
                list.push(new type);
                bs.unpack(list[list.length - 1]);
            }
            return list;
        }

        /**
         * pack a call to a registered RP and the supplied arguments into bs
         * @method packRpc
         */
        , packRpc: function(rpc, args, bs) {
            bs.writeUInt(this.registry.hash(rpc), 8);
        }

        /**
         * unpack and execute a call to a registered RP using the supplied
         * arguments from bs
         * @method unpackRpc
         */
        , unpackRpc: function(bs) {
            var hash = bs.readUInt(8);
            this.registry.getRpc(hash)();
        }
    };

    return Wasabi;
})();

module.exports = Wasabi;
