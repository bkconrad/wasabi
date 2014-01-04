---
title: Visibility Groups
layout: guide
category: concepts
---

By default, all objects are visible to each connection, so you do not strictly need to define visibility groups. However, limiting visibility is useful to prevent cheating and reduce bandwidth usage. Typically, only objects within a player's visible area should be included in his connection's visibility, perhaps with some extra room to allow for latency.

Groups are created with `Wasabi.createGroup`, and can be shared among connections. Connections can have zero or more groups, and start with none defined.

*A connection with no defined visibility group will receive **all** objects.*

Here is an example of using groups

{% highlight javascript %}

var conn = Wasabi.addClient(socket);
var group = Wasabi.createGroup();
var player = new Player();

group.addObject(player);
conn.addGroup(group);

{% endhighlight %}

An object "comes in scope" when it is included in a connection's groups after it was not previously. When the opposite is true, the object "leaves scope". These circumstances cause the `clientGhostCreate` and `clientGhostDestroy` events to fire when the client receives the packet for this `processConnections` call. Otherwise, when the object has not changed visibility, no event is fired.