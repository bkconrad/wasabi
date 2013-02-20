var Bitstream = require('./bitstream');
var Registry = require('./registry');
var Rpc = require('./rpc');
var Wasabi = (function() {
    /**
     * facade class for interacting with Wasabi
     * @class Wasabi
     */
    function Wasabi() {
        this.registry = new Registry;
    }
    Wasabi.Bitstream = Bitstream;
    Wasabi.Registry = Registry;
    Wasabi.Rpc = Rpc;

    Wasabi.prototype = {
        constructor: Wasabi
        /**
         * packs update data for obj
         * @method packUpdate
         */
        , packUpdate: function(obj, bs) {
            bs.writeUInt(obj.wabiSerialNumber, 16);
            bs.pack(obj);
        }
        /**
         * unpacks update data for an object
         * @method unpackUpdate
         */
        , unpackUpdate: function(bs) {
            var obj = this.registry.getObject(bs.readUInt(16));
            if (!obj) {
                return;
            }
            bs.unpack(obj);
            return obj;
        }
        /**
         * packs data needed to instantiate a replicated version of obj
         * @method packGhost
         */
        , packGhost: function(obj, bs) {
            bs.writeUInt(this.registry.hash(obj.constructor), 16);
            this.packUpdate(obj, bs);
        }
        /**
         * unpacks a newly replicated object from bs
         * @method unpackGhost
         */
        , unpackGhost: function(bs) {
            var obj, type;
            type = this.registry.getClass(bs.readUInt(16));
            if (!type) {
                return;
            }
            obj = new type;
            this.registry.addObject(obj);
            this.unpackUpdate(bs);
            return obj;
        }
        /**
         * pack the given list of objects (with update data) into bs
         * @method packObjects
         */
        , packObjects: function(list, bs) {
            var i;
            for (i = 0; i < list.length; i++) {
                this.packUpdate(list[i], bs);
            }
            bs.writeUInt(0, 16);
        }

        /**
         * unpack the given list of objects (with update data) from bs
         * @method unpackObjects
         */
        , unpackObjects: function(bs) {
            var hash = 0;
            var list = [];
            var obj;
            while (true) {
                obj = this.unpackUpdate(bs);
                if (!obj) {
                    break;
                }

                list.push(obj);
            }
            return list;
        }

        /**
         * pack a call to a registered RP and the supplied arguments into bs
         * @method packRpc
         */
        , packRpc: function(rpc, args, bs) {
            bs.writeUInt(this.registry.hash(rpc), 8);
            args.serialize = rpc.argSerialize;
            bs.pack(args);
        }

        /**
         * unpack and execute a call to a registered RP using the supplied
         * arguments from bs
         * @method unpackRpc
         */
        , unpackRpc: function(bs) {
            var hash = bs.readUInt(8);
            var rpc = this.registry.getRpc(hash);

            var args = {};
            args.serialize = rpc.argSerialize;
            bs.unpack(args);

            rpc(args);
        }

        // passthrough functions
        /**
         * register a klass instance
         * @method addObject
         */
        , addObject: function(obj) {
            this.registry.addObject(obj);
        }
        /**
         * register a klass
         * @method addClass
         */
        , addClass: function(klass) {
            this.registry.addClass(klass);
        }
        /**
         * register an RP
         * @method addRpc
         */
        , addRpc: function(rpc, serialize) {
            this.registry.addRpc(rpc, serialize);
        }
    };

    return Wasabi;
})();

module.exports = Wasabi;
