import {Readable, Writable} from "node:stream";
import {ChannelBound, WindowDressingState} from "./model/common";
import {WindowDressingInstanceConfig} from "./model/config";


export type RpcPacket = IncomingRpcPacket | OutgoingRpcPacket;

export type IncomingRpcPacket = {
    position: ChannelBound & {
        state: WindowDressingState
    }
}

export type OutgoingRpcPacket = {
    home: ChannelBound
} | {
    setup: ChannelBound & WindowDressingInstanceConfig & {
        init: WindowDressingState
    }
} | {
    get_position: ChannelBound
};

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

    send(packet: OutgoingRpcPacket) {
        this.port.write(serializeRpcPacket(packet));
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
