// Communication with server.

import Utils from "./util.js";

const Comms = new class {
    constructor() {
        // Websocket info
        this.url = `ws://${window.location.host}`;
        this.websocket;
        this.connected = false;
        this.connecting = false;

        this._ready_res;
        this.ready = new Promise((res, rej) => {
            this._ready_res = res;
        });

        // Reconnecting info
        this.reconnect_time_init = 2000;
        this.reconnect_time_mult = 1.2; // Wait 1, 2, 4, 8, 16 seconds to reconnect...
        this.reconnect_time = this.reconnect_time_init;

        this.current_req_id = 0;
        this.reqs = [];

        // Bind functions
        this.on_ws_message = this.on_ws_message.bind(this);

        // Connect to Websocket server
        this.connect_ws();
    }

    async connect_ws() {
        this.connecting = true;
        this.reconnect_time = this.reconnect_time_init;

        // Try until reconnect time gets to more than 5 minutes or we loaded
        while (!this.connected && this.reconnect_time < 300 * 1000) {
            console.log("Attemting to connect to websocket.");
            console.log(`Reconnect time: ${this.reconnect_time}`)
            this.websocket = new WebSocket(this.url);

            this.websocket.addEventListener("open", () => {
                console.log("Connected to WebSocket server.");
                this.connected = true;
                this.connecting = false;
                this._ready_res(); // resolve so stuff can happen again
            });

            this.websocket.addEventListener("message", this.on_ws_message);

            this.websocket.addEventListener("error", () => {
                if (this.websocket)
                    this.websocket.close();
            });

            this.websocket.addEventListener("close", () => {
                this.connected = false;

                if (!this.connecting) {
                    // Create promise
                    this.ready = new Promise((res, rej) => {
                        this._ready_res = res;
                    });

                    // Connect
                    this.connect_ws();
                }
            })
            
            await Utils.wait(this.reconnect_time);
            this.reconnect_time *= this.reconnect_time_mult;
        }
    }

    async fetch_json(url) {
        try {
            const response = await fetch(url);

            // Handle response
            let data = await response.json();
            return data;
        } catch {
            return false;
        }
    }

    async fetch_buffer(url) {
        try {
            const response = await fetch(url);

            // Handle response
            let data = await response.arrayBuffer();
            return data;
        } catch {
            return false;
        }
    }

    async post_json(url, payload) {
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {"Content-type": "application/json"},
                body: JSON.stringify(payload)
            });

            // Response
            const data = await response.json();
            return data;
        } catch {
            return false;
        }
    }

    async get_buffer(parameters) {
        // Create what we send
        if (!parameters)
            parameters = {};

        // Create ID for this request
        this.current_req_id++;
        parameters.req_id = this.current_req_id;

        // Send!
        const payload = JSON.stringify(parameters);

        if (!this.connected)
            await this.ready;
        this.websocket.send(payload);

        // Make promise for result, add the req
        return new Promise((resolve, reject) => {
            // And add the req to buffer
            this.reqs.push({
                req_id: parameters.req_id,
                time_sent: Date.now(),

                resolve: resolve,
                reject: reject
            });
        });
    }

    async on_ws_message(event) {
        const data = await event.data.arrayBuffer();
    
        // Get type
        const data_view = new DataView(data)
        const req_id = data_view.getUint16(0, true);
        let req, req_pos;

        // Find our beloved request
        for (let i = 0; i < this.reqs.length; i++) {
            if (this.reqs[i].req_id == req_id) {
                req = this.reqs[i];
                req_pos = i;
            }
        }

        if (!req)
            return false;

        // Log time taken
        const after = Date.now();
        //console.log(`Buffer Request #${req.req_id}\nTrip time: ${after - req.time_sent}ms`);

        // Do it
        req.resolve(data);

        // Remove request because it succeded
        this.reqs.splice(req_pos, 1);
        return true;
    }
}

export default Comms;