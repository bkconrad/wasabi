# Wasabi

A simple replication library using *binary* encoding over WebSockets (no
fallbacks). Released under the MIT License.

	npm install wasabi

Currently, Wasabi only allows dumb serialization/deserialization of objects over
a WebSocket. The main advantage of using Wasabi are that you get binary encoding
without the hassle, and you *only have to write one function*

Say you have a Player object you use in an existing game:
**player.js**

	function Player () {
		this.x = 0;
		this.y = 0;
	}

To use this class with Wasabi, just write a `#serialize` method for it:

	Player.prototype.serialize = function (desc) {
		desc.uint('x', 16); // an unsigned integer named x using 16 bits
		desc.uint('y', 16); // an unsigned integer named y using 16 bits
	}

The `desc` is a description of the object. The actual class of the `desc`
object is determined by the whether the object is being packed or unpacked, so
you only have to write a single function and Wasabi will figure out how to take
your object in *and* out of the network

To then send your Player over a web socket, you need a Bitstream:
**server.js**

	// our server socket
	var wss = new WebSocketServer({port: 8080});

	// create a bitstream which handles the conversion from a js object to
	// binary on the wire
	var bitStream = new Wasabi.Bitstream;

	// instantiate the object we'll send and initialize some members
	var player = new Player();
	player.x = 1337;
	player.y = 1234;

	// pack the object into our bitstream
	bitStream.pack(player);

	// send it on a successful connection
	wss.on('connection', function (ws) {
		// BitStream#serialize translates the bitstream's contents into
		// a string which can be sent via WebSocket#send
		ws.send(bitStream.serialize());
	});

You probably want to then read the object from a socket on the client side:
**client.js**

	var ws = new WebSocket('ws://localhost:8080');
		ws.on('message', function (data) {
		// BitStream.deserialize makes a bitstream from string contents
		var bitStream = Wasabi.Bitstream.deserialize(data);

		// but notice that we need an object instance *before* we can
		// unpack an object from the bitstream
		var myPlayer = new Player();
		console.log(bitStream.unpack(myPlayer));
	}
