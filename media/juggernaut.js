/*
Copyright (c) 2008 Alexander MacCaw

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

function Juggernaut(options) {
    this.is_connected = false;
    this.attempting_to_reconnect = false;
    this.ever_been_connected = false;
    this.hasLogger = "console" in window && "log" in window.console;
    this.options = options;
    this.options.channels = this.options.channels || []; // TODO used only in handshake method
    this.options.channels_callbacks = {};
    this.emptyFunction = function() {};
    this.bindToWindow();
  }

Juggernaut.fn = Juggernaut.prototype;

Juggernaut.fn.logger = function(msg) {
    if (this.options.debug) {
      msg = "Juggernaut: " + msg + " on " + this.options.host + ':' + this.options.port;
      this.hasLogger ? console.log(msg) : alert(msg);
    }
};

Juggernaut.fn.initialized = function(){
    this.fire_event('initialized');
    this.connect();
};

Juggernaut.fn.broadcast = function(data, type, client_ids, channels){
    var msg = {command: 'broadcast', data: data, type: (type||'to_channels')};
    if(channels)  msg['channels'] = channels;
    if(client_ids) msg['client_ids'] = client_ids;
    this.sendData(Juggernaut.toJSON(msg));
};

Juggernaut.fn.sendData = function(data){
    this.swf().sendData(escape(data));
};

Juggernaut.fn.connect = function(){
    if(!this.is_connected){
      this.fire_event('connect');
      this.swf().connect(this.options.host, this.options.port);
    }
};

Juggernaut.fn.disconnect = function(){
    if(this.is_connected) {
      this.swf().disconnect();
      this.is_connected = false;
    }
};

Juggernaut.fn.handshake = function() {
    var handshake = {};
    handshake['command'] = 'subscribe';
    if(this.options.session_id) handshake['session_id'] = this.options.session_id;
    if(this.options.client_id)  handshake['client_id'] = this.options.client_id;
    if(this.options.channels)   handshake['channels'] = this.options.channels;
    if(this.currentMsgId) {
      handshake['last_msg_id'] = this.currentMsgId;
      handshake['signature'] = this.currentSignature;
    }

    return handshake;
};

Juggernaut.fn.connected = function(e) {
    var that = this;
    var json = Juggernaut.toJSON(this.handshake());
    this.sendData(json);
    this.ever_been_connected = true;
    this.is_connected = true;
    setTimeout(function(){
      if(that.is_connected) that.attempting_to_reconnect = false;
    }, 1 * 1000);
    this.logger('Connected');
    this.fire_event('connected');
};

Juggernaut.fn.receiveData = function(e) {
     var msg = Juggernaut.parseJSON(unescape(e.toString()));
     this.currentMsgId = msg.id;
     this.currentSignature = msg.signature;
     this.logger("Received data:\n" + Juggernaut.toJSON(msg) + "\n");
     if (msg.channel && !(this.options.channels_callbacks[msg.channel] == this.emptyFunction)) {
         this.options.channels_callbacks[msg.channel](msg.data);
     } else {
         eval(msg.data);
     }
};

Juggernaut.fn.subscribe = function(channel, callback) {
    if (typeof callback != "function") callback = this.emptyFunction;

    if (this.is_connected && !(channel in this.options.channels_callbacks)) {
        this.options.channels_callbacks[channel] = callback;

        var handshake = this.handshake();
        handshake.command = "query";
        handshake.type = "add_channels_to_client";
        handshake.channels = [channel];
        this.sendData(Juggernaut.toJSON(handshake));
        this.logger("Subscribed to channel '" + channel + "'");
    } else {
        this.logger("You are already subscribed to channel '" + channel + "'");
    }
};

Juggernaut.fn.unsubscribe = function(channel) {
    if(this.is_connected && (channel in this.options.channels_callbacks)) {
        delete this.options.channels_callbacks[channel];

        var handshake = this.handshake();
        handshake.command = "query";
        handshake.type = "remove_channels_from_client";
        handshake.channels = [channel];
        this.sendData(Juggernaut.toJSON(handshake));
        this.logger("Unsubscribed from channel '" + channel + "'");
    } else {
        this.logger("You are not subscribed to channel '" + channel + "'");
    }
};

Juggernaut.fn.publish = function(channel, data) {
    if(this.is_connected && (channel in this.options.channels_callbacks)) {
        this.broadcast(data, null, null, [channel]);
        this.logger("Published data:\n" + Juggernaut.toJSON(data) + "\nto '" + channel + "' channel");
    } else {
        this.logger("You are not subscribed to channel '" + channel + "'");
    }
};

var juggernaut;

// Prototype specific - override for other frameworks
Juggernaut.fn.fire_event = function(fx_name) {
     $(document).fire("juggernaut:" + fx_name);
};

Juggernaut.fn.bindToWindow = function() {
    Event.observe(window, 'load', function() {
        juggernaut = this;
        this.appendFlashObject();
    }.bind(this));
};

Juggernaut.toJSON = function(hash) {
    return Object.toJSON(hash);
};

Juggernaut.parseJSON = function(string) {
    return string.evalJSON();
};

Juggernaut.fn.swf = function(){
    return $(this.options.swf_name);
};

Juggernaut.fn.appendElement = function() {
    this.element = new Element('div', { id: 'juggernaut' });
    $(document.body).insert({ bottom: this.element });
};

/*** END PROTOTYPE SPECIFIC ***/

Juggernaut.fn.appendFlashObject = function(){
    if(this.swf()) {
      throw("Juggernaut error. 'swf_name' must be unique per juggernaut instance.");
    }
    Juggernaut.fn.appendElement();
    swfobject.embedSWF(
      this.options.swf_address,
      'juggernaut',
      this.options.width,
      this.options.height,
      String(this.options.flash_version),
      this.options.ei_swf_address,
      {'bridgeName': this.options.bridge_name},
      {},
      {'id': this.options.swf_name, 'name': this.options.swf_name}
    );
};

Juggernaut.fn.refreshFlashObject = function(){
    this.swf().remove();
    this.appendFlashObject();
};

Juggernaut.fn.errorConnecting = function(e) {
    this.is_connected = false;
    if(!this.attempting_to_reconnect) {
      this.logger('There has been an error connecting');
      this.fire_event('errorConnecting');
      this.reconnect();
    }
};

Juggernaut.fn.disconnected = function(e) {
    this.is_connected = false;
    if(!this.attempting_to_reconnect) {
      this.logger('Connection has been lost');
      this.fire_event('disconnected');
      this.reconnect();
    }
};

Juggernaut.fn.reconnect = function(){
    if(this.options.reconnect_attempts){
        var that = this;
        this.attempting_to_reconnect = true;
        this.fire_event('reconnect');
        this.logger('Will attempt to reconnect ' + this.options.reconnect_attempts + ' times,\
the first in ' + (this.options.reconnect_intervals || 3) + ' seconds');

        for(var i=0; i < this.options.reconnect_attempts; i++){
            setTimeout(function(){
                if(!that.is_connected){
                    that.logger('Attempting reconnect');
                    if(!that.ever_been_connected){
                        that.refreshFlashObject();
                    } else {
                        that.connect();
                    }
                }
            }, (this.options.reconnect_intervals || 3) * 1000 * (i + 1));
        }
    }
};