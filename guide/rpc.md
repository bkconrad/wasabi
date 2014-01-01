---
title: RPCs
layout: guide
category: concepts
---

A Remote Procedure Call (RPC) is used to invoke a method on a remote instance of an object. RPCs can be invoked on either real or ghost instances, and can travel from client to server, server to client, or both.

Declaration
---
RPCs are automatically detected by Wasabi when you call `addClass`. Wasabi will look for functions that start with `rpc`, `c2s`, or `s2c`, meaning a bidirectional, client to server, or server to client RPC, respectively. Wasabi will automatically detect the number of arguments an RPC requires. When Wasabi encounters an RPC definition on a class's `prototype`, *it will replace the original function with an RPC invocation stub*.

Here is an example of an RPC meant to be called by a client to move the player he controls:

{% highlight javascript %}
var PLAYER_SPEED = 100;
Player.prototype.c2sMove = function c2sMove(x, y) {
    x = Math.min(Math.max(x, -1), 1);
    y = Math.min(Math.max(y, -1), 1);
    this.xvel = PLAYER_SPEED * x;
    this.yvel = PLAYER_SPEED * x;
};
{% endhighlight %}

You can optionally declare an `*Args` method, which is like a `serialize` method, but for encoding the arguments of an RPC. You should do this when you're done prototyping, or want to improve the CPU and network performance of your program. For the `c2sMove` example above, the args function would be called `c2sMoveArgs`, and would look like this:

{% highlight javascript %}
Player.prototype.c2sMoveArgs = function c2sMoveArgs(desc) {
    desc.float('x', 8);
    desc.float('y', 8);
};
{% endhighlight %}

*Remember, the `*Args` function for RPCs is completely optional, and it is recommended to only write one when it's time to tune for performance.*

Usage
---
When the client calls `myPlayer.c2sMove(1, 1)`, Wasabi will queue information about this RPC call, and send it out on the next call to `processConnections`. Note that the code within `c2sMove` is actually executed on the server, and that the client's copy of the function has been replaced with an invocation stub. Thus, the `xvel` and `yvel` properties on the client's Player instance will not change until the server gets the RPC call, then sends the updated `xvel` and `yvel` back to the client.

Connection Targetting
---
Often, an RPC invocation should only be sent to subset of connections, rather than all connections (as is the default). This can be accomplished by passing a reference to the connection after the regular arguments of the RPC. Connection objects are returned by `addClient` and `addServer`, and it is typical to store a reference to a connection on some object in your simulation.

For example:

{% highlight javascript %}
var conn = addClient(clientSock);
player.conn = conn;
// later ...
player.s2cPrivateMessage(messageText, player.conn);
{% endhighlight %}

Note that if `player.conn` was omitted, the `s2cPrivateMessage` would be sent to *all* ghosts of the `player`, which would probably exist on all connected clients.

You may specify as many connections as you like, and all of them will receive the RPC. If you do not pass any connections, the RPC will be sent to all connections known to the Wasabi instance.

Connection Source Checking
---
Similarly, some RPCs should only be run from a specific connection. An example would be a movement RPC, which should only be allowed to come from the connection which controls the player being moved.

When the RPC is invoked at its destination, it receives the connection it came from after the function's defined arguments.

{% highlight javascript %}
Player.prototype.c2sMove(direction) {
    // notice that arguments[0] is the direction specified above,
    // so arguments[1] is the connection which issued this RPC,
    // and this.conn is the player's actual controlling connection
    if(arguments[1] !== this.conn) {
        console.log(conn + " tried to move someone else's player!");
        return;
    }

    // now move the player, since we know the RPC came from his connection
    // ...
};
{% endhighlight %}