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
import {RpcHandle} from "../comms/rpc";
import {getHapHostName} from "./bridge";

export class WindowDressing {
    protected readonly accessory: Accessory;
    protected readonly cfg: WindowDressingInstanceConfig;
    protected readonly rpc: RpcHandle;
    protected position: WindowDressingStatePair;

    public constructor(cfg: WindowDressingInstanceConfig, rpc: RpcHandle, init?: WindowDressingState) {
        const variant = cfg.full_tilt_steps === undefined ? "Roller" : "Venetian";

        this.accessory = new Accessory(`${getHapHostName()} ${variant} ${cfg.channel}`, cfg.uuid);
        this.cfg = cfg;
        this.rpc = rpc;

        const setupChannel = async () => {
            let curpos = this?.position?.current ?? init;

            await this.rpc.send({
                "setup": {
                    channel: this.cfg.channel,
                    init: curpos,
                    full_cycle_steps: this.cfg.full_cycle_steps,
                    reverse: this.cfg.reverse,
                    full_tilt_steps: this.cfg.full_tilt_steps,
                }
            });
            require("debug")("BlindsHAP:WindowDressing:SetupChannel")(`Channel ${this.cfg.channel} had been setup`);
        };

        require("debug")("BlindsHAP:WindowDressing:SetupChannel")(`Channel ${this.cfg.channel} had constructed. Requesting state...`);
        this.rpc.send({
            "get": {
                channel: this.cfg.channel
            }
        });

        let initState = false;
        this.rpc.subscribe(incoming => {
            if ("ready" in incoming) {
                setupChannel();
            } else if ("absent" in incoming && incoming.absent.channel === this.cfg.channel) {
                setupChannel();
            } else if ("position" in incoming && incoming.position.channel === this.cfg.channel) {
                this.position = incoming.position;

                if (incoming.position.notify) {
                    this.notifyAccessory();
                }

                if (!initState) {
                    initState = true;
                    require("debug")("BlindsHAP:WindowDressing:SetupChannel")(`Received initial state for channel ${this.cfg.channel}`);
                }
            }
        });

        setInterval(() => {
            this.rpc.send({
                "get": {
                    channel: this.cfg.channel
                }
            });
        }, 2000);
    }

    public setupAccessory(): Accessory {
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
                    .then(() => state.sendEventNotification(false))
                    .then(() => this.accessory
                        .getService(`Blinds ${this.cfg.channel}`)
                        .getCharacteristic(Characteristic.PositionState)
                        .updateValue(Characteristic.PositionState.INCREASING))
                    .catch(err => cb(err));
            } else {
                cb();
            }
        });

        this.accessory.addService(resetButton);
    }

    protected notifyAccessory() {
        let name = `Blinds ${this.cfg.channel}`;
        let windowCovering = this.accessory.getService(name);

        {
            windowCovering
                .getCharacteristic(Characteristic.CurrentPosition)
                .updateValue(this.position.current.position);

            if (this.cfg.full_tilt_steps !== undefined) {
                windowCovering
                    .getCharacteristic(Characteristic.CurrentHorizontalTiltAngle)
                    .updateValue(this.position.current.tilt);
            }
        }

        require("debug")("BlindsHAP:WindowDressing:Notify")(`Pushing new position data for ${name}`);
    }

    protected addCovering() {
        let windowCovering = new Service.WindowCovering(`Blinds ${this.cfg.channel}`);
        {
            let curPos = windowCovering.getCharacteristic(Characteristic.CurrentPosition)!;
            curPos.on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback) => {
                cb(null, this.position.current.position);
            });
            let targetPos = windowCovering.getCharacteristic(Characteristic.TargetPosition)!;
            targetPos.on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback) => {
                cb(null, this.position.desired.position);
            });
            targetPos.on(CharacteristicEventTypes.SET, (value: CharacteristicValue, cb: CharacteristicSetCallback) => {
                this.setPosition(value as number)
                    .then(() => cb())
                    .catch(err => cb(err));
            });
            let posState = windowCovering.getCharacteristic(Characteristic.PositionState)!;
            posState.on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback) => {
                let {current, desired} = this.position;

                if (current.position > desired.position) {
                    cb(null, Characteristic.PositionState.DECREASING);
                } else if (current.position < desired.position) {
                    cb(null, Characteristic.PositionState.INCREASING);
                } else {
                    cb(null, Characteristic.PositionState.STOPPED);
                }
            });
        }

        if (this.cfg.full_tilt_steps !== undefined) {
            let curTilt = windowCovering.addCharacteristic(Characteristic.CurrentHorizontalTiltAngle)!;
            curTilt.on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback) => {
                cb(null, this.position.current.tilt);

            });
            let targetTilt = windowCovering.addCharacteristic(Characteristic.TargetHorizontalTiltAngle)!;
            targetTilt.on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback) => {
                cb(null, this.position.desired.tilt);
            });
            targetTilt.on(CharacteristicEventTypes.SET, (value: CharacteristicValue, cb: CharacteristicSetCallback) => {
                this.setTilt(value as number)
                    .then(() => cb())
                    .catch(err => cb(err));
            });
        }

        this.accessory.addService(windowCovering);
    }

    private setPositionCursor?: [NodeJS.Timeout, (_: void) => void] = undefined;

    private async setPosition(position: number) {
        await new Promise((res, rej) => {
            if (this.setPositionCursor !== undefined) {
                clearTimeout(this.setPositionCursor[0]);
                this.setPositionCursor[1](undefined);
                this.setPositionCursor = undefined;
            }

            let timeout = setTimeout(() => {
                this.rpc.send({
                    set: {
                        channel: this.cfg.channel,
                        position
                    }
                }).then(res).catch(rej)
            }, 50);
            this.setPositionCursor = [timeout, res];
        });
    }

    private setTiltCursor?: [NodeJS.Timeout, (_: void) => void] = undefined;

    private async setTilt(tilt: number) {
        await new Promise((res, rej) => {
            if (this.setTiltCursor !== undefined) {
                clearTimeout(this.setTiltCursor[0]);
                this.setTiltCursor[1](undefined);
                this.setTiltCursor = undefined;
            }

            let timeout = setTimeout(() => {
                this.rpc.send({
                    set: {
                        channel: this.cfg.channel,
                        tilt
                    }
                }).then(res).catch(rej)
            }, 50);
            this.setTiltCursor = [timeout, res];
        });
    }
}
