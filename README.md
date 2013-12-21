[![Build Status](https://travis-ci.org/kaen/wasabi.png?branch=master)](https://travis-ci.org/kaen/wasabi)

# Wasabi

A simple then powerful replication library using binary encoding over WebSockets. Released under the MIT License.

    npm install wasabi

The main advantages of using Wasabi are:

 - All data is tightly packed as binary rather than JSON, with user-specified
   precision.
 - You only need to write a single short function per class to start replicating
 - Replicated object lifetimes can be managed based on a "scope" callback which
   may be set for each client (or not at all)
 - Remote RPC invocation works exactly like local function calls
 - Prototypal inheritance of is fully supported out-of-the-box
 - You can get started without much boilerplate, then define additional
   functions to increase performance when you become production-ready

# Usage

For further reading, make sure to look at the [API Docs on
GitHub](http://kaen.github.io/wasabi/doc/) or build your own locally with `jake
doc`.

## Simple Replication

Say you have a Player object you use in an existing (client-only) game:
**old player.js**

```javascript
function Player () {
    this.x = Math.floor(Math.random() * 400);
    this.y = Math.floor(Math.random() * 400);
    this.health = 1.0;
}
```

To start replicating this class with Wasabi, just register it and write a
`serialize` method for it.  Wasabi uses these `serialize` methods to
describe the replicated attributes, their types, and the bits required to
encode their maximum value.

**new player.js**

```javascript
function Player () {
    this.x = Math.floor(Math.random() * 400);
    this.y = Math.floor(Math.random() * 400);
    this.health = 1.0;
}

// serialize
Player.prototype.serialize = function (desc) {
    desc.uint('x', 16); // a 16 bit unsigned integer named x
    desc.uint('y', 16); // a 16 bit unsigned integer named y
    desc.float('health', 16); // a normalized 16 bit signed float
}
```

The `desc` argument which Wasabi passes to `serialize` is a "description" of the
object. The actual class of the `desc` object is determined by whether the
object is being packed or unpacked. Using this one weird trick, you only have to
write a single function and Wasabi will figure out how to take your object in
*and* out of the network.

At this point you're ready to start replicating:

**server.js**

```javascript
var Player = require('./player.js')
  , Wasabi = require('wasabi')
  , WebSocket = require('ws')
  ;

Wasabi.addClass(Player);

var webSockServer = new WebSocket.Server({port:1234}, function() {
    setInterval(function() {
        // handle connections
        Wasabi.processConnections();
        
        // simulation update code goes here
        
    }, 50);
});

webSockServer.on('connection', function(clientSock) {
    // add the new client's connection to the server's Wasabi instance
    Wasabi.addClient(clientSock);
    
    // create the player's game object and add it to Wasabi
    var newPlayer = new Player();
    Wasabi.addObject(newPlayer);
});
```

You probably want to then read the object from a socket on the client side:

**client.js**

```javascript
Wasabi.addClass(Player);

var sock = new WebSocket('ws://localhost:1234');             
Wasabi.addServer(sock);

sock.onopen = function() {
    setInterval(function() {
        // receive network stuff
        Wasabi.processConnections();
        
        // client-side update code goes here
        
    }, 50);
}
```

## Remote Procedure Calls
### Definition
To define a class RPC, create a method prefixed with "rpc":

```javascript
Player.prototype.rpcYell = function (times) {
    var i;
    for(i = 0; i < times; i++) {
        console.log('SPAARTA!');
    }
}
```
    
Make sure that you call `addClass` only **after** defining RPCs, as Wasabi will
look for any methods starting with `rpc` and replace them with the actual remote
invocation stubs.

### Invocation
From the server side we can make a Player "yell" on the clients by saying:

```javascript
player.rpcYell(3);
```

### Performance Enhancement
In order to allow rapid prototyping, Wasabi will infer the types of the
arguments (float, uint, etc.) upon invocation by default. There is significant
CPU and network overhead involved in doing this, so it is highly recommended
that production code includes "args" functions for each RPC. The args function
is written like the serialize function for an object, but is applied to the
arguments on the RPC. The benefit of writing these functions is that Wasabi
doesn't have to detect the types of the arguments, and also does not have to
encode type information over the network.

The args function for `rpcYell` above would look like:

```javascript
Player.prototype.rpcYellArgs = function (desc) {
    desc.uint('times', 8); // An 8-bit unsigned integer
}
```

# Benchmarks
Wasabi has cpu and network usage benchmark which can be run via `sudo jake
bench` (you need sudo because it measures network usage with pcap... patches
welcome). Here is the performance of Wasabi v0.1.3 on a 2.8Ghz CPU:

    One connection, 1000 objects x 148 ops/sec ±0.83% (86 runs sampled)
    Ten connections, 100 objects x 144 ops/sec ±0.93% (84 runs sampled)
    100 connections, ten objects x 109 ops/sec ±1.06% (82 runs sampled)
    Ten connections, ten objects x 1,165 ops/sec ±0.82% (98 runs sampled)
    
    Start of TCP session between 127.0.0.1:47099 and 127.0.0.1:31337
    1 clients with 100 objects for 1000 iterations
    End of TCP session between 127.0.0.1:47099 and 127.0.0.1:31337
    client -> server: 9.15kB (61.42kB with transport)
    0.92kB/s at 15hz
    server -> client: 820.59kB (872.85kB with transport)
    13.09kB/s at 15hz

# Contact
If you have bug reports, feature requests, questions, or pull requests, drop by
the [github repo](https://github.com/kaen/wasabi). If you have lavish praise or
eloquent maledictions, email me at [bkconrad@gmail.com](mailto:bkconrad@gmail.com).
