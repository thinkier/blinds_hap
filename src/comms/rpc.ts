import {Readable, Writable} from "node:stream";
import {IncomingRpcPacket, OutgoingRpcPacket} from "../model/rpc";


export class RpcHandle {
    protected port: Readable & Writable;
    protected subscribers: ((packet: IncomingRpcPacket) => void)[] = [];

    constructor(port: Readable & Writable) {
        this.port = port;
        let buf = Buffer.alloc(0);

        port.on("data", (data: Buffer) => {
            // Concatenate new data onto existing buffer
            buf = Buffer.concat([buf, data]);

            let len = buf.readUint8();
            while (buf.length > len) {
                // Extract the json
                let str = buf.toString("ascii", 1, len + 1);
                // Emit the content
                for (let sub of this.subscribers) {
                    sub(JSON.parse(str))
                }
                // Cleanup the buffer & prepare for next iteration0
                buf = buf.subarray(len + 1);
                if (buf.length === 0) {
                    break;
                }
                len = buf.readUint8();
            }
        });
    }

    async send(packet: OutgoingRpcPacket): Promise<void> {
        let str = JSON.stringify(packet);
        let buf = Buffer.alloc(str.length + 1);

        buf.writeUint8(str.length);
        buf.write(str, 1, "ascii");

        return new Promise((res, rej) => {
            this.port.write(buf, (err) => {
                if (err) {
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
}