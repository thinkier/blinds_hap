import {SerialPort} from "serialport";
import {RpcHandle} from "./rpc";

const port = new SerialPort({
    path: "/dev/serial0",
    baudRate: 115200,
});

port.setEncoding("ascii");
port.on("data", console.log);
const rpc = new RpcHandle(port);

rpc.send({
    setup: {
        channel: 3,
        init: {
            position: 0,
            tilt: 90
        },
        full_cycle_steps: 100000,
    }
});

rpc.send({
    home: {
        channel: 3
    }
});

setInterval(() => {
    rpc.send({
        get_position: {
            channel: 3
        }
    });
}, 100);
