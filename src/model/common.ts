export interface WindowDressingState {
    position: number,
    tilt: number
}

export type Channel = 0 | 1 | 2 | 3;

export interface ChannelBound {
    channel: Channel
}
