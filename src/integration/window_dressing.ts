import {WindowDressingInstanceConfig} from "../config/accessories";
import {
    Accessory,
    Characteristic,
    CharacteristicEventTypes,
    CharacteristicGetCallback,
    CharacteristicSetCallback, CharacteristicValue,
    Service
} from "hap-nodejs";
import {WindowDressingState, WindowDressingStatePair} from "../model/common";
import {IncomingRpcPacket} from "../model/rpc";
import {RpcHandle} from "../comms/rpc";
import {getHapHostName} from "./bridge";

export class WindowDressing {
    protected readonly accessory: Accessory;
    protected readonly cfg: WindowDressingInstanceConfig;
    protected readonly rpc: RpcHandle;

    public constructor(cfg: WindowDressingInstanceConfig, rpc: RpcHandle, init?: WindowDressingState) {
        this.accessory = new Accessory(`${getHapHostName()} ${cfg.channel}`, cfg.uuid);
        this.cfg = cfg;
        this.rpc = rpc;

        this.rpc.send({
            "setup": {
                channel: this.cfg.channel,
                // Default to fully open
                init: init ?? {position: 100, tilt: 0},
                full_cycle_steps: this.cfg.full_cycle_steps,
                reverse: this.cfg.reverse,
                full_tilt_steps: this.cfg.full_tilt_steps,
            }
        });
    }

    public setup(): Accessory {
        this.addCovering();
        if (this.cfg.stallguard_threshold !== undefined) {
            this.addHomingButton();
        }

        return this.accessory;
    }

    protected addHomingButton() {
        let resetButton = new Service.Switch(`Reset ${this.cfg.channel}`);

        let state = resetButton.getCharacteristic(Characteristic.On)!;
        state.on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback) => {
            cb(null, false);
        });
        state.on(CharacteristicEventTypes.SET, (value: CharacteristicValue, cb: CharacteristicSetCallback) => {
            if (value) {
                this.rpc.send({"home": {channel: this.cfg.channel}})
                    .then(() => cb())
                    .catch(err => cb(err));
            }
        });

        this.accessory.addService(resetButton);
    }

    protected addCovering() {
        let windowCovering = new Service.WindowCovering(`Blinds ${this.cfg.channel}`);
        {
            let curPos = windowCovering.getCharacteristic(Characteristic.CurrentPosition)!;
            curPos.on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback) => {
                this.getState()
                    .then(state => state.current)
                    .then((state) => {
                        cb(null, state.position);
                    });
            });
            let targetPos = windowCovering.getCharacteristic(Characteristic.TargetPosition)!;
            targetPos.on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback) => {
                this.getState()
                    .then(state => state.desired)
                    .then((state) => {
                        cb(null, state.position);
                    });
            });
            targetPos.on(CharacteristicEventTypes.SET, (value: CharacteristicValue, cb: CharacteristicSetCallback) => {
                this.setPosition(value as number)
                    .then(() => cb())
                    .catch(err => cb(err));
            });
            let posState = windowCovering.getCharacteristic(Characteristic.PositionState)!;
            posState.on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback) => {
                this.getState()
                    .then(({current, desired}) => {
                        if (current.position > desired.position) {
                            cb(null, Characteristic.PositionState.DECREASING);
                        } else if (current.position < desired.position) {
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
                this.getState()
                    .then(state => state.current)
                    .then(state => {
                        cb(null, state.tilt);
                    });
            });
            let targetTilt = windowCovering.addCharacteristic(Characteristic.TargetHorizontalTiltAngle)!;
            targetTilt.on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback) => {
                this.getState()
                    .then(state => state.current)
                    .then(state => {
                        cb(null, state.tilt);
                    })
                    .catch(err => cb(err));
            });
            targetTilt.on(CharacteristicEventTypes.SET, (value: CharacteristicValue, cb: CharacteristicSetCallback) => {
                this.setTilt(value as number)
                    .then(() => cb())
                    .catch(err => cb(err));
            });
        }

        this.accessory.addService(windowCovering);
    }

    private async setPosition(position: number) {
        await this.rpc.send({
            set: {
                channel: this.cfg.channel,
                position
            }
        })
    }

    private async setTilt(tilt: number) {
        await this.rpc.send({
            set: {
                channel: this.cfg.channel,
                tilt
            }
        })
    }

    private async getState(): Promise<WindowDressingStatePair> {
        let handler = new Promise<WindowDressingStatePair>((res, rej) => {
            let timeout = setTimeout(() => {
                this.rpc.reset();
                rej(new Error("Timeout detected"));
            }, 5000);

            const update = (packet: IncomingRpcPacket) => {
                if ("position" in packet && packet.position.channel === this.cfg.channel) {
                    res({
                        current: packet.position.current,
                        desired: packet.position.desired
                    });
                }

                clearTimeout(timeout);
                this.rpc.unsubscribe(update);
            }

            this.rpc.subscribe(update);
        })

        await this.rpc.send({get: {channel: this.cfg.channel}});
        return await handler;
    }
}
