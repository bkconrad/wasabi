var Bitstream = require('./bitstream');
var Registry = require('./registry');
var Rpc = require('./rpc');

/**
 * named and exported function that would otherwise be an IIFE. Used to
 * instantiate a second Wasabi module for use in tests (to simulate a remote
 * client)
 * @function makeWasabi
 */
function makeWasabi() {
    // for enums
    var iota;

    /**
     * facade class for interacting with Wasabi
     * @class Wasabi
     */
    Wasabi = {
        constructor: Wasabi
        , Bitstream: Bitstream
        , Registry: Registry
        , Rpc: Rpc

        , makeWasabi: makeWasabi

        , WABI_TYPE_RPC: iota = 0
        , WABI_TYPE_CLASS: ++iota
        , WABI_TYPE_GHOST: ++iota
        , WABI_TYPE_UPDATE: ++iota
        , WABI_TYPE_MAX: ++iota
        
        , WABI_SEPARATOR: 0xFFFF

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
            bs.writeUInt(obj.wabiSerialNumber, 16);
            this.packUpdate(obj, bs);
        }
        /**
         * unpacks a newly replicated object from bs
         * @method unpackGhost
         */
        , unpackGhost: function(bs) {
            var obj, type, serial;
            type = this.registry.getClass(bs.readUInt(16));
            if (!type) {
                // TODO: Raise an exception when unpacking a ghost with unregistered class
                return;
            }
            serial = bs.readUInt(16);
            obj = new type;
            this.registry.addObject(obj, serial);
            this.unpackUpdate(bs);
            return obj;
        }

        /**
         * packs ghosts for needed objects into bs
         * @method packGhosts
         */
        , packGhosts: function(bs) {
            // TODO: take a list of in-scope objects to ghost
            var serial;
            for(serial in this.registry.objects) {
                var obj = this.registry.getObject(serial);
                if(this._shouldAddGhost(obj)) {
                    this.packGhost(obj, bs);
                }
            }

            bs.writeUInt(this.WABI_SEPARATOR, 16);
        }

        /**
         * unpack all needed ghosts from bs
         * @method unpackGhosts
         */
        , unpackGhosts: function(bs) {
            while(bs.peekUInt(16) != this.WABI_SEPARATOR) {
                this.unpackGhost(bs);
            }
            
            // burn off the separator
            bs.readUInt(16);
        }
        /**
         * pack the given list of objects (with update data) into bs
         * @method packUpdates
         */
        , packUpdates: function(list, bs) {
            var k;
            for (k in list) {
                this.packUpdate(list[k], bs);
            }
            bs.writeUInt(this.WABI_SEPARATOR, 16);
        }

        /**
         * unpack the given list of objects (with update data) from bs
         * @method unpackUpdates
         */
        , unpackUpdates: function(bs) {
            var hash = 0;
            var list = [];
            var obj;
            while (bs.peekUInt(16) != this.WABI_SEPARATOR) {
                obj = this.unpackUpdate(bs);
                list.push(obj);
            }

            // burn off the separator
            bs.readUInt(16);

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
        
        /**
         * pack the data for a single "frame" including all ghosting control,
         * updates, and rpcs
         * @method pack
         */
        , pack: function(bs) {
            this.packGhosts(bs);
            this.packUpdates(this.registry.objects, bs);
        }

        /**
         * unpack the data for a single "frame" including all ghosting control,
         * updates, and rpcs
         * @method unpack
         */
        , unpack: function(bs) {
            this.unpackGhosts(bs);
            this.unpackUpdates(bs);
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
        
        /**
         * determine if this object needs to be ghosted this frame
         */
        , _shouldAddGhost: function(obj) {
            return true;
        }
    };

    Wasabi.registry = new Registry;

    return Wasabi;
}

var Wasabi = makeWasabi();

module.exports = Wasabi;
