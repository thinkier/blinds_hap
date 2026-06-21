import {ChannelBound, Notifiable, WindowDressingInstance, WindowDressingState, WindowDressingStatePair} from "./common";


export type IncomingRpcPacket = {
    position: ChannelBound & Notifiable & WindowDressingStatePair
} | {
    ready: {}
} | {
    absent: {
        channel: number
    }
} | {
    stall_guard_result: ChannelBound & {
        sg_result: number
    }
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
} | {
    get_stall_guard_result: ChannelBound
};
