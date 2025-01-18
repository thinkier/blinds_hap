import os from "node:os";
import {Bridge} from "hap-nodejs";
import {HomeKitConfigFile} from "../config/homekit";

export function getHapHostName(fullName: boolean = false) {
    let name = os.hostname();

    if (!fullName) {
        name = name.replace(/-bridge$/, "");
    }

    name = name.replace(/[_-]+/, ' ');

    let frags = name.split(' ')
        .map(frag => frag.length > 0 ? `${frag.charAt(0).toUpperCase()}${frag.slice(1)}` : frag)

    return frags.join(' ');
}

export const createBridge = (hk: HomeKitConfigFile) => {
    return new Bridge(getHapHostName(true), hk.bridge_uuid);
}
