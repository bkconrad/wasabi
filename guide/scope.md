---
title: Scope
layout: guide
category: concepts
---

Scope refers to the visibility of an object to a specific client. When an object is "in a client's scope", the server will instruct that client to create a ghost representing the server's instance of the object.

By default, all objects are visible to all clients, so you do not strictly need to define a scope callback. However, limiting scope is useful to prevent cheating and reduce bandwidth usage. Typically, only objects within a player's visible area should be included in his connection's scope, perhaps with some extra room to allow for latency.

Scope callbacks are passed as the (optional) second parameter to `addClient`. A scope callback must return an Array of objects which are considered to be in scope. The callback will be queried during each `processConnections` call to determine which objects are in that connection's scope. 

Here is an example of a typical scope callback:

{% highlight javascript %}
var player = new Player();
Wasabi.addClient(socket, function() {
    var obj, i;
    var result = [];
    for (i = 0; i < game.allObjects.length; i++) {
        obj = game.allObjects[i];
        if(player.canSee(obj)) {
            result.push(obj);
        }
    }

    return result;
});
{% endhighlight %}

An object "comes in scope" when it was not in the returned Array on the last call, but is in the Array on the current call. When the opposite is true, the object "leaves scope". These circumstances cause the `clientGhostCreate` and `clientGhostDestroy` events to fire when the client receives the packet for this `processConnections` call. Otherwise, when the object is already in or out of scope, no event is fired.