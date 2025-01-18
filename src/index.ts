import {SerialPort} from "serialport";
import {RpcHandle} from "./comms/rpc";
import {readHomeKit} from "./config/homekit";
import {WindowDressing} from "./integration/window_dressing";
import {readAccessories} from "./config/accessories";
import {Bridge, Categories} from "hap-nodejs";
import {createBridge} from "./integration/bridge";

const port = new SerialPort({
    path: "/dev/serial0",
    baudRate: 115200,
});

const rpc = new RpcHandle(port);
const accessories = readAccessories();
const hk = readHomeKit();

const main = async () => {
    const bridge = createBridge(hk);

    bridge.addBridgedAccessories(await Promise.all(accessories.instances.map(async cfg => {
        return await new WindowDressing(cfg, rpc)
            .setup()
    })));
    await bridge.publish({...hk, category: Categories.BRIDGE});

}
main();
