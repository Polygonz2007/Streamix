// Communication with server.

import Utils from "/util.js";

// temp
const debug_info = document.querySelector("#debug-info");


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
        this.reconnect_time_init = 5000;
        this.reconnect_time_mult = 1.1; // Wait 1, 2, 4, 8, 16 seconds to reconnect...
        this.reconnect_time = this.reconnect_time_init;

        this.current_req_id = 0;
        this.reqs = [];

        // Bind functions
        this.on_ws_message = this.on_ws_message.bind(this);

        // Debug
        this.total_transfer = 0;
        this.transfer_rate = 0;
        this.transfer_time = performance.now();
        this.prev_transfer_time = this.transfer_time;
    }

    async ws_connect() {
        this.websocket = new WebSocket(this.url);

        // Connect to Websocket server
        this.websocket.addEventListener("message", this.on_ws_message);
        this._ready_res();

        return true;

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

    async ws_req(parameters) {
        // Create what we send
        if (!parameters)
            parameters = {};

        // Create ID for this request
        this.current_req_id++;
        if (this.current_req_id > 0xFFFF)
            this.current_req_id = 0;

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

    async get_frame(index) {
        // Create what we send
        const buffer = new Uint8Array(2 + 2);
        const buffer_view = new DataView(buffer.buffer);
        buffer_view.setUint16(2, index);
        
        // Create ID for this request
        this.current_req_id++;
        if (this.current_req_id > 0xFFFF)
            this.current_req_id = 0;

        const req_id = this.current_req_id;
        buffer_view.setUint16(0, req_id);

        // Send!
        if (!this.connected)
            await this.ready;
        this.websocket.send(buffer);

        // Make promise for result, add the req
        return new Promise((resolve, reject) => {
            // And add the req to buffer
            this.reqs.push({
                req_id: req_id,
                time_sent: Date.now(),

                resolve: resolve,
                reject: reject
            });
        });
    }

    async on_ws_message(event) {
        // Parse binary or JSON
        let req_id, data;
        if (event.data instanceof Blob) {
            // Parse binary and create Uint8Array from the data
            data = await event.data.arrayBuffer();
            const data_view = new DataView(data);

            let parsed = {};
            parsed.req_id = data_view.getUint16(0);
            parsed.size = data_view.getUint16(2);
            parsed.data = new Uint8Array(data.slice(4)); // Copy binary data into buffer

            data = parsed;
        } else {
            // Parse JSON
            data = JSON.parse(event.data);
        }

        // Show error if debug on
        //if (data.status !== null && data.status == false)
        //    alert(data.error);

        // Read req_id and find the corresponding request
        req_id = data.req_id;
        let req, req_pos;
        for (let i = 0; i < this.reqs.length; i++) {
            if (this.reqs[i].req_id == req_id) {
                req = this.reqs[i];
                req_pos = i;
            }
        }

        if (!req) // If we can't find the request, silently ignore
            return false;

        // Log request timestamp and size
        // TODO: Add this

        // Return data
        req.resolve(data);

        // Remove completed request
        this.reqs.splice(req_pos, 1);
        return true;
    }
}

// Export
export default Comms;
window.comms = Comms;
