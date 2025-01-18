import {WindowDressingInstanceConfig} from "./config";
import {
    Accessory,
    Characteristic,
    CharacteristicEventTypes,
    CharacteristicGetCallback,
    CharacteristicSetCallback, CharacteristicValue,
    Service
} from "hap-nodejs";
import * as os from "node:os";
import {IncomingRpcPacket, RpcHandle} from "./rpc";
import {WindowDressingState} from "./common";

export class WindowDressing {
    protected readonly accessory: Accessory;
    protected readonly cfg: WindowDressingInstanceConfig;
    protected readonly rpc: RpcHandle;
    protected shadowDesiredState: WindowDressingState;

    constructor(cfg: WindowDressingInstanceConfig, rpc: RpcHandle, init?: WindowDressingState) {
        this.accessory = new Accessory(`${os.hostname().replace(/-bridge$/, "")}-${cfg.channel}`, cfg.uuid);
        this.cfg = cfg;
        this.rpc = rpc;
        // Default to fully open
        this.shadowDesiredState = init ?? {position: 100, tilt: 0};
    }

    protected async setup(): Promise<Accessory> {
        await this.rpc.send({
            "setup": {
                init: this.shadowDesiredState,
                ...this.cfg
            }
        });
        this.addCovering();
        if (this.cfg.stallguard_threshold !== undefined) {
            this.addHomingButton();
        }

        return this.accessory;
    }

    protected addHomingButton() {
        let resetButton = new Service.Switch(`Reset ${this.cfg.channel}`);

        let state = resetButton.addCharacteristic(Characteristic.On)!;
        state.on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback) => {
            cb(null, false);
        });
        state.on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, cb: CharacteristicSetCallback) => {
            if (value) {
                try {
                    await this.rpc.send({"home": {channel: this.cfg.channel}});
                } catch (e) {
                    console.error(e);
                }
            }
            cb(null, false);
        });

        this.accessory.addService(resetButton);
    }

    protected addCovering() {
        let windowCovering = new Service.WindowCovering(`Blinds ${this.cfg.channel}`);
        {
            let curPos = windowCovering.addCharacteristic(Characteristic.CurrentPosition)!;
            curPos.on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback) => {
                this.getCurrentState().then((state) => {
                    cb(null, state.position);
                });
            });
            let targetPos = windowCovering.addCharacteristic(Characteristic.TargetPosition)!;
            targetPos.on(CharacteristicEventTypes.GET, async (cb: CharacteristicGetCallback) => {
                cb(null, this.shadowDesiredState.position);
            });
            targetPos.on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, cb: CharacteristicSetCallback) => {
                try {
                    await this.setPosition(value as number);
                } catch (e) {
                    console.error(e);
                }
                cb(null, value);
            });
            let posState = windowCovering.addCharacteristic(Characteristic.PositionState)!;
            posState.on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback) => {
                this.getCurrentState().then(curState => {
                    if (curState.position > this.shadowDesiredState.position) {
                        cb(null, Characteristic.PositionState.DECREASING);
                    } else if (curState.position < this.shadowDesiredState.position) {
                        cb(null, Characteristic.PositionState.INCREASING);
                    } else {
                        cb(null, Characteristic.PositionState.STOPPED);
                    }
                });
            });
        }

        if (this.cfg.full_tilt_steps !== undefined) {
            let curTilt = windowCovering.addCharacteristic(Characteristic.CurrentHorizontalTiltAngle)!;
            curTilt.on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback) => {
                this.getCurrentState().then((state) => {
                    cb(null, state.tilt);
                });
            });
            let targetTilt = windowCovering.addCharacteristic(Characteristic.TargetHorizontalTiltAngle)!;
            targetTilt.on(CharacteristicEventTypes.GET, async (cb: CharacteristicGetCallback) => {
                cb(null, this.shadowDesiredState.tilt);
            });
            targetTilt.on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, cb: CharacteristicSetCallback) => {
                try {
                    await this.setTilt(value as number);
                } catch (e) {
                    console.error(e);
                }
                cb(null, value);
            });
        }

        this.accessory.addService(windowCovering);
    }

    private async setPosition(value: number) {
        this.shadowDesiredState.position = value;

        await this.rpc.send({
            set_position: {
                channel: this.cfg.channel,
                state: this.shadowDesiredState
            }
        })
    }

    private async setTilt(value: number) {
        this.shadowDesiredState.tilt = value;

        await this.rpc.send({
            set_position: {
                channel: this.cfg.channel,
                state: this.shadowDesiredState
            }
        })
    }

    private async getCurrentState(): Promise<WindowDressingState> {
        let handler = new Promise<WindowDressingState>((res) => {
            const update = (packet: IncomingRpcPacket) => {
                if ("position" in packet && packet.position.channel === this.cfg.channel) {
                    res(packet.position.state);
                }

                this.rpc.unsubscribe(update);
            }

            this.rpc.subscribe(update);
        })

        await this.rpc.send({get_position: {channel: this.cfg.channel}});
        return await handler;
    }
}
