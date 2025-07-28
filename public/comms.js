// Communication with server.

const Comms = new class {
    constructor() {
        // Connect to websocket server
        const url = `ws://${window.location.host}`;
        this.websocket = new WebSocket(url);

        this.current_req_id = 0;
        this.reqs = [];

        this.websocket.addEventListener("open", () => {
            console.log("Connected to WebSocket server.");
        });
    }

    async get_json(url) {
        try {
            const response = await fetch(url);

            // Handle response
            let data = await response.json();
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
}

Comms.websocket.addEventListener("message", async (event) => {
    const data = await event.data.arrayBuffer();
  
    // Get type
    const data_view = new DataView(data)
    const req_id = data_view.getUint16(0, true);
    console.log(`Received ws req with ID #${req_id}`)
    let req, req_pos;

    // Find our beloved request
    for (let i = 0; i < Comms.reqs.length; i++) {
        if (Comms.reqs[i].req_id == req_id) {
            req = Comms.reqs[i];
            req_pos = i;
        }
    }

    if (!req)
        return false;

    // Log time taken
    const after = Date.now();
    console.log(`Buffer request #${req.req_id}\nTrip time: ${after - req.time_sent}ms`);

    // Do it
    req.resolve(data);

    // Remove request because it succeded
    Comms.reqs.splice(req_pos, 1);
    return true;
});

export default Comms;