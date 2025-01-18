import jsyaml from "js-yaml"
import * as fs from "node:fs";
import {ChannelBound, WindowDressingInstance} from "../model/common";

export type WindowDressingInstanceConfig = ChannelBound & WindowDressingInstance & {
    uuid: string,
    stallguard_threshold?: number
}

export interface AccessoryConfigFile {
    instances: WindowDressingInstanceConfig[]
}

export function readAccessories(path = "config/accessories.yml"): AccessoryConfigFile {
    return jsyaml.load(fs.readFileSync(path, 'utf8')) as AccessoryConfigFile
}
