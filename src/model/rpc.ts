import {ChannelBound, WindowDressingInstance, WindowDressingState} from "./common";


export type RpcPacket = IncomingRpcPacket | OutgoingRpcPacket;

export type IncomingRpcPacket = {
    position: ChannelBound & {
        state: WindowDressingState
    }
}

export type OutgoingRpcPacket = {
    home: ChannelBound
} | {
    setup: ChannelBound & WindowDressingInstance & {
        init: WindowDressingState
    }
} | {
    set_position: ChannelBound & {
        state: WindowDressingState
    }
} | {
    get_position: ChannelBound
};
