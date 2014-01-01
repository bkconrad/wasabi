---
title: Getting Started
category: overview
layout: guide
---

The following is a crash course in setting up Wasabi. If you already understand prototypal inheritance, it should be fairly intuitive.

Adding A Class
---

To begin replicating a class with Wasabi, you will need to write a `serialize` method and call `Wasabi.addClass` on the class's constructor. Here is a minimal Player class:

{%highlight javascript%}

// Just a normal constructor function.
function Player () {
    this.x = 0;
    this.y = 0;
}

// serialize methods tell Wasabi about the replicated properties
// of your classes, including their types and the number of bits
// used to encode them.
Player.prototype.serialize = function (desc) {
    desc.uint('x', 16); // a 16 bit unsigned integer named x
    desc.uint('y', 16); // a 16 bit unsigned integer named y
};

// don't forget to register your class with Wasabi!
Wasabi.addClass(Player);

{%endhighlight%}

Note that this code will need to be executed on both the client and the server. Typically all of this code will go in a file called `player.js`. You can read more about `serialize` functions in the Concepts section of the guide.

Connecting A Client And Server
---

Wasabi supports WebSockets as well as socket.io out of the box. You can use anything that conforms to the WebSockets interface (has a `send` method and an `onmessage` callback). Setting up a server using Node.js and the `ws` module looks like this:

{% highlight javascript %}

// Create the server socket
var serverSock = new WebSocket.Server({port:1234}, function() {
    // Start your hosting loop
    // ...
});

serverSock.on('connection', function(clientSock) {
    var conn = Wasabi.addClient(clientSock);
});

{% endhighlight %}

Then, on the client side:

{% highlight javascript %}

// connect to the server
var sock = new WebSocket('ws://' + window.location.hostname + ':1234');

sock.onopen = function() {
    Wasabi.addServer(sock);
    // start the client's loop
    // ...
}

{% endhighlight %}

Next, you'll want to create some objects to replicate.

Creating An Object
---

When you want to replicate an instance of the Player class, you can simply do:

{%highlight javascript%}

var player = new Player();
Wasabi.addObject(player);

{%endhighlight%}

Objects should only be manually created on the server. Wasabi will automatically manage the creation and destruction of objects on the client, as shown in the next section.

Synchronizing Servers and Clients
---

This is where all the magic happens. Once you've registered your class, connected your server and client, and added an object on the server. All you have to do is call `processConnections`:

{% highlight javascript %}
Wasabi.processConnections();
{% endhighlight %}

That's it! Just call that in a loop on both the client and server, and the client's copy will be updated to match the servers automatically.

Next Steps
---
If you have a fairly good grasp on the content of this guide, you might want to read more about the concepts in Wasabi in the Concepts section. You can also look at [an example game](https://github.com/kaen/wasabi_example) to see Wasabi in action, or the [API docs]({{ site.baseurl }}/doc/) if you're ready to dive right in.