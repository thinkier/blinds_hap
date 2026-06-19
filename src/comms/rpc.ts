import {Readable, Writable} from "node:stream";
import {IncomingRpcPacket, OutgoingRpcPacket} from "../model/rpc";


export class RpcHandle {
    protected port: Readable & Writable;
    protected subscribers: ((packet: IncomingRpcPacket) => void)[] = [];

    constructor(port: Readable & Writable) {
        this.port = port;
        let buf = Buffer.alloc(0);

        let debug = require("debug")("BlindsHAP:Proto:IncomingRpcPacket");
        port.on("data", (data: Buffer) => {
            // Concatenate new data onto existing buffer
            buf = Buffer.concat([buf, data]);

            let len = data.indexOf("\n");

            if (len >= 0) {
                // Extract the json
                let str = buf.toString("ascii", 0, len);
                try {
                    // Emit the content
                    let packet = JSON.parse(str);
                    debug(packet);
                    for (let sub of this.subscribers) {
                        sub(packet);
                    }
                } catch (e) {
                    require("debug")("BlindsHAP:Proto:Incoming")("Failed to read packet, draining buffer");
                    buf = Buffer.alloc(0);
                }
                // Cleanup the buffer & prepare for next iteration0
                buf = buf.subarray(len + 1);
            }
        });
    }

    async send(packet: OutgoingRpcPacket): Promise<void> {
        let debug = require("debug")("BlindsHAP:Proto:OutgoingRpcPacket");
        debug(packet);

        let str = JSON.stringify(packet);
        let buf = Buffer.alloc(str.length + 1, "\n", "ascii");

        buf.write(str);

        return new Promise((res, rej) => {
            this.port.write(buf, (err) => {
                if (err) {
                    require("debug")("BlindsHAP:Proto:Outgoing")(err);
                    rej(err)
                } else {
                    res(undefined);
                }
            });
        })
    }

    subscribe(callback: (packet: IncomingRpcPacket) => void) {
        this.subscribers.push(callback);
    }

    unsubscribe(callback: (packet: IncomingRpcPacket) => void) {
        let idx = this.subscribers.indexOf(callback);
        if (idx !== -1) {
            this.subscribers.splice(idx, 1);
        }
    }

    reset() {
        require("debug")("BlindsHAP:Session")("Attempting to reset the target device");
        this.port.write(Buffer.from([0]));
    }
}
