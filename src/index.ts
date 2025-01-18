import {SerialPort} from "serialport";
import {RpcHandle} from "./comms/rpc";
import {readHomeKit} from "./config/homekit";
import {WindowDressing} from "./integration/window_dressing";
import {readAccessories} from "./config/accessories";

const port = new SerialPort({
    path: "/dev/serial0",
    baudRate: 115200,
});

const rpc = new RpcHandle(port);
const accessories = readAccessories();
const hk = readHomeKit();

rpc.subscribe(console.log);

const main = async () => {
    for (let instance of accessories.instances) {
        let acc = await new WindowDressing(instance, rpc)
            .setup();
        await acc.publish({...hk});
    }

}
main();
