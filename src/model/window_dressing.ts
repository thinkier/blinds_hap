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
import {RpcHandle} from "./rpc";
import {WindowDressingState} from "./common";

export class WindowDressing {
    protected readonly accessory: Accessory;
    protected readonly cfg: WindowDressingInstanceConfig;
    protected readonly rpc: RpcHandle;
    protected shadowSetState: WindowDressingState;

    constructor(cfg: WindowDressingInstanceConfig, rpc: RpcHandle, init?: WindowDressingState) {
        this.accessory = new Accessory(`${os.hostname().replace(/-bridge$/, "")}-${cfg.channel}`, cfg.uuid);
        this.cfg = cfg;
        this.rpc = rpc;
        // Default to fully open
        this.shadowSetState = init ?? {position: 100, tilt: 0};
    }

    protected async setup(): Promise<Accessory> {
        await this.rpc.send({
            "setup": {
                init: this.shadowSetState,
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
        let resetButton = new Service.Switch("Reset");

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
        })

        this.accessory.addService(resetButton);
    }

    protected addCovering() {
        let windowCovering = new Service.WindowCovering();

        const isVenetian = this.cfg.full_tilt_steps !== undefined;

        this.accessory.addService(windowCovering);
    }
}
