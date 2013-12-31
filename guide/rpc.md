---
title: RPCs
layout: guide
category: concepts
---

A Remote Procedure Call (RPC) is used to invoke a method on a remote instance of an object. RPCs can be invoked on either real or ghost instances, and can travel from client to server, server to client, or both.

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

When the client calls `myPlayer.c2sMove(1, 1)`, Wasabi will queue information about this RPC call, and send it out on the next call to `processConnections`. Note that the code within `c2sMove` is actually executed on the server, and that the client's copy of the function has been replaced with an invocation stub. Thus, the `xvel` and `yvel` properties on the client's Player instance will not change until the server gets the RPC call, then sends the updated `xvel` and `yvel` back to the client.