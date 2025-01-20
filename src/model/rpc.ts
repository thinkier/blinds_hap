import {ChannelBound, WindowDressingInstance, WindowDressingState, WindowDressingStatePair} from "./common";


export type RpcPacket = IncomingRpcPacket | OutgoingRpcPacket;

export type IncomingRpcPacket = {
    position: ChannelBound & WindowDressingStatePair,
    ready: {}
}

export type OutgoingRpcPacket = {
    home: ChannelBound
} | {
    setup: ChannelBound & WindowDressingInstance & {
        init: WindowDressingState
    }
} | {
    set: ChannelBound & {
        position?: number,
        tilt?: number
    }
} | {
    get: ChannelBound
};
