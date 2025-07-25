// Communication with server.

const Comms = new class {
    constructor() {
        // Connect to websocket server
        const url = `ws://${window.location.host}`;
        this.websocket = new WebSocket(url);

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
}

export default Comms;