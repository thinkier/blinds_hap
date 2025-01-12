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

    constructor(port: Readable & Writable) {
        this.port = port;
    }

    send(packet: OutgoingRpcPacket) {
        this.port.write(serializeRpcPacket(packet));
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
