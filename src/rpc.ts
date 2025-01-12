import {Readable, Writable} from "node:stream";


export type RpcPacket = IncomingRpcPacket | OutgoingRpcPacket;

export type IncomingRpcPacket = {
    position: {
        channel: number,
        state: {
            position: number,
            tilt: number
        }
    }
}

export type OutgoingRpcPacket = {
    home: {
        channel: number
    }
} | {
    setup: {
        channel: number,
        init: {
            position: number,
            tilt: number
        }
        full_cycle_steps: number,
        reverse?: boolean,
        full_tilt_steps?: number
    }
} | {
    get_position: {
        channel: number
    }
};

export class RpcHandle {
    protected port: Readable & Writable;
    protected incoming: IncomingRpcPacket[] = [];
    protected incomingResolver: ((packet: IncomingRpcPacket) => void)[] = [];

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
                if (this.incomingResolver.length > 0) {
                    this.incomingResolver.shift()(JSON.parse(str));
                } else {
                    this.incoming.push(JSON.parse(str))
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

    send(packet: OutgoingRpcPacket) {
        this.port.write(serializeRpcPacket(packet));
    }

    async recv(): Promise<IncomingRpcPacket> {
        if (this.incoming.length > 0) {
            return this.incoming.shift()
        } else {
            return await new Promise((res) => {
                this.incomingResolver.push(res);
            });
        }
    }
}

const serializeRpcPacket = (packet: OutgoingRpcPacket): Buffer => {
    let str = JSON.stringify(packet);
    let buf = Buffer.alloc(str.length + 1);

    buf.writeUint8(str.length);
    buf.write(str, 1, "ascii");

    return buf;
}

export const readRpcPacket = async (read: Readable): Promise<IncomingRpcPacket> => {
    let len = read.read(1).readUint8();
    let str = null;
    while (str === null) {
        str = read.read(len);
    }

    return JSON.parse(str);
}
