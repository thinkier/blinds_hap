export interface WindowDressingState {
    position: number,
    tilt: number
}

export interface WindowDressingStatePair {
    current: WindowDressingState,
    desired: WindowDressingState
}

export interface WindowDressingInstance {
    full_cycle_steps: number,
    reverse?: boolean,
    full_tilt_steps?: number,
}

export type Channel = 0 | 1 | 2 | 3;

export interface ChannelBound {
    channel: Channel
}
